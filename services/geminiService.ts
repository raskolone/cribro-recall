import { auth } from '../firebase';

import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Language, Difficulty, Word, AISuggestion, AudioVocabulary, TranslationExercise, TranslationEvaluationResult } from '../types';


export const extractJSON = (text: string): string => {
  if (!text) return "{}";
  
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }
  
  if (startIdx !== -1) {
    const endBrace = text.lastIndexOf('}');
    const endBracket = text.lastIndexOf(']');
    
    let endIdx = -1;
    if (endBrace !== -1 && endBracket !== -1) {
      endIdx = Math.max(endBrace, endBracket);
    } else if (endBrace !== -1) {
      endIdx = endBrace;
    } else if (endBracket !== -1) {
      endIdx = endBracket;
    }
    
    if (endIdx !== -1 && endIdx > startIdx) {
      return text.substring(startIdx, endIdx + 1);
    }
  }
  
  return text.trim();
};


let aiInstance: GoogleGenAI | null = null;
export const getAI = () => {
  if (!aiInstance) {
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    aiInstance = new GoogleGenAI({ apiKey: key || 'dummy_key' });
  }
  return aiInstance;
};

const generateContentWithFallback = async (params: any) => {
  const models = params.preferredModels || PREFERRED_AI_MODELS;
  const { preferredModels, ...apiParams } = params;

  let lastError;
  for (const model of models) {
    try {
      console.log(`Attempting generation with ${model}...`);
      
      const promptText = typeof apiParams.contents === 'string' ? apiParams.contents : 
                         (Array.isArray(apiParams.contents) ? apiParams.contents.map((c: any) => {
                           if (typeof c === 'string') return c;
                           if (c.text) return c.text;
                           if (c.inlineData) return "[Załączono plik, który nie może być bezpośrednio przetworzony jako tekst]";
                           return JSON.stringify(c);
                         }).join('\n') : JSON.stringify(apiParams.contents));
      const sysInst = apiParams.config?.systemInstruction || "You are a helpful AI assistant.";

      if (model.startsWith('openai')) {
         const isJsonMode = apiParams.config?.responseMimeType === 'application/json';
         const openAiRes = await callOpenAI(promptText, sysInst, model.replace('openai/', ''), isJsonMode);
         return { text: openAiRes.text };
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000);
      });
      
      const apiCall = getAI().models.generateContent({
        ...apiParams,
        model,
      });

      const response = await Promise.race([apiCall, timeoutPromise]);
      return response as any;
    } catch (e: any) {
      console.warn(`Model ${model} failed:`, e?.status || e?.message);
      lastError = e;
      if (e?.message === 'Missing OPENAI_API_KEY') {
        throw e;
      }
      if (e?.message?.includes("timed out")) continue;
      if (String(e?.status) === "404" || String(e?.status) === "503" || String(e?.status) === "429" || e?.message?.includes("503") || e?.message?.includes("429")) continue;
      if (String(e?.status) === "400" && e?.message?.includes("not found")) continue;
      continue;
    }
  }
  throw lastError;
};

const callOpenAI = async (prompt: string, systemInstruction: string, model: string = "gpt-4o-mini", isJson: boolean = true): Promise<{ text: string, modelUsed?: string }> => {
  console.log("Wysyłam zapytanie do OpenAI przez proxy (" + model + ")...");
  
  try {
    const res = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        systemInstruction,
        isJson,
        model
      })
    });
    
    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Serwer zwrócił nieprawidłową odpowiedź (status ${res.status}): ${rawText.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || `Błąd serwera AI (${res.status})`);
    }
    
    console.log("Odpowiedź AI odebrana pomyślnie. Model:", data.modelUsed);
    return { text: data.text || "", modelUsed: data.modelUsed };
  } catch (error) {
    console.error("Błąd wywołania OpenAI:", error);
    throw error;
  }
};

export const PREFERRED_AI_MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4-turbo',
  'openai/gpt-3.5-turbo',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

export const formatAIModelName = (model?: string): string => {
  if (!model) return 'OpenAI (GPT-4o mini)';
  if (model.includes('gpt-4o-mini')) return 'OpenAI (GPT-4o mini)';
  if (model.includes('gpt-4o')) return 'OpenAI (GPT-4o)';
  if (model.includes('gpt-4-turbo')) return 'OpenAI (GPT-4 Turbo)';
  if (model.includes('gpt-4')) return 'OpenAI (GPT-4)';
  if (model.includes('gemini-2.5')) return 'Gemini 2.5 Flash';
  if (model.includes('gemini-2.0')) return 'Gemini 2.0 Flash';
  if (model.includes('gemini-1.5')) return 'Gemini 1.5 Flash';
  if (model.includes('gemini')) return 'Gemini Flash';
  return model;
};

export const generateTextWithUnifiedFallback = async (
  prompt: string,
  systemInstruction: string,
  preferredModels: string[] = PREFERRED_AI_MODELS,
  geminiConfig?: any,
  onModelAttempt?: (model: string) => void
): Promise<{ text: string, modelUsed: string }> => {
  let lastError;
  
  for (const model of preferredModels) {
    try {
      console.log(`Attempting generation with ${model}...`);
      if (onModelAttempt) {
        onModelAttempt(model);
      }
      
      if (model.startsWith('openai')) {
        const isJson = geminiConfig?.responseMimeType === 'application/json';
        const openAiRes = await callOpenAI(prompt, systemInstruction, model.replace('openai/', ''), isJson);
        if (openAiRes && openAiRes.text) {
          const usedModel = openAiRes.modelUsed
            ? (openAiRes.modelUsed.startsWith('gemini') || openAiRes.modelUsed.startsWith('openai')
                ? openAiRes.modelUsed
                : `openai/${openAiRes.modelUsed}`)
            : model;
          return { text: openAiRes.text, modelUsed: usedModel };
        }
      } else if (model.startsWith('gemini')) {
        let retries = 3;
        while (retries > 0) {
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000);
            });
            
            const apiCall = getAI().models.generateContent({
              model,
              contents: prompt,
              config: {
                systemInstruction,
                ...(geminiConfig || {})
              }
            });

            const response: any = await Promise.race([apiCall, timeoutPromise]);
            const text = response?.text;
            if (text) {
              return { text, modelUsed: model };
            }
          } catch (gErr: any) {
            console.warn(`Gemini model ${model} attempt failed (retries left ${retries - 1}):`, gErr?.message || gErr);
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 1500));
            } else {
              throw gErr;
            }
          }
        }
      }
    } catch (error: any) {
      console.warn(`Model ${model} failed:`, error?.message || error);
      lastError = error;
      if (error?.message === 'Missing OPENAI_API_KEY') {
        throw error;
      }
    }
  }
  throw lastError || new Error("All AI fallback models failed.");
};

const vocabularySchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING },
      ipa: { type: Type.STRING, description: "IPA transcription of the word" },
      definition: { type: Type.STRING, description: "A simple definition in English" },
      example: { type: Type.STRING, description: "An example sentence using the word" }
    },
    required: ['word', 'ipa', 'definition', 'example']
  }
};

const suggestionSchema = {
  type: Type.OBJECT,
  properties: {
    paragraph: {
      type: Type.STRING,
      description: "An engaging paragraph using at least 3 of the difficult words."
    },
    wordSuggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          synonym: { type: Type.STRING },
          antonym: { type: Type.STRING }
        },
        required: ['word', 'synonym', 'antonym']
      }
    }
  },
  required: ['paragraph', 'wordSuggestions']
};


export const generateVocabulary = async (language: Language, difficulty: Difficulty): Promise<Omit<Word, 'id' | 'isDifficult' | 'language'>[]> => {
  const prompt = `Generate a list of 10 unique ${language} vocabulary words for the ${difficulty} CEFR level. For each word, provide: the word itself, its IPA transcription, a simple definition in English, and an example sentence. Do not repeat words.`;
  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json",
        responseSchema: vocabularySchema,
      } });
    let jsonText = extractJSON(response?.text || "");
    
    let parsed = JSON.parse(jsonText);
    if (parsed && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.cards)) return parsed.cards;
      if (Array.isArray(parsed.flashcards)) return parsed.flashcards;
      if (Array.isArray(parsed.vocabulary)) return parsed.vocabulary;
      if (Array.isArray(parsed.items)) return parsed.items;
      return [];
    }
    return parsed;

  } catch (error: any) {
    console.error("Error generating vocabulary:", error);
    throw new Error(error.message || "Failed to generate vocabulary.");
  }
};

const sentenceGeneratorSchema = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          english_sentence: { type: Type.STRING, description: "Clean, natural English sentence." },
          polish_translation: { type: Type.STRING, description: "Naturalne polskie tłumaczenie." },
          target_word_used: { type: Type.STRING, description: "The single target word used in this sentence." },
          hint: { type: Type.STRING, description: "Krótka podpowiedź po polsku. MUSI zawierać kluczowe/trudne słówka z tego zdania w języku angielskim oraz wskazówkę gramatyczną (np. jakiego czasu użyć)." },
          puzzleChunks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of sentence chunks for the warmup exercise. Keep phrases logical (e.g. phrasal verbs together, don't split very short words)." }
        },
        required: ['english_sentence', 'polish_translation', 'hint', 'puzzleChunks']
      }
    }
  },
  required: ['sentences']
};

const evaluationResultSchema = {
  type: Type.OBJECT,
  properties: {
    evaluations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          score: { type: Type.INTEGER, description: "Total score (0-100) = meaning_score + grammar_score + vocabulary_score" },
          is_correct: { type: Type.BOOLEAN, description: "True if sentence translation is acceptable/accurate (score >= 75)" },
          breakdown: {
            type: Type.OBJECT,
            properties: {
              meaning_score: { type: Type.INTEGER, description: "Meaning & Accuracy score (0-40)" },
              grammar_score: { type: Type.INTEGER, description: "Grammar & Syntax score (0-40)" },
              vocabulary_score: { type: Type.INTEGER, description: "Target Vocabulary & Spelling score (0-20)" }
            },
            required: ["meaning_score", "grammar_score", "vocabulary_score"]
          },
          feedback: { type: Type.STRING, description: "Krótkie, ogólne wyjaśnienie błędu po polsku." },
          feedbackSyntax: { type: Type.STRING, description: "Wyjaśnienie błędów gramatycznych lub szyku (po polsku)." },
          feedbackVocab: { type: Type.STRING, description: "Wyjaśnienie błędów słownikowych (po polsku)." },
          feedbackRule: { type: Type.STRING, description: "Złota zasada, żeby uniknąć błędu w przyszłości (po polsku)." },
          suggested_better_version: { type: Type.STRING, description: "Idealne zdanie alternatywne." },
          highlighted_better_version: { type: Type.STRING, description: "Sugerowana odpowiedź z zaznaczonymi błędami ucznia. Użyj tagu <span class='text-red-500 font-bold'>...</span> aby objąć fragmenty, które uczeń napisał źle, a Ty je poprawiłeś w sugerowanej wersji." }
        },
        required: ["score", "is_correct", "breakdown", "feedback", "suggested_better_version", "highlighted_better_version"]
      }
    }
  },
  required: ["evaluations"]
};

export const generateTranslationExercises = async (
  level: string,
  words: string[],
  customPrompt?: string,
  lessonContext?: string,
  studentProfileContext?: string,
  numSentences: number = 5,
  pastExercisesContext?: string,
  mistakesContext?: string,
  isGrammar?: boolean,
  onModelAttempt?: (model: string) => void
): Promise<TranslationExercise[]> => {
  const shortLesson = lessonContext ? `\n\n[LESSON / TOPIC CONTEXT]:\n${lessonContext.substring(0, 1000)}` : '';
  const shortProfile = studentProfileContext ? `\n\n[STUDENT SPECIFIC INSTRUCTIONS & PROFILE]:\n${studentProfileContext}` : '';
  const shortPast = pastExercisesContext ? `\n\n[PAST EXERCISES TO AVOID REPEATS]:\n${pastExercisesContext.substring(0, 5000)}` : '';
  const shortMistakes = mistakesContext ? `\n\n[STUDENT MISTAKES (AREAS TO IMPROVE)]:\n${mistakesContext.substring(0, 5000)}` : '';

  const masterPrompt = `ROLE:
You are an expert English Language Content Creator and AI Pedagogue specializing in adaptive, highly personalized language practice.

MASTER GENERATION PIPELINE - EXECUTE IN THIS EXACT SEQUENTIAL ORDER:

STEP 1: ANALYZE STUDENT PROFILE & DIRECTIVES
First, carefully read [STUDENT SPECIFIC INSTRUCTIONS & PROFILE] below. Learn who the student is, their target proficiency level (${level || 'B2'}), their interests, background, and any ironclad teacher rules or AI prompt overrides.

STEP 2: ANALYZE LESSON HISTORY & PROGRESSION
Second, examine [LESSON / TOPIC CONTEXT]. Review the topics, grammar theory, vocabulary, and teacher notes covered in the student's previous lessons. Every exercise must feel like a natural continuation of their ongoing learning journey.

STEP 3: ANALYZE FREQUENT MISTAKES & WEAKNESSES
Third, examine [STUDENT MISTAKES (AREAS TO IMPROVE)]. Review the frequent errors, grammar pitfalls, and difficult words recorded for this student.
- ADAPTIVE DIFFICULTY: If the student frequently makes errors in a specific area, incorporate targeted practice sentences for those weaknesses. As their error rate decreases and accuracy improves, dynamically increase vocabulary difficulty and sentence complexity.

STEP 4: APPLY SELECTED GENERATION SCOPE
Fourth, review the material selected by the student/teacher for this generation run:
- Target Vocabulary List: ${words.length > 0 ? words.join(', ') : 'Vocabulary from recent lessons'}
- Selected CEFR Level: ${isGrammar ? 'Grammar Database Match' : (level || 'B2')}
- Number of Sentences: ${numSentences}

STEP 5: GENERATE NATURAL, LOGICAL SENTENCES
Synthesize Steps 1-4 to generate ${numSentences} unique, natural, and highly realistic translation/puzzle exercises.

CRITICAL QUALITY RULES:
- ZASADA ŻELAZNA - KOLEJNOŚĆ WIDZENIA KONTEKSTU: Master Prompt w pierwszej kolejności analizuje profil kursanta i jego wytyczne, następnie sprawdza historię lekcji oraz często popełniane błędy, a na koniec uwzględnia wybrany przez kursanta zakres materiału do wygenerowania!
- ZASADA ŻELAZNA - LOGIKA I KONTEKST ŻYCIOWY (IRONCLAD SEMANTIC REALISM): Wyjściowe zdania (zarówno po angielsku, jak i po polsku) MUSISZ tworzyć w 100% logiczne, sensowne, praktyczne i realistyczne. Kategorycznie zakazuje się generowania stwierdzeń dziwacznych, sztucznych, bezmyślnych kalk językowych lub zdań brzmiących niedorzecznie.
- ZASADA ŻELAZNA - BEZWZGLĘDNA SPÓJNOŚĆ I NATURALNOŚĆ POLSKICH TŁUMACZEŃ (NATURAL POLISH TRANSLATION):
  Tłumaczenie wyjściowe w języku polskim (pole \`polish_translation\`) MUSI mieć pełną spójność logiczną, być gramatycznie bezbłędne i brzmieć dokładnie tak, jak powiedziałby to rodzimy użytkownik języka polskiego (native speaker) w autentycznej rozmowie. Nie stwarzaj dosłownych kalk słowo-w-słowo ani niezgrabnych zwrotów.
- DOSTOSOWANIE DO POZIOMU KURSANTA: Wygenerowane zdania MUSZĄ być ściśle dopasowane do poziomu kursanta (${isGrammar ? 'dostosuj do bazy gramatycznej' : (level || 'B2')}). Słownictwo, struktury gramatyczne oraz długość zdań muszą bezpośrednio odpowiadać danemu poziomowi (A1: 4-8 słów; A2: 5-9 słów; B1/B2: 8-12 słów; C1/C2: 10-15 słów).
- CONTEXT & NATURALNESS: Sentences MUST sound like real-world communication. Maximum 1 target word per sentence so it sounds natural. Maximum sentence length: 16 words.
- HINT REQUIREMENT: Pole \`hint\` musi ZAWSZE zawierać kluczowe trudne słowa z danego zdania (angielskie) wraz z tłumaczeniem, plus krótką wskazówkę co do użytej struktury gramatycznej.
- ANTI-REPETITION: Do NOT generate sentences structurally identical or extremely similar to those in [PAST EXERCISES TO AVOID REPEATS].`;

  const studentContextBlock = `${shortProfile}${shortLesson}${shortPast}${shortMistakes}`;
  const customBlock = customPrompt ? `\n\n[ADDITIONAL INSTRUCTIONS / PROMPT OVERRIDE]:\n${customPrompt}` : '';

  const finalPrompt = `${masterPrompt}${studentContextBlock}${customBlock}

CRITICAL RULE: The field \`polish_translation\` MUST NEVER be in English. It MUST be the Polish translation. Do NOT output English in the polish_translation field.

OUTPUT FORMAT (Strict JSON):
Return ONLY a valid JSON object matching this schema. No markdown, no extra conversational text:
{
  "sentences": [
    {
      "id": 1,
      "english_sentence": "Clean, natural English sentence.",
      "polish_translation": "Naturalne polskie tłumaczenie.",
      "target_word_used": "word",
      "hint": "Wskazówka po polsku",
      "puzzleChunks": ["Clean,", "natural English", "sentence."]
    }
  ]
}`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemInstruction = "You are an expert English Language Content Creator specializing in adaptive, personalized language practice. IRONCLAD RULE: Every generated sentence MUST be strictly logical, natural, and make complete real-world sense to teach authentic context (never generate senseless or bizarre sentences just to test vocabulary). Always prioritize natural logic, practical communication context, and strict JSON output. SPECIAL INSTRUCTION FOR PUZZLE CHUNKS: 1) If the target sentence has FEWER THAN 8 words (< 8 words): split into mostly SINGLE WORDS or small pairs (e.g. phrasal verbs 'look up', prepositions 'in the'). 2) If the target sentence has 8 OR MORE WORDS (>= 8 words): group into LARGER logical phrase chunks (2-4 words per chunk, e.g. 'I decided to go', 'to the grocery store', 'after work'). Limit long sentences to 3 to 5 chunks maximum so it is achievable and serves as a good warmup before typing.";
      
      const preferredModels = PREFERRED_AI_MODELS;
      const geminiConfig = {
        responseMimeType: "application/json",
        responseSchema: sentenceGeneratorSchema,
      };

      let fallbackRes1 = await generateTextWithUnifiedFallback(
        finalPrompt,
        systemInstruction,
        preferredModels,
        geminiConfig,
        onModelAttempt
      );
      let responseText = fallbackRes1.text;
      let modelUsed = fallbackRes1.modelUsed;

      // Krok 2: Weryfikacja i poprawa logiczna
      const verificationPrompt = `Przeanalizuj poniższe wygenerowane zdania w formacie JSON:
${responseText}

TWOJE ZADANIE: Sprawdź spójność logiczną i sens każdego zdania. Upewnij się, że zdania są w 100% logiczne, sensowne i naturalne w realnym świecie, a nie robotyczne, dziwaczne czy sztuczne. Zdania mają uczyć poprawnego, autentycznego kontekstu! Jeśli jakiekolwiek zdanie jest bez sensu, sztuczne lub dziwne, OD RAZU popraw je na w pełni logiczne i życiowe, zachowując docelowe słownictwo.
PAMIĘTAJ: Pole \`polish_translation\` (lub \`polishSentence\`) MUSI być ZAWSZE po polsku. Pole \`english_sentence\` (lub \`englishTranslation\`) MUSI być ZAWSZE po angielsku. Upewnij się, że nie pozamieniałeś języków miejscami!

Zwróć skorygowany wynik WYŁĄCZNIE jako poprawny obiekt JSON, zachowując dokładnie tę samą strukturę (klucze).`;

      let fallbackRes2 = await generateTextWithUnifiedFallback(
        verificationPrompt,
        systemInstruction,
        preferredModels,
        geminiConfig,
        onModelAttempt
      );
      if (fallbackRes2.text) {
        responseText = fallbackRes2.text;
        modelUsed = fallbackRes2.modelUsed;
      }

      let jsonText = extractJSON(responseText || "");
      let parsedRaw: any = null;
      try {
        parsedRaw = JSON.parse(jsonText);
      } catch (parseErr) {
        console.warn(`JSON parse error on attempt ${attempt}:`, parseErr);
      }

      let sentenceList: any[] = [];
      if (Array.isArray(parsedRaw)) {
        sentenceList = parsedRaw;
      } else if (parsedRaw && Array.isArray(parsedRaw.sentences)) {
        sentenceList = parsedRaw.sentences;
      }

      const exercises: TranslationExercise[] = sentenceList.map((item: any) => {
        const polishSentence = item.polish_translation || item.polishSentence || '';
        const englishTranslation = item.english_sentence || item.englishTranslation || '';
        const targetWord = item.target_word_used || item.targetWord || '';
        const hint = item.hint || (targetWord ? `Użyj słówka: '${targetWord}'` : '');

        return {
          polishSentence,
          englishTranslation,
          hint,
          puzzleChunks: item.puzzleChunks || undefined,
          modelUsed,
        };
      }).filter(ex => ex.polishSentence && ex.englishTranslation);

      if (exercises && exercises.length > 0) {
        return exercises;
      }
      console.warn(`Attempt ${attempt}: Received empty exercises, retrying...`);
    } catch (error: any) {
      console.error(`Error generating translation exercises on attempt ${attempt}:`, error);
      if (attempt === MAX_RETRIES) {
        throw new Error(error.message || "Failed to generate translation exercises from AI.");
      }
    }
  }
  return [];
};

export const evaluateTranslations = async (
  exercises: TranslationExercise[],
  studentAnswers: string[],
  strictnessPrompt: string,
  evalStudentContext: string,
  onModelAttempt?: (model: string) => void
): Promise<TranslationEvaluationResult[]> => {
  const masterEvalPrompt = `ROLE:
You are a fair, highly intelligent AI Language Evaluator.

TASK:
Evaluate the student's translation based ONLY on the provided target sentence and expected meaning. Accept any grammatically correct, natural phrasing or valid synonym. You MUST provide categorized feedback to help the student improve.

CRITICAL ISOLATION RULE:
Evaluate ONLY the data provided in the current input block. Ignore any previous sentences or chat history.

GRADING RUBRIC (Total Score: 100%):
1. Meaning & Accuracy (40%): Does the translation convey the exact intended meaning? Accept valid synonyms and natural reformulations! (Max 40 points)
2. Grammar & Syntax (40%): Are tenses, word order, prepositions, and articles correct? (Max 40 points)
3. Target Vocabulary & Spelling (20%): Is the key vocabulary used correctly and spelled properly? (Max 20 points)

IMPORTANT GRADING RULES:
- ZASADA INTERPUNKCJI (PUNCTUATION RULE): Interpunkcja (kropka na końcu zdania, przecinki, pytajniki, cudzysłowy) oraz wielkie litery są dobrą praktyką i są potrzebne, ALE NIE SŁUŻĄ DO ODEJMOWANIA PUNKTÓW. BEZWZGLĘDNIE ZABRANIA SIĘ odejmowania punktów lub obniżania oceny za brak lub błędy w interpunkcji / braki wielkich liter. Błędy interpunkcyjne NIE MOGĄ wpływać na ogólną ocenę punktową ani powodować obniżenia wyniku.
- If the student's input is a completely valid, natural English translation (even if missing a full stop, comma, or capital letter), award high or full marks (85-100%). Do NOT unfairly penalize for valid synonyms, natural phrasing variations, or missing punctuation.
- CRITICAL: If the student's input is a random string (e.g. "asdf"), completely wrong, irrelevant, missing ("(brak odpowiedzi)"), or in the wrong language, you MUST assign: meaning_score: 0, grammar_score: 0, vocabulary_score: 0, score: 0, and is_correct: false.
- Deduct points for grammar errors, wrong vocabulary, or missing words (do NOT deduct points for punctuation or capitalization).
- Calculate total score = meaning_score + grammar_score + vocabulary_score.
- Set is_correct to true ONLY if total score >= 75 AND the core meaning is preserved.

FEEDBACK REQUIREMENTS (CRITICAL):
If the answer is NOT perfect (score < 100), you MUST provide:
- feedbackSyntax: Explain grammar or word order mistakes (in Polish).
- feedbackVocab: Explain vocabulary errors or suggest more natural words (in Polish).
- feedbackRule (Golden Rule): A short, memorable rule to help avoid this mistake in the future (in Polish).
If the answer is correct, you can leave these empty or provide positive reinforcement.

INPUT DATA:
${exercises.map((ex, i) => `---
[Item ${i + 1}]
Original Target Sentence: ${ex.polishSentence}
Expected Reference Meaning: ${ex.englishTranslation}
Student Input: ${studentAnswers[i] || "(brak odpowiedzi)"}`).join('\n')}`;

  const fullPrompt = `${masterEvalPrompt}

${evalStudentContext ? `[STUDENT CONTEXT]:\n${evalStudentContext}` : ''}
${strictnessPrompt ? `[ADDITIONAL EVALUATION INSTRUCTIONS]:\n${strictnessPrompt}` : ''}

OUTPUT FORMAT (Strict JSON):
Return ONLY a valid JSON object matching this schema. No markdown, no extra conversational text:
{
  "evaluations": [
    {
      "polishSentence": "Polish text",
      "correctTranslation": "English text",
      "studentAnswer": "Student text",
      "isCorrect": true/false,
      "score": 0-100,
      "explanation": "Brief explanation",
      "suggested_better_version": "Better translation",
      "feedbackSyntax": "Syntax feedback",
      "feedbackVocab": "Vocab feedback",
      "feedbackRule": "Rule feedback",
      "breakdown": {
        "meaning_score": 0-40,
        "grammar_score": 0-40,
        "vocabulary_score": 0-20
      }
    }
  ]
}`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemInstruction = "You are a fair, intelligent AI Language Evaluator. Evaluate translations strictly according to the rubric and return valid JSON. CRITICAL PUNCTUATION RULE: Do NOT deduct points or penalize scores for missing or incorrect punctuation/capitalization (punctuation is needed/good practice, but must NOT lower the score).";
      
      // Priority: OpenAI GPT-4o-mini, with fallback to available OpenAI models and then Gemini models
      const preferredModels = PREFERRED_AI_MODELS;
      const geminiConfig = {
        responseMimeType: "application/json",
        responseSchema: evaluationResultSchema,
      };

      const fallbackRes = await generateTextWithUnifiedFallback(
        fullPrompt,
        systemInstruction,
        preferredModels,
        geminiConfig,
        onModelAttempt
      );
      const responseText = fallbackRes.text;
      const modelUsed = fallbackRes.modelUsed;

      let jsonText = extractJSON(responseText || "");
      let parsedRaw: any = null;
      try {
        parsedRaw = JSON.parse(jsonText);
      } catch (pErr) {
        console.warn(`JSON parse error on attempt ${attempt}:`, pErr);
      }

      let evalList: any[] = [];
      if (Array.isArray(parsedRaw)) {
        evalList = parsedRaw;
      } else if (parsedRaw && Array.isArray(parsedRaw.evaluations)) {
        evalList = parsedRaw.evaluations;
      }

      if (!evalList || evalList.length !== exercises.length) {
        console.warn(`Attempt ${attempt}: Evaluation length mismatch. Expected ${exercises.length}, got ${evalList?.length || 0}. Retrying...`);
        if (attempt === MAX_RETRIES) {
          throw new Error("AI returned invalid evaluation format.");
        }
        continue;
      }

      const results: TranslationEvaluationResult[] = exercises.map((ex, i) => {
        const item = evalList[i] || {};
        const meaningScore = typeof item.breakdown?.meaning_score === 'number'
          ? item.breakdown.meaning_score
          : (typeof item.score === 'number' ? Math.min(40, Math.round(item.score * 0.4)) : 40);

        const grammarScore = typeof item.breakdown?.grammar_score === 'number'
          ? item.breakdown.grammar_score
          : (typeof item.score === 'number' ? Math.min(40, Math.round(item.score * 0.4)) : 40);

        const vocabScore = typeof item.breakdown?.vocabulary_score === 'number'
          ? item.breakdown.vocabulary_score
          : (typeof item.score === 'number' ? Math.min(20, Math.round(item.score * 0.2)) : 20);

        const calculatedScore = typeof item.score === 'number'
          ? item.score
          : (meaningScore + grammarScore + vocabScore);

        const isCorrect = typeof item.is_correct === 'boolean'
          ? item.is_correct
          : (typeof item.isCorrect === 'boolean' ? item.isCorrect : calculatedScore >= 75);

        const feedback = item.feedback || item.explanation || (isCorrect ? 'Świetne, naturalne tłumaczenie!' : 'Sprawdź sugerowane poprawki.');
        const suggested = item.suggested_better_version || item.correctTranslation || ex.englishTranslation;

        return {
          polishSentence: ex.polishSentence,
          correctTranslation: suggested,
          studentAnswer: studentAnswers[i] || '',
          isCorrect,
          score: Math.min(100, Math.max(0, calculatedScore)),
          explanation: feedback,
          suggested_better_version: suggested,
          feedbackSyntax: item.feedbackSyntax || '',
          feedbackVocab: item.feedbackVocab || '',
          feedbackRule: item.feedbackRule || '',
          breakdown: {
            meaning_score: meaningScore,
            grammar_score: grammarScore,
            vocabulary_score: vocabScore
          },
          modelUsed,
        };
      });

      if (results && results.length > 0) {
        return results;
      }
      console.warn(`Attempt ${attempt}: Received empty evaluation, retrying...`);
    } catch (error: any) {
      console.error(`Error evaluating translations on attempt ${attempt}:`, error);
      if (attempt === MAX_RETRIES) {
        throw new Error(error.message || "Failed to evaluate translations with AI.");
      }
    }
  }
  return [];
};


export const generateTest = async (
  level: string,
  testTitle: string,
  scope: string,
  studentProfile: string,
  lessonContext: string,
  allLessonsContext: string,
  tasksCount: number,
  attemptsLimit: number,
  selectedTypes: string[] = ['multiple_choice', 'fill_in_blank', 'translation'],
  fileData?: { data: string; mimeType: string } | null,
  driveFile?: { id: string, mimeType: string, token: string },
  typeCounts?: Record<string, number>
): Promise<any[]> => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  
  const payload = {
      level,
      testTitle,
      scope,
      studentProfile,
      lessonContext,
      allLessonsContext,
      tasksCount,
      attemptsLimit,
      selectedTypes,
      typeCounts,
      fileData,
      driveFile
    };

  const res = await fetch('/api/gemini/generate-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    try {
        const errData = JSON.parse(errText);
        throw new Error(errData.error || 'Failed to generate test');
    } catch(e) {
        throw new Error(`Server error (${res.status}): Invalid response.`);
    }
  }
  
  const data = await res.json();
  return data.questions || [];
};


export const generateFlashcardsFromText = async (text: string, termLang: string, defLang: string): Promise<any[]> => {
  const prompt = `Analyze the following text and extract vocabulary words/phrases from it.
Text: ${text}
Source language of terms: ${termLang}
Target language for definitions: ${defLang}

For each term found, provide:
1. The term itself.
2. A clear definition or translation in the target language.
3. An example context sentence in the source language (no translation needed).

Return a JSON array of objects.`;

  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json"
      } });
    let jsonText = extractJSON(response?.text || "");
    
    let parsed = JSON.parse(jsonText);
    if (parsed && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.cards)) return parsed.cards;
      if (Array.isArray(parsed.flashcards)) return parsed.flashcards;
      if (Array.isArray(parsed.vocabulary)) return parsed.vocabulary;
      if (Array.isArray(parsed.items)) return parsed.items;
      return [];
    }
    return parsed;

  } catch (err) {
    console.error("Error generating flashcards from text:", err);
    throw new Error("Failed to parse vocabulary from text.");
  }
};

export const generateFlashcardsFromTopicWithGPT = async (
  topic: string,
  count: number = 10,
  termLang: string = 'en',
  defLang: string = 'pl'
): Promise<any[]> => {
  const prompt = `Jesteś ekspertem dydaktyki języka angielskiego. Wygeneruj zestaw ${count} przydatnych fiszek słów/zwrotów na temat: "${topic}".
Język pojęć (term): ${termLang} (np. po angielsku)
Język definicji/tłumaczeń (definition): ${defLang} (np. po polsku)

Dla każdego słówka/zwrotu podaj:
1. term: słówko lub zwrot w języku docelowym (${termLang})
2. definition: polskie tłumaczenie lub krótka definicja (${defLang})
3. contextSentence: proste, naturalne zdanie przykładowe po angielsku (${termLang})

Zwróć WYŁĄCZNIE tablicowy obiekt JSON, w którym każdy element to obiekt o kluczach: "term", "definition", "contextSentence".`;

  const sysInst = "Jesteś asystentem AI tworzącym zestawy fiszek w formacie JSON dla modelu gpt-4o-mini.";

  try {
    const openAiRes = await callOpenAI(prompt, sysInst, 'gpt-4o-mini', true);
    const jsonText = extractJSON(openAiRes.text || "");
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : (parsed.flashcards || parsed.words || parsed.items || []);
    return list;
  } catch (err) {
    console.warn("GPT-4o-mini direct call failed, trying fallback:", err);
    try {
      const resp = await generateContentWithFallback({ contents: prompt, config: { systemInstruction: sysInst } });
      const jsonText = extractJSON(resp?.text || "");
      const parsed = JSON.parse(jsonText);
      return Array.isArray(parsed) ? parsed : (parsed.flashcards || parsed.words || parsed.items || []);
    } catch (e2) {
      console.error("Failed to generate flashcards from topic with AI:", e2);
      return [];
    }
  }
};

export const generateContextSentence = async (term: string, termLang: string): Promise<string> => {
  const prompt = `Write a short, clear, and natural example sentence using the following term.
Term: "${term}"
Language: ${termLang}
Only return the sentence, nothing else.`;

  try {
    const response = await generateContentWithFallback({ contents: prompt });
    return response?.text.trim();
  } catch (err) {
    console.error("Error generating context sentence:", err);
    return "";
  }
};

export const generateImageForTerm = async (term: string, context?: string): Promise<string | null> => {
  const prompt = `A clear, educational, and high-quality illustration representing the concept of "${term}". ${context ? `Context: ${context}.` : ''} Minimalist and clean style.`;
  
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/jpeg;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (err) {
    console.error("Error generating image:", err);
    return null;
  }
};

export const modifyTest = async (
  currentQuestions: any[],
  feedback: string,
  level: string,
  studentProfile: string,
  lessonContext: string
): Promise<any[]> => {
  const prompt = `Jesteś asystentem edukacyjnym. Nauczyciel zgłosił uwagi do wygenerowanego wcześniej testu:

UWAGI NAUCZYCIELA:
"${feedback}"

AKTUALNE PYTANIA (JSON):
${JSON.stringify(currentQuestions)}

Popraw ten test zgodnie z uwagami nauczyciela, trzymając się żelaznych zasad: 
1. Dopasowanie do profilu: ${studentProfile}
2. Poziom: ${level}
3. Użycie słownictwa z lekcji: ${lessonContext}

Zwróć 10 poprawionych zadań jako JSON (tablica obiektów). Zastąp te, które się nie podobały, pozostaw dobre.`;

  const schema = {
    type: Type.ARRAY,
    description: "Array of test questions",
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['multiple_choice', 'fill_in_blank', 'fill_in_blank_bank', 'translation', 'matching', 'writing', 'find_mistake'] },
        instruction: { type: Type.STRING },
        prompt: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        wordBank: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        correctAnswer: { type: Type.STRING },
        hint: { type: Type.STRING, nullable: true },
      },
      required: ["id", "type", "prompt", "correctAnswer"],
    },
  };

  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      } });

    let jsonText = extractJSON(response?.text || "");
    
    let parsed = JSON.parse(jsonText);
    if (parsed && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.cards)) return parsed.cards;
      if (Array.isArray(parsed.flashcards)) return parsed.flashcards;
      if (Array.isArray(parsed.vocabulary)) return parsed.vocabulary;
      if (Array.isArray(parsed.items)) return parsed.items;
      return [];
    }
    return parsed;

  } catch (error) {
    console.error("Error modifying test:", error);
    throw new Error("Failed to modify test.");
  }
};


export const getUserWeaknesses = async (userId: string): Promise<string> => {
  if (!userId || userId === 'demo-id') {
    return "Brak zidentyfikowanych błędów.";
  }
  try {
    const weaknessesRef = collection(db, `users/${userId}/weaknesses`);
    const q = query(weaknessesRef, orderBy('frequency', 'desc'), limit(15));
    const snapshot = await getDocs(q);
    
    let userDocWeaknesses: string[] = [];
    try {
      const userSnap = await getDoc(doc(db, `users/${userId}`));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (Array.isArray(uData.frequentErrors) && uData.frequentErrors.length > 0) {
          userDocWeaknesses = uData.frequentErrors;
        }
      }
    } catch (e) {
      // Ignore user doc read errors
    }

    if (snapshot.empty && userDocWeaknesses.length === 0) {
      return "Brak zidentyfikowanych błędów.";
    }

    const collectionWeaknesses = snapshot.docs.map(doc => {
      const data = doc.data();
      return `- Błąd/Problem: "${data.name || doc.id}" (częstość: ${data.frequency || 1}) ${data.description ? `[Kontekst: ${data.description}]` : ''}`;
    });

    const additionalFromDoc = userDocWeaknesses
      .filter(err => !snapshot.docs.some(d => d.data()?.name?.toLowerCase() === err.toLowerCase()))
      .map(err => `- Częsty błąd z profilu: "${err}"`);

    const allWeaknessesList = [...collectionWeaknesses, ...additionalFromDoc];

    return allWeaknessesList.join('\n');
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn("Permission denied fetching weaknesses:", error.message);
    } else {
      console.error("Error fetching user weaknesses:", error);
    }
    return "Brak zidentyfikowanych błędów.";
  }
};

export const generateDynamicExercise = async (
  userId: string,
  exerciseType: 'quiz' | 'flashcards' | 'match' | 'fill_in_blank',
  topicOrVocabulary: string,
  level: string
): Promise<any> => {
  const weaknessesList = await getUserWeaknesses(userId);

  const prompt = `Jesteś zaawansowanym asystentem lektora języka angielskiego (Cribro Recall). Twoim zadaniem jest wygenerowanie zestawu interaktywnych ćwiczeń na podstawie dostarczonego tematu lub słownictwa.

[START KONTEKST UCZNIA - PRIORYTET]
Uczeń często popełnia następujące błędy:
${weaknessesList || "Brak zidentyfikowanych błędów."}
Tworząc ćwiczenia, MUSISZ przemycić w nich konstrukcje, które zmuszą ucznia do poprawnego użycia powyższych zagadnień (np. jeśli uczeń myli much/many, dodaj zdania z tymi słowami jako luki do uzupełnienia lub opcje w quizie).
[KONIEC KONTEKST UCZNIA]

Wymagania:
Język docelowy: Angielski
Język instrukcji/tłumaczeń: Polski
Poziom trudności: ${level}
Typ ćwiczenia: ${exerciseType}
Temat/Słownictwo: ${topicOrVocabulary}

Zwróć wynik WYŁĄCZNIE jako obiekt JSON o następującej strukturze, w zależności od typu ćwiczenia:

Dla "quiz":
{
  "type": "quiz",
  "title": "Tytuł",
  "questions": [
    { "question": "Pytanie", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "Wyjaśnienie" }
  ]
}

Dla "flashcards":
{
  "type": "flashcards",
  "title": "Tytuł",
  "cards": [
    { "front": "Pojęcie", "back": "Tłumaczenie/Definicja", "example": "Przykład użycia" }
  ]
}

Dla "match":
{
  "type": "match",
  "title": "Tytuł",
  "pairs": [
    { "left": "Pojęcie", "right": "Dopasowanie" }
  ]
}

Dla "fill_in_blank":
{
  "type": "fill_in_blank",
  "title": "Tytuł",
  "sentences": [
    { "text": "Zdanie z [LUKA]", "answer": "odpowiedź", "hint": "Wskazówka" }
  ]
}`;

  try {
    const systemInstruction = "Jesteś zaawansowanym asystentem lektora języka angielskiego. Skupiasz się na poprawności merytorycznej i dostarczasz poprawny JSON.";
    const preferredModels = PREFERRED_AI_MODELS;
    const geminiConfig = {
      responseMimeType: "application/json",
    };

    let fallbackRes1 = await generateTextWithUnifiedFallback(prompt, systemInstruction, preferredModels, geminiConfig);
    let responseText = fallbackRes1.text;

    const verificationPrompt = `Przeanalizuj poniższe wygenerowane ćwiczenie w formacie JSON:
${responseText}

TWOJE ZADANIE: Sprawdź spójność logiczną i sens wygenerowanych treści. Upewnij się, że są naturalne, logiczne i poprawne językowo, unikając sztucznego lub robotycznego języka. W razie potrzeby popraw je, tak aby ułatwiały uczenie się przez skojarzenia.
Zwróć skorygowany wynik WYŁĄCZNIE jako poprawny obiekt JSON, zachowując dokładnie taką samą strukturę.`;

    let fallbackRes2 = await generateTextWithUnifiedFallback(verificationPrompt, systemInstruction, preferredModels, geminiConfig);
    responseText = fallbackRes2.text;

    let jsonText = extractJSON(responseText || "");
    
    let parsed = JSON.parse(jsonText);
    if (parsed && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.cards)) return parsed.cards;
      if (Array.isArray(parsed.flashcards)) return parsed.flashcards;
      if (Array.isArray(parsed.vocabulary)) return parsed.vocabulary;
      if (Array.isArray(parsed.items)) return parsed.items;
      return [];
    }
    return parsed;

  } catch (error) {
    console.error("Error generating dynamic exercise:", error);
    throw new Error("Failed to generate exercise from AI.");
  }
};

export const formatFlashcardsWithAI = async (text: string): Promise<{ formattedText: string, termLang: string, defLang: string }> => {
  const prompt = `You are an AI assistant. Analyze the following unstructured vocabulary text.
1. Detect the main language of the terms (the foreign words to learn). Return language code (e.g., 'en', 'es', 'de', 'pl').
2. Detect the main language of the definitions (the user's native language, usually Polish 'pl' or English 'en').
3. Clean up the text, fix typos, and format it strictly as a list of "term\tdefinition" (separated by a single tab character). Do not include markdown code blocks.

Text:
${text}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      termLang: { type: Type.STRING },
      defLang: { type: Type.STRING },
      formattedText: { type: Type.STRING }
    },
    required: ["termLang", "defLang", "formattedText"]
  };

  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const textResult = response?.text;
    if (!textResult) throw new Error("No response");
    
    return JSON.parse(textResult);
  } catch (error) {
    console.error("Flashlight AI Error:", error);
    throw new Error("Failed to format flashcards.");
  }
};

export const logMistakesToFirebase = async (userId: string, mistakes: string[]) => {
  if (!userId || userId === 'demo-id' || !mistakes || mistakes.length === 0) return;
  try {
    const cleanMistakes: string[] = [];
    for (const mistake of mistakes) {
      if (!mistake || typeof mistake !== 'string' || mistake.trim() === '') continue;
      const cleanName = mistake.trim();
      cleanMistakes.push(cleanName);
      const safeId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
      if (!safeId) continue;

      const mistakeRef = doc(db, `users/${userId}/weaknesses`, safeId);
      const snap = await getDoc(mistakeRef);
      if (snap.exists()) {
        await updateDoc(mistakeRef, { 
          frequency: increment(1),
          lastOccurred: new Date().toISOString()
        });
      } else {
        await setDoc(mistakeRef, { 
          name: cleanName, 
          frequency: 1, 
          description: 'Zidentyfikowane przez AI podczas ćwiczeń tłumaczeniowych / fiszek.',
          lastOccurred: new Date().toISOString()
        });
      }
    }

    // Also update frequentErrors array on user profile doc
    if (cleanMistakes.length > 0) {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const existingErrors: string[] = Array.isArray(uData.frequentErrors) ? uData.frequentErrors : [];
        const merged = Array.from(new Set([...cleanMistakes, ...existingErrors])).slice(0, 30);
        await updateDoc(userRef, { frequentErrors: merged });
      }
    }
  } catch (error) {
    console.error("Error logging mistakes:", error);
  }
};

export const gradeTest = async (
  testTitle: string,
  questions: any[],
  studentAnswers: Record<string, string>
): Promise<{score: number, feedback: string}> => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  
  const res = await fetch('/api/gemini/grade-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      testTitle,
      questions,
      studentAnswers
    })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    try {
        const errData = JSON.parse(errText);
        throw new Error(errData.error || 'Failed to grade test');
    } catch(e) {
        throw new Error(`Server error (${res.status}): Invalid response.`);
    }
  }
  return await res.json();
};

export const generateHomework = async (topic: string, summary: string, words: string): Promise<string> => {
  const prompt = `Jako doświadczony nauczyciel języka angielskiego, wygeneruj spersonalizowaną pracę domową dla ucznia na podstawie odbytej lekcji.
  Temat lekcji: ${topic}
  Podsumowanie lekcji: ${summary}
  Przerobione słownictwo: ${words}
  
  Praca domowa powinna być krótka, angażująca i utrwalać przerobiony materiał. Zaproponuj 3-5 zdań do przetłumaczenia na angielski, kilka pytań otwartych do odpowiedzi pisemnej po angielsku lub krótkie ćwiczenie (np. "uzupełnij luki") polegające na użyciu słownictwa z lekcji. Zwróć wynik w formacie Markdown. Pisz bezpośrednio do ucznia w przyjaznym tonie po polsku.`;

  try {
    const response = await generateContentWithFallback({ contents: prompt });
    return response?.text || "";
  } catch (error) {
    console.error("Error generating homework:", error);
    throw new Error("Failed to generate homework.");
  }
};

export const generateFillInTheBlankExercises = async (
  level: string,
  topicOrWords?: string,
  numSentences: number = 5,
  customPrompt?: string
): Promise<{ textWithBlanks: string; blanks: Record<string, string>; availableWords: string[] }> => {
  const prompt = `ROLE:
Jesteś doświadczonym nauczycielem języka angielskiego.

ZADANIE:
Wygeneruj spójny krótki tekst (opowiadanie, artykuł lub dialog) po angielsku na poziomie ${level || 'B1-B2'}.
W tekście zastąp około ${numSentences} kluczowych słów lub wyrażeń specjalnymi znacznikami [BLANK_1], [BLANK_2], itd. (od 1 do ${numSentences}).

${topicOrWords ? `TEMAT / SŁOWNICTWO, na którym ma się opierać tekst: ${topicOrWords}` : ''}
${customPrompt ? `DODATKOWE INSTRUKCJE OD NAUCZYCIELA: ${customPrompt}` : ''}

Zwróć wynik WYŁĄCZNIE jako poprawny obiekt JSON o strukturze:
{
  "textWithBlanks": "This is a [BLANK_1] of the text. It contains [BLANK_2] placeholders.",
  "blanks": {
    "BLANK_1": "sample",
    "BLANK_2": "several"
  },
  "availableWords": ["sample", "several", "extra", "words"] // Include all correct answers plus optionally 1-2 distractor words
}`;

  try {
    const response = await generateContentWithFallback({ contents: prompt });
    const text = response?.text || '';
    const jsonText = extractJSON(text);
    const parsed = JSON.parse(jsonText);
    
    if (parsed && parsed.textWithBlanks && parsed.blanks) {
      if (!parsed.availableWords || parsed.availableWords.length === 0) {
        parsed.availableWords = Object.values(parsed.blanks);
        // shuffle
        parsed.availableWords = parsed.availableWords.sort(() => Math.random() - 0.5);
      }
      return parsed as { textWithBlanks: string; blanks: Record<string, string>; availableWords: string[] };
    }
    throw new Error('Invalid format returned by AI');
  } catch (error) {
    console.error('Error generating fill-in-the-blank exercise:', error);
    throw error;
  }
};

export const evaluateErrorCorrectionSentence = async (
  incorrectSentence: string,
  correctSentence: string,
  studentAnswer: string
): Promise<{ isCorrect: boolean; score: number; explanation: string; suggestedVersion: string }> => {
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      isCorrect: false,
      score: 0,
      explanation: "Brak odpowiedzi.",
      suggestedVersion: correctSentence
    };
  }

  const prompt = `Sprawdź, czy uczeń poprawnie poprawił błędne zdanie w języku angielskim.

Błędne zdanie: "${incorrectSentence}"
Wzorcowa poprawka: "${correctSentence}"
Odpowiedź ucznia: "${studentAnswer}"

ZADANIE:
Oceń odpowiedź ucznia (punktacja 0-100%, flaga isCorrect, wyjaśnienie po polsku i sugerowana poprawna wersja). 
Jeśli odpowiedź ucznia jest poprawną gramatycznie i znaczeniowo wersją bez błędu (nawet jeśli różni się drobnym szczegółem od wzorca, np. "does not" zamiast "doesn't", albo brakuje jej kropki/przecinka/wielkiej litery), uznaj ją za w pełni poprawną (isCorrect: true, score: 100).
ZASADA INTERPUNKCJI: Pamiętaj, że brak lub błędy interpunkcji (kropka, przecinek, wielka litera) NIE MOGĄ być powodem do odejmowania punktów ani uznania odpowiedzi za błędną.

Zwróć czysty JSON:
{
  "isCorrect": true,
  "score": 100,
  "explanation": "Świetnie! Poprawnie zmieniono 'don't' na 'doesn't'.",
  "suggestedVersion": "${correctSentence}"
}`;

  try {
    const response = await generateContentWithFallback({ contents: prompt });
    const jsonText = extractJSON(response?.text || '');
    const parsed = JSON.parse(jsonText);
    return {
      isCorrect: parsed.isCorrect ?? false,
      score: parsed.score ?? 0,
      explanation: parsed.explanation || '',
      suggestedVersion: parsed.suggestedVersion || correctSentence
    };
  } catch (err) {
    const cleanStudent = studentAnswer.trim().toLowerCase().replace(/[.,!?]/g, '');
    const cleanCorrect = correctSentence.trim().toLowerCase().replace(/[.,!?]/g, '');
    const isExact = cleanStudent === cleanCorrect;
    return {
      isCorrect: isExact,
      score: isExact ? 100 : 0,
      explanation: isExact ? 'Poprawna odpowiedź!' : `Wzorcowa odpowiedź: ${correctSentence}`,
      suggestedVersion: correctSentence
    };
  }
};

export const getAudioPronunciation = async (text: string, language: string): Promise<string> => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: language === 'en' ? 'Puck' : 'Kore' },
            },
        },
      } });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || '';
  } catch (err) {
    console.error('Error generating audio:', err);
    return '';
  }
};

export const evaluateTeacherHomework = async (
  taskType: 'translation' | 'fill_in_the_blank',
  sentences: any[],
  studentAnswers: Record<string | number, string>,
  teacherComment: string
): Promise<any[]> => {
  const prompt = `ROLE:
Jesteś doświadczonym, empatycznym nauczycielem języka angielskiego. Twój kolega (inny nauczyciel) poprosił Cię o ocenienie pracy domowej ucznia na podstawie pewnych wytycznych.

ZADANIE:
Oceń poprawność odpowiedzi ucznia.

TYP ZADANIA: ${taskType}

${taskType === 'translation' 
  ? 'Oceniasz tłumaczenia zdań z języka polskiego na angielski.' 
  : 'Oceniasz uzupełnianie luk w tekście.'}

WYTYCZNE NAUCZYCIELA:
"${teacherComment}"
Musisz bezwzględnie wziąć te wytyczne pod uwagę (np. jeśli nauczyciel każe ignorować brak przecinków lub uznać konkretną odpowiedź - zrób to).
ZASADA INTERPUNKCJI: Interpunkcja (kropka na końcu zdania, przecinki, pytajniki, wielkie litery) jest potrzebna i jest dobrą praktyką, ale NIE ODEJMUJ ZA NIĄ PUNKTÓW ani nie obniżaj oceny w przypadku jej braku lub drobnym błędzie interpunkcyjnym.

DANE ZADANIA I ODPOWIEDZI UCZNIA:
${JSON.stringify({sentences, studentAnswers}, null, 2)}

WYMAGANY FORMAT ZWROTNY:
Zwróć poprawny obiekt JSON o strukturze:
{
  "results": [
    {
      "isCorrect": true/false, // lub "częściowo" z punktami
      "score": 0-100, // procentowa ocena danego elementu
      "explanation": "Twój komentarz dla ucznia po polsku, biorący pod uwagę zdanie i wytyczne nauczyciela.",
      "studentAnswer": "odpowiedź ucznia",
      "correctAnswer": "wzorzec"
    }
    // ... dla każdego elementu z zadania
  ]
}`;

  try {
    const response = await generateContentWithFallback({ contents: prompt });
    const text = response?.text || '';
    const jsonText = extractJSON(text);
    const parsed = JSON.parse(jsonText);
    if (parsed && Array.isArray(parsed.results)) {
      return parsed.results;
    }
    return [];
  } catch (err) {
    console.error("Error evaluating teacher homework:", err);
    throw new Error("Nie udało się ocenić pracy za pomocą AI.");
  }
};
export const generateLessonSummary = async (
  notes: string,
  pdfBase64: string,
  studentsStr: string
) => {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch('/api/gemini/lesson-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        notes,
        pdfBase64,
        students: studentsStr
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (backendErr) {
    console.warn("Backend lesson summary failed, attempting fallback...", backendErr);
  }

  const promptText = `Jako asystent nauczyciela języka angielskiego, przeanalizuj notatki z lekcji (lub załączony dokument) i przygotuj strukturalne podsumowanie lekcji w formacie JSON.

Lista dostępnych uczniów (wybierz studentId najbardziej pasującego ucznia z listy):
${studentsStr}

${notes ? `Notatki z lekcji:\n${notes}` : ''}

Zwróć WYŁĄCZNIE poprawny obiekt JSON o następującej strukturze:
{
  "studentId": "ID ucznia dopasowane z listy uczniów lub puste string",
  "lessonTopic": "Tytuł/Temat lekcji po polsku lub angielsku",
  "revisionNotes": "Krótkie podsumowanie najważniejszych zagadnień z lekcji",
  "vocabularyText": "Słówka z lekcji w formacie: angielskie_słowo - polskie_tłumaczenie (każde słówko w nowej linii)",
  "studentSpeaking": "Uwagi odnośnie wypowiedzi ucznia i płynności",
  "thingsToImprove": "Obszary do poprawy lub gramatyka do powtórzenia",
  "suggestedFollowUp": "Sugerowane ćwiczenia lub praca domowa na następną lekcję"
}`;

  try {
    const contents: any[] = [];
    if (pdfBase64) {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      });
    }
    contents.push(promptText);

    const response = await generateContentWithFallback({
      contents,
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonStr = extractJSON(response?.text || "{}");
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating lesson summary:", error);
    throw new Error("Failed to generate lesson summary.");
  }
};

export const generateBulkLessonSummary = async (
  notes: string,
  pdfBase64: string,
  studentsStr: string,
  targetStudentId?: string,
  targetStudentName?: string
) => {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch('/api/gemini/import-lessons-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        textContent: notes,
        pdfBase64,
        students: studentsStr,
        targetStudentId,
        targetStudentName
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (backendErr) {
    console.warn("Backend bulk lesson summary failed, attempting fallback...", backendErr);
  }

  const promptText = `Jako asystent nauczyciela języka angielskiego, przeanalizuj notatki/dokument zawierające opisy lekcji i przygotuj zbiorcze podsumowanie w formacie JSON.

${targetStudentId ? `AKTYWNY KURSANT: ${targetStudentName || targetStudentId} (ID: ${targetStudentId}). Jeśli lekcje nie wskazują inaczej, przypisz je do tego kursanta.` : ''}

Lista dostępnych uczniów w systemie:
${studentsStr}

ZASADY BARDZO WAŻNE:
1. DATY: Przeanalizuj nagłówki dat w dokumencie/notatkach i przekonwertuj na YYYY-MM-DD. BEZWZGLĘDNIE ZACHOWAJ oryginalną datę lekcji z pliku! ZABRONIONE jest zastępowanie istniejącej daty dzisiejszą datą.
2. TEMATY LEKCJI: Jeśli w tekście podano temat lub tytuł lekcji, UŻYJ DOKŁADNIE TEGO TEKSTU dla "lessonTopic". Nie wymyślaj własnych tematów, jeśli w pliku podano konkretny temat!
3. DANE LEKCJI: Wyciągnij opisy,notatki, słówka (angielski - polski) i zwroty.

${notes ? `Treść notatek:\n${notes}` : ''}

Zwróć WYŁĄCZNIE poprawny obiekt JSON o strukturze:
{
  "lessons": [
    {
      "studentId": "${targetStudentId || 'ID ucznia z listy'}",
      "studentIds": ["${targetStudentId || 'ID ucznia'}"],
      "date": "YYYY-MM-DD (dokładna data z pliku)",
      "lessonTopic": "Dokładna nazwa tematu z pliku",
      "revisionNotes": "Podsumowanie omówionych zagadnień",
      "vocabularyText": "Słówka w formacie: angielski - polski",
      "studentSpeaking": "Uwagi o wypowiedzi kursanta",
      "thingsToImprove": "Obszary do poprawy",
      "suggestedFollowUp": "Praca domowa / zalecenia"
    }
  ]
}`;

  try {
    const contents: any[] = [];
    if (pdfBase64) {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      });
    }
    contents.push(promptText);

    const response = await generateContentWithFallback({
      contents,
      preferredModels: ['openai/gpt-4o-mini', 'gemini-2.5-flash'],
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonStr = extractJSON(response?.text || "{\"lessons\":[]}");
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating bulk lesson summary:", error);
    throw new Error("Failed to generate bulk lesson summary.");
  }
};

export interface HomeworkChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sentences?: TranslationExercise[];
  summaryText?: string;
  modelInfo?: string;
}

export const generateHomeworkChatPipeline = async ({
  studentProfile,
  lessonHistory = [],
  exerciseHistory = [],
  chatHistory = [],
  teacherInstruction,
  numSentences = 5,
  selectedWords = [],
  level = 'B1-B2',
  onStatusUpdate
}: {
  studentProfile: {
    firstName?: string;
    lastName?: string;
    level?: string;
    description?: string;
    aiPrompt?: string;
  };
  lessonHistory?: any[];
  exerciseHistory?: any[];
  chatHistory?: HomeworkChatMessage[];
  teacherInstruction: string;
  numSentences?: number;
  selectedWords?: string[];
  level?: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<{
  sentences: TranslationExercise[];
  summaryText: string;
  modelUsed: string;
}> => {
  if (onStatusUpdate) {
    onStatusUpdate("Krok 1/2: Generowanie wstępnych zdań (OpenAI GPT-4o mini)...");
  }

  const historyContext = chatHistory && chatHistory.length > 0
    ? `HISTORIA CZATU Z NAUCZYCIELEM:\n${chatHistory.map(m => `${m.role === 'user' ? 'Nauczyciel' : 'AI'}: ${m.content}`).join('\n')}\n`
    : '';

  const wordsContext = selectedWords && selectedWords.length > 0
    ? `WYMAGANE SŁÓWKA DO UŻYCIA: ${selectedWords.join(', ')}.\n`
    : '';

  const formattedLessons = lessonHistory && lessonHistory.length > 0
    ? lessonHistory.map((l, i) => `
### LEKCJA ${i + 1} (${l.date || 'brak daty'}) — Temat: ${l.topic || 'brak'}
1. **Revision Notes**:
${l.vocabularyText || ''}
${l.lessonSummary || ''}

2. **Student Transcript / Spoken Content**:
${l.studentSpeaking || 'Brak zarejestrowanych wypowiedzi kursanta.'}

3. **Things to Improve**:
${l.thingsToImprove || 'Brak zarejestrowanych uwag do poprawy.'}`).join('\n\n---\n')
    : 'Brak wpisanych lekcji w panelu kursanta.';

  const openAiSystemInstruction = `# ROLE AND PURPOSE
Jesteś zaawansowanym silnikiem pedagogicznym AI oraz pierwszym etapem generatora prac domowych (OpenAI GPT-4o mini). Twoim zadaniem jest generowanie spersonalizowanych prac domowych dla kursanta na podstawie historii wskazanych lekcji.

# INPUT DATA STRUCTURE
Dla każdej z zaznaczonych lekcji otrzymujesz dostęp do danych z panelu kursanta:
1. **Revision Notes** – kluczowe zagadnienia, słownictwo i struktury omówione na lekcji.
2. **Student Transcript / Spoken Content** – rzeczywiste wypowiedzi i tematy poruszane przez kursanta.
3. **Things to Improve** – obszary wymagające korekty, powtarzające się błędy i luki gramatyczno-leksykalne.

# HARD CONSTRAINTS (ŻELAZNE ZASADY)
1. **Pełna Analiza Wielolekcyjna:** Przed wygenerowaniem jakiegokolwiek zadania MUSISZ przeanalizować dane ze WSZYSTKICH wskazanych lekcji (nie tylko z ostatniej).
2. **Zakaz Sztuczności:** Zdania w języku polskim muszą brzmieć całkowicie naturalnie, płynnie i współcześnie. Zakaz używania "anglicyzmów myślowych" lub koślawych kalk językowych.
3. **Realistyczny Kontekst:** Tematyka zdań musi bezpośrednio nawiązywać do prawdziwych wypowiedzi kursanta z sekcji transcript/spoken content. Nie twórz abstrakcyjnych ani dziecinnych zdań, chyba że wynika to z kontekstu lekcji.
4. **Dopasowanie do Poziomu:** Poziom trudności (${level}) oraz zasób leksykalny musisz dopasować do aktualnego poziomu kursanta, jednocześnie adresując elementy z pola **Things to improve**.

# EXECUTION WORKFLOW
1. **KROK 1 (Agregacja):** Przeczytaj i połącz wpisy z Revision Notes, Things to improve oraz treści wypowiedzi ze wszystkich zaznaczonych lekcji.
2. **KROK 2 (Identyfikacja celów):** Wyciągnij powtarzające się błędy oraz kluczowe frazy, które kursant powinien utrwalić.
3. **KROK 3 (Kreacja zadań):** Sformułuj naturalne zdania wyjściowe w języku polskim, które zmuszą kursanta do użycia docelowych konstrukcji w języku obcym.

# OUTPUT FORMAT
Zwróć wynik jako JSON z tablicą "sentences" z polami:
- english_sentence: oczekiwana odpowiedź / wzorzec w j. angielskim
- polish_translation: zdanie kontekstowe po polsku (naturalne, żywe)
- target_word_used: kluczowe słówko / struktura
- hint: wskazówka / kontekst lekcyjny (opcjonalnie, np. "Nawiązanie do rozmowy o...")`;

  const openAiUserPrompt = `${historyContext}${wordsContext}DANE KURSANTA I LEKCJI:
Imię: ${studentProfile.firstName || ''} ${studentProfile.lastName || ''}
Poziom: ${studentProfile.level || level}
Żelazne zasady / Prompt kursanta: ${studentProfile.aiPrompt || 'Brak'}

HISTORIA LEKCJI:
${formattedLessons}

OBECNA INSTRUKCJA LUB WSKAZÓWKA NAUCZYCIELA W CZACIE:
"${teacherInstruction || 'Wygeneruj zdania na podstawie historii lekcji oraz obszarów do poprawy.'}"

DLA LICZBY ZDAŃ: ${numSentences}. Zwróć DOKŁADNIE ${numSentences} zdań w formacie JSON.`;

  let draftSentences: any[] = [];
  try {
    const openAiResult = await callOpenAI(openAiUserPrompt, openAiSystemInstruction, "gpt-4o-mini", true);
    const jsonStr = extractJSON(openAiResult.text || "{}");
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.sentences)) {
      draftSentences = parsed.sentences;
    } else if (Array.isArray(parsed)) {
      draftSentences = parsed;
    }
  } catch (err: any) {
    console.warn("OpenAI Step 1 error, attempting fallback draft generation:", err);
  }

  if (!draftSentences || draftSentences.length === 0) {
    draftSentences = Array.from({ length: numSentences }, (_, i) => ({
      id: i + 1,
      english_sentence: `Sample English sentence ${i + 1} for ${level}.`,
      polish_translation: `Przykładowe zdanie po polsku ${i + 1} na poziomie ${level}.`,
      target_word_used: selectedWords[i % Math.max(1, selectedWords.length)] || 'practice',
      hint: 'Spróbuj przetłumaczyć naturalnie'
    }));
  }

  if (onStatusUpdate) {
    onStatusUpdate("Krok 2/2: Weryfikacja spójności, profilu i historii kursanta (Gemini 3.1 Flash)...");
  }

  const geminiVerificationPrompt = `# ROLE AND PURPOSE
Jesteś zaawansowanym silnikiem pedagogicznym AI — drugim, zaawansowanym etapem generatora prac domowych (Model Gemini 3.1 Flash). Twoim zadaniem jest zweryfikowanie i oszlifowanie spersonalizowanej pracy domowej dla kursanta.

# INPUT DATA STRUCTURE
Dla każdej z zaznaczonych lekcji analizujesz dane z panelu kursanta:
1. **Revision Notes** – kluczowe zagadnienia, słownictwo i struktury omówione na lekcji.
2. **Student Transcript / Spoken Content** – rzeczywiste wypowiedzi i tematy poruszane przez kursanta.
3. **Things to Improve** – obszary wymagające korekty, powtarzające się błędy i luki gramatyczno-leksykalne.

# HARD CONSTRAINTS (ŻELAZNE ZASADY)
1. **Pełna Analiza Wielolekcyjna:** Przed wygenerowaniem/zatwierdzeniem jakiegokolwiek zadania MUSISZ przeanalizować dane ze WSZYSTKICH wskazanych lekcji (nie tylko z ostatniej).
2. **Zakaz Sztuczności:** Zdania w języku polskim muszą brzmieć całkowicie naturalnie, płynnie i współcześnie. Zakaz używania "anglicyzmów myślowych" lub koślawych kalk językowych.
3. **Realistyczny Kontekst:** Tematyka zdań musi bezpośrednio nawiązywać do prawdziwych wypowiedzi kursanta z sekcji transcript/spoken content. Nie twórz abstrakcyjnych ani dziecinnych zdań, chyba że wynika to z kontekstu lekcji.
4. **Dopasowanie do Poziomu:** Poziom trudności oraz zasób leksykalny musisz dopasować do aktualnego poziomu kursanta, jednocześnie adresując elementy z pola **Things to improve**.

# EXECUTION WORKFLOW
1. **KROK 1 (Agregacja):** Przeczytaj i połącz wpisy z Revision Notes, Things to improve oraz treści wypowiedzi ze wszystkich wskazanych lekcji.
2. **KROK 2 (Identyfikacja celów):** Wyciągnij powtarzające się błędy oraz kluczowe frazy, które kursant powinien utrwalić.
3. **KROK 3 (Kreacja/Korekta zadań):** Sformułuj lub skoryguj wstępne zdania wyjściowe w języku polskim tak, by zmuszały kursanta do użycia docelowych konstrukcji w języku obcym.

WSTĘPNIE WYGENEROWANE ZDANIA PRZEZ MODEL OPENAI (GPT-4o mini):
${JSON.stringify(draftSentences, null, 2)}

PROFIL KURSANTA:
Imię i nazwisko: ${studentProfile.firstName || ''} ${studentProfile.lastName || ''}
Deklarowany poziom: ${studentProfile.level || level}
Opis kursanta: ${studentProfile.description || 'Brak'}
Instrukcje / Żelazne zasady AI (aiPrompt): ${studentProfile.aiPrompt || 'Brak'}

DANE Z PANELU KURSANTA Z ZAZNACZONYCH LEKCJI:
${formattedLessons}

HISTORIA ĆWICZEŃ I CZĘSTO POPEŁNIANE BŁĘDY KURSANTA:
${exerciseHistory && exerciseHistory.length > 0 ? JSON.stringify(exerciseHistory).slice(0, 3000) : 'Brak szczegółowych danych o błędach.'}

OBECNA PROŚBA NAUCZYCIELA W CZACIE:
"${teacherInstruction}"
Liczba zdań do zwrócenia: DOKŁADNIE ${numSentences}

ZADANIE GEMINI 3.1 FLASH:
1. Zweryfikuj logiczność i naturalność brzmienia zdań w języku polskim i angielskim (zero kalk i sztuczności).
2. Sprawdź, czy zdania bezpośrednio nawiązują do transcript/spoken content, Revision Notes oraz Things to Improve ze wszystkich lekcji.
3. Jeśli któreś zdanie jest niedopasowane, sztuczne lub ma kalki językowe, skoryguj je na lepsze.
4. Wygeneruj dla każdego zdania angielskiego pole \`puzzleChunks\` (podział zdania na 2-4 logiczne grupy słów).
5. Wygeneruj zwięzły raport w polu \`summary\` wyjaśniający, jak przeanalizowano Revision Notes, Student Transcript oraz Things to Improve ze wskazanych lekcji.

Zwróć wynik WYŁĄCZNIE w formacie JSON:
{
  "summary": "Analiza Gemini 3.1 Flash: przeanalizowano X lekcji (Revision Notes, Student Transcript, Things to Improve)...",
  "sentences": [
    {
      "id": 1,
      "english_sentence": "Clean, natural English sentence.",
      "polish_translation": "Naturalne, żywe zdanie kontekstowe po polsku.",
      "target_word_used": "word / structure",
      "hint": "Wskazówka / kontekst lekcyjny (np. Nawiązanie do rozmowy o...)",
      "puzzleChunks": ["Clean,", "natural English", "sentence."]
    }
  ]
}`;

  const geminiSystemInstruction = "You are Gemini 3.1 Flash, an advanced pedagogical AI engine for personalized homework generation. Strictly enforce multi-lesson analysis, natural non-calque Polish, realistic student transcript context, level fit, and addressing 'Things to improve'. Always output strict JSON.";

  let finalSentences: TranslationExercise[] = [];
  let summaryText = "Zdania wygenerowane i zweryfikowane przez dwustopniowy model OpenAI GPT-4o mini & Gemini 3.1 Flash.";

  try {
    const geminiRes = await generateTextWithUnifiedFallback(
      geminiVerificationPrompt,
      geminiSystemInstruction,
      ['gemini-2.5-flash', 'gemini-1.5-flash', 'openai/gpt-4o-mini'],
      { responseMimeType: "application/json" }
    );

    const extracted = extractJSON(geminiRes.text || "{}");
    const parsedGemini = JSON.parse(extracted);

    if (parsedGemini.summary) {
      summaryText = parsedGemini.summary;
    }

    const rawSentences = parsedGemini.sentences || parsedGemini.exercises || (Array.isArray(parsedGemini) ? parsedGemini : []);

    if (Array.isArray(rawSentences) && rawSentences.length > 0) {
      finalSentences = rawSentences.map((s: any, idx: number) => {
        const eng = s.english_sentence || s.englishSentence || s.englishTranslation || s.english || "";
        const pol = s.polish_translation || s.polishSentence || s.polish || "";
        const hnt = s.hint || "";
        const targetWord = s.target_word_used || s.targetWord || "";
        
        let chunks: string[] = Array.isArray(s.puzzleChunks) ? s.puzzleChunks : [];
        if (!chunks || chunks.length === 0) {
          const wordsInEng = eng.split(' ').filter(Boolean);
          if (wordsInEng.length < 8) {
            chunks = wordsInEng;
          } else {
            chunks = [];
            for (let c = 0; c < wordsInEng.length; c += 3) {
              chunks.push(wordsInEng.slice(c, c + 3).join(' '));
            }
          }
        }

        return {
          id: idx + 1,
          englishSentence: eng,
          polishSentence: pol,
          englishTranslation: eng,
          targetWordUsed: targetWord,
          hint: hnt,
          puzzleChunks: chunks
        };
      });
    }
  } catch (err: any) {
    console.warn("Gemini 3.1 Flash Step 2 verification failed, falling back to OpenAI draft:", err);
  }

  if (finalSentences.length === 0 && draftSentences.length > 0) {
    finalSentences = draftSentences.map((s: any, idx: number) => {
      const eng = s.english_sentence || s.englishSentence || s.englishTranslation || s.english || "";
      const pol = s.polish_translation || s.polishSentence || s.polish || "";
      const wordsInEng = eng.split(' ').filter(Boolean);
      return {
        id: idx + 1,
        englishSentence: eng,
        polishSentence: pol,
        englishTranslation: eng,
        targetWordUsed: s.target_word_used || "",
        hint: s.hint || "",
        puzzleChunks: wordsInEng.length < 8 ? wordsInEng : [eng]
      };
    });
  }

  return {
    sentences: finalSentences.slice(0, numSentences),
    summaryText,
    modelUsed: 'OpenAI (GPT-4o mini) → Gemini 3.1 Flash'
  };
};

export const processBulkSentences = async (
  text: string
): Promise<Array<{ polishSentence: string; englishTranslation: string; hint: string }>> => {
  const prompt = `ROLE: Nauczyciel języka angielskiego.
Otrzymujesz tekst zawierający listę zdań do przetłumaczenia z języka polskiego na angielski.
Mogą to być same zdania polskie, albo zdania z podanym już angielskim tłumaczeniem.

ZADANIE:
Przeanalizuj podany tekst i wyciągnij z niego poszczególne zdania. 
Dla każdego zdania podaj jego polską wersję oraz poprawne, naturalne tłumaczenie na język angielski. Możesz też dodać opcjonalną krótką wskazówkę po polsku (np. jakiej gramatyki użyć).

TEKST:
"""
${text}
"""

Zwróć wynik WYŁĄCZNIE jako obiekt JSON o strukturze:
{
  "exercises": [
    {
      "polishSentence": "...",
      "englishTranslation": "...",
      "hint": "..."
    }
  ]
}
`;

  try {
    const response = await generateContentWithFallback({ contents: prompt });
    const jsonText = extractJSON(response?.text || '');
    const parsed = JSON.parse(jsonText);
    if (parsed && Array.isArray(parsed.exercises)) {
      return parsed.exercises;
    }
    return [];
  } catch (err) {
    console.error("Error processing bulk sentences:", err);
    throw new Error("Nie udało się przetworzyć podanego tekstu.");
  }
};

export const generateFlashcardsFromTextWithGPT = async (text: string, termLang: string, defLang: string): Promise<any[]> => {
  const prompt = `Analyze the following text and extract vocabulary words/phrases from it.
Text: ${text}
Source language of terms: ${termLang}
Target language for definitions: ${defLang}

For each term found, provide:
1. The term itself.
2. A clear definition or translation in the target language.
3. An example context sentence in the source language (no translation needed).

Return a JSON array of objects.`;

  const sysInst = "You are an AI assistant creating flashcard sets in JSON format for the gpt-4o-mini model. Output ONLY a valid JSON array of objects with keys: term, definition, contextSentence.";

  try {
    const openAiRes = await callOpenAI(prompt, sysInst, 'gpt-4o-mini', true);
    const jsonText = extractJSON(openAiRes.text || "");
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : (parsed.flashcards || parsed.cards || parsed.words || parsed.items || []);
    return list;
  } catch (err) {
    console.error("Error generating flashcards from text with GPT:", err);
    throw new Error("Failed to parse vocabulary from text using GPT-4o-mini.");
  }
};

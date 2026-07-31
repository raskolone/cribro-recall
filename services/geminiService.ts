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
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || '';
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
      
      if (model.startsWith('deepseek')) {
         const promptText = typeof apiParams.contents === 'string' ? apiParams.contents : 
                            (Array.isArray(apiParams.contents) ? apiParams.contents.map((c: any) => c.text || JSON.stringify(c)).join('\n') : JSON.stringify(apiParams.contents));
         const sysInst = apiParams.config?.systemInstruction || "You are a helpful AI assistant.";
         
         const text = await callDeepSeek(promptText, sysInst, model);
         return { text };
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
      if (e?.message?.includes("timed out")) continue;
      if (String(e?.status) === "404" || String(e?.status) === "503" || String(e?.status) === "429" || e?.message?.includes("503") || e?.message?.includes("429")) continue;
      if (String(e?.status) === "400" && e?.message?.includes("not found")) continue;
      continue;
    }
  }
  throw lastError;
};

const callDeepSeek = async (prompt: string, systemInstruction: string, model: string = "deepseek-chat") => {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const res = await fetch('/api/deepseek/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, systemInstruction, model })
  });

  if (!res.ok) {
    let errorText = res.statusText;
    try {
      const errorData = await res.json();
      errorText = errorData.error || errorText;
    } catch {
      const rawText = await res.text().catch(() => '');
      errorText = rawText ? `Raw: ${rawText.substring(0, 100)}` : errorText;
    }
    throw new Error(`DeepSeek API error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return data.text;
};

export const PREFERRED_AI_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner'
];

export const formatAIModelName = (model?: string): string => {
  if (!model) return 'DeepSeek Lite (V3)';
  if (model.includes('deepseek-reasoner') || model.includes('deepseekv4-pro')) return 'DeepSeek Pro (R1)';
  if (model.includes('deepseek-chat') || model.includes('deepseek')) return 'DeepSeek Lite (V3)';
  if (model.includes('gemini-2.5-flash-lite') || model.includes('gemini-1.5-flash-lite')) return 'Gemini Flash Lite';
  if (model.includes('gemini')) return 'Gemini 2.5 Flash';
  return model;
};

const generateTextWithUnifiedFallback = async (
  prompt: string,
  systemInstruction: string,
  preferredModels: string[] = PREFERRED_AI_MODELS,
  geminiConfig?: any,
  onModelAttempt?: (model: string) => void
): Promise<{ text: string, modelUsed: string }> => {
  let lastError;
  const filteredModels = preferredModels.filter(m => m.startsWith('deepseek'));
  const modelsToTry = filteredModels.length > 0 ? filteredModels : ['deepseek-chat', 'deepseek-reasoner'];
  
  for (const model of modelsToTry) {
    try {
      console.log(`Attempting generation with ${model}...`);
      if (onModelAttempt) {
        onModelAttempt(model);
      }
      
      const text = await callDeepSeek(prompt, systemInstruction, model);
      if (text) {
        return { text, modelUsed: model };
      }
    } catch (error: any) {
      console.warn(`Model ${model} failed:`, error?.message || error);
      lastError = error;
    }
  }
  throw lastError || new Error("All DeepSeek models failed without providing an error message.");
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
    return JSON.parse(jsonText);
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
You are an expert English Language Content Creator specializing in adaptive, personalized language practice.

TASK:
Generate natural, highly realistic sentences using the provided list of target vocabulary. Adapt the tone and topic naturally to match the vocabulary context. 
CRITICAL: The Polish translations MUST be perfectly natural, logically coherent, grammatically flawless, and sound like something a native Polish speaker would actually say in real life. Do not generate robotic, word-for-word, or awkwardly phrased Polish sentences.

RULES FOR SENTENCE GENERATION:
- CONTEXT: Sentences MUST sound like real-world communication relevant to the provided vocabulary (e.g., casual, technical, business, everyday conversation).
- LENGTH: Maximum sentence length is 16 words, regardless of the level. Do not exceed 16 words for the entire sentence.
- NATURALNESS: Never force multiple target words into a single sentence if it sounds awkward. Use MAXIMUM 1 target word per sentence.
- GRAMMAR & STYLE: Use modern, natural English. Avoid academic, bizarre, or forced phrasing. The Polish translation MUST also be perfectly natural.
- VARIETY: Use diverse sentence structures (mix conditionals, modal verbs, different tenses, and sentence lengths).
- LOGIC & REALISM: Sentences MUST be practical, logical, and make total sense in real-world communication. Do NOT forcefully weave random student profile keywords or hobbies into a sentence if it makes the sentence illogical, weird, or artificial. Practical usability is the absolute highest priority.
- HINT REQUIREMENT: Pole \`hint\` musi ZAWSZE zawierać kluczowe trudne słowa z danego zdania (angielskie) wraz z tłumaczeniem, plus krótką wskazówkę co do użytej struktury gramatycznej.
- ANTI-REPETITION (CRITICAL): Do NOT generate sentences that are structurally identical or extremely similar to the sentences listed in PAST EXERCISES. The user should learn to understand the language dynamically, not memorize specific sentence structures by heart. Create new contexts, subjects, and scenarios.\n- ANTI-REPETITION & CONTEXT (CRITICAL): Jeśli uczeń kontynuuje ćwiczenie (ćwiczy dłużej), kategorycznie NIE powtarzaj tych samych ani podobnych zdań, które znajdują się w PAST EXERCISES. Buduj zupełnie nowe, świeże scenariusze i konteksty, ale utrzymaj docelowe słownictwo.
- LEARNING FROM MISTAKES: Jeśli dostarczono sekcję [STUDENT MISTAKES], skup się na wygenerowaniu zdań, które ćwiczą trudne dla ucznia obszary (np. błędnie użyte słowa lub konstrukcje gramatyczne). Zdania muszą pokazywać wyraźny, życiowy kontekst poprawnego użycia, aby uczeń zrozumiał błąd i mógł się poprawić.

INPUT FORMAT:
Target Vocabulary List: ${words.length > 0 ? words.join(', ') : 'General level-appropriate vocabulary'}
Target CEFR Level: ${isGrammar ? 'ZIGNORUJ poziom kursanta (bypassed). Poziom trudności musi być dokładnie dopasowany do dostarczonych przykładów z bazy.' : (level || 'B2')}
Number of Sentences: ${numSentences}`;

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
      const systemInstruction = "You are an expert English Language Content Creator specializing in adaptive, personalized language practice. Always prioritize natural logic, practical communication, and strict JSON output. SPECIAL INSTRUCTION FOR PUZZLE CHUNKS: 1) If the target sentence has FEWER THAN 8 words (< 8 words): split into mostly SINGLE WORDS or small pairs (e.g. phrasal verbs 'look up', prepositions 'in the'). 2) If the target sentence has 8 OR MORE WORDS (>= 8 words): group into LARGER logical phrase chunks (2-4 words per chunk, e.g. 'I decided to go', 'to the grocery store', 'after work'). Limit long sentences to 3 to 5 chunks maximum so it is achievable and serves as a good warmup before typing.";
      
      const preferredModels = [
        'deepseek-chat',
        'deepseek-reasoner'
      ];
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

TWOJE ZADANIE: Sprawdź spójność logiczną i sens zdania. Upewnij się, że zdania są naturalne, a nie robotyczne czy sztuczne. Dzięki temu umożliwi to uczenie się przez skojarzenia faktów.
Jeśli to konieczne, popraw zdania (zarówno polskie, jak i angielskie), aby brzmiały jak najbardziej naturalnie i logicznie.
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
- If the student's input is a completely valid, natural English translation, award high or full marks (85-100%). Do NOT unfairly penalize for valid synonyms or natural phrasing variations.
- CRITICAL: If the student's input is a random string (e.g. "asdf"), completely wrong, irrelevant, missing ("(brak odpowiedzi)"), or in the wrong language, you MUST assign: meaning_score: 0, grammar_score: 0, vocabulary_score: 0, score: 0, and is_correct: false.
- Deduct points for grammar errors, wrong vocabulary, or missing words.
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
Return ONLY a valid JSON object matching the requested schema with an array "evaluations".`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemInstruction = "You are a fair, intelligent AI Language Evaluator. Evaluate translations strictly according to the rubric and return valid JSON.";
      
      // Priority: DeepSeek (deepseek-reasoner / 4 pro, then deepseek-chat), with fallback to available Gemini models
      const preferredModels = [
        'deepseek-reasoner',
        'deepseek-chat',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
      ];
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

  // Try DeepSeek first if no files attached
  if (!fileData && !driveFile) {
    try {
      console.log('Attempting generateTest via DeepSeek...');
      const resDs = await fetch('/api/deepseek/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (resDs.ok) {
         const data = await resDs.json();
         return data.questions;
      }
    } catch (e) {
      console.warn('DeepSeek test generation failed, falling back to Gemini', e);
    }
  }

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

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        term: { type: Type.STRING },
        definition: { type: Type.STRING },
        contextSentence: { type: Type.STRING }
      },
      required: ["term", "definition", "contextSentence"]
    }
  };

  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      } });
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText);
  } catch (err) {
    console.error("Error generating flashcards from text:", err);
    throw new Error("Failed to parse vocabulary from text.");
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
    return JSON.parse(jsonText);
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
    const q = query(weaknessesRef, orderBy('frequency', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return "Brak zidentyfikowanych błędów.";
    }

    const weaknesses = snapshot.docs.map(doc => {
      const data = doc.data();
      return `Błąd: ${data.name || doc.id} - ${data.description || 'Brak opisu'}`;
    });

    return weaknesses.join('\n');
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
    const preferredModels = [
      'deepseek-chat',
      'deepseek-reasoner'
    ];
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
    return JSON.parse(jsonText);
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
    for (const mistake of mistakes) {
      if (!mistake || mistake.trim() === '') continue;
      const cleanName = mistake.trim();
      const safeId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const mistakeRef = doc(db, `users/${userId}/weaknesses`, safeId);
      const snap = await getDoc(mistakeRef);
      if (snap.exists()) {
        await updateDoc(mistakeRef, { frequency: increment(1) });
      } else {
        await setDoc(mistakeRef, { name: cleanName, frequency: 1, description: 'Zidentyfikowane przez AI podczas ćwiczeń.' });
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
  studentsStr: string
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
        students: studentsStr
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (backendErr) {
    console.warn("Backend bulk lesson summary failed, attempting fallback...", backendErr);
  }

  const promptText = `Jako asystent nauczyciela języka angielskiego, przeanalizuj notatki zawierające opisy wielu lekcji (lub załączony dokument) i przygotuj zbiorcze podsumowanie dla każdej rozpoznanej lekcji/ucznia w formacie JSON.

Lista dostępnych uczniów (wybierz studentId najbardziej pasującego ucznia dla każdej lekcji):
${studentsStr}

${notes ? `Zbiorcze notatki:\n${notes}` : ''}

Zwróć WYŁĄCZNIE poprawny obiekt JSON o strukturze:
{
  "lessons": [
    {
      "studentId": "ID ucznia dopasowane z listy uczniów",
      "date": "YYYY-MM-DD (jeśli jest w notatce) lub dzisiejsza data",
      "lessonTopic": "Tytuł/Temat lekcji",
      "revisionNotes": "Podsumowanie omówionych zagadnień",
      "vocabularyText": "Słówka z lekcji w formacie: angielskie_słowo - polskie_tłumaczenie (każde w nowej linii)",
      "studentSpeaking": "Uwagi odnośnie wypowiedzi ucznia",
      "thingsToImprove": "Obszary do poprawy",
      "suggestedFollowUp": "Sugerowana praca domowa/dalsze kroki"
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

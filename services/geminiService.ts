import { auth } from '../firebase';
export const extractJSON = (text: string): string => {
  if (!text) return "{}";
  
  // Try to find markdown code blocks first
  const jsonBlockRegex = /```(?:json)?s*([sS]*?)s*```/i;
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // If no markdown block, try to find the first '{' or '[' and last '}' or ']'
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  
  let startIndex = -1;
  let endIndex = -1;
  
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }
  
  if (lastBrace !== -1 && lastBracket !== -1) {
    endIndex = Math.max(lastBrace, lastBracket);
  } else if (lastBrace !== -1) {
    endIndex = lastBrace;
  } else if (lastBracket !== -1) {
    endIndex = lastBracket;
  }
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return text.substring(startIndex, endIndex + 1);
  }
  
  // Fallback to trimming
  return text.trim();
};

import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Language, Difficulty, Word, AISuggestion, AudioVocabulary, TranslationExercise, TranslationEvaluationResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: vocabularySchema,
      },
    });

    let jsonText = extractJSON(response?.text || "");
    const parsed = JSON.parse(jsonText);
    return parsed as Omit<Word, 'id' | 'isDifficult' | 'language'>[];
  } catch (error) {
    console.error("Error generating vocabulary:", error);
    throw new Error("Failed to generate vocabulary from AI.");
  }
};

export const getAudioPronunciation = async (text: string, voice: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ]
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.error("Missing audio data in response API:", JSON.stringify(response, null, 2));
      throw new Error("No audio data received from API.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error getting audio pronunciation:", error);
    throw new Error(`Failed to get audio pronunciation. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const audioVocabSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      targetWord: { type: Type.STRING, description: "The extracted vocabulary word in the target language (usually English)." },
      translation: { type: Type.STRING, description: "Translation of the word into the learner's language." },
      contextSentence: { type: Type.STRING, description: "An example sentence using the word, preferably based on the audio context." }
    },
    required: ['targetWord', 'translation', 'contextSentence']
  }
};

export const generateAudioVocabulary = async (base64Audio: string, mimeType: string, language: string): Promise<AudioVocabulary[]> => {
  const prompt = `Listen to the provided audio material. Extract the key vocabulary words or phrases introduced in the target language (English).
  For each word, provide:
  1. targetWord: The word in English.
  2. translation: The translation in ${language}.
  3. contextSentence: An example sentence using this word, referencing the context of the audio if possible.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Audio, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: audioVocabSchema,
      },
    });

    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as AudioVocabulary[];
  } catch (error) {
    console.error("Error generating audio vocabulary:", error);
    throw new Error("Failed to generate audio vocabulary from AI.");
  }
};

export const generateAudioTranscript = async (base64Audio: string, mimeType: string, language: string): Promise<string> => {
  const prompt = `Listen to the provided audio material. Generate a precise, literal, word-for-word transcript of the entire recording. Do not summarize, do not skip words, and do not add any extra conversational filler text or commentary. Return only the raw transcript text formatting it nicely with newlines where appropriate. The language of the user requesting this is ${language}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Audio, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ],
    });

    return response?.text.trim();
  } catch (error) {
    console.error("Error generating audio transcript:", error);
    throw new Error("Failed to generate audio transcript from AI.");
  }
};

export const getAISuggestions = async (difficultWords: Word[]): Promise<AISuggestion> => {
  const wordList = difficultWords.map(w => w.word).join(', ');
  const prompt = `I'm struggling with these vocabulary words: ${wordList}. 
  1. Write a short, engaging paragraph that correctly uses at least three of these words in a natural context.
  2. For each word in the list, provide one relevant synonym and one relevant antonym.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestionSchema
      },
    });

    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as AISuggestion;
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    throw new Error("Failed to get AI suggestions.");
  }
};

const translationExerciseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      polishSentence: { type: Type.STRING, description: "Zdanie po polsku do przetłumaczenia" },
      englishTranslation: { type: Type.STRING, description: "The correct or recommended English translation" },
      hint: { type: Type.STRING, description: "A subtle hint in Polish, e.g., suggesting a grammar structure or key vocabulary word to use" }
    },
    required: ['polishSentence', 'englishTranslation', 'hint']
  }
};

const evaluationResultSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      polishSentence: { type: Type.STRING },
      correctTranslation: { type: Type.STRING },
      studentAnswer: { type: Type.STRING },
      highlightedAnswer: { type: Type.STRING, description: "The student's answer with HTML span tags. Wrap correct words in <span class='text-green-500 font-bold'>word</span>, and incorrect words in <span class='text-red-500 font-bold line-through'>word</span>. Add missing required words as <span class='text-amber-500 font-bold'>[missing]</span>." },
      isCorrect: { type: Type.BOOLEAN, description: "Whether the answer is mostly correct or functionally accurate" },
      score: { type: Type.INTEGER, description: "Accuracy score from 0 to 100 based on grammar, choice of words, and meaning" },
      explanation: { type: Type.STRING, description: "Detailed explanation in Polish highlighting mistakes, grammar rules, and alternative correct translations" },
      feedbackSyntax: { type: Type.STRING, description: "Szyk i gramatyka: short, elegant feedback on syntax/grammar. No markdown asterisks." },
      feedbackVocab: { type: Type.STRING, description: "Słownictwo i naturalność: short, elegant feedback on vocabulary/naturalness. No markdown asterisks." },
      feedbackRule: { type: Type.STRING, description: "Złota zasada: short golden rule/takeaway. No markdown asterisks." },
      mistakes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of specific grammar or vocabulary topics the student failed at (e.g. 'Present Perfect', 'Articles'). Empty if correct." }
    },
    required: ['polishSentence', 'correctTranslation', 'studentAnswer', 'highlightedAnswer', 'isCorrect', 'score', 'explanation', 'feedbackSyntax', 'feedbackVocab', 'feedbackRule', 'mistakes']
  }
};

export const generateTranslationExercises = async (
  level: string,
  words: string[],
  customPrompt?: string,
  lessonContext?: string,
  studentProfileContext?: string,
  numSentences: number = 5,
  pastExercisesContext?: string
): Promise<TranslationExercise[]> => {
  const basePrompt = `Generate a list of ${numSentences} unique sentences in Polish for a student to translate into English.
  
  CRITICAL LEVEL REQUIREMENT: The exercises MUST be strictly adequate for the selected CEFR level: ${level}. 
  If the level is A1, A2, or A2/B1, the sentences MUST be simple, short, and use basic grammar so the student does not get discouraged. If it's an intermediate level like B1/B2, balance the difficulty accordingly. Do NOT overcomplicate sentences for lower levels.
  
  ${words.length > 0 ? `The sentences should incorporate or test the following English vocabulary/concepts: ${words.join(', ')}.` : ''}
  
  ${lessonContext ? `Here are some summaries of the student's recent lessons. 
  CRITICAL: Analyze the entire lesson entry, especially any example sentences the student practiced during the lesson. You MUST absolutely take these examples and structures into account when generating new sentences:\n${lessonContext}` : ''}
  
  ${studentProfileContext ? `Here are details about the student's profile (interests, weaknesses, goals, and potentially example sentences they struggle with or practiced):\n${studentProfileContext}\nPlease use these details to deeply personalize the context of the sentences. Full UX personalization is required so that practice is tailor-made for this specific user. If there are example sentences in their profile, study their structure and incorporate similar difficulty/context.` : ''}
  
  ${pastExercisesContext ? `\nCRITICAL HISTORY CHECK: The student's past practice sessions are listed below:\n${pastExercisesContext}\n\nZASADA ŻELAZNA (IRONCLAD RULE): You MUST analyze this session history and STRICTLY avoid generating IDENTICAL sentences. You are ENCOURAGED to reuse the same grammar topics and vocabulary (especially those the student struggles with), but you MUST present them in completely NEW sentences and different examples.` : ''}
  
  For each sentence, provide the Polish sentence, the correct English translation, and a helpful Polish hint.`;

  // Ensure any [NUM_SENTENCES] placeholder in customPrompt is replaced
  const processedCustomPrompt = customPrompt ? customPrompt.replace(/\[NUM_SENTENCES\]/g, numSentences.toString()) : '';
  const finalPrompt = processedCustomPrompt ? `${processedCustomPrompt}\n\nContext and Constraints:\n${basePrompt}` : basePrompt;

  try {
    let response;
    const config = {
      systemInstruction: "Jesteś inteligentnym asystentem edukacyjnym ZEIAN. Twoim najważniejszym celem jest: 1. Bezwzględne dopasowanie poziomu (jeśli A1, A2 lub A2/B1 to zdania proste, krótkie; jeśli poziomy pośrednie jak B1/B2 to trudność zbilansowana). 2. Precyzyjne zrozumienie kontekstu ucznia (np. jeśli produkuje części do samolotów, nie twórz zdań, w których lata samolotami, nie twórz sztucznych kontekstów). 3. Nieustanne weryfikowanie historii lekcji i poprzednich zdań jako bazy referencyjnej trudności. Używaj historii, by nie tworzyć zdań bardziej skomplikowanych niż te już przerobione oraz do unikania powtórek w najnowszych 3 sesjach.",
      responseMimeType: "application/json",
      responseSchema: translationExerciseSchema,
    };
    
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-2.5-flash failed, falling back to gemini-2.5-flash", e1);
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: finalPrompt,
          config,
        });
      } catch (e2: any) {
        console.warn("gemini-2.5-flash failed, falling back to gemini-2.5-flash", e2);
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: finalPrompt,
            config,
          });
        } catch (e3: any) {
          console.warn("gemini-2.5-flash failed, falling back to gemini-2.5-flash", e3);
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: finalPrompt,
            config,
          });
        }
      }
    }

    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationExercise[];
  } catch (error: any) {
    console.error("Error generating translation exercises:", error);
    throw new Error(error.message || "Failed to generate translation exercises from AI.");
  }
};

export const generateHomework = async (topic: string, summary: string, words: string): Promise<string> => {
  const prompt = `Jako doświadczony nauczyciel języka angielskiego, wygeneruj spersonalizowaną pracę domową dla ucznia na podstawie odbytej lekcji.
  Temat lekcji: ${topic}
  Podsumowanie lekcji: ${summary}
  Przerobione słownictwo: ${words}
  
  Praca domowa powinna być krótka, angażująca i utrwalać przerobiony materiał. Zaproponuj 3-5 zdań do przetłumaczenia na angielski, 
  kilka pytań otwartych do odpowiedzi pisemnej po angielsku lub krótkie ćwiczenie (np. "uzupełnij luki") polegające na użyciu słownictwa z lekcji. 
  
  Zwróć wynik formacie Markdown (użyj nagłówków np. ### Zadanie 1, list punktowanych itp.), aby tekst był czytelny i przejrzysty dla ucznia. Pisz bezpośrednio do ucznia w przyjaznym tonie po polsku.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response?.text.trim();
  } catch (error) {
    console.error("Error generating homework:", error);
    throw new Error("Failed to generate homework from AI.");
  }
};

export const evaluateTranslations = async (
  exercises: TranslationExercise[],
  studentAnswers: string[],
  customEvaluationPrompt?: string,
  studentProfileContext?: string
): Promise<TranslationEvaluationResult[]> => {
  const formattedPairs = exercises.map((ex, idx) => {
    return `Sentence ${idx + 1}:
    Polish: ${ex.polishSentence}
    Reference English: ${ex.englishTranslation}
    Student's Answer: ${studentAnswers[idx] || '(no answer)'}`;
  }).join('\n\n');

  const basePrompt = `Review the student's English translations of the Polish sentences.
  For each sentence:
  1. Compare the Student's Answer with the Reference English.
  2. Grade it. If it's functionally correct and has no major grammar errors, mark isCorrect as true, and give a high score.
  3. Generate 'explanation' as a general comment if needed. Provide detailed feedback using 'feedbackSyntax', 'feedbackVocab', and 'feedbackRule' fields. Write elegantly in Polish without markdown format characters like asterisks (**). Be concise and to the point.
  4. Generate a 'highlightedAnswer' where you take the EXACT words the student wrote and wrap them in HTML tags: <span class='text-green-500 font-bold'>correct_word</span> or <span class='text-red-500 font-bold line-through'>wrong_word</span>. Also insert <span class='text-amber-500 font-bold'>[missing]</span> if something crucial was omitted. Do not wrap punctuation. Return the entire string.
  5. For any mistakes made, list the exact grammar or vocabulary topics the student struggled with in the 'mistakes' array (e.g. 'Present Perfect', 'Phrasal Verbs', 'Prepositions'). Leave it empty if there are no mistakes.
  ${studentProfileContext ? `
Student context: ${studentProfileContext}` : ''}
  
  Student's Work:
  ${formattedPairs}`;

  const finalPrompt = customEvaluationPrompt ? `${customEvaluationPrompt}\n\nContext:\n${basePrompt}` : basePrompt;

  try {
    let response;
    const config = {
      systemInstruction: `Jesteś bezpośrednim i konkretnym trenerem języka angielskiego dla Polaków. Przeanalizuj tłumaczenie kursanta i porównaj je z wersją wzorcową. 

Zasady generowania feedbacku (Stosuj bezwzględnie):
1. Podziel swój feedback na mikrokategorie: 'feedbackSyntax', 'feedbackVocab' oraz 'feedbackRule' w zwracanym JSONie. Używaj tylko tych 3 kategorii. W pole 'explanation' nic nie wpisuj (poza wyjątkami opisanymi niżej).
2. Szyk i gramatyka (feedbackSyntax): krótki i elegancki komentarz o błędach gramatycznych lub pochwała.
3. Słownictwo i naturalność (feedbackVocab): czy użyto naturalnych słów, jak by to powiedział native speaker.
4. Złota zasada (feedbackRule): jedna, najważniejsza, krótka wskazówka do zapamiętania.
5. Kategoryczny ZAKAZ używania znaków formatowania Markdown typu gwiazdki (**) pogrubiające tekst. 
6. Pisz czytelnie, krótko i na temat. Odbiorcą nie są programiści, tylko osoby uczące się.
7. Jeśli tłumaczenie kursanta jest w 100% poprawne, zwróć wyłącznie krótką pochwałę w polu 'explanation', a pozostałe 3 pola feedbacku mogą być puste.`,
      responseMimeType: "application/json",
      responseSchema: evaluationResultSchema,
    };
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-2.5-flash failed, falling back to gemini-2.5-flash", e1);
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: finalPrompt,
          config,
        });
      } catch (e2: any) {
        console.warn("gemini-2.5-flash failed again, falling back to gemini-2.5-flash", e2);
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: finalPrompt,
            config,
          });
        } catch (e3: any) {
           console.warn("gemini-2.5-flash failed, falling back to gemini-2.5-flash", e3);
           response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: finalPrompt,
            config,
          });
        }
      }
    }

    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationEvaluationResult[];
  } catch (error) {
    console.error("Error evaluating translations:", error);
    throw new Error("Failed to evaluate translations with AI.");
  }
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
  driveFile?: { id: string, mimeType: string, token: string }
): Promise<any[]> => {
  
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  
  const res = await fetch('/api/gemini/generate-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      level,
      testTitle,
      scope,
      studentProfile,
      lessonContext,
      allLessonsContext,
      tasksCount,
      attemptsLimit,
      selectedTypes,
      fileData,
      driveFile
    })
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response?.text.trim();
  } catch (err) {
    console.error("Error generating context sentence:", err);
    return "";
  }
};

export const generateImageForTerm = async (term: string, context?: string): Promise<string | null> => {
  const prompt = `A clear, educational, and high-quality illustration representing the concept of "${term}". ${context ? `Context: ${context}.` : ''} Minimalist and clean style.`;
  
  try {
    const response = await ai.models.generateContent({
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
        type: { type: Type.STRING, enum: ['multiple_choice', 'fill_in_blank', 'translation'] },
        prompt: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        correctAnswer: { type: Type.STRING },
      },
      required: ["id", "type", "prompt", "correctAnswer"],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    let jsonText = extractJSON(response?.text || "");
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
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

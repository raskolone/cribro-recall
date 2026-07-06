
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
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: vocabularySchema,
      },
    });

    const jsonText = response.text.trim();
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
      model: "gemini-3.1-flash-tts-preview",
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

    const jsonText = response.text.trim();
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

    return response.text.trim();
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

    const jsonText = response.text.trim();
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
      explanation: { type: Type.STRING, description: "Detailed explanation in Polish highlighting mistakes, grammar rules, and alternative correct translations" }
    },
    required: ['polishSentence', 'correctTranslation', 'studentAnswer', 'highlightedAnswer', 'isCorrect', 'score', 'explanation']
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
  If the level is A1 or A2, the sentences MUST be simple, short, and use basic grammar so the student does not get discouraged. Do NOT overcomplicate sentences for lower levels.
  
  ${words.length > 0 ? `The sentences should incorporate or test the following English vocabulary/concepts: ${words.join(', ')}.` : ''}
  
  ${lessonContext ? `Here are some summaries of the student's recent lessons. 
  CRITICAL: Analyze the entire lesson entry, especially any example sentences the student practiced during the lesson. You MUST absolutely take these examples and structures into account when generating new sentences:\n${lessonContext}` : ''}
  
  ${studentProfileContext ? `Here are details about the student's profile (interests, weaknesses, goals, and potentially example sentences they struggle with or practiced):\n${studentProfileContext}\nPlease use these details to deeply personalize the context of the sentences. Full UX personalization is required so that practice is tailor-made for this specific user. If there are example sentences in their profile, study their structure and incorporate similar difficulty/context.` : ''}
  
  ${pastExercisesContext ? `\nCRITICAL HISTORY CHECK: The student's past practice sessions are listed below:\n${pastExercisesContext}\n\nZASADA ŻELAZNA (IRONCLAD RULE): You MUST analyze this session history and STRICTLY avoid repetition. A sentence or specific context completed by the student in Session 1, Session 2, or Session 3 is STRICTLY FORBIDDEN. Sentences from Session 4 and older MAY be brought back for review and spaced repetition.` : ''}
  
  For each sentence, provide the Polish sentence, the correct English translation, and a helpful Polish hint.`;

  // Ensure any [NUM_SENTENCES] placeholder in customPrompt is replaced
  const processedCustomPrompt = customPrompt ? customPrompt.replace(/\[NUM_SENTENCES\]/g, numSentences.toString()) : '';
  const finalPrompt = processedCustomPrompt ? `${processedCustomPrompt}\n\nContext and Constraints:\n${basePrompt}` : basePrompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: finalPrompt,
      config: {
        systemInstruction: "Jesteś inteligentnym asystentem edukacyjnym ZEIAN. Twoim najważniejszym celem jest: 1. Bezwzględne dopasowanie poziomu (jeśli A1/A2 to zdania proste, krótkie). 2. Precyzyjne zrozumienie kontekstu ucznia (np. jeśli produkuje części do samolotów, nie twórz zdań, w których lata samolotami, nie twórz sztucznych kontekstów). 3. Nieustanne weryfikowanie historii lekcji i poprzednich zdań jako bazy referencyjnej trudności. Używaj historii, by nie tworzyć zdań bardziej skomplikowanych niż te już przerobione oraz do unikania powtórek w najnowszych 3 sesjach.",
        responseMimeType: "application/json",
        responseSchema: translationExerciseSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as TranslationExercise[];
  } catch (error) {
    console.error("Error generating translation exercises:", error);
    throw new Error("Failed to generate translation exercises from AI.");
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
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    return response.text.trim();
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
  3. Provide a clear, friendly, and detailed explanation in Polish (explanation) explaining mistakes, grammar points, or why it is correct. Include any alternative correct translations.
  4. Generate a 'highlightedAnswer' where you take the EXACT words the student wrote and wrap them in HTML tags: <span class='text-green-500 font-bold'>correct_word</span> or <span class='text-red-500 font-bold line-through'>wrong_word</span>. Also insert <span class='text-amber-500 font-bold'>[missing]</span> if something crucial was omitted. Do not wrap punctuation. Return the entire string.
  ${studentProfileContext ? `
Student context: ${studentProfileContext}` : ''}
  
  Student's Work:
  ${formattedPairs}`;

  const finalPrompt = customEvaluationPrompt ? `${customEvaluationPrompt}\n\nContext:\n${basePrompt}` : basePrompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: finalPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evaluationResultSchema,
      },
    });

    const jsonText = response.text.trim();
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
  selectedTypes: string[] = ['multiple_choice', 'fill_in_blank', 'translation'],
  fileData?: { data: string; mimeType: string } | null
): Promise<any[]> => {
  const prompt = `Jesteś asystentem edukacyjnym, generatorem testów opartym o model **Gemini 3.1 Pro Preview**.
Twoim zadaniem jest przygotowanie testu dla kursanta na podstawie jego dotychczasowych lekcji oraz dostarczonych materiałów.

# ZASADY ŻELAZNE:
1. Przeanalizuj dokładnie profil kursanta:
${studentProfile}
Nie wymyślaj rzeczy, które nie istnieją w profilu ani w lekcjach. 
2. Test musi być ściśle dostosowany do poziomu kursanta: ${level}.
3. Wykorzystaj elementy, które faktycznie pojawiały się w trakcie nauki (słownictwo z lekcji: ${lessonContext}). Test ma bazować na podobnych strukturach, aby kursant się nie pogubił.
4. Wygeneruj DOKŁADNIE 10 różnych zadań, w formatach:
   - multiple_choice (wielokrotnego wyboru),
   - fill_in_blank (krótkie zadania na wpisywanie brakujących elementów),
   - translation (tłumaczenie zdań z języka polskiego na angielski na podstawie omawianych tematów).
5. Zdania mają być autentyczne, brzmieć naturalnie, tak aby kursant widział ich praktyczne zastosowanie w swoim życiu. Unikaj dziwnych, nierealnych sytuacji.

Tytuł testu: ${testTitle}
Zakres materiału: ${scope}
  
Zwróć wynik jako obiekt JSON zawierający tablicę obiektów pytań.`;

  const schema = {
    type: Type.ARRAY,
    description: "Array of test questions",
    items: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["multiple_choice", "fill_in_blank", "translation"], description: "Type of the question" },
        prompt: { type: Type.STRING, description: "The question or the sentence to translate/fill" },
        options: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Options for multiple_choice. Leave empty for other types."
        },
        correctAnswer: { type: Type.STRING, description: "The correct answer (exact string). For translation, the correct English translation." },
        hint: { type: Type.STRING, description: "Optional hint in Polish." }
      },
      required: ["type", "prompt", "correctAnswer"]
    }
  };

  try {
    const contents: any[] = [prompt];
    if (fileData) {
      contents.push({
        inlineData: {
          data: fileData.data,
          mimeType: fileData.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro", // Fallback to 1.5 pro since 3.1 pro doesn't exist yet in the SDK
      contents: contents,
      config: {
        systemInstruction: "You are an expert language teacher. Generate customized tests based on the student's lesson history, profile, and level. Ensure questions are practical and match the exact material covered.",
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return JSON.parse(response.text.trim());
  } catch (err) {
    console.error("Test generation failed", err);
    throw new Error("Failed to generate test.");
  }
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
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return JSON.parse(response.text.trim());
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
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (err) {
    console.error("Error generating context sentence:", err);
    return "";
  }
};

export const generateImageForTerm = async (term: string, context?: string): Promise<string | null> => {
  const prompt = `A clear, educational, and high-quality illustration representing the concept of "${term}". ${context ? `Context: ${context}.` : ''} Minimalist and clean style.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
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
      model: "gemini-1.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error modifying test:", error);
    throw new Error("Failed to modify test.");
  }
};

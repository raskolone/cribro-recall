
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
      isCorrect: { type: Type.BOOLEAN, description: "Whether the answer is mostly correct or functionally accurate" },
      score: { type: Type.INTEGER, description: "Accuracy score from 0 to 100 based on grammar, choice of words, and meaning" },
      explanation: { type: Type.STRING, description: "Detailed explanation in Polish highlighting mistakes, grammar rules, and alternative correct translations" }
    },
    required: ['polishSentence', 'correctTranslation', 'studentAnswer', 'isCorrect', 'score', 'explanation']
  }
};

export const generateTranslationExercises = async (
  level: string,
  words: string[],
  customPrompt?: string,
  lessonContext?: string,
  studentProfileContext?: string
): Promise<TranslationExercise[]> => {
  const basePrompt = `Generate a list of 5 unique sentences in Polish for a student to translate into English.
  The exercises must be suitable for CEFR level: ${level}.
  ${words.length > 0 ? `The sentences should incorporate or test the following English vocabulary/concepts: ${words.join(', ')}.` : ''}
  ${lessonContext ? `Here are some summaries of the student's recent lessons to help personalize the content:\n${lessonContext}` : ''}
  ${studentProfileContext ? `Here are details about the student's profile (interests, weaknesses, goals):\n${studentProfileContext}\nPlease use these details to personalize the context of the sentences (e.g. if they like football, make a sentence about football).` : ''}
  For each sentence, provide the Polish sentence, the correct English translation, and a helpful Polish hint.`;

  const finalPrompt = customPrompt ? `${customPrompt}\n\nContext and Constraints:\n${basePrompt}` : basePrompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: finalPrompt,
      config: {
        systemInstruction: "Wygeneruj zdania na podstawie słownictwa wybranego przez usera, dostosuj poziom zdań",
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
  customEvaluationPrompt?: string
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

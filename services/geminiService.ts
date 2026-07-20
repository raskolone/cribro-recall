import { auth } from '../firebase';
export const extractJSON = (text: string): string => {
  if (!text) return "{}";
  
  // Try to find markdown code blocks first
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
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
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: vocabularySchema,
      },
    });
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText);
  } catch (error: any) {
    console.error("Error generating vocabulary:", error);
    throw new Error(error.message || "Failed to generate vocabulary.");
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
      isCorrect: { type: Type.BOOLEAN, description: "Whether the translation is completely correct and natural." },
      feedback: { type: Type.STRING, description: "Feedback in Polish explaining errors or giving praise." }
    },
    required: ['polishSentence', 'correctTranslation', 'studentAnswer', 'isCorrect', 'feedback']
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
  const shortLesson = lessonContext ? `Lesson context: ${lessonContext.substring(0, 500)}` : '';
  const shortProfile = studentProfileContext ? `Student profile: ${studentProfileContext.substring(0, 300)}` : '';
  const shortPast = pastExercisesContext ? `Past exercises to avoid repeats: ${pastExercisesContext.substring(0, 500)}` : '';

  const basePrompt = `Generate exactly ${numSentences} unique Polish-English translation exercises for a student at CEFR level ${level}.
Make them short, practical, and strictly appropriate for ${level}.
${words.length > 0 ? 'Use these words if possible: ' + words.join(', ') : ''}${shortLesson}${shortProfile}${shortPast}

Return JSON array of objects with:
- polishSentence (string)
- englishTranslation (string)
- hint (string, in Polish)`;

  const finalPrompt = customPrompt ? `${customPrompt}\n\nConstraints:\n${basePrompt}` : basePrompt;

  try {
    const config = {
      systemInstruction: "You are an AI language tutor. Generate short, level-appropriate translation sentences. Be fast and concise. Always return valid JSON array.",
      responseMimeType: "application/json",
      responseSchema: translationExerciseSchema,
    };
    
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-3.5-flash failed, retrying with gemini-3.5-flash...", e1);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    }
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationExercise[];
  } catch (error: any) {
    console.error("Error generating translation exercises:", error);
    throw new Error(error.message || "Failed to generate translation exercises from AI.");
  }
};

export const evaluateTranslations = async (
  exercises: TranslationExercise[],
  studentAnswers: string[],
  strictnessPrompt: string,
  evalStudentContext: string
): Promise<TranslationEvaluationResult[]> => {
  const prompt = `Evaluate the following student translations from Polish to English.
${evalStudentContext}
${strictnessPrompt}

Exercises:
${exercises.map((ex, i) => `${i + 1}. Polish: "${ex.polishSentence}" | Expected: "${ex.englishTranslation}" | Student Answer: "${studentAnswers[i]}"`).join('\n')}`;

  try {
    const config = {
      systemInstruction: "You are an AI language tutor evaluating translations. Always return a valid JSON array.",
      responseMimeType: "application/json",
      responseSchema: evaluationResultSchema,
    };
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config,
      });
    } catch (e1) {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config,
      });
    }
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationEvaluationResult[];
  } catch (error: any) {
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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

export const generateHomework = async (topic: string, summary: string, words: string): Promise<string> => {
  const prompt = `Jako doświadczony nauczyciel języka angielskiego, wygeneruj spersonalizowaną pracę domową dla ucznia na podstawie odbytej lekcji.
  Temat lekcji: ${topic}
  Podsumowanie lekcji: ${summary}
  Przerobione słownictwo: ${words}
  
  Praca domowa powinna być krótka, angażująca i utrwalać przerobiony materiał. Zaproponuj 3-5 zdań do przetłumaczenia na angielski, kilka pytań otwartych do odpowiedzi pisemnej po angielsku lub krótkie ćwiczenie (np. "uzupełnij luki") polegające na użyciu słownictwa z lekcji. Zwróć wynik w formacie Markdown. Pisz bezpośrednio do ucznia w przyjaznym tonie po polsku.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    return response?.text || "";
  } catch (error) {
    console.error("Error generating homework:", error);
    throw new Error("Failed to generate homework.");
  }
};

export const getAudioPronunciation = async (text: string, language: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: language === 'en' ? 'Puck' : 'Kore' },
            },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || '';
  } catch (err) {
    console.error('Error generating audio:', err);
    return '';
  }
};

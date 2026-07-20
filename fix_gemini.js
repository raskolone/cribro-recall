import fs from 'fs';

let file = 'services/geminiService.ts';
let lines = fs.readFileSync(file, 'utf-8').split('\n');

// Find start of generateVocabulary
let startIndex = lines.findIndex(l => l.includes('export const generateVocabulary ='));
// Find start of generateHomework
let endIndex = lines.findIndex(l => l.includes('export const generateHomework ='));

let replacement = `export const generateVocabulary = async (language: Language, difficulty: Difficulty): Promise<Omit<Word, 'id' | 'isDifficult' | 'language'>[]> => {
  const prompt = \`Generate a list of 10 unique \${language} vocabulary words for the \${difficulty} CEFR level. For each word, provide: the word itself, its IPA transcription, a simple definition in English, and an example sentence. Do not repeat words.\`;
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
  const shortLesson = lessonContext ? \`Lesson context: \${lessonContext.substring(0, 500)}\` : '';
  const shortProfile = studentProfileContext ? \`Student profile: \${studentProfileContext.substring(0, 300)}\` : '';
  const shortPast = pastExercisesContext ? \`Past exercises to avoid repeats: \${pastExercisesContext.substring(0, 500)}\` : '';

  const basePrompt = \`Generate exactly \${numSentences} unique Polish-English translation exercises for a student at CEFR level \${level}.
Make them short, practical, and strictly appropriate for \${level}.
\${words.length > 0 ? 'Use these words if possible: ' + words.join(', ') : ''}\${shortLesson}\${shortProfile}\${shortPast}

Return JSON array of objects with:
- polishSentence (string)
- englishTranslation (string)
- hint (string, in Polish)\`;

  const finalPrompt = customPrompt ? \`\${customPrompt}\n\nConstraints:\n\${basePrompt}\` : basePrompt;

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
  const prompt = \`Evaluate the following student translations from Polish to English.
\${evalStudentContext}
\${strictnessPrompt}

Exercises:
\${exercises.map((ex, i) => \`\${i + 1}. Polish: "\${ex.polishSentence}" | Expected: "\${ex.englishTranslation}" | Student Answer: "\${studentAnswers[i]}"\`).join('\n')}\`;

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
    throw new Error("Failed to evaluate translations.");
  }
};
`;

lines.splice(startIndex, endIndex - startIndex, replacement);
fs.writeFileSync(file, lines.join('\n'));
console.log("Fixed geminiService.ts");

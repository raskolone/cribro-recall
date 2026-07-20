import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// The missing outer `try {` is right before `let response;` in `evaluateTranslations`, and before `const config` in both?
// No, I'll just run a regex that wraps the inner block if it's not wrapped.
// Or I can just write evaluateTranslations again cleanly.

content = content.replace(/export const evaluateTranslations[\s\S]*?\}\s*catch\s*\(error\)\s*\{\s*console\.error\("Error evaluating translations:", error\);\s*throw new Error\("Failed to evaluate translations with AI\."\);\s*\}\s*\};/g,
`export const evaluateTranslations = async (
  exercises: TranslationExercise[],
  studentAnswers: string[],
  strictnessPrompt: string,
  evalStudentContext: string
): Promise<TranslationEvaluationResult[]> => {
  const prompt = \`Evaluate the following student translations from Polish to English.
\${evalStudentContext}
\${strictnessPrompt}

Exercises:
\${exercises.map((ex, i) => \`\${i + 1}. Polish: "\${ex.polishSentence}" | Expected: "\${ex.englishTranslation}" | Student Answer: "\${studentAnswers[i]}"\`).join('\\n')}\`;

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
};`
);

content = content.replace(/export const generateTranslationExercises[\s\S]*?\}\s*catch\s*\(error:\s*any\)\s*\{\s*console\.error\("Error generating translation exercises:", error\);\s*throw new Error\(error\.message \|\| "Failed to generate translation exercises from AI\."\);\s*\}\s*\};/g,
`export const generateTranslationExercises = async (
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

  const finalPrompt = customPrompt ? \`\${customPrompt}\\n\\nConstraints:\\n\${basePrompt}\` : basePrompt;

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
};`
);

fs.writeFileSync(file, content);
console.log("Fixed final");

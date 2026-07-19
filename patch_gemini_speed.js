import fs from 'fs';
let content = fs.readFileSync('services/geminiService.ts', 'utf-8');

const targetFunc = content.match(/export const generateTranslationExercises = async \([\s\S]*?\): Promise<TranslationExercise\[\]> => \{[\s\S]*?return JSON\.parse\(jsonText\) as TranslationExercise\[\];\n  \} catch \(error: any\) \{/)[0];

const newFunc = `export const generateTranslationExercises = async (
  level: string,
  words: string[],
  customPrompt?: string,
  lessonContext?: string,
  studentProfileContext?: string,
  numSentences: number = 5,
  pastExercisesContext?: string
): Promise<TranslationExercise[]> => {
  // Ograniczamy nadmiarowe dane kontekstowe dla modelu, aby przyspieszyć generowanie.
  // Zbyt duże prompt'y wydłużają czas odpowiedzi.
  const shortLesson = lessonContext ? \`\nLesson context: \${lessonContext.substring(0, 500)}\` : '';
  const shortProfile = studentProfileContext ? \`\nStudent profile: \${studentProfileContext.substring(0, 300)}\` : '';
  const shortPast = pastExercisesContext ? \`\nPast exercises to avoid repeats: \${pastExercisesContext.substring(0, 500)}\` : '';

  const basePrompt = \`Generate exactly \${numSentences} unique Polish-English translation exercises for a student at CEFR level \${level}.
Make them short, practical, and strictly appropriate for \${level}.
\${words.length > 0 ? 'Use these words if possible: ' + words.join(', ') : ''}\${shortLesson}\${shortProfile}\${shortPast}

Return JSON array of objects with:
- polishSentence (string)
- englishTranslation (string)
- hint (string, in Polish)\`;

  const finalPrompt = customPrompt ? \`\${customPrompt}\n\nConstraints:\n\${basePrompt}\` : basePrompt;

  try {
    let response;
    const config = {
      systemInstruction: "You are an AI language tutor. Generate short, level-appropriate translation sentences. Be fast and concise. Always return valid JSON array.",
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
      console.warn("gemini-2.5-flash failed, retrying with gemini-2.5-flash-lite...", e1);
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: finalPrompt,
        config,
      });
    }
    
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationExercise[];
  } catch (error: any) {`;

content = content.replace(targetFunc, newFunc);
fs.writeFileSync('services/geminiService.ts', content);

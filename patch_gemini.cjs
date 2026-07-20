const fs = require('fs');
const path = 'services/geminiService.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `  try {
    const config = {
      systemInstruction: "You are an AI language tutor. Generate short, level-appropriate translation sentences. Be fast and concise. Always return valid JSON array.",
      responseMimeType: "application/json",
      responseSchema: translationExerciseSchema,
    };
    
    const response = await generateContentWithFallback({ contents: finalPrompt, config });
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationExercise[];
  } catch (error: any) {
    console.error("Error generating translation exercises:", error);
    throw new Error(error.message || "Failed to generate translation exercises from AI.");
  }`;

const replacement = `  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const config = {
        systemInstruction: "You are an AI language tutor. Generate short, level-appropriate translation sentences. Be fast and concise. Always return valid JSON array.",
        responseMimeType: "application/json",
        responseSchema: translationExerciseSchema,
      };
      
      const response = await generateContentWithFallback({ contents: finalPrompt, config });
      let jsonText = extractJSON(response?.text || "");
      const parsed = JSON.parse(jsonText) as TranslationExercise[];
      if (parsed && parsed.length > 0) {
        return parsed;
      }
      console.warn(\`Attempt \${attempt}: Received empty exercises, retrying...\`);
    } catch (error: any) {
      console.error(\`Error generating translation exercises on attempt \${attempt}:\`, error);
      if (attempt === MAX_RETRIES) {
        throw new Error(error.message || "Failed to generate translation exercises from AI.");
      }
    }
  }
  return [];`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log('Patched geminiService.ts for retries in generation');

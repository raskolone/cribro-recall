const fs = require('fs');
const path = 'services/geminiService.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `  try {
    const config = {
      systemInstruction: "You are an AI language tutor evaluating translations. Always return a valid JSON array.",
      responseMimeType: "application/json",
      responseSchema: evaluationResultSchema,
    };
    const response = await generateContentWithFallback({ contents: prompt, config });
    let jsonText = extractJSON(response?.text || "");
    return JSON.parse(jsonText) as TranslationEvaluationResult[];
  } catch (error: any) {
    console.error("Error evaluating translations:", error);
    throw new Error("Failed to evaluate translations with AI.");
  }`;

const replacement = `  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const config = {
        systemInstruction: "You are an AI language tutor evaluating translations. Always return a valid JSON array.",
        responseMimeType: "application/json",
        responseSchema: evaluationResultSchema,
      };
      const response = await generateContentWithFallback({ contents: prompt, config });
      let jsonText = extractJSON(response?.text || "");
      const parsed = JSON.parse(jsonText) as TranslationEvaluationResult[];
      if (parsed && parsed.length > 0) {
        return parsed;
      }
      console.warn(\`Attempt \${attempt}: Received empty evaluation, retrying...\`);
    } catch (error: any) {
      console.error(\`Error evaluating translations on attempt \${attempt}:\`, error);
      if (attempt === MAX_RETRIES) {
        throw new Error("Failed to evaluate translations with AI.");
      }
    }
  }
  return [];`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log('Patched geminiService.ts for retries in evaluation');

import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// Insert the helper function after extractJSON
const helper = `
const generateContentWithFallback = async (params: any) => {
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError;
  for (const model of models) {
    try {
      console.log(\`Attempting generation with \${model}...\`);
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return response;
    } catch (e: any) {
      console.warn(\`Model \${model} failed:\`, e?.status || e?.message);
      lastError = e;
      if (e?.status === 400 && e?.message?.includes("not found")) {
         // Model doesn't exist, try next
         continue;
      }
      if (e?.status === 503 || e?.status === 429) {
         // High demand or rate limit, try next
         continue;
      }
      // For other errors, it might be a prompt issue, but let's try next anyway for robustness
    }
  }
  throw lastError;
};
`;

content = content.replace(/export const extractJSON =.*?\}\n/s, (match) => match + helper);

fs.writeFileSync(file, content);
console.log("Added helper");

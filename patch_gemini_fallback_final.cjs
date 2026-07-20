const fs = require('fs');
const path = 'services/geminiService.ts';
let content = fs.readFileSync(path, 'utf8');

const oldFallback = `const generateContentWithFallback = async (params: any) => {
  const model = "gemini-1.5-flash";
  console.log(\`Attempting generation with \${model}...\`);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timed out after 15 seconds")), 15000);
  });
  
  const apiCall = ai.models.generateContent({
    ...params,
    model,
  });

  return await Promise.race([apiCall, timeoutPromise]) as any;
};`;

const newFallback = `const generateContentWithFallback = async (params: any) => {
  const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash-lite-001"];
  let lastError;
  for (const model of models) {
    try {
      console.log(\`Attempting generation with \${model}...\`);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 15 seconds")), 15000);
      });
      
      const apiCall = ai.models.generateContent({
        ...params,
        model,
      });

      const response = await Promise.race([apiCall, timeoutPromise]);
      return response as any;
    } catch (e: any) {
      console.warn(\`Model \${model} failed:\`, e?.status || e?.message);
      lastError = e;
      if (e?.message?.includes("timed out")) continue;
      if (e?.status === 404 || e?.status === 503 || e?.status === 429) continue;
      if (e?.status === 400 && e?.message?.includes("not found")) continue;
      if (e?.status === 400) throw e;
    }
  }
  throw lastError;
};`;

if(content.includes(oldFallback)) {
  content = content.replace(oldFallback, newFallback);
  fs.writeFileSync(path, content);
  console.log("Patched fallback successfully");
} else {
  console.log("oldFallback not found");
}

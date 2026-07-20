const fs = require('fs');
const path = 'services/geminiService.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /const generateContentWithFallback = async \(params: any\) => \{[\s\S]*?throw lastError;\n\};/;

const newFallback = `const generateContentWithFallback = async (params: any) => {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
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
      console.warn(\`Model \${model} failed:\`, e);
      lastError = e;
      if (e?.message?.includes("timed out")) continue;
      if (e?.status === 404 || e?.status === 503 || e?.status === 429) continue;
      // if it's 400 but says not found, continue
      if (e?.status === 400 && e?.message?.includes("not found")) continue;
      
      // if we are here, it's a real 400 (bad request) or 500 (internal error), we should throw if it's a bad prompt
      if (e?.status === 400) throw e;
    }
  }
  throw lastError;
};`;

if(regex.test(content)) {
  content = content.replace(regex, newFallback);
  fs.writeFileSync(path, content);
  console.log("Patched fallback successfully");
} else {
  console.log("Regex did not match");
}

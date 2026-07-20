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
        setTimeout(() => reject(new Error("Request timed out after 10 seconds")), 10000);
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
      if (e?.message?.includes("timed out")) {
        continue;
      }
      if (e?.status === 400 && e?.message?.includes("not found")) { 
         continue;
      }
      if (e?.status === 503 || e?.status === 429) { 
         continue;
      }
      if (e?.status === 400) {
         throw e; // Don't retry invalid prompts
      }
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

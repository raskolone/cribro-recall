const fs = require('fs');
const file = 'services/geminiService.ts';
let text = fs.readFileSync(file, 'utf8');

const regex = /const generateContentWithFallback = async \(params: any\) => \{[\s\S]*?\n\};\n\nif \(!process\.env\.API_KEY\) \{/;

const newFunc = `const generateContentWithFallback = async (params: any) => {
  const models = ["gemini-3.5-flash", "gemini-3.5-flash-8b", "gemini-3.1-pro", "gemini-3.1-flash-lite"];
  let lastError;
  for (const model of models) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(\`Attempting generation with \${model}... (retries left: \${retries})\`);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out after 45 seconds")), 45000);
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
        if (e?.message?.includes("timed out") || e?.status === 503 || e?.status === 429) {
           retries--;
           if (retries > 0) {
             console.log(\`Waiting before retry...\`);
             await new Promise(r => setTimeout(r, 2000));
             continue;
           }
        } else if (e?.status === 404 || (e?.status === 400 && e?.message?.includes("not found"))) {
           // Model not found, break out of retry loop and go to next model
           break;
        } else {
           throw e;
        }
      }
    }
  }
  throw lastError;
};

if (!process.env.API_KEY) {`;

text = text.replace(regex, newFunc);
fs.writeFileSync(file, text);

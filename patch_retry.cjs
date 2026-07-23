const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const retryFunction = `
async function generateContentWithRetry(aiClient: any, contents: any, config: any) {
  const models = ['gemini-3.5-flash', 'gemini-3.5-flash-8b', 'gemini-3.1-pro', 'gemini-3.1-flash-lite'];
  let lastError;
  
  for (const model of models) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(\`[Server] Attempting generation with \${model}... (retries left: \${retries})\`);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out after 45 seconds")), 45000);
        });
        
        const apiCall = aiClient.models.generateContent({
          model,
          contents,
          config
        });
        
        const response = await Promise.race([apiCall, timeoutPromise]);
        return response;
      } catch (err: any) {
        console.warn(\`[Server] Model \${model} failed:\`, err?.status || err?.message);
        lastError = err;
        
        if (err?.message?.includes("timed out") || err?.status === 503 || err?.status === 429) {
          retries--;
          if (retries > 0) {
            console.log(\`[Server] Waiting before retry...\`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        } else if (err?.status === 404 || (err?.status === 400 && err?.message?.includes("not found"))) {
          break; // Next model
        } else {
          throw err;
        }
      }
    }
  }
  throw lastError;
}
`;

content = content.replace('import { GoogleGenAI, Type } from "@google/genai";', 'import { GoogleGenAI, Type } from "@google/genai";\n' + retryFunction);
fs.writeFileSync(file, content);

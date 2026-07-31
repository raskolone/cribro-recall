const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const replacement = `
const generateContentWithFallback = async (params: any) => {
  const models = params.preferredModels || PREFERRED_AI_MODELS;
  const { preferredModels, ...apiParams } = params;

  let lastError;
  for (const model of models) {
    try {
      console.log(\`Attempting generation with \${model}...\`);
      
      if (model.startsWith('deepseek')) {
         const promptText = typeof apiParams.contents === 'string' ? apiParams.contents : 
                            (Array.isArray(apiParams.contents) ? apiParams.contents.map((c: any) => c.text || JSON.stringify(c)).join('\\n') : JSON.stringify(apiParams.contents));
         const sysInst = apiParams.config?.systemInstruction || "You are a helpful AI assistant.";
         
         const text = await callDeepSeek(promptText, sysInst, model);
         return { text };
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000);
      });
      
      const apiCall = getAI().models.generateContent({
        ...apiParams,
        model,
      });

      const response = await Promise.race([apiCall, timeoutPromise]);
      return response as any;
    } catch (e: any) {
      console.warn(\`Model \${model} failed:\`, e?.status || e?.message);
      lastError = e;
      if (e?.message?.includes("timed out")) continue;
      if (String(e?.status) === "404" || String(e?.status) === "503" || String(e?.status) === "429" || e?.message?.includes("503") || e?.message?.includes("429")) continue;
      if (String(e?.status) === "400" && e?.message?.includes("not found")) continue;
      continue;
    }
  }
  throw lastError;
};
`;

code = code.replace(/const generateContentWithFallback = async \(params: any\) => \{[\s\S]*?throw lastError;\n\};/, replacement.trim());

fs.writeFileSync('services/geminiService.ts', code);

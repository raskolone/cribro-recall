const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

// replace callDeepSeek
const oldCallDeepSeekRegex = /const callDeepSeek = async \([\s\S]*?return data\.text;\n\};/m;
const newCallDeepSeek = `import { generateDeepSeekResponse } from './deepseekService';

const callDeepSeek = async (prompt: string, systemInstruction: string, model: string = "deepseek-chat") => {
  return await generateDeepSeekResponse(prompt, systemInstruction);
};`;

code = code.replace(oldCallDeepSeekRegex, newCallDeepSeek);

// replace preferredModels inside evaluateTranslations
const preferredModelsRegex = /const preferredModels = PREFERRED_AI_MODELS;/g;
code = code.replace(preferredModelsRegex, "const preferredModels = ['deepseek-chat', 'openai/gpt-4o-mini'];");

fs.writeFileSync('services/geminiService.ts', code);

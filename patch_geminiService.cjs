const fs = require('fs');

let code = fs.readFileSync('services/geminiService.ts', 'utf8');

// Update formatAIModelName
const formatAIModelNameTarget = `export const formatAIModelName = (model?: string): string => {
  if (!model) return 'DeepSeek Pro (R1)';
  if (model.includes('deepseek-reasoner')) return 'DeepSeek Pro (R1)';`;
const formatAIModelNameNew = `export const formatAIModelName = (model?: string): string => {
  if (!model) return 'DeepSeek v4 Pro';
  if (model.includes('deepseek-reasoner') || model.includes('deepseekv4-pro')) return 'DeepSeek v4 Pro';`;

code = code.replace(formatAIModelNameTarget, formatAIModelNameNew);

// Update evaluateTranslations models
const evalTarget = `      const systemInstruction = "You are a fair, intelligent AI Language Evaluator. Evaluate translations strictly according to the rubric and return valid JSON.";
      
      const preferredModels = PREFERRED_AI_MODELS;`;
const evalNew = `      const systemInstruction = "You are a fair, intelligent AI Language Evaluator. Evaluate translations strictly according to the rubric and return valid JSON.";
      
      // Force DeepSeek v4 Pro (reasoner) as the absolute primary choice for evaluation with advanced reasoning
      const preferredModels = ['deepseek-reasoner', 'deepseek-chat', 'gemini-3.1-pro-preview', 'gemini-3.6-flash'];`;

code = code.replace(evalTarget, evalNew);
fs.writeFileSync('services/geminiService.ts', code);

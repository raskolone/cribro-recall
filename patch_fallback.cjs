const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

code = code.replace(
  "export const PREFERRED_AI_MODELS = [\n  'openai/gpt-4o-mini',\n  'gemini-2.5-flash',\n  'gemini-2.0-flash'\n];",
  "export const PREFERRED_AI_MODELS = ['openai/gpt-4o-mini'];"
);

// We need to check if there are other occurrences of PREFERRED_AI_MODELS.

fs.writeFileSync('services/geminiService.ts', code);

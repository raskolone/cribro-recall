const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

code = code.replace(
  "console.warn(`Model ${model} failed:`, error?.message || error);\\n      lastError = error;",
  "console.warn(`Model ${model} failed:`, error?.message || error);\n      lastError = error;\n      if (error?.message === 'Missing VITE_OPENAI_API_KEY') {\n        throw error;\n      }"
);

fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched fallback logic in services/geminiService.ts");

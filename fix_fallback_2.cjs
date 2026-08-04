const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

code = code.replace(
  "console.warn(`Model ${model} failed:`, e?.status || e?.message);\\n      lastError = e;",
  "console.warn(`Model ${model} failed:`, e?.status || e?.message);\n      lastError = e;\n      if (e?.message === 'Missing VITE_OPENAI_API_KEY') {\n        throw e;\n      }"
);

fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched fallback logic in generateContentWithFallback");

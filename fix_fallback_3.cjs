const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

code = code.replace(
  "    } catch (e: any) {\n      console.warn(`Model ${model} failed:`, e?.status || e?.message);\n      lastError = e;",
  "    } catch (e: any) {\n      console.warn(`Model ${model} failed:`, e?.status || e?.message);\n      lastError = e;\n      if (e?.message === 'Missing VITE_OPENAI_API_KEY') {\n        throw e;\n      }"
);

fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched fallback logic in generateContentWithFallback");

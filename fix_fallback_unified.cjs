const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

code = code.replace(
  "    } catch (error: any) {\n      console.warn(`Model ${model} failed:`, error?.message || error);\n      lastError = error;\n    }",
  "    } catch (error: any) {\n      console.warn(`Model ${model} failed:`, error?.message || error);\n      lastError = error;\n      if (error?.message === 'Missing VITE_OPENAI_API_KEY') {\n        throw error;\n      }\n    }"
);

fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched fallback logic successfully");

const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

code = code.replace(/model: "gemini-2.5-pro"/g, 'model: "gemini-2.5-flash"');

fs.writeFileSync('services/geminiService.ts', code);

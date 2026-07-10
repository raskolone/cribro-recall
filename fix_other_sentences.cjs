const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

code = code.replace(/export const generateContextSentence = async[\s\S]*?model: "gemini-2\.5-flash"/, (match) => match.replace('gemini-2.5-flash', 'gemini-3.5-flash'));

fs.writeFileSync('services/geminiService.ts', code);

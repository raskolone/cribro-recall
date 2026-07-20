import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/gemini-2\.5-flash/g, "gemini-3.5-flash");
fs.writeFileSync(file, content);
console.log("Reverted to gemini-3.5-flash");

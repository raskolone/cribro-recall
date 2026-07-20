import fs from 'fs';

let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/\.join\('\n'\)/g, ".join('\\n')");

fs.writeFileSync(file, content);
console.log("Fixed newlines");

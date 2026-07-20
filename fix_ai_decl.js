import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// I might have added `ai` twice when running fix_ai_init.js
// Let's remove the second occurrence.

const secondAiStart = content.indexOf('const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });', content.indexOf('const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });') + 1);

if (secondAiStart !== -1) {
    content = content.substring(0, secondAiStart) + content.substring(secondAiStart + 'const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });'.length);
    fs.writeFileSync(file, content);
    console.log("Removed duplicate ai");
} else {
    console.error("No duplicate found?");
    
    // Maybe process.env.API_KEY check was also duplicated?
    const aiInit = `if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });`;
    const count = content.split('const ai = new GoogleGenAI').length - 1;
    console.log("Count is", count);
}

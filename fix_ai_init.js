import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

const aiInit = `if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
`;

content = content.replace(aiInit, '');
const fallbackStart = content.indexOf('const generateContentWithFallback =');
content = content.substring(0, fallbackStart) + aiInit + '\n' + content.substring(fallbackStart);

fs.writeFileSync(file, content);
console.log("Moved ai init");

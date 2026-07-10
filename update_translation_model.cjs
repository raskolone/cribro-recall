const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

const target = `    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: finalPrompt,`;

const replacement = `    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: finalPrompt,`;

code = code.replace(target, replacement);
fs.writeFileSync('services/geminiService.ts', code);

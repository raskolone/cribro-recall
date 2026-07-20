import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /response = await ai\.models\.generateContent\(\{[\s\S]*?config,\n\s*\}\);/g,
  `response = await ai.models.generateContent({\n        model: "gemini-3.5-flash",\n        contents: finalPrompt,\n        config,\n      });\n      console.log("Raw Gemini API response:", response);`
);

fs.writeFileSync(file, content);
console.log("Added logging");

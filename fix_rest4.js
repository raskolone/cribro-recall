import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// For generateTranslationExercises:
content = content.replace(
  /let response;\n\s*try \{\n\s*response = await ai\.models\.generateContent\(\{\n\s*model: "gemini-3\.5-flash",\n\s*contents: finalPrompt,/g,
  `try {\n  let response;\n  try {\n    response = await ai.models.generateContent({\n      model: "gemini-3.5-flash",\n      contents: finalPrompt,`
);

// For evaluateTranslations:
content = content.replace(
  /let response;\n\s*try \{\n\s*response = await ai\.models\.generateContent\(\{\n\s*model: "gemini-3\.5-flash",\n\s*contents: prompt,/g,
  `try {\n  let response;\n  try {\n    response = await ai.models.generateContent({\n      model: "gemini-3.5-flash",\n      contents: prompt,`
);

fs.writeFileSync(file, content);
console.log("Fixed outer try");

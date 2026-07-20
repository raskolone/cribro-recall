import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /let response;\s*try \{\s*response = await ai\.models\.generateContent\(\{/g,
  `try {\n  let response;\n  try {\n    response = await ai.models.generateContent({`
);

fs.writeFileSync(file, content);
console.log("Fixed try");

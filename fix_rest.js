import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// The regex I used before was: 
// response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: finalPrompt, config, });

// Let's replace the broken try catch with a clean one for ALL occurrences.
content = content.replace(
  /try \{\s*const response = await ai\.models\.generateContent\(\{\s*model: "gemini-3\.5-flash",\s*contents: (.*?),\s*config,\s*\}\);\s*console\.log\("Raw Gemini API response:", response\);\s*\} catch \(e1: any\) \{\s*.*?\s*response = await ai\.models\.generateContent\(\{\s*model: "gemini-3\.5-flash",\s*contents: (.*?),\s*config,\s*\}\);\s*console\.log\("Raw Gemini API response:", response\);\s*\}/g,
  `let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: $1,
      config,
    });
  } catch (e1) {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: $2,
      config,
    });
  }`
);

fs.writeFileSync(file, content);
console.log("Fixed rest");

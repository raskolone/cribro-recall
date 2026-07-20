import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/try \{\s*let response;\s*try \{/g, '  let response;\n  try {');

// Also replace finalPrompt in evaluateTranslations with prompt
// evaluateTranslations is around line 200.
// finalPrompt is only used in generateTranslationExercises. I'll replace finalPrompt with prompt in the block where evaluateTranslations is.
content = content.replace(/contents: finalPrompt,\s*config,\s*\}\);\s*\}\s*catch\s*\(e1\)/, 'contents: prompt,\n      config,\n    });\n  } catch (e1)');
content = content.replace(/catch\s*\(e1\)\s*\{\s*response = await ai\.models\.generateContent\(\{\s*model:\s*"gemini-3\.5-flash",\s*contents:\s*finalPrompt/g, 'catch (e1) {\n    response = await ai.models.generateContent({\n      model: "gemini-3.5-flash",\n      contents: prompt');

fs.writeFileSync(file, content);
console.log("Fixed try and finalPrompt");

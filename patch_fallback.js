import fs from 'fs';
let content = fs.readFileSync('services/geminiService.ts', 'utf-8');
content = content.replace(/console\.warn\("gemini-2\.5-flash failed, retrying with gemini-2\.5-flash\.\.\.", e1\);\s*response = await ai\.models\.generateContent\(\{\s*model: "gemini-2\.5-flash"/g, 
  'console.warn("gemini-2.5-flash failed, retrying with gemini-1.5-flash-8b (lite fallback)...", e1);\n      response = await ai.models.generateContent({\n        model: "gemini-1.5-flash-8b"');

content = content.replace(/console\.warn\("gemini-2\.5-flash eval failed on first attempt, retrying with gemini-2\.5-flash\.\.\.", e1\);\s*response = await ai\.models\.generateContent\(\{\s*model: "gemini-2\.5-flash"/g,
  'console.warn("gemini-2.5-flash eval failed on first attempt, retrying with gemini-1.5-flash-8b...", e1);\n      response = await ai.models.generateContent({\n        model: "gemini-1.5-flash-8b"');

fs.writeFileSync('services/geminiService.ts', content);

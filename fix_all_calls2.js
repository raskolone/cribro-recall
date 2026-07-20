import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// Use /s to match across newlines
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{\s*model:\s*"[^"]+",\s*contents:\s*([a-zA-Z0-9_]+),\s*config:\s*(\{.*?\})\s*,\s*\}\);/gs,
  `const response = await generateContentWithFallback({ contents: $1, config: $2 });`
);

// Without the trailing comma after config
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{\s*model:\s*"[^"]+",\s*contents:\s*([a-zA-Z0-9_]+),\s*config:\s*(\{.*?\})\s*\}\);/gs,
  `const response = await generateContentWithFallback({ contents: $1, config: $2 });`
);

fs.writeFileSync(file, content);
console.log("Fixed more");

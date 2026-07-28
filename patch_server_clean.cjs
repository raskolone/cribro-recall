const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex1 = /app\.post\('\/api\/gemini\/lesson-summary'[\s\S]*?\/\/ Proxy for Gemini API/;
code = code.replace(regex1, '// Proxy for Gemini API');

const regex2 = /app\.post\('\/api\/gemini\/import-lessons-batch'[\s\S]*?app\.post\('\/api\/gemini\/lesson-summary'/;
code = code.replace(regex2, 'app.post(\'/api/gemini/lesson-summary\'');

fs.writeFileSync('server.ts', code);
console.log("Cleaned server.ts");

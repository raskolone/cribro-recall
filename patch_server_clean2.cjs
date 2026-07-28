const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex2 = /app\.post\('\/api\/gemini\/import-lessons-batch'[\s\S]*?app\.post\('\/api\/gemini\/grade-test'/;
code = code.replace(regex2, 'app.post(\'/api/gemini/grade-test\'');

fs.writeFileSync('server.ts', code);
console.log("Cleaned import-lessons-batch from server.ts");

const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const models = \['gemini-2\.5-flash', 'gemini-2\.5-flash-8b', 'gemini-3\.1-flash-lite', 'gemini-3\.5-flash'\];/g, 
    "const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];");
  fs.writeFileSync(file, content);
}

fixFile('server.ts');
fixFile('services/geminiService.ts');

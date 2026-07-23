const fs = require('fs');
function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const models = \['gemini-3\.6-flash', 'gemini-3\.1-flash-lite', 'gemini-3\.1-pro-preview'\];/, 
    `const models = ['gemini-3.5-flash', 'gemini-3.5-flash-8b'];`);
  content = content.replace(/const models = \["gemini-3\.6-flash", "gemini-3\.1-flash-lite", "gemini-3\.1-pro-preview"\];/, 
    `const models = ['gemini-3.5-flash', 'gemini-3.5-flash-8b'];`);
  fs.writeFileSync(file, content);
}
patchFile('server.ts');
patchFile('services/geminiService.ts');

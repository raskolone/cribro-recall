const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the model arrays
  content = content.replace(/const models = \['gemini-3\.5-flash', 'gemini-3\.5-flash-8b', 'gemini-3\.1-pro', 'gemini-3\.1-flash-lite'\];/, 
    `const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];`);
    
  content = content.replace(/const models = \["gemini-3\.5-flash", "gemini-3\.1-flash-lite"\];/, 
    `const models = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];`);

  fs.writeFileSync(file, content);
}

patchFile('server.ts');
patchFile('services/geminiService.ts');

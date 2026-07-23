const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/setTimeout\(\(\) => reject\(new Error\("Request timed out after \d+ seconds"\)\), \d+\);/g, 
    'setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000);');
    
  // Use gemini-3.5-flash
  content = content.replace(/const models = \['gemini-3\.5-flash', 'gemini-3\.5-flash-8b'\];/, 
    `const models = ['gemini-3.5-flash', 'gemini-3.5-flash-8b', 'gemini-3.1-flash-lite'];`);
  content = content.replace(/const models = \['gemini-3\.5-flash', 'gemini-3\.5-flash-8b'\];/, 
    `const models = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];`);
    
  fs.writeFileSync(file, content);
}

patchFile('server.ts');
patchFile('services/geminiService.ts');

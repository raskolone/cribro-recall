const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace 25 seconds with 90 seconds.
  content = content.replace(/setTimeout\(\(\) => reject\(new Error\("Request timed out after \d+ seconds"\)\), \d+\);/g, 
    'setTimeout(() => reject(new Error("Request timed out after 90 seconds")), 90000);');

  fs.writeFileSync(file, content);
}

patchFile('server.ts');
patchFile('services/geminiService.ts');

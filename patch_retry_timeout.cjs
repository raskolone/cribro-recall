const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace 90 seconds with 20 seconds, and change the retry logic.
  content = content.replace(/setTimeout\(\(\) => reject\(new Error\("Request timed out after \d+ seconds"\)\), \d+\);/, 
    'setTimeout(() => reject(new Error("Request timed out after 25 seconds")), 25000);');
    
  // Change logic: if timeout, break to try the next model.
  content = content.replace(/if \(err\?\.message\?\.includes\("timed out"\) \|\| err\?\.status === 503 \|\| err\?\.status === 429\) \{/, 
    `if (err?.message?.includes("timed out")) {
          break; // Next model immediately on timeout
        } else if (err?.status === 503 || err?.status === 429) {`);

  fs.writeFileSync(file, content);
}

patchFile('server.ts');
patchFile('services/geminiService.ts');

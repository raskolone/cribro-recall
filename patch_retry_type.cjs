const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace strict equality with loose equality or string includes
  content = content.replace(/} else if \(err\?\.status === 503 \|\| err\?\.status === 429\) {/, 
    `} else if (String(err?.status) === "503" || String(err?.status) === "429" || err?.message?.includes("503") || err?.message?.includes("429")) {`);

  content = content.replace(/} else if \(err\?\.status === 404 \|\| \(err\?\.status === 400 && err\?\.message\?\.includes\("not found"\)\)\) {/, 
    `} else if (String(err?.status) === "404" || (String(err?.status) === "400" && err?.message?.includes("not found"))) {`);

  fs.writeFileSync(file, content);
}

patchFile('server.ts');

const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/if \(e\?\.status === 404 \|\| e\?\.status === 503 \|\| e\?\.status === 429\) continue;/, 
    `if (String(e?.status) === "404" || String(e?.status) === "503" || String(e?.status) === "429" || e?.message?.includes("503") || e?.message?.includes("429")) continue;`);

  content = content.replace(/if \(e\?\.status === 400 && e\?\.message\?\.includes\("not found"\)\) continue;/, 
    `if (String(e?.status) === "400" && e?.message?.includes("not found")) continue;`);

  content = content.replace(/if \(e\?\.status === 400\) throw e;/, 
    `if (String(e?.status) === "400") throw e;`);

  fs.writeFileSync(file, content);
}

patchFile('services/geminiService.ts');

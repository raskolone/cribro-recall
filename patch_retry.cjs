const fs = require('fs');

function patch(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\} else if \(String\(err\?\.status\) === "503" \|\| String\(err\?\.status\) === "429" \|\| err\?\.message\?\.includes\("503"\) \|\| err\?\.message\?\.includes\("429"\)\) \{/, 
    `} else if (String(err?.status) === "429" && err?.message?.includes("Quota exceeded for metric")) {
          console.warn("[Server] Quota exceeded, switching model immediately");
          break; // Next model immediately
        } else if (String(err?.status) === "503" || String(err?.status) === "429" || err?.message?.includes("503") || err?.message?.includes("429")) {`);
  fs.writeFileSync(file, content);
}
patch('server.ts');

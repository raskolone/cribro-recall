const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  /app.post\('\/api\/gemini\/import-lessons-batch', async \(req, res\) => {/,
  `app.post('/api/gemini/import-lessons-batch', requireFirebaseAdmin, async (req, res) => {`
);

fs.writeFileSync('server.ts', code);

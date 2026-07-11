const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/app\.use\(express\.json\(\{ limit: '50mb' \}\)\);/, `app.use(express.json({ limit: '50mb' }));
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next(err);
});`);

fs.writeFileSync('server.ts', code);
console.log('patched');

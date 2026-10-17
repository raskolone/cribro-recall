// Dev-only serwer testowy dla fiszek na telefon (FLASH-SWIPE-1).
// Serwuje harness fiszek z istniejących stubów (bez logowania, bez Firestore, bez sieci).
// Działa na 0.0.0.0:3009 — dostępny z sieci lokalnej (LAN) dla iPhone'a i innych urządzeń.
import { build } from 'esbuild';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = mkdtempSync(join(tmpdir(), 'flashcard-harness-'));
const stubs = join(repo, 'tests/browser/stubs.tsx');

console.log('Budowanie bundle fiszek (esbuild + stubs)...');
await build({
  entryPoints: [join(repo, 'tests/browser/flashcardEntry.tsx')],
  bundle: true,
  format: 'iife',
  outfile: join(out, 'app.js'),
  jsx: 'automatic',
  nodePaths: [join(repo, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'error',
  plugins: [{
    name: 'stub',
    setup(b) {
      b.onLoad({ filter: /FlashcardStudyScreen\.tsx$/ }, (a) => ({
        contents: readFileSync(a.path, 'utf8') + '\nexport { FlashcardsMode };',
        loader: 'tsx',
        resolveDir: dirname(a.path),
      }));
      b.onResolve({
        filter: /(context\/(AuthContext|LanguageContext|SettingsContext|FlashcardContext)|services\/(studentContext|ttsService))$/,
      }, () => ({ path: stubs }));
    },
  }],
});

console.log('Kompilacja stylów CSS (Tailwind v4)...');
const compiler = await compile(readFileSync(join(repo, 'index.css'), 'utf8'), { base: repo, onDependency() {} });
const scanner = new Scanner({
  sources: ['components', 'utils', 'design', 'hooks'].map((d) => ({ base: join(repo, d), pattern: '**/*', negated: false })),
});
const css = compiler.build(scanner.scan());
const js = readFileSync(join(out, 'app.js'), 'utf8');

function renderHtml(query) {
  const area = query.get('area') || 'study';
  const theme = query.get('theme') || 'dark';
  const term = query.get('term') || 'save';

  const toolbar = `
  <div style="background:rgba(15,23,42,0.95);border-bottom:1px solid rgba(255,255,255,0.1);padding:8px 12px;font-family:system-ui,sans-serif;font-size:12px;color:#94a3b8;display:flex;flex-wrap:wrap;align-items:center;gap:8px;position:sticky;top:0;z-index:9999;">
    <span style="font-weight:bold;color:#f8fafc;margin-right:4px;">🃏 Fiszki Dev Harness:</span>
    <a href="?area=study&theme=${theme}&term=${term}" style="color:${area==='study'?'#38bdf8':'#cbd5e1'};text-decoration:${area==='study'?'underline':'none'};padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.05);">Nauka (Study)</a>
    <a href="?area=warmup&theme=${theme}&term=${term}" style="color:${area==='warmup'?'#38bdf8':'#cbd5e1'};text-decoration:${area==='warmup'?'underline':'none'};padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.05);">Rozgrzewka (Warmup)</a>
    <span style="color:#475569;">|</span>
    <a href="?area=${area}&theme=${theme==='dark'?'light':'dark'}&term=${term}" style="color:#cbd5e1;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.05);">Motyw: ${theme==='dark'?'🌙 Ciemny (przełącz na jasny)':'☀️ Jasny (przełącz na ciemny)'}</a>
    <span style="color:#475569;">|</span>
    <span style="color:#64748b;">Słowo:</span>
    <a href="?area=${area}&theme=${theme}&term=save" style="color:${term==='save'?'#38bdf8':'#cbd5e1'};text-decoration:${term==='save'?'underline':'none'};">save</a>
    <a href="?area=${area}&theme=${theme}&term=motivation" style="color:${term==='motivation'?'#38bdf8':'#cbd5e1'};text-decoration:${term==='motivation'?'underline':'none'};">motivation</a>
    <a href="?area=${area}&theme=${theme}&term=long" style="color:${term==='long'?'#38bdf8':'#cbd5e1'};text-decoration:${term==='long'?'underline':'none'};">długi tekst</a>
  </div>`;

  return `<!doctype html>
<html lang="pl" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
  <title>Cribro Recall — Flashcards Test Harness</title>
  <style>${css}</style>
</head>
<body style="margin:0;padding:0;background-color:${theme==='dark'?'#090d16':'#f8fafc'};">
  ${toolbar}
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
</html>`;
}

const PORT = 3009;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/app.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(js);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(renderHtml(url.searchParams));
});

server.listen(PORT, HOST, () => {
  let lanIp = 'localhost';
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🚀 Flashcards Dev Harness uruchomiony!`);
  console.log(`   Lokalnie: http://localhost:${PORT}`);
  console.log(`   Telefon (LAN): http://${lanIp}:${PORT}`);
  console.log(`   Host: ${HOST}, Port: ${PORT}, PID: ${process.pid}`);
  console.log(`======================================================\n`);
});

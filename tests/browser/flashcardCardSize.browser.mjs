// Test przeglądarkowy (Chromium): karta fiszki ma TEN SAM rozmiar dla każdego pojęcia, obu stron
// i szerokości ekranu, a etykieta nie nachodzi na przyciski. Renderuje PRAWDZIWE FlashcardsMode
// (w łańcuchu kontenerów z Dashboard.tsx) i HomeworkWarmupCards (jak w shell() DirectHomeworkScreen).
// Uruchomienie: `npm run test:browser` (wymaga zainstalowanego Playwrighta z Chromium).
import { build } from 'esbuild';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = mkdtempSync(join(tmpdir(), 'flashcard-size-'));
const stubs = join(repo, 'tests/browser/stubs.tsx');

await build({
  entryPoints: [join(repo, 'tests/browser/flashcardEntry.tsx')], bundle: true, format: 'iife', outfile: join(out, 'app.js'),
  jsx: 'automatic', nodePaths: [join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) {
    b.onLoad({ filter: /FlashcardStudyScreen\.tsx$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8') + '\nexport { FlashcardsMode };', loader: 'tsx', resolveDir: dirname(a.path) }));
    b.onResolve({ filter: /(context\/(AuthContext|LanguageContext|SettingsContext|FlashcardContext)|services\/(studentContext|ttsService))$/ }, () => ({ path: stubs }));
  } }],
});
const compiler = await compile(readFileSync(join(repo, 'index.css'), 'utf8'), { base: repo, onDependency() {} });
const scanner = new Scanner({ sources: ['components', 'utils', 'design', 'hooks'].map((d) => ({ base: join(repo, d), pattern: '**/*', negated: false })) });
const css = compiler.build(scanner.scan());
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const js = readFileSync(join(out, 'app.js'));
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(js); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const intersects = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
const terms = ['motivation', 'save', 'keep', 'long'];
const widths = [[375, 812], [768, 1024], [1280, 800]];
const browser = await chromium.launch();
let checked = 0;
try {
  for (const area of ['study', 'warmup']) {
    const sizes = new Map();
    for (const theme of ['light', 'dark']) for (const [w, h] of widths) {
      const widthKey = `${area}@${w}`;
      for (const term of terms) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        await page.goto(`${base}?area=${area}&theme=${theme}&term=${term}`);
        await page.waitForSelector('[data-face]');
        const measure = () => page.evaluate(() => {
          const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
          const faces = [...document.querySelectorAll('[data-face]')].map(R);
          const headers = [...document.querySelectorAll('[data-face]')].map((f) => ({
            label: R(f.querySelector('[data-face-label]')), buttons: [...f.querySelectorAll('[data-face-actions] button')].map(R),
          }));
          const ctl = document.querySelector('[data-testid=flashcard-actions],[data-testid=warmup-cards-controls]');
          const btn = ['flashcard-dont-know', 'flashcard-know'].map((id) => document.querySelector(`[data-testid=${id}]`)).map((e) => e && { ...R(e), text: e.textContent.trim(), visible: getComputedStyle(e).visibility === 'visible', disabled: e.disabled });
          return { faces, headers, ctlTop: ctl.getBoundingClientRect().top, btn };
        });
        const front = await measure();
        await page.keyboard.press('Space');
        await page.waitForTimeout(900);
        const back = await measure();
        for (const m of [front, back]) {
          for (const f of m.faces) {
            const prev = sizes.get(widthKey);
            if (!prev) sizes.set(widthKey, { w: f.w, h: f.h, from: `${theme}/${term}` });
            else {
              assert.ok(Math.abs(prev.w - f.w) < 0.6 && Math.abs(prev.h - f.h) < 0.6, `${widthKey} ${theme} ${term}: ${f.w}x${f.h} ≠ ${prev.w}x${prev.h} (${prev.from})`);
            }
            assert.ok(Math.abs(f.h - 320) < 0.6, `${widthKey}: wysokość ${f.h} ≠ 20rem`);
          }
          for (const hd of m.headers) for (const b of hd.buttons) assert.ok(!intersects(hd.label, b), `${widthKey} ${term}: etykieta nachodzi na przycisk`);
        }
        assert.ok(Math.abs(front.ctlTop - back.ctlTop) < 0.6, `${widthKey} ${term}: przyciski pod kartą skaczą po obrocie (${front.ctlTop} → ${back.ctlTop})`);
        const key = `${area}@${w}|ctl`;
        const c = sizes.get(key);
        if (c === undefined) sizes.set(key, front.ctlTop);
        else assert.ok(Math.abs(c - front.ctlTop) < 0.6, `${widthKey} ${theme} ${term}: przyciski pod kartą w innym miejscu (${front.ctlTop} vs ${c})`);
        if (area === 'study') {
          // Przyciski oceny: widoczne i aktywne przed obrotem, jedna etykieta, ta sama pozycja i rozmiar po obrocie.
          for (const [i, label] of ['Nie umiem', 'Umiem'].entries()) {
            for (const m of [front, back]) {
              const b = m.btn[i];
              assert.ok(b && b.visible && !b.disabled, `${widthKey} ${term}: przycisk „${label}" niewidoczny/wyłączony`);
              assert.equal(b.text, label, `${widthKey} ${term}: widoczny tekst przycisku to „${b.text}"`);
              assert.ok(b.h >= 40 && b.h <= 46, `${widthKey}: wysokość przycisku ${b.h}`);
              assert.ok(b.w < 220, `${widthKey}: przycisk za szeroki (${b.w})`);
            }
            const fb = front.btn[i], bb = back.btn[i];
            assert.ok(Math.abs(fb.left - bb.left) < 0.6 && Math.abs(fb.top - bb.top) < 0.6 && Math.abs(fb.w - bb.w) < 0.6, `${widthKey} ${term}: przycisk „${label}" zmienił położenie po obrocie`);
            const bk = `${area}@${w}|btn${i}`;
            const prevB = sizes.get(bk);
            if (!prevB) sizes.set(bk, fb);
            else assert.ok(Math.abs(prevB.left - fb.left) < 0.6 && Math.abs(prevB.top - fb.top) < 0.6 && Math.abs(prevB.w - fb.w) < 0.6, `${widthKey} ${theme} ${term}: przycisk „${label}" w innym miejscu/rozmiarze niż dla innego pojęcia`);
          }
          const [dk, k] = front.btn;
          assert.ok(Math.abs((dk.left + k.left + k.w) / 2 - w / 2) < 3, `${widthKey}: przyciski nie są wyśrodkowane`);
        }
        checked++;
        await ctx.close();
      }
    }
  }
  // Klik „Umiem" PRZED i PO obrocie karty ocenia kartę (licznik opanowanych rośnie).
  for (const flipFirst of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(`${base}?area=study&theme=dark&term=save`);
    await page.waitForSelector('[data-face]');
    if (flipFirst) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
    await page.click('[data-testid=flashcard-know]');
    await page.waitForFunction(() => /1\s*z\s*2/.test(document.querySelector('[data-testid=flashcard-counter]')?.textContent || ''), null, { timeout: 5000 });
    await ctx.close();
  }
  // Klawisz ArrowRight PRZED i PO obrocie karty ocenia kartę tak samo jak klik.
  for (const flipFirst of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(`${base}?area=study&theme=dark&term=save`);
    await page.waitForSelector('[data-face]');
    if (flipFirst) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => /1\s*z\s*2/.test(document.querySelector('[data-testid=flashcard-counter]')?.textContent || ''), null, { timeout: 5000 });
    await ctx.close();
  }
console.log(`OK: ${checked} kombinacji (ekran × motyw × szerokość × pojęcie), stały rozmiar karty, brak nakładania`);
} finally {
  await browser.close();
  server.close();
}

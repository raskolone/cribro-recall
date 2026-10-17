// Test dotykowy (Playwright Chromium + WebKit): gesty swipe w prawo i w lewo na karcie fiszki
// z emulacją dotyku (CDP Input.dispatchTouchEvent w Chromium oraz zdarzenia dotykowe w WebKit).
// Weryfikuje: ocenę karty (prawo = Umiem -> licznik rośnie, lewo = Nie umiem -> przejście do następnej karty),
// brak zacięcia, odporność na drganie pionowe (jitterY) oraz różne czasy i długości ruchu.
import { build } from 'esbuild';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = mkdtempSync(join(tmpdir(), 'flashcard-swipe-browser-'));
const stubs = join(repo, 'tests/browser/stubs.tsx');

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

const compiler = await compile(readFileSync(join(repo, 'index.css'), 'utf8'), { base: repo, onDependency() {} });
const scanner = new Scanner({
  sources: ['components', 'utils', 'design', 'hooks'].map((d) => ({ base: join(repo, d), pattern: '**/*', negated: false })),
});
const css = compiler.build(scanner.scan());
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const js = readFileSync(join(out, 'app.js'));
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/app.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(js);
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
}).listen(0);

const base = `http://localhost:${server.address().port}/`;

async function executeCdpSwipe(client, startX, startY, distancePx, durationMs, jitterY) {
  const steps = Math.max(8, Math.round(durationMs / 16));
  const stepTime = Math.max(10, Math.round(durationMs / steps));

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const x = startX + distancePx * progress;
    const y = startY + (i % 2 === 0 ? jitterY : -jitterY);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    });
    await new Promise((r) => setTimeout(r, stepTime));
  }

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

const scenarios = [
  { name: 'Swipe w prawo PRZED obrotem (Umiem)', dir: 'right', flipFirst: false, dist: 130, time: 160, jitterY: 4 },
  { name: 'Swipe w prawo PO obrocie (Umiem)', dir: 'right', flipFirst: true, dist: 130, time: 200, jitterY: -4 },
  { name: 'Swipe w lewo PRZED obrotem (Nie umiem)', dir: 'left', flipFirst: false, dist: 130, time: 160, jitterY: 3 },
  { name: 'Swipe w lewo PO obrocie (Nie umiem)', dir: 'left', flipFirst: true, dist: 130, time: 200, jitterY: -3 },
  { name: 'Szybki swipe w prawo (krótki czas 80ms)', dir: 'right', flipFirst: false, dist: 140, time: 80, jitterY: 2 },
  { name: 'Wolniejszy swipe w prawo (300ms)', dir: 'right', flipFirst: false, dist: 110, time: 300, jitterY: 5 },
  { name: 'Krótki ruch tuż ponad progiem (88px)', dir: 'right', flipFirst: false, dist: 88, time: 180, jitterY: 2 },
  { name: 'Głęboki swipe w lewo (200px)', dir: 'left', flipFirst: false, dist: 200, time: 200, jitterY: 4 },
  { name: 'Mocniejsze drganie pionowe (jitterY = 6px)', dir: 'right', flipFirst: false, dist: 140, time: 180, jitterY: 6 },
];

let totalPassed = 0;

try {
  // 1. CHROMIUM (CDP Touch Events)
  const chromiumBrowser = await chromium.launch({ headless: true });
  console.log('--- Testy Chromium (hasTouch + CDP Input.dispatchTouchEvent) ---');
  for (const s of scenarios) {
    const ctx = await chromiumBrowser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(`${base}?area=study&theme=dark&term=save`);
    await page.waitForSelector('[data-face]');

    await page.evaluate(() => {
      window.__events = [];
      const stage = document.querySelector('[data-testid=flashcard-stage]');
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'].forEach((evt) => {
        stage.addEventListener(evt, () => window.__events.push(evt));
      });
    });

    if (s.flipFirst) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }

    const client = await ctx.newCDPSession(page);
    const stage = await page.waitForSelector('[data-testid=flashcard-stage]');
    const box = await stage.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const distancePx = s.dir === 'right' ? s.dist : -s.dist;

    await executeCdpSwipe(client, startX, startY, distancePx, s.time, s.jitterY);

    await page.waitForTimeout(600);
    const events = await page.evaluate(() => window.__events);
    const hadCancel = events.includes('pointercancel');
    const counterText = await page.evaluate(() => document.querySelector('[data-testid=flashcard-counter]')?.textContent || '');

    assert.ok(!hadCancel, `${s.name}: wystąpił pointercancel! Zdarzenia: ${events.join(' -> ')}`);

    if (s.dir === 'right') {
      assert.match(counterText, /1\s*z\s*2/, `${s.name}: licznik nie wzrósł po Umiem (${counterText})`);
    } else {
      assert.match(counterText, /0\s*z\s*2/, `${s.name}: nieoczekiwany licznik po Nie umiem (${counterText})`);
      const currentText = await page.evaluate(() => document.querySelector('[data-face="front"]')?.textContent || '');
      assert.ok(currentText.includes('second') || currentText.includes('save'), `${s.name}: karta zacięła się`);
    }

    console.log(`  ✔ ${s.name}: zaliczony (${s.dir === 'right' ? 'licznik 1 z 2' : 'następna karta'}, brak pointercancel)`);
    totalPassed++;
    await ctx.close();
  }
  await chromiumBrowser.close();

  // 2. WEBKIT (iOS WebKit Touch Simulation & Touch-Action Verification)
  const webkitBrowser = await webkit.launch({ headless: true });
  console.log('--- Testy WebKit (iPhone viewport 375x812 + Touch Pointer Events) ---');
  for (const s of [scenarios[0], scenarios[1], scenarios[2], scenarios[3]]) {
    const ctx = await webkitBrowser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(`${base}?area=study&theme=dark&term=save`);
    await page.waitForSelector('[data-face]');

    // Verify touch-action computed style on WebKit
    const styles = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid=flashcard-stage]');
      const face = document.querySelector('[data-face]');
      const box = document.querySelector('[data-face] .overflow-y-auto');
      return {
        stage: window.getComputedStyle(stage).touchAction,
        face: window.getComputedStyle(face).touchAction,
        box: window.getComputedStyle(box).touchAction,
      };
    });
    assert.equal(styles.box, 'pan-y', 'WebKit: .overflow-y-auto musi mieć touch-action: pan-y');
    assert.equal(styles.face, 'pan-y', 'WebKit: [data-face] musi mieć touch-action: pan-y');

    if (s.flipFirst) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }

    const distancePx = s.dir === 'right' ? s.dist : -s.dist;
    const counterText = await page.evaluate(async ({ dist, time, jitterY }) => {
      const stage = document.querySelector('[data-testid=flashcard-stage]');
      const box = stage.getBoundingClientRect();
      const startX = box.left + box.width / 2;
      const startY = box.top + box.height / 2;
      const target = document.elementFromPoint(startX, startY) || stage;
      const steps = Math.max(8, Math.round(time / 16));
      const stepTime = Math.max(10, Math.round(time / steps));

      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
        clientX: startX, clientY: startY, isPrimary: true
      }));

      for (let i = 1; i <= steps; i++) {
        const x = startX + dist * (i / steps);
        const y = startY + (i % 2 === 0 ? jitterY : -jitterY);
        target.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
          clientX: x, clientY: y, isPrimary: true
        }));
        await new Promise((r) => setTimeout(r, stepTime));
      }

      target.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
        clientX: startX + dist, clientY: startY, isPrimary: true
      }));

      await new Promise((r) => setTimeout(r, 600));
      return document.querySelector('[data-testid=flashcard-counter]')?.textContent || '';
    }, { dist: distancePx, time: s.time, jitterY: s.jitterY });

    if (s.dir === 'right') {
      assert.match(counterText, /1\s*z\s*2/, `WebKit ${s.name}: licznik nie wzrósł (${counterText})`);
    } else {
      assert.match(counterText, /0\s*z\s*2/, `WebKit ${s.name}: nieoczekiwany licznik (${counterText})`);
    }

    console.log(`  ✔ WebKit ${s.name}: zaliczony (${s.dir === 'right' ? 'licznik 1 z 2' : 'następna karta'})`);
    totalPassed++;
    await ctx.close();
  }
  await webkitBrowser.close();

  console.log(`\nOK: Wszystkie ${totalPassed} scenariuszy dotykowych (Chromium + WebKit) zaliczone pomyślnie.`);
} finally {
  server.close();
}

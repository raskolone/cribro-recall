import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { THEME_COLORS } from '../utils/themeColor';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = src('index.html');
const vite = src('vite.config.ts');

test('index.html: theme-color, apple-mobile-web-app-* i apple-touch-icon', () => {
  assert.match(html, /<meta name="theme-color" content="#09101c"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black"/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Cribro"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  assert.match(html, /viewport-fit=cover/);
});

test('kolory motywu w index.html i utils/themeColor.ts są te same', () => {
  assert.match(html, new RegExp(`'light' \\? '${THEME_COLORS.light}' : '${THEME_COLORS.dark}'`));
  assert.match(html, new RegExp(`name="theme-color" content="${THEME_COLORS.dark}"`));
  assert.match(vite, new RegExp(`theme_color: '${THEME_COLORS.dark}'`));
  const tokens = src('design/theme/tokens.css');
  assert.ok(tokens.includes(`--bg:              ${THEME_COLORS.dark};`));
  assert.ok(tokens.includes(`--bg:              ${THEME_COLORS.light};`));
});

test('manifest: lang pl, orientation, standalone, id i ikony maskable istnieją w public/', () => {
  assert.match(vite, /lang: 'pl'/);
  assert.match(vite, /orientation: 'any'/);
  assert.match(vite, /display: 'standalone'/);
  assert.match(vite, /id: '\/'/);
  const maskable = [...vite.matchAll(/src: '(icon-maskable-\d+x\d+\.png)',\s*sizes: '(\d+x\d+)',\s*type: 'image\/png',\s*purpose: 'maskable'/g)];
  assert.equal(maskable.length, 2);
  for (const [, file] of maskable) assert.ok(existsSync(new URL(`../public/${file}`, import.meta.url)), file);
  // purpose łączone „any maskable" jest odradzane — ikony SVG mają tylko `any`
  assert.doesNotMatch(vite, /purpose: 'any maskable'/);
});

test('rejestracją SW zarządza aplikacja, a service worker nadal przejmuje kontrolę od razu', () => {
  assert.match(vite, /injectRegister: false/);
  const sw = src('sw.ts');
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /clientsClaim\(\)/);
  assert.match(src('index.tsx'), /import\.meta\.env\.PROD\) startPwaUpdates\(\)/);
});

test('baner aktualizacji jest zamontowany w App i ma dolny odstęp safe-area', () => {
  assert.match(src('App.tsx'), /<UpdateBanner \/>/);
  assert.match(src('components/ui/UpdateBanner.tsx'), /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
});

test('teksty banera są w obu plikach tłumaczeń', () => {
  for (const f of ['pl.json', 'en.json']) {
    const j = JSON.parse(src(f));
    assert.ok(j['Dostępna nowa wersja'], f);
    assert.ok(j['Odśwież'], f);
  }
});

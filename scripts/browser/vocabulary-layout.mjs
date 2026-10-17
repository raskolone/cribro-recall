/**
 * Test przeglądarkowy układu „Moich Listów Słów” (VOCAB-DUP-5): renderuje PRAWDZIWY FlashcardSetsScreen
 * w łańcuchu kontenerów panelu „Moje zasoby” (klasy czytane ze źródeł TodayScreen/Dashboard), bez Firebase,
 * logowania i Vite. Chromium, 4 szerokości okna × jasny/ciemny × siatka/lista + widok samodzielny.
 *
 *   npm run test:browser            (zrzuty: ~/.cribro-backups/vocab-dup-5/)
 *
 * Nie sprawdza: danych z Firestore, zapisu postępu, przepływu po zalogowaniu.
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(new URL('../..', import.meta.url).pathname);
const req = createRequire(join(repo, 'package.json'));
const { chromium } = req('playwright');
const work = mkdtempSync(join(tmpdir(), 'vocab-layout-'));
const shots = join(homedir(), '.cribro-backups', 'vocab-dup-5');
mkdirSync(shots, { recursive: true });

const src = (rel) => readFileSync(join(repo, rel), 'utf8');
const pick = (text, re, what) => {
  const m = re.exec(text);
  if (!m) throw new Error(`Nie znaleziono klas: ${what} — łańcuch kontenerów w źródłach się zmienił`);
  return m[1];
};
const today = src('components/dashboard/TodayScreen.tsx');
const MAIN = pick(src('components/dashboard/Dashboard.tsx'), /<main className="([^"]+)"/, 'Dashboard <main>');
const ROOT = pick(today, /<div className="(w-full max-w-3xl mx-auto[^"]*)"/, 'korzeń TodayScreen');
const PANEL = pick(today, /<div className="(rounded-2xl border border-line-strong bg-base-200\/40 overflow-hidden)"/, 'ramka otwartego kafelka');
const BODY = pick(today, /<div className="([^"]+)">\s*<FlashcardSetsScreen embedded/, 'treść zakładki Słownictwo');

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import i18n from ${JSON.stringify(join(repo, 'i18n'))};
import { LanguageProvider } from ${JSON.stringify(join(repo, 'context/LanguageContext'))};
import { AuthContext } from ${JSON.stringify(join(repo, 'context/AuthContext'))};
import { FlashcardContext } from ${JSON.stringify(join(repo, 'context/FlashcardContext'))};
import { SettingsProvider } from ${JSON.stringify(join(repo, 'context/SettingsContext'))};
import FlashcardSetsScreen from ${JSON.stringify(join(repo, 'components/flashcards/FlashcardSetsScreen'))};
import { deduplicateFlashcardSets } from ${JSON.stringify(join(repo, 'utils/lessonCanonicalKey'))};

const topics = [
  ['Codzienne nawyki i jedzenie', '2026-08-04', 19], ['Motivation and Communication', '2026-07-28', 12], ['Silo and Fallout: Safety, Freedom', '2026-08-05', 8],
  ['Digital Tools, Focus & Everyday Choices', '2026-09-11', 5], ['Podróże służbowe i negocjacje handlowe w międzynarodowym środowisku pracy zdalnej i hybrydowej', '2026-09-18', 22],
  ['Powtarzanie Present Simple (wszystkie formy)', '2026-10-16', 14], ['Travel', '2026-09-25', 3], ['Health and Wellbeing', '2026-10-02', 9], ['Job interviews', '2026-10-09', 17],
];
const ids = topics.map((t, i) => 'lesson-17' + (80 + i) + '000000000-abc' + i);
const db = topics.map((t, i) => ({ id: 'set-lesson-' + ids[i], userId: 'u', title: t[0], isLessonVocabulary: true, cardCount: t[2], createdAt: '2026-10-17T08:0' + i + ':00.000Z', lessonDate: t[1], lessonTopic: t[0] }));
const virt = topics.map((t, i) => ({ id: 'lesson_' + ids[i], userId: 'u', title: t[0], isLessonVocabulary: true, cardCount: t[2], createdAt: t[1], lessonDate: t[1], lessonTopic: t[0] }));
const own = [
  { id: 'own1', userId: 'u', title: 'Mój zestaw', cardCount: 4, createdAt: '2026-09-14T07:48:39.569Z', description: 'Własne słówka z pracy' },
  { id: 'own2', userId: 'u', title: 'Phrasal verbs — bardzo długa nazwa własnego zestawu fiszek do powtórek przed egzaminem', cardCount: 31, createdAt: '2026-09-20T07:48:39.569Z' },
];
const known = topics.map((t, i) => ({ id: ids[i], date: t[1], topic: t[0] }));
const nums = new Map(ids.map((id, i) => [id, i + 1]));
const sets = deduplicateFlashcardSets([...db, ...own], virt, known, nums);
const sessions = [
  { id: 's1', userId: 'u', setId: 'lesson_' + ids[0], mode: 'flashcards', scorePercent: 90, totalCards: 10, correctCount: 9, completedAt: '2026-10-11T10:00:00.000Z' },
  { id: 's2', userId: 'u', setId: 'set-lesson-' + ids[3], mode: 'flashcards', scorePercent: 45, totalCards: 10, correctCount: 4, completedAt: '2026-10-12T10:00:00.000Z' },
];
const flash = { sets, sessions, createSet: async () => 'n', deleteSet: async () => {}, getFlashcards: async () => [{ id: 'c', term: 'apple', definition: 'jabłko' }] };
const q = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', q.get('theme'));
document.documentElement.classList.add(q.get('theme'));
const screen = <FlashcardSetsScreen embedded={q.get('mode') === 'embedded'} onStudySet={() => {}} onEditSet={() => {}} onStatsSet={() => {}} onNavigate={() => {}} />;
const page = q.get('mode') === 'embedded' ? (
  <main className=${JSON.stringify(MAIN)} style={{ height: '100dvh' }}>
    <div className=${JSON.stringify(ROOT)}><div className=${JSON.stringify(PANEL)}><div className=${JSON.stringify(BODY)}>{screen}</div></div></div>
  </main>
) : (
  <main className=${JSON.stringify(MAIN)} style={{ height: '100dvh' }}><div className="p-4 sm:p-6 w-full">{screen}</div></main>
);
const mount = () => createRoot(document.getElementById('root')).render(
  <LanguageProvider><AuthContext.Provider value={{ user: { id: 'u', dismissedNotifications: [], role: 'user' } }}>
    <FlashcardContext.Provider value={flash}><SettingsProvider>{page}</SettingsProvider></FlashcardContext.Provider>
  </AuthContext.Provider></LanguageProvider>);
(i18n.isInitialized ? Promise.resolve() : new Promise((r) => i18n.on('initialized', r))).then(mount);
`;
writeFileSync(join(work, 'entry.tsx'), entry);
writeFileSync(join(work, 'firebase-stub.ts'), `export const auth: any = { currentUser: null, onAuthStateChanged: () => () => {}, onIdTokenChanged: () => () => {} }; export const db: any = {}; export const functions: any = {}; export const firebaseConfig: any = {};
export enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }
export function handleFirestoreError(e: any) { throw e; }`);

await build({
  entryPoints: [join(work, 'entry.tsx')], outfile: join(work, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.json': 'json' },
  nodePaths: [join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
  plugins: [{ name: 'stub-firebase', setup(b) {
    b.onResolve({ filter: /(^|\/)firebase$/ }, (a) => (a.resolveDir.startsWith(repo) && !a.importer.includes('node_modules') ? { path: join(work, 'firebase-stub.ts') } : null));
  } }],
});

const { compile } = await import(pathToFileURL(join(repo, 'node_modules/@tailwindcss/node/dist/index.mjs')).href);
const { Scanner } = req('@tailwindcss/oxide');
const compiler = await compile(readFileSync(join(repo, 'index.css'), 'utf8'), { base: repo, onDependency() {} });
const scanner = new Scanner({ sources: ['components', 'utils', 'design'].map((d) => ({ base: join(repo, d), pattern: '**/*', negated: false })) });
writeFileSync(join(work, 'style.css'), compiler.build(scanner.scan()));

const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const server = createServer((rq, rs) => {
  const path = rq.url.split('?')[0];
  if (path === '/style.css') { rs.setHeader('content-type', 'text/css'); return rs.end(readFileSync(join(work, 'style.css'))); }
  if (path === '/bundle.js') { rs.setHeader('content-type', 'text/javascript'); return rs.end(readFileSync(join(work, 'bundle.js'))); }
  rs.setHeader('content-type', 'text/html'); rs.end(html);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const failures = [];
const report = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

async function measure(page) {
  return page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const cards = [...document.querySelectorAll('[data-testid="vocab-set-card"]')].map((c) => {
      const cr = r(c);
      const buttons = [...c.querySelectorAll('button')].map((b) => ({ ...r(b), text: b.textContent.trim(), nowrap: getComputedStyle(b).whiteSpace, label: b.getAttribute('aria-label'), title: b.getAttribute('title'),
        lines: (() => { const rg = document.createRange(); rg.selectNodeContents(b); return new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size; })() }));
      const h3 = c.querySelector('h3');
      const lh = parseFloat(getComputedStyle(h3).lineHeight) || 20;
      return { cr, scrollW: c.scrollWidth, clientW: c.clientWidth, buttons, titleH: h3.getBoundingClientRect().height, titleW: h3.getBoundingClientRect().width, lineH: lh, titleAttr: h3.getAttribute('title'), titleText: h3.textContent.trim() };
    });
    const section = document.querySelector('[data-testid="vocab-set-card"]')?.parentElement;
    return { cards, containerW: section ? section.getBoundingClientRect().width : 0, docW: document.documentElement.scrollWidth, winW: window.innerWidth };
  });
}

function assertLayout(tag, m, view) {
  check(m.docW <= m.winW + 1, `${tag}: poziome przepełnienie strony (${m.docW} > ${m.winW})`);
  check(m.cards.length === 11, `${tag}: oczekiwano 11 kart (9 lekcji + 2 własne), jest ${m.cards.length}`);
  for (const c of m.cards) {
    const name = c.titleText.slice(0, 24);
    check(c.scrollW <= c.clientW + 1, `${tag} [${name}]: przepełnienie karty ${c.scrollW} > ${c.clientW}`);
    const iconSizes = [];
    for (const b of c.buttons) {
      check(b.l >= c.cr.l - 0.5 && b.r <= c.cr.r + 0.5 && b.t >= c.cr.t - 0.5 && b.b <= c.cr.b + 0.5, `${tag} [${name}]: przycisk „${b.text || b.label}” poza kartą`);
      check(b.h >= 39.5, `${tag} [${name}]: przycisk „${b.text || b.label}” niższy niż 40 px (${b.h.toFixed(1)})`);
      if (/Ucz się/.test(b.text)) { check(b.lines === 1 && b.nowrap === 'nowrap' && b.h <= 46, `${tag} [${name}]: „Ucz się” łamie się (linie ${b.lines}, wysokość ${b.h.toFixed(1)})`); }
      else if (!b.text || b.text.length <= 2) { iconSizes.push(b); check(b.w >= 39.5 && Math.abs(b.w - b.h) < 1.5 && b.label && b.title, `${tag} [${name}]: ikona ${b.label} ma ${b.w.toFixed(1)}×${b.h.toFixed(1)} albo brak aria-label/title`); }
    }
    for (let i = 0; i < c.buttons.length; i++) for (let j = i + 1; j < c.buttons.length; j++) {
      const a = c.buttons[i], b = c.buttons[j];
      check(a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5, `${tag} [${name}]: przyciski „${a.text || a.label}” i „${b.text || b.label}” nachodzą na siebie`);
    }
    check(c.titleH <= c.lineH * 2 + 2, `${tag} [${name}]: tytuł wyższy niż 2 linie (${c.titleH.toFixed(1)} > ${(c.lineH * 2).toFixed(1)})`);
    check(c.titleAttr === c.titleText.replace(/DRAFT$/, '').trim() || c.titleAttr, `${tag} [${name}]: brak pełnego tytułu w title`);
    if (view === 'list') check(c.titleW >= 120, `${tag} [${name}]: tytuł ściśnięty do ${c.titleW.toFixed(0)} px`);
  }
  // wiersze siatki: równa wysokość
  if (view === 'grid') {
    const rows = new Map();
    for (const c of m.cards) { const k = `${Math.round(c.cr.t / 4)}`; rows.set(k, [...(rows.get(k) || []), c]); }
    for (const group of rows.values()) { const hs = group.map((c) => c.cr.h); check(Math.max(...hs) - Math.min(...hs) <= 1.5, `${tag}: karty w jednym rzędzie mają różną wysokość (${hs.map((h) => h.toFixed(0)).join('/')})`); }
  }
  const cols = new Set(m.cards.filter((c) => Math.abs(c.cr.t - m.cards[0].cr.t) < 4).map((c) => Math.round(c.cr.l))).size;
  return { cols, cardW: Math.round(m.cards[0].cr.w) };
}

const scenarios = [];
for (const theme of ['light', 'dark']) for (const w of [375, 768, 1100, 1280]) scenarios.push({ theme, w, mode: 'embedded' });
for (const theme of ['light', 'dark']) scenarios.push({ theme, w: 1280, mode: 'standalone' });

for (const sc of scenarios) {
  const ctx = await browser.newContext({ viewport: { width: sc.w, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('app_language', 'pl'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (process.env.DEBUG_BROWSER) page.on('console', (m) => console.log('[page]', m.type(), m.text()));
  await page.goto(`${base}?theme=${sc.theme}&mode=${sc.mode}`);
  await page.waitForSelector('[data-testid="vocab-set-card"]', { timeout: 8000 }).catch((e) => { throw new Error(`Brak kart (${sc.mode} ${sc.theme} ${sc.w}): ${errors.join(' | ')}`); });
  await page.waitForTimeout(900);
  for (const view of ['grid', 'list']) {
    if (view === 'list') { await page.click('text=☰'); await page.waitForTimeout(200); }
    const tag = `${sc.mode} ${sc.theme} ${sc.w}px ${view}`;
    const m = await measure(page);
    const { cols, cardW } = assertLayout(tag, m, view);
    report.push(`${tag.padEnd(34)} kontener ${String(Math.round(m.containerW)).padStart(4)} px, kolumn ${cols}, karta ${cardW} px`);
    if (sc.mode === 'embedded' && sc.w >= 1100 && view === 'grid') check(cols >= 2, `${tag}: oczekiwano ≥ 2 kolumn`);
    if (sc.mode === 'standalone' && view === 'grid') check(cols >= 3, `${tag}: pełna szerokość powinna mieć ≥ 3 kolumny, jest ${cols}`);
    if (sc.w === 375 && view === 'grid') check(cols === 1, `${tag}: telefon powinien mieć 1 kolumnę, jest ${cols}`);
    await page.screenshot({ path: join(shots, `${sc.mode}-${sc.theme}-${sc.w}-${view}.png`), fullPage: true });
  }
  check(errors.length === 0, `${sc.mode} ${sc.theme} ${sc.w}px: błędy strony: ${errors.join('; ')}`);
  await ctx.close();
}
await browser.close();
server.close();

console.log(report.join('\n'));
console.log(`\nZrzuty: ${shots}`);
if (failures.length) { console.error(`\nNIEPOWODZENIA (${failures.length}):\n- ` + failures.slice(0, 60).join('\n- ')); process.exit(1); }
console.log('\nOK: wszystkie asercje układu przeszły.');

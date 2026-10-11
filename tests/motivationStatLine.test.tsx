import './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import i18n from '../i18n';
import MotivationStatLine from '../components/ui/MotivationStatLine';
import { buildMotivationItems } from '../utils/motivationStats';
import { getMotivationCounts, nextVisit, resetMotivationCache, setMotivationCounts } from '../utils/motivationStatsCache';

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  await i18n.changeLanguage('pl');
});
afterEach(() => {
  cleanup();
  resetMotivationCache();
  try { localStorage.clear(); } catch { /* brak storage */ }
});

const items = buildMotivationItems({ exercises: 23, translatedSentences: 148, correctedSentences: 37 });
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
const active = (c: HTMLElement) => c.querySelector('[data-active="true"]')!.textContent;

test('wszystkie pozycje leżą w jednym miejscu (stała wysokość), widoczna jedna; reszta aria-hidden; bez aria-live', () => {
  const { container, getAllByTestId, getByTestId } = render(<MotivationStatLine items={items} reducedMotion={false} />);
  const all = getAllByTestId('motivation-item');
  assert.equal(all.length, 4, '3 statystyki + wariant „Gratulacje”');
  assert.equal(all.filter((i) => i.getAttribute('data-active') === 'true').length, 1);
  assert.ok(all.filter((i) => i.getAttribute('data-active') === 'false').every((i) => i.getAttribute('aria-hidden') === 'true'));
  assert.ok(all.every((i) => /\babsolute\b/.test(i.className) && /inset-0/.test(i.className)), 'pozycje nie zmieniają wysokości układu');
  assert.match(all[0].className, /transition-opacity duration-500/);
  assert.match(all[0].className, /motion-reduce:transition-none/);
  assert.equal(container.querySelector('[aria-live]'), null, 'bez aria-live (spokojny odczyt)');
  assert.equal(active(container), 'Masz już za sobą 23 ćwiczenia');
  assert.match(getByTestId('motivation-line').className, /min-h-11/, 'cel dotyku ≥ 44 px');
  assert.match(getByTestId('motivation-line').className, /-my-2\.5/, '…bez zmiany wysokości układu (ujemny margines)');
  assert.ok(all[0].querySelector('svg[aria-hidden="true"]'), 'mała ikona');
});

test('automatyczna rotacja co interwał; kolejność jak na liście', async () => {
  const { container } = render(<MotivationStatLine items={items} reducedMotion={false} intervalMs={40} />);
  assert.equal(active(container), 'Masz już za sobą 23 ćwiczenia');
  await wait(70);
  assert.equal(active(container), 'Przetłumaczone zdania: 148');
  await wait(50);
  assert.equal(active(container), 'Poprawione zdania: 37');
});

test('najechanie i fokus wstrzymują rotację, opuszczenie wznawia', async () => {
  const { container, getByTestId } = render(<MotivationStatLine items={items} reducedMotion={false} intervalMs={40} />);
  const line = getByTestId('motivation-line');
  fireEvent.mouseEnter(line);
  await wait(120);
  assert.equal(active(container), 'Masz już za sobą 23 ćwiczenia', 'hover');
  fireEvent.mouseLeave(line);
  await wait(70);
  assert.notEqual(active(container), 'Masz już za sobą 23 ćwiczenia', 'wznowiona');
  const before = active(container);
  fireEvent.focus(line);
  await wait(120);
  assert.equal(active(container), before, 'fokus');
});

test('dotknięcie przechodzi do następnej statystyki i wstrzymuje rotację (reszta pauzy: TOUCH_PAUSE_MS)', async () => {
  const { container, getByTestId } = render(<MotivationStatLine items={items} reducedMotion={false} intervalMs={40} />);
  fireEvent.click(getByTestId('motivation-line'));
  assert.equal(active(container), 'Przetłumaczone zdania: 148');
  await wait(120);
  assert.equal(active(container), 'Przetłumaczone zdania: 148', 'po dotknięciu nie skacze dalej sama');
});

test('klawiatura: przycisk, Enter/Spacja (natywnie) = klik; etykieta „Pokaż kolejną statystykę”', () => {
  const { getByTestId } = render(<MotivationStatLine items={items} reducedMotion />);
  const line = getByTestId('motivation-line');
  assert.equal(line.tagName, 'BUTTON');
  assert.equal(line.getAttribute('aria-label'), 'Pokaż kolejną statystykę');
});

test('prefers-reduced-motion: bez rotacji i bez przenikania; jedna statystyka, dotknięcie → następna', async () => {
  const { container, getByTestId, getAllByTestId } = render(<MotivationStatLine items={items} reducedMotion intervalMs={30} />);
  const first = active(container);
  await wait(120);
  assert.equal(active(container), first, 'bez automatycznej rotacji');
  assert.ok(getAllByTestId('motivation-item').every((i) => /motion-reduce:transition-none/.test(i.className)));
  fireEvent.click(getByTestId('motivation-line'));
  assert.notEqual(active(container), first, 'dotknięcie przechodzi dalej');
});

test('reduced-motion: kolejna statystyka przy każdym wejściu w panel (licznik wejść)', () => {
  const seen: Array<string | null> = [];
  for (let i = 0; i < 4; i++) {
    const { container, unmount } = render(<MotivationStatLine items={items} reducedMotion />);
    seen.push(active(container));
    unmount();
  }
  assert.equal(new Set(seen).size, 4, `cztery wejścia = cztery różne statystyki: ${seen.join(' | ')}`);
});

test('działa bez storage: licznik wejść i cache nie rzucają, gdy localStorage jest niedostępny', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
  try {
    assert.doesNotThrow(() => nextVisit());
    assert.doesNotThrow(() => setMotivationCounts('u1', { exercises: 3 }));
    assert.deepEqual(getMotivationCounts('u1'), { exercises: 3 }, 'pamięć sesji wystarcza');
    const { container } = render(<MotivationStatLine items={items} reducedMotion />);
    assert.ok(active(container));
  } finally {
    if (real) Object.defineProperty(globalThis, 'localStorage', real); else delete (globalThis as any).localStorage;
  }
});

test('brak danych: jedna spokojna, statyczna linia zachęty bez liczb; „pending” = pusty placeholder', async () => {
  const empty = render(<MotivationStatLine items={[]} />);
  assert.equal(empty.getByTestId('motivation-empty').textContent, 'Zacznij od pierwszego ćwiczenia.');
  assert.equal(empty.queryByTestId('motivation-line'), null);
  cleanup();
  const pending = render(<MotivationStatLine items={[]} pending />);
  assert.equal(pending.container.textContent, '');
  cleanup();
  await i18n.changeLanguage('en');
  const en = render(<MotivationStatLine items={[]} />);
  assert.equal(en.getByTestId('motivation-empty').textContent, 'Start with your first exercise.');
  await i18n.changeLanguage('pl');
});

test('jedna statystyka: bez rotacji i bez etykiety „kolejna”', async () => {
  const one = buildMotivationItems({ homework: 1 });
  const { container, getByTestId } = render(<MotivationStatLine items={one} reducedMotion={false} intervalMs={20} />);
  await wait(80);
  assert.equal(active(container), 'Ukończone prace domowe: 1');
  assert.equal(getByTestId('motivation-line').getAttribute('aria-label'), null);
});

test('stałe zdania zniknęły z panelu i ekranu ćwiczeń; wszędzie ten sam komponent', () => {
  const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
  const hero = read('components/dashboard/StudentHeroHeader.tsx');
  const gen = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.ok(!hero.includes('Dobrze Ci idzie') && !hero.includes("You're doing great"));
  assert.ok(!gen.includes('Świetnie Ci idzie') && !gen.includes('Keep it up') && !gen.includes('Przetłumaczyłeś już'));
  assert.equal((hero.match(/<MotivationStatLine/g) || []).length, 1);
  assert.equal((gen.match(/<MotivationStatLine/g) || []).length, 2, 'góra ekranu + dymek');
  // zero nowych zapisów i odczytów w komponencie i logice
  for (const rel of ['components/ui/MotivationStatLine.tsx', 'utils/motivationStats.ts']) {
    assert.ok(!/firebase|addDoc|setDoc|updateDoc|getDocs|onSnapshot/.test(read(rel)), rel);
  }
});

test('panel nie dubluje odczytów: liczniki z istniejących nasłuchów + sesji z kontekstu, bez nowych zapytań', () => {
  const hero = read('components/dashboard/StudentHeroHeader.tsx');
  assert.equal((hero.match(/onSnapshot\(/g) || []).length, 4, 'te same cztery nasłuchy co przed zmianą');
  assert.match(hero, /computeMotivationCounts\(\{ logs: practiceLogs, sessions: ownPanel \? sessions : undefined/);
  function read(rel: string) { return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'); }
});

// --- kontrast (oba motywy) -------------------------------------------------------------------

import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../utils/contrast';
import { themeColor, type ThemeName } from './helpers/themeColors';

test('kontrast linii statystyk: tekst text-hi ≥ 4,5:1 na tle strony i karty, ikona (akcent) ≥ 3:1 — oba motywy (tabela w stdout)', () => {
  const rows = ['motyw | tło | text-hi | ikona (akcent)'];
  for (const theme of ['dark', 'light'] as ThemeName[]) {
    for (const bgToken of ['--color-bg', '--color-surface-flat']) {
      const bg = themeColor(theme, bgToken);
      const text = contrastRatio(themeColor(theme, '--color-text-hi'), bg);
      const icon = contrastRatio(themeColor(theme, '--color-primary'), bg);
      rows.push(`${theme} | ${bgToken} | ${text.toFixed(2)} | ${icon.toFixed(2)}`);
      assert.ok(text >= AA_TEXT, `${theme} ${bgToken} tekst ${text.toFixed(2)}`);
      assert.ok(icon >= AA_NON_TEXT, `${theme} ${bgToken} ikona ${icon.toFixed(2)}`);
    }
  }
  console.log(rows.join('\n'));
});

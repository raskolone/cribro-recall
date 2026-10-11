import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { GAME_TILE_SHADES, gameTileAttrs, shadeForHit } from '../utils/gameTile';
import { QUIZ_TILE_STATE, quizOptionState } from '../utils/quizOptionStates';
import { THEMES, themeColor, ThemeName } from './helpers/themeColors';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const themes: ThemeName[] = ['dark', 'light'];

// --- czysta funkcja stylu ------------------------------------------------------------------

test('gameTileAttrs: klasa bazowa, stan i atrybuty ARIA zależą tylko od stanu', () => {
  assert.deepEqual(gameTileAttrs({ state: 'rest' }), { className: 'game-tile', 'data-state': 'rest' });
  const selected = gameTileAttrs({ state: 'selected', toggle: true });
  assert.equal(selected['aria-pressed'], true);
  assert.equal(gameTileAttrs({ state: 'rest', toggle: true })['aria-pressed'], false);
  assert.equal(gameTileAttrs({ state: 'rest' })['aria-pressed'], undefined, 'bez toggle brak aria-pressed');
  assert.equal(gameTileAttrs({ state: 'locked' })['aria-disabled'], true);
  assert.equal(gameTileAttrs({ state: 'correct' })['aria-disabled'], true);
  assert.equal(gameTileAttrs({ state: 'wrong' })['aria-disabled'], undefined, 'błędny można poprawić (MC: po odpowiedzi blokuje rodzic)');
  assert.equal(gameTileAttrs({ state: 'locked', shade: 3 })['data-shade'], 3);
  assert.equal(gameTileAttrs({ state: 'rest', extraClass: 'game-tile--chip' }).className, 'game-tile game-tile--chip');
});

test('shadeForHit: kolejne trafienia mają różne odcienie 1…5, potem od początku', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(shadeForHit), [1, 2, 3, 4, 5, 1, 2]);
  assert.equal(GAME_TILE_SHADES, 5);
  for (let start = 0; start < 12; start++) {
    const window = Array.from({ length: 5 }, (_, i) => shadeForHit(start + i));
    assert.equal(new Set(window).size, 5, `5 kolejnych trafień od ${start}`);
  }
});

test('quiz używa wspólnego stylu: mapowanie stanów i fazy', () => {
  assert.deepEqual(QUIZ_TILE_STATE, { default: 'rest', correct: 'correct', incorrect: 'wrong', disabled: 'locked' });
  assert.equal(quizOptionState('answering', true, false), 'default');
  assert.equal(quizOptionState('answered', true, false), 'correct');
  assert.equal(quizOptionState('answered', false, true), 'incorrect');
  assert.equal(quizOptionState('answered', false, false), 'disabled');
});

// --- CSS: jeden zestaw reguł ----------------------------------------------------------------

const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `brak reguły ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

test('.game-tile: kontur 2 px, min. 56 px, połysk ze wspólnego tokenu menu głównego, bez animacji połysku', () => {
  const base = rule('.game-tile');
  assert.match(base, /border: 2px solid/);
  assert.match(base, /min-height: 3\.5rem/);
  assert.match(base, /font-weight: 700/);
  const sheen = rule('.game-tile::after');
  assert.match(sheen, /var\(--glass-sheen\)/);
  assert.match(sheen, /var\(--glass-sheen-edge\)/);
  assert.doesNotMatch(sheen, /animation|transition/);
  // ten sam token w kafelkach menu głównego
  assert.match(css, /\.liquid-glass-tile::after,\n\.glass-tile::after \{[^}]*var\(--glass-sheen\)/);
});

test('.game-tile: stany nie zmieniają rozmiaru ani położenia (bez transform/scale/margin/padding)', () => {
  const states = css.slice(css.indexOf('.game-tile[data-state="rest"]:hover'), css.indexOf('/* Wersja zwarta'));
  assert.doesNotMatch(states, /transform:|scale\(|margin|padding|width:|height:/);
});

test('.game-tile: focus-visible widoczny, shake wyłączony przy prefers-reduced-motion', () => {
  assert.match(rule('.game-tile:focus-visible'), /outline: 3px solid var\(--color-primary\)/);
  const reduced = css.slice(css.indexOf('@keyframes game-tile-shake'));
  assert.match(reduced, /prefers-reduced-motion: reduce[\s\S]*\.game-tile\[data-state="wrong"\] \{ animation: none; \}/);
});

// --- kontrast ------------------------------------------------------------------------------

test('kontrast kafelków gier: tekst ≥ 4,5:1, obrys i ikony ≥ 3:1 — oba motywy (tabela w stdout)', () => {
  const rows = ['motyw | stan | tekst na tle | obrys vs tło strony | obrys vs tło kafelka'];
  for (const theme of themes) {
    const page = themeColor(theme, '--color-bg');
    const text = themeColor(theme, '--color-text-hi');
    const text3 = themeColor(theme, '--color-text-3');
    const specs: Array<{ name: string; bg: string; line: string; text: typeof text }> = [
      { name: 'rest', bg: '--color-game-rest', line: '--color-game-rest-line', text },
      { name: 'correct', bg: '--color-game-ok', line: '--color-game-ok-line', text },
      { name: 'wrong', bg: '--color-game-bad', line: '--color-game-bad-line', text },
      { name: 'locked', bg: '--color-game-locked', line: '--color-game-locked-line', text: text3 },
      ...[1, 2, 3, 4, 5].map((n) => ({ name: `para ${n}`, bg: `--color-tile-${n}`, line: `--color-tile-line-${n}`, text })),
    ];
    for (const spec of specs) {
      const bg = themeColor(theme, spec.bg);
      const line = themeColor(theme, spec.line);
      const textRatio = contrastRatio(composite(spec.text, bg), bg);
      const vsPage = contrastRatio(line, page);
      const vsTile = contrastRatio(line, bg);
      rows.push(`${theme} | ${spec.name} | ${textRatio.toFixed(2)} | ${vsPage.toFixed(2)} | ${vsTile.toFixed(2)}`);
      assert.ok(textRatio >= AA_TEXT, `${theme}/${spec.name}: tekst ${textRatio.toFixed(2)}`);
      if (spec.name !== 'locked') {
        assert.ok(vsPage >= AA_NON_TEXT || vsTile >= AA_NON_TEXT, `${theme}/${spec.name}: obrys ${vsPage.toFixed(2)} / ${vsTile.toFixed(2)}`);
      }
    }
    // zaznaczony: obwódka akcentu względem tła spoczynku
    const selected = contrastRatio(themeColor(theme, '--color-primary'), themeColor(theme, '--color-game-rest'));
    rows.push(`${theme} | selected (akcent vs spoczynek) | – | – | ${selected.toFixed(2)}`);
    assert.ok(selected >= AA_NON_TEXT, `${theme}: zaznaczony ${selected.toFixed(2)}`);
  }
  console.log(rows.join('\n'));
});

test('tokeny gier mają osobne wartości w obu motywach', () => {
  for (const t of ['--color-game-rest', '--color-game-ok', '--color-game-bad', '--color-game-locked', '--glass-sheen']) {
    const dark = THEMES.dark[t] ?? css.match(new RegExp(`${t}:\\s*([^;]+);`, 'g'))?.[0];
    assert.ok(dark, t);
  }
  assert.notEqual(THEMES.dark['--color-game-rest'], THEMES.light['--color-game-rest']);
});

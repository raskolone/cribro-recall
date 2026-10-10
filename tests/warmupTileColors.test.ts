import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTileColors, TILE_COLOR_COUNT } from '../utils/warmupTileColors';
import { THEMES, themeColor, ThemeName } from './helpers/themeColors';
import { AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { readFileSync } from 'node:fs';

const TEXTS = ['I would like', 'to have a hammock', 'on my spacious balcony.', 'I would likes'];

test('kolory: przydział stabilny (to samo wejście = ten sam wynik), niezależny od kolejności w puli', () => {
  const a = assignTileColors(TEXTS, '0|sentence');
  assert.deepEqual(assignTileColors(TEXTS, '0|sentence'), a);
  const reversed = [...TEXTS].reverse();
  const b = assignTileColors(reversed, '0|sentence');
  TEXTS.forEach((text, i) => assert.equal(b[reversed.indexOf(text)], a[i], `„${text}” ma ten sam kolor po przetasowaniu`));
  assert.ok(a.every((c) => Number.isInteger(c) && c >= 0 && c < TILE_COLOR_COUNT));
});

test('kolory: do 5 kafelków w rundzie ma 5 różnych odcieni', () => {
  for (let n = 2; n <= TILE_COLOR_COUNT; n++) {
    for (let s = 0; s < 40; s++) {
      const colors = assignTileColors(TEXTS.concat('extra tile here').slice(0, n), `${s}|x`);
      assert.equal(new Set(colors).size, n);
    }
  }
});

// Syntetyczny korpus rund: 3–5 kawałków + (co 2.) dystraktor, losowe teksty.
const WORDS = 'time year people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work government number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name'.split(' ');
function corpus(rounds: number) {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pick = () => WORDS[Math.floor(rnd() * WORDS.length)];
  return Array.from({ length: rounds }, (_, r) => {
    const n = 3 + Math.floor(rnd() * 3);
    const chunks = Array.from({ length: n }, () => `${pick()} ${pick()}${rnd() < 0.3 ? ` ${pick()}` : ''}`);
    const tiles: Array<{ text: string; role: 'chunk' | 'distractor'; position: number }> = chunks.map((text, position) => ({ text, role: 'chunk', position }));
    if (r % 2 === 0) tiles.push({ text: `${pick()} ${pick()}s`, role: 'distractor', position: n });
    return { seed: `${r}|${chunks.join(' ')}`, tiles };
  });
}

test('kolory: nie korelują z rolą (poprawny/dystraktor) ani z pozycją w poprawnej odpowiedzi', () => {
  const rounds = corpus(4000);
  const byRole = { chunk: new Array(TILE_COLOR_COUNT).fill(0), distractor: new Array(TILE_COLOR_COUNT).fill(0) };
  const byPosition: number[][] = Array.from({ length: 6 }, () => new Array(TILE_COLOR_COUNT).fill(0));
  for (const round of rounds) {
    const colors = assignTileColors(round.tiles.map((t) => t.text), round.seed);
    round.tiles.forEach((tile, i) => {
      byRole[tile.role][colors[i]]++;
      if (tile.role === 'chunk') byPosition[tile.position][colors[i]]++;
    });
  }
  const assertUniform = (counts: number[], label: string) => {
    const total = counts.reduce((a, b) => a + b, 0);
    counts.forEach((c, color) => {
      const share = c / total;
      assert.ok(Math.abs(share - 1 / TILE_COLOR_COUNT) < 0.05, `${label}: odcień ${color} ma udział ${share.toFixed(3)}`);
    });
  };
  assertUniform(byRole.chunk, 'poprawne');
  assertUniform(byRole.distractor, 'dystraktory');
  byPosition.slice(0, 5).forEach((counts, p) => assertUniform(counts, `pozycja ${p}`));
});

// ── kontrast: tekst text-hi na tle każdego odcienia, w obu motywach ──
const PALETTE = [1, 2, 3, 4, 5];
const themes: ThemeName[] = ['dark', 'light'];

test('kontrast: text-hi na tle każdego odcienia kafelka ≥ 4,5:1 w obu motywach (tabela w stdout)', () => {
  const rows: string[] = ['motyw | odcień | tło | text-hi | kontrast | obrys vs karta'];
  for (const theme of themes) {
    const text = themeColor(theme, '--color-text-hi');
    const card = themeColor(theme, '--color-surface-flat');
    for (const n of PALETTE) {
      const bg = themeColor(theme, `--color-tile-${n}`);
      const line = themeColor(theme, `--color-tile-line-${n}`);
      const ratio = contrastRatio(composite(text, bg), bg);
      rows.push(`${theme} | ${n} | ${THEMES[theme][`--color-tile-${n}`]} | ${THEMES[theme]['--color-text-hi']} | ${ratio.toFixed(2)} | ${contrastRatio(line, card).toFixed(2)}`);
      assert.ok(ratio >= AA_TEXT, `${theme} odcień ${n}: ${ratio.toFixed(2)} < ${AA_TEXT}`);
    }
  }
  console.log(rows.join('\n'));
});

test('kolory: komponent używa tokenów, nie surowych klas kolorów', () => {
  const src = readFileSync(new URL('../components/dashboard/HomeworkWarmupScrambler.tsx', import.meta.url), 'utf8');
  for (const n of PALETTE) assert.ok(src.includes(`bg-tile-${n} border-tile-line-${n}`));
  assert.ok(!/text-white|bg-white|\bvh\b|\d+vh/.test(src));
});

import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React, { useState } from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import '../i18n';
import HomeworkExercise from '../components/dashboard/HomeworkExercise';
import { mcOptionTint } from '../utils/multipleChoice';
import { gameTileAttrs } from '../utils/gameTile';
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { THEMES, themeColor, ThemeName } from './helpers/themeColors';

afterEach(cleanup);

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const mk = (correctIndex: number) => ({
  question: 'She ___ in this office since 2019.',
  options: ['has worked', 'works', 'is working', 'worked'],
  correctIndex,
});

const Host: React.FC<{ item: any }> = ({ item }) => {
  const [answer, setAnswer] = useState<number | null>(null);
  return <HomeworkExercise type="multiple_choice" item={item} answer={answer} onChange={setAnswer} />;
};
const click = (el: Element) => act(() => { fireEvent.click(el); });
const tints = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-testid="mc-option"]')).map((t) => t.getAttribute('data-tint'));

test('kolor kafelka zależy od pozycji, nie od flagi poprawności: ten sam układ barw dla każdego correctIndex', () => {
  const layouts = [0, 1, 2, 3].map((correctIndex) => tints(render(<Host item={mk(correctIndex)} />).container));
  for (const layout of layouts) assert.deepEqual(layout, ['2', '3', '4', '5']);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(mcOptionTint), [2, 3, 4, 5, 2, 3]);
});

test('cztery kafelki mają cztery różne barwy, a kolor nie zmienia się po odpowiedzi (poprawnej ani błędnej)', () => {
  const { container } = render(<Host item={mk(0)} />);
  const before = tints(container);
  assert.equal(new Set(before).size, 4);
  click(container.querySelectorAll('[data-testid="mc-option"]')[2]);
  assert.deepEqual(tints(container), before);
  assert.deepEqual(
    Array.from(container.querySelectorAll('[data-testid="mc-option"]')).map((t) => t.getAttribute('data-state')),
    ['correct', 'locked', 'wrong', 'locked']
  );
});

test('poprawna i błędna odpowiedź różnią się nie tylko kolorem: ikona, tekst dla czytnika, przerywany obrys, wynik pod siatką', () => {
  const { container, getByTestId } = render(<Host item={mk(0)} />);
  click(container.querySelectorAll('[data-testid="mc-option"]')[1]);
  const [ok, bad] = [0, 1].map((i) => container.querySelectorAll('[data-testid="mc-option"]')[i] as HTMLElement);
  assert.ok(ok.querySelector('svg') && bad.querySelector('svg'), 'ikona na obu');
  assert.notEqual(ok.innerHTML.match(/<svg[\s\S]*?<\/svg>/)![0], bad.innerHTML.match(/<svg[\s\S]*?<\/svg>/)![0], 'ikony różne (✓ / ✕)');
  assert.match(ok.querySelector('.sr-only')!.textContent!, /Poprawna odpowiedź/);
  assert.match(bad.querySelector('.sr-only')!.textContent!, /Błędna odpowiedź/);
  assert.match(getByTestId('mc-result').textContent!, /Błędna odpowiedź/);
  assert.match(css, /\.game-tile\[data-tint\]\[data-state="wrong"\] \{ border-style: dashed; \}/);
});

test('gameTileAttrs: tint trafia do data-tint, a nie do data-shade (shade przejmowałby kolor po stanie)', () => {
  const attrs = gameTileAttrs({ state: 'rest', tint: 3 });
  assert.equal(attrs['data-tint'], 3);
  assert.equal(attrs['data-shade'], undefined);
});

test('CSS: stany nadpisują pastel (reguły tint przed regułami stanów), cel ≥ 44 px, kafelek ≥ 56 px, reduced-motion', () => {
  const tintAt = css.indexOf('.game-tile[data-tint="1"]');
  for (const state of ['selected', 'correct', 'wrong', 'locked']) {
    assert.ok(tintAt >= 0 && tintAt < css.indexOf(`.game-tile[data-state="${state}"]`), `tint przed ${state}`);
  }
  assert.match(css, /\.game-tile \{[^}]*min-height: 3\.5rem/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.game-tile \{ transition: none; \}[\s\S]*\.game-tile\[data-state="wrong"\] \{ animation: none; \}/);
});

test('kontrast pasteli opcji (5 kolorów × 2 motywy): tekst ≥ 4,5:1, obrys ≥ 3:1 względem tła kafelka lub strony, zaznaczenie ≥ 3:1', () => {
  const themes: ThemeName[] = ['light', 'dark'];
  const rows = ['motyw | kolor | tło | tekst na tle | obrys vs tło kafelka | obrys vs tło strony | obwódka zaznaczenia vs tło kafelka'];
  for (const theme of themes) {
    const text = themeColor(theme, '--color-text-hi');
    const page = themeColor(theme, '--color-bg');
    const primary = themeColor(theme, '--color-primary');
    for (const n of [1, 2, 3, 4, 5]) {
      const bg = themeColor(theme, `--color-tile-${n}`);
      const line = themeColor(theme, `--color-tile-line-${n}`);
      const textRatio = contrastRatio(composite(text, bg), bg);
      const vsTile = contrastRatio(line, bg);
      const vsPage = contrastRatio(line, page);
      const sel = contrastRatio(primary, bg);
      rows.push(`${theme} | ${n} | ${THEMES[theme][`--color-tile-${n}`]} | ${textRatio.toFixed(2)} | ${vsTile.toFixed(2)} | ${vsPage.toFixed(2)} | ${sel.toFixed(2)}`);
      assert.ok(textRatio >= AA_TEXT, `${theme}/${n}: tekst ${textRatio.toFixed(2)}`);
      assert.ok(Math.max(vsTile, vsPage) >= AA_NON_TEXT, `${theme}/${n}: obrys ${vsTile.toFixed(2)} / ${vsPage.toFixed(2)}`);
      assert.ok(Math.max(sel, contrastRatio(primary, page)) >= AA_NON_TEXT, `${theme}/${n}: zaznaczenie ${sel.toFixed(2)}`);
    }
  }
  console.log(rows.join('\n'));
});


function getHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return Math.round(h);
}

test('żaden kolor puli (1…5) w obu motywach nie wpada w zakres 335°–25° (czerwień/róż)', () => {
  const themes: ThemeName[] = ['light', 'dark'];
  for (const theme of themes) {
    for (const n of [1, 2, 3, 4, 5]) {
      const hex = THEMES[theme][`--color-tile-${n}`];
      const hue = getHue(hex);
      const isRedPink = hue >= 335 || hue <= 25;
      assert.equal(isRedPink, false, `${theme} tile-${n} (${hex}, hue ${hue}°) leży w zakresie 335°–25°!`);
    }
  }
});

// Podpisy „(Strzałka w lewo/prawo)" pod „Nie umiem" / „Umiem": tekst ≥ 4,5:1 w obu motywach.
// Dawny `opacity-70` bladł podpis poniżej AA w trybie jasnym.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { themeColor, type ThemeName } from './helpers/themeColors';

const src = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
const themes: ThemeName[] = ['dark', 'light'];

test('podpisy skrótów klawiszowych nie są blednięte przezroczystością', () => {
  const hints = [...src.matchAll(/<span className="([^"]*)">\{i18n\.t\("(?:Nie umiem|Umiem) \(Strzałka w (?:lewo|prawo)\)"\)\}<\/span>/g)];
  assert.equal(hints.length, 2);
  for (const [, cls] of hints) assert.doesNotMatch(cls, /opacity/, cls);
});

test('„Nie umiem": etykieta i podpis idą tokenem text-hi (czerwień na czerwonawym tle nie daje AA w jasnym motywie)', () => {
  assert.match(src, /<span className="text-text-hi">\{i18n\.t\("Nie umiem"\)\}<\/span>/);
  assert.match(src, /<span className="text-\[12px\] uppercase text-text-hi">\{i18n\.t\("Nie umiem \(Strzałka w lewo\)"\)\}<\/span>/);
});

for (const theme of themes) {
  test(`„Nie umiem" (danger): tekst podpisu ≥ 4,5:1 na tle przycisku — motyw ${theme}`, () => {
    // Button danger: bg-danger/10 nałożone na tło strony, tekst tokenem text-hi.
    const bg = composite(themeColor(theme, '--color-danger'), themeColor(theme, '--color-bg'), 0.1);
    const ratio = contrastRatio(themeColor(theme, '--color-text-hi'), bg);
    assert.ok(ratio >= AA_TEXT, `${theme}: ${ratio.toFixed(2)}:1`);
  });

  test(`„Umiem" (primary): tekst podpisu ≥ 4,5:1 na wypełnieniu akcentem — motyw ${theme}`, () => {
    const ratio = contrastRatio(themeColor(theme, '--color-accent-ink'), themeColor(theme, '--color-accent'));
    assert.ok(ratio >= AA_TEXT, `${theme}: ${ratio.toFixed(2)}:1`);
  });
}

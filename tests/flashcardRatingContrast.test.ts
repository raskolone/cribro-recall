// Podpisy „(Strzałka w lewo/prawo)" pod „Nie umiem" / „Umiem": tekst ≥ 4,5:1 w obu motywach.
// Dawny `opacity-70` bladł podpis poniżej AA w trybie jasnym.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AA_TEXT, contrastRatio } from '../utils/contrast';
import { themeColor, type ThemeName } from './helpers/themeColors';

const src = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
const themes: ThemeName[] = ['dark', 'light'];

test('jedna etykieta na przycisk: bez drugiej linii z powtórzeniem i opisem klawisza w widocznym tekście', () => {
  assert.doesNotMatch(src, /<span[^>]*>\{i18n\.t\("(?:Nie umiem|Umiem) \(Strzałka w (?:lewo|prawo)\)"\)\}<\/span>/);
  // Opis skrótu tylko w aria-label i title.
  assert.equal((src.match(/aria-label=\{i18n\.t\("(?:Nie umiem|Umiem) \(Strzałka w (?:lewo|prawo)\)"\)\}/g) || []).length, 2);
  assert.equal((src.match(/title=\{i18n\.t\("(?:Nie umiem|Umiem) \(Strzałka w (?:lewo|prawo)\)"\)\}/g) || []).length, 2);
});

test('strzałka w lewo PRZED „Nie umiem", strzałka w prawo PO „Umiem"', () => {
  assert.match(src, /<ArrowLeft [^>]*\/>\s*<span>\{i18n\.t\("Nie umiem"\)\}<\/span>/);
  assert.match(src, /<span>\{i18n\.t\("Umiem"\)\}<\/span>\s*<ArrowRight /);
});

test('przyciski oceny są zawsze renderowane (nie zależą od isFlipped) i wołają ten sam handleAnswer', () => {
  const row = src.slice(src.indexOf('data-testid="flashcard-actions"'), src.indexOf('data-testid="flashcard-flip-hint"'));
  assert.ok(row.includes('handleAnswer(false)') && row.includes('handleAnswer(true)'));
  assert.doesNotMatch(row, /isFlipped|disabled/);
});

test('„Nie umiem" = tło danger, „Umiem" = tło accent, tekst accent-ink (tokeny motywu)', () => {
  assert.match(src, /bg-danger px-5 text-sm font-bold text-accent-ink/);
  assert.match(src, /bg-accent px-5 text-sm font-bold text-accent-ink/);
});

for (const theme of themes) {
  test(`„Nie umiem" (danger): etykieta ≥ 4,5:1 na wypełnieniu — motyw ${theme}`, () => {
    // Przycisk: wypełnienie tokenem danger, tekst accent-ink.
    const ratio = contrastRatio(themeColor(theme, '--color-accent-ink'), themeColor(theme, '--color-danger'));
    assert.ok(ratio >= AA_TEXT, `${theme}: ${ratio.toFixed(2)}:1`);
  });

  test(`„Umiem" (primary): tekst podpisu ≥ 4,5:1 na wypełnieniu akcentem — motyw ${theme}`, () => {
    const ratio = contrastRatio(themeColor(theme, '--color-accent-ink'), themeColor(theme, '--color-accent'));
    assert.ok(ratio >= AA_TEXT, `${theme}: ${ratio.toFixed(2)}:1`);
  });
}

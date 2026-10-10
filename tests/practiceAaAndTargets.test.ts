// Poprawki z przebiegu weryfikacyjnego w przeglądarce (obie przeglądarki, oba motywy): cele dotykowe ≥ 44 px
// i kontrast AA w miejscach, gdzie kolor akcentu na własnym półprzezroczystym tle dawał 3,1–4,2:1 w jasnym motywie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { themeColor, type ThemeName } from './helpers/themeColors';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('„Utwórz własny zestaw": przycisk i link mają cel ≥ 44 px, a modal przycisk zamknięcia 44 × 44', () => {
  const screen = read('components/practice/FreePracticeScreen.tsx');
  const button = screen.slice(screen.indexOf('data-testid="free-practice-create-set-button"'), screen.indexOf('data-testid="free-practice-create-set-button"') + 420);
  assert.match(button, /min-h-11/);
  const link = screen.slice(screen.indexOf('data-testid="free-practice-create-set"'), screen.indexOf('data-testid="free-practice-create-set"') + 320);
  assert.match(link, /min-h-11/);
  assert.match(read('components/practice/CreateCustomSetModal.tsx'), /aria-label=\{t\('Zamknij'\)\}\s*className=\{`flex h-11 w-11/);
});

test('odsłuch US/UK: strefa dotyku (::before) sięga 12 px nad i pod przyciskiem — ≥ 44 px także przy zaokrąglonej wysokości', () => {
  assert.match(read('components/practice/SentenceFeedback.tsx'), /before:inset-x-0 before:-inset-y-3/);
});

test('plakietki i etykiety na tle akcentu/ostrzeżenia mają tekst tokenem text-hi, a kolor w obwódce i ikonie', () => {
  const screen = read('components/practice/FreePracticeScreen.tsx');
  assert.match(screen, /rounded-full border border-primary bg-primary\/10 px-2\.5 py-0\.5 text-xs font-bold text-text-hi/, '„Polecane na start"');
  const next = read('components/practice/WhatsNextSection.tsx');
  assert.match(next, /bg-warn\/10 text-text-hi border border-warn/, 'chipy słów do powtórzenia');
  assert.doesNotMatch(next, /text-warn/, 'tekst nie idzie kolorem ostrzeżenia na jego tle');
  const gen = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.match(gen, /text-text-hi bg-primary\/10 border border-primary">/, 'plakietka rodzaju w zaproszeniu do ćwiczenia');
});

for (const theme of ['dark', 'light'] as ThemeName[]) {
  test(`tekst text-hi na tle primary/10 i warn/10 ≥ 4,5:1, obwódka ≥ 3:1 — motyw ${theme}`, () => {
    const surface = themeColor(theme, '--color-surface-flat');
    const page = themeColor(theme, '--color-bg');
    for (const token of ['--color-primary', '--color-warn']) {
      for (const base of [surface, page]) {
        const tint = composite(themeColor(theme, token), base, token === '--color-primary' ? 0.1 : 0.1);
        const text = contrastRatio(themeColor(theme, '--color-text-hi'), tint);
        assert.ok(text >= AA_TEXT, `${token}: ${text.toFixed(2)}`);
        const border = contrastRatio(themeColor(theme, token), base);
        assert.ok(border >= AA_NON_TEXT, `obwódka ${token}: ${border.toFixed(2)}`);
      }
    }
  });
}

test('ekrany ćwiczenia, zaproszenia do niego i wyników mają boczny odstęp na telefonie (karta nie dotyka krawędzi okna)', () => {
  const src = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  for (const marker of [
    'max-w-2xl mx-auto space-y-4 px-3 sm:px-0 pb-28 md:pb-8 animate-fade-in',
    'max-w-2xl mx-auto px-3 sm:px-0 pb-28 md:pb-8 animate-fade-in',
    'max-w-2xl mx-auto space-y-4 px-3 sm:px-0 pb-28 md:pb-8',
    'ref={resultsRef} className="max-w-3xl mx-auto space-y-8 px-3 sm:px-0"',
  ]) {
    assert.ok(src.includes(marker), marker);
  }
});

test('plansza dopasowania i ekrany końca sesji mają boczny odstęp na telefonie (nic nie dotyka krawędzi okna)', () => {
  const game = read('components/flashcards/MatchingGame.tsx');
  assert.ok(game.includes('min-h-[calc(100dvh-5rem)] px-3 sm:px-0 pb-8'), 'plansza');
  assert.ok(game.includes('min-h-[calc(100dvh-5rem)] px-3 sm:px-0 py-8'), 'podsumowanie dopasowania');
  const study = read('components/flashcards/FlashcardStudyScreen.tsx');
  assert.equal((study.match(/max-w-2xl mx-auto text-center space-y-8 px-3 sm:px-0/g) || []).length, 3, 'ekrany końca: fiszki, quiz, pisanie');
  assert.doesNotMatch(study, /max-w-2xl mx-auto text-center space-y-8">/);
});

for (const theme of ['dark', 'light'] as ThemeName[]) {
  test(`licznik na aktywnej zakładce zestawów: tekst accent-ink na akcencie ≥ 4,5:1 — motyw ${theme} (dawne text-white dawało 2,2:1 w ciemnym)`, () => {
    const accent = themeColor(theme, '--color-primary');
    const ink = themeColor(theme, '--color-accent-ink');
    const badge = composite({ r: 0, g: 0, b: 0, a: 1 }, accent, 0.15); // bg-black/15 na akcencie
    assert.ok(contrastRatio(ink, badge) >= AA_TEXT, `${contrastRatio(ink, badge).toFixed(2)}`);
    const src = read('components/practice/FreePracticeScreen.tsx');
    assert.doesNotMatch(src, /bg-black\/20 text-white/);
    assert.match(src, /bg-black\/15 text-accent-ink/);
  });
}

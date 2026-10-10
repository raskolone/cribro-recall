// F2: ekran „Tłumaczenie zdań" / „Korekta zdań" — karta zdania, pole odpowiedzi i pasek akcji (tokeny
// obu motywów, bez cieni wewnętrznych, wyraźne stany). Tylko prezentacja; punktacja bez zmian.
import './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import { SentenceActionBar, SentenceAnswerInput, SentencePromptCard } from '../components/practice/SentencePracticeParts';
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../utils/contrast';
import { themeColor, type ThemeName } from './helpers/themeColors';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});
afterEach(cleanup);

// --- Karta zdania, pole, akcje (F2) ---------------------------------------------------------

test('karta zdania: plakietka „Zdanie N", „Pokaż wskazówkę" z aria-expanded, lekka powierzchnia — bez cieni wewnętrznych', () => {
  let toggled = 0;
  const { getByTestId, rerender } = render(
    <SentencePromptCard variant="translation" index={0} sentence="Zarezerwowałem lot." hint="book — Past Simple" hintOpen={false} onToggleHint={() => toggled++} />,
  );
  const card = getByTestId('sentence-prompt');
  assert.match(card.textContent!, /Zdanie 1/);
  assert.match(card.textContent!, /Zarezerwowałem lot\./);
  const toggle = getByTestId('hint-toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.match(toggle.textContent!, /Pokaż wskazówkę/);
  assert.match(toggle.className, /min-h-11/);
  assert.equal(getByTestId('hint-panel').hasAttribute('hidden'), true);
  fireEvent.click(toggle);
  assert.equal(toggled, 1);
  rerender(<SentencePromptCard variant="translation" index={0} sentence="Zarezerwowałem lot." hint="book — Past Simple" hintOpen onToggleHint={() => {}} />);
  assert.equal(getByTestId('hint-toggle').getAttribute('aria-expanded'), 'true');
  assert.match(getByTestId('hint-toggle').textContent!, /Ukryj wskazówkę/);
  assert.equal(getByTestId('hint-panel').hasAttribute('hidden'), false);
  assert.match(card.className, /bg-surface-flat/);
  assert.doesNotMatch(read('components/practice/SentencePracticeParts.tsx'), /shadow-inner|inset_0|shadow-\[inset|bg-black/);
});

test('karta korekty: ten sam komponent, wariant correction z kontekstem; bez wskazówki brak przycisku', () => {
  const { getByTestId, queryByTestId } = render(
    <SentencePromptCard variant="correction" index={1} sentence="She don't eat meat." context="Ona nie je mięsa." hintOpen={false} onToggleHint={() => {}} />,
  );
  assert.equal(getByTestId('sentence-prompt').getAttribute('data-variant'), 'correction');
  assert.match(getByTestId('sentence-prompt').textContent!, /Znajdź i popraw błąd w zdaniu/);
  assert.match(getByTestId('sentence-prompt').textContent!, /Ona nie je mięsa\./);
  assert.ok(!queryByTestId('hint-toggle'));
});

test('pole odpowiedzi: etykieta powiązana z polem, tokeny motywu, tekst 16 px, wyraźny focus, placeholder', () => {
  const { getByTestId, getByLabelText } = render(<SentenceAnswerInput label="Twoje tłumaczenie na angielski" placeholder="Wpisz swoje tłumaczenie tutaj" defaultValue="" />);
  const field = getByTestId('sentence-answer') as HTMLTextAreaElement;
  assert.equal(getByLabelText('Twoje tłumaczenie na angielski'), field);
  assert.equal(field.placeholder, 'Wpisz swoje tłumaczenie tutaj');
  for (const cls of ['bg-surface-flat', 'border-text-mute', 'text-text-hi', 'placeholder:text-text-3', 'text-base', 'focus:border-primary', 'focus:ring-2']) {
    assert.ok(field.className.includes(cls), cls);
  }
  assert.doesNotMatch(field.className, /bg-black|shadow-inner|text-white/);
  assert.match(field.className, /motion-reduce:transition-none/);
});

test('pasek akcji: Poprzednie, Sprawdź (główna, wypełniona), Dalej (drugorzędna) — stała kolejność, cele ≥ 44 px', () => {
  const clicks: string[] = [];
  const { getByTestId, getByText } = render(
    <SentenceActionBar
      previous={{ label: 'Poprzednie', onClick: () => clicks.push('prev'), disabled: true }}
      primary={{ label: 'Sprawdź', onClick: () => clicks.push('check') }}
      secondary={{ label: 'Dalej', onClick: () => clicks.push('next') }}
    />,
  );
  const bar = getByTestId('sentence-actions');
  assert.match(bar.className, /grid-cols-2/);
  assert.match(bar.className, /sm:flex/);
  const [prev, primary, secondary] = ['action-previous', 'action-primary', 'action-secondary'].map((id) => getByTestId(id)) as HTMLButtonElement[];
  for (const b of [prev, primary, secondary]) assert.match(b.className, /min-h-12/);
  assert.match(primary.className, /bg-accent text-accent-ink/);
  assert.doesNotMatch(secondary.className, /bg-accent/);
  assert.match(secondary.className, /border-text-mute/);
  assert.equal(prev.disabled, true);
  assert.match(prev.className, /disabled:text-text-3/, 'nieaktywne czytelne, nie wyblakłe');
  assert.doesNotMatch(prev.className + secondary.className + primary.className, /opacity-/);
  // Główna akcja pierwsza w kolejności wizualnej na wąskim ekranie; DOM: Poprzednie, Sprawdź, Dalej.
  assert.match(primary.parentElement!.className, /order-1 col-span-2/);
  assert.match(prev.className, /order-2/);
  assert.match(secondary.className, /order-3/);
  assert.deepEqual([...bar.querySelectorAll('button')].map((b) => b.textContent), ['Poprzednie', 'Sprawdź', 'Dalej']);
  fireEvent.click(primary);
  fireEvent.click(secondary);
  fireEvent.click(prev);
  assert.deepEqual(clicks, ['check', 'next']);
  assert.ok(getByText('Sprawdź'));
});

test('pasek akcji: stan ładowania blokuje przycisk i ma aria-busy; bez drugorzędnej akcji rysuje dwa przyciski', () => {
  const { getByTestId, queryByTestId } = render(
    <SentenceActionBar previous={{ label: 'Poprzednie', onClick: () => {} }} primary={{ label: 'Sprawdź', onClick: () => {}, loading: true }} />,
  );
  const primary = getByTestId('action-primary') as HTMLButtonElement;
  assert.equal(primary.disabled, true);
  assert.equal(primary.getAttribute('aria-busy'), 'true');
  assert.ok(primary.querySelector('svg.animate-spin'));
  assert.ok(!queryByTestId('action-secondary'));
});

// --- Kontrast AA w obu motywach -------------------------------------------------------------

const themes: ThemeName[] = ['dark', 'light'];
for (const theme of themes) {
  const surface = themeColor(theme, '--color-surface-flat');
  const page = themeColor(theme, '--color-bg');
  const ratio = (fg: string, bg = surface) => contrastRatio(themeColor(theme, fg), bg);

  test(`pole odpowiedzi — motyw ${theme}: tekst ≥ 4,5:1, placeholder ≥ 4,5:1, obwódka ≥ 3:1 (na powierzchni i na tle)`, () => {
    assert.ok(ratio('--color-text-hi') >= AA_TEXT, `tekst ${ratio('--color-text-hi').toFixed(2)}`);
    assert.ok(ratio('--color-text-3') >= AA_TEXT, `placeholder ${ratio('--color-text-3').toFixed(2)}`);
    assert.ok(ratio('--color-text-mute') >= AA_NON_TEXT, `obwódka/powierzchnia ${ratio('--color-text-mute').toFixed(2)}`);
    assert.ok(ratio('--color-text-mute', page) >= AA_NON_TEXT, `obwódka/tło ${ratio('--color-text-mute', page).toFixed(2)}`);
    assert.ok(ratio('--color-primary') >= AA_NON_TEXT, `focus ${ratio('--color-primary').toFixed(2)}`);
  });

  test(`przyciski — motyw ${theme}: główna AA, drugorzędna AA, nieaktywne ≥ 3:1 (czytelne, nie wyblakłe)`, () => {
    assert.ok(contrastRatio(themeColor(theme, '--color-accent-ink'), themeColor(theme, '--color-accent')) >= AA_TEXT, 'Sprawdź');
    assert.ok(ratio('--color-text-hi') >= AA_TEXT, 'Dalej (kontur)');
    assert.ok(ratio('--color-text-hi', page) >= AA_TEXT, 'Dalej na tle strony');
    assert.ok(ratio('--color-text-3') >= AA_NON_TEXT, `nieaktywne ${ratio('--color-text-3').toFixed(2)}`);
    assert.ok(ratio('--color-text-3', page) >= AA_NON_TEXT, `nieaktywne na tle ${ratio('--color-text-3', page).toFixed(2)}`);
    assert.ok(ratio('--color-text-mute') >= AA_NON_TEXT, 'obrys drugorzędnej');
  });
}

// --- Wpięcie w generator -------------------------------------------------------------------

test('generator używa wspólnych komponentów karty, pola i paska akcji; bez cieni wewnętrznych i surowych kolorów w tych miejscach', () => {
  const src = strip(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  for (const name of ['SentencePromptCard', 'SentenceAnswerInput', 'SentenceActionBar']) assert.ok(src.includes(`<${name}`), name);
  assert.doesNotMatch(src, /shadow-\[inset_0_2px_15px/);
  assert.doesNotMatch(src, /Twoje tłumaczenie na angielski:'|Wpisz swoje tłumaczenie tutaj\.\.\./);
});

test('kolejność akcji w generatorze: Sprawdź jest główną, Dalej/Zakończ drugorzędną, po sprawdzeniu jedna akcja', () => {
  const src = strip(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  const a = src.indexOf('<SentenceActionBar');
  const bar = src.slice(a, a + 900);
  assert.match(bar, /previous=\{\{ label: i18n\.t\('Poprzednie'\), onClick: handlePrev, disabled: idx === 0 \}\}/);
  assert.match(bar, /label: i18n\.t\('Sprawdź'\), onClick: handleEvaluateSingle/);
  assert.match(bar, /secondary=\{evaluated \? undefined : forward\}/);
  assert.match(src, /label: evaluated \? i18n\.t\('Zakończ i podsumuj'\) : i18n\.t\('Zakończ'\)/);
});

test('punktacja i logika oceny bez zmian: handleEvaluateSingle i wynik poprawnej korekty 40/40/20 jak dotąd', () => {
  const src = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.match(src, /const handleEvaluateSingle = async \(\) => \{/);
  assert.match(src, /meaning_score: 40,\s*grammar_score: 40,\s*vocabulary_score: 20/);
});

test('teksty karty, pola i paska akcji mają wpis w pl.json i en.json', () => {
  const pl = JSON.parse(read('pl.json')) as Record<string, string>;
  const en = JSON.parse(read('en.json')) as Record<string, string>;
  const keys = new Set<string>();
  for (const m of read('components/practice/SentencePracticeParts.tsx').matchAll(/\bt\('([^']+)'\)/g)) keys.add(m[1]);
  for (const k of ['Poprzednie', 'Sprawdź', 'Dalej', 'Zakończ', 'Zakończ i podsumuj', 'Twoje tłumaczenie na angielski', 'Twoja poprawiona wersja']) keys.add(k);
  assert.ok(keys.size >= 8, `klucze: ${keys.size}`);
  for (const key of keys) {
    assert.ok(key in pl, `pl: ${key}`);
    assert.ok(key in en && en[key].trim() !== '', `en: ${key}`);
  }
});

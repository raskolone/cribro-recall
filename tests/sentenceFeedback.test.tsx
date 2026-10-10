// F3: ocena zdania po sprawdzeniu — plakietki, ton wyniku (z ikoną i liczbą), bloki odpowiedzi,
// akordeon feedbacku, bezpieczne podświetlenia. Tylko prezentacja; punktacja bez zmian.
import './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import { FeedbackAccordion, ScoreBreakdownRow, SentenceFeedbackPanel, SentenceResultCard } from '../components/practice/SentenceFeedback';
import { TONE_CLASSES, TONE_LABEL_KEYS, TONE_TOKENS, toneForPercent, toneForPoints, toneForShare } from '../utils/scoreTone';
import { sanitizeHighlightHtml } from '../utils/safeHighlight';
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { themeColor, type ThemeName } from './helpers/themeColors';
import type { TranslationEvaluationResult } from '../types';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});
afterEach(cleanup);

const result = (over: Partial<TranslationEvaluationResult> = {}): TranslationEvaluationResult => ({
  polishSentence: 'Zarezerwowałem lot na piątek.',
  correctTranslation: 'I booked a flight for Friday.',
  studentAnswer: 'I booked flight for Friday',
  isCorrect: false,
  score: 72,
  explanation: 'Brakuje przedimka.',
  breakdown: { meaning_score: 40, grammar_score: 20, vocabulary_score: 12 },
  feedbackSyntax: 'Dodaj przedimek „a" przed „flight".',
  feedbackVocab: 'Dobry dobór słownictwa.',
  feedbackRule: 'Rzeczownik policzalny w liczbie pojedynczej wymaga przedimka.',
  ...over,
});

// --- Ton wyniku -----------------------------------------------------------------------------

test('ton wyniku wg udziału punktów: ≥ 85% sukces, 50–84% ostrzeżenie, < 50% błąd (progi graniczne)', () => {
  assert.equal(toneForShare(1), 'success');
  assert.equal(toneForShare(0.85), 'success');
  assert.equal(toneForShare(0.8499), 'warn');
  assert.equal(toneForShare(0.5), 'warn');
  assert.equal(toneForShare(0.4999), 'danger');
  assert.equal(toneForShare(0), 'danger');
  assert.equal(toneForShare(NaN), 'danger');
  assert.equal(toneForShare(7), 'success', 'poza przedziałem obcinane');
  assert.equal(toneForShare(-3), 'danger');
  assert.equal(toneForPercent(85), 'success');
  assert.equal(toneForPercent(84), 'warn');
  assert.equal(toneForPercent(49), 'danger');
  // punkty składowe liczone względem własnego maksimum (40/40/20)
  assert.equal(toneForPoints(34, 40), 'success');
  assert.equal(toneForPoints(33, 40), 'warn');
  assert.equal(toneForPoints(17, 20), 'success');
  assert.equal(toneForPoints(9, 20), 'danger');
  assert.equal(toneForPoints(5, 0), 'danger');
});

// --- Plakietki i wynik ogólny ---------------------------------------------------------------

test('zwarty rząd plakietek zamiast kafli: etykieta, punkty/max, ikona i opis dla czytnika — kolor nie jest jedynym sygnałem', () => {
  const { getAllByTestId, container } = render(<ScoreBreakdownRow breakdown={{ meaning_score: 40, grammar_score: 20, vocabulary_score: 5 }} />);
  const chips = getAllByTestId('score-chip');
  assert.deepEqual(chips.map((c) => c.getAttribute('data-tone')), ['success', 'warn', 'danger']);
  assert.deepEqual(
    chips.map((c) => c.textContent),
    ['Znaczenie40/40Bardzo dobrze', 'Gramatyka20/40Można poprawić', 'Słownictwo5/20Do poprawy'],
  );
  for (const chip of chips) {
    assert.ok(chip.querySelector('svg'), 'ikona tonu');
    assert.ok(chip.querySelector('.sr-only'), 'tonalny opis dla czytnika');
    assert.match(chip.className, /text-text-hi/, 'tekst tokenem text-hi (AA), kolor tylko w obwódce i ikonie');
    assert.match(chip.className, /rounded-full/);
  }
  assert.equal(container.querySelectorAll('li').length, 3);
  assert.equal(render(<ScoreBreakdownRow />).container.innerHTML, '', 'bez breakdown nic nie rysujemy');
});

test('wynik ogólny: procent, ikona i ton z progów', () => {
  const { getByTestId, rerender } = render(<SentenceFeedbackPanel result={result({ score: 90, isCorrect: true })} onPlay={() => {}} />);
  assert.equal(getByTestId('overall-score').getAttribute('data-tone'), 'success');
  assert.match(getByTestId('overall-score').textContent!, /^90%/);
  rerender(<SentenceFeedbackPanel result={result({ score: 60 })} onPlay={() => {}} />);
  assert.equal(getByTestId('overall-score').getAttribute('data-tone'), 'warn');
  rerender(<SentenceFeedbackPanel result={result({ score: 30 })} onPlay={() => {}} />);
  assert.equal(getByTestId('overall-score').getAttribute('data-tone'), 'danger');
  assert.ok(getByTestId('overall-score').querySelector('svg'));
});

// --- Panel oceny pod zdaniem ----------------------------------------------------------------

test('panel oceny: werdykt, plakietki, odpowiedź kursanta, wzorzec z odsłuchem US/UK, akapity feedbacku — bez kafli', () => {
  const plays: Array<[string, string]> = [];
  const { getByTestId, queryByTestId } = render(
    <SentenceFeedbackPanel result={result()} modelLabel="Gemini 2.5 Flash" onPlay={(text, accent) => plays.push([text, accent])} />,
  );
  assert.match(getByTestId('sentence-feedback').textContent!, /Do poprawy/);
  assert.match(getByTestId('sentence-feedback').textContent!, /Sprawdzone przez\s*Gemini 2\.5 Flash/);
  assert.equal(getByTestId('score-breakdown').querySelectorAll('li').length, 3);
  assert.match(getByTestId('answer-student').textContent!, /I booked flight for Friday/);
  assert.match(getByTestId('answer-model').textContent!, /I booked a flight for Friday\./);
  fireEvent.click(getByTestId('listen-us'));
  fireEvent.click(getByTestId('listen-uk'));
  assert.deepEqual(plays, [['I booked a flight for Friday.', 'en-US'], ['I booked a flight for Friday.', 'en-GB']]);
  assert.ok(getByTestId('feedback-syntax').textContent!.includes('Dodaj przedimek'));
  assert.ok(getByTestId('feedback-vocab') && getByTestId('feedback-rule'));
  assert.ok(!queryByTestId('feedback-toggle'), 'akordeon to element listy wyników, nie panelu pod zdaniem');
  // brak kafli „grid-cols-3 + bg-black/30"
  assert.doesNotMatch(read('components/practice/SentenceFeedback.tsx'), /grid-cols-3|bg-black\/30/);
});

test('przyciski odsłuchu: wizualnie małe (h-7), strefa dotyku ≥ 44 px przez ::before, etykiety dostępne', () => {
  const { getByTestId } = render(<SentenceFeedbackPanel result={result()} onPlay={() => {}} />);
  const us = getByTestId('listen-us');
  assert.match(us.className, /\bh-7\b/);
  assert.match(us.className, /before:-inset-y-2/, '28 px + 2 × 8 px = 44 px strefy dotyku');
  assert.match(us.className, /before:inset-x-0/);
  assert.match(us.className, /min-w-11/);
  assert.equal(us.getAttribute('aria-label'), 'Wymowa amerykańska');
  assert.equal(getByTestId('listen-uk').getAttribute('aria-label'), 'Wymowa brytyjska');
});

test('brak odpowiedzi kursanta i brak breakdown nie psują panelu', () => {
  const { getByTestId, queryByTestId } = render(<SentenceFeedbackPanel result={result({ studentAnswer: '', breakdown: undefined })} onPlay={() => {}} />);
  assert.match(getByTestId('answer-student').textContent!, /\(brak\)/);
  assert.ok(!queryByTestId('score-breakdown'));
});

test('feedback bez rozbicia na pola pokazuje ogólne wyjaśnienie', () => {
  const { getByTestId } = render(<SentenceFeedbackPanel result={result({ feedbackSyntax: '', feedbackVocab: '', feedbackRule: '', explanation: 'Ogólne wyjaśnienie.' })} onPlay={() => {}} />);
  assert.match(getByTestId('sentence-feedback').textContent!, /Ogólne wyjaśnienie\./);
});

// --- Lista wyników i akordeon ---------------------------------------------------------------

test('karta wyniku: „Po polsku" na całą szerokość, odpowiedź i wzorzec obok siebie od sm, jedno pod drugim na telefonie', () => {
  const { getByTestId } = render(<SentenceResultCard result={result()} index={2} onPlay={() => {}} />);
  const card = getByTestId('sentence-result');
  assert.equal(card.getAttribute('data-tone'), 'warn');
  assert.match(card.textContent!, /Zdanie 3/);
  const answers = getByTestId('result-answers');
  assert.match(answers.className, /\bgrid\b/);
  assert.match(answers.className, /sm:grid-cols-2/);
  assert.doesNotMatch(answers.className, /(^|\s)grid-cols-2/, 'na telefonie jedna kolumna');
  assert.match(getByTestId('result-polish').textContent!, /Zarezerwowałem lot na piątek\./);
  assert.match(getByTestId('result-student').textContent!, /I booked flight for Friday/);
  assert.match(getByTestId('result-model').textContent!, /I booked a flight for Friday\./);
  assert.match(card.className, /border-l-warn/, 'ton także jako lewa kreska');
  assert.doesNotMatch(card.className, /\bp-6\b|space-y-6/, 'zwarte odstępy');
});

test('akordeon „Sprawdź feedback": aria-expanded + aria-controls, domyślnie zwinięty, rozwija się i zwija, zawartość w regionie', () => {
  const { getByTestId } = render(<FeedbackAccordion result={result()} />);
  const toggle = getByTestId('feedback-toggle');
  const panel = getByTestId('feedback-panel');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hasAttribute('hidden'), true);
  assert.equal(toggle.getAttribute('aria-controls'), panel.id);
  assert.equal(panel.getAttribute('role'), 'region');
  assert.match(toggle.className, /min-h-11/);
  assert.match(toggle.textContent!, /Sprawdź feedback/);
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hasAttribute('hidden'), false);
  assert.ok(panel.textContent!.includes('Dodaj przedimek'));
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hasAttribute('hidden'), true);
});

test('akordeon: ikona stanu bez migania (animate-ping/pulse usunięte), obrót strzałki wyłączany przy reduced-motion', () => {
  const src = strip(read('components/practice/SentenceFeedback.tsx'));
  assert.doesNotMatch(src, /animate-ping|animate-pulse/);
  assert.match(src, /transition-transform motion-reduce:transition-none/);
  assert.match(src, /animate-spin motion-reduce:animate-none/);
});

// --- Podświetlenia od modelu: biała lista ---------------------------------------------------

test('podświetlenie: tylko span/b/strong/em z klasami z białej listy; skrypty, obrazki i atrybuty stają się tekstem', () => {
  assert.equal(sanitizeHighlightHtml("I <span class='text-red-500 font-bold'>booked</span> a flight"), 'I <span class="text-danger underline decoration-2 font-bold">booked</span> a flight');
  const evil = '<img src=x onerror=alert(1)><script>alert(1)</script><span onclick="x()">a</span><a href="javascript:x">b</a><span class="text-red-500" style="x">c</span>';
  const out = sanitizeHighlightHtml(evil);
  assert.doesNotMatch(out, /<(?!\/?(?:span|b|strong|em)\b)/i, out);
  assert.doesNotMatch(out, /<[^>]*(onerror|onclick|style=|href)/i, 'atrybuty zdarzeń i linki nie trafiają do znaczników');
  assert.match(out, /&lt;img/);
  assert.match(out, /&lt;script&gt;/);
  assert.equal(sanitizeHighlightHtml('</span>sam koniec'), '&lt;/span&gt;sam koniec', 'niesparowany znacznik zamykający = tekst');
  assert.equal(sanitizeHighlightHtml('<span class="font-bold">niezamknięty'), '<span class="font-bold">niezamknięty</span>', 'niezamknięte domykane');
  assert.equal(sanitizeHighlightHtml('Tom &amp; Jerry <3'), 'Tom &amp; Jerry &lt;3');
  assert.equal(sanitizeHighlightHtml(null), '');
  assert.equal(sanitizeHighlightHtml(42), '');
  assert.equal(sanitizeHighlightHtml('<b class="evil-class">x</b>'), '<b>x</b>', 'obca klasa odrzucona');
});

test('panel i lista renderują podświetlenie przez filtr — wstrzyknięty znacznik nie trafia do DOM', () => {
  const r = result({ highlighted_better_version: "I <img src=x onerror=alert(1)> <span class='text-red-500'>booked</span>" });
  const { getByTestId } = render(<SentenceFeedbackPanel result={r} onPlay={() => {}} />);
  const model = getByTestId('answer-model');
  assert.equal(model.querySelector('img'), null);
  assert.ok(model.querySelector('span.text-danger'), 'klasa modelu zmapowana na token');
});

// --- Kontrast AA w obu motywach -------------------------------------------------------------

const themes: ThemeName[] = ['dark', 'light'];
for (const theme of themes) {
  const surface = themeColor(theme, '--color-surface-flat');
  const ratio = (fg: string, bg = surface) => contrastRatio(themeColor(theme, fg), bg);

  for (const tone of ['success', 'warn', 'danger'] as const) {
    test(`plakietka tonu ${tone} — motyw ${theme}: tekst ≥ 4,5:1, ikona i obwódka ≥ 3:1`, () => {
      const { color } = TONE_TOKENS[tone];
      const tint = composite(themeColor(theme, color), surface, 0.1);
      assert.ok(contrastRatio(themeColor(theme, '--color-text-hi'), tint) >= AA_TEXT, `tekst ${contrastRatio(themeColor(theme, '--color-text-hi'), tint).toFixed(2)}`);
      assert.ok(contrastRatio(themeColor(theme, color), tint) >= AA_NON_TEXT, `ikona ${contrastRatio(themeColor(theme, color), tint).toFixed(2)}`);
      assert.ok(contrastRatio(themeColor(theme, color), surface) >= AA_NON_TEXT, `obwódka ${contrastRatio(themeColor(theme, color), surface).toFixed(2)}`);
    });
  }

  test(`akapity feedbacku — motyw ${theme}: podpis text-hi i tekst text-2 ≥ 4,5:1, lewe kreski (danger/info/warn) ≥ 3:1`, () => {
    assert.ok(ratio('--color-text-hi') >= AA_TEXT);
    assert.ok(ratio('--color-text-2') >= AA_TEXT, `text-2 ${ratio('--color-text-2').toFixed(2)}`);
    for (const c of ['--color-danger', '--color-info', '--color-warn']) assert.ok(ratio(c) >= AA_NON_TEXT, `${c} ${ratio(c).toFixed(2)}`);
  });
}

test('mapowanie tonów używa wyłącznie tokenów semantycznych (primary / warn / danger) i ma opisy dla czytników', () => {
  assert.deepEqual(Object.keys(TONE_CLASSES).sort(), ['danger', 'success', 'warn']);
  for (const [tone, c] of Object.entries(TONE_CLASSES)) {
    for (const cls of Object.values(c)) assert.doesNotMatch(cls, /green|red|amber|emerald|text-white|black/, `${tone}: ${cls}`);
  }
  assert.equal(new Set(Object.values(TONE_LABEL_KEYS)).size, 3);
  const pl = JSON.parse(read('pl.json')) as Record<string, string>;
  const en = JSON.parse(read('en.json')) as Record<string, string>;
  for (const key of Object.values(TONE_LABEL_KEYS)) {
    assert.ok(key in pl && key in en && en[key].trim(), key);
  }
});

// --- Wpięcie w generator --------------------------------------------------------------------

test('generator używa wspólnych komponentów oceny i nie ma już „kafli", ani surowego HTML z modelu', () => {
  const src = strip(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  for (const name of ['SentenceFeedbackPanel', 'SentenceResultCard']) assert.ok(src.includes(`<${name}`), name);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/, 'HTML z modelu tylko przez HighlightedText (biała lista)');
  assert.doesNotMatch(src, /breakdown\?\.meaning_score|breakdown\.meaning_score/, 'plakietki składowych tylko w komponencie');
  assert.doesNotMatch(src, /Sprawdź Feedback|animate-ping absolute inline-flex h-full w-full rounded-full bg-warn/);
});

test('punktacja i logika oceny nietknięte: wynik poprawnej korekty 40/40/20 jak dotąd', () => {
  const src = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.match(src, /const handleEvaluateSingle = async \(\) => \{/);
  assert.match(src, /meaning_score: 40,\s*grammar_score: 40,\s*vocabulary_score: 20/);
});

test('teksty komponentów oceny mają wpis w pl.json i en.json', () => {
  const pl = JSON.parse(read('pl.json')) as Record<string, string>;
  const en = JSON.parse(read('en.json')) as Record<string, string>;
  const keys = new Set<string>();
  for (const m of read('components/practice/SentenceFeedback.tsx').matchAll(/\bt\('([^']+)'\)/g)) keys.add(m[1]);
  assert.ok(keys.size >= 14, `klucze: ${keys.size}`);
  for (const key of keys) {
    assert.ok(key in pl, `pl: ${key}`);
    assert.ok(key in en && en[key].trim() !== '', `en: ${key}`);
  }
});

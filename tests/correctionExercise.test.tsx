import './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React, { useState } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import { SentenceAnswerInput, SentencePromptCard } from '../components/practice/SentencePracticeParts';
import { sentenceToCopy } from '../utils/sentenceSession';
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio } from '../utils/contrast';
import { THEMES, themeColor, type ThemeName } from './helpers/themeColors';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});
afterEach(cleanup);

/** Mały rodzic jak w generatorze: odpowiedzi po indeksie, „Kopiuj” wkleja zdanie BIEŻĄCEGO zadania. */
const exercises = [
  { erroneousSentence: "She don't eat meat.", polishSentence: 'Ona nie je mięsa.' },
  { erroneousSentence: 'He go to work by bus.', polishSentence: 'On jeździ do pracy autobusem.' },
];
const Host: React.FC = () => {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const ex = exercises[idx];
  return (
    <div>
      <SentencePromptCard
        variant="correction"
        index={idx}
        sentence={ex.erroneousSentence}
        context={ex.polishSentence}
        hintOpen={false}
        onToggleHint={() => {}}
        onCopy={sentenceToCopy(ex) ? () => setAnswers((a) => ({ ...a, [idx]: sentenceToCopy(ex) })) : undefined}
      />
      <SentenceAnswerInput tone="cool" label="Twoja poprawiona wersja" value={answers[idx] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [idx]: e.target.value }))} />
      <button data-testid="next" onClick={() => setIdx(1)}>next</button>
    </div>
  );
};

test('„Kopiuj zdanie do edycji”: duży przycisk z ikoną i tekstem WEWNĄTRZ karty, pod zdaniem', () => {
  const { getByTestId } = render(<Host />);
  const card = getByTestId('sentence-prompt');
  const button = getByTestId('copy-sentence');
  assert.ok(card.contains(button), 'przycisk jest w karcie ze zdaniem z błędem');
  assert.match(button.textContent!, /Kopiuj zdanie do edycji/);
  assert.ok(button.querySelector('svg'), 'ikona');
  assert.match(button.className, /min-h-12/);
  const sentence = card.querySelector('p')!;
  assert.ok(sentence.compareDocumentPosition(button) & 4 /* FOLLOWING */, 'przycisk jest PO zdaniu');
  assert.equal(button.tagName, 'BUTTON');
});

test('kliknięcie wkleja zdanie bieżącego zadania do pola; po przejściu dalej — zdanie tego (drugiego) zadania', () => {
  const { getByTestId } = render(<Host />);
  const field = () => getByTestId('sentence-answer') as HTMLTextAreaElement;
  fireEvent.click(getByTestId('copy-sentence'));
  assert.equal(field().value, "She don't eat meat.");
  fireEvent.click(getByTestId('next'));
  assert.equal(field().value, '', 'nowe zadanie nie dziedziczy odpowiedzi (H1)');
  fireEvent.click(getByTestId('copy-sentence'));
  assert.equal(field().value, 'He go to work by bus.');
});

test('bez zdania z błędem lub bez onCopy przycisku nie ma; wariant tłumaczenia nigdy go nie ma', () => {
  const none = render(<SentencePromptCard variant="correction" index={0} sentence="x" hintOpen={false} onToggleHint={() => {}} />);
  assert.equal(none.queryByTestId('copy-sentence'), null);
  cleanup();
  const tr = render(<SentencePromptCard variant="translation" index={0} sentence="x" hintOpen={false} onToggleHint={() => {}} onCopy={() => {}} />);
  assert.equal(tr.queryByTestId('copy-sentence'), null);
  assert.equal(sentenceToCopy(undefined), '');
  assert.equal(sentenceToCopy({ erroneousSentence: '  A b.  ' }), 'A b.');
});

test('hierarchia: etykieta → zdanie z błędem → przycisk → znaczenie; pole w tonie miętowym, karta w ciepłym', () => {
  const { getByTestId } = render(<Host />);
  const card = getByTestId('sentence-prompt');
  assert.match(card.className, /bg-card-warm/);
  assert.match(card.className, /border-card-warm-line/);
  assert.match(getByTestId('sentence-answer').className, /bg-card-cool/);
  assert.match(getByTestId('sentence-answer').className, /border-card-cool-line/);
  const text = card.textContent!;
  assert.ok(text.indexOf('Znajdź i popraw') < text.indexOf("She don't eat meat.") && text.indexOf("She don't eat meat.") < text.indexOf('Kopiuj zdanie') && text.indexOf('Kopiuj zdanie') < text.indexOf('Kontekst i znaczenie'));
});

test('generator: Kopiuj wkleja sentenceToCopy(bieżące zadanie), fokus tylko poza dotykiem, stary przycisk usunięty', () => {
  const src = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.match(src, /onCopy=\{sentenceToCopy\(exercises\[activeSentenceIndex\]\) \? \(\) => copyErroneousSentence\(activeSentenceIndex\) : undefined\}/);
  const fn = src.slice(src.indexOf('const copyErroneousSentence'), src.indexOf('const calcAvg'));
  assert.match(fn, /handleAnswerChange\(idx, text\)/);
  assert.match(fn, /if \(isCoarsePointer\(\)\) return;/, 'na dotyku bez wymuszania klawiatury');
  assert.ok(!src.includes("t('Kopiuj zdanie do edycji')"), 'przycisk żyje w karcie, nie w generatorze');
  // H1 (stan po id) i H2 (Enter) zostają
  assert.match(src, /stampExercises/);
  assert.match(src, /enterKeyAction/);
});

// --- kontrast pastelowych powierzchni -------------------------------------------------------

test('kontrast: text-hi/text-3 na kartach ciepłej i miętowej, obrys ≥ 3:1 — oba motywy (tabela w stdout)', () => {
  const rows = ['motyw | powierzchnia | text-hi | text-3 (placeholder) | obrys vs strona | obrys vs powierzchnia'];
  for (const theme of ['dark', 'light'] as ThemeName[]) {
    const page = themeColor(theme, '--color-bg');
    for (const [name, bgToken, lineToken] of [
      ['karta ciepła', '--color-card-warm', '--color-card-warm-line'],
      ['pole miętowe', '--color-card-cool', '--color-card-cool-line'],
    ]) {
      const bg = themeColor(theme, bgToken);
      const line = themeColor(theme, lineToken);
      const hi = contrastRatio(composite(themeColor(theme, '--color-text-hi'), bg), bg);
      const t3 = contrastRatio(composite(themeColor(theme, '--color-text-3'), bg), bg);
      const vsPage = contrastRatio(line, page);
      const vsBg = contrastRatio(line, bg);
      rows.push(`${theme} | ${name} | ${hi.toFixed(2)} | ${t3.toFixed(2)} | ${vsPage.toFixed(2)} | ${vsBg.toFixed(2)}`);
      assert.ok(hi >= AA_TEXT, `${theme} ${name}: text-hi ${hi.toFixed(2)}`);
      assert.ok(t3 >= AA_TEXT, `${theme} ${name}: placeholder ${t3.toFixed(2)}`);
      assert.ok(vsPage >= AA_NON_TEXT || vsBg >= AA_NON_TEXT, `${theme} ${name}: obrys ${vsPage.toFixed(2)}/${vsBg.toFixed(2)}`);
    }
  }
  assert.notEqual(THEMES.dark['--color-card-warm'], THEMES.light['--color-card-warm']);
  console.log(rows.join('\n'));
});

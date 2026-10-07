import { test } from 'node:test';
import assert from 'node:assert/strict';
// Import poboczny — inicjalizuje singleton i18next, z którego korzysta
// `normalizeExercise.ts`.
import '../i18n';
import { buildWarmupRounds } from '../utils/warmupRounds';
import { checkWarmupExerciseItem } from '../utils/exerciseSentenceChecks';

/**
 * Rozgrzewka: polecenie to ZAWSZE polskie zdanie, kafelki to angielskie
 * słowa/fragmenty poprawnej wersji. Element bez polskiego odpowiednika jest
 * pomijany — nigdy nie pokazujemy angielskiego zdania (w tym z błędem) jako
 * polecenia.
 */

const HEADING = 'Ułóż zdanie';
const INSTRUCTION = 'Ułóż zdanie po angielsku z kafelków.';

test('stary find_errors: polskie polecenie, poprawne zdanie jako cel, zdanie z błędem nigdzie nie jest poleceniem', () => {
  const rounds = buildWarmupRounds([
    {
      incorrectSentence: 'I would to have a spacious living room in my ideal home.',
      correctSentence: 'I would like to have a spacious living room in my ideal home.',
      polishHint: 'Chciałbym mieć przestronny salon w moim wymarzonym domu.',
    },
  ]);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].heading, HEADING);
  assert.equal(rounds[0].instruction, INSTRUCTION);
  assert.equal(rounds[0].sourceLabel, 'Chciałbym mieć przestronny salon w moim wymarzonym domu.');
  assert.equal(rounds[0].targetSentence, 'I would like to have a spacious living room in my ideal home.');
  assert.notEqual(rounds[0].sourceLabel, 'I would to have a spacious living room in my ideal home.');
  assert.ok(!/popraw|znajdź błąd/i.test(`${rounds[0].heading} ${rounds[0].instruction}`));
});

test('stary find_errors bez polskiego znaczenia jest pomijany', () => {
  const rounds = buildWarmupRounds([
    {
      incorrectSentence: 'I have meet the deadline yesterday.',
      correctSentence: 'I met the deadline yesterday.',
    },
  ]);
  assert.equal(rounds.length, 0);
});

test('stare tłumaczenie: polskie zdanie jako polecenie, angielskie jako cel', () => {
  const rounds = buildWarmupRounds(
    [{ polishSentence: 'Muszę dotrzymać terminu.', englishTranslation: 'I have to meet the deadline.' }],
    { type: 'translation' }
  );
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].sourceLabel, 'Muszę dotrzymać terminu.');
  assert.equal(rounds[0].targetSentence, 'I have to meet the deadline.');
  assert.equal(rounds[0].heading, HEADING);
});

test('stare tłumaczenie bez angielskiej wersji jest pomijane', () => {
  const rounds = buildWarmupRounds([{ polishSentence: 'Muszę dotrzymać terminu.' }], { type: 'translation' });
  assert.equal(rounds.length, 0);
});

test('stary word_order z polishHint działa, bez polishHint jest pomijany', () => {
  const withHint = buildWarmupRounds([
    { chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'], correctSentence: 'I have to meet the deadline', polishHint: 'Muszę dotrzymać terminu.' },
  ]);
  assert.equal(withHint.length, 1);
  assert.equal(withHint[0].sourceLabel, 'Muszę dotrzymać terminu.');
  assert.equal(withHint[0].heading, HEADING);

  const withoutHint = buildWarmupRounds([
    { chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'], correctSentence: 'I have to meet the deadline' },
  ]);
  assert.equal(withoutHint.length, 0);
});

test('wstrzyknięta instrukcja AI w polu polishHint nie jest poleceniem — runda pominięta', () => {
  const rounds = buildWarmupRounds([
    {
      chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'],
      correctSentence: 'I have to meet the deadline',
      polishHint: 'Popraw zdanie. Zwróć uwagę na czas.',
    },
  ]);
  assert.equal(rounds.length, 0);
});

test('fill_in_the_blank i element bez derywowalnego zdania nie tworzą rundy', () => {
  assert.equal(buildWarmupRounds([{ textWithBlanks: 'She [BLANK_1] to school.', availableWords: ['goes'] }]).length, 0);
});

test('zdanie za krótkie nie trafia do rozgrzewki', () => {
  const rounds = buildWarmupRounds([{ chunks: ['Hi', 'there'], correctSentence: 'Hi there', polishHint: 'Cześć.' }]);
  assert.equal(rounds.length, 0);
});

test('maksymalnie 3 rundy starej rozgrzewki', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({
    chunks: ['I', 'like', 'sentence', String(i)],
    correctSentence: `I like sentence ${i}`,
    polishHint: `Lubię zdanie ${i}.`,
  }));
  assert.equal(buildWarmupRounds(items).length, 3);
});

test('warmup niepusty z polskim tłumaczeniem: polecenie polskie, kafelki angielskie', () => {
  const rounds = buildWarmupRounds([], {
    warmup: [
      {
        chunks: ['I have to', 'meet the deadline', 'by tomorrow'],
        correctSentence: 'I have to meet the deadline by tomorrow',
        polishTranslation: 'Muszę dotrzymać terminu do jutra.',
      },
    ],
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].type, 'warmup_chunk');
  assert.equal(rounds[0].heading, HEADING);
  assert.equal(rounds[0].instruction, INSTRUCTION);
  assert.equal(rounds[0].sourceLabel, 'Muszę dotrzymać terminu do jutra.');
  assert.notEqual(rounds[0].sourceLabel, rounds[0].targetSentence);
  assert.deepEqual(rounds[0].chunks, ['I have to', 'meet the deadline', 'by tomorrow']);
});

test('warmup bez polskiego tłumaczenia: runda pominięta, indeksy pozostałych zachowane', () => {
  const rounds = buildWarmupRounds([], {
    warmup: [
      { chunks: ['A b', 'c d', 'e f'], correctSentence: 'A b c d e f', polishHint: 'stare pole' },
      { chunks: ['A b', 'c d', 'e f'], correctSentence: 'A b c d e f', polishTranslation: 'Pełne tłumaczenie.' },
    ],
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].itemIndex, 1);
});

test('task.warmup === [] daje brak rozgrzewki', () => {
  const rounds = buildWarmupRounds(
    [{ chunks: ['I', 'like', 'sentence'], correctSentence: 'I like sentence', polishHint: 'Lubię zdanie.' }],
    { warmup: [] }
  );
  assert.equal(rounds.length, 0);
});

test('task.warmup === undefined wraca do starej rozgrzewki ze sentences', () => {
  const rounds = buildWarmupRounds(
    [{ chunks: ['I', 'like', 'sentence'], correctSentence: 'I like sentence', polishHint: 'Lubię zdanie.' }],
    { warmup: undefined, type: 'word_order' }
  );
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].targetSentence, 'I like sentence');
});

test('walidacja generatora: element bez polskiego tłumaczenia jest odrzucany', () => {
  const base = { chunks: ['I have to', 'meet the deadline', 'by tomorrow'], correctSentence: 'I have to meet the deadline by tomorrow' };
  const missing = checkWarmupExerciseItem(base);
  assert.equal(missing.ok, false);
  const ok = checkWarmupExerciseItem({ ...base, polishTranslation: 'Muszę dotrzymać terminu do jutra.' });
  assert.equal(ok.ok, true);
  const oldField = checkWarmupExerciseItem({ ...base, polishHint: 'Termin.' });
  assert.equal(oldField.ok, false);
});

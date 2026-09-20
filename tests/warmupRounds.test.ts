import { test } from 'node:test';
import assert from 'node:assert/strict';
// Import poboczny — inicjalizuje singleton i18next (en.json/pl.json), z
// którego korzysta `exerciseUiCopy` w `normalizeExercise.ts`. Bez tego
// `i18n.t(...)` zwraca `undefined` zamiast klucza, bo nic nie wywołało
// `i18n.init()` w tym procesie testowym.
import '../i18n';
import { buildWarmupRounds } from '../utils/warmupRounds';

/**
 * Regresja hotfixu P0 (2026-09-20): rozgrzewka miała własny, zduplikowany
 * łańcuch normalizacji i ZAWSZE pokazywała nagłówek rozsypanki, nawet gdy
 * źródłowe zadanie było tłumaczeniem albo poprawą błędu. Te testy dowodzą,
 * że `buildWarmupRounds` deleguje do `normalizeExercise` (ten sam adapter
 * co `HomeworkExercise.tsx`) i że nagłówek/instrukcja odpowiadają
 * rzeczywistemu typowi zadania — także dla historycznych aliasów pól.
 */

test('buildWarmupRounds: word_order (rozsypanka) dostaje nagłówek "Ułóż zdanie"', () => {
  const rounds = buildWarmupRounds([
    { chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'], correctSentence: 'I have to meet the deadline' },
  ]);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].type, 'word_order');
  assert.equal(rounds[0].heading, 'Ułóż zdanie');
  assert.equal(rounds[0].targetSentence, 'I have to meet the deadline');
});

test('buildWarmupRounds: tłumaczenie (alias englishTranslation) dostaje nagłówek "Przetłumacz zdanie", nie rozsypanki', () => {
  const rounds = buildWarmupRounds(
    [
      {
        polishSentence: 'Muszę dotrzymać terminu.',
        englishTranslation: 'I have to meet the deadline.',
      },
    ],
    { type: 'translation' }
  );
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].type, 'translation');
  assert.equal(rounds[0].heading, 'Przetłumacz zdanie');
  assert.notEqual(rounds[0].heading, 'Ułóż zdanie');
  assert.equal(rounds[0].sourceLabel, 'Muszę dotrzymać terminu.');
  assert.equal(rounds[0].targetSentence, 'I have to meet the deadline.');
});

test('buildWarmupRounds: tłumaczenie z historycznym aliasem correctTranslation działa tak samo', () => {
  const rounds = buildWarmupRounds(
    [{ polishSentence: 'Muszę dotrzymać terminu.', correctTranslation: 'I have to meet the deadline.' }],
    { type: 'translation' }
  );
  assert.equal(rounds[0].heading, 'Przetłumacz zdanie');
  assert.equal(rounds[0].targetSentence, 'I have to meet the deadline.');
});

test('buildWarmupRounds: poprawa błędu (find_errors) dostaje nagłówek "Popraw zdanie" i pokazuje zdanie z błędem, nie wzorcowe', () => {
  const rounds = buildWarmupRounds([
    {
      incorrectSentence: 'I have meet the deadline yesterday.',
      correctSentence: 'I met the deadline yesterday.',
    },
  ]);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].type, 'find_errors');
  assert.equal(rounds[0].heading, 'Popraw zdanie');
  assert.equal(rounds[0].sourceLabel, 'I have meet the deadline yesterday.');
  assert.equal(rounds[0].targetSentence, 'I met the deadline yesterday.');
});

test('buildWarmupRounds: wstrzyknięta instrukcja AI w polu źródłowym nie staje się nagłówkiem rozsypanki', () => {
  const rounds = buildWarmupRounds([
    {
      chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'],
      correctSentence: 'I have to meet the deadline',
      polishHint: 'Popraw zdanie. Zwróć uwagę na czas.',
    },
  ]);
  assert.equal(rounds[0].sourceLabel, undefined);
  assert.equal(rounds[0].heading, 'Ułóż zdanie');
});

test('buildWarmupRounds: zdanie za krótkie lub za długie nie trafia do rozgrzewki', () => {
  const tooShort = buildWarmupRounds([{ chunks: ['Hi', 'there'], correctSentence: 'Hi there' }]);
  assert.equal(tooShort.length, 0);
});

test('buildWarmupRounds: maksymalnie 3 rundy, niezależnie od liczby zadań', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({
    chunks: ['I', 'like', 'sentence', String(i)],
    correctSentence: `I like sentence ${i}`,
  }));
  const rounds = buildWarmupRounds(items);
  assert.equal(rounds.length, 3);
});

test('buildWarmupRounds: brak derywowalnego zdania wzorcowego pomija element zamiast zgadywać', () => {
  const rounds = buildWarmupRounds([{ textWithBlanks: 'She [BLANK_1] to school.', availableWords: ['goes'] }]);
  assert.equal(rounds.length, 0);
});

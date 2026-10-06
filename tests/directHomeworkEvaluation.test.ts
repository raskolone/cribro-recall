import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateDirectHomework, stripUndefinedDeep } from '../utils/directHomeworkEvaluation';

/** Głębokie sprawdzenie: żadnego `undefined` w żadnym obiekcie ani tablicy. */
const assertNoUndefined = (value: unknown, path = 'root'): void => {
  assert.notEqual(value, undefined, `undefined w ${path}`);
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertNoUndefined(v, `${path}.${k}`);
  }
};

const matchingItem = {
  type: 'matching',
  pairs: [
    { id: 'pair-0', left: 'save time', right: 'oszczędzać czas' },
    { id: 'pair-1', left: 'spend time', right: 'spędzać czas' },
  ],
};

test('dopasowanie bez explanation: wiersz bez klucza explanation i bez undefined', () => {
  const { rows, storedAnswers, averageScore } = evaluateDirectHomework([matchingItem], { 0: ['pair-0'] });
  assert.equal(rows.length, 1);
  assert.equal('explanation' in rows[0], false);
  assert.equal(rows[0].score, 50);
  assert.equal(rows[0].studentAnswer, 'save time = oszczędzać czas');
  assert.equal(rows[0].correctTranslation, 'save time = oszczędzać czas, spend time = spędzać czas');
  assert.equal(averageScore, 50);
  assertNoUndefined(rows);
  assertNoUndefined(storedAnswers);
});

test('dopasowanie: komplet par = 100% i isCorrect', () => {
  const { rows } = evaluateDirectHomework([matchingItem], { 0: ['pair-0', 'pair-1'] });
  assert.equal(rows[0].score, 100);
  assert.equal(rows[0].isCorrect, true);
});

test('element z explanation zachowuje je', () => {
  const item = { type: 'find_errors', incorrectSentence: 'She don\'t eat.', correctSentence: 'She doesn\'t eat.', explanation: 'doesn\'t po she' };
  const { rows } = evaluateDirectHomework([item], { 0: 'She doesn\'t eat.' });
  assert.equal(rows[0].explanation, 'doesn\'t po she');
  assert.equal(rows[0].score, 100);
});

test('tłumaczenie bez explanation i bez odpowiedzi na część zadań nie daje undefined', () => {
  const items = [
    { type: 'translation', polishSentence: 'Oszczędzam czas.', englishTranslation: 'I save time.' },
    { type: 'translation', polishSentence: 'Spędzam czas.', englishTranslation: 'I spend time.' },
  ];
  // Kursant odpowiedział tylko na pierwsze: answers[1] === undefined.
  const { rows, storedAnswers } = evaluateDirectHomework(items, { 0: 'I save time.' });
  assert.equal(rows[1].score, 0);
  assert.equal('studentAnswer' in rows[1], false);
  assert.equal(1 in storedAnswers, false);
  assertNoUndefined(rows);
  assertNoUndefined(storedAnswers);
});

test('typy, które już działały, liczą się jak dotąd', () => {
  const items = [
    { type: 'word_order', chunks: ['I', 'save', 'time'], correctSentence: 'I save time.' },
    { type: 'translation', polishSentence: 'x', englishTranslation: 'I save time.' },
  ];
  const { rows, averageScore } = evaluateDirectHomework(items, { 0: [0, 1, 2], 1: 'I save time' });
  assert.equal(rows[0].score, 100);
  assert.equal(rows[1].score, 100);
  assert.equal(averageScore, 100);
});

test('stripUndefinedDeep: pomija klucze, tablice zachowują indeksy, daty bez zmian', () => {
  const d = new Date(0);
  const out = stripUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined, { f: undefined, g: 2 }] }, when: d });
  assert.deepEqual(out, { a: 1, c: { e: [1, null, { g: 2 }] }, when: d });
  assert.equal(out.when, d);
});

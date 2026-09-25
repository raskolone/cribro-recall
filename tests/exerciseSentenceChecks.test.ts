import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUsedSentencesBlock,
  filterRepeatedSentences,
  normalizeSentence,
} from '../utils/exerciseSentenceChecks';

test('normalizeSentence: interpunkcja, wielkość liter i apostrofy nie odróżniają zdań', () => {
  assert.equal(normalizeSentence('I don’t   like Mondays!'), normalizeSentence("i don't like mondays"));
  assert.equal(normalizeSentence('  Hello, world.  '), 'hello world');
});

test('normalizeSentence: apostrof zostaje — "dont" to inne słowo niż "don\'t"', () => {
  assert.notEqual(normalizeSentence('I dont know.'), normalizeSentence("I don't know."));
});

test('filterRepeatedSentences: odsiewa zdania z sesji i powtórki wewnątrz partii', () => {
  const items = [
    { en: 'I missed the bus this morning.', pl: 'Uciekł mi dziś autobus.' },
    { en: 'Can you send me the invoice?', pl: 'Możesz mi wysłać fakturę?' },
    { en: 'can you send me the invoice', pl: 'Wyślesz mi fakturę?' },
    { en: 'We moved the meeting to Friday.', pl: 'Przenieśliśmy spotkanie na piątek.' },
  ];

  const fresh = filterRepeatedSentences(items, ['I missed the bus this morning!'], (i) => [i.en, i.pl]);

  assert.deepEqual(
    fresh.map((i) => i.en),
    ['Can you send me the invoice?', 'We moved the meeting to Friday.']
  );
});

test('filterRepeatedSentences: pusta historia przepuszcza wszystko poza duplikatami', () => {
  const fresh = filterRepeatedSentences(['A b.', 'a b', 'C d.'], [], (s) => [s]);
  assert.deepEqual(fresh, ['A b.', 'C d.']);
});

test('buildUsedSentencesBlock: pusty bez historii, z historią wymienia ostatnie zdania', () => {
  assert.equal(buildUsedSentencesBlock(undefined), '');
  assert.equal(buildUsedSentencesBlock([]), '');

  const block = buildUsedSentencesBlock(['One.', 'Two.', 'Three.'], 2);
  assert.ok(!block.includes('One.'));
  assert.ok(block.includes('- Two.'));
  assert.ok(block.includes('- Three.'));
});

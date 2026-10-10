import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWordPairs } from '../utils/customSetParser';

test('parseWordPairs: poprawnie parsuje standardowe linie z myślnikiem', () => {
  const input = `apple - jabłko\nbanana - banan\ncherry - wiśnia`;
  const { valid, invalidLines } = parseWordPairs(input);

  assert.equal(valid.length, 3);
  assert.deepEqual(valid[0], { term: 'apple', definition: 'jabłko' });
  assert.deepEqual(valid[1], { term: 'banana', definition: 'banan' });
  assert.deepEqual(valid[2], { term: 'cherry', definition: 'wiśnia' });
  assert.equal(invalidLines.length, 0);
});

test('parseWordPairs: ignoruje wiodące numeratory i punktory (1., -, *, •)', () => {
  const input = `1. dog - pies\n2. cat - kot\n- car - samochód\n* book - książka\n• pen - długopis`;
  const { valid, invalidLines } = parseWordPairs(input);

  assert.equal(valid.length, 5);
  assert.deepEqual(valid[0], { term: 'dog', definition: 'pies' });
  assert.deepEqual(valid[1], { term: 'cat', definition: 'kot' });
  assert.deepEqual(valid[2], { term: 'car', definition: 'samochód' });
  assert.deepEqual(valid[3], { term: 'book', definition: 'książka' });
  assert.deepEqual(valid[4], { term: 'pen', definition: 'długopis' });
  assert.equal(invalidLines.length, 0);
});

test('parseWordPairs: obsługuje różne separatory (półpauza, pauza, dwukropek, równość, tabulator)', () => {
  const input = `word1 – definicja1\nword2 — definicja2\nword3 : definicja3\nword4 = definicja4\nword5\tdefinicja5`;
  const { valid, invalidLines } = parseWordPairs(input);

  assert.equal(valid.length, 5);
  assert.deepEqual(valid[0], { term: 'word1', definition: 'definicja1' });
  assert.deepEqual(valid[1], { term: 'word2', definition: 'definicja2' });
  assert.deepEqual(valid[2], { term: 'word3', definition: 'definicja3' });
  assert.deepEqual(valid[3], { term: 'word4', definition: 'definicja4' });
  assert.deepEqual(valid[4], { term: 'word5', definition: 'definicja5' });
  assert.equal(invalidLines.length, 0);
});

test('parseWordPairs: puste linie są ignorowane, niepoprawne linie trafiają do invalidLines', () => {
  const input = `\n  \nvalid - poprawny\n\nsamojedno\n  \n`;
  const { valid, invalidLines } = parseWordPairs(input);

  assert.equal(valid.length, 1);
  assert.deepEqual(valid[0], { term: 'valid', definition: 'poprawny' });
  assert.equal(invalidLines.length, 1);
  assert.equal(invalidLines[0], 'samojedno');
});

test('parseWordPairs: pusty tekst zwraca puste tablice bez błędów', () => {
  assert.deepEqual(parseWordPairs(''), { valid: [], invalidLines: [] });
  assert.deepEqual(parseWordPairs(null as any), { valid: [], invalidLines: [] });
  assert.deepEqual(parseWordPairs(undefined as any), { valid: [], invalidLines: [] });
});

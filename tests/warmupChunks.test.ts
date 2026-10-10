// Kawałki rozgrzewki: deterministyczny podział zdania, scalanie pojedynczych słów, dystraktory, stabilne tasowanie.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CHUNK_WORDS,
  MIN_CHUNK_WORDS,
  MIN_SENTENCE_WORDS,
  chunkSentence,
  countWords,
  hashString,
  isUsableChunking,
  joinsTo,
  mergeSmallChunks,
  pickDistractors,
  resolveChunks,
  seededRandom,
  stableShuffle,
} from '../utils/warmupChunks';

const SENTENCES = [
  'I have to meet the deadline by tomorrow morning.',
  'She usually walks to work with her sister.',
  'My sister likes green tea.',
  'Could you tell me where the nearest pharmacy is?',
  'We decided to stay at home because it was raining heavily.',
  'He has been working in this company for almost ten years now, and he still loves it.',
  'They booked a table for six people.',
  'I would like to have a spacious living room in my ideal home.',
];

test('podział zdania: 2–5 kawałków po 2–4 słowa, złożone dają dokładnie zdanie, nigdy pojedyncze słowa', () => {
  for (const sentence of SENTENCES) {
    const chunks = chunkSentence(sentence);
    assert.ok(chunks.length >= 2 && chunks.length <= 5, `${sentence}: ${chunks.length} kawałków`);
    assert.equal(chunks.join(' '), sentence);
    for (const chunk of chunks) {
      const words = countWords(chunk);
      assert.ok(words >= MIN_CHUNK_WORDS && words <= MAX_CHUNK_WORDS, `„${chunk}" ma ${words} słów`);
    }
    assert.ok(isUsableChunking(chunks, sentence));
  }
});

test('podział zdania jest deterministyczny i nie tnie po słowach funkcyjnych, gdy da się inaczej', () => {
  assert.deepEqual(chunkSentence(SENTENCES[0]), chunkSentence(SENTENCES[0]));
  for (const sentence of SENTENCES) {
    const chunks = chunkSentence(sentence);
    // żaden kawałek (poza ostatnim) nie kończy się przedimkiem ani przyimkiem „to"/„of"/„in"
    const weakEnd = chunks.slice(0, -1).filter((c) => /\b(a|an|the|to|of|in|at|for|with|and|but|my|her|his)$/i.test(c));
    assert.ok(weakEnd.length <= 1, `${sentence} → ${chunks.join(' | ')}`);
  }
  assert.equal(chunkSentence('I booked a flight for Friday.').join(' '), 'I booked a flight for Friday.');
});

test('za krótkie zdanie (< 4 słów) nie ma podziału', () => {
  assert.equal(MIN_SENTENCE_WORDS, 4);
  assert.deepEqual(chunkSentence('I like tea.'), []);
  assert.deepEqual(chunkSentence(''), []);
  assert.equal(chunkSentence('I like green tea').length, 2);
});

test('scalanie: pojedyncze słowo łączy się z następnym, ostatnie z poprzednim, samotna interpunkcja nie jest kafelkiem', () => {
  assert.deepEqual(mergeSmallChunks(['I', 'have to', 'meet the deadline']), ['I have to', 'meet the deadline']);
  assert.deepEqual(mergeSmallChunks(['I have to', 'meet the deadline', 'now']), ['I have to', 'meet the deadline now']);
  assert.deepEqual(mergeSmallChunks(['I have to', 'meet the deadline', '.']), ['I have to', 'meet the deadline .']);
  assert.deepEqual(mergeSmallChunks(['a', 'b', 'c']), ['a b c']);
  assert.deepEqual(mergeSmallChunks(['  ', 'good morning']), ['good morning']);
});

test('resolveChunks: dane z frazami zostają, lista słów i niespójne kawałki → podział zdania', () => {
  const sentence = 'I have to meet the deadline by tomorrow';
  assert.deepEqual(resolveChunks([['I have to', 'meet the deadline', 'by tomorrow']], sentence), ['I have to', 'meet the deadline', 'by tomorrow']);
  assert.deepEqual(resolveChunks([['I', 'have to', 'meet the deadline', 'by tomorrow']], sentence), ['I have to', 'meet the deadline', 'by tomorrow'], 'jedno luźne słowo scalone');
  const fromWords = resolveChunks([sentence.split(' ')], sentence);
  assert.deepEqual(fromWords, chunkSentence(sentence), 'lista słów nie jest scalana parami');
  assert.deepEqual(resolveChunks([['totally', 'different']], sentence), chunkSentence(sentence));
  assert.deepEqual(resolveChunks([undefined, null, []], sentence), chunkSentence(sentence));
  assert.deepEqual(resolveChunks([], 'Hi there'), []);
  assert.ok(joinsTo(['I have', 'to go'], 'I have  to go'));
});

test('dystraktory: cały kawałek z innych rund, bez dubli, najwyżej max, deterministycznie', () => {
  const own = ['I have to', 'meet the deadline'];
  const others = [{ chunks: ['I have to', 'by tomorrow'] }, { chunks: ['She usually', 'walks to work'] }];
  assert.deepEqual(pickDistractors(own, others), ['by tomorrow'], 'kawałek obecny w odpowiedzi pominięty');
  assert.deepEqual(pickDistractors(own, others, 2), ['by tomorrow', 'She usually']);
  assert.deepEqual(pickDistractors(own, others, 0), []);
  assert.deepEqual(pickDistractors(own, []), []);
  assert.deepEqual(pickDistractors(own, [{ chunks: ['tea'] }]), [], 'pojedynczego słowa nigdy');
  assert.deepEqual(pickDistractors(own, others), pickDistractors(own, others));
});

test('stabilne tasowanie: to samo ziarno = ta sama kolejność, inne ziarno = (zwykle) inna, nigdy rozwiązanie', () => {
  const items = ['a b', 'c d', 'e f', 'g h', 'i j'];
  const same = (order: readonly string[]) => order.every((x, i) => x === items[i]);
  const first = stableShuffle(items, 42, same);
  assert.deepEqual(stableShuffle(items, 42, same), first);
  assert.equal([...first].sort().join(), [...items].sort().join(), 'permutacja bez zgubionych kafelków');
  const orders = new Set(Array.from({ length: 30 }, (_, i) => stableShuffle(items, hashString(`runda|${i}`), same).join('|')));
  assert.ok(orders.size > 10, 'różne ziarna dają różne układy');
  for (let seed = 0; seed < 200; seed++) assert.equal(same(stableShuffle(items, seed, same)), false, `ziarno ${seed}`);
  assert.deepEqual(stableShuffle(['x y'], 1, () => true), ['x y']);
  assert.ok(seededRandom(1)() !== seededRandom(2)());
  assert.equal(hashString('abc'), hashString('abc'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWarmup, sanitizeWarmupItem } from '../utils/warmupSanitize';

const good = {
  chunks: ['I have to', 'meet the deadline', 'by tomorrow'],
  correctSentence: 'I have to meet the deadline by tomorrow',
  polishTranslation: 'Muszę dotrzymać terminu do jutra.',
};

test('sanitizeWarmup: poprawny element przechodzi w kształcie {chunks, correctSentence, polishTranslation}', () => {
  assert.deepEqual(sanitizeWarmup([good]), [good]);
});

test('sanitizeWarmup: odrzuca element z za małą lub za dużą liczbą fragmentów', () => {
  assert.equal(sanitizeWarmupItem({ ...good, chunks: ['I have to', 'meet the deadline'] }), null);
  assert.equal(sanitizeWarmupItem({ ...good, chunks: ['a', 'b', 'c', 'd', 'e', 'f'] }), null);
  assert.equal(sanitizeWarmup([{ ...good, chunks: ['a', 'b'] }]), undefined);
});

test('sanitizeWarmup: nie-tablica i brak pola dają undefined (stara rozgrzewka)', () => {
  assert.equal(sanitizeWarmup(undefined), undefined);
  assert.equal(sanitizeWarmup(null), undefined);
  assert.equal(sanitizeWarmup('x'), undefined);
  assert.equal(sanitizeWarmup({ 0: good }), undefined);
});

test('sanitizeWarmup: zbyt długi tekst odrzuca element', () => {
  assert.equal(sanitizeWarmupItem({ ...good, correctSentence: 'a '.repeat(200) }), null);
  assert.equal(sanitizeWarmupItem({ ...good, polishTranslation: 'x'.repeat(301) }), null);
  assert.equal(sanitizeWarmupItem({ ...good, chunks: ['I have to', 'x'.repeat(81), 'by tomorrow'] }), null);
});

test('sanitizeWarmup: brak polskiego tłumaczenia odrzuca element, a pozostałe zostają', () => {
  const { polishTranslation: _omit, ...noTranslation } = good;
  assert.equal(sanitizeWarmupItem(noTranslation), null);
  assert.equal(sanitizeWarmupItem({ ...good, polishTranslation: '   ' }), null);
  assert.deepEqual(sanitizeWarmup([noTranslation, good]), [good]);
});

test('sanitizeWarmup: [] zostaje [] (jawny brak rozgrzewki)', () => {
  assert.deepEqual(sanitizeWarmup([]), []);
});

test('sanitizeWarmup: najwyżej 5 elementów, wynik bez undefined, obce pola odcięte', () => {
  const many = Array.from({ length: 8 }, () => ({ ...good, extra: 'x', polishHint: undefined }));
  const out = sanitizeWarmup(many)!;
  assert.equal(out.length, 5);
  assert.deepEqual(Object.keys(out[0]).sort(), ['chunks', 'correctSentence', 'polishTranslation']);
});

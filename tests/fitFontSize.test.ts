import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFitFontSize, estimateLineCount, htmlToPlainText } from '../utils/fitFontSize';

const box = { width: 320, height: 180, maxSize: 40, minSize: 14.4 };

test('krótki tekst dostaje maksymalny rozmiar', () => {
  assert.deepEqual(computeFitFontSize({ text: 'take off', ...box }), { size: 40, overflow: false });
});

test('dłuższy tekst dostaje mniejszą czcionkę, ale nie poniżej minimum', () => {
  const mid = computeFitFontSize({ text: 'to be on the verge of doing something important and difficult', ...box });
  assert.ok(mid.size < 40 && mid.size > 14.4 && !mid.overflow, JSON.stringify(mid));
});

test('rozmiar nie rośnie ze wzrostem długości tekstu', () => {
  let prev = Infinity;
  for (let n = 1; n <= 400; n += 7) {
    const { size } = computeFitFontSize({ text: Array.from({ length: n }, () => 'word').join(' '), ...box });
    assert.ok(size <= prev, `n=${n}: ${size} > ${prev}`);
    prev = size;
  }
});

test('dopasowany tekst mieści się w polu według tego samego oszacowania', () => {
  const text = 'she has been working there since the beginning of last year';
  const { size, overflow } = computeFitFontSize({ text, ...box });
  assert.equal(overflow, false);
  const lines = estimateLineCount(text, box.width / (size * 0.6));
  assert.ok(lines * size * 1.2 <= box.height);
});

test('tekst za długi nawet na minimum → minimum i overflow (przewijanie)', () => {
  const text = Array.from({ length: 600 }, () => 'lorem').join(' ');
  assert.deepEqual(computeFitFontSize({ text, ...box }), { size: 14.4, overflow: true });
});

test('jedno bardzo długie słowo łamie się i zmniejsza czcionkę', () => {
  const { size } = computeFitFontSize({ text: 'incomprehensibilities'.repeat(3), ...box });
  assert.ok(size < 40);
});

test('brak wymiarów lub pusty tekst → maksimum bez overflow', () => {
  assert.deepEqual(computeFitFontSize({ text: 'abc', ...box, width: 0 }), { size: 40, overflow: false });
  assert.deepEqual(computeFitFontSize({ text: '   ', ...box }), { size: 40, overflow: false });
});

test('węższe pole daje nie większą czcionkę niż szersze', () => {
  const text = 'a fairly long definition that needs several lines to be shown';
  const wide = computeFitFontSize({ text, ...box, width: 400 }).size;
  const narrow = computeFitFontSize({ text, ...box, width: 200 }).size;
  assert.ok(narrow <= wide);
});

test('estimateLineCount: zawijanie na słowach i akapity', () => {
  assert.equal(estimateLineCount('aaa bbb ccc', 7), 2);
  assert.equal(estimateLineCount('aaa\nbbb', 20), 2);
  assert.equal(estimateLineCount('abcdefghij', 4), 3);
});

test('htmlToPlainText zdejmuje znaczniki', () => {
  assert.equal(htmlToPlainText('<b>take</b> off<br>now &amp; then'), 'take off\nnow & then');
});

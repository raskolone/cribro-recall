import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUnscrambleAttempt } from '../utils/unscrambleGrading';

test('classifyUnscrambleAttempt: dokładna kolejność -> correct', () => {
  const target = ['I', 'have', 'to', 'meet', 'the', 'deadline'];
  assert.equal(classifyUnscrambleAttempt([...target], target), 'correct');
});

test('classifyUnscrambleAttempt: te same słowa w złej kolejności -> close', () => {
  const target = ['I', 'have', 'to', 'meet', 'the', 'deadline'];
  const answer = ['I', 'have', 'to', 'the', 'deadline', 'meet'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'close');
});

test('classifyUnscrambleAttempt: brakujące słowo -> incorrect', () => {
  const target = ['I', 'have', 'to', 'meet', 'the', 'deadline'];
  const answer = ['I', 'have', 'to', 'meet', 'deadline'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'incorrect');
});

test('classifyUnscrambleAttempt: dodatkowe słowo -> incorrect', () => {
  const target = ['I', 'have', 'to', 'meet', 'the', 'deadline'];
  const answer = ['I', 'have', 'to', 'meet', 'the', 'deadline', 'today'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'incorrect');
});

test('classifyUnscrambleAttempt: niewłaściwe słowo zamiast właściwego -> incorrect', () => {
  const target = ['I', 'have', 'to', 'meet', 'the', 'deadline'];
  const answer = ['I', 'have', 'to', 'meet', 'the', 'client'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'incorrect');
});

test('classifyUnscrambleAttempt: duplikat słowa liczony poprawnie — ta sama liczność w innej kolejności -> close', () => {
  const target = ['the', 'cat', 'chased', 'the', 'dog'];
  const answer = ['the', 'the', 'cat', 'chased', 'dog'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'close');
});

test('classifyUnscrambleAttempt: duplikat słowa liczony poprawnie — zła liczność duplikatów -> incorrect', () => {
  const target = ['the', 'cat', 'chased', 'the', 'dog'];
  // Tylko jedno "the" zamiast dwóch — multiset się nie zgadza mimo tych samych unikalnych słów.
  const answer = ['the', 'cat', 'chased', 'dog', 'dog'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'incorrect');
});

test('classifyUnscrambleAttempt: normalizacja interpunkcji i wielkości liter jak w reszcie aplikacji', () => {
  const target = ['I', "don't", 'know.'];
  const answer = ['I', "Don't", 'know'];
  assert.equal(classifyUnscrambleAttempt(answer, target), 'correct');
});

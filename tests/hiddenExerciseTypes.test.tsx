import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import '../i18n';
import HomeworkExercise from '../components/dashboard/HomeworkExercise';
import { HIDDEN_EXERCISE_TYPES, isExerciseTypeHidden, withoutHiddenExerciseTypes } from '../config/featureFlags';
import { EXERCISE_TYPES_V2 } from '../functions/src/homeworkV2/contracts';
import { OFFERED_HOMEWORK_TYPES, regenerateItems, typesSentToGenerator } from '../services/homeworkGenerator';
import { normalizeExercise } from '../utils/normalizeExercise';
import { assignUids } from '../utils/homeworkItems';

afterEach(cleanup);

test('luki są na liście ukrytych typów, a jedno miejsce konfiguracji obejmuje alias silnika v2', () => {
  assert.ok(HIDDEN_EXERCISE_TYPES.includes('fill_in_the_blank'));
  assert.equal(isExerciseTypeHidden('fill_in_the_blank'), true);
  assert.equal(isExerciseTypeHidden('gap_from_context'), true);
  assert.equal(isExerciseTypeHidden('translation'), false);
  assert.equal(isExerciseTypeHidden('multiple_choice'), false);
});

test('selektor kreatora v1: kafelek „Uzupełnij luki” znika, pozostałe typy zostają', () => {
  assert.ok(!OFFERED_HOMEWORK_TYPES.includes('fill_in_the_blank'));
  assert.deepEqual([...OFFERED_HOMEWORK_TYPES], ['translation', 'find_errors', 'multiple_choice', 'matching']);
});

test('selektor kreatora v2: gap_from_context znika, reszta zostaje', () => {
  assert.deepEqual(withoutHiddenExerciseTypes(EXERCISE_TYPES_V2), ['micro_translation', 'fix_sentence']);
});

test('lista typów przekazywana generatorowi nie zawiera luk, nawet gdy ktoś ją podeśle', () => {
  assert.deepEqual(typesSentToGenerator(['translation', 'fill_in_the_blank', 'matching']), ['translation', 'matching']);
  assert.deepEqual(typesSentToGenerator(['fill_in_the_blank']), []);
});

test('ponowne generowanie zaznaczonych luk nie woła modelu: typ zwraca błąd bez podmian', async () => {
  const sections = assignUids(
    [{ type: 'fill_in_the_blank' as const, items: [{ textWithBlanks: 'She ___ home.', blanks: ['goes'] }] }],
    () => 'u1'
  );
  const results = await regenerateItems({
    sourceText: 'go home',
    sections,
    selectedUids: ['u1'],
    excludeSentences: [],
    level: 'B1',
    perType: 3,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].type, 'fill_in_the_blank');
  assert.deepEqual(results[0].replacements, []);
  assert.ok(results[0].error);
});

test('już przypisane zadanie z lukami nadal przechodzi normalizeExercise i renderuje się u kursanta', () => {
  const raw = { type: 'fill_in_the_blank', textWithBlanks: 'She {{gap:1}} to school every day.', availableWords: ['goes', 'go'] };
  const exercise = normalizeExercise(raw);
  assert.equal(exercise.type, 'fill_in_the_blank');
  assert.notEqual(exercise.state, 'invalid');
  assert.equal(exercise.segments!.filter((s) => s.kind === 'gap').length, 1);

  const { container } = render(<HomeworkExercise type="fill_in_the_blank" item={raw} answer={undefined} onChange={() => {}} />);
  assert.ok(container.querySelector('[data-testid="exercise-instruction"]'), 'polecenie nad treścią');
  assert.ok(container.textContent!.includes('She'), 'treść zdania');
  assert.ok(container.textContent!.includes('goes'), 'bank słów');
  assert.ok(container.textContent!.includes('to school every day.'), 'treść zdania po luce');
});

test('zadanie z silnika v2 (gap_from_context) nadal jest rozpoznawane jako luki', () => {
  assert.equal(normalizeExercise({ exerciseType: 'gap_from_context', content: 'She ___ home.' }).type, 'fill_in_the_blank');
});

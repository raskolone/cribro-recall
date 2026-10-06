import assert from 'node:assert/strict';
import test from 'node:test';

import { isPendingStatus } from '../utils/homework';

test('pending i assigned (fan-out do grupy) to zadania nierozwiązane', () => {
  assert.equal(isPendingStatus('pending'), true);
  assert.equal(isPendingStatus('assigned'), true);
});

test('submitted, graded i completed nie są pending', () => {
  assert.equal(isPendingStatus('submitted'), false);
  assert.equal(isPendingStatus('graded'), false);
  assert.equal(isPendingStatus('completed'), false);
});

test('brak statusu nie jest pending (lista lektora nigdy takich nie pokazywała)', () => {
  assert.equal(isPendingStatus(undefined), false);
  assert.equal(isPendingStatus(null), false);
  assert.equal(isPendingStatus(''), false);
});

import { isStudentTodoStatus } from '../utils/homework';

test('kursant: assigned, pending i brak statusu trafiają do „do zrobienia"; submitted/graded/completed nie', () => {
  assert.equal(isStudentTodoStatus('assigned'), true);
  assert.equal(isStudentTodoStatus('pending'), true);
  assert.equal(isStudentTodoStatus(undefined), true);
  assert.equal(isStudentTodoStatus(null), true);
  assert.equal(isStudentTodoStatus('submitted'), false);
  assert.equal(isStudentTodoStatus('graded'), false);
  assert.equal(isStudentTodoStatus('completed'), false);
});

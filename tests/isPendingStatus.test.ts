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

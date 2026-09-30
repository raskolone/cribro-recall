import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowUnassignedBar } from '../utils/scratchpadAssignBar';

test('notatnik roboczy bez kursanta i grupy → pasek widoczny', () => {
  assert.equal(shouldShowUnassignedBar({ studentId: null, groupId: null }, 3), true);
  assert.equal(shouldShowUnassignedBar({}, 1), true);
});

test('notatnik z groupId → pasek ukryty, nawet bez studentId', () => {
  assert.equal(shouldShowUnassignedBar({ studentId: null, groupId: 'g1' }, 3), false);
  assert.equal(shouldShowUnassignedBar({ groupId: 'g1' }, 3), false);
});

test('notatnik przypisany do kursanta lub brak kandydatów → pasek ukryty', () => {
  assert.equal(shouldShowUnassignedBar({ studentId: 's1' }, 3), false);
  assert.equal(shouldShowUnassignedBar({}, 0), false);
});

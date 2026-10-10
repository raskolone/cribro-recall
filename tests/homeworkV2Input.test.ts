import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ASSIGN_EXERCISES,
  MAX_ASSIGN_STUDENTS,
  MAX_GENERATE_ITEM_COUNT,
  isSafeDocId,
  validateAssignInput,
  validateGenerateInput,
} from '../utils/homeworkV2Input';

test('isSafeDocId: odrzuca ścieżki, puste, nie-teksty i napisy ze spacjami na brzegach', () => {
  assert.equal(isSafeDocId('abc123'), true);
  for (const bad of ['', ' a', 'a/b', '..', '.', 12, null, undefined, 'x'.repeat(201)]) assert.equal(isSafeDocId(bad), false, String(bad));
});

test('validateAssignInput: poprawne wejście, deduplikacja uid, domyślny tytuł', () => {
  const r = validateAssignInput({ studentUids: ['a', 'a', 'b'], exercises: [{}] });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.studentUids, ['a', 'b']);
    assert.equal(r.value.title, 'Praca domowa');
  }
});

test('validateAssignInput: puste / zbyt wiele uid / zbyt wiele zadań / nie-lista', () => {
  assert.equal(validateAssignInput({ studentUids: [] }).ok, false);
  assert.equal(validateAssignInput({}).ok, false);
  assert.equal(validateAssignInput({ studentUids: 'a' }).ok, false);
  assert.equal(validateAssignInput({ studentUids: Array.from({ length: MAX_ASSIGN_STUDENTS + 1 }, (_, i) => `u${i}`) }).ok, false);
  assert.equal(validateAssignInput({ studentUids: ['a'], exercises: Array.from({ length: MAX_ASSIGN_EXERCISES + 1 }, () => ({})) }).ok, false);
  assert.equal(validateAssignInput({ studentUids: ['a'], groupId: 'x/y' }).ok, false);
});

test('validateGenerateInput: wartości z realnego UI (suwak 1–30 zadań, do 120 min) przechodzą', () => {
  const r = validateGenerateInput({ studentUid: 's1', lessonIds: ['l1', 'l2'], itemCount: 30, plannedMinutes: 120 });
  assert.ok(r.ok);
});

test('validateGenerateInput: odrzuca brak kursanta, brak lekcji, absurdalną liczbę zadań i minut, nie-listę rawLessons', () => {
  assert.equal(validateGenerateInput({ lessonIds: ['l'] }).ok, false);
  assert.equal(validateGenerateInput({ studentUid: 's' }).ok, false);
  assert.equal(validateGenerateInput({ studentUid: 's', lessonIds: ['l'], itemCount: MAX_GENERATE_ITEM_COUNT + 1 }).ok, false);
  assert.equal(validateGenerateInput({ studentUid: 's', lessonIds: ['l'], plannedMinutes: 99999 }).ok, false);
  assert.equal(validateGenerateInput({ studentUid: 's', lessonIds: ['l'], rawLessons: 'x' }).ok, false);
  assert.equal(validateGenerateInput({ studentUid: 'a/b', lessonIds: ['l'] }).ok, false);
});

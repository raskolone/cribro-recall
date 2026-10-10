import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGradedNotification, taskOwnerUid, MAX_NOTIFICATION_FEEDBACK_CHARS } from '../utils/gradedNotification';

test('v1: sprawdzona praca -> treść z dokumentu; niesprawdzona -> odmowa', () => {
  const ok = resolveGradedNotification({ status: 'graded', title: ' T ', teacherFeedback: ' Brawo ', grade: 87.4 });
  assert.deepEqual(ok, { ok: true, content: { title: 'T', score: 87, feedback: 'Brawo' } });
  assert.equal(resolveGradedNotification({ status: 'pending', title: 'T' }).ok, false);
});

test('v1: brak tytułu/wyniku/komentarza -> wartości bezpieczne, wynik obcięty do 0–100, komentarz do limitu', () => {
  const r = resolveGradedNotification({ status: 'graded', grade: 250, teacherFeedback: 'x'.repeat(MAX_NOTIFICATION_FEEDBACK_CHARS + 50) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.content.title, 'Praca domowa');
    assert.equal(r.content.score, 100);
    assert.equal(r.content.feedback.length, MAX_NOTIFICATION_FEEDBACK_CHARS);
  }
  const r2 = resolveGradedNotification({ status: 'graded', grade: 'abc', teacherFeedback: 42 });
  assert.ok(r2.ok);
  if (r2.ok) assert.deepEqual([r2.content.score, r2.content.feedback], [null, '']);
});

test('v2: wynik i komentarz z zatwierdzonej próby; bez próby odmowa', () => {
  const r = resolveGradedNotification({ engineVersion: 'v2', title: 'Set' }, { feedbackMessage: 'Ok', weightedScore: 0.835 });
  assert.deepEqual(r, { ok: true, content: { title: 'Set', score: 84, feedback: 'Ok' } });
  assert.equal(resolveGradedNotification({ engineVersion: 'v2' }, null).ok, false);
});

test('taskOwnerUid: studentUid, potem studentId, potem userId', () => {
  assert.equal(taskOwnerUid({ studentUid: 'a', studentId: 'b' }), 'a');
  assert.equal(taskOwnerUid({ studentId: 'b' }), 'b');
  assert.equal(taskOwnerUid({ userId: 'c' }), 'c');
  assert.equal(taskOwnerUid(undefined), '');
});

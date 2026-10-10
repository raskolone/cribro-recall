import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, createUser, type RouteHarness, type TestUser } from './harness';
import { validExercise } from './fixtures';

/**
 * SEC2 p.2 — POST /api/homework-v2/generate i /assign musiały być dostępne dla KAŻDEGO zalogowanego
 * (requireFirebaseAuth): kursant mógł zapisać zadania w cudzym `specialTasks` i ustawić `hasNewHomework`.
 */
let h: RouteHarness;
let student: TestUser;
let teacher: TestUser;
let other: TestUser;

before(async () => {
  process.env.HOMEWORK_ENGINE_V2 = 'true';
  h = await startHarness();
  student = await createUser(h.db, { role: 'user' });
  other = await createUser(h.db, { role: 'user', profile: { email: 'other-db@example.test' } });
  teacher = await createUser(h.db, { role: 'teacher' });
});
after(async () => { await h.close(); });

const tasksOf = async (studentUid: string) =>
  (await h.db.collection('specialTasks').where('studentUid', '==', studentUid).get()).docs;

const assignBody = (uids: string[], extra: Record<string, unknown> = {}) => ({
  exercises: [validExercise('ex-1', uids[0])],
  studentUids: uids,
  title: 'Praca testowa',
  ...extra,
});

for (const route of ['/api/homework-v2/generate', '/api/homework-v2/assign']) {
  test(`${route}: brak tokenu -> 401`, async () => {
    assert.equal((await h.call('POST', route, { body: {} })).status, 401);
  });
  test(`${route}: kursant -> 403`, async () => {
    const r = await h.call('POST', route, { token: student.token, body: route.endsWith('assign') ? assignBody([other.uid]) : { studentUid: other.uid, lessonIds: ['l1'] } });
    assert.equal(r.status, 403);
  });
}

test('assign: kursant NIE zapisuje zadań ani nie ustawia hasNewHomework cudzemu kursantowi', async () => {
  await h.call('POST', '/api/homework-v2/assign', { token: student.token, body: assignBody([other.uid]) });
  assert.equal((await tasksOf(other.uid)).length, 0);
  assert.notEqual((await h.db.collection('users').doc(other.uid).get()).data()?.hasNewHomework, true);
});

test('assign: lektor -> 200, zadanie zapisane z teacherId z TOKENU i hasNewHomework', async () => {
  const r = await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: assignBody([other.uid]) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.taskIds.length, 1);
  const doc = await h.db.collection('specialTasks').doc(r.body.taskIds[0]).get();
  assert.equal(doc.data()?.teacherId, teacher.uid);
  assert.equal(doc.data()?.studentUid, other.uid);
  assert.equal((await h.db.collection('users').doc(other.uid).get()).data()?.hasNewHomework, true);
});

test('assign: e-mail kursanta bierze się z bazy, nie z pola wpisanego przez klienta', async () => {
  const r = await h.call('POST', '/api/homework-v2/assign', {
    token: teacher.token,
    body: assignBody([other.uid], { studentEmails: { [other.uid]: 'attacker@evil.test' } }),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const doc = await h.db.collection('specialTasks').doc(r.body.taskIds[0]).get();
  assert.equal(doc.data()?.studentEmail, 'other-db@example.test');
});

test('assign: uid nieistniejącego kursanta -> 400 i nic nie zapisane', async () => {
  const before = (await tasksOf(other.uid)).length;
  const r = await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: assignBody([other.uid, 'nie-ma-takiego-uid']) });
  assert.equal(r.status, 400);
  assert.equal((await tasksOf(other.uid)).length, before);
});

test('assign: dokument grupy (isGroup) nie jest kursantem -> 400', async () => {
  await h.db.collection('users').doc('grupa-1').set({ isGroup: true, name: 'Grupa' });
  const r = await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: assignBody(['grupa-1']) });
  assert.equal(r.status, 400);
});

test('assign: zbyt wiele uid -> 400', async () => {
  const uids = Array.from({ length: 201 }, (_, i) => `u${i}`);
  const r = await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: assignBody(uids) });
  assert.equal(r.status, 400);
});

test('assign: uid nie-tekstowy / ze ścieżką -> 400', async () => {
  for (const bad of [[123], ['a/b'], [''], [{ x: 1 }]]) {
    const r = await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: { ...assignBody([other.uid]), studentUids: bad } });
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

test('assign: zbyt wiele ćwiczeń / zbyt duże wejście / za długi tytuł -> 400', async () => {
  const many = Array.from({ length: 101 }, (_, i) => validExercise(`ex-${i}`, other.uid));
  assert.equal((await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: { ...assignBody([other.uid]), exercises: many } })).status, 400);
  const huge = { ...validExercise('ex-big', other.uid), content: 'x'.repeat(1_100_000) };
  assert.equal((await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: { ...assignBody([other.uid]), exercises: [huge] } })).status, 400);
  assert.equal((await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: assignBody([other.uid], { title: 't'.repeat(201) }) })).status, 400);
});

test('assign: flaga HOMEWORK_ENGINE_V2 wyłączona -> 412 i nic nie zapisane', async () => {
  process.env.HOMEWORK_ENGINE_V2 = 'false';
  try {
    const before = (await tasksOf(other.uid)).length;
    const r = await h.call('POST', '/api/homework-v2/assign', { token: teacher.token, body: assignBody([other.uid]) });
    assert.equal(r.status, 412);
    assert.equal((await tasksOf(other.uid)).length, before);
  } finally {
    process.env.HOMEWORK_ENGINE_V2 = 'true';
  }
});

test('generate: lektor przechodzi autoryzację (flaga wyłączona -> 412, czyli dotarł do bramki), walidacja wejścia 400', async () => {
  process.env.HOMEWORK_ENGINE_V2 = 'false';
  try {
    assert.equal((await h.call('POST', '/api/homework-v2/generate', { token: teacher.token, body: { studentUid: other.uid, lessonIds: ['l1'] } })).status, 412);
  } finally {
    process.env.HOMEWORK_ENGINE_V2 = 'true';
  }
  assert.equal((await h.call('POST', '/api/homework-v2/generate', { token: teacher.token, body: { lessonIds: ['l1'] } })).status, 400);
  assert.equal((await h.call('POST', '/api/homework-v2/generate', { token: teacher.token, body: { studentUid: other.uid, lessonIds: [] } })).status, 400);
  assert.equal((await h.call('POST', '/api/homework-v2/generate', { token: teacher.token, body: { studentUid: 'nie-ma-takiego', lessonIds: ['l1'] } })).status, 404);
  assert.equal((await h.call('POST', '/api/homework-v2/generate', { token: teacher.token, body: { studentUid: other.uid, lessonIds: Array.from({ length: 101 }, (_, i) => `l${i}`) } })).status, 400);
  assert.equal((await h.call('POST', '/api/homework-v2/generate', { token: teacher.token, body: { studentUid: other.uid, lessonIds: ['l1'], itemCount: 500 } })).status, 400);
});

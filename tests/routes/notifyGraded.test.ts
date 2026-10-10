import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, createUser, type RouteHarness, type TestUser } from './harness';

/**
 * SEC2 p.3 — POST /api/homework/notify-graded: dowolny zalogowany mógł wysłać kursantowi e-mail
 * z DOWOLNĄ treścią (tytuł, komentarz, wynik, podpis) i nadpisać mu pola lastGraded* w profilu.
 */
let h: RouteHarness;
let student: TestUser;
let stranger: TestUser;
let teacher: TestUser;
let teacherNoName: TestUser;
const resendCalls: Array<{ headers: Record<string, string>; payload: any }> = [];
const realFetch = globalThis.fetch;

before(async () => {
  process.env.RESEND_API_KEY = 're_test_key';
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://api.resend.com/')) {
      resendCalls.push({ headers: init.headers, payload: JSON.parse(init.body) });
      return new Response('{"id":"x"}', { status: 200 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  h = await startHarness();
  student = await createUser(h.db, { role: 'user', profile: { firstName: 'Anna', email: 'anna-db@example.test' } });
  stranger = await createUser(h.db, { role: 'user' });
  teacher = await createUser(h.db, { role: 'teacher', profile: { firstName: 'Tomasz', lastName: 'Lektor' } });
  teacherNoName = await createUser(h.db, { role: 'teacher' });
});
after(async () => { globalThis.fetch = realFetch; await h.close(); });
beforeEach(() => { resendCalls.length = 0; });

let seq = 0;
const makeTask = async (data: Record<string, unknown>): Promise<string> => {
  seq += 1;
  const id = `task-${seq}-${Date.now()}`;
  await h.db.collection('specialTasks').doc(id).set({ studentUid: student.uid, title: 'Past Simple', ...data });
  return id;
};
const gradedV1 = (extra: Record<string, unknown> = {}) => ({ status: 'graded', teacherFeedback: 'Dobra robota!', grade: 87, ...extra });
const body = (taskId: string, extra: Record<string, unknown> = {}) => ({ studentUid: student.uid, taskId, ...extra });
const profile = async () => (await h.db.collection('users').doc(student.uid).get()).data() || {};

test('brak tokenu -> 401', async () => {
  assert.equal((await h.call('POST', '/api/homework/notify-graded', { body: body('x') })).status, 401);
});

test('kursant -> 403, żadnego maila i profil cudzego kursanta nietknięty', async () => {
  const taskId = await makeTask(gradedV1());
  const r = await h.call('POST', '/api/homework/notify-graded', {
    token: stranger.token,
    body: body(taskId, { taskTitle: 'PHISH', teacherFeedback: 'Kliknij http://evil.test', score: 1, teacherName: 'Dyrektor' }),
  });
  assert.equal(r.status, 403);
  assert.equal(resendCalls.length, 0);
  assert.notEqual((await profile()).lastGradedHomeworkTitle, 'PHISH');
});

test('lektor, legalny przepływ v1: mail i profil z DOKUMENTU ZADANIA, pola z żądania są ignorowane', async () => {
  const taskId = await makeTask(gradedV1());
  const r = await h.call('POST', '/api/homework/notify-graded', {
    token: teacher.token,
    body: body(taskId, { taskTitle: 'PHISH', teacherFeedback: 'Kliknij http://evil.test', score: 1, teacherName: 'Dyrektor' }),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(resendCalls.length, 1);
  const mail = resendCalls[0].payload;
  assert.deepEqual(mail.to, ['anna-db@example.test']);
  assert.match(mail.subject, /Past Simple/);
  assert.match(mail.html, /Dobra robota!/);
  assert.match(mail.html, /87%/);
  assert.match(mail.text, /Tomasz Lektor/);
  for (const forbidden of ['PHISH', 'evil.test', 'Dyrektor']) {
    assert.ok(!mail.html.includes(forbidden) && !mail.text.includes(forbidden) && !mail.subject.includes(forbidden), forbidden);
  }
  const p = await profile();
  assert.equal(p.lastGradedHomeworkTitle, 'Past Simple');
  assert.equal(p.lastGradedFeedback, 'Dobra robota!');
  assert.equal(p.lastGradedScore, 87);
  assert.equal(p.lastGradedHomeworkId, taskId);
  assert.equal((await h.db.collection('specialTasks').doc(taskId).get()).data()?.emailGradedNotificationSent, true);
});

test('podpis bez imienia w profilu lektora: wartość domyślna, nie z żądania', async () => {
  const taskId = await makeTask(gradedV1());
  const r = await h.call('POST', '/api/homework/notify-graded', { token: teacherNoName.token, body: body(taskId, { teacherName: 'Dyrektor' }) });
  assert.equal(r.status, 200);
  assert.match(resendCalls[0].payload.text, /Maciej Wyrozumski/);
  assert.ok(!resendCalls[0].payload.text.includes('Dyrektor'));
});

test('idempotencja: drugie wywołanie dla tego samego zadania nie wysyła maila', async () => {
  const taskId = await makeTask(gradedV1());
  await h.call('POST', '/api/homework/notify-graded', { token: teacher.token, body: body(taskId) });
  const again = await h.call('POST', '/api/homework/notify-graded', { token: teacher.token, body: body(taskId) });
  assert.equal(again.status, 200);
  assert.equal(again.body.skipped, true);
  assert.equal(resendCalls.length, 1);
});

test('lektor, walidacja: brak taskId 400, zadanie nie istnieje 404, zadanie innego kursanta 403, niesprawdzone 409', async () => {
  const call = (b: unknown) => h.call('POST', '/api/homework/notify-graded', { token: teacher.token, body: b });
  assert.equal((await call({ studentUid: student.uid })).status, 400);
  assert.equal((await call({ taskId: 'x' })).status, 400);
  assert.equal((await call({ studentUid: student.uid, taskId: 'a/b' })).status, 400);
  assert.equal((await call(body('nie-ma-takiego-zadania'))).status, 404);
  assert.equal((await call({ studentUid: 'nie-ma-kursanta', taskId: 'x' })).status, 404);
  const foreign = await makeTask(gradedV1({ studentUid: stranger.uid }));
  assert.equal((await call(body(foreign))).status, 403);
  const pending = await makeTask({ status: 'pending' });
  assert.equal((await call(body(pending))).status, 409);
  assert.equal(resendCalls.length, 0);
});

test('lektor, v2: komentarz i wynik z najnowszej ZATWIERDZONEJ próby, nie z żądania', async () => {
  const taskId = await makeTask({ engineVersion: 'v2', status: 'pending' });
  const attempts = h.db.collection('specialTasks').doc(taskId).collection('attempts');
  await attempts.doc('a1').set({ feedbackMessage: 'stary komentarz', weightedScore: 0.4, teacherApprovedAt: '2026-10-01T10:00:00.000Z' });
  await attempts.doc('a2').set({ feedbackMessage: 'Świetnie, tak trzymaj', weightedScore: 0.92, teacherApprovedAt: '2026-10-02T10:00:00.000Z' });
  await attempts.doc('a3').set({ feedbackMessage: 'nie zatwierdzona', weightedScore: 0.1 });
  const r = await h.call('POST', '/api/homework/notify-graded', { token: teacher.token, body: body(taskId, { teacherFeedback: 'PHISH', score: 1 }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(resendCalls[0].payload.html, /Świetnie, tak trzymaj/);
  assert.match(resendCalls[0].payload.html, /92%/);
  assert.ok(!resendCalls[0].payload.html.includes('PHISH'));
  assert.equal((await profile()).lastGradedScore, 92);
});

test('lektor, v2 bez zatwierdzonej próby -> 409', async () => {
  const taskId = await makeTask({ engineVersion: 'v2', status: 'pending' });
  const r = await h.call('POST', '/api/homework/notify-graded', { token: teacher.token, body: body(taskId) });
  assert.equal(r.status, 409);
});

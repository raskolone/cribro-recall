import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, createUser, type RouteHarness, type TestUser } from './harness';

/**
 * SEC2 p.4 — /api/scenario/* stały za requireFirebaseAuth: dowolny zalogowany mógł nadpisać
 * `plannedScenario` / `scenarioCanvasV2` w lessonRecords DOWOLNEGO kursanta oraz zużywać Gemini.
 * Dowód z grepa: trasy wołają wyłącznie hooki useScenarioGenerator / useScenarioCanvas
 * (komponenty components/admin/*) i narzędzie czatu Asystenta Lektora (components/admin/TeacherAssistant).
 */
let h: RouteHarness;
let student: TestUser;
let victim: TestUser;
let teacher: TestUser;

before(async () => {
  h = await startHarness();
  student = await createUser(h.db, { role: 'user' });
  victim = await createUser(h.db, { role: 'user' });
  teacher = await createUser(h.db, { role: 'teacher' });
  await h.db.collection('users').doc(victim.uid).collection('lessonRecords').doc('lesson-1').set({ topic: 'Past Simple' });
});
after(async () => { await h.close(); });

const ROUTES = ['generate', 'generate-for-chat', 'save', 'canvas/generate', 'canvas/save', 'canvas/refresh'].map((r) => `/api/scenario/${r}`);
const scenario = { modules: [{ id: 'm1', title: 'x' }] };
const record = async () => (await h.db.collection('users').doc(victim.uid).collection('lessonRecords').doc('lesson-1').get()).data() || {};

for (const route of ROUTES) {
  test(`${route}: brak tokenu -> 401, kursant -> 403`, async () => {
    assert.equal((await h.call('POST', route, { body: {} })).status, 401);
    assert.equal((await h.call('POST', route, { token: student.token, body: { studentId: victim.uid, targetLessonId: 'lesson-1', durationMin: 45, studentRef: 'x', scenario, canvas: { version: 2, blocks: [] }, mutationId: 'm', expectedRevision: 1 } })).status, 403);
  });
  test(`${route}: lektor przechodzi autoryzację (pusta walidacja -> 400, nie 401/403)`, async () => {
    assert.equal((await h.call('POST', route, { token: teacher.token, body: {} })).status, 400);
  });
}

test('save: kursant NIE nadpisuje scenariusza cudzej lekcji', async () => {
  await h.call('POST', '/api/scenario/save', { token: student.token, body: { studentId: victim.uid, targetLessonId: 'lesson-1', scenario } });
  assert.equal((await record()).plannedScenario, undefined);
});

test('canvas/save: kursant NIE nadpisuje canvasu cudzej lekcji', async () => {
  await h.call('POST', '/api/scenario/canvas/save', { token: student.token, body: { studentId: victim.uid, targetLessonId: 'lesson-1', canvas: { version: 2, blocks: [] } } });
  assert.equal((await record()).scenarioCanvasV2, undefined);
});

test('save: lektor zapisuje scenariusz (legalny przepływ)', async () => {
  const r = await h.call('POST', '/api/scenario/save', { token: teacher.token, body: { studentId: victim.uid, targetLessonId: 'lesson-1', scenario } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual((await record()).plannedScenario, scenario);
  assert.equal((await h.call('POST', '/api/scenario/save', { token: teacher.token, body: { studentId: victim.uid, targetLessonId: 'brak', scenario } })).status, 404);
});

test('canvas/save: lektor zapisuje canvas (legalny przepływ)', async () => {
  const canvas = { version: 2, blocks: [], revision: 1 };
  const r = await h.call('POST', '/api/scenario/canvas/save', { token: teacher.token, body: { studentId: victim.uid, targetLessonId: 'lesson-1', canvas } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual((await record()).scenarioCanvasV2, canvas);
});

test('generate / canvas/generate: lektor z poprawnym wejściem dociera do Gemini (brak klucza w teście -> 500, nie 403)', async () => {
  for (const route of ['/api/scenario/generate', '/api/scenario/canvas/generate']) {
    const r = await h.call('POST', route, { token: teacher.token, body: { studentId: victim.uid, durationMin: 45 } });
    assert.equal(r.status, 500, route);
    assert.match(String(r.body.error), /GEMINI_API_KEY/);
  }
});

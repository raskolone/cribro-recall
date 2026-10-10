import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, createUser, type RouteHarness, type TestUser } from './harness';
import { validExercise } from './fixtures';

/**
 * SEC2 p.6 — POST /api/gemini/generate: tylko ograniczenia, które nie zmieniają legalnych wywołań
 * (rozmiar ciała, limit na użytkownika, sufit maxOutputTokens). Gemini podmienione stubem fetch.
 */
let h: RouteHarness;
let student: TestUser;
let student2: TestUser;
let teacher: TestUser;
const geminiCalls: any[] = [];
const realFetch = globalThis.fetch;
const ROUTE = '/api/gemini/generate';

before(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.HOMEWORK_ENGINE_V2 = 'true';
  process.env.GEMINI_PROXY_PER_MINUTE = '5';
  process.env.GEMINI_PROXY_PER_DAY = '1000';
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('generativelanguage.googleapis.com')) {
      geminiCalls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  h = await startHarness();
  student = await createUser(h.db, { role: 'user' });
  student2 = await createUser(h.db, { role: 'user' });
  teacher = await createUser(h.db, { role: 'teacher' });
});
after(async () => { globalThis.fetch = realFetch; await h.close(); });

const body = (extra: Record<string, unknown> = {}) => ({ model: 'gemini-2.5-flash', contents: 'Say ok', ...extra });

test('brak tokenu -> 401', async () => {
  assert.equal((await h.call('POST', ROUTE, { body: body() })).status, 401);
});

test('legalne wywołanie kursanta: 200, a tools / thinkingConfig / responseSchema przechodzą BEZ ZMIAN', async () => {
  geminiCalls.length = 0;
  const config = {
    systemInstruction: 'Be brief',
    tools: [{ googleSearch: {} }],
    thinkingConfig: { thinkingBudget: 0 },
    responseMimeType: 'application/json',
  };
  const r = await h.call('POST', ROUTE, { token: student.token, body: body({ config }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.text, 'ok');
  const sent = geminiCalls[0].body;
  assert.deepEqual(sent.tools, config.tools);
  assert.equal(sent.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(sent.generationConfig.responseMimeType, 'application/json');
  assert.equal(sent.generationConfig.maxOutputTokens, undefined, 'bez maxOutputTokens w żądaniu nic nie dopisujemy');
});

test('sufit maxOutputTokens: absurdalna wartość obcięta, rozsądna bez zmian', async () => {
  geminiCalls.length = 0;
  await h.call('POST', ROUTE, { token: teacher.token, body: body({ config: { maxOutputTokens: 5_000_000 } }) });
  await h.call('POST', ROUTE, { token: teacher.token, body: body({ config: { maxOutputTokens: 8192 } }) });
  assert.equal(geminiCalls[0].body.generationConfig.maxOutputTokens, 65536);
  assert.equal(geminiCalls[1].body.generationConfig.maxOutputTokens, 8192);
});

test('limit rozmiaru ciała: 1,5 MB przechodzi (duży prompt), 3 MB -> 413, a inne trasy nadal mają limit 50 MB', async () => {
  const big = (n: number) => 'x'.repeat(n);
  const teacherCall = (n: number) => h.call('POST', ROUTE, { token: teacher.token, body: body({ contents: big(n) }) });
  assert.equal((await teacherCall(1_500_000)).status, 200);
  assert.equal((await teacherCall(3_000_000)).status, 413);
  // trasa spoza proxy Gemini: 3 MB nie jest odrzucone przez parser (walidacja trasy odpowiada 400, nie 413)
  const other = await h.call('POST', '/api/homework-v2/assign', {
    token: teacher.token,
    body: { studentUids: ['a'], exercises: [{ ...validExercise('e', 'a'), content: big(3_000_000) }] },
  });
  assert.equal(other.status, 400);
});

test('limit rozmiaru obowiązuje też dla wariantów ścieżki (ukośnik końcowy, wielkość liter)', async () => {
  for (const path of ['/api/gemini/generate/', '/API/Gemini/Generate']) {
    const r = await h.call('POST', path, { token: teacher.token, body: body({ contents: 'x'.repeat(3_000_000) }) });
    assert.equal(r.status, 413, path);
  }
});

test('nieprawidłowy JSON -> 400, nieuwierzytelniony duży ciężar nie jest parsowany (401)', async () => {
  assert.equal((await h.call('POST', ROUTE, { token: student2.token, rawBody: '{nie json' })).status, 400);
  assert.equal((await h.call('POST', ROUTE, { rawBody: 'x'.repeat(3_000_000) })).status, 401);
});

test('limit na minutę: kursant dostaje 429 + Retry-After po przekroczeniu, kolejny kursant i lektor nie są dotknięci', async () => {
  const limited = await createUser(h.db, { role: 'user' });
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await h.call('POST', ROUTE, { token: limited.token, body: body() })).status, 200, `żądanie ${i + 1}`);
  }
  const res = await fetch(h.baseUrl + ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${limited.token}` },
    body: JSON.stringify(body()),
  });
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) >= 1);
  const payload = await res.json();
  assert.equal(payload.reason, 'minute');
  // odrzucone żądanie nie zwiększa licznika
  assert.equal((await h.db.collection('geminiProxyUsage').doc(limited.uid).get()).data()?.minuteCount, 5);

  assert.equal((await h.call('POST', ROUTE, { token: student2.token, body: body() })).status, 200);
  for (let i = 0; i < 8; i += 1) {
    assert.equal((await h.call('POST', ROUTE, { token: teacher.token, body: body() })).status, 200, `lektor ${i + 1}`);
  }
  assert.equal((await h.db.collection('geminiProxyUsage').doc(teacher.uid).get()).exists, false, 'lektor nie ma licznika');
});

test('równoległe żądania nie przekraczają limitu (transakcja)', async () => {
  const racer = await createUser(h.db, { role: 'user' });
  const results = await Promise.all(Array.from({ length: 12 }, () => h.call('POST', ROUTE, { token: racer.token, body: body() })));
  assert.equal(results.filter((r) => r.status === 200).length, 5);
  assert.equal(results.filter((r) => r.status === 429).length, 7);
});

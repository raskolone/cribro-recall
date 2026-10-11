import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, createUser, type RouteHarness, type TestUser } from './harness';

/**
 * SEC2b — tymczasowa ochrona /api/openai, /api/anthropic, /api/deepseek. Kursanci wołają je legalnie
 * (generatory fiszek), więc dostęp zostaje; dochodzą limit ciała, limit żądań na użytkownika i sufit
 * max_tokens (Anthropic). Dostawcy podmienieni stubem fetch — żadnych prawdziwych wywołań.
 */
let h: RouteHarness;
let student: TestUser;
let teacher: TestUser;
const providerCalls: Array<{ url: string; body: any }> = [];
const realFetch = globalThis.fetch;

const ROUTES = ['/api/openai', '/api/openai/generate', '/api/anthropic', '/api/anthropic/generate', '/api/deepseek', '/api/deepseek/generate'];
const body = (extra: Record<string, unknown> = {}) => ({ prompt: 'Say ok', isJson: false, ...extra });

before(async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.DEEPSEEK_API_KEY = 'sk-ds-test';
  process.env.GEMINI_PROXY_PER_MINUTE = '5';
  process.env.GEMINI_PROXY_PER_DAY = '1000';
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/api\.(openai|anthropic|deepseek)\.com/.test(url)) {
      providerCalls.push({ url, body: JSON.parse(init.body) });
      const payload = url.includes('anthropic') ? { content: [{ type: 'text', text: 'ok' }] } : { choices: [{ message: { content: 'ok' } }] };
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  h = await startHarness();
  student = await createUser(h.db, { role: 'user' });
  teacher = await createUser(h.db, { role: 'teacher' });
});
after(async () => { globalThis.fetch = realFetch; await h.close(); });

for (const route of ROUTES) {
  test(`${route}: brak tokenu -> 401; kursant NADAL ma dostęp (200, generatory fiszek)`, async () => {
    assert.equal((await h.call('POST', route, { body: body() })).status, 401);
    const user = await createUser(h.db, { role: 'user' });
    const r = await h.call('POST', route, { token: user.token, body: body() });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.text, 'ok');
  });
}

test('limit rozmiaru ciała: 1,5 MB przechodzi, 3 MB -> 413, także dla wariantów ścieżki', async () => {
  for (const route of ['/api/openai', '/api/anthropic', '/api/deepseek']) {
    assert.equal((await h.call('POST', route, { token: teacher.token, body: body({ prompt: 'x'.repeat(1_500_000) }) })).status, 200, route);
    assert.equal((await h.call('POST', route, { token: teacher.token, body: body({ prompt: 'x'.repeat(3_000_000) }) })).status, 413, route);
  }
  for (const path of ['/api/openai/', '/API/Anthropic/Generate', '/api/DeepSeek']) {
    assert.equal((await h.call('POST', path, { token: teacher.token, body: body({ prompt: 'x'.repeat(3_000_000) }) })).status, 413, path);
  }
});

test('limit na minutę: wspólny budżet trzech dostawców, 429 + Retry-After, odrzucone nie zwiększa licznika, lektor zwolniony', async () => {
  const limited = await createUser(h.db, { role: 'user' });
  const routes = ['/api/openai', '/api/anthropic', '/api/deepseek', '/api/openai', '/api/anthropic'];
  for (const [i, route] of routes.entries()) {
    assert.equal((await h.call('POST', route, { token: limited.token, body: body() })).status, 200, `żądanie ${i + 1}`);
  }
  const res = await fetch(h.baseUrl + '/api/deepseek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${limited.token}` },
    body: JSON.stringify(body()),
  });
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) >= 1);
  assert.equal((await h.db.collection('aiProxyUsage').doc(limited.uid).get()).data()?.minuteCount, 5);
  assert.equal((await h.db.collection('geminiProxyUsage').doc(limited.uid).get()).exists, false, 'osobny budżet niż Gemini');
  for (let i = 0; i < 8; i += 1) assert.equal((await h.call('POST', '/api/openai', { token: teacher.token, body: body() })).status, 200);
  assert.equal((await h.db.collection('aiProxyUsage').doc(teacher.uid).get()).exists, false);
});

test('sufit max_tokens (Anthropic): brak -> 4096 jak dotąd, rozsądna wartość bez zmian, absurdalna obcięta do 8192', async () => {
  providerCalls.length = 0;
  for (const extra of [{}, { max_tokens: 1000 }, { max_tokens: 5_000_000 }]) {
    assert.equal((await h.call('POST', '/api/anthropic', { token: teacher.token, body: body(extra) })).status, 200);
  }
  assert.deepEqual(providerCalls.map((c) => c.body.max_tokens), [4096, 1000, 8192]);
});

test('zwykłe użycie bez zmian: system prompt i tryb JSON docierają do dostawcy', async () => {
  providerCalls.length = 0;
  await h.call('POST', '/api/openai', { token: teacher.token, body: { prompt: 'Zwróć JSON', systemInstruction: 'Be brief', isJson: true } });
  const sent = providerCalls[0].body;
  assert.equal(sent.messages[0].role, 'system');
  assert.deepEqual(sent.response_format, { type: 'json_object' });
});

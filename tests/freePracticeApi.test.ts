// Klient trasy /api/free-practice/generate: mapowanie odpowiedzi serwera na wynik albo typowany błąd.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FREE_PRACTICE_ENDPOINT,
  FreePracticeApiError,
  freePracticeErrorKey,
  requestFreeSentences,
  type FreePracticeDeps,
  type FreePracticeErrorCode,
  type FreePracticeRequest,
} from '../services/freePracticeApi';

const payload: FreePracticeRequest = { format: 'translation', topics: ['travel'], words: [], lessonRecordIds: [], count: 5, excludeSentences: [] };

const depsFor = (status: number, body: unknown, token: string | null = 'tok') => {
  const calls: Array<{ input: string; init: any }> = [];
  const deps: FreePracticeDeps = {
    fetch: async (input, init) => {
      calls.push({ input, init });
      return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
    },
    getToken: async () => token,
  };
  return { deps, calls };
};

const failure = async (status: number, body: unknown): Promise<FreePracticeApiError> => {
  try {
    await requestFreeSentences(payload, depsFor(status, body).deps);
  } catch (err) {
    assert.ok(err instanceof FreePracticeApiError, String(err));
    return err as FreePracticeApiError;
  }
  throw new Error('oczekiwano błędu');
};

test('sukces: zdania, limit i pozostałe generowania; żądanie z tokenem Bearer i JSON-em', async () => {
  const { deps, calls } = depsFor(200, { exercises: [{ polishSentence: 'a', englishTranslation: 'b', hint: '' }], limit: 10, remaining: 7 });
  const result = await requestFreeSentences(payload, deps);
  assert.deepEqual(result, { exercises: [{ polishSentence: 'a', englishTranslation: 'b', hint: '' }], limit: 10, remaining: 7 });
  assert.equal(calls[0].input, '/api/free-practice/generate');
  assert.equal(FREE_PRACTICE_ENDPOINT, '/api/free-practice/generate');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
});

test('lektor: limit i remaining null (bez limitu); brak tokenu nie wysyła nagłówka Authorization', async () => {
  const { deps, calls } = depsFor(200, { exercises: [{ polishSentence: 'a', englishTranslation: 'b', hint: '' }], limit: null, remaining: null }, null);
  const result = await requestFreeSentences(payload, deps);
  assert.deepEqual([result.limit, result.remaining], [null, null]);
  assert.equal('Authorization' in calls[0].init.headers, false);
});

test('429 daily_limit → błąd z limitem i chwilą odnowienia (UI pokazuje komunikat z i18n, nie tekst serwera)', async () => {
  const err = await failure(429, { error: 'daily_limit', message: 'x', limit: 10, used: 10, resetsAt: '2026-10-10T22:00:00.000Z' });
  assert.deepEqual([err.code, err.limit, err.resetsAt], ['daily_limit', 10, '2026-10-10T22:00:00.000Z']);
});

test('pozostałe błędy mapują się na kody: 400, 401, 503 ai_unavailable, 502/500, zepsuta odpowiedź, pusta lista, sieć', async () => {
  assert.equal((await failure(400, { error: 'empty_scope', message: 'Wybierz temat' })).code, 'bad_request');
  assert.equal((await failure(401, { error: 'Invalid or expired token' })).code, 'unauthorized');
  assert.equal((await failure(503, { error: 'ai_unavailable' })).code, 'ai_unavailable');
  assert.equal((await failure(502, { error: 'generation_failed', message: 'Nie udało się' })).code, 'generation_failed');
  assert.equal((await failure(500, '<html>boom</html>')).code, 'generation_failed');
  assert.equal((await failure(200, { exercises: [] })).code, 'generation_failed', 'pusta lista to nie sukces');
  assert.equal((await failure(200, 'nie json')).code, 'generation_failed');
  let thrown: unknown;
  try {
    await requestFreeSentences(payload, { fetch: async () => { throw new Error('offline'); }, getToken: async () => 't' });
  } catch (e) {
    thrown = e;
  }
  assert.equal((thrown as FreePracticeApiError).code, 'network');
});

test('każdy kod błędu ma komunikat w pl.json i en.json (bez tekstów z LLM i z serwera)', () => {
  const pl = JSON.parse(readFileSync(new URL('../pl.json', import.meta.url), 'utf8')) as Record<string, string>;
  const en = JSON.parse(readFileSync(new URL('../en.json', import.meta.url), 'utf8')) as Record<string, string>;
  const codes: FreePracticeErrorCode[] = ['daily_limit', 'generation_failed', 'ai_unavailable', 'bad_request', 'unauthorized', 'network'];
  for (const code of codes) {
    const key = freePracticeErrorKey(code);
    assert.ok(key in pl, `pl: ${key}`);
    assert.ok(key in en && en[key].trim() !== '', `en: ${key}`);
    assert.doesNotMatch(key, /[.:]/, `klucz z kropką lub dwukropkiem → separatory i18next: ${key}`);
  }
  assert.match(freePracticeErrorKey('daily_limit'), /\{\{limit\}\}/);
  assert.equal(new Set(codes.map(freePracticeErrorKey)).size, codes.length, 'każdy kod ma własny komunikat');
});

test('klient nie importuje Firebase (token i fetch wstrzykuje wywołujący)', () => {
  const src = readFileSync(new URL('../services/freePracticeApi.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /from ['"].*firebase/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PER_DAY_LIMIT,
  DEFAULT_PER_MINUTE_LIMIT,
  GEMINI_MAX_OUTPUT_TOKENS_CEILING,
  clampGeminiConfig,
  isProxyExempt,
  reserveProxyCall,
  resolveProxyLimits,
} from '../utils/geminiProxyGuard';
import type { UsageDb } from '../utils/freePracticeQuota';

/** Minimalna baza w pamięci spełniająca UsageDb (transakcje wykonują się szeregowo). */
const fakeDb = () => {
  const store = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db: UsageDb = {
    collection: (name) => ({ doc: (id) => `${name}/${id}` }),
    runTransaction: async (update) =>
      update({
        get: async (ref) => ({ exists: store.has(ref as string), data: () => store.get(ref as string) }),
        set: (ref, data) => { writes += 1; store.set(ref as string, { ...(store.get(ref as string) || {}), ...data }); },
      }),
  };
  return { db, store, writes: () => writes };
};
const at = (iso: string) => new Date(iso);

test('resolveProxyLimits: domyślne, z env, zła wartość -> domyślna', () => {
  assert.deepEqual(resolveProxyLimits({}), { perMinute: DEFAULT_PER_MINUTE_LIMIT, perDay: DEFAULT_PER_DAY_LIMIT });
  assert.deepEqual(resolveProxyLimits({ GEMINI_PROXY_PER_MINUTE: '10', GEMINI_PROXY_PER_DAY: '99' }), { perMinute: 10, perDay: 99 });
  assert.deepEqual(resolveProxyLimits({ GEMINI_PROXY_PER_MINUTE: '0', GEMINI_PROXY_PER_DAY: 'abc' }), { perMinute: DEFAULT_PER_MINUTE_LIMIT, perDay: DEFAULT_PER_DAY_LIMIT });
});

test('limit na minutę: rezerwuje do limitu, potem odmowa bez zapisu, nowa minuta zeruje licznik minutowy', async () => {
  const { db, writes } = fakeDb();
  const limits = { perMinute: 2, perDay: 100 };
  assert.equal((await reserveProxyCall(db, 'u1', at('2026-10-10T10:00:05Z'), limits)).ok, true);
  assert.equal((await reserveProxyCall(db, 'u1', at('2026-10-10T10:00:30Z'), limits)).ok, true);
  const w = writes();
  const denied = await reserveProxyCall(db, 'u1', at('2026-10-10T10:00:40Z'), limits);
  assert.deepEqual(denied, { ok: false, reason: 'minute', retryAfterSec: 20 });
  assert.equal(writes(), w, 'odmowa niczego nie zapisuje');
  assert.equal((await reserveProxyCall(db, 'u1', at('2026-10-10T10:01:00Z'), limits)).ok, true);
});

test('limit dobowy (dzień Europe/Warsaw): odmowa po wyczerpaniu, odnawia się następnego dnia', async () => {
  const { db } = fakeDb();
  const limits = { perMinute: 100, perDay: 3 };
  for (let i = 0; i < 3; i += 1) assert.equal((await reserveProxyCall(db, 'u1', at(`2026-10-10T1${i}:00:00Z`), limits)).ok, true);
  const denied = await reserveProxyCall(db, 'u1', at('2026-10-10T15:00:00Z'), limits);
  assert.equal(denied.ok === false && denied.reason, 'day');
  // 22:30 UTC to już 00:30 następnego dnia w Warszawie (CEST)
  assert.equal((await reserveProxyCall(db, 'u1', at('2026-10-10T22:30:00Z'), limits)).ok, true);
});

test('liczniki są niezależne między użytkownikami', async () => {
  const { db } = fakeDb();
  const limits = { perMinute: 1, perDay: 10 };
  assert.equal((await reserveProxyCall(db, 'a', at('2026-10-10T10:00:00Z'), limits)).ok, true);
  assert.equal((await reserveProxyCall(db, 'b', at('2026-10-10T10:00:00Z'), limits)).ok, true);
  assert.equal((await reserveProxyCall(db, 'a', at('2026-10-10T10:00:01Z'), limits)).ok, false);
});

test('isProxyExempt: lektor, admin, admin_student i adres admina; kursant nie', () => {
  for (const role of ['teacher', 'admin', 'admin_student']) assert.equal(isProxyExempt(role, false), true, role);
  assert.equal(isProxyExempt('user', true), true);
  assert.equal(isProxyExempt('user', false), false);
  assert.equal(isProxyExempt(undefined, false), false);
});

test('clampGeminiConfig: tnie tylko maxOutputTokens ponad sufit; reszta konfiguracji (tools, thinkingConfig) nietknięta', () => {
  const cfg = { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 1_000_000 };
  const out = clampGeminiConfig(cfg);
  assert.equal(out.maxOutputTokens, GEMINI_MAX_OUTPUT_TOKENS_CEILING);
  assert.deepEqual(out.tools, cfg.tools);
  assert.deepEqual(out.thinkingConfig, cfg.thinkingConfig);
  assert.equal(cfg.maxOutputTokens, 1_000_000, 'wejście nie jest mutowane');
  const ok = { maxOutputTokens: 8192 };
  assert.equal(clampGeminiConfig(ok), ok);
  assert.equal(clampGeminiConfig(undefined), undefined);
  const noMax = { responseMimeType: 'application/json' };
  assert.equal(clampGeminiConfig(noMax), noMax);
});

// Cała kolejność trasy /api/free-practice/generate na atrapach: limit dzienny, zwrot slotu,
// zwolnienie lektora, równoległość, personalizacja po stronie serwera, logi bez treści tematów.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleFreePracticeGenerate, hashUid, type HandlerDeps } from '../utils/freePracticeHandler';
import { FREE_PRACTICE_USAGE_COLLECTION, usageDocId, type UsageDb } from '../utils/freePracticeQuota';
import { FREE_PRACTICE_MODEL, type CallModel } from '../utils/freePracticeGeneration';

// --- Atrapa bazy: licznik z optymistyczną współbieżnością + dokumenty do odczytu -----------

class FakeDb implements UsageDb {
  docs = new Map<string, Record<string, any>>();
  versions = new Map<string, number>();
  reads: string[] = [];
  constructor(seed: Record<string, any> = {}) {
    for (const [k, v] of Object.entries(seed)) this.docs.set(k, v);
  }
  private snap(path: string) {
    return { exists: this.docs.has(path), id: path.split('/').pop()!, data: () => this.docs.get(path) };
  }
  collection(name: string): any {
    const self = this;
    const docRef = (path: string): any => ({
      __path: path,
      get: async () => {
        self.reads.push(path);
        return self.snap(path);
      },
      collection: (sub: string) => self.collection(`${path}/${sub}`),
    });
    return {
      doc: (id: string) => (name.startsWith('users/') || name === 'users' || name === FREE_PRACTICE_USAGE_COLLECTION ? docRef(`${name}/${id}`) : docRef(`${name}/${id}`)),
      orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
    };
  }
  async runTransaction<T>(update: (tx: any) => Promise<T>): Promise<T> {
    for (;;) {
      const readVersions = new Map<string, number>();
      const writes: Array<[string, Record<string, any>]> = [];
      const tx = {
        get: async (ref: any) => {
          const path = ref.__path;
          readVersions.set(path, this.versions.get(path) ?? 0);
          await new Promise((r) => setImmediate(r));
          return this.snap(path);
        },
        set: (ref: any, data: Record<string, any>) => writes.push([ref.__path, data]),
      };
      const result = await update(tx);
      await new Promise((r) => setImmediate(r));
      if ([...readVersions].some(([p, v]) => (this.versions.get(p) ?? 0) !== v)) continue;
      for (const [p, d] of writes) {
        this.docs.set(p, { ...(this.docs.get(p) ?? {}), ...d });
        this.versions.set(p, (this.versions.get(p) ?? 0) + 1);
      }
      return result;
    }
  }
  usage(uid: string, day = '2026-10-10'): number {
    return Number(this.docs.get(`${FREE_PRACTICE_USAGE_COLLECTION}/${usageDocId(uid, day)}`)?.count ?? 0);
  }
}

const sentences = (n = 3) =>
  JSON.stringify({
    sentences: Array.from({ length: n }, (_, i) => ({
      english_sentence: `I travel by train number ${i + 1}.`,
      polish_translation: `Podróżuję pociągiem numer ${i + 1}.`,
      hint: 'travel — Present Simple',
      target_word_used: 'travel',
      puzzleChunks: ['I travel', 'by train', `number ${i + 1}`],
    })),
  });

const NOW = new Date('2026-10-10T10:00:00Z');
const body = { format: 'translation', topics: ['podróże'], words: [], lessonRecordIds: [], count: 3 };

function setup(over: Partial<HandlerDeps> = {}, seed: Record<string, any> = {}, replies: Array<string | Error> = [sentences()]) {
  const db = new FakeDb({ 'users/stu': { role: 'user', level: 'A2' }, 'users/teach': { role: 'teacher' }, ...seed });
  const prompts: string[] = [];
  const logs: Array<Record<string, string | number>> = [];
  let calls = 0;
  const callModel: CallModel = async ({ prompt }) => {
    prompts.push(prompt);
    const next = replies[Math.min(calls++, replies.length - 1)];
    if (next instanceof Error) throw next;
    return { text: next, modelUsed: FREE_PRACTICE_MODEL };
  };
  const deps: HandlerDeps = {
    usageDb: db,
    contextDb: db as any,
    modelAvailable: true,
    callModel,
    limit: 10,
    now: () => NOW,
    log: (entry) => logs.push(entry),
    ...over,
  };
  return { db, deps, prompts, logs, calls: () => calls };
}

test('sukces: zdania w kształcie generatora, licznik +1, pozostałe generowania, wpis w logu', async () => {
  const { db, deps, logs } = setup();
  const res = await handleFreePracticeGenerate(deps, { uid: 'stu', body });
  assert.equal(res.status, 200);
  assert.equal((res.body.exercises as unknown[]).length, 3);
  assert.deepEqual([res.body.limit, res.body.remaining], [10, 9]);
  assert.equal(db.usage('stu'), 1);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].outcome, 'ok');
});

test('LIMIT DZIENNY: 10 udanych generowań, 11. dostaje 429 z limitem i chwilą odnowienia, bez wywołania modelu', async () => {
  const { db, deps, calls } = setup();
  for (let i = 1; i <= 10; i++) {
    const res = await handleFreePracticeGenerate(deps, { uid: 'stu', body });
    assert.equal(res.status, 200, `#${i}`);
    assert.equal(res.body.remaining, 10 - i);
  }
  const callsBefore = calls();
  const denied = await handleFreePracticeGenerate(deps, { uid: 'stu', body });
  assert.equal(denied.status, 429);
  assert.deepEqual([denied.body.error, denied.body.limit, denied.body.used], ['daily_limit', 10, 10]);
  assert.equal(denied.body.resetsAt, '2026-10-10T22:00:00.000Z', 'północ w Warszawie (CEST)');
  assert.equal(calls(), callsBefore, 'po wyczerpaniu limitu nie kosztuje ani jednego wywołania Gemini');
  assert.equal(db.usage('stu'), 10);
});

test('limit konfigurowalny i liczony na kursanta; inny kursant ma własny licznik', async () => {
  const { deps, db } = setup({ limit: 2 }, { 'users/stu2': { role: 'user' } });
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body })).status, 200);
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body })).status, 200);
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body })).status, 429);
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu2', body })).status, 200);
  assert.equal(db.usage('stu2'), 1);
});

test('następny dzień (czas Warszawy) odnawia limit', async () => {
  let clock = NOW;
  const { deps } = setup({ limit: 1, now: () => clock });
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body })).status, 200);
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body })).status, 429);
  clock = new Date('2026-10-10T22:00:00Z'); // 00:00 następnego dnia lokalnego
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body })).status, 200);
});

test('LEKTOR i administrator (rola z dokumentu w bazie) bez limitu i bez zapisu licznika; klient nie może się podszyć', async () => {
  const { deps, db } = setup({ limit: 1 }, { 'users/adm': { role: 'admin' } });
  for (let i = 0; i < 5; i++) {
    const res = await handleFreePracticeGenerate(deps, { uid: 'teach', body });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.limit, res.body.remaining], [null, null]);
  }
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'adm', body })).status, 200);
  assert.equal([...db.docs.keys()].some((k) => k.startsWith(FREE_PRACTICE_USAGE_COLLECTION)), false, 'bez licznika dla lektora');
  // kursant podszywający się w treści żądania pozostaje limitowany
  const forged = { ...body, role: 'teacher', uid: 'teach', unlimited: true, limit: 999 };
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body: forged })).status, 200);
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'stu', body: forged })).status, 429);
  // nieistniejący dokument kursanta = brak roli = limit
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'nowy', body })).status, 200);
  assert.equal((await handleFreePracticeGenerate(deps, { uid: 'nowy', body })).status, 429);
});

test('ZWROT SLOTU przy błędzie modelu i przy niepoprawnym wyniku — licznik wraca, kursant nie traci generowania', async () => {
  const failing = setup({ limit: 3 }, {}, [new Error('503 Service Unavailable')]);
  const res = await handleFreePracticeGenerate(failing.deps, { uid: 'stu', body });
  assert.equal(res.status, 502);
  assert.equal(res.body.error, 'generation_failed');
  assert.equal(failing.db.usage('stu'), 0, 'slot zwrócony');
  assert.equal(failing.logs.at(-1)!.outcome, 'model_failed');

  const garbage = setup({ limit: 3 }, {}, ['nie JSON', '{"zle":1}']);
  const res2 = await handleFreePracticeGenerate(garbage.deps, { uid: 'stu', body });
  assert.equal(res2.status, 502);
  assert.equal(garbage.calls(), 2, 'dokładnie jedno ponowienie');
  assert.equal(garbage.db.usage('stu'), 0, 'slot zwrócony także po niepoprawnym JSON-ie');
  assert.equal(garbage.logs.at(-1)!.outcome, 'invalid_output');

  // po porażkach kursant ma pełny limit
  const ok = setup({ limit: 3 }, {}, [new Error('boom'), new Error('boom'), new Error('boom'), sentences()]);
  for (let i = 0; i < 3; i++) await handleFreePracticeGenerate(ok.deps, { uid: 'stu', body });
  assert.equal((await handleFreePracticeGenerate(ok.deps, { uid: 'stu', body })).status, 200);
  assert.equal(ok.db.usage('stu'), 1);
});

test('zwrot slotu, który się nie udaje, nie psuje odpowiedzi i jest zgłaszany', async () => {
  const errors: unknown[] = [];
  const { deps, db } = setup({ onReleaseError: (e) => errors.push(e) }, {}, [new Error('boom')]);
  const original = db.runTransaction.bind(db);
  let transactions = 0;
  db.runTransaction = async (fn: any) => {
    if (++transactions === 2) throw new Error('release failed');
    return original(fn);
  };
  const res = await handleFreePracticeGenerate(deps, { uid: 'stu', body });
  assert.equal(res.status, 502);
  assert.equal(errors.length, 1);
});

test('żądanie bez zakresu, ze złym formatem albo za dużą liczbą tematów: 400 i ZERO zużytego slotu', async () => {
  const { deps, db, calls } = setup();
  const bad = [{}, { format: 'quiz', topics: ['a'] }, { format: 'translation' }, { format: 'translation', topics: ['a', 'b', 'c', 'd'] }, { format: 'translation', topics: [5] }, null];
  for (const payload of bad) {
    const res = await handleFreePracticeGenerate(deps, { uid: 'stu', body: payload });
    assert.equal(res.status, 400, JSON.stringify(payload));
  }
  assert.equal(db.usage('stu'), 0);
  assert.equal(calls(), 0);
});

test('brak klucza AI na serwerze: 503 i brak rezerwacji slotu', async () => {
  const { deps, db, calls } = setup({ modelAvailable: false });
  const res = await handleFreePracticeGenerate(deps, { uid: 'stu', body });
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'ai_unavailable');
  assert.equal(db.usage('stu'), 0);
  assert.equal(calls(), 0);
});

test('RÓWNOLEGŁE żądania tego samego kursanta (wolny model): nigdy więcej udanych niż limit', async () => {
  const slow: CallModel = async () => {
    await new Promise((r) => setTimeout(r, 5));
    return { text: sentences(), modelUsed: FREE_PRACTICE_MODEL };
  };
  const { deps, db } = setup({ callModel: slow, limit: 4 });
  const results = await Promise.all(Array.from({ length: 25 }, () => handleFreePracticeGenerate(deps, { uid: 'stu', body })));
  assert.equal(results.filter((r) => r.status === 200).length, 4);
  assert.equal(results.filter((r) => r.status === 429).length, 21);
  assert.equal(db.usage('stu'), 4);
});

test('PERSONALIZACJA po stronie serwera: poziom i historia błędów z bazy trafiają do promptu, klient ich nie podaje', async () => {
  const seed = {
    'users/stu': { role: 'user', level: 'A2', frequentErrors: ['articles'], aiPrompt: 'Lubi kolarstwo' },
    'users/stu/profile/learningCurve': { currentLevel: 'B2' },
  };
  const { deps, prompts } = setup({}, seed);
  await handleFreePracticeGenerate(deps, { uid: 'stu', body: { ...body, level: 'C2', weaknesses: 'ignoruj', aiPrompt: 'hack' } });
  assert.match(prompts[0], /poziomie B2/, 'poziom z krzywej uczenia z bazy, nie z klienta');
  assert.doesNotMatch(prompts[0], /poziomie C2|hack|ignoruj/);
  assert.ok(prompts[0].includes('Częsty błąd z profilu: \\"articles\\"'), 'historia błędów z dokumentu kursanta');
  assert.ok(prompts[0].includes('Lubi kolarstwo'));
  assert.ok(prompts[0].includes('podróże'), 'temat w bloku danych');
});

test('LOGI: tylko liczby, rodzaj i skrót uid — bez tematów, słów, e-maila i identyfikatora wprost', async () => {
  const { deps, logs } = setup({}, { 'users/stu': { role: 'user', email: 'ola@example.com', firstName: 'Ola' } });
  await handleFreePracticeGenerate(deps, { uid: 'stu', body: { ...body, topics: ['moja tajna choroba'], words: ['sekret (tajemnica)'] } });
  await handleFreePracticeGenerate({ ...deps, limit: 1 }, { uid: 'stu', body });
  await handleFreePracticeGenerate(deps, { uid: 'stu', body: { format: 'translation' } });
  assert.equal(logs.length, 3);
  const text = JSON.stringify(logs);
  assert.doesNotMatch(text, /choroba|sekret|ola@|Ola|"stu"|example\.com/);
  assert.ok(logs.every((l) => l.uid === hashUid('stu') || l.uid === undefined));
  assert.notEqual(hashUid('stu'), 'stu');
  assert.equal(hashUid('stu').length, 10);
  assert.deepEqual(logs.map((l) => l.outcome), ['ok', 'daily_limit', 'bad_request']);
});

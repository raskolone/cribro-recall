// Dzienny limit generowań: klucz dnia w Europe/Warsaw, rezerwacja i zwrot slotu w transakcji.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FREE_PRACTICE_DAILY_LIMIT,
  FREE_PRACTICE_USAGE_COLLECTION,
  isUnlimitedRole,
  nextWarsawMidnight,
  releaseSlot,
  reserveSlot,
  resolveDailyLimit,
  usageDocId,
  warsawDayKey,
  type UsageDb,
} from '../utils/freePracticeQuota';

// --- Atrapa Firestore z optymistyczną współbieżnością (jak prawdziwy: konflikt → ponowienie) ---

class FakeFirestore implements UsageDb {
  docs = new Map<string, Record<string, unknown>>();
  versions = new Map<string, number>();
  commits = 0;
  retries = 0;

  collection(name: string) {
    return { doc: (id: string) => `${name}/${id}` };
  }

  async runTransaction<T>(update: (tx: any) => Promise<T>): Promise<T> {
    for (;;) {
      const readVersions = new Map<string, number>();
      const writes: Array<[string, Record<string, unknown>, boolean]> = [];
      const tx = {
        get: async (ref: string) => {
          readVersions.set(ref, this.versions.get(ref) ?? 0);
          await new Promise((resolve) => setImmediate(resolve)); // oddaje sterowanie — żądania się przeplatają
          const data = this.docs.get(ref);
          return { exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
        },
        set: (ref: string, data: Record<string, unknown>, options?: { merge?: boolean }) => {
          writes.push([ref, data, Boolean(options?.merge)]);
        },
      };
      const result = await update(tx);
      await new Promise((resolve) => setImmediate(resolve));
      const conflict = [...readVersions].some(([ref, version]) => (this.versions.get(ref) ?? 0) !== version);
      if (conflict) {
        this.retries++;
        continue;
      }
      for (const [ref, data, merge] of writes) {
        this.docs.set(ref, merge ? { ...(this.docs.get(ref) ?? {}), ...data } : data);
        this.versions.set(ref, (this.versions.get(ref) ?? 0) + 1);
      }
      if (writes.length > 0) this.commits++;
      return result;
    }
  }

  count(uid: string, day: string): number {
    return Number(this.docs.get(`${FREE_PRACTICE_USAGE_COLLECTION}/${usageDocId(uid, day)}`)?.count ?? 0);
  }
}

const noon = new Date('2026-10-10T10:00:00Z');

test('klucz dnia: strefa Europe/Warsaw, nie UTC — granica o północy czasu lokalnego (czas zimowy CET)', () => {
  assert.equal(warsawDayKey(new Date('2026-01-14T22:59:59Z')), '2026-01-14'); // 23:59:59 CET
  assert.equal(warsawDayKey(new Date('2026-01-14T23:00:00Z')), '2026-01-15'); // 00:00:00 CET
  assert.equal(warsawDayKey(new Date('2026-01-14T23:30:00Z')), '2026-01-15', 'UTC jeszcze „14", w Warszawie już „15"');
});

test('klucz dnia: czas letni (CEST) przesuwa granicę na 22:00 UTC', () => {
  assert.equal(warsawDayKey(new Date('2026-06-30T21:59:59Z')), '2026-06-30'); // 23:59:59 CEST
  assert.equal(warsawDayKey(new Date('2026-06-30T22:00:00Z')), '2026-07-01'); // 00:00:00 CEST
});

test('klucz dnia: przejście na czas letni (2026-03-29) i zimowy (2026-10-25) — dzień ma 23 i 25 godzin', () => {
  // Wiosna: o 02:00 CET zegar skacze na 03:00 CEST (01:00 UTC). Dzień 29.03 trwa 23 h.
  assert.equal(warsawDayKey(new Date('2026-03-28T22:59:59Z')), '2026-03-28');
  assert.equal(warsawDayKey(new Date('2026-03-28T23:00:00Z')), '2026-03-29'); // 00:00 CET
  assert.equal(warsawDayKey(new Date('2026-03-29T01:00:00Z')), '2026-03-29'); // 03:00 CEST
  assert.equal(warsawDayKey(new Date('2026-03-29T21:59:59Z')), '2026-03-29'); // 23:59:59 CEST
  assert.equal(warsawDayKey(new Date('2026-03-29T22:00:00Z')), '2026-03-30'); // 00:00 CEST
  // Jesień: o 03:00 CEST zegar cofa się na 02:00 CET (01:00 UTC). Dzień 25.10 trwa 25 h.
  assert.equal(warsawDayKey(new Date('2026-10-24T21:59:59Z')), '2026-10-24');
  assert.equal(warsawDayKey(new Date('2026-10-24T22:00:00Z')), '2026-10-25'); // 00:00 CEST
  assert.equal(warsawDayKey(new Date('2026-10-25T00:30:00Z')), '2026-10-25'); // 02:30 CEST
  assert.equal(warsawDayKey(new Date('2026-10-25T01:30:00Z')), '2026-10-25'); // 02:30 CET (druga)
  assert.equal(warsawDayKey(new Date('2026-10-25T22:59:59Z')), '2026-10-25'); // 23:59:59 CET
  assert.equal(warsawDayKey(new Date('2026-10-25T23:00:00Z')), '2026-10-26'); // 00:00 CET
});

test('odnowienie limitu: pierwsza sekunda następnego dnia lokalnego, także w dniach przejścia czasu', () => {
  assert.equal(nextWarsawMidnight(new Date('2026-01-14T12:00:00Z')).toISOString(), '2026-01-14T23:00:00.000Z');
  assert.equal(nextWarsawMidnight(new Date('2026-06-30T12:00:00Z')).toISOString(), '2026-06-30T22:00:00.000Z');
  assert.equal(nextWarsawMidnight(new Date('2026-03-29T00:30:00Z')).toISOString(), '2026-03-29T22:00:00.000Z', 'dzień 23-godzinny');
  assert.equal(nextWarsawMidnight(new Date('2026-10-25T00:30:00Z')).toISOString(), '2026-10-25T23:00:00.000Z', 'dzień 25-godzinny');
  const at = new Date('2026-10-10T21:59:59Z');
  const reset = nextWarsawMidnight(at);
  assert.notEqual(warsawDayKey(reset), warsawDayKey(at));
  assert.equal(warsawDayKey(new Date(reset.getTime() - 1000)), warsawDayKey(at));
});

test('limit z konfiguracji: domyślnie 10, dodatnia liczba całkowita nadpisuje, śmieci wracają do domyślnego', () => {
  assert.equal(DEFAULT_FREE_PRACTICE_DAILY_LIMIT, 10);
  assert.equal(resolveDailyLimit(undefined), 10);
  assert.equal(resolveDailyLimit(''), 10);
  assert.equal(resolveDailyLimit('25'), 25);
  assert.equal(resolveDailyLimit(3), 3);
  for (const bad of ['0', '-4', '2.5', 'dużo', null, NaN]) assert.equal(resolveDailyLimit(bad as any), 10, String(bad));
  assert.equal(resolveDailyLimit('999999'), 1000, 'sufit');
});

test('lektor i administrator bez limitu — decyduje rola, każda inna wartość limitowana', () => {
  assert.equal(isUnlimitedRole('teacher'), true);
  assert.equal(isUnlimitedRole('admin'), true);
  for (const role of ['user', undefined, null, '', 'Teacher', 'student', 1, {}]) assert.equal(isUnlimitedRole(role), false, String(role));
});

test('rezerwacja: dokument freePracticeUsage/{uid}_{dzień}, licznik rośnie, po limicie odmowa bez zapisu', async () => {
  const db = new FakeFirestore();
  for (let i = 1; i <= 10; i++) {
    const r = await reserveSlot(db, 'u1', noon, 10);
    assert.deepEqual([r.ok, r.used, r.limit, r.day], [true, i, 10, '2026-10-10']);
  }
  const commitsBefore = db.commits;
  const denied = await reserveSlot(db, 'u1', noon, 10);
  assert.equal(denied.ok, false);
  assert.equal(denied.used, 10);
  assert.equal(db.commits, commitsBefore, 'odmowa nic nie zapisuje');
  assert.equal(db.count('u1', '2026-10-10'), 10);
  assert.ok(db.docs.has('freePracticeUsage/u1_2026-10-10'));
  assert.deepEqual(Object.keys(db.docs.get('freePracticeUsage/u1_2026-10-10')!).sort(), ['count', 'day', 'uid', 'updatedAt']);
});

test('rezerwacja: kursanci i dni liczone osobno — następny dzień lokalny zaczyna od zera', async () => {
  const db = new FakeFirestore();
  assert.equal((await reserveSlot(db, 'u1', noon, 1)).ok, true);
  assert.equal((await reserveSlot(db, 'u1', noon, 1)).ok, false);
  assert.equal((await reserveSlot(db, 'u2', noon, 1)).ok, true, 'inny kursant');
  const tomorrow = new Date('2026-10-10T22:00:00Z'); // 00:00 CEST następnego dnia
  const next = await reserveSlot(db, 'u1', tomorrow, 1);
  assert.deepEqual([next.ok, next.day], [true, '2026-10-11']);
});

test('RÓWNOLEGŁE żądania: nigdy więcej niż limit, dokładnie limit zakończonych sukcesem', async () => {
  const db = new FakeFirestore();
  const results = await Promise.all(Array.from({ length: 30 }, () => reserveSlot(db, 'u1', noon, 10)));
  assert.equal(results.filter((r) => r.ok).length, 10);
  assert.equal(results.filter((r) => !r.ok).length, 20);
  assert.equal(db.count('u1', '2026-10-10'), 10);
  assert.ok(db.retries > 0, 'atrapa rzeczywiście wymusiła konflikty — test ma sens');
  assert.deepEqual(
    results.filter((r) => r.ok).map((r) => r.used).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'każdy sukces dostał inny numer slotu',
  );
});

test('RÓWNOLEGŁE rezerwacje i zwroty: licznik nigdy nie przekracza limitu ani nie spada poniżej zera', async () => {
  const db = new FakeFirestore();
  const work = Array.from({ length: 40 }, async (_, i) => {
    const r = await reserveSlot(db, 'u1', noon, 5);
    if (r.ok && i % 2 === 0) await releaseSlot(db, 'u1', r.day);
    return r;
  });
  await Promise.all(work);
  const final = db.count('u1', '2026-10-10');
  assert.ok(final >= 0 && final <= 5, `licznik ${final}`);
});

test('zwrot slotu: o jeden w dół, nigdy poniżej zera, z dniem z rezerwacji (północ w trakcie generowania)', async () => {
  const db = new FakeFirestore();
  const r = await reserveSlot(db, 'u1', new Date('2026-10-10T21:59:50Z'), 10); // 23:59:50 CEST
  assert.equal(r.day, '2026-10-10');
  await releaseSlot(db, 'u1', r.day, new Date('2026-10-10T22:00:10Z')); // „po północy"
  assert.equal(db.count('u1', '2026-10-10'), 0, 'zwrot trafił do dnia rezerwacji');
  assert.equal(db.count('u1', '2026-10-11'), 0, 'nie założył licznika nowego dnia');
  await releaseSlot(db, 'u1', '2026-10-10');
  await releaseSlot(db, 'u1', '2026-10-10');
  assert.equal(db.count('u1', '2026-10-10'), 0);
  assert.equal((await reserveSlot(db, 'u1', noon, 10)).used, 1);
});

test('odczyt licznika siedzi W transakcji (mutacja: odczyt poza nią przepuściłby ponad limit)', async () => {
  const db = new FakeFirestore();
  // Wersja błędna: odczyt przed transakcją, zapis w transakcji — dokładnie to, czego robić nie wolno.
  const broken = async () => {
    const ref = db.collection(FREE_PRACTICE_USAGE_COLLECTION).doc(usageDocId('u1', '2026-10-10'));
    const before = Number(db.docs.get(ref as string)?.count ?? 0);
    await new Promise((resolve) => setImmediate(resolve));
    if (before >= 3) return false;
    await db.runTransaction(async (tx) => {
      tx.set(ref, { count: before + 1 }, { merge: true });
    });
    return true;
  };
  const wrong = await Promise.all(Array.from({ length: 12 }, broken));
  assert.ok(wrong.filter(Boolean).length > 3, 'błędny wariant łamie limit — więc atrapa wykrywa błąd');
  const db2 = new FakeFirestore();
  const good = await Promise.all(Array.from({ length: 12 }, () => reserveSlot(db2, 'u1', noon, 3)));
  assert.equal(good.filter((r) => r.ok).length, 3);
});

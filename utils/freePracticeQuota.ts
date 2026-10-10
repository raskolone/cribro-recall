/**
 * Dzienny limit generowań zdań w Ćwiczeniach dowolnych — logika bez Firebase i bez Express.
 *
 * Licznik leży w `freePracticeUsage/{uid}_{YYYY-MM-DD}` i jest zapisywany WYŁĄCZNIE po stronie
 * serwera przez Admin SDK (omija reguły Firestore, więc `firestore.rules` zostają bez zmian, a
 * klient nie ma żadnej ścieżki do tej kolekcji). Dzień liczony w strefie Europe/Warsaw — kursant
 * ma „swoją północ", a nie północ UTC.
 *
 * Rezerwacja slotu to transakcja Firestore: odczyt licznika i zapis w jednej transakcji, więc przy
 * równoległych żądaniach Firestore ponawia konfliktujące transakcje i licznik nigdy nie przekroczy
 * limitu. Zwrot slotu (błąd Gemini) też w transakcji, nigdy poniżej zera.
 */

export const FREE_PRACTICE_USAGE_COLLECTION = 'freePracticeUsage';
export const FREE_PRACTICE_TIME_ZONE = 'Europe/Warsaw';
/** Domyślny dzienny limit generowań na kursanta; nadpisywalny zmienną `FREE_PRACTICE_DAILY_LIMIT`. */
export const DEFAULT_FREE_PRACTICE_DAILY_LIMIT = 10;
const MAX_CONFIGURABLE_LIMIT = 1000;

/** Limit z konfiguracji (np. `process.env`): dodatnia liczba całkowita, inaczej domyślny. */
export function resolveDailyLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_FREE_PRACTICE_DAILY_LIMIT;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(value) || value < 1) return DEFAULT_FREE_PRACTICE_DAILY_LIMIT;
  return Math.min(value, MAX_CONFIGURABLE_LIMIT);
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FREE_PRACTICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Klucz dnia `YYYY-MM-DD` w strefie Europe/Warsaw (z uwzględnieniem czasu letniego). */
export function warsawDayKey(date: Date): string {
  return dayFormatter.format(date);
}

/** Pierwsza chwila następnego dnia w Europe/Warsaw — kiedy limit się odnawia. */
export function nextWarsawMidnight(date: Date): Date {
  const today = warsawDayKey(date);
  // Dzień ma 23–25 godzin; szukamy pierwszej CAŁEJ sekundy z innym kluczem dnia (bisekcja).
  let low = Math.floor(date.getTime() / 1000);
  let high = low + 26 * 3600;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (warsawDayKey(new Date(mid * 1000)) === today) low = mid;
    else high = mid;
  }
  return new Date(high * 1000);
}

export function usageDocId(uid: string, dayKey: string): string {
  return `${uid}_${dayKey}`;
}

/** Konta lektora i administratora nie mają limitu; rola pochodzi z dokumentu w bazie, nie z klienta. */
export function isUnlimitedRole(role: unknown): boolean {
  return role === 'teacher' || role === 'admin';
}

// --- Minimalny interfejs Firestore (Admin SDK spełnia go wprost) ---------------------------

export interface UsageSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
export interface UsageTransaction {
  get(ref: unknown): Promise<UsageSnapshot>;
  set(ref: unknown, data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
}
export interface UsageDb {
  collection(name: string): { doc(id: string): unknown };
  runTransaction<T>(update: (tx: UsageTransaction) => Promise<T>): Promise<T>;
}

export interface Reservation {
  ok: boolean;
  /** Ile generowań zużyto w tym dniu (po rezerwacji, gdy `ok`). */
  used: number;
  limit: number;
  day: string;
}

const countOf = (snap: UsageSnapshot): number => {
  const raw = snap.exists ? snap.data()?.count : 0;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
};

/** Rezerwuje jeden slot generowania; przy wyczerpanym limicie nic nie zapisuje. */
export async function reserveSlot(db: UsageDb, uid: string, now: Date, limit: number): Promise<Reservation> {
  const day = warsawDayKey(now);
  const ref = db.collection(FREE_PRACTICE_USAGE_COLLECTION).doc(usageDocId(uid, day));
  return db.runTransaction(async (tx) => {
    const used = countOf(await tx.get(ref));
    if (used >= limit) return { ok: false, used, limit, day };
    tx.set(ref, { uid, day, count: used + 1, updatedAt: now.toISOString() }, { merge: true });
    return { ok: true, used: used + 1, limit, day };
  });
}

/** Zwraca slot (błąd generowania). `day` pochodzi z rezerwacji — przekroczenie północy nic nie psuje. */
export async function releaseSlot(db: UsageDb, uid: string, day: string, now: Date = new Date()): Promise<void> {
  const ref = db.collection(FREE_PRACTICE_USAGE_COLLECTION).doc(usageDocId(uid, day));
  await db.runTransaction(async (tx) => {
    const used = countOf(await tx.get(ref));
    if (used <= 0) return;
    tx.set(ref, { uid, day, count: used - 1, updatedAt: now.toISOString() }, { merge: true });
  });
}

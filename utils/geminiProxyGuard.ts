/**
 * Ochrona kosztowa trasy `POST /api/gemini/generate` — logika bez Firebase i bez Express.
 *
 * Trasa jest cienkim proxy dla całego klienta (kursanci też jej używają), więc NIE może zmieniać
 * semantyki wywołań: modele, `tools`, `thinkingConfig` i `contents` przechodzą bez zmian. Chronimy
 * tylko przed nadużyciem kosztowym:
 * 1. rozmiar ciała żądania (zamiast globalnych 50 MB),
 * 2. limit żądań na użytkownika w minucie i w dobie (hojny; lektor/admin zwolnieni),
 * 3. sufit `maxOutputTokens` równy realnemu maksimum modeli Flash (klient w ogóle go dziś nie ustawia).
 *
 * Licznik leży w `geminiProxyUsage/{uid}`, zapisywany WYŁĄCZNIE przez Admin SDK (omija reguły, więc
 * `firestore.rules` zostają bez zmian, a klient nie ma do kolekcji dostępu). Rezerwacja to transakcja,
 * więc równoległe żądania nie przekroczą limitu. Odrzucone żądanie niczego nie zapisuje — zablokowany
 * użytkownik odzyskuje dostęp, gdy mija okno, a nie dopiero po tym, jak przestanie próbować.
 */
import { warsawDayKey, type UsageDb } from './freePracticeQuota';

export const GEMINI_PROXY_USAGE_COLLECTION = 'geminiProxyUsage';
/**
 * Maksymalne ciało żądania. Klient przesyła sam tekst (żadnych `inlineData` — grep po całym froncie),
 * więc nawet bardzo duży prompt z historią lekcji mieści się w ułamku tej wartości.
 */
export const GEMINI_PROXY_MAX_BODY = '2mb';
/** Realne maksimum wyjścia modeli Gemini 2.5/3 Flash; klient dziś nie ustawia `maxOutputTokens` wcale. */
export const GEMINI_MAX_OUTPUT_TOKENS_CEILING = 65536;
export const DEFAULT_PER_MINUTE_LIMIT = 60;
export const DEFAULT_PER_DAY_LIMIT = 2000;
const MAX_CONFIGURABLE = 100_000;

export interface ProxyLimits {
  perMinute: number;
  perDay: number;
}

const positiveInt = (raw: unknown, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isInteger(value) && value >= 1 ? Math.min(value, MAX_CONFIGURABLE) : fallback;
};

/** Limity z konfiguracji (`GEMINI_PROXY_PER_MINUTE`, `GEMINI_PROXY_PER_DAY`); zła wartość -> domyślna. */
export function resolveProxyLimits(env: Record<string, string | undefined> = process.env): ProxyLimits {
  return {
    perMinute: positiveInt(env.GEMINI_PROXY_PER_MINUTE, DEFAULT_PER_MINUTE_LIMIT),
    perDay: positiveInt(env.GEMINI_PROXY_PER_DAY, DEFAULT_PER_DAY_LIMIT),
  };
}

/** Lektor i administrator (rola z dokumentu w bazie albo adres z listy administratorów) nie mają limitu. */
export function isProxyExempt(role: unknown, isAdminEmail: boolean): boolean {
  return isAdminEmail || role === 'teacher' || role === 'admin' || role === 'admin_student';
}

export type ProxyReservation =
  | { ok: true }
  | { ok: false; reason: 'minute' | 'day'; retryAfterSec: number };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Rezerwuje jedno wywołanie; przy przekroczeniu limitu nic nie zapisuje. */
export async function reserveProxyCall(db: UsageDb, uid: string, now: Date, limits: ProxyLimits): Promise<ProxyReservation> {
  const ref = db.collection(GEMINI_PROXY_USAGE_COLLECTION).doc(uid);
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const dayKey = warsawDayKey(now);
  return db.runTransaction(async (tx): Promise<ProxyReservation> => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const minuteCount = data.minuteKey === minuteKey ? num(data.minuteCount) : 0;
    const dayCount = data.dayKey === dayKey ? num(data.dayCount) : 0;
    if (minuteCount >= limits.perMinute) {
      return { ok: false, reason: 'minute', retryAfterSec: Math.max(1, 60 - Math.floor((now.getTime() % 60_000) / 1000)) };
    }
    if (dayCount >= limits.perDay) {
      return { ok: false, reason: 'day', retryAfterSec: 3600 };
    }
    tx.set(ref, { uid, minuteKey, minuteCount: minuteCount + 1, dayKey, dayCount: dayCount + 1, updatedAt: now.toISOString() }, { merge: true });
    return { ok: true };
  });
}

/**
 * Przycina wyłącznie ABSURDALNY `maxOutputTokens` (powyżej realnego maksimum modeli); nic poza tym nie
 * ruszamy — `tools`, `thinkingConfig`, schematy i instrukcje systemowe przechodzą bez zmian.
 */
export function clampGeminiConfig<T>(config: T): T {
  if (!config || typeof config !== 'object') return config;
  const c = config as Record<string, unknown>;
  if (typeof c.maxOutputTokens === 'number' && c.maxOutputTokens > GEMINI_MAX_OUTPUT_TOKENS_CEILING) {
    return { ...c, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS_CEILING } as T;
  }
  return config;
}

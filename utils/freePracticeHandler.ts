/**
 * Obsługa `POST /api/free-practice/generate` bez Express i bez sieci — cała kolejność kroków trasy
 * w jednym miejscu, żeby dała się przetestować na atrapach (`tests/freePracticeHandler.test.ts`).
 *
 * Kolejność: walidacja żądania → dostępność modelu → rola z dokumentu w bazie → rezerwacja slotu
 * (transakcja) → kontekst kursanta (odczyt) → model (jedna próba + najwyżej jedno ponowienie)
 * → odpowiedź. Każda porażka PO rezerwacji zwraca slot. Logi: tylko `buildUsageLog`.
 */
import { createHash } from 'crypto';
import {
  FreeGenerationError,
  buildUsageLog,
  generateFreePracticeExercises,
  parseGenerateRequest,
  type CallModel,
  type FreeExercise,
  type UsageLogInput,
} from './freePracticeGeneration';
import { loadStudentContext, readUserDoc, type ContextDb } from './freePracticeContext';
import {
  isUnlimitedRole,
  nextWarsawMidnight,
  releaseSlot,
  reserveSlot,
  type Reservation,
  type UsageDb,
} from './freePracticeQuota';

export interface HandlerDeps {
  usageDb: UsageDb;
  contextDb: ContextDb;
  /** Dostępność modelu (klucz AI na serwerze) — bez niego nie rezerwujemy slotu. */
  modelAvailable: boolean;
  callModel: CallModel;
  /** Dzienny limit (z konfiguracji serwera, nigdy z klienta). */
  limit: number;
  now?: () => Date;
  log?: (entry: Record<string, string | number>) => void;
  /** Wywoływany, gdy zwrot slotu się nie uda (np. do ostrzeżenia w logu serwera). */
  onReleaseError?: (error: unknown) => void;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** Skrót identyfikatora do logów — uid nie trafia do logów wprost. */
export const hashUid = (uid: string): string => createHash('sha256').update(String(uid)).digest('hex').slice(0, 10);

export async function handleFreePracticeGenerate(
  deps: HandlerDeps,
  input: { uid: string; body: unknown },
): Promise<HandlerResult> {
  const now = deps.now ?? (() => new Date());
  const startedAt = Date.now();
  const uidHash = hashUid(input.uid);
  const log = (entry: UsageLogInput) => deps.log?.(buildUsageLog(entry));

  const parsed = parseGenerateRequest(input.body);
  if (parsed.ok === false) {
    deps.log?.({ uid: uidHash, outcome: 'bad_request', code: parsed.code });
    return { status: 400, body: { error: parsed.code, message: parsed.message } };
  }
  const request = parsed.value;
  const base = {
    uidHash,
    format: request.format,
    topicCount: request.topics.length,
    wordCount: request.words.length,
    lessonCount: request.lessonRecordIds.length,
  };

  if (!deps.modelAvailable) {
    log({ ...base, outcome: 'unavailable' });
    return { status: 503, body: { error: 'ai_unavailable', message: 'Usługa AI jest chwilowo niedostępna.' } };
  }

  let reservation: Reservation | null = null;
  try {
    const userData = await readUserDoc(deps.contextDb, input.uid);
    if (!isUnlimitedRole(userData.role)) {
      reservation = await reserveSlot(deps.usageDb, input.uid, now(), deps.limit);
      if (reservation.ok === false) {
        log({ ...base, outcome: 'daily_limit', used: reservation.used, limit: deps.limit });
        return {
          status: 429,
          body: {
            error: 'daily_limit',
            message: 'Wykorzystano dzienny limit generowania zdań.',
            limit: deps.limit,
            used: reservation.used,
            resetsAt: nextWarsawMidnight(now()).toISOString(),
          },
        };
      }
    }

    const context = await loadStudentContext(deps.contextDb, input.uid, userData, request.lessonRecordIds, now());
    const result = await generateFreePracticeExercises({ request, context, callModel: deps.callModel });
    log({
      ...base,
      outcome: 'ok',
      used: reservation?.used,
      limit: reservation?.limit,
      attempts: result.attempts,
      model: result.modelUsed,
      durationMs: Date.now() - startedAt,
    });
    return {
      status: 200,
      body: {
        exercises: result.exercises satisfies FreeExercise[],
        limit: reservation ? reservation.limit : null,
        remaining: reservation ? Math.max(0, reservation.limit - reservation.used) : null,
      },
    };
  } catch (err) {
    if (reservation && reservation.ok) {
      await releaseSlot(deps.usageDb, input.uid, reservation.day, now()).catch((releaseErr) => deps.onReleaseError?.(releaseErr));
    }
    const outcome = err instanceof FreeGenerationError && err.code === 'invalid_output' ? 'invalid_output' : 'model_failed';
    log({ ...base, outcome, durationMs: Date.now() - startedAt });
    return {
      status: 502,
      body: { error: 'generation_failed', message: 'Nie udało się przygotować ćwiczenia. Spróbuj ponownie za chwilę.' },
    };
  }
}

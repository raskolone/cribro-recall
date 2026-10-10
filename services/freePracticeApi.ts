/**
 * Klient trasy `POST /api/free-practice/generate` (Ćwiczenia dowolne: Tłumaczenie i Korekta zdań).
 *
 * Bez importu Firebase: token i `fetch` wstrzykuje wywołujący, więc plik da się sprawdzić w
 * `node:test`. Odpowiedź serwera jest już w kształcie `TranslationExercise` z generatora zdań.
 * Błędy mają typowany `code` — ekran tłumaczy je przez i18n, a nie pokazuje tekstu z serwera.
 */
import type { TranslationExercise } from '../types';

export type FreePracticeErrorCode = 'daily_limit' | 'generation_failed' | 'ai_unavailable' | 'bad_request' | 'unauthorized' | 'network';

export class FreePracticeApiError extends Error {
  constructor(
    public readonly code: FreePracticeErrorCode,
    message: string,
    public readonly limit?: number,
    public readonly resetsAt?: string,
  ) {
    super(message);
    this.name = 'FreePracticeApiError';
  }
}

export interface FreePracticeRequest {
  format: 'translation' | 'correction';
  topics: string[];
  words: string[];
  lessonRecordIds: string[];
  count: number;
  excludeSentences: string[];
  focusWords?: string[];
}

export interface FreePracticeResponse {
  exercises: TranslationExercise[];
  /** `null` = bez limitu (konto lektora). */
  limit: number | null;
  remaining: number | null;
}

export interface FreePracticeDeps {
  fetch: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
  }>;
  getToken: () => Promise<string | undefined | null>;
}

export const FREE_PRACTICE_ENDPOINT = '/api/free-practice/generate';

export async function requestFreeSentences(payload: FreePracticeRequest, deps: FreePracticeDeps): Promise<FreePracticeResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await deps.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Bez tokenu serwer odpowie 401 — poniżej zamieniamy to na czytelny błąd.
  }

  let res: Awaited<ReturnType<FreePracticeDeps['fetch']>>;
  try {
    res = await deps.fetch(FREE_PRACTICE_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch {
    throw new FreePracticeApiError('network', 'Brak połączenia z serwerem.');
  }

  const raw = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }

  if (res.ok) {
    const exercises = Array.isArray(data?.exercises) ? (data.exercises as TranslationExercise[]) : [];
    if (exercises.length === 0) throw new FreePracticeApiError('generation_failed', 'Serwer nie zwrócił zdań.');
    return {
      exercises,
      limit: typeof data.limit === 'number' ? data.limit : null,
      remaining: typeof data.remaining === 'number' ? data.remaining : null,
    };
  }

  if (res.status === 429 && data?.error === 'daily_limit') {
    throw new FreePracticeApiError('daily_limit', 'Dzienny limit wykorzystany.', typeof data.limit === 'number' ? data.limit : undefined, typeof data.resetsAt === 'string' ? data.resetsAt : undefined);
  }
  if (res.status === 401) throw new FreePracticeApiError('unauthorized', 'Sesja wygasła.');
  if (res.status === 400) throw new FreePracticeApiError('bad_request', typeof data?.message === 'string' ? data.message : 'Nieprawidłowe żądanie.');
  if (res.status === 503 && data?.error === 'ai_unavailable') throw new FreePracticeApiError('ai_unavailable', 'Usługa AI jest chwilowo niedostępna.');
  throw new FreePracticeApiError('generation_failed', typeof data?.message === 'string' ? data.message : `Błąd serwera (${res.status}).`);
}

/** Klucz i18n komunikatu dla kodu błędu (limit dzienny ma własny panel z liczbą). */
export function freePracticeErrorKey(code: FreePracticeErrorCode): string {
  switch (code) {
    case 'daily_limit':
      return 'Wykorzystano dzienny limit zdań z AI ({{limit}}) — limit odnowi się o północy';
    case 'ai_unavailable':
      return 'Usługa AI jest chwilowo niedostępna — spróbuj ponownie za chwilę';
    case 'network':
      return 'Brak połączenia z serwerem — sprawdź internet i spróbuj ponownie';
    case 'unauthorized':
      return 'Sesja wygasła — zaloguj się ponownie';
    case 'bad_request':
      return 'Nie udało się przygotować ćwiczenia z tego zakresu — zmień zakres i spróbuj ponownie';
    default:
      return 'Serwer nie przygotował poprawnych zdań — spróbuj ponownie za chwilę';
  }
}

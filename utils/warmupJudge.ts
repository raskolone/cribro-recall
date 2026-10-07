import type { WarmupDraftItem, WarmupExercise } from '../types';
import type { WarmupFailureReason } from './exerciseSentenceChecks';

/**
 * Kontrola jakości rozgrzewki drugim wywołaniem modelu: czy angielskie zdanie
 * jest naturalne i logiczne, a polskie tłumaczenie brzmi po polsku.
 *
 * Tu tylko czysty parsing odpowiedzi i filtrowanie — samo wywołanie siedzi
 * w `services/homeworkGenerator.ts`.
 */
export interface WarmupVerdict {
  ok: boolean;
  reason: string;
}

/**
 * Wyrok dla każdego z `count` elementów (kolejność wejścia).
 * `null` = brak wyroku (model pominął element albo odpowiedź nieczytelna).
 * Elementy spoza zakresu są ignorowane.
 */
export const parseWarmupVerdicts = (raw: unknown, count: number): Array<WarmupVerdict | null> => {
  const verdicts: Array<WarmupVerdict | null> = Array.from({ length: count }, () => null);

  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return verdicts;
    }
  }

  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { verdicts?: unknown }).verdicts)
    ? (data as { verdicts: unknown[] }).verdicts
    : null;
  if (!list) return verdicts;

  list.forEach((entry, position) => {
    if (!entry || typeof entry !== 'object') return;
    const source = entry as Record<string, unknown>;
    if (typeof source.ok !== 'boolean') return;
    const index = typeof source.index === 'number' ? source.index : position;
    if (!Number.isInteger(index) || index < 0 || index >= count) return;
    // Pierwszy wyrok dla indeksu wygrywa.
    if (verdicts[index]) return;
    verdicts[index] = { ok: source.ok, reason: typeof source.reason === 'string' ? source.reason.trim() : '' };
  });

  return verdicts;
};

export interface WarmupJudgement {
  items: WarmupDraftItem[];
  reasons: WarmupFailureReason[];
}

/**
 * `ok: false` → element odpada (powód `unnatural_sentence`); brak wyroku →
 * element zostaje z `unverified: true`.
 */
export const applyWarmupVerdicts = (
  items: WarmupExercise[],
  verdicts: Array<WarmupVerdict | null>
): WarmupJudgement => {
  const kept: WarmupDraftItem[] = [];
  const reasons: WarmupFailureReason[] = [];
  items.forEach((item, index) => {
    const verdict = verdicts[index] ?? null;
    if (verdict && !verdict.ok) {
      reasons.push('unnatural_sentence');
    } else if (verdict) {
      kept.push({ ...item });
    } else {
      kept.push({ ...item, unverified: true });
    }
  });
  return { items: kept, reasons };
};

/** Wszystkie elementy bez weryfikacji — gdy samo wywołanie kontrolne się nie powiodło. */
export const markAllUnverified = (items: WarmupExercise[]): WarmupDraftItem[] =>
  items.map((item) => ({ ...item, unverified: true }));

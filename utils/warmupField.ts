import type { WarmupDraftItem, WarmupExercise } from '../types';

/**
 * Wartość pola `warmup` zapisywana w pracy domowej — trzy stany kreatora:
 * - przełącznik wyłączony → `[]` (lektor świadomie rezygnuje z rozgrzewki),
 * - włączony i są elementy → elementy,
 * - włączony i brak elementów (generowanie zawiodło) → `undefined`
 *   (pole pomijane, kursant dostaje starą rozgrzewkę).
 */
export const resolveWarmupField = (
  includeWarmup: boolean,
  items: WarmupDraftItem[]
): WarmupExercise[] | undefined => {
  if (!includeWarmup) return [];
  return items.length > 0 ? stripWarmupDraftFlags(items) : undefined;
};

/** Zdejmuje robocze flagi kreatora (`unverified`) — do dokumentu pracy idą tylko pola `WarmupExercise`. */
export const stripWarmupDraftFlags = (items: WarmupDraftItem[]): WarmupExercise[] =>
  items.map(({ chunks, correctSentence, polishTranslation }) => ({ chunks, correctSentence, polishTranslation }));

/** Usunięcie elementu z podglądu rozgrzewki; zły indeks = bez zmian. */
export const removeWarmupItem = <T>(items: T[], index: number): T[] =>
  index < 0 || index >= items.length ? items : items.filter((_, i) => i !== index);

/** Fragment obiektu do rozproszenia: klucz `warmup` tylko gdy wartość istnieje (Firestore odrzuca `undefined`). */
export const warmupFieldEntry = (
  value: WarmupExercise[] | undefined
): { warmup?: WarmupExercise[] } => (value === undefined ? {} : { warmup: value });

import type { WarmupExercise } from '../types';
import { stripUndefinedDeep } from './directHomeworkEvaluation';

/**
 * Walidacja pola `warmup` przyjmowanego z żądania (przypisanie pracy grupie)
 * i zwracanego na linku bez logowania. Współdzielona przez oba endpointy w
 * `server.ts`, żeby kształt był jeden.
 */
export const WARMUP_MAX_ITEMS = 5;
export const WARMUP_MIN_CHUNKS = 3;
export const WARMUP_MAX_CHUNKS = 5;
export const WARMUP_MAX_CHUNK_LENGTH = 80;
export const WARMUP_MAX_SENTENCE_LENGTH = 250;
export const WARMUP_MAX_TRANSLATION_LENGTH = 300;

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || text.length > maxLength) return null;
  return text;
};

export const sanitizeWarmupItem = (raw: unknown): WarmupExercise | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (!Array.isArray(source.chunks)) return null;
  if (source.chunks.length < WARMUP_MIN_CHUNKS || source.chunks.length > WARMUP_MAX_CHUNKS) return null;

  const chunks: string[] = [];
  for (const chunk of source.chunks) {
    const text = cleanText(chunk, WARMUP_MAX_CHUNK_LENGTH);
    if (!text) return null;
    chunks.push(text);
  }

  const correctSentence = cleanText(source.correctSentence, WARMUP_MAX_SENTENCE_LENGTH);
  const polishTranslation = cleanText(source.polishTranslation, WARMUP_MAX_TRANSLATION_LENGTH);
  if (!correctSentence || !polishTranslation) return null;

  return { chunks, correctSentence, polishTranslation };
};

/**
 * - brak / nie-tablica → `undefined` (pole pomijane = stara rozgrzewka),
 * - `[]` → `[]` (jawny brak rozgrzewki),
 * - niepusta tablica → poprawne elementy (do 5); jeśli żaden nie przeszedł → `undefined`.
 * Wynik wolny od wartości `undefined` w głębi.
 */
export const sanitizeWarmup = (input: unknown): WarmupExercise[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  if (input.length === 0) return [];
  const valid: WarmupExercise[] = [];
  for (const item of input) {
    const clean = sanitizeWarmupItem(item);
    if (clean) valid.push(clean);
    if (valid.length >= WARMUP_MAX_ITEMS) break;
  }
  return valid.length > 0 ? stripUndefinedDeep(valid) : undefined;
};

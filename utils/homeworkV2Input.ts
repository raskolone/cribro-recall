import { clampMatchingPairCount } from "./normalizeExercise";
/**
 * Walidacja wejścia tras `/api/homework-v2/*` — czyste funkcje, bez Firebase i bez Express.
 *
 * Trasy są chronione rolą (requireFirebaseAdmin), ale nawet lektor nie powinien móc wysłać
 * dowolnie wielkiego żądania: lista uid trafia do pętli zapisów w Firestore, a lista lekcji
 * do zapytań i do promptu modelu. Limity są hojne względem realnego użycia (grupa, kilka lekcji,
 * kilkanaście zadań) — odcinają tylko nadużycie i pomyłki.
 */

export const MAX_ASSIGN_STUDENTS = 200;
export const MAX_ASSIGN_EXERCISES = 100;
export const MAX_EXERCISES_JSON_CHARS = 1_000_000;
export const MAX_TITLE_CHARS = 200;
export const MAX_GENERATE_LESSONS = 100;
export const MAX_GENERATE_ITEM_COUNT = 50;
export const MAX_GENERATE_MINUTES = 600;
export const MAX_RAW_LESSONS_JSON_CHARS = 2_000_000;
const MAX_ID_CHARS = 200;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Identyfikator dokumentu Firestore: niepusty tekst, bez `/`, bez białych znaków na brzegach. */
export const isSafeDocId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_ID_CHARS &&
  value === value.trim() &&
  !value.includes('/') &&
  value !== '.' &&
  value !== '..';

const idList = (raw: unknown, label: string, max: number): Validated<string[]> => {
  if (!Array.isArray(raw)) return fail(`${label}: oczekiwano listy.`);
  if (raw.length > max) return fail(`${label}: za dużo pozycji (maks. ${max}).`);
  for (const item of raw) {
    if (!isSafeDocId(item)) return fail(`${label}: nieprawidłowy identyfikator.`);
  }
  return { ok: true, value: Array.from(new Set(raw as string[])) };
};

export interface AssignInput {
  studentUids: string[];
  exercises: unknown[];
  title: string;
  dueDate: string;
  groupId: string;
}

export function validateAssignInput(body: any): Validated<AssignInput> {
  const uids = idList(body?.studentUids ?? [], 'studentUids', MAX_ASSIGN_STUDENTS);
  if (uids.ok === false) return uids;
  if (uids.value.length === 0) return fail('Nie wskazano kursantów.');

  const exercises = Array.isArray(body?.exercises) ? body.exercises : [];
  if (exercises.length > MAX_ASSIGN_EXERCISES) return fail(`Za dużo zadań w zestawie (maks. ${MAX_ASSIGN_EXERCISES}).`);
  if (JSON.stringify(exercises).length > MAX_EXERCISES_JSON_CHARS) return fail('Zestaw zadań jest zbyt duży.');

  const title = String(body?.title || 'Praca domowa').trim();
  if (title.length > MAX_TITLE_CHARS) return fail(`Tytuł jest zbyt długi (maks. ${MAX_TITLE_CHARS} znaków).`);

  const groupId = String(body?.groupId || '').trim();
  if (groupId && !isSafeDocId(groupId)) return fail('Nieprawidłowy identyfikator grupy.');

  return { ok: true, value: { studentUids: uids.value, exercises, title, dueDate: String(body?.dueDate || '').trim(), groupId } };
}

export interface GenerateInput {
  studentUid: string;
  lessonIds: string[];
  itemCount: number;
  plannedMinutes: number;
  matchingPairCount?: number;
}

export function validateGenerateInput(body: any): Validated<GenerateInput> {
  const studentUid = String(body?.studentUid || '').trim();
  if (!studentUid) return fail('Nie wskazano kursanta.');
  if (!isSafeDocId(studentUid)) return fail('Nieprawidłowy identyfikator kursanta.');

  const lessons = idList(Array.isArray(body?.lessonIds) ? body.lessonIds : [], 'lessonIds', MAX_GENERATE_LESSONS);
  if (lessons.ok === false) return lessons;
  if (lessons.value.length === 0) return fail('Nie wskazano lekcji.');

  const itemCount = Number(body?.itemCount) || 6;
  if (!Number.isFinite(itemCount) || itemCount < 1 || itemCount > MAX_GENERATE_ITEM_COUNT) {
    return fail(`Liczba zadań musi mieścić się w zakresie 1–${MAX_GENERATE_ITEM_COUNT}.`);
  }
  const plannedMinutes = Number(body?.plannedMinutes) || 0;
  if (!Number.isFinite(plannedMinutes) || plannedMinutes < 0 || plannedMinutes > MAX_GENERATE_MINUTES) {
    return fail('Nieprawidłowy planowany czas.');
  }
  if (body?.rawLessons !== undefined) {
    if (!Array.isArray(body.rawLessons)) return fail('rawLessons: oczekiwano listy.');
    if (JSON.stringify(body.rawLessons).length > MAX_RAW_LESSONS_JSON_CHARS) return fail('rawLessons: zbyt duże wejście.');
  }
  const matchingPairCount = body?.matchingPairCount !== undefined ? clampMatchingPairCount(body.matchingPairCount) : undefined;
  return { ok: true, value: { studentUid, lessonIds: lessons.value, itemCount, plannedMinutes, ...(matchingPairCount !== undefined ? { matchingPairCount } : {}) } };
}

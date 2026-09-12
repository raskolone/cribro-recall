/**
 * Składanie dokumentu pracy domowej v2.
 *
 * Wydzielone z `endpoints.ts`, bo to jest miejsce, w którym łamie się albo
 * dotrzymuje kontrakt zgodności z v1 — a taki kod musi dać się przetestować
 * bez Firestore, bez sieci i bez wdrożenia.
 *
 * Plik nie importuje niczego z Firebase. To celowe: cała jego zawartość to
 * czyste przekształcenie danych.
 */

import { ENGINE_VERSION, ExerciseContractV2, SCHEMA_VERSION, isExerciseContractV2 } from './contracts';

/**
 * Które zadania wolno wysłać kursantowi.
 *
 * Dwie bramki naraz, i obie są potrzebne:
 *
 * 1. `isExerciseContractV2` — do bazy nie trafia coś, co nie jest kontraktem.
 *    Payload przychodzi z przeglądarki lektora, więc równie dobrze mógłby być
 *    czymkolwiek.
 * 2. `requiresTeacherReview` — zadanie, którego walidator nie przepuścił po
 *    dwóch regeneracjach, nie może pójść automatycznie (§10 specyfikacji).
 *    Lektor odblokowuje je świadomie w podglądzie; jeśli tego nie zrobił,
 *    wypada tutaj.
 *
 * Filtr działa po stronie serwera, mimo że ekran lektora już raz odsiewa.
 * Sprawdzenie wyłącznie w przeglądarce znaczyłoby, że wystarczy podmienić
 * jedno pole w żądaniu, żeby wysłać kursantowi zadanie uznane za złe.
 */
export const selectSendableExercises = (rawExercises: unknown[]): ExerciseContractV2[] =>
  (Array.isArray(rawExercises) ? rawExercises : []).filter(
    (item): item is ExerciseContractV2 =>
      isExerciseContractV2(item) && !(item as ExerciseContractV2).requiresTeacherReview
  );

export interface BuildTaskPayloadInput {
  studentUid: string;
  exercises: ExerciseContractV2[];
  teacherId: string;
  title: string;
  dueDate?: string;
  groupId?: string;
  /** Wspólny dla całej grupy. Ten sam zestaw, osobne dokumenty. */
  homeworkSetId: string;
  createdAt: string;
}

/**
 * Dokument `specialTasks` dla jednego kursanta.
 *
 * Kontrakt zgodności z v1 jest tu dotrzymany co do nazwy pola — szczegóły
 * i uzasadnienie w `docs/audyt-homework-v2.md` §4:
 *
 * - `sentences`: `notifyStudentOnHomework` liczy `sentences.length` jako liczbę
 *   zadań w mailu. Inna nazwa = wiadomość „0 zadań".
 * - `skipAutoEmail` + `manualEmailConfirmationRequired`: wprowadzają v2 w ten
 *   sam tryb co oba kreatory v1 — automat wychodzi wcześnie, a pocztę wysyła
 *   lektor z okna potwierdzenia.
 * - `studentUid`: reguła `create` w `firestore.rules` wymaga niepustego stringa.
 * - `studentId` / `userId` / `studentIds`: starsze widoki czytają po tych
 *   nazwach (patrz `taskOwnerFields` w `utils/homework.ts`).
 */
export const buildV2TaskPayload = (input: BuildTaskPayloadInput): Record<string, unknown> => ({
  // --- pola wymagane przez v1 i przez reguły ---
  studentUid: input.studentUid,
  studentId: input.studentUid,
  userId: input.studentUid,
  studentIds: [input.studentUid],
  title: input.title,
  instructions: 'Masz trzy próby na każde zadanie. Podpowiedź pojawi się, gdy będzie potrzebna.',
  createdAt: input.createdAt,
  ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  status: 'pending' as const,
  sentences: input.exercises.map((exercise) => ({ ...exercise, studentId: input.studentUid })),

  // --- tryb mailingu identyczny jak w kreatorach v1 ---
  manualEmailConfirmationRequired: true,
  skipAutoEmail: true,
  emailNotificationSent: false,

  // --- pola v2 ---
  engineVersion: ENGINE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  teacherId: input.teacherId,
  homeworkSetId: input.homeworkSetId,
  ...(input.groupId ? { groupId: input.groupId } : {}),
  mode: 'training' as const,
  assignedBy: 'Lektor',
});

/** Identyfikator zestawu — wspólny dla wszystkich kursantów w grupie. */
export const newHomeworkSetId = (): string =>
  `hwset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

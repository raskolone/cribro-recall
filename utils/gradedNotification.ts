/**
 * Treść powiadomienia „praca sprawdzona" — składana z DOKUMENTU ZADANIA, nigdy z ciała żądania.
 *
 * Trasa `POST /api/homework/notify-graded` wysyła e-mail do kursanta z adresu systemu. Gdyby tytuł,
 * komentarz i wynik pochodziły z żądania, każdy wywołujący mógłby wysłać kursantowi dowolną treść
 * w imieniu lektora. Źródłem prawdy jest to, co lektor zapisał przy ocenie:
 * - v1: `specialTasks/{id}` — `status: 'graded'`, `teacherFeedback`, `grade`,
 * - v2: najnowsza zatwierdzona próba (`attempts`, `teacherApprovedAt`) — `feedbackMessage`, `weightedScore`.
 */

export const MAX_NOTIFICATION_TITLE_CHARS = 200;
export const MAX_NOTIFICATION_FEEDBACK_CHARS = 5000;

export interface GradedNotificationContent {
  title: string;
  score: number | null;
  feedback: string;
}

export type GradedNotificationResult =
  | { ok: true; content: GradedNotificationContent }
  | { ok: false; code: 'not_graded'; message: string };

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const percent = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;

/** Kto jest właścicielem zadania — te same pola co `taskOwnerFields` w `utils/homework.ts`. */
export function taskOwnerUid(task: Record<string, unknown> | undefined): string {
  if (!task) return '';
  for (const key of ['studentUid', 'studentId', 'userId']) {
    const v = task[key];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

export function resolveGradedNotification(
  task: Record<string, unknown>,
  latestApprovedAttempt?: Record<string, unknown> | null,
): GradedNotificationResult {
  const title = text(task.title, MAX_NOTIFICATION_TITLE_CHARS) || 'Praca domowa';

  if (task.engineVersion !== undefined) {
    // Silnik v2 nie zmienia `status` zadania — werdykt żyje w zatwierdzonej próbie.
    if (!latestApprovedAttempt) {
      return { ok: false, code: 'not_graded', message: 'Brak zatwierdzonej oceny tej pracy.' };
    }
    const weighted = latestApprovedAttempt.weightedScore;
    return {
      ok: true,
      content: {
        title,
        score: typeof weighted === 'number' && Number.isFinite(weighted) ? percent(weighted * 100) : null,
        feedback: text(latestApprovedAttempt.feedbackMessage, MAX_NOTIFICATION_FEEDBACK_CHARS),
      },
    };
  }

  if (task.status !== 'graded') {
    return { ok: false, code: 'not_graded', message: 'Ta praca nie została jeszcze sprawdzona.' };
  }
  return {
    ok: true,
    content: { title, score: percent(task.grade), feedback: text(task.teacherFeedback, MAX_NOTIFICATION_FEEDBACK_CHARS) },
  };
}

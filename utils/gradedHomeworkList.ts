/**
 * Lista „Sprawdzone przez nauczyciela" na ekranie Praca domowa kursanta — logika bez UI:
 * kolejność, ile kafelków widać, czy praca jest „świeżo sprawdzona", tytuł bez przedrostka, data.
 */
import { toneForPercent, type ScoreTone } from './scoreTone';

export const FRESH_DAYS = 7;
export const VISIBLE_NEWEST = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GradedTaskLike {
  id?: string;
  title?: string;
  reviewedAt?: unknown;
  submittedAt?: unknown;
  grade?: number;
  /** Pole z danych: lektor ustawia `false` przy ocenie, kursant `true` po wejściu w ocenę. */
  feedbackReadByStudent?: boolean;
}

/** ISO / liczba ms / Timestamp Firestore (`toMillis`, `seconds`) → ms; brak lub nieczytelne → null. */
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === 'function') {
    const ms = v.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

/**
 * „Świeże" = sprawdzone w ciągu ostatnich 7 dni (włącznie z granicą) i nieobejrzane. Obejrzane to:
 * `feedbackReadByStudent === true` ALBO wejście zapisane lokalnie (`seenLocally`). Bez daty sprawdzenia
 * praca nigdy nie jest „świeża" — nie ma od czego liczyć 7 dni. Data z przyszłości (zegar) też nie.
 */
export function isFreshlyReviewed(task: GradedTaskLike, nowMs: number, seenLocally = false): boolean {
  if (task.feedbackReadByStudent === true || seenLocally) return false;
  const reviewed = toMillis(task.reviewedAt);
  if (reviewed === null) return false;
  const age = nowMs - reviewed;
  return age >= 0 && age <= FRESH_DAYS * DAY_MS;
}

/** Od najnowszej sprawdzonej; prace bez daty sprawdzenia na końcu (stabilnie, w kolejności wejścia). */
export function sortNewestReviewed<T extends GradedTaskLike>(tasks: ReadonlyArray<T>): T[] {
  return tasks
    .map((task, index) => ({ task, index, ms: toMillis(task.reviewedAt) }))
    .sort((a, b) => {
      if (a.ms === null && b.ms === null) return a.index - b.index;
      if (a.ms === null) return 1;
      if (b.ms === null) return -1;
      return b.ms - a.ms || a.index - b.index;
    })
    .map((entry) => entry.task);
}

/** Widoczne: `limit` najnowszych; reszta za przyciskiem „Pokaż starsze (N)" (`hiddenCount`). */
export function splitVisible<T>(sorted: ReadonlyArray<T>, expanded: boolean, limit = VISIBLE_NEWEST) {
  const hiddenCount = Math.max(0, sorted.length - limit);
  return {
    visible: sorted.slice(0, limit),
    older: expanded ? sorted.slice(limit) : [],
    hiddenCount,
    canToggle: hiddenCount > 0,
  };
}

/** „Praca domowa: Past Simple" → „Past Simple". Gdy po przedrostku nic nie zostaje, tytuł bez zmian. */
export function stripHomeworkPrefix(title: string | undefined): string {
  const raw = (title ?? '').trim();
  const stripped = raw.replace(/^(praca\s+domowa|homework)\s*[:\-–—]\s*/i, '').trim();
  return stripped || raw;
}

/** `10.10.2026` albo pusty napis, gdy brak/nieczytelna data. Bez godziny i bez surowych timestampów. */
export function formatReviewDate(value: unknown): string {
  const ms = toMillis(value);
  if (ms === null) return '';
  return new Date(ms).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function gradeTone(grade: number | undefined): ScoreTone | null {
  return typeof grade === 'number' && Number.isFinite(grade) ? toneForPercent(grade) : null;
}

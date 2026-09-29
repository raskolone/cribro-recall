/**
 * Tryb „multiple" w HomeworkComposerV2 — ad-hoc wybór kilku kursantów bez
 * formalnej grupy. Czysta logika (bez UI), żeby dało się ją testować w node:test.
 */

export const NO_RECIPIENTS_MESSAGE = 'Zaznacz co najmniej jednego kursanta, żeby przypisać zadanie.';

/** Filtr listy po imieniu/nazwisku (bez rozróżniania wielkości liter i ogonków pomijamy — tylko lowercase). */
export const filterByName = <T>(items: T[], query: string, label: (item: T) => string): T[] => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => label(item).toLowerCase().includes(q));
};

/** „Zaznacz wszystkich" — dokłada widoczne (przefiltrowane) ID do już zaznaczonych, bez duplikatów. */
export const selectAllIds = (current: string[], visibleIds: string[]): string[] =>
  Array.from(new Set([...current, ...visibleIds]));

export const toggleId = (current: string[], id: string): string[] =>
  current.includes(id) ? current.filter((x) => x !== id) : [...current, id];

/** Komunikat blokujący przypisanie albo null, gdy można wysyłać. */
export const validateMultipleRecipients = (selectedIds: string[]): string | null =>
  selectedIds.length === 0 ? NO_RECIPIENTS_MESSAGE : null;

// ---------------------------------------------------------------------------
// Silnik v1: zapis ad-hoc (bez grupy) — N dokumentów `specialTasks`
// ---------------------------------------------------------------------------

export interface AdHocRecipient {
  id: string;
  name: string;
  email?: string;
  username?: string;
}

export interface AdHocHomeworkBase {
  title: string;
  type: string;
  types: string[];
  instructions: string;
  sentences: unknown[];
  dueDate: string;
  createdAt: string;
  origin: string;
}

/** Wspólny identyfikator zestawu łączący dokumenty jednej ad-hoc wysyłki. */
export const newAdHocHomeworkSetId = (random: () => string): string =>
  `hwset_multi_${Date.now().toString(36)}_${random()}`;

/**
 * Jeden dokument na kursanta, w kształcie zadania v1 z ścieżki „indywidualny
 * kursant" (bez `engineVersion`, bez `groupId`) + wspólne `homeworkSetId`.
 * Każdy odbiorca ma własny token dostępu.
 */
export const buildAdHocHomeworkPayloads = (
  recipients: AdHocRecipient[],
  base: AdHocHomeworkBase,
  homeworkSetId: string,
  makeToken: () => string
): Array<Record<string, unknown>> =>
  recipients.map((r) => {
    const accessToken = makeToken();
    return {
      studentUid: r.id,
      studentId: r.id,
      userId: r.id,
      studentIds: [r.id],
      studentName: r.name,
      studentEmail: r.email || '',
      studentUsername: r.username || '',
      title: base.title,
      type: base.type,
      types: base.types,
      instructions: base.instructions,
      createdAt: base.createdAt,
      dueDate: base.dueDate,
      status: 'pending',
      sentences: base.sentences,
      manualEmailConfirmationRequired: true,
      skipAutoEmail: true,
      emailNotificationSent: false,
      homeworkSetId,
      accessToken,
      accessExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      accessUrl: `${base.origin}/hw?token=${accessToken}`,
    };
  });

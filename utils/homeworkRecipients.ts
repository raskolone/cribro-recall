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

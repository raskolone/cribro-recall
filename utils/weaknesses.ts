/**
 * Lista słabości kursanta do promptu — wspólny format dla klienta (`getUserWeaknesses`) i serwera
 * (generowanie zdań w Ćwiczeniach dowolnych). Czysta funkcja: dane przychodzą z odczytu bazy
 * wykonanego przez wywołującego (SDK klienta albo Admin SDK), tu tylko skład tekstu.
 */

export const NO_WEAKNESSES = 'Brak zidentyfikowanych błędów.';

export interface WeaknessRow {
  id?: string;
  name?: string;
  frequency?: number;
  description?: string;
}

export function formatWeaknessesList(rows: readonly WeaknessRow[], frequentErrors: readonly string[] = []): string {
  if (rows.length === 0 && frequentErrors.length === 0) return NO_WEAKNESSES;

  const fromCollection = rows.map(
    (data) =>
      `- Błąd/Problem: "${data.name || data.id}" (częstość: ${data.frequency || 1}) ${data.description ? `[Kontekst: ${data.description}]` : ''}`,
  );

  const additionalFromDoc = frequentErrors
    .filter((err) => !rows.some((row) => row.name?.toLowerCase() === err.toLowerCase()))
    .map((err) => `- Częsty błąd z profilu: "${err}"`);

  return [...fromCollection, ...additionalFromDoc].join('\n');
}

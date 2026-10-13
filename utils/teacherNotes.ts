/**
 * Które prywatne notatki lektora pokazać.
 *
 * Źródłem jest `scratchpads/{id}/private/teacher`. Dopóki migracja nie
 * przeniesie starych notatek, część notatników ma je jeszcze w polu
 * `teacherNotes` dokumentu nadrzędnego — wtedy (i tylko wtedy, gdy
 * dokumentu prywatnego nie ma) bierzemy to pole. Pusty string w dokumencie
 * prywatnym to świadomie wyczyszczone notatki, nie brak danych.
 */
export function resolveTeacherNotes(
  privateNotes: string | null | undefined,
  legacyNotes: string | null | undefined
): string {
  if (typeof privateNotes === 'string') return privateNotes;
  return typeof legacyNotes === 'string' ? legacyNotes : '';
}

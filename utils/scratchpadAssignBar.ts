/**
 * Czy pokazać pasek „Notatnik roboczy — nikt go jeszcze nie widzi".
 *
 * Notatnik grupowy (`groupId`) nie ma pojedynczego `studentId`, ale widzą go
 * członkowie grupy — nie jest „roboczy". Przypisanie do jednego kursanta
 * przeniosłoby jego treść z grupy, więc dla grupy paska nie pokazujemy wcale.
 */
export const shouldShowUnassignedBar = (
  doc: { studentId?: string | null; groupId?: string | null },
  assignableCount: number
): boolean => !doc.studentId && !doc.groupId && assignableCount > 0;

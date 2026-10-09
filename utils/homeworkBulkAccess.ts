/**
 * Czy w ekranie prac domowych lektora jest menu „Szybkie akcje"
 * (zaznaczanie do usunięcia).
 *
 * Menu należy do LISTY prac lektora w module „Zadania i testy". Dotąd włączał
 * je wyłącznie prop `bulkActions`, który przekazuje `TeacherWorkScreen`. Wejście
 * z karty grupy (`initialGroupId`) jest tą samą listą, tylko z filtrem grupy —
 * więc dostaje menu także wtedy, gdy jakiś montaż zapomni o propie. Karta
 * kursanta (bez propa i bez grupy) zostaje bez menu.
 */
export interface BulkAccessInput {
  /** Prop `bulkActions` z modułu „Zadania i testy". */
  bulkActions: boolean;
  /** Wejście z karty grupy / modalu grup (`initialGroupId`). */
  openedFromGroup: boolean;
  isTeacher: boolean;
  /** Zakładka ekranu: lista, kreator, fiszki. */
  activeTab: string;
  /** Kursant rozwiązuje pracę (widok ćwiczenia zamiast listy). */
  hasActiveTask: boolean;
}

export const canUseBulkActions = ({
  bulkActions,
  openedFromGroup,
  isTeacher,
  activeTab,
  hasActiveTask,
}: BulkAccessInput): boolean =>
  (bulkActions || openedFromGroup) && isTeacher && activeTab === 'list' && !hasActiveTask;

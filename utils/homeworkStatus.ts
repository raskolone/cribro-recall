/**
 * Mapowanie statusów pracy domowej na czytelne etykiety i18n.
 *
 * Używane w nagłówkach widoków podglądu i oceny pracy domowej.
 * Dla znanych statusów ('submitted', 'graded', 'completed', 'pending', 'assigned')
 * zwraca odpowiednik po polsku lub po angielsku.
 * Dla nieznanego statusu zwraca surową wartość bez zmian.
 */

export type HomeworkLanguage = 'pl' | 'en';

export function formatHomeworkStatus(
  status?: string | null,
  language: HomeworkLanguage = 'pl'
): string {
  if (!status) return '';
  const key = String(status).trim().toLowerCase();

  if (language === 'pl') {
    switch (key) {
      case 'submitted':
        return 'Do sprawdzenia';
      case 'graded':
        return 'Sprawdzona';
      case 'completed':
        return 'Sprawdzona';
      case 'pending':
      case 'assigned':
        return 'W trakcie';
      default:
        return status;
    }
  }

  // Język angielski
  switch (key) {
    case 'submitted':
      return 'To review';
    case 'graded':
      return 'Graded';
    case 'completed':
      return 'Completed';
    case 'pending':
    case 'assigned':
      return 'In progress';
    default:
      return status;
  }
}

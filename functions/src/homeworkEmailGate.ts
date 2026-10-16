/**
 * Czy nowa praca w `specialTasks` może dostać automatyczny e-mail od razu po utworzeniu.
 *
 * Plik celowo nie importuje `firebase-functions` — decyzję da się przetestować z katalogu
 * głównego (tests/homeworkEmailGate.test.ts), w którym pakiet funkcji nie jest zainstalowany.
 *
 * Prace z serii (`seriesId`) wydaje cron, bez lektora przy ekranie i bez modala
 * potwierdzenia wysyłki. Dlatego mail wychodzi wyłącznie, gdy lektor jawnie potwierdził
 * automatyczne maile przy tworzeniu serii — serwer oznacza to flagą
 * `seriesAutoEmailConfirmed: true` (utils/homeworkSeries.ts, buildReleasedTaskDocument).
 * Brak flagi = brak maila, nawet gdy pozostałe flagi by go przepuszczały.
 */
export type HomeworkEmailGateResult =
  | { send: true }
  | { send: false; reason: 'manual_confirmation_or_skipped' | 'series_auto_email_not_confirmed' };

export function shouldAutoEmailNewHomework(task: Record<string, any>): HomeworkEmailGateResult {
  if (task.manualEmailConfirmationRequired || task.skipAutoEmail || task.emailNotificationSent) {
    return { send: false, reason: 'manual_confirmation_or_skipped' };
  }
  if (task.seriesId && task.seriesAutoEmailConfirmed !== true) {
    return { send: false, reason: 'series_auto_email_not_confirmed' };
  }
  return { send: true };
}

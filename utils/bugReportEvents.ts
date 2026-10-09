/**
 * Otwarcie panelu „Zgłoś problem" z innego miejsca niż pływająca ikona.
 *
 * Na telefonie ikona nie wisi nad treścią — wejście jest w menu ustawień. Menu i panel
 * nie znają się nawzajem; łączy je jedno zdarzenie okna, więc `BugReporter` zostaje
 * niezależny od paska górnego (a pasek od logiki zgłoszeń).
 */
export const OPEN_BUG_REPORT_EVENT = 'cribro:open-bug-report';

export function requestBugReport(target: Pick<Window, 'dispatchEvent'> = window): void {
  target.dispatchEvent(new CustomEvent(OPEN_BUG_REPORT_EVENT));
}

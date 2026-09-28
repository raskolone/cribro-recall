/**
 * Kolejność operacji przy wysyłce zaproszenia do aplikacji
 * (`StudentInviteEmailModal.tsx`). Wydzielone, żeby dało się przetestować
 * bez renderowania komponentu i bez mockowania `fetch`/Firebase.
 *
 * P0: wcześniej `changeUserPassword` był wołany PO wysłaniu maila, w
 * try/catch, który połykał błąd (`console.warn`) — modal i tak pokazywał
 * "Zaproszenie wysłane pomyślnie", mimo że hasło nigdy nie trafiło do
 * konta kursanta w Firebase Auth. Ta funkcja gwarantuje: zmiana hasła
 * PRZED wysyłką maila, a jej błąd przerywa całość (mail nigdy nie idzie).
 */

export async function changePasswordBeforeInvite(
  willChangePassword: boolean,
  changePassword: () => Promise<void>,
  failureMessage: string
): Promise<void> {
  if (!willChangePassword) return;
  try {
    await changePassword();
  } catch {
    throw new Error(failureMessage);
  }
}

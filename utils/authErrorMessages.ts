/**
 * Mapowanie kodów błędów Firebase Auth na komunikaty ekranu logowania
 * (`AuthScreen.tsx`). Wydzielone do osobnej funkcji, żeby dało się
 * przetestować bez renderowania komponentu.
 */
import i18n from 'i18next';

export function mapFirebaseAuthErrorToMessage(code: string | undefined, fallback: string): string {
  if (code === 'auth/invalid-email') return i18n.t('Wprowadź poprawny adres e-mail.');
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Nieprawidłowy login lub hasło.';
  }
  if (code === 'auth/too-many-requests') return 'Zbyt wiele nieudanych prób logowania. Odczekaj chwilę.';
  if (code === 'auth/email-already-in-use') return 'User is already registered';
  if (code === 'auth/weak-password') return 'Password should be at least 6 characters';
  return fallback;
}

import { User } from '../types';

/**
 * Sprawdza, czy przekazana wartość jest surowym technicznym identyfikatorem
 * (np. Firebase Auth UID o długości 20-36 znaków bez spacji lub UUID w formacie szesnastkowym).
 */
export const isRawId = (str?: string | null): boolean => {
  if (!str) return false;
  const s = str.trim();
  if (s.length === 0) return false;

  // Firebase Auth UID składa się zazwyczaj z 20-36 znaków alfanumerycznych/podkreśleń/myślników bez spacji
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return true;

  // Format UUID (8-4-4-4-12)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;

  return false;
};

/**
 * Zwraca czytelną dla człowieka reprezentację kursanta (Imię i Nazwisko, Display Name lub Nazwę Użytkownika).
 * GWARANCJA: Nigdy nie zwraca surowego technicznego identyfikatora UID/ID.
 *
 * @param user Obiekt profilu użytkownika (jeśli dostępny)
 * @param fallbackName Opcjonalna nazwa zapasowa (np. z dokumentu zadania)
 * @param fallbackDefault Domyślny napis, gdy nie uda się ustalić tożsamości (domyślnie 'Kursant')
 */
export const formatStudentDisplayName = (
  user?: Partial<User> | null,
  fallbackName?: string | null,
  fallbackDefault = 'Kursant'
): string => {
  if (user) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (fullName) return fullName;

    const disp = (user.displayName || (user as any).name || '').trim();
    if (disp && !isRawId(disp)) return disp;

    const uname = (user.username || '').trim();
    if (uname && !isRawId(uname)) return uname;

    if (user.email && user.email.includes('@')) {
      const emailPrefix = user.email.split('@')[0].trim();
      if (emailPrefix && !isRawId(emailPrefix)) return emailPrefix;
    }
  }

  if (fallbackName) {
    const trimmed = fallbackName.trim();
    if (trimmed && !isRawId(trimmed)) {
      return trimmed;
    }
  }

  return fallbackDefault;
};

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

/**
 * Zwraca WYŁĄCZNIE samo pierwsze imię kursanta lub lektora (bez nazwiska),
 * czyszcząc techniczne identyfikatory, prefiksy i separatory.
 * Np. "Maciej Wyrozumski" -> "Maciej"
 * "Milena.Miksa-Matyjasik" -> "Milena"
 * "anna_nowak" -> "Anna"
 */
export const formatStudentFirstName = (
  user?: Partial<User> | null,
  fallbackName?: string | null,
  fallbackDefault = 'Kursant'
): string => {
  if (user?.firstName) {
    const fn = user.firstName.trim().split(/\s+/)[0];
    if (fn && !isRawId(fn)) {
      return fn.charAt(0).toUpperCase() + fn.slice(1);
    }
  }

  const fullName = formatStudentDisplayName(user, fallbackName, fallbackDefault);
  if (!fullName || fullName === fallbackDefault) return fallbackDefault;

  let clean = fullName.trim();
  // Rozdzielenie po spacji
  if (clean.includes(' ')) {
    clean = clean.split(/\s+/)[0];
  }
  // Rozdzielenie po kropce
  if (clean.includes('.')) {
    clean = clean.split('.')[0];
  }
  // Rozdzielenie po podkreśleniu
  if (clean.includes('_')) {
    clean = clean.split('_')[0];
  }

  clean = clean.replace(/^[,.\s!:]+|[,.\s!:]+$/g, '');
  if (!clean || isRawId(clean)) return fallbackDefault;

  return clean.charAt(0).toUpperCase() + clean.slice(1);
};


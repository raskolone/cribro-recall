import { toPolishVocative, formatOnlyFirstName } from './polishVocative';
import { isRawId } from './studentFormat';

const GENERIC_STUDENT_NAMES = new Set([
  'kursant',
  'kursancie',
  'kursanta',
  'uczen',
  'uczeń',
  'student',
  'user',
  'użytkownik',
]);

/**
 * Wyciąga i odmienia imię kursanta w wołaczu na potrzeby powitania w pracy domowej.
 * Jeśli imię jest puste, techniczne (UID) lub ogólne ("Kursant", "Kursancie"), zwraca pusty ciąg.
 */
export function extractStudentVocative(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  if (!trimmed || isRawId(trimmed)) return '';

  // 1. Wyciągnij pierwszy człon / imię (odcina nazwisko, kropki, podkreślenia itp.)
  const first = formatOnlyFirstName(trimmed);
  if (!first || isRawId(first)) return '';

  // 2. Normalizacja wielkości liter (pierwsza wielka, reszta małe)
  const normalized = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  // 3. Sprawdź, czy to nie ogólna nazwa (np. "Kursant", "Kursancie")
  if (GENERIC_STUDENT_NAMES.has(normalized.toLowerCase())) {
    return '';
  }

  // 4. Odmień w wołaczu za pomocą istniejącej funkcji toPolishVocative
  const vocative = toPolishVocative(normalized);
  if (!vocative) return '';

  // 5. Dodatkowa weryfikacja, czy wynik odmiany nie jest ogólnym zwrotem
  if (GENERIC_STUDENT_NAMES.has(vocative.toLowerCase())) {
    return '';
  }

  return vocative;
}

/**
 * Buduje nagłówek powitalny pracy domowej (np. na ekranie przed rozgrzewką).
 * Gdy imię kursanta jest dostępne: "Świetnie, że tu jesteś, Marku!"
 * Gdy imię jest puste lub ogólne ("Kursant", "Kursancie"): "Świetnie, że tu jesteś!"
 */
export function buildHomeworkWelcomeGreeting(
  rawInput?: { firstName?: string; name?: string; displayName?: string; username?: string } | string | null
): string {
  let nameStr: string | undefined | null;
  if (typeof rawInput === 'string') {
    nameStr = rawInput;
  } else if (rawInput && typeof rawInput === 'object') {
    nameStr = rawInput.name || rawInput.firstName || rawInput.displayName || rawInput.username;
  } else {
    nameStr = undefined;
  }

  const vocative = extractStudentVocative(nameStr);
  if (!vocative) {
    return 'Świetnie, że tu jesteś!';
  }
  return `Świetnie, że tu jesteś, ${vocative}!`;
}

/**
 * Statystyki motywacyjne kursanta — czysta logika (bez Reacta, bez bazy): z liczników powstaje uporządkowana
 * lista pozycji do wyświetlenia (klucz i18n + liczba). Teksty, w tym odmiana liczebników, pochodzą z i18n
 * (klucze `motivation.*` z końcówkami plural `_one/_few/_many/_other`), a kategoria liczebnika to
 * `Intl.PluralRules` — tak samo dla polskiego i angielskiego.
 *
 * Zasady: tylko liczby >= 1 z wiarygodnego źródła, żadnych przybliżeń, żadnych „dni z rzędu” (streak).
 * Liczniki wynikają WYŁĄCZNIE z istniejących danych (patrz `computeMotivationCounts`); nic się nie zapisuje.
 */

export interface MotivationCounts {
  /** Zakończone ćwiczenia (wpisy practiceLogs poza pracą domową i testami + zakończone sesje fiszek). */
  exercises?: number;
  /** Zdania z ćwiczeń tłumaczenia (practiceLogs `ai_translation`). */
  translatedSentences?: number;
  /** Zdania z ćwiczeń korekty (practiceLogs `sentence_correction`). */
  correctedSentences?: number;
  /** Fiszki z zakończonych sesji fiszek / quizu / pisania (suma `totalCards`). */
  flashcards?: number;
  /** Prace domowe w statusie `submitted` lub `graded`. */
  homework?: number;
  /** Pary z zakończonych sesji dopasowania (suma `totalCards` sesji `matching`). */
  pairs?: number;
}

export type MotivationStatId = 'exercises' | 'translated' | 'corrected' | 'flashcards' | 'homework' | 'pairs' | 'congrats';

export type MotivationIcon = 'trophy' | 'languages' | 'pencil' | 'layers' | 'book' | 'link' | 'party';

export interface MotivationItem {
  id: MotivationStatId;
  /** Klucz i18n (`motivation.<id>`); liczba idzie jako `count`, końcówkę plural dobiera i18n. */
  i18nKey: string;
  count: number;
  icon: MotivationIcon;
}

/** Klucz i18n statycznej linii zachęty, gdy nie ma żadnych danych (bez liczb). */
export const MOTIVATION_EMPTY_KEY = 'motivation.empty';

/** Stała kolejność wyświetlania (rotacja idzie po niej). „Gratulacje” to drugi wariant licznika ćwiczeń — na końcu. */
const ORDER: Array<{ id: MotivationStatId; source: keyof MotivationCounts; icon: MotivationIcon }> = [
  { id: 'exercises', source: 'exercises', icon: 'trophy' },
  { id: 'translated', source: 'translatedSentences', icon: 'languages' },
  { id: 'corrected', source: 'correctedSentences', icon: 'pencil' },
  { id: 'flashcards', source: 'flashcards', icon: 'layers' },
  { id: 'homework', source: 'homework', icon: 'book' },
  { id: 'pairs', source: 'pairs', icon: 'link' },
  { id: 'congrats', source: 'exercises', icon: 'party' },
];

const usable = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 1;

/** Pozycje do pokazania: tylko liczby >= 1 (całkowite, zaokrąglone w dół), w stałej kolejności. Brak danych → `[]`. */
export function buildMotivationItems(counts: MotivationCounts | null | undefined): MotivationItem[] {
  if (!counts) return [];
  const items: MotivationItem[] = [];
  for (const entry of ORDER) {
    const raw = counts[entry.source];
    if (!usable(raw)) continue;
    items.push({ id: entry.id, i18nKey: `motivation.${entry.id}`, count: Math.floor(raw), icon: entry.icon });
  }
  return items;
}

/** Kategoria liczebnika (`one` / `few` / `many` / `other`) według reguł języka — `Intl.PluralRules`. */
export function pluralCategory(count: number, locale: string): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(count);
}

/** Klucz i18n z końcówką plural (np. `motivation.exercises_few`) — do podglądu i testów; `t()` robi to samo sam. */
export function pluralKeyFor(item: MotivationItem, locale: string): string {
  return `${item.i18nKey}_${pluralCategory(item.count, locale)}`;
}

/** Następny indeks rotacji (zawija się). Pusta lista → 0. */
export const nextIndex = (index: number, length: number): number => (length <= 0 ? 0 : (index + 1) % length);

/** Indeks startowy dla `prefers-reduced-motion`: kolejna statystyka przy każdym wejściu w panel. */
export const startIndexForVisit = (visit: number, length: number): number =>
  length <= 0 ? 0 : ((visit % length) + length) % length;

// --- Liczniki z istniejących danych -------------------------------------------------------------------

export interface PracticeLogLike {
  exerciseType?: string;
  totalWords?: unknown;
  exercisesData?: unknown;
  detailedFeedback?: unknown;
}

export interface SessionLike {
  mode?: string;
  totalCards?: unknown;
}

/** Ile elementów (zdań) ma wpis ćwiczenia — jak w panelu: `totalWords`, inaczej długość listy wyników. */
export function logItemCount(log: PracticeLogLike): number {
  if (log.totalWords !== undefined && log.totalWords !== null) {
    const n = Number(log.totalWords);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  if (Array.isArray(log.exercisesData)) return log.exercisesData.length;
  if (Array.isArray(log.detailedFeedback)) return log.detailedFeedback.length;
  return 1;
}

const FLASHCARD_MODES = new Set(['flashcards', 'quiz', 'writing']);

/**
 * Liczniki z danych, które aplikacja i tak już czyta (nasłuchy panelu / pojedynczy odczyt practiceLogs przy
 * wejściu w generator): wpisy ćwiczeń, sesje fiszek (kontekst fiszek) i prace domowe. Zero nowych zapisów.
 *
 * `homeworkDone` / `sessions` = `undefined` oznacza „źródło niedostępne” (licznik pominięty, nie zero).
 * Uwaga o jakości: przed poprawką H1 (stan korekty po id) część wpisów practiceLogs mogła być zdublowana po drugiej
 * rundzie, więc liczby ćwiczeń i zdań u niektórych kursantów mogą być lekko zawyżone — danych nie poprawiamy.
 */
export function computeMotivationCounts(input: {
  logs: readonly PracticeLogLike[];
  sessions?: readonly SessionLike[];
  homeworkDone?: number;
}): MotivationCounts {
  let logExercises = 0;
  let translated = 0;
  let corrected = 0;
  for (const log of input.logs) {
    const type = log.exerciseType;
    if (type === 'Aktywność') continue;
    if (type !== 'homework' && type !== 'test') logExercises += 1;
    if (type === 'ai_translation') translated += logItemCount(log);
    else if (type === 'sentence_correction') corrected += logItemCount(log);
  }

  const counts: MotivationCounts = { translatedSentences: translated, correctedSentences: corrected };

  if (input.sessions) {
    let flashcards = 0;
    let pairs = 0;
    for (const session of input.sessions) {
      const cards = Number(session.totalCards);
      if (!Number.isFinite(cards) || cards < 1) continue;
      if (session.mode && FLASHCARD_MODES.has(session.mode)) flashcards += Math.floor(cards);
      else if (session.mode === 'matching') pairs += Math.floor(cards);
    }
    counts.exercises = logExercises + input.sessions.filter((s) => Boolean(s.mode)).length;
    counts.flashcards = flashcards;
    counts.pairs = pairs;
  } else {
    // Bez sesji fiszek nie znamy pełnej liczby ćwiczeń — nie pokazujemy zaniżonej.
  }
  if (typeof input.homeworkDone === 'number') counts.homework = input.homeworkDone;
  return counts;
}

/** Złączenie liczników z dwóch źródeł: dla każdego pola wygrywa większa wartość (źródła nie mierzą rzeczy rozłącznych). */
export function mergeMotivationCounts(a?: MotivationCounts | null, b?: MotivationCounts | null): MotivationCounts {
  const out: MotivationCounts = {};
  for (const key of ['exercises', 'translatedSentences', 'correctedSentences', 'flashcards', 'homework', 'pairs'] as const) {
    const values = [a?.[key], b?.[key]].filter((v): v is number => typeof v === 'number');
    if (values.length > 0) out[key] = Math.max(...values);
  }
  return out;
}

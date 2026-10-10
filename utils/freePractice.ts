/**
 * „Ćwiczenia dowolne" — kursant uruchamia ćwiczenie z pulpitu, poza pracą domową.
 *
 * Logika bez UI i bez Firebase: lista rodzajów, kroki przepływu, wybór wielu zestawów
 * i cel uruchomienia. Rodzaje oparte na zestawach (Fiszki, Quiz, Dopasowanie) to tryby, które moduł
 * fiszek (`FlashcardStudyScreen`) już ma — nic nowego w samych ćwiczeniach. Start nie niesie żadnego
 * pola pracy domowej (`taskId`, `specialTasks`…), a zapis wyniku robi ta sama ścieżka co dotąd
 * (`FlashcardContext.saveSession`: `sessions`, `practiceLogs`), która nie dotyka `specialTasks`.
 *
 * „Fiszki Intro" i „Pisanie" zniknęły z tego menu, ale zostają w module fiszek (używa ich m.in.
 * ekran „Moje słownictwo"). Korekta i Tłumaczenie zdań są na liście jako kafelki „wkrótce"
 * (`available: false`) — start dostaną z fazą generowania zdań przez AI.
 *
 * Zdania z AI (`AIExerciseGeneratorScreen`) celowo NIE są rodzajem z tej listy: ten
 * ekran po ukończeniu ustawia `specialTasks/{id}.status = 'submitted'`, gdy źródłem
 * jest zadanie lektora (`special-task-…`), więc nie spełniałby warunku „nie zmienia
 * statusu pracy domowej".
 */

export type FreePracticeMode = 'flashcards' | 'quiz' | 'matching' | 'correction' | 'translation';

/** Akcent kafelka: nazwa tokenu motywu (kolor służy rozpoznaniu rodzaju, nie ozdobie). */
export type FreePracticeAccent = 'primary' | 'info' | 'accent-2' | 'warn';

/** Klucz ikony (lucide-react); mapowanie na komponent robi ekran, tu zostaje czysta logika. */
export type FreePracticeIcon = 'layers' | 'listChecks' | 'link' | 'spellCheck' | 'languages';

export interface FreePracticeType {
  mode: FreePracticeMode;
  /** Klucze i18n (pl.json / en.json) — nazwa i jedno zdanie opisu. */
  titleKey: string;
  descriptionKey: string;
  icon: FreePracticeIcon;
  accent: FreePracticeAccent;
  /** `false` = kafelek „wkrótce": widoczny, wyłączony, z opisem. */
  available: boolean;
}

/** Kolejność = kolejność na ekranie. Pierwszy jest domyślnie wybrany. */
export const FREE_PRACTICE_TYPES: readonly FreePracticeType[] = [
  { mode: 'flashcards', titleKey: 'Fiszki', descriptionKey: 'Odwracaj karty i sprawdzaj, co pamiętasz', icon: 'layers', accent: 'primary', available: true },
  { mode: 'quiz', titleKey: 'Quiz', descriptionKey: 'Szybki test wielokrotnego wyboru', icon: 'listChecks', accent: 'info', available: true },
  { mode: 'matching', titleKey: 'Dopasowanie', descriptionKey: 'Połącz słowo z jego znaczeniem', icon: 'link', accent: 'accent-2', available: true },
  { mode: 'correction', titleKey: 'Korekta zdań', descriptionKey: 'Znajdź błąd w zdaniu i popraw go', icon: 'spellCheck', accent: 'warn', available: false },
  { mode: 'translation', titleKey: 'Tłumaczenie zdań', descriptionKey: 'Przetłumacz zdania na angielski', icon: 'languages', accent: 'info', available: false },
];

export const DEFAULT_FREE_PRACTICE_MODE: FreePracticeMode = FREE_PRACTICE_TYPES[0].mode;

/** Tryby, które da się dziś uruchomić (moduł fiszek). */
export const STUDY_MODES: readonly FreePracticeMode[] = ['flashcards', 'quiz', 'matching'];

export function isFreePracticeModeAvailable(mode: FreePracticeMode): boolean {
  return FREE_PRACTICE_TYPES.some((type) => type.mode === mode && type.available);
}

// --- Kroki przepływu -----------------------------------------------------------------------

/** 1) rodzaj ćwiczenia, 2) zakres / materiał, 3) start. */
export const FREE_PRACTICE_STEPS = ['type', 'scope', 'start'] as const;
export type FreePracticeStep = (typeof FREE_PRACTICE_STEPS)[number];

export function stepNumber(step: FreePracticeStep): number {
  return FREE_PRACTICE_STEPS.indexOf(step) + 1;
}

export function nextStep(step: FreePracticeStep): FreePracticeStep {
  return FREE_PRACTICE_STEPS[Math.min(FREE_PRACTICE_STEPS.length - 1, FREE_PRACTICE_STEPS.indexOf(step) + 1)];
}

export function previousStep(step: FreePracticeStep): FreePracticeStep {
  return FREE_PRACTICE_STEPS[Math.max(0, FREE_PRACTICE_STEPS.indexOf(step) - 1)];
}

// --- Start ---------------------------------------------------------------------------------

/** Dokąd prowadzi start ćwiczenia — wyłącznie widok nauki fiszek, zestawy i tryb. */
export interface FreePracticeLaunch {
  view: 'flashcard-study';
  /** Pierwszy wybrany zestaw (zgodność z modułem, który zna jeden `setId`). */
  setId: string;
  /** Wszystkie wybrane zestawy, w kolejności wyboru. */
  setIds: string[];
  mode: FreePracticeMode;
}

export function freePracticeLaunch(mode: FreePracticeMode, setIds: readonly string[]): FreePracticeLaunch {
  const ids = [...setIds];
  return { view: 'flashcard-study', setId: ids[0] ?? '', setIds: ids, mode };
}

// --- Zakres: wielokrotny wybór zestawów ----------------------------------------------------

interface SetLike {
  id: string;
  title?: string;
  description?: string;
  lessonTopic?: string;
  isGeneral?: boolean;
  isDraft?: boolean;
  cardCount?: number;
  flashcards?: readonly unknown[];
}

/** Liczba kart: `cardCount` (zestawy z bazy i lekcyjne) albo długość wbudowanej listy (słownictwo ogólne). */
export function setCardCount(set: SetLike): number {
  if (typeof set.cardCount === 'number') return set.cardCount;
  return Array.isArray(set.flashcards) ? set.flashcards.length : 0;
}

/** Zestaw bez kart nie nadaje się do nauki — i nie wolno go wysłać do ładowania (spadłoby na generowanie AI). */
export function isSetSelectable(set: SetLike): boolean {
  return !set.isDraft && setCardCount(set) > 0;
}

/** Górny limit zestawów w jednym ćwiczeniu — długie sesje z dziesiątek zestawów nie mają sensu. */
export const MAX_FREE_PRACTICE_SETS = 10;

/**
 * Własne zestawy i z lekcji idą na wierzch, słownictwo ogólne (długa, stała lista)
 * osobno — ekran chowa je w rozwijanej sekcji. Szkice (`isDraft`) nie są do nauki.
 */
export function groupFreePracticeSets<T extends SetLike>(sets: readonly T[]): { own: T[]; general: T[] } {
  const own: T[] = [];
  const general: T[] = [];
  for (const set of sets) {
    if (!set || set.isDraft) continue;
    (set.isGeneral ? general : own).push(set);
  }
  return { own, general };
}

const fold = (text: string) =>
  text
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

/** Wyszukiwarka: bez rozróżniania wielkości liter i polskich znaków, po tytule, temacie i opisie. */
export function filterSetsByQuery<T extends SetLike>(sets: readonly T[], query: string): T[] {
  const needle = fold(query.trim());
  if (!needle) return [...sets];
  return sets.filter((set) => fold(`${set.title ?? ''} ${set.lessonTopic ?? ''} ${set.description ?? ''}`).includes(needle));
}

/** Dodaje albo zdejmuje zestaw; kolejność wyboru zachowana, powyżej limitu nowy się nie dodaje. */
export function toggleSetSelection(
  selected: readonly string[],
  id: string,
  max: number = MAX_FREE_PRACTICE_SETS,
): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return selected.length >= max ? [...selected] : [...selected, id];
}

/** Zostawia tylko zestawy, które nadal istnieją i są do nauki (lista zestawów potrafi się zmienić w trakcie). */
export function pruneSelection<T extends SetLike>(selected: readonly string[], sets: readonly T[]): string[] {
  const ok = new Set(sets.filter(isSetSelectable).map((set) => set.id));
  return selected.filter((id) => ok.has(id));
}

export interface SelectionSummary {
  sets: number;
  cards: number;
}

export function summarizeSelection<T extends SetLike>(sets: readonly T[], selected: readonly string[]): SelectionSummary {
  const byId = new Map(sets.map((set) => [set.id, set]));
  let cards = 0;
  let count = 0;
  for (const id of selected) {
    const set = byId.get(id);
    if (!set) continue;
    count += 1;
    cards += setCardCount(set);
  }
  return { sets: count, cards };
}

/** Minimalna liczba kart, żeby tryb miał sens (quiz potrzebuje wariantów odpowiedzi, dopasowanie par). */
export const MIN_CARDS: Partial<Record<FreePracticeMode, number>> = { flashcards: 1, quiz: 4, matching: 2 };

export type StartBlocker = 'unavailable' | 'no-sets' | 'too-few-cards';

export function startBlocker(mode: FreePracticeMode, summary: SelectionSummary): { blocker: StartBlocker | null; min: number } {
  const min = MIN_CARDS[mode] ?? 0;
  if (!isFreePracticeModeAvailable(mode)) return { blocker: 'unavailable', min };
  if (summary.sets === 0) return { blocker: 'no-sets', min };
  if (summary.cards < min) return { blocker: 'too-few-cards', min };
  return { blocker: null, min };
}

/**
 * Klawiatura w grupie rodzajów (`role="radiogroup"`): strzałki przechodzą cyklicznie po rodzajach
 * dostępnych (kafelki „wkrótce" są pomijane), Home/End na początek i koniec.
 * Inny klawisz → `null` (zostaje przeglądarce).
 */
export function nextFreePracticeMode(
  current: FreePracticeMode,
  key: string,
  types: readonly FreePracticeType[] = FREE_PRACTICE_TYPES,
): FreePracticeMode | null {
  const enabled = types.filter((type) => type.available);
  const index = enabled.findIndex((type) => type.mode === current);
  if (index < 0 || enabled.length === 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return enabled[(index + 1) % enabled.length].mode;
    case 'ArrowLeft':
    case 'ArrowUp':
      return enabled[(index - 1 + enabled.length) % enabled.length].mode;
    case 'Home':
      return enabled[0].mode;
    case 'End':
      return enabled[enabled.length - 1].mode;
    default:
      return null;
  }
}

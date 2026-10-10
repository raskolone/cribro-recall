/**
 * „Ćwiczenia dowolne" — jedno menu ćwiczeń poza pracą domową.
 *
 * Logika bez UI i bez Firebase: lista rodzajów, kroki przepływu, wybór źródeł i cel uruchomienia.
 * Pięć rodzajów w dwóch grupach:
 *  - oparte na zestawach (Fiszki, Quiz, Dopasowanie) — tryby, które moduł fiszek
 *    (`FlashcardStudyScreen`) już ma; zakres = wielokrotny wybór istniejących zestawów, bez AI;
 *  - zdania z AI (Tłumaczenie, Korekta) — generator zdań w trybie `free`
 *    (`AIExerciseGeneratorScreen mode="free"`); zakres = zestawy i lekcje (oraz tematy).
 *
 * Start nie niesie żadnego pola pracy domowej (`taskId`, `specialTasks`…). Zapis wyniku fiszek robi
 * `FlashcardContext.saveSession`, a generator w trybie `free` nie woła aktualizacji `specialTasks`
 * (patrz `utils/specialTaskSubmission.ts`).
 */

import { resolveLessonShortcut, shortcutKind, type LessonLike } from './freeSentenceScope';
import { sanitizeFreeText } from './sanitizeFreeText';

export type FreePracticeMode = 'flashcards' | 'quiz' | 'matching' | 'correction' | 'translation';

/** Akcent kafelka: nazwa tokenu motywu (kolor służy rozpoznaniu rodzaju, nie ozdobie). */
export type FreePracticeAccent = 'primary' | 'info' | 'accent-2' | 'warn';

/** Klucz ikony (lucide-react); mapowanie na komponent robi ekran, tu zostaje czysta logika. */
export type FreePracticeIcon = 'layers' | 'listChecks' | 'link' | 'spellCheck' | 'languages';

export type PracticeSection = 'warmup' | 'advanced';

export interface FreePracticeType {
  mode: FreePracticeMode;
  /** Klucze i18n (pl.json / en.json) — nazwa i jedno zdanie opisu. */
  titleKey: string;
  descriptionKey: string;
  icon: FreePracticeIcon;
  accent: FreePracticeAccent;
  section: PracticeSection;
  recommended?: boolean;
}

export const WARMUP_MODES: readonly FreePracticeMode[] = ['flashcards', 'matching'];
export const ADVANCED_MODES: readonly FreePracticeMode[] = ['translation', 'quiz', 'correction'];

/** Kolejność = kolejność na ekranie. Pierwszy jest domyślnie wybrany (Fiszki — polecane na start). */
export const FREE_PRACTICE_TYPES: readonly FreePracticeType[] = [
  { mode: 'flashcards', titleKey: 'Fiszki', descriptionKey: 'Odwracaj karty i sprawdzaj, co pamiętasz', icon: 'layers', accent: 'primary', section: 'warmup', recommended: true },
  { mode: 'matching', titleKey: 'Dopasowanie', descriptionKey: 'Połącz słowo z jego znaczeniem', icon: 'link', accent: 'accent-2', section: 'warmup' },
  { mode: 'translation', titleKey: 'Tłumaczenie zdań', descriptionKey: 'Przetłumacz zdania na angielski', icon: 'languages', accent: 'info', section: 'advanced' },
  { mode: 'quiz', titleKey: 'Quiz', descriptionKey: 'Szybki test wielokrotnego wyboru', icon: 'listChecks', accent: 'info', section: 'advanced' },
  { mode: 'correction', titleKey: 'Korekta zdań', descriptionKey: 'Znajdź błąd w zdaniu i popraw go', icon: 'spellCheck', accent: 'warn', section: 'advanced' },
];

export const DEFAULT_FREE_PRACTICE_MODE: FreePracticeMode = FREE_PRACTICE_TYPES[0].mode;

/** Tryby modułu fiszek (zakres: zestawy, bez AI). */
export const STUDY_MODES: readonly FreePracticeMode[] = ['flashcards', 'quiz', 'matching'];

/** Tryby zdań z AI (zakres: zestawy, lekcje, tematy). */
export const SENTENCE_MODES: readonly FreePracticeMode[] = ['translation', 'correction'];

export function isSentenceMode(mode: FreePracticeMode): boolean {
  return SENTENCE_MODES.includes(mode);
}

/** Format ćwiczenia w generatorze zdań: „Sprawdź się" (tłumaczenie) albo „Napraw zdanie" (korekta). */
export type SentenceFormat = 'typing' | 'correction';

export function sentenceFormatFor(mode: FreePracticeMode): SentenceFormat {
  return mode === 'correction' ? 'correction' : 'typing';
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

/** Start ćwiczenia z zestawów — widok nauki fiszek, zestawy i tryb. */
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

/** Zakres zdań z AI: zestawy, lekcje (id zestawów słownictwa z lekcji) i tematy wpisane ręcznie. */
export interface SentenceScope {
  setIds: string[];
  lessonIds: string[];
  topics?: string[];
}

export const EMPTY_SENTENCE_SCOPE: SentenceScope = { setIds: [], lessonIds: [], topics: [] };

/** Start zdań z AI — generator w trybie `free`. Żadnego pola zadania lektora. */
export interface FreeSentencesLaunch extends SentenceScope {
  view: 'free-sentences';
  mode: 'translation' | 'correction';
  format: SentenceFormat;
}

export function freeSentencesLaunch(mode: 'translation' | 'correction', scope: SentenceScope): FreeSentencesLaunch {
  return {
    view: 'free-sentences',
    mode,
    format: sentenceFormatFor(mode),
    setIds: [...scope.setIds],
    lessonIds: [...scope.lessonIds],
    topics: scope.topics ? [...scope.topics] : [],
  };
}

export type AnyFreeLaunch = FreePracticeLaunch | FreeSentencesLaunch;

export function buildFreeLaunch(mode: FreePracticeMode, scope: SentenceScope): AnyFreeLaunch {
  return mode === 'translation' || mode === 'correction'
    ? freeSentencesLaunch(mode, scope)
    : freePracticeLaunch(mode, scope.setIds);
}

// --- Stan początkowy menu (powrót z ćwiczenia, skrót z innego ekranu) ---------------------------

/** Wstępny stan menu: powrót z ćwiczenia albo skrót „Przećwicz w zdaniach AI" z innego ekranu. */
export interface FreePracticeInitial {
  mode?: FreePracticeMode;
  step?: FreePracticeStep;
  setIds?: string[];
  lessonIds?: string[];
  topics?: string[];
}

/**
 * Skrót „Przećwicz w zdaniach AI" (zestaw, fiszki, historia lekcji): menu z Tłumaczeniem i wstępnie
 * wybranym zakresem, od razu na kroku zakresu. Nieznany albo pusty zakres → menu od początku,
 * ale nadal z Tłumaczeniem.
 */
export function shortcutInitial(
  rawId: string | null | undefined,
  lessons: readonly LessonLike[],
  sets: ReadonlyArray<SetLike>,
): FreePracticeInitial {
  const fallback: FreePracticeInitial = { mode: 'translation' };
  if (!rawId) return fallback;
  if (shortcutKind(rawId) === 'lesson') {
    const lessonId = resolveLessonShortcut(rawId, lessons);
    return lessonId ? { mode: 'translation', step: 'scope', lessonIds: [lessonId] } : fallback;
  }
  const set = sets.find((candidate) => candidate.id === rawId);
  return set && isSetSelectable(set) ? { mode: 'translation', step: 'scope', setIds: [rawId] } : fallback;
}

// --- Zakres: wielokrotny wybór zestawów ----------------------------------------------------

interface SetLike {
  id: string;
  title?: string;
  description?: string;
  lessonTopic?: string;
  isGeneral?: boolean;
  isDraft?: boolean;
  isLessonVocabulary?: boolean;
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
export interface CategorizedSets<T> {
  lessons: T[];
  general: T[];
  user: T[];
}

/**
 * Podział na 3 kategorie:
 * 1) "Z moich lekcji" (`isLessonVocabulary`)
 * 2) "Gotowe zestawy" (`isGeneral`)
 * 3) "Moje zestawy" (własne zestawy kursanta, bez szkiców)
 */
export function categorizeFreePracticeSets<T extends SetLike>(sets: readonly T[]): CategorizedSets<T> {
  const lessons: T[] = [];
  const general: T[] = [];
  const user: T[] = [];
  for (const set of sets) {
    if (!set || set.isDraft) continue;
    if (set.isLessonVocabulary) {
      lessons.push(set);
    } else if (set.isGeneral) {
      general.push(set);
    } else {
      user.push(set);
    }
  }
  return { lessons, general, user };
}

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

/** Łączny limit źródeł (zestawy + lekcje + tematy) w jednym ćwiczeniu ze zdań — prompt nie może puchnąć. */
export const MAX_SENTENCE_SOURCES = 5;
/** Tematy wpisane ręcznie: liczba i długość jednego (to samo ogranicza serwer). */
export const MAX_SENTENCE_TOPICS = 3;
export const MAX_TOPIC_LENGTH = 80;

/**
 * Temat wpisany ręcznie → ta sama normalizacja co na serwerze (`sanitizeFreeText`), obcięty do
 * `MAX_TOPIC_LENGTH`. Pusty wynik = temat odrzucony.
 */
export function normalizeTopic(raw: string): string {
  return sanitizeFreeText(raw, MAX_TOPIC_LENGTH);
}

/** Czy da się dodać jeszcze jeden temat (limit tematów i łączny limit źródeł). */
export function canAddTopic(topics: readonly string[], otherSources: number): boolean {
  return topics.length < MAX_SENTENCE_TOPICS && topics.length + otherSources < MAX_SENTENCE_SOURCES;
}

/** Dodaje temat: pusty, powtórzony (bez rozróżniania wielkości liter) albo ponad limit — bez zmiany. */
export function addTopic(topics: readonly string[], raw: string, otherSources = 0): string[] {
  const topic = normalizeTopic(raw);
  if (!topic) return [...topics];
  const key = topic.toLocaleLowerCase('pl');
  if (topics.some((existing) => existing.toLocaleLowerCase('pl') === key)) return [...topics];
  if (!canAddTopic(topics, otherSources)) return [...topics];
  return [...topics, topic];
}

export function removeTopic(topics: readonly string[], topic: string): string[] {
  return topics.filter((existing) => existing !== topic);
}

export type StartBlocker = 'no-sets' | 'too-few-cards' | 'no-scope' | 'too-many-sources';

export function sentenceSourceCount(scope: SentenceScope): number {
  return scope.setIds.length + scope.lessonIds.length + (scope.topics?.length ?? 0);
}

export function startBlocker(mode: FreePracticeMode, summary: SelectionSummary): { blocker: StartBlocker | null; min: number } {
  const min = MIN_CARDS[mode] ?? 0;
  if (summary.sets === 0) return { blocker: 'no-sets', min };
  if (summary.cards < min) return { blocker: 'too-few-cards', min };
  return { blocker: null, min };
}

/** Blokada startu dla zdań z AI: trzeba wybrać choć jedno źródło, nie więcej niż limit. */
export function sentenceStartBlocker(scope: SentenceScope): StartBlocker | null {
  const count = sentenceSourceCount(scope);
  if (count === 0) return 'no-scope';
  if (count > MAX_SENTENCE_SOURCES) return 'too-many-sources';
  return null;
}

/**
 * Klawiatura w grupie rodzajów (`role="radiogroup"`): strzałki przechodzą cyklicznie po rodzajach,
 * Home/End na początek i koniec.
 * Inny klawisz → `null` (zostaje przeglądarce).
 */
export function nextFreePracticeMode(
  current: FreePracticeMode,
  key: string,
  types: readonly FreePracticeType[] = FREE_PRACTICE_TYPES,
): FreePracticeMode | null {
  const enabled = types;
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

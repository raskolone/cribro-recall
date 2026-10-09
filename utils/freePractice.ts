/**
 * „Ćwiczenia dowolne" — kursant uruchamia ćwiczenie z pulpitu, poza pracą domową.
 *
 * Logika bez UI i bez Firebase: lista rodzajów, cel uruchomienia i podział
 * zestawów. Rodzaje to dokładnie tryby, które moduł fiszek (`FlashcardStudyScreen`)
 * już ma — nic nowego w samych ćwiczeniach. Start nie niesie żadnego pola pracy
 * domowej (`taskId`, `specialTasks`…), a zapis wyniku robi ta sama ścieżka co
 * dotąd (`FlashcardContext.saveSession`: `sessions`, `practiceLogs`), która nie
 * dotyka `specialTasks`.
 *
 * Zdania z AI (`AIExerciseGeneratorScreen`) celowo NIE są rodzajem z tej listy: ten
 * ekran po ukończeniu ustawia `specialTasks/{id}.status = 'submitted'`, gdy źródłem
 * jest zadanie lektora (`special-task-…`), więc nie spełniałby warunku „nie zmienia
 * statusu pracy domowej".
 */

export type FreePracticeMode = 'intro' | 'flashcards' | 'quiz' | 'writing' | 'matching';

export interface FreePracticeType {
  mode: FreePracticeMode;
  /** Klucze i18n (pl.json / en.json) — nazwa i jedno zdanie opisu. */
  titleKey: string;
  descriptionKey: string;
}

/** Kolejność = kolejność na ekranie. Pierwszy jest domyślnie wybrany. */
export const FREE_PRACTICE_TYPES: readonly FreePracticeType[] = [
  { mode: 'flashcards', titleKey: 'Fiszki', descriptionKey: 'Odwracaj karty i sprawdzaj, co pamiętasz' },
  { mode: 'quiz', titleKey: 'Quiz', descriptionKey: 'Szybki test wielokrotnego wyboru' },
  { mode: 'writing', titleKey: 'Pisanie', descriptionKey: 'Wpisz brakujące słowo w zdaniu' },
  { mode: 'matching', titleKey: 'Dopasowanie', descriptionKey: 'Połącz słowo z jego znaczeniem' },
  { mode: 'intro', titleKey: 'Fiszki Intro', descriptionKey: 'Poznaj materiał spokojnie, bez wyników' },
];

export const DEFAULT_FREE_PRACTICE_MODE: FreePracticeMode = FREE_PRACTICE_TYPES[0].mode;

/** Dokąd prowadzi start ćwiczenia — wyłącznie widok nauki fiszek, zestaw i tryb. */
export interface FreePracticeLaunch {
  view: 'flashcard-study';
  setId: string;
  mode: FreePracticeMode;
}

export function freePracticeLaunch(mode: FreePracticeMode, setId: string): FreePracticeLaunch {
  return { view: 'flashcard-study', setId, mode };
}

interface SetLike {
  id: string;
  isGeneral?: boolean;
  isDraft?: boolean;
}

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

/**
 * Klawiatura w grupie rodzajów (`role="radiogroup"`): strzałki przechodzą cyklicznie,
 * Home/End na początek i koniec. Inny klawisz → `null` (zostaje przeglądarce).
 */
export function nextFreePracticeMode(
  current: FreePracticeMode,
  key: string,
  types: readonly FreePracticeType[] = FREE_PRACTICE_TYPES,
): FreePracticeMode | null {
  const index = types.findIndex((type) => type.mode === current);
  if (index < 0 || types.length === 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return types[(index + 1) % types.length].mode;
    case 'ArrowLeft':
    case 'ArrowUp':
      return types[(index - 1 + types.length) % types.length].mode;
    case 'Home':
      return types[0].mode;
    case 'End':
      return types[types.length - 1].mode;
    default:
      return null;
  }
}

/**
 * Zakres „zdań z AI" w Ćwiczeniach dowolnych: lekcje, skróty z innych ekranów i zbieranie słów.
 *
 * Czysta logika z wstrzykiwanymi zależnościami — bez Firebase i bez React, żeby dało się ją
 * sprawdzić w `node:test`. Nic tu nie zna zadań lektora (`specialTasks`).
 */
import { getApprovedVocabularyText } from './vocabulary';

/** Zestaw słownictwa z lekcji (`VocabularySet`) w zakresie, którego potrzebuje ten moduł. */
export interface LessonLike {
  id: string;
  title?: string;
  topic?: string;
  date?: string;
  lessonRecordId?: string;
  vocabularyText?: string;
  approvedItems?: string[];
}

const fold = (text: string) =>
  text
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

/** Wyszukiwarka lekcji: bez rozróżniania wielkości liter i polskich znaków, po tytule i temacie. */
export function filterLessonsByQuery<T extends LessonLike>(lessons: readonly T[], query: string): T[] {
  const needle = fold(query.trim());
  if (!needle) return [...lessons];
  return lessons.filter((lesson) => fold(`${lesson.title ?? ''} ${lesson.topic ?? ''}`).includes(needle));
}

/** Zostawia tylko lekcje, które nadal istnieją (lista potrafi się zmienić w trakcie). */
export function pruneLessonSelection(selected: readonly string[], lessons: readonly LessonLike[]): string[] {
  const ok = new Set(lessons.map((lesson) => lesson.id));
  return selected.filter((id) => ok.has(id));
}

/**
 * Skrót z innego ekranu niesie `lesson_<id>` / `vocab-<id>` / `set-<id>`, gdzie `<id>` bywa id zestawu
 * słownictwa, id zapisu lekcji albo `generated-<id>` (starsze lekcje bez zestawu). Zwraca id zestawu,
 * który da się wybrać w menu, albo `null`.
 */
export function resolveLessonShortcut(rawId: string, lessons: readonly LessonLike[]): string | null {
  const clean = rawId.replace(/^(lesson_|vocab-|set-)/, '');
  const found = lessons.find(
    (lesson) => lesson.id === clean || lesson.lessonRecordId === clean || lesson.id === `generated-${clean}`,
  );
  return found ? found.id : null;
}

export type ShortcutKind = 'lesson' | 'set';

/** Rozpoznanie skrótu: lekcja (`lesson_…`, `vocab-…`) albo zestaw fiszek. */
export function shortcutKind(rawId: string): ShortcutKind {
  return /^(lesson_|vocab-)/.test(rawId) ? 'lesson' : 'set';
}

/** Ile słów z zakresu idzie do jednego zapytania. */
export const MAX_SCOPE_WORDS = 20;

export interface ScopeWordsDeps {
  /** `FlashcardContext.getFlashcards` — dla zestawów ogólnych i własnych. */
  getFlashcards: (setId: string) => Promise<ReadonlyArray<{ term: string; definition?: string }>>;
  lessons: readonly LessonLike[];
  /** Losowość wstrzykiwana, żeby test był deterministyczny. */
  shuffle?: <T>(items: T[]) => T[];
}

const defaultShuffle = <T,>(items: T[]): T[] => [...items].sort(() => 0.5 - Math.random());

/**
 * Słowa z wybranych zestawów i lekcji: bez powtórzeń, przemieszane, do `MAX_SCOPE_WORDS`.
 * Karta z tłumaczeniem daje `termin (znaczenie)`, jak w dotychczasowym generatorze.
 * Zestaw, który się nie wczytał, jest pomijany — reszta zakresu działa dalej.
 */
export async function resolveFreeScopeWords(
  scope: { setIds: readonly string[]; lessonIds: readonly string[] },
  deps: ScopeWordsDeps,
): Promise<string[]> {
  const shuffle = deps.shuffle ?? defaultShuffle;
  const words: string[] = [];

  const lists = await Promise.all(
    scope.setIds.map((id) => deps.getFlashcards(id).catch(() => [] as Array<{ term: string; definition?: string }>)),
  );
  for (const cards of lists) {
    for (const card of cards) {
      const term = (card.term ?? '').trim();
      if (!term) continue;
      words.push(card.definition ? `${term} (${card.definition})` : term);
    }
  }

  for (const id of scope.lessonIds) {
    const lesson = deps.lessons.find((l) => l.id === id);
    if (!lesson) continue;
    const items = getApprovedVocabularyText(lesson)
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    words.push(...items);
  }

  return shuffle(Array.from(new Set(words))).slice(0, MAX_SCOPE_WORDS);
}

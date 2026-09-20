import { HomeworkType } from '../types';
import { CanonicalExerciseType, exerciseUiCopy, normalizeExercise } from './normalizeExercise';

/**
 * Adapter kanoniczny dla rozgrzewki (`HomeworkWarmupScrambler.tsx`).
 *
 * Dotąd rozgrzewka miała własny, równoległy łańcuch normalizacji pól
 * (`correctTranslation`, `chunks`, `sentence`, ...) i zawsze pokazywała
 * nagłówek rozsypanki, nawet gdy źródłowe zadanie było tłumaczeniem albo
 * poprawą błędu — patrz AGENT_LOG.md, hotfix P0 (2026-09-20). Ta funkcja
 * deleguje rozpoznanie typu i czyszczenie pól do `normalizeExercise`
 * (ten sam adapter, którego używa `HomeworkExercise.tsx`), żeby nie
 * istniała druga mapa semantyki ani druga mapa i18n.
 */
export interface WarmupRound {
  /** Indeks oryginalnego elementu w przekazanej tablicy `sentences` — potrzebny do trwałego zapisu próby. */
  itemIndex: number;
  type: CanonicalExerciseType;
  heading: string;
  instruction: string;
  /** Zdanie źródłowe do pokazania nad rozsypanką (polskie zdanie / zdanie z błędem), gdy istnieje. */
  sourceLabel?: string;
  /** Zdanie wzorcowe do ułożenia z tokenów. */
  targetSentence: string;
  hint?: string;
}

const countWords = (sentence: string): number =>
  sentence.trim().split(/\s+/).filter(Boolean).length;

export function buildWarmupRounds(
  sentences: any[],
  task?: { type?: HomeworkType } | null
): WarmupRound[] {
  if (!Array.isArray(sentences) || sentences.length === 0) return [];

  const rounds: WarmupRound[] = [];

  sentences.forEach((raw, itemIndex) => {
    const exercise = normalizeExercise(raw, task);
    if (exercise.state !== 'ready') return;

    let targetSentence: string | undefined;
    let sourceLabel: string | undefined;

    if (exercise.type === 'word_order') {
      targetSentence =
        exercise.correctSentence ||
        (exercise.tokens && exercise.tokens.length > 0 ? exercise.tokens.join(' ') : undefined);
      sourceLabel = exercise.sourceSentence;
    } else if (exercise.type === 'translation') {
      targetSentence = exercise.correctSentence;
      sourceLabel = exercise.sourceSentence;
    } else if (exercise.type === 'find_errors') {
      targetSentence = exercise.correctSentence;
      sourceLabel = exercise.incorrectSentence;
    } else {
      // fill_in_the_blank: bez niezawodnego sposobu odtworzenia pełnego
      // zdania z samych segmentów luk (bank słów nie gwarantuje kolejności)
      // — używamy WYŁĄCZNIE jawnego zdania wzorcowego, jeśli generator je
      // dołączył, zamiast zgadywać złożenie luk (CLAUDE.md: zero zgadywania).
      targetSentence =
        typeof exercise.raw?.correctSentence === 'string' ? exercise.raw.correctSentence :
        typeof exercise.raw?.fullSentence === 'string' ? exercise.raw.fullSentence :
        undefined;
      sourceLabel = undefined;
    }

    if (!targetSentence || typeof targetSentence !== 'string' || !targetSentence.trim()) return;

    const trimmed = targetSentence.trim();
    const wordCount = countWords(trimmed);
    // Ten sam próg co dotychczas: 3–20 słów, żeby rozgrzewka nie przeciążała kursanta.
    if (wordCount < 3 || wordCount > 20) return;

    const { heading, instruction } = exerciseUiCopy(exercise.type);

    rounds.push({
      itemIndex,
      type: exercise.type,
      heading,
      instruction,
      sourceLabel,
      targetSentence: trimmed,
      hint: exercise.hint,
    });
  });

  // Maksymalnie 3 zdania na rozgrzewkę — jak dotychczas.
  return rounds.slice(0, 3);
}

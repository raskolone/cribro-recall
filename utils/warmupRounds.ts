import { HomeworkType } from '../types';
import { CanonicalExerciseType, normalizeExercise } from './normalizeExercise';

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
  type: CanonicalExerciseType | 'warmup_chunk';
  heading: string;
  instruction: string;
  /** Polskie zdanie — polecenie rundy (zawsze ustawione). */
  sourceLabel?: string;
  /** Zdanie wzorcowe do ułożenia z tokenów. */
  targetSentence: string;
  hint?: string;
  /** Zdefiniowane z góry fragmenty (chunks). Jeśli brak, używa się podziału na słowa. */
  chunks?: string[];
}

const countWords = (sentence: string): number =>
  sentence.trim().split(/\s+/).filter(Boolean).length;

/** Rozgrzewka zawsze każe ułożyć angielskie zdanie z polskiego polecenia — niezależnie od typu zadania źródłowego. */
const WARMUP_HEADING = 'Ułóż zdanie';
const WARMUP_INSTRUCTION = 'Ułóż zdanie po angielsku z kafelków.';

export function buildWarmupRounds(
  sentences: any[],
  task?: any | null
): WarmupRound[] {
  // 1. Nowy format: jeśli jest zdefiniowane pole warmup w SpecialTask (tablica)
  // Niepusta tablica bez ani jednego elementu z polishTranslation (stary kształt
  // z polishHint) to brak pola — wraca stara rozgrzewka, nic nie migrujemy.
  const hasPolishItem =
    task &&
    Array.isArray(task.warmup) &&
    task.warmup.some((ex: any) => typeof ex?.polishTranslation === 'string' && ex.polishTranslation.trim());
  if (task && Array.isArray(task.warmup) && (task.warmup.length === 0 || hasPolishItem)) {
    if (task.warmup.length === 0) {
      return []; // pusta rozgrzewka = brak rozgrzewki (świadoma decyzja lektora)
    }
    const warmupRounds: WarmupRound[] = [];
    task.warmup.forEach((ex: any, idx: number) => {
      const polish = typeof ex?.polishTranslation === 'string' ? ex.polishTranslation.trim() : '';
      // Bez polskiego tłumaczenia nie ma polecenia — pomijamy rundę (indeks
      // `idx` zostaje oryginalny, żeby zapisane próby się nie rozjechały).
      if (!polish) return;
      if (!Array.isArray(ex?.chunks) || ex.chunks.length === 0) return;
      if (typeof ex?.correctSentence !== 'string' || !ex.correctSentence.trim()) return;
      warmupRounds.push({
        itemIndex: idx, // Rozgrzewki mają osobną indeksację
        type: 'warmup_chunk',
        heading: WARMUP_HEADING,
        instruction: WARMUP_INSTRUCTION,
        sourceLabel: polish,
        targetSentence: ex.correctSentence,
        chunks: ex.chunks,
        hint: '',
      });
    });
    return warmupRounds;
  }

  // 2. Stary format (warmup === undefined): budujemy z zadań (sentences)
  if (!Array.isArray(sentences) || sentences.length === 0) return [];

  const rounds: WarmupRound[] = [];

  sentences.forEach((raw, itemIndex) => {
    const exercise = normalizeExercise(raw, task);
    if (exercise.state !== 'ready') return;

    // Polecenie rundy to ZAWSZE polskie zdanie. Element bez polskiego
    // odpowiednika jest pomijany — nigdy nie pokazujemy angielskiego zdania
    // (zwłaszcza z błędem) jako polecenia, bo kafelki ujawniłyby odpowiedź.
    let targetSentence: string | undefined;
    let sourceLabel: string | undefined;

    if (exercise.type === 'word_order') {
      targetSentence =
        exercise.correctSentence ||
        (exercise.tokens && exercise.tokens.length > 0 ? exercise.tokens.join(' ') : undefined);
      sourceLabel = exercise.sourceSentence; // polishHint
    } else if (exercise.type === 'translation') {
      targetSentence = exercise.correctSentence;
      sourceLabel = exercise.sourceSentence; // polishSentence
    } else if (exercise.type === 'find_errors') {
      targetSentence = exercise.correctSentence;
      sourceLabel = typeof exercise.meaning === 'string' ? exercise.meaning : undefined; // polishHint / meaning
    }
    // fill_in_the_blank (i matching / multiple_choice, które normalizeExercise
    // odrzuca) nie mają polskiego odpowiednika całego zdania — brak rundy.

    if (!sourceLabel || !sourceLabel.trim()) return;
    sourceLabel = sourceLabel.trim();

    if (!targetSentence || typeof targetSentence !== 'string' || !targetSentence.trim()) return;

    const trimmed = targetSentence.trim();
    const wordCount = countWords(trimmed);
    // Ten sam próg co dotychczas: 3–20 słów
    if (wordCount < 3 || wordCount > 20) return;

    rounds.push({
      itemIndex,
      type: exercise.type,
      heading: WARMUP_HEADING,
      instruction: WARMUP_INSTRUCTION,
      sourceLabel,
      targetSentence: trimmed,
      hint: exercise.hint,
    });
  });

  return rounds.slice(0, 3);
}

import { HomeworkType } from '../types';
import { CanonicalExerciseType, normalizeExercise } from './normalizeExercise';
import { MIN_SENTENCE_WORDS, resolveChunks } from './warmupChunks';
import { findConflictingPrompts, pickSafeDistractor, validateTileSet, TileSetFailure } from './warmupTileSet';

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
  /**
   * Kawałki (frazy po 2–4 słowa) układane przez kursanta — ZAWSZE ustawione. Z danych rozgrzewki,
   * `puzzleChunks` zdania albo z podziału zdania (`utils/warmupChunks.ts`); nigdy pojedyncze słowa.
   */
  chunks: string[];
  /** Najwyżej 1 dystraktor: zniekształcony kawałek TEGO SAMEGO zdania (`utils/warmupTileSet.ts`), nigdy fraza z innego zdania. */
  distractors: string[];
}

/** Runda pominięta przed pokazaniem kursantowi — nic nie jest zapisywane, powód trafia do logu. */
export interface SkippedWarmupRound {
  itemIndex: number;
  reason: TileSetFailure | 'conflicting_prompt';
}

export interface WarmupRoundsReport {
  rounds: WarmupRound[];
  skipped: SkippedWarmupRound[];
}

const countWords = (sentence: string): number =>
  sentence.trim().split(/\s+/).filter(Boolean).length;

/** Rozgrzewka zawsze każe ułożyć angielskie zdanie z polskiego polecenia — niezależnie od typu zadania źródłowego. */
const WARMUP_HEADING = 'Ułóż zdanie';
const WARMUP_INSTRUCTION = 'Ułóż zdanie po angielsku z kafelków.';

export function buildWarmupRounds(sentences: any[], task?: any | null): WarmupRound[] {
  return buildWarmupRoundsReport(sentences, task).rounds;
}

export function buildWarmupRoundsReport(sentences: any[], task?: any | null): WarmupRoundsReport {
  // 1. Nowy format: jeśli jest zdefiniowane pole warmup w SpecialTask (tablica)
  // Niepusta tablica bez ani jednego elementu z polishTranslation (stary kształt
  // z polishHint) to brak pola — wraca stara rozgrzewka, nic nie migrujemy.
  const hasPolishItem =
    task &&
    Array.isArray(task.warmup) &&
    task.warmup.some((ex: any) => typeof ex?.polishTranslation === 'string' && ex.polishTranslation.trim());
  if (task && Array.isArray(task.warmup) && (task.warmup.length === 0 || hasPolishItem)) {
    if (task.warmup.length === 0) {
      return { rounds: [], skipped: [] }; // pusta rozgrzewka = brak rozgrzewki (świadoma decyzja lektora)
    }
    const warmupRounds: WarmupRound[] = [];
    task.warmup.forEach((ex: any, idx: number) => {
      const polish = typeof ex?.polishTranslation === 'string' ? ex.polishTranslation.trim() : '';
      // Bez polskiego tłumaczenia nie ma polecenia — pomijamy rundę (indeks
      // `idx` zostaje oryginalny, żeby zapisane próby się nie rozjechały).
      if (!polish) return;
      if (!Array.isArray(ex?.chunks) || ex.chunks.length === 0) return;
      if (typeof ex?.correctSentence !== 'string' || !ex.correctSentence.trim()) return;
      // Kawałki z danych; pojedyncze słowa (np. „I") scalane z sąsiadem, a gdy dane nie dają
      // użytecznych kawałków — podział zdania. Zdanie za krótkie na frazy → runda pominięta.
      const chunks = resolveChunks([ex.chunks], ex.correctSentence);
      if (chunks.length === 0) return;
      warmupRounds.push({
        itemIndex: idx, // Rozgrzewki mają osobną indeksację
        type: 'warmup_chunk',
        heading: WARMUP_HEADING,
        instruction: WARMUP_INSTRUCTION,
        sourceLabel: polish,
        targetSentence: ex.correctSentence,
        chunks,
        distractors: [],
        hint: '',
      });
    });
    return finalizeRounds(warmupRounds);
  }

  // 2. Stary format (warmup === undefined): budujemy z zadań (sentences)
  if (!Array.isArray(sentences) || sentences.length === 0) return { rounds: [], skipped: [] };

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
    // Dolny próg to dwa kawałki po dwa słowa (kafelki nie są pojedynczymi słowami); górny jak dotąd.
    if (wordCount < MIN_SENTENCE_WORDS || wordCount > 20) return;

    // Kawałki: `puzzleChunks` zdania (generator zdań), `tokens` zadania word_order (gdy są frazami),
    // w ostateczności podział zdania. Pojedyncze słowa nigdy nie stają się kafelkami.
    const chunks = resolveChunks(
      [Array.isArray(raw?.puzzleChunks) ? raw.puzzleChunks : undefined, exercise.type === 'word_order' ? exercise.tokens : undefined],
      trimmed
    );
    if (chunks.length === 0) return;

    rounds.push({
      itemIndex,
      type: exercise.type,
      heading: WARMUP_HEADING,
      instruction: WARMUP_INSTRUCTION,
      sourceLabel,
      targetSentence: trimmed,
      hint: exercise.hint,
      chunks,
      distractors: [],
    });
  });

  return finalizeRounds(rounds.slice(0, 3));
}

/**
 * Ostatni etap: pomija rundy z rozjechanym poleceniem (to samo polskie zdanie, różne angielskie),
 * dokłada każdej rundzie najwyżej jeden dystraktor — zniekształcenie kawałka z TEGO SAMEGO zdania
 * — i sprawdza niezmiennik zestawu kafelków. Runda, która go nie spełnia, odpada.
 */
function finalizeRounds(candidates: WarmupRound[]): WarmupRoundsReport {
  const conflicting = findConflictingPrompts(candidates);
  const rounds: WarmupRound[] = [];
  const skipped: SkippedWarmupRound[] = [];
  for (const round of candidates) {
    if (conflicting.has(round.itemIndex)) {
      skipped.push({ itemIndex: round.itemIndex, reason: 'conflicting_prompt' });
      continue;
    }
    const distractor = pickSafeDistractor(round.chunks, round.targetSentence);
    const withTiles: WarmupRound = { ...round, distractors: distractor ? [distractor] : [] };
    const check = validateWarmupRound(withTiles);
    if ('reason' in check) skipped.push({ itemIndex: round.itemIndex, reason: check.reason });
    else rounds.push(withTiles);
  }
  return { rounds, skipped };
}

/** Niezmiennik zestawu kafelków rundy (kafelki = kawałki + najwyżej jeden dystraktor z tego samego zdania). */
export const validateWarmupRound = (round: WarmupRound) =>
  validateTileSet({
    targetSentence: round.targetSentence,
    chunks: round.chunks,
    tiles: [...round.chunks, ...round.distractors],
  });

/** Zostawia tylko rundy spełniające niezmiennik — obrona w głębi dla rund pochodzących spoza `buildWarmupRounds`. */
export function filterValidRounds(rounds: readonly WarmupRound[]): { rounds: WarmupRound[]; skipped: SkippedWarmupRound[] } {
  const ok: WarmupRound[] = [];
  const skipped: SkippedWarmupRound[] = [];
  for (const round of rounds) {
    const check = validateWarmupRound(round);
    if ('reason' in check) skipped.push({ itemIndex: round.itemIndex, reason: check.reason });
    else ok.push(round);
  }
  return { rounds: ok, skipped };
}

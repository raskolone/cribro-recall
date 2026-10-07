/**
 * Deterministyczne sprawdzenia zdań z generatora ćwiczeń — bez modelu, bez sieci.
 *
 * Prompt może modelu tylko PROSIĆ („nie powtarzaj", „wstaw błąd"). Ten plik
 * pilnuje, żeby prośba, której model nie posłuchał, nie dotarła do kursanta.
 */

/**
 * Postać zdania do porównań: bez wielkości liter, interpunkcji i nadmiarowych
 * spacji, z ujednoliconymi apostrofami.
 *
 * Różnica wyłącznie w interpunkcji albo wielkiej literze to dla kursanta to
 * samo zdanie — i nie jest błędem do poprawienia. Apostrof zostaje, bo
 * „dont" vs „don't" to już inne słowo.
 */
export const normalizeSentence = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Odsiewa zadania, których zdanie już padło — w tej sesji albo wcześniej
 * w tej samej partii.
 *
 * `keysOf` zwraca wszystkie zdania zadania, po których poznajemy powtórkę
 * (np. angielskie i polskie w tłumaczeniu). Wystarczy, że jedno się pokrywa.
 */
export const filterRepeatedSentences = <T>(
  items: T[],
  used: Iterable<string>,
  keysOf: (item: T) => unknown[]
): T[] => {
  const seen = new Set<string>();
  for (const sentence of used) {
    const key = normalizeSentence(sentence);
    if (key) seen.add(key);
  }

  return items.filter((item) => {
    const keys = keysOf(item).map(normalizeSentence).filter(Boolean);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
};

/**
 * Blok promptu z listą zdań, których nie wolno powtórzyć.
 *
 * Ostatnie `limit` pozycji — najświeższe są najbardziej prawdopodobnym
 * źródłem powtórki, a cała historia sesji rozdęłaby prompt.
 */
export const buildUsedSentencesBlock = (sentences: string[] | undefined, limit = 60): string => {
  const list = (sentences || []).map((s) => String(s).trim()).filter(Boolean).slice(-limit);
  if (list.length === 0) return '';
  return `\n\n[ZDANIA JUŻ UŻYTE W TEJ SESJI — NIE WOLNO ICH POWTÓRZYĆ ANI LEKKO PRZEFORMUŁOWAĆ]:
${list.map((s) => `- ${s}`).join('\n')}
Każde nowe zdanie musi opisywać INNĄ sytuację niż powyższe.`;
};

// ---------------------------------------------------------------------------
// „Popraw zdanie" (find_errors / fix_sentence)
// ---------------------------------------------------------------------------

/**
 * Zamknięta lista typów błędu — błędy, które Polak realnie popełnia.
 *
 * Lista jest celowo krótka i „ludzka": model, który ma wybrać typ z niej,
 * nie może uciec w błąd egzotyczny ani w różnicę interpunkcji.
 */
export const FIX_SENTENCE_ERROR_TYPES = [
  'verb_tense',
  'subject_verb_agreement',
  'auxiliary_verb',
  'article',
  'preposition',
  'word_order',
  'word_form',
  'plural_or_countable',
  'false_friend',
  'collocation',
] as const;

export type FixSentenceErrorType = (typeof FIX_SENTENCE_ERROR_TYPES)[number];

export interface FixSentenceItem {
  correctSentence: string;
  errorSentence: string;
  errorType: FixSentenceErrorType;
  explanation?: string;
  hint?: string;
  polishHint?: string;
}

export type FixSentenceRejection = 'missing_fields' | 'unknown_error_type' | 'no_error';

export type FixSentenceCheck =
  | { ok: true; item: FixSentenceItem }
  | { ok: false; reason: FixSentenceRejection; errorSentence?: string };

const pickString = (source: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

/**
 * Sprawdza jedno zadanie „Popraw zdanie" z odpowiedzi modelu.
 *
 * Wymagane: `correct_sentence`, `error_sentence`, `error_type` (z listy).
 * Zadanie, w którym zdanie z błędem po normalizacji jest identyczne
 * z poprawnym, jest nierozwiązywalne — kursant nie ma czego poprawić.
 */
export const checkFixSentenceItem = (raw: unknown): FixSentenceCheck => {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'missing_fields' };
  const source = raw as Record<string, unknown>;

  const correctSentence = pickString(source, 'correct_sentence', 'correctSentence');
  const errorSentence = pickString(source, 'error_sentence', 'errorSentence', 'incorrectSentence');
  const errorType = pickString(source, 'error_type', 'errorType');

  if (!correctSentence || !errorSentence || !errorType) {
    return { ok: false, reason: 'missing_fields', errorSentence: errorSentence || undefined };
  }
  if (!(FIX_SENTENCE_ERROR_TYPES as readonly string[]).includes(errorType)) {
    return { ok: false, reason: 'unknown_error_type', errorSentence };
  }
  if (normalizeSentence(errorSentence) === normalizeSentence(correctSentence)) {
    return { ok: false, reason: 'no_error', errorSentence };
  }

  const explanation = pickString(source, 'explanation');
  const hint = pickString(source, 'hint');
  const polishHint = pickString(source, 'polish_hint', 'polishHint');

  return {
    ok: true,
    item: {
      correctSentence,
      errorSentence,
      errorType: errorType as FixSentenceErrorType,
      ...(explanation ? { explanation } : {}),
      ...(hint ? { hint } : {}),
      ...(polishHint ? { polishHint } : {}),
    },
  };
};

/** Co poszło nie tak w pierwszej próbie — treść mocniejszej instrukcji przy powtórce. */
export interface FixSentenceRetryRequest {
  /** Ile zadań trzeba dołożyć w miejsce odrzuconych. */
  missing: number;
  /** Zdania „z błędem", które błędu nie miały — model ma je zobaczyć. */
  rejectedErrorSentences: string[];
}

export interface FixSentenceBatch {
  items: FixSentenceItem[];
  /** Zadania odrzucone ostatecznie — po powtórce nadal wadliwe. */
  dropped: number;
  retried: boolean;
}

/**
 * Pierwsza próba → walidacja → najwyżej JEDNA powtórka z mocniejszą
 * instrukcją dla odrzuconych → zadania wciąż wadliwe nie są pokazywane.
 *
 * `ask(null)` to zwykłe zamówienie, `ask(retry)` — powtórka. Obie zwracają
 * surową listę zadań od modelu. Nieudana powtórka nie zabiera zadań, które
 * przeszły za pierwszym razem.
 */
export const collectValidFixSentences = async (
  ask: (retry: FixSentenceRetryRequest | null) => Promise<unknown[]>
): Promise<FixSentenceBatch> => {
  const first = (await ask(null)).map(checkFixSentenceItem);
  const items = first.flatMap((check) => (check.ok ? [check.item] : []));
  const rejected = first.filter((check): check is Extract<FixSentenceCheck, { ok: false }> => !check.ok);

  if (rejected.length === 0) return { items, dropped: 0, retried: false };

  let replacements: FixSentenceItem[] = [];
  try {
    const second = await ask({
      missing: rejected.length,
      rejectedErrorSentences: rejected.map((r) => r.errorSentence).filter((s): s is string => Boolean(s)),
    });
    replacements = second
      .map(checkFixSentenceItem)
      .flatMap((check) => (check.ok ? [check.item] : []))
      .slice(0, rejected.length);
  } catch (err) {
    if (items.length === 0) throw err;
    console.warn('[fix_sentence] Powtórka nie powiodła się — zostają zadania z pierwszej próby.', err);
  }

  return {
    items: [...items, ...replacements],
    dropped: rejected.length - replacements.length,
    retried: true,
  };
};

// ---------------------------------------------------------------------------
// Rozgrzewka (WarmupExercise)
// ---------------------------------------------------------------------------

export type WarmupExerciseRejection =
  | 'missing_fields'
  | 'missing_polish_translation'
  | 'invalid_chunk_count'
  | 'invalid_word_count_in_chunk'
  | 'duplicate_chunks'
  | 'chunks_dont_match_sentence'
  | 'topic_as_subject';

/** Powód, dla którego rozgrzewka (cała lub jej element) nie trafiła do pracy. */
export type WarmupFailureReason =
  | WarmupExerciseRejection
  | 'sentence_repeated'
  | 'unnatural_sentence'
  | 'no_items'
  | 'model_error';

export const WARMUP_FAILURE_LABELS: Record<WarmupFailureReason, string> = {
  missing_fields: 'brak fragmentów lub zdania',
  missing_polish_translation: 'brak polskiego tłumaczenia',
  invalid_chunk_count: 'zła liczba fragmentów (potrzeba 3–5)',
  invalid_word_count_in_chunk: 'fragment ma mniej niż 2 lub więcej niż 4 słowa',
  duplicate_chunks: 'powtórzony fragment w jednym zdaniu',
  chunks_dont_match_sentence: 'fragmenty nie składają się na zdanie',
  topic_as_subject: 'tytuł tematu użyty jako podmiot zdania',
  sentence_repeated: 'zdanie powtarza zdanie z pracy',
  unnatural_sentence: 'nienaturalne zdanie',
  no_items: 'model nie zwrócił żadnych zdań',
  model_error: 'błąd modelu',
};

/** Czytelny powód (powody) niepowodzenia rozgrzewki do pokazania lektorowi. */
export const describeWarmupFailure = (reasons: WarmupFailureReason[]): string => {
  const unique = Array.from(new Set(reasons));
  if (unique.length === 0) return 'brak poprawnych zdań';
  return unique.map((r) => WARMUP_FAILURE_LABELS[r]).join('; ');
};

export type WarmupExerciseCheck =
  | { ok: true; item: { chunks: string[]; correctSentence: string; polishTranslation: string } }
  | { ok: false; reason: WarmupExerciseRejection };

const countWords = (text: string): number => text.trim().split(/\s+/).length;

/** Porównanie złożenia: bez wielkości liter, końcowej interpunkcji i nadmiarowych spacji. */
const normalizeAssembly = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.!?…]+$/, '')
    .toLowerCase();

const SUBJECT_DETERMINERS = new Set(['my', 'your', 'our', 'his', 'her', 'their', 'its', 'the', 'a', 'an', 'this', 'that']);

const topicWords = (text: string): string[] => {
  const words = normalizeSentence(text).split(' ').filter(Boolean);
  while (words.length > 0 && SUBJECT_DETERMINERS.has(words[0])) words.shift();
  return words;
};

/** Tytuły tematów z materiału zbudowanego przez `buildSourceText` (linie „LEKCJA (data): temat"). */
export const extractLessonTopics = (sourceText: string): string[] => {
  const topics: string[] = [];
  for (const match of sourceText.matchAll(/^LEKCJA \([^)]*\):[ \t]*(.+)$/gm)) {
    const topic = match[1].trim();
    if (topic) topics.push(topic);
  }
  return topics;
};

/**
 * Czy zdanie zaczyna się od tytułu tematu (lub jego frazy z co najmniej dwóch
 * słów) użytego jako podmiot — np. „My ideal home would like…" przy temacie
 * „Describing your ideal home". Porównanie bez wielkości liter i bez
 * wiodącego zaimka dzierżawczego/przedimka po obu stronach.
 */
export const startsWithTopicAsSubject = (firstChunk: string, topics: string[]): boolean => {
  const head = topicWords(firstChunk);
  if (head.length === 0) return false;
  for (const topic of topics) {
    const words = topicWords(topic);
    for (let start = 0; start < words.length; start++) {
      const phrase = words.slice(start);
      if (phrase.length < 2) break;
      // Cały tytuł (od `start`) albo jego początek z co najmniej dwóch słów.
      for (let end = phrase.length; end >= 2; end--) {
        const candidate = phrase.slice(0, end);
        if (candidate.length <= head.length && candidate.every((w, i) => head[i] === w)) return true;
      }
    }
  }
  return false;
};

export const checkWarmupExerciseItem = (raw: unknown, topics: string[] = []): WarmupExerciseCheck => {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'missing_fields' };
  const source = raw as Record<string, unknown>;

  const chunks = Array.isArray(source.chunks)
    ? source.chunks.map((c) => String(c).replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
  const correctSentence = pickString(source, 'correct_sentence', 'correctSentence');
  const polishTranslation = pickString(source, 'polish_translation', 'polishTranslation');

  if (chunks.length === 0 || !correctSentence) {
    return { ok: false, reason: 'missing_fields' };
  }

  if (!polishTranslation) {
    return { ok: false, reason: 'missing_polish_translation' };
  }

  if (chunks.length < 3 || chunks.length > 5) {
    return { ok: false, reason: 'invalid_chunk_count' };
  }

  for (const chunk of chunks) {
    const words = countWords(chunk);
    if (words < 2 || words > 4) {
      return { ok: false, reason: 'invalid_word_count_in_chunk' };
    }
  }

  if (new Set(chunks).size !== chunks.length) {
    return { ok: false, reason: 'duplicate_chunks' };
  }

  const assembled = chunks.join(' ');
  if (normalizeAssembly(assembled) !== normalizeAssembly(correctSentence)) {
    return { ok: false, reason: 'chunks_dont_match_sentence' };
  }

  if (startsWithTopicAsSubject(chunks[0], topics)) {
    return { ok: false, reason: 'topic_as_subject' };
  }

  return {
    ok: true,
    item: {
      chunks,
      // Dokładnie złożone fragmenty — tak ocenia classifyUnscrambleAttempt.
      correctSentence: assembled,
      polishTranslation,
    },
  };
};

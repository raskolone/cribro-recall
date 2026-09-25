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

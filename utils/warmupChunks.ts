/**
 * Kawałki (frazy) do rozgrzewki klockowej — czysta logika bez Reacta i bez bazy.
 *
 * Rozgrzewka składa angielską odpowiedź z kafelków-KAWAŁKÓW (2–4 słowa), nigdy z pojedynczych
 * słów. Źródła kawałków, w kolejności zaufania: pole `chunks` z danych rozgrzewki (nowy format),
 * `puzzleChunks` zdania (generator zdań), `tokens` zadania word_order, a gdy żadne nie nadaje się
 * do użycia (same słowa, całe zdanie, kawałki niezłożone w zdanie) — deterministyczny podział
 * zdania (`chunkSentence`). Dystraktor (najwyżej jeden, zniekształcony kawałek tego samego zdania) żyje w `warmupTileSet.ts`.
 */

export const MIN_CHUNK_WORDS = 2;
export const MAX_CHUNK_WORDS = 4;
export const MIN_ROUND_CHUNKS = 2;
export const MAX_ROUND_CHUNKS = 6;
/** Zdanie krótsze niż dwa kawałki po dwa słowa nie ma sensu jako układanka z fraz. */
export const MIN_SENTENCE_WORDS = MIN_CHUNK_WORDS * MIN_ROUND_CHUNKS;
/** Najwyżej tyle kafelków-dystraktorów w jednej rundzie. */
export const MAX_DISTRACTORS = 1;

const normalizeText = (text: string): string => String(text ?? '').trim().replace(/\s+/g, ' ');

/** Słowo = token z literą lub cyfrą; samotna interpunkcja nie jest słowem. */
export const countWords = (text: string): number =>
  normalizeText(text)
    .split(' ')
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

/** Zdanie bez końcowej interpunkcji (. ! ? …) — dane lektora bywają zapisane z kropką albo bez niej. */
const withoutFinalPunctuation = (text: string): string => normalizeText(text).replace(/[\s.!?…]+$/u, '');

/**
 * Czy kawałki po złożeniu dają to zdanie (spacje i wielkość znaków bez zmian; końcowa kropka,
 * wykrzyknik lub pytajnik mogą różnić się tylko obecnością — samo to nie jest powodem do odrzucenia
 * kawałków napisanych przez lektora).
 */
export const joinsTo = (chunks: readonly string[], sentence: string): boolean =>
  withoutFinalPunctuation(chunks.join(' ')) === withoutFinalPunctuation(sentence);

/**
 * Scala kawałki, które nie mają dwóch słów (pojedyncze słowo, samotny znak interpunkcyjny):
 * z następnym, a ostatni — z poprzednim. Kolejność i treść zdania zostają bez zmian.
 */
export function mergeSmallChunks(chunks: readonly string[]): string[] {
  const out: string[] = [];
  let carry = '';
  for (const raw of chunks) {
    const text = normalizeText(raw);
    if (!text) continue;
    const merged = carry ? `${carry} ${text}` : text;
    if (countWords(merged) < MIN_CHUNK_WORDS) {
      carry = merged;
      continue;
    }
    out.push(merged);
    carry = '';
  }
  if (carry) {
    if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]} ${carry}`;
    else out.push(carry);
  }
  return out;
}

/** Słowa, po których nie tniemy zdania (przedimki, przyimki, spójniki, zaimki dzierżawcze, operatory). */
const WEAK_END = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'about', 'into', 'than', 'as',
  'and', 'but', 'or', 'so', 'that', 'if', 'because', 'when', 'while',
  'my', 'your', 'his', 'her', 'our', 'their', 'its', 'this', 'these', 'those', 'some', 'any',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'should', 'must', 'might', 'not', 'i', 'you', 'he', 'she', 'we', 'they', 'it',
]);

const bareWord = (token: string): string => token.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

const cutPenalty = (words: string[], endExclusive: number): number => {
  if (endExclusive >= words.length) return 0;
  const last = words[endExclusive - 1];
  let penalty = WEAK_END.has(bareWord(last)) ? 3 : 0;
  if (/[,;:]$/.test(last)) penalty -= 1;
  return penalty;
};

/**
 * Deterministyczny podział zdania na 2–5 kawałków po 2–4 słowa. Liczba kawałków ≈ słowa / 3;
 * programowanie dynamiczne minimalizuje karę za cięcie po słowach funkcyjnych i za rozrzut
 * rozmiarów. Zdanie krótsze niż `MIN_SENTENCE_WORDS` → `[]` (brak układanki).
 */
export function chunkSentence(sentence: string): string[] {
  const words = normalizeText(sentence).split(' ').filter(Boolean);
  const n = words.length;
  if (n < MIN_SENTENCE_WORDS) return [];

  const wanted = Math.min(5, Math.max(2, Math.round(n / 3)));
  // k kawałków po 2–4 słowa mieści n słów tylko, gdy 2k ≤ n ≤ 4k.
  let k = wanted;
  while (k > 2 && 2 * k > n) k--;
  while (k < 5 && 4 * k < n) k++;
  if (4 * k < n) return [];

  const INF = Number.POSITIVE_INFINITY;
  // best[j][i] — minimalny koszt podziału pierwszych i słów na j kawałków
  const best: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(INF));
  const from: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(-1));
  best[0][0] = 0;
  for (let j = 1; j <= k; j++) {
    for (let i = MIN_CHUNK_WORDS * j; i <= Math.min(n, MAX_CHUNK_WORDS * j); i++) {
      for (let size = MIN_CHUNK_WORDS; size <= MAX_CHUNK_WORDS; size++) {
        const start = i - size;
        if (start < 0 || best[j - 1][start] === INF) continue;
        const cost = best[j - 1][start] + cutPenalty(words, i) + Math.abs(size - 3) * 0.5;
        if (cost < best[j][i]) {
          best[j][i] = cost;
          from[j][i] = start;
        }
      }
    }
  }
  if (best[k][n] === INF) return [];

  const chunks: string[] = [];
  let end = n;
  for (let j = k; j >= 1; j--) {
    const start = from[j][end];
    chunks.unshift(words.slice(start, end).join(' '));
    end = start;
  }
  return chunks;
}

/** Kawałki nadają się na kafelki: złożone dają zdanie, mieści się 2–6 kawałków, każdy ma ≥ 2 słowa. */
export const isUsableChunking = (chunks: readonly string[], sentence: string): boolean =>
  chunks.length >= MIN_ROUND_CHUNKS &&
  chunks.length <= MAX_ROUND_CHUNKS &&
  chunks.every((chunk) => countWords(chunk) >= MIN_CHUNK_WORDS) &&
  joinsTo(chunks, sentence);

/**
 * Pierwsze źródło kawałków, które po scaleniu pojedynczych słów nadaje się do użycia; gdy żadne —
 * podział zdania. Pusta tablica = ze zdania nie da się zrobić układanki z fraz.
 */
export function resolveChunks(candidates: ReadonlyArray<readonly string[] | undefined | null>, sentence: string): string[] {
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const strings = candidate.filter((c): c is string => typeof c === 'string');
    // Lista pojedynczych słów (stare word_order) to nie frazy: scalanie parami dałoby przypadkowe
    // kawałki („try to"), więc lepszy jest podział zdania. Jedno luźne słowo („I") scalamy z sąsiadem.
    if (strings.filter((c) => countWords(c) < MIN_CHUNK_WORDS).length > 1) continue;
    const merged = mergeSmallChunks(strings);
    if (isUsableChunking(merged, sentence)) return merged;
  }
  const generated = chunkSentence(sentence);
  return isUsableChunking(generated, sentence) ? generated : [];
}

/** Deterministyczny, rozsądnie losowy generator (mulberry32) — tasowanie stabilne dla danego ziarna. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Kolejność kafelków w puli: stała dla danej rundy i ziarna sesji (NIE zmienia się przy ponownym
 * renderze rodzica), nigdy równa poprawnej kolejności (gdy da się inaczej).
 */
export function stableShuffle<T>(items: readonly T[], seed: number, isSameAsAnswer: (order: readonly T[]) => boolean): T[] {
  let attempt = 0;
  for (;;) {
    const rand = seededRandom(seed + attempt * 7919);
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.length < 2 || attempt >= 12 || !isSameAsAnswer(out)) return out;
    attempt++;
  }
}

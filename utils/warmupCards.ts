import type { WarmupCard } from '../types';
import { normalizeSentence } from './exerciseSentenceChecks';
import { parseVocabularyTextToCards } from './vocabulary';

/**
 * Fiszki rozgrzewki (`SpecialTask.warmupCards`) — walidacja, sanityzacja i
 * parsowanie. Czyste funkcje, współdzielone przez klienta i (w przyszłości)
 * serwer. Wzorowane na `warmupField.ts` / `warmupSanitize.ts`.
 */
export const WARMUP_CARDS_MAX = 6;
export const WARMUP_CARD_TERM_MAX_WORDS = 5;
export const WARMUP_CARD_TERM_MAX_LENGTH = 60;
export const WARMUP_CARD_DEFINITION_MAX_LENGTH = 60;
export const WARMUP_CARD_CONTEXT_MAX_LENGTH = 200;

export type WarmupCardRejection =
  | 'invalid_shape'
  | 'missing_term'
  | 'missing_definition'
  | 'term_too_long'
  | 'definition_too_long'
  | 'definition_same_as_term'
  | 'term_in_task_sentence'
  | 'duplicate_term'
  | 'over_limit'
  | 'no_cards'
  | 'model_error';

export const WARMUP_CARD_REJECTION_LABELS: Record<WarmupCardRejection, string> = {
  invalid_shape: 'niepoprawny format karty',
  missing_term: 'brak angielskiej frazy',
  missing_definition: 'brak polskiego znaczenia',
  term_too_long: 'fraza dłuższa niż 5 słów',
  definition_too_long: 'znaczenie dłuższe niż 60 znaków',
  definition_same_as_term: 'znaczenie jest takie samo jak fraza',
  term_in_task_sentence: 'fraza to całe zdanie z pracy (zdradzałaby odpowiedź)',
  duplicate_term: 'powtórzona fraza',
  over_limit: 'więcej niż 6 kart',
  no_cards: 'model nie zwrócił żadnych kart',
  model_error: 'błąd modelu',
};

/** Czytelny powód (powody) odrzucenia kart do pokazania lektorowi. */
export const describeWarmupCardRejection = (reasons: WarmupCardRejection[]): string => {
  const unique = Array.from(new Set(reasons));
  if (unique.length === 0) return 'brak poprawnych kart';
  return unique.map((r) => WARMUP_CARD_REJECTION_LABELS[r]).join('; ');
};

const clean = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return value.trim().replace(/\s+/g, ' ');
};

const countWords = (text: string): number => text.split(' ').filter(Boolean).length;

/**
 * Karta zdradza odpowiedź tylko wtedy, gdy fraza jest CAŁYM zdaniem z pracy
 * (po normalizeSentence). Fraza zawarta w dłuższym zdaniu jest dozwolona.
 */
const termEqualsTaskSentence = (term: string, taskSentences: string[]): boolean => {
  const key = normalizeSentence(term);
  if (!key) return false;
  return taskSentences.some((sentence) => normalizeSentence(sentence) === key);
};

export type WarmupCardCheck = { ok: true; card: WarmupCard } | { ok: false; reason: WarmupCardRejection };

/**
 * Normalizacja + walidacja pojedynczej karty. Zbyt długi opcjonalny przykład
 * jest pomijany (karta zostaje), reszta limitów odrzuca kartę.
 */
export const checkWarmupCard = (raw: unknown, taskSentences: string[] = []): WarmupCardCheck => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'invalid_shape' };
  const source = raw as Record<string, unknown>;

  const term = clean(source.term);
  if (!term) return { ok: false, reason: 'missing_term' };
  if (countWords(term) > WARMUP_CARD_TERM_MAX_WORDS || term.length > WARMUP_CARD_TERM_MAX_LENGTH) {
    return { ok: false, reason: 'term_too_long' };
  }

  const definition = clean(source.definition);
  if (!definition) return { ok: false, reason: 'missing_definition' };
  if (definition.length > WARMUP_CARD_DEFINITION_MAX_LENGTH) return { ok: false, reason: 'definition_too_long' };
  if (normalizeSentence(definition) === normalizeSentence(term)) return { ok: false, reason: 'definition_same_as_term' };

  if (termEqualsTaskSentence(term, taskSentences)) return { ok: false, reason: 'term_in_task_sentence' };

  const context = clean(source.contextSentence);
  const card: WarmupCard = { term, definition };
  if (context && context.length <= WARMUP_CARD_CONTEXT_MAX_LENGTH) card.contextSentence = context;
  return { ok: true, card };
};

export interface WarmupCardsResult {
  cards: WarmupCard[];
  rejected: Array<{ raw: unknown; reason: WarmupCardRejection }>;
  reasons: WarmupCardRejection[];
}

/** Waliduje listę: odrzuca niepoprawne, deduplikuje po `normalizeSentence(term)`, tnie do 6. */
export const buildWarmupCards = (rawCards: unknown, taskSentences: string[] = []): WarmupCardsResult => {
  const result: WarmupCardsResult = { cards: [], rejected: [], reasons: [] };
  if (!Array.isArray(rawCards)) return result;
  const seen = new Set<string>();
  for (const raw of rawCards) {
    const check = checkWarmupCard(raw, taskSentences);
    let reason: WarmupCardRejection | null = 'reason' in check ? check.reason : null;
    if ('card' in check) {
      const key = normalizeSentence(check.card.term);
      if (seen.has(key)) reason = 'duplicate_term';
      else if (result.cards.length >= WARMUP_CARDS_MAX) reason = 'over_limit';
      else {
        seen.add(key);
        result.cards.push(check.card);
      }
    }
    if (reason) {
      result.rejected.push({ raw, reason });
      result.reasons.push(reason);
    }
  }
  return result;
};

/**
 * Pole `warmupCards` z dokumentu / żądania:
 * - nie-tablica → `undefined` (pole pomijane = stare prace),
 * - `[]` → `[]` (jawnie wyłączone),
 * - niepusta tablica → poprawne karty (do 6); żadna poprawna → `undefined`.
 */
export const sanitizeWarmupCards = (input: unknown, taskSentences: string[] = []): WarmupCard[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  if (input.length === 0) return [];
  const { cards } = buildWarmupCards(input, taskSentences);
  return cards.length > 0 ? cards : undefined;
};

/**
 * Wartość pola zapisywana w pracy — trzy stany kreatora (jak `resolveWarmupField`):
 * wyłączone → `[]`, włączone i są karty → karty, włączone bez kart → `undefined`.
 */
export const resolveWarmupCardsField = (includeCards: boolean, cards: WarmupCard[]): WarmupCard[] | undefined => {
  if (!includeCards) return [];
  return cards.length > 0 ? cards : undefined;
};

/** Fragment obiektu do rozproszenia: klucz tylko gdy wartość istnieje (Firestore odrzuca `undefined`). */
export const warmupCardsFieldEntry = (value: WarmupCard[] | undefined): { warmupCards?: WarmupCard[] } =>
  value === undefined ? {} : { warmupCards: value };

// ————— Parser zapasowy tekstu słownictwa —————

const SEPARATOR_RE = /\s+[-–—]\s+/g;

/** Słowa polskie bez znaków diakrytycznych, które wyznaczają granicę „znaczenie | następna fraza". */
const POLISH_MARKER_WORDS = new Set([
  'się', 'sie', 'coś', 'cos', 'kogoś', 'kogos', 'komuś', 'komus', 'kimś', 'czymś', 'nie', 'że', 'jest',
  'na', 'z', 'w', 'o', 'u', 'od', 'za', 'bez', 'dla', 'oraz', 'lub', 'albo', 'ktoś', 'ktos',
  'być', 'mieć', 'robić', 'jak', 'czy', 'przez', 'przy', 'przed',
]);
const POLISH_DIACRITICS_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const hasPolishEvidence = (word: string): boolean => {
  const bare = word.replace(/[^\p{L}]/gu, '').toLowerCase();
  if (!bare) return false;
  return POLISH_DIACRITICS_RE.test(bare) || POLISH_MARKER_WORDS.has(bare);
};

const countSeparators = (line: string): number => (line.match(SEPARATOR_RE) || []).length;

export interface FlattenedPair {
  term: string;
  definition: string;
}

/**
 * Rozbija JEDNĄ linię ze sklejonymi parami („fraza - znaczenie fraza2 - znaczenie2")
 * na pary. Między dwoma separatorami stoi „znaczenie poprzedniej + fraza następnej";
 * granica to ostatnie słowo z polskim śladem (znak diakrytyczny lub polskie słowo
 * funkcyjne) — wszystko po nim jest angielską frazą. Odcinek bez żadnego polskiego
 * śladu nie ma jak zostać podzielony: jego znaczenie jest nieznane, więc daje parę
 * z pustym znaczeniem (odrzucaną jako brak polskiego znaczenia).
 */
export const splitFlattenedVocabularyLine = (line: string): FlattenedPair[] => {
  const segments = line.trim().split(SEPARATOR_RE).map((part) => part.trim());
  if (segments.length < 2) return [{ term: line.trim(), definition: '' }];

  const pairs: FlattenedPair[] = [];
  let term = segments[0];
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (i === segments.length - 1) {
      pairs.push({ term, definition: segment });
      break;
    }
    const words = segment.split(/\s+/).filter(Boolean);
    let boundary = -1;
    for (let w = words.length - 1; w >= 0; w--) {
      if (hasPolishEvidence(words[w])) {
        boundary = w;
        break;
      }
    }
    if (boundary < 0 || boundary === words.length - 1) {
      // Brak granicy: nie wiadomo, gdzie kończy się znaczenie i zaczyna następna fraza.
      pairs.push({ term, definition: '' });
      term = ''; // następna fraza nieznana — pusta, żeby nie powstała karta z polskim słowem we frazie
      continue;
    }
    pairs.push({ term, definition: words.slice(0, boundary + 1).join(' ') });
    term = words.slice(boundary + 1).join(' ');
  }
  return pairs;
};

/**
 * Parsuje tekst słownictwa do kart. Linie „fraza - znaczenie" (także – — : =)
 * rozbiera istniejący `parseVocabularyTextToCards` (czysta funkcja z
 * `utils/vocabulary.ts`). Linia z co najmniej dwoma separatorami to postać
 * spłaszczona (wiele par w jednej linii) — idzie przez `splitFlattenedVocabularyLine`.
 * Fragment bez znaczenia jest odrzucany jako `missing_definition`.
 */
export const parseWarmupCardsFromText = (text: string, taskSentences: string[] = []): WarmupCardsResult => {
  const raw: Array<{ term: string; definition: string }> = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    if (countSeparators(line) >= 2) {
      raw.push(...splitFlattenedVocabularyLine(line));
    } else {
      raw.push(...parseVocabularyTextToCards(line).map(({ term, definition }) => ({ term, definition })));
    }
  }
  return buildWarmupCards(raw, taskSentences);
};

// ————— Źródło kart według trybu kreatora —————

export type WarmupCardOrigin = 'lesson' | 'text' | 'ai';

/** Karta w kreatorze: robocza flaga `origin` NIE trafia do dokumentu pracy. */
export interface WarmupCardDraft extends WarmupCard {
  origin?: WarmupCardOrigin;
}

export const stripWarmupCardDraftFlags = (cards: WarmupCardDraft[]): WarmupCard[] =>
  cards.map(({ term, definition, contextSentence }) => ({
    term,
    definition,
    ...(contextSentence ? { contextSentence } : {}),
  }));

export interface WarmupCardLessonInput {
  id: string;
  topic?: string;
  vocabularyText?: string;
}

export type WarmupCardSourcePlan =
  | { kind: 'lessons'; lessons: WarmupCardLessonInput[]; aiFallbackText: string }
  | { kind: 'ai'; sourceText: string };

/**
 * Skąd brać karty: wybrane lekcje → zestaw fiszek lekcji (potem tekst słownictwa),
 * wklejony tekst albo sam temat → jedno wywołanie modelu. Dla lekcji bez żadnych
 * kart `aiFallbackText` (materiał z tematem) pozwala modelowi wyprowadzić frazy z tematu.
 */
export const planWarmupCardSource = (
  mode: 'lessons' | 'text',
  lessons: WarmupCardLessonInput[],
  sourceText: string
): WarmupCardSourcePlan => {
  if (mode === 'lessons' && lessons.length > 0) {
    return {
      kind: 'lessons',
      lessons: lessons.map(({ id, topic, vocabularyText }) => ({ id, topic, vocabularyText })),
      aiFallbackText: sourceText,
    };
  }
  return { kind: 'ai', sourceText };
};

export interface LessonCardCandidates {
  /** Surowe karty z `sets/set-lesson-{id}/flashcards` (term, definition, position). */
  flashcards: Array<{ term?: unknown; definition?: unknown; position?: unknown }>;
  vocabularyText?: string;
}

/**
 * Karty z lekcji: zestaw fiszek ma pierwszeństwo (karty bez znaczenia odpadają),
 * a gdy zestawu brak lub nie dał żadnej poprawnej karty — parser tekstu słownictwa.
 * Wynik z wielu lekcji jest przeplatany, żeby 6 miejsc nie zajęła jedna lekcja.
 */
export const collectLessonCards = (perLesson: LessonCardCandidates[], taskSentences: string[] = []): WarmupCardsResult => {
  const lists: unknown[][] = perLesson.map((lesson) => {
    const sorted = [...(lesson.flashcards || [])].sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0));
    const fromSet = buildWarmupCards(
      sorted.map((c) => ({ term: c?.term, definition: c?.definition })),
      taskSentences
    );
    if (fromSet.cards.length > 0) return sorted.map((c) => ({ term: c?.term, definition: c?.definition }));
    return parseWarmupCardsFromText(lesson.vocabularyText || '', taskSentences).cards;
  });
  const interleaved: unknown[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (i < list.length) interleaved.push(list[i]);
  return buildWarmupCards(interleaved, taskSentences);
};

/** Walidacja odpowiedzi modelu `{cards:[…]}`; nie rzuca. Brak kart = powód `no_cards`. */
export const parseGeneratedWarmupCards = (parsed: unknown, taskSentences: string[] = []): WarmupCardsResult => {
  const rawCards = (parsed as any)?.cards;
  const result = buildWarmupCards(rawCards, taskSentences);
  if (!Array.isArray(rawCards) || rawCards.length === 0) result.reasons.push('no_cards');
  return result;
};

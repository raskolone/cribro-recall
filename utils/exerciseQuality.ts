/**
 * Kontrola jakości wygenerowanych ćwiczeń — dwa stopnie, oba przed pokazaniem czegokolwiek kursantowi.
 *
 *  1) LOKALNA, deterministyczna (bez modelu): kształt danych, duplikaty, osoba/liczba PL↔EN tam,
 *     gdzie da się to sprawdzić regułą, znane kalki, jednoznaczność opcji i par.
 *  2) SĘDZIA modelu: jedno zbiorcze wywołanie na zestaw, kryteria a)–e) per element
 *     (`utils/exerciseQualityRules.ts`). Wywołanie wstrzykuje wywołujący — tu tylko prompt, schemat,
 *     parsowanie wyroków i pętla `runQualityGate` (odrzucenie → dogenerowanie, max 2 ponowienia).
 *
 * Plik jest czysty: bez sieci, bez Firebase, bez Reacta (logika ma być portowalna do iOS).
 */
import { Type } from '@google/genai';
import { normalizeSentence } from './exerciseSentenceChecks';
import { isGrammarFocusId } from './grammarFocus';
import { findPersonMismatch, hasKnownCalque, tokens } from './pairConsistency';

export { findPersonMismatch, hasKnownCalque };
import { JUDGE_CRITERIA_TEXT, QUALITY_CRITERIA, QualityCriterion } from './exerciseQualityRules';

// ---------------------------------------------------------------------------
// Kształt elementu (wspólny dla wszystkich typów)
// ---------------------------------------------------------------------------

export type QualityItem =
  | { kind: 'pair'; en: string; pl: string }
  | {
      kind: 'multiple_choice';
      question: string;
      options: string[];
      correctIndex: number;
      explanation?: string;
      grammarFocus?: string;
    }
  /** Jedna para słowo/fraza EN ↔ znaczenie PL (dopasowanie par); zestaw sprawdzany jest para po parze. */
  | { kind: 'word_pair'; left: string; right: string }
  | { kind: 'fix_sentence'; incorrect: string; correct: string; pl?: string };

export type LocalRejection =
  | 'missing_field'
  | 'too_long'
  | 'markup'
  | 'language_mixed'
  | 'person_mismatch'
  | 'calque'
  | 'duplicate'
  | 'same_structure'
  | 'bad_option_count'
  | 'duplicate_option'
  | 'equivalent_options'
  | 'bad_correct_index'
  | 'no_blank'
  | 'unknown_grammar_focus'
  | 'duplicate_pair_side'
  | 'no_error'
  | 'error_not_single';

// ---------------------------------------------------------------------------
// Pojedyncze pola
// ---------------------------------------------------------------------------

const MARKUP = /https?:\/\/|www\.|<|>|\{\{|`/i;
const POLISH_DIACRITICS = /[ąćęłńóśźż]/i;
const EN_STOPWORDS = new Set(['the', 'is', 'are', 'was', 'were', 'to', 'and', 'of', 'in', 'my', 'i', 'you', 'we', 'it', 'a', 'an', 'for', 'with', 'on']);

const clean = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();
const wordCount = (text: string): number => (text ? text.split(' ').length : 0);

const checkEnglishSide = (en: string): LocalRejection | null => {
  if (!en) return 'missing_field';
  if (en.length > 200 || wordCount(en) > 26) return 'too_long';
  if (MARKUP.test(en)) return 'markup';
  if (POLISH_DIACRITICS.test(en)) return 'language_mixed';
  return null;
};

const checkPolishSide = (pl: string): LocalRejection | null => {
  if (!pl) return 'missing_field';
  if (pl.length > 240) return 'too_long';
  if (MARKUP.test(pl)) return 'markup';
  if (!POLISH_DIACRITICS.test(pl)) {
    // Bez polskich znaków i z ≥ 3 angielskimi słowami funkcyjnymi → to angielski w polu polskim.
    const english = tokens(pl).filter((t) => EN_STOPWORDS.has(t)).length;
    if (english >= 3) return 'language_mixed';
  }
  return null;
};

const checkPair = (en: string, pl: string): LocalRejection | null =>
  checkEnglishSide(en) ?? checkPolishSide(pl) ?? (findPersonMismatch(en, pl) ? 'person_mismatch' : null) ?? (hasKnownCalque(en, pl) ? 'calque' : null);

// ---------------------------------------------------------------------------
// Edycja na poziomie słów — korekta zdań
// ---------------------------------------------------------------------------

const tokenDistance = (a: string[], b: string[]): number => {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
};

// ---------------------------------------------------------------------------
// Kontrola lokalna jednego elementu
// ---------------------------------------------------------------------------

export const checkItemLocally = (item: QualityItem): LocalRejection | null => {
  switch (item.kind) {
    case 'pair':
      return checkPair(clean(item.en), clean(item.pl));

    case 'fix_sentence': {
      const incorrect = clean(item.incorrect);
      const correct = clean(item.correct);
      const side = checkEnglishSide(correct) ?? checkEnglishSide(incorrect);
      if (side) return side;
      if (normalizeSentence(incorrect) === normalizeSentence(correct)) return 'no_error';
      // „Dokładnie jeden błąd”: zdania różnią się o kilka słów co najwyżej (zamiana szyku = 2).
      const distance = tokenDistance(normalizeSentence(incorrect).split(' '), normalizeSentence(correct).split(' '));
      if (distance > 3) return 'error_not_single';
      const pl = clean(item.pl);
      if (pl) {
        const plSide = checkPolishSide(pl);
        if (plSide) return plSide;
        if (findPersonMismatch(correct, pl)) return 'person_mismatch';
        if (hasKnownCalque(correct, pl)) return 'calque';
      }
      return null;
    }

    case 'multiple_choice': {
      const question = clean(item.question);
      if (!question) return 'missing_field';
      if (question.length > 240 || MARKUP.test(question)) return 'too_long';
      const options = (item.options ?? []).map(clean);
      if (options.length !== 4) return 'bad_option_count';
      if (options.some((o) => !o || o.length > 80)) return 'missing_field';
      if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= options.length) return 'bad_correct_index';
      if (new Set(options.map(normalizeSentence)).size !== options.length) return 'duplicate_option';
      const blanks = question.split('___').length - 1;
      if (blanks > 1) return 'no_blank';
      if (blanks === 0 && !question.includes('?')) return 'no_blank';
      if (blanks === 1) {
        // Dwie opcje dające po wstawieniu to samo zdanie = więcej niż jedna poprawna odpowiedź.
        const filled = options.map((o) => normalizeSentence(question.replace('___', o)));
        if (new Set(filled).size !== filled.length) return 'equivalent_options';
      }
      if (item.grammarFocus !== undefined && !isGrammarFocusId(item.grammarFocus)) return 'unknown_grammar_focus';
      return null;
    }

    case 'word_pair': {
      const left = clean(item.left);
      const right = clean(item.right);
      if (!left || !right) return 'missing_field';
      if (left.length > 80 || right.length > 100 || MARKUP.test(left + right)) return 'too_long';
      if (POLISH_DIACRITICS.test(left)) return 'language_mixed';
      if (normalizeSentence(left) === normalizeSentence(right)) return 'duplicate_pair_side';
      return null;
    }
  }
};

// ---------------------------------------------------------------------------
// Kontrola lokalna zestawu (duplikaty, powtarzająca się struktura)
// ---------------------------------------------------------------------------

const keysOf = (item: QualityItem): string[] => {
  switch (item.kind) {
    case 'pair':
      return [normalizeSentence(item.en), normalizeSentence(item.pl)];
    case 'fix_sentence':
      return [normalizeSentence(item.correct), normalizeSentence(item.incorrect)];
    case 'multiple_choice':
      return [normalizeSentence(item.question)];
    case 'word_pair':
      return [normalizeSentence(item.left), normalizeSentence(item.right)];
  }
};

const structureKey = (item: QualityItem): string | null => {
  const sentence = item.kind === 'pair' ? item.en : item.kind === 'fix_sentence' ? item.correct : null;
  if (!sentence) return null;
  return normalizeSentence(sentence).split(' ').slice(0, 3).join(' ');
};

/**
 * Które elementy zestawu odpadają lokalnie (indeks → powód). Kontrola pojedyncza + duplikaty
 * (także względem `alreadyKept`, czyli elementów, które już przeszły) + dwa kolejne zdania
 * zaczynające się tak samo.
 */
export const checkSetLocally = (items: QualityItem[], alreadyKept: QualityItem[] = []): Map<number, LocalRejection> => {
  const rejected = new Map<number, LocalRejection>();
  const seen = new Set<string>();
  alreadyKept.forEach((kept) => keysOf(kept).forEach((k) => k && seen.add(k)));
  let previousStructure = alreadyKept.length > 0 ? structureKey(alreadyKept[alreadyKept.length - 1]) : null;

  items.forEach((item, index) => {
    const single = checkItemLocally(item);
    if (single) {
      rejected.set(index, single);
      return;
    }
    const keys = keysOf(item).filter(Boolean);
    if (keys.some((k) => seen.has(k))) {
      rejected.set(index, item.kind === 'word_pair' ? 'duplicate_pair_side' : 'duplicate');
      return;
    }
    const structure = structureKey(item);
    if (structure && structure === previousStructure) {
      rejected.set(index, 'same_structure');
      return;
    }
    keys.forEach((k) => seen.add(k));
    previousStructure = structure;
  });
  return rejected;
};

// ---------------------------------------------------------------------------
// Sędzia modelu: prompt, schemat, parsowanie
// ---------------------------------------------------------------------------

export interface JudgeVerdict {
  ok: boolean;
  reason: string;
  criteria: Partial<Record<QualityCriterion, boolean>>;
}

const renderForJudge = (item: QualityItem, index: number): string => {
  switch (item.kind) {
    case 'pair':
      return `${index}. [para PL↔EN]\n   EN: ${item.en}\n   PL: ${item.pl}`;
    case 'fix_sentence':
      return `${index}. [korekta zdania]\n   Z BŁĘDEM: ${item.incorrect}\n   POPRAWNIE: ${item.correct}${item.pl ? `\n   PL: ${item.pl}` : ''}`;
    case 'multiple_choice':
      return `${index}. [wielokrotny wybór]\n   PYTANIE: ${item.question}\n   OPCJE: ${item.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('  ')}\n   POPRAWNA: ${String.fromCharCode(65 + item.correctIndex)}${item.explanation ? `\n   WYJAŚNIENIE: ${item.explanation}` : ''}`;
    case 'word_pair':
      return `${index}. [dopasowanie: słowo/fraza EN ↔ znaczenie PL]\n   ${item.left} = ${item.right}`;
  }
};

export const buildJudgePrompt = (items: QualityItem[], levelHint?: string): string =>
  `ZADANIE: jesteś surowym recenzentem ćwiczeń do nauki angielskiego dla polskiego kursanta${levelHint ? ` (poziom ${levelHint})` : ''}. Oceń każdy element poniżej.

${JUDGE_CRITERIA_TEXT}

ELEMENTY:
${items.map(renderForJudge).join('\n')}

Zwróć JSON z jednym wpisem na element (index = numer elementu):
{"verdicts":[{"index":0,"reason":"","naturalness":true,"equivalence":true,"uniqueness":true,"level_vocab":true,"context":true,"grammar":true}]}`;

/** `propertyOrdering`: najpierw uzasadnienie, potem wyroki — model „myśli” zanim oceni (thinkingBudget = 0). */
export const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          reason: { type: Type.STRING, description: 'Po polsku, kilka słów: co jest nie tak (puste, gdy wszystko w porządku).' },
          naturalness: { type: Type.BOOLEAN },
          equivalence: { type: Type.BOOLEAN },
          uniqueness: { type: Type.BOOLEAN },
          level_vocab: { type: Type.BOOLEAN },
          context: { type: Type.BOOLEAN },
          grammar: { type: Type.BOOLEAN },
        },
        required: ['index', 'reason', ...QUALITY_CRITERIA],
        propertyOrdering: ['index', 'reason', ...QUALITY_CRITERIA],
      },
    },
  },
  required: ['verdicts'],
};

/**
 * Wyrok dla każdego z `count` elementów; `null` = brak wyroku (pominięty element, nieczytelna odpowiedź).
 * Element przechodzi tylko wtedy, gdy WSZYSTKIE podane kryteria są `true` — brak kryterium traktujemy
 * jak niespełnione, żeby niepełna odpowiedź nie przepuszczała elementu.
 */
export const parseJudgeVerdicts = (raw: unknown, count: number): Array<JudgeVerdict | null> => {
  const verdicts: Array<JudgeVerdict | null> = Array.from({ length: count }, () => null);
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return verdicts;
    }
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { verdicts?: unknown }).verdicts)
    ? (data as { verdicts: unknown[] }).verdicts
    : null;
  if (!list) return verdicts;

  list.forEach((entry, position) => {
    if (!entry || typeof entry !== 'object') return;
    const source = entry as Record<string, unknown>;
    const index = typeof source.index === 'number' ? source.index : position;
    if (!Number.isInteger(index) || index < 0 || index >= count || verdicts[index]) return;

    const criteria: Partial<Record<QualityCriterion, boolean>> = {};
    for (const key of QUALITY_CRITERIA) if (typeof source[key] === 'boolean') criteria[key] = source[key] as boolean;
    const hasCriteria = Object.keys(criteria).length > 0;
    // Stary kształt `{ok, reason}` (kontrola rozgrzewki) też jest przyjmowany.
    if (!hasCriteria && typeof source.ok !== 'boolean') return;

    const ok = hasCriteria
      ? QUALITY_CRITERIA.every((key) => criteria[key] === true) && source.ok !== false
      : source.ok === true;
    verdicts[index] = { ok, reason: typeof source.reason === 'string' ? source.reason.trim() : '', criteria };
  });
  return verdicts;
};

// ---------------------------------------------------------------------------
// Pętla: kontrola lokalna → sędzia → dogenerowanie (max 2 ponowienia)
// ---------------------------------------------------------------------------

export const MAX_QUALITY_RETRIES = 2;

export interface QualityGateRejection {
  stage: 'local' | 'judge';
  reason: string;
  /** Tekst odrzuconego elementu — wchodzi do promptu dogenerowania jako „tego nie rób”. */
  text: string;
}

export interface QualityGateResult<T> {
  /** Elementy, które przeszły OBA stopnie. Tylko je wolno pokazać kursantowi. */
  items: T[];
  /** Przeszły kontrolę lokalną, ale sędzia nie odpowiedział (błąd wywołania / brak wyroku). */
  unverified: T[];
  rejected: QualityGateRejection[];
  /** Ile razy dogenerowywano brakujące elementy (0–2). */
  retries: number;
}

export interface QualityGateOptions<T> {
  items: T[];
  /** Ile elementów chcemy mieć na końcu. */
  target: number;
  toQuality: (item: T) => QualityItem;
  /** Jedno zbiorcze wywołanie sędziego; zwraca wyroki w kolejności wejścia albo rzuca. */
  judge: (items: QualityItem[]) => Promise<Array<JudgeVerdict | null>>;
  /** Dogenerowanie `missing` brakujących elementów; `rejected` = czego unikać. Brak = bez dogenerowania. */
  refill?: (missing: number, rejected: QualityGateRejection[]) => Promise<T[]>;
  maxRetries?: number;
}

const describeItem = (item: QualityItem): string => {
  switch (item.kind) {
    case 'pair':
      return `${item.en} / ${item.pl}`;
    case 'fix_sentence':
      return item.incorrect;
    case 'multiple_choice':
      return item.question;
    case 'word_pair':
      return `${item.left} = ${item.right}`;
  }
};

export const runQualityGate = async <T>(options: QualityGateOptions<T>): Promise<QualityGateResult<T>> => {
  const maxRetries = options.maxRetries ?? MAX_QUALITY_RETRIES;
  const kept: T[] = [];
  const unverified: T[] = [];
  const rejected: QualityGateRejection[] = [];
  let pending = options.items;
  let retries = 0;
  let judgeDown = false;

  for (let round = 0; ; round++) {
    const qualities = pending.map(options.toQuality);
    const keptQualities = kept.map(options.toQuality);
    const local = checkSetLocally(qualities, keptQualities);

    const survivors: Array<{ item: T; quality: QualityItem }> = [];
    pending.forEach((item, index) => {
      const reason = local.get(index);
      if (reason) rejected.push({ stage: 'local', reason, text: describeItem(qualities[index]) });
      else survivors.push({ item, quality: qualities[index] });
    });

    if (survivors.length > 0) {
      let verdicts: Array<JudgeVerdict | null> | null = null;
      try {
        verdicts = await options.judge(survivors.map((s) => s.quality));
      } catch {
        verdicts = null;
      }
      if (!verdicts) judgeDown = true;
      survivors.forEach((survivor, index) => {
        const verdict = verdicts?.[index] ?? null;
        if (!verdict) unverified.push(survivor.item);
        else if (verdict.ok) kept.push(survivor.item);
        else rejected.push({ stage: 'judge', reason: verdict.reason || 'judge_rejected', text: describeItem(survivor.quality) });
      });
    }

    const missing = options.target - kept.length;
    // Sędzia niedostępny → dogenerowanie nic nie da (nowe elementy też byłyby niesprawdzone).
    // Dogenerowujemy tylko po odrzuceniach — model, który zwrócił mniej, niż prosiliśmy, ale samo dobre, nie dostaje drugiego wywołania (koszt).
    if (missing <= 0 || !options.refill || retries >= maxRetries || judgeDown || rejected.length === 0) break;
    retries += 1;
    try {
      pending = await options.refill(missing, rejected);
    } catch {
      break;
    }
    if (pending.length === 0) break;
  }

  return { items: kept.slice(0, options.target), unverified, rejected, retries };
};

/** Blok „czego unikać” do promptu dogenerowania: odrzucone elementy z powodami. */
export const buildRejectedBlock = (rejected: QualityGateRejection[], limit = 8): string => {
  const lines = rejected.slice(-limit).map((r) => `- ${r.text}${r.reason && r.stage === 'judge' ? ` (${r.reason})` : ''}`);
  return lines.length === 0 ? '' : `\n\n[ODRZUCONE PRZY KONTROLI — NIE POWTARZAJ TYCH BŁĘDÓW]:\n${lines.join('\n')}\n`;
};

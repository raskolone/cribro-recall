import i18n from 'i18next';
import { HomeworkType } from '../types';

/**
 * Adapter kanoniczny dla jednego ćwiczenia pracy domowej (silnik v1 —
 * `StudentHomeworkScreen.tsx` + `HomeworkExercise.tsx`, jedyna ścieżka, którą
 * realnie widzi dziś kursant, patrz `config/featureFlags.ts`).
 *
 * Generator AI (`services/geminiService.ts`, `services/homeworkGenerator.ts`)
 * i starsze zadania w Firestore używają kilku niezgodnych ze sobą kształtów
 * tego samego ćwiczenia — różne nazwy pól, różne formaty luk, czasem
 * instrukcję wstrzykniętą w pole treści zamiast właściwego zdania. Dotąd
 * każdy z tych przypadków był łatany osobno, wewnątrz `HomeworkExercise.tsx`
 * (patrz commity 15e3fe4, 9294fab) — ten plik zbiera te łatki w jednym
 * miejscu, żeby komponent renderujący nie musiał znać kształtu danych z
 * bazy, tylko gotowy, jednolity kontrakt.
 */

/** Typ kanoniczny — te same cztery rodzaje, które `utils/homework.ts` już rozróżnia jako v1. */
export type CanonicalExerciseType = 'word_order' | 'fill_in_the_blank' | 'translation' | 'find_errors';

export type ExerciseState = 'ready' | 'degraded' | 'invalid';

export type ExerciseSegment =
  | { kind: 'text'; text: string }
  | { kind: 'gap'; gapId: string };

export interface CanonicalGap {
  id: string;
}

export interface CanonicalExercise {
  type: CanonicalExerciseType;
  state: ExerciseState;

  /** Wiadomość do pokazania kursantowi, gdy `state === 'invalid'`. */
  message?: string;

  // --- fill_in_the_blank ---
  /** Gotowe do wyrenderowania: tekst i luki w kolejności występowania. */
  segments?: ExerciseSegment[];
  gaps?: CanonicalGap[];
  /** Bank słów do przeciągnięcia w lukę; pusty = pole tekstowe zamiast banku. */
  availableWords?: string[];

  // --- word_order ---
  /** ZAWSZE tablica czystych stringów — nigdy zagnieżdżonych obiektów. */
  tokens?: string[];
  correctSentence?: string;

  // --- wspólne ---
  /** Zdanie/treść źródłowa (np. polskie zdanie do przetłumaczenia lub ułożenia). */
  sourceSentence?: string;
  /** Zdanie z błędem (find_errors). */
  incorrectSentence?: string;
  hint?: string;
  meaning?: string;

  /** Surowy element, na wypadek gdyby wywołujący potrzebował pola spoza kontraktu. */
  raw: any;
}

/** Mapa aliasów starszych/równoległych nazw typu na typ kanoniczny. */
const TYPE_ALIASES: Record<string, CanonicalExerciseType> = {
  word_order: 'word_order',
  unscramble: 'word_order',
  fill_in_the_blank: 'fill_in_the_blank',
  gap_fill: 'fill_in_the_blank',
  gap_from_context: 'fill_in_the_blank',
  cloze: 'fill_in_the_blank',
  translation: 'translation',
  micro_translation: 'translation',
  find_errors: 'find_errors',
  fix_sentence: 'find_errors',
};

const resolveCanonicalType = (item: any, task?: { type?: HomeworkType } | null): CanonicalExerciseType | null => {
  const declared = item?.type || item?.exerciseType;
  if (declared && TYPE_ALIASES[declared]) return TYPE_ALIASES[declared];
  if (item?.incorrectSentence) return 'find_errors';
  if (item?.textWithBlanks || item?.blanks || item?.wordsToCut || item?.missingWords) return 'fill_in_the_blank';
  if (item?.chunks) return 'word_order';
  const fallback = task?.type && TYPE_ALIASES[task.type];
  return fallback || null;
};

/**
 * Wypowiedzi generatora AI czasem wstrzykują własną instrukcję ("Popraw
 * zdanie. Zwróć uwagę na...") w pole źródłowe zamiast prawdziwego zdania —
 * patrz commit 9294fab. Taki tekst nie jest zdaniem, więc traktujemy go jak
 * brak źródła.
 */
const looksLikeInjectedInstruction = (text: string): boolean =>
  /^(popraw zdanie|zwróć uwagę|instrukcja|ułóż)\b/i.test(text.trim());

const cleanSourceSentence = (raw: unknown): string => {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text || looksLikeInjectedInstruction(text)) return '';
  return text;
};

/**
 * Rozbija payload luki na `ExerciseSegment[]`, obsługując cztery formaty,
 * jakie realnie występują w danych (BLANK_n, ciąg podkreśleń, kanoniczne
 * `{{gap:n}}`) lub mogą wystąpić w przyszłych wersjach generatora (pełne
 * zdanie + lista słów do wycięcia).
 */
export const normalizeGapPayload = (
  item: any
): { segments: ExerciseSegment[]; availableWords: string[] } | null => {
  // 1. Kanoniczne {{gap:n}}
  const canonicalSource = typeof item?.textWithBlanks === 'string' && item.textWithBlanks.includes('{{gap:')
    ? item.textWithBlanks
    : null;
  if (canonicalSource) {
    const segments = splitBySeparator(canonicalSource, /\{\{gap:(\d+)\}\}/g, (n) => `GAP_${n}`);
    if (segments.some((s) => s.kind === 'gap')) {
      return { segments, availableWords: Array.isArray(item.availableWords) ? item.availableWords : [] };
    }
  }

  // 2. Legacy [BLANK_n]
  if (typeof item?.textWithBlanks === 'string' && /\[BLANK_\d+\]/.test(item.textWithBlanks)) {
    const segments = splitBySeparator(item.textWithBlanks, /\[BLANK_(\d+)\]/g, (n) => `BLANK_${n}`);
    if (segments.some((s) => s.kind === 'gap')) {
      return { segments, availableWords: Array.isArray(item.availableWords) ? item.availableWords : [] };
    }
  }

  // 4. Pełne zdanie + słowa do wycięcia (format przewidziany na przyszłość —
  // dziś generator go nie wysyła, ale mapowanie jest tanie i deterministyczne).
  const cutWords: string[] = Array.isArray(item?.wordsToCut)
    ? item.wordsToCut
    : Array.isArray(item?.missingWords)
      ? item.missingWords
      : [];
  const baseSentence = String(item?.fullSentence || item?.sentenceWithBlank || '').trim();
  if (cutWords.length > 0 && baseSentence) {
    const segments = cutWordsFromSentence(baseSentence, cutWords);
    if (segments.some((s) => s.kind === 'gap')) {
      return { segments, availableWords: cutWords };
    }
  }

  // 3. Legacy potrójne podkreślenie — jedna luka, bez banku (wpisywana z ręki).
  const contentSource = String(item?.content || item?.text || item?.sentence || item?.sentenceWithBlank || '');
  if (/_{3,}/.test(contentSource)) {
    const parts = contentSource.split(/_{3,}/);
    const segments: ExerciseSegment[] = [];
    parts.forEach((part, index) => {
      if (part) segments.push({ kind: 'text', text: part });
      if (index < parts.length - 1) segments.push({ kind: 'gap', gapId: 'GAP_1' });
    });
    return { segments, availableWords: [] };
  }

  return null;
};

const splitBySeparator = (
  source: string,
  pattern: RegExp,
  gapIdFromMatch: (n: string) => string
): ExerciseSegment[] => {
  const segments: ExerciseSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  while ((match = re.exec(source))) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: source.slice(lastIndex, match.index) });
    }
    segments.push({ kind: 'gap', gapId: gapIdFromMatch(match[1]) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length) {
    segments.push({ kind: 'text', text: source.slice(lastIndex) });
  }
  return segments;
};

/** Wycina podane słowa z gotowego zdania, zamieniając pierwsze wystąpienie każdego na lukę. */
const cutWordsFromSentence = (sentence: string, wordsToCut: string[]): ExerciseSegment[] => {
  let remaining = sentence;
  const segments: ExerciseSegment[] = [];
  let gapIndex = 0;

  wordsToCut.forEach((word) => {
    if (!word) return;
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) return;
    gapIndex += 1;
    if (match.index > 0) segments.push({ kind: 'text', text: remaining.slice(0, match.index) });
    segments.push({ kind: 'gap', gapId: `GAP_${gapIndex}` });
    remaining = remaining.slice(match.index + match[0].length);
  });

  if (remaining) segments.push({ kind: 'text', text: remaining });
  return segments;
};

/**
 * Zawsze zwraca `string[]` czystych fragmentów — nigdy zagnieżdżonych
 * obiektów (`{word: "..."}`, źródło `TypeError: reading 'word'`).
 *
 * Nie odrzuca elementów: `answer` w rozsypance trzyma INDEKSY do tej
 * tablicy (patrz `answerToText` w `StudentHomeworkScreen.tsx`, które czyta
 * `item.chunks?.[i]`), więc filtrowanie przesunęłoby indeksy i rozjechało
 * już zapisane odpowiedzi. Pusty/nietypowy element zostaje pustym stringiem
 * zamiast znikać.
 */
const normalizeTokens = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object' && typeof (entry as any).word === 'string') return (entry as any).word;
    if (entry === null || entry === undefined) return '';
    return String(entry);
  });
};

/**
 * Normalizuje dowolny surowy element z bazy do jednolitego kontraktu.
 * Zero wyjątków: błąd w kształcie danych degraduje do `state: 'invalid'`
 * zamiast wywalić render.
 */
export const normalizeExercise = (raw: any, task?: { type?: HomeworkType } | null): CanonicalExercise => {
  try {
    const type = resolveCanonicalType(raw, task);
    if (!type) {
      return { type: 'translation', state: 'invalid', message: INVALID_MESSAGE, raw };
    }

    if (type === 'word_order') {
      const tokens = normalizeTokens(raw?.chunks);
      if (tokens.length === 0) {
        return { type, state: 'invalid', message: INVALID_MESSAGE, raw };
      }
      const sourceSentence = cleanSourceSentence(raw?.polishHint || raw?.sourceSentence || raw?.prompt);
      return {
        type,
        state: 'ready',
        tokens,
        sourceSentence: sourceSentence || undefined,
        correctSentence: typeof raw?.correctSentence === 'string' ? raw.correctSentence : undefined,
        raw,
      };
    }

    if (type === 'fill_in_the_blank') {
      const gapPayload = normalizeGapPayload(raw);
      if (!gapPayload) {
        const fallbackText = String(raw?.content || raw?.text || raw?.sentence || raw?.instruction || '').trim();
        if (!fallbackText) {
          return { type, state: 'invalid', message: INVALID_MESSAGE, raw };
        }
        return {
          type,
          state: 'degraded',
          segments: [{ kind: 'text', text: fallbackText }],
          gaps: [],
          availableWords: [],
          raw,
        };
      }
      const gaps = gapPayload.segments
        .filter((s): s is Extract<ExerciseSegment, { kind: 'gap' }> => s.kind === 'gap')
        .map((s) => ({ id: s.gapId }));
      return {
        type,
        state: 'ready',
        segments: gapPayload.segments,
        gaps,
        availableWords: gapPayload.availableWords,
        raw,
      };
    }

    if (type === 'translation') {
      const sourceSentence = cleanSourceSentence(raw?.polishSentence || raw?.content || raw?.instruction);
      if (!sourceSentence) {
        return { type, state: 'invalid', message: INVALID_MESSAGE, raw };
      }
      const explicitHint =
        raw?.hint || raw?.hintSmall || raw?.hintLarge ||
        (Array.isArray(raw?.requiredMaterial) ? raw.requiredMaterial.join(', ') : raw?.requiredMaterial);
      // Pole "poprawne zdanie" dla tłumaczenia nie jest dziś pokazywane w
      // `HomeworkExercise.tsx` (ocenia to AI przy zapisie), ale generator
      // potrafi je dołączyć pod kilkoma historycznymi nazwami — potrzebne
      // np. do zbudowania rozgrzewki (`utils/warmupRounds.ts`), która musi
      // znać wzorcowe zdanie, żeby ułożyć z niego rozsypankę.
      const correctSentence =
        typeof raw?.correctTranslation === 'string' ? raw.correctTranslation :
        typeof raw?.englishTranslation === 'string' ? raw.englishTranslation :
        typeof raw?.englishSentence === 'string' ? raw.englishSentence :
        typeof raw?.modelAnswer === 'string' ? raw.modelAnswer :
        undefined;
      return {
        type,
        state: 'ready',
        sourceSentence,
        hint: explicitHint || undefined,
        correctSentence,
        raw,
      };
    }

    // find_errors
    const incorrectSentence = cleanSourceSentence(raw?.incorrectSentence || raw?.content);
    if (!incorrectSentence) {
      return { type, state: 'invalid', message: INVALID_MESSAGE, raw };
    }
    const explicitHint =
      raw?.hint || raw?.hintSmall || raw?.hintLarge ||
      (Array.isArray(raw?.requiredMaterial) ? raw.requiredMaterial.join(', ') : raw?.requiredMaterial);
    const meaning = raw?.polishHint || raw?.meaning || undefined;
    return {
      type,
      state: 'ready',
      incorrectSentence,
      hint: explicitHint || undefined,
      meaning,
      correctSentence: typeof raw?.correctSentence === 'string' ? raw.correctSentence : undefined,
      raw,
    };
  } catch {
    return { type: 'translation', state: 'invalid', message: INVALID_MESSAGE, raw };
  }
};

const INVALID_MESSAGE =
  'Nie udało się wczytać treści tego zadania. Możesz przejść do kolejnego ćwiczenia.';

/**
 * Nagłówek i polecenie dla każdego typu — deterministyczne, nie generowane
 * przez AI. Przechodzi przez i18next (`en.json`/`pl.json`), zgodnie z
 * konwencją repo (CLAUDE.md §4) — klucze to domyślny, polski tekst.
 */
export const exerciseUiCopy = (type: CanonicalExerciseType): { heading: string; instruction: string } => {
  switch (type) {
    case 'word_order':
      return { heading: i18n.t('Ułóż zdanie'), instruction: i18n.t('Ułóż wyrazy w poprawnej kolejności.') };
    case 'fill_in_the_blank':
      return { heading: i18n.t('Uzupełnij luki'), instruction: i18n.t('Wpisz brakujące słowa.') };
    case 'translation':
      return { heading: i18n.t('Przetłumacz zdanie'), instruction: i18n.t('Zapisz tłumaczenie w języku angielskim.') };
    case 'find_errors':
      return { heading: i18n.t('Popraw zdanie'), instruction: i18n.t('Znajdź błąd i zapisz poprawną wersję zdania.') };
  }
};

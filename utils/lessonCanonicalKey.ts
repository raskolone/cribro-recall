/**
 * Moduł wyznaczania kanonicznego klucza lekcji i aliasów zestawów słownictwa.
 * Rozwiązuje problem duplikatów zestawów w "Słownictwo z lekcji" (VOCAB-DUP-2).
 */
import { FlashcardSet } from '../types';

export interface LessonKeyContext {
  lessonRecordId?: string;
  lessonDate?: string;
  lessonTopic?: string;
  title?: string;
  aliasIds?: string[];
  knownLessonRecords?: Array<{ id: string; date?: string; topic?: string }>;
}

/**
 * Normalizuje tytuł/temat lekcji do porównań odpornych na prefiksy i formatowanie.
 */
export function normalizeTopic(topic?: string | null): string {
  if (!topic) return '';
  return topic
    .toLowerCase()
    .replace(/^\[lekcja\]\s*/i, '')
    .replace(/^(lekcja|lesson)\s*#?\d+[\s:\-–]*/i, '')
    .replace(/\((lekcja|lesson)\s*#?\d+\)\s*/gi, '')
    .replace(/^słownictwo\s+z\s+lekcji[\s:\-–]*/i, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/[^a-z0-9ąćęłńóśźż]/gi, '')
    .trim();
}

/** Okno bliskości timestampów zestawu `set-lesson-<ts>` i lekcji `lesson-<ts>` (ms). */
export const HISTORICAL_PAIR_WINDOW_MS = 30000;

/**
 * Szuka lekcji dla historycznego zestawu `set-lesson-<timestamp>`.
 * Kandydat to lekcja, dla której zachodzi JEDNO z:
 *  (1) ten sam temat (po normalizacji) i — gdy obie strony mają datę — ta sama data;
 *  (2) ID `lesson-<ts>` z timestampem bliższym niż HISTORICAL_PAIR_WINDOW_MS i niesprzecznym tematem.
 * Zwraca ID tylko przy dokładnie jednym kandydacie; w przeciwnym razie null.
 */
export function findUnambiguousLessonForHistoricalSet(
  strippedId: string,
  context?: LessonKeyContext
): string | null {
  const known = context?.knownLessonRecords;
  if (!known || known.length === 0) return null;

  const targetTopic = normalizeTopic(context?.lessonTopic || context?.title);
  const targetDate = (context?.lessonDate || '').trim();
  const isTimestamp = /^\d{10,16}$/.test(strippedId);
  const setTime = isTimestamp ? Number(strippedId) : NaN;

  const candidates = new Set<string>();
  for (const l of known) {
    const lTopic = normalizeTopic(l.topic);
    const lDate = (l.date || '').trim();

    if (targetTopic && lTopic && targetTopic === lTopic && !(targetDate && lDate && targetDate !== lDate)) {
      candidates.add(l.id);
      continue;
    }

    if (isTimestamp && l.id.startsWith('lesson-')) {
      const lTime = Number(l.id.replace(/^lesson-/, '').split('-')[0]);
      if (!Number.isNaN(lTime) && Math.abs(setTime - lTime) < HISTORICAL_PAIR_WINDOW_MS) {
        if (!targetTopic || !lTopic || targetTopic === lTopic) candidates.add(l.id);
      }
    }
  }

  return candidates.size === 1 ? Array.from(candidates)[0] : null;
}

/**
 * Zwraca kanoniczny identyfikator lekcji (lessonRecordId) dla danego zestawu lub ID zestawu.
 */
export function getCanonicalLessonRecordId(
  setId: string | null | undefined,
  context?: LessonKeyContext
): string | null {
  // 1. Pierwsze źródło: jawne pole lessonRecordId jeśli istnieje
  if (context?.lessonRecordId && typeof context.lessonRecordId === 'string' && context.lessonRecordId.trim().length > 0) {
    return context.lessonRecordId.trim();
  }

  if (!setId || typeof setId !== 'string') return null;
  const rawId = setId.trim();

  // 2. Format wirtualny z FlashcardContext: lesson_<lessonRecordId>
  if (rawId.startsWith('lesson_')) {
    const stripped = rawId.replace(/^lesson_/, '').trim();
    if (stripped.length > 0) return stripped;
  }

  // 3. Format vocab-<lessonRecordId>
  if (rawId.startsWith('vocab-')) {
    const stripped = rawId.replace(/^vocab-/, '').trim();
    if (stripped.length > 0) return stripped;
  }

  // 4. Format z bazy Firestore /sets: set-lesson-<id>
  if (rawId.startsWith('set-lesson-')) {
    const stripped = rawId.replace(/^set-lesson-/, '').trim();
    if (!stripped) return null;

    // 4a. set-lesson-lesson-... -> lesson-...
    if (stripped.startsWith('lesson-')) {
      return stripped;
    }

    // 4b. set-lesson-<UUID> (np. 7ff9e99b-2628-4502-80b2-5b8834284636)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stripped);
    if (isUuid) {
      return stripped;
    }

    // 4c. Sprawdzenie w knownLessonRecords po bezpośrednim ID
    if (context?.knownLessonRecords && context.knownLessonRecords.length > 0) {
      const directMatch = context.knownLessonRecords.find(l => l.id === stripped);
      if (directMatch) return directMatch.id;
    }

    // 4d. Historyczny format set-lesson-<timestamp> (np. set-lesson-1785854174197).
    // Parujemy z lekcją TYLKO, gdy kandydat jest jednoznaczny; przy 0 lub >1 kandydatach
    // zestaw zostaje pod własnym kluczem (nic nie znika z widoku).
    const match = findUnambiguousLessonForHistoricalSet(stripped, context);
    if (match) return match;

    return stripped;
  }

  // 5. Sprawdzenie czy sam setId pasuje do znanej lekcji
  if (context?.knownLessonRecords?.some(l => l.id === rawId)) {
    return rawId;
  }

  return null;
}

/**
 * Sprawdza, czy obiekt lub identyfikator reprezentuje zestaw słownictwa z lekcji.
 */
export function isLessonVocabularySet(setOrId: any): boolean {
  if (!setOrId) return false;
  if (typeof setOrId === 'string') {
    return setOrId.startsWith('lesson_') || setOrId.startsWith('set-lesson-') || setOrId.startsWith('vocab-');
  }
  if (setOrId.isLessonVocabulary) return true;
  if (typeof setOrId.id === 'string') {
    if (setOrId.id.startsWith('lesson_') || setOrId.id.startsWith('set-lesson-')) return true;
  }
  if (setOrId.assignedByTeacher && (setOrId.lessonTopic || setOrId.lessonDate)) return true;
  return false;
}

/**
 * Zwraca listę wszystkich możliwych aliasów ID dla danego klucza lekcji.
 */
export function getLessonSetAliases(canonicalKey: string, extraIds: (string | null | undefined)[] = []): string[] {
  if (!canonicalKey) return [];
  const clean = canonicalKey.replace(/^lesson_/, '').replace(/^set-lesson-/, '').replace(/^vocab-/, '');
  const aliases = new Set<string>();

  aliases.add(clean);
  aliases.add(`lesson_${clean}`);
  aliases.add(`set-lesson-${clean}`);
  aliases.add(`vocab-${clean}`);

  if (!clean.startsWith('lesson-')) {
    aliases.add(`set-lesson-lesson-${clean}`);
    aliases.add(`lesson_lesson-${clean}`);
  }

  for (const extra of extraIds) {
    if (extra && typeof extra === 'string') {
      aliases.add(extra);
    }
  }

  return Array.from(aliases);
}

/**
 * Sprawdza, czy dwa identyfikatory (lub zestawy) reprezentują tę samą lekcję.
 */
export function areLessonSetAliases(
  idA: string | null | undefined,
  idB: string | null | undefined,
  contextA?: LessonKeyContext,
  contextB?: LessonKeyContext
): boolean {
  if (!idA || !idB) return false;
  if (idA === idB) return true;

  // 1. Sprawdź jawne listy aliasów jeśli dostępne w kontekście
  if (contextA?.aliasIds && contextA.aliasIds.includes(idB)) return true;
  if (contextB?.aliasIds && contextB.aliasIds.includes(idA)) return true;

  const canonA = getCanonicalLessonRecordId(idA, contextA);
  const canonB = getCanonicalLessonRecordId(idB, contextB);

  if (canonA && canonB && canonA === canonB) return true;

  // 2. Sprawdź czy jeden jest w generowanych aliasach drugiego
  if (canonA) {
    const aliasesA = getLessonSetAliases(canonA, [idA]);
    if (aliasesA.includes(idB)) return true;
  }
  if (canonB) {
    const aliasesB = getLessonSetAliases(canonB, [idB]);
    if (aliasesB.includes(idA)) return true;
  }

  // 3. Sprawdź warianty z podwójnym prefixem
  const cleanA = idA.replace(/^set-lesson-/, '').replace(/^lesson_/, '').replace(/^vocab-/, '');
  const cleanB = idB.replace(/^set-lesson-/, '').replace(/^lesson_/, '').replace(/^vocab-/, '');
  if (cleanA && cleanB && cleanA === cleanB) return true;

  // 4. Dopasowanie timestampowe dla historycznych par set-lesson-<timestamp> vs ...lesson-<timestamp>
  const parseTimestamp = (val: string): number | null => {
    const stripped = val.replace(/^set-lesson-/, '').replace(/^lesson_/, '').replace(/^vocab-/, '');
    const m = stripped.match(/(?:lesson-)?(\d{10,16})/);
    return m ? Number(m[1]) : null;
  };

  // Tylko gdy dokładnie jedna strona jest historycznym `set-lesson-<timestamp>`: dwie różne
  // lekcje utworzone w odstępie kilku sekund nie są aliasami.
  const isHistorical = (id: string) => /^set-lesson-\d{10,16}$/.test(id);
  const tsA = parseTimestamp(idA);
  const tsB = parseTimestamp(idB);
  if (isHistorical(idA) !== isHistorical(idB) && tsA !== null && tsB !== null && Math.abs(tsA - tsB) < 15000) {
    return true;
  }

  return false;
}

/**
 * B) Deduplikacja w FlashcardContext: po kluczu kanonicznym zostaje JEDEN zestaw lekcji.
 * Reguła wyboru: preferuj zestaw z bazy (/sets), jeśli istnieje, w przeciwnym razie wirtualny.
 * Zestawy własne i ogólne (nie "z lekcji") nie są dotykane.
 */
export function deduplicateFlashcardSets(
  dbSets: FlashcardSet[],
  virtualLessonSets: FlashcardSet[],
  knownLessonRecords?: Array<{ id: string; date?: string; topic?: string }>,
  chronologicalLessonNumbers?: Map<string, number>
): FlashcardSet[] {
  // 1. Zestawy nie-lekcyjne zostają nienaruszone
  const nonLessonSets: FlashcardSet[] = [];
  const lessonDbSets: FlashcardSet[] = [];

  for (const set of dbSets) {
    if (isLessonVocabularySet(set)) {
      lessonDbSets.push(set);
    } else {
      nonLessonSets.push(set);
    }
  }

  // 2. Grupowanie zestawów lekcyjnych po kluczu kanonicznym
  const groups = new Map<string, { dbSets: FlashcardSet[]; virtualSets: FlashcardSet[]; allIds: Set<string> }>();

  const addToGroup = (set: FlashcardSet, isDb: boolean) => {
    const canonKey = getCanonicalLessonRecordId(set.id, {
      lessonRecordId: set.lessonRecordId,
      lessonTopic: set.lessonTopic || set.title,
      lessonDate: set.lessonDate,
      knownLessonRecords
    });
    // Jeśli nie udało się ustalić kanonicznego klucza, kluczem zostaje sam set.id (nie ukrywamy niczego)
    const key = canonKey || set.id;

    let group = groups.get(key);
    if (!group) {
      group = { dbSets: [], virtualSets: [], allIds: new Set<string>() };
      groups.set(key, group);
    }

    group.allIds.add(set.id);
    if (canonKey) group.allIds.add(canonKey);

    if (isDb) {
      group.dbSets.push(set);
    } else {
      group.virtualSets.push(set);
    }
  };

  for (const s of lessonDbSets) {
    addToGroup(s, true);
  }
  for (const s of virtualLessonSets) {
    addToGroup(s, false);
  }

  // 3. Dla każdej grupy wybieramy JEDEN zestaw
  const deduplicatedLessonSets: FlashcardSet[] = [];

  for (const [canonKey, group] of groups.entries()) {
    const virtualSet = group.virtualSets[0];
    const lessonNum = (chronologicalLessonNumbers && canonKey)
      ? chronologicalLessonNumbers.get(canonKey)
      : undefined;

    const allAliases = Array.from(group.allIds);

    if (group.dbSets.length > 0) {
      // Preferujemy zestaw z bazy (/sets)
      const chosenDbSet = group.dbSets.length === 1
        ? group.dbSets[0]
        : [...group.dbSets].sort((a, b) => {
            const aIsNew = a.id.startsWith('set-lesson-lesson-');
            const bIsNew = b.id.startsWith('set-lesson-lesson-');
            if (aIsNew && !bIsNew) return -1;
            if (!aIsNew && bIsNew) return 1;
            return (b.cardCount || 0) - (a.cardCount || 0);
          })[0];

      // Wzbogacamy zestaw z bazy o brakujące dane z zestawu wirtualnego
      const merged: FlashcardSet = {
        ...chosenDbSet,
        lessonRecordId: canonKey,
        aliasIds: allAliases,
        lessonNumber: lessonNum ?? chosenDbSet.lessonNumber ?? virtualSet?.lessonNumber,
        lessonTopic: chosenDbSet.lessonTopic || virtualSet?.lessonTopic,
        lessonDate: chosenDbSet.lessonDate || virtualSet?.lessonDate,
        flashcards: (Array.isArray(chosenDbSet.flashcards) && chosenDbSet.flashcards.length > 0)
          ? chosenDbSet.flashcards
          : virtualSet?.flashcards,
      } as any;

      deduplicatedLessonSets.push(merged);
    } else if (virtualSet) {
      // Brak w bazie -> zostaje zestaw wirtualny
      const merged: FlashcardSet = {
        ...virtualSet,
        lessonRecordId: canonKey,
        aliasIds: allAliases,
        lessonNumber: lessonNum ?? virtualSet.lessonNumber,
      } as any;
      deduplicatedLessonSets.push(merged);
    }
  }

  return [...nonLessonSets, ...deduplicatedLessonSets];
}

const toMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Kolejność zestawów z lekcji: data lekcji malejąco (najnowsza pierwsza), przy remisie
 * numer lekcji malejąco, potem data utworzenia malejąco. Zestaw bez daty lekcji ląduje na końcu.
 */
export function compareLessonSetsNewestFirst(a: FlashcardSet, b: FlashcardSet): number {
  const byDate = toMillis(b.lessonDate) - toMillis(a.lessonDate);
  if (byDate !== 0) return byDate;
  const byNumber = (b.lessonNumber ?? 0) - (a.lessonNumber ?? 0);
  if (byNumber !== 0) return byNumber;
  return toMillis(b.createdAt) - toMillis(a.createdAt);
}

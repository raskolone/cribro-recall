/**
 * ContextAssembler — minimalny, pseudonimizowany kontekst dla modelu.
 *
 * Buduje paliwo generatora wyłącznie z zatwierdzonych lekcji w Firestore.
 * Notion nie jest tu odpytywany i nie może być: to dokumentacja, nie runtime.
 *
 * Kolejność źródeł jest odwzorowana za specyfikacją (§5 i „Paliwo kontekstu"
 * w §18): lekcja → notatka lektora → zatwierdzone słownictwo, gramatyka,
 * korekty i cele → ostatnie błędy z v2 → globalny rdzeń. Wiedza modelu wchodzi
 * wyłącznie na etapie układania formy, nigdy jako nowe źródło celu — i to
 * pilnuje prompt generatora, nie ten plik.
 */

import { MAX_LESSONS_AS_FUEL } from './contracts';
import { getDb } from './db';

// ---------------------------------------------------------------------------
// Kształt paliwa
// ---------------------------------------------------------------------------

export interface LessonFuel {
  lessonId: string;
  topic: string;
  date: string;
  /** Słownictwo z lekcji — hasło i tłumaczenie, po jednej pozycji na linię. */
  vocabulary: string;
  /** Korekty językowe z lekcji, BEZ pozycji dotyczących wymowy. */
  corrections: string;
  /** Lekcja w skrócie — kontekst i notatka lektora. */
  summary: string;
  /** Cele na kolejną lekcję — pomagają trafić w to, co ma wrócić. */
  goals: string;
}

export interface StudentSnapshot {
  /** Poziom deklarowany lub wyliczony. CEFR przegrywa z notatką i faktami. */
  cefr: string;
  /** Ostatnie błędy z homework v2. Puste przy pierwszym zestawie. */
  recentMistakes: string[];
}

export interface AssembledContext {
  lessons: LessonFuel[];
  student: StudentSnapshot;
  /** Do zapisania w `sourceRefs` każdego zadania. */
  lessonIds: string[];
}

// ---------------------------------------------------------------------------
// Odsiewanie wymowy
// ---------------------------------------------------------------------------

/**
 * Blok korekt w tym modelu danych nazywa się „Corrections & Pronunciation"
 * i trzyma jedno obok drugiego (patrz `LessonBlocks` w `types.ts`).
 *
 * Zlecenie mówi wprost: blok wymowy nie jest paliwem ćwiczeń tekstowych.
 * Zadanie pisemne oparte na „th jak w think" uczy czegoś, czego kursant
 * w tym ćwiczeniu nie ćwiczy — nie da się przećwiczyć wymowy klawiaturą.
 *
 * Odsiewamy po linii, nie po całym bloku: w jednym bloku potrafią leżeć obok
 * siebie prawdziwa korekta gramatyczna i uwaga o akcencie.
 */
const PRONUNCIATION_MARKERS =
  /(wymow|pronunc|akcent|stress|intonac|intonat|sylab|syllab|\/[a-zʃʒθðŋæɪʊəɜɑɒʌ:ˈˌ]+\/|\[[a-zʃʒθðŋæɪʊəɜɑɒʌ:ˈˌ]+\])/i;

export const stripPronunciationLines = (corrections: string): string =>
  (corrections || '')
    .split('\n')
    .filter((line) => line.trim().length > 0 && !PRONUNCIATION_MARKERS.test(line))
    .join('\n')
    .trim();

// ---------------------------------------------------------------------------
// Czytanie lekcji
// ---------------------------------------------------------------------------

/**
 * Wyciąga bloki z rekordu lekcji.
 *
 * Uproszczona wersja `extractLessonBlocks` z `utils/lessonBlocks.ts`: obsługuje
 * `structuredBlocks` i pola płaskie, czyli dwie ścieżki, którymi idą rekordy
 * po imporcie i po migracji. Nie odtwarza parsowania wieloblokowego tekstu
 * z Notion — tamten kod ma sto linii i żyje po stronie aplikacji, która i tak
 * migruje takie rekordy (`migrateRecordToBlocks`), zanim lektor je zatwierdzi.
 *
 * Rekord, z którego nie da się wyciągnąć ani słownictwa, ani korekt, nie jest
 * paliwem — i mówimy o tym wprost, zamiast generować z pustki.
 */
const readLessonFuel = (lessonId: string, record: Record<string, unknown>): LessonFuel => {
  const blocks = (record.structuredBlocks as Record<string, string> | undefined) || {};

  const text = (blockValue: unknown, flatValue: unknown): string =>
    String(blockValue || flatValue || '').trim();

  return {
    lessonId,
    topic: String(record.topic || '').trim(),
    date: String(record.date || '').trim(),
    vocabulary: text(blocks.vocabulary, record.vocabularyText),
    corrections: stripPronunciationLines(text(blocks.corrections, record.corrections)),
    summary: text(blocks.summary, record.lessonSummary),
    goals: text(blocks.nextLesson, record.nextLessonPlan || record.suggestedFollowUp),
  };
};

/** Czy lekcja jest zatwierdzona — odpowiednik `isStudentVisibleLesson`. */
const isApprovedLesson = (record: Record<string, unknown>): boolean => {
  if (record.status === 'rejected' || record.status === 'pending_confirmation') return false;
  if (record.isPendingConfirmation === true) return false;
  if (record.isDateMissing === true) return false;
  const reason = String(record.pendingReason || '').trim();
  return reason.length === 0;
};

/** Czy z tej lekcji w ogóle da się cokolwiek ułożyć. */
export const hasUsableFuel = (fuel: LessonFuel): boolean =>
  fuel.vocabulary.length > 0 || fuel.corrections.length > 0;

// ---------------------------------------------------------------------------
// Złożenie kontekstu
// ---------------------------------------------------------------------------

export interface AssembleInput {
  studentUid: string;
  /** Wybór lektora. Domyślnie jedna lekcja, najwyżej trzy. */
  lessonIds: string[];
  /** Poziom z profilu kursanta. */
  cefr: string;
  /** Ostatnie błędy z homework v2, jeśli są. */
  recentMistakes?: string[];
}

export const assembleContext = async (input: AssembleInput): Promise<AssembledContext> => {
  const ids = input.lessonIds.slice(0, MAX_LESSONS_AS_FUEL);
  if (ids.length === 0) throw new Error('Nie wskazano żadnej lekcji jako paliwa.');

  const snapshots = await Promise.all(
    ids.map((id) => getDb().collection('users').doc(input.studentUid).collection('lessonRecords').doc(id).get())
  );

  const lessons: LessonFuel[] = [];
  const rejected: string[] = [];

  snapshots.forEach((snapshot, index) => {
    const id = ids[index];
    if (!snapshot.exists) {
      rejected.push(`${id}: lekcja nie istnieje`);
      return;
    }
    const record = snapshot.data() as Record<string, unknown>;
    if (!isApprovedLesson(record)) {
      rejected.push(`${id}: lekcja niezatwierdzona`);
      return;
    }
    const fuel = readLessonFuel(id, record);
    if (!hasUsableFuel(fuel)) {
      rejected.push(`${id}: brak słownictwa i korekt`);
      return;
    }
    lessons.push(fuel);
  });

  if (lessons.length === 0) {
    throw new Error(
      `Żadna z wybranych lekcji nie nadaje się na paliwo. ${rejected.join('; ')}`
    );
  }

  return {
    lessons,
    student: {
      cefr: input.cefr,
      // Przycięte: model ma wiedzieć, co wraca, a nie dostać całą historię.
      recentMistakes: (input.recentMistakes || []).slice(0, 8),
    },
    lessonIds: lessons.map((lesson) => lesson.lessonId),
  };
};

// ---------------------------------------------------------------------------
// Serializacja do promptu
// ---------------------------------------------------------------------------

/**
 * Zamienia kontekst w tekst dla modelu.
 *
 * Pseudonimizacja jest tu, a nie w wywołaniu: do modelu nie idzie imię,
 * nazwisko, e-mail ani UID kursanta. Model dostaje „kursant", poziom
 * i materiał — i to wystarcza, żeby ułożyć zadanie. Wszystko powyżej tego
 * minimum byłoby danymi osobowymi wysyłanymi bez powodu.
 */
export const renderContextForPrompt = (context: AssembledContext): string => {
  const lessonSections = context.lessons.map((lesson, index) => {
    const parts = [`### LEKCJA ${index + 1}: ${lesson.topic || '(bez tematu)'} (${lesson.date})`];
    if (lesson.summary) parts.push(`NOTATKA LEKTORA:\n${lesson.summary}`);
    if (lesson.vocabulary) parts.push(`SŁOWNICTWO:\n${lesson.vocabulary}`);
    if (lesson.corrections) parts.push(`KOREKTY JĘZYKOWE:\n${lesson.corrections}`);
    if (lesson.goals) parts.push(`CELE NA DALEJ:\n${lesson.goals}`);
    return parts.join('\n\n');
  });

  const mistakes = context.student.recentMistakes.length
    ? `\n\n### POWTARZAJĄCE SIĘ BŁĘDY KURSANTA\n${context.student.recentMistakes.map((m) => `- ${m}`).join('\n')}`
    : '';

  return `### KURSANT
Poziom: ${context.student.cefr}
(Kursant jest anonimowy. Nie używaj imion ani faktów osobistych — nie masz ich i nie wolno Ci ich wymyślać.)

${lessonSections.join('\n\n')}${mistakes}`;
};

import { LessonRecord } from '../types';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { generateTextWithUnifiedFallback, extractJSON } from './geminiService';

/**
 * Odprawa przed lekcją — ostatnie lekcje ułożone przez model w to, co lektor
 * naprawdę czyta minutę przed zajęciami.
 *
 * ══ DLACZEGO MODEL, A NIE SAM PODZIAŁ NA SEKCJE ══
 *
 * Notatki z lekcji są zapisem przebiegu, nie streszczeniem: blok pracy
 * domowej potrafi mieć trzydzieści zdań z kluczem odpowiedzi, a „do poprawy"
 * bywa wklejką z całego dokumentu. Samo rozłożenie tego na sekcje pokazuje tę
 * samą ścianę tekstu, tylko w czterech kawałkach.
 *
 * ══ ZAKRES WYBIERA LEKTOR ══
 *
 * Jedna lekcja, dwie albo trzy — bo to zależy od tego, po co się tu wchodzi.
 * Przed lekcją co tydzień wystarczy ostatnia; po dłuższej przerwie albo przed
 * rozmową o postępach trzeba zobaczyć wątek, czyli rzeczy powtarzające się
 * w kilku. Domyślne trzy byłyby w najczęstszym przypadku trzema razami
 * więcej tekstu, niż trzeba.
 *
 * ══ KRÓTKO I PO IMIENIU ══
 *
 * Odprawa zaczyna się jednym akapitem skierowanym do lektora po imieniu
 * („Macieju, ostatnio z Bartkiem…"), a nie nagłówkiem. Reszta to listy
 * punktów w zwijanych sekcjach. Esej o postępach czyta się dłużej niż same
 * notatki, czyli robi dokładnie odwrotnie, niż ten ekran ma robić.
 *
 * ══ WYNIK JEST BUFOROWANY ══
 *
 * Klucz to identyfikator ostatniej lekcji PLUS zakres: dopóki nie doszła
 * nowa lekcja, odprawa o tym samym zakresie się nie zmienia. Bufor siedzi
 * w `localStorage` — jest podręczny dla jednej osoby przy jednym komputerze
 * i tyle ma znaczyć.
 */

/** Ile ostatnich lekcji wchodzi do odprawy. */
export type BriefingScope = 1 | 2 | 3;

/** Jedna lekcja rozłożona na trzy pytania, które lektor zadaje sobie sam. */
export interface BriefingLesson {
  date: string;
  topic: string;
  /** Co się działo. */
  covered: string[];
  /** O czym mówił kursant. */
  studentVoice: string[];
  /** Jakie słowa padły. */
  vocabulary: { term: string; note?: string }[];
  /** Co zostało zadane po tej lekcji. */
  homework: string[];
}

export interface PreLessonBriefing {
  /** Akapit do lektora po imieniu. Trzy, najwyżej cztery zdania. */
  headline: string;
  /** Rozbicie po lekcjach — tyle pozycji, ile lektor wybrał. */
  lessons: BriefingLesson[];
  /** Co się chwieje — błędy powtarzalne. */
  watchOut: string[];
  /** Propozycja na dzisiaj. */
  nextStep: string[];
  /** Model, który to ułożył — do stopki karty. */
  modelUsed?: string;
}

const CACHE_PREFIX = 'pre_lesson_briefing_v2:';

const cacheKey = (studentId: string, lastLessonId: string, scope: BriefingScope) =>
  `${CACHE_PREFIX}${studentId}:${lastLessonId}:${scope}`;

export const readCachedBriefing = (
  studentId: string,
  lastLessonId: string,
  scope: BriefingScope
): PreLessonBriefing | null => {
  try {
    const raw = window.localStorage.getItem(cacheKey(studentId, lastLessonId, scope));
    return raw ? (JSON.parse(raw) as PreLessonBriefing) : null;
  } catch {
    return null;
  }
};

const writeCachedBriefing = (
  studentId: string,
  lastLessonId: string,
  scope: BriefingScope,
  briefing: PreLessonBriefing
): void => {
  try {
    window.localStorage.setItem(
      cacheKey(studentId, lastLessonId, scope),
      JSON.stringify(briefing)
    );
  } catch {
    /* brak miejsca albo tryb prywatny — odprawa policzy się ponownie */
  }
};

/** Skraca pojedynczy blok, żeby trzy lekcje zmieściły się w rozsądnym oknie. */
const clip = (text: string | undefined, limit: number): string =>
  !text ? '' : text.length > limit ? `${text.slice(0, limit)}…` : text;

/** Jedna lekcja jako tekst dla modelu — bez kluczy odpowiedzi i bez ozdób. */
const lessonToPrompt = (lesson: LessonRecord, index: number): string => {
  const blocks = extractLessonBlocks(lesson);
  return [
    `### LEKCJA ${index + 1} — data: ${lesson.date || 'bez daty'} — temat: „${lesson.topic || 'bez tematu'}"`,
    blocks.summary ? `PRZEBIEG:\n${clip(blocks.summary, 1600)}` : '',
    lesson.studentSpeaking ? `WYPOWIEDZI KURSANTA:\n${clip(lesson.studentSpeaking, 1200)}` : '',
    blocks.vocabulary ? `SŁOWNICTWO:\n${clip(blocks.vocabulary, 1200)}` : '',
    blocks.corrections || lesson.thingsToImprove
      ? `BŁĘDY I POPRAWKI:\n${clip(blocks.corrections || lesson.thingsToImprove, 1200)}`
      : '',
    // Klucz odpowiedzi celowo pomijany: zajmuje najwięcej miejsca i nie mówi
    // nic o tym, jak kursantowi poszło.
    blocks.homework ? `ZADANE:\n${clip(blocks.homework, 900)}` : '',
    blocks.nextLesson || lesson.suggestedFollowUp
      ? `PLAN NA NASTĘPNĄ:\n${clip(blocks.nextLesson || lesson.suggestedFollowUp, 600)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const systemInstruction = (teacherName: string, studentName: string, count: number) => `Jesteś asystentem lektora języka angielskiego. Lektor ma na imię ${teacherName}. Kursant nazywa się ${studentName}. Dostajesz notatki z ${count === 1 ? 'ostatniej lekcji' : `${count} ostatnich lekcji`} i przygotowujesz ODPRAWĘ, którą lektor czyta minutę przed kolejnymi zajęciami.

NAJWAŻNIEJSZE: ma być KRÓTKO. To ściągawka, nie raport. Lektor ma ją przeczytać w kilkanaście sekund.

ZASADY:
- Piszesz PO POLSKU.
- "headline" to 2-4 ZDANIA skierowane do lektora po imieniu, zaczynające się od jego imienia w wołaczu (np. "${teacherName}, ostatnio z ${studentName} ..."). Mówisz w nim, co się przerobiło i co z tego wynika na dziś. Bez ozdobników, bez chwalenia, bez zapowiadania, co będzie w dalszej części.
- Reszta to WYŁĄCZNIE punkty. Każdy punkt to jedno zdanie do ~110 znaków. Żadnych akapitów.
- Terminy angielskie zostawiasz po angielsku.
- Opierasz się WYŁĄCZNIE na notatkach. Niczego nie zmyślasz; jeżeli czegoś nie ma, zwracasz pustą listę.
- "lessons" ma dokładnie ${count} ${count === 1 ? 'pozycję' : 'pozycji'} — po jednej na każdą przekazaną lekcję, w kolejności od NAJNOWSZEJ do najstarszej. "date" i "topic" przepisujesz z notatek.
- W "watchOut" wymieniasz wyłącznie błędy i braki, które WIDAĆ w notatkach; najpierw te powtarzające się w kilku lekcjach.
- W "nextStep" proponujesz 2-3 konkretne ruchy na dzisiejszą lekcję.

Odpowiadasz WYŁĄCZNIE obiektem JSON:
{
  "headline": string,
  "lessons": [{
    "date": string,
    "topic": string,
    "covered": string[],
    "studentVoice": string[],
    "vocabulary": [{"term": string, "note": string}],
    "homework": string[]
  }],
  "watchOut": string[],
  "nextStep": string[]
}
"covered", "studentVoice" i "homework" mają po 0-4 pozycje. "vocabulary" do 10 pozycji, "note" to krótkie tłumaczenie lub kontekst. "watchOut" 0-5, "nextStep" 2-3.`;

const asStringList = (value: any, limit: number): string[] =>
  Array.isArray(value)
    ? value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, limit)
    : [];

const asVocabList = (value: any, limit: number): { term: string; note?: string }[] =>
  Array.isArray(value)
    ? value
        .map((item: any) => ({
          term: String(item?.term || '').trim(),
          note: item?.note ? String(item.note).trim() : undefined,
        }))
        .filter((item: { term: string }) => item.term.length > 0)
        .slice(0, limit)
    : [];

/**
 * Układa odprawę z wybranej liczby ostatnich lekcji. `lessons` przychodzą
 * posortowane malejąco po dacie — funkcja bierze tyle pierwszych, ile wynosi
 * `scope`, i podaje je modelowi od najnowszej, bo tak też je czyta lektor.
 */
export const generatePreLessonBriefing = async (
  teacherName: string,
  studentName: string,
  lessons: LessonRecord[],
  scope: BriefingScope,
  options?: { force?: boolean }
): Promise<PreLessonBriefing | null> => {
  const recent = lessons.slice(0, scope);
  if (recent.length === 0) return null;

  const studentId = recent[0].studentId;
  const lastLessonId = recent[0].id;

  if (!options?.force) {
    const cached = readCachedBriefing(studentId, lastLessonId, scope);
    if (cached) return cached;
  }

  const prompt = `Lektor: ${teacherName}
Kursant: ${studentName}
Lekcje w materiale (od najnowszej): ${recent.length}

${recent.map(lessonToPrompt).join('\n\n')}`;

  const { text, modelUsed } = await generateTextWithUnifiedFallback(
    prompt,
    systemInstruction(teacherName, studentName, recent.length),
    undefined,
    { responseMimeType: 'application/json' },
    undefined,
    { taskName: 'Odprawa przed lekcją', category: 'stats' }
  );

  const parsed = JSON.parse(extractJSON(text));

  const briefing: PreLessonBriefing = {
    headline: typeof parsed.headline === 'string' ? parsed.headline.trim() : '',
    lessons: Array.isArray(parsed.lessons)
      ? parsed.lessons.slice(0, recent.length).map((item: any, index: number) => ({
          // Data i temat wracają z NASZYCH danych, nie z odpowiedzi modelu:
          // to jedyne dwa pola, które znamy na pewno, a przepisane przez model
          // potrafią przyjść w innym formacie albo z literówką.
          date: recent[index]?.date || String(item?.date || ''),
          topic: recent[index]?.topic || String(item?.topic || 'Bez tematu'),
          covered: asStringList(item?.covered, 4),
          studentVoice: asStringList(item?.studentVoice, 4),
          vocabulary: asVocabList(item?.vocabulary, 10),
          homework: asStringList(item?.homework, 4),
        }))
      : [],
    watchOut: asStringList(parsed.watchOut, 5),
    nextStep: asStringList(parsed.nextStep, 3),
    modelUsed,
  };

  writeCachedBriefing(studentId, lastLessonId, scope, briefing);
  return briefing;
};

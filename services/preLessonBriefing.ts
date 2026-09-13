import { LessonRecord } from '../types';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { generateTextWithUnifiedFallback, extractJSON } from './geminiService';

/**
 * Odprawa przed lekcją — trzy ostatnie lekcje ułożone przez model w to, co
 * lektor naprawdę czyta minutę przed zajęciami.
 *
 * ══ DLACZEGO MODEL, A NIE SAM PODZIAŁ NA SEKCJE ══
 *
 * Notatki z lekcji są zapisem przebiegu, nie streszczeniem: blok pracy
 * domowej potrafi mieć trzydzieści zdań z kluczem odpowiedzi, a „do poprawy"
 * bywa wklejką z całego dokumentu. Samo rozłożenie tego na sekcje pokazuje tę
 * samą ścianę tekstu, tylko w czterech kawałkach. Model dostaje trzy ostatnie
 * lekcje naraz i zwraca listy punktów — czyli robi dokładnie to, co lektor
 * robił dotąd sam, czytając wstecz przed każdymi zajęciami.
 *
 * ══ TRZY LEKCJE, NIE JEDNA ══
 *
 * Jedna lekcja nie mówi, co się utrwaliło, a co wraca. Trzy pokazują wątek:
 * słowo, które pada trzeci raz, i błąd, który nie ustąpił, są ważniejsze od
 * wszystkiego, co zdarzyło się raz.
 *
 * ══ WYNIK JEST BUFOROWANY ══
 *
 * Klucz to identyfikator ostatniej lekcji: dopóki nie doszła nowa, odprawa
 * się nie zmienia, więc nie ma powodu płacić za nią przy każdym otwarciu
 * okna. Bufor siedzi w `localStorage` — jest podręczny dla jednej osoby przy
 * jednym komputerze i tyle ma znaczyć.
 */

export interface PreLessonBriefing {
  /** Jedno zdanie: gdzie jesteśmy po ostatnich zajęciach. */
  headline: string;
  /** Co się działo — tematy i zakres ostatnich lekcji. */
  covered: string[];
  /** O czym mówił kursant — jego własne wypowiedzi i tematy. */
  studentVoice: string[];
  /** Słownictwo, które realnie padło. */
  vocabulary: { term: string; note?: string }[];
  /** Co zostało zadane i czy wróciło. */
  homework: string[];
  /** Co się chwieje — błędy powtarzalne. */
  watchOut: string[];
  /** Propozycja na dzisiaj. */
  nextStep: string[];
  /** Model, który to ułożył — do stopki karty. */
  modelUsed?: string;
}

const CACHE_PREFIX = 'pre_lesson_briefing_v1:';

const cacheKey = (studentId: string, lastLessonId: string) =>
  `${CACHE_PREFIX}${studentId}:${lastLessonId}`;

export const readCachedBriefing = (
  studentId: string,
  lastLessonId: string
): PreLessonBriefing | null => {
  try {
    const raw = window.localStorage.getItem(cacheKey(studentId, lastLessonId));
    return raw ? (JSON.parse(raw) as PreLessonBriefing) : null;
  } catch {
    return null;
  }
};

const writeCachedBriefing = (
  studentId: string,
  lastLessonId: string,
  briefing: PreLessonBriefing
): void => {
  try {
    window.localStorage.setItem(cacheKey(studentId, lastLessonId), JSON.stringify(briefing));
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
    `### LEKCJA ${index + 1} — ${lesson.date || 'bez daty'} — „${lesson.topic || 'bez tematu'}"`,
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

const SYSTEM_INSTRUCTION = `Jesteś asystentem lektora języka angielskiego. Dostajesz notatki z maksymalnie trzech ostatnich lekcji jednego kursanta i przygotowujesz ODPRAWĘ, którą lektor czyta minutę przed kolejnymi zajęciami.

ZASADY:
- Piszesz PO POLSKU, zwięźle, w punktach. Żadnych wstępów, podsumowań i uprzejmości.
- Każdy punkt to jedno zdanie, maksymalnie ~120 znaków.
- Terminy angielskie zostawiasz po angielsku.
- Opierasz się WYŁĄCZNIE na notatkach. Niczego nie zmyślasz; jeżeli czegoś nie ma, zwracasz pustą listę.
- Najnowsza lekcja waży najwięcej. Rzeczy powtarzające się w kilku lekcjach wymieniaj jako pierwsze — to one znaczą, że coś wraca.
- W "watchOut" wymieniasz wyłącznie błędy i braki, które WIDAĆ w notatkach.
- W "nextStep" proponujesz 2-4 konkretne ruchy na dzisiejszą lekcję, wynikające z powyższego.

Odpowiadasz WYŁĄCZNIE obiektem JSON o polach:
{
  "headline": string,
  "covered": string[],
  "studentVoice": string[],
  "vocabulary": [{"term": string, "note": string}],
  "homework": string[],
  "watchOut": string[],
  "nextStep": string[]
}
Listy mają po 0-6 pozycji. "vocabulary" do 12 pozycji, "note" to krótkie tłumaczenie lub kontekst.`;

const asStringList = (value: any, limit: number): string[] =>
  Array.isArray(value)
    ? value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, limit)
    : [];

/**
 * Układa odprawę z trzech ostatnich lekcji. `lessons` przychodzą posortowane
 * malejąco po dacie — funkcja bierze trzy pierwsze i sama odwraca kolejność
 * dla modelu, żeby czytał je tak, jak się odbyły.
 */
export const generatePreLessonBriefing = async (
  studentName: string,
  lessons: LessonRecord[],
  options?: { force?: boolean }
): Promise<PreLessonBriefing | null> => {
  const recent = lessons.slice(0, 3);
  if (recent.length === 0) return null;

  const studentId = recent[0].studentId;
  const lastLessonId = recent[0].id;

  if (!options?.force) {
    const cached = readCachedBriefing(studentId, lastLessonId);
    if (cached) return cached;
  }

  const prompt = `Kursant: ${studentName}
Liczba lekcji w materiale: ${recent.length}

${[...recent].reverse().map(lessonToPrompt).join('\n\n')}`;

  const { text, modelUsed } = await generateTextWithUnifiedFallback(
    prompt,
    SYSTEM_INSTRUCTION,
    undefined,
    { responseMimeType: 'application/json' },
    undefined,
    { taskName: 'Odprawa przed lekcją', category: 'stats' }
  );

  const parsed = JSON.parse(extractJSON(text));

  const briefing: PreLessonBriefing = {
    headline: typeof parsed.headline === 'string' ? parsed.headline.trim() : '',
    covered: asStringList(parsed.covered, 6),
    studentVoice: asStringList(parsed.studentVoice, 6),
    vocabulary: Array.isArray(parsed.vocabulary)
      ? parsed.vocabulary
          .map((item: any) => ({
            term: String(item?.term || '').trim(),
            note: item?.note ? String(item.note).trim() : undefined,
          }))
          .filter((item: { term: string }) => item.term.length > 0)
          .slice(0, 12)
      : [],
    homework: asStringList(parsed.homework, 6),
    watchOut: asStringList(parsed.watchOut, 6),
    nextStep: asStringList(parsed.nextStep, 4),
    modelUsed,
  };

  writeCachedBriefing(studentId, lastLessonId, briefing);
  return briefing;
};

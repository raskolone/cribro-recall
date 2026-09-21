import { LessonRecord } from '../types';
import { extractLessonBlocks } from './lessonBlocks';

/**
 * Normalizacja WYŚWIETLANIA tematu/daty lekcji dla lektora.
 *
 * ══ SKĄD SIĘ BIORĄ ZEPSUTE TEMATY ══
 *
 * Import transkrypcji z Notion (`/api/notion/fetch-transcripts` w server.ts)
 * bierze tytuł strony Notion 1:1 jako `topic`. Część spotkań trafia do
 * Notion z tytułem nadanym przez narzędzie do nagrywania (np. „Milena
 * Sesniak — 2026-09-16T06:30:00.000Z"), które dokleja surowy znacznik
 * czasu ISO do imienia kursanta. Taki tytuł zapisuje się jako temat lekcji
 * i wygląda jak zepsuty rekord w UI lektora.
 *
 * Ten moduł NIE zmienia tego, co jest zapisane w Firestore (poza
 * server.ts, gdzie zapobiega zapisaniu takiego tematu na przyszłość) —
 * to warstwa normalizacji na czas wyświetlania.
 *
 * ══ HIERARCHIA WYCIĄGANIA TEMATU (getDisplayLessonTopic) ══
 * 1. `topic` — jeśli to realna treść, a nie surowy znacznik ISO.
 * 2. Pierwsza linijka (maks. 60 znaków) z bloku 1 / podsumowania lekcji —
 *    tam jest prawdziwy temat spotkania wyciągnięty z notatek Notion.
 * 3. Nazwa kursanta/firmy, oczyszczona ze znacznika ISO.
 * 4. Ostateczny fallback: „Lekcja z dnia DD.MM.YYYY”.
 */

/** Fragment wyglądający jak surowa data/czas ISO (np. `2026-09-16T06:30` lub `2026-09-16`). */
const ISO_DATETIME_FRAGMENT = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/;

/** Cały temat to tylko data ISO, bez żadnej innej treści. */
const ONLY_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Wykrywa, czy dany „temat" lekcji jest w rzeczywistości surowym znacznikiem
 * czasu ISO (ewentualnie z doklejonym imieniem/nazwiskiem) — a nie realną
 * treścią tematu wpisaną przez lektora lub wygenerowaną z transkrypcji.
 */
export function isJunkIsoTopic(topic?: string | null): boolean {
  if (!topic) return true;
  const trimmed = topic.trim();
  if (!trimmed) return true;

  // Cały temat to wyłącznie data YYYY-MM-DD.
  if (ONLY_ISO_DATE.test(trimmed)) return true;

  // Temat zawiera znacznik czasu ISO z godziną (np. "Imię Nazwisko - 2026-09-16T06:30:00.000Z").
  // Prawdziwy, sensowny temat lekcji nigdy nie zawiera takiego wzorca.
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return true;

  return false;
}

/**
 * Formatuje datę lekcji jako `DD.MM.YYYY` (polski format dzień-miesiąc-rok).
 * Zwraca `null`, gdy data jest pusta lub nieparsowalna.
 */
export function formatLessonDateDDMMYYYY(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const MAX_TOPIC_LENGTH = 60;

/** Pierwsza linijka tekstu, przycięta do `MAX_TOPIC_LENGTH` znaków (z wielokropkiem, gdy ucięta). */
function firstLineTrimmed(text?: string | null): string {
  if (!text) return '';
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '';
  if (firstLine.length <= MAX_TOPIC_LENGTH) return firstLine;
  return `${firstLine.slice(0, MAX_TOPIC_LENGTH).trim()}…`;
}

/**
 * Czyści imię/nazwę kursanta (lub grupy/firmy) ze sklejonego surowego
 * znacznika czasu ISO doklejonego przez narzędzie do nagrywania spotkań
 * (np. „Dorota Komar-Janiszek (Media Saturn) - 2026-09-16T06:30:00.000Z"
 * → „Dorota Komar-Janiszek (Media Saturn)").
 */
function cleanStudentNameFromIso(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(new RegExp(`[\\s\\-–—]*${ISO_DATETIME_FRAGMENT.source}[\\s\\-–—]*`, 'g'), ' ')
    .trim();
}

/**
 * Podzbiór pól `LessonRecord` potrzebny do wyciągnięcia tematu — celowo węższy
 * niż `Partial<LessonRecord>`, żeby wywołania z sąsiednich, lżejszych typów
 * kart (np. `CloseoutLessonCard`, gdzie `source` to zwykły `string`, nie unia
 * `LessonRecord['source']`) nie wywalały się na niezwiązanych polach.
 */
type LessonTopicSource = Pick<
  LessonRecord,
  | 'topic'
  | 'date'
  | 'lessonSummary'
  | 'studentName'
  | 'structuredBlocks'
  | 'thingsToImprove'
  | 'vocabularyText'
  | 'corrections'
  | 'homeworkText'
  | 'homeworkAnswerKey'
  | 'nextLessonPlan'
  | 'suggestedFollowUp'
  | 'studentSpeaking'
>;

/**
 * Zwraca temat lekcji gotowy do wyświetlenia lektorowi, wg hierarchii:
 * 1. realny `topic` — bez zmian,
 * 2. pierwsza linijka streszczenia lekcji (Blok 1 / `lessonSummary`),
 * 3. nazwa kursanta/grupy oczyszczona ze znacznika ISO,
 * 4. `Lekcja z dnia DD.MM.YYYY` na podstawie prawdziwego pola `date`.
 */
export function getDisplayLessonTopic(
  record: Partial<LessonTopicSource> | null | undefined,
  fallbackStudentName?: string | null
): string {
  const topic = record?.topic?.trim() || '';
  if (topic && !isJunkIsoTopic(topic)) {
    return topic;
  }

  const blocks = extractLessonBlocks((record || {}) as Partial<LessonRecord>);
  const summaryTopic = firstLineTrimmed(blocks.summary || record?.lessonSummary);
  if (summaryTopic && !isJunkIsoTopic(summaryTopic)) {
    return summaryTopic;
  }

  const studentName = cleanStudentNameFromIso(record?.studentName || fallbackStudentName);
  if (studentName) {
    return studentName;
  }

  const formattedDate = formatLessonDateDDMMYYYY(record?.date);
  if (formattedDate) {
    return `Lekcja z dnia ${formattedDate}`;
  }

  return 'Lekcja bez tematu';
}

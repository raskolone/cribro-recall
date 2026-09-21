import { LessonRecord } from '../types';

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

/**
 * Zwraca temat lekcji gotowy do wyświetlenia lektorowi:
 * - realny temat z Notion / wpisany ręcznie — bez zmian,
 * - brakujący lub surowy znacznik ISO — zastąpiony `Lekcja z dnia DD.MM.YYYY`
 *   (na podstawie prawdziwego pola `date` rekordu, nie zepsutego tematu).
 */
export function getDisplayLessonTopic(record: Pick<LessonRecord, 'topic' | 'date'> | null | undefined): string {
  const topic = record?.topic?.trim() || '';

  if (topic && !isJunkIsoTopic(topic)) {
    return topic;
  }

  const formattedDate = formatLessonDateDDMMYYYY(record?.date);
  if (formattedDate) {
    return `Lekcja z dnia ${formattedDate}`;
  }

  return 'Lekcja bez tematu';
}

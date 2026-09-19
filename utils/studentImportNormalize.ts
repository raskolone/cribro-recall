/**
 * Porządkowanie odpowiedzi modelu dla "Smart Student Onboarding".
 *
 * Jak w `utils/lessonImport.ts`: `responseSchema` wymusza kształt tylko dla
 * Gemini, kaskada zaczyna od innego dostawcy przy awarii, więc kształt i tak
 * trzeba sprawdzić u siebie. Logika żyje poza serwerem, żeby dało się ją
 * przetestować bez wołania modelu.
 */

import {
  CefrLevel,
  ParsedLessonImport,
  StudentImportAnalysis,
  StudentImportMissingField,
} from '../types/studentImport';
import { normalizeLessonDate } from './lessonImport';

const asText = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asText).map((s) => s.trim()).filter(Boolean) : [];

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const asCefrLevel = (value: unknown): CefrLevel | undefined => {
  const text = asText(value).trim().toUpperCase();
  return (CEFR_LEVELS as string[]).includes(text) ? (text as CefrLevel) : undefined;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Data lekcji bez roku (np. "15 maja") trafia do `normalizeLessonDate` razem
 * z rokiem bieżącym doklejonym niżej — ale trzeba to oznaczyć jako niepewne,
 * bo model mógł źle zgadnąć rok dla lekcji sprzed 2026 (patrz `dateAmbiguous`
 * w kontrakcie). Sam brak jakiejkolwiek daty jest tu traktowany tak samo.
 */
function normalizeLessonImportDate(rawDate: unknown, today: string): { date: string; ambiguous: boolean } {
  const text = asText(rawDate).trim();
  if (!text) return { date: today, ambiguous: true };

  const hasFourDigitYear = /\b\d{4}\b/.test(text);
  const normalized = normalizeLessonDate(text, today);
  return { date: normalized, ambiguous: !hasFourDigitYear };
}

export function normalizeParsedLessons(payload: unknown, today: string): ParsedLessonImport[] {
  const raw = Array.isArray(payload) ? payload : [];

  return raw
    .filter((lesson: any) => lesson && typeof lesson === 'object')
    .map((lesson: any) => {
      const { date, ambiguous } = normalizeLessonImportDate(lesson.date, today);
      return {
        date,
        dateAmbiguous: Boolean(lesson.dateAmbiguous) || ambiguous,
        summary: asText(lesson.summary).trim(),
        vocabulary: asStringArray(lesson.vocabulary),
        corrections: asStringArray(lesson.corrections),
      };
    })
    .filter(
      (lesson: ParsedLessonImport) =>
        lesson.summary || lesson.vocabulary.length > 0 || lesson.corrections.length > 0
    );
}

/**
 * Buduje ostateczną analizę z surowej odpowiedzi modelu, ustalając samodzielnie
 * `status`/`missingFields` — model bywa niekonsekwentny w ich wyznaczaniu, a to
 * są pola, na których lektor podejmuje decyzję "zatwierdzam / uzupełniam", więc
 * muszą być deterministyczne.
 */
export function normalizeStudentImportAnalysis(payload: any, today: string): StudentImportAnalysis {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const rawExtracted = raw.extractedData && typeof raw.extractedData === 'object' ? raw.extractedData : {};

  const fullName = asText(rawExtracted.fullName).trim() || undefined;
  const emailCandidate = asText(rawExtracted.email).trim().toLowerCase();
  const email = EMAIL_REGEX.test(emailCandidate) ? emailCandidate : undefined;
  const level = asCefrLevel(rawExtracted.level);
  const historicalLessons = normalizeParsedLessons(rawExtracted.historicalLessons, today);

  const missingFields: StudentImportAnalysis['missingFields'] = [];
  if (!fullName) {
    missingFields.push({ field: 'fullName', label: 'Imię i nazwisko kursanta', severity: 'critical' });
  }
  if (!email) {
    missingFields.push({ field: 'email', label: 'Adres e-mail kursanta', severity: 'critical' });
  }
  if (!level) {
    missingFields.push({ field: 'level', label: 'Poziom zaawansowania (CEFR)', severity: 'warning' });
  }
  if (historicalLessons.some((l) => l.dateAmbiguous)) {
    missingFields.push({ field: 'lessonDates', label: 'Niepewne daty lekcji do weryfikacji', severity: 'warning' });
  }

  const hasCritical = missingFields.some((f) => f.severity === 'critical');

  return {
    status: hasCritical ? 'NEEDS_REVIEW' : 'READY',
    extractedData: {
      fullName,
      email,
      level,
      targetGoals: asText(rawExtracted.targetGoals).trim() || undefined,
      industry: asText(rawExtracted.industry).trim() || undefined,
      generalNotes: asText(rawExtracted.generalNotes).trim() || undefined,
      historicalLessons,
    },
    missingFields,
    aiComment: asText(raw.aiComment).trim() || 'Model nie dodał podsumowania.',
  };
}

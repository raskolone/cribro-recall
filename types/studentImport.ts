/**
 * Kontrakt "Smart Student Onboarding" — import kursanta z pliku (.txt/.md/.pdf).
 *
 * `extractedData` celowo nie kopiuje 1:1 pól `User` z `types.ts` (np. `fullName`
 * zamiast `displayName`/`firstName`/`lastName`) — to surowy wynik ekstrakcji AI,
 * mapowany na docelowy dokument dopiero przy zapisie (patrz
 * `components/admin/StudentImportReviewCard.tsx` i miejsce wywołania
 * `handleCreateStudent`). Dzięki temu prompt/model nie musi znać wewnętrznego
 * podziału imię/nazwisko, a walidacja braków działa na jednym, płaskim polu.
 */

export interface ParsedLessonImport {
  /** YYYY-MM-DD. Gdy w źródle brakowało daty, `normalizeStudentImportAnalysis` wstawia dzisiejszą i ustawia `dateAmbiguous`. */
  date: string;
  dateAmbiguous?: boolean;
  summary: string;
  vocabulary: string[];
  corrections: string[];
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface StudentImportExtractedData {
  fullName?: string;
  email?: string;
  level?: CefrLevel;
  targetGoals?: string;
  industry?: string;
  generalNotes?: string;
  historicalLessons: ParsedLessonImport[];
}

export type StudentImportMissingField = 'fullName' | 'email' | 'level' | 'lessonDates';

export interface StudentImportAnalysis {
  status: 'READY' | 'NEEDS_REVIEW';
  extractedData: StudentImportExtractedData;
  missingFields: Array<{
    field: StudentImportMissingField;
    label: string;
    severity: 'critical' | 'warning';
  }>;
  /** Krótkie podsumowanie w 1-2 zdaniach po polsku. */
  aiComment: string;
}

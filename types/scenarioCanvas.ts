/**
 * Kontrakt "Kreator Scenariuszy i Interaktywny Canvas" (MVP).
 *
 * Dopisywany OBOK istniejącego kontraktu `LessonScenario` (types/scenario.ts)
 * jako opcjonalne, wersjonowane pole `scenarioCanvasV2` na rekordzie lekcji.
 * Zero migracji wstecznej: stary dokument bez tego pola nadal otwiera się
 * bez błędu — patrz `hasScenarioCanvasV2` niżej.
 */

import { ScenarioDurationMin, ScenarioMode } from './scenario';

export const CANVAS_BLOCK_IDS = [
  'lesson_goal',
  'warm_up',
  'revision_translation',
  'older_lesson_refresh',
  'grammar_review',
  'main_topic',
  'language_focus',
  'practice_enclosure',
  'homework',
] as const;

export type CanvasBlockId = (typeof CANVAS_BLOCK_IDS)[number];

/** Bloki, które backend może pominąć w konkretnych warunkach (patrz `skipReason`). */
export const CANVAS_OPTIONAL_BLOCK_IDS: readonly CanvasBlockId[] = ['grammar_review', 'older_lesson_refresh'];

export type CanvasItemKind =
  | 'question'
  | 'task'
  | 'note'
  | 'rescue_question'
  | 'wind_down_question';

export type CanvasReviewState = 'pending' | 'accepted' | 'rejected';

export interface CanvasItemReview {
  state: CanvasReviewState;
  rejectionReason: string | null;
}

/** Sposób podania elementu na lekcji — metadane pomocnicze dla lektora, nie sterują logiką. */
export interface CanvasItemDelivery {
  spoken?: boolean;
  written?: boolean;
}

export interface CanvasItem {
  itemId: string;
  kind: CanvasItemKind;
  text: string;
  review: CanvasItemReview;
  delivery: CanvasItemDelivery;
  /** Licznik podmian tego elementu przez Lesson Refresh — startuje od 1. */
  generation: number;
}

export interface CanvasBlock {
  blockId: CanvasBlockId;
  objective: string;
  /** Minuty nadane przez backend z budżetu; 0 dla `lesson_goal` (callout, nie blok czasowy). */
  durationMin: number;
  items: CanvasItem[];
  /** true = blok pominięty (brak gramatyki / cold start) — `items` wtedy puste. */
  skipped: boolean;
  skipReason?: string;
  /** Wyłącznie dla `main_topic`: modele odpowiedzi + prompt ratunkowy (fioletowy panel). */
  teacherNotes?: string[];
}

/** Budżety czasowe (minuty) per blok, dla każdej długości lekcji — suma = durationMin (bez lesson_goal). */
export const CANVAS_DURATION_BUDGETS: Record<ScenarioDurationMin, Record<Exclude<CanvasBlockId, 'lesson_goal'>, number>> = {
  45: {
    warm_up: 4,
    revision_translation: 5,
    older_lesson_refresh: 4,
    grammar_review: 6,
    main_topic: 18,
    language_focus: 4,
    practice_enclosure: 3,
    homework: 1,
  },
  60: {
    warm_up: 5,
    revision_translation: 6,
    older_lesson_refresh: 5,
    grammar_review: 8,
    main_topic: 24,
    language_focus: 6,
    practice_enclosure: 5,
    homework: 1,
  },
  90: {
    warm_up: 7,
    revision_translation: 9,
    older_lesson_refresh: 7,
    grammar_review: 12,
    main_topic: 38,
    language_focus: 9,
    practice_enclosure: 7,
    homework: 1,
  },
};

export interface ScenarioCanvasV2 {
  version: 2;
  canvasId: string;
  studentId: string;
  durationMin: ScenarioDurationMin;
  mode: ScenarioMode;
  /** Rośnie o 1 przy każdym zapisanym Lesson Refresh — chroni przed podwójnym/stale zapisem. */
  revision: number;
  blocks: CanvasBlock[];
  generatedAt: string;
  updatedAt: string;
  /** Ostatni zastosowany mutationId Lesson Refresh — do idempotencji podwójnego kliknięcia. */
  lastMutationId?: string;
}

/** Model (Planner) zwraca treść bloków bez ID/czasów/review — jak w kontrakcie v1. */
export interface CanvasModelItem {
  kind: CanvasItemKind;
  text: string;
}

export interface CanvasModelBlock {
  blockId: CanvasBlockId;
  objective: string;
  items: CanvasModelItem[];
  teacherNotes?: string[];
}

export interface CanvasPlannerOutput {
  blocks: CanvasModelBlock[];
}

/** Auditor zwraca patch po itemId — wyłącznie dla elementów, które chce zamienić. */
export interface CanvasAuditorPatchItem {
  itemId: string;
  text: string;
}

export interface CanvasAuditorOutput {
  patches: CanvasAuditorPatchItem[];
}

/** Lesson Refresh: model dostaje wyłącznie odrzucone ID + uwagi lektora + skrót kontekstu. */
export interface CanvasRefreshModelItem {
  itemId: string;
  kind: CanvasItemKind;
  text: string;
}

export interface CanvasRefreshOutput {
  items: CanvasRefreshModelItem[];
}

export interface GenerateScenarioCanvasRequest {
  studentId: string;
  durationMin: ScenarioDurationMin;
}

export interface GenerateScenarioCanvasResponse {
  canvas: ScenarioCanvasV2;
}

export interface SaveScenarioCanvasRequest {
  studentId: string;
  targetLessonId: string;
  canvas: ScenarioCanvasV2;
}

export interface SaveScenarioCanvasResponse {
  ok: true;
  canvasSavedAt: string;
}

export interface LessonRefreshTeacherNote {
  itemId: string;
  note: string;
}

export interface LessonRefreshRequest {
  studentId: string;
  targetLessonId: string;
  scenarioId: string;
  expectedRevision: number;
  mutationId: string;
  teacherNotes: LessonRefreshTeacherNote[];
}

export interface LessonRefreshResponse {
  ok: true;
  canvas: ScenarioCanvasV2;
}

/** Łatka pól dopisywanych do `users/{studentId}/lessonRecords/{targetLessonId}` przy zapisie. */
export interface LessonRecordScenarioCanvasPatch {
  scenarioCanvasV2: ScenarioCanvasV2;
  scenarioCanvasSavedAt: string;
}

/** Zabezpiecz odczyt: stary dokument bez tego pola nadal otwiera się bez błędu. */
export function hasScenarioCanvasV2(data: any): data is { scenarioCanvasV2: ScenarioCanvasV2 } {
  return !!data && data.scenarioCanvasV2 && typeof data.scenarioCanvasV2 === 'object' && data.scenarioCanvasV2.version === 2;
}

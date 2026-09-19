/**
 * Kontrakt "Generator Scenariusza Lekcji 2.0" (Etap 2.1).
 *
 * Architektura celowo trzyma klienta z dala od Firestore: front wysyła tylko
 * { studentId, durationMin }, a backend (server.ts) sam czyta profil kursanta
 * i ostatnią ukończoną lekcję, ustala tryb (`returning` / `cold_start`) i woła
 * Gemini. Model zwraca wyłącznie treść modułów — bez czasów i bez ID, bo
 * budżety czasowe i identyfikatory nadaje backend z `SCENARIO_DURATION_BUDGETS`,
 * żeby model nie mógł zepsuć matematyki czasu trwania lekcji.
 */

export const SCENARIO_MODULE_IDS = [
  'warmup_followup',
  'error_work',
  'main_topic',
  'wrapup_feedback',
] as const;

export type ScenarioModuleId = (typeof SCENARIO_MODULE_IDS)[number];

export type ScenarioDurationMin = 45 | 60 | 90;

export type ScenarioMode = 'returning' | 'cold_start';

/** Budżety czasowe (w minutach) per moduł, dla każdej z obsługiwanych długości lekcji. */
export const SCENARIO_DURATION_BUDGETS: Record<ScenarioDurationMin, Record<ScenarioModuleId, number>> = {
  45: {
    warmup_followup: 5,
    error_work: 10,
    main_topic: 25,
    wrapup_feedback: 5,
  },
  60: {
    warmup_followup: 8,
    error_work: 12,
    main_topic: 32,
    wrapup_feedback: 8,
  },
  90: {
    warmup_followup: 10,
    error_work: 18,
    main_topic: 50,
    wrapup_feedback: 12,
  },
};

/** Wejście z klienta — nic więcej. Klient nie czyta Firestore przed wywołaniem AI. */
export interface GenerateScenarioRequest {
  studentId: string;
  durationMin: ScenarioDurationMin;
}

/** Pojedynczy punkt modułu, tak jak zwraca go model — bez ID. */
export interface ScenarioModelItem {
  text: string;
}

/** Moduł tak jak zwraca go model — bez czasu trwania i bez ID. */
export interface ScenarioModelModule {
  moduleId: ScenarioModuleId;
  objective: string;
  items: ScenarioModelItem[];
  /**
   * Wskazówki ratunkowe dla lektora (rescue prompts) — wyłącznie dla modułu
   * "main_topic": alternatywne, prostsze pytania na wypadek, gdy kursant
   * odpowie jednym słowem lub utknie na temacie.
   */
  teacherNotes?: string[];
}

/** Dokładnie to, co ma zwrócić Gemini: 4 moduły w stałej kolejności, bez metadanych czasowych. */
export interface ScenarioModelOutput {
  modules: ScenarioModelModule[];
}

/** Punkt modułu po stronie backendu/klienta — z nadanym ID i flagą edycji lektora. */
export interface ScenarioItem {
  id: string;
  text: string;
  editedByTeacher?: boolean;
}

/** Moduł po wzbogaceniu przez backend: czas z budżetu, ID punktów. */
export interface ScenarioModule {
  moduleId: ScenarioModuleId;
  objective: string;
  durationMin: number;
  items: ScenarioItem[];
  /** Patrz `ScenarioModelModule.teacherNotes` — przepisane bez zmian z modelu. */
  teacherNotes?: string[];
}

export interface LessonScenario {
  id: string;
  studentId: string;
  durationMin: ScenarioDurationMin;
  mode: ScenarioMode;
  modules: ScenarioModule[];
  generatedAt: string;
}

export interface GenerateScenarioResponse {
  scenario: LessonScenario;
}

export interface SaveScenarioRequest {
  studentId: string;
  targetLessonId: string;
  scenario: LessonScenario;
}

export interface SaveScenarioResponse {
  ok: true;
  scenarioSavedAt: string;
}

/** Łatka pól dopisywanych do `users/{studentId}/lessonRecords/{targetLessonId}` przy zapisie. */
export interface LessonRecordScenarioPatch {
  plannedScenario: LessonScenario;
  scenarioSavedAt: string;
}

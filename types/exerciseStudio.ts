/**
 * CRIBRO Recall — Exercise Studio Types & Data Models
 *
 * Wspólny interfejs definicji ćwiczeń dla Exercise Studio oraz Lesson Canvas.
 */

export type ExerciseStudioType =
  | 'random_wheel'
  | 'sentence_scramble'
  | 'matching_pairs'
  | 'random_cards'
  | 'multiple_choice';

export type ExerciseType = ExerciseStudioType;

export type ExerciseStatus = 'draft' | 'ready' | 'archived';

export interface ExerciseDefinition<TPayload = any> {
  id: string;
  title: string;
  type: ExerciseStudioType;
  cefr?: string;
  language?: string;
  sourceLessonId?: string;
  sourceLessonIdeaId?: string;
  targetLanguage?: string[];
  instructions?: string;
  payload: TPayload;
  status: ExerciseStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** Element / segment koła fortuny */
export interface WheelItem {
  id: string;
  label: string;
  prompt?: string;
  category?: string;
  colorToken?: string;
  used?: boolean;
}

/** Payload konfiguracji koła fortuny w Exercise Studio */
export interface RandomWheelPayload {
  items: WheelItem[];
  removeOnHit?: boolean;
  spinDuration?: number;
  questionSource?: 'custom' | 'scenario' | 'past_lessons';
  title?: string;
}

/** Placeholder payload dla pozostałych typów w rejestrze */
export interface SentenceScramblePayload {
  sentences: { id: string; original: string; promptPl?: string; scrambled?: string[] }[];
}

export interface MatchingPairsPayload {
  pairs: { id: string; left: string; right: string; category?: string }[];
}

export interface RandomCardsPayload {
  cards: { id: string; front: string; back?: string; prompt?: string; category?: string }[];
}

export interface MultipleChoicePayload {
  questions: { id: string; question: string; options: string[]; correctIndex: number; explanation?: string }[];
}

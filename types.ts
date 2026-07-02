
export type Language = 'English' | 'Spanish' | 'French' | 'Dutch';
export type Difficulty = 'A1-A2' | 'B1-B2' | 'C1-C2';
export type RevisionFrequency = 'Daily' | 'Weekly' | 'Monthly';
export type ExerciseType = 'flashcards' | 'quiz' | 'fill-in-the-blank' | 'match';

export interface User {
  id?: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  photoURL?: string;
  streakCount?: number;
  lastStreakDate?: string;
  loginCount?: number;
  lastLoginDate?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  level?: string;
  description?: string;
}

export interface WordSet {
  id: string;
  name: string;
  description: string;
  language?: Language;
  createdAt: string;
}

export interface Word {
  id: string;
  word: string;
  ipa: string;
  definition: string;
  example: string;
  language: Language;
  isDifficult: boolean;
  setId?: string;
  // Spaced Repetition Fields
  nextReviewDate?: string;
  repetitionLevel?: number; // 0, 1, 2, 3, 4
}

export interface AISuggestion {
  paragraph: string;
  wordSuggestions: Array<{
    word: string;
    synonym: string;
    antonym: string;
  }>;
}

export interface PracticeHistory {
  lastExerciseType: ExerciseType;
  lastPracticeDate: string;
}

export interface PracticeLog {
  id: string;
  exerciseType: ExerciseType;
  date: string;
  isRevisionMode: boolean;
  score?: number;
  totalWords?: number;
}

// New Flashcard Module Types
export interface FlashcardSet {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  cardCount: number;
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
  assignedByTeacher?: boolean;
  isLessonVocabulary?: boolean;
  lessonDate?: string;
  lessonTopic?: string;
}

export interface Flashcard {
  id: string;
  position: number;
  term: string;
  termLanguage: string;
  definition: string;
  definitionLanguage: string;
  contextSentence?: string;
  contextTranslation?: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  createdAt: any; // Timestamp
  isLocked?: boolean;
}

export interface StudySession {
  id: string;
  userId: string;
  setId: string;
  mode: string;
  scorePercent: number;
  totalCards: number;
  correctCount: number;
  completedAt: any; // Timestamp
}

export interface SessionResult {
  id: string;
  flashcardId: string;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface AISuggestionCache {
  id: string;
  term: string;
  sourceLanguage: string;
  targetLanguage: string;
  suggestedDefinition: string;
  createdAt: any; // Timestamp
}

export interface AudioVocabulary {
  targetWord: string;
  translation: string;
  contextSentence: string;
}

export interface TranslationExercise {
  polishSentence: string;
  englishTranslation: string;
  hint?: string;
}

export interface TranslationEvaluationResult {
  polishSentence: string;
  correctTranslation: string;
  studentAnswer: string;
  isCorrect: boolean;
  score: number;
  explanation: string;
}

export interface LessonRecord {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  words: string;
  summary: string;
  createdAt: any;
}


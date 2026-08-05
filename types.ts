
export type Language = 'English' | 'Spanish' | 'French' | 'Dutch';
export type Difficulty = 'A1-A2' | 'B1-B2' | 'C1-C2';
export type RevisionFrequency = 'Daily' | 'Weekly' | 'Monthly';
export type ExerciseType = 'intro' | 'flashcards' | 'quiz' | 'fill-in-the-blank' | 'match' | 'ai_translation';

export interface User {
  id?: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'teacher';
  photoURL?: string;
  displayName?: string;
  name?: string;
  streakCount?: number;
  translatedSentencesCount?: number;
  requirePasswordChange?: boolean;
  lastStreakDate?: string;
  loginCount?: number;
  dismissedNotifications?: string[];
  lastLoginDate?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  level?: string;
  hasNewVocabulary?: boolean;
  hasNewLesson?: boolean;
  adminMessage?: { title: string; text: string; createdAt: string; } | null;
  description?: string;
  aiPrompt?: string;
  isSuspended?: boolean;
  tempPasswordLogins?: number;
  onboardingCompleted?: boolean;
  tempPassword?: string;
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
  sentences?: any[];
  id: string;
  exerciseType: ExerciseType;
  date: string;
  isRevisionMode?: boolean;
  score?: number;
  totalWords?: number;
  testName?: string;
  exercisesData?: TranslationEvaluationResult[] | string | any;
  detailedFeedback?: TranslationEvaluationResult[] | any[];
  exerciseFormat?: string;
  practiceMode?: string;
  selectedSetId?: string;
  setDisplayName?: string;
  wordsUsed?: string[];
}

// New Flashcard Module Types
export interface FlashcardSet {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  cardCount: number;
  words?: any[];
  cards?: any[];
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
  assignedByTeacher?: boolean;
  isLessonVocabulary?: boolean;
  isGeneral?: boolean;
  lessonNumber?: number;
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

export interface FlashcardProgress {
  id?: string;
  flashcardId: string;
  userId: string;
  setId: string;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewedAt: string;
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
  puzzleChunks?: string[];
  modelUsed?: string;
}

export interface TranslationEvaluationResult {
  polishSentence: string;
  correctTranslation: string;
  studentAnswer: string;
  highlightedAnswer?: string;
  isCorrect: boolean;
  score: number;
  explanation: string;
  suggested_better_version?: string;
  highlighted_better_version?: string;
  breakdown?: {
    meaning_score: number;
    grammar_score: number;
    vocabulary_score: number;
  };
  feedbackSyntax?: string;
  feedbackVocab?: string;
  feedbackRule?: string;
  mistakes?: string[];
  modelUsed?: string;
}

export interface LessonRecord {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  vocabularyText: string;
  lessonSummary?: string;
  studentSpeaking?: string;
  thingsToImprove?: string;
  suggestedFollowUp?: string;
  vocabularySetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularySet {
  id: string;
  studentId: string;
  lessonRecordId: string;
  title: string;
  date: string;
  topic: string;
  vocabularyText: string;
  itemCount: number;
  status: "draft" | "ready";
  source: "lesson_record";
  createdAt: string;
  updatedAt: string;
  used?: boolean;
}


export type TestQuestionType = 'multiple_choice' | 'fill_in_blank' | 'fill_in_blank_bank' | 'translation' | 'matching' | 'writing' | 'find_mistake';

export interface TestQuestion {
  id: string;
  type: TestQuestionType;
  instruction?: string;
  prompt: string; // The question or sentence to translate
  options?: string[]; // For multiple choice or matching
  wordBank?: string[]; // For fill in blank bank
  correctAnswer: string; 
  hint?: string;
  puzzleChunks?: string[];
}

export interface ErrorCorrectionExercise {
  incorrectSentence: string;
  correctSentence: string;
  explanation?: string;
  hint?: string;
}

export type HomeworkType = 'translation' | 'find_errors';

export interface SpecialTask {
  id?: string;
  studentId: string;
  studentName?: string;
  assignedBy?: string;
  title: string;
  type?: HomeworkType;
  instructions?: string;
  createdAt: string;
  dueDate?: string;
  status: 'pending' | 'submitted' | 'completed' | 'graded';
  sentences: any[];
  studentAnswers?: Record<number, string> | Record<string, string>;
  evaluationResults?: any[];
  submittedAt?: string;
  teacherFeedback?: string;
  grade?: number;
}

export interface StudentTest {
  id?: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  title: string;
  scope: string; // Zakres materiału
  instructions?: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'graded';
  questions: TestQuestion[];
  score?: number;
  maxScore?: number;
  attemptsLimit?: number;
  attemptsUsed?: number;
  studentAnswers?: Record<string, string>;
  aiFeedback?: string; // Map of questionId to student's answer
  teacherRead?: boolean;
}

export interface BugReport {
  id?: string;
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
  description: string;
  errorContext?: string;
  path?: string;
  status: 'new' | 'investigating' | 'resolved';
  createdAt: string;
}


export type Language = 'English' | 'Spanish' | 'French' | 'Dutch';
export type Difficulty = 'A1-A2' | 'B1-B2' | 'C1-C2';
export type RevisionFrequency = 'Daily' | 'Weekly' | 'Monthly';
export type ExerciseType = 'intro' | 'flashcards' | 'quiz' | 'fill-in-the-blank' | 'match' | 'ai_translation';

export type TTSAccent = 'en-US' | 'en-GB' | 'AmE' | 'BrE';
export type VoiceGender = 'male' | 'female';
export type SoundEngine = 'auto' | 'openai' | 'gpt4o-mini' | 'gemini' | 'browser';
export type VoiceSpeed = 0.75 | 0.85 | 1.0 | 1.15;

export interface SoundSettings {
  ttsAccent: TTSAccent;
  voiceGender: VoiceGender;
  voiceSpeed: VoiceSpeed;
  soundEngine: SoundEngine;
  autoPlaySentence: boolean;
  autoPlayFlashcards: boolean;
  soundEffectsEnabled: boolean;
}

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
  hasNewHomework?: boolean;
  adminMessage?: { title: string; text: string; createdAt: string; } | null;
  description?: string;
  aiPrompt?: string;
  isSuspended?: boolean;
  tempPasswordLogins?: number;
  frequentErrors?: any[];
  onboardingCompleted?: boolean;
  tempPassword?: string;
  showAiMonitor?: boolean;
  canViewAiMonitor?: boolean;
  soundSettings?: SoundSettings;
  ttsAccent?: TTSAccent;
  voiceGender?: VoiceGender;
  voiceSpeed?: VoiceSpeed;
  soundEngine?: SoundEngine;
  autoPlaySentence?: boolean;
  autoPlayFlashcards?: boolean;
}

/**
 * Checks if the user is authorized to view AI model names and the AI Live Monitor.
 * Admins always have access by default.
 * Regular students only have access if explicitly enabled by an admin in their profile.
 */
export const canUserViewAiMonitor = (user?: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.showAiMonitor || user.canViewAiMonitor);
};

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
  isDraft?: boolean;
  cardCount: number;
  words?: any[];
  cards?: any[];
  flashcards?: any[];
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

export interface LessonScenarioStage {
  id: string;
  title: string;
  duration?: string;
  body: string;
}

export interface GeneratedLessonScenario {
  id: string;
  title: string;
  topic: string;
  content: string;
  studentId?: string | null;
  studentName?: string | null;
  targetLevel?: string;
  lessonDuration?: string;
  lessonType?: string;
  vocabularyText?: string;
  stages?: LessonScenarioStage[];
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
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
  scenarioId?: string;
  scenarioTopic?: string;
  scenarioContent?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecallLearningType =
  | 'fraza'
  | 'kolokacja'
  | 'gramatyka'
  | 'wymowa'
  | 'funkcja'
  | 'korekta';

export type RecallApprovalStatus = 'draft' | 'approved' | 'archived';

/** Wynik jednej próby przypomnienia sobie elementu. */
export type RetrievalResult = 'fail' | 'effort' | 'confident';

export interface RetrievalAttempt {
  /** ISO, dzień próby. */
  date: string;
  result: RetrievalResult;
  /** ISO, kiedy element wraca do kolejki. */
  nextDueAt: string;
}

/**
 * Jeden konkretny element do zapamiętania — nie wpis lekcji, nie zestaw słówek.
 *
 * To jest jedyne źródło materiału do powtórek. Elementy powstają wyłącznie
 * w momencie zapisu lekcji (szkic AI → zatwierdzenie lektora); nic nie tworzy
 * ich „w locie" przy otwarciu panelu kursanta.
 */
export interface RecallItem {
  id: string;
  studentId: string;
  /** Lekcja źródłowa — kontekst, z którego element pochodzi. */
  lessonId: string;
  targetForm: string;
  meaningOrFunction: string;
  learningType: RecallLearningType;
  /** Wyjątek metodyczny kontrolowany przez lektora. */
  teacherNote?: string;
  approvalStatus: RecallApprovalStatus;
  retrievalHistory: RetrievalAttempt[];
  /**
   * Kopia `nextDueAt` z ostatniej próby, wyciągnięta na wierzch dokumentu.
   * Firestore nie potrafi filtrować po polu wewnątrz tablicy, więc bez tego
   * kolejka „na dziś" wymagałaby ściągnięcia wszystkich elementów kursanta.
   */
  nextDueAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Kandydat ze szkicu AI, zanim stanie się dokumentem w bazie. */
export interface RecallCandidate {
  targetForm: string;
  meaningOrFunction: string;
  learningType: RecallLearningType;
  teacherNote?: string;
}

export interface VocabularySet {
  id: string;
  studentId: string;
  lessonRecordId: string;
  title: string;
  date: string;
  topic: string;
  vocabularyText: string;
  /**
   * Pozycje zatwierdzone po lekcji — to z nich, i tylko z nich, biorą się
   * powtórki. Puste albo brak pola znaczy „wszystko z `vocabularyText`":
   * tak zachowują się zestawy sprzed wprowadzenia zatwierdzania oraz te
   * odtwarzane ze starych `lessonRecords`.
   */
  approvedItems?: string[];
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

export type HomeworkType = 'translation' | 'find_errors' | 'fill_in_the_blank';

export interface FillInTheBlankExercise {
  sentenceWithBlank?: string;
  missingWord?: string;
  fullSentence?: string;
  textWithBlanks?: string;
  blanks?: Record<string, string>;
  availableWords?: string[];
  hint?: string;
}

export interface SpecialTask {
  id?: string;
  /**
   * UID konta, do którego zadanie należy — pole rozstrzygające dla reguł
   * Firestore i dla zapytań kursanta (patrz utils/homework.ts). `studentId`
   * zostaje dla zgodności ze starszymi widokami.
   */
  studentUid?: string;
  studentId: string;
  studentName?: string;
  /** Znacznik wysłania powiadomienia e-mail, zapisywany przez Cloud Function. */
  notificationSentAt?: any;
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

export interface LessonModuleConfig {
  id: string;
  order: number;
  title: string;
  duration?: string;
  placeholderInstruction: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface LessonPlanPreset {
  id: string;
  name: string;
  description: string;
  defaultDuration: string;
  modules: LessonModuleConfig[];
  customPrompt?: string;
  isCustom?: boolean;
}

export interface LessonPlannerCustomSettings {
  customPrompt: string;
  englishVariety: 'any' | 'british' | 'american';
  explanationStyle: 'concise' | 'detailed';
  homeworkType: 'translation' | 'writing' | 'speaking' | 'mixed';
  vocabCount: number;
}

export type PresentationSlideType = 
  | 'title' 
  | 'warmup' 
  | 'vocabulary' 
  | 'grammar' 
  | 'speaking' 
  | 'practice' 
  | 'enclosure' 
  | 'correction' 
  | 'summary' 
  | 'freeform';

export interface PresentationExerciseOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface PresentationSlideItem {
  id: string;
  term?: string;
  ipa?: string;
  definition?: string;
  example?: string;
  question?: string;
  errorText?: string;
  correctionText?: string;
  explanation?: string;
  hint?: string;
  answer?: string;
  revealed?: boolean;
  // Interactive exercise extensions
  exerciseType?: 'fill-gap' | 'transform' | 'multiple-choice' | 'matching' | 'roleplay' | 'qa';
  options?: string[];
  correctOptionIndex?: number;
  // Role-play extensions
  roleUser?: string;
  roleTeacher?: string;
  scenarioContext?: string;
  taskGoal?: string;
}

export interface PresentationSlide {
  id: string;
  type: PresentationSlideType;
  title: string;
  subtitle?: string;
  content?: string;
  items?: PresentationSlideItem[];
  timerMinutes?: number;
  speakerNotes?: string;
  bgTheme?: 'dark' | 'midnight' | 'emerald' | 'amber' | 'clean-light';
  // Enclosure and pedagogical metrics
  quickCheck?: Array<{ question: string; answer: string; hint?: string }>;
  exitTicketChallenge?: string;
  aiModelUsed?: string;
}

export interface LiveCorrectionItem {
  id: string;
  studentSaid: string;
  betterWay: string;
  explanation?: string;
  timestamp: string;
}

export interface LiveVocabItem {
  id: string;
  term: string;
  translation: string;
  example?: string;
  timestamp: string;
}

export interface LessonPresentation {
  id: string;
  title: string;
  topic: string;
  targetLevel?: string;
  studentId?: string | null;
  studentName?: string | null;
  slides: PresentationSlide[];
  liveCorrections: LiveCorrectionItem[];
  liveVocab: LiveVocabItem[];
  liveNotes: string;
  aiModelUsed?: string;
  createdAt: string;
  updatedAt: string;
}

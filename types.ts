
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
  hasGradedHomework?: boolean;
  lastGradedHomeworkId?: string;
  lastGradedHomeworkTitle?: string;
  lastGradedFeedback?: string;
  lastGradedScore?: number;
  adminMessage?: { title: string; text: string; createdAt: string; } | null;
  description?: string;
  aiPrompt?: string;
  isSuspended?: boolean;
  /**
   * Zakończona współpraca. Konto i cała historia zostają nietknięte, znika
   * tylko z list w panelu — inaczej niż `isSuspended`, które odbiera dostęp
   * komuś, kto nadal jest kursantem.
   */
  isArchived?: boolean;
  archivedAt?: string;
  notionPageId?: string;
  tempPasswordLogins?: number;
  frequentErrors?: any[];
  onboardingCompleted?: boolean;
  /** Kursant odrzucił sugestię zmiany hasła tymczasowego. Banner nie pojawi się ponownie. */
  passwordChangeDismissed?: boolean;
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
  /** Ukrywa ikonę passy w panelu kursanta. Passa sama w sobie liczy się dalej. */
  streakHidden?: boolean;
  /** Wyłączenie powiadomień e-mail o zadaniach i przypomnieniach (Resend). */
  emailNotificationsDisabled?: boolean;
  unsubscribedAt?: string;
  /** Data i godzina ostatniego wysłania zaproszenia do aplikacji z danymi logowania. */
  lastInviteSentAt?: string;
  /** Adres lektora, który wysłał zaproszenie. */
  inviteSentBy?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'homework' | 'reminder' | 'feedback' | 'lesson' | 'welcome';
  subject: string;
  description: string;
  status: 'active' | 'draft';
  variables: string[];
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

export interface LessonAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'markdown' | 'html' | 'text' | 'audio';
  size: number;
  mimeType: string;
  dataUrl?: string;
  textContent?: string;
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
  isTemplate?: boolean;
  category?: string;
  sourceFiles?: string[];
  attachments?: LessonAttachment[];
}

export interface LessonBlocks {
  /** BLOK 1: Lekcja w skrócie (Overview / Context / Revision Notes) */
  summary: string;
  /** BLOK 2a: Key Language (Słownictwo do powtórek / hasło - tłumaczenie) */
  vocabulary: string;
  /** BLOK 2b: Corrections & Pronunciation (Korekty językowe, błędy z lekcji) */
  corrections: string;
  /** BLOK 3: Homework — Cribro Habit (Zdania do tłumaczenia, zadania) */
  homework: string;
  /** BLOK 3: Klucz odpowiedzi do zadania domowego (Answer Key) */
  answerKey?: string;
  /** BLOK 4: Next Lesson (Plan i cele na kolejną lekcję) */
  nextLesson: string;
  /** Learning Curve / Kontekst wypowiedzi kursanta */
  learningCurve?: string;
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
  /** BLOK 2b: Wyodrębnione korekty gramatyczne i wymowa */
  corrections?: string;
  /** BLOK 3: Wyodrębniona treść pracy domowej / zdania z lekcji */
  homeworkText?: string;
  /** BLOK 3: Klucz odpowiedzi do pracy domowej */
  homeworkAnswerKey?: string;
  /** BLOK 4: Wyodrębniony plan na kolejną lekcję */
  nextLessonPlan?: string;
  /** Elastyczny obiekt bloków ułatwiający renderowanie i eksport */
  structuredBlocks?: LessonBlocks;
  /** Status weryfikacji lekcji: 'confirmed' (widoczna dla ucznia) | 'pending_confirmation' (wymaga zatwierdzenia przez lektora) | 'rejected' (odrzucona) */
  status?: 'confirmed' | 'pending_confirmation' | 'rejected';
  /** Flaga oznaczająca lekcję oczekującą na manualny przegląd lektora */
  isPendingConfirmation?: boolean;
  /** Powód wymagania potwierdzenia (np. 'Brak daty spotkania w Notion', 'Wybrakowane podsumowanie') */
  pendingReason?: string;
  /** Czy data została wykryta, czy jest brakująca w Notion */
  isDateMissing?: boolean;
  /** Źródło pochodzenia rekordu */
  source?: 'notion' | 'manual' | 'ai';
  /** Identyfikator strony Notion */
  notionPageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RejectedNotionItem {
  id: string; // notionPageId
  studentId: string;
  topic: string;
  date?: string;
  rejectedAt: string;
  reason?: string;
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
  /**
   * Poziom ćwiczenia tłumaczenia — ustawia go LEKTOR przy układaniu testu.
   *
   * `hard` (domyślny) to wpisywanie z pamięci, `easy` to układanka z gotowych
   * fragmentów. W teście kursant nie ma prawa tego zmieniać: test ma sprawdzać
   * opanowanie, a nie to, na jaki tryb kursant miał ochotę. W pracy domowej
   * wybór kursanta jest w porządku — tam chodzi o naukę, nie o pomiar.
   */
  difficulty?: 'easy' | 'hard';
}

export interface ErrorCorrectionExercise {
  type?: HomeworkType;
  incorrectSentence: string;
  correctSentence: string;
  explanation?: string;
  hint?: string;
  polishHint?: string;
}

/**
 * Rodzaje pracy domowej.
 *
 * `word_order` i `multiple_choice` są dopisane pod telefon: rozwiązuje się je
 * samym dotykiem, bez klawiatury, i sprawdzają się deterministycznie — kursant
 * zna wynik od razu, bez czekania na ocenę modelu.
 */
export type HomeworkType =
  | 'translation'
  | 'find_errors'
  | 'fill_in_the_blank'
  | 'word_order'
  | 'multiple_choice';

/** Ułóż zdanie z rozsypanych fragmentów. */
export interface WordOrderExercise {
  /** Fragmenty w kolejności do pokazania — już przetasowane. */
  chunks: string[];
  /** Poprawna kolejność jako gotowe zdanie; po niej sprawdzamy odpowiedź. */
  correctSentence: string;
  /** Polskie znaczenie, żeby zadanie miało sens, a nie było układanką liter. */
  polishHint?: string;
}

/** Wybór poprawnej formy spośród kilku. */
export interface MultipleChoiceExercise {
  /** Zdanie z luką „___" albo pytanie. */
  question: string;
  options: string[];
  /** Indeks poprawnej opcji w `options`. */
  correctIndex: number;
  /** Dlaczego ta, a nie tamta — pokazujemy po odpowiedzi. */
  explanation?: string;
}

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
  reviewedAt?: string;
  feedbackReadByStudent?: boolean;
  teacherRead?: boolean;
  teacherViewedAt?: string;
  studentViewedAt?: string;
  // Direct Access Link (Magic Link) properties
  accessToken?: string;
  accessExpiresAt?: string;
  accessUrl?: string;
  submittedViaDirectLink?: boolean;
  /**
   * Silnik v2 (`functions/src/homeworkV2`). Ocena i feedback żyją w
   * subkolekcji `attempts`, nie w tym dokumencie — patrz
   * `services/homeworkV2/contracts.ts`.
   */
  engineVersion?: number;
  teacherId?: string;
  /** Ustawiane ręcznie z ekranu przeglądu v2 — werdyktu AI nie da się zmienić. */
  teacherReviewedAt?: string;
  teacherReviewNote?: string;
}

export interface InboundMessage {
  id?: string;
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  studentId?: string;
  studentName?: string;
  subject: string;
  text: string;
  html?: string;
  receivedAt: string;
  read: boolean;
  archived?: boolean;
}

export interface MailingSettings {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  emailSignature: string;
  enableHomeworkAssigned: boolean;
  enableHomeworkReviewed: boolean;
  enableDueDateReminder: boolean;
  reminderHoursBefore: number;
  enableNotionSyncNotice: boolean;
  enableBccSender?: boolean;
  bccEmail?: string;
  resendApiKey?: string;
  customTemplates?: Record<string, { subject?: string; customIntro?: string; enabled?: boolean }>;
  updatedAt?: string;
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
  | 'toc'
  | 'warmup' 
  | 'vocabulary' 
  | 'grammar' 
  | 'speaking' 
  | 'listening'
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
  imageUrl?: string;
  audioUrl?: string;
  audioName?: string;
  sectionTag?: string;
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

export interface LiveSessionStudent {
  id: string;
  name: string;
  joinedAt: string;
  lastSeenAt: string;
}

export interface LiveSession {
  /** Kod PIN sesji (np. 6 znaków alfanumerycznych, np. "482190" lub "ABC123") */
  pin: string;
  sessionId: string;
  teacherUid: string;
  teacherName: string;
  deckTitle: string;
  deck: LessonPresentation;
  currentSlideIndex: number;
  totalSlides: number;
  /**
   * Co lektor odkrył i podświetlił na slajdzie.
   */
  interaction: {
    revealedAnswers: Record<string, boolean>;
    highlightedItemId: string | null;
    randomQuestionIndex: number | null;
  };
  /** Rysunek z tablicy lektora wraz z rozmiarem płótna */
  whiteboard?: {
    shapes: any[];
    width: number;
    height: number;
  } | null;
  /** Znacznik czasu zakończenia odliczania */
  timerEndsAt?: number | null;
  /** Słownictwo i błędy notowane na bieżąco */
  liveNotebook?: {
    vocab: LiveVocabItem[];
    corrections: LiveCorrectionItem[];
  } | null;
  /** Pozycja wskaźnika laserowego lektora */
  laserPos?: {
    x: number;
    y: number;
    active: boolean;
  } | null;
  status: 'active' | 'ended';
  createdAt: string;
  updatedAt: string;
  connectedStudents: LiveSessionStudent[];
  revision: number;
}


/**
 * Test otwarty — dla kandydatów, których nie ma jeszcze w bazie.
 *
 * Nie jest przypisany do żadnego konta, więc żyje w kolekcji głównej, a nie pod
 * `users/{id}/tests`. Wejściem jest krótki kod, który lektor podaje kandydatowi:
 * dokument ma ten kod jako własne id, dzięki czemu otwarcie testu to jeden
 * odczyt po znanym adresie, bez przeszukiwania kolekcji.
 */
export interface PublicTest {
  /** Kod dostępu — jednocześnie id dokumentu. */
  id: string;
  title: string;
  /** Zakres materiału, na podstawie którego powstał test. */
  scope: string;
  instructions?: string;
  questions: TestQuestion[];
  /** UID lektora, który wystawił test. */
  createdBy: string;
  createdAt: string;
  /** Wyłączony test nie przyjmuje nowych podejść, ale wyniki zostają. */
  isActive: boolean;
  /** Po tej dacie test przestaje wpuszczać. Puste — bez terminu. */
  expiresAt?: string;
  /** Ilu kandydatów już podeszło — licznik do listy lektora. */
  submissionCount?: number;
}

/** Jedno podejście kandydata do testu otwartego. */
export interface PublicTestSubmission {
  id?: string;
  candidateName: string;
  candidateEmail?: string;
  answers: Record<string, string>;
  score?: number;
  maxScore?: number;
  /** Poziom oszacowany po wyniku — to po niego sięga lektor. */
  estimatedLevel?: string;
  aiFeedback?: string;
  submittedAt: string;
}

/**
 * Współdzielony dokument brudnopisu (Scratchpad / Google Docs dla lekcji).
 * Zapewnia trwały, żywy dokument powiązany z kursem lub profilem kursanta,
 * do którego lektor i uczeń mają dostęp w czasie rzeczywistym przez link lub kod PIN.
 */
export interface ScratchpadDocument {
  id: string;
  pin: string;
  studentId?: string | null;
  studentName: string;
  teacherUid: string;
  teacherName: string;
  title: string;
  contentHtml: string;
  contentText: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy?: {
    uid: string;
    name: string;
    role: 'teacher' | 'student';
  };
  allowStudentEdit: boolean;
  requirePin?: boolean;
  version: number;
  /**
   * Ustawione, gdy Firestore odmówił zapisu i notatnik żyje wyłącznie w tej
   * przeglądarce. Nie jest zapisywane w chmurze — służy do ostrzeżenia
   * lektora, zanim wyśle kursantowi link, który po drugiej stronie okaże się
   * pusty.
   */
  cloudBlockedReason?: string;
}


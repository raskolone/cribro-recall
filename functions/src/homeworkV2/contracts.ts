/**
 * Zamrożone kontrakty silnika prac domowych v2.
 *
 * Ten plik jest jedynym źródłem prawdy dla rubryki, drabinki podpowiedzi,
 * progów i kształtu zadania. Leży w pakiecie `functions/`, bo to Cloud
 * Functions wystawia oceny, a `functions/tsconfig.json` kompiluje wyłącznie
 * `src` — plik trzymany w katalogu głównym repo nie wszedłby do wdrożenia.
 * Aplikacja sięga po niego przez `services/homeworkV2/contracts.ts`.
 *
 * Plik celowo niczego nie importuje — dokładnie z tego samego powodu, co
 * `services/aiModels.ts`: wchodzi zarówno do bundla przeglądarki, jak i do
 * pakietu Cloud Functions, a te dwa mają inne moduły, inny target i inne
 * `node_modules`.
 *
 * „Zamrożone" znaczy tu jedno: wartości poniżej wynikają z decyzji
 * produktowych z 12.09.2026 (kanoniczna specyfikacja silnika v2, §3.1 i §18),
 * a nie z wygody implementacji. Zmiana którejkolwiek z nich zmienia ocenę
 * odpowiedzi, które już zapadły — dlatego każde zadanie zapisuje
 * `schemaVersion`, a nie odwołuje się do „aktualnej" rubryki.
 */

// ---------------------------------------------------------------------------
// Wersjonowanie
// ---------------------------------------------------------------------------

/** Silnik, który wystawił zadanie. Odróżnia dokumenty v2 od zestawów v1. */
export const ENGINE_VERSION = 2 as const;

/**
 * Wersja kształtu danych. Rośnie przy każdej zmianie pól kontraktu.
 *
 * Zadanie zapisuje swoją wersję i zostaje przy niej na zawsze: próba oceniona
 * rubryką 2.0.0 nie może zostać przeliczona rubryką 2.1.0, bo kursant dostałby
 * inny wynik za tę samą odpowiedź.
 */
export const SCHEMA_VERSION = '2.0.0';

/**
 * Wersja zestawu promptów. Rośnie, gdy zmienia się treść instrukcji dla modelu.
 *
 * Osobno od `SCHEMA_VERSION`, bo prompt zmienia się częściej niż kształt danych
 * i sam w sobie nie unieważnia zapisanych odpowiedzi — pozwala jednak
 * odpowiedzieć na pytanie „czy te słabe zadania wyszły ze starego promptu".
 */
export const PROMPT_VERSION = 'hw-v2-2026-09-12';

// ---------------------------------------------------------------------------
// Typy zadań
// ---------------------------------------------------------------------------

/**
 * Trzy typy objęte tym zleceniem.
 *
 * Bank kanoniczny ma sześć (§7 specyfikacji). Ułóż i odtwórz, parafraza oraz
 * reakcja w sytuacji są świadomie poza kodem aż do osobnej akceptacji — nie
 * dopisuj ich tutaj „na zapas", bo planner zacznie je proponować.
 *
 * Nazwy nie pokrywają się z `HomeworkType` z `types.ts` i to jest zamierzone:
 * typy v1 nie mają kontraktu oceny, wariantów ani drabinki podpowiedzi, więc
 * współdzielenie nazwy mówiłoby nieprawdę o tym, co dokument potrafi.
 */
export type ExerciseTypeV2 = 'micro_translation' | 'fix_sentence' | 'gap_from_context';

export const EXERCISE_TYPES_V2: readonly ExerciseTypeV2[] = [
  'micro_translation',
  'fix_sentence',
  'gap_from_context',
] as const;

/** Tryb wykonania. Testy postępu (`exam`) są poza tym zleceniem. */
export type EngineModeV2 = 'training';

/** Pierwsza wersja jest tekstowa; pole istnieje, bo schemat ma przewidywać mowę (§14). */
export type ResponseModeV2 = 'text';

// ---------------------------------------------------------------------------
// Rubryka — zamrożona (§3.1 „Mini-rubryka treningu")
// ---------------------------------------------------------------------------

/**
 * Trzy obszary oceny.
 *
 * `targetMaterial` to nie jest to samo, co gramatyka w rubryce v1
 * (`evaluateTranslations` w `services/geminiService.ts` waży
 * znaczenie / gramatykę / słownictwo). Tutaj środkowy obszar pyta o jedno:
 * czy kursant użył tego, czego ćwiczenie miało uczyć. Zdanie bez błędu
 * gramatycznego, ale omijające ćwiczoną konstrukcję, dostaje w tym obszarze zero.
 */
export type RubricArea = 'meaning' | 'targetMaterial' | 'accuracy';

export const RUBRIC_AREAS: readonly RubricArea[] = ['meaning', 'targetMaterial', 'accuracy'] as const;

/** Wagi obszarów. Sumują się do 100 i nie podlegają zmianie per zadanie. */
export const RUBRIC_WEIGHTS: Readonly<Record<RubricArea, number>> = {
  meaning: 40,
  targetMaterial: 40,
  accuracy: 20,
} as const;

/**
 * Jedyne dozwolone oceny obszaru.
 *
 * Skala trójstopniowa jest celowa: model, który może wystawić 0,73, wystawia
 * liczbę bez pokrycia. Trzy stopnie da się opisać słowami i sprawdzić.
 */
export const AREA_SCORES: readonly number[] = [0, 0.5, 1] as const;

export type AreaScore = 0 | 0.5 | 1;

/** Wynik obszarowy jednej odpowiedzi. */
export type RubricScores = Readonly<Record<RubricArea, AreaScore>>;

/**
 * Poniżej tego progu ocena nie jest wiążąca.
 *
 * Zamiast zgadywać, silnik oddaje sprawę lektorowi: stan opanowania zostaje bez
 * zmiany, a kursant nie dostaje kary za niepewność modelu (§3.1).
 */
export const CONFIDENCE_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Próby i regeneracje
// ---------------------------------------------------------------------------

/** Trening daje trzy próby. Po trzeciej pokazujemy wzorzec i wymagamy poprawki. */
export const MAX_ATTEMPTS = 3;

/** Walidator dostaje dwie szanse na poprawienie zadania, potem idzie do lektora. */
export const MAX_REGENERATIONS = 2;

/** Paliwem jest zatwierdzona lekcja — domyślnie jedna, najwyżej trzy (§3.1). */
export const DEFAULT_LESSONS_AS_FUEL = 1;
export const MAX_LESSONS_AS_FUEL = 3;

export type AttemptNumber = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Stan opanowania
// ---------------------------------------------------------------------------

/**
 * Co kursant widzi zamiast procentu.
 *
 * Trening pokazuje feedback i stan — nigdy wyniku procentowego ani słupka
 * (§3.1). Procent zostaje w teście postępu, który jest poza tym zleceniem.
 */
export type MasteryState = 'nowe' | 'ćwiczymy' | 'opanowane';

export const MASTERY_STATES: readonly MasteryState[] = ['nowe', 'ćwiczymy', 'opanowane'] as const;

// ---------------------------------------------------------------------------
// Kontrakt zadania
// ---------------------------------------------------------------------------

/** Skąd wzięło się zadanie. Każde musi umieć wskazać źródło (§16). */
export interface SourceRefV2 {
  /** `lessonRecord` — jedyne paliwo w tym zleceniu. */
  kind: 'lessonRecord';
  /** Identyfikator dokumentu lekcji. */
  id: string;
  /** Blok lekcji, z którego pochodzi materiał. Wymowa nie jest paliwem. */
  block?: 'vocabulary' | 'grammar' | 'corrections' | 'goals' | 'note';
  /** Etykieta dla lektora — w UI pokazujemy krótkie `lekcja`. */
  label?: string;
}

/** Wynik niezależnego walidatora naturalności (§10). */
export interface ValidationResultV2 {
  passed: boolean;
  /** 0–1. Zadanie poniżej progu idzie do regeneracji, potem do lektora. */
  score: number;
  /** Które z pytań walidatora wypadły źle — do pokazania lektorowi. */
  failedChecks: string[];
  /** Ile razy zadanie było już przepisywane. Nigdy więcej niż MAX_REGENERATIONS. */
  regenerationCount: number;
  /** Model, który walidował. Osobne wywołanie, nie ten sam przebieg co generator. */
  modelVersion: string;
  checkedAt: string;
}

/**
 * Zamrożony kontrakt jednego zadania.
 *
 * Powstaje przed przypisaniem i od pierwszej odpowiedzi jest niezmienny.
 * Edycja po tym momencie tworzy nową wersję zadania; stara zostaje przy
 * zapisanej próbie, żeby historia kursanta nie zmieniała się wstecz (§9).
 */
export interface ExerciseContractV2 {
  // --- tożsamość i wersje ---
  id: string;
  engineVersion: typeof ENGINE_VERSION;
  schemaVersion: string;
  promptVersion: string;
  /** Model, który ułożył to zadanie. */
  modelVersion: string;

  // --- właściciel i adresat ---
  /** Zawsze obecny. Pochodzi z `request.auth.uid`, nigdy z payloadu klienta (§14). */
  teacherId: string;
  /** Dokładnie jedno z dwóch: zadanie indywidualne albo grupowe. */
  studentId?: string;
  groupId?: string;

  // --- rodzaj i poziom ---
  mode: EngineModeV2;
  exerciseType: ExerciseTypeV2;
  responseMode: ResponseModeV2;
  sourceLanguage: string;
  targetLanguage: string;
  cefr: string;
  /** 1–5. Ustala planner przy generowaniu, nigdy w środku zestawu (§18). */
  difficulty: number;

  // --- treść ---
  /** Jeden główny cel. Zadanie o dwóch celach nie przechodzi walidatora. */
  learningObjective: string;
  /** Treść zadania: zdanie PL, zdanie z błędem albo tekst z luką. */
  content: string;
  /** Polecenie dla kursanta. */
  instruction: string;
  /** Odpowiedź wzorcowa. */
  modelAnswer: string;
  /** Warianty naturalne. Trafienie w wariant = pełne punkty obszaru (§3.1). */
  acceptedVariants: string[];
  /** Materiał, który musi się pojawić — bez niego obszar `targetMaterial` to zero. */
  requiredMaterial: string[];
  /** Typowe błędy przy tym zadaniu. Paliwo dla feedbacku, nie dla kary. */
  commonMistakes: string[];

  // --- drabinka podpowiedzi (zamrożona, nie z wolnego AI) ---
  /** Podpowiedź do próby 2. */
  hintSmall: string;
  /** Podpowiedź do próby 3. */
  hintLarge: string;

  // --- pochodzenie i kontrola jakości ---
  sourceRefs: SourceRefV2[];
  validation: ValidationResultV2;
  /** Zadanie, którego walidator nie przepuścił — nie wolno go wysłać automatycznie. */
  requiresTeacherReview: boolean;

  createdAt: string;
}

// ---------------------------------------------------------------------------
// Próba kursanta
// ---------------------------------------------------------------------------

/**
 * Jedna próba.
 *
 * Trafia do podkolekcji `specialTasks/{taskId}/attempts/{attemptId}`, a nie do
 * dokumentu nadrzędnego — dzięki temu reguła zapisu dla kursanta zostaje wąska,
 * a pola werdyktu (`rubricScores`, `masteryState`, `confidence`) pisze wyłącznie
 * Admin SDK z Cloud Functions.
 */
export interface AttemptV2 {
  attemptNumber: AttemptNumber;
  /** Odpowiedź kursanta. */
  answer: string;
  /** Czy przy tej próbie pokazano podpowiedź i którą. */
  hintShown: 'none' | 'small' | 'large';
  /** Czy to wymagana poprawka po pokazaniu wzorca (po próbie 3). */
  isCorrectionAfterModelAnswer: boolean;
  startedAt: string;
  submittedAt: string;
}

/** Werdykt jednej próby — wynik `GradingEngine`, nigdy zapis klienta. */
export interface GradingVerdictV2 {
  rubricScores: RubricScores;
  /** 0–100, wyliczone z wag. Nie pokazywane kursantowi w treningu. */
  weightedScore: number;
  /** 0–1. Poniżej CONFIDENCE_THRESHOLD werdykt nie jest wiążący. */
  confidence: number;
  /** Uzasadnienie obszarowe — strukturalne, nie swobodna opinia modelu. */
  rationale: Readonly<Record<RubricArea, string>>;
  masteryState: MasteryState;
  requiresTeacherReview: boolean;
  schemaVersion: string;
  modelVersion: string;
  gradedAt: string;
}

// ---------------------------------------------------------------------------
// Strażniki typów
// ---------------------------------------------------------------------------
//
// W repo nie ma `zod` ani żadnego innego walidatora schematu, a zlecenie
// zabrania dokładania bibliotek. Strażniki poniżej robią dokładnie tyle, ile
// trzeba: odsiewają odpowiedź modelu, która nie jest kontraktem, zanim
// cokolwiek trafi do bazy.

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isExerciseTypeV2 = (value: unknown): value is ExerciseTypeV2 =>
  typeof value === 'string' && (EXERCISE_TYPES_V2 as readonly string[]).includes(value);

export const isMasteryState = (value: unknown): value is MasteryState =>
  typeof value === 'string' && (MASTERY_STATES as readonly string[]).includes(value);

export const isAreaScore = (value: unknown): value is AreaScore =>
  value === 0 || value === 0.5 || value === 1;

export const isRubricScores = (value: unknown): value is RubricScores => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return RUBRIC_AREAS.every((area) => isAreaScore(candidate[area]));
};

export const isSourceRefV2 = (value: unknown): value is SourceRefV2 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.kind === 'lessonRecord' && isNonEmptyString(candidate.id);
};

export const isValidationResultV2 = (value: unknown): value is ValidationResultV2 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.passed === 'boolean' &&
    typeof candidate.score === 'number' &&
    candidate.score >= 0 &&
    candidate.score <= 1 &&
    isStringArray(candidate.failedChecks) &&
    typeof candidate.regenerationCount === 'number' &&
    candidate.regenerationCount >= 0 &&
    candidate.regenerationCount <= MAX_REGENERATIONS &&
    isNonEmptyString(candidate.modelVersion) &&
    isNonEmptyString(candidate.checkedAt)
  );
};

/**
 * Czy to jest pełny kontrakt zadania.
 *
 * Sprawdza obecność i sensowność, nie jakość treści — od jakości jest
 * `QualityValidator` w osobnym wywołaniu modelu. Tu chodzi o to, żeby do bazy
 * nie trafiło zadanie bez celu, bez wzorca albo bez źródła.
 */
export const isExerciseContractV2 = (value: unknown): value is ExerciseContractV2 => {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;

  // Adresat: dokładnie jeden. Zadanie „dla wszystkich" nie istnieje w v2 —
  // grupa dostaje osobny dokument na kursanta, patrz docs/audyt-homework-v2.md.
  const hasExactlyOneAudience =
    (isNonEmptyString(c.studentId) ? 1 : 0) + (isNonEmptyString(c.groupId) ? 1 : 0) === 1;

  return (
    isNonEmptyString(c.id) &&
    c.engineVersion === ENGINE_VERSION &&
    isNonEmptyString(c.schemaVersion) &&
    isNonEmptyString(c.promptVersion) &&
    isNonEmptyString(c.modelVersion) &&
    isNonEmptyString(c.teacherId) &&
    hasExactlyOneAudience &&
    c.mode === 'training' &&
    isExerciseTypeV2(c.exerciseType) &&
    c.responseMode === 'text' &&
    isNonEmptyString(c.sourceLanguage) &&
    isNonEmptyString(c.targetLanguage) &&
    isNonEmptyString(c.cefr) &&
    typeof c.difficulty === 'number' &&
    c.difficulty >= 1 &&
    c.difficulty <= 5 &&
    isNonEmptyString(c.learningObjective) &&
    isNonEmptyString(c.content) &&
    isNonEmptyString(c.instruction) &&
    isNonEmptyString(c.modelAnswer) &&
    isStringArray(c.acceptedVariants) &&
    isStringArray(c.requiredMaterial) &&
    c.requiredMaterial.length > 0 &&
    isStringArray(c.commonMistakes) &&
    isNonEmptyString(c.hintSmall) &&
    isNonEmptyString(c.hintLarge) &&
    Array.isArray(c.sourceRefs) &&
    c.sourceRefs.length > 0 &&
    c.sourceRefs.every(isSourceRefV2) &&
    isValidationResultV2(c.validation) &&
    typeof c.requiresTeacherReview === 'boolean' &&
    isNonEmptyString(c.createdAt)
  );
};

// ---------------------------------------------------------------------------
// Drabinka podpowiedzi — zamrożona
// ---------------------------------------------------------------------------

/**
 * Co wolno pokazać przy danej próbie.
 *
 * Podpowiedź pochodzi z kontraktu zadania, nie z osobnego pytania do modelu
 * (§3.1). Dzięki temu kursant dostaje tę samą podpowiedź przy każdym
 * podejściu, a lektor widzi ją w podglądzie, zanim zadanie wyjdzie.
 */
export const hintForAttempt = (
  contract: Pick<ExerciseContractV2, 'hintSmall' | 'hintLarge'>,
  attemptNumber: AttemptNumber
): { level: AttemptV2['hintShown']; text: string | null } => {
  if (attemptNumber === 1) return { level: 'none', text: null };
  if (attemptNumber === 2) return { level: 'small', text: contract.hintSmall };
  return { level: 'large', text: contract.hintLarge };
};

/**
 * Czym jest podpowiedź dla każdego z trzech typów.
 *
 * Opis jest instrukcją dla generatora, a nie tekstem pokazywanym kursantowi —
 * konkretna treść siedzi w `hintSmall` / `hintLarge` danego zadania.
 */
export const HINT_PROTOCOL: Readonly<Record<ExerciseTypeV2, { small: string; large: string }>> = {
  micro_translation: {
    small: 'Pierwsze słowo lub konstrukcja, od której zaczyna się zdanie.',
    large: 'Szkielet zdania z lukami na resztę.',
  },
  fix_sentence: {
    small: 'Zaznaczone miejsce błędu, bez nazwania go.',
    large: 'Nazwany typ błędu, nadal bez pełnej poprawki.',
  },
  gap_from_context: {
    small: 'Pierwsza litera brakującego słowa.',
    large: 'Liczba słów albo fragment odpowiedzi.',
  },
} as const;

/** Czy po tej próbie pokazujemy wzorzec i żądamy poprawionej wersji. */
export const shouldRevealModelAnswer = (attemptNumber: AttemptNumber): boolean =>
  attemptNumber >= MAX_ATTEMPTS;

// ---------------------------------------------------------------------------
// Scoring — czysta funkcja, bez AI
// ---------------------------------------------------------------------------

/**
 * Wynik ważony 0–100 z ocen obszarowych.
 *
 * Kursant tego nie zobaczy w treningu; liczba służy lektorowi, metrykom
 * i progom poniżej.
 */
export const weightedScore = (scores: RubricScores): number =>
  RUBRIC_AREAS.reduce((sum, area) => sum + scores[area] * RUBRIC_WEIGHTS[area], 0);

/**
 * Czy próba jest poprawna.
 *
 * UWAGA — to jest interpretacja, nie cytat. Specyfikacja mówi, kiedy odpowiedź
 * NIE może być uznana („brak głównego celu = maksymalnie ćwiczymy",
 * „literówka nie zeruje"), ale nie podaje progu liczbowego. Próg zapisany tutaj
 * czyta te dwa zdania wprost:
 *
 *   znaczenie zachowane (1) ORAZ cel użyty poprawnie (1) ORAZ poprawność ≥ 0,5
 *
 * czyli: sens się zgadza, ćwiczony materiał jest, a jedyne, co wolno,
 * to literówka lub drobiazg. Ważone daje to 90/100.
 *
 * Gdyby Maciej chciał inaczej — to jedno miejsce do zmiany, wraz z podbiciem
 * `SCHEMA_VERSION`, bo zmiana progu zmienia wynik zapisanych już prób.
 */
export const isPassingAttempt = (scores: RubricScores): boolean =>
  scores.meaning === 1 && scores.targetMaterial === 1 && scores.accuracy >= 0.5;

/** Czy kursant w ogóle użył ćwiczonego materiału. */
export const usedTargetMaterial = (scores: RubricScores): boolean => scores.targetMaterial > 0;

export interface MasteryInput {
  scores: RubricScores;
  confidence: number;
  attemptNumber: AttemptNumber;
  /** Czy to wymagana poprawka po pokazaniu wzorca. */
  isCorrectionAfterModelAnswer: boolean;
  /** Stan sprzed tej próby — zwracany bez zmiany przy niskiej pewności. */
  previousState: MasteryState;
}

/**
 * Stan opanowania po próbie.
 *
 * Reguły wprost ze specyfikacji (§3.1), w kolejności rozstrzygania:
 *
 * 1. Pewność poniżej progu nie karze i nie nagradza — stan zostaje bez zmiany,
 *    a sprawa idzie do lektora.
 * 2. Brak głównego celu to najwyżej `ćwiczymy`. Nigdy `opanowane`, choćby
 *    zdanie było bez zarzutu gramatycznie.
 * 3. `opanowane` należy się za poprawną pierwszą próbę albo za poprawioną
 *    wersję po trzeciej. Poprawna druga próba to nadal `ćwiczymy` — kursant
 *    potrzebował podpowiedzi, więc materiał wraca do powtórki.
 */
export const resolveMastery = (
  input: MasteryInput
): { state: MasteryState; requiresTeacherReview: boolean } => {
  const { scores, confidence, attemptNumber, isCorrectionAfterModelAnswer, previousState } = input;

  if (confidence < CONFIDENCE_THRESHOLD) {
    return { state: previousState, requiresTeacherReview: true };
  }

  if (!usedTargetMaterial(scores)) {
    return { state: 'ćwiczymy', requiresTeacherReview: false };
  }

  if (!isPassingAttempt(scores)) {
    return { state: 'ćwiczymy', requiresTeacherReview: false };
  }

  const earnedMastery = attemptNumber === 1 || isCorrectionAfterModelAnswer;
  return { state: earnedMastery ? 'opanowane' : 'ćwiczymy', requiresTeacherReview: false };
};

// ---------------------------------------------------------------------------
// Zgodność z v1
// ---------------------------------------------------------------------------

/**
 * Pola, bez których zestaw v2 zepsuje to, co działa.
 *
 * `sentences`: `notifyStudentOnHomework` liczy `task.sentences.length` jako
 * liczbę zadań w mailu. Inna nazwa pola = wiadomość „0 zadań".
 *
 * `skipAutoEmail` + `manualEmailConfirmationRequired`: oba dzisiejsze kreatory
 * je ustawiają, więc automat wychodzi od razu, a pocztę wysyła lektor z
 * `HomeworkEmailConfirmationModal`. v2 wchodzi w ten sam tryb, zamiast
 * otwierać drugą ścieżkę wysyłki.
 *
 * `studentUid`: reguła `create` w `firestore.rules` wymaga niepustego stringa.
 *
 * Szczegóły i uzasadnienie: `docs/audyt-homework-v2.md` §4.
 */
export const V1_COMPATIBILITY_FIELDS = {
  itemsField: 'sentences',
  engineVersionField: 'engineVersion',
  ownerField: 'studentUid',
} as const;

/**
 * Czy dokument `specialTasks` należy do silnika v2.
 *
 * Ekrany v1 muszą tym filtrować. Bez tego `homeworkItemType()`
 * (`utils/homework.ts`) uzna nieznany element v2 za `translation` i spróbuje
 * wyrenderować zadanie, którego nie rozumie.
 */
export const isV2Task = (task: unknown): boolean => {
  if (!task || typeof task !== 'object') return false;
  return (task as Record<string, unknown>).engineVersion === ENGINE_VERSION;
};

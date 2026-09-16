/**
 * Krzywa uczenia kursanta — dobieranie trudności na podstawie tego, co
 * kursant realnie zrobił, a nie na podstawie poziomu wpisanego raz w profilu.
 *
 * Moduł jest czysty: bez Firestore, bez Reacta, bez `Date.now()` w miejscach,
 * które liczą. Wejście to profil i lista prób, wyjście to nowy profil. Dzięki
 * temu całą decyzję „podnieść czy obniżyć poziom" da się przetestować bez
 * bazy — i dlatego ona faktycznie jest przetestowana (tests/learningCurve.test.ts).
 *
 * Zapis stanu żyje w `services/learningProfile.ts`, które tylko czyta i zapisuje
 * dokument; żadna reguła metodyczna nie ma prawa tam zamieszkać.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Jak trudne jest zadanie na danym poziomie dla tego kursanta. */
export type DifficultyFit = 'too_easy' | 'right' | 'stretch' | 'too_hard';

export interface AttemptRecord {
  /** Treść polecenia — pierwsze zdanie wystarczy, to materiał do promptu. */
  prompt: string;
  /** Oczekiwana odpowiedź; puste, gdy zadanie nie miało jednej poprawnej. */
  expected?: string;
  /** Co odpowiedział kursant. */
  given?: string;
  isCorrect: boolean;
  /** Wynik 0–100. Zadania zero-jedynkowe dają 0 albo 100. */
  score: number;
  /** Poziom, na jakim zadanie było ułożone. */
  level: CefrLevel;
  /** `translation`, `word_order`, `recall`, `flashcards`… */
  exerciseType: string;
  /** ISO. */
  date: string;
}

export interface Tally {
  attempts: number;
  correct: number;
  scoreSum: number;
}

export interface LevelChange {
  date: string;
  from: CefrLevel;
  to: CefrLevel;
  reason: string;
}

export interface RecordedMistake {
  prompt: string;
  expected: string;
  given: string;
  exerciseType: string;
  date: string;
}

export interface LearningProfile {
  studentId: string;
  /** Poziom wpisany przez lektora — punkt odniesienia i granica dryfu. */
  baseLevel: CefrLevel;
  /** Poziom, na którym układamy zadania teraz. */
  currentLevel: CefrLevel;
  totalAttempts: number;
  totalCorrect: number;
  /** Statystyki w rozbiciu na poziom zadania. */
  byLevel: Partial<Record<CefrLevel, Tally>>;
  /** Statystyki w rozbiciu na rodzaj zadania. */
  byExerciseType: Record<string, Tally>;
  /** Ostatnie wyniki (najnowszy na końcu) — z nich liczy się okno decyzyjne. */
  recentOutcomes: boolean[];
  /** Ile prób od ostatniej zmiany poziomu; histereza przeciw oscylacji. */
  attemptsSinceLevelChange: number;
  /** Ostatnie błędy — trafiają wprost do promptu jako „nad czym pracujemy". */
  recentMistakes: RecordedMistake[];
  /** Dziennik zmian poziomu — wewnętrzny raport mechanizmu. */
  levelHistory: LevelChange[];
  updatedAt: string;
  lastUpdated?: string;
  createdAt?: string;
}

/** Okno, po którym w ogóle wolno ruszyć poziomem. */
export const DECISION_WINDOW = 12;

/** Powyżej tej skuteczności w oknie zadania są za łatwe. */
export const PROMOTE_ACCURACY = 0.85;

/** Poniżej tej skuteczności w oknie zadania są za trudne. */
export const DEMOTE_ACCURACY = 0.45;

/** O tyle poziomów algorytm może odejść od poziomu wpisanego przez lektora. */
export const MAX_DRIFT_FROM_BASE = 1;

/** Ile błędów trzymamy pod ręką dla modelu. */
export const MAX_RECENT_MISTAKES = 15;

/** Ile ostatnich wyników trzyma profil (dwa okna: bieżące i poprzednie). */
const MAX_RECENT_OUTCOMES = DECISION_WINDOW * 2;

export const isCefrLevel = (value: unknown): value is CefrLevel =>
  typeof value === 'string' && (CEFR_LEVELS as readonly string[]).includes(value);

/**
 * Sprowadza poziom do jednej z sześciu wartości CEFR.
 *
 * Poziomy w bazie bywają zapisane jako „B1-B2", „b2", „Poziom B1" albo puste —
 * pochodzą z ręcznych wpisów lektora sprzed ujednolicenia. Z zakresu bierzemy
 * niższy koniec: lepiej zacząć łatwiej i podnieść, niż zniechęcić od progu.
 */
export const normalizeLevel = (raw: unknown, fallback: CefrLevel = 'B1'): CefrLevel => {
  if (isCefrLevel(raw)) return raw;
  const text = String(raw || '').toUpperCase();
  const match = text.match(/[ABC][12]/g);
  if (!match || match.length === 0) return fallback;
  const found = match.filter(isCefrLevel);
  if (found.length === 0) return fallback;
  return found.reduce((lowest, level) =>
    CEFR_LEVELS.indexOf(level) < CEFR_LEVELS.indexOf(lowest) ? level : lowest
  );
};

/** Przesuwa poziom o `step` stopni, nie wychodząc poza skalę. */
export const shiftLevel = (level: CefrLevel, step: number): CefrLevel => {
  const index = CEFR_LEVELS.indexOf(level);
  const next = Math.min(CEFR_LEVELS.length - 1, Math.max(0, index + step));
  return CEFR_LEVELS[next];
};

/** Odległość między poziomami w stopniach (dodatnia, gdy `a` wyżej niż `b`). */
export const levelDistance = (a: CefrLevel, b: CefrLevel): number =>
  CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b);

const emptyTally = (): Tally => ({ attempts: 0, correct: 0, scoreSum: 0 });

const addToTally = (tally: Tally | undefined, attempt: AttemptRecord): Tally => {
  const base = tally || emptyTally();
  return {
    attempts: base.attempts + 1,
    correct: base.correct + (attempt.isCorrect ? 1 : 0),
    scoreSum: base.scoreSum + (Number.isFinite(attempt.score) ? attempt.score : 0),
  };
};

export const accuracyOf = (tally?: Tally): number =>
  !tally || tally.attempts === 0 ? 0 : tally.correct / tally.attempts;

export const averageScoreOf = (tally?: Tally): number =>
  !tally || tally.attempts === 0 ? 0 : Math.round(tally.scoreSum / tally.attempts);

export function createProfile(studentId: string, baseLevel: CefrLevel, now: string): LearningProfile {
  return {
    studentId,
    baseLevel,
    currentLevel: baseLevel,
    totalAttempts: 0,
    totalCorrect: 0,
    byLevel: {},
    byExerciseType: {},
    recentOutcomes: [],
    attemptsSinceLevelChange: 0,
    recentMistakes: [],
    levelHistory: [],
    updatedAt: now,
    lastUpdated: now,
    createdAt: now,
  };
}

/**
 * Dopisuje próby do profilu. Nie zmienia poziomu — od tego jest
 * `evaluateLevelChange`, żeby dało się zapisać wyniki bez ruszania trudności.
 */
export function recordAttempts(
  profile: LearningProfile,
  attempts: AttemptRecord[],
  now: string
): LearningProfile {
  if (attempts.length === 0) return profile;

  const next: LearningProfile = {
    ...profile,
    byLevel: { ...profile.byLevel },
    byExerciseType: { ...profile.byExerciseType },
    recentOutcomes: [...profile.recentOutcomes],
    recentMistakes: [...profile.recentMistakes],
    levelHistory: [...profile.levelHistory],
    updatedAt: now,
    lastUpdated: now,
  };

  attempts.forEach((attempt) => {
    next.totalAttempts += 1;
    if (attempt.isCorrect) next.totalCorrect += 1;
    next.attemptsSinceLevelChange += 1;
    next.byLevel[attempt.level] = addToTally(next.byLevel[attempt.level], attempt);
    next.byExerciseType[attempt.exerciseType] = addToTally(
      next.byExerciseType[attempt.exerciseType],
      attempt
    );
    next.recentOutcomes.push(attempt.isCorrect);

    if (!attempt.isCorrect) {
      next.recentMistakes.push({
        prompt: attempt.prompt,
        expected: attempt.expected || '',
        given: attempt.given || '',
        exerciseType: attempt.exerciseType,
        date: attempt.date,
      });
    }
  });

  next.recentOutcomes = next.recentOutcomes.slice(-MAX_RECENT_OUTCOMES);
  next.recentMistakes = next.recentMistakes.slice(-MAX_RECENT_MISTAKES);
  return next;
}

/** Skuteczność w ostatnim oknie decyzyjnym. */
export const windowAccuracy = (profile: LearningProfile): number => {
  const window = profile.recentOutcomes.slice(-DECISION_WINDOW);
  if (window.length === 0) return 0;
  return window.filter(Boolean).length / window.length;
};

export interface LevelDecision {
  level: CefrLevel;
  changed: boolean;
  reason: string;
}

/**
 * Decyzja o zmianie poziomu.
 *
 * Trzy zabezpieczenia przed skakaniem trudności w tę i we w tę:
 *  - pełne okno prób (`DECISION_WINDOW`) zanim cokolwiek się rusza,
 *  - licznik okna zeruje się po każdej zmianie (histereza),
 *  - dryf ograniczony do jednego stopnia od poziomu wpisanego przez lektora —
 *    lektor zna kursanta z zajęć, algorytm zna tylko klikanie w aplikacji.
 */
export function evaluateLevelChange(profile: LearningProfile, now: string): LevelDecision {
  const window = profile.recentOutcomes.slice(-DECISION_WINDOW);

  if (window.length < DECISION_WINDOW || profile.attemptsSinceLevelChange < DECISION_WINDOW) {
    return {
      level: profile.currentLevel,
      changed: false,
      reason: 'Za mało prób od ostatniej zmiany, żeby ruszać poziomem.',
    };
  }

  const accuracy = windowAccuracy(profile);
  const percent = Math.round(accuracy * 100);

  if (accuracy >= PROMOTE_ACCURACY) {
    const candidate = shiftLevel(profile.currentLevel, 1);
    if (candidate === profile.currentLevel) {
      return { level: profile.currentLevel, changed: false, reason: 'Najwyższy poziom skali.' };
    }
    if (levelDistance(candidate, profile.baseLevel) > MAX_DRIFT_FROM_BASE) {
      return {
        level: profile.currentLevel,
        changed: false,
        reason: `Skuteczność ${percent}%, ale wyżej niż ${MAX_DRIFT_FROM_BASE} stopień ponad poziom od lektora nie schodzimy bez jego decyzji.`,
      };
    }
    return {
      level: candidate,
      changed: true,
      reason: `Skuteczność ${percent}% w ostatnich ${DECISION_WINDOW} zadaniach — podnosimy poziom.`,
    };
  }

  if (accuracy <= DEMOTE_ACCURACY) {
    const candidate = shiftLevel(profile.currentLevel, -1);
    if (candidate === profile.currentLevel) {
      return { level: profile.currentLevel, changed: false, reason: 'Najniższy poziom skali.' };
    }
    if (levelDistance(profile.baseLevel, candidate) > MAX_DRIFT_FROM_BASE) {
      return {
        level: profile.currentLevel,
        changed: false,
        reason: `Skuteczność ${percent}%, ale niżej niż ${MAX_DRIFT_FROM_BASE} stopień pod poziom od lektora nie schodzimy bez jego decyzji.`,
      };
    }
    return {
      level: candidate,
      changed: true,
      reason: `Skuteczność ${percent}% w ostatnich ${DECISION_WINDOW} zadaniach — obniżamy poziom.`,
    };
  }

  return {
    level: profile.currentLevel,
    changed: false,
    reason: `Skuteczność ${percent}% mieści się w przedziale roboczym — poziom bez zmian.`,
  };
}

/** Nakłada decyzję na profil: zmienia poziom, zeruje okno, dopisuje do dziennika. */
export function applyLevelDecision(
  profile: LearningProfile,
  decision: LevelDecision,
  now: string
): LearningProfile {
  if (!decision.changed) return profile;
  return {
    ...profile,
    currentLevel: decision.level,
    attemptsSinceLevelChange: 0,
    levelHistory: [
      ...profile.levelHistory,
      { date: now, from: profile.currentLevel, to: decision.level, reason: decision.reason },
    ].slice(-30),
    updatedAt: now,
    lastUpdated: now,
  };
}

/** Skrót na jedno wywołanie: zapisz próby i od razu przelicz poziom. */
export function ingestAttempts(
  profile: LearningProfile,
  attempts: AttemptRecord[],
  now: string
): { profile: LearningProfile; decision: LevelDecision } {
  const recorded = recordAttempts(profile, attempts, now);
  const decision = evaluateLevelChange(recorded, now);
  return { profile: applyLevelDecision(recorded, decision, now), decision };
}

/**
 * Czy zadanie na tym poziomie jest w zasięgu kursanta.
 *
 * To jest odpowiedź na pytanie „z czym sobie poradzi, a co będzie za trudne":
 * poziom równy bieżącemu jest w punkt, jeden wyżej to ćwiczenie na rozciąganie
 * (wartościowe, ale nie na całą pracę domową), dwa wyżej to już zniechęcanie.
 */
export function assessDifficulty(profile: LearningProfile, level: CefrLevel): DifficultyFit {
  const distance = levelDistance(level, profile.currentLevel);
  if (distance <= -2) return 'too_easy';
  if (distance >= 2) return 'too_hard';
  if (distance === 1) return 'stretch';
  if (distance === -1) {
    // Poziom niżej jest powtórką, chyba że kursant właśnie na bieżącym tonie —
    // wtedy nadal jest w punkt, bo poziom dopiero się ustala. Brak wyników to
    // nie to samo co złe wyniki: `windowAccuracy` pustego profilu wynosi 0,
    // więc bez tego warunku świeży kursant dostawałby zaniżone zadania.
    const hasEvidence = profile.recentOutcomes.length > 0;
    return hasEvidence && windowAccuracy(profile) <= DEMOTE_ACCURACY ? 'right' : 'too_easy';
  }
  return 'right';
}

/** Najczęściej mylone rodzaje zadań — do wskazówki dla modelu i dla lektora. */
export function weakestExerciseTypes(profile: LearningProfile, max = 3): string[] {
  return Object.entries(profile.byExerciseType)
    .filter(([, tally]) => tally.attempts >= 3)
    .sort((a, b) => accuracyOf(a[1]) - accuracyOf(b[1]))
    .slice(0, max)
    .map(([type]) => type);
}

/**
 * Podręczna notatka o kursancie dla modelu.
 *
 * Model dostaje liczby i ostatnie błędy, a nie ogólniki: „ma być trudniej"
 * znaczy dla modelu cokolwiek, a „skuteczność 91% na B1, myli czasy przeszłe,
 * ostatnio pomylił X" prowadzi do konkretnego zdania.
 */
export function buildStudentBriefing(profile: LearningProfile): string {
  if (profile.totalAttempts === 0) {
    return [
      `[PROFIL KURSANTA]`,
      `Poziom docelowy: ${profile.currentLevel} (wpisany przez lektora, brak jeszcze historii ćwiczeń).`,
      `Ułóż zadania dokładnie na tym poziomie.`,
    ].join('\n');
  }

  const overall = Math.round((profile.totalCorrect / profile.totalAttempts) * 100);
  const windowPercent = Math.round(windowAccuracy(profile) * 100);
  const levelLine = Object.entries(profile.byLevel)
    .map(([level, tally]) => `${level}: ${Math.round(accuracyOf(tally) * 100)}% z ${tally.attempts}`)
    .join(', ');
  const weakTypes = weakestExerciseTypes(profile);
  const mistakes = profile.recentMistakes.slice(-8);

  const lines = [
    `[PROFIL KURSANTA]`,
    `Poziom, na którym układamy zadania: ${profile.currentLevel} (poziom od lektora: ${profile.baseLevel}).`,
    `Skuteczność ogółem: ${overall}% z ${profile.totalAttempts} zadań. W ostatnich ${DECISION_WINDOW}: ${windowPercent}%.`,
    levelLine ? `Skuteczność wg poziomu zadań: ${levelLine}.` : '',
    weakTypes.length > 0 ? `Najsłabiej idą zadania typu: ${weakTypes.join(', ')}.` : '',
  ];

  if (mistakes.length > 0) {
    lines.push('', 'OSTATNIE BŁĘDY KURSANTA (pracuj na tych brakach, nie powtarzaj ich treści dosłownie):');
    mistakes.forEach((mistake) => {
      const expected = mistake.expected ? ` | poprawnie: "${mistake.expected}"` : '';
      const given = mistake.given ? ` | odpowiedział: "${mistake.given}"` : '';
      lines.push(`- [${mistake.exerciseType}] "${mistake.prompt}"${given}${expected}`);
    });
  }

  lines.push(
    '',
    `ZASADA DOBORU TRUDNOŚCI: większość zadań na poziomie ${profile.currentLevel}; ` +
      `najwyżej jedno na ${shiftLevel(profile.currentLevel, 1)} jako wyzwanie. ` +
      `Nie schodź poniżej ${shiftLevel(profile.currentLevel, -1)} i nie wychodź powyżej ${shiftLevel(profile.currentLevel, 1)}.`
  );

  return lines.filter((line) => line !== '').join('\n');
}

/** Dozwolone klucze dokumentu learningCurve w Firestore Security Rules */
export const FIRESTORE_LEARNING_PROFILE_ALLOWED_KEYS = [
  'studentId',
  'baseLevel',
  'currentLevel',
  'totalAttempts',
  'totalCorrect',
  'byLevel',
  'byExerciseType',
  'recentOutcomes',
  'attemptsSinceLevelChange',
  'recentMistakes',
  'levelHistory',
  'lastUpdated',
  'createdAt',
] as const;

export const FIRESTORE_LEARNING_PROFILE_REQUIRED_KEYS = [
  'studentId',
  'baseLevel',
  'currentLevel',
  'totalAttempts',
  'totalCorrect',
] as const;

/**
 * Przekształca profil w czysty obiekt dozwolony przez reguły Firestore.
 *
 * `levelHistory` musi tu być: to dziennik decyzji o trudności (kiedy poziom
 * poszedł w górę, kiedy w dół i dlaczego), czyli ta część raportu, której nie da
 * się odtworzyć z niczego innego — liczniki mówią, jak jest teraz, a nie jak
 * kursant do tego doszedł. Pominięty w serializacji był liczony przy każdej
 * sesji i wyrzucany przy zapisie.
 *
 * `updatedAt` żyje tylko w pamięci (ustawiają je funkcje krzywej); do bazy idzie
 * `lastUpdated` i to ono wraca przy odczycie.
 */
export function serializeLearningProfile(profile: LearningProfile, createdAt?: string) {
  const now = new Date().toISOString();
  return {
    studentId: profile.studentId,
    baseLevel: profile.baseLevel,
    currentLevel: profile.currentLevel,
    totalAttempts: profile.totalAttempts,
    totalCorrect: profile.totalCorrect,
    byLevel: profile.byLevel || {},
    byExerciseType: profile.byExerciseType || {},
    recentOutcomes: profile.recentOutcomes || [],
    attemptsSinceLevelChange: profile.attemptsSinceLevelChange || 0,
    recentMistakes: profile.recentMistakes || [],
    levelHistory: profile.levelHistory || [],
    lastUpdated: profile.lastUpdated || profile.updatedAt || now,
    createdAt: profile.createdAt || createdAt || profile.updatedAt || now,
  };
}

export function deserializeLearningProfile(
  studentId: string,
  stored: Partial<LearningProfile>,
  baseLevel?: string
): LearningProfile {
  const fallbackLevel = normalizeLevel(baseLevel);
  const now = new Date().toISOString();
  const profile = createProfile(
    studentId,
    fallbackLevel,
    stored.lastUpdated || stored.updatedAt || now
  );
  return {
    ...profile,
    ...stored,
    studentId,
    baseLevel: fallbackLevel,
    currentLevel: normalizeLevel(stored.currentLevel, fallbackLevel),
    byLevel: stored.byLevel || {},
    byExerciseType: stored.byExerciseType || {},
    recentOutcomes: stored.recentOutcomes || [],
    recentMistakes: stored.recentMistakes || [],
    levelHistory: stored.levelHistory || [],
    lastUpdated: stored.lastUpdated || stored.updatedAt || now,
    createdAt: stored.createdAt || now,
  };
}


import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AreaScore,
  CONFIDENCE_THRESHOLD,
  ENGINE_VERSION,
  EXERCISE_TYPES_V2,
  ExerciseContractV2,
  MASTERY_STATES,
  MAX_ATTEMPTS,
  MAX_REGENERATIONS,
  MasteryState,
  RUBRIC_WEIGHTS,
  RubricScores,
  hintForAttempt,
  isExerciseContractV2,
  isPassingAttempt,
  isRubricScores,
  isV2Task,
  resolveMastery,
  shouldRevealModelAnswer,
  usedTargetMaterial,
  weightedScore,
} from '../services/homeworkV2/contracts';

/**
 * Testy zamrożonego kontraktu.
 *
 * Kontrakt jest zamrożony w tym sensie, że jego zmiana zmienia ocenę już
 * zapisanych odpowiedzi. Te testy mają dzwonić, gdy ktoś przestawi wagę,
 * próg albo drabinkę podpowiedzi bez świadomej decyzji — nie mają sprawdzać,
 * czy TypeScript działa.
 */

const scores = (meaning: AreaScore, targetMaterial: AreaScore, accuracy: AreaScore): RubricScores => ({
  meaning,
  targetMaterial,
  accuracy,
});

const validContract = (): ExerciseContractV2 => ({
  id: 'ex-1',
  engineVersion: ENGINE_VERSION,
  schemaVersion: '2.0.0',
  promptVersion: 'hw-v2-2026-09-12',
  modelVersion: 'gpt-5.6-luna',
  teacherId: 'teacher-1',
  studentId: 'student-1',
  mode: 'training',
  exerciseType: 'micro_translation',
  responseMode: 'text',
  sourceLanguage: 'pl',
  targetLanguage: 'en',
  cefr: 'B1',
  difficulty: 3,
  learningObjective: 'used to — nawyk w przeszłości',
  content: 'Kiedyś dojeżdżałem do pracy rowerem.',
  instruction: 'Przetłumacz zdanie, używając konstrukcji z lekcji.',
  modelAnswer: 'I used to commute to work by bike.',
  acceptedVariants: ['I used to cycle to work.', 'I used to ride my bike to work.'],
  requiredMaterial: ['used to'],
  commonMistakes: ['I was used to commute', 'I use to commute'],
  hintSmall: 'Zacznij od „I used to…".',
  hintLarge: 'I used to ___ to work by ___.',
  sourceRefs: [{ kind: 'lessonRecord', id: 'lesson-42', block: 'grammar', label: 'lekcja' }],
  validation: {
    passed: true,
    score: 0.91,
    failedChecks: [],
    regenerationCount: 0,
    modelVersion: 'gpt-5.6-luna',
    checkedAt: '2026-09-12T10:00:00.000Z',
  },
  requiresTeacherReview: false,
  createdAt: '2026-09-12T10:00:00.000Z',
});

// --- wersjonowanie i stałe ---------------------------------------------------

test('wagi rubryki sumują się do 100 i trzymają podział 40/40/20', () => {
  assert.equal(RUBRIC_WEIGHTS.meaning, 40);
  assert.equal(RUBRIC_WEIGHTS.targetMaterial, 40);
  assert.equal(RUBRIC_WEIGHTS.accuracy, 20);
  const total = Object.values(RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test('zlecenie obejmuje dokładnie trzy typy — ani mniej, ani więcej', () => {
  assert.deepEqual([...EXERCISE_TYPES_V2], ['micro_translation', 'fix_sentence', 'gap_from_context']);
});

test('stany opanowania są trzy i w tej kolejności', () => {
  assert.deepEqual([...MASTERY_STATES], ['nowe', 'ćwiczymy', 'opanowane']);
});

test('progi z decyzji produktowej nie zmieniły się po cichu', () => {
  assert.equal(CONFIDENCE_THRESHOLD, 0.6);
  assert.equal(MAX_ATTEMPTS, 3);
  assert.equal(MAX_REGENERATIONS, 2);
});

// --- scoring -----------------------------------------------------------------

test('wynik ważony liczy się z ocen obszarowych', () => {
  assert.equal(weightedScore(scores(1, 1, 1)), 100);
  assert.equal(weightedScore(scores(0, 0, 0)), 0);
  assert.equal(weightedScore(scores(1, 1, 0.5)), 90);
  assert.equal(weightedScore(scores(0.5, 0.5, 0.5)), 50);
});

test('literówka nie zeruje odpowiedzi — nadal jest zaliczona', () => {
  // Sens zachowany, cel użyty, drobiazg w poprawności.
  const withTypo = scores(1, 1, 0.5);
  assert.equal(isPassingAttempt(withTypo), true);
  assert.equal(weightedScore(withTypo), 90);
});

test('brak ćwiczonego materiału nie przechodzi, choćby zdanie było bez zarzutu', () => {
  const missedTarget = scores(1, 0, 1);
  assert.equal(usedTargetMaterial(missedTarget), false);
  assert.equal(isPassingAttempt(missedTarget), false);
});

test('częściowe użycie celu to za mało na zaliczenie próby', () => {
  assert.equal(isPassingAttempt(scores(1, 0.5, 1)), false);
});

test('złamana zrozumiałość nie przechodzi mimo trafionego celu', () => {
  assert.equal(isPassingAttempt(scores(1, 1, 0)), false);
});

// --- stan opanowania ---------------------------------------------------------

test('poprawna pierwsza próba daje opanowane', () => {
  const result = resolveMastery({
    scores: scores(1, 1, 1),
    confidence: 0.9,
    attemptNumber: 1,
    isCorrectionAfterModelAnswer: false,
    previousState: 'nowe',
  });
  assert.equal(result.state, 'opanowane');
  assert.equal(result.requiresTeacherReview, false);
});

test('poprawna druga próba to nadal ćwiczymy — kursant potrzebował podpowiedzi', () => {
  const result = resolveMastery({
    scores: scores(1, 1, 1),
    confidence: 0.9,
    attemptNumber: 2,
    isCorrectionAfterModelAnswer: false,
    previousState: 'nowe',
  });
  assert.equal(result.state, 'ćwiczymy');
});

test('poprawiona wersja po trzeciej próbie daje opanowane', () => {
  const result = resolveMastery({
    scores: scores(1, 1, 1),
    confidence: 0.75,
    attemptNumber: 3,
    isCorrectionAfterModelAnswer: true,
    previousState: 'ćwiczymy',
  });
  assert.equal(result.state, 'opanowane');
});

test('brak głównego celu daje najwyżej ćwiczymy, nigdy opanowane', () => {
  for (const attemptNumber of [1, 2, 3] as const) {
    const result = resolveMastery({
      scores: scores(1, 0, 1),
      confidence: 0.95,
      attemptNumber,
      isCorrectionAfterModelAnswer: attemptNumber === 3,
      previousState: 'nowe',
    });
    assert.equal(result.state, 'ćwiczymy', `próba ${attemptNumber}`);
  }
});

test('niska pewność nie karze: stan zostaje bez zmiany i idzie do lektora', () => {
  const previousStates: MasteryState[] = ['nowe', 'ćwiczymy', 'opanowane'];
  for (const previousState of previousStates) {
    const result = resolveMastery({
      scores: scores(0, 0, 0),
      confidence: 0.4,
      attemptNumber: 1,
      isCorrectionAfterModelAnswer: false,
      previousState,
    });
    assert.equal(result.state, previousState, `stan ${previousState} miał zostać nietknięty`);
    assert.equal(result.requiresTeacherReview, true);
  }
});

test('niska pewność nie nagradza też bezpodstawnie', () => {
  const result = resolveMastery({
    scores: scores(1, 1, 1),
    confidence: CONFIDENCE_THRESHOLD - 0.01,
    attemptNumber: 1,
    isCorrectionAfterModelAnswer: false,
    previousState: 'nowe',
  });
  assert.equal(result.state, 'nowe');
  assert.equal(result.requiresTeacherReview, true);
});

test('pewność dokładnie na progu jest już wiążąca', () => {
  const result = resolveMastery({
    scores: scores(1, 1, 1),
    confidence: CONFIDENCE_THRESHOLD,
    attemptNumber: 1,
    isCorrectionAfterModelAnswer: false,
    previousState: 'nowe',
  });
  assert.equal(result.state, 'opanowane');
  assert.equal(result.requiresTeacherReview, false);
});

// --- drabinka podpowiedzi ----------------------------------------------------

test('drabinka podpowiedzi jest zamrożona: 1 zero, 2 mała, 3 większa', () => {
  const contract = validContract();

  assert.deepEqual(hintForAttempt(contract, 1), { level: 'none', text: null });
  assert.deepEqual(hintForAttempt(contract, 2), { level: 'small', text: contract.hintSmall });
  assert.deepEqual(hintForAttempt(contract, 3), { level: 'large', text: contract.hintLarge });
});

test('wzorzec pokazujemy dopiero po trzeciej próbie', () => {
  assert.equal(shouldRevealModelAnswer(1), false);
  assert.equal(shouldRevealModelAnswer(2), false);
  assert.equal(shouldRevealModelAnswer(3), true);
});

// --- strażniki typów ---------------------------------------------------------

test('poprawny kontrakt przechodzi walidację', () => {
  assert.equal(isExerciseContractV2(validContract()), true);
});

test('kontrakt bez celu, wzorca lub źródła jest odrzucany', () => {
  const withoutObjective = { ...validContract(), learningObjective: '   ' };
  const withoutModelAnswer = { ...validContract(), modelAnswer: '' };
  const withoutSources = { ...validContract(), sourceRefs: [] };
  const withoutRequiredMaterial = { ...validContract(), requiredMaterial: [] };

  assert.equal(isExerciseContractV2(withoutObjective), false);
  assert.equal(isExerciseContractV2(withoutModelAnswer), false);
  assert.equal(isExerciseContractV2(withoutSources), false);
  assert.equal(isExerciseContractV2(withoutRequiredMaterial), false);
});

test('kontrakt bez teacherId nie przechodzi — izolacja tenantowa od pierwszego dnia', () => {
  const { teacherId, ...withoutTeacher } = validContract();
  assert.equal(isExerciseContractV2(withoutTeacher), false);
});

test('adresat musi być dokładnie jeden: kursant albo grupa', () => {
  const both = { ...validContract(), groupId: 'group-1' };
  const { studentId, ...neither } = validContract();

  assert.equal(isExerciseContractV2(both), false);
  assert.equal(isExerciseContractV2(neither), false);
  assert.equal(isExerciseContractV2({ ...neither, groupId: 'group-1' }), true);
});

test('typ spoza trzech objętych zleceniem jest odrzucany', () => {
  // „Ułóż i odtwórz" zostaje w kanonie produktu, ale nie w tym kodzie.
  const outOfScope = { ...validContract(), exerciseType: 'rebuild_sentence' };
  assert.equal(isExerciseContractV2(outOfScope), false);
});

test('zadanie podszywające się pod v1 jest odrzucane', () => {
  const v1 = { ...validContract(), engineVersion: 1 };
  assert.equal(isExerciseContractV2(v1), false);
});

test('walidacja po więcej niż dwóch regeneracjach jest odrzucana', () => {
  const contract = validContract();
  const tooManyRegenerations = {
    ...contract,
    validation: { ...contract.validation, regenerationCount: MAX_REGENERATIONS + 1 },
  };
  assert.equal(isExerciseContractV2(tooManyRegenerations), false);
});

test('oceny obszarowe spoza skali 0 / 0,5 / 1 są odrzucane', () => {
  assert.equal(isRubricScores({ meaning: 1, targetMaterial: 0.5, accuracy: 0 }), true);
  assert.equal(isRubricScores({ meaning: 0.73, targetMaterial: 1, accuracy: 1 }), false);
  assert.equal(isRubricScores({ meaning: 1, targetMaterial: 1 }), false);
  assert.equal(isRubricScores(null), false);
});

// --- zgodność z v1 -----------------------------------------------------------

test('rozpoznanie zestawu v2 chroni ekrany v1 przed nieznanym zadaniem', () => {
  assert.equal(isV2Task({ engineVersion: 2, sentences: [] }), true);
  assert.equal(isV2Task({ sentences: [] }), false);
  assert.equal(isV2Task({ engineVersion: 1 }), false);
  assert.equal(isV2Task(null), false);
  assert.equal(isV2Task(undefined), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AttemptNumber,
  CONFIDENCE_THRESHOLD,
  ENGINE_VERSION,
  ExerciseContractV2,
  MAX_ATTEMPTS,
  MasteryState,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from '../services/homeworkV2/contracts';
import { gradeAttempt } from '../functions/src/homeworkV2/gradingEngine';
import { composeFeedback } from '../functions/src/homeworkV2/feedbackComposer';
import type { ModelCall, ModelResponse } from '../functions/src/homeworkV2/openai';

/**
 * Złoty zbiór oceniania.
 *
 * Cztery przypadki wymagane przez zlecenie — wariant naturalny, literówka,
 * brak celu i niski confidence — plus awaria modelu. Model jest podstawiany,
 * więc testy sprawdzają REGUŁY silnika, a nie jakość GPT.
 */

const modelReturning = (data: unknown): ModelCall => async (): Promise<ModelResponse> => ({
  data,
  modelUsed: 'gpt-5.6-luna',
  latencyMs: 1,
});

const failingModel: ModelCall = async () => {
  throw new Error('OpenAI niedostępne');
};

const contract = (): ExerciseContractV2 => ({
  id: 'ex-1',
  engineVersion: ENGINE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  promptVersion: PROMPT_VERSION,
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
  instruction: 'Przetłumacz zdanie.',
  modelAnswer: 'I used to commute to work by bike.',
  acceptedVariants: ['I used to cycle to work.'],
  requiredMaterial: ['used to'],
  commonMistakes: ['I was used to commute'],
  hintSmall: 'Zacznij od „I used to…".',
  hintLarge: 'I used to ___ to work by ___.',
  sourceRefs: [{ kind: 'lessonRecord', id: 'lesson-1', label: 'lekcja' }],
  validation: {
    passed: true,
    score: 0.9,
    failedChecks: [],
    regenerationCount: 0,
    modelVersion: 'gpt-5.6-luna',
    checkedAt: '2026-09-12T10:00:00.000Z',
  },
  requiresTeacherReview: false,
  createdAt: '2026-09-12T10:00:00.000Z',
});

const grade = (
  scores: { meaning: number; targetMaterial: number; accuracy: number },
  confidence: number,
  attemptNumber: AttemptNumber = 1,
  previousState: MasteryState = 'nowe',
  isCorrectionAfterModelAnswer = false
) =>
  gradeAttempt({
    contract: contract(),
    answer: 'I used to commute to work by bike.',
    attemptNumber,
    isCorrectionAfterModelAnswer,
    previousState,
    call: modelReturning({
      ...scores,
      confidence,
      rationale: { meaning: 'ok', targetMaterial: 'ok', accuracy: 'ok' },
    }),
  });

// --- złoty zbiór -------------------------------------------------------------

test('ZŁOTY ZBIÓR: wariant naturalny dostaje pełne punkty i opanowane', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, 0.9);

  assert.equal(verdict.weightedScore, 100);
  assert.equal(verdict.masteryState, 'opanowane');
  assert.equal(verdict.requiresTeacherReview, false);
});

test('ZŁOTY ZBIÓR: literówka nie zeruje odpowiedzi ani nie blokuje opanowanego', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 0.5 }, 0.85);

  assert.equal(verdict.weightedScore, 90);
  assert.equal(verdict.masteryState, 'opanowane');
});

test('ZŁOTY ZBIÓR: brak ćwiczonego materiału to maksymalnie ćwiczymy', async () => {
  // Zdanie bez zarzutu gramatycznie, ale omijające „used to".
  const verdict = await grade({ meaning: 1, targetMaterial: 0, accuracy: 1 }, 0.95);

  assert.equal(verdict.masteryState, 'ćwiczymy');
  assert.notEqual(verdict.masteryState, 'opanowane');
});

test('ZŁOTY ZBIÓR: niska pewność nie karze i oddaje sprawę lektorowi', async () => {
  const verdict = await grade({ meaning: 0, targetMaterial: 0, accuracy: 0 }, 0.3, 1, 'opanowane');

  // Stan sprzed próby zostaje nietknięty — kursant nic nie traci.
  assert.equal(verdict.masteryState, 'opanowane');
  assert.equal(verdict.requiresTeacherReview, true);
});

// --- odporność ---------------------------------------------------------------

test('awaria modelu nie karze kursanta — stan bez zmiany, sprawa do lektora', async () => {
  const verdict = await gradeAttempt({
    contract: contract(),
    answer: 'I used to commute by bike.',
    attemptNumber: 1,
    isCorrectionAfterModelAnswer: false,
    previousState: 'ćwiczymy',
    call: failingModel,
  });

  assert.equal(verdict.confidence, 0);
  assert.equal(verdict.masteryState, 'ćwiczymy');
  assert.equal(verdict.requiresTeacherReview, true);
  assert.equal(verdict.modelVersion, 'unavailable');
});

test('oceny spoza skali są przyciągane do 0 / 0,5 / 1', async () => {
  const verdict = await grade({ meaning: 0.9, targetMaterial: 0.4, accuracy: 0.1 }, 0.8);

  assert.equal(verdict.rubricScores.meaning, 1);
  assert.equal(verdict.rubricScores.targetMaterial, 0.5);
  assert.equal(verdict.rubricScores.accuracy, 0);
});

test('pewność jest przycinana do zakresu 0–1', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, 5);
  assert.equal(verdict.confidence, 1);
});

test('werdykt zapisuje wersję schematu, którą go wystawiono', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, 0.9);
  assert.equal(verdict.schemaVersion, SCHEMA_VERSION);
});

// --- próby i drabinka --------------------------------------------------------

test('poprawiona wersja po trzeciej próbie daje opanowane', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, 0.8, 3, 'ćwiczymy', true);
  assert.equal(verdict.masteryState, 'opanowane');
});

test('poprawna druga próba zostaje przy ćwiczymy', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, 0.9, 2);
  assert.equal(verdict.masteryState, 'ćwiczymy');
});

test('pewność dokładnie na progu jest wiążąca', async () => {
  const verdict = await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, CONFIDENCE_THRESHOLD);
  assert.equal(verdict.masteryState, 'opanowane');
  assert.equal(verdict.requiresTeacherReview, false);
});

// --- feedback ----------------------------------------------------------------

test('feedback podaje podpowiedź z kontraktu, nie od modelu', async () => {
  const c = contract();
  const feedback = await composeFeedback({
    contract: c,
    verdict: await grade({ meaning: 0.5, targetMaterial: 0.5, accuracy: 1 }, 0.8),
    answer: 'I commute to work by bike.',
    attemptNumber: 1,
    call: modelReturning({ message: 'Sens jest zachowany. Teraz dodaj konstrukcję z lekcji.' }),
  });

  // Po próbie 1 następna podpowiedź to hintSmall — dokładnie z kontraktu.
  assert.equal(feedback.nextHint, c.hintSmall);
  assert.equal(feedback.revealModelAnswer, false);
  assert.equal(feedback.attemptsLeft, MAX_ATTEMPTS - 1);
});

test('po trzeciej próbie pokazujemy wzorzec i nie dajemy kolejnej podpowiedzi', async () => {
  const c = contract();
  const feedback = await composeFeedback({
    contract: c,
    verdict: await grade({ meaning: 0.5, targetMaterial: 0, accuracy: 0.5 }, 0.8, 3),
    answer: 'I commute by bike.',
    attemptNumber: 3,
    call: modelReturning({ message: 'Zobacz wzorzec i napisz poprawioną wersję.' }),
  });

  assert.equal(feedback.revealModelAnswer, true);
  assert.equal(feedback.modelAnswer, c.modelAnswer);
  assert.equal(feedback.nextHint, null);
  assert.equal(feedback.attemptsLeft, 0);
});

test('awaria modelu feedbacku nie zostawia kursanta z pustym ekranem', async () => {
  const feedback = await composeFeedback({
    contract: contract(),
    verdict: await grade({ meaning: 1, targetMaterial: 1, accuracy: 1 }, 0.9),
    answer: 'I used to commute to work by bike.',
    attemptNumber: 1,
    call: failingModel,
  });

  assert.ok(feedback.message.length > 0);
  assert.equal(feedback.masteryState, 'opanowane');
});

test('feedback dla kursanta nie zawiera procentu ani wyniku liczbowego', async () => {
  const feedback = await composeFeedback({
    contract: contract(),
    verdict: await grade({ meaning: 1, targetMaterial: 1, accuracy: 0.5 }, 0.9),
    answer: 'I used to comute to work by bike.',
    attemptNumber: 1,
    call: modelReturning({ message: 'Znaczenie jest zachowane. Popraw jedną literówkę.' }),
  });

  // Kontrakt zwracany kursantowi nie ma pola z wynikiem — to celowe (§3.1).
  // TypeScript pilnuje tego na etapie kompilacji; ten test broni przed
  // dorzuceniem wyniku do odpowiedzi przy okazji późniejszej zmiany.
  assert.equal((feedback as unknown as Record<string, unknown>).weightedScore, undefined);
  assert.equal((feedback as unknown as Record<string, unknown>).rubricScores, undefined);
  assert.ok(!/%/.test(feedback.message));
});

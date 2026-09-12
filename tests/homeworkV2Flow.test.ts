import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AttemptNumber,
  ENGINE_VERSION,
  EXERCISE_TYPES_V2,
  ExerciseContractV2,
  ExerciseTypeV2,
  HINT_PROTOCOL,
  MAX_ATTEMPTS,
  MAX_REGENERATIONS,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  hintForAttempt,
  shouldRevealModelAnswer,
} from '../services/homeworkV2/contracts';
import {
  buildV2TaskPayload,
  newHomeworkSetId,
  selectSendableExercises,
} from '../functions/src/homeworkV2/assignment';
import { isHomeworkEngineV2Enabled } from '../functions/src/homeworkV2/flag';
import { validateAll } from '../functions/src/homeworkV2/qualityValidator';
import { generateExercises } from '../functions/src/homeworkV2/exerciseGenerator';
import { planExercises } from '../functions/src/homeworkV2/exercisePlanner';
import type { AssembledContext } from '../functions/src/homeworkV2/contextAssembler';
import type { DraftExercise } from '../functions/src/homeworkV2/exerciseGenerator';
import type { ModelCall, ModelResponse } from '../functions/src/homeworkV2/openai';

/**
 * Testy obowiązkowe ze zlecenia §18, których nie pokrywają pozostałe pliki:
 * drabinka podpowiedzi dla KAŻDEGO z trzech typów, grupa (wspólna treść,
 * osobne dokumenty), flaga on/off, awaria AI i sieci oraz reguła, że zadanie
 * po dwóch nieudanych walidacjach nie idzie auto-wysyłką.
 */

const modelReturning = (data: unknown): ModelCall => async (): Promise<ModelResponse> => ({
  data,
  modelUsed: 'gpt-5.6-luna',
  latencyMs: 1,
});

const failingModel: ModelCall = async () => {
  throw new Error('ECONNRESET');
};

const contract = (overrides: Partial<ExerciseContractV2> = {}): ExerciseContractV2 => ({
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
  learningObjective: 'used to',
  content: 'Kiedyś dojeżdżałem rowerem.',
  instruction: 'Przetłumacz zdanie.',
  modelAnswer: 'I used to commute by bike.',
  acceptedVariants: [],
  requiredMaterial: ['used to'],
  commonMistakes: [],
  hintSmall: 'mała podpowiedź',
  hintLarge: 'większa podpowiedź',
  sourceRefs: [{ kind: 'lessonRecord', id: 'lesson-1' }],
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
  ...overrides,
});

const context = (): AssembledContext => ({
  lessons: [
    {
      lessonId: 'lesson-1',
      topic: 'Nawyki',
      date: '2026-09-10',
      vocabulary: 'commute - dojeżdżać',
      corrections: 'I was used to commute → I used to commute',
      summary: '',
      goals: '',
    },
  ],
  student: { cefr: 'B1', recentMistakes: [] },
  lessonIds: ['lesson-1'],
});

const draft = (type: ExerciseTypeV2): DraftExercise => ({
  exerciseType: type,
  learningObjective: 'used to',
  content: 'treść',
  instruction: 'polecenie',
  modelAnswer: 'wzorzec',
  acceptedVariants: [],
  requiredMaterial: ['used to'],
  commonMistakes: [],
  hintSmall: `mała dla ${type}`,
  hintLarge: `większa dla ${type}`,
  sourceLessonIndex: 1,
});

// ———————————————— Drabinka podpowiedzi dla każdego z 3 typów ————————————————

for (const type of EXERCISE_TYPES_V2) {
  test(`3 próby i zamrożona drabinka podpowiedzi — ${type}`, () => {
    const c = contract({
      exerciseType: type,
      hintSmall: `mała dla ${type}`,
      hintLarge: `większa dla ${type}`,
    });

    // Próba 1: zero podpowiedzi.
    assert.deepEqual(hintForAttempt(c, 1), { level: 'none', text: null });
    // Próba 2: mała, prosto z kontraktu.
    assert.deepEqual(hintForAttempt(c, 2), { level: 'small', text: `mała dla ${type}` });
    // Próba 3: większa, też z kontraktu.
    assert.deepEqual(hintForAttempt(c, 3), { level: 'large', text: `większa dla ${type}` });

    // Wzorzec dopiero po trzeciej.
    assert.equal(shouldRevealModelAnswer(1), false);
    assert.equal(shouldRevealModelAnswer(2), false);
    assert.equal(shouldRevealModelAnswer(3), true);
  });

  test(`podpowiedź nie zdradza pełnej odpowiedzi — ${type}`, () => {
    const c = contract({ exerciseType: type });
    for (const attempt of [2, 3] as AttemptNumber[]) {
      const hint = hintForAttempt(c, attempt).text || '';
      assert.notEqual(
        hint.trim().toLowerCase(),
        c.modelAnswer.trim().toLowerCase(),
        'podpowiedź nie może być całą odpowiedzią'
      );
    }
  });
}

test('protokół podpowiedzi opisuje dokładnie trzy typy', () => {
  assert.deepEqual(Object.keys(HINT_PROTOCOL).sort(), [...EXERCISE_TYPES_V2].sort());
});

// ———————————————— Grupa: wspólna treść, osobne dokumenty ————————————————

test('grupa dostaje identyczną treść w osobnych dokumentach', () => {
  const exercises = [contract({ id: 'ex-1' }), contract({ id: 'ex-2' })];
  const homeworkSetId = newHomeworkSetId();
  const createdAt = '2026-09-12T12:00:00.000Z';

  const ala = buildV2TaskPayload({
    studentUid: 'ala',
    exercises,
    teacherId: 'teacher-1',
    title: 'Praca domowa',
    groupId: 'grupa-1',
    homeworkSetId,
    createdAt,
  });
  const bob = buildV2TaskPayload({
    studentUid: 'bob',
    exercises,
    teacherId: 'teacher-1',
    title: 'Praca domowa',
    groupId: 'grupa-1',
    homeworkSetId,
    createdAt,
  });

  // Wspólny zestaw.
  assert.equal(ala.homeworkSetId, bob.homeworkSetId);
  assert.equal(ala.groupId, 'grupa-1');

  // Identyczna treść zadań.
  const alaIds = (ala.sentences as ExerciseContractV2[]).map((e) => e.id);
  const bobIds = (bob.sentences as ExerciseContractV2[]).map((e) => e.id);
  assert.deepEqual(alaIds, bobIds);

  // Osobny właściciel — stąd biorą się osobne próby, ocena i profil.
  assert.equal(ala.studentUid, 'ala');
  assert.equal(bob.studentUid, 'bob');
  assert.notEqual(ala.studentUid, bob.studentUid);
});

test('identyfikatory zestawów nie powtarzają się', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newHomeworkSetId()));
  assert.equal(ids.size, 200);
});

// ———————————————— Zgodność z v1 przy zapisie ————————————————

test('dokument v2 zachowuje pola, bez których v1 się psuje', () => {
  const payload = buildV2TaskPayload({
    studentUid: 'ala',
    exercises: [contract(), contract({ id: 'ex-2' })],
    teacherId: 'teacher-1',
    title: 'Praca domowa',
    homeworkSetId: 'hwset-1',
    createdAt: '2026-09-12T12:00:00.000Z',
  });

  // Wyzwalacz mailowy liczy sentences.length jako liczbę zadań w mailu.
  assert.ok(Array.isArray(payload.sentences));
  assert.equal((payload.sentences as unknown[]).length, 2);

  // Bez tego notifyStudentOnHomework wysłałby maila za plecami lektora.
  assert.equal(payload.skipAutoEmail, true);
  assert.equal(payload.manualEmailConfirmationRequired, true);

  // Reguła `create` w firestore.rules wymaga niepustego studentUid.
  assert.equal(payload.studentUid, 'ala');
  assert.equal(payload.studentId, 'ala');
  assert.deepEqual(payload.studentIds, ['ala']);

  // Znacznik silnika — po nim ekrany v1 wiedzą, żeby ten dokument pominąć.
  assert.equal(payload.engineVersion, ENGINE_VERSION);
});

// ———————————————— Zadanie po 2 nieudanych walidacjach ————————————————

test('zadanie po dwóch nieudanych walidacjach NIE idzie auto-wysyłką', async () => {
  // Walidator odrzuca zawsze, regeneracja zawsze coś zwraca.
  let regenerations = 0;
  const results = await validateAll({
    context: context(),
    drafts: [draft('micro_translation')],
    call: modelReturning({ passed: false, score: 0.2, failedChecks: ['naturalness_pl'] }),
    regenerate: async (d) => {
      regenerations += 1;
      return d;
    },
  });

  assert.equal(regenerations, MAX_REGENERATIONS, 'dokładnie dwie regeneracje, nie więcej');
  assert.equal(results[0].requiresTeacherReview, true);
  assert.equal(results[0].validation.regenerationCount, MAX_REGENERATIONS);

  // I najważniejsze: taki kontrakt nie przechodzi przez bramkę wysyłki.
  const blocked = contract({ requiresTeacherReview: true });
  assert.deepEqual(selectSendableExercises([blocked]), []);
});

test('bramka wysyłki przepuszcza tylko poprawne kontrakty bez uwag', () => {
  const ok = contract({ id: 'ok' });
  const blocked = contract({ id: 'blocked', requiresTeacherReview: true });
  const notAContract = { id: 'śmieć', content: 'coś' };

  const selected = selectSendableExercises([ok, blocked, notAContract, null, 'tekst']);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'ok');
});

test('regeneracja, która nic nie zwraca, przerywa pętlę zamiast się zapętlać', async () => {
  const results = await validateAll({
    context: context(),
    drafts: [draft('fix_sentence')],
    call: modelReturning({ passed: false, score: 0.1, failedChecks: ['single_goal'] }),
    regenerate: async () => null,
  });

  assert.equal(results[0].requiresTeacherReview, true);
});

// ———————————————— Flaga on/off ————————————————

test('flaga jest wyłączona przy braku zmiennej i przy każdej wartości poza "true"', () => {
  assert.equal(isHomeworkEngineV2Enabled({}), false);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: '' }), false);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: 'false' }), false);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: '0' }), false);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: 'yes' }), false);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: '1' }), false);
});

test('flaga włącza się wyłącznie wartością "true", niezależnie od wielkości liter', () => {
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: 'true' }), true);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: 'TRUE' }), true);
  assert.equal(isHomeworkEngineV2Enabled({ HOMEWORK_ENGINE_V2: '  true  ' }), true);
});

// ———————————————— Awaria AI i sieci ————————————————

test('awaria sieci przy generowaniu nie zapisuje połowicznego zestawu', async () => {
  const plan = planExercises({ context: context(), itemCount: 3 });

  await assert.rejects(
    () => generateExercises({ context: context(), slots: plan.slots, call: failingModel }),
    /ECONNRESET/
  );
});

test('model zwracający śmieci zamiast zadań daje pusty wynik, nie wysypkę', async () => {
  const plan = planExercises({ context: context(), itemCount: 3 });

  const result = await generateExercises({
    context: context(),
    slots: plan.slots,
    call: modelReturning({ exercises: [{ nonsens: true }, 'tekst', null] }),
  });

  assert.equal(result.drafts.length, 0);
  assert.equal(result.missingSlots, 3);
});

test('model zwracający mniej zadań niż zamówiono jest zgłaszany, nie ukrywany', async () => {
  const plan = planExercises({ context: context(), itemCount: 3 });

  const result = await generateExercises({
    context: context(),
    slots: plan.slots,
    call: modelReturning({
      exercises: [
        {
          exerciseType: 'micro_translation',
          learningObjective: 'used to',
          content: 'x',
          modelAnswer: 'y',
          requiredMaterial: ['used to'],
        },
      ],
    }),
  });

  assert.equal(result.drafts.length, 1);
  assert.equal(result.missingSlots, 2);
});

test('awaria walidatora nie przepuszcza zadania po cichu', async () => {
  await assert.rejects(() =>
    validateAll({
      context: context(),
      drafts: [draft('gap_from_context')],
      call: failingModel,
      regenerate: async (d) => d,
    })
  );
});

// ———————————————— Liczba prób ————————————————

test('trening daje dokładnie trzy próby', () => {
  assert.equal(MAX_ATTEMPTS, 3);
  // Czwarte podejście to poprawiona wersja po wzorcu, nie czwarta próba.
  assert.equal(shouldRevealModelAnswer(MAX_ATTEMPTS as AttemptNumber), true);
});

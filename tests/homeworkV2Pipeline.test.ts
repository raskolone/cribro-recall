import assert from 'node:assert/strict';
import test from 'node:test';

import { AssembledContext, stripPronunciationLines } from '../functions/src/homeworkV2/contextAssembler';
import { planExercises, summarizePlan } from '../functions/src/homeworkV2/exercisePlanner';
import { parseDraft } from '../functions/src/homeworkV2/exerciseGenerator';
import {
  V2_MODEL_CASCADE,
  extractJson,
  mapToActualOpenAIModel,
} from '../functions/src/homeworkV2/openai';
import { validateDraft, VALIDATION_PASS_THRESHOLD } from '../functions/src/homeworkV2/qualityValidator';
import type { ModelCall, ModelResponse } from '../functions/src/homeworkV2/openai';
import type { DraftExercise } from '../functions/src/homeworkV2/exerciseGenerator';

/**
 * Testy pipeline'u generowania.
 *
 * Model jest podstawiany — żaden test nie dotyka sieci ani klucza. Chodzi
 * o zachowanie silnika wobec odpowiedzi modelu, a nie o jakość samego modelu.
 */

const modelReturning = (data: unknown): ModelCall => async (): Promise<ModelResponse> => ({
  data,
  modelUsed: 'gpt-5.6-luna',
  latencyMs: 1,
});

const context = (overrides: Partial<AssembledContext> = {}): AssembledContext => ({
  lessons: [
    {
      lessonId: 'lesson-1',
      topic: 'Nawyki w przeszłości',
      date: '2026-09-10',
      vocabulary: 'commute - dojeżdżać\nused to - kiedyś (nawyk)',
      corrections: 'I was used to commute → I used to commute',
      summary: 'Rozmowa o dawnych nawykach.',
      goals: 'Utrwalić used to.',
    },
  ],
  student: { cefr: 'B1', recentMistakes: [] },
  lessonIds: ['lesson-1'],
  ...overrides,
});

const draft = (overrides: Partial<DraftExercise> = {}): DraftExercise => ({
  exerciseType: 'micro_translation',
  learningObjective: 'used to',
  content: 'Kiedyś dojeżdżałem rowerem.',
  instruction: 'Przetłumacz zdanie.',
  modelAnswer: 'I used to commute by bike.',
  acceptedVariants: ['I used to cycle.'],
  requiredMaterial: ['used to'],
  commonMistakes: ['I was used to commute'],
  hintSmall: 'Zacznij od „I used to…".',
  hintLarge: 'I used to ___ by ___.',
  sourceLessonIndex: 1,
  ...overrides,
});

// --- kaskada modeli ----------------------------------------------------------

test('kaskada v2 nie zawiera żadnego modelu spoza OpenAI', () => {
  for (const model of V2_MODEL_CASCADE) {
    assert.ok(!model.includes('gemini'), `${model} nie ma prawa być w kaskadzie v2`);
    assert.ok(!model.includes('deepseek'));
    assert.ok(!model.includes('claude'));
  }
  assert.equal(V2_MODEL_CASCADE.length, 2);
});

test('nazwa logiczna modelu tłumaczy się tak samo jak w server.ts', () => {
  // server.ts:4 — „GPT 5.6 Luna" to poziom, nie endpoint.
  assert.equal(mapToActualOpenAIModel('gpt-5.6-luna'), 'gpt-4o');
  assert.equal(mapToActualOpenAIModel('gpt-5.6'), 'gpt-4o');
  assert.equal(mapToActualOpenAIModel('openai/gpt-4o-mini'), 'gpt-4o-mini');
  assert.equal(mapToActualOpenAIModel('cokolwiek'), 'gpt-4o-mini');
});

// --- parsowanie odpowiedzi ---------------------------------------------------

test('JSON owinięty w ```json nie wywraca generowania', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('Proszę bardzo: {"a":1} gotowe'), { a: 1 });
});

test('pusta odpowiedź modelu jest błędem, nie pustym obiektem', () => {
  assert.throws(() => extractJson(''));
  assert.throws(() => extractJson('bez żadnego jsona'));
});

// --- odsiewanie wymowy -------------------------------------------------------

test('wymowa nie wchodzi do paliwa ćwiczeń tekstowych', () => {
  const input = [
    'I was used to commute → I used to commute',
    'Wymowa: comfortable /ˈkʌmftəbəl/',
    'she dont → she doesn\'t',
    'Akcent w słowie "develop" pada na drugą sylabę',
  ].join('\n');

  const result = stripPronunciationLines(input);

  assert.ok(result.includes('used to commute'));
  assert.ok(result.includes("she doesn't"));
  assert.ok(!result.includes('comfortable'), 'linia o wymowie miała wypaść');
  assert.ok(!result.includes('Akcent'), 'linia o akcencie miała wypaść');
});

// --- planner -----------------------------------------------------------------

test('planner rozkłada typy naprzemiennie, a nie blokami', () => {
  const plan = planExercises({
    context: context(),
    requestedTypes: ['micro_translation', 'fix_sentence'],
    itemCount: 4,
  });

  assert.deepEqual(
    plan.slots.map((s) => s.exerciseType),
    ['micro_translation', 'fix_sentence', 'micro_translation', 'fix_sentence']
  );
});

test('planner nie zmienia liczby zadań ustawionej przez lektora — tylko ostrzega', () => {
  const plan = planExercises({
    context: context(),
    itemCount: 30,
    plannedMinutes: 5,
  });

  // Liczba zadań zostaje taka, jaką ustawił lektor. Silnik nie decyduje za niego.
  assert.equal(plan.slots.length, 30);
  assert.ok(plan.warnings.some((w) => w.includes('min')), 'miało paść ostrzeżenie o czasie');
});

test('planner ostrzega, gdy materiału jest mniej niż zamówionych zadań', () => {
  const plan = planExercises({ context: context(), itemCount: 25 });
  assert.ok(plan.warnings.some((w) => w.includes('pozycji materiału')));
});

test('planner ostrzega przy „Napraw zdanie" bez bloku korekt', () => {
  const bare = context({
    lessons: [{ ...context().lessons[0], corrections: '' }],
  });
  const plan = planExercises({ context: bare, requestedTypes: ['fix_sentence'], itemCount: 2 });
  assert.ok(plan.warnings.some((w) => w.includes('Napraw zdanie')));
});

test('planner odrzuca typ spoza trzech objętych zleceniem', () => {
  assert.throws(() =>
    planExercises({
      context: context(),
      requestedTypes: ['rebuild_sentence' as never],
      itemCount: 3,
    })
  );
});

test('podsumowanie planu liczy zadania per typ', () => {
  const plan = planExercises({ context: context(), itemCount: 3 });
  assert.deepEqual(summarizePlan(plan), {
    micro_translation: 1,
    fix_sentence: 1,
    gap_from_context: 1,
  });
});

// --- parsowanie zadań od modelu ---------------------------------------------

test('zadanie bez wzorca, celu lub materiału nie przechodzi', () => {
  assert.equal(parseDraft({ content: 'x', modelAnswer: 'y' }, 'micro_translation'), null);
  assert.equal(
    parseDraft({ content: 'x', modelAnswer: 'y', learningObjective: 'z', requiredMaterial: [] }, 'micro_translation'),
    null
  );
  assert.equal(parseDraft(null, 'micro_translation'), null);
  assert.equal(parseDraft('tekst zamiast obiektu', 'micro_translation'), null);
});

test('poprawne zadanie od modelu jest przyjmowane w całości', () => {
  const parsed = parseDraft(
    {
      exerciseType: 'fix_sentence',
      learningObjective: 'used to',
      content: 'I was used to commute by bike.',
      instruction: 'Popraw zdanie.',
      modelAnswer: 'I used to commute by bike.',
      acceptedVariants: ['I used to cycle to work.'],
      requiredMaterial: ['used to'],
      commonMistakes: ['was used to'],
      hintSmall: 'Błąd jest na początku.',
      hintLarge: 'Zły czas / zła konstrukcja.',
      sourceLessonIndex: 1,
    },
    'micro_translation'
  );

  assert.ok(parsed);
  assert.equal(parsed!.exerciseType, 'fix_sentence');
  assert.deepEqual(parsed!.requiredMaterial, ['used to']);
});

test('typ spoza odpowiedzi modelu spada na typ ze slotu', () => {
  const parsed = parseDraft(
    {
      learningObjective: 'used to',
      content: 'x',
      modelAnswer: 'y',
      requiredMaterial: ['used to'],
    },
    'gap_from_context'
  );
  assert.equal(parsed!.exerciseType, 'gap_from_context');
});

// --- walidator ---------------------------------------------------------------

test('walidator przepuszcza zadanie bez zarzutów i z wysokim wynikiem', async () => {
  const validation = await validateDraft(
    context(),
    draft(),
    modelReturning({ passed: true, score: 0.92, failedChecks: [] }),
    0
  );
  assert.equal(validation.passed, true);
  assert.equal(validation.regenerationCount, 0);
});

test('walidator nie wierzy deklaracji „passed", gdy są zarzuty', async () => {
  // Model bywa niekonsekwentny: mówi „przeszło" i wylicza, co nie gra.
  const validation = await validateDraft(
    context(),
    draft(),
    modelReturning({ passed: true, score: 0.95, failedChecks: ['naturalness_pl'] }),
    0
  );
  assert.equal(validation.passed, false);
  assert.deepEqual(validation.failedChecks, ['naturalness_pl']);
});

test('walidator nie przepuszcza wyniku poniżej progu', async () => {
  const validation = await validateDraft(
    context(),
    draft(),
    modelReturning({ passed: true, score: VALIDATION_PASS_THRESHOLD - 0.01, failedChecks: [] }),
    0
  );
  assert.equal(validation.passed, false);
});

test('wynik walidatora jest przycinany do zakresu 0–1', async () => {
  const tooHigh = await validateDraft(context(), draft(), modelReturning({ passed: true, score: 7 }), 0);
  const negative = await validateDraft(context(), draft(), modelReturning({ passed: false, score: -3 }), 0);
  assert.equal(tooHigh.score, 1);
  assert.equal(negative.score, 0);
});

test('walidator zapisuje, ile razy zadanie było przepisywane', async () => {
  const validation = await validateDraft(
    context(),
    draft(),
    modelReturning({ passed: true, score: 0.9, failedChecks: [] }),
    2
  );
  assert.equal(validation.regenerationCount, 2);
});

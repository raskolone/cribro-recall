import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_BLOCK_IDS, CANVAS_DURATION_BUDGETS, CanvasBlockId, CanvasModelItem, ScenarioCanvasV2 } from '../types/scenarioCanvas';
import {
  applyCanvasAuditorPatch,
  applyLessonRefresh,
  buildScenarioCanvas,
  computeApplicableCanvasBlockIds,
  getRejectedItemIds,
  validateCanvasAuditorOutput,
  validateCanvasPlannerOutput,
  validateCanvasRefreshOutput,
} from '../utils/scenarioCanvasValidation';

function validPlannerModel(applicableBlockIds: CanvasBlockId[]) {
  return {
    blocks: applicableBlockIds.map((blockId) => ({
      blockId,
      objective: `Cel bloku ${blockId}`,
      items: (blockId === 'main_topic'
        ? [
            { kind: 'question', text: 'Punkt główny 1' },
            { kind: 'question', text: 'Punkt główny 2' },
            { kind: 'rescue_question', text: 'Ratunkowe 1' },
            { kind: 'rescue_question', text: 'Ratunkowe 2' },
            { kind: 'wind_down_question', text: 'Pytanie zamykające' },
          ]
        : [
            { kind: 'question', text: `Punkt 1 dla ${blockId}` },
            { kind: 'task', text: `Punkt 2 dla ${blockId}` },
          ]) as CanvasModelItem[],
      ...(blockId === 'main_topic' ? { teacherNotes: ['Model odpowiedzi 1', 'Prompt ratunkowy'] } : {}),
    })),
  };
}

function makeCounterId() {
  let counter = 0;
  return () => `id-${counter++}`;
}

test('computeApplicableCanvasBlockIds: returning + gramatyka -> wszystkie 9 bloków', () => {
  const ids = computeApplicableCanvasBlockIds('returning', true);
  assert.deepEqual(ids, [...CANVAS_BLOCK_IDS]);
});

test('computeApplicableCanvasBlockIds: cold_start pomija older_lesson_refresh', () => {
  const ids = computeApplicableCanvasBlockIds('cold_start', true);
  assert.ok(!ids.includes('older_lesson_refresh'));
  assert.ok(ids.includes('grammar_review'));
});

test('computeApplicableCanvasBlockIds: brak gramatyki pomija grammar_review', () => {
  const ids = computeApplicableCanvasBlockIds('returning', false);
  assert.ok(!ids.includes('grammar_review'));
  assert.ok(ids.includes('older_lesson_refresh'));
});

test('validateCanvasPlannerOutput akceptuje poprawną odpowiedź', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  assert.doesNotThrow(() => validateCanvasPlannerOutput(validPlannerModel(applicable), applicable));
});

test('validateCanvasPlannerOutput odrzuca złą kolejność bloków', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  const model = validPlannerModel(applicable);
  const swapped = { blocks: [model.blocks[1], model.blocks[0], ...model.blocks.slice(2)] };
  assert.throws(() => validateCanvasPlannerOutput(swapped, applicable));
});

test('validateCanvasPlannerOutput odrzuca main_topic bez wind_down_question', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  const model = validPlannerModel(applicable);
  const mainTopic = model.blocks.find((b) => b.blockId === 'main_topic')!;
  mainTopic.items = mainTopic.items.filter((it) => it.kind !== 'wind_down_question');
  assert.throws(() => validateCanvasPlannerOutput(model, applicable));
});

test('validateCanvasPlannerOutput odrzuca main_topic z 1 rescue_question (potrzeba 2-3)', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  const model = validPlannerModel(applicable);
  const mainTopic = model.blocks.find((b) => b.blockId === 'main_topic')!;
  mainTopic.items = mainTopic.items.filter((it) => it.kind !== 'rescue_question').concat([{ kind: 'rescue_question', text: 'Jedyne ratunkowe' }]);
  assert.throws(() => validateCanvasPlannerOutput(model, applicable));
});

test('validateCanvasPlannerOutput odrzuca pusty punkt', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  const model = validPlannerModel(applicable);
  model.blocks[0].items[0].text = '   ';
  assert.throws(() => validateCanvasPlannerOutput(model, applicable));
});

test('buildScenarioCanvas: kolejność wszystkich 9 bloków zgodna z CANVAS_BLOCK_IDS, także pominiętych', () => {
  const applicable = computeApplicableCanvasBlockIds('cold_start', false);
  const canvas = buildScenarioCanvas(
    validPlannerModel(applicable),
    applicable,
    { studentId: 's1', durationMin: 60, mode: 'cold_start', generatedAt: '2026-09-20T10:00:00.000Z' },
    makeCounterId()
  );
  assert.deepEqual(canvas.blocks.map((b) => b.blockId), [...CANVAS_BLOCK_IDS]);
});

test('buildScenarioCanvas: grammar_review pomijany przy braku gramatyki (skipped:true, puste items)', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', false);
  const canvas = buildScenarioCanvas(
    validPlannerModel(applicable),
    applicable,
    { studentId: 's1', durationMin: 60, mode: 'returning', generatedAt: '2026-09-20T10:00:00.000Z' },
    makeCounterId()
  );
  const grammar = canvas.blocks.find((b) => b.blockId === 'grammar_review')!;
  assert.equal(grammar.skipped, true);
  assert.deepEqual(grammar.items, []);
  assert.equal(grammar.durationMin, 0);
});

test('buildScenarioCanvas: older_lesson_refresh pomijany przy cold starcie', () => {
  const applicable = computeApplicableCanvasBlockIds('cold_start', true);
  const canvas = buildScenarioCanvas(
    validPlannerModel(applicable),
    applicable,
    { studentId: 's1', durationMin: 45, mode: 'cold_start', generatedAt: '2026-09-20T10:00:00.000Z' },
    makeCounterId()
  );
  const refresh = canvas.blocks.find((b) => b.blockId === 'older_lesson_refresh')!;
  assert.equal(refresh.skipped, true);
});

test('buildScenarioCanvas: czasy bloków (bez lesson_goal) sumują się do durationMin dla obecnych bloków', () => {
  for (const duration of [45, 60, 90] as const) {
    const applicable = computeApplicableCanvasBlockIds('returning', true);
    const canvas = buildScenarioCanvas(
      validPlannerModel(applicable),
      applicable,
      { studentId: 's1', durationMin: duration, mode: 'returning', generatedAt: '2026-09-20T10:00:00.000Z' },
      makeCounterId()
    );
    const total = canvas.blocks.filter((b) => b.blockId !== 'lesson_goal').reduce((sum, b) => sum + b.durationMin, 0);
    assert.equal(total, duration);
    const goal = canvas.blocks.find((b) => b.blockId === 'lesson_goal')!;
    assert.equal(goal.durationMin, 0);
  }
});

test('buildScenarioCanvas: nadaje unikalne itemId, review pending, generation 1', () => {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  const canvas = buildScenarioCanvas(
    validPlannerModel(applicable),
    applicable,
    { studentId: 's1', durationMin: 60, mode: 'returning', generatedAt: '2026-09-20T10:00:00.000Z' },
    makeCounterId()
  );
  const allIds = canvas.blocks.flatMap((b) => b.items.map((it) => it.itemId));
  assert.equal(new Set(allIds).size, allIds.length);
  for (const item of canvas.blocks.flatMap((b) => b.items)) {
    assert.equal(item.review.state, 'pending');
    assert.equal(item.generation, 1);
  }
});

test('CANVAS_DURATION_BUDGETS ma dodatni budżet dla każdego bloku poza lesson_goal', () => {
  for (const duration of [45, 60, 90] as const) {
    for (const [blockId, minutes] of Object.entries(CANVAS_DURATION_BUDGETS[duration])) {
      assert.ok(minutes > 0, `${blockId} @ ${duration}min powinien mieć dodatni budżet`);
    }
  }
});

function makeCanvas(): ScenarioCanvasV2 {
  const applicable = computeApplicableCanvasBlockIds('returning', true);
  return buildScenarioCanvas(
    validPlannerModel(applicable),
    applicable,
    { studentId: 's1', durationMin: 60, mode: 'returning', generatedAt: '2026-09-20T10:00:00.000Z' },
    makeCounterId()
  );
}

test('validateCanvasAuditorOutput odrzuca patch dla obcego (nieistniejącego) itemId', () => {
  const canvas = makeCanvas();
  assert.throws(() => validateCanvasAuditorOutput({ patches: [{ itemId: 'not-real', text: 'x' }] }, canvas));
});

test('validateCanvasAuditorOutput akceptuje patch dla znanego itemId', () => {
  const canvas = makeCanvas();
  const realId = canvas.blocks[1].items[0].itemId;
  assert.doesNotThrow(() => validateCanvasAuditorOutput({ patches: [{ itemId: realId, text: 'Nowy tekst' }] }, canvas));
});

test('applyCanvasAuditorPatch podmienia wyłącznie wskazane teksty', () => {
  const canvas = makeCanvas();
  const target = canvas.blocks[1].items[0];
  const untouched = canvas.blocks[1].items[1].text;
  const patched = applyCanvasAuditorPatch(canvas, [{ itemId: target.itemId, text: 'Poprawiony tekst' }]);
  const patchedItem = patched.blocks[1].items.find((it) => it.itemId === target.itemId)!;
  assert.equal(patchedItem.text, 'Poprawiony tekst');
  assert.equal(patched.blocks[1].items[1].text, untouched);
});

test('getRejectedItemIds zwraca tylko odrzucone elementy', () => {
  const canvas = makeCanvas();
  canvas.blocks[1].items[0].review.state = 'rejected';
  canvas.blocks[2].items[0].review.state = 'accepted';
  const rejected = getRejectedItemIds(canvas);
  assert.deepEqual(rejected, [canvas.blocks[1].items[0].itemId]);
});

test('Lesson Refresh: response schema wymaga dokładnej równości zbiorów itemId (za mało)', () => {
  const canvas = makeCanvas();
  canvas.blocks[1].items[0].review.state = 'rejected';
  canvas.blocks[1].items[1].review.state = 'rejected';
  const rejectedIds = getRejectedItemIds(canvas);
  assert.throws(() => validateCanvasRefreshOutput({ items: [{ itemId: rejectedIds[0], kind: 'question', text: 'x' }] }, rejectedIds));
});

test('Lesson Refresh: response schema wymaga dokładnej równości zbiorów itemId (obcy ID)', () => {
  const canvas = makeCanvas();
  canvas.blocks[1].items[0].review.state = 'rejected';
  const rejectedIds = getRejectedItemIds(canvas);
  assert.throws(() =>
    validateCanvasRefreshOutput({ items: [{ itemId: 'obcy-id', kind: 'question', text: 'x' }] }, rejectedIds)
  );
});

test('Lesson Refresh: akceptuje dokładnie ten sam zbiór itemId', () => {
  const canvas = makeCanvas();
  canvas.blocks[1].items[0].review.state = 'rejected';
  canvas.blocks[1].items[1].review.state = 'rejected';
  const rejectedIds = getRejectedItemIds(canvas);
  assert.doesNotThrow(() =>
    validateCanvasRefreshOutput(
      { items: rejectedIds.map((id) => ({ itemId: id, kind: 'question' as const, text: 'Nowa wersja' })) },
      rejectedIds
    )
  );
});

test('applyLessonRefresh podmienia wyłącznie odrzucone pozycje, zaakceptowane pozostają nienaruszone', () => {
  const canvas = makeCanvas();
  const rejectedItem = canvas.blocks[1].items[0];
  const acceptedItem = canvas.blocks[1].items[1];
  rejectedItem.review = { state: 'rejected', rejectionReason: 'zbyt sztuczne' };
  acceptedItem.review = { state: 'accepted', rejectionReason: null };
  acceptedItem.generation = 1;

  const refreshed = applyLessonRefresh(
    canvas,
    { items: [{ itemId: rejectedItem.itemId, kind: 'task', text: 'Nowa treść' }] },
    'mutation-1',
    '2026-09-20T11:00:00.000Z'
  );

  const newRejected = refreshed.blocks[1].items.find((it) => it.itemId === rejectedItem.itemId)!;
  assert.equal(newRejected.text, 'Nowa treść');
  assert.equal(newRejected.kind, 'task');
  assert.equal(newRejected.generation, 2);
  assert.equal(newRejected.review.state, 'pending');
  assert.equal(newRejected.review.rejectionReason, null);

  const stillAccepted = refreshed.blocks[1].items.find((it) => it.itemId === acceptedItem.itemId)!;
  assert.equal(stillAccepted.text, acceptedItem.text);
  assert.equal(stillAccepted.review.state, 'accepted');
  assert.equal(stillAccepted.generation, 1);
});

test('applyLessonRefresh zwiększa revision canvasu i zapisuje mutationId', () => {
  const canvas = makeCanvas();
  const rejectedItem = canvas.blocks[1].items[0];
  rejectedItem.review = { state: 'rejected', rejectionReason: null };
  const refreshed = applyLessonRefresh(
    canvas,
    { items: [{ itemId: rejectedItem.itemId, kind: 'question', text: 'x' }] },
    'mutation-42',
    '2026-09-20T12:00:00.000Z'
  );
  assert.equal(refreshed.revision, canvas.revision + 1);
  assert.equal(refreshed.lastMutationId, 'mutation-42');
  assert.equal(refreshed.updatedAt, '2026-09-20T12:00:00.000Z');
});

test('buildScenarioCanvas: 1:1 (returning z gramatyką) vs grupa/cold_start — różne zestawy bloków', () => {
  const oneToOne = computeApplicableCanvasBlockIds('returning', true);
  const coldStart = computeApplicableCanvasBlockIds('cold_start', false);
  assert.notDeepEqual(oneToOne, coldStart);
  assert.equal(oneToOne.length, 9);
  assert.equal(coldStart.length, 7);
});

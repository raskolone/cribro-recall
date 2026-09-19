import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO_DURATION_BUDGETS, SCENARIO_MODULE_IDS } from '../types/scenario';
import { buildLessonScenario, validateScenarioModelOutput } from '../utils/scenarioValidation';

function validModel() {
  return {
    modules: SCENARIO_MODULE_IDS.map((moduleId) => ({
      moduleId,
      objective: `Cel modułu ${moduleId}`,
      items: [{ text: `Punkt 1 dla ${moduleId}` }, { text: `Punkt 2 dla ${moduleId}` }],
    })),
  };
}

test('SCENARIO_DURATION_BUDGETS sumuje się do długości lekcji dla 45/60/90 min', () => {
  for (const duration of [45, 60, 90] as const) {
    const budgets = SCENARIO_DURATION_BUDGETS[duration];
    const total = SCENARIO_MODULE_IDS.reduce((sum, id) => sum + budgets[id], 0);
    assert.equal(total, duration);
  }
});

test('SCENARIO_DURATION_BUDGETS ma budżet dla każdego modułu przy każdej długości', () => {
  for (const duration of [45, 60, 90] as const) {
    const budgets = SCENARIO_DURATION_BUDGETS[duration];
    for (const moduleId of SCENARIO_MODULE_IDS) {
      assert.ok(budgets[moduleId] > 0, `${moduleId} @ ${duration}min powinien mieć dodatni budżet`);
    }
  }
});

test('validateScenarioModelOutput akceptuje poprawną odpowiedź modelu', () => {
  assert.doesNotThrow(() => validateScenarioModelOutput(validModel()));
});

test('validateScenarioModelOutput odrzuca złą liczbę modułów', () => {
  const bad = { modules: validModel().modules.slice(0, 3) };
  assert.throws(() => validateScenarioModelOutput(bad));
});

test('validateScenarioModelOutput odrzuca złą kolejność modułów', () => {
  const modules = validModel().modules;
  const swapped = [modules[1], modules[0], modules[2], modules[3]];
  assert.throws(() => validateScenarioModelOutput({ modules: swapped }));
});

test('validateScenarioModelOutput odrzuca pusty cel modułu', () => {
  const modules = validModel().modules;
  modules[0].objective = '   ';
  assert.throws(() => validateScenarioModelOutput({ modules }));
});

test('validateScenarioModelOutput odrzuca zbyt wiele punktów (>6)', () => {
  const modules = validModel().modules;
  modules[2].items = Array.from({ length: 7 }, (_, i) => ({ text: `Punkt ${i}` }));
  assert.throws(() => validateScenarioModelOutput({ modules }));
});

test('validateScenarioModelOutput odrzuca zero punktów', () => {
  const modules = validModel().modules;
  modules[0].items = [];
  assert.throws(() => validateScenarioModelOutput({ modules }));
});

test('validateScenarioModelOutput odrzuca pusty tekst punktu', () => {
  const modules = validModel().modules;
  modules[3].items = [{ text: '' }];
  assert.throws(() => validateScenarioModelOutput({ modules }));
});

test('buildLessonScenario nadaje czasy z budżetu i unikalne ID punktom', () => {
  let counter = 0;
  const makeId = () => `id-${counter++}`;

  const scenario = buildLessonScenario(
    validModel(),
    { studentId: 'student-1', durationMin: 60, mode: 'returning', generatedAt: '2026-09-19T10:00:00.000Z' },
    makeId
  );

  assert.equal(scenario.studentId, 'student-1');
  assert.equal(scenario.durationMin, 60);
  assert.equal(scenario.mode, 'returning');
  assert.equal(scenario.modules.length, 4);

  const budgets = SCENARIO_DURATION_BUDGETS[60];
  for (const mod of scenario.modules) {
    assert.equal(mod.durationMin, budgets[mod.moduleId]);
    for (const item of mod.items) {
      assert.ok(item.id.startsWith('id-'));
      assert.ok(item.text.length > 0);
    }
  }

  const allIds = scenario.modules.flatMap((m) => m.items.map((i) => i.id));
  assert.equal(new Set(allIds).size, allIds.length);
});

test('buildLessonScenario zachowuje kolejność modułów zgodną z SCENARIO_MODULE_IDS', () => {
  const scenario = buildLessonScenario(
    validModel(),
    { studentId: 'student-2', durationMin: 45, mode: 'cold_start', generatedAt: '2026-09-19T10:00:00.000Z' },
    () => 'x'
  );
  assert.deepEqual(scenario.modules.map((m) => m.moduleId), [...SCENARIO_MODULE_IDS]);
});

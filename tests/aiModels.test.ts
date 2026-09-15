import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_MODEL_CASCADE,
  GEMINI_MODEL_CASCADE,
  OPENAI_MODEL_CASCADE,
  PRIMARY_MODEL,
  SECONDARY_MODEL,
  TERTIARY_MODEL,
  openAiModelsFor,
} from '../services/aiModels';

/**
 * Kaskada modeli.
 *
 * Test pilnuje kolejności, bo to ona jest tu decyzją: najpierw najmocniejszy
 * model, potem drugi dostawca (żeby awaria OpenAI nie zatrzymała nauki), na
 * końcu coś lekkiego. Rozjazd kolejności nie wywala aplikacji — po prostu
 * generuje gorsze zadania za większe pieniądze, więc nikt by tego nie zauważył.
 */

test('kolejność kaskady: mocny → drugi dostawca → lekki', () => {
  assert.equal(AI_MODEL_CASCADE[0], PRIMARY_MODEL);
  assert.equal(AI_MODEL_CASCADE[1], SECONDARY_MODEL);
  assert.equal(AI_MODEL_CASCADE[2], TERTIARY_MODEL);
});

test('pierwszy jest gemini-2.5-flash, drugi gemini-3.8-flash', () => {
  assert.equal(PRIMARY_MODEL, 'gemini-2.5-flash');
  assert.equal(SECONDARY_MODEL, 'gemini-3.8-flash');
});

test('model trzeciorzędny jest lekki i nie jest tym samym co pierwszy', () => {
  assert.equal(TERTIARY_MODEL, 'openai/gpt-4o-mini');
  assert.notEqual(TERTIARY_MODEL, PRIMARY_MODEL);
});

test('kaskada dostawców rozdziela się bez prefiksów i bez gubienia modeli', () => {
  assert.deepEqual(OPENAI_MODEL_CASCADE, ['gpt-4o-mini', 'gpt-5.6-luna']);
  assert.equal(GEMINI_MODEL_CASCADE[0], 'gemini-2.5-flash');
  assert.equal(
    OPENAI_MODEL_CASCADE.length + GEMINI_MODEL_CASCADE.length,
    AI_MODEL_CASCADE.length
  );
  assert.ok(OPENAI_MODEL_CASCADE.every((m) => !m.startsWith('openai/')));
});

test('żądany model idzie pierwszy, reszta kaskady zostaje jako zapas', () => {
  assert.deepEqual(openAiModelsFor('openai/gpt-4o-mini'), ['gpt-4o-mini', 'gpt-5.6-luna']);
  assert.equal(openAiModelsFor('gpt-4o')[0], 'gpt-4o');
  assert.ok(openAiModelsFor('gpt-4o').includes('gpt-5.6-luna'));
});

test('bez wskazanego modelu obowiązuje domyślna kolejność', () => {
  assert.deepEqual(openAiModelsFor(), OPENAI_MODEL_CASCADE);
  assert.deepEqual(openAiModelsFor(null), OPENAI_MODEL_CASCADE);
  assert.deepEqual(openAiModelsFor(''), OPENAI_MODEL_CASCADE);
});

test('model wskazany dwa razy nie powiela się w liście prób', () => {
  const models = openAiModelsFor('gpt-5.6-luna');
  assert.equal(models.filter((m) => m === 'gpt-5.6-luna').length, 1);
  assert.equal(models[0], 'gpt-5.6-luna');
});

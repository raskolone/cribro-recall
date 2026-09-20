import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEWORK_GENERATION_MODELS,
  assertHomeworkModelAllowed,
  DisallowedHomeworkModelError,
} from '../services/aiModels';

/**
 * Twardy guard modeli pracy domowej (hotfix P0, 2026-09-20). Jedyny
 * dopuszczalny model to dokładnie `gemini-2.5-flash` — żaden inny model
 * OpenAI ani nawet inny model Gemini nie może przejść, bo awaria Gemini
 * 2.5 Flash ma kończyć się jawnym błędem, nie cichym zejściem na coś innego.
 */

test('HOMEWORK_GENERATION_MODELS to dokładnie jeden model: gemini-2.5-flash', () => {
  assert.deepEqual([...HOMEWORK_GENERATION_MODELS], ['gemini-2.5-flash']);
});

test('assertHomeworkModelAllowed: przepuszcza dokładnie gemini-2.5-flash', () => {
  assert.doesNotThrow(() => assertHomeworkModelAllowed('gemini-2.5-flash'));
});

test('assertHomeworkModelAllowed: odrzuca modele OpenAI przed jakimkolwiek wywołaniem providera', () => {
  for (const model of ['gpt-4o-mini', 'openai/gpt-4o-mini', 'gpt-5.6-luna', 'openai/gpt-5.6-luna', 'gpt-4o']) {
    assert.throws(() => assertHomeworkModelAllowed(model), DisallowedHomeworkModelError, `model ${model} powinien być odrzucony`);
  }
});

test('assertHomeworkModelAllowed: odrzuca INNY model Gemini niż dokładnie gemini-2.5-flash', () => {
  assert.throws(() => assertHomeworkModelAllowed('gemini-3.8-flash'), DisallowedHomeworkModelError);
  assert.throws(() => assertHomeworkModelAllowed('gemini-2.5-pro'), DisallowedHomeworkModelError);
});

test('generateTranslationExercises: modelsOverride z niedozwolonym modelem rzuca PRZED wywołaniem providera (bez sieci)', async () => {
  const { generateTranslationExercises } = await import('../services/geminiService');

  await assert.rejects(
    () => generateTranslationExercises('B1', ['deadline'], undefined, undefined, undefined, 1, undefined, undefined, false, undefined, ['openai/gpt-4o-mini']),
    DisallowedHomeworkModelError
  );
});

test('generateFillInTheBlankExercises: modelsOverride z niedozwolonym modelem rzuca PRZED wywołaniem providera (bez sieci)', async () => {
  const { generateFillInTheBlankExercises } = await import('../services/geminiService');

  await assert.rejects(
    () => generateFillInTheBlankExercises('B1', 'travel', 5, undefined, ['gemini-3.8-flash']),
    DisallowedHomeworkModelError
  );
});

test('evaluateTranslations: modelsOverride z niedozwolonym modelem (ocena homework) rzuca PRZED wywołaniem providera', async () => {
  const { evaluateTranslations } = await import('../services/geminiService');

  await assert.rejects(
    () => evaluateTranslations(
      [{ polishSentence: 'x', englishTranslation: 'y', hint: '' }],
      ['y'],
      'B1',
      '',
      undefined,
      ['openai/gpt-4o-mini']
    ),
    DisallowedHomeworkModelError
  );
});

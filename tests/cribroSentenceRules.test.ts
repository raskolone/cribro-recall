import assert from 'node:assert/strict';
import test from 'node:test';

import * as rootChecks from '../utils/exerciseSentenceChecks';
import * as rootRules from '../services/cribroSentenceRules';
import * as v2Knowledge from '../functions/src/homeworkV2/coreKnowledge';
import {
  deterministicFailedChecks,
  normalizeSentence as v2Normalize,
  validateAll,
  validateDraft,
} from '../functions/src/homeworkV2/qualityValidator';
import type { DraftExercise } from '../functions/src/homeworkV2/exerciseGenerator';
import type { AssembledContext } from '../functions/src/homeworkV2/contextAssembler';
import type { ModelCall } from '../functions/src/homeworkV2/openai';

/**
 * `functions/` nie importuje z katalogu głównego, więc reguły zdań istnieją
 * w dwóch kopiach. Te testy pilnują, żeby się nie rozjechały.
 */

test('kopie reguł: lista typów błędu jest identyczna w aplikacji i w silniku v2', () => {
  assert.deepEqual([...v2Knowledge.FIX_SENTENCE_ERROR_TYPES], [...rootChecks.FIX_SENTENCE_ERROR_TYPES]);
  assert.deepEqual(v2Knowledge.FIX_SENTENCE_ERROR_TYPE_GUIDE, rootRules.FIX_SENTENCE_ERROR_TYPE_GUIDE);
});

test('kopie reguł: instrukcja „Popraw zdanie" jest identyczna w aplikacji i w silniku v2', () => {
  assert.equal(v2Knowledge.FIX_SENTENCE_RULES, rootRules.FIX_SENTENCE_RULES);
  assert.ok(v2Knowledge.EXERCISE_TYPE_BRIEFS.fix_sentence.includes(rootRules.FIX_SENTENCE_RULES));
});

test('kopie reguł: normalizacja zdań działa tak samo w obu pakietach', () => {
  for (const sample of ["I don’t  know!", 'She DOESN\'T eat meat.', 'Zażółć gęślą jaźń?', '  a, b; c  ']) {
    assert.equal(v2Normalize(sample), rootChecks.normalizeSentence(sample), sample);
  }
});

const fixDraft = (overrides: Partial<DraftExercise> = {}): DraftExercise => ({
  exerciseType: 'fix_sentence',
  learningObjective: 'past simple z yesterday',
  content: 'I have seen him yesterday.',
  instruction: '',
  modelAnswer: 'I saw him yesterday.',
  acceptedVariants: [],
  requiredMaterial: ['past simple'],
  commonMistakes: [],
  hintSmall: '',
  hintLarge: '',
  sourceLessonIndex: 1,
  errorType: 'verb_tense',
  ...overrides,
});

test('v2 deterministicFailedChecks: poprawne fix_sentence nie ma zarzutów', () => {
  assert.deepEqual(deterministicFailedChecks(fixDraft()), []);
});

test('v2 deterministicFailedChecks: zdanie „z błędem" równe wzorcowi albo wariantowi → has_no_error', () => {
  assert.deepEqual(
    deterministicFailedChecks(fixDraft({ content: 'i saw him yesterday' })),
    ['fix_sentence_has_no_error']
  );
  assert.deepEqual(
    deterministicFailedChecks(fixDraft({ content: 'I saw him yesterday!', modelAnswer: 'Yesterday I saw him.', acceptedVariants: ['I saw him yesterday.'] })),
    ['fix_sentence_has_no_error']
  );
});

test('v2 deterministicFailedChecks: brak albo nieznany errorType → missing_error_type', () => {
  assert.deepEqual(deterministicFailedChecks(fixDraft({ errorType: undefined })), ['fix_sentence_missing_error_type']);
  assert.deepEqual(deterministicFailedChecks(fixDraft({ errorType: 'spelling' })), ['fix_sentence_missing_error_type']);
});

test('v2 deterministicFailedChecks: inne typy zadań nie są sprawdzane', () => {
  assert.deepEqual(
    deterministicFailedChecks(fixDraft({ exerciseType: 'micro_translation', content: 'I saw him yesterday.', errorType: undefined })),
    []
  );
});

const context: AssembledContext = {
  lessons: [
    {
      lessonId: 'lesson-1',
      topic: 'Weekend',
      date: '2026-09-20',
      vocabulary: 'yesterday - wczoraj',
      corrections: 'I have seen him yesterday → I saw him yesterday',
      summary: 'Past simple.',
      goals: 'Past simple z yesterday.',
    },
  ],
  student: { cefr: 'B1', recentMistakes: [] },
  lessonIds: ['lesson-1'],
};

/** Kontroler-model, który przepuszcza wszystko. */
const approvingModel: ModelCall = async (request) => ({
  data: request.taskName === 'hw-v2/validate-batch'
    ? { results: [{ index: 1, passed: true, score: 1, failedChecks: [] }] }
    : { passed: true, score: 1, failedChecks: [] },
  modelUsed: 'gemini-2.5-flash',
  latencyMs: 1,
});

test('v2 validateDraft: „passed" od modelu nie przepuszcza fix_sentence bez błędu', async () => {
  const verdict = await validateDraft(context, fixDraft({ content: 'I saw him yesterday.' }), approvingModel, 0);
  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.failedChecks, ['fix_sentence_has_no_error']);
});

test('v2 validateAll: fix_sentence bez błędu idzie do regeneracji, a uparcie wadliwe — do lektora', async () => {
  const regenerated: string[][] = [];
  const result = await validateAll({
    context,
    drafts: [fixDraft({ content: 'I saw him yesterday.' })],
    call: approvingModel,
    regenerateBatch: async (items) => {
      regenerated.push(items[0].failedChecks);
      return [fixDraft({ content: 'I saw him yesterday!' })];
    },
  });
  assert.ok(regenerated.length >= 1);
  assert.ok(regenerated[0].includes('fix_sentence_has_no_error'));
  assert.equal(result[0].requiresTeacherReview, true);
});

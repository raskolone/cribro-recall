import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExercise, normalizeGapPayload } from '../utils/normalizeExercise';

test('normalizeExercise: rozsypanka z obiektami zamiast stringów nie wywala .word i nie przesuwa indeksów', () => {
  const raw = { chunks: ['I', { word: 'have to' }, null, 'meet the deadline'], correctSentence: 'I have to meet the deadline' };
  const exercise = normalizeExercise(raw);

  assert.equal(exercise.state, 'ready');
  assert.deepEqual(exercise.tokens, ['I', 'have to', '', 'meet the deadline']);
});

test('normalizeExercise: rozsypanka bez polskiego zdania nie pokazuje boksu tłumaczenia', () => {
  const raw = { chunks: ['I', 'have to', 'meet the deadline'] };
  const exercise = normalizeExercise(raw);

  assert.equal(exercise.sourceSentence, undefined);
});

test('normalizeExercise: instrukcja wstrzyknięta w polishHint nie jest traktowana jak zdanie źródłowe', () => {
  const raw = { chunks: ['I', 'have to', 'meet the deadline'], polishHint: 'Popraw zdanie. Zwróć uwagę na czas.' };
  const exercise = normalizeExercise(raw);

  assert.equal(exercise.sourceSentence, undefined);
});

test('normalizeExercise: pusta rozsypanka degraduje do invalid zamiast crashować render', () => {
  const raw = { chunks: [] };
  const exercise = normalizeExercise(raw);

  assert.equal(exercise.state, 'invalid');
  assert.ok(exercise.message);
});

test('normalizeGapPayload: format legacy [BLANK_n] z bankiem słów', () => {
  const result = normalizeGapPayload({
    textWithBlanks: 'This is a [BLANK_1] of the text.',
    availableWords: ['sample'],
  });

  assert.ok(result);
  assert.equal(result!.segments.length, 3);
  assert.equal(result!.segments[0].kind, 'text');
  assert.equal(result!.segments[1].kind, 'gap');
  assert.equal(result!.segments[2].kind, 'text');
  assert.deepEqual(result!.availableWords, ['sample']);
});

test('normalizeGapPayload: potrójne podkreślenie bez banku daje jedną lukę', () => {
  const result = normalizeGapPayload({ content: 'She ___ to school every day.' });

  assert.ok(result);
  assert.equal(result!.segments.filter((s) => s.kind === 'gap').length, 1);
  assert.deepEqual(result!.availableWords, []);
});

test('normalizeGapPayload: kanoniczne {{gap:n}}', () => {
  const result = normalizeGapPayload({
    textWithBlanks: 'She {{gap:1}} to school.',
    availableWords: ['goes'],
  });

  assert.ok(result);
  assert.equal(result!.segments.filter((s) => s.kind === 'gap').length, 1);
});

test('normalizeGapPayload: pełne zdanie + wordsToCut', () => {
  const result = normalizeGapPayload({
    fullSentence: 'She goes to school every day.',
    wordsToCut: ['goes', 'school'],
  });

  assert.ok(result);
  assert.equal(result!.segments.filter((s) => s.kind === 'gap').length, 2);
  assert.deepEqual(result!.availableWords, ['goes', 'school']);
});

test('normalizeExercise: brak jakiegokolwiek rozpoznanego formatu luki degraduje zamiast pokazać pusty boks', () => {
  const raw = { type: 'fill_in_the_blank', content: '' };
  const exercise = normalizeExercise(raw);

  assert.equal(exercise.state, 'invalid');
});

test('normalizeExercise: nieznany/pusty surowy element nigdy nie rzuca wyjątku', () => {
  assert.doesNotThrow(() => normalizeExercise(null));
  assert.doesNotThrow(() => normalizeExercise(undefined));
  assert.doesNotThrow(() => normalizeExercise('nie obiekt'));
  assert.equal(normalizeExercise(null).state, 'invalid');
});

test('normalizeExercise: aliasy typów v2 (fix_sentence, gap_from_context, micro_translation) mapują na typ kanoniczny v1', () => {
  assert.equal(normalizeExercise({ exerciseType: 'fix_sentence', incorrectSentence: 'She go home.' }).type, 'find_errors');
  assert.equal(normalizeExercise({ exerciseType: 'gap_from_context', content: 'She ___ home.' }).type, 'fill_in_the_blank');
  assert.equal(normalizeExercise({ exerciseType: 'micro_translation', polishSentence: 'Ona idzie do domu.' }).type, 'translation');
});

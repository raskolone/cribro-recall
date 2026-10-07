import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWarmupField, warmupFieldEntry } from '../utils/warmupField';
import { buildWarmupRounds } from '../utils/warmupRounds';
import { buildAdHocHomeworkPayloads } from '../utils/homeworkRecipients';
import { classifyUnscrambleAttempt } from '../utils/unscrambleGrading';
import { checkWarmupExerciseItem, describeWarmupFailure } from '../utils/exerciseSentenceChecks';

const item = {
  chunks: ['I have to', 'meet the deadline', 'by tomorrow morning'],
  correctSentence: 'I have to meet the deadline by tomorrow morning.',
  polishTranslation: 'Muszę dotrzymać terminu jutro rano.',
};

// --- kreator: trzy stany pola warmup ---

test('resolveWarmupField: przełącznik wyłączony -> [] (nawet gdy są elementy)', () => {
  assert.deepEqual(resolveWarmupField(false, [item]), []);
  assert.deepEqual(resolveWarmupField(false, []), []);
});

test('resolveWarmupField: włączony i są elementy -> elementy', () => {
  assert.deepEqual(resolveWarmupField(true, [item]), [item]);
});

test('resolveWarmupField: włączony i brak elementów -> undefined, a klucz jest pomijany', () => {
  const value = resolveWarmupField(true, []);
  assert.equal(value, undefined);
  assert.equal('warmup' in warmupFieldEntry(value), false);
  assert.deepEqual(warmupFieldEntry([]), { warmup: [] });
});

test('buildAdHocHomeworkPayloads: bez warmup nie ma klucza (Firestore nie przyjmie undefined)', () => {
  const base = { title: 't', type: 'translation', types: ['translation'], instructions: '', sentences: [], dueDate: '', createdAt: '', origin: 'http://x' };
  const r = [{ id: 'u1', name: 'A' }];
  const without = buildAdHocHomeworkPayloads(r, { ...base, warmup: undefined }, 'set', () => 'tok');
  assert.equal('warmup' in without[0], false);
  const empty = buildAdHocHomeworkPayloads(r, { ...base, warmup: [] }, 'set', () => 'tok');
  assert.deepEqual(empty[0].warmup, []);
});

// --- walidacja złożenia ---

test('walidacja: brak końcowej kropki w fragmentach nie odrzuca elementu', () => {
  const c = checkWarmupExerciseItem(item);
  assert.equal('item' in c, true);
});

test('walidacja: inna wielkość liter i nadmiarowe spacje są tolerowane', () => {
  const c = checkWarmupExerciseItem({
    ...item,
    chunks: ['i have  to', 'Meet the deadline', ' by tomorrow morning '],
  });
  assert.equal('item' in c, true);
});

test('correctSentence = fragmenty złożone pojedynczą spacją, więc classifyUnscrambleAttempt ocenia spójnie', () => {
  const c = checkWarmupExerciseItem({ ...item, chunks: ['i have  to', 'Meet the deadline', 'by tomorrow morning'] });
  assert.ok('item' in c);
  if (!('item' in c)) return;
  assert.equal(c.item.correctSentence, 'i have to Meet the deadline by tomorrow morning');
  assert.deepEqual(c.item.chunks, ['i have to', 'Meet the deadline', 'by tomorrow morning']);
  const target = c.item.correctSentence.split(' ');
  assert.equal(classifyUnscrambleAttempt(target, target), 'correct');
});

test('walidacja: powody odrzucenia', () => {
  const reason = (patch: Record<string, unknown>) => {
    const c = checkWarmupExerciseItem({ ...item, ...patch }) as any;
    return c.reason;
  };
  assert.equal(reason({ chunks: ['I have to', 'meet the deadline'] }), 'invalid_chunk_count');
  assert.equal(reason({ chunks: ['I have to', 'meet', 'by tomorrow morning'] }), 'invalid_word_count_in_chunk');
  assert.equal(reason({ chunks: ['I have to', 'I have to', 'meet the deadline'] }), 'duplicate_chunks');
  assert.equal(reason({ correctSentence: 'Something else entirely.' }), 'chunks_dont_match_sentence');
  assert.equal(reason({ polishTranslation: '' }), 'missing_polish_translation');
  assert.equal(reason({ chunks: [] }), 'missing_fields');
});

test('describeWarmupFailure: unikalne powody po polsku', () => {
  assert.equal(describeWarmupFailure(['model_error']), 'błąd modelu');
  assert.equal(
    describeWarmupFailure(['duplicate_chunks', 'duplicate_chunks', 'sentence_repeated']),
    'powtórzony fragment w jednym zdaniu; zdanie powtarza zdanie z pracy'
  );
  assert.equal(describeWarmupFailure([]), 'brak poprawnych zdań');
});

// --- buildWarmupRounds ---

const sentences = [{ chunks: ['I', 'like', 'sentence'], correctSentence: 'I like sentence', polishHint: 'Lubię zdanie.' }];

test('buildWarmupRounds: undefined -> stara rozgrzewka', () => {
  assert.equal(buildWarmupRounds(sentences, { warmup: undefined, type: 'word_order' }).length, 1);
});

test('buildWarmupRounds: [] -> 0 rund', () => {
  assert.equal(buildWarmupRounds(sentences, { warmup: [], type: 'word_order' }).length, 0);
});

test('buildWarmupRounds: stary kształt (polishHint, bez polishTranslation) -> jak brak pola', () => {
  const old = [{ chunks: ['a b', 'c d', 'e f'], correctSentence: 'a b c d e f', polishHint: 'Stare.' }];
  const rounds = buildWarmupRounds(sentences, { warmup: old, type: 'word_order' });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].targetSentence, 'I like sentence');
});

test('buildWarmupRounds: mieszany -> tylko elementy z polishTranslation', () => {
  const old = { chunks: ['a b', 'c d', 'e f'], correctSentence: 'a b c d e f', polishHint: 'Stare.' };
  const rounds = buildWarmupRounds(sentences, { warmup: [old, item], type: 'word_order' });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].sourceLabel, item.polishTranslation);
  assert.equal(rounds[0].itemIndex, 1);
});

test('buildWarmupRounds: poprawny -> rundy z polskim poleceniem', () => {
  const rounds = buildWarmupRounds(sentences, { warmup: [item], type: 'word_order' });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].type, 'warmup_chunk');
  assert.equal(rounds[0].sourceLabel, item.polishTranslation);
});

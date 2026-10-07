import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyWarmupVerdicts, markAllUnverified, parseWarmupVerdicts } from '../utils/warmupJudge';
import { removeWarmupItem, resolveWarmupField, stripWarmupDraftFlags } from '../utils/warmupField';
import { checkWarmupExerciseItem, extractLessonTopics } from '../utils/exerciseSentenceChecks';

const mk = (sentence: string, chunks: string[], pl = 'Tłumaczenie.') => ({
  chunks,
  correctSentence: sentence,
  polishTranslation: pl,
});
const a = mk('I have to meet the deadline by tomorrow.', ['I have to', 'meet the deadline', 'by tomorrow.']);
const b = mk('My sister likes a big kitchen.', ['My sister', 'likes a', 'big kitchen.']);

test('parseWarmupVerdicts: ok / nie ok z indeksami', () => {
  const v = parseWarmupVerdicts({ verdicts: [{ index: 0, ok: true, reason: '' }, { index: 1, ok: false, reason: 'dziwne' }] }, 2);
  assert.deepEqual(v, [{ ok: true, reason: '' }, { ok: false, reason: 'dziwne' }]);
});

test('parseWarmupVerdicts: brak elementu w odpowiedzi -> null', () => {
  const v = parseWarmupVerdicts({ verdicts: [{ index: 1, ok: true, reason: '' }] }, 2);
  assert.equal(v[0], null);
  assert.equal(v[1]?.ok, true);
});

test('parseWarmupVerdicts: niepoprawny JSON i śmieci -> same null', () => {
  assert.deepEqual(parseWarmupVerdicts('{nie json', 2), [null, null]);
  assert.deepEqual(parseWarmupVerdicts(null, 2), [null, null]);
  assert.deepEqual(parseWarmupVerdicts({ verdicts: 'x' }, 2), [null, null]);
  assert.deepEqual(parseWarmupVerdicts({ verdicts: [{ index: 0 }] }, 1), [null]);
});

test('parseWarmupVerdicts: nadmiarowe elementy ignorowane, tablica w korzeniu i JSON-string działają', () => {
  const v = parseWarmupVerdicts(JSON.stringify([{ ok: true }, { ok: true }, { ok: false }]), 2);
  assert.equal(v.length, 2);
  assert.deepEqual(parseWarmupVerdicts({ verdicts: [{ index: 7, ok: false }] }, 1), [null]);
});

test('applyWarmupVerdicts: ok=false odpada z powodem, brak wyroku -> unverified', () => {
  const r = applyWarmupVerdicts([a, b], [{ ok: false, reason: 'x' }, null]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].unverified, true);
  assert.deepEqual(r.reasons, ['unnatural_sentence']);
  const ok = applyWarmupVerdicts([a], [{ ok: true, reason: '' }]);
  assert.equal('unverified' in ok.items[0], false);
});

test('markAllUnverified oznacza wszystkie', () => {
  assert.ok(markAllUnverified([a, b]).every((i) => i.unverified === true));
});

test('filtr tematu: "My ideal home would like…" odrzucone przy temacie "Describing your ideal home"', () => {
  const bad = mk('My ideal home would like to have roomy spaces.', ['My ideal home', 'would like to', 'have roomy spaces.']);
  const r = checkWarmupExerciseItem(bad, ['Describing your ideal home']);
  assert.deepEqual(r, { ok: false, reason: 'topic_as_subject' });
});

test('filtr tematu: "My sister would like to have a big kitchen." przyjęte', () => {
  const good = mk('My sister would like to have a big kitchen.', ['My sister', 'would like to', 'have a big kitchen.']);
  assert.equal(checkWarmupExerciseItem(good, ['Describing your ideal home']).ok, true);
});

test('filtr tematu: bez tematów nic nie odrzuca; jedno słowo tematu nie wystarcza', () => {
  const bad = mk('My ideal home would like to have roomy spaces.', ['My ideal home', 'would like to', 'have roomy spaces.']);
  assert.equal(checkWarmupExerciseItem(bad).ok, true);
  const doctor = mk('The doctor told me to rest more.', ['The doctor', 'told me to', 'rest more.']);
  assert.equal(checkWarmupExerciseItem(doctor, ['Going to the doctor']).ok, true);
});

test('extractLessonTopics czyta tematy z materiału', () => {
  const src = 'LEKCJA (2026-10-01): Describing your ideal home\nSłownictwo:\nroomy\n\n---\n\nLEKCJA (2026-10-03): Travel plans';
  assert.deepEqual(extractLessonTopics(src), ['Describing your ideal home', 'Travel plans']);
});

test('usuwanie elementów w podglądzie: czysta funkcja, zły indeks bez zmian', () => {
  const list = [a, b];
  assert.deepEqual(removeWarmupItem(list, 0), [b]);
  assert.equal(removeWarmupItem(list, 5), list);
  assert.equal(list.length, 2);
  assert.deepEqual(resolveWarmupField(true, removeWarmupItem(removeWarmupItem(list, 0), 0)), undefined);
});

test('flaga unverified nie trafia do zapisu', () => {
  const saved = resolveWarmupField(true, [{ ...a, unverified: true }]);
  assert.ok(saved && !('unverified' in saved[0]));
  assert.deepEqual(stripWarmupDraftFlags([{ ...b, unverified: true }]), [b]);
});

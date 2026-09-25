import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUsedSentencesBlock,
  checkFixSentenceItem,
  collectValidFixSentences,
  filterRepeatedSentences,
  normalizeSentence,
} from '../utils/exerciseSentenceChecks';

test('normalizeSentence: interpunkcja, wielkość liter i apostrofy nie odróżniają zdań', () => {
  assert.equal(normalizeSentence('I don’t   like Mondays!'), normalizeSentence("i don't like mondays"));
  assert.equal(normalizeSentence('  Hello, world.  '), 'hello world');
});

test('normalizeSentence: apostrof zostaje — "dont" to inne słowo niż "don\'t"', () => {
  assert.notEqual(normalizeSentence('I dont know.'), normalizeSentence("I don't know."));
});

test('filterRepeatedSentences: odsiewa zdania z sesji i powtórki wewnątrz partii', () => {
  const items = [
    { en: 'I missed the bus this morning.', pl: 'Uciekł mi dziś autobus.' },
    { en: 'Can you send me the invoice?', pl: 'Możesz mi wysłać fakturę?' },
    { en: 'can you send me the invoice', pl: 'Wyślesz mi fakturę?' },
    { en: 'We moved the meeting to Friday.', pl: 'Przenieśliśmy spotkanie na piątek.' },
  ];

  const fresh = filterRepeatedSentences(items, ['I missed the bus this morning!'], (i) => [i.en, i.pl]);

  assert.deepEqual(
    fresh.map((i) => i.en),
    ['Can you send me the invoice?', 'We moved the meeting to Friday.']
  );
});

test('filterRepeatedSentences: pusta historia przepuszcza wszystko poza duplikatami', () => {
  const fresh = filterRepeatedSentences(['A b.', 'a b', 'C d.'], [], (s) => [s]);
  assert.deepEqual(fresh, ['A b.', 'C d.']);
});

test('buildUsedSentencesBlock: pusty bez historii, z historią wymienia ostatnie zdania', () => {
  assert.equal(buildUsedSentencesBlock(undefined), '');
  assert.equal(buildUsedSentencesBlock([]), '');

  const block = buildUsedSentencesBlock(['One.', 'Two.', 'Three.'], 2);
  assert.ok(!block.includes('One.'));
  assert.ok(block.includes('- Two.'));
  assert.ok(block.includes('- Three.'));
});

// ---------------------------------------------------------------------------
// „Popraw zdanie" — walidacja schematu i powtórka
// ---------------------------------------------------------------------------

const good = (n: number) => ({
  correct_sentence: `She doesn't eat meat, number ${n}.`,
  error_type: 'auxiliary_verb',
  error_sentence: `She don't eat meat, number ${n}.`,
  explanation: 'doesn\'t w 3. os.',
  hint: 'Czasownik posiłkowy.',
  polish_hint: 'Ona nie je mięsa.',
});

const noError = (n: number) => ({
  ...good(n),
  error_sentence: `she doesn't eat meat number ${n}`,
});

test('checkFixSentenceItem: poprawne zadanie przechodzi i mapuje pola', () => {
  const check = checkFixSentenceItem(good(1));
  assert.equal(check.ok, true);
  if (!check.ok) return;
  assert.equal(check.item.errorSentence, "She don't eat meat, number 1.");
  assert.equal(check.item.correctSentence, "She doesn't eat meat, number 1.");
  assert.equal(check.item.errorType, 'auxiliary_verb');
  assert.equal(check.item.polishHint, 'Ona nie je mięsa.');
});

test('checkFixSentenceItem: brak któregokolwiek z trzech wymaganych pól odrzuca zadanie', () => {
  for (const field of ['correct_sentence', 'error_sentence', 'error_type'] as const) {
    const raw: Record<string, unknown> = { ...good(1) };
    delete raw[field];
    const check = checkFixSentenceItem(raw);
    assert.equal(check.ok, false, field);
    if (!check.ok) assert.equal(check.reason, 'missing_fields');
  }
  assert.equal(checkFixSentenceItem(null).ok, false);
  assert.equal(checkFixSentenceItem({ ...good(1), error_type: '   ' }).ok, false);
});

test('checkFixSentenceItem: typ błędu spoza listy jest odrzucany', () => {
  const check = checkFixSentenceItem({ ...good(1), error_type: 'punctuation' });
  assert.equal(check.ok, false);
  if (!check.ok) assert.equal(check.reason, 'unknown_error_type');
});

test('checkFixSentenceItem: zdanie „z błędem" równe poprawnemu po normalizacji → no_error', () => {
  const identical = checkFixSentenceItem({ ...good(1), error_sentence: good(1).correct_sentence });
  assert.equal(identical.ok, false);
  if (!identical.ok) assert.equal(identical.reason, 'no_error');

  // Różnica tylko w interpunkcji i wielkości liter to nie błąd do poprawienia.
  const cosmetic = checkFixSentenceItem(noError(1));
  assert.equal(cosmetic.ok, false);
  if (!cosmetic.ok) assert.equal(cosmetic.reason, 'no_error');
});

test('checkFixSentenceItem: przyjmuje też stare nazwy pól (camelCase)', () => {
  const check = checkFixSentenceItem({
    correctSentence: 'I met him yesterday.',
    incorrectSentence: 'I have met him yesterday.',
    errorType: 'verb_tense',
  });
  assert.equal(check.ok, true);
});

test('collectValidFixSentences: wszystko dobre → jedno wywołanie, bez powtórki', async () => {
  const calls: unknown[] = [];
  const batch = await collectValidFixSentences(async (retry) => {
    calls.push(retry);
    return [good(1), good(2)];
  });
  assert.equal(calls.length, 1);
  assert.equal(batch.items.length, 2);
  assert.equal(batch.retried, false);
  assert.equal(batch.dropped, 0);
});

test('collectValidFixSentences: odrzucone zadanie dostaje JEDNĄ powtórkę z listą wadliwych zdań', async () => {
  const calls: any[] = [];
  const batch = await collectValidFixSentences(async (retry) => {
    calls.push(retry);
    return retry ? [good(9)] : [good(1), noError(2)];
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].missing, 1);
  assert.deepEqual(calls[1].rejectedErrorSentences, [noError(2).error_sentence]);
  assert.deepEqual(
    batch.items.map((i) => i.correctSentence),
    [good(1).correct_sentence, good(9).correct_sentence]
  );
  assert.equal(batch.dropped, 0);
});

test('collectValidFixSentences: nadal bez błędu po powtórce → zadanie nie jest pokazywane', async () => {
  let calls = 0;
  const batch = await collectValidFixSentences(async () => {
    calls += 1;
    return calls === 1 ? [good(1), noError(2)] : [noError(3)];
  });
  assert.equal(calls, 2, 'najwyżej jedna powtórka');
  assert.equal(batch.items.length, 1);
  assert.equal(batch.dropped, 1);
});

test('collectValidFixSentences: powtórka nie może dołożyć więcej zadań, niż odrzucono', async () => {
  const batch = await collectValidFixSentences(async (retry) =>
    retry ? [good(7), good(8), good(9)] : [good(1), noError(2)]
  );
  assert.equal(batch.items.length, 2);
});

test('collectValidFixSentences: błąd sieci w powtórce nie zabiera dobrych zadań z pierwszej próby', async () => {
  const batch = await collectValidFixSentences(async (retry) => {
    if (retry) throw new Error('timeout');
    return [good(1), noError(2)];
  });
  assert.equal(batch.items.length, 1);
  assert.equal(batch.dropped, 1);
});

test('collectValidFixSentences: błąd powtórki przy zerze dobrych zadań leci dalej', async () => {
  await assert.rejects(
    collectValidFixSentences(async (retry) => {
      if (retry) throw new Error('timeout');
      return [noError(1)];
    }),
    /timeout/
  );
});

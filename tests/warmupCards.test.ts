import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWarmupCards,
  checkWarmupCard,
  describeWarmupCardRejection,
  collectLessonCards,
  parseGeneratedWarmupCards,
  parseWarmupCardsFromText,
  planWarmupCardSource,
  splitFlattenedVocabularyLine,
  stripWarmupCardDraftFlags,
  resolveWarmupCardsField,
  sanitizeWarmupCards,
  warmupCardsFieldEntry,
} from '../utils/warmupCards';

const card = (term: string, definition = 'znaczenie', extra: object = {}) => ({ term, definition, ...extra });

test('checkWarmupCard: poprawna karta jest przycinana i zachowuje przykład', () => {
  const r = checkWarmupCard({ term: '  take   off ', definition: ' zdjąć ', contextSentence: ' Take off your coat. ' });
  assert.deepEqual(r, { ok: true, card: { term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.' } });
});

test('checkWarmupCard: brak znaczenia, brak frazy, zły kształt', () => {
  assert.deepEqual(checkWarmupCard({ term: 'hello', definition: '  ' }), { ok: false, reason: 'missing_definition' });
  assert.deepEqual(checkWarmupCard({ term: '', definition: 'cześć' }), { ok: false, reason: 'missing_term' });
  assert.deepEqual(checkWarmupCard('hello'), { ok: false, reason: 'invalid_shape' });
  assert.deepEqual(checkWarmupCard(null), { ok: false, reason: 'invalid_shape' });
});

test('checkWarmupCard: zbyt długi term i zbyt długie znaczenie', () => {
  assert.deepEqual(checkWarmupCard(card('one two three four five six')), { ok: false, reason: 'term_too_long' });
  assert.equal(checkWarmupCard(card('one two three four five')).ok, true);
  assert.deepEqual(checkWarmupCard(card('a'.repeat(61))), { ok: false, reason: 'term_too_long' });
  assert.deepEqual(checkWarmupCard(card('hello', 'x'.repeat(61))), { ok: false, reason: 'definition_too_long' });
});

test('checkWarmupCard: znaczenie identyczne z frazą jest odrzucane; zbyt długi przykład jest pomijany', () => {
  assert.deepEqual(checkWarmupCard(card('Hello', 'hello!')), { ok: false, reason: 'definition_same_as_term' });
  const r = checkWarmupCard(card('hello', 'cześć', { contextSentence: 'x'.repeat(201) }));
  assert.deepEqual(r, { ok: true, card: { term: 'hello', definition: 'cześć' } });
});

test('buildWarmupCards: duplikaty po normalizeSentence', () => {
  const r = buildWarmupCards([card('Take off'), card('take  OFF!', 'inne'), card('look up')]);
  assert.deepEqual(r.cards.map((c) => c.term), ['Take off', 'look up']);
  assert.deepEqual(r.reasons, ['duplicate_term']);
});

test('reguła anty-spoilerowa: fraza zawarta w dłuższym zdaniu pracy jest przyjęta', () => {
  const r = buildWarmupCards([card('take off')], ['She decided to take off her coat.']);
  assert.deepEqual(r.cards.map((c) => c.term), ['take off']);
  assert.deepEqual(r.reasons, []);
});

test('reguła anty-spoilerowa: fraza równa całemu zdaniu pracy jest odrzucana (bez interpunkcji i wielkości liter)', () => {
  const r = buildWarmupCards([card('Take off your coat'), card('look up')], ['take off your coat!', 'Wyjdź stąd']);
  assert.deepEqual(r.cards.map((c) => c.term), ['look up']);
  assert.deepEqual(r.reasons, ['term_in_task_sentence']);
});

test('buildWarmupCards: limit 6 kart', () => {
  const raw = Array.from({ length: 9 }, (_, i) => card(`phrase ${i}`));
  const r = buildWarmupCards(raw);
  assert.equal(r.cards.length, 6);
  assert.deepEqual(r.reasons, ['over_limit', 'over_limit', 'over_limit']);
});

test('sanitizeWarmupCards: nie-tablica → undefined, [] → [], same złe → undefined', () => {
  assert.equal(sanitizeWarmupCards(undefined), undefined);
  assert.equal(sanitizeWarmupCards(null), undefined);
  assert.equal(sanitizeWarmupCards('cards'), undefined);
  assert.equal(sanitizeWarmupCards({ term: 'a', definition: 'b' }), undefined);
  assert.deepEqual(sanitizeWarmupCards([]), []);
  assert.equal(sanitizeWarmupCards([{ term: 'a' }, 5]), undefined);
  assert.deepEqual(sanitizeWarmupCards([card('hello', 'cześć'), { term: 'a' }, 7]), [{ term: 'hello', definition: 'cześć' }]);
});

test('trzy stany pola: wyłączone, są karty, brak kart (pole pomijane)', () => {
  const cards = [{ term: 'hello', definition: 'cześć' }];
  assert.deepEqual(resolveWarmupCardsField(false, cards), []);
  assert.deepEqual(resolveWarmupCardsField(true, cards), cards);
  assert.equal(resolveWarmupCardsField(true, []), undefined);
  assert.deepEqual(warmupCardsFieldEntry([]), { warmupCards: [] });
  assert.deepEqual(warmupCardsFieldEntry(cards), { warmupCards: cards });
  assert.deepEqual(warmupCardsFieldEntry(undefined), {});
  assert.equal('warmupCards' in warmupCardsFieldEntry(undefined), false);
});

test('parseWarmupCardsFromText: różne separatory, linie bez znaczenia odrzucane', () => {
  const text = [
    'take off - zdjąć',
    'look up – sprawdzić',
    'give in — poddać się',
    'carry on: kontynuować',
    'run out = skończyć się',
    'just a word',
    '',
  ].join('\n');
  const r = parseWarmupCardsFromText(text);
  assert.deepEqual(r.cards.map((c) => [c.term, c.definition]), [
    ['take off', 'zdjąć'],
    ['look up', 'sprawdzić'],
    ['give in', 'poddać się'],
    ['carry on', 'kontynuować'],
    ['run out', 'skończyć się'],
  ]);
  assert.deepEqual(r.reasons, ['missing_definition']);
  assert.equal(parseWarmupCardsFromText('').cards.length, 0);
});

test('describeWarmupCardRejection: polskie opisy bez powtórzeń', () => {
  assert.equal(describeWarmupCardRejection([]), 'brak poprawnych kart');
  assert.equal(
    describeWarmupCardRejection(['missing_definition', 'missing_definition', 'duplicate_term']),
    'brak polskiego znaczenia; powtórzona fraza'
  );
});

test('parser zapasowy: jedna linia ze sklejonymi parami', () => {
  const line = 'arrive late - spóźnić się have breakfast / have coffee - jeść śniadanie / pić kawę';
  assert.deepEqual(splitFlattenedVocabularyLine(line), [
    { term: 'arrive late', definition: 'spóźnić się' },
    { term: 'have breakfast / have coffee', definition: 'jeść śniadanie / pić kawę' },
  ]);
  const r = parseWarmupCardsFromText(line);
  assert.deepEqual(r.cards.map((c) => [c.term, c.definition]), [
    ['arrive late', 'spóźnić się'],
    ['have breakfast / have coffee', 'jeść śniadanie / pić kawę'],
  ]);
  assert.deepEqual(r.reasons, []);
});

test('parser zapasowy: odcinek bez polskiego śladu daje odrzucenie, nie błędną kartę', () => {
  const r = parseWarmupCardsFromText('go home - dom take a break - przerwa');
  // „dom" nie ma polskiego śladu: granicy nie da się wyznaczyć.
  assert.deepEqual(r.cards, []);
  assert.ok(r.reasons.length > 0);
  assert.deepEqual(r.reasons, ['missing_definition', 'missing_term']);
});

test('parser zapasowy: mieszanka linii zwykłych i spłaszczonych', () => {
  const text = 'take off - zdjąć\nlook up - sprawdzić give in - poddać się\nrun out = skończyć się';
  const r = parseWarmupCardsFromText(text);
  assert.deepEqual(r.cards.map((c) => c.term), ['take off', 'look up', 'give in', 'run out']);
});

test('collectLessonCards: zestaw fiszek ma pierwszeństwo, karty bez znaczenia odpadają', () => {
  const r = collectLessonCards([
    {
      flashcards: [
        { term: 'b', definition: 'drugi', position: 1 },
        { term: 'a phrase', definition: 'pierwszy', position: 0 },
        { term: 'no meaning', definition: '', position: 2 },
      ],
      vocabularyText: 'ignored - zignorowane',
    },
  ]);
  assert.deepEqual(r.cards.map((c) => c.term), ['a phrase', 'b']);
  assert.deepEqual(r.reasons, ['missing_definition']);
});

test('collectLessonCards: brak zestawu → tekst słownictwa; wiele lekcji jest przeplatanych, max 6', () => {
  const fromText = collectLessonCards([{ flashcards: [], vocabularyText: 'take off - zdjąć' }]);
  assert.deepEqual(fromText.cards.map((c) => c.term), ['take off']);

  const mk = (prefix: string) => ({
    flashcards: Array.from({ length: 5 }, (_, i) => ({ term: `${prefix} ${i}`, definition: 'znaczenie', position: i })),
  });
  const r = collectLessonCards([mk('alpha'), mk('beta')]);
  assert.equal(r.cards.length, 6);
  assert.deepEqual(r.cards.slice(0, 4).map((c) => c.term), ['alpha 0', 'beta 0', 'alpha 1', 'beta 1']);
});

test('planWarmupCardSource: lekcje → zestawy lekcji, wklejony tekst / temat → model', () => {
  const lessons = [{ id: 'l1', topic: 'Travel', vocabularyText: 'x - y' }];
  const lessonsPlan = planWarmupCardSource('lessons', lessons, 'MATERIAŁ');
  assert.equal(lessonsPlan.kind, 'lessons');
  assert.deepEqual(lessonsPlan.kind === 'lessons' && lessonsPlan.lessons.map((l) => l.id), ['l1']);
  assert.deepEqual(planWarmupCardSource('text', [], 'MATERIAŁ'), { kind: 'ai', sourceText: 'MATERIAŁ' });
  assert.deepEqual(planWarmupCardSource('lessons', [], 'TEMAT'), { kind: 'ai', sourceText: 'TEMAT' });
});

test('parseGeneratedWarmupCards: walidacja z powodami, brak kart = no_cards', () => {
  const r = parseGeneratedWarmupCards({
    cards: [
      { term: 'take off', definition: 'zdjąć' },
      { term: 'I usually take off my coat at home', definition: 'zwykle zdejmuję płaszcz' },
      { term: 'look up', definition: '' },
    ],
  });
  assert.deepEqual(r.cards.map((c) => c.term), ['take off']);
  assert.deepEqual(r.reasons, ['term_too_long', 'missing_definition']);
  assert.deepEqual(parseGeneratedWarmupCards({}).reasons, ['no_cards']);
  assert.deepEqual(parseGeneratedWarmupCards(null).reasons, ['no_cards']);
});

test('zapis: flagi robocze kart nie trafiają do dokumentu, trzy stany pola', () => {
  const drafts = [{ term: 'take off', definition: 'zdjąć', contextSentence: 'Take off.', origin: 'ai' as const }, { term: 'a', definition: 'b', origin: 'lesson' as const }];
  const stripped = stripWarmupCardDraftFlags(drafts);
  assert.deepEqual(stripped, [{ term: 'take off', definition: 'zdjąć', contextSentence: 'Take off.' }, { term: 'a', definition: 'b' }]);
  assert.ok(stripped.every((c) => !('origin' in c)));
  assert.deepEqual(warmupCardsFieldEntry(resolveWarmupCardsField(false, stripped)), { warmupCards: [] });
  assert.deepEqual(warmupCardsFieldEntry(resolveWarmupCardsField(true, stripped)), { warmupCards: stripped });
  assert.deepEqual(warmupCardsFieldEntry(resolveWarmupCardsField(true, [])), {});
});

// ————— Ścieżki serwerowe: assign-homework (grupa) i GET direct —————

import { stripUndefinedDeep } from '../utils/directHomeworkEvaluation';

const hasUndefinedDeep = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefinedDeep);
  if (value && typeof value === 'object') return Object.values(value).some(hasUndefinedDeep);
  return false;
};

test('serwer: poprawna lista kart przechodzi, niepoprawne są odrzucane', () => {
  const out = sanitizeWarmupCards([
    card('take off', 'zdjąć', { contextSentence: 'Take off your coat.' }),
    { term: 'no meaning' },
    card('look after', 'opiekować się'),
    'not a card',
  ]);
  assert.deepEqual(out, [
    { term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.' },
    { term: 'look after', definition: 'opiekować się' },
  ]);
});

test('serwer: za dużo kart → obcięte do 6', () => {
  const many = Array.from({ length: 9 }, (_, i) => card(`phrase ${i}`));
  const out = sanitizeWarmupCards(many);
  assert.equal(out?.length, 6);
  assert.deepEqual(out?.map((c) => c.term), many.slice(0, 6).map((c) => c.term));
});

test('serwer: karta bez definition jest odrzucona; same złe karty → pole pominięte', () => {
  assert.equal(sanitizeWarmupCards([{ term: 'take off' }, { term: 'x', definition: '  ' }]), undefined);
});

test('serwer: nie-tablica lub brak → undefined, [] zachowane jako []', () => {
  for (const v of [undefined, null, 'x', 5, {}, { term: 'a', definition: 'b' }]) {
    assert.equal(sanitizeWarmupCards(v), undefined);
  }
  assert.deepEqual(sanitizeWarmupCards([]), []);
});

test('serwer: dokument zadania nie zawiera undefined (głębokie sprawdzenie)', () => {
  const build = (raw: unknown) =>
    stripUndefinedDeep({
      id: 'task_1',
      warmup: undefined,
      warmupCards: sanitizeWarmupCards(raw),
    });
  const withCards = build([card('take off', 'zdjąć', { contextSentence: undefined })]);
  assert.equal(hasUndefinedDeep(withCards), false);
  assert.deepEqual(withCards.warmupCards, [{ term: 'take off', definition: 'zdjąć' }]);
  const empty = build([]);
  assert.deepEqual(empty.warmupCards, []);
  const missing = build(undefined);
  assert.equal(hasUndefinedDeep(missing), false);
  assert.equal('warmupCards' in missing, false);
});

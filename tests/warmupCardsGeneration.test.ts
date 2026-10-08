import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWarmupCards, generateWarmupCardsForSource } from '../services/homeworkGenerator';
import { describeWarmupCardRejection } from '../utils/warmupCards';

const asker = (parsed: unknown) => async () => ({ parsed, modelUsed: 'test' });

test('generateWarmupCards: poprawne karty dostają origin „ai", niepoprawne odpadają z powodami', async () => {
  const r = await generateWarmupCards(
    'MATERIAŁ',
    ['Look up'],
    asker({
      cards: [
        { term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.' },
        { term: 'I usually take off my coat at home', definition: 'zwykle zdejmuję płaszcz' },
        { term: 'look up', definition: 'sprawdzić' },
        { term: 'give in', definition: '' },
      ],
    })
  );
  assert.deepEqual(r.cards, [{ term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.', origin: 'ai' }]);
  assert.equal(r.rejected, 3);
  assert.deepEqual(r.reasons, ['term_too_long', 'term_in_task_sentence', 'missing_definition']);
  assert.equal(
    describeWarmupCardRejection(r.reasons),
    'fraza dłuższa niż 5 słów; fraza to całe zdanie z pracy (zdradzałaby odpowiedź); brak polskiego znaczenia'
  );
});

test('generateWarmupCards: błąd modelu i pusta odpowiedź → [] z powodem, bez wyjątku', async () => {
  const failing = await generateWarmupCards('x', [], async () => {
    throw new Error('boom');
  });
  assert.deepEqual(failing, { cards: [], rejected: 0, reasons: ['model_error'] });
  const empty = await generateWarmupCards('x', [], asker({ cards: [] }));
  assert.deepEqual(empty, { cards: [], rejected: 0, reasons: ['no_cards'] });
});

test('generateWarmupCardsForSource: lekcje czytają zestaw fiszek i nie wołają modelu', async () => {
  let asked = 0;
  const r = await generateWarmupCardsForSource(
    { lessons: [{ id: 'l1', topic: 'Travel', vocabularyText: '' } as any] },
    'SRC',
    [],
    {
      fetchFlashcards: async (id) => {
        assert.equal(id, 'l1');
        return [{ term: 'arrive late', definition: 'spóźnić się', position: 0 }];
      },
      ask: async () => {
        asked++;
        return { parsed: {}, modelUsed: 'x' };
      },
    }
  );
  assert.deepEqual(r.cards, [{ term: 'arrive late', definition: 'spóźnić się', origin: 'lesson' }]);
  assert.equal(asked, 0);
});

test('generateWarmupCardsForSource: brak zestawu → tekst słownictwa (jedna linia), nadal bez modelu', async () => {
  let asked = 0;
  const r = await generateWarmupCardsForSource(
    {
      lessons: [
        { id: 'l1', topic: 'Daily', vocabularyText: 'arrive late - spóźnić się have breakfast / have coffee - jeść śniadanie / pić kawę' } as any,
      ],
    },
    'SRC',
    [],
    {
      fetchFlashcards: async () => [],
      ask: async () => {
        asked++;
        return { parsed: {}, modelUsed: 'x' };
      },
    }
  );
  assert.deepEqual(r.cards.map((c) => c.term), ['arrive late', 'have breakfast / have coffee']);
  assert.equal(asked, 0);
});

test('generateWarmupCardsForSource: wklejony tekst i lekcja bez kart wołają model', async () => {
  let asked = 0;
  const ask = async () => {
    asked++;
    return { parsed: { cards: [{ term: 'book a table', definition: 'zarezerwować stolik' }] }, modelUsed: 'x' };
  };
  const pasted = await generateWarmupCardsForSource({ pastedText: 'restaurants' }, 'SRC', [], { ask });
  assert.deepEqual(pasted.cards.map((c) => c.origin), ['ai']);
  const topicOnly = await generateWarmupCardsForSource(
    { lessons: [{ id: 'l2', topic: 'Restaurants', vocabularyText: '' } as any] },
    'SRC',
    [],
    { fetchFlashcards: async () => [], ask }
  );
  assert.equal(topicOnly.cards.length, 1);
  assert.equal(asked, 2);
});

test('generateWarmupCardsForSource: błąd odczytu fiszek nie rzuca wyjątku', async () => {
  const r = await generateWarmupCardsForSource(
    { lessons: [{ id: 'l1', topic: '', vocabularyText: 'take off - zdjąć' } as any] },
    'SRC',
    [],
    {
      fetchFlashcards: async () => {
        throw new Error('permission-denied');
      },
    }
  );
  assert.deepEqual(r.cards.map((c) => c.term), ['take off']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFlashcardQueue,
  getCurrentCard,
  canLeaveCurrentForLater,
  rateCurrentCard,
  leaveCurrentForLater,
  getSessionSummary,
} from '../utils/flashcardQueue';

const cards = [
  { id: 'c1', term: 'apple', definition: 'jabłko' },
  { id: 'c2', term: 'book', definition: 'książka' },
  { id: 'c3', term: 'cat', definition: 'kot' },
  { id: 'c4', term: 'dog', definition: 'pies' },
  { id: 'c5', term: 'elephant', definition: 'słoń' },
];

test('kolejka startowa: kolejność kart zachowana, brak słów słabych', () => {
  const state = createFlashcardQueue(cards);
  assert.equal(state.initialTotal, 5);
  assert.equal(state.masteredCount, 0);
  assert.equal(getCurrentCard(state)?.id, 'c1');
  assert.equal(state.isFinished, false);
  assert.deepEqual(state.weakWords, []);
});

test('ocena „Umiem": karta opanowana, znika z kolejki, rośnie masteredCount', () => {
  let state = createFlashcardQueue(cards);
  state = rateCurrentCard(state, true, 1200);

  assert.equal(state.masteredCount, 1);
  assert.equal(state.queue.length, 4);
  assert.equal(getCurrentCard(state)?.id, 'c2');
  assert.deepEqual(state.weakWords, []);

  const summary = getSessionSummary(state);
  assert.equal(summary.results.length, 1);
  assert.equal(summary.results[0].isCorrect, true);
  assert.equal(summary.results[0].responseTimeMs, 1200);
});

test('kolejność powrotów: „Nie umiem" wraca po ok. 3 kolejnych kartach', () => {
  let state = createFlashcardQueue(cards); // [c1, c2, c3, c4, c5]
  // Oceniamy c1 na false: remaining = [c2, c3, c4, c5]. Re-entry at index 3 -> [c2, c3, c4, c1, c5]
  state = rateCurrentCard(state, false, 800);

  assert.equal(state.masteredCount, 0);
  assert.equal(state.queue.length, 5);
  assert.deepEqual(state.queue.map((q) => q.card.id), ['c2', 'c3', 'c4', 'c1', 'c5']);
  assert.deepEqual(state.weakWords, ['apple']);
  assert.equal(getCurrentCard(state)?.id, 'c2');

  // c2 -> Umiem: remaining = [c3, c4, c1, c5]
  state = rateCurrentCard(state, true);
  assert.equal(getCurrentCard(state)?.id, 'c3');

  // c3 -> Umiem: remaining = [c4, c1, c5]
  state = rateCurrentCard(state, true);
  assert.equal(getCurrentCard(state)?.id, 'c4');

  // c4 -> Umiem: remaining = [c1, c5]
  state = rateCurrentCard(state, true);
  // Następna to powracające c1!
  assert.equal(getCurrentCard(state)?.id, 'c1');
});

test('kolejność powrotów: gdy zostało mniej niż 3 karty, wraca na koniec', () => {
  const twoCards = [cards[0], cards[1]]; // [c1, c2]
  let state = createFlashcardQueue(twoCards);

  // c1 false: remaining = [c2] (len 1 < 3). Wraca na koniec: [c2, c1]
  state = rateCurrentCard(state, false);
  assert.deepEqual(state.queue.map((q) => q.card.id), ['c2', 'c1']);

  // Jeśli została tylko 1 karta: remaining = []. Wraca na pozycję 0
  const oneCard = [cards[0]];
  let stateOne = createFlashcardQueue(oneCard);
  stateOne = rateCurrentCard(stateOne, false);
  assert.deepEqual(stateOne.queue.map((q) => q.card.id), ['c1']);
});

test('SRS i saveSession: zapisuje tylko PIERWSZĄ ocenę każdej karty', () => {
  let state = createFlashcardQueue([cards[0]]); // tylko c1
  // 1. Pierwsza ocena: false (błąd)
  state = rateCurrentCard(state, false, 2000);
  assert.equal(state.firstRatings.get('c1')?.isCorrect, false);
  assert.equal(state.firstRatings.get('c1')?.responseTimeMs, 2000);

  // 2. Karta wraca, teraz oceniamy na true (opanowana po powtórce)
  state = rateCurrentCard(state, true, 500);
  assert.equal(state.isFinished, true);

  // Pierwsza ocena w SRS NADAL ma isCorrect: false!
  const summary = getSessionSummary(state);
  assert.equal(summary.results.length, 1);
  assert.equal(summary.results[0].flashcardId, 'c1');
  assert.equal(summary.results[0].isCorrect, false, 'zapisuje pierwszą ocenę, nie powtórkę');
  assert.equal(summary.results[0].responseTimeMs, 2000);
  assert.equal(summary.correctCount, 0, 'wynik SRS odzwierciedla pierwszą próbę');
  assert.deepEqual(summary.weakWords, ['apple']);
});

test('zabezpieczenie pętli: po 4 kolejnych „Nie umiem" pojawia się opcja „Zostaw na później"', () => {
  let state = createFlashcardQueue([cards[0]]); // tylko c1

  for (let i = 1; i <= 3; i++) {
    assert.equal(canLeaveCurrentForLater(state), false, `próba ${i}: brak opcji`);
    state = rateCurrentCard(state, false);
  }
  // 4. błąd
  assert.equal(canLeaveCurrentForLater(state), false);
  state = rateCurrentCard(state, false);

  // Po 4 błędach: opcja jest dostępna!
  assert.equal(canLeaveCurrentForLater(state), true);

  // Użycie „Zostaw na później": karta kończy pętlę, sesja się kończy
  state = leaveCurrentForLater(state);
  assert.equal(state.isFinished, true);
  assert.equal(state.queue.length, 0);
  assert.deepEqual(state.weakWords, ['apple']);
});

test('zakończenie sesji: dopiero gdy wszystkie karty zostaną opanowane', () => {
  let state = createFlashcardQueue([cards[0], cards[1]]);
  state = rateCurrentCard(state, false); // c1 fail -> [c2, c1]
  assert.equal(state.isFinished, false);

  state = rateCurrentCard(state, true); // c2 pass -> [c1]
  assert.equal(state.isFinished, false);

  state = rateCurrentCard(state, true); // c1 pass -> []
  assert.equal(state.isFinished, true);
  assert.equal(state.masteredCount, 2);
});

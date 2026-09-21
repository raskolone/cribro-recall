// Test integracyjny (render + interakcja użytkownika) dla HomeworkWarmupScrambler —
// jedyny komponent React w projekcie testowany na poziomie DOM, więc jsdom jest
// ustawiany ręcznie tutaj, a nie globalnie, żeby nie obciążać pozostałych
// (czysto logicznych) testów node:test.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
// Node 22+ deklaruje `globalThis.navigator` jako gettera bez settera —
// zwykłe przypisanie rzuca "Cannot set property navigator".
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import HomeworkWarmupScrambler from '../components/dashboard/HomeworkWarmupScrambler';

// Runda 1 (8 unikalnych słów) wyraźnie dłuższa od rundy 2 (3 unikalne słowa) —
// dokładny scenariusz z hotfixa: `shuffledBank` przelicza się na nowo z
// useMemo przy zmianie `currentIndex`, a stary reset w osobnym useEffect
// uruchamiał się PO renderze, więc pierwszy render krótszej rundy 2 czytał
// jeszcze indeksy kafelków z dłuższej rundy 1 i `shuffledBank[bankIndex]`
// wypadało poza zakres.
const ROUND_1_WORDS = ['I', 'always', 'try', 'to', 'speak', 'English', 'quite', 'slowly'];
const ROUND_2_WORDS = ['She', 'likes', 'tea'];

const sentences = [
  {
    chunks: ROUND_1_WORDS,
    correctSentence: ROUND_1_WORDS.join(' '),
  },
  {
    chunks: ROUND_2_WORDS,
    correctSentence: ROUND_2_WORDS.join(' '),
  },
];

test('HomeworkWarmupScrambler: przejście z dłuższej rundy 1 do krótszej rundy 2 nie crashuje (reading \'word\')', () => {
  const onComplete = () => {};
  const onSkip = () => {};

  const { container, getAllByTestId } = render(
    React.createElement(HomeworkWarmupScrambler, {
      sentences,
      onComplete,
      onSkip,
    })
  );

  // Układamy rundę 1 w poprawnej kolejności, klikając kafelki z banku po
  // tekście — klikanie w złej kolejności dałoby "close", nie "correct".
  for (const word of ROUND_1_WORDS) {
    const bankTiles = getAllByTestId('warmup-bank-tile');
    const tile = bankTiles.find((el) => el.textContent === word && !(el as HTMLButtonElement).disabled);
    assert.ok(tile, `kafelek "${word}" powinien być dostępny w rundzie 1`);
    fireEvent.click(tile!);
  }

  // Runda 1 ułożona poprawnie -> pojawia się przycisk przejścia do rundy 2.
  const nextButtons1 = getAllByTestId('warmup-next-button');
  assert.equal(nextButtons1.length, 1);
  assert.equal((nextButtons1[0] as HTMLButtonElement).disabled, false);

  // Dokładnie to kliknięcie wcześniej crashowało renderowanie rundy 2.
  fireEvent.click(nextButtons1[0]);

  // Runda 2 renderuje się bez wyjątku i pokazuje WYŁĄCZNIE swoje 3 słowa —
  // brak śladu indeksów/kafelków z dłuższej rundy 1.
  const bankTilesRound2 = getAllByTestId('warmup-bank-tile');
  assert.equal(bankTilesRound2.length, ROUND_2_WORDS.length);
  const renderedWords = bankTilesRound2.map((el) => el.textContent).sort();
  assert.deepEqual(renderedWords, [...ROUND_2_WORDS].sort());

  // "Twoje zdanie" musi być puste — pełny synchroniczny reset stanu rundy,
  // nie tylko brak crasha.
  assert.equal(within(container).queryAllByTestId('warmup-selected-tile').length, 0);

  cleanup();
});

test('HomeworkWarmupScrambler: przycisk "Dalej" jest aktywny również przy wyniku "close" (bliskie, zła kolejność)', () => {
  const onComplete = () => {};
  const onSkip = () => {};

  const { getAllByTestId } = render(
    React.createElement(HomeworkWarmupScrambler, {
      sentences: [sentences[0]],
      onComplete,
      onSkip,
    })
  );

  // Te same słowa, celowo odwrócona kolejność -> ten sam multiset, zły szyk -> "close".
  for (const word of [...ROUND_1_WORDS].reverse()) {
    const bankTiles = getAllByTestId('warmup-bank-tile');
    const tile = bankTiles.find((el) => el.textContent === word && !(el as HTMLButtonElement).disabled);
    assert.ok(tile, `kafelek "${word}" powinien być dostępny`);
    fireEvent.click(tile!);
  }

  const nextButtons = getAllByTestId('warmup-next-button');
  assert.equal(nextButtons.length, 1);
  assert.equal((nextButtons[0] as HTMLButtonElement).disabled, false);

  cleanup();
});

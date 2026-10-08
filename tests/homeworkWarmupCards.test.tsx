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

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '../i18n';
import HomeworkWarmupCards from '../components/dashboard/HomeworkWarmupCards';

afterEach(() => {
  cleanup();
  delete (dom.window as any).speechSynthesis;
  delete (globalThis as any).SpeechSynthesisUtterance;
});

const cards = [
  { term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.' },
  { term: 'look up', definition: 'sprawdzić' },
];

const setup = () => {
  const calls = { done: 0, skip: 0 };
  const utils = render(
    React.createElement(HomeworkWarmupCards, { cards, onDone: () => calls.done++, onSkip: () => calls.skip++ })
  );
  return { ...utils, calls };
};

test('HomeworkWarmupCards: renderuje pierwszą kartę, wskaźnik i angielską frazę', () => {
  const { getByTestId } = setup();
  assert.equal(getByTestId('warmup-cards-progress').textContent, 'Karta 1 z 2');
  assert.equal(getByTestId('warmup-card-front').textContent?.includes('take off'), true);
  assert.equal(getByTestId('warmup-card').getAttribute('data-flipped'), 'false');
});

test('HomeworkWarmupCards: klik i spacja obracają kartę; rewers pokazuje znaczenie i przykład', () => {
  const { getByTestId } = setup();
  const cardEl = getByTestId('warmup-card');
  fireEvent.click(cardEl);
  assert.equal(cardEl.getAttribute('data-flipped'), 'true');
  const back = getByTestId('warmup-card-back').textContent ?? '';
  assert.ok(back.includes('zdjąć') && back.includes('Take off your coat.'));
  fireEvent.keyDown(cardEl, { key: ' ' });
  assert.equal(cardEl.getAttribute('data-flipped'), 'false');
});

test('HomeworkWarmupCards: Dalej/Wstecz, strzałki, reset obrotu i Zakończ karty na ostatniej', () => {
  const { getByTestId, getByText, calls, container } = setup();
  fireEvent.click(getByTestId('warmup-card'));
  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.equal(getByTestId('warmup-cards-progress').textContent, 'Karta 2 z 2');
  assert.equal(getByTestId('warmup-card').getAttribute('data-flipped'), 'false');
  assert.equal(calls.done, 0);
  assert.ok(getByText('Zakończ karty'));

  fireEvent.keyDown(getByTestId('warmup-card'), { key: 'ArrowLeft' });
  assert.equal(getByTestId('warmup-cards-progress').textContent, 'Karta 1 z 2');
  fireEvent.keyDown(getByTestId('warmup-card'), { key: 'ArrowRight' });
  assert.equal(getByTestId('warmup-cards-progress').textContent, 'Karta 2 z 2');

  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.equal(calls.done, 1);
  assert.ok(container);
});

test('HomeworkWarmupCards: „Wstecz" jest wyłączone na pierwszej karcie', () => {
  const { getByText } = setup();
  assert.equal((getByText('Wstecz').closest('button') as HTMLButtonElement).disabled, true);
});

test('HomeworkWarmupCards: „Pomiń rozgrzewkę" wywołuje onSkip, nie onDone', () => {
  const { getByText, calls } = setup();
  fireEvent.click(getByText('Pomiń rozgrzewkę'));
  assert.equal(calls.skip, 1);
  assert.equal(calls.done, 0);
});

test('HomeworkWarmupCards: bez speechSynthesis przycisk wymowy jest ukryty', () => {
  const { queryByTestId } = setup();
  assert.equal('speechSynthesis' in dom.window, false);
  assert.equal(queryByTestId('warmup-cards-speak'), null);
});

test('HomeworkWarmupCards: z speechSynthesis przycisk czyta frazę (cancel + speak, en-GB)', () => {
  const spoken: Array<{ text: string; lang: string }> = [];
  let cancelled = 0;
  (dom.window as any).speechSynthesis = {
    cancel: () => cancelled++,
    speak: (u: any) => spoken.push({ text: u.text, lang: u.lang }),
    getVoices: () => [],
  };
  (globalThis as any).SpeechSynthesisUtterance = class {
    text: string;
    lang = '';
    rate = 1;
    voice: unknown = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  const { getByTestId } = setup();
  fireEvent.click(getByTestId('warmup-cards-speak'));
  assert.equal(cancelled, 1);
  assert.deepEqual(spoken, [{ text: 'take off', lang: 'en-GB' }]);
});

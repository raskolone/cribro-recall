import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import WhatsNextSection from '../components/practice/WhatsNextSection';
import MatchingGame from '../components/flashcards/MatchingGame';
import type { MatchCardInput } from '../utils/matchingGame';

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});

afterEach(() => {
  cleanup();
});

test('WhatsNextSection: renderuje nagłówek, słowa słabe, 3 opcje (Quiz, Tłumaczenie, Korekta) i przycisk powrotu', () => {
  const { getByTestId, queryByTestId } = render(
    <WhatsNextSection
      weakWords={['awkward', 'embarrassed']}
      onStartQuiz={() => {}}
      onStartSentences={() => {}}
      onBack={() => {}}
    />
  );

  assert.ok(getByTestId('whats-next-title'));
  assert.ok(getByTestId('whats-next-weak-words'));
  assert.ok(getByTestId('whats-next-weak-words').textContent?.includes('awkward'));
  assert.ok(getByTestId('whats-next-weak-words').textContent?.includes('embarrassed'));

  assert.ok(getByTestId('whats-next-quiz'));
  assert.ok(getByTestId('whats-next-translation'));
  assert.ok(getByTestId('whats-next-correction'));
  assert.ok(getByTestId('whats-next-back'));
});

test('WhatsNextSection: kliknięcie Rozpocznij quiz wywołuje onStartQuiz', () => {
  let quizStarted = false;
  const { getByTestId } = render(
    <WhatsNextSection
      weakWords={['awkward']}
      onStartQuiz={() => { quizStarted = true; }}
      onStartSentences={() => {}}
      onBack={() => {}}
    />
  );

  fireEvent.click(getByTestId('whats-next-start-quiz'));
  assert.equal(quizStarted, true);
});

test('WhatsNextSection: zmiana liczby zdań i kliknięcie Tłumaczenie przekazuje count', () => {
  let sentFormat: string | null = null;
  let sentCount: number | null = null;

  const { getByTestId } = render(
    <WhatsNextSection
      weakWords={['hesitate']}
      onStartQuiz={() => {}}
      onStartSentences={(format, count) => {
        sentFormat = format;
        sentCount = count;
      }}
      onBack={() => {}}
    />
  );

  // Zwiększenie liczby zdań suwakiem Tłumaczenia z 5 na 6
  const translationInc = getByTestId('whats-next-translation').querySelector('[data-testid="sentence-count-increment"]') as HTMLButtonElement;
  assert.ok(translationInc);
  fireEvent.click(translationInc);

  fireEvent.click(getByTestId('whats-next-start-translation'));
  assert.equal(sentFormat, 'translation');
  assert.equal(sentCount, 6);
});

test('WhatsNextSection: zmiana liczby zdań i kliknięcie Korekta przekazuje count', () => {
  let sentFormat: string | null = null;
  let sentCount: number | null = null;

  const { getByTestId } = render(
    <WhatsNextSection
      weakWords={[]}
      onStartQuiz={() => {}}
      onStartSentences={(format, count) => {
        sentFormat = format;
        sentCount = count;
      }}
      onBack={() => {}}
    />
  );

  // Zmniejszenie liczby zdań suwakiem Korekty z 5 na 4
  const correctionDec = getByTestId('whats-next-correction').querySelector('[data-testid="sentence-count-decrement"]') as HTMLButtonElement;
  assert.ok(correctionDec);
  fireEvent.click(correctionDec);

  fireEvent.click(getByTestId('whats-next-start-correction'));
  assert.equal(sentFormat, 'correction');
  assert.equal(sentCount, 4);
});

test('MatchingGame: po zakończeniu partii pokazuje WhatsNextSection ze słowami błędnymi', async () => {
  const cards: MatchCardInput[] = [
    { id: 'c1', term: 'stubborn', definition: 'uparty' },
    { id: 'c2', term: 'reliable', definition: 'niezawodny' },
  ];

  let quizWrongWords: string[] | null = null;

  const { container, findByTestId } = render(
    <MatchingGame
      cards={cards}
      onBack={() => {}}
      onQuit={() => {}}
      onFinish={() => {}}
      reducedMotion
      renderPronunciation={(text) => <span>{text}</span>}
      onStartQuiz={(wrong) => { quizWrongWords = wrong; }}
      onStartSentences={() => {}}
    />
  );

  // Zróbmy 1 błąd: kliknij stubborn (c1) + niezawodny (c2)
  const leftC1 = container.querySelector('[data-tile-key="left-c1"]') as HTMLElement;
  const rightC2 = container.querySelector('[data-tile-key="right-c2"]') as HTMLElement;
  fireEvent.click(leftC1);
  fireEvent.click(rightC2);

  await new Promise((resolve) => setTimeout(resolve, 850));

  // Następnie połączmy poprawnie obie pary
  const leftC1Again = container.querySelector('[data-tile-key="left-c1"]') as HTMLElement;
  const rightC1 = container.querySelector('[data-tile-key="right-c1"]') as HTMLElement;
  fireEvent.click(leftC1Again);
  fireEvent.click(rightC1);

  const leftC2 = container.querySelector('[data-tile-key="left-c2"]') as HTMLElement;
  const rightC2Again = container.querySelector('[data-tile-key="right-c2"]') as HTMLElement;
  fireEvent.click(leftC2);
  fireEvent.click(rightC2Again);

  await new Promise((resolve) => setTimeout(resolve, 50));

  const whatsNext = await findByTestId('whats-next-section');
  assert.ok(whatsNext);
  assert.ok(container.querySelector('[data-testid="whats-next-weak-words"]')?.textContent?.includes('stubborn'));

  // Kliknięcie quiz przekazuje oba słowa z błędnej próby
  const startQuizBtn = await findByTestId('whats-next-start-quiz');
  fireEvent.click(startQuizBtn);
  assert.deepEqual(quizWrongWords, ['stubborn', 'reliable']);
});

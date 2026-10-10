import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '../i18n';
import QuizOption from '../components/flashcards/QuizOption';

afterEach(cleanup);

const mount = (state: 'default' | 'correct' | 'incorrect' | 'disabled', onSelect = () => {}) =>
  render(<QuizOption html="wyczerpać <b>zapasy</b>" state={state} onSelect={onSelect} />);

test('stan poprawny: ikona + tekst dla czytników ekranu, nie tylko kolor', () => {
  const { getByTestId } = mount('correct');
  const el = getByTestId('quiz-option');
  assert.ok(el.querySelector('svg'), 'ikona');
  assert.equal(el.querySelector('svg')?.getAttribute('aria-hidden'), 'true');
  assert.equal(el.querySelector('.sr-only')?.textContent, 'Poprawna odpowiedź');
  assert.equal(el.getAttribute('aria-disabled'), 'true');
});

test('stan błędny: ikona + tekst dla czytników ekranu', () => {
  const el = mount('incorrect').getByTestId('quiz-option');
  assert.ok(el.querySelector('svg'));
  assert.equal(el.querySelector('.sr-only')?.textContent, 'Błędna odpowiedź');
});

test('stan domyślny jest klikalny, ma hover/focus z tokenów i brak ikony/sr-only', () => {
  let n = 0;
  const el = mount('default', () => n++).getByTestId('quiz-option');
  assert.equal(el.getAttribute('aria-disabled'), null);
  assert.equal(el.querySelector('svg'), null);
  assert.equal(el.querySelector('.sr-only'), null);
  assert.match(el.className, /hover:bg-primary\/10/);
  fireEvent.click(el);
  assert.equal(n, 1);
});

test('po odpowiedzi kafelki nie reagują na klik (aria-disabled zamiast disabled, bez blednięcia tekstu)', () => {
  for (const state of ['correct', 'incorrect', 'disabled'] as const) {
    let n = 0;
    cleanup();
    const el = mount(state, () => n++).getByTestId('quiz-option');
    fireEvent.click(el);
    assert.equal(n, 0, state);
    assert.equal((el as HTMLButtonElement).disabled, false, `${state}: natywny disabled nakłada na iOS szary kolor i krycie`);
    assert.doesNotMatch(el.className, /opacity/);
    assert.match(el.className, /min-h-14/);
  }
});

test('treść odpowiedzi renderuje się z HTML fiszki', () => {
  const el = mount('default').getByTestId('quiz-option');
  assert.equal(el.querySelector('b')?.textContent, 'zapasy');
});

test('QuizMode używa QuizOption, odpowiedzi na dole telefonu, komunikat dla czytników w aria-live', () => {
  const s = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
  const quiz = s.slice(s.indexOf('// --- Quiz Mode Component ---'), s.indexOf('// --- Writing Mode Component ---'));
  assert.match(quiz, /<QuizOption/);
  assert.match(quiz, /max-md:mt-auto/);
  assert.match(quiz, /role="status" aria-live="polite"/);
  assert.match(quiz, /px-4 sm:px-0/);
  assert.doesNotMatch(quiz, /opacity-50/);
  assert.doesNotMatch(quiz, /bg-primary\/20 border-primary text-primary/);
});

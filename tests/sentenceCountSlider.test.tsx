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
import SentenceCountSlider from '../components/practice/SentenceCountSlider';

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});

afterEach(() => {
  cleanup();
});

test('SentenceCountSlider: renderuje natywny suwak 1–20 z dostępnymi atrybutami', () => {
  const { getByTestId } = render(
    <SentenceCountSlider value={5} onChange={() => {}} min={1} max={20} />
  );

  const slider = getByTestId('sentence-count-slider') as HTMLInputElement;
  assert.equal(slider.tagName, 'INPUT');
  assert.equal(slider.type, 'range');
  assert.equal(slider.getAttribute('min'), '1');
  assert.equal(slider.getAttribute('max'), '20');
  assert.equal(slider.getAttribute('step'), '1');
  assert.equal(slider.getAttribute('aria-valuenow'), '5');
  assert.equal(slider.getAttribute('aria-valuemin'), '1');
  assert.equal(slider.getAttribute('aria-valuemax'), '20');
  assert.ok(slider.getAttribute('aria-valuetext')?.includes('5'));
});

test('SentenceCountSlider: przyciski minus i plus zmieniają wartość w dopuszczalnym zakresie', () => {
  const values: number[] = [];
  const { getByTestId, rerender } = render(
    <SentenceCountSlider value={5} onChange={(v) => values.push(v)} min={1} max={20} />
  );

  const decBtn = getByTestId('sentence-count-decrement');
  const incBtn = getByTestId('sentence-count-increment');

  // Kliknięcie minus → 4
  fireEvent.click(decBtn);
  assert.equal(values[values.length - 1], 4);

  // Kliknięcie plus → 6
  fireEvent.click(incBtn);
  assert.equal(values[values.length - 1], 6);

  // Granica dolna (wartość 1 → przycisk minus disabled)
  rerender(<SentenceCountSlider value={1} onChange={(v) => values.push(v)} min={1} max={20} />);
  assert.equal((getByTestId('sentence-count-decrement') as HTMLButtonElement).disabled, true);

  // Granica górna (wartość 20 → przycisk plus disabled)
  rerender(<SentenceCountSlider value={20} onChange={(v) => values.push(v)} min={1} max={20} />);
  assert.equal((getByTestId('sentence-count-increment') as HTMLButtonElement).disabled, true);
});

test('SentenceCountSlider: zmiana wartości przez suwak wywołuje onChange z przycięciem', () => {
  const values: number[] = [];
  const { getByTestId } = render(
    <SentenceCountSlider value={5} onChange={(v) => values.push(v)} min={1} max={20} />
  );

  const slider = getByTestId('sentence-count-slider');
  fireEvent.input(slider, { target: { value: '12' } });
  assert.equal(values[values.length - 1], 12);
});

test('SentenceCountSlider: dotyk ≥ 44 px (klasy min-h-11 / min-w-11 / h-11 / w-11)', () => {
  const { getByTestId } = render(
    <SentenceCountSlider value={5} onChange={() => {}} min={1} max={20} />
  );

  const decBtn = getByTestId('sentence-count-decrement');
  const incBtn = getByTestId('sentence-count-increment');
  const slider = getByTestId('sentence-count-slider');

  assert.ok(decBtn.className.includes('min-h-11') || decBtn.className.includes('h-11'));
  assert.ok(incBtn.className.includes('min-h-11') || incBtn.className.includes('h-11'));
  assert.ok(slider.className.includes('h-11'));
});

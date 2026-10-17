import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import i18n from '../i18n';
import HomeworkExercise from '../components/dashboard/HomeworkExercise';
import { EXERCISE_INSTRUCTION_KEYS, splitAtGap } from '../utils/exerciseInstruction';

afterEach(cleanup);

const items: Array<[string, any, string]> = [
  ['translation', { polishSentence: 'Idę do pracy.', correctAnswer: 'I go to work.' }, 'translation'],
  ['multiple_choice', { question: 'She ___ here.', options: ['is', 'are', 'am', 'be'], correctIndex: 0 }, 'multiple_choice'],
  ['matching', { pairs: [{ id: 'a', left: 'dog', right: 'pies' }, { id: 'b', left: 'cat', right: 'kot' }] }, 'matching'],
  ['fill_in_the_blank', { text: 'She ___ a book.', answer: 'reads' }, 'fill_in_the_blank'],
  ['word_order', { chunks: ['I', 'like', 'tea'], correctSentence: 'I like tea' }, 'word_order'],
  ['find_errors', { incorrectSentence: 'She go home.', correctSentence: 'She goes home.' }, 'find_errors'],
];

for (const [type, item, expected] of items) {
  test(`polecenie nad treścią (${type}): osobna etykieta z i18n, nie z modelu`, async () => {
    await i18n.changeLanguage('pl');
    const { container } = render(<HomeworkExercise type={type as any} item={{ ...item, taskLabel: 'POLECENIE Z MODELU' }} answer={undefined} onChange={() => {}} />);
    const label = container.querySelector('[data-testid="exercise-instruction"]');
    assert.ok(label, 'brak etykiety polecenia');
    assert.equal(label!.getAttribute('data-instruction-type'), expected);
    assert.equal(label!.textContent, i18n.t((EXERCISE_INSTRUCTION_KEYS as any)[expected]));
    assert.ok(!container.textContent!.includes('POLECENIE Z MODELU'));
    assert.match(label!.className, /text-text-hi/);
    // Wyśrodkowane, większe, półgruby krój; neon w klasie .exercise-instruction (index.css).
    assert.match(label!.className, /\btext-lg\b/);
    assert.match(label!.className, /\btext-center\b/);
    assert.match(label!.className, /\bfont-semibold\b/);
    assert.match(label!.className, /\bexercise-instruction\b/);
  });
}

test('wszystkie polecenia mają tłumaczenie w en.json i pl.json', () => {
  const en = JSON.parse(readFileSync('en.json', 'utf8'));
  const pl = JSON.parse(readFileSync('pl.json', 'utf8'));
  for (const key of Object.values(EXERCISE_INSTRUCTION_KEYS)) {
    assert.ok(en[key] && en[key] !== key, `en: ${key}`);
    assert.equal(pl[key], key);
  }
});

test('wielokrotny wybór: luka jako pole .mc-gap zamiast podkreślników, treść w danych bez zmian', () => {
  const q = 'She ___ in this office since 2019.';
  const { getByTestId } = render(<HomeworkExercise type="multiple_choice" item={{ question: q, options: ['has worked', 'works', 'is working', 'worked'], correctIndex: 0 }} answer={undefined} onChange={() => {}} />);
  const gap = getByTestId('mc-gap');
  assert.ok(gap.classList.contains('mc-gap'));
  const text = getByTestId('mc-question').textContent!;
  assert.ok(!text.includes('___'));
  assert.equal(text, 'She  in this office since 2019.');
  assert.match(getByTestId('mc-grid').className, /grid-cols-2/);
  assert.match(getByTestId('mc-grid').className, /max-\[359px\]:grid-cols-1/);
});

test('splitAtGap: pierwsza luka dzieli zdanie, brak luki = null', () => {
  assert.deepEqual(splitAtGap('A ___ b.'), { before: 'A ', after: ' b.' });
  assert.equal(splitAtGap('Bez luki.'), null);
  assert.equal(splitAtGap(undefined), null);
});

test('CSS: .mc-gap i .game-tile mają min. wysokość dotyku (≥ 56 px kafelek)', () => {
  const css = readFileSync('index.css', 'utf8');
  assert.match(css, /\.mc-gap\s*\{/);
  assert.match(css, /\.game-tile \{[^}]*min-height: 3\.5rem/s);
});

test('neon polecenia: statyczny, z tokenów motywu, bez animacji i bez surowych kolorów', () => {
  const css = readFileSync('index.css', 'utf8');
  const start = css.indexOf('.exercise-instruction {');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('.exercise-instruction {', start + 30)) + 3);
  assert.ok(start > 0 && block.includes('box-shadow') && block.includes('text-shadow'));
  assert.match(block, /var\(--color-primary\)/);
  assert.doesNotMatch(block, /animation|transition|@keyframes|#[0-9a-f]{3,8}\b|rgba?\(/i);
});

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
import React, { useState } from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import i18n from '../i18n';
import HomeworkExercise from '../components/dashboard/HomeworkExercise';

afterEach(cleanup);

const item = {
  question: 'She ___ in this office since 2019.',
  grammarFocus: 'tense',
  options: ['has worked', 'works', 'is working', 'worked'],
  correctIndex: 0,
  explanation: 'Since + punkt w czasie wymaga Present Perfect.',
};

const Host: React.FC<{ item: any; start?: number | null }> = ({ item: it, start = null }) => {
  const [answer, setAnswer] = useState<number | null>(start);
  return <HomeworkExercise type="multiple_choice" item={it} answer={answer} onChange={setAnswer} />;
};
const click = (el: Element) => act(() => { fireEvent.click(el); });

test('cztery opcje w siatce 2×2 o równych kafelkach (wspólny styl, bez ręcznych kolorów)', () => {
  const { getByTestId, getAllByTestId } = render(<Host item={item} />);
  const grid = getByTestId('mc-grid');
  assert.match(grid.className, /grid-cols-2/);
  assert.match(grid.className, /auto-rows-fr/);
  const tiles = getAllByTestId('mc-option');
  assert.equal(tiles.length, 4);
  assert.ok(tiles.every((t) => t.classList.contains('game-tile') && t.getAttribute('data-state') === 'rest'));
  assert.ok(tiles.every((t) => t.getAttribute('aria-pressed') === 'false'));
});

test('etykieta zagadnienia pochodzi z i18n (pl i en), nie z treści zadania', async () => {
  const { getByTestId } = render(<Host item={{ ...item, grammarFocus: 'tense' }} />);
  assert.match(getByTestId('mc-focus').textContent!, /Zagadnienie: Czas gramatyczny/);
  await i18n.changeLanguage('en');
  cleanup();
  const en = render(<Host item={{ ...item, grammarFocus: 'tense' }} />);
  assert.match(en.getByTestId('mc-focus').textContent!, /Focus: Tense/);
  await i18n.changeLanguage('pl');
});

test('stare zadanie bez grammarFocus i bez wyjaśnienia: działa, bez etykiety', () => {
  const old = { question: 'I ___ tea.', options: ['like', 'likes'], correctIndex: 0 };
  const { queryByTestId, getAllByTestId } = render(<Host item={old} />);
  assert.equal(queryByTestId('mc-focus'), null);
  assert.equal(getAllByTestId('mc-option').length, 2);
  click(getAllByTestId('mc-option')[1]);
  assert.equal(queryByTestId('mc-explanation'), null);
  assert.equal(getAllByTestId('mc-option')[1].getAttribute('data-state'), 'wrong');
});

test('odpowiedź błędna: błędna z ikoną i tekstem, poprawna wskazana, reszta zablokowana, wyjaśnienie widoczne', () => {
  const { getAllByTestId, getByTestId } = render(<Host item={item} />);
  const tiles = () => getAllByTestId('mc-option');
  click(tiles()[2]);
  assert.deepEqual(tiles().map((t) => t.getAttribute('data-state')), ['correct', 'locked', 'wrong', 'locked']);
  assert.ok(tiles()[2].querySelector('svg'), 'ikona na błędnej');
  assert.ok(tiles()[0].querySelector('svg'), 'ikona na poprawnej');
  assert.match(tiles()[2].textContent!, /Błędna odpowiedź/);
  assert.match(tiles()[0].textContent!, /Poprawna odpowiedź/);
  assert.equal(tiles()[1].querySelector('svg'), null);
  assert.equal(getByTestId('mc-explanation').textContent, item.explanation);
  const result = getByTestId('mc-result');
  assert.equal(result.getAttribute('aria-live'), 'polite');
  assert.match(result.textContent!, /Błędna odpowiedź/);
  // po odpowiedzi wybór jest ostateczny
  click(tiles()[1]);
  assert.equal(tiles()[2].getAttribute('data-state'), 'wrong');
  assert.ok(tiles().every((t) => t.getAttribute('aria-disabled') === 'true'));
});

test('odpowiedź poprawna: tekst „Poprawna odpowiedź” w wyniku i na kafelku', () => {
  const { getAllByTestId, getByTestId } = render(<Host item={item} />);
  click(getAllByTestId('mc-option')[0]);
  assert.deepEqual(getAllByTestId('mc-option').map((t) => t.getAttribute('data-state')), ['correct', 'locked', 'locked', 'locked']);
  assert.match(getByTestId('mc-result').textContent!, /Poprawna odpowiedź/);
});

test('wcześniej zapisana odpowiedź (powrót do zadania) od razu pokazuje wynik', () => {
  const { getAllByTestId } = render(<Host item={item} start={1} />);
  assert.deepEqual(getAllByTestId('mc-option').map((t) => t.getAttribute('data-state')), ['correct', 'wrong', 'locked', 'locked']);
});

test('widok MC nie ma surowych kolorów ani px < 16 (tokeny i wspólny styl)', () => {
  const src = readFileSync(new URL('../components/dashboard/HomeworkMultipleChoice.tsx', import.meta.url), 'utf8');
  assert.ok(!/text-white|bg-white|text-\[1[0-5]px\]|\bvh\b/.test(src));
  assert.ok(src.includes('gameTileAttrs'));
});

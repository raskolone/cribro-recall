import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import '../i18n';
import HomeworkExercise from '../components/dashboard/HomeworkExercise';

afterEach(cleanup);

const mkItem = (n: number) => ({ pairs: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, left: `en${i}`, right: `pl${i}` })) });

/** Rodzic trzymający odpowiedź w stanie — jak StudentHomeworkScreen; każdy zapis = re-render rodzica. */
const Host: React.FC<{ item: any; onAnswer?: (a: string[]) => void }> = ({ item, onAnswer }) => {
  const [answer, setAnswer] = useState<string[]>([]);
  return (
    <HomeworkExercise
      type="matching"
      item={{ ...item, pairs: item.pairs.map((p: any) => ({ ...p })) }}
      answer={answer}
      onChange={(a) => { setAnswer(a); onAnswer?.(a); }}
    />
  );
};

const click = (el: Element) => act(() => { fireEvent.click(el); });
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
const tiles = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-testid="matching-tile"]')) as HTMLElement[];
const order = (c: HTMLElement) => tiles(c).map((t) => t.getAttribute('data-tile-key')).join();
const tile = (c: HTMLElement, key: string) => c.querySelector(`[data-tile-key="${key}"]`) as HTMLElement;

test('układ: angielski po lewej w kolejności zadania, polski po prawej przetasowany, 2 px kafelki z wspólnej klasy', () => {
  const { container } = render(<Host item={mkItem(5)} />);
  const all = tiles(container);
  assert.equal(all.length, 10);
  assert.deepEqual(all.slice(0, 5).map((t) => t.getAttribute('data-side')), Array(5).fill('left'));
  assert.deepEqual(all.slice(0, 5).map((t) => t.textContent), ['en0', 'en1', 'en2', 'en3', 'en4']);
  assert.notDeepEqual(all.slice(5).map((t) => t.textContent), ['pl0', 'pl1', 'pl2', 'pl3', 'pl4']);
  assert.ok(all.every((t) => t.classList.contains('game-tile')));
  assert.ok(all.every((t) => t.getAttribute('data-shade') === null), 'przed trafieniem żaden kafelek nie ma koloru pary');
});

test('kolejność NIE zmienia się przy zaznaczeniu, błędzie, trafieniu ani re-renderze rodzica z nową tablicą par', async () => {
  const { container, rerender } = render(<Host item={mkItem(5)} />);
  const first = order(container);
  for (let i = 0; i < 8; i++) rerender(<Host item={mkItem(5)} />);
  assert.equal(order(container), first, 're-render');
  click(tile(container, 'left-p0'));
  assert.equal(order(container), first, 'zaznaczenie');
  click(tile(container, 'right-p1'));
  assert.equal(order(container), first, 'błąd');
  await wait(700);
  assert.equal(order(container), first, 'po błędzie');
  click(tile(container, 'left-p0'));
  click(tile(container, 'right-p0'));
  assert.equal(order(container), first, 'trafienie');
  rerender(<Host item={mkItem(5)} />);
  assert.equal(order(container), first, 'po trafieniu i re-renderze');
});

test('trafiona para zostaje na miejscu, zablokowana, w jednym odcieniu; kolejne pary w innych; niedopasowane bez koloru', () => {
  const answers: string[][] = [];
  const { container } = render(<Host item={mkItem(5)} onAnswer={(a) => answers.push(a)} />);
  click(tile(container, 'right-p2'));
  click(tile(container, 'left-p2'));
  const [l2, r2] = [tile(container, 'left-p2'), tile(container, 'right-p2')];
  assert.equal(l2.getAttribute('data-state'), 'locked');
  assert.equal(r2.getAttribute('data-state'), 'locked');
  assert.equal(l2.getAttribute('data-shade'), r2.getAttribute('data-shade'));
  assert.equal(l2.getAttribute('aria-disabled'), 'true');
  assert.match(l2.textContent!, /Dopasowano|Matched/);
  assert.equal(tile(container, 'left-p0').getAttribute('data-shade'), null);
  click(tile(container, 'left-p4'));
  click(tile(container, 'right-p4'));
  assert.notEqual(tile(container, 'left-p4').getAttribute('data-shade'), l2.getAttribute('data-shade'));
  assert.deepEqual(answers.at(-1), ['p2', 'p4'], 'odpowiedź = id trafionych par w kolejności trafień (jak dotąd)');
  // zablokowanego nie da się znów zaznaczyć
  click(l2);
  assert.equal(l2.getAttribute('data-state'), 'locked');
});

test('błąd: obwódka + ikona + tekst dla czytników (nie sam kolor), potem powrót do spoczynku', async () => {
  const { container } = render(<Host item={mkItem(4)} />);
  click(tile(container, 'left-p0'));
  assert.equal(tile(container, 'left-p0').getAttribute('aria-pressed'), 'true');
  click(tile(container, 'right-p1'));
  const wrong = tile(container, 'right-p1');
  assert.equal(wrong.getAttribute('data-state'), 'wrong');
  assert.ok(wrong.querySelector('svg'));
  assert.match(wrong.textContent!, /Błędna para|Wrong pair/);
  click(tile(container, 'left-p2')); // w trakcie błędu — ignorowane
  assert.equal(tile(container, 'left-p2').getAttribute('data-state'), 'rest');
  await wait(700);
  assert.equal(tile(container, 'left-p0').getAttribute('data-state'), 'rest');
  assert.equal(tile(container, 'right-p1').getAttribute('data-state'), 'rest');
});

test('więcej niż 5 par → kolejne rundy po najwyżej 5; przycisk „Następna runda” po skończeniu rundy', () => {
  const { container, queryByText, getByText, getByTestId } = render(<Host item={mkItem(6)} />);
  assert.equal(tiles(container).length, 6, 'runda 1 = 3 pary (6 → 3+3)');
  assert.match(getByTestId('matching-round').textContent!, /1/);
  assert.equal(queryByText(/Następna runda|Next round/), null);
  for (const id of ['p0', 'p1', 'p2']) {
    click(tile(container, `left-${id}`));
    click(tile(container, `right-${id}`));
  }
  const next = getByText(/Następna runda|Next round/);
  click(next);
  assert.equal(tiles(container).length, 6);
  assert.ok(tile(container, 'left-p3'));
  assert.equal(tile(container, 'left-p3').getAttribute('data-shade'), null, 'nowa runda zaczyna bez kolorów');
});

test('stare dane: odpowiedź z wcześniej zapisanymi trafieniami przywraca kolory i pozycję rundy', () => {
  const item = mkItem(6);
  const { container } = render(<HomeworkExercise type="matching" item={item} answer={['p0', 'p1', 'p2', 'p3']} onChange={() => {}} />);
  assert.ok(tile(container, 'left-p3'), 'od razu runda 2');
  assert.equal(tile(container, 'left-p3').getAttribute('data-state'), 'locked');
  assert.ok(tile(container, 'left-p3').getAttribute('data-shade'));
  assert.equal(tile(container, 'left-p4').getAttribute('data-state'), 'rest');
});

test('mniej niż 2 poprawne pary → karta „nie udało się wczytać”, bez wyjątku', () => {
  const { container } = render(<HomeworkExercise type="matching" item={{ pairs: [{ id: 'a', left: 'x', right: 'y' }] }} answer={[]} onChange={() => {}} />);
  assert.equal(tiles(container).length, 0);
  assert.ok(container.textContent!.length > 0);
});

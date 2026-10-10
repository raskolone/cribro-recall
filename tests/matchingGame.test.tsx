// Test integracyjny gry „Dopasowanie" (render + interakcja). jsdom ustawiany ręcznie,
// jak w pozostałych testach komponentów.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { gsap } from 'gsap';
import '../i18n';
import MatchingGame, { type MatchingResult } from '../components/flashcards/MatchingGame';
import type { MatchCardInput } from '../utils/matchingGame';

afterEach(() => cleanup());

const mkCards = (n: number): MatchCardInput[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, term: `term${i}`, definition: `def${i}` }));

const noop = () => {};
const stubPronunciation = (text: string) => <button type="button" data-testid={`say-${text}`}>UK</button>;

const setup = (cards = mkCards(6), extra: Partial<React.ComponentProps<typeof MatchingGame>> = {}) => {
  const finishes: MatchingResult[] = [];
  const utils = render(
    <MatchingGame
      cards={cards}
      onBack={noop}
      onQuit={noop}
      onFinish={r => { finishes.push(r); }}
      renderPronunciation={stubPronunciation}
      reducedMotion
      {...extra}
    />,
  );
  const keys = () => Array.from(utils.container.querySelectorAll('[data-tile-key]')).map(e => e.getAttribute('data-tile-key')!);
  const tile = (key: string) => utils.container.querySelector(`[data-tile-key="${key}"]`) as HTMLElement;
  return { ...utils, finishes, keys, tile };
};

const click = (el: HTMLElement) => act(() => { fireEvent.click(el); });
const wait = (ms: number) => act(() => new Promise<void>(r => setTimeout(r, ms)));

test('kafelki mają stabilne klucze left-<id>/right-<id> i jest ich 2 × pary', () => {
  const { keys } = setup();
  assert.equal(keys().length, 12);
  assert.ok(keys().every(k => /^(left|right)-c\d$/.test(k)));
  assert.equal(new Set(keys()).size, 12);
});

test('kolejność nie zmienia się po ponownych renderach ani po zmianie referencji tablicy kart', () => {
  const finishes: MatchingResult[] = [];
  const cards = mkCards(6);
  const make = (c: MatchCardInput[]) => (
    <MatchingGame cards={c} onBack={noop} onQuit={noop} onFinish={r => { finishes.push(r); }} renderPronunciation={stubPronunciation} reducedMotion />
  );
  const { container, rerender } = render(make(cards));
  const read = () => Array.from(container.querySelectorAll('[data-tile-key]')).map(e => e.getAttribute('data-tile-key')).join();
  const first = read();
  for (let i = 0; i < 5; i++) rerender(make(cards.map(c => ({ ...c }))));      // nowa referencja za każdym razem
  rerender(make([...cards].reverse()));                                       // inna kolejność wejścia
  rerender(make(mkCards(10)));                                                // zupełnie inny zestaw w tle
  assert.equal(read(), first);
});

test('dopasowanie: oba kafelki zostają w DOM jako „matched", licznik i pasek rosną, sąsiedzi się nie ruszają', () => {
  const { keys, tile, getByTestId, container } = setup();
  const before = keys();
  click(tile('left-c0'));
  assert.equal(tile('left-c0').getAttribute('data-state'), 'selected');
  click(tile('right-c0'));
  assert.equal(tile('left-c0').getAttribute('data-state'), 'matched');
  assert.equal(tile('right-c0').getAttribute('data-state'), 'matched');
  assert.equal(tile('left-c0').getAttribute('aria-disabled'), 'true');
  assert.deepEqual(keys(), before);
  assert.match(getByTestId('match-progress').textContent!, /1 z 6/);
  assert.equal(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow'), '1');
  // dopasowanego kafelka nie da się już zaznaczyć
  click(tile('left-c0'));
  assert.equal(tile('left-c0').getAttribute('data-state'), 'matched');
});

test('drugie kliknięcie w ten sam kafelek odznacza', () => {
  const { tile } = setup();
  click(tile('left-c1'));
  click(tile('left-c1'));
  assert.equal(tile('left-c1').getAttribute('data-state'), 'idle');
});

test('błędna para: licznik błędów, stan „wrong", trzeci kafelek zablokowany, potem powrót do wyjścia', async () => {
  const { tile, getByTestId } = setup();
  click(tile('left-c0'));
  click(tile('right-c1'));
  assert.equal(tile('left-c0').getAttribute('data-state'), 'wrong');
  assert.equal(tile('right-c1').getAttribute('data-state'), 'wrong');
  assert.match(getByTestId('match-mistakes').textContent!, /1/);
  assert.match(tile('left-c0').textContent!, /Błędna para/); // tekst dla czytników ekranu, nie tylko kolor
  click(tile('left-c2'));                                        // trzeci klik w czasie animacji
  assert.equal(tile('left-c2').getAttribute('data-state'), 'idle');
  await wait(800);
  assert.equal(tile('left-c0').getAttribute('data-state'), 'idle');
  assert.equal(tile('right-c1').getAttribute('data-state'), 'idle');
  click(tile('left-c2'));
  assert.equal(tile('left-c2').getAttribute('data-state'), 'selected');
});

test('kliknięcie przycisku wymowy nie wybiera kafelka', () => {
  const { tile, getByTestId } = setup();
  const label = (document.querySelector('[data-tile-key="left-c0"]') as HTMLElement).querySelector('[data-testid^="say-"]') as HTMLElement;
  assert.ok(label);
  click(label);
  assert.equal(tile('left-c0').getAttribute('data-state'), 'idle');
  assert.ok(getByTestId('match-progress'));
});

test('klawiatura: Enter zaznacza kafelek', () => {
  const { tile } = setup();
  act(() => { fireEvent.keyDown(tile('left-c3'), { key: 'Enter' }); });
  assert.equal(tile('left-c3').getAttribute('data-state'), 'selected');
});

const playAll = (tile: (k: string) => HTMLElement, ids: string[], wrongFirst = 0) => {
  for (let i = 0; i < wrongFirst; i++) {
    click(tile(`left-${ids[0]}`));
    click(tile(`right-${ids[1]}`));
  }
};

test('koniec rundy: onFinish raz, ekran z gwiazdkami, podsumowanie, „Zagraj ponownie" tasuje na nowo', async () => {
  const { tile, finishes, findByText, getByText, queryByText, container } = setup();
  const ids = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
  // 1 błąd → 3★ przy 6 parach
  click(tile('left-c0'));
  click(tile('right-c1'));
  await wait(800);
  for (const id of ids) {
    click(tile(`left-${id}`));
    click(tile(`right-${id}`));
  }
  await wait(30);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].pairs, 6);
  assert.equal(finishes[0].mistakes, 1);
  assert.equal(finishes[0].stars, 3);
  assert.ok(await findByText('Brawo!'));
  assert.ok(getByText(/Zdobyte gwiazdki: 3 z 3/, { selector: 'p' }));
  assert.equal(container.querySelectorAll('[data-star-filled]').length, 3);
  assert.equal(container.querySelector('[data-testid="summary-pairs"]')!.textContent, '6');
  assert.equal(container.querySelector('[data-testid="summary-mistakes"]')!.textContent, '1');

  act(() => { fireEvent.click(getByText('Zagraj ponownie')); });
  assert.equal(queryByText('Brawo!'), null);
  const keysAfter = Array.from(container.querySelectorAll('[data-tile-key]')).map(e => e.getAttribute('data-tile-key'));
  assert.equal(keysAfter.length, 12);
  assert.ok(keysAfter.every(k => !!k));
  assert.equal(finishes.length, 1); // replay nie zapisuje drugi raz
});

test('mało błędów/dużo błędów: liczba wypełnionych gwiazdek zgodna z progami', async () => {
  const { tile, finishes, findByText, container } = setup();
  const ids = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
  for (let i = 0; i < 4; i++) {
    click(tile('left-c0'));
    click(tile('right-c1'));
    await wait(800);
  }
  for (const id of ids) {
    click(tile(`left-${id}`));
    click(tile(`right-${id}`));
  }
  await findByText('Brawo!');
  assert.equal(finishes[0].mistakes, 4);
  assert.equal(finishes[0].stars, 1);
  assert.equal(container.querySelectorAll('[data-star-filled]').length, 1);
  assert.equal(container.querySelectorAll('[data-star]').length, 3); // reszta jako kontur
});

test('sprzątanie: odmontowanie wywołuje revert kontekstu GSAP i usuwa cząsteczki', () => {
  const g = gsap as any;
  const realContext = g.context;
  let reverted = 0;
  g.context = (...args: any[]) => {
    const ctx = realContext.apply(g, args);
    const realRevert = ctx.revert.bind(ctx);
    ctx.revert = (...a: any[]) => { reverted++; return realRevert(...a); };
    return ctx;
  };
  try {
    const { tile, unmount } = setup(mkCards(6), { reducedMotion: false });
    click(tile('left-c0'));
    click(tile('right-c0')); // burst iskier
    assert.ok(document.querySelectorAll('span[aria-hidden="true"][style*="border-radius"]').length > 0);
    unmount();
    assert.equal(reverted, 1);
    assert.equal(document.querySelectorAll('span[aria-hidden="true"][style*="border-radius"]').length, 0);
  } finally {
    g.context = realContext;
  }
});

test('prefers-reduced-motion: brak iskier i nakładki kombinacji, tylko zmiana stanu', () => {
  const { tile } = setup(mkCards(6), { reducedMotion: true });
  click(tile('left-c0'));
  click(tile('right-c0'));
  click(tile('left-c1'));
  click(tile('right-c1')); // combo x2
  assert.equal(document.querySelectorAll('span[style*="border-radius"]').length, 0);
  assert.ok(!/x2/.test(document.body.textContent || ''));
  assert.equal(tile('left-c1').getAttribute('data-state'), 'matched');
});

test('przycisk wymowy renderuje się tylko dla lewych kafelków (EN), a prawe (PL) go nie mają', () => {
  const { tile } = setup();
  const leftSay = tile('left-c0').querySelector('[data-testid^="say-"]');
  const rightSay = tile('right-c0').querySelector('[data-testid^="say-"]');
  assert.ok(leftSay, 'kafelek EN ma wymowę');
  assert.equal(rightSay, null, 'kafelek PL nie ma wymowy');
});

test('błędne dopasowania są gromadzone w wrongWords i przekazywane w onFinish', async () => {
  const { tile, finishes } = setup();
  const ids = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
  click(tile('left-c0'));
  click(tile('right-c1')); // błąd!
  await wait(800);
  for (const id of ids) {
    click(tile(`left-${id}`));
    click(tile(`right-${id}`));
  }
  await wait(30);
  assert.equal(finishes.length, 1);
  assert.ok(finishes[0].wrongWords?.includes('term0'));
  assert.ok(finishes[0].wrongWords?.includes('term1'));
});

test('trafione kafelki znikają z zachowaniem miejsca w siatce (opacity-0 invisible w reducedMotion)', () => {
  const { tile, keys } = setup(mkCards(6), { reducedMotion: true });
  click(tile('left-c0'));
  click(tile('right-c0'));
  assert.equal(keys().length, 12, 'plansza nie traci slotów w siatce');
  assert.match(tile('left-c0').className, /opacity-0/);
  assert.match(tile('left-c0').className, /invisible/);
});


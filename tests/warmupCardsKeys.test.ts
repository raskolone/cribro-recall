import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWarmupCardsQueue,
  intentToAction,
  isNativeActivationTarget,
  isTextEntryTarget,
  resolveWarmupCardsKey,
  shouldSuppressKeyUp,
  warmupCardsProgressPercent,
} from '../utils/warmupCardsKeys';

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({
  tagName,
  getAttribute: () => null,
  parentElement: null,
  ...extra,
});

test('resolveWarmupCardsKey: strzałki → next/prev, spacja → flip, Enter → enter; wszystkie z preventDefault', () => {
  const body = el('BODY');
  assert.deepEqual(resolveWarmupCardsKey({ key: 'ArrowRight', target: body }), { intent: 'next', preventDefault: true });
  assert.deepEqual(resolveWarmupCardsKey({ key: 'ArrowLeft', target: body }), { intent: 'prev', preventDefault: true });
  assert.deepEqual(resolveWarmupCardsKey({ key: ' ', target: body }), { intent: 'flip', preventDefault: true });
  assert.deepEqual(resolveWarmupCardsKey({ key: 'Spacebar', target: body }), { intent: 'flip', preventDefault: true });
  assert.deepEqual(resolveWarmupCardsKey({ key: 'Enter', target: body }), { intent: 'enter', preventDefault: true });
});

test('resolveWarmupCardsKey: trzymana spacja nie odwraca w kółko, ale dalej blokuje przewijanie', () => {
  assert.deepEqual(resolveWarmupCardsKey({ key: ' ', repeat: true, target: el('BODY') }), {
    intent: null,
    preventDefault: true,
  });
});

test('resolveWarmupCardsKey: trzymana strzałka przechodzi dalej (kolejka decyduje o tempie)', () => {
  assert.equal(resolveWarmupCardsKey({ key: 'ArrowRight', repeat: true, target: el('BODY') }).intent, 'next');
});

test('resolveWarmupCardsKey: spacja na sfokusowanym przycisku odwraca kartę i blokuje klik przycisku', () => {
  assert.deepEqual(resolveWarmupCardsKey({ key: ' ', target: el('BUTTON') }), { intent: 'flip', preventDefault: true });
});

test('resolveWarmupCardsKey: Enter na natywnym przycisku/linku zostaje przeglądarce (bez podwójnego zakończenia)', () => {
  assert.deepEqual(resolveWarmupCardsKey({ key: 'Enter', target: el('BUTTON') }), { intent: null, preventDefault: false });
  assert.deepEqual(resolveWarmupCardsKey({ key: 'Enter', target: el('A', { href: 'https://x' }) }), {
    intent: null,
    preventDefault: false,
  });
  assert.equal(resolveWarmupCardsKey({ key: 'Enter', repeat: true, target: el('BODY') }).intent, null);
});

test('resolveWarmupCardsKey: pole tekstowe, textarea, select i contenteditable — klawisze nietknięte', () => {
  const targets = [
    el('INPUT', { type: 'text' }),
    el('INPUT', {}),
    el('INPUT', { type: 'search' }),
    el('TEXTAREA'),
    el('SELECT'),
    el('DIV', { isContentEditable: true }),
  ];
  for (const target of targets) {
    for (const key of ['ArrowRight', 'ArrowLeft', ' ', 'Enter']) {
      assert.deepEqual(resolveWarmupCardsKey({ key, target }), { intent: null, preventDefault: false }, `${target.tagName} ${key}`);
    }
  }
});

test('isTextEntryTarget: potomek elementu contenteditable (jsdom bez isContentEditable) i input nietekstowy', () => {
  const editable = el('DIV', { getAttribute: (n: string) => (n === 'contenteditable' ? 'true' : null) });
  const child = el('SPAN', { parentElement: editable });
  assert.equal(isTextEntryTarget(child), true);
  const notEditable = el('DIV', { getAttribute: (n: string) => (n === 'contenteditable' ? 'false' : null) });
  assert.equal(isTextEntryTarget(el('SPAN', { parentElement: notEditable })), false);
  assert.equal(isTextEntryTarget(el('INPUT', { type: 'checkbox' })), false);
  assert.equal(isTextEntryTarget(null), false);
  assert.equal(isTextEntryTarget(el('BODY')), false);
});

test('isNativeActivationTarget: przycisk, link z href, input-przycisk tak; div, link bez href nie', () => {
  assert.equal(isNativeActivationTarget(el('BUTTON')), true);
  assert.equal(isNativeActivationTarget(el('A', { href: '/x' })), true);
  assert.equal(isNativeActivationTarget(el('A')), false);
  assert.equal(isNativeActivationTarget(el('INPUT', { type: 'submit' })), true);
  assert.equal(isNativeActivationTarget(el('DIV')), false);
  assert.equal(isNativeActivationTarget(undefined), false);
});

test('resolveWarmupCardsKey: Ctrl/Alt/Cmd, kompozycja IME, zdarzenie już obsłużone i inne klawisze są ignorowane', () => {
  const body = el('BODY');
  const ignored = { intent: null, preventDefault: false };
  assert.deepEqual(resolveWarmupCardsKey({ key: 'ArrowRight', metaKey: true, target: body }), ignored);
  assert.deepEqual(resolveWarmupCardsKey({ key: 'ArrowLeft', altKey: true, target: body }), ignored);
  assert.deepEqual(resolveWarmupCardsKey({ key: ' ', ctrlKey: true, target: body }), ignored);
  assert.deepEqual(resolveWarmupCardsKey({ key: 'Enter', isComposing: true, target: body }), ignored);
  assert.deepEqual(resolveWarmupCardsKey({ key: 'ArrowRight', defaultPrevented: true, target: body }), ignored);
  assert.deepEqual(resolveWarmupCardsKey({ key: 'a', target: body }), ignored);
  assert.deepEqual(resolveWarmupCardsKey({ key: 'Escape', target: body }), ignored);
});

test('shouldSuppressKeyUp: tylko spacja poza polem tekstowym i bez modyfikatorów', () => {
  assert.equal(shouldSuppressKeyUp({ key: ' ', target: el('BUTTON') }), true);
  assert.equal(shouldSuppressKeyUp({ key: ' ', target: el('INPUT', { type: 'text' }) }), false);
  assert.equal(shouldSuppressKeyUp({ key: ' ', ctrlKey: true, target: el('BODY') }), false);
  assert.equal(shouldSuppressKeyUp({ key: 'Enter', target: el('BODY') }), false);
});

test('intentToAction: granice pierwszej i ostatniej karty', () => {
  // Pierwsza z trzech
  assert.equal(intentToAction('prev', 0, 3), null);
  assert.equal(intentToAction('next', 0, 3), 'next');
  assert.equal(intentToAction('enter', 0, 3), null);
  // Środkowa
  assert.equal(intentToAction('prev', 1, 3), 'prev');
  assert.equal(intentToAction('next', 1, 3), 'next');
  // Ostatnia: strzałka w prawo nic nie robi, kończy tylko Enter
  assert.equal(intentToAction('next', 2, 3), null);
  assert.equal(intentToAction('enter', 2, 3), 'finish');
  assert.equal(intentToAction('prev', 2, 3), 'prev');
  assert.equal(intentToAction('flip', 2, 3), 'flip');
  // Jedna karta: jest jednocześnie pierwsza i ostatnia
  assert.equal(intentToAction('prev', 0, 1), null);
  assert.equal(intentToAction('next', 0, 1), null);
  assert.equal(intentToAction('enter', 0, 1), 'finish');
  // Pusta talia / indeks spoza zakresu
  assert.equal(intentToAction('flip', 0, 0), null);
  assert.equal(intentToAction('next', 5, 3), null);
});

test('createWarmupCardsQueue: wolna wykonuje od razu, zajęta pamięta tylko ostatni zamiar', () => {
  const q = createWarmupCardsQueue();
  assert.equal(q.busy, false);
  assert.equal(q.request('next'), 'next');
  q.lock();
  assert.equal(q.busy, true);
  assert.equal(q.request('next'), null);
  assert.equal(q.request('flip'), null);
  assert.equal(q.release(), 'flip');
  assert.equal(q.busy, false);
  // Po zwolnieniu kolejka jest pusta
  q.lock();
  assert.equal(q.release(), null);
});

test('createWarmupCardsQueue: powtórzenia z trzymanego klawisza w trakcie przejścia są odrzucane', () => {
  const q = createWarmupCardsQueue();
  q.lock();
  assert.equal(q.request('next', true), null);
  assert.equal(q.request('next', true), null);
  assert.equal(q.release(), null, 'po puszczeniu strzałki karta nie przeskakuje jeszcze raz');
  // ale osobne szybkie naciśnięcie czeka na swoją kolej
  q.lock();
  q.request('next', false);
  q.request('next', true);
  assert.equal(q.release(), 'next');
});

test('warmupCardsProgressPercent: procent bieżącej karty z przycięciem do zakresu', () => {
  assert.equal(warmupCardsProgressPercent(0, 4), 25);
  assert.equal(warmupCardsProgressPercent(3, 4), 100);
  assert.equal(warmupCardsProgressPercent(0, 3), 33.3);
  assert.equal(warmupCardsProgressPercent(9, 3), 100);
  assert.equal(warmupCardsProgressPercent(-1, 3), 33.3);
  assert.equal(warmupCardsProgressPercent(0, 0), 0);
});

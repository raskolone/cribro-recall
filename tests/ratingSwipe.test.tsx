// Gest oceny w module fiszek: prawdziwy hook + prawdziwe PointerEvent (pointerType=touch) w jsdom.
// Sam FlashcardsMode nie renderuje się w node:test (Firebase), więc testujemy hook na
// minimalnej scenie z tą samą nakładką SwipeRatingHint.
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
import React, { useRef } from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { gsap } from 'gsap';
import '../i18n';
import i18n from 'i18next';
import { useRatingSwipe } from '../hooks/useRatingSwipe';
import { SWIPE_TOUCH_ACTION_CLASS } from '../hooks/useCardSwipe';
import SwipeRatingHint from '../components/flashcards/SwipeRatingHint';
import { DRAG, ratingSnapBackVars } from '../utils/flashcardCardMotion';

// gsap.set zostaje prawdziwe (sprawdzamy realny translate3d), gsap.to nagrywamy.
const g = gsap as any;
const realTo = g.to;
const toCalls: any[] = [];
g.to = (target: unknown, vars: any) => {
  toCalls.push({ target, vars });
  return { kill: () => undefined };
};

let reducedMotion = false;
(dom.window as any).matchMedia = (q: string) => ({ matches: reducedMotion && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} });

afterEach(() => {
  cleanup();
  toCalls.length = 0;
  reducedMotion = false;
  document.body.innerHTML = '';
});

const state = { rated: [] as boolean[], busy: false, clicks: 0 };

const Stage: React.FC<{ flipped?: boolean }> = ({ flipped }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const know = useRef<HTMLDivElement>(null);
  const dont = useRef<HTMLDivElement>(null);
  const swipe = useRatingSwipe({
    cardRef,
    knowHintRef: know,
    dontKnowHintRef: dont,
    isBusy: () => state.busy,
    onRate: (ok) => state.rated.push(ok),
  });
  return (
    <div
      ref={cardRef}
      data-testid="stage"
      data-flipped={String(Boolean(flipped))}
      className={SWIPE_TOUCH_ACTION_CLASS}
      onClick={() => {
        if (swipe.consumeSuppressedClick()) return;
        state.clicks++;
      }}
      {...swipe.bind}
    >
      <button data-testid="inner-btn">x</button>
      <SwipeRatingHint knowRef={know} dontKnowRef={dont} />
    </div>
  );
};

const setup = (flipped = false) => {
  state.rated = [];
  state.busy = false;
  state.clicks = 0;
  const utils = render(<Stage flipped={flipped} />);
  const stage = utils.getByTestId('stage');
  const hint = (side: 'know' | 'dontKnow') => stage.querySelector(`[data-hint="${side}"]`) as HTMLElement;
  return { ...utils, stage, hint };
};

const ptr = (
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y = 300,
  extra: PointerEventInit = {},
) =>
  act(() => {
    el.dispatchEvent(
      new (dom.window as any).PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: y,
        button: 0,
        ...extra,
      }),
    );
  });

const drag = (el: Element, from: number, to: number) => {
  ptr(el, 'pointerdown', from);
  ptr(el, 'pointermove', from + (to - from) / 2);
  ptr(el, 'pointermove', to);
};

for (const flipped of [false, true]) {
  const label = flipped ? 'rewers' : 'awers';

  test(`gest w lewo ≥ progu = „Nie umiem" (${label}), w prawo = „Umiem"`, () => {
    const left = setup(flipped);
    drag(left.stage, 300, 300 - DRAG.thresholdPx - 20);
    ptr(left.stage, 'pointerup', 300 - DRAG.thresholdPx - 20);
    assert.deepEqual(state.rated, [false]);
    cleanup();
    const right = setup(flipped);
    drag(right.stage, 100, 100 + DRAG.thresholdPx + 20);
    ptr(right.stage, 'pointerup', 100 + DRAG.thresholdPx + 20);
    assert.deepEqual(state.rated, [true]);
    assert.equal(state.clicks, 0, 'echo kliknięcia po gescie nie odwraca karty');
  });

  test(`za krótki gest (${label}): bez oceny, sprężysty powrót, kliknięcie po nim pominięte`, () => {
    const { stage } = setup(flipped);
    drag(stage, 300, 300 - (DRAG.thresholdPx - 10));
    ptr(stage, 'pointerup', 300 - (DRAG.thresholdPx - 10));
    assert.deepEqual(state.rated, []);
    const back = toCalls.at(-1);
    assert.ok(back, 'powrót karty');
    assert.equal(back.vars.clearProps, 'all');
    assert.equal(back.vars.x, 0);
    assert.equal(back.vars.rotation, 0);
    assert.equal(typeof back.vars.ease, 'function', 'sprężyna, nie liniowo');
    fireEvent.click(stage);
    assert.equal(state.clicks, 0);
  });
}

test('karta idzie za palcem 1:1 przez translate3d + obrót, bez tweena na ruch', () => {
  const { stage } = setup();
  ptr(stage, 'pointerdown', 300);
  ptr(stage, 'pointermove', 250);
  assert.match(stage.style.transform, /translate3d\(-50px/);
  assert.match(stage.style.transform, /rotate\(-2\.5deg\)/);
  ptr(stage, 'pointermove', 200);
  assert.match(stage.style.transform, /translate3d\(-100px/);
  assert.equal(toCalls.length, 0, 'ruch palca nie tworzy tweenów gsap.to');
});

test('wskazówka: etykieta po stronie ruchu rośnie do progu, jest aria-hidden i niesie ikonę oraz tekst', () => {
  const { stage, hint } = setup();
  assert.equal(stage.querySelector('[data-testid="swipe-rating-hint"]')?.getAttribute('aria-hidden'), 'true');
  assert.match(hint('dontKnow').textContent ?? '', new RegExp(i18n.t('Nie umiem')));
  assert.match(hint('know').textContent ?? '', new RegExp(i18n.t('Umiem')));
  assert.ok(hint('dontKnow').querySelector('svg') && hint('know').querySelector('svg'), 'ikony, nie tylko kolor');
  ptr(stage, 'pointerdown', 300);
  ptr(stage, 'pointermove', 260); // dx = −40 = pół progu
  assert.equal(hint('dontKnow').style.opacity, '0.5');
  assert.equal(hint('know').style.opacity, '0');
  ptr(stage, 'pointermove', 360); // dx = +60
  assert.equal(hint('know').style.opacity, '0.75');
  assert.equal(hint('dontKnow').style.opacity, '0');
  ptr(stage, 'pointerup', 360);
  assert.equal(hint('know').style.opacity, '0', 'po puszczeniu wskazówka znika');
});

test('gest pionowy (przeglądarka przewija i wysyła pointercancel) nie ocenia i nie przesuwa karty', () => {
  const { stage } = setup();
  ptr(stage, 'pointerdown', 200, 300);
  ptr(stage, 'pointermove', 203, 240); // poziomo < próg startu
  ptr(stage, 'pointercancel', 203, 200);
  assert.deepEqual(state.rated, []);
  assert.equal(stage.style.transform, '');
  assert.equal(toCalls.length, 0, 'nie było przeciągania, więc nie ma powrotu');
});

test('pointercancel w trakcie przeciągania powyżej progu nie zatwierdza oceny i cofa kartę', () => {
  const { stage, hint } = setup();
  drag(stage, 300, 120);
  ptr(stage, 'pointercancel', 120);
  ptr(stage, 'pointerup', 120);
  assert.deepEqual(state.rated, []);
  assert.equal(hint('dontKnow').style.opacity, '0');
  assert.equal(toCalls.at(-1)?.vars.clearProps, 'all');
});

test('dotknięcie bez ruchu to zwykłe kliknięcie (odwraca kartę), nie ocena', () => {
  const { stage } = setup();
  ptr(stage, 'pointerdown', 200);
  ptr(stage, 'pointerup', 200);
  fireEvent.click(stage);
  assert.deepEqual(state.rated, []);
  assert.equal(state.clicks, 1);
});

test('gest nie startuje na przycisku, w trakcie odlotu ani przy lewej krawędzi ekranu (systemowe „wstecz")', () => {
  const { stage, getByTestId } = setup();
  drag(getByTestId('inner-btn'), 300, 100);
  ptr(getByTestId('inner-btn'), 'pointerup', 100);
  assert.deepEqual(state.rated, [], 'przycisk wewnątrz karty zostaje przyciskiem');
  state.busy = true;
  drag(stage, 300, 100);
  ptr(stage, 'pointerup', 100);
  assert.deepEqual(state.rated, [], 'odlot trwa');
  state.busy = false;
  drag(stage, 4, 200);
  ptr(stage, 'pointerup', 200);
  assert.deepEqual(state.rated, [], 'krawędź iOS');
});

test('prefers-reduced-motion: powrót natychmiast (bez sprężyny), ocena nadal działa', () => {
  reducedMotion = true;
  const { stage } = setup();
  drag(stage, 300, 260);
  ptr(stage, 'pointerup', 260);
  const back = toCalls.at(-1).vars;
  assert.equal(back.duration, 0.01);
  assert.equal(back.ease, 'none');
  assert.deepEqual(ratingSnapBackVars(true).ease, 'none');
});

test('stage ma touch-action: pan-y — pionowe przewijanie zostaje przeglądarce', () => {
  const { stage } = setup();
  assert.ok(stage.className.includes('touch-pan-y'));
});

// przywrócenie prawdziwego gsap.to na koniec pliku (inne testy w tym samym procesie go nie używają)
test('sprzątanie atrapy', () => {
  g.to = realTo;
});

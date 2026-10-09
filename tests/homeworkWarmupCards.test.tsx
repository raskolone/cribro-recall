// Test integracyjny (render + interakcja użytkownika) dla HomeworkWarmupCards.
// jsdom jest ustawiany ręcznie tutaj, a nie globalnie, żeby nie obciążać
// pozostałych (czysto logicznych) testów node:test.
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
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { gsap } from 'gsap';
import '../i18n';
import HomeworkWarmupCards from '../components/dashboard/HomeworkWarmupCards';

// --- Atrapa GSAP ---------------------------------------------------------
// Komponent woła gsap.to/fromTo/set/killTweensOf/getProperty w chwili akcji, więc
// podmiana metod na obiekcie gsap wystarcza. Domyślnie tweeny kończą się od razu
// (synchronicznie), a w trybie `deferAnimations` ich onComplete czeka na
// ręczne `finishNextAnimation()` — tak sprawdzamy szybkie klikanie w trakcie
// przejścia. gsap.context zostaje prawdziwy (revert przy odmontowaniu); test
// sprzątania na chwilę przywraca prawdziwe metody (`realGsap`).
type GsapCall = { method: 'to' | 'fromTo' | 'set' | 'killTweensOf'; target: unknown; vars?: any; fromVars?: any };
const gsapCalls: GsapCall[] = [];
const pending: Array<() => void> = [];
let deferAnimations = false;
// Atrapa set/to niczego nie obraca, więc kąt odczytywany przez komponent podajemy tu.
let rotationYOf: (target: unknown) => number = () => 0;
const fakeTween = { kill: () => fakeTween };
const settle = (vars: any) => {
  if (typeof vars?.onComplete !== 'function') return;
  if (deferAnimations) pending.push(vars.onComplete);
  else vars.onComplete();
};
const g = gsap as any;
const realGsap = { to: g.to, fromTo: g.fromTo, set: g.set, killTweensOf: g.killTweensOf, getProperty: g.getProperty };
const fakeGsap = {
  to: (target: unknown, vars: any) => {
    gsapCalls.push({ method: 'to', target, vars });
    settle(vars);
    return fakeTween;
  },
  fromTo: (target: unknown, fromVars: any, vars: any) => {
    gsapCalls.push({ method: 'fromTo', target, fromVars, vars });
    settle(vars);
    return fakeTween;
  },
  set: (target: unknown, vars: any) => {
    gsapCalls.push({ method: 'set', target, vars });
    return fakeTween;
  },
  killTweensOf: (target: unknown) => {
    gsapCalls.push({ method: 'killTweensOf', target });
  },
  getProperty: (target: unknown, prop: string) => (prop === 'rotationY' ? rotationYOf(target) : 0),
};
Object.assign(g, fakeGsap);
const finishNextAnimation = () => {
  const next = pending.shift();
  assert.ok(next, 'oczekiwano trwającej animacji');
  act(() => next!());
};
const animatedCalls = () => gsapCalls.filter((c) => c.method === 'to' || c.method === 'fromTo');

afterEach(() => {
  cleanup();
  delete (dom.window as any).speechSynthesis;
  delete (globalThis as any).SpeechSynthesisUtterance;
  delete (dom.window as any).matchMedia;
  gsapCalls.length = 0;
  pending.length = 0;
  deferAnimations = false;
  rotationYOf = () => 0;
  document.body.innerHTML = '';
});

const cards = [
  { term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.' },
  { term: 'look up', definition: 'sprawdzić' },
];
const threeCards = [...cards, { term: 'give up', definition: 'poddać się' }];

const setup = (deck = cards) => {
  const calls = { done: 0, skip: 0 };
  const utils = render(
    React.createElement(HomeworkWarmupCards, { cards: deck, onDone: () => calls.done++, onSkip: () => calls.skip++ })
  );
  const progress = () => utils.getByTestId('warmup-cards-progress').textContent;
  const isFlipped = () => utils.getByTestId('warmup-card').getAttribute('data-flipped') === 'true';
  return { ...utils, calls, progress, isFlipped };
};

const key = (target: Element | Document, k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key: k, ...init });

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
  const { getByTestId, getByText, calls } = setup();
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
  // Drugie kliknięcie zanim rodzic zdąży odmontować komponent nie kończy drugi raz.
  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.equal(calls.done, 1);
});

test('HomeworkWarmupCards: „Wstecz" jest wyłączone na pierwszej karcie', () => {
  const { getByLabelText } = setup();
  assert.equal((getByLabelText('Poprzednia karta') as HTMLButtonElement).disabled, true);
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
  const { getByTestId, isFlipped } = setup();
  fireEvent.click(getByTestId('warmup-cards-speak'));
  assert.equal(cancelled, 1);
  assert.deepEqual(spoken, [{ text: 'take off', lang: 'en-GB' }]);
  // Przycisk wymowy leży poza obracanym elementem — kliknięcie nie odwraca karty.
  assert.equal(isFlipped(), false);
});

// --- Klawiatura ------------------------------------------------------------

test('klawiatura bez fokusu: → następna, ← poprzednia, spacja odwraca; wszystkie z preventDefault', () => {
  const { progress, isFlipped } = setup();
  assert.equal(document.activeElement, document.body);

  assert.equal(key(document.body, 'ArrowRight'), false, 'preventDefault na strzałce');
  assert.equal(progress(), 'Karta 2 z 2');
  assert.equal(key(document.body, 'ArrowLeft'), false);
  assert.equal(progress(), 'Karta 1 z 2');

  assert.equal(key(document.body, ' '), false, 'spacja nie przewija strony');
  assert.equal(isFlipped(), true);
  key(document.body, ' ');
  assert.equal(isFlipped(), false);
  // Trzymana spacja (repeat) nie miga kartą, ale nadal nie przewija.
  assert.equal(key(document.body, ' ', { repeat: true }), false);
  assert.equal(isFlipped(), false);
});

test('klawiatura: granice — ← na pierwszej i → na ostatniej nic nie robią, Enter kończy tylko na ostatniej', () => {
  const { progress, calls } = setup();
  key(document.body, 'ArrowLeft');
  assert.equal(progress(), 'Karta 1 z 2');
  key(document.body, 'Enter');
  assert.equal(calls.done, 0, 'Enter poza ostatnią kartą nie kończy');

  key(document.body, 'ArrowRight');
  assert.equal(progress(), 'Karta 2 z 2');
  key(document.body, 'ArrowRight');
  key(document.body, 'ArrowRight', { repeat: true });
  assert.equal(progress(), 'Karta 2 z 2');
  assert.equal(calls.done, 0, 'strzałka na ostatniej karcie nie kończy kart');

  key(document.body, 'Enter');
  assert.equal(calls.done, 1);
  key(document.body, 'Enter');
  assert.equal(calls.done, 1, 'onDone dokładnie raz');
});

test('klawiatura: brak reakcji, gdy fokus jest w polu tekstowym (w kartach i poza nimi)', () => {
  const { getByTestId, progress, isFlipped } = setup();
  const inside = document.createElement('input');
  inside.type = 'text';
  getByTestId('warmup-cards-root').appendChild(inside);
  inside.focus();
  assert.equal(key(inside, 'ArrowRight'), true, 'brak preventDefault w polu tekstowym');
  assert.equal(key(inside, ' '), true);
  assert.equal(progress(), 'Karta 1 z 2');
  assert.equal(isFlipped(), false);

  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  textarea.focus();
  assert.equal(key(textarea, 'ArrowRight'), true);
  assert.equal(key(textarea, ' '), true);
  assert.equal(progress(), 'Karta 1 z 2');
  assert.equal(isFlipped(), false);
});

test('klawiatura: fokus na elemencie spoza kart (np. okno nad nimi) — klawisze zostają temu elementowi', () => {
  const { progress, isFlipped } = setup();
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  outside.focus();
  assert.equal(key(outside, ' '), true);
  assert.equal(key(outside, 'ArrowRight'), true);
  assert.equal(isFlipped(), false);
  assert.equal(progress(), 'Karta 1 z 2');
});

test('klawiatura: spacja na sfokusowanym przycisku kart odwraca raz i blokuje klik przycisku (keydown + keyup)', () => {
  const { getByTestId, isFlipped, progress } = setup();
  const next = getByTestId('warmup-cards-next');
  next.focus();
  assert.equal(key(next, ' '), false);
  assert.equal(fireEvent.keyUp(next, { key: ' ' }), false, 'keyup spacji zduszony — przycisk się nie kliknie');
  assert.equal(isFlipped(), true);
  assert.equal(progress(), 'Karta 1 z 2');
});

test('klawiatura: Enter na sfokusowanym przycisku zostaje przeglądarce (bez podwójnego zakończenia)', () => {
  const { getByTestId, getByLabelText, calls, progress } = setup();
  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.equal(progress(), 'Karta 2 z 2');
  const back = getByLabelText('Poprzednia karta');
  back.focus();
  assert.equal(key(back, 'Enter'), true, 'Enter na „Wstecz" nie jest przechwytywany');
  assert.equal(calls.done, 0);
});

test('listener klawiatury: dodany raz na dokumencie i sprzątany przy odmontowaniu', () => {
  const added: Array<[string, unknown]> = [];
  const removed: Array<[string, unknown]> = [];
  const origAdd = document.addEventListener;
  const origRemove = document.removeEventListener;
  document.addEventListener = function (this: Document, type: string, fn: any, opts?: any) {
    added.push([type, fn]);
    return origAdd.call(this, type, fn, opts);
  } as typeof document.addEventListener;
  document.removeEventListener = function (this: Document, type: string, fn: any, opts?: any) {
    removed.push([type, fn]);
    return origRemove.call(this, type, fn, opts);
  } as typeof document.removeEventListener;

  try {
    const { unmount, calls } = setup();
    const keydown = added.filter(([t]) => t === 'keydown');
    const keyup = added.filter(([t]) => t === 'keyup');
    assert.equal(keydown.length, 1);
    assert.equal(keyup.length, 1);

    unmount();
    assert.ok(removed.some(([t, fn]) => t === 'keydown' && fn === keydown[0][1]));
    assert.ok(removed.some(([t, fn]) => t === 'keyup' && fn === keyup[0][1]));

    // Po odmontowaniu klawisze nic nie robią i niczego nie blokują.
    assert.equal(key(document.body, ' '), true);
    assert.equal(key(document.body, 'Enter'), true);
    assert.equal(calls.done, 0);
  } finally {
    document.addEventListener = origAdd;
    document.removeEventListener = origRemove;
  }
});

// --- Animacje ----------------------------------------------------------------

test('GSAP: odwrócenie = rotationY 180 przez 0,5 s z power2.inOut; powrót do 0', () => {
  const { getByTestId } = setup();
  const flipEl = getByTestId('warmup-card');
  key(document.body, ' ');
  const flip = animatedCalls().find((c) => c.target === flipEl);
  assert.ok(flip);
  assert.equal(flip!.vars.rotationY, 180);
  assert.equal(flip!.vars.duration, 0.5);
  assert.equal(flip!.vars.ease, 'power2.inOut');
  // Poprzedni obrót jest zabijany, zanim ruszy następny.
  assert.ok(gsapCalls.some((c) => c.method === 'killTweensOf' && c.target === flipEl));

  gsapCalls.length = 0;
  key(document.body, ' ');
  assert.equal(animatedCalls().find((c) => c.target === flipEl)!.vars.rotationY, 0);
});

const isGhost = (c: GsapCall) => (c.target as Element).getAttribute?.('data-testid') === 'warmup-card-ghost';

test('GSAP: zmiana karty = odrzucenie — → w lewo z obrotem i opadnięciem, następna spod spodu; ← lustrzanie', () => {
  const { getByTestId } = setup();
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  key(document.body, ' ');
  gsapCalls.length = 0;

  key(document.body, 'ArrowRight');
  const exit = animatedCalls().find((c) => c.method === 'to' && isGhost(c))!;
  assert.ok(exit, 'odlatuje kopia starej karty');
  assert.ok((exit.target as Element).textContent?.includes('take off'));
  assert.deepEqual(
    [exit.vars.xPercent, exit.vars.y, exit.vars.rotation, exit.vars.opacity, exit.vars.duration, exit.vars.ease],
    [-120, 60, -15, 0, 0.3, 'power2.in']
  );
  const enter = animatedCalls().find((c) => c.method === 'fromTo' && c.target === cardEl)!;
  assert.deepEqual([enter.fromVars.scale, enter.fromVars.opacity], [0.92, 0.6]);
  assert.deepEqual(
    [enter.vars.scale, enter.vars.opacity, enter.vars.duration, enter.vars.ease],
    [1, 1, 0.3, 'power2.out']
  );
  assert.equal(enter.vars.delay, 0.15, 'nowa karta rośnie od połowy wyjścia starej');
  assert.equal(enter.vars.clearProps, 'transform,opacity', 'inline perspective zostaje');
  // Nowa karta startuje awersem: obrót ustawiony na 0 bez animacji.
  assert.ok(gsapCalls.some((c) => c.method === 'set' && c.target === flipEl && c.vars.rotationY === 0));
  assert.ok(gsapCalls.some((c) => c.method === 'killTweensOf' && c.target === flipEl));
  assert.ok(gsapCalls.some((c) => c.method === 'killTweensOf' && c.target === cardEl));
  assert.equal(getByTestId('warmup-card').getAttribute('data-flipped'), 'false');

  gsapCalls.length = 0;
  key(document.body, 'ArrowLeft');
  const back = animatedCalls().find((c) => c.method === 'to' && isGhost(c))!;
  assert.deepEqual([back.vars.xPercent, back.vars.y, back.vars.rotation, back.vars.opacity], [120, 60, 15, 0]);
  assert.ok((back.target as Element).textContent?.includes('look up'));
  const backIn = animatedCalls().find((c) => c.method === 'fromTo' && c.target === cardEl)!;
  assert.deepEqual([backIn.fromVars.scale, backIn.fromVars.opacity], [0.92, 0.6]);
});

test('odrzucenie: kopia starej karty nad nową, poza drzewem dostępności, w przycinającej ramce sceny', () => {
  deferAnimations = true;
  const { getByTestId, queryByTestId, progress } = setup();
  const stage = getByTestId('warmup-cards-stage');
  Object.defineProperty(stage, 'offsetHeight', { configurable: true, value: 312 });

  key(document.body, 'ArrowRight');
  assert.equal(progress(), 'Karta 2 z 2', 'licznik i nowa karta od razu');
  assert.ok(getByTestId('warmup-card-front').textContent?.includes('look up'));
  const ghost = getByTestId('warmup-card-ghost');
  assert.ok(ghost.textContent?.includes('take off'), 'kopia pokazuje starą kartę');
  assert.equal(ghost.querySelectorAll('[data-testid], button').length, 0, 'bez zdublowanych identyfikatorów i przycisków');

  const frame = ghost.parentElement!;
  assert.equal(frame.parentElement, stage, 'ramka należy do sceny karty');
  assert.equal(stage.lastElementChild, frame, 'kopia leży nad nową kartą');
  assert.equal(frame.getAttribute('aria-hidden'), 'true');
  const frameClasses = frame.className.split(/\s+/);
  for (const cls of ['absolute', 'overflow-hidden', 'pointer-events-none', 'z-20']) {
    assert.ok(frameClasses.includes(cls), `ramka: ${cls}`);
  }
  assert.ok(stage.className.split(/\s+/).includes('isolate'));
  assert.equal(stage.style.minHeight, '312px', 'scena trzyma wysokość starej karty');

  finishNextAnimation(); // wyjście
  assert.equal(queryByTestId('warmup-card-ghost'), null, 'kopia znika po wyjściu');
  assert.equal(stage.style.minHeight, '312px', 'wysokość trzymana do końca wejścia');
  finishNextAnimation(); // wejście
  assert.equal(stage.style.minHeight, '');
  assert.equal(pending.length, 0);
});

test('odrzucenie: kopia startuje z kątem bieżącej karty — także w połowie odwracania', () => {
  const { getByTestId } = setup();
  const flipEl = getByTestId('warmup-card');
  rotationYOf = (target) => (target === flipEl ? 72 : 0);
  key(document.body, 'ArrowRight');
  const ghostAngle = gsapCalls.find((c) => c.method === 'set' && c.vars.rotationY === 72);
  assert.ok(ghostAngle, 'kopia dostała kąt 72°');
  assert.equal((ghostAngle!.target as Element).parentElement?.getAttribute('data-testid'), 'warmup-card-ghost');
  assert.ok(gsapCalls.some((c) => c.method === 'set' && c.target === flipEl && c.vars.rotationY === 0));
});

test('GSAP: szybkie naciśnięcia w trakcie przejścia — ostatnie czeka, powtórzenia trzymanego klawisza odpadają', () => {
  deferAnimations = true;
  const { progress, calls } = setup(threeCards);

  key(document.body, 'ArrowRight');
  assert.equal(progress(), 'Karta 2 z 3', 'nowa karta od razu pod spodem, stara odlatuje jako kopia');
  key(document.body, 'ArrowRight', { repeat: true });
  key(document.body, 'ArrowRight', { repeat: true });
  key(document.body, 'ArrowRight'); // osobne naciśnięcie — zakolejkowane
  assert.equal(pending.length, 2, 'jedno przejście naraz (wyjście + wejście)');
  assert.equal(progress(), 'Karta 2 z 3');

  finishNextAnimation(); // wyjście karty 1
  assert.equal(progress(), 'Karta 2 z 3', 'koniec samego wyjścia nie zwalnia kolejki');
  finishNextAnimation(); // wejście karty 2 → rusza zakolejkowane „dalej"
  assert.equal(progress(), 'Karta 3 z 3');
  assert.equal(pending.length, 2);

  // Enter w trakcie przejścia na ostatnią kartę czeka i kończy dopiero po jej wejściu.
  key(document.body, 'Enter');
  finishNextAnimation(); // wyjście karty 2
  assert.equal(calls.done, 0);
  finishNextAnimation(); // wejście karty 3
  assert.equal(calls.done, 1);
  assert.equal(pending.length, 0, 'żadna karta nie zostaje w połowie animacji');
});

test('GSAP: podwójny klik „Dalej" z przedostatniej karty nie kończy kart, choć etykieta zmienia się od razu', () => {
  deferAnimations = true;
  const { getByTestId, getByText, progress, calls } = setup();
  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.ok(getByText('Zakończ karty'), 'etykieta ostatniej karty już na starcie przejścia');
  fireEvent.click(getByTestId('warmup-cards-next')); // drugi klik w trakcie przejścia
  finishNextAnimation();
  finishNextAnimation();
  assert.equal(progress(), 'Karta 2 z 2');
  assert.equal(pending.length, 0);
  assert.equal(calls.done, 0);

  // Po przejściu „Zakończ karty" działa normalnie.
  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.equal(calls.done, 1);
});

test('gsap.context: odmontowanie w trakcie przejścia zabija prawdziwe tweeny wyjścia i wejścia', () => {
  Object.assign(g, realGsap);
  // CSSPlugin woła globalne getComputedStyle — jsdom ma je tylko na window.
  (globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try {
    const { getByTestId, unmount, calls } = setup();
    const cardEl = getByTestId('warmup-card').parentElement!;
    key(document.body, 'ArrowRight');
    const ghost = getByTestId('warmup-card-ghost');
    assert.ok(gsap.getTweensOf(ghost).length > 0, 'wyjście kopii trwa');
    assert.ok(gsap.getTweensOf(cardEl).length > 0, 'wejście nowej karty czeka na swój delay');

    unmount();
    assert.equal(gsap.getTweensOf(ghost).length, 0);
    assert.equal(gsap.getTweensOf(cardEl).length, 0);
    assert.equal(calls.done, 0);
  } finally {
    // Gdyby sprzątanie zawiodło, żywe tweeny trzymałyby proces testów przy życiu.
    gsap.globalTimeline.clear();
    Object.assign(g, fakeGsap);
    delete (globalThis as any).getComputedStyle;
  }
});

test('pasek postępu: szerokość ustawiona na starcie, potem animowana; role=progressbar i aria-live licznika', () => {
  const { getByTestId, getByRole } = setup();
  const bar = getByTestId('warmup-cards-bar');
  const initial = gsapCalls.find((c) => c.method === 'set' && c.target === bar);
  assert.equal(initial?.vars.width, '50%');

  key(document.body, 'ArrowRight');
  const grow = animatedCalls().find((c) => c.target === bar);
  assert.equal(grow?.vars.width, '100%');
  assert.equal(grow?.vars.duration, 0.35);

  const progressbar = getByRole('progressbar');
  assert.equal(progressbar.getAttribute('aria-valuenow'), '2');
  assert.equal(progressbar.getAttribute('aria-valuemax'), '2');
  assert.equal(progressbar.getAttribute('aria-label'), 'Postęp fiszek');
  const counter = getByTestId('warmup-cards-progress');
  assert.equal(counter.getAttribute('aria-live'), 'polite');
  assert.equal(getByTestId('warmup-cards-root').getAttribute('aria-label'), 'Fiszki rozgrzewki');
});

test('prefers-reduced-motion: bez tweenów — natychmiastowa zmiana karty i stron', () => {
  (dom.window as any).matchMedia = (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  const { getByTestId, queryByTestId, progress, isFlipped } = setup();

  key(document.body, ' ');
  assert.equal(isFlipped(), true);
  assert.ok(getByTestId('warmup-card-front').className.includes('invisible'));
  assert.ok(!getByTestId('warmup-card-back').className.includes('invisible'));
  assert.equal(getByTestId('warmup-card-back').style.transform, '', 'rewers bez obrotu 3D');

  key(document.body, 'ArrowRight');
  assert.equal(progress(), 'Karta 2 z 2');
  assert.equal(isFlipped(), false);
  assert.equal(queryByTestId('warmup-card-ghost'), null, 'bez odlatującej kopii');
  assert.equal(getByTestId('warmup-cards-stage').style.minHeight, '');
  key(document.body, 'ArrowLeft');
  assert.equal(progress(), 'Karta 1 z 2');

  assert.deepEqual(animatedCalls(), [], 'żadnego gsap.to/fromTo przy ograniczeniu ruchu');
});

test('podpowiedź klawiatury z i18n; na ostatniej karcie dochodzi „Enter kończy"', () => {
  const { getByTestId } = setup();
  assert.equal(getByTestId('warmup-cards-hint').textContent, '← → zmiana karty, spacja odwraca');
  key(document.body, 'ArrowRight');
  assert.equal(getByTestId('warmup-cards-hint').textContent, '← → zmiana karty, spacja odwraca · Enter kończy');
});

test('pusta talia: onDone od razu, dokładnie raz', () => {
  const { calls, container } = setup([]);
  assert.equal(calls.done, 1);
  assert.equal(container.innerHTML, '');
});

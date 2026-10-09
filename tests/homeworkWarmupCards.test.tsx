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
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { gsap } from 'gsap';
import '../i18n';
import HomeworkWarmupCards from '../components/dashboard/HomeworkWarmupCards';
import { springEase } from '../utils/flashcardCardMotion';

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

test('HomeworkWarmupCards: bez speechSynthesis przyciski wymowy są ukryte', () => {
  const { container } = setup();
  assert.equal('speechSynthesis' in dom.window, false);
  assert.equal(container.querySelectorAll('[data-lang]').length, 0);
});

const installSpeech = () => {
  const spoken: Array<{ text: string; lang: string }> = [];
  const state = { cancelled: 0 };
  (dom.window as any).speechSynthesis = {
    cancel: () => state.cancelled++,
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
  return { spoken, state };
};

test('HomeworkWarmupCards: UK/US w rogu awersu czytają frazę natywnie (en-GB / en-US), bez odwracania karty', () => {
  const { spoken, state } = installSpeech();
  const { getByTestId, isFlipped } = setup();
  const front = getByTestId('warmup-card-front');
  fireEvent.click(front.querySelector('[data-lang="en-GB"]')!);
  fireEvent.click(front.querySelector('[data-lang="en-US"]')!);
  assert.equal(state.cancelled, 2);
  assert.deepEqual(spoken, [
    { text: 'take off', lang: 'en-GB' },
    { text: 'take off', lang: 'en-US' },
  ]);
  // Przyciski leżą wewnątrz karty, ale kliknięcie nie bąbelkuje do obrotu.
  assert.equal(isFlipped(), false);
});

test('HomeworkWarmupCards: ten sam wygląd przycisków wymowy co w module (PronunciationButtons) — UK i US na obu stronach', () => {
  installSpeech();
  const { getByTestId } = setup();
  for (const id of ['warmup-card-front', 'warmup-card-back']) {
    const face = getByTestId(id);
    assert.equal(face.querySelectorAll('[data-lang]').length, 2);
    assert.match(face.textContent!, /UK/);
    assert.match(face.textContent!, /US/);
  }
  // Odwrócona od widza strona jest inert — nie łapie fokusu.
  assert.equal(getByTestId('warmup-card-back').hasAttribute('inert'), true);
  assert.equal(getByTestId('warmup-card-front').hasAttribute('inert'), false);
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

test('GSAP: odwrócenie = rotationY 180 sprężyną z modułu fiszek (0,6 s, krzywa własna); powrót do 0', () => {
  const { getByTestId } = setup();
  const flipEl = getByTestId('warmup-card');
  key(document.body, ' ');
  const flip = animatedCalls().find((c) => c.target === flipEl);
  assert.ok(flip);
  assert.equal(flip!.vars.rotationY, 180);
  assert.equal(flip!.vars.duration, 0.6);
  assert.equal(typeof flip!.vars.ease, 'function', 'sprężyna jako funkcja easingu, nie elastic/back');
  const ease = flip!.vars.ease as (p: number) => number;
  const reference = springEase();
  for (const p of [0, 0.1, 0.25, 0.5, 0.75, 1]) assert.equal(ease(p), reference(p));
  // Poprzedni obrót jest zabijany, zanim ruszy następny.
  assert.ok(gsapCalls.some((c) => c.method === 'killTweensOf' && c.target === flipEl));

  gsapCalls.length = 0;
  key(document.body, ' ');
  assert.equal(animatedCalls().find((c) => c.target === flipEl)!.vars.rotationY, 0);
});

test('GSAP: zmiana karty w stronę palca — Dalej: odlot w LEWO (x = −szerokość okna, −20°), wjazd z prawej; Wstecz lustrzanie; krycie osobnym tweenem', () => {
  const { getByTestId } = setup();
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  const width = window.innerWidth;
  key(document.body, ' ');
  gsapCalls.length = 0;

  key(document.body, 'ArrowRight');
  const exit = animatedCalls().find((c) => c.method === 'to' && c.target === cardEl)!;
  assert.deepEqual(
    [exit.vars.x, exit.vars.rotation, exit.vars.duration, exit.vars.ease],
    [-width, -20, 0.3, 'power2.in']
  );
  assert.equal('opacity' in exit.vars, false, 'krycie nie jest częścią tweena ruchu');
  const enter = animatedCalls().find((c) => c.method === 'fromTo' && c.target === cardEl)!;
  assert.deepEqual([enter.fromVars.x, enter.fromVars.opacity, enter.fromVars.rotation], [200, 0, 10]);
  assert.deepEqual(
    [enter.vars.x, enter.vars.y, enter.vars.rotation, enter.vars.opacity, enter.vars.scale, enter.vars.duration, enter.vars.ease],
    [0, 0, 0, 1, 1, 0.4, 'back.out(1.5)']
  );
  assert.equal(enter.vars.clearProps, 'all');
  // Nowa karta zawsze zaczyna awersem; obrót ustawiony na 0 bez animacji.
  assert.ok(gsapCalls.some((c) => c.method === 'set' && c.target === flipEl && c.vars.rotationY === 0));
  assert.ok(gsapCalls.some((c) => c.method === 'killTweensOf' && c.target === cardEl));
  assert.equal(getByTestId('warmup-card').getAttribute('data-flipped'), 'false');

  gsapCalls.length = 0;
  key(document.body, 'ArrowLeft');
  const back = animatedCalls().find((c) => c.method === 'to' && c.target === cardEl)!;
  assert.deepEqual([back.vars.x, back.vars.rotation], [width, 20]);
  const backFade = animatedCalls().filter((c) => c.method === 'to' && c.target === cardEl)[1];
  assert.equal(backFade.vars.opacity, 0);
  const backIn = animatedCalls().find((c) => c.method === 'fromTo' && c.target === cardEl)!;
  assert.deepEqual([backIn.fromVars.x, backIn.fromVars.rotation], [-200, -10]);
});

// --- Odlot bez ucinania ----------------------------------------------------------

const OVERFLOW_CLASS = /^(?:overflow(?:-[xy])?-(?:hidden|clip|auto|scroll)|\[overflow[^\]]*\]|\[contain:[^\]]*paint[^\]]*\])$/;
const CLIPPING_STYLE = /^(?:hidden|clip|auto|scroll)$/;

/** Przodkowie `el` aż do korzenia sceny (włącznie) — wszystko, co mogłoby przyciąć lecącą kartę. */
const sceneAncestors = (el: Element, root: Element) => {
  const chain: Element[] = [];
  for (let node: Element | null = el.parentElement; node; node = node.parentElement) {
    chain.push(node);
    if (node === root) return chain;
  }
  throw new Error('karta nie leży w korzeniu sceny');
};

test('odlot: w trakcie lotu żaden przodek karty w obrębie sceny nie ma overflow hidden/clip/auto na osi X', () => {
  deferAnimations = true;
  const { getByTestId } = setup();
  const root = getByTestId('warmup-cards-root');
  const cardEl = getByTestId('warmup-card').parentElement!;

  // Najpierw „Dalej" (karta 1 → 2), potem „Wstecz" (2 → 1): oba kierunki odlotu.
  for (const k of ['ArrowRight', 'ArrowLeft'] as const) {
    key(document.body, k);
    assert.ok(pending.length > 0, `${k}: karta jest w locie`);
    const ancestors = sceneAncestors(getByTestId('warmup-card').parentElement!, root);
    assert.ok(ancestors.includes(root) && ancestors.length >= 3);
    for (const el of ancestors) {
      for (const cls of Array.from(el.classList)) {
        assert.doesNotMatch(cls, OVERFLOW_CLASS, `${k}: przodek <${el.tagName.toLowerCase()}> ma klasę ${cls}`);
      }
      const st = (el as HTMLElement).style;
      assert.doesNotMatch(st.overflow || 'visible', CLIPPING_STYLE, `${k}: inline overflow`);
      assert.doesNotMatch(st.overflowX || 'visible', CLIPPING_STYLE, `${k}: inline overflow-x`);
      assert.equal(st.clipPath || '', '', `${k}: clip-path`);
    }
    while (pending.length) finishNextAnimation();
  }
  assert.ok(cardEl.isConnected);
});

test('odlot: krycie to osobny tween 1→0 (0,25 s, power1.out), krótszy niż ruch (0,3 s), po tweenie ruchu i bez kasowania go', () => {
  const { getByTestId } = setup();
  const cardEl = getByTestId('warmup-card').parentElement!;
  gsapCalls.length = 0;

  key(document.body, 'ArrowRight');
  const onCard = animatedCalls().filter((c) => c.method === 'to' && c.target === cardEl);
  const [move, fade] = onCard;
  assert.ok(move && fade, 'ruch i krycie');
  assert.equal(move.vars.x, -window.innerWidth, 'Dalej: karta leci w lewo');
  assert.deepEqual(
    [fade.vars.opacity, fade.vars.duration, fade.vars.ease],
    [0, 0.25, 'power1.out']
  );
  assert.ok(fade.vars.duration < move.vars.duration, 'krycie kończy się przed ruchem');
  // Tween ruchu ma overwrite:true, więc krycie musi powstać PO nim i nie może nic kasować.
  assert.equal(move.vars.overwrite, true);
  assert.equal(fade.vars.overwrite, false);
  for (const prop of ['x', 'y', 'rotation']) assert.equal(prop in fade.vars, false, `krycie nie rusza ${prop}`);
  // Podmianę karty zwalnia koniec ruchu, nie krycia.
  assert.equal(typeof move.vars.onComplete, 'function');
  assert.equal(fade.vars.onComplete, undefined);
});

test('odlot (prawdziwy GSAP): opacity dochodzi do 0 przed końcem tweena x, a karta wciąż jest w locie', () => {
  Object.assign(g, realGsap);
  (globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try {
    const { getByTestId, progress } = setup();
    const cardEl = getByTestId('warmup-card').parentElement!;
    key(document.body, 'ArrowRight');

    const tweens = gsap.getTweensOf(cardEl);
    const move = tweens.find((t) => (t.vars as any).x !== undefined)!;
    const fade = tweens.find((t) => (t.vars as any).opacity === 0)!;
    assert.ok(move && fade && move !== fade, 'dwa osobne tweeny');
    assert.equal(fade.startTime(), move.startTime(), 'startują razem');
    assert.ok(fade.startTime() + fade.duration() < move.startTime() + move.duration());

    // Przewijamy na moment, w którym krycie już się skończyło, a ruch jeszcze trwa.
    const t = fade.duration() + 0.01;
    assert.ok(t < move.duration());
    fade.pause().time(fade.duration());
    move.pause().time(t);
    assert.equal(Number(gsap.getProperty(cardEl, 'opacity')), 0);
    const x = Number(gsap.getProperty(cardEl, 'x'));
    assert.ok(x < 0 && x > -window.innerWidth, `x=${x}: w locie w lewo, nie u celu`);
    assert.equal(progress(), 'Karta 1 z 2', 'podmiana dopiero po końcu ruchu');
  } finally {
    gsap.globalTimeline.clear();
    Object.assign(g, fakeGsap);
    delete (globalThis as any).getComputedStyle;
  }
});

test('odlot: poziomy scroll strony blokują kontenery strony (main w Dashboard, powłoka DirectHomeworkScreen), nie panel kart', () => {
  const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
  const dashboard = read('components/dashboard/Dashboard.tsx');
  assert.match(dashboard, /<main className="[^"]*\boverflow-x-hidden\b/);
  const direct = read('components/dashboard/DirectHomeworkScreen.tsx');
  const shell = direct.match(/const shell = [\s\S]*?className="([^"]*)"/);
  assert.ok(shell, 'powłoka DirectHomeworkScreen');
  assert.match(shell![1], /\boverflow-x-hidden\b/);
});

test('odlot: przyciski Wstecz/Odwróć/Dalej i podpowiedzi leżą nad sceną (z-10), karta przechodzi pod nimi', () => {
  const { getByTestId, getByLabelText } = setup();
  const controls = getByTestId('warmup-cards-controls');
  assert.ok(controls.classList.contains('relative') && controls.classList.contains('z-10'));
  for (const label of ['Poprzednia karta', 'Odwróć fiszkę']) assert.ok(controls.contains(getByLabelText(label)));
  assert.ok(controls.contains(getByTestId('warmup-cards-next')));
  const stage = getByTestId('warmup-cards-stage');
  assert.equal(stage.contains(controls), false, 'kontrolki poza sceną karty');
  assert.equal(stage.classList.contains('z-10'), false);
});

test('zmiana karty jest sekwencją: licznik i treść zmieniają się po odlocie, nie przed; bez kopii karty', () => {
  deferAnimations = true;
  const { getByTestId, queryByTestId, progress, isFlipped } = setup();
  fireEvent.click(getByTestId('warmup-card'));
  assert.equal(isFlipped(), true);

  key(document.body, 'ArrowRight');
  assert.equal(progress(), 'Karta 1 z 2', 'stara karta odlatuje, licznik jeszcze stary');
  assert.ok(getByTestId('warmup-card-front').textContent?.includes('take off'));
  assert.equal(queryByTestId('warmup-card-ghost'), null, 'jedna karta, bez odlatującej kopii');

  finishNextAnimation(); // odlot
  assert.equal(progress(), 'Karta 2 z 2');
  assert.ok(getByTestId('warmup-card-front').textContent?.includes('look up'));
  assert.equal(isFlipped(), false, 'nowa karta zaczyna awersem');
  assert.equal(pending.length, 1, 'wjazd nowej karty czeka na koniec');
  finishNextAnimation(); // wjazd
  assert.equal(pending.length, 0);
});

test('GSAP: szybkie naciśnięcia w trakcie przejścia — ostatnie czeka, powtórzenia trzymanego klawisza odpadają', () => {
  deferAnimations = true;
  const { progress, calls } = setup(threeCards);

  key(document.body, 'ArrowRight');
  key(document.body, 'ArrowRight', { repeat: true });
  key(document.body, 'ArrowRight', { repeat: true });
  key(document.body, 'ArrowRight'); // osobne naciśnięcie — zakolejkowane
  assert.equal(pending.length, 1, 'jedno przejście naraz');
  assert.equal(progress(), 'Karta 1 z 3');

  finishNextAnimation(); // odlot karty 1
  assert.equal(progress(), 'Karta 2 z 3');
  assert.equal(pending.length, 1, 'koniec samego odlotu nie zwalnia kolejki');
  finishNextAnimation(); // wjazd karty 2 → rusza zakolejkowane „dalej"
  assert.equal(pending.length, 1);
  assert.equal(progress(), 'Karta 2 z 3');
  finishNextAnimation(); // odlot karty 2
  assert.equal(progress(), 'Karta 3 z 3');

  // Enter w trakcie przejścia na ostatnią kartę czeka i kończy dopiero po jej wjeździe.
  key(document.body, 'Enter');
  finishNextAnimation(); // wjazd karty 3 → rusza zakolejkowany Enter
  assert.equal(calls.done, 1);
  assert.equal(pending.length, 0, 'żadna karta nie zostaje w połowie animacji');
});

test('GSAP: podwójny klik „Dalej" z przedostatniej karty nie kończy kart', () => {
  deferAnimations = true;
  const { getByTestId, progress, calls } = setup();
  fireEvent.click(getByTestId('warmup-cards-next'));
  fireEvent.click(getByTestId('warmup-cards-next')); // drugi klik w trakcie przejścia → „next" w kolejce
  finishNextAnimation();
  assert.equal(progress(), 'Karta 2 z 2');
  finishNextAnimation();
  assert.equal(pending.length, 0);
  assert.equal(calls.done, 0);

  // Po przejściu „Zakończ karty" działa normalnie.
  fireEvent.click(getByTestId('warmup-cards-next'));
  assert.equal(calls.done, 1);
});

test('gsap.context: odmontowanie w trakcie odlotu zabija prawdziwe tweeny', () => {
  Object.assign(g, realGsap);
  // CSSPlugin woła globalne getComputedStyle — jsdom ma je tylko na window.
  (globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try {
    const { getByTestId, unmount, calls } = setup();
    const cardEl = getByTestId('warmup-card').parentElement!;
    key(document.body, 'ArrowRight');
    assert.ok(gsap.getTweensOf(cardEl).length > 0, 'odlot karty trwa');

    unmount();
    assert.equal(gsap.getTweensOf(cardEl).length, 0);
    assert.equal(calls.done, 0);
  } finally {
    // Gdyby sprzątanie zawiodło, żywe tweeny trzymałyby proces testów przy życiu.
    gsap.globalTimeline.clear();
    Object.assign(g, fakeGsap);
    delete (globalThis as any).getComputedStyle;
  }
});

// --- Przeciąganie ------------------------------------------------------------------

const ptr = (el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', x: number, extra: PointerEventInit = {}) =>
  act(() => {
    el.dispatchEvent(
      new (dom.window as any).PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        ...extra,
      })
    );
  });

const drag = (el: Element, from: number, to: number, extra: PointerEventInit = {}) => {
  ptr(el, 'pointerdown', from, extra);
  ptr(el, 'pointermove', from + (to - from) / 2, extra);
  ptr(el, 'pointermove', to, extra);
  ptr(el, 'pointerup', to, extra);
};

test('przeciąganie: przy nieodwróconej karcie opór (x = 0,5·dx, obrót 0,02·dx) i krótkie to() 0,1 s', () => {
  const { getByTestId } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  ptr(flipEl, 'pointerdown', 100);
  ptr(flipEl, 'pointermove', 160);
  const follow = animatedCalls().filter((c) => c.target === cardEl).pop()!;
  assert.deepEqual([follow.vars.x, follow.vars.rotation, follow.vars.duration], [30, 1.2, 0.1]);
  assert.equal(follow.vars.overwrite, true);
});

test('przeciąganie: przy odwróconej karcie karta podąża za wskaźnikiem (x = dx, obrót 0,05·dx)', () => {
  const { getByTestId } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  key(document.body, ' ');
  gsapCalls.length = 0;
  ptr(flipEl, 'pointerdown', 100);
  ptr(flipEl, 'pointermove', 160);
  const follow = animatedCalls().filter((c) => c.target === cardEl).pop()!;
  assert.deepEqual([follow.vars.x, follow.vars.rotation], [60, 3]);
});

test('przeciąganie: w LEWO ≥ 80 px = następna karta, w PRAWO = poprzednia; kliknięcie po gestcie nie odwraca', () => {
  const { getByTestId, progress, isFlipped } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  drag(flipEl, 200, 110);
  assert.equal(progress(), 'Karta 2 z 3');
  fireEvent.click(flipEl); // click zaraz po puszczeniu palca
  assert.equal(isFlipped(), false, 'gest nie odwraca karty');

  drag(getByTestId('warmup-card'), 100, 190);
  assert.equal(progress(), 'Karta 1 z 3');
});

test('przeciąganie: karta odlatuje w stronę palca, a nowa wjeżdża z przeciwnej (lewo → x<0, wjazd z prawej)', () => {
  const { getByTestId } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  gsapCalls.length = 0;
  drag(flipEl, 200, 100);
  const exit = animatedCalls().find((c) => c.method === 'to' && c.target === cardEl && (c.vars as any).x === -window.innerWidth);
  assert.ok(exit, 'odlot w lewo');
  const enter = animatedCalls().find((c) => c.method === 'fromTo' && c.target === cardEl)!;
  assert.ok(enter.fromVars.x > 0, 'wjazd z prawej');

  gsapCalls.length = 0;
  drag(getByTestId('warmup-card'), 100, 200);
  assert.ok(animatedCalls().find((c) => c.method === 'to' && c.target === cardEl && (c.vars as any).x === window.innerWidth), 'odlot w prawo');
  assert.ok(animatedCalls().find((c) => c.method === 'fromTo' && c.target === cardEl)!.fromVars.x < 0, 'wjazd z lewej');
});

test('przeciąganie: dotyk zaczęty przy lewej krawędzi ekranu (gest „wstecz" systemu) nie rusza karty', () => {
  const { getByTestId, progress } = setup(threeCards);
  drag(getByTestId('warmup-card'), 5, 200);
  assert.equal(progress(), 'Karta 1 z 3');
});

test('przeciąganie: lostpointercapture z elementu potomnego (niejawne przechwycenie dotyku w Chromium) nie przerywa gestu', () => {
  const { getByTestId, progress } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const child = getByTestId('warmup-card-front');
  ptr(flipEl, 'pointerdown', 200);
  ptr(flipEl, 'pointermove', 150);
  act(() => {
    child.dispatchEvent(new (dom.window as any).PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1, pointerType: 'touch' }));
  });
  ptr(flipEl, 'pointermove', 100);
  ptr(flipEl, 'pointerup', 100);
  assert.equal(progress(), 'Karta 2 z 3', 'gest dokończony mimo zwolnienia niejawnego przechwycenia');
});

test('przeciąganie: utrata własnego przechwycenia (cel = kontener karty) anuluje gest', () => {
  const { getByTestId, progress } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  ptr(flipEl, 'pointerdown', 200);
  ptr(flipEl, 'pointermove', 150);
  act(() => {
    cardEl.dispatchEvent(new (dom.window as any).PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1, pointerType: 'touch' }));
  });
  ptr(flipEl, 'pointermove', 100);
  ptr(flipEl, 'pointerup', 100);
  assert.equal(progress(), 'Karta 1 z 3');
});

test('przeciąganie: pointercapture po przekroczeniu progu ruchu i zwolnienie po puszczeniu', () => {
  const { getByTestId } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  const captured: number[] = [];
  const released: number[] = [];
  (cardEl as any).setPointerCapture = (id: number) => captured.push(id);
  (cardEl as any).releasePointerCapture = (id: number) => released.push(id);
  ptr(flipEl, 'pointerdown', 200);
  ptr(flipEl, 'pointermove', 198); // < 8 px: jeszcze kliknięcie
  assert.deepEqual(captured, []);
  ptr(flipEl, 'pointermove', 150);
  assert.deepEqual(captured, [1]);
  ptr(flipEl, 'pointerup', 150);
  assert.deepEqual(released, [1]);
});

test('przeciąganie: za krótkie (< 80 px) — sprężysty powrót z clearProps, bez zmiany karty', () => {
  const { getByTestId, progress } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  drag(flipEl, 100, 170); // 70 px
  assert.equal(progress(), 'Karta 1 z 3');
  const back = animatedCalls().filter((c) => c.target === cardEl).pop()!;
  assert.deepEqual([back.vars.x, back.vars.rotation, back.vars.opacity, back.vars.clearProps], [0, 0, 1, 'all']);
  assert.equal(back.vars.ease, 'back.out(1.5)');
});

test('przeciąganie: na granicach (w prawo na pierwszej, w lewo na ostatniej) karta wraca na miejsce', () => {
  const { getByTestId, progress, calls } = setup();
  const flipEl = getByTestId('warmup-card');
  const cardEl = flipEl.parentElement!;
  drag(flipEl, 50, 200); // pierwsza karta → „poprzednia" niemożliwa
  assert.equal(progress(), 'Karta 1 z 2');
  assert.equal(animatedCalls().filter((c) => c.target === cardEl).pop()!.vars.clearProps, 'all');

  drag(flipEl, 200, 50); // → karta 2 (ostatnia)
  assert.equal(progress(), 'Karta 2 z 2');
  gsapCalls.length = 0;
  drag(getByTestId('warmup-card'), 200, 50); // „następna" na ostatniej
  assert.equal(progress(), 'Karta 2 z 2');
  assert.equal(calls.done, 0, 'przeciągnięcie nie kończy kart');
  assert.equal(animatedCalls().filter((c) => c.target === cardEl).pop()!.vars.clearProps, 'all');
});

test('przeciąganie: anulowanie wskaźnika wraca na miejsce; prawy przycisk myszy i przyciski wymowy nie zaczynają gestu', () => {
  installSpeech();
  const { getByTestId, progress } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  ptr(flipEl, 'pointerdown', 100);
  ptr(flipEl, 'pointermove', 250);
  ptr(flipEl, 'pointercancel', 250);
  assert.equal(progress(), 'Karta 1 z 3');

  drag(flipEl, 100, 250, { pointerType: 'mouse', button: 2 });
  assert.equal(progress(), 'Karta 1 z 3');

  const speak = getByTestId('warmup-card-front').querySelector('[data-lang="en-GB"]')!;
  drag(speak, 100, 250);
  assert.equal(progress(), 'Karta 1 z 3');
});

test('przeciąganie myszą działa jak dotyk; zwykłe kliknięcie bez ruchu odwraca kartę', () => {
  const { getByTestId, progress, isFlipped } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  drag(flipEl, 200, 100, { pointerType: 'mouse' });
  assert.equal(progress(), 'Karta 2 z 3');
  const el2 = getByTestId('warmup-card');
  ptr(el2, 'pointerdown', 100, { pointerType: 'mouse' });
  ptr(el2, 'pointerup', 100, { pointerType: 'mouse' });
  fireEvent.click(el2);
  assert.equal(isFlipped(), true);
});

test('przeciąganie: w trakcie przejścia nowy gest jest ignorowany (kolejka: ostatnia akcja wygrywa)', () => {
  deferAnimations = true;
  const { getByTestId, progress } = setup(threeCards);
  const flipEl = getByTestId('warmup-card');
  key(document.body, 'ArrowRight');
  drag(flipEl, 100, 250);
  assert.equal(pending.length, 1);
  finishNextAnimation();
  finishNextAnimation();
  assert.equal(progress(), 'Karta 2 z 3');
});

test('przeciąganie przy prefers-reduced-motion: gest przełącza kartę bez żadnych tweenów', () => {
  (dom.window as any).matchMedia = (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  const { getByTestId, progress } = setup(threeCards);
  const bar = getByTestId('warmup-cards-bar');
  gsapCalls.length = 0;
  drag(getByTestId('warmup-card'), 220, 100);
  assert.equal(progress(), 'Karta 2 z 3');
  assert.deepEqual(animatedCalls().filter((c) => c.target !== bar), []);
});

test('pasek postępu: szerokość ustawiona na starcie, potem animowana; role=progressbar i aria-live licznika', () => {
  const { getByTestId, getByRole } = setup();
  const bar = getByTestId('warmup-cards-bar');
  const initial = gsapCalls.find((c) => c.method === 'set' && c.target === bar);
  assert.equal(initial?.vars.width, '50%');

  key(document.body, 'ArrowRight');
  const grow = animatedCalls().find((c) => c.target === bar);
  assert.equal(grow?.vars.width, '100%');
  assert.equal(grow?.vars.duration, 0.3);

  const progressbar = getByRole('progressbar');
  assert.equal(progressbar.getAttribute('aria-valuenow'), '2');
  assert.equal(progressbar.getAttribute('aria-valuemax'), '2');
  assert.equal(progressbar.getAttribute('aria-label'), 'Postęp fiszek');
  const counter = getByTestId('warmup-cards-progress');
  assert.equal(counter.getAttribute('aria-live'), 'polite');
  assert.equal(getByTestId('warmup-cards-root').getAttribute('aria-label'), 'Fiszki rozgrzewki');
  // Poziomy scroll strony blokuje kontener strony (patrz test strukturalny niżej), nie sam panel —
  // clip na panelu ścinałby lecącą kartę pionową krawędzią.
  assert.doesNotMatch(getByTestId('warmup-cards-root').className, /overflow/);
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

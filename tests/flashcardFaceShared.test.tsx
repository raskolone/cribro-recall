// Wspólna karta (FlashcardFace): ta sama struktura i klasy w module fiszek i w rozgrzewce.
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
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import '../i18n';
import FlashcardFace, {
  ACTIONS_CLASS,
  BACK_BODY_CLASS,
  BACK_CLASS,
  BACK_LABEL_CLASS,
  FACE_BASE_CLASS,
  FRONT_BODY_CLASS,
  FRONT_CLASS,
  FRONT_LABEL_CLASS,
} from '../components/flashcards/FlashcardFace';
import HomeworkWarmupCards from '../components/dashboard/HomeworkWarmupCards';

afterEach(() => cleanup());

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const has = (el: Element, all: string) => all.split(/\s+/).every(c => classes(el).includes(c));

// Tak moduł fiszek woła FlashcardFace (HTML + akcje w rogu).
const renderModuleStyle = () =>
  render(
    <div className="grid">
      <FlashcardFace side="front" label="Pojęcie" html="<b>take</b> off" actions={<button type="button">UK</button>} />
      <FlashcardFace side="back" label="Definicja" html="zdjąć" actions={<button type="button">UK</button>} />
    </div>,
  );

const renderWarmup = () =>
  render(<HomeworkWarmupCards cards={[{ term: 'take off', definition: 'zdjąć', contextSentence: 'Take off your coat.' }]} onDone={() => {}} onSkip={() => {}} />);

const structure = (face: Element) => ({
  root: classes(face).filter(c => c !== 'invisible').sort().join(' '),
  label: classes(face.children[face.querySelector('.absolute') ? 1 : 0]).sort().join(' '),
});

test('przód i tył: te same klasy kontenera, etykiety i treści w module i w rozgrzewce', () => {
  const mod = renderModuleStyle();
  const modFront = mod.container.querySelector('[data-face="front"]')!;
  const modBack = mod.container.querySelector('[data-face="back"]')!;
  const modRoot = [modFront, modBack].map(f => classes(f).sort().join(' '));
  const modBodies = [modFront, modBack].map(f => classes(f.querySelector('div.font-bold')!).sort().join(' '));
  const modLabels = [modFront, modBack].map(f => classes(f.querySelector('.font-mono')!).sort().join(' '));
  cleanup();

  const wu = renderWarmup();
  const wuFront = wu.container.querySelector('[data-face="front"]')!;
  const wuBack = wu.container.querySelector('[data-face="back"]')!;
  const wuRoot = [wuFront, wuBack].map(f => classes(f).sort().join(' '));
  const wuBodies = [wuFront, wuBack].map(f => classes(f.querySelector('div.font-bold')!).sort().join(' '));
  const wuLabels = [wuFront, wuBack].map(f => classes(f.querySelector('.font-mono')!).sort().join(' '));

  assert.deepEqual(wuRoot, modRoot);
  assert.deepEqual(wuBodies, modBodies);
  assert.deepEqual(wuLabels, modLabels);
});

test('klasy wspólnej karty: jedna komórka siatki, min-h, tokeny motywu, zawijanie, róg na akcje', () => {
  const { container } = renderModuleStyle();
  const front = container.querySelector('[data-face="front"]')!;
  const back = container.querySelector('[data-face="back"]')!;
  assert.ok(classes(front).includes('liquid-glass-card'));
  assert.ok(has(front, FACE_BASE_CLASS) && has(front, FRONT_CLASS));
  assert.ok(has(back, FACE_BASE_CLASS) && has(back, BACK_CLASS));
  assert.ok(has(front, 'col-start-1 row-start-1 min-h-[240px] sm:min-h-[300px]'));
  assert.ok(!classes(front).includes('absolute'), 'bez position:absolute');
  assert.ok(has(front.querySelector('.font-mono')!, FRONT_LABEL_CLASS));
  assert.ok(has(back.querySelector('.font-mono')!, BACK_LABEL_CLASS));
  assert.ok(has(front.querySelector('div.font-bold')!, FRONT_BODY_CLASS));
  assert.ok(has(back.querySelector('div.font-bold')!, BACK_BODY_CLASS));
  assert.ok(FRONT_BODY_CLASS.includes('break-words') && FRONT_BODY_CLASS.includes('text-text-hi'));
  assert.ok(has(front.firstElementChild!, ACTIONS_CLASS));
  assert.equal((front.getAttribute('style') ?? '').includes('backface-visibility: hidden'), true);
  assert.equal((back.getAttribute('style') ?? '').includes('rotateY(180deg)'), true);
});

test('treść: html wstawiany jak w module, tekst w rozgrzewce jest escapowany', () => {
  const mod = renderModuleStyle();
  assert.equal(mod.container.querySelector('[data-face="front"] b')?.textContent, 'take');
  cleanup();
  const { container } = render(
    <FlashcardFace side="front" label="X">{'<b>nie</b>'}</FlashcardFace>,
  );
  assert.equal(container.querySelector('b'), null);
  assert.equal(container.querySelector('div.font-bold')!.textContent, '<b>nie</b>');
});

test('tryb flat (reduced motion): bez backface/rotateY, strona odwrócona od widza jest invisible; inert + aria-hidden', () => {
  const { container } = render(
    <div className="grid">
      <FlashcardFace side="front" label="A" flat turnedAway={true}>x</FlashcardFace>
      <FlashcardFace side="back" label="B" flat turnedAway={false}>y</FlashcardFace>
    </div>,
  );
  const front = container.querySelector('[data-face="front"]')!;
  const back = container.querySelector('[data-face="back"]')!;
  assert.ok(classes(front).includes('invisible'));
  assert.ok(!classes(back).includes('invisible'));
  assert.equal(front.getAttribute('style') ?? '', '');
  assert.equal(front.getAttribute('aria-hidden'), 'true');
  assert.equal(back.getAttribute('aria-hidden'), 'false');
  assert.ok(front.hasAttribute('inert'));
  assert.ok(!back.hasAttribute('inert'));
});

test('moduł fiszek i rozgrzewka używają FlashcardFace (zero zduplikowanego markupu kart)', () => {
  const mode = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
  const flashcardsMode = mode.slice(mode.indexOf('const FlashcardsMode'), mode.indexOf('const QuizMode'));
  assert.equal((flashcardsMode.match(/<FlashcardFace/g) || []).length, 2);
  assert.doesNotMatch(flashcardsMode, /backface-hidden|data-face/);
  const warmup = readFileSync(new URL('../components/dashboard/HomeworkWarmupCards.tsx', import.meta.url), 'utf8');
  assert.equal((warmup.match(/<FlashcardFace/g) || []).length, 2);
  // Ten sam układ stage: grid + perspective-1000 w obu miejscach.
  assert.match(flashcardsMode, /perspective-1000/);
  assert.match(warmup, /perspective-1000/);
  assert.match(warmup, /className="grid cursor-pointer select-none"/);
});

test('przyciski wymowy mają wspólny wygląd (PronunciationButtons) i są po stronie rozgrzewki natywne', () => {
  const tts = readFileSync(new URL('../components/flashcards/TTSButtons.tsx', import.meta.url), 'utf8');
  const warmup = readFileSync(new URL('../components/dashboard/HomeworkWarmupCards.tsx', import.meta.url), 'utf8');
  assert.match(tts, /PronunciationButtons/);
  assert.match(warmup, /PronunciationButtons/);
  assert.doesNotMatch(warmup, /playSpeech|TTSButtons|aiMonitor/);
  assert.match(warmup, /speechSynthesis/);
});

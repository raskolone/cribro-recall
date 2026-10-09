// Ekran „Ćwiczenia dowolne" (render + interakcja). jsdom ustawiany ręcznie, jak w pozostałych
// testach komponentów.
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
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import FreePracticeScreen from '../components/practice/FreePracticeScreen';
import type { FreePracticeLaunch } from '../utils/freePractice';
import type { FlashcardSet } from '../types';

// i18n inicjalizuje się asynchronicznie — bez czekania pierwszy render kończy się aktualizacją poza act().
before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});

afterEach(() => cleanup());

const mkSet = (id: string, title: string, extra: Partial<FlashcardSet> = {}): FlashcardSet => ({
  id,
  userId: 'u1',
  title,
  isPublic: false,
  cardCount: 5,
  createdAt: '',
  updatedAt: '',
  ...extra,
});

const sets: FlashcardSet[] = [
  mkSet('s1', 'Moje słówka', { lessonTopic: 'Podróże' }),
  mkSet('s2', 'Lekcja 4', { isLessonVocabulary: true }),
  mkSet('d1', 'Szkic zestawu', { isDraft: true }),
  mkSet('g1', 'Ogólne A1', { isGeneral: true }),
  mkSet('g2', 'Ogólne A2', { isGeneral: true }),
];

const setup = (props: Partial<React.ComponentProps<typeof FreePracticeScreen>> = {}) => {
  const starts: FreePracticeLaunch[] = [];
  const calls = { back: 0, vocabulary: 0, sentences: 0 };
  const utils = render(
    <FreePracticeScreen
      sets={sets}
      onStart={(launch) => starts.push(launch)}
      onBack={() => calls.back++}
      onOpenVocabulary={() => calls.vocabulary++}
      onOpenExtraPractice={() => calls.sentences++}
      {...props}
    />,
  );
  const radios = () => Array.from(utils.container.querySelectorAll<HTMLElement>('[role="radio"]'));
  const checked = () => radios().find((r) => r.getAttribute('aria-checked') === 'true')!;
  const setButtons = () => Array.from(utils.container.querySelectorAll<HTMLElement>('[data-testid="free-practice-set"]'));
  return { ...utils, starts, calls, radios, checked, setButtons };
};

test('ekran: nagłówek, powrót, pięć rodzajów w grupie radio, domyślnie fiszki', () => {
  const { getByRole, getByTestId, radios, checked } = setup();
  assert.equal(getByRole('heading', { level: 1 }).textContent, 'Ćwiczenia dowolne');
  assert.ok(getByTestId('free-practice-back'));
  const group = getByRole('radiogroup');
  assert.ok(group.getAttribute('aria-labelledby'));
  assert.equal(radios().length, 5);
  assert.equal(checked().getAttribute('data-mode'), 'flashcards');
  // Roving tabindex: tylko wybrany rodzaj jest w kolejności tabulacji.
  assert.deepEqual(radios().map((r) => r.tabIndex), [0, -1, -1, -1, -1]);
  assert.equal(radios()[0].getAttribute('aria-checked'), 'true');
});

test('fokus po wejściu trafia na nagłówek ekranu (przycisk wejścia zniknął z pulpitu); dalej Tab idzie do wybranego rodzaju', () => {
  const { getByRole, checked } = setup();
  const h1 = getByRole('heading', { level: 1 });
  assert.equal(document.activeElement, h1);
  assert.equal(h1.tabIndex, -1, 'nagłówek tylko programowo fokusowalny, poza kolejnością Tab');
  // Pierwszy element po nagłówku w kolejności Tab to wybrany rodzaj (roving tabindex = 0).
  assert.ok(h1.compareDocumentPosition(checked()) & 4, 'wybrany rodzaj leży za nagłówkiem w DOM');
  assert.equal(checked().tabIndex, 0);
});

test('start: klik w zestaw wywołuje onStart raz, z wybranym rodzajem i bez pól pracy domowej', () => {
  const { setButtons, starts, radios } = setup();
  fireEvent.click(setButtons()[0]);
  assert.deepEqual(starts, [{ view: 'flashcard-study', setId: 's1', mode: 'flashcards' }]);

  fireEvent.click(radios().find((r) => r.getAttribute('data-mode') === 'matching')!);
  fireEvent.click(setButtons()[1]);
  assert.deepEqual(starts[1], { view: 'flashcard-study', setId: 's2', mode: 'matching' });
  assert.equal(starts.length, 2);
  for (const launch of starts) assert.deepEqual(Object.keys(launch).sort(), ['mode', 'setId', 'view']);
});

test('klawiatura: strzałki zmieniają i fokusują rodzaj, Home/End skaczą, zawijanie na krańcach', () => {
  const { radios, checked } = setup();
  const mode = () => checked().getAttribute('data-mode');

  fireEvent.keyDown(radios()[0], { key: 'ArrowRight' });
  assert.equal(mode(), 'quiz');
  assert.equal(document.activeElement, checked(), 'fokus idzie za wyborem');
  assert.deepEqual(radios().map((r) => r.tabIndex), [-1, 0, -1, -1, -1]);

  fireEvent.keyDown(checked(), { key: 'ArrowDown' });
  assert.equal(mode(), 'writing');
  fireEvent.keyDown(checked(), { key: 'ArrowLeft' });
  assert.equal(mode(), 'quiz');
  fireEvent.keyDown(checked(), { key: 'End' });
  assert.equal(mode(), 'intro');
  fireEvent.keyDown(checked(), { key: 'ArrowRight' });
  assert.equal(mode(), 'flashcards', 'zawinięcie z ostatniego na pierwszy');
  fireEvent.keyDown(checked(), { key: 'ArrowLeft' });
  assert.equal(mode(), 'intro', 'zawinięcie z pierwszego na ostatni');
  fireEvent.keyDown(checked(), { key: 'Home' });
  assert.equal(mode(), 'flashcards');
});

test('klawiatura: strzałka nie jest połykana przez inne klawisze, a preventDefault tylko dla obsłużonych', () => {
  const { radios } = setup();
  const handled = fireEvent.keyDown(radios()[0], { key: 'ArrowRight' });
  assert.equal(handled, false, 'strzałka: preventDefault (nie przewija strony)');
  const ignored = fireEvent.keyDown(radios()[1], { key: 'Tab' });
  assert.equal(ignored, true, 'Tab zostaje przeglądarce');
});

test('zestawy to natywne przyciski z czytelną etykietą (rodzaj + tytuł); szkice pominięte', () => {
  const { setButtons, radios } = setup();
  const buttons = setButtons();
  assert.deepEqual(buttons.map((b) => b.getAttribute('data-set-id')), ['s1', 's2', 'g1', 'g2']);
  for (const b of buttons) {
    assert.equal(b.tagName, 'BUTTON');
    assert.equal(b.getAttribute('type'), 'button');
  }
  assert.match(buttons[0].getAttribute('aria-label')!, /Fiszki.*Moje słówka/);
  fireEvent.click(radios().find((r) => r.getAttribute('data-mode') === 'quiz')!);
  assert.match(setButtons()[0].getAttribute('aria-label')!, /Quiz.*Moje słówka/);
  assert.equal(document.body.textContent!.includes('Szkic zestawu'), false);
  assert.ok(document.body.textContent!.includes('Podróże'), 'temat lekcji jako druga linia');
});

test('słownictwo ogólne siedzi w zwiniętej sekcji z licznikiem', () => {
  const { getByTestId } = setup();
  const details = getByTestId('free-practice-general') as HTMLDetailsElement;
  assert.equal(details.open, false);
  assert.match(details.querySelector('summary')!.textContent!, /Słownictwo ogólne \(2\)/);
  assert.equal(details.querySelectorAll('[data-testid="free-practice-set"]').length, 2);
});

test('same zestawy ogólne: sekcja własnych się nie pojawia, ekran działa', () => {
  const { setButtons, starts, getByTestId } = setup({ sets: sets.filter((s) => s.isGeneral) });
  assert.equal(setButtons().length, 2);
  assert.equal(document.querySelectorAll('ul[aria-labelledby="free-practice-sets-label"]').length, 0);
  fireEvent.click(setButtons()[0]);
  assert.equal(starts[0].setId, 'g1');
  assert.ok(getByTestId('free-practice-general'));
});

test('brak zestawów: komunikat i przejście do słownictwa, żadnego przycisku startu', () => {
  const { getByTestId, setButtons, calls, getByText } = setup({ sets: [] });
  assert.ok(getByTestId('free-practice-empty'));
  assert.equal(setButtons().length, 0);
  fireEvent.click(getByText('Przejdź do słownictwa'));
  assert.equal(calls.vocabulary, 1);
});

test('powrót i osobny wiersz „Zdania z AI": wołają swoje obsługi, nie startują ćwiczenia', () => {
  const { getByTestId, calls, starts, radios } = setup();
  fireEvent.click(getByTestId('free-practice-back'));
  assert.equal(calls.back, 1);
  fireEvent.click(getByTestId('free-practice-sentences'));
  assert.equal(calls.sentences, 1);
  assert.equal(starts.length, 0);
  assert.equal(radios().length, 5, 'zdania AI nie są rodzajem na liście');
});

test('wiersz „Zdania z AI" nie pojawia się bez obsługi', () => {
  const { queryByTestId } = setup({ onOpenExtraPractice: undefined });
  assert.equal(queryByTestId('free-practice-sentences'), null);
});

test('ekran tłumaczy się na angielski przez i18n', async () => {
  await i18n.changeLanguage('en');
  try {
    const { getByRole, radios, getByText } = setup();
    assert.equal(getByRole('heading', { level: 1 }).textContent, 'Free practice');
    assert.deepEqual(
      radios().map((r) => r.querySelector('span')!.textContent),
      ['Flashcards', 'Quiz', 'Writing', 'Matching', 'Flashcards Intro'],
    );
    assert.ok(getByText('Dashboard'));
  } finally {
    cleanup(); // odmontować przed zmianą języka — inaczej aktualizacja leci poza act()
    await i18n.changeLanguage('pl');
  }
});

test('dostępność ruchu: bez animacji w JS, a każde przejście kolorów wyłączane przy reduced-motion', () => {
  for (const file of ['components/practice/FreePracticeScreen.tsx', 'components/dashboard/FreePracticeEntry.tsx']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /gsap|motion\/react|framer-motion|react-dnd|dnd-kit/i, file);
    const transitions = (src.match(/transition-(?:colors|transform)/g) || []).length;
    const reduced = (src.match(/motion-reduce:transition-none/g) || []).length;
    assert.ok(transitions > 0 && reduced === transitions, `${file}: ${transitions} przejść, ${reduced} z motion-reduce`);
  }
});

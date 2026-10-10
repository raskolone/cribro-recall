// Ekran „Ćwiczenia dowolne" v2 (render + interakcja): trzy kroki, wybór wielu zestawów, tryby.
// jsdom ustawiany ręcznie, jak w pozostałych testach komponentów.
import { dom } from './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import FreePracticeScreen from '../components/practice/FreePracticeScreen';
import type { FreePracticeLaunch } from '../utils/freePractice';
import { MAX_FREE_PRACTICE_SETS } from '../utils/freePractice';
import type { FlashcardSet } from '../types';

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});

afterEach(() => {
  cleanup();
  delete (dom.window as any).matchMedia;
  delete (dom.window.HTMLElement.prototype as any).animate;
});

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
  mkSet('s2', 'Lekcja 4', { isLessonVocabulary: true, cardCount: 12 }),
  mkSet('d1', 'Szkic zestawu', { isDraft: true }),
  mkSet('e1', 'Pusty zestaw', { cardCount: 0 }),
  mkSet('g1', 'Ogólne A1', { isGeneral: true, cardCount: undefined, flashcards: [1, 2, 3] as any }),
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
  const tile = (mode: string) => radios().find((r) => r.getAttribute('data-mode') === mode)!;
  const rows = () => Array.from(utils.container.querySelectorAll<HTMLElement>('[data-testid="free-practice-set"]'));
  const row = (id: string) => rows().find((r) => r.getAttribute('data-set-id') === id)!;
  const box = (id: string) => row(id).querySelector('input[type="checkbox"]') as HTMLInputElement;
  const next = () => utils.getByTestId('free-practice-next') as HTMLButtonElement;
  const prev = () => utils.getByTestId('free-practice-prev') as HTMLButtonElement;
  const stepCounter = () => utils.getByTestId('free-practice-step-counter').textContent;
  const toScope = () => fireEvent.click(next());
  const toStart = () => {
    fireEvent.click(next());
    fireEvent.click(next());
  };
  return { ...utils, starts, calls, radios, checked, tile, rows, row, box, next, prev, stepCounter, toScope, toStart };
};

test('kolejność kroków: 1 rodzaj → 2 zakres → 3 start, z widocznym postępem i powrotem', () => {
  const { stepCounter, next, prev, getByTestId, queryByTestId, container, toScope } = setup();
  assert.equal(stepCounter(), 'Krok 1 z 3');
  assert.ok(getByTestId('free-practice-step-type'));
  assert.equal(queryByTestId('free-practice-prev'), null, 'na pierwszym kroku nie ma „Wstecz"');
  const current = () => container.querySelector('[data-testid="free-practice-steps"] li[aria-current="step"]')!.getAttribute('data-step');
  assert.equal(current(), 'type');
  assert.equal(next().textContent, 'Dalej');

  toScope();
  assert.equal(stepCounter(), 'Krok 2 z 3');
  assert.ok(getByTestId('free-practice-step-scope'));
  assert.equal(current(), 'scope');
  assert.equal(next().disabled, true, 'bez zestawu nie można iść dalej');

  fireEvent.click(prev());
  assert.equal(stepCounter(), 'Krok 1 z 3');
  assert.ok(getByTestId('free-practice-step-type'));
});

test('krok 3 jest dopiero po wyborze zestawu; przycisk zmienia się na „Start" i startuje', () => {
  const { box, next, stepCounter, starts, getByTestId, toScope } = setup();
  toScope();
  fireEvent.click(box('s1'));
  fireEvent.click(next());
  assert.equal(stepCounter(), 'Krok 3 z 3');
  assert.equal(next().textContent, 'Start');
  assert.ok(getByTestId('free-practice-summary').textContent!.includes('Moje słówka'));
  fireEvent.click(next());
  assert.deepEqual(starts, [{ view: 'flashcard-study', setId: 's1', setIds: ['s1'], mode: 'flashcards' }]);
});

test('menu: pięć rodzajów, bez „Fiszki Intro" i „Pisanie", domyślnie Fiszki, roving tabindex', () => {
  const { radios, checked, container } = setup();
  assert.deepEqual(
    radios().map((r) => r.querySelector('span:nth-of-type(2)')!.textContent),
    ['Fiszki', 'Quiz', 'Dopasowanie', 'Korekta zdań', 'Tłumaczenie zdań'],
  );
  const text = container.textContent!;
  assert.ok(!text.includes('Fiszki Intro') && !text.includes('Pisanie'));
  assert.equal(checked().getAttribute('data-mode'), 'flashcards');
  assert.deepEqual(radios().map((r) => r.tabIndex), [0, -1, -1, -1, -1]);
});

test('kafelki: każdy ma ikonę (svg), opis i własny akcent; wybrany ma znacznik — nie tylko kolor', () => {
  const { radios, tile } = setup();
  for (const r of radios()) {
    assert.ok(r.querySelector('svg'), `${r.getAttribute('data-mode')}: ikona`);
    assert.ok(r.querySelectorAll('span').length >= 3, 'tytuł + opis');
  }
  assert.ok(tile('flashcards').querySelector('[data-testid="free-practice-selected-mark"] svg'), 'znacznik wyboru z ikoną');
  assert.equal(tile('quiz').querySelector('[data-testid="free-practice-selected-mark"]'), null);
  assert.match(tile('flashcards').className, /border-primary/);
  assert.match(tile('quiz').className, /border-line-strong/);
  fireEvent.click(tile('quiz'));
  assert.ok(tile('quiz').querySelector('[data-testid="free-practice-selected-mark"]'));
  assert.equal(tile('flashcards').querySelector('[data-testid="free-practice-selected-mark"]'), null);
});

test('korekta i tłumaczenie: kafelki „wkrótce" — wyłączone, z opisem, nie dają się wybrać', () => {
  const { tile, checked, next, toScope, getAllByTestId } = setup();
  for (const mode of ['correction', 'translation']) {
    const el = tile(mode);
    assert.equal(el.getAttribute('aria-disabled'), 'true');
    assert.equal(el.getAttribute('data-available'), 'false');
    assert.equal(el.tabIndex, -1);
    assert.ok(el.textContent!.includes('Wkrótce'));
    fireEvent.click(el);
    assert.equal(checked().getAttribute('data-mode'), 'flashcards', 'klik nie zmienia wyboru');
  }
  assert.ok(tile('correction').textContent!.includes('Znajdź błąd w zdaniu i popraw go'));
  assert.ok(tile('translation').textContent!.includes('Przetłumacz zdania na angielski'));
  assert.equal(getAllByTestId('free-practice-soon').length, 2);
  toScope();
  assert.ok(next());
});

test('fokus po wejściu trafia na nagłówek ekranu, po zmianie kroku na nagłówek kroku', () => {
  const { getByRole, next, checked, toScope } = setup();
  const h1 = getByRole('heading', { level: 1 });
  assert.equal(document.activeElement, h1);
  assert.equal(h1.tabIndex, -1);
  assert.ok(h1.compareDocumentPosition(checked()) & 4, 'wybrany rodzaj leży za nagłówkiem');
  toScope();
  assert.equal(document.activeElement, document.getElementById('free-practice-sets-label'));
  assert.ok(next());
});

test('klawiatura w grupie rodzajów: strzałki i Home/End po dostępnych, fokus idzie za wyborem, Tab zostaje przeglądarce', () => {
  const { radios, checked } = setup();
  const mode = () => checked().getAttribute('data-mode');
  fireEvent.keyDown(radios()[0], { key: 'ArrowRight' });
  assert.equal(mode(), 'quiz');
  assert.equal(document.activeElement, checked());
  assert.deepEqual(radios().map((r) => r.tabIndex), [-1, 0, -1, -1, -1]);
  fireEvent.keyDown(checked(), { key: 'ArrowRight' });
  assert.equal(mode(), 'matching');
  fireEvent.keyDown(checked(), { key: 'ArrowRight' });
  assert.equal(mode(), 'flashcards', 'zawinięcie omija kafelki „wkrótce"');
  fireEvent.keyDown(checked(), { key: 'End' });
  assert.equal(mode(), 'matching');
  fireEvent.keyDown(checked(), { key: 'Home' });
  assert.equal(mode(), 'flashcards');
  assert.equal(fireEvent.keyDown(radios()[0], { key: 'ArrowRight' }), false, 'strzałka: preventDefault');
  assert.equal(fireEvent.keyDown(radios()[1], { key: 'Tab' }), true, 'Tab zostaje przeglądarce');
});

test('zakres: wielokrotny wybór natywnymi polami wyboru, licznik zestawów i kart, kolejność wyboru', () => {
  const { rows, box, row, getByTestId, toScope, container } = setup();
  toScope();
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['s1', 's2', 'e1', 'g1', 'g2'], 'szkic pominięty');
  for (const r of rows()) assert.equal(r.querySelector('input')!.type, 'checkbox');
  const counter = () => getByTestId('free-practice-counter');
  assert.equal(counter().textContent, 'Zestawy: 0 · Karty: 0');
  assert.equal(counter().getAttribute('aria-live'), 'polite');

  fireEvent.click(box('s2'));
  fireEvent.click(box('s1'));
  assert.equal(counter().textContent, 'Zestawy: 2 · Karty: 17');
  assert.equal(row('s1').getAttribute('data-checked'), 'true');
  // słownictwo ogólne: liczba kart z wbudowanej listy
  const general = container.querySelector('[data-testid="free-practice-general"]') as HTMLDetailsElement;
  assert.ok(general.textContent!.includes('3 karty'));
  fireEvent.click(box('g1'));
  assert.equal(counter().textContent, 'Zestawy: 3 · Karty: 20');
  fireEvent.click(box('s2'));
  assert.equal(counter().textContent, 'Zestawy: 2 · Karty: 8');
  fireEvent.click(getByTestId('free-practice-clear'));
  assert.equal(counter().textContent, 'Zestawy: 0 · Karty: 0');
});

test('start z kilku zestawów: onStart dostaje wszystkie id w kolejności wyboru i wybrany rodzaj', () => {
  const { box, tile, starts, toScope, next, toStart } = setup();
  fireEvent.click(tile('matching'));
  toScope();
  fireEvent.click(box('s2'));
  fireEvent.click(box('s1'));
  fireEvent.click(next());
  fireEvent.click(next());
  assert.equal(starts.length, 1);
  assert.deepEqual(starts[0], { view: 'flashcard-study', setId: 's2', setIds: ['s2', 's1'], mode: 'matching' });
  assert.ok(toStart);
});

test('pusty zestaw jest wyłączony z komunikatem; liczba kart widoczna z poprawną odmianą', () => {
  const { box, row, toScope } = setup();
  toScope();
  assert.equal(box('e1').disabled, true);
  assert.ok(row('e1').textContent!.includes('Zestaw jest pusty'));
  assert.ok(row('s1').textContent!.includes('5 kart'));
  assert.ok(row('s2').textContent!.includes('12 kart'));
});

test('wyszukiwarka: filtruje listę bez rozróżniania znaków, otwiera słownictwo ogólne, komunikat gdy brak wyników, czyszczenie', () => {
  const { getByTestId, rows, toScope, getByLabelText, container } = setup();
  toScope();
  const search = getByTestId('free-practice-search') as HTMLInputElement;
  assert.equal(search.type, 'search');
  assert.ok(getByLabelText('Szukaj zestawów'));
  fireEvent.change(search, { target: { value: 'podroze' } });
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['s1']);
  fireEvent.change(search, { target: { value: 'ogolne' } });
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['g1', 'g2']);
  assert.equal((container.querySelector('[data-testid="free-practice-general"]') as HTMLDetailsElement).open, true, 'wyniki ze słownictwa ogólnego są widoczne');
  fireEvent.change(search, { target: { value: 'zzzz' } });
  assert.equal(rows().length, 0);
  assert.ok(getByTestId('free-practice-nothing'));
  fireEvent.click(container.querySelector('button[aria-label="Wyczyść wyszukiwanie"]')!);
  assert.equal(search.value, '');
  assert.equal(rows().length, 5);
});

test('zaznaczenie przeżywa wyszukiwanie i powrót do poprzedniego kroku', () => {
  const { box, getByTestId, toScope, prev, next, rows } = setup();
  toScope();
  fireEvent.click(box('s1'));
  fireEvent.change(getByTestId('free-practice-search'), { target: { value: 'lekcja' } });
  assert.equal(getByTestId('free-practice-counter').textContent, 'Zestawy: 1 · Karty: 5', 'licznik liczy też ukryte wiersze');
  fireEvent.click(prev());
  fireEvent.click(next());
  assert.ok(rows().length > 0);
  assert.equal(getByTestId('free-practice-counter').textContent, 'Zestawy: 1 · Karty: 5');
});

test('limit zestawów: po osiągnięciu limitu niewybrane wiersze są wyłączone z komunikatem', () => {
  const many = Array.from({ length: MAX_FREE_PRACTICE_SETS + 2 }, (_, i) => mkSet(`m${i}`, `Zestaw ${i}`));
  const { box, toScope, getByText } = setup({ sets: many });
  toScope();
  for (let i = 0; i < MAX_FREE_PRACTICE_SETS; i++) fireEvent.click(box(`m${i}`));
  assert.equal(box(`m${MAX_FREE_PRACTICE_SETS}`).disabled, true);
  assert.equal(box('m0').disabled, false, 'wybrany można odznaczyć');
  assert.ok(getByText(`Limit zestawów w jednym ćwiczeniu: ${MAX_FREE_PRACTICE_SETS}`));
});

test('quiz potrzebuje min. 4 kart: komunikat i zablokowane „Dalej"; z większą liczbą kart odblokowane', () => {
  const small = [mkSet('a', 'A', { cardCount: 3 }), mkSet('b', 'B', { cardCount: 1 })];
  const { tile, box, next, toScope, getByTestId } = setup({ sets: small });
  fireEvent.click(tile('quiz'));
  toScope();
  assert.equal(getByTestId('free-practice-blocker').textContent, 'Wybierz co najmniej jeden zestaw');
  fireEvent.click(box('a'));
  assert.equal(next().disabled, true);
  assert.equal(getByTestId('free-practice-blocker').textContent, 'Ten rodzaj potrzebuje co najmniej 4 kart');
  fireEvent.click(box('b'));
  assert.equal(next().disabled, false);
});

test('brak zestawów: komunikat i przejście do słownictwa, „Dalej" zablokowane', () => {
  const { getByTestId, calls, getByText, next, toScope, rows } = setup({ sets: [] });
  toScope();
  assert.ok(getByTestId('free-practice-empty'));
  assert.equal(rows().length, 0);
  assert.equal(next().disabled, true);
  fireEvent.click(getByText('Przejdź do słownictwa'));
  assert.equal(calls.vocabulary, 1);
});

test('powrót: z kroku 1 na pulpit, z dalszych kroków o krok wstecz; „Zdania z AI" to osobne wejście, nie rodzaj', () => {
  const { getByTestId, calls, starts, radios, prev, toScope, stepCounter } = setup();
  fireEvent.click(getByTestId('free-practice-sentences'));
  assert.equal(calls.sentences, 1);
  assert.equal(radios().length, 5);
  fireEvent.click(getByTestId('free-practice-back'));
  assert.equal(calls.back, 1);
  toScope();
  fireEvent.click(prev());
  assert.equal(calls.back, 1, 'Wstecz w kroku 2 wraca do kroku 1, nie na pulpit');
  assert.equal(stepCounter(), 'Krok 1 z 3');
  assert.equal(starts.length, 0);
});

test('start nie niesie żadnych pól pracy domowej', () => {
  const { box, toScope, next, starts } = setup();
  toScope();
  fireEvent.click(box('s1'));
  fireEvent.click(next());
  fireEvent.click(next());
  const keys = Object.keys(starts[0]).sort();
  assert.deepEqual(keys, ['mode', 'setId', 'setIds', 'view']);
  assert.ok(!keys.some((k) => /task|homework|status/i.test(k)));
});

test('ekran tłumaczy się na angielski przez i18n (kafelki, kroki, liczniki)', async () => {
  await i18n.changeLanguage('en');
  try {
    const { getByRole, radios, stepCounter, toScope, getByTestId, box } = setup();
    assert.equal(getByRole('heading', { level: 1 }).textContent, 'Free practice');
    assert.deepEqual(
      radios().map((r) => r.querySelector('span:nth-of-type(2)')!.textContent),
      ['Flashcards', 'Quiz', 'Matching', 'Sentence correction', 'Sentence translation'],
    );
    assert.equal(stepCounter(), 'Step 1 of 3');
    toScope();
    fireEvent.click(box('s1'));
    assert.equal(getByTestId('free-practice-counter').textContent, 'Sets: 1 · Cards: 5');
    assert.ok(getByTestId('free-practice-step-scope').textContent!.includes('5 cards'));
  } finally {
    cleanup();
    await i18n.changeLanguage('pl');
  }
});

// --- Animacja wejścia: CSS/WAAPI, reduced-motion ----------------------------------------------

test('stagger: każdy kafelek wchodzi z rosnącym opóźnieniem (WAAPI), przy reduced-motion bez animacji', () => {
  const calls: Array<{ delay: number; duration: number }> = [];
  (dom.window.HTMLElement.prototype as any).animate = function (_k: unknown, o: KeyframeAnimationOptions) {
    calls.push({ delay: Number(o.delay), duration: Number(o.duration) });
    return { cancel() {} };
  };
  (dom.window as any).matchMedia = () => ({ matches: false });
  setup();
  assert.ok(calls.length >= 6, `kafelki + wiersz „Zdania z AI": ${calls.length}`);
  const delays = calls.map((c) => c.delay);
  assert.deepEqual(delays, [...delays].sort((a, b) => a - b));
  assert.ok(delays[1] > delays[0]);
  assert.ok(calls.every((c) => c.duration > 0 && c.duration <= 400));
  cleanup();
  calls.length = 0;
  (dom.window as any).matchMedia = (q: string) => ({ matches: q.includes('reduce') });
  setup();
  assert.equal(calls.length, 0, 'prefers-reduced-motion: reduce → bez animacji');
});

test('ruch: bez bibliotek animacji i drag-and-drop, a każde przejście CSS wyłączane przy reduced-motion', () => {
  for (const file of ['components/practice/FreePracticeScreen.tsx', 'hooks/useStaggerIn.ts']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /gsap|motion\/react|framer-motion|react-dnd|dnd-kit/i, file);
  }
  const src = readFileSync(new URL('../components/practice/FreePracticeScreen.tsx', import.meta.url), 'utf8');
  const transitions = (src.match(/transition-(?:colors|transform)/g) || []).length;
  const reduced = (src.match(/motion-reduce:transition-none/g) || []).length;
  assert.ok(transitions > 0 && reduced === transitions, `${transitions} przejść, ${reduced} z motion-reduce`);
});

test('pasek przycisków przyklejony do dołu z safe-area, pola ≥ 16 px, cele dotykowe ≥ 44 px', () => {
  const src = readFileSync(new URL('../components/practice/FreePracticeScreen.tsx', import.meta.url), 'utf8');
  assert.match(src, /sticky bottom-\[calc\(-1\*env\(safe-area-inset-bottom\)\)\][^"]*pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(src, /type="search"[\s\S]{0,400}text-base/);
  assert.match(src, /min-h-12/);
  assert.match(src, /min-h-14/); // wiersze zestawów
});

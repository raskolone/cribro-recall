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
import type { AnyFreeLaunch } from '../utils/freePractice';
import { MAX_FREE_PRACTICE_SETS, MAX_SENTENCE_SOURCES } from '../utils/freePractice';
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

const lessons = [
  { id: 'l1', title: 'Lekcja 12.10', topic: 'Podróże' },
  { id: 'l2', title: 'Lekcja 19.10', topic: 'Praca' },
  { id: 'l3', title: 'Lekcja 26.10', topic: 'Zdrowie' },
];

const setup = (props: Partial<React.ComponentProps<typeof FreePracticeScreen>> = {}) => {
  const starts: AnyFreeLaunch[] = [];
  const calls = { back: 0, vocabulary: 0 };
  // Domyślnie startujemy od fiszek (zakres = zestawy); testy domyślnego rodzaju podają `initial: undefined`.
  const utils = render(
    <FreePracticeScreen
      sets={sets}
      lessons={lessons}
      initial={{ mode: 'flashcards' }}
      onStart={(launch) => starts.push(launch)}
      onBack={() => calls.back++}
      onOpenVocabulary={() => calls.vocabulary++}
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
  const tab = (key: 'lessons' | 'general' | 'user') => utils.getByTestId(`free-practice-tab-${key}`);
  return { ...utils, starts, calls, radios, checked, tile, rows, row, box, next, prev, stepCounter, toScope, toStart, tab };
};

test('kolejność kroków: 1 rodzaj → 2 zakres → 3 start, z widocznym postępem i powrotem', () => {
  const { stepCounter, next, prev, getByTestId, queryByTestId, container, toScope } = setup({ initial: undefined });
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

test('krok 3 jest dopiero po wyborze zestawu; przycisk zmienia się na „Start" i startuje (fiszki → moduł fiszek)', () => {
  const { box, next, stepCounter, starts, getByTestId, toScope, tab } = setup();
  toScope();
  fireEvent.click(tab('user'));
  fireEvent.click(box('s1'));
  fireEvent.click(next());
  assert.equal(stepCounter(), 'Krok 3 z 3');
  assert.equal(next().textContent, 'Start');
  assert.ok(getByTestId('free-practice-summary').textContent!.includes('Moje słówka'));
  fireEvent.click(next());
  assert.deepEqual(starts, [{ view: 'flashcard-study', setId: 's1', setIds: ['s1'], mode: 'flashcards' }]);
});

test('menu: pięć rodzajów w dwóch sekcjach: Fiszki, Dopasowanie oraz Tłumaczenie, Quiz, Korekta; domyślnie Fiszki, roving tabindex', () => {
  const { radios, checked, container } = setup({ initial: undefined });
  assert.deepEqual(
    radios().map((r) => r.querySelector('[data-testid="tile-title"]')!.textContent),
    ['Fiszki', 'Dopasowanie', 'Tłumaczenie zdań', 'Quiz', 'Korekta zdań'],
  );
  const text = container.textContent!;
  assert.ok(!text.includes('Fiszki Intro') && !text.includes('Pisanie'));
  assert.ok(!text.includes('Wkrótce') && !text.includes('Zdania z AI'), 'żadnych kafelków „wkrótce" ani starego linku');
  assert.equal(checked().getAttribute('data-mode'), 'flashcards');
  assert.deepEqual(radios().map((r) => r.tabIndex), [0, -1, -1, -1, -1]);
});

test('kafelki: każdy ma ikonę (svg), opis i własny akcent; wybrany ma znacznik — nie tylko kolor', () => {
  const { radios, tile } = setup({ initial: undefined });
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

test('korekta i tłumaczenie to pełnoprawne kafelki: aktywne, z opisem, dają się wybrać i prowadzą do zakresu', () => {
  const { tile, checked, toScope, getByTestId } = setup({ initial: undefined });
  for (const mode of ['correction', 'translation']) {
    const el = tile(mode);
    assert.equal(el.getAttribute('aria-disabled'), null, mode);
    assert.ok(!el.textContent!.includes('Wkrótce'));
    fireEvent.click(el);
    assert.equal(checked().getAttribute('data-mode'), mode);
  }
  assert.ok(tile('correction').textContent!.includes('Znajdź błąd w zdaniu i popraw go'));
  assert.ok(tile('translation').textContent!.includes('Przetłumacz zdania na angielski'));
  toScope();
  assert.ok(getByTestId('free-practice-step-scope'));
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

test('klawiatura w grupie rodzajów: strzałki i Home/End po wszystkich pięciu, fokus idzie za wyborem, Tab zostaje przeglądarce', () => {
  const { radios, checked } = setup({ initial: undefined });
  const mode = () => checked().getAttribute('data-mode');
  fireEvent.keyDown(radios()[0], { key: 'ArrowRight' });
  assert.equal(mode(), 'matching');
  assert.equal(document.activeElement, checked());
  assert.deepEqual(radios().map((r) => r.tabIndex), [-1, 0, -1, -1, -1]);
  fireEvent.keyDown(checked(), { key: 'ArrowRight' });
  assert.equal(mode(), 'translation');
  fireEvent.keyDown(checked(), { key: 'End' });
  assert.equal(mode(), 'correction');
  fireEvent.keyDown(checked(), { key: 'ArrowRight' });
  assert.equal(mode(), 'flashcards', 'zawinięcie na pierwszy');
  fireEvent.keyDown(checked(), { key: 'ArrowLeft' });
  assert.equal(mode(), 'correction', 'zawinięcie na ostatni');
  fireEvent.keyDown(checked(), { key: 'Home' });
  assert.equal(mode(), 'flashcards');
  assert.equal(fireEvent.keyDown(radios()[0], { key: 'ArrowRight' }), false, 'strzałka: preventDefault');
  assert.equal(fireEvent.keyDown(radios()[1], { key: 'Tab' }), true, 'Tab zostaje przeglądarce');
});

test('zakres: wielokrotny wybór w zakładkach (Z moich lekcji, Gotowe zestawy, Moje zestawy), licznik i czyszczenie', () => {
  const { rows, box, row, getByTestId, toScope, tab } = setup();
  toScope();
  // Domyślna zakładka: Z moich lekcji (s2)
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['s2']);
  for (const r of rows()) assert.equal(r.querySelector('input')!.type, 'checkbox');
  const counter = () => getByTestId('free-practice-counter');
  assert.equal(counter().textContent, 'Zestawy: 0 · Karty: 0');
  assert.equal(counter().getAttribute('aria-live'), 'polite');

  // Wybór z lekcji
  fireEvent.click(box('s2'));
  assert.equal(counter().textContent, 'Zestawy: 1 · Karty: 12');

  // Przełączenie na Moje zestawy (s1, e1)
  fireEvent.click(tab('user'));
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['s1', 'e1']);
  fireEvent.click(box('s1'));
  assert.equal(counter().textContent, 'Zestawy: 2 · Karty: 17');
  assert.equal(row('s1').getAttribute('data-checked'), 'true');

  // Przełączenie na Gotowe zestawy (g1, g2)
  fireEvent.click(tab('general'));
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['g1', 'g2']);
  fireEvent.click(box('g1'));
  assert.equal(counter().textContent, 'Zestawy: 3 · Karty: 20');

  // Powrót do Z moich lekcji i odznaczenie s2
  fireEvent.click(tab('lessons'));
  fireEvent.click(box('s2'));
  assert.equal(counter().textContent, 'Zestawy: 2 · Karty: 8');

  // Wyczyść wybór
  fireEvent.click(getByTestId('free-practice-clear'));
  assert.equal(counter().textContent, 'Zestawy: 0 · Karty: 0');
});

test('start z kilku zestawów: onStart dostaje wszystkie id w kolejności wyboru i wybrany rodzaj', () => {
  const { box, tile, starts, toScope, next, toStart, tab } = setup();
  fireEvent.click(tile('matching'));
  toScope();
  fireEvent.click(box('s2'));
  fireEvent.click(tab('user'));
  fireEvent.click(box('s1'));
  fireEvent.click(next());
  fireEvent.click(next());
  assert.equal(starts.length, 1);
  assert.deepEqual(starts[0], { view: 'flashcard-study', setId: 's2', setIds: ['s2', 's1'], mode: 'matching' });
  assert.ok(toStart);
});

test('pusty zestaw jest wyłączony z komunikatem; liczba kart widoczna z poprawną odmianą', () => {
  const { box, row, toScope, tab } = setup();
  toScope();
  fireEvent.click(tab('user'));
  assert.equal(box('e1').disabled, true);
  assert.ok(row('e1').textContent!.includes('Zestaw jest pusty'));
  assert.ok(row('s1').textContent!.includes('5 kart'));
  fireEvent.click(tab('lessons'));
  assert.ok(row('s2').textContent!.includes('12 kart'));
});

test('wyszukiwarka: filtruje listę w zakładkach, komunikat gdy brak wyników, czyszczenie', () => {
  const { getByTestId, rows, toScope, getByLabelText, container, tab } = setup();
  toScope();
  const search = getByTestId('free-practice-search') as HTMLInputElement;
  assert.equal(search.type, 'search');
  assert.ok(getByLabelText('Szukaj zestawów'));

  // Szukanie w Moich zestawach
  fireEvent.change(search, { target: { value: 'podroze' } });
  fireEvent.click(tab('user'));
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['s1']);

  // Szukanie w Gotowych zestawach
  fireEvent.change(search, { target: { value: 'ogolne' } });
  fireEvent.click(tab('general'));
  assert.deepEqual(rows().map((r) => r.getAttribute('data-set-id')), ['g1', 'g2']);

  // Brak wyników
  fireEvent.change(search, { target: { value: 'zzzz' } });
  assert.equal(rows().length, 0);
  assert.ok(getByTestId('free-practice-nothing'));

  // Czyszczenie wyszukiwarki
  fireEvent.click(container.querySelector('button[aria-label="Wyczyść wyszukiwanie"]')!);
  assert.equal(search.value, '');
});

test('zaznaczenie przeżywa wyszukiwanie i powrót do poprzedniego kroku', () => {
  const { box, getByTestId, toScope, prev, next, tab } = setup();
  toScope();
  fireEvent.click(tab('user'));
  fireEvent.click(box('s1'));
  fireEvent.change(getByTestId('free-practice-search'), { target: { value: 'lekcja' } });
  assert.equal(getByTestId('free-practice-counter').textContent, 'Zestawy: 1 · Karty: 5', 'licznik liczy też ukryte wiersze');
  fireEvent.click(prev());
  fireEvent.click(next());
  assert.equal(getByTestId('free-practice-counter').textContent, 'Zestawy: 1 · Karty: 5');
});

test('tworzenie własnego zestawu: modal waliduje formularz, zapisuje i zaznacza nowy zestaw', async () => {
  let createdPayload: { name: string; pairs: any[] } | null = null;
  const mockCreate = async (name: string, pairs: any[]) => {
    createdPayload = { name, pairs };
    return 'new-set-123';
  };
  const { getByTestId, toScope, queryByTestId, tab } = setup({ onCreateSet: mockCreate });
  toScope();
  fireEvent.click(tab('user'));
  fireEvent.click(getByTestId('free-practice-create-set'));
  assert.ok(getByTestId('custom-set-name-input'));
  // Przycisk zapisu wyłączony przy pustym formularzu
  assert.equal((getByTestId('custom-set-submit') as HTMLButtonElement).disabled, true);
  fireEvent.change(getByTestId('custom-set-name-input'), { target: { value: 'Zwroty w hotelu' } });
  fireEvent.change(getByTestId('custom-set-words-input'), { target: { value: 'room - pokój\nkey - klucz' } });
  assert.ok(getByTestId('custom-set-parsed-count').textContent!.includes('2'));
  assert.equal((getByTestId('custom-set-submit') as HTMLButtonElement).disabled, false);
  fireEvent.click(getByTestId('custom-set-submit'));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(queryByTestId('custom-set-name-input'), null, 'modal zamknięty po zapisie');
  assert.equal(createdPayload?.name, 'Zwroty w hotelu');
  assert.equal(createdPayload?.pairs.length, 2);
  assert.deepEqual(createdPayload?.pairs[0], { term: 'room', definition: 'pokój' });
  assert.deepEqual(createdPayload?.pairs[1], { term: 'key', definition: 'klucz' });
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

test('powrót: z kroku 1 na pulpit, z dalszych kroków o krok wstecz; nie ma osobnego wejścia „Zdania z AI"', () => {
  const { getByTestId, queryByTestId, calls, starts, radios, prev, toScope, stepCounter } = setup();
  assert.equal(queryByTestId('free-practice-sentences'), null);
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
  const { box, toScope, next, starts, tab } = setup();
  toScope();
  fireEvent.click(tab('user'));
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
    const { getByRole, radios, stepCounter, toScope, getByTestId, box, tab } = setup({ initial: { mode: 'translation' } });
    assert.equal(getByRole('heading', { level: 1 }).textContent, 'Free practice');
    assert.deepEqual(
      radios().map((r) => r.querySelector('[data-testid="tile-title"]')!.textContent),
      ['Flashcards', 'Matching', 'Sentence translation', 'Quiz', 'Sentence correction'],
    );
    assert.equal(stepCounter(), 'Step 1 of 3');
    toScope();
    fireEvent.click(tab('user'));
    fireEvent.click(box('s1'));
    assert.equal(getByTestId('free-practice-counter').textContent, 'Sources: 1 of 5');
    assert.ok(getByTestId('free-practice-step-scope').textContent!.includes('5 cards'));
    assert.ok(getByTestId('free-practice-step-scope').textContent!.includes('From my lessons'));
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
  assert.ok(calls.length >= 5, `pięć kafelków: ${calls.length}`);
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

// --- Zdania z AI (Tłumaczenie, Korekta): zakres = zestawy + lekcje ----------------------------

const lessonRows = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[data-testid="free-practice-lesson"]'));
const lessonBox = (container: HTMLElement, id: string) =>
  lessonRows(container).find((r) => r.getAttribute('data-lesson-id') === id)!.querySelector('input') as HTMLInputElement;

test('tłumaczenie: zakres to zestawy i lekcje, licznik źródeł, wyszukiwarka obejmuje oba', () => {
  const { toScope, getByTestId, container, box, rows, getByLabelText, tab } = setup({ initial: { mode: 'translation' } });
  toScope();
  assert.ok(getByTestId('free-practice-lessons'));
  assert.deepEqual(lessonRows(container).map((r) => r.getAttribute('data-lesson-id')), ['l1', 'l2', 'l3']);
  const counter = () => getByTestId('free-practice-counter');
  assert.equal(counter().textContent, 'Źródła: 0 z 5');
  fireEvent.click(tab('user'));
  fireEvent.click(box('s1'));
  fireEvent.click(tab('lessons'));
  fireEvent.click(lessonBox(container, 'l2'));
  assert.equal(counter().textContent, 'Źródła: 2 z 5');
  const search = getByLabelText('Szukaj zestawów i lekcji') as HTMLInputElement;
  fireEvent.change(search, { target: { value: 'zdrowie' } });
  assert.deepEqual(lessonRows(container).map((r) => r.getAttribute('data-lesson-id')), ['l3']);
  assert.equal(rows().length, 0);
  assert.equal(counter().textContent, 'Źródła: 2 z 5', 'licznik liczy też ukryte wiersze');
});

test('fiszki, quiz i dopasowanie nie pokazują lekcji — zakres tylko zestawy', () => {
  for (const mode of ['flashcards', 'quiz', 'matching']) {
    const { toScope, queryByTestId, getByTestId } = setup({ initial: { mode: mode as any } });
    toScope();
    assert.equal(queryByTestId('free-practice-lessons'), null, mode);
    assert.match(getByTestId('free-practice-counter').textContent!, /^Zestawy: \d+ · Karty: \d+$/, mode);
    cleanup();
  }
});

test('zdania z AI: bez wyboru „Dalej" zablokowane z komunikatem; wystarczy sama lekcja', () => {
  const { toScope, next, getByTestId, container } = setup({ initial: { mode: 'translation' } });
  toScope();
  assert.equal(next().disabled, true);
  assert.equal(getByTestId('free-practice-blocker').textContent, 'Wybierz co najmniej jedno źródło');
  fireEvent.click(lessonBox(container, 'l1'));
  assert.equal(next().disabled, false);
});

test('zdania z AI: łączny limit źródeł (zestawy + lekcje) — po osiągnięciu reszta wyłączona z komunikatem', () => {
  const many = Array.from({ length: 6 }, (_, i) => mkSet(`m${i}`, `Zestaw ${i}`));
  const { toScope, box, container, getByText, tab } = setup({ initial: { mode: 'translation' }, sets: many });
  toScope();
  fireEvent.click(tab('user'));
  for (let i = 0; i < 3; i++) fireEvent.click(box(`m${i}`));
  fireEvent.click(tab('lessons'));
  fireEvent.click(lessonBox(container, 'l1'));
  fireEvent.click(lessonBox(container, 'l2'));
  fireEvent.click(tab('user'));
  assert.equal(box('m3').disabled, true, 'zestaw ponad limit');
  fireEvent.click(tab('lessons'));
  assert.equal(lessonBox(container, 'l3').disabled, true, 'lekcja ponad limit');
  fireEvent.click(tab('user'));
  assert.equal(box('m0').disabled, false, 'wybrane można odznaczyć');
  assert.ok(getByText(`Limit źródeł w jednym ćwiczeniu: ${MAX_SENTENCE_SOURCES}`));
  fireEvent.click(tab('lessons'));
  fireEvent.click(lessonBox(container, 'l1'));
  fireEvent.click(tab('user'));
  assert.equal(box('m3').disabled, false, 'po zwolnieniu miejsca znów można dodać');
});

test('start tłumaczenia: generator dostaje zakres i format, korekty — format correction; żadnych pól pracy domowej', () => {
  const { toScope, box, next, starts, container, tab } = setup({ initial: { mode: 'translation' } });
  toScope();
  fireEvent.click(tab('user'));
  fireEvent.click(box('s1'));
  fireEvent.click(tab('lessons'));
  fireEvent.click(lessonBox(container, 'l3'));
  fireEvent.click(next());
  assert.ok(container.textContent!.includes('Lekcja 26.10') && container.textContent!.includes('Moje słówka'));
  fireEvent.click(next());
  assert.deepEqual(starts[0], { view: 'free-sentences', mode: 'translation', format: 'typing', setIds: ['s1'], lessonIds: ['l3'], topics: [], count: 5 });
  cleanup();

  const second = setup({ initial: { mode: 'correction' } });
  second.toScope();
  fireEvent.click(second.tab('user'));
  fireEvent.click(second.box('s1'));
  second.toStart();
  assert.equal((second.starts[0] as any).format, 'correction');
  assert.equal((second.starts[0] as any).count, 5);
  assert.ok(!Object.keys(second.starts[0]).some((key) => /task|homework|status/i.test(key)));
});

test('start zdań z AI: zmiana suwaka liczby zdań w kroku 3 przekazuje wybraną wartość w onStart', () => {
  const { toScope, box, next, starts, container, tab } = setup({ initial: { mode: 'translation' } });
  toScope();
  fireEvent.click(tab('user'));
  fireEvent.click(box('s1'));
  fireEvent.click(next()); // idź do kroku 3

  const incBtn = container.querySelector('[data-testid="sentence-count-increment"]') as HTMLButtonElement;
  assert.ok(incBtn);
  fireEvent.click(incBtn); // 5 -> 6
  fireEvent.click(incBtn); // 6 -> 7

  fireEvent.click(next()); // kliknij Start
  assert.equal((starts[0] as any).count, 7);
});

test('skrót z innego ekranu: menu otwiera się na kroku zakresu z wybranym tłumaczeniem i zakresem', () => {
  const { stepCounter, getByTestId, container } = setup({ initial: { mode: 'translation', step: 'scope', lessonIds: ['l2'], setIds: ['s1'] } });
  assert.equal(stepCounter(), 'Krok 2 z 3');
  assert.ok(getByTestId('free-practice-step-scope'));
  assert.equal(getByTestId('free-practice-counter').textContent, 'Źródła: 2 z 5');
  assert.equal(lessonBox(container, 'l2').checked, true);
});

test('menu nie zawiera żadnej informacji o pracy domowej', () => {
  const { container, toScope } = setup({ initial: undefined });
  assert.doesNotMatch(container.textContent!, /prac\w* domow|homework/i);
  toScope();
  assert.doesNotMatch(container.textContent!, /prac\w* domow|homework/i);
});

test('zdania z AI: zestawy „z lekcji" nie dublują grupy Lekcje; w fiszkach zostają na liście', () => {
  const sentencesView = setup({ initial: { mode: 'translation' } });
  sentencesView.toScope();
  assert.equal(sentencesView.rows().some((r) => r.getAttribute('data-set-id') === 's2'), false, 's2 = zestaw z lekcji');
  assert.ok(sentencesView.getByTestId('free-practice-lessons'));
  assert.ok(sentencesView.container.textContent!.includes('Zestawy'), 'nagłówek grupy zestawów, gdy są dwie grupy');
  cleanup();
  const study = setup();
  study.toScope();
  assert.equal(study.rows().some((r) => r.getAttribute('data-set-id') === 's2'), true);
  cleanup();
  // bez wczytanych lekcji zestawy z lekcji zostają, żeby kursant miał z czego wybierać
  const noLessons = setup({ initial: { mode: 'translation' }, lessons: [] });
  noLessons.toScope();
  assert.equal(noLessons.rows().some((r) => r.getAttribute('data-set-id') === 's2'), true);
});

// --- Układ menu i sekcje (R1) -------------------------------------------------------------------

test('układ menu: Sekcja 1 rozgrzewka (Fiszki z plakietką polecane na start, Dopasowanie) i Sekcja 2 trudniejsza praktyka (Tłumaczenie, Quiz, Korekta)', () => {
  const { container, tile } = setup({ initial: undefined });
  assert.ok(container.textContent!.includes('Rozpocznij tutaj – rozgrzewka'));
  assert.ok(container.textContent!.includes('Trudniejsza praktyka'));
  assert.ok(container.textContent!.includes('Najlepiej po rozgrzewce — utrwal wiedzę w praktyce'));
  assert.ok(tile('flashcards').textContent!.includes('Polecane na start'));
  assert.equal(tile('matching').textContent!.includes('Polecane na start'), false);
});

test('własny temat: brak pola tematów i chipów w UI w żadnym trybie', () => {
  for (const mode of ['translation', 'correction', 'flashcards', 'quiz', 'matching']) {
    const { toScope, queryByTestId } = setup({ initial: { mode: mode as any } });
    toScope();
    assert.equal(queryByTestId('free-practice-topics'), null, `mode ${mode} nie ma tematów`);
    assert.equal(queryByTestId('free-practice-topic-input'), null);
    cleanup();
  }
});

test('dostępność i cele dotykowe: kafelki rozgrzewki min-h-36/40, cele dotykowe ≥ 44 px, bez odwołań do pracy domowej', () => {
  const src = readFileSync(new URL('../components/practice/FreePracticeScreen.tsx', import.meta.url), 'utf8');
  assert.match(src, /min-h-36 sm:min-h-40/);
  assert.match(src, /min-h-24/);
  const { container, toScope } = setup({ initial: undefined });
  toScope();
  assert.doesNotMatch(container.textContent!, /prac\w* domow|homework/i);
});

// --- Szybki start z „Co dalej?" (od razu krok 3) -------------------------------------------------

import { quickStartInitial } from '../utils/freePractice';

const quick = (mode: 'translation' | 'correction' = 'translation', words = ['hesitate', 'run out of', 'give it a go']) =>
  setup({ initial: quickStartInitial(mode, ['s1', 'g1'], words) });

test('szybki start: ekran otwiera się w kroku 3 z rodzajem, zestawami (chipy tylko do odczytu) i liczbą słów słabych', () => {
  const { stepCounter, getByTestId, queryByTestId, container, next } = quick();
  assert.equal(stepCounter(), 'Krok 3 z 3');
  assert.ok(getByTestId('free-practice-step-start'));
  assert.ok(!queryByTestId('free-practice-step-type') && !queryByTestId('free-practice-step-scope'), 'kroki 1 i 2 pominięte');
  const summary = getByTestId('free-practice-summary');
  assert.match(summary.textContent!, /Tłumaczenie zdań/);
  assert.match(summary.textContent!, /Moje słówka/);
  assert.match(summary.textContent!, /Ogólne A1/);
  assert.equal(summary.querySelectorAll('input').length, 0, 'zestawy jako chipy tylko do odczytu');
  assert.equal(getByTestId('free-practice-focus-count').textContent, 'Słowa do powtórzenia (3)');
  assert.equal(next().textContent, 'Generuj', 'duży przycisk „Generuj" zamiast „Start"');
  assert.match(container.querySelector('h2#free-practice-start-label')!.textContent!, /Ustaw liczbę zdań i generuj/);
});

test('szybki start: suwak 1–20, domyślnie 5; „Generuj" startuje z count i focusWords (ten sam kształt startu, bez pól pracy domowej)', () => {
  const { getByTestId, starts, next, container } = quick('correction');
  const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
  assert.equal(slider.min, '1');
  assert.equal(slider.max, '20');
  assert.equal(slider.value, '5');
  assert.equal(getByTestId('sentence-count-value').textContent, '5 zdań');
  fireEvent.change(slider, { target: { value: '12' } });
  assert.equal(getByTestId('sentence-count-value').textContent, '12 zdań');
  fireEvent.change(slider, { target: { value: '99' } });
  assert.equal(slider.value, '20', 'górna granica 20');
  fireEvent.change(slider, { target: { value: '0' } });
  assert.equal(slider.value, '1', 'dolna granica 1');
  fireEvent.change(slider, { target: { value: '8' } });
  fireEvent.click(next());
  assert.equal(starts.length, 1);
  assert.deepEqual(starts[0], {
    view: 'free-sentences',
    mode: 'correction',
    format: 'correction',
    setIds: ['s1', 'g1'],
    lessonIds: [],
    topics: [],
    count: 8,
    focusWords: ['hesitate', 'run out of', 'give it a go'],
  });
  assert.ok(!Object.keys(starts[0]).some((key) => /task|homework|status/i.test(key)));
});

test('szybki start: domyślnie count 5 w żądaniu, a initial.count ustawia suwak (z przycięciem do 1–20)', () => {
  const { starts, next } = quick();
  fireEvent.click(next());
  assert.equal((starts[0] as { count: number }).count, 5);
  cleanup();
  const preset = setup({ initial: { ...quickStartInitial('translation', ['s1']), count: 14 } });
  assert.equal(preset.getByTestId('sentence-count-value').textContent, '14 zdań');
  cleanup();
  const clamped = setup({ initial: { ...quickStartInitial('translation', ['s1']), count: 500 } });
  assert.equal(clamped.getByTestId('sentence-count-value').textContent, '20 zdań');
});

test('szybki start: „Zmień zakres" wraca do kroku 2 z zachowanym wyborem, a „Dalej" — do kroku 3 ze słowami słabymi', () => {
  const { getByTestId, stepCounter, box, next, getByText, tab } = quick();
  fireEvent.click(getByTestId('free-practice-change-scope'));
  assert.equal(stepCounter(), 'Krok 2 z 3');
  assert.ok(getByTestId('free-practice-step-scope'));
  fireEvent.click(tab('user'));
  assert.equal(box('s1').checked, true, 'wybrany zestaw zachowany');
  fireEvent.click(tab('general'));
  assert.equal(box('g1').checked, true, 'drugi wybrany zestaw zachowany');
  assert.equal(getByTestId('free-practice-counter').textContent, 'Źródła: 2 z 5');
  fireEvent.click(box('g2'));
  fireEvent.click(next());
  assert.equal(stepCounter(), 'Krok 3 z 3');
  assert.equal(getByTestId('free-practice-focus-count').textContent, 'Słowa do powtórzenia (3)', 'słowa słabe przetrwały zmianę zakresu');
  assert.equal(next().textContent, 'Generuj');
  assert.ok(getByText('Ogólne A2'), 'dodany zestaw widoczny w podsumowaniu');
});

test('szybki start: „Wróć do menu" wraca do kroku 1 z zachowanym rodzajem i zestawami; „Pulpit" wychodzi z ekranu', () => {
  const { getByTestId, stepCounter, checked, prev, toScope, calls, box, tab } = quick('correction');
  assert.equal(prev().textContent, 'Wróć do menu');
  fireEvent.click(prev());
  assert.equal(stepCounter(), 'Krok 1 z 3');
  assert.equal(checked().getAttribute('data-mode'), 'correction', 'rodzaj zachowany');
  toScope();
  fireEvent.click(tab('user'));
  assert.equal(box('s1').checked, true, 'wybór zestawów zachowany');
  fireEvent.click(getByTestId('free-practice-back'));
  assert.equal(calls.back, 1);
});

test('szybki start: bez zakresu „Generuj" jest wyłączone z komunikatem; zwykły przepływ zostaje przy „Start" i bez „Zmień zakres"', () => {
  const empty = setup({ initial: quickStartInitial('translation', [], ['hesitate']) });
  assert.equal(empty.next().disabled, true);
  assert.match(empty.container.textContent!, /Wybierz co najmniej jedno źródło/);
  cleanup();
  const normal = setup({ initial: { mode: 'translation', step: 'start', setIds: ['s1'] } });
  assert.equal(normal.next().textContent, 'Start');
  assert.ok(!normal.queryByTestId('free-practice-change-scope'));
  assert.ok(!normal.queryByTestId('free-practice-focus-count'));
  assert.equal(normal.prev().textContent, 'Wstecz');
});

test('szybki start działa tylko dla zdań z AI — dla quizu flaga jest ignorowana', () => {
  const { next, queryByTestId } = setup({ initial: { mode: 'quiz', step: 'start', quick: true, setIds: ['s1'], focusWords: ['x'] } });
  assert.equal(next().textContent, 'Start');
  assert.ok(!queryByTestId('free-practice-change-scope'));
});

test('szybki start: cele ≥ 44 px, ekran bez odwołań do pracy domowej, teksty po angielsku', async () => {
  const { container, getByTestId } = quick();
  assert.doesNotMatch(container.textContent!, /prac\w* domow|homework/i);
  assert.match(getByTestId('free-practice-change-scope').className, /min-h-11/);
  assert.match(getByTestId('free-practice-next').className, /min-h-12/);
  await i18n.changeLanguage('en');
  try {
    cleanup();
    const en = quick();
    assert.equal(en.next().textContent, 'Generate');
    assert.equal(en.getByTestId('free-practice-focus-count').textContent, 'Words to review (3)');
    assert.equal(en.getByTestId('free-practice-change-scope').textContent, 'Change scope');
    assert.equal(en.prev().textContent, 'Back to menu');
  } finally {
    cleanup();
    await i18n.changeLanguage('pl');
  }
});

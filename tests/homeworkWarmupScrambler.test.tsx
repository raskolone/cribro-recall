// Test integracyjny (render + interakcja użytkownika) dla HomeworkWarmupScrambler —
// jedyny komponent React w projekcie testowany na poziomie DOM, więc jsdom jest
// ustawiany ręcznie tutaj, a nie globalnie, żeby nie obciążać pozostałych
// (czysto logicznych) testów node:test.
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

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import i18n from '../i18n';
import HomeworkWarmupScrambler from '../components/dashboard/HomeworkWarmupScrambler';

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});

import { buildWarmupRounds } from '../utils/warmupRounds';
import { countWords } from '../utils/warmupChunks';
import { distortionsOf } from '../utils/warmupTileSet';

// Runda 1 (8 słów → 3 kawałki + dystraktor = 4 kafelki) wyraźnie większa od rundy 2
// (5 słów → 2 kawałki, ew. z dystraktorem) — scenariusz z hotfixa: pula przelicza się przy
// zmianie `currentIndex`, a stary reset w osobnym useEffect uruchamiał się PO renderze, więc
// pierwszy render mniejszej rundy 2 czytał jeszcze identyfikatory kafelków z większej rundy 1
// i kafelek wypadał poza zakres.
const sentences = [
  { chunks: ['I', 'always', 'try', 'to', 'speak', 'English', 'quite', 'slowly'], correctSentence: 'I always try to speak English quite slowly', polishHint: 'Pierwsze zdanie.' },
  { chunks: ['My', 'sister', 'likes', 'green', 'tea'], correctSentence: 'My sister likes green tea', polishHint: 'Drugie zdanie.' },
];

const rounds = buildWarmupRounds(sentences);
const ROUND_1_CHUNKS = rounds[0].chunks;
const ROUND_2_CHUNKS = rounds[1].chunks;

/** Klika w dostępny (nieużyty) kafelek o danym tekście. */
const pick = (getAllByTestId: (id: string) => HTMLElement[], text: string) => {
  const tile = getAllByTestId('warmup-bank-tile').find((el) => el.textContent === text && !(el as HTMLButtonElement).disabled);
  assert.ok(tile, `kafelek "${text}" powinien być dostępny`);
  fireEvent.click(tile!);
};

const renderScrambler = (props: Record<string, unknown> = {}) =>
  render(React.createElement(HomeworkWarmupScrambler, { sentences, onComplete: () => {}, onSkip: () => {}, ...props } as any));

test('kafelki to całe kawałki (≥ 2 słowa), nie pojedyncze słowa — także gdy dane zawierają same słowa', () => {
  assert.ok(ROUND_1_CHUNKS.length >= 2 && ROUND_1_CHUNKS.length <= 5);
  assert.equal(ROUND_1_CHUNKS.join(' '), 'I always try to speak English quite slowly');
  const { getAllByTestId } = renderScrambler();
  const texts = getAllByTestId('warmup-bank-tile').map((el) => el.textContent!);
  assert.ok(texts.every((text) => countWords(text) >= 2), `kafelki: ${texts.join(' | ')}`);
  cleanup();
});

test('przejście z większej rundy 1 do mniejszej rundy 2 nie crashuje i pokazuje wyłącznie kafelki rundy 2', () => {
  const { container, getAllByTestId } = renderScrambler();
  for (const chunk of ROUND_1_CHUNKS) pick(getAllByTestId, chunk);

  const nextButtons1 = getAllByTestId('warmup-next-button');
  assert.equal(nextButtons1.length, 1);
  assert.equal((nextButtons1[0] as HTMLButtonElement).disabled, false);
  fireEvent.click(nextButtons1[0]);

  const round2Texts = getAllByTestId('warmup-bank-tile').map((el) => el.textContent!).sort();
  const expected = [...ROUND_2_CHUNKS, ...rounds[1].distractors].sort();
  assert.deepEqual(round2Texts, expected);
  for (const chunk of ROUND_1_CHUNKS) assert.ok(!round2Texts.includes(chunk) || rounds[1].distractors.includes(chunk), 'żadnych kafelków rundy 1 poza dystraktorem');
  assert.equal(within(container).queryAllByTestId('warmup-selected-tile').length, 0, 'odpowiedź wyczyszczona');
  cleanup();
});

test('przycisk "Dalej" jest aktywny również przy wyniku "close" (te same frazy, zła kolejność)', () => {
  const { getAllByTestId } = renderScrambler({ sentences: [sentences[0]] });
  for (const chunk of [...ROUND_1_CHUNKS].reverse()) pick(getAllByTestId, chunk);
  const nextButtons = getAllByTestId('warmup-next-button');
  assert.equal(nextButtons.length, 1);
  assert.equal((nextButtons[0] as HTMLButtonElement).disabled, false);
  cleanup();
});

test('STABILNOŚĆ: kolejność i liczba kafelków puli po wyborze są identyczne, wybrany zostaje jako puste miejsce', () => {
  const { getAllByTestId, container } = renderScrambler();
  const before = getAllByTestId('warmup-bank-tile');
  const textsBefore = before.map((el) => el.textContent);
  const target = ROUND_1_CHUNKS[0];
  pick(getAllByTestId, target);
  const after = getAllByTestId('warmup-bank-tile');
  assert.deepEqual(after.map((el) => el.textContent), textsBefore, 'ta sama kolejność i liczba kafelków');
  const used = after.find((el) => el.getAttribute('data-used') === 'true')!;
  assert.equal(used.textContent, target, 'wybrany kafelek zostaje w puli na swoim miejscu');
  assert.equal(after.indexOf(used), textsBefore.indexOf(target));
  assert.equal((used as HTMLButtonElement).disabled, true);
  assert.equal(used.getAttribute('aria-hidden'), 'true', 'puste miejsce nie jest ogłaszane czytnikom');
  assert.match(used.className, /\binvisible\b/);
  assert.match(used.parentElement!.className, /border-dashed/, 'puste miejsce zaznaczone obrysem');
  // cofnięcie przywraca kafelek bez zmiany układu
  fireEvent.click(getAllByTestId('warmup-selected-tile')[0]);
  assert.deepEqual(getAllByTestId('warmup-bank-tile').map((el) => el.textContent), textsBefore);
  assert.equal(getAllByTestId('warmup-bank-tile').some((el) => el.getAttribute('data-used') === 'true'), false);
  assert.ok(container);
  cleanup();
});

test('STABILNOŚĆ: ponowny render rodzica z nową (równoważną) tożsamością task/sentences nie tasuje puli na nowo', () => {
  const orders: string[] = [];
  const { getAllByTestId, rerender } = renderScrambler({ task: { type: 'translation' } });
  const snapshot = () => getAllByTestId('warmup-bank-tile').map((el) => el.textContent).join('|');
  orders.push(snapshot());
  pick(getAllByTestId, ROUND_1_CHUNKS[1]);
  for (let i = 0; i < 25; i++) {
    rerender(
      React.createElement(HomeworkWarmupScrambler, {
        sentences: sentences.map((x) => ({ ...x })),
        task: { type: 'translation', id: 'nowy-obiekt' },
        onComplete: () => {},
        onSkip: () => {},
      } as any)
    );
    orders.push(snapshot());
  }
  assert.equal(new Set(orders).size, 1, 'kolejność puli ani razu się nie zmieniła');
  assert.equal(getAllByTestId('warmup-selected-tile').length, 1, 'wybór kursanta przetrwał ponowne renderowanie');
  assert.equal(getAllByTestId('warmup-selected-tile')[0].textContent, ROUND_1_CHUNKS[1]);
  cleanup();
});

test('STABILNOŚĆ: strefa odpowiedzi ma stałą wysokość — niewidoczny miernik niesie pełną odpowiedź, a pula nigdy nie startuje w poprawnej kolejności', () => {
  const { getByTestId, getAllByTestId } = renderScrambler();
  const sizer = getByTestId('warmup-answer-sizer');
  assert.equal(sizer.getAttribute('aria-hidden'), 'true');
  assert.match(sizer.className, /\binvisible\b/);
  assert.deepEqual([...sizer.children].map((c) => c.textContent).sort(), [...ROUND_1_CHUNKS].sort());
  const zone = getByTestId('warmup-answer-zone');
  assert.match(zone.className, /\bgrid\b/);
  assert.match(zone.className, /min-h-\[4\.5rem\]/);
  const texts = getAllByTestId('warmup-bank-tile').map((el) => el.textContent);
  assert.notDeepEqual(texts.filter((t) => ROUND_1_CHUNKS.includes(t!)), ROUND_1_CHUNKS, 'pula nie jest od razu rozwiązaniem');
  cleanup();
});

test('dystraktor to zniekształcony kawałek TEGO SAMEGO zdania, najwyżej jeden, zawsze jego brak w odpowiedzi', () => {
  const { getAllByTestId } = renderScrambler();
  const texts = getAllByTestId('warmup-bank-tile').map((el) => el.textContent!);
  const extra = texts.filter((t) => !ROUND_1_CHUNKS.includes(t));
  assert.equal(extra.length, 1);
  assert.ok(!ROUND_2_CHUNKS.includes(extra[0]), 'nie jest kawałkiem innej rundy');
  assert.ok(ROUND_1_CHUNKS.some((c) => distortionsOf(c).includes(extra[0])), 'zniekształcenie kawałka tej samej rundy');
  assert.equal(texts.length, ROUND_1_CHUNKS.length + 1);
  // ułożenie samych kawałków odpowiedzi (bez dystraktora) → poprawnie, a dystraktor zostaje w puli
  for (const chunk of ROUND_1_CHUNKS) pick(getAllByTestId, chunk);
  assert.equal(getAllByTestId('warmup-next-button').length, 1);
  assert.equal(getAllByTestId('warmup-bank-tile').filter((el) => el.getAttribute('data-used') !== 'true').length, 1);
  cleanup();
});

test('wybór dystraktora zamiast kawałka odpowiedzi → nietrafione, bez kary; Resetuj i cofnięcie działają', () => {
  const { getAllByTestId, queryByTestId } = renderScrambler();
  const distractor = getAllByTestId('warmup-bank-tile').map((el) => el.textContent!).find((t) => !ROUND_1_CHUNKS.includes(t))!;
  pick(getAllByTestId, distractor);
  for (const chunk of ROUND_1_CHUNKS.slice(1)) pick(getAllByTestId, chunk);
  assert.ok(queryByTestId('warmup-incorrect'), 'delikatna wskazówka zamiast kary');
  assert.ok(!queryByTestId('warmup-next-button'), 'bez przejścia dalej, dopóki nie ułoży poprawnie');
  fireEvent.click(getAllByTestId('warmup-selected-tile')[0]);
  assert.ok(!queryByTestId('warmup-incorrect'), 'cofnięcie kafelka zdejmuje wskazówkę');
  cleanup();
});

test('lekka forma: bez punktów, można pominąć (dwa przyciski), znacznik „Niepunktowane", kafelki ≥ 44 px na dotyku', () => {
  const skips: number[] = [];
  const { getByText, getAllByText, container } = renderScrambler({ onSkip: () => skips.push(1) });
  assert.ok(getByText(/Niepunktowane/));
  fireEvent.click(getByText('Pomiń rozgrzewkę'));
  fireEvent.click(getAllByText(/bez rozgrzewki/)[0]);
  assert.equal(skips.length, 2);
  assert.doesNotMatch(container.textContent!, /punkt(?!owane)|%|kara|błąd/i);
  cleanup();
});

test('ruch tylko CSS i wyłączany przy reduced-motion; bez skalowania kafelków i bez bibliotek animacji', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/dashboard/HomeworkWarmupScrambler.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /gsap|motion\/react|framer-motion|react-dnd|dnd-kit/i);
  assert.doesNotMatch(src, /hover:scale|active:scale|\bscale-\d|animate-pulse|shuffle\(\)|Math\.random\(\) - 0\.5/);
  const transitions = (src.match(/(?<![:\w-])(?:transition-(?!none)[a-z\[\]]+|animate-in)/g) || []).length;
  const reduced = (src.match(/motion-reduce:(?:transition-none|animate-none)/g) || []).length;
  assert.ok(transitions > 0 && reduced >= transitions, `${transitions} przejść, ${reduced} wariantów motion-reduce`);
});

test('wszystkie teksty komponentu mają wpis w pl.json i en.json (i18n, nie literały)', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
  const pl = JSON.parse(read('pl.json')) as Record<string, string>;
  const en = JSON.parse(read('en.json')) as Record<string, string>;
  const src = read('components/dashboard/HomeworkWarmupScrambler.tsx');
  const keys = new Set([...src.matchAll(/\bt\('([^']+)'/g)].map((m) => m[1]));
  for (const key of ['Ułóż zdanie', 'Ułóż zdanie po angielsku z kafelków.', 'Rozpocznij pracę domową']) keys.add(key);
  assert.ok(keys.size >= 18, `klucze: ${keys.size}`);
  for (const key of keys) {
    assert.ok(key in pl, `pl: ${key}`);
    assert.ok(key in en && en[key].trim() !== '', `en: ${key}`);
    assert.doesNotMatch(key.replace(/\{\{[^}]+\}\}/g, ''), /:/, `klucz z dwukropkiem: ${key}`);
  }
});

test('STABILNOŚĆ: wiersz z „Resetuj" ma stałą wysokość równą celowi dotykowemu — pojawienie się przycisku nie przesuwa puli (pomiar w przeglądarce: +20 px)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/dashboard/HomeworkWarmupScrambler.tsx', import.meta.url), 'utf8');
  const row = src.slice(src.indexOf("t('Twoja odpowiedź')") - 400, src.indexOf("t('Twoja odpowiedź')"));
  assert.match(row, /min-h-6 pointer-coarse:min-h-11/, 'wiersz nagłówka strefy odpowiedzi rezerwuje 44 px na dotyku');
  const reset = src.slice(src.indexOf('onClick={handleReset}'), src.indexOf('onClick={handleReset}') + 400);
  assert.match(reset, /pointer-coarse:min-h-11/, 'przycisk Resetuj ma cel 44 px — i wiersz już go mieści');
});

test('pula nigdy nie zaczyna się od ułożonej odpowiedzi — także z dystraktorem między kafelkami (40 losowych sesji)', () => {
  let solvedAtStart = 0;
  for (let i = 0; i < 40; i++) {
    const { getAllByTestId, unmount } = renderScrambler();
    const order = getAllByTestId('warmup-bank-tile').map((el) => el.textContent!).filter((text) => ROUND_1_CHUNKS.includes(text));
    if (order.length === ROUND_1_CHUNKS.length && order.every((text, idx) => text === ROUND_1_CHUNKS[idx])) solvedAtStart++;
    unmount();
  }
  assert.equal(solvedAtStart, 0);
});

test('kawałki lektora bez końcowej kropki zostają kawałkami lektora (nie są zastępowane podziałem zdania)', () => {
  const { getAllByTestId } = render(
    React.createElement(HomeworkWarmupScrambler, {
      sentences: [],
      task: { warmup: [{ chunks: ['I have to', 'meet the deadline', 'by tomorrow morning'], correctSentence: 'I have to meet the deadline by tomorrow morning.', polishTranslation: 'Muszę dotrzymać terminu do jutra rano.' }] },
      onComplete: () => {},
      onSkip: () => {},
    } as any)
  );
  const texts = getAllByTestId('warmup-bank-tile').map((el) => el.textContent).sort();
  assert.deepEqual(texts, ['I have to', 'by tomorrow morning', 'meet the deadline']);
  cleanup();
});

// ── H3: niezmiennik zestawu kafelków, kolory kafelków, zbędny kafelek po sprawdzeniu ──

const HAMMOCK_PL = 'Chciałbym mieć hamak na moim przestronnym balkonie.';
const hammockItem = { chunks: ['I would like', 'to have a hammock', 'on my spacious balcony.'], correctSentence: 'I would like to have a hammock on my spacious balcony.', polishTranslation: HAMMOCK_PL };
const furnitureItem = { chunks: ['We chose', 'simple furniture', 'for our small,', 'cramped apartment.'], correctSentence: 'We chose simple furniture for our small, cramped apartment.', polishTranslation: 'Wybraliśmy proste meble do naszego małego, ciasnego mieszkania.' };

const tileClasses = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => /^(bg-tile-|border-tile-line-)/.test(c)).sort().join(' ');

test('H3: ćwiczenie z rozjechaną parą (objaw z telefonu) jest pomijane: bez kafelków, bez zapisu wyniku', () => {
  const skips: number[] = [];
  const attempts: unknown[] = [];
  const { queryAllByTestId, container } = renderScrambler({
    sentences: [],
    task: { warmup: [{ ...furnitureItem, polishTranslation: HAMMOCK_PL }, hammockItem] },
    onSkip: () => skips.push(1),
    onAttemptResult: (a: unknown) => attempts.push(a),
  });
  assert.equal(queryAllByTestId('warmup-bank-tile').length, 0, 'nie pokazujemy ćwiczenia');
  assert.ok(!container.textContent!.includes('We chose'));
  assert.ok(skips.length >= 1, 'rozgrzewka przechodzi dalej bez błędu');
  assert.equal(attempts.length, 0, 'nic nie zapisano');
  cleanup();
});

test('H3: zestaw kafelków zawsze = kawałki zdania + najwyżej jeden zniekształcony kawałek tego samego zdania', () => {
  const { getAllByTestId, getByTestId } = renderScrambler({ sentences: [], task: { warmup: [furnitureItem, hammockItem] } });
  // runda 1 = zdanie o meblach
  assert.equal(getByTestId('warmup-source').textContent, furnitureItem.polishTranslation);
  const texts = getAllByTestId('warmup-bank-tile').map((el) => el.textContent!);
  assert.deepEqual([...texts].sort(), [...furnitureItem.chunks].sort(), 'tylko kawałki tego zdania (brak bezpiecznego kandydata na dystraktor)');
  cleanup();
});

test('H3: kafelek zachowuje kolor po przeniesieniu do odpowiedzi i po zwróceniu na listę; kolory nie zdradzają dystraktora', () => {
  const { getAllByTestId, queryByTestId } = renderScrambler({ sentences: [], task: { warmup: [hammockItem, furnitureItem] } });
  const bankTiles = getAllByTestId('warmup-bank-tile');
  const colorOf = new Map(bankTiles.map((el) => [el.textContent!, tileClasses(el)]));
  assert.ok([...colorOf.values()].every((c) => /bg-tile-\d border-tile-line-\d/.test(c)));
  const [first] = bankTiles.map((el) => el.textContent!);
  pick(getAllByTestId, first);
  const selected = getAllByTestId('warmup-selected-tile');
  assert.equal(tileClasses(selected[0]), colorOf.get(first), 'ten sam kolor w polu odpowiedzi');
  fireEvent.click(selected[0]);
  const back = getAllByTestId('warmup-bank-tile').find((el) => el.textContent === first && el.getAttribute('data-used') !== 'true')!;
  assert.equal(tileClasses(back), colorOf.get(first), 'ten sam kolor po zwróceniu');
  // przed sprawdzeniem nic w DOM nie oznacza dystraktora
  assert.equal(queryByTestId('warmup-extra-tile'), null);
  assert.ok(getAllByTestId('warmup-bank-tile').every((el) => !el.hasAttribute('data-distractor')));
  cleanup();
});

test('H3: po sprawdzeniu pokazujemy, który kafelek był zbędny (tekstem)', () => {
  const { getAllByTestId, getByTestId } = renderScrambler({ sentences: [], task: { warmup: [hammockItem, furnitureItem] } });
  const extra = rounds_of(hammockItem).distractors[0];
  assert.ok(extra, 'ćwiczenie z hamakiem ma dystraktor');
  for (const chunk of hammockItem.chunks) pick(getAllByTestId, chunk);
  assert.ok(getByTestId('warmup-extra-tile').textContent!.includes(extra));
  cleanup();
});

function rounds_of(item: typeof hammockItem) {
  return buildWarmupRounds([], { warmup: [item] })[0];
}

// Po zapisie sesji (ostatnia karta) ekran „Co dalej?" znikał po ~0,5 s i zaczynała się nowa sesja „0 z N":
// tożsamość funkcji z FlashcardContext zmienia się przy każdym renderze dostawcy, a efekty ładowania kart
// zależały od niej i wstawiały do stanu nową tablicę o tej samej treści.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sameCardList } from '../utils/cardListEquality';

const src = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const card = (id: string, term = id, definition = `${id}-def`) => ({ id, term, definition });

test('sameCardList: ta sama talia (id, hasło, definicja, kolejność) = ta sama; każda różnica = inna', () => {
  const a = [card('1'), card('2')];
  assert.equal(sameCardList(a, a), true);
  assert.equal(sameCardList(a, [card('1'), card('2')]), true, 'nowa tablica o tej samej treści');
  assert.equal(sameCardList([], []), true);
  assert.equal(sameCardList(a, [card('2'), card('1')]), false, 'inna kolejność');
  assert.equal(sameCardList(a, [card('1')]), false, 'inna długość');
  assert.equal(sameCardList(a, [card('1'), card('2', 'zmienione')]), false, 'zmienione hasło');
  assert.equal(sameCardList(a, [card('1'), card('2', '2', 'inna definicja')]), false, 'zmieniona definicja');
  assert.equal(sameCardList([], [card('1')]), false);
});

test('ekran nauki podstawia do stanu poprzednią tablicę, gdy talia się nie zmieniła (oba warianty: jeden i wiele zestawów)', () => {
  assert.equal((code.match(/setCards\(prev => \(sameCardList\(prev, [a-zA-Z.]+\) \? prev : [a-zA-Z.]+\)\)/g) || []).length, 2);
  assert.doesNotMatch(code, /setCards\((merged\.cards|loadedCards)\)/, 'surowe podstawienie nowej tablicy wraca do błędu');
});

test('efekt ładowania kolejki fiszek nie zależy od tożsamości getProgress z kontekstu', () => {
  assert.match(code, /const getProgressRef = useRef\(getProgress\);\s*getProgressRef\.current = getProgress;/);
  assert.match(code, /\}, \[initialCards, setId, multi\]\);/);
  assert.doesNotMatch(code, /\[initialCards, setId, multi, getProgress\]/);
});

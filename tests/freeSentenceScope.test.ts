// Zakres „zdań z AI": zbieranie słów z zestawów i lekcji, skróty z innych ekranów, wyszukiwarka lekcji.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCOPE_WORDS,
  filterLessonsByQuery,
  pruneLessonSelection,
  resolveFreeScopeWords,
  resolveLessonShortcut,
  shortcutKind,
} from '../utils/freeSentenceScope';

const keep = <T,>(items: T[]) => items; // deterministycznie: bez tasowania

const lessons = [
  { id: 'v1', title: 'Lekcja 2026-10-05', topic: 'Podróże', lessonRecordId: 'rec1', vocabularyText: 'book a flight\ncheck in; boarding pass, gate' },
  { id: 'v2', title: 'Lekcja 2026-10-12', topic: 'Żywność', lessonRecordId: 'rec2', vocabularyText: 'recipe\nleftovers', approvedItems: ['recipe'] },
  { id: 'generated-rec3', title: 'Stara lekcja', topic: 'Praca', lessonRecordId: 'rec3', vocabularyText: 'deadline' },
];

test('słowa z zestawów: termin z tłumaczeniem w nawiasie, bez powtórzeń i pustych', async () => {
  const cards: Record<string, Array<{ term: string; definition?: string }>> = {
    a: [{ term: 'apple', definition: 'jabłko' }, { term: '  ', definition: 'x' }, { term: 'pear' }],
    b: [{ term: 'apple', definition: 'jabłko' }, { term: 'plum', definition: 'śliwka' }],
  };
  const words = await resolveFreeScopeWords(
    { setIds: ['a', 'b'], lessonIds: [] },
    { getFlashcards: async (id) => cards[id] ?? [], lessons, shuffle: keep },
  );
  assert.deepEqual(words, ['apple (jabłko)', 'pear', 'plum (śliwka)']);
});

test('słowa z lekcji: rozdzielane liniami, przecinkami i średnikami; zatwierdzone pozycje mają pierwszeństwo', async () => {
  const words = await resolveFreeScopeWords(
    { setIds: [], lessonIds: ['v1', 'v2', 'generated-rec3', 'nieistniejaca'] },
    { getFlashcards: async () => [], lessons, shuffle: keep },
  );
  assert.deepEqual(words, ['book a flight', 'check in', 'boarding pass', 'gate', 'recipe', 'deadline']);
});

test('zestawy i lekcje razem; limit słów na zapytanie; zestaw, który się nie wczytał, nie psuje reszty', async () => {
  const big = Array.from({ length: 40 }, (_, i) => ({ term: `w${i}` }));
  const words = await resolveFreeScopeWords(
    { setIds: ['big', 'broken'], lessonIds: ['v1'] },
    {
      getFlashcards: async (id) => {
        if (id === 'broken') throw new Error('offline');
        return big;
      },
      lessons,
      shuffle: keep,
    },
  );
  assert.equal(words.length, MAX_SCOPE_WORDS);
  assert.equal(words[0], 'w0');
  const onlyLesson = await resolveFreeScopeWords(
    { setIds: ['broken'], lessonIds: ['v1'] },
    { getFlashcards: async () => { throw new Error('x'); }, lessons, shuffle: keep },
  );
  assert.deepEqual(onlyLesson, ['book a flight', 'check in', 'boarding pass', 'gate']);
});

test('pusty zakres → brak słów (generator zostaje przy kontekście lekcji i tematach)', async () => {
  assert.deepEqual(await resolveFreeScopeWords({ setIds: [], lessonIds: [] }, { getFlashcards: async () => [], lessons }), []);
});

test('skrót lesson_/vocab-/set-: id zestawu, id zapisu lekcji i generated- trafiają w ten sam wybieralny wiersz', () => {
  assert.equal(resolveLessonShortcut('lesson_v1', lessons), 'v1');
  assert.equal(resolveLessonShortcut('lesson_rec2', lessons), 'v2');
  assert.equal(resolveLessonShortcut('vocab-v2', lessons), 'v2');
  assert.equal(resolveLessonShortcut('lesson_rec3', lessons), 'generated-rec3');
  assert.equal(resolveLessonShortcut('lesson_nie-ma', lessons), null);
  assert.equal(shortcutKind('lesson_abc'), 'lesson');
  assert.equal(shortcutKind('vocab-abc'), 'lesson');
  assert.equal(shortcutKind('abc'), 'set');
  assert.equal(shortcutKind('gen-a1'), 'set');
});

test('wyszukiwarka lekcji ignoruje wielkość liter i polskie znaki; pruning usuwa nieistniejące', () => {
  assert.deepEqual(filterLessonsByQuery(lessons, 'ZYWNOSC').map((l) => l.id), ['v2']);
  assert.deepEqual(filterLessonsByQuery(lessons, 'podroze').map((l) => l.id), ['v1']);
  assert.equal(filterLessonsByQuery(lessons, '  ').length, 3);
  assert.deepEqual(pruneLessonSelection(['v1', 'zniknela', 'v2'], lessons), ['v1', 'v2']);
});

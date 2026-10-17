import { dom } from './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthContext } from '../context/AuthContext';
import { SettingsProvider } from '../context/SettingsContext';
import { FlashcardContext } from '../context/FlashcardContext';
import FlashcardSetsScreen from '../components/flashcards/FlashcardSetsScreen';
import { deduplicateFlashcardSets } from '../utils/lessonCanonicalKey';
import type { FlashcardSet, StudySession } from '../types';

// Bez zapisanego języka LanguageProvider bierze język przeglądarki (jsdom: en-US), a testy sprawdzają polskie teksty.
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
dom.window.localStorage.setItem('app_language', 'pl');

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});
afterEach(cleanup);

const lessonIds = [
  { rec: 'lesson-1785854172295', date: '2026-08-04', topic: 'Codzienne nawyki i jedzenie', cards: 19, n: 1 },
  { rec: '7ff9e99b-2628-4502-80b2-5b8834284636', date: '2026-09-11', topic: 'Digital Tools', cards: 5, n: 2 },
  { rec: 'lesson-1792227283563-569854', date: '2026-10-16', topic: 'Present Simple', cards: 14, n: 3 },
];

/** Jak w danych Moniki: każda lekcja jest i w /sets (set-lesson-…), i jako wirtualna (lesson_…); createdAt rośnie od NAJSTARSZEJ. */
const dbSets = lessonIds.map(
  (l, i) =>
    ({ id: `set-lesson-${l.rec}`, userId: 'u1', title: l.topic, isLessonVocabulary: true, cardCount: l.cards, createdAt: `2026-10-17T08:0${i}:00.000Z`, lessonDate: l.date, lessonTopic: l.topic }) as any as FlashcardSet
);
const virtualSets = lessonIds.map(
  (l) =>
    ({ id: `lesson_${l.rec}`, userId: 'u1', title: l.topic, isLessonVocabulary: true, cardCount: l.cards, createdAt: l.date, lessonDate: l.date, lessonTopic: l.topic }) as any as FlashcardSet
);
const ownSet = { id: 'set-own-1', userId: 'u1', title: 'Mój zestaw', cardCount: 4, createdAt: '2026-09-14T07:48:39.569Z' } as any as FlashcardSet;
const numbers = new Map(lessonIds.map((l) => [l.rec, l.n]));
const known = lessonIds.map((l) => ({ id: l.rec, date: l.date, topic: l.topic }));
const sets = deduplicateFlashcardSets([...dbSets, ownSet], virtualSets, known, numbers);

const session = (setId: string, scorePercent: number): StudySession =>
  ({ id: `s-${setId}`, userId: 'u1', setId, mode: 'flashcards', scorePercent, totalCards: 10, correctCount: 9, completedAt: '2026-10-11T10:00:00.000Z' }) as StudySession;

const setup = (
  overrides: { sets?: FlashcardSet[]; sessions?: StudySession[]; embedded?: boolean; handlers?: Partial<React.ComponentProps<typeof FlashcardSetsScreen>> } = {}
) => {
  const flashcards: any = {
    sets: overrides.sets ?? sets,
    sessions: overrides.sessions ?? [],
    createSet: async () => 'new-set',
    deleteSet: async () => {},
    getFlashcards: async () => [{ id: 'c1', term: 'apple', definition: 'jabłko' }],
  };
  return render(
    <LanguageProvider>
      <AuthContext.Provider value={{ user: { id: 'u1', dismissedNotifications: [] } } as any}>
        <FlashcardContext.Provider value={flashcards}>
          <SettingsProvider>
          <FlashcardSetsScreen
            embedded={overrides.embedded ?? true}
            onStudySet={() => {}}
            onEditSet={() => {}}
            onStatsSet={() => {}}
            onNavigate={() => {}}
            {...overrides.handlers}
          />
          </SettingsProvider>
        </FlashcardContext.Provider>
      </AuthContext.Provider>
    </LanguageProvider>
  );
};

// Siatka dobiera kolumny do szerokości kontenera (auto-fill), nie okna.
const GRID = '.grid[class*="auto-fill"]';

test('tryb osadzony: bez własnego nagłówka strony, obie sekcje i pasek narzędzi', () => {
  const { container, getByText } = setup();
  assert.equal(container.querySelector('h1'), null);
  getByText(/Słownictwo z lekcji/);
  getByText(/Słownictwo prywatne/);
  getByText(/Stwórz nowy zestaw/);
  getByText('Mój zestaw');
});

test('samodzielny widok nadal ma nagłówek „Moje Listy Słów”', () => {
  const { container } = setup({ embedded: false });
  assert.match(container.querySelector('h1')!.textContent!, /Moje Listy Słów/);
});

test('pary aliasów → jedna pozycja na lekcję, od najnowszej lekcji (mimo odwrotnego createdAt)', () => {
  const { getAllByRole } = setup();
  const titles = getAllByRole('heading', { level: 3 }).map((h) => h.textContent!.trim());
  const lessonTitles = titles.filter((t) => t !== 'Mój zestaw');
  assert.deepEqual(lessonTitles, ['Present Simple', 'Digital Tools', 'Codzienne nawyki i jedzenie']);
});

test('domyślnie siatka; przełącznik pokazuje listę i wraca', () => {
  const { container, getByText } = setup();
  assert.ok(container.querySelector(GRID), 'siatka kart');
  fireEvent.click(getByText('☰'));
  assert.equal(container.querySelector(GRID), null);
  fireEvent.click(getByText('⊞'));
  assert.ok(container.querySelector(GRID));
});

test('akcje zestawu z lekcji: Ucz się, Ćwicz w zdaniach, podgląd i statystyki — przyciski ≥ 40 px', async () => {
  const calls: string[] = [];
  const { getAllByText, getAllByTitle, findByText } = setup({
    handlers: {
      onStudySet: (id) => calls.push(`study:${id}`),
      onStatsSet: (id) => calls.push(`stats:${id}`),
      onNavigate: (v, extra) => calls.push(`${v}:${extra?.setId}`),
    },
  });
  fireEvent.click(getAllByText(/Ucz się|Study/)[0]);
  fireEvent.click(getAllByTitle('Ćwicz w zdaniach AI')[0]);
  fireEvent.click(getAllByTitle('Statystyki')[0]);
  const id = 'set-lesson-lesson-1792227283563-569854';
  assert.deepEqual(calls, [`study:${id}`, `ai-generator:${id}`, `stats:${id}`]);
  const preview = getAllByTitle('Podgląd')[0];
  assert.match(preview.className, /h-10 w-10/);
  assert.match(getAllByTitle('Statystyki')[0].className, /h-10 w-10/);
  fireEvent.click(preview);
  await findByText('apple');
});

test('Opanowanie liczy sesje zapisane pod aliasem (wirtualne ID przy zestawie z bazy)', () => {
  const { container } = setup({ sessions: [session('lesson_7ff9e99b-2628-4502-80b2-5b8834284636', 70)] });
  assert.match(container.textContent!, /70%/);
});

test('pusty stan: bez zestawów pokazuje zachętę do stworzenia pierwszej listy', () => {
  const { container } = setup({ sets: [] });
  assert.match(container.textContent!, /Stwórz swoją pierwszą listę słów/);
});

test('wejścia: powiadomienie i pusty stan Ćwiczeń dowolnych → flashcard-sets → zakładka „Słownictwo”; powrót z nauki do niej', () => {
  const dashboard = read('components/dashboard/Dashboard.tsx');
  const today = read('components/dashboard/TodayScreen.tsx');
  const notifications = read('components/dashboard/StudentNotifications.tsx');
  assert.match(notifications, /type === 'set' \? 'flashcard-sets'/);
  assert.match(dashboard, /onOpenVocabulary=\{\(\) => handleNavigate\('flashcard-sets'\)\}/);
  // widok flashcard-sets kursanta to TodayScreen otwarty na zakładce słownictwa
  assert.match(dashboard, /<TodayScreen \{\.\.\.studentPanelProps\} initialResourceTab="vocabulary" \/>/);
  // zakładka jest osobnym MIEJSCEM panelu (wstecz przeglądarki, F5), a powrót z nauki przeżywa przeładowanie
  assert.match(dashboard, /onVocabularyOpenChange: \(open: boolean\)/);
  assert.match(dashboard, /STUDY_RETURN_KEY/);
  assert.match(today, /useState<string \| null>\(initialResourceTab \? 'resources' : null\)/);
  assert.match(today, /<FlashcardSetsScreen embedded \{\.\.\.vocabulary\} \/>/);
  // nauka z zakładki wraca do niej; edycja i statystyki już wracały do flashcard-sets
  assert.match(dashboard, /returnTo: 'flashcard-sets'/);
  assert.match(dashboard, /onBack=\{\(\) => handleNavigate\(studyReturnView\)\}/);
});

test('nie ma drugiej kopii: mini-lista, wzór na Opanowanie z VOCAB-DUP-3 i stara flaga usunięte', () => {
  for (const gone of ['components/dashboard/StudentVocabularyTab.tsx', 'utils/vocabularyTab.ts', 'components/dashboard/StudentVocabPreview.tsx']) {
    assert.throws(() => read(gone), `${gone} powinien nie istnieć`);
  }
  assert.doesNotMatch(read('components/dashboard/TodayScreen.tsx'), /SHOW_STUDENT_VOCABULARY_MODULE/);
});

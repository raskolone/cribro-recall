// „Ćwiczenia dowolne" — logika bez UI oraz gwarancja, że ścieżka startu nie dotyka prac domowych.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_FREE_PRACTICE_MODE,
  MAX_SENTENCE_SOURCES,
  MAX_SENTENCE_TOPICS,
  MAX_TOPIC_LENGTH,
  addTopic,
  canAddTopic,
  normalizeTopic,
  removeTopic,
  SENTENCE_MODES,
  buildFreeLaunch,
  freeSentencesLaunch,
  isSentenceMode,
  sentenceFormatFor,
  sentenceSourceCount,
  sentenceStartBlocker,
  shortcutInitial,
  FREE_PRACTICE_STEPS,
  FREE_PRACTICE_TYPES,
  MAX_FREE_PRACTICE_SETS,
  STUDY_MODES,
  filterSetsByQuery,
  freePracticeLaunch,
  groupFreePracticeSets,
  isSetSelectable,
  nextFreePracticeMode,
  nextStep,
  previousStep,
  pruneSelection,
  setCardCount,
  startBlocker,
  stepNumber,
  summarizeSelection,
  toggleSetSelection,
} from '../utils/freePractice';
import { mergeSetCards, splitSessionBySet } from '../utils/multiSetSession';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const pl = JSON.parse(read('pl.json')) as Record<string, string>;
const en = JSON.parse(read('en.json')) as Record<string, string>;

test('menu ma pięć rodzajów w dwóch sekcjach: Fiszki, Dopasowanie (rozgrzewka) oraz Tłumaczenie, Quiz, Korekta (trudniejsza)', () => {
  assert.deepEqual(
    FREE_PRACTICE_TYPES.map((type) => type.mode),
    ['flashcards', 'matching', 'translation', 'quiz', 'correction'],
  );
  assert.deepEqual(
    FREE_PRACTICE_TYPES.map((type) => type.titleKey),
    ['Fiszki', 'Dopasowanie', 'Tłumaczenie zdań', 'Quiz', 'Korekta zdań'],
  );
  assert.equal(FREE_PRACTICE_TYPES[0].recommended, true, 'Fiszki są polecane na start');
});

test('„Fiszki Intro" i „Pisanie" zniknęły z menu, ale tryby zostają w module fiszek (używa ich Moje słownictwo)', () => {
  const modes = FREE_PRACTICE_TYPES.map((type) => type.mode as string);
  assert.ok(!modes.includes('intro') && !modes.includes('writing'));
  const titles = FREE_PRACTICE_TYPES.map((type) => type.titleKey);
  assert.ok(!titles.includes('Fiszki Intro') && !titles.includes('Pisanie'));
  const src = read('components/flashcards/FlashcardStudyScreen.tsx');
  assert.match(src, /type StudyMode = [^;]*'intro'[^;]*;/);
  assert.match(src, /type StudyMode = [^;]*'writing'[^;]*;/);
  assert.match(src, /selectedMode === 'intro'/);
  assert.match(src, /selectedMode === 'writing'/);
});

test('wszystkie rodzaje są aktywne: fiszki/quiz/dopasowanie to tryby modułu fiszek, tłumaczenie i korekta to zdania z AI', () => {
  const src = read('components/flashcards/FlashcardStudyScreen.tsx');
  const union = src.match(/type StudyMode = ([^;]+);/)![1].split('|').map((p) => p.trim().replace(/'/g, ''));
  for (const mode of STUDY_MODES) assert.ok(union.includes(mode), mode);
  assert.deepEqual([...STUDY_MODES].sort(), ['flashcards', 'matching', 'quiz'].sort());
  assert.deepEqual([...SENTENCE_MODES], ['translation', 'correction']);
  assert.equal(new Set(FREE_PRACTICE_TYPES.map((type) => type.mode)).size, FREE_PRACTICE_TYPES.length);
  assert.deepEqual([...STUDY_MODES, ...SENTENCE_MODES].sort(), FREE_PRACTICE_TYPES.map((t) => t.mode).sort());
  // żadnych kafelków „wkrótce"
  for (const type of FREE_PRACTICE_TYPES) assert.ok(!('available' in type), type.mode);
  // każdy rodzaj ma własną ikonę i akcent z tokenów motywu
  assert.equal(new Set(FREE_PRACTICE_TYPES.map((type) => type.icon)).size, FREE_PRACTICE_TYPES.length);
  for (const type of FREE_PRACTICE_TYPES) assert.match(type.accent, /^(primary|info|accent-2|warn)$/);
});

test('domyślny rodzaj to pierwszy na liście: fiszki (polecane na start)', () => {
  assert.equal(DEFAULT_FREE_PRACTICE_MODE, 'flashcards');
  assert.equal(FREE_PRACTICE_TYPES[0].mode, DEFAULT_FREE_PRACTICE_MODE);
  assert.ok(isSentenceMode('translation') && isSentenceMode('correction') && !isSentenceMode('quiz'));
  assert.equal(sentenceFormatFor('translation'), 'typing', 'dawne „Sprawdź się"');
  assert.equal(sentenceFormatFor('correction'), 'correction', 'dawne „Napraw zdanie"');
});

test('start niesie wyłącznie widok nauki fiszek, zestawy i tryb — zero pól pracy domowej', () => {
  const launch = freePracticeLaunch('quiz', ['set-1']);
  assert.deepEqual(launch, { view: 'flashcard-study', setId: 'set-1', setIds: ['set-1'], mode: 'quiz' });
  assert.deepEqual(Object.keys(launch).sort(), ['mode', 'setId', 'setIds', 'view']);
  assert.deepEqual(freePracticeLaunch('flashcards', ['a', 'b', 'c']).setIds, ['a', 'b', 'c']);
  assert.equal(freePracticeLaunch('flashcards', ['a', 'b']).setId, 'a', 'setId = pierwszy wybrany');
  for (const type of FREE_PRACTICE_TYPES) {
    const keys = Object.keys(freePracticeLaunch(type.mode, ['x']));
    assert.ok(!keys.some((key) => /task|homework|status/i.test(key)), `${type.mode}: ${keys.join(',')}`);
  }
});

test('zestawy: własne i z lekcji osobno od słownictwa ogólnego, szkice pominięte, kolejność zachowana', () => {
  const sets = [
    { id: 'a', title: 'A' },
    { id: 'g1', title: 'G1', isGeneral: true },
    { id: 'd', title: 'Szkic', isDraft: true },
    { id: 'b', title: 'B', isLessonVocabulary: true },
    { id: 'g2', title: 'G2', isGeneral: true },
    { id: 'gd', title: 'Szkic ogólny', isGeneral: true, isDraft: true },
  ];
  const { own, general } = groupFreePracticeSets(sets);
  assert.deepEqual(own.map((set) => set.id), ['a', 'b']);
  assert.deepEqual(general.map((set) => set.id), ['g1', 'g2']);
  assert.deepEqual(groupFreePracticeSets([]), { own: [], general: [] });
});

test('klawiatura w grupie rodzajów: strzałki cyklicznie po wszystkich rodzajach, Home/End, reszta zostaje przeglądarce', () => {
  assert.equal(nextFreePracticeMode('flashcards', 'ArrowRight'), 'matching');
  assert.equal(nextFreePracticeMode('flashcards', 'ArrowDown'), 'matching');
  assert.equal(nextFreePracticeMode('matching', 'ArrowLeft'), 'flashcards');
  assert.equal(nextFreePracticeMode('matching', 'ArrowUp'), 'flashcards');
  assert.equal(nextFreePracticeMode('flashcards', 'ArrowLeft'), 'correction', 'zawinięcie na ostatni');
  assert.equal(nextFreePracticeMode('correction', 'ArrowRight'), 'flashcards', 'zawinięcie na pierwszy');
  assert.equal(nextFreePracticeMode('correction', 'Home'), 'flashcards');
  assert.equal(nextFreePracticeMode('flashcards', 'End'), 'correction');
  for (const key of ['Enter', ' ', 'Tab', 'a', 'Escape']) assert.equal(nextFreePracticeMode('flashcards', key), null, key);
});

test('kroki: 1 rodzaj → 2 zakres → 3 start, bez wyjścia poza krańce', () => {
  assert.deepEqual([...FREE_PRACTICE_STEPS], ['type', 'scope', 'start']);
  assert.deepEqual(FREE_PRACTICE_STEPS.map(stepNumber), [1, 2, 3]);
  assert.equal(nextStep('type'), 'scope');
  assert.equal(nextStep('scope'), 'start');
  assert.equal(nextStep('start'), 'start');
  assert.equal(previousStep('start'), 'scope');
  assert.equal(previousStep('type'), 'type');
});

const mk = (id: string, title: string, over: Record<string, unknown> = {}) => ({ id, title, cardCount: 5, ...over });

test('liczba kart: cardCount, a dla słownictwa ogólnego długość wbudowanej listy; pusty zestaw nie jest do wyboru', () => {
  assert.equal(setCardCount(mk('a', 'A', { cardCount: 7 })), 7);
  assert.equal(setCardCount({ id: 'g', title: 'G', flashcards: [1, 2, 3] }), 3);
  assert.equal(setCardCount({ id: 'x', title: 'X' }), 0);
  assert.equal(isSetSelectable(mk('a', 'A')), true);
  assert.equal(isSetSelectable(mk('a', 'A', { cardCount: 0 })), false, 'pusty zestaw spadłby na generowanie AI w getFlashcards');
  assert.equal(isSetSelectable(mk('a', 'A', { isDraft: true })), false);
});

test('wielokrotny wybór: dodaje i zdejmuje, zachowuje kolejność, respektuje limit', () => {
  let sel: string[] = [];
  sel = toggleSetSelection(sel, 'a');
  sel = toggleSetSelection(sel, 'b');
  sel = toggleSetSelection(sel, 'c');
  assert.deepEqual(sel, ['a', 'b', 'c']);
  assert.deepEqual(toggleSetSelection(sel, 'b'), ['a', 'c']);
  assert.deepEqual(sel, ['a', 'b', 'c'], 'nie mutuje wejścia');
  const full = Array.from({ length: MAX_FREE_PRACTICE_SETS }, (_, i) => `s${i}`);
  assert.deepEqual(toggleSetSelection(full, 'extra'), full, 'powyżej limitu nowy zestaw nie wchodzi');
  assert.equal(toggleSetSelection(full, 's3').length, MAX_FREE_PRACTICE_SETS - 1, 'zdjąć zawsze można');
});

test('wyszukiwarka: bez wielkości liter i polskich znaków, po tytule, temacie i opisie', () => {
  const list = [
    mk('1', 'Podróże i wakacje'),
    mk('2', 'Lekcja 4', { lessonTopic: 'Żywność' }),
    mk('3', 'Biznes', { description: 'Spotkania w pracy' }),
  ];
  assert.deepEqual(filterSetsByQuery(list, 'PODROZE').map((x) => x.id), ['1']);
  assert.deepEqual(filterSetsByQuery(list, 'zywnosc').map((x) => x.id), ['2']);
  assert.deepEqual(filterSetsByQuery(list, 'praca').map((x) => x.id), [], 'tylko dokładna podfraza');
  assert.deepEqual(filterSetsByQuery(list, 'w pracy').map((x) => x.id), ['3']);
  assert.deepEqual(filterSetsByQuery(list, '   ').map((x) => x.id), ['1', '2', '3'], 'puste zapytanie = wszystko');
  assert.deepEqual(filterSetsByQuery(list, 'xyz'), []);
});

test('licznik: liczba wybranych zestawów i suma kart; nieistniejące id ignorowane; prune usuwa puste i szkice', () => {
  const list = [mk('a', 'A', { cardCount: 5 }), mk('b', 'B', { cardCount: 12 }), mk('c', 'C', { cardCount: 0 }), mk('d', 'D', { isDraft: true })];
  assert.deepEqual(summarizeSelection(list, ['a', 'b']), { sets: 2, cards: 17 });
  assert.deepEqual(summarizeSelection(list, ['a', 'zzz']), { sets: 1, cards: 5 });
  assert.deepEqual(summarizeSelection(list, []), { sets: 0, cards: 0 });
  assert.deepEqual(pruneSelection(['a', 'c', 'd', 'zzz', 'b'], list), ['a', 'b']);
});

test('start zablokowany: brak zestawów, za mało kart (quiz 4, dopasowanie 2); reszta wolna', () => {
  assert.deepEqual(startBlocker('flashcards', { sets: 0, cards: 0 }), { blocker: 'no-sets', min: 1 });
  assert.deepEqual(startBlocker('quiz', { sets: 1, cards: 3 }), { blocker: 'too-few-cards', min: 4 });
  assert.deepEqual(startBlocker('quiz', { sets: 2, cards: 4 }), { blocker: null, min: 4 });
  assert.deepEqual(startBlocker('matching', { sets: 1, cards: 1 }), { blocker: 'too-few-cards', min: 2 });
  assert.deepEqual(startBlocker('flashcards', { sets: 1, cards: 1 }), { blocker: null, min: 1 });
});

test('zdania z AI: start wymaga co najmniej jednego źródła, nie więcej niż limit; tematy liczą się do limitu', () => {
  const scope = (setIds: string[], lessonIds: string[] = [], topics: string[] = []) => ({ setIds, lessonIds, topics });
  assert.equal(sentenceStartBlocker(scope([])), 'no-scope', 'walidacja braku zakresu');
  assert.equal(sentenceStartBlocker(scope(['a'])), null);
  assert.equal(sentenceStartBlocker(scope([], ['l1'])), null, 'sama lekcja wystarcza');
  assert.equal(sentenceStartBlocker(scope([], [], ['podróże'])), null, 'sam temat wystarcza');
  assert.equal(MAX_SENTENCE_SOURCES, 5);
  assert.equal(sentenceStartBlocker(scope(['a', 'b'], ['l1', 'l2'], ['t'])), null, '5 źródeł mieści się w limicie');
  assert.equal(sentenceStartBlocker(scope(['a', 'b', 'c'], ['l1', 'l2'], ['t'])), 'too-many-sources');
  assert.equal(sentenceSourceCount(scope(['a'], ['l1'], ['t1', 't2'])), 4);
});

test('start zdań z AI niesie zakres i format, a nie pola pracy domowej; buildFreeLaunch rozdziela rodzaje', () => {
  const launch = freeSentencesLaunch('correction', { setIds: ['s1'], lessonIds: ['l1'], topics: ['travel'] });
  assert.deepEqual(launch, { view: 'free-sentences', mode: 'correction', format: 'correction', setIds: ['s1'], lessonIds: ['l1'], topics: ['travel'] });
  assert.deepEqual(Object.keys(launch).sort(), ['format', 'lessonIds', 'mode', 'setIds', 'topics', 'view']);
  assert.ok(!Object.keys(launch).some((key) => /task|homework|status/i.test(key)));
  const input = { setIds: ['s1'], lessonIds: [], topics: [] };
  assert.equal(buildFreeLaunch('translation', input).view, 'free-sentences');
  assert.equal((buildFreeLaunch('translation', input) as { format: string }).format, 'typing');
  for (const mode of ['flashcards', 'quiz', 'matching'] as const) {
    assert.equal(buildFreeLaunch(mode, input).view, 'flashcard-study', mode);
  }
});

test('skrót „Przećwicz w zdaniach AI": tłumaczenie + zakres od razu na kroku zakresu; nieznany zakres → menu od początku', () => {
  const lessons = [{ id: 'v1', lessonRecordId: 'rec1' }, { id: 'generated-rec2', lessonRecordId: 'rec2' }];
  const sets = [mk('s1', 'A'), mk('s0', 'Pusty', { cardCount: 0 })];
  assert.deepEqual(shortcutInitial('s1', lessons, sets), { mode: 'translation', step: 'scope', setIds: ['s1'] });
  assert.deepEqual(shortcutInitial('lesson_rec1', lessons, sets), { mode: 'translation', step: 'scope', lessonIds: ['v1'] });
  assert.deepEqual(shortcutInitial('lesson_rec2', lessons, sets), { mode: 'translation', step: 'scope', lessonIds: ['generated-rec2'] });
  assert.deepEqual(shortcutInitial('vocab-v1', lessons, sets), { mode: 'translation', step: 'scope', lessonIds: ['v1'] });
  assert.deepEqual(shortcutInitial('s0', lessons, sets), { mode: 'translation' }, 'pusty zestaw nie jest do wyboru');
  assert.deepEqual(shortcutInitial('lesson_nieznana', lessons, sets), { mode: 'translation' });
  assert.deepEqual(shortcutInitial(null, lessons, sets), { mode: 'translation' });
});

test('zapis wyniku z wielu zestawów: jeden saveSession na zestaw, statystyki liczone z wyników zestawu', () => {
  const map = { c1: 'A', c2: 'A', c3: 'B', c4: 'B', c5: 'B' };
  const results = [
    { flashcardId: 'c1', isCorrect: true },
    { flashcardId: 'c3', isCorrect: false },
    { flashcardId: 'c2', isCorrect: false },
    { flashcardId: 'c4', isCorrect: true },
    { flashcardId: 'c5', isCorrect: true },
  ];
  const parts = splitSessionBySet({ setId: 'A', mode: 'quiz', totalCards: 5, correctCount: 3, scorePercent: 60 }, results, map, 'A');
  assert.deepEqual(parts.map((p) => p.sessionData.setId), ['A', 'B'], 'kolejność pierwszego wystąpienia');
  assert.deepEqual(parts[0].sessionData, { setId: 'A', mode: 'quiz', totalCards: 2, correctCount: 1, scorePercent: 50 });
  assert.deepEqual(parts[1].sessionData, { setId: 'B', mode: 'quiz', totalCards: 3, correctCount: 2, scorePercent: 67 });
  assert.equal(parts[0].results.length + parts[1].results.length, 5, 'żaden wynik nie ginie');
  assert.ok(parts.every((p) => p.sessionData.mode === 'quiz'));
});

test('zapis wyniku bez wyników na kartach (dopasowanie): jedna sesja pod pierwszym zestawem, liczby bez zmian', () => {
  const parts = splitSessionBySet({ setId: 'A', mode: 'matching', totalCards: 8, correctCount: 8, scorePercent: 100 }, [], {}, 'A');
  assert.deepEqual(parts, [{ sessionData: { setId: 'A', mode: 'matching', totalCards: 8, correctCount: 8, scorePercent: 100 }, results: [] }]);
});

test('wynik z nieznaną kartą trafia do zestawu zapasowego, a nie ginie', () => {
  const parts = splitSessionBySet<{ mode: string; setId?: string }, { flashcardId: string; isCorrect: boolean }>({ mode: 'flashcards' }, [{ flashcardId: 'nieznana', isCorrect: true }], { c1: 'B' }, 'A');
  assert.deepEqual(parts.map((p) => p.sessionData.setId), ['A']);
});

test('i18n: każdy tekst ekranu i punktu wejścia ma wpis w pl.json i en.json (bez tekstów z LLM)', () => {
  const sources = [
    'components/practice/FreePracticeScreen.tsx',
    'components/dashboard/FreePracticeEntry.tsx',
  ].map(read);
  const keys = new Set<string>();
  for (const src of sources) for (const m of src.matchAll(/\bt\('([^']+)'[,)]/g)) keys.add(m[1]);
  for (const type of FREE_PRACTICE_TYPES) {
    keys.add(type.titleKey);
    keys.add(type.descriptionKey);
  }
  assert.ok(keys.size >= 25, `znalezione klucze: ${keys.size}`);
  keys.delete('cardCountLabel'); // klucz z liczbą mnogą — sprawdzany niżej po przyrostkach
  for (const suffix of ['one', 'few', 'many', 'other']) assert.ok(`cardCountLabel_${suffix}` in pl, `pl: cardCountLabel_${suffix}`);
  for (const suffix of ['one', 'other']) assert.ok(`cardCountLabel_${suffix}` in en, `en: cardCountLabel_${suffix}`);
  for (const key of keys) {
    assert.ok(key in pl, `pl.json: brak „${key}"`);
    assert.ok(key in en && en[key].trim() !== '', `en.json: brak „${key}"`);
    assert.doesNotMatch(key, /[.:]/, `klucz „${key}" zawiera . lub : (separatory i18next)`);
  }
});

// --- Gwarancja „nie zmienia statusu pracy domowej" ------------------------------------

test('kod wyboru i punktu wejścia nie zna Firestore ani zadań (specialTasks, taskId)', () => {
  for (const file of [
    'utils/freePractice.ts',
    'utils/freeSentenceScope.ts',
    'utils/specialTaskSubmission.ts',
    'components/practice/FreePracticeScreen.tsx',
    'components/dashboard/FreePracticeEntry.tsx',
  ]) {
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /firebase|firestore|updateDoc|setDoc|addDoc|specialTasks|\btaskId\b/i, file);
  }
});

test('ścieżka uruchamianego ćwiczenia (moduł fiszek + saveSession) nie pisze do specialTasks', () => {
  for (const file of [
    'components/flashcards/FlashcardStudyScreen.tsx',
    'components/flashcards/MatchingGame.tsx',
    'context/FlashcardContext.tsx',
  ]) {
    assert.doesNotMatch(read(file), /specialTasks/, file);
  }
  // saveSession zapisuje tylko sesje, wyniki i historię ćwiczeń kursanta.
  const ctx = read('context/FlashcardContext.tsx');
  const save = ctx.slice(ctx.indexOf('const saveSession ='), ctx.indexOf('const getProgress ='));
  assert.ok(save.length > 500, 'wycięto ciało saveSession');
  const writes = [...save.matchAll(/batch\.set\(\w+Ref/g)].length;
  assert.equal(writes, 3, 'sessions, sessions/*/results, practiceLogs');
  assert.match(save, /sessions\/\$\{sessionId\}/);
  assert.match(save, /users\/\$\{userId\}\/practiceLogs/);
});

// --- Wpięcie w Dashboard --------------------------------------------------------------

test('Dashboard: jedno menu dla kursanta — pulpit i skróty „Przećwicz w zdaniach AI" prowadzą do FreePracticeScreen', () => {
  const src = read('components/dashboard/Dashboard.tsx');
  assert.match(src, /type View = [^;]*'free-practice'[^;]*'free-sentences'/);
  assert.match(src, /onOpenFreePractice: \(\) => handleNavigate\('free-practice'\)/);
  const start = src.indexOf("view === 'free-sentences' && !isTeacher && freeLaunch");
  const block = src.slice(start, src.indexOf("if (view === 'settings')"));
  // wszystkie cztery widoki kursanta → to samo menu
  assert.match(block, /view === 'free-practice' \|\| view === 'extra-practice' \|\| view === 'ai-generator' \|\| view === 'free-sentences'/);
  assert.match(block, /<FreePracticeScreen/);
  assert.match(block, /_initialStudyMode = launch\.mode/);
  assert.match(block, /handleNavigate\(launch\.view, \{ setId: launch\.setId, setIds: launch\.setIds \}\)/);
  assert.match(block, /onBack=\{\(\) => handleNavigate\('dashboard'\)\}/);
  // zdania z AI: generator w trybie free, bez zadania lektora i bez wejścia w generator kursanta
  assert.match(block, /<AIExerciseGeneratorScreen[\s\S]{0,120}mode="free"/);
  assert.match(block, /onExitFree=\{\(\) => handleNavigate\('free-practice'\)\}/);
  assert.doesNotMatch(block, /taskId|specialTasks/);
  // generator bez trybu zostaje dla lektora
  assert.match(src, /view !== 'extra-practice' && view !== 'ai-generator'/);
  assert.match(src, /<FlashcardStudyScreen[\s\S]{0,200}onBack=\{\(\) => handleNavigate\('dashboard'\)\}/);
});

test('nagłówek kursanta: kafelek pracy domowej i filtr „do zrobienia" bez zmian, wejście w obu stanach z jednego komponentu', () => {
  const hero = read('components/dashboard/StudentHeroHeader.tsx');
  assert.match(hero, /\.filter\(\(t\) => isStudentTodoStatus\(t\.status\)\)/);
  assert.equal((hero.match(/<StudentHeroAction/g) || []).length, 1);
  assert.doesNotMatch(hero, /onOpenExtraPractice/);
  const action = read('components/dashboard/StudentHeroAction.tsx');
  // <FreePracticeEntry> poza gałęziami warunku — jedno wystąpienie, widoczne zawsze.
  assert.equal((action.match(/<FreePracticeEntry/g) || []).length, 1);
  const ternaryEnd = action.indexOf(')}', action.indexOf('pendingTasks.length > 0 ?'));
  assert.ok(action.indexOf('<FreePracticeEntry') > ternaryEnd);
});

test('wspólna lista kart: kolizja id między zestawami nie gubi kart, a zapis przywraca prawdziwe id', () => {
  const { cards, cardSetMap, originalIds } = mergeSetCards([
    { setId: 'A', cards: [{ id: 'c0', term: 'a0' }, { id: 'c1', term: 'a1' }] },
    { setId: 'B', cards: [{ id: 'c0', term: 'b0' }, { id: 'x', term: 'b1' }] },
  ]);
  assert.equal(cards.length, 4, 'żadna karta nie ginie');
  assert.equal(new Set(cards.map((c) => c.id)).size, 4, 'id unikalne na czas sesji');
  assert.deepEqual(cards.map((c) => c.term), ['a0', 'a1', 'b0', 'b1']);
  assert.equal(cardSetMap['c0'], 'A');
  assert.equal(cardSetMap['B::c0'], 'B');
  assert.deepEqual(originalIds, { 'B::c0': 'c0' });
  const parts = splitSessionBySet<{ mode: string; setId?: string }, { flashcardId: string; isCorrect: boolean }>({ mode: 'quiz' }, [{ flashcardId: 'B::c0', isCorrect: false }, { flashcardId: 'c0', isCorrect: true }], cardSetMap, 'A', originalIds);
  const b = parts.find((p) => p.sessionData.setId === 'B')!;
  assert.equal(b.results[0].flashcardId, 'c0', 'do bazy trafia prawdziwe id karty');
});

test('ta sama karta dwa razy w jednym zestawie nie jest dublowana', () => {
  const { cards } = mergeSetCards([{ setId: 'A', cards: [{ id: 'c0' }, { id: 'c0' }] }]);
  assert.equal(cards.length, 1);
});

test('tematy: normalizacja jak na serwerze, limit trzech tematów i pięciu źródeł, bez powtórek', () => {
  assert.equal(normalizeTopic('  podróże   służbowe '), 'podróże służbowe');
  assert.equal(normalizeTopic('<b>podróże</b> {{x}}'), 'b podróże /b x', 'znaczniki i klamry znikają');
  assert.equal(normalizeTopic('😀'), '');
  assert.equal(normalizeTopic('a'.repeat(300)).length, MAX_TOPIC_LENGTH);
  assert.equal(MAX_TOPIC_LENGTH, 80);
  assert.deepEqual(addTopic([], '  '), []);
  assert.deepEqual(addTopic(['travel'], 'Travel'), ['travel'], 'powtórka bez rozróżniania wielkości liter');
  assert.deepEqual(addTopic(['a'], 'b'), ['a', 'b']);
  let topics: string[] = [];
  for (const t of ['a', 'b', 'c', 'd']) topics = addTopic(topics, t);
  assert.deepEqual(topics, ['a', 'b', 'c'], `limit ${MAX_SENTENCE_TOPICS} tematów`);
  assert.deepEqual(addTopic(['a'], 'b', MAX_SENTENCE_SOURCES - 1), ['a'], 'łączny limit źródeł liczy też zestawy i lekcje');
  assert.equal(canAddTopic([], 5), false);
  assert.equal(canAddTopic([], 4), true);
  assert.deepEqual(removeTopic(['a', 'b'], 'a'), ['b']);
});

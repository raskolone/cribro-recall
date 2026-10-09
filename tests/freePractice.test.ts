// „Ćwiczenia dowolne" — logika bez UI oraz gwarancja, że ścieżka startu nie dotyka prac domowych.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_FREE_PRACTICE_MODE,
  FREE_PRACTICE_TYPES,
  freePracticeLaunch,
  groupFreePracticeSets,
  nextFreePracticeMode,
} from '../utils/freePractice';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const pl = JSON.parse(read('pl.json')) as Record<string, string>;
const en = JSON.parse(read('en.json')) as Record<string, string>;

test('rodzaje to dokładnie tryby modułu fiszek — nic wymyślonego, bez trybu „zdania AI"', () => {
  const src = read('components/flashcards/FlashcardStudyScreen.tsx');
  const union = src.match(/type StudyMode = ([^;]+);/);
  assert.ok(union, 'typ StudyMode w FlashcardStudyScreen');
  const studyModes = union![1]
    .split('|')
    .map((part) => part.trim().replace(/'/g, ''))
    .filter((part) => part !== 'null')
    .sort();
  assert.deepEqual(FREE_PRACTICE_TYPES.map((type) => type.mode).sort(), studyModes);
  assert.equal(new Set(FREE_PRACTICE_TYPES.map((type) => type.mode)).size, FREE_PRACTICE_TYPES.length);
});

test('domyślny rodzaj to pierwszy na liście: fiszki', () => {
  assert.equal(DEFAULT_FREE_PRACTICE_MODE, 'flashcards');
  assert.equal(FREE_PRACTICE_TYPES[0].mode, DEFAULT_FREE_PRACTICE_MODE);
});

test('start niesie wyłącznie widok nauki fiszek, zestaw i tryb — zero pól pracy domowej', () => {
  const launch = freePracticeLaunch('quiz', 'set-1');
  assert.deepEqual(launch, { view: 'flashcard-study', setId: 'set-1', mode: 'quiz' });
  assert.deepEqual(Object.keys(launch).sort(), ['mode', 'setId', 'view']);
  for (const type of FREE_PRACTICE_TYPES) {
    const keys = Object.keys(freePracticeLaunch(type.mode, 'x'));
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

test('klawiatura w grupie rodzajów: strzałki cyklicznie, Home/End, inne klawisze zostają przeglądarce', () => {
  const first = FREE_PRACTICE_TYPES[0].mode;
  const second = FREE_PRACTICE_TYPES[1].mode;
  const last = FREE_PRACTICE_TYPES[FREE_PRACTICE_TYPES.length - 1].mode;
  assert.equal(nextFreePracticeMode(first, 'ArrowRight'), second);
  assert.equal(nextFreePracticeMode(first, 'ArrowDown'), second);
  assert.equal(nextFreePracticeMode(second, 'ArrowLeft'), first);
  assert.equal(nextFreePracticeMode(second, 'ArrowUp'), first);
  assert.equal(nextFreePracticeMode(first, 'ArrowLeft'), last, 'zawinięcie na koniec');
  assert.equal(nextFreePracticeMode(last, 'ArrowRight'), first, 'zawinięcie na początek');
  assert.equal(nextFreePracticeMode(second, 'Home'), first);
  assert.equal(nextFreePracticeMode(first, 'End'), last);
  for (const key of ['Enter', ' ', 'Tab', 'a', 'Escape']) assert.equal(nextFreePracticeMode(first, key), null, key);
});

test('i18n: każdy tekst ekranu i punktu wejścia ma wpis w pl.json i en.json (bez tekstów z LLM)', () => {
  const sources = [
    'components/practice/FreePracticeScreen.tsx',
    'components/dashboard/FreePracticeEntry.tsx',
  ].map(read);
  const keys = new Set<string>();
  for (const src of sources) for (const m of src.matchAll(/\bt\('([^']+)'\)/g)) keys.add(m[1]);
  for (const type of FREE_PRACTICE_TYPES) {
    keys.add(type.titleKey);
    keys.add(type.descriptionKey);
  }
  assert.ok(keys.size >= 15, `znalezione klucze: ${keys.size}`);
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

test('zdania AI nie są rodzajem na liście — ten ekran potrafi oznaczyć pracę domową jako oddaną', () => {
  const generator = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.match(generator, /selectedSetId\?\.startsWith\('special-task-'\)/);
  assert.match(generator, /status: 'submitted'/);
  assert.ok(FREE_PRACTICE_TYPES.every((type) => !/ai|sentence|zdani/i.test(type.mode)));
});

// --- Wpięcie w Dashboard --------------------------------------------------------------

test('Dashboard: widok free-practice tylko dla kursanta, start przez flashcard-study, powrót na pulpit', () => {
  const src = read('components/dashboard/Dashboard.tsx');
  assert.match(src, /type View = [^;]*'free-practice'/);
  assert.match(src, /view === 'free-practice' && !isTeacher/);
  assert.match(src, /onOpenFreePractice: \(\) => handleNavigate\('free-practice'\)/);
  const branch = src.slice(src.indexOf("view === 'free-practice' && !isTeacher"));
  const block = branch.slice(0, branch.indexOf("if (view === 'settings')"));
  assert.match(block, /_initialStudyMode = launch\.mode/);
  assert.match(block, /handleNavigate\(launch\.view, \{ setId: launch\.setId \}\)/);
  assert.match(block, /onBack=\{\(\) => handleNavigate\('dashboard'\)\}/);
  // Ćwiczenie uruchomione stąd wraca na pulpit tak samo jak z „Mojego słownictwa".
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

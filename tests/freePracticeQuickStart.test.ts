// Szybki start od „Co dalej?" do kroku 3: wpięcie w moduł fiszek, Dashboard i generator (struktura źródeł).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('„Co dalej?" po fiszkach i po dopasowaniu otwiera ćwiczenia dowolne w kroku 3, nie od razu generator', () => {
  const src = strip(read('components/flashcards/FlashcardStudyScreen.tsx'));
  const calls = [...src.matchAll(/onNavigate\('free-practice', \{\s*quickStart: \{ mode: format, setIds: setIds && setIds\.length > 0 \? setIds : \[setId\], focusWords: (\w+) \},?\s*\}\)/g)];
  assert.equal(calls.length, 2, 'fiszki i dopasowanie');
  assert.doesNotMatch(src, /onNavigate\('free-sentences'/, 'koniec ze startem generowania bez kroku 3');
  assert.match(src, /onStartSentences=\{\(format\) => onStartSentences\?\.\(format, queueState\.weakWords\)\}/);
  const game = strip(read('components/flashcards/MatchingGame.tsx'));
  assert.match(game, /onStartSentences\?\.\(format, result\.wrongWords \|\| \[\]\)/);
});

test('ekran „Co dalej?" nie ma suwaków — liczbę zdań ustawia krok 3', () => {
  const src = strip(read('components/practice/WhatsNextSection.tsx'));
  assert.doesNotMatch(src, /SentenceCountSlider|useState/);
  assert.match(src, /onStartSentences\('translation'\)/);
  assert.match(src, /onStartSentences\('correction'\)/);
});

test('Dashboard: quickStart ustawia szkic w kroku 3, powrót z generatora wraca do kroku 3, szkic znika po wyjściu z przepływu', () => {
  const src = strip(read('components/dashboard/Dashboard.tsx'));
  assert.match(src, /v === 'free-practice' && extra\?\.quickStart/);
  assert.match(src, /setFreeDraft\(quickStartInitial\(q\.mode, q\.setIds, q\.focusWords \?\? \[\]\)\)/);
  assert.match(src, /step: wasQuick \? 'start' : 'scope'/);
  assert.match(src, /\{ quick: true, count: launch\.count, focusWords: launch\.focusWords \}/);
  assert.match(src, /if \(!inFreeFlow\) setFreeDraft\(null\)/);
  // żadnego zapisu ani odczytu zadań lektora w tej ścieżce
  const block = src.slice(src.indexOf("view === 'free-sentences' && !isTeacher && freeLaunch"), src.indexOf("if (view === 'settings')"));
  assert.doesNotMatch(block, /specialTasks|taskId/);
});

test('„Generuj" woła /api/free-practice/generate z count i focusWords z szybkiego startu (bez zapisu do specialTasks)', () => {
  const gen = strip(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  const fn = gen.slice(gen.indexOf('const generateFreeSentences'), gen.indexOf('const handleGenerate = async ('));
  assert.match(fn, /count: practiceMode === 'time' \? 10 : \(freeLaunch\.count \?\? numSentences\)/);
  assert.match(fn, /focusWords: freeLaunch\.focusWords/);
  assert.match(fn, /requestFreeSentences\(/);
  assert.doesNotMatch(fn, /specialTasks|updateDoc|setDoc/);
  const api = strip(read('services/freePracticeApi.ts'));
  assert.match(api, /focusWords\?: string\[\]/);
  assert.match(api, /body: JSON\.stringify\(payload\)/);
  assert.match(api, /FREE_PRACTICE_ENDPOINT = '\/api\/free-practice\/generate'/);
  // limit, błąd i ładowanie — te same stany co w zwykłym starcie (jeden generator)
  assert.match(gen, /freeLimit \? i18n\.t\('Dzienny limit wykorzystany'\)/);
  assert.match(gen, /data-testid="free-sentences-error"/);
});

test('szybki start nie dotyka reguł ani ścieżek pracy domowej: zero zapisów do specialTasks w kodzie menu i startu', () => {
  for (const file of ['utils/freePractice.ts', 'components/practice/FreePracticeScreen.tsx', 'components/practice/WhatsNextSection.tsx']) {
    assert.doesNotMatch(strip(read(file)), /specialTasks|firestore|updateDoc|\btaskId\b|homework/i, file);
  }
  assert.doesNotMatch(read('firestore.rules'), /freePractice|quickStart/);
});

test('teksty szybkiego startu mają wpis w pl.json i en.json', () => {
  const pl = JSON.parse(read('pl.json')) as Record<string, string>;
  const en = JSON.parse(read('en.json')) as Record<string, string>;
  for (const key of ['Generuj', 'Ustaw liczbę zdań i generuj', 'Słowa do powtórzenia ({{count}})', 'Zmień zakres', 'Wróć do menu']) {
    assert.ok(key in pl, `pl: ${key}`);
    assert.ok(key in en && en[key].trim() !== '', `en: ${key}`);
    assert.doesNotMatch(key.replace(/\{\{[^}]+\}\}/g, ''), /[.:]/, key);
  }
});

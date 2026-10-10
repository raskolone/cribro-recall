// Ćwiczenia dowolne NIGDY nie zmieniają statusu pracy domowej ani zadania lektora, a ekran nie zna pracy domowej.
// Generator importuje Firebase, więc nie da się go uruchomić w node:test — gwarancja jest czystą funkcją
// (używaną w obu miejscach zapisu) plus testy strukturalne źródła.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldMarkTaskSubmitted, specialTaskIdFrom } from '../utils/specialTaskSubmission';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('shouldMarkTaskSubmitted: tryb free nigdy nie oznacza zadania — także gdy setId wygląda na zadanie lektora', () => {
  for (const setId of ['special-task-abc', 'special-task-', 'all', 'free-scope', 'lessons', '', null, undefined, 'gen-a1']) {
    assert.equal(shouldMarkTaskSubmitted('free', setId), false, String(setId));
  }
});

test('shouldMarkTaskSubmitted: tryb domyślny (lektor) działa jak dotąd — tylko dla special-task-<id>', () => {
  assert.equal(shouldMarkTaskSubmitted(undefined, 'special-task-abc'), true);
  assert.equal(shouldMarkTaskSubmitted('default', 'special-task-abc'), true);
  assert.equal(shouldMarkTaskSubmitted(undefined, 'special-task-'), false, 'puste id');
  assert.equal(shouldMarkTaskSubmitted(undefined, 'all'), false);
  assert.equal(shouldMarkTaskSubmitted(undefined, null), false);
  assert.equal(specialTaskIdFrom('special-task-xyz'), 'xyz');
  assert.equal(specialTaskIdFrom('basket'), null);
});

test('generator: oba miejsca zapisu statusu przechodzą przez shouldMarkTaskSubmitted(mode, …) — nie ma gołego sprawdzenia special-task-', () => {
  const src = stripComments(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  const writes = [...src.matchAll(/status: 'submitted'/g)];
  assert.equal(writes.length, 2, 'dwa miejsca zapisu statusu');
  for (const w of writes) {
    const before = src.slice(Math.max(0, w.index! - 500), w.index!);
    assert.match(before, /if \(shouldMarkTaskSubmitted\(mode, selectedSetId\)\)/, 'zapis tylko za bramką');
    assert.match(before, /specialTaskIdFrom\(selectedSetId\)/);
  }
  // jedyne zapisy do specialTasks w generatorze to właśnie te dwa — każdy leży za bramką z góry
  const taskWrites = [...src.matchAll(/updateDoc\(doc\(db, 'specialTasks'/g)];
  assert.equal(taskWrites.length, 2);
  for (const w of taskWrites) assert.match(src.slice(Math.max(0, w.index! - 400), w.index!), /shouldMarkTaskSubmitted\(mode, selectedSetId\)/);
});

test('generator w trybie free: nasłuch zadań lektora jest odcięty, a wejście do zadania ma strażnika', () => {
  const src = stripComments(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  const listener = src.indexOf('onSnapshot(studentTasksQuery');
  assert.ok(listener > 0);
  const before = src.slice(Math.max(0, listener - 400), listener);
  assert.match(before, /if \(isFree\) return;/, 'free nie subskrybuje specialTasks');
  assert.match(src, /if \(!isFree && selectedSetId\?\.startsWith\('special-task-'\)\)/);
  // free startuje z menu, a nie z listy generatora
  assert.match(src, /useState<string>\(isFree \? FREE_SCOPE_ID : 'all'\)/);
  assert.match(src, /if \(isFree && freeLaunch\)/);
});

test('generator w trybie free: powrót do początku to wyjście do menu, nie ekran ustawień z listą zadań lektora', () => {
  const src = stripComments(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  assert.equal((src.match(/setStep\('setup'\)/g) || []).length, 1, 'jedyne setStep(\'setup\') siedzi w returnToSetup');
  const fn = src.slice(src.indexOf('const returnToSetup'), src.indexOf('const handleMaybeLater'));
  assert.match(fn, /if \(isFree\)[\s\S]*onExitFree\?\.\(\)[\s\S]*return;/);
  assert.match(src, /\) : isFree \? \(/, 'osobna gałąź ekranu setup dla free (błąd + ponowienie), bez ekranu ustawień');
});

test('rozgrzewka w trybie free nie mówi o pracy domowej', () => {
  const gen = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.match(gen, /finishLabel=\{isFree \? i18n\.t\('Przejdź do zdań'\) : undefined\}/);
  const scrambler = read('components/dashboard/HomeworkWarmupScrambler.tsx');
  assert.match(scrambler, /finishLabel = 'Rozpocznij pracę domową'/, 'domyślnie (rozgrzewka pracy domowej) bez zmian');
});

test('menu Ćwiczeń dowolnych: żadnej wzmianki o pracy domowej ani zadaniach lektora w kodzie i tekstach', () => {
  const src = stripComments(read('components/practice/FreePracticeScreen.tsx')) + stripComments(read('utils/freePractice.ts'));
  assert.doesNotMatch(src, /homework|specialTasks|praca domowa|prace domowe|\btaskId\b/i);
  const pl = JSON.parse(read('pl.json')) as Record<string, string>;
  for (const key of ['Wybierz rodzaj ćwiczenia i materiał']) assert.doesNotMatch(pl[key], /domow/i);
  assert.ok(!('Zdania z AI' in pl), 'stary link usunięty z tekstów');
});

test('„Rozwiąż zadania" z pulpitu nadal prowadzi do pracy domowej, poza ścieżką Ćwiczeń dowolnych', () => {
  const dash = read('components/dashboard/Dashboard.tsx');
  assert.match(dash, /onOpenHomework: \(taskId\?: string\) =>\s*handleNavigate\('homework', taskId \? \{ taskId \} : undefined\)/);
  const hero = read('components/dashboard/StudentHeroAction.tsx');
  assert.match(hero, /pendingTasks\.length > 0 \?/);
  // widok pracy domowej: te same ekrany co dotąd, a zapis zadań lektora zostaje w ekranach pracy domowej
  assert.match(dash, /view === 'homework'/);
  assert.match(dash, /<StudentHomeworkScreen|StudentHomeworkV2Screen/);
  assert.match(read('components/dashboard/StudentHomeworkScreen.tsx'), /updateDoc\(doc\(db, 'specialTasks'/);
  // ścieżka Ćwiczeń dowolnych nie renderuje ekranów pracy domowej
  const start = dash.indexOf("view === 'free-sentences' && !isTeacher && freeLaunch");
  const free = dash.slice(start, dash.indexOf("if (view === 'settings')"));
  assert.doesNotMatch(free, /StudentHomework|HomeworkScreen|taskId|specialTasks/);
});

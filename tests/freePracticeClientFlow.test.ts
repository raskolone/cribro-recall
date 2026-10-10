// Klient trybu free: zdania z AI idą przez serwer, a klient nie sięga do licznika limitu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('klient nie sięga do kolekcji licznika limitu (zapis tylko Admin SDK po stronie serwera)', () => {
  for (const file of ['services/freePracticeApi.ts', 'components/dashboard/AIExerciseGeneratorScreen.tsx', 'components/practice/FreePracticeScreen.tsx', 'components/dashboard/Dashboard.tsx']) {
    assert.doesNotMatch(read(file), /freePracticeUsage/, file);
  }
});

test('generator w trybie free: zdania idą przez serwer — przed jakimkolwiek klienckim generowaniem i odczytem historii', () => {
  const src = strip(read('components/dashboard/AIExerciseGeneratorScreen.tsx'));
  const handle = src.slice(src.indexOf('const handleGenerate = async ('), src.indexOf('// Submit and grade translations with Gemini'));
  const free = handle.indexOf('if (isFree && freeLaunch) {');
  assert.ok(free > 0);
  assert.match(handle.slice(free, free + 120), /await generateFreeSentences\(isAppending\);\s*return;/);
  for (const clientCall of ['generateTranslationExercises(', 'generateFindErrors(', 'getUserWeaknesses(', 'getStudentAiContext(']) {
    assert.ok(handle.indexOf(clientCall) > free, `${clientCall} musi być PO wczesnym wyjściem trybu free`);
  }
  const gen = src.slice(src.indexOf('const generateFreeSentences'), src.indexOf('const handleGenerate = async ('));
  assert.match(gen, /requestFreeSentences\(/);
  assert.doesNotMatch(gen, /generateTranslationExercises|generateFindErrors|getUserWeaknesses|specialTasks|gemini/i);
  // błąd limitu → panel z komunikatem i18n, bez przycisku ponowienia
  assert.match(src, /freeLimit \? i18n\.t\('Dzienny limit wykorzystany'\)/);
  assert.match(src, /\{!freeLimit && \(\s*<Button type="button" onClick=\{\(\) => \{ setError\(null\); handleGenerate\(false\); \}\}/);
});

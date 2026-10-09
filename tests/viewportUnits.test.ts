import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Pliki powłoki i ekranów kursanta. `vh`/`min-h-screen` to wysokość DUŻEGO viewportu (iOS Safari
// z schowanym paskiem adresu) — przy widocznym pasku daje pusty pas pod treścią.
const STUDENT_FILES = [
  'App.tsx',
  'components/auth/AuthScreen.tsx',
  'components/auth/ForcePasswordChangeScreen.tsx',
  'components/auth/UnsubscribeScreen.tsx',
  'components/ui/GlobalErrorBoundary.tsx',
  'components/ui/TopBar.tsx',
  'components/dashboard/Dashboard.tsx',
  'components/dashboard/TodayScreen.tsx',
  'components/dashboard/StudentHomeworkScreen.tsx',
  'components/dashboard/StudentNotifications.tsx',
  'components/dashboard/AIExerciseGeneratorScreen.tsx',
  'components/dashboard/WordList.tsx',
  'components/flashcards/FlashcardSetsScreen.tsx',
  'components/flashcards/FlashcardEditScreen.tsx',
  'components/flashcards/FlashcardStudyScreen.tsx',
  'components/common/ModuleHelpButton.tsx',
  'components/ui/DesktopOnlyNotice.tsx',
];

test('ekrany kursanta nie używają vh ani min-h-screen', () => {
  for (const f of STUDENT_FILES) {
    const s = src(f);
    assert.doesNotMatch(s, /min-h-screen|\bh-screen\b|\bmax-h-screen\b/, `${f}: min-h-screen/h-screen`);
    assert.doesNotMatch(s, /\[\d+vh\]/, `${f}: wysokość w vh`);
  }
});

test('korzeń dokumentu ma dvh z fallbackiem na vh (w tej kolejności)', () => {
  const css = src('index.css');
  assert.match(css, /html, body, #root \{ min-height: 100vh; min-height: 100dvh; \}/);
  assert.match(css, /@utility min-h-app \{\s*min-height: 100vh;\s*min-height: 100dvh;\s*\}/);
  assert.doesNotMatch(src('index.html'), /<body[^>]*min-h-screen/);
});

test('pasek górny i przewijana treść respektują safe-area', () => {
  assert.match(src('components/ui/TopBar.tsx'), /<header[^>]*pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(src('components/dashboard/Dashboard.tsx'), /<main[^>]*pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(src('components/dashboard/StudentHomeworkV2Screen.tsx'), /fixed inset-x-0 bottom-0[^"]*pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
});

test('powłoka aplikacji ma jeden min-h zamiast stosu', () => {
  const app = src('App.tsx');
  const shell = app.split('\n').filter((l) => l.includes('relative z-10 w-full'));
  assert.ok(shell.length >= 1);
  for (const l of shell) assert.doesNotMatch(l, /min-h-/);
});

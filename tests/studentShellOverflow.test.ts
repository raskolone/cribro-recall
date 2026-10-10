import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('wrapper ekranów w Dashboardzie wymusza w-full i min-w-0 na korzeniu ekranu', () => {
  const dash = src('components/dashboard/Dashboard.tsx');
  const m = dash.match(/<GSAPModuleTransition activeKey=\{view\} className="([^"]*)"/);
  assert.ok(m, 'brak wrappera GSAPModuleTransition z widokiem');
  assert.match(m![1], /max-md:\[&>\*\]:w-full/);
  assert.match(m![1], /max-md:\[&>\*\]:min-w-0/);
});

test('komentarz lektora i tytuły zestawów łamią się zamiast wypychać układ', () => {
  const hw = src('components/dashboard/StudentHomeworkScreen.tsx');
  const tiles = src('components/dashboard/GradedHomeworkTiles.tsx');
  const feedbackLines = `${hw}\n${tiles}`.split('\n').filter((l) => l.includes('leading-relaxed whitespace-pre-wrap') || l.includes('line-clamp-2 break-words'));
  assert.ok(feedbackLines.length >= 2);
  for (const l of feedbackLines) assert.match(l, /\[overflow-wrap:anywhere\]/);
  assert.match(src('components/dashboard/StudentHomeworkGradedModal.tsx'), /whitespace-pre-wrap break-words \[overflow-wrap:anywhere\]/);
  assert.match(src('components/flashcards/FlashcardSetsScreen.tsx'), /className="min-w-0 text-lg font-bold/);
  assert.match(src('components/flashcards/FlashcardSetsScreen.tsx'), /flex-1 min-w-0 max-sm:w-full/);
});

test('data lekcji w zestawie nie jest wypisywana jako surowy tekst z bazy', () => {
  const sets = src('components/flashcards/FlashcardSetsScreen.tsx');
  assert.match(sets, /formatDisplayDateValue/);
  assert.doesNotMatch(sets, /return cleaned \|\| set\.lessonDate \|\|/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const entry = src('components/dashboard/FreePracticeEntry.tsx');

test('„Ćwiczenia dowolne": obwódka i plakietka ikony w kolorze akcentu z tokenów motywu', () => {
  assert.match(entry, /border border-primary dark:border-primary\/70/);
  assert.match(entry, /data-testid="free-practice-icon"[\s\S]*?bg-primary text-accent-ink/);
  assert.match(entry, /<ChevronRight[^>]*text-primary/);
  // tylko tokeny motywu — żadnych surowych kolorów
  assert.doesNotMatch(entry, /#[0-9a-fA-F]{3,8}|rgb\(|text-white|bg-white|emerald|green-/);
});

test('wiersz nie jest wypełniony akcentem — CTA „Rozwiąż zadania" zostaje jedyną wypełnioną akcją', () => {
  const button = entry.match(/<button[\s\S]*?className="([^"]*)"/)![1];
  assert.doesNotMatch(button, /(^|\s)(dark:)?bg-primary(\s|\/|$)/, 'tło wiersza bez akcentu');
  assert.match(button, /bg-base-100\/50/);
  const hero = src('components/dashboard/StudentHeroAction.tsx');
  assert.match(hero, /Rozwiąż zadania/);
  assert.match(hero, /bg-primary/, 'CTA ma wypełnienie akcentem');
});

test('kontrast: w jasnym motywie obwódka w pełnym kolorze akcentu (70% dawało 2,75:1 < 3:1)', () => {
  assert.doesNotMatch(entry, /(?<!dark:)border-primary\/70/);
});

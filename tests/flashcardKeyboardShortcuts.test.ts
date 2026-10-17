import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');

test('skrót ArrowLeft wywołuje handleAnswer(false) bez warunku isFlipped', () => {
  const handlerMatch = src.match(/if\s*\(e\.code\s*===\s*['"]ArrowLeft['"]\)\s*\{([^}]+)\}/);
  assert.ok(handlerMatch, 'Brak gałęzi obsługi ArrowLeft');
  const body = handlerMatch[1];
  assert.match(body, /handleAnswer\s*\(\s*false\s*\)/);
  assert.doesNotMatch(body, /isFlipped/, 'ArrowLeft nie powinno zależeć od isFlipped');
  assert.doesNotMatch(body, /handlePrev/, 'ArrowLeft nie powinno wołać handlePrev');
});

test('skrót ArrowRight wywołuje handleAnswer(true) bez warunku isFlipped', () => {
  const handlerMatch = src.match(/if\s*\(e\.code\s*===\s*['"]ArrowRight['"]\)\s*\{([^}]+)\}/);
  assert.ok(handlerMatch, 'Brak gałęzi obsługi ArrowRight');
  const body = handlerMatch[1];
  assert.match(body, /handleAnswer\s*\(\s*true\s*\)/);
  assert.doesNotMatch(body, /isFlipped/, 'ArrowRight nie powinno zależeć od isFlipped');
  assert.doesNotMatch(body, /handleNext/, 'ArrowRight nie powinno wołać handleNext');
});

test('skrót Space wywołuje handleFlip()', () => {
  const handlerMatch = src.match(/if\s*\(e\.code\s*===\s*['"]Space['"]\)\s*\{([^}]+)\}/);
  assert.ok(handlerMatch, 'Brak gałęzi obsługi Space');
  assert.match(handlerMatch[1], /handleFlip\s*\(\s*\)/);
});

test('boczne przyciski < > odpowiadają za nawigację bez oceny (handlePrev / handleNext)', () => {
  assert.match(src, /onClick=\{handlePrev\}\s*disabled=\{queueState\.queue\.length <= 1\}/);
  assert.match(src, /onClick=\{handleNext\}\s*disabled=\{queueState\.queue\.length <= 1\}/);
});

test('aria-label i title przycisków informują o skrótach klawiszowych', () => {
  assert.match(src, /aria-label=\{i18n\.t\("Nie umiem \(Strzałka w lewo\)"\)\}/);
  assert.match(src, /title=\{i18n\.t\("Nie umiem \(Strzałka w lewo\)"\)\}/);
  assert.match(src, /aria-label=\{i18n\.t\("Umiem \(Strzałka w prawo\)"\)\}/);
  assert.match(src, /title=\{i18n\.t\("Umiem \(Strzałka w prawo\)"\)\}/);
});

// Test strukturalny układu karty w trybie nauki fiszek (FlashcardsMode).
// Komponentu nie da się wyrenderować w node:test (konteksty Firebase), więc
// sprawdzamy źródło — to zabezpiecza przed powrotem błędu z nakładaniem się kart:
// .liquid-glass-card ma `position: relative` poza warstwą Tailwinda i nadpisuje
// `absolute`, więc obie strony karty muszą dzielić jedną komórkę siatki.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_REST, enterFromVars, snapBackVars } from '../utils/flashcardCardMotion';

const src = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
const face = readFileSync(new URL('../components/flashcards/FlashcardFace.tsx', import.meta.url), 'utf8');
const mode = src.slice(src.indexOf('const FlashcardsMode'), src.indexOf('const QuizMode'));
const stage = mode.slice(mode.indexOf('data-testid="flashcard-stage"'), mode.indexOf('<FlashcardFace'));

test('obie strony karty w jednej komórce siatki, bez position:absolute (FlashcardFace)', () => {
  assert.match(face, /FACE_BASE_CLASS =\s*'col-start-1 row-start-1/);
  assert.doesNotMatch(face.slice(face.indexOf('FACE_BASE_CLASS'), face.indexOf('FRONT_CLASS')), /\babsolute\b|\bh-full\b/);
  assert.equal((mode.match(/<FlashcardFace/g) || []).length, 2);
  assert.match(stage, /className="grid w-full preserve-3d"/);
  assert.doesNotMatch(mode, /aspect-\[3\/2\]/);
});

test('przyciski Nie umiem / Umiem są poza kontenerem karty', () => {
  const stageStart = mode.indexOf('data-testid="flashcard-stage"');
  const flipEnd = mode.indexOf('</motion.div>');
  const actions = mode.indexOf('data-testid="flashcard-actions"');
  assert.ok(stageStart > 0 && flipEnd > stageStart);
  assert.ok(actions > flipEnd, 'przyciski muszą występować po zamknięciu obracanej karty');
  // Między końcem karty a przyciskami nie ma już elementu stage ani flip.
  const between = mode.slice(flipEnd, actions);
  assert.doesNotMatch(between, /flashcard-stage|flashcard-flip/);
});

test('zmiana karty remontuje obracany element (nowa karta nie obraca się „od tyłu")', () => {
  assert.match(mode, /<motion\.div\s+key=\{currentIndex\}/);
});

test('tekst zawija się i ma token koloru zamiast surowego białego', () => {
  assert.match(face, /FRONT_BODY_CLASS = '[^']*text-text-hi[^']*break-words/);
  assert.match(face, /BACK_BODY_CLASS = '[^']*text-text-hi[^']*break-words/);
});

test('powrót karty czyści style inline (reset x/y/rotation po zmianie i po przeciągnięciu)', () => {
  assert.deepEqual(CARD_REST, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
  assert.equal(snapBackVars().clearProps, 'all');
  assert.equal(snapBackVars().overwrite, true);
  const e = enterFromVars(-1, 15);
  assert.equal(e.to.clearProps, 'all');
  assert.equal(e.to.x, 0);
  assert.equal(e.to.rotation, 0);
  assert.equal(e.from.x, -200);
  assert.equal(e.from.rotation, -15);
  assert.equal(enterFromVars(1, 10).from.x, 200);
});

test('odlot i snap-back przechodzą przez wspólne parametry (overwrite, clearProps)', () => {
  assert.equal((mode.match(/onComplete: proceed/g) || []).length, 3);
  assert.equal((mode.match(/exitVars\(/g) || []).length, 2);
  assert.equal((mode.match(/overwrite: true,\s*onComplete: proceed/g) || []).length, 1);
  assert.ok(!/gsap\.to\(cardContainerRef\.current, \{ x: 0, rotation: 0/.test(mode));
});

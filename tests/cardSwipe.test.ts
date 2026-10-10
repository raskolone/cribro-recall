import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSwipeGesture, EDGE_GUARD_PX, SwipeEndResult, SwipePointer } from '../utils/cardSwipe';
import { DRAG } from '../utils/flashcardCardMotion';

const touch = (clientX: number, over: Partial<SwipePointer> = {}): SwipePointer => ({ pointerId: 1, pointerType: 'touch', clientX, button: 0, ...over });

function rig(canStart?: (e: SwipePointer) => boolean) {
  const drags: Array<[number, boolean, number]> = [];
  const ends: SwipeEndResult[] = [];
  const g = createSwipeGesture({ canStart, onDrag: (dx, first, id) => drags.push([dx, first, id]), onEnd: (r) => ends.push(r) });
  const swipe = (from: number, to: number, over: Partial<SwipePointer> = {}) => {
    g.down(touch(from, over));
    g.move(touch((from + to) / 2, over));
    g.move(touch(to, over));
    return g.up(touch(to, over));
  };
  return { g, drags, ends, swipe };
}

test('dotyk w LEWO ≥ progu = następna, w PRAWO = poprzednia (jedno mapowanie dla obu modułów)', () => {
  const left = rig();
  left.swipe(300, 300 - DRAG.thresholdPx);
  assert.equal(left.ends[0].direction, 'next');
  const right = rig();
  right.swipe(100, 100 + DRAG.thresholdPx);
  assert.equal(right.ends[0].direction, 'prev');
});

test('poniżej progu gest kończy się bez kierunku (karta wraca na miejsce)', () => {
  const r = rig();
  r.swipe(200, 200 - (DRAG.thresholdPx - 1));
  assert.equal(r.ends[0].direction, null);
  assert.equal(r.ends[0].cancelled, false);
});

test('dotknięcie bez ruchu (< próg startu) to kliknięcie: nie jest przeciąganiem i nie woła onEnd', () => {
  const r = rig();
  r.g.down(touch(200));
  r.g.move(touch(200 - (DRAG.startDistancePx - 1)));
  assert.equal(r.g.up(touch(200)), false);
  assert.deepEqual(r.drags, []);
  assert.deepEqual(r.ends, []);
});

test('pierwsze onDrag niesie first=true i id wskaźnika (do setPointerCapture), kolejne first=false', () => {
  const r = rig();
  r.g.down(touch(200, { pointerId: 7 }));
  r.g.move(touch(180, { pointerId: 7 }));
  r.g.move(touch(150, { pointerId: 7 }));
  assert.deepEqual(r.drags, [[-20, true, 7], [-50, false, 7]]);
});

test('pointercancel (przeglądarka przejęła pionowe przewijanie) kończy gest bez zatwierdzenia', () => {
  const r = rig();
  r.g.down(touch(300));
  r.g.move(touch(150));
  assert.equal(r.g.cancel(touch(150)), true);
  assert.deepEqual(r.ends.map((e) => [e.direction, e.cancelled]), [[null, true]]);
  // po anulowaniu nic nie „wisi": kolejny pointerup nie zatwierdza starego gestu
  assert.equal(r.g.up(touch(150)), false);
  assert.equal(r.ends.length, 1);
});

test('anulowanie przed progiem startu nie wywołuje onEnd (nie było przeciągania)', () => {
  const r = rig();
  r.g.down(touch(300));
  assert.equal(r.g.cancel(touch(300)), false);
  assert.deepEqual(r.ends, []);
});

test('drugi palec i obcy pointerId są ignorowane', () => {
  const r = rig();
  r.g.down(touch(300, { pointerId: 1 }));
  assert.equal(r.g.down(touch(100, { pointerId: 2 })), false);
  assert.equal(r.g.move(touch(10, { pointerId: 2 })), false);
  r.g.move(touch(200, { pointerId: 1 }));
  assert.equal(r.g.up(touch(10, { pointerId: 2 })), false);
  assert.equal(r.g.up(touch(200, { pointerId: 1 })), true);
  assert.equal(r.ends[0].direction, 'next');
});

test('dotyk zaczęty przy lewej krawędzi ekranu (systemowe „wstecz" iOS) nie zaczyna gestu; mysz tak', () => {
  const r = rig();
  assert.equal(r.g.down(touch(EDGE_GUARD_PX - 1)), false);
  assert.equal(r.g.down(touch(EDGE_GUARD_PX)), true);
  const m = rig();
  assert.equal(m.g.down(touch(2, { pointerType: 'mouse' })), true);
});

test('prawy przycisk myszy nie zaczyna gestu; canStart może go zablokować', () => {
  const r = rig();
  assert.equal(r.g.down(touch(300, { pointerType: 'mouse', button: 2 })), false);
  const blocked = rig(() => false);
  assert.equal(blocked.g.down(touch(300)), false);
});

// --- Podpięcie w komponentach (te moduły nie renderują się w node: Firebase) -----------

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('rozgrzewka używa useCardSwipe, moduł fiszek useRatingSwipe (nakładka na ten sam hook); żadnych handlerów touch*', () => {
  const module_ = src('components/flashcards/FlashcardStudyScreen.tsx');
  const warmup = src('components/dashboard/HomeworkWarmupCards.tsx');
  assert.match(warmup, /useCardSwipe\(/);
  assert.match(src('hooks/useRatingSwipe.ts'), /useCardSwipe\(/);
  for (const s of [module_, warmup]) {
    assert.match(s, /\{\.\.\.swipe\.bind\}/);
    assert.match(s, /SWIPE_TOUCH_ACTION_CLASS/);
    assert.match(s, /consumeSuppressedClick\(\)/);
  }
  assert.doesNotMatch(module_, /onTouchStart|onTouchMove|onTouchEnd|handleTouchStart/);
  assert.match(module_, /useRatingSwipe\(/);
  // gest oceny nie zna stanu odwrócenia — to gwarantuje „tak samo na awersie i rewersie"
  assert.doesNotMatch(src('hooks/useRatingSwipe.ts'), /isFlipped|flipped/i);
  const call = module_.slice(module_.indexOf('useRatingSwipe({'), module_.indexOf('useRatingSwipe({') + 300);
  assert.doesNotMatch(call, /isFlipped/);
});

test('hook: setPointerCapture po starcie przeciągania, pointercancel i lostpointercapture kończą gest', () => {
  const hook = src('hooks/useCardSwipe.ts');
  assert.match(hook, /setPointerCapture/);
  assert.match(hook, /releasePointerCapture/);
  assert.match(hook, /onPointerCancel/);
  assert.match(hook, /onLostPointerCapture/);
  assert.match(hook, /touch-pan-y/);
});

test('moduł fiszek: ocena, zapis sesji i SRS nietknięte przez zmianę gestów', () => {
  const s = src('components/flashcards/FlashcardStudyScreen.tsx');
  assert.match(s, /await saveSession\(\{\s*setId,\s*mode: 'flashcards'/);
  assert.match(s, /enterFromVars\(isCorrect \? -1 : 1, 15\)/);
  assert.match(s, /ratingExitVars\(isCorrect, window\.innerWidth/);
});

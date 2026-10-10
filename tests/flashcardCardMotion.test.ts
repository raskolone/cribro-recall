import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARD_REST,
  DRAG,
  ENTER_DURATION,
  ENTER_EASE,
  EXIT_DURATION,
  EXIT_EASE,
  FLIP_DEGREES,
  FLIP_DURATION,
  FLIP_SPRING,
  dragFollowVars,
  enterFromVars,
  enterVars,
  exitFadeVars,
  exitMoveVars,
  exitVars,
  EXIT_FADE_DURATION,
  EXIT_FADE_EASE,
  snapBackVars,
  springEase,
  springOvershoot,
  swipeDirection,
} from '../utils/flashcardCardMotion';

test('sprężyna obrotu: parametry z modułu fiszek (stiffness 200, damping 20, mass 1), ζ ≈ 0,707', () => {
  assert.deepEqual(FLIP_SPRING, { stiffness: 200, damping: 20, mass: 1 });
  const zeta = FLIP_SPRING.damping / (2 * Math.sqrt(FLIP_SPRING.stiffness * FLIP_SPRING.mass));
  assert.ok(Math.abs(zeta - Math.SQRT1_2) < 1e-9);
  assert.equal(FLIP_DEGREES, 180);
  assert.ok(FLIP_DURATION >= 0.5 && FLIP_DURATION <= 0.7);
});

test('springEase: start 0, koniec 1, przestrzał ≈ 4,3 % w ≈ 0,31 s, wygaszenie przed końcem', () => {
  const ease = springEase();
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(2), 1);

  let peak = 0;
  let peakT = 0;
  for (let i = 1; i < 1000; i++) {
    const p = i / 1000;
    const v = ease(p);
    if (v > peak) {
      peak = v;
      peakT = p * FLIP_DURATION;
    }
  }
  const theoretical = springOvershoot();
  assert.ok(Math.abs(theoretical - 0.0432) < 0.001, `przestrzał teoretyczny ${theoretical}`);
  assert.ok(Math.abs(peak - 1 - theoretical) < 0.002, `przestrzał ${peak - 1}`);
  assert.ok(peakT > 0.28 && peakT < 0.34, `szczyt po ${peakT} s`);
  // tuż przed końcem krzywa jest w granicach progu spoczynku motion (0,5° z 180°)
  assert.ok(Math.abs(ease(0.999) - 1) * FLIP_DEGREES < 0.5);
  // dopasowanie do czasu, w którym sprężyna z modułu wchodzi w próg spoczynku
  assert.ok(Math.abs(ease(0.95) - 1) * FLIP_DEGREES < 3);
});

test('springEase: wartości rosną od 0, przekraczają 1 (przestrzał) i nie wybiegają poza ~1,05', () => {
  const ease = springEase();
  assert.ok(ease(0.1) > 0 && ease(0.1) < 1);
  const samples = Array.from({ length: 101 }, (_, i) => ease(i / 100));
  assert.ok(Math.max(...samples) > 1);
  assert.ok(Math.max(...samples) < 1.06);
  assert.ok(Math.min(...samples) >= 0);
});

test('odlot w stronę palca: next → lewo −20°, wjazd z prawej; prev lustrzanie', () => {
  assert.deepEqual(
    exitVars('next', 1000),
    { x: -1000, rotation: -20, opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: true }
  );
  assert.deepEqual(
    exitVars('prev', 1000),
    { x: 1000, rotation: 20, opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: true }
  );
  assert.equal(EXIT_DURATION, 0.3);
  assert.equal(EXIT_EASE, 'power2.in');
  const next = enterVars('next');
  assert.deepEqual(next.from, { x: 200, opacity: 0, rotation: 10 });
  assert.equal(next.to.duration, ENTER_DURATION);
  assert.equal(next.to.ease, ENTER_EASE);
  assert.equal(ENTER_DURATION, 0.4);
  assert.equal(ENTER_EASE, 'back.out(1.5)');
  assert.equal(next.to.clearProps, 'all');
  assert.deepEqual(enterVars('prev').from, { x: -200, opacity: 0, rotation: -10 });
  // wjazd zawsze z PRZECIWNEJ strony niż odlot
  for (const dir of ['next', 'prev'] as const) {
    assert.equal(Math.sign(enterVars(dir).from.x), -Math.sign(exitVars(dir, 1000).x));
  }
  // wjazd po ocenie (moduł fiszek): „umiem" −200 px/−15°
  assert.deepEqual(enterFromVars(-1, 15).from, { x: -200, opacity: 0, rotation: -15 });
  assert.deepEqual(enterFromVars(1, 15).from, { x: 200, opacity: 0, rotation: 15 });
});

test('odlot rozgrzewki: ruch = exitVars bez krycia (moduł fiszek bez zmian), krycie osobno i krócej niż ruch', () => {
  for (const dir of ['next', 'prev'] as const) {
    const { opacity, ...rest } = exitVars(dir, 1280);
    assert.equal(opacity, 0, 'moduł fiszek: exitVars dalej kryje w tym samym tweenie');
    assert.deepEqual(exitMoveVars(dir, 1280), rest);
  }
  assert.equal(exitMoveVars('next', 1280).x, -1280);
  assert.equal(exitMoveVars('prev', 1280).rotation, 20);
  assert.equal('opacity' in exitMoveVars('next', 1280), false);

  assert.deepEqual(exitFadeVars(), { opacity: 0, duration: 0.25, ease: 'power1.out', overwrite: false });
  assert.equal(EXIT_FADE_DURATION, 0.25);
  assert.equal(EXIT_FADE_EASE, 'power1.out');
  assert.ok(EXIT_FADE_DURATION < EXIT_DURATION);
});

test('stan spoczynkowy i powrót: wszystko do zera i clearProps (nic nie zostaje przesunięte)', () => {
  assert.deepEqual(CARD_REST, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
  const back = snapBackVars();
  assert.equal(back.clearProps, 'all');
  assert.equal(back.overwrite, true);
  assert.deepEqual([back.x, back.y, back.rotation, back.opacity, back.scale], [0, 0, 0, 1, 1]);
  for (const dir of ['next', 'prev'] as const) {
    const to = enterVars(dir).to;
    assert.deepEqual([to.x, to.y, to.rotation, to.opacity, to.scale, to.clearProps], [0, 0, 0, 1, 1, 'all']);
  }
});

test('przeciąganie: próg 80 px, podążanie z oporem / bez oporu, kierunek gestu', () => {
  assert.equal(DRAG.thresholdPx, 80);
  assert.ok(DRAG.startDistancePx > 0 && DRAG.startDistancePx < DRAG.thresholdPx);
  assert.deepEqual(dragFollowVars(100, false), { x: 50, rotation: 2, duration: 0.1, overwrite: true });
  assert.deepEqual(dragFollowVars(100, true), { x: 100, rotation: 5, duration: 0.1, overwrite: true });
  assert.deepEqual(dragFollowVars(-40, true), { x: -40, rotation: -2, duration: 0.1, overwrite: true });

  assert.equal(swipeDirection(80), 'prev');
  assert.equal(swipeDirection(300), 'prev');
  assert.equal(swipeDirection(79), null);
  assert.equal(swipeDirection(0), null);
  assert.equal(swipeDirection(-79), null);
  assert.equal(swipeDirection(-80), 'next');
});

// --- Struktura: brak motion/react w nowym kodzie, GSAP core ----------------------------

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('nowe pliki nie używają motion/react ani framer-motion; GSAP tylko jako nazwany import rdzenia', () => {
  const files = [
    'components/flashcards/FlashcardFace.tsx',
    'components/flashcards/PronunciationButtons.tsx',
    'components/flashcards/MatchingGame.tsx',
    'components/dashboard/HomeworkWarmupCards.tsx',
    'utils/flashcardCardMotion.ts',
    'utils/matchingGame.ts',
  ];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /from ['"](motion\/react|framer-motion|motion)['"]/, f);
    assert.doesNotMatch(src, /gsap\/[A-Za-z]+/, `${f}: bez wtyczek GSAP`);
    assert.doesNotMatch(src, /import gsap from/, `${f}: nazwany import { gsap }`);
  }
});

test('rozgrzewka bierze wszystkie parametry ruchu z jednego modułu (bez własnych liczb odlotu/wjazdu)', () => {
  const src = read('components/dashboard/HomeworkWarmupCards.tsx');
  assert.match(src, /from '\.\.\/\.\.\/utils\/flashcardCardMotion'/);
  assert.doesNotMatch(src, /EXIT_X_PERCENT|EXIT_DROP_PX|ENTER_FROM_SCALE|ENTER_DELAY/);
  assert.doesNotMatch(src, /power2\.inOut/);
});

// --- Ocena gestem (moduł fiszek) -------------------------------------------------------
import {
  RATING_EXIT_ROTATION_DEG,
  ratingDragPose,
  ratingExitVars,
  ratingHint,
  ratingSnapBackVars,
  ratingSwipeAction,
  RATING_SNAP_DURATION,
  RATING_SNAP_SPRING,
  springEase as springEaseFn,
} from '../utils/flashcardCardMotion';

test('ocena gestem: prawo = umiem, lewo = nie umiem, od progu 80 px (bez zależności od odwrócenia)', () => {
  assert.equal(ratingSwipeAction(DRAG.thresholdPx), 'know');
  assert.equal(ratingSwipeAction(-DRAG.thresholdPx), 'dontKnow');
  assert.equal(ratingSwipeAction(DRAG.thresholdPx - 1), null);
  assert.equal(ratingSwipeAction(-(DRAG.thresholdPx - 1)), null);
  assert.equal(ratingSwipeAction(0), null);
});

test('ocena gestem: karta idzie 1:1 (x = dx, obrót 0,05·dx) przez translate3d', () => {
  assert.deepEqual(ratingDragPose(100), { x: 100, rotation: 5, force3D: true });
  assert.deepEqual(ratingDragPose(-40), { x: -40, rotation: -2, force3D: true });
});

test('ocena gestem: wskazówka — martwa strefa, strona ruchu, siła do progu i nasycenie', () => {
  assert.deepEqual(ratingHint(3), { side: null, strength: 0 });
  assert.deepEqual(ratingHint(-40), { side: 'dontKnow', strength: 0.5 });
  assert.deepEqual(ratingHint(60), { side: 'know', strength: 0.75 });
  assert.equal(ratingHint(500).strength, 1);
  assert.equal(ratingHint(-500).strength, 1);
});

test('ocena gestem: odlot = dawna animacja rewersu (±szerokość, ±45°, 0,4 s power2.in); ograniczenie ruchu = sam zanik', () => {
  assert.deepEqual(ratingExitVars(true, 390), { x: 390, rotation: RATING_EXIT_ROTATION_DEG, opacity: 0, duration: 0.4, ease: 'power2.in', overwrite: true });
  assert.deepEqual(ratingExitVars(false, 390), { x: -390, rotation: -45, opacity: 0, duration: 0.4, ease: 'power2.in', overwrite: true });
  const reduced = ratingExitVars(true, 390, true) as Record<string, unknown>;
  assert.equal(reduced.x, undefined);
  assert.equal(reduced.rotation, undefined);
  assert.equal(reduced.opacity, 0);
  assert.ok((reduced.duration as number) < 0.2);
});

test('ocena gestem: powrót jest sprężyną z lekkim przestrzałem, kończy w 1 i czyści style inline', () => {
  const v = ratingSnapBackVars() as any;
  assert.equal(v.clearProps, 'all');
  assert.equal(v.duration, RATING_SNAP_DURATION);
  const ease = springEaseFn(RATING_SNAP_SPRING, RATING_SNAP_DURATION);
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  const peak = Math.max(...Array.from({ length: 100 }, (_, i) => ease(i / 100)));
  assert.ok(peak > 1 && peak < 1.08, `przestrzał ${peak}`);
  assert.ok(Math.abs(ease(0.99) - 1) < 0.01, 'u końca prawie w spoczynku');
  const reduced = ratingSnapBackVars(true) as any;
  assert.equal(reduced.ease, 'none');
});

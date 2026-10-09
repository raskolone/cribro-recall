/**
 * Parametry ruchu karty fiszki w JEDNYM miejscu — czytane przez moduł fiszek
 * (FlashcardStudyScreen → FlashcardsMode) i przez rozgrzewkę (HomeworkWarmupCards),
 * żeby obie karty poruszały się identycznie. Wartości pochodzą z FlashcardsMode:
 * odlot/wjazd (x, rotation, opacity, czasy, easing), próg przeciągania, obrót
 * (sprężyna motion/react) — patrz CHANGELOG „Fiszki w rozgrzewce: wspólna karta".
 *
 * Kontener karty dostaje od GSAP-a transformacje (przesunięcie, obrót, krycie) przy
 * przeciąganiu i przy odlocie/wjeździe. Każda droga powrotu (odpuszczenie
 * przeciągnięcia, zmiana karty) sprowadza go do stanu spoczynkowego i czyści style
 * inline, więc po odwróceniu albo zmianie karty nic nie zostaje przesunięte.
 */

export const CARD_REST = { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 } as const;

// --- Obrót (flip) --------------------------------------------------------------
// Moduł fiszek: motion.div, animate rotateY 0↔180, type "spring", stiffness 200,
// damping 20 (mass domyślnie 1; podane `duration: 0.6` jest przy parametrach
// fizycznych ignorowane). Układ drugiego rzędu: ω0 = √(k/m) ≈ 14,14 rad/s,
// ζ = c / (2√(km)) ≈ 0,707 → przestrzał e^(−πζ/√(1−ζ²)) ≈ 4,3 % (≈ 7,8° przy 180°),
// szczyt po ≈ 0,31 s, wygaszenie poniżej progu spoczynku motion (0,5°) po ≈ 0,59 s.
export const FLIP_SPRING = { stiffness: 200, damping: 20, mass: 1 } as const;
/** Czas tweena GSAP = czas wygaszenia sprężyny (zaokrąglony jak `duration` w module). */
export const FLIP_DURATION = 0.6;
export const FLIP_DEGREES = 180;
export const PERSPECTIVE_PX = 1000; // klasa `perspective-1000`

/**
 * Funkcja easingu GSAP odwzorowująca odpowiedź skokową sprężyny tłumionej (rozwiązanie
 * analityczne, start ze spoczynku). To ta sama krzywa, którą liczy motion — bez
 * przybliżania `elastic.out`/`back.out`. `duration` = czas, w którym krzywa kończy
 * się w 1 (pozostałe odchylenie < 0,5° przy obrocie o 180°).
 */
export function springEase(
  spring: { stiffness: number; damping: number; mass: number } = FLIP_SPRING,
  duration: number = FLIP_DURATION,
): (progress: number) => number {
  const { stiffness: k, damping: c, mass: m } = spring;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const t = p * duration;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * w0 * t);
      return 1 - decay * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    // Krytyczne/nadtłumione: bez przestrzału (zapas na zmianę parametrów).
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
}

/** Przestrzał sprężyny w ułamku drogi (do testów i raportu). */
export function springOvershoot(spring = FLIP_SPRING): number {
  const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
  return zeta >= 1 ? 0 : Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
}

// --- Zmiana karty (nawigacja) ------------------------------------------------------
export type CardDirection = 'next' | 'prev';

export const EXIT_DURATION = 0.3;
export const EXIT_EASE = 'power2.in';
export const EXIT_ROTATION_DEG = 20;
export const ENTER_DURATION = 0.4;
export const ENTER_EASE = 'back.out(1.5)';
export const ENTER_OFFSET_PX = 200;
export const ENTER_TILT_DEG = 10;

/** Odlot bieżącej karty: „next" w prawo z obrotem +20°, „prev" w lewo z −20° (jak w module). */
export function exitVars(dir: CardDirection, viewportWidth: number) {
  const sign = dir === 'next' ? 1 : -1;
  return {
    x: sign * viewportWidth,
    rotation: sign * EXIT_ROTATION_DEG,
    opacity: 0,
    duration: EXIT_DURATION,
    ease: EXIT_EASE,
    overwrite: true,
  } as const;
}

// Rozgrzewka: odlot bez ucinania. Ramka sceny nie przycina już karty (panel ma szerokość
// karty, więc każdy `overflow` na nim ścinałby ją tuż po starcie), dlatego krycie spada
// własnym, krótszym tweenem i dochodzi do 0, zanim karta dotrze do krawędzi panelu —
// x/rotation lecą dalej (0,3 s) już niewidoczne. Moduł fiszek dalej używa `exitVars`.
export const EXIT_FADE_DURATION = 0.25;
export const EXIT_FADE_EASE = 'power1.out';

/** Odlot bez krycia: te same x/obrót/czas/easing co `exitVars` (moduł fiszek), ale `opacity` zostaje poza tweenem. */
export function exitMoveVars(dir: CardDirection, viewportWidth: number) {
  const { opacity: _opacity, ...move } = exitVars(dir, viewportWidth);
  return move;
}

/**
 * Zanik odlatującej karty — osobny tween równolegle do `exitMoveVars`. Bez `overwrite`,
 * żeby nie zabić tweena ruchu (tworzonego tuż przed nim z `overwrite: true`).
 */
export function exitFadeVars() {
  return { opacity: 0, duration: EXIT_FADE_DURATION, ease: EXIT_FADE_EASE, overwrite: false } as const;
}

/** Wjazd nowej karty: „next" z lewej (−200 px, −10°), „prev" z prawej (+200 px, +10°). */
export function enterVars(dir: CardDirection) {
  const sign = dir === 'next' ? -1 : 1;
  return {
    from: { x: sign * ENTER_OFFSET_PX, opacity: 0, rotation: sign * ENTER_TILT_DEG },
    to: { ...CARD_REST, duration: ENTER_DURATION, ease: ENTER_EASE, overwrite: true, clearProps: 'all' },
  } as const;
}

/** Wjazd po ocenie „umiem / nie umiem" (tylko moduł fiszek): −200 px/−15° dla „umiem". */
export function enterFromVars(direction: -1 | 1, tilt: number) {
  return {
    from: { x: direction * ENTER_OFFSET_PX, opacity: 0, rotation: direction * tilt },
    to: { ...CARD_REST, duration: ENTER_DURATION, ease: ENTER_EASE, overwrite: true, clearProps: 'all' },
  } as const;
}

// --- Przeciąganie -----------------------------------------------------------------
export const DRAG = {
  /** Przesunięcie, od którego gest liczy się jako przeciąganie (nie kliknięcie). */
  startDistancePx: 8,
  /** Próg zatwierdzenia gestu — jak w module (80 px). */
  thresholdPx: 80,
  followDuration: 0.1,
  /** Karta nieodwrócona: opór (x = 0,5·dx, obrót 0,02·dx). */
  idle: { xFactor: 0.5, rotationFactor: 0.02 },
  /** Karta odwrócona: podąża za palcem (x = dx, obrót 0,05·dx). */
  flipped: { xFactor: 1, rotationFactor: 0.05 },
} as const;

export const SNAP_BACK_DURATION = 0.3;

/** Parametry tweena „wróć na miejsce" — z clearProps, żeby nie zostały style inline. */
export function snapBackVars(duration: number = SNAP_BACK_DURATION) {
  return { ...CARD_REST, duration, ease: ENTER_EASE, overwrite: true, clearProps: 'all' } as const;
}

/** Podążanie karty za wskaźnikiem w trakcie przeciągania. */
export function dragFollowVars(dx: number, flipped: boolean) {
  const f = flipped ? DRAG.flipped : DRAG.idle;
  return { x: dx * f.xFactor, rotation: dx * f.rotationFactor, duration: DRAG.followDuration, overwrite: true } as const;
}

/**
 * Kierunek zatwierdzonego gestu. W rozgrzewce (bez oceny) przeciągnięcie w prawo =
 * następna karta, w lewo = poprzednia — zgodnie z kierunkiem odlotu karty
 * (`exitVars('next')` leci w prawo). Moduł fiszek ma własne mapowanie dotyku
 * (w lewo = następna) i go nie używa.
 */
export function swipeDirection(dx: number): CardDirection | null {
  if (dx >= DRAG.thresholdPx) return 'next';
  if (dx <= -DRAG.thresholdPx) return 'prev';
  return null;
}

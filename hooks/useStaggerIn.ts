import { RefObject, useLayoutEffect } from 'react';

/** Odstęp między kolejnymi elementami (ms) i czas jednej animacji wejścia. */
export const STAGGER_STEP_MS = 55;
export const STAGGER_DURATION_MS = 260;

export interface StaggerFrames {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

/** Klatki wejścia jednego elementu (czysta funkcja — łatwa do przetestowania bez przeglądarki). */
export function staggerFrames(index: number): StaggerFrames {
  return {
    keyframes: [
      { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    ],
    options: {
      duration: STAGGER_DURATION_MS,
      delay: index * STAGGER_STEP_MS,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'backwards', // przed startem (delay) element jest już niewidoczny, po końcu wraca do stylów CSS
    },
  };
}

/**
 * Animacja wejścia „po kolei" (stagger) dla elementów `[data-stagger]` kontenera — czyste WAAPI,
 * bez bibliotek. Przy `prefers-reduced-motion: reduce` albo bez `Element.animate` nic nie robi
 * (elementy po prostu są). Odpala się przy każdej zmianie `key` (np. kroku przepływu).
 */
export function useStaggerIn(containerRef: RefObject<HTMLElement | null>, key: unknown): void {
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-stagger]'));
    const animations = items
      .map((el, i) => {
        if (typeof el.animate !== 'function') return null;
        const { keyframes, options } = staggerFrames(i);
        return el.animate(keyframes, options);
      })
      .filter((a): a is Animation => a !== null);
    return () => animations.forEach((a) => a.cancel());
  }, [containerRef, key]);
}

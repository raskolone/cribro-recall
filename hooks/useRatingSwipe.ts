import { RefObject, useCallback } from 'react';
import { gsap } from 'gsap';
import { useCardSwipe } from './useCardSwipe';
import { prefersReducedMotion } from '../services/gsapAnimations';
import { ratingDragPose, ratingHint, ratingSnapBackVars, ratingSwipeAction, SwipeRating } from '../utils/flashcardCardMotion';

export interface UseRatingSwipeOptions {
  cardRef: RefObject<HTMLElement | null>;
  knowHintRef: RefObject<HTMLElement | null>;
  dontKnowHintRef: RefObject<HTMLElement | null>;
  /** `true` = trwa odlot po ocenie; gest nie startuje. */
  isBusy: () => boolean;
  /** Zatwierdzony gest: prawo → `true` („umiem"), lewo → `false` („nie umiem"). Odlot robi wołający. */
  onRate: (isCorrect: boolean) => void;
}

/**
 * Gest oceny karty fiszki (moduł fiszek): karta idzie za palcem 1:1 (`gsap.set` → translate3d,
 * bez tweena na każdy ruch), powyżej progu `onRate`, poniżej sprężyste wrócenie. Działa tak samo
 * na awersie i rewersie — nie zależy od stanu odwrócenia. Wskazówka kierunku (nakładka
 * `SwipeRatingHint`) jest sterowana wprost przez `style.opacity`, bez renderu Reacta.
 */
export function useRatingSwipe({ cardRef, knowHintRef, dontKnowHintRef, isBusy, onRate }: UseRatingSwipeOptions) {
  const setHint = useCallback(
    (dx: number) => {
      const { side, strength } = ratingHint(dx);
      const apply = (el: HTMLElement | null, on: boolean) => {
        if (el) el.style.opacity = on ? String(strength) : '0';
      };
      apply(knowHintRef.current, side === 'know');
      apply(dontKnowHintRef.current, side === 'dontKnow');
    },
    [knowHintRef, dontKnowHintRef],
  );

  return useCardSwipe({
    canStart: (e) => !isBusy() && !(e.target as Element).closest?.('button'),
    onFollow: (dx) => {
      if (cardRef.current) gsap.set(cardRef.current, ratingDragPose(dx));
      setHint(dx);
    },
    onSwipe: ({ dx, cancelled }) => {
      if (cancelled) return false;
      const action: SwipeRating | null = ratingSwipeAction(dx);
      if (action === null) return false;
      setHint(0);
      onRate(action === 'know');
      return true;
    },
    onSnapBack: () => {
      setHint(0);
      if (cardRef.current) gsap.to(cardRef.current, ratingSnapBackVars(prefersReducedMotion()));
    },
  });
}

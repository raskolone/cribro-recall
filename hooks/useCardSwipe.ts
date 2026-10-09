import { useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { createSwipeGesture, SwipeEndResult } from '../utils/cardSwipe';

/** Klasa Tailwinda dla elementu z gestem: pionowe przewijanie zostaje przeglądarce, poziomy gest naszemu kodowi. */
export const SWIPE_TOUCH_ACTION_CLASS = 'touch-pan-y';

const CLICK_SUPPRESSION_MS = 120;

export interface UseCardSwipeOptions {
  /** Czy gest wolno zacząć (np. cel nie jest przyciskiem, brak trwającej animacji). */
  canStart?: (e: React.PointerEvent) => boolean;
  /** Karta podąża za palcem. */
  onFollow: (dx: number) => void;
  /**
   * Zatwierdzony (≥ próg) lub niezatwierdzony gest. Zwróć `true`, gdy uruchomiłeś animację
   * odlotu; `false` = hook wywoła `onSnapBack`.
   */
  onSwipe: (result: SwipeEndResult) => boolean;
  /** Karta wraca na miejsce (za mało, brak następnej/poprzedniej, anulowanie). */
  onSnapBack: () => void;
}

/**
 * PointerEvents dla przeciągania karty: `setPointerCapture` po rozpoczęciu przeciągania,
 * `pointercancel` / utrata własnego przechwycenia kończą gest bez zatwierdzenia, a kliknięcie
 * wygenerowane zaraz po przeciągnięciu jest pomijane (`consumeSuppressedClick`), żeby karta
 * się nie odwracała po każdym swipe'ie. Dotyczy dotyku i myszy.
 */
export function useCardSwipe(options: UseCardSwipeOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const suppressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<Element | null>(null);

  const gesture = useMemo(
    () =>
      createSwipeGesture({
        canStart: (e) => optionsRef.current.canStart?.(e as unknown as React.PointerEvent) ?? true,
        onDrag: (dx, first, pointerId) => {
          if (first) {
            try {
              targetRef.current?.setPointerCapture?.(pointerId);
            } catch {
              /* przechwycenie wskaźnika jest opcjonalne */
            }
          }
          optionsRef.current.onFollow(dx);
        },
        onEnd: (result) => {
          suppressRef.current = true;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            suppressRef.current = false;
          }, CLICK_SUPPRESSION_MS);
          const handled = optionsRef.current.onSwipe(result);
          if (!handled) optionsRef.current.onSnapBack();
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const release = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* jw. */
    }
  };

  return {
    bind: {
      onPointerDown: (e: React.PointerEvent) => {
        suppressRef.current = false;
        targetRef.current = e.currentTarget as Element;
        gesture.down(e);
      },
      onPointerMove: (e: React.PointerEvent) => {
        gesture.move(e);
      },
      onPointerUp: (e: React.PointerEvent) => {
        release(e);
        gesture.up(e);
      },
      onPointerCancel: (e: React.PointerEvent) => {
        release(e);
        gesture.cancel(e);
      },
      // Dotyk ma w Chromium NIEJAWNE przechwycenie przez element docelowy; nasze jawne
      // `setPointerCapture` na kontenerze je zwalnia i wywołuje `lostpointercapture` na tym
      // elemencie (bąbelkuje do nas). To nie jest utrata gestu — anulujemy tylko wtedy, gdy
      // straciliśmy WŁASNE przechwycenie (cel zdarzenia = kontener).
      onLostPointerCapture: (e: React.PointerEvent) => {
        if (e.target === e.currentTarget) gesture.cancel(e);
      },
    },
    /** `true` = to kliknięcie jest echem przeciągnięcia — nie obracaj karty. */
    consumeSuppressedClick(): boolean {
      if (!suppressRef.current) return false;
      suppressRef.current = false;
      return true;
    },
  };
}

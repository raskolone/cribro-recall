import { CardDirection, DRAG, swipeDirection } from './flashcardCardMotion';

/**
 * Gest przeciągnięcia karty (PointerEvents) — logika bez przeglądarki i bez Reacta.
 * Wspólna dla rozgrzewki (HomeworkWarmupCards) i modułu fiszek (FlashcardStudyScreen);
 * podpięcie do DOM robi `hooks/useCardSwipe.ts`.
 *
 * Reguły:
 * - gest zaczyna się jako „kandydat" i staje się przeciąganiem dopiero po
 *   `DRAG.startDistancePx` ruchu w poziomie (dotyk bez ruchu = zwykłe kliknięcie);
 * - zatwierdza go przesunięcie ≥ `DRAG.thresholdPx`; znaczenie kierunku zależy od ekranu
 *   (rozgrzewka: lewo = następna, prawo = poprzednia; moduł fiszek: lewo = „nie umiem",
 *   prawo = „umiem", patrz `ratingSwipeAction`);
 * - `pointercancel` (przeglądarka przejęła gest — np. pionowe przewijanie, krawędź „wstecz")
 *   kończy gest bez zatwierdzenia;
 * - obsługiwany jest jeden wskaźnik naraz (drugi palec jest ignorowany);
 * - dotyk zaczęty tuż przy lewej krawędzi ekranu nie rozpoczyna gestu — należy do systemowego
 *   „wstecz" (iOS), którego nie wolno dublować przeciąganiem karty.
 */

/** Strefa przy lewej krawędzi ekranu, w której dotyk nie zaczyna przeciągania karty. */
export const EDGE_GUARD_PX = 16;

export interface SwipePointer {
  pointerId: number;
  pointerType: string;
  clientX: number;
  button?: number;
}

export interface SwipeEndResult {
  dx: number;
  /** Kierunek po przekroczeniu progu; `null` = za mało albo anulowanie. */
  direction: CardDirection | null;
  cancelled: boolean;
}

export interface SwipeGestureHandlers {
  /** Czy gest wolno zacząć (np. nie na przycisku, nie w trakcie animacji). */
  canStart?: (e: SwipePointer) => boolean;
  /** Pierwsze wywołanie (`first`) = gest właśnie stał się przeciąganiem — tu przechwyć wskaźnik. */
  onDrag: (dx: number, first: boolean, pointerId: number) => void;
  /** Wołane tylko dla gestu, który stał się przeciąganiem (też po anulowaniu). */
  onEnd: (result: SwipeEndResult) => void;
}

export function createSwipeGesture(handlers: SwipeGestureHandlers) {
  let drag: { id: number; startX: number; dx: number; active: boolean } | null = null;

  const finish = (cancelled: boolean) => {
    const current = drag;
    drag = null;
    if (!current || !current.active) return false;
    handlers.onEnd({
      dx: current.dx,
      direction: cancelled ? null : swipeDirection(current.dx),
      cancelled,
    });
    return true;
  };

  return {
    down(e: SwipePointer): boolean {
      if (drag) return false; // drugi palec
      if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return false;
      if (e.pointerType === 'touch' && e.clientX < EDGE_GUARD_PX) return false;
      if (handlers.canStart && !handlers.canStart(e)) return false;
      drag = { id: e.pointerId, startX: e.clientX, dx: 0, active: false };
      return true;
    },
    move(e: SwipePointer): boolean {
      if (!drag || drag.id !== e.pointerId) return false;
      drag.dx = e.clientX - drag.startX;
      let first = false;
      if (!drag.active) {
        if (Math.abs(drag.dx) < DRAG.startDistancePx) return false;
        drag.active = true;
        first = true;
      }
      handlers.onDrag(drag.dx, first, drag.id);
      return true;
    },
    /** Zwraca `true`, gdy gest był przeciąganiem (wtedy kliknięcie po nim trzeba pominąć). */
    up(e: SwipePointer): boolean {
      if (!drag || drag.id !== e.pointerId) return false;
      return finish(false);
    },
    cancel(e: SwipePointer): boolean {
      if (!drag || drag.id !== e.pointerId) return false;
      return finish(true);
    },
    isActive: () => Boolean(drag?.active),
  };
}

export type SwipeGesture = ReturnType<typeof createSwipeGesture>;

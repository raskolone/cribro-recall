/**
 * Skrót Enter w ćwiczeniach ze zdaniami (tłumaczenie i korekta). Czysta funkcja: stan + zdarzenie → akcja.
 * Komponent tylko zbiera wejście (`describeEnterTarget`, `isCoarsePointer`) i wykonuje wynik.
 */

export type EnterAction = 'check' | 'next' | 'none';

/** Gdzie jest fokus: pole odpowiedzi, element klikalny (przycisk, link…), inne pole/okno albo „nigdzie". */
export type EnterTarget = 'answer' | 'interactive' | 'other-field' | 'body';

export interface EnterKeyInput {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat: boolean;
  isComposing: boolean;
  target: EnterTarget;
  /** `(pointer: coarse)` — dotyk i klawiatura ekranowa: Enter zostaje nową linią. */
  coarsePointer: boolean;
  evaluating: boolean;
  evaluated: boolean;
  /** Pole odpowiedzi ma niepusty tekst. */
  answered: boolean;
  /** „Dalej" / „Zakończ" jest dostępne (nieoznaczone jako disabled/loading). */
  canForward: boolean;
  /** Ile ms minęło od ostatniej akcji wykonanej tym skrótem (null = jeszcze nie było). */
  msSinceLastAction: number | null;
}

/** Dwa szybkie Entery po feedbacku to JEDNO zdanie dalej: kolejna akcja dopiero po tym czasie. */
export const ENTER_COOLDOWN_MS = 450;

export function enterKeyAction(input: EnterKeyInput): EnterAction {
  if (input.key !== 'Enter') return 'none';
  if (input.shiftKey || input.ctrlKey || input.metaKey || input.altKey) return 'none';
  if (input.repeat || input.isComposing) return 'none';
  if (input.coarsePointer) return 'none';
  // Na przycisku/linku Enter robi to, co ten element — bez podwójnego wywołania.
  if (input.target === 'interactive' || input.target === 'other-field') return 'none';
  if (input.evaluating) return 'none';
  if (input.msSinceLastAction !== null && input.msSinceLastAction < ENTER_COOLDOWN_MS) return 'none';

  if (input.evaluated) return input.canForward ? 'next' : 'none';
  // Niesprawdzone: z pola (albo spoza pola, gdy fokus przepadł) sprawdzamy, jeśli jest co sprawdzać.
  return input.answered ? 'check' : 'none';
}

const INTERACTIVE = 'button, a[href], select, summary, [role="button"], [role="link"], [role="radio"], [role="tab"], input';

/** Klasyfikuje cel zdarzenia klawiatury. `answerSelector` wskazuje pole odpowiedzi. */
export function describeEnterTarget(target: EventTarget | null, answerSelector = '[data-testid="sentence-answer"]'): EnterTarget {
  const el = target as Element | null;
  if (!el || typeof (el as Element).closest !== 'function') return 'body';
  if (el.matches?.(answerSelector)) return 'answer';
  if (el.closest('[contenteditable="true"], textarea, [role="textbox"], [role="dialog"]')) return 'other-field';
  if (el.closest(INTERACTIVE)) return 'interactive';
  return 'body';
}

export function isCoarsePointer(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

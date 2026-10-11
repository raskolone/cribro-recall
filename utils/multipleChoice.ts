/**
 * Wielokrotny wybór — czysta logika (bez Reacta): stany kafelków odpowiedzi, tasowanie opcji po wygenerowaniu,
 * odczyt zagadnienia gramatycznego. Wygląd kafelków to wspólny styl gier (`utils/gameTile.ts`).
 */
import type { GameTileState } from './gameTile';
import { grammarFocusLabelKey, isGrammarFocusId, type GrammarFocusId } from './grammarFocus';

export interface McOptionView {
  index: number;
  state: GameTileState;
  /** Tylko po odpowiedzi: ta opcja jest poprawna / ta opcja została wybrana błędnie. */
  verdict?: 'correct' | 'wrong';
}

/** Czy zadanie ma poprawny `correctIndex` (stare dane bywają bez niego — wtedy nie pokazujemy wyniku). */
export const hasValidKey = (options: readonly unknown[], correctIndex: unknown): correctIndex is number =>
  Number.isInteger(correctIndex) && (correctIndex as number) >= 0 && (correctIndex as number) < options.length;

/**
 * Stany opcji. Przed odpowiedzią wszystkie `rest` (wybrana — `selected`). Po odpowiedzi (`reveal` i poprawny klucz):
 * poprawna `correct`, błędnie wybrana `wrong`, reszta `locked`.
 */
export function mcOptionViews(optionCount: number, selected: number, correctIndex: unknown, reveal: boolean): McOptionView[] {
  const answered = selected >= 0 && selected < optionCount;
  const canReveal = reveal && answered && hasValidKey(Array.from({ length: optionCount }), correctIndex);
  return Array.from({ length: optionCount }, (_, index) => {
    if (canReveal) {
      if (index === correctIndex) return { index, state: 'correct', verdict: 'correct' };
      if (index === selected) return { index, state: 'wrong', verdict: 'wrong' };
      return { index, state: 'locked' };
    }
    return { index, state: index === selected ? 'selected' : 'rest' };
  });
}

/** Zagadnienie z zadania (tylko wartość z listy) i klucz i18n jego etykiety; stare dane → `null`. */
export function grammarFocusOf(item: { grammarFocus?: unknown } | null | undefined): { id: GrammarFocusId; labelKey: string } | null {
  const id = item?.grammarFocus;
  return isGrammarFocusId(id) ? { id, labelKey: grammarFocusLabelKey(id) } : null;
}

/**
 * Miesza opcje po stronie aplikacji (model ma skłonność do stałej pozycji poprawnej odpowiedzi)
 * i przelicza `correctIndex`. `rng` do wstrzykiwania w testach.
 */
export function shuffleOptions(options: readonly string[], correctIndex: number, rng: () => number = Math.random): { options: string[]; correctIndex: number } {
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), correctIndex: order.indexOf(correctIndex) };
}

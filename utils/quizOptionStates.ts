/**
 * Stan kafelka odpowiedzi w quizie (wielokrotny wybór fiszek).
 *
 * Wygląd stanów to wspólny kafelek gier (`utils/gameTile.ts`, `.game-tile` w index.css) — tu tylko
 * mapowanie fazy pytania na stan odpowiedzi. Zasada niezmienna: tekst odpowiedzi zawsze w `text-hi`,
 * a stan niosą obwódka, ikona i tekst dla czytników ekranu — nigdy sam kolor ani krycie przycisku.
 */
import type { GameTileState } from './gameTile';

export type QuizOptionState = 'default' | 'correct' | 'incorrect' | 'disabled';

/** Stan kafelka gier odpowiadający stanowi odpowiedzi w quizie. */
export const QUIZ_TILE_STATE: Record<QuizOptionState, GameTileState> = {
  default: 'rest',
  correct: 'correct',
  incorrect: 'wrong',
  disabled: 'locked',
};

export type QuizOptionPhase = 'answering' | 'answered';

/** Stan wyświetlany dla opcji: przed odpowiedzią wszystkie `default`, po niej poprawna/błędna/nieaktywne. */
export function quizOptionState(
  phase: QuizOptionPhase,
  isCorrectOption: boolean,
  isPickedOption: boolean,
): QuizOptionState {
  if (phase === 'answering') return 'default';
  if (isCorrectOption) return 'correct';
  if (isPickedOption) return 'incorrect';
  return 'disabled';
}

/**
 * Stany kafelka odpowiedzi w quizie (wielokrotny wybór) — jedno miejsce prawdy o kolorach.
 *
 * Zasada: TEKST odpowiedzi zawsze w `text-hi` (najwyższy kontrast w obu motywach), a stan
 * niosą obwódka, delikatne tło, ikona i tekst dla czytników ekranu — nigdy sam kolor tekstu
 * ani przezroczystość całego przycisku (to dawało zielone na zielonym i blednięcie po odpowiedzi).
 * Opis `contrast` (tokeny + krycie) czyta test kontrastu, który liczy WCAG z `index.css`.
 */

export type QuizOptionState = 'default' | 'hover' | 'selected' | 'correct' | 'incorrect' | 'disabled';

export interface QuizOptionRecipe {
  /** Klasy Tailwinda (tokeny motywu). */
  classes: string;
  /** Token koloru tekstu odpowiedzi. */
  text: string;
  /** Warstwy tła od dołu: nieprzezroczysta powierzchnia + opcjonalna nakładka (token, krycie). */
  surface: string;
  tint?: { token: string; alpha: number };
  /** Ikona i obwódka niosące stan (kontrast elementów graficznych ≥ 3:1). */
  signal?: string;
}

const BASE =
  'relative w-full min-h-14 px-4 py-3 rounded-2xl border-2 text-base sm:text-lg font-medium leading-snug ' +
  'break-words whitespace-normal flex items-center justify-center gap-3 text-center ' +
  'transition-colors motion-reduce:transition-none cursor-pointer select-none';

export const QUIZ_OPTION_STATES: Record<QuizOptionState, QuizOptionRecipe> = {
  default: {
    classes: `${BASE} bg-surface-flat border-line-strong text-text-hi`,
    text: '--color-text-hi',
    surface: '--color-surface-flat',
  },
  // hover działa tylko na urządzeniach z kursorem (Tailwind 4: @media (hover: hover));
  // fokus klawiatury dostaje to samo tło + globalny kontur :focus-visible.
  hover: {
    classes: 'hover:bg-primary/10 hover:border-primary/60 focus-visible:bg-primary/10 focus-visible:border-primary/60',
    text: '--color-text-hi',
    surface: '--color-surface-flat',
    tint: { token: '--color-primary', alpha: 0.1 },
    signal: '--color-primary',
  },
  selected: {
    classes: 'bg-primary/10 border-primary text-text-hi',
    text: '--color-text-hi',
    surface: '--color-surface-flat',
    tint: { token: '--color-primary', alpha: 0.1 },
    signal: '--color-primary',
  },
  correct: {
    classes: `${BASE} bg-primary/15 border-primary text-text-hi`,
    text: '--color-text-hi',
    surface: '--color-surface-flat',
    tint: { token: '--color-primary', alpha: 0.15 },
    signal: '--color-primary',
  },
  incorrect: {
    classes: `${BASE} bg-danger/15 border-danger text-text-hi`,
    text: '--color-text-hi',
    surface: '--color-surface-flat',
    tint: { token: '--color-danger', alpha: 0.15 },
    signal: '--color-danger',
  },
  // Nieaktywny (po odpowiedzi, nie wybrany): spokojniejszy tekst z tokenu, NIE opacity.
  disabled: {
    classes: `${BASE} bg-surface-flat border-line text-text-3 cursor-default`,
    text: '--color-text-3',
    surface: '--color-surface-flat',
  },
};

export type QuizOptionPhase = 'answering' | 'answered';

/** Stan wyświetlany dla opcji: przed odpowiedzią wszystkie `default`, po niej poprawna/błędna/nieaktywne. */
export function quizOptionState(
  phase: QuizOptionPhase,
  isCorrectOption: boolean,
  isPickedOption: boolean,
): Exclude<QuizOptionState, 'hover' | 'selected'> {
  if (phase === 'answering') return 'default';
  if (isCorrectOption) return 'correct';
  if (isPickedOption) return 'incorrect';
  return 'disabled';
}

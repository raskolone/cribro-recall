import React from 'react';
import { Check, X } from 'lucide-react';
import i18n from 'i18next';
import { QUIZ_TILE_STATE, QuizOptionState } from '../../utils/quizOptionStates';
import { gameTileAttrs } from '../../utils/gameTile';

/**
 * Kafelek odpowiedzi w quizie (wielokrotny wybór). Czysty widok: stan przychodzi z propsa,
 * wygląd z wspólnego kafelka gier (`utils/gameTile.ts`, tokeny motywu, kontrast AA sprawdzany testem).
 *
 * Stan poprawny/błędny niesie nie tylko kolor: ikona (Check / X) + tekst dla czytników ekranu.
 * Zamiast `disabled` jest `aria-disabled` — natywny `disabled` na iOS/Safari nakłada szary kolor
 * i krycie na cały przycisk, co po odpowiedzi blednie tekst.
 */

export interface QuizOptionProps {
  /** Treść odpowiedzi (zaufany HTML fiszek). */
  html: string;
  state: QuizOptionState;
  onSelect: () => void;
}

const QuizOption: React.FC<QuizOptionProps> = ({ html, state, onSelect }) => {
  const interactive = state === 'default';
  const tile = gameTileAttrs({ state: QUIZ_TILE_STATE[state] });

  return (
    <button
      type="button"
      data-testid="quiz-option"
      {...tile}
      aria-disabled={interactive ? undefined : true}
      onClick={interactive ? onSelect : undefined}
    >
      {state === 'correct' && <Check aria-hidden="true" size={22} strokeWidth={3} className="shrink-0 text-primary" />}
      {state === 'incorrect' && <X aria-hidden="true" size={22} strokeWidth={3} className="shrink-0 text-danger" />}
      <span className="min-w-0" dangerouslySetInnerHTML={{ __html: html }} />
      {state === 'correct' && <span className="sr-only">{i18n.t('Poprawna odpowiedź')}</span>}
      {state === 'incorrect' && <span className="sr-only">{i18n.t('Błędna odpowiedź')}</span>}
    </button>
  );
};

export default QuizOption;

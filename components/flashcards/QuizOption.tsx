import React from 'react';
import { Check, X } from 'lucide-react';
import i18n from 'i18next';
import { QUIZ_OPTION_STATES, QuizOptionState } from '../../utils/quizOptionStates';

/**
 * Kafelek odpowiedzi w quizie (wielokrotny wybór). Czysty widok: stan przychodzi z propsa,
 * kolory z `utils/quizOptionStates.ts` (tokeny motywu, kontrast AA sprawdzany testem).
 *
 * Stan poprawny/błędny niesie nie tylko kolor: ikona (Check / X) + tekst dla czytników ekranu.
 * Zamiast `disabled` jest `aria-disabled` — natywny `disabled` na iOS/Safari nakłada szary kolor
 * i krycie na cały przycisk, co po odpowiedzi blednie tekst.
 */

export interface QuizOptionProps {
  /** Treść odpowiedzi (zaufany HTML fiszek). */
  html: string;
  state: Exclude<QuizOptionState, 'hover' | 'selected'>;
  onSelect: () => void;
}

const QuizOption: React.FC<QuizOptionProps> = ({ html, state, onSelect }) => {
  const interactive = state === 'default';
  const recipe = QUIZ_OPTION_STATES[state];
  const cls = interactive ? `${recipe.classes} ${QUIZ_OPTION_STATES.hover.classes}` : recipe.classes;

  return (
    <button
      type="button"
      data-testid="quiz-option"
      data-state={state}
      aria-disabled={interactive ? undefined : true}
      onClick={interactive ? onSelect : undefined}
      className={cls}
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

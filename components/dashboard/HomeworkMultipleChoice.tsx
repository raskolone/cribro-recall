import React from 'react';
import { Check, X } from 'lucide-react';
import i18n from 'i18next';
import { gameTileAttrs } from '../../utils/gameTile';
import ExerciseInstruction from '../ui/ExerciseInstruction';
import { splitAtGap } from '../../utils/exerciseInstruction';
import { grammarFocusOf, hasValidKey, mcOptionTint, mcOptionViews } from '../../utils/multipleChoice';

/**
 * Wielokrotny wybór w pracy domowej: pytanie, etykieta zagadnienia gramatycznego (z i18n, nigdy z modelu),
 * cztery opcje w siatce 2×2 (jedna kolumna dopiero poniżej 360 px), każda we własnym pastelu z pozycji (nie z poprawności); luka `___` w zdaniu to zaokrąglone pole (`.mc-gap`) i — po odpowiedzi — stan poprawna/błędna (ikona + tekst,
 * nie sam kolor) z krótkim wyjaśnieniem. Odpowiedź to indeks wybranej opcji (jak dotąd). Po odpowiedzi
 * wybór jest ostateczny (kafelki zablokowane), o ile zadanie ma poprawny klucz.
 */
export interface HomeworkMultipleChoiceProps {
  item: { question?: string; options?: string[]; correctIndex?: number; explanation?: string; grammarFocus?: string };
  answer: unknown;
  onChange: (index: number) => void;
  /** Pokazywać wynik po odpowiedzi (domyślnie tak). */
  reveal?: boolean;
}

const HomeworkMultipleChoice: React.FC<HomeworkMultipleChoiceProps> = ({ item, answer, onChange, reveal = true }) => {
  const options: string[] = Array.isArray(item.options) ? item.options : [];
  const selected = typeof answer === 'number' ? answer : -1;
  const views = mcOptionViews(options.length, selected, item.correctIndex, reveal);
  const revealed = views.some((v) => v.verdict);
  const focus = grammarFocusOf(item);
  const correct = revealed && selected === item.correctIndex;
  const gap = splitAtGap(item.question);
  const explanation = typeof item.explanation === 'string' ? item.explanation.trim() : '';

  return (
    <div className="space-y-4">
      <ExerciseInstruction type="multiple_choice" />
      {focus && (
        <span
          data-testid="mc-focus"
          className="inline-flex items-center px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-text-hi text-xs font-bold uppercase tracking-wider"
        >
          {i18n.t('Zagadnienie')}: {i18n.t(focus.labelKey)}
        </span>
      )}
      <p data-testid="mc-question" className="prose-justified text-xl font-bold text-text-hi leading-relaxed">
        {gap ? (
          <>
            {gap.before}
            <span data-testid="mc-gap" role="img" aria-label={i18n.t('luka w zdaniu')} className="mc-gap" />
            {gap.after}
          </>
        ) : (
          item.question
        )}
      </p>
      <div
        data-testid="mc-grid"
        role="group"
        aria-label={i18n.t('Opcje odpowiedzi')}
        className="grid grid-cols-2 max-[359px]:grid-cols-1 auto-rows-fr gap-3"
      >
        {options.map((option, index) => {
          const view = views[index];
          const attrs = gameTileAttrs({ state: view.state, tint: mcOptionTint(index), toggle: !revealed, extraClass: 'game-tile--marked' });
          return (
            <button
              key={index}
              type="button"
              data-testid="mc-option"
              {...attrs}
              aria-disabled={revealed ? true : undefined}
              onClick={revealed ? undefined : () => onChange(index)}
            >
              {view.verdict === 'correct' && <Check aria-hidden="true" size={18} strokeWidth={3} className="game-tile__mark" />}
              {view.verdict === 'wrong' && <X aria-hidden="true" size={18} strokeWidth={3} className="game-tile__mark" />}
              <span className="min-w-0">{option}</span>
              {view.verdict === 'correct' && <span className="sr-only">{i18n.t('Poprawna odpowiedź')}</span>}
              {view.verdict === 'wrong' && <span className="sr-only">{i18n.t('Błędna odpowiedź')}</span>}
            </button>
          );
        })}
      </div>
      {revealed && hasValidKey(options, item.correctIndex) && (
        <div role="status" aria-live="polite" data-testid="mc-result" className="space-y-2">
          <p className="flex items-center gap-2 font-bold text-text-hi">
            {correct ? (
              <Check aria-hidden="true" size={20} strokeWidth={3} className="shrink-0 text-primary" />
            ) : (
              <X aria-hidden="true" size={20} strokeWidth={3} className="shrink-0 text-danger" />
            )}
            <span>{correct ? i18n.t('Poprawna odpowiedź') : i18n.t('Błędna odpowiedź')}</span>
          </p>
          {explanation && (
            <p data-testid="mc-explanation" className="rounded-2xl border-2 border-line-strong bg-surface-flat p-4 text-base text-text-hi leading-relaxed">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default HomeworkMultipleChoice;

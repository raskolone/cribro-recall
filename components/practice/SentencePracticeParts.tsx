import React, { forwardRef, useId } from 'react';
import { AlertCircle, Lightbulb, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Elementy ekranu „Tłumaczenie zdań" / „Korekta zdań": karta zdania, pole odpowiedzi i pasek
 * akcji. Jedna implementacja stylu (tokeny motywu, oba motywy), używana przez generator zdań
 * w Ćwiczeniach dowolnych. Bez cieni wewnętrznych („wgniecenia"): lekkie tło i wyraźna obwódka.
 */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200';

/** Karta zdania do przetłumaczenia (`translation`) albo zdania z błędem (`correction`). */
export const SentencePromptCard: React.FC<{
  variant: 'translation' | 'correction';
  index: number;
  sentence: string;
  /** Dla korekty: polskie znaczenie zdania z błędem (kontekst). */
  context?: string;
  hint?: string;
  hintOpen: boolean;
  onToggleHint: () => void;
}> = ({ variant, index, sentence, context, hint, hintOpen, onToggleHint }) => {
  const { t } = useTranslation();
  const hintId = useId();
  const correction = variant === 'correction';
  return (
    <div
      data-testid="sentence-prompt"
      data-variant={variant}
      className={`w-full space-y-2 rounded-2xl border bg-surface-flat p-4 text-left ${correction ? 'border-warn' : 'border-line-strong'}`}
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-xs font-bold text-text-hi">
          {correction && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />}
          {correction ? t('Znajdź i popraw błąd w zdaniu') : `${t('Zdanie')} ${index + 1}`}
        </span>
        {hint && (
          <button
            type="button"
            data-testid="hint-toggle"
            onClick={onToggleHint}
            aria-expanded={hintOpen}
            aria-controls={hintId}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-text-hi cursor-pointer hover:text-primary transition-colors motion-reduce:transition-none ${focusRing}`}
          >
            <Lightbulb className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            {hintOpen ? t('Ukryj wskazówkę') : t('Pokaż wskazówkę')}
          </button>
        )}
      </div>
      {correction && <span className="sr-only">{`${t('Zdanie')} ${index + 1}`}</span>}
      <p className={`font-bold leading-snug text-text-hi ${correction ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} text-center`}>{sentence}</p>
      {correction && context && context !== sentence && (
        <p className="border-t border-line-soft pt-2 text-sm text-text-2">
          <span className="font-semibold text-text-hi">{t('Kontekst i znaczenie')}: </span>
          <span className="italic">{context}</span>
        </p>
      )}
      <div id={hintId} hidden={!hintOpen || !hint} data-testid="hint-panel" className="rounded-lg border border-line-strong px-3 py-2 text-sm leading-snug text-text-2">
        {hint}
      </div>
    </div>
  );
};

/** Pole odpowiedzi: jasna powierzchnia z tokenów, wyraźna obwódka, focus, placeholder AA, tekst 16 px. */
export const SentenceAnswerInput = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }
>(({ label, className, ...props }, ref) => {
  const id = useId();
  return (
    <div className="w-full space-y-1.5 text-left">
      <label htmlFor={id} className="block text-sm font-bold text-text-hi">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={2}
        data-testid="sentence-answer"
        className={`block min-h-20 w-full resize-y rounded-xl border-2 border-text-mute bg-surface-flat px-3.5 py-3 text-base leading-snug text-text-hi placeholder:text-text-3 transition-colors motion-reduce:transition-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-default disabled:border-line-strong disabled:text-text-2 ${className ?? ''}`}
        {...props}
      />
    </div>
  );
});
SentenceAnswerInput.displayName = 'SentenceAnswerInput';

interface ActionConfig {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
  /** Podpowiedź skrótu (np. „Enter: Sprawdź”) — widoczna tylko przy myszy/klawiaturze, nie na dotyku. */
  shortcutHint?: string;
}

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-bold transition-colors motion-reduce:transition-none cursor-pointer disabled:cursor-default';

const buttonClass = {
  // Główna akcja: wypełniony akcent; nieaktywna — wyciszone tło, ale tekst ≥ 3:1 (text-3), nie wyblakły.
  primary: `${base} border-2 border-primary bg-accent text-accent-ink hover:brightness-110 disabled:border-line-strong disabled:bg-surface-flat disabled:text-text-3 disabled:hover:brightness-100`,
  // Drugorzędna: kontur i tekst text-hi, wyraźna także gdy nieaktywna.
  secondary: `${base} border-2 border-text-mute bg-transparent text-text-hi hover:border-primary disabled:border-line-strong disabled:text-text-3 disabled:hover:border-line-strong`,
} as const;

const ActionButton: React.FC<{ kind: keyof typeof buttonClass; action: ActionConfig; className?: string }> = ({ kind, action, className }) => (
  <button
    type="button"
    data-testid={action.testId}
    onClick={action.onClick}
    disabled={action.disabled || action.loading}
    aria-busy={action.loading || undefined}
    aria-keyshortcuts={action.shortcutHint ? 'Enter' : undefined}
    className={`${buttonClass[kind]} ${focusRing} ${className ?? ''}`}
  >
    {action.loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    {action.label}
    {action.shortcutHint && !action.disabled && !action.loading && (
      <span data-testid="shortcut-hint" aria-hidden="true" className="hidden pointer-fine:inline text-xs font-medium">
        {action.shortcutHint}
      </span>
    )}
  </button>
);

/**
 * Pasek akcji. Kolejność jest stała: na wąskim ekranie główna akcja na całą szerokość NAD parą
 * „Poprzednie | drugorzędna", od `sm` jeden rząd (Poprzednie po lewej, akcje po prawej).
 */
export const SentenceActionBar: React.FC<{
  previous: ActionConfig;
  primary: ActionConfig;
  secondary?: ActionConfig;
}> = ({ previous, primary, secondary }) => (
  <div data-testid="sentence-actions" className="grid w-full grid-cols-2 gap-2.5 pt-1 sm:flex sm:items-center">
    <ActionButton kind="secondary" action={{ ...previous, testId: previous.testId ?? 'action-previous' }} className="order-2 sm:order-none" />
    <div className="order-1 col-span-2 flex flex-col gap-2.5 sm:order-none sm:ml-auto sm:flex-row">
      <ActionButton kind="primary" action={{ ...primary, testId: primary.testId ?? 'action-primary' }} className="w-full sm:w-auto" />
    </div>
    {secondary && (
      <ActionButton kind="secondary" action={{ ...secondary, testId: secondary.testId ?? 'action-secondary' }} className="order-3 sm:order-none" />
    )}
  </div>
);

import React, { useState, useId, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { parseWordPairs, type WordPair } from '../../utils/customSetParser';

export interface CreateCustomSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, pairs: WordPair[]) => Promise<string>;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200';

export const CreateCustomSetModal: React.FC<CreateCustomSetModalProps> = ({ isOpen, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const titleId = useId();
  const nameInputId = useId();
  const textInputId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setRawText('');
      setErrorMessage(null);
      setIsSubmitting(false);
      // Fokus na polu nazwy
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const { valid, invalidLines } = parseWordPairs(rawText);
  const isValid = name.trim().length > 0 && valid.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage(t('Wpisz nazwę zestawu'));
      return;
    }
    if (valid.length === 0) {
      setErrorMessage(t('Dodaj co najmniej jedną parę słów'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSave(name.trim(), valid);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || t('Nie udało się zapisać zestawu, spróbuj ponownie'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-line-strong bg-base-100 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] flex flex-col">
        {/* Nagłówek */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h2 id={titleId} className="text-lg sm:text-xl font-bold text-text-hi">
            {t('Utwórz własny zestaw')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t('Zamknij')}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-text-2 hover:bg-surface-flat hover:text-text-hi cursor-pointer disabled:opacity-50 ${focusRing}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Formularz */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
            >
              <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nazwa zestawu */}
          <div className="space-y-1.5">
            <label htmlFor={nameInputId} className="block text-sm font-semibold text-text-hi">
              {t('Nazwa zestawu')}
            </label>
            <input
              ref={nameRef}
              id={nameInputId}
              type="text"
              data-testid="custom-set-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('np. Zwroty na wakacje')}
              disabled={isSubmitting}
              autoComplete="off"
              className={`w-full min-h-12 rounded-xl border-2 border-line-strong bg-surface-flat px-3.5 text-base text-text-hi placeholder:text-text-3 ${focusRing}`}
            />
          </div>

          {/* Pary słów */}
          <div className="space-y-1.5">
            <label htmlFor={textInputId} className="block text-sm font-semibold text-text-hi">
              {t('Pary słów (każda w nowej linii)')}
            </label>
            <p className="text-xs text-text-2 leading-relaxed">
              {t('Format: słowo - tłumaczenie')}
            </p>
            <textarea
              id={textInputId}
              data-testid="custom-set-words-input"
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`apple - jabłko\nbook - książka\ncat - kot`}
              disabled={isSubmitting}
              className={`w-full rounded-xl border-2 border-line-strong bg-surface-flat p-3 font-mono text-base text-text-hi placeholder:text-text-3 resize-y ${focusRing}`}
            />

            {/* Licznik rozpoznanych par */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <span
                data-testid="custom-set-parsed-count"
                className={`inline-flex items-center gap-1 font-semibold ${
                  valid.length > 0 ? 'text-primary' : 'text-text-3'
                }`}
              >
                {valid.length > 0 && <CheckCircle2 size={14} aria-hidden="true" />}
                {t('Rozpoznano {{count}} par', { count: valid.length })}
              </span>
              {invalidLines.length > 0 && (
                <span className="text-amber-500 font-medium truncate max-w-[240px]">
                  {invalidLines.length} {t('nierozpoznanych linii')}
                </span>
              )}
            </div>
          </div>

          {/* Przyciski akcji */}
          <div className="flex items-center justify-end gap-3 pt-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`min-h-11 px-4 rounded-xl border border-line-strong bg-surface-flat text-sm font-semibold text-text-2 hover:text-text-hi hover:bg-base-200 transition-colors cursor-pointer disabled:opacity-50 ${focusRing}`}
            >
              {t('Anuluj')}
            </button>
            <button
              type="submit"
              data-testid="custom-set-submit"
              disabled={!isValid || isSubmitting}
              className={`inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-primary text-accent-ink text-sm font-bold shadow-sm transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>{t('Zapisywanie...')}</span>
                </>
              ) : (
                <span>{t('Zapisz zestaw')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCustomSetModal;

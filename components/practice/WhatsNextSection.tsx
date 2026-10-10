import React from 'react';
import i18n from 'i18next';
import { HelpCircle, Languages, CheckCircle2, ArrowLeft, RotateCcw } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

export interface WhatsNextSectionProps {
  weakWords?: string[];
  onStartQuiz: () => void;
  /** Tłumaczenie / Korekta: otwiera ćwiczenia dowolne od kroku 3 (suwak liczby zdań i „Generuj"). */
  onStartSentences: (format: 'translation' | 'correction') => void;
  onBack: () => void;
  onReplay?: () => void;
  className?: string;
}

export const WhatsNextSection: React.FC<WhatsNextSectionProps> = ({
  weakWords = [],
  onStartQuiz,
  onStartSentences,
  onBack,
  onReplay,
  className = '',
}) => {
  const uniqueWeakWords = Array.from(new Set(weakWords.filter(Boolean)));

  return (
    <div data-testid="whats-next-section" className={`w-full max-w-2xl mx-auto space-y-6 text-left ${className}`}>
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-black text-text-hi" data-testid="whats-next-title">
          {i18n.t('Co dalej?')}
        </h3>
        <p className="text-sm text-content-muted">
          {i18n.t('Polecane po rozgrzewce — trudniejsza praktyka')}
        </p>
      </div>

      {uniqueWeakWords.length > 0 && (
        <div
          data-testid="whats-next-weak-words"
          className="rounded-2xl border border-line-soft bg-surface-elevated/80 dark:bg-surface-elevated/40 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-warn">
              {i18n.t('Słowa do powtórzenia')} ({uniqueWeakWords.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {uniqueWeakWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warn/10 text-warn border border-warn/20"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* Opcja 1: Quiz */}
        <Card
          data-testid="whats-next-quiz"
          className="p-5 border-2 border-line-soft hover:border-line-strong transition-all space-y-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft/20 text-accent">
              <HelpCircle size={22} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-text-hi">{i18n.t('Quiz')}</h4>
              <p className="text-xs text-content-muted mt-0.5">
                {i18n.t('Bez AI — utrwalenie słówek (słowa słabe na początku)')}
              </p>
            </div>
          </div>
          <Button
            onClick={onStartQuiz}
            className="w-full pointer-coarse:min-h-11"
            data-testid="whats-next-start-quiz"
          >
            {i18n.t('Rozpocznij quiz')}
          </Button>
        </Card>

        {/* Opcja 2: Tłumaczenie zdań */}
        <Card
          data-testid="whats-next-translation"
          className="p-5 border-2 border-line-soft hover:border-line-strong transition-all space-y-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Languages size={22} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-text-hi">{i18n.t('Tłumaczenie zdań')}</h4>
              <p className="text-xs text-content-muted mt-0.5">
                {i18n.t('Zdania AI z wykorzystaniem Twoich słów')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => onStartSentences('translation')}
            className="w-full pointer-coarse:min-h-11"
            data-testid="whats-next-start-translation"
          >
            {i18n.t('Rozpocznij tłumaczenie')}
          </Button>
        </Card>

        {/* Opcja 3: Korekta zdań */}
        <Card
          data-testid="whats-next-correction"
          className="p-5 border-2 border-line-soft hover:border-line-strong transition-all space-y-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/15 text-info">
              <CheckCircle2 size={22} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-text-hi">{i18n.t('Korekta zdań')}</h4>
              <p className="text-xs text-content-muted mt-0.5">
                {i18n.t('Znajdź i popraw błędy w zdaniach z AI')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => onStartSentences('correction')}
            className="w-full pointer-coarse:min-h-11"
            data-testid="whats-next-start-correction"
          >
            {i18n.t('Rozpocznij korektę')}
          </Button>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onReplay && (
          <Button
            onClick={onReplay}
            variant="secondary"
            className="flex-1 pointer-coarse:min-h-11 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} aria-hidden="true" />
            {i18n.t('Zagraj ponownie')}
          </Button>
        )}
        <Button
          onClick={onBack}
          variant="secondary"
          className="flex-1 pointer-coarse:min-h-11 flex items-center justify-center gap-2"
          data-testid="whats-next-back"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {i18n.t('Wróć do menu')}
        </Button>
      </div>
    </div>
  );
};

export default WhatsNextSection;

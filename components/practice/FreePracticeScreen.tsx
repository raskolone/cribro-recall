import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FlashcardSet } from '../../types';
import {
  DEFAULT_FREE_PRACTICE_MODE,
  FREE_PRACTICE_TYPES,
  freePracticeLaunch,
  groupFreePracticeSets,
  nextFreePracticeMode,
  type FreePracticeLaunch,
  type FreePracticeMode,
} from '../../utils/freePractice';

interface FreePracticeScreenProps {
  /** Zestawy kursanta (własne, z lekcji i słownictwo ogólne) — `useFlashcards().sets`. */
  sets: ReadonlyArray<FlashcardSet>;
  /** Start wybranego ćwiczenia; rodzic przechodzi do widoku nauki fiszek. */
  onStart: (launch: FreePracticeLaunch) => void;
  /** Powrót na pulpit. */
  onBack: () => void;
  /** Brak zestawów → przejście do słownictwa, gdzie można je utworzyć. */
  onOpenVocabulary?: () => void;
  /** Osobny ekran generatora zdań AI („Praktyka dodatkowa") — nie jest rodzajem z listy. */
  onOpenExtraPractice?: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200';

/**
 * Ekran „Ćwiczenia dowolne": kursant wybiera rodzaj ćwiczenia i materiał, a start
 * oddaje istniejącemu modułowi fiszek. Nic tu nie zapisuje do bazy ani nie zna pracy
 * domowej — wyniki zapisuje `saveSession` w module nauki, jak dotąd.
 *
 * Bez animacji w JS; przejścia kolorów wyłączają się przy prefers-reduced-motion.
 * Rodzaje to grupa radio (strzałki, Home/End), zestawy to zwykłe przyciski.
 */
const FreePracticeScreen: React.FC<FreePracticeScreenProps> = ({
  sets,
  onStart,
  onBack,
  onOpenVocabulary,
  onOpenExtraPractice,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<FreePracticeMode>(DEFAULT_FREE_PRACTICE_MODE);
  const radioRefs = useRef<Partial<Record<FreePracticeMode, HTMLButtonElement | null>>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { own, general } = groupFreePracticeSets(sets);
  const activeType = FREE_PRACTICE_TYPES.find((type) => type.mode === mode) ?? FREE_PRACTICE_TYPES[0];

  // Przycisk, którym kursant tu wszedł, znika razem z pulpitem — bez tego fokus spadałby na
  // <body> i klawiatura zaczynała od początku strony.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const onRadioKeyDown = (e: React.KeyboardEvent) => {
    const next = nextFreePracticeMode(mode, e.key);
    if (!next) return;
    e.preventDefault();
    setMode(next);
    radioRefs.current[next]?.focus();
  };

  const renderSet = (set: FlashcardSet) => (
    <li key={set.id}>
      <button
        type="button"
        data-testid="free-practice-set"
        data-set-id={set.id}
        onClick={() => onStart(freePracticeLaunch(mode, set.id))}
        aria-label={`${t('Rozpocznij')} — ${t(activeType.titleKey)} — ${set.title}`}
        className={`w-full min-h-12 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-line-strong bg-base-100/40 hover:bg-base-100/70 hover:border-primary/40 text-left cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-text-hi truncate">{set.title}</span>
          {(set.lessonTopic || set.description) && (
            <span className="block text-xs text-content-muted truncate">{set.lessonTopic || set.description}</span>
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-content-muted" aria-hidden="true" />
      </button>
    </li>
  );

  return (
    <section
      aria-labelledby="free-practice-title"
      data-testid="free-practice"
      className="w-full max-w-3xl mx-auto px-3 sm:px-4 pt-5 pb-24 sm:py-8 space-y-6"
    >
      <header className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          data-testid="free-practice-back"
          className={`inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          {t('Pulpit')}
        </button>
        <div>
          <h1
            id="free-practice-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-2xl sm:text-3xl font-black tracking-tight text-text-hi focus:outline-none"
          >
            {t('Ćwiczenia dowolne')}
          </h1>
          <p className="text-sm text-content-muted mt-1">
            {t('Wybierz rodzaj ćwiczenia i materiał — wyniki nie wpływają na prace domowe')}
          </p>
        </div>
      </header>

      <div>
        <h2
          id="free-practice-type-label"
          className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted mb-2"
        >
          {t('Rodzaj ćwiczenia')}
        </h2>
        <div
          role="radiogroup"
          aria-labelledby="free-practice-type-label"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          onKeyDown={onRadioKeyDown}
        >
          {FREE_PRACTICE_TYPES.map((type) => {
            const selected = type.mode === mode;
            return (
              <button
                key={type.mode}
                ref={(el) => {
                  radioRefs.current[type.mode] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                data-mode={type.mode}
                onClick={() => setMode(type.mode)}
                className={`min-h-14 px-4 py-2.5 rounded-xl border text-left cursor-pointer transition-colors motion-reduce:transition-none ${focusRing} ${
                  selected
                    ? 'border-primary bg-primary/10 text-text-hi'
                    : 'border-line-strong bg-base-100/40 text-content-muted hover:text-text-hi hover:bg-base-100/70'
                }`}
              >
                <span className="block text-sm font-bold">{t(type.titleKey)}</span>
                <span className="block text-xs text-content-muted">{t(type.descriptionKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2
          id="free-practice-sets-label"
          className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted mb-2"
        >
          {t('Materiał')}
        </h2>

        {own.length === 0 && general.length === 0 ? (
          <div
            data-testid="free-practice-empty"
            className="text-center py-10 px-4 rounded-2xl border border-dashed border-line-strong text-content-muted space-y-4"
          >
            <p className="text-sm">{t('Nie masz jeszcze żadnych zestawów')}</p>
            {onOpenVocabulary && (
              <button
                type="button"
                onClick={onOpenVocabulary}
                className={`inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 text-text-hi text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
              >
                {t('Przejdź do słownictwa')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {own.length > 0 && (
              <ul aria-labelledby="free-practice-sets-label" className="space-y-2">
                {own.map(renderSet)}
              </ul>
            )}
            {general.length > 0 && (
              <details data-testid="free-practice-general" className="group">
                <summary
                  className={`min-h-11 flex items-center gap-2 px-1 text-sm font-semibold text-content-muted hover:text-text-hi cursor-pointer select-none ${focusRing}`}
                >
                  <ChevronRight
                    size={14}
                    className="shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-90"
                    aria-hidden="true"
                  />
                  {t('Słownictwo ogólne')} ({general.length})
                </summary>
                <ul className="space-y-2 mt-2">{general.map(renderSet)}</ul>
              </details>
            )}
          </div>
        )}
      </div>

      {onOpenExtraPractice && (
        <div className="pt-2 border-t border-line-soft">
          <button
            type="button"
            onClick={onOpenExtraPractice}
            data-testid="free-practice-sentences"
            className={`w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left text-content-muted hover:text-text-hi hover:bg-base-100/40 cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <Sparkles size={16} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t('Zdania z AI')}</span>
                <span className="block text-xs text-content-muted">
                  {t('Osobny ekran z generatorem zdań — może dotyczyć także zadań od lektora')}
                </span>
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
};

export default FreePracticeScreen;

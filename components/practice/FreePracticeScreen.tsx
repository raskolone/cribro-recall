import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Languages, Layers, Link2, ListChecks, Search, Sparkles, SpellCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FlashcardSet } from '../../types';
import Button from '../ui/Button';
import { useStaggerIn } from '../../hooks/useStaggerIn';
import {
  DEFAULT_FREE_PRACTICE_MODE,
  FREE_PRACTICE_STEPS,
  FREE_PRACTICE_TYPES,
  MAX_FREE_PRACTICE_SETS,
  filterSetsByQuery,
  freePracticeLaunch,
  groupFreePracticeSets,
  isSetSelectable,
  nextFreePracticeMode,
  nextStep,
  previousStep,
  pruneSelection,
  setCardCount,
  startBlocker,
  stepNumber,
  summarizeSelection,
  toggleSetSelection,
  type FreePracticeAccent,
  type FreePracticeIcon,
  type FreePracticeLaunch,
  type FreePracticeMode,
  type FreePracticeStep,
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

const ICONS: Record<FreePracticeIcon, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>> = {
  layers: Layers,
  listChecks: ListChecks,
  link: Link2,
  spellCheck: SpellCheck,
  languages: Languages,
};

// Pełne nazwy klas (a nie sklejane z akcentu) — inaczej Tailwind ich nie zobaczy w źródle.
const ACCENT_CLASSES: Record<FreePracticeAccent, { chip: string }> = {
  primary: { chip: 'bg-primary/15 text-primary' },
  info: { chip: 'bg-info/15 text-info' },
  'accent-2': { chip: 'bg-accent-2/15 text-accent-2' },
  warn: { chip: 'bg-warn/15 text-warn' },
};

/**
 * Ekran „Ćwiczenia dowolne": trzy kroki — 1) rodzaj ćwiczenia, 2) zakres (wybór kilku zestawów
 * z wyszukiwarką i licznikiem), 3) start. Start oddaje istniejącemu modułowi fiszek; nic tu nie
 * zapisuje do bazy ani nie zna pracy domowej — wyniki zapisuje `saveSession` w module nauki.
 *
 * Wejście kafelków: CSS/WAAPI (`useStaggerIn`), wyłączone przy prefers-reduced-motion. Rodzaje to
 * grupa radio (strzałki, Home/End), zestawy to pola wyboru. Na telefonie pasek z przyciskiem
 * „Dalej / Start" jest przyklejony do dołu okna.
 */
const FreePracticeScreen: React.FC<FreePracticeScreenProps> = ({
  sets,
  onStart,
  onBack,
  onOpenVocabulary,
  onOpenExtraPractice,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<FreePracticeStep>('type');
  const [mode, setMode] = useState<FreePracticeMode>(DEFAULT_FREE_PRACTICE_MODE);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const radioRefs = useRef<Partial<Record<FreePracticeMode, HTMLButtonElement | null>>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const firstRender = useRef(true);

  const activeType = FREE_PRACTICE_TYPES.find((type) => type.mode === mode) ?? FREE_PRACTICE_TYPES[0];
  // Lista zestawów potrafi się zmienić w trakcie (np. synchronizacja) — wybór tylko z istniejących.
  const validSelected = useMemo(() => pruneSelection(selected, sets), [selected, sets]);
  const summary = useMemo(() => summarizeSelection(sets, validSelected), [sets, validSelected]);
  const { blocker, min } = startBlocker(mode, summary);
  const { own, general } = groupFreePracticeSets(sets);
  const hasSets = own.length > 0 || general.length > 0;

  useStaggerIn(panelRef, step);

  // Wejście: fokus na tytule (przycisk wejścia znika z pulpitem). Zmiana kroku: fokus na nagłówku
  // kroku, żeby klawiatura i czytnik trafiły do nowej treści.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      titleRef.current?.focus({ preventScroll: true });
      return;
    }
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const onRadioKeyDown = (e: React.KeyboardEvent) => {
    const next = nextFreePracticeMode(mode, e.key);
    if (!next) return;
    e.preventDefault();
    setMode(next);
    radioRefs.current[next]?.focus();
  };

  const goBack = () => (step === 'type' ? onBack() : setStep(previousStep(step)));

  const start = () => {
    if (blocker) return;
    onStart(freePracticeLaunch(mode, validSelected));
  };

  const primaryAction = () => {
    if (step === 'start') start();
    else setStep(nextStep(step));
  };

  const primaryDisabled = step === 'scope' ? blocker !== null : step === 'start' ? blocker !== null : false;
  const primaryLabel = step === 'start' ? t('Start') : t('Dalej');

  const stepLabel = (s: FreePracticeStep) => (s === 'type' ? t('Rodzaj') : s === 'scope' ? t('Materiał') : t('Start'));

  const blockerMessage =
    blocker === 'no-sets'
      ? t('Wybierz co najmniej jeden zestaw')
      : blocker === 'too-few-cards'
        ? t('Ten rodzaj potrzebuje co najmniej {{min}} kart', { min })
        : null;

  // --- Krok 1: rodzaj ------------------------------------------------------------------------
  const renderTypeStep = () => (
    <div className="space-y-4">
      <h2
        id="free-practice-type-label"
        ref={stepHeadingRef}
        tabIndex={-1}
        className="text-[12px] font-mono font-bold uppercase tracking-wider text-content-muted focus:outline-none"
      >
        {t('Rodzaj ćwiczenia')}
      </h2>
      <div
        role="radiogroup"
        aria-labelledby="free-practice-type-label"
        className="grid grid-cols-2 gap-2.5 sm:gap-3"
        onKeyDown={onRadioKeyDown}
      >
        {FREE_PRACTICE_TYPES.map((type) => {
          const selectedTile = type.available && type.mode === mode;
          const Icon = ICONS[type.icon];
          const accent = ACCENT_CLASSES[type.accent];
          return (
            <button
              key={type.mode}
              ref={(el) => {
                radioRefs.current[type.mode] = el;
              }}
              type="button"
              role="radio"
              data-stagger
              data-mode={type.mode}
              data-available={type.available}
              aria-checked={selectedTile}
              aria-disabled={type.available ? undefined : true}
              tabIndex={selectedTile ? 0 : -1}
              onClick={() => type.available && setMode(type.mode)}
              className={`relative flex flex-col items-start gap-2 min-h-32 p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-colors motion-reduce:transition-none ${focusRing} ${
                selectedTile
                  ? 'border-primary bg-primary/10 text-text-hi cursor-pointer'
                  : type.available
                    ? 'border-line-strong bg-surface-flat text-text-hi hover:border-primary/50 cursor-pointer'
                    : 'border-dashed border-line-strong bg-surface-flat text-text-3 cursor-default'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.chip}`}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className="block text-base font-bold leading-tight">{t(type.titleKey)}</span>
              <span className="block text-sm leading-snug text-text-2">{t(type.descriptionKey)}</span>
              {selectedTile && (
                <span
                  data-testid="free-practice-selected-mark"
                  className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-accent-ink"
                >
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
              {!type.available && (
                <span
                  data-testid="free-practice-soon"
                  className="absolute top-2.5 right-2.5 rounded-full border border-line-strong px-2 py-0.5 text-[12px] font-semibold text-text-2"
                >
                  {t('Wkrótce')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {onOpenExtraPractice && (
        <div data-stagger className="pt-2 border-t border-line-soft">
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
    </div>
  );

  // --- Krok 2: zakres ------------------------------------------------------------------------
  const limitReached = validSelected.length >= MAX_FREE_PRACTICE_SETS;

  const renderSetRow = (set: FlashcardSet) => {
    const count = setCardCount(set);
    const checked = validSelected.includes(set.id);
    const selectable = isSetSelectable(set);
    const blockedByLimit = !checked && limitReached;
    const disabled = !selectable || blockedByLimit;
    return (
      <li key={set.id} data-stagger>
        <label
          data-testid="free-practice-set"
          data-set-id={set.id}
          data-checked={checked}
          className={`relative flex min-h-14 items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-colors motion-reduce:transition-none ${
            checked ? 'border-primary bg-primary/10' : 'border-line-strong bg-surface-flat'
          } ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-primary/50'}`}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={() => setSelected((current) => toggleSetSelection(pruneSelection(current, sets), set.id))}
          />
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-base-200 ${
              checked ? 'border-primary bg-primary text-accent-ink' : 'border-text-mute bg-transparent text-transparent'
            }`}
          >
            <Check size={16} strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-base font-semibold break-words ${selectable ? 'text-text-hi' : 'text-text-3'}`}>{set.title}</span>
            {(set.lessonTopic || set.description) && (
              <span className="block text-sm text-text-2 truncate">{set.lessonTopic || set.description}</span>
            )}
          </span>
          <span className="shrink-0 text-sm font-medium text-text-2">
            {selectable ? t('cardCountLabel', { count }) : t('Zestaw jest pusty')}
          </span>
        </label>
      </li>
    );
  };

  const visibleOwn = filterSetsByQuery(own, query);
  const visibleGeneral = filterSetsByQuery(general, query);
  const searching = query.trim().length > 0;
  const nothingFound = searching && visibleOwn.length === 0 && visibleGeneral.length === 0;

  const renderScopeStep = () => (
    <div className="space-y-4">
      <h2
        id="free-practice-sets-label"
        ref={stepHeadingRef}
        tabIndex={-1}
        className="text-[12px] font-mono font-bold uppercase tracking-wider text-content-muted focus:outline-none"
      >
        {t('Materiał')}
      </h2>

      {!hasSets ? (
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
        <>
          <div data-stagger className="relative">
            <label htmlFor={searchId} className="sr-only">
              {t('Szukaj zestawów')}
            </label>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
            <input
              id={searchId}
              type="search"
              data-testid="free-practice-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Szukaj zestawów')}
              autoComplete="off"
              className={`w-full min-h-12 rounded-xl border-2 border-line-strong bg-surface-flat pl-10 pr-10 text-base text-text-hi placeholder:text-text-3 ${focusRing}`}
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('Wyczyść wyszukiwanie')}
                className={`absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-text-2 hover:text-text-hi cursor-pointer ${focusRing}`}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          <div data-stagger className="flex min-h-11 items-center justify-between gap-3">
            <p data-testid="free-practice-counter" role="status" aria-live="polite" className="text-sm font-semibold text-text-hi">
              {t('Zestawy {{sets}} · Karty {{cards}}', { sets: summary.sets, cards: summary.cards })}
            </p>
            {validSelected.length > 0 && (
              <button
                type="button"
                data-testid="free-practice-clear"
                onClick={() => setSelected([])}
                className={`min-h-11 px-3 rounded-lg text-sm font-semibold text-text-2 hover:text-text-hi cursor-pointer ${focusRing}`}
              >
                {t('Wyczyść wybór')}
              </button>
            )}
          </div>
          {limitReached && (
            <p className="text-sm text-text-2">{t('Limit zestawów w jednym ćwiczeniu {{max}}', { max: MAX_FREE_PRACTICE_SETS })}</p>
          )}

          {nothingFound ? (
            <p role="status" data-testid="free-practice-nothing" className="py-6 text-center text-sm text-text-2">
              {t('Nic nie znaleziono')}
            </p>
          ) : (
            <div className="space-y-4">
              {visibleOwn.length > 0 && (
                <ul aria-labelledby="free-practice-sets-label" className="space-y-2">
                  {visibleOwn.map(renderSetRow)}
                </ul>
              )}
              {visibleGeneral.length > 0 && (
                <details data-testid="free-practice-general" open={searching ? true : undefined} className="group">
                  <summary
                    className={`min-h-11 flex items-center gap-2 px-1 text-sm font-semibold text-text-2 hover:text-text-hi cursor-pointer select-none ${focusRing}`}
                  >
                    <ChevronRight
                      size={14}
                      className="shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-90"
                      aria-hidden="true"
                    />
                    {t('Słownictwo ogólne')} ({visibleGeneral.length})
                  </summary>
                  <ul className="space-y-2 mt-2">{visibleGeneral.map(renderSetRow)}</ul>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  // --- Krok 3: start -------------------------------------------------------------------------
  const renderStartStep = () => {
    const Icon = ICONS[activeType.icon];
    const accent = ACCENT_CLASSES[activeType.accent];
    const chosen = validSelected.map((id) => sets.find((set) => set.id === id)).filter((set): set is FlashcardSet => Boolean(set));
    return (
      <div className="space-y-4">
        <h2
          id="free-practice-start-label"
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-[12px] font-mono font-bold uppercase tracking-wider text-content-muted focus:outline-none"
        >
          {t('Gotowe do startu')}
        </h2>
        <div data-stagger data-testid="free-practice-summary" className="space-y-4 rounded-2xl border-2 border-line-strong bg-surface-flat p-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.chip}`}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold text-text-hi">{t(activeType.titleKey)}</p>
              <p className="text-sm text-text-2">{t('Zestawy {{sets}} · Karty {{cards}}', { sets: summary.sets, cards: summary.cards })}</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={t('Wybrane zestawy')}>
            {chosen.map((set) => (
              <li key={set.id} className="max-w-full truncate rounded-full border border-line-strong px-3 py-1 text-sm text-text-hi">
                {set.title}
              </li>
            ))}
          </ul>
        </div>
        {blockerMessage && (
          <p role="status" className="text-sm text-text-2">
            {blockerMessage}
          </p>
        )}
      </div>
    );
  };

  return (
    <section
      aria-labelledby="free-practice-title"
      data-testid="free-practice"
      className="flex w-full max-w-3xl mx-auto flex-col px-3 sm:px-4 pt-5 sm:py-8 max-md:flex-1"
    >
      <header className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          data-testid="free-practice-back"
          className={`inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl pointer-coarse:min-h-11 border border-line-strong bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
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

        <nav aria-label={t('Kroki')} data-testid="free-practice-steps" className="pt-1">
          <p className="mb-2 text-sm font-semibold text-text-2" data-testid="free-practice-step-counter">
            {t('Krok {{current}} z {{total}}', { current: stepNumber(step), total: FREE_PRACTICE_STEPS.length })}
          </p>
          <ol className="grid grid-cols-3 gap-2">
            {FREE_PRACTICE_STEPS.map((s) => {
              const done = stepNumber(s) < stepNumber(step);
              const current = s === step;
              return (
                <li key={s} data-step={s} aria-current={current ? 'step' : undefined} className="space-y-1.5">
                  <span
                    className={`block h-1.5 rounded-full ${done || current ? 'bg-primary' : 'bg-line-strong'}`}
                    aria-hidden="true"
                  />
                  <span className={`flex items-center gap-1 text-sm ${current ? 'font-bold text-text-hi' : 'font-medium text-text-2'}`}>
                    {done && <Check size={14} strokeWidth={3} className="shrink-0 text-primary" aria-hidden="true" />}
                    {stepNumber(s)}. {stepLabel(s)}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <div ref={panelRef} key={step} data-testid={`free-practice-step-${step}`} className="mt-5 pb-4">
        {step === 'type' && renderTypeStep()}
        {step === 'scope' && renderScopeStep()}
        {step === 'start' && renderStartStep()}
      </div>

      {/* Przyklejony do dołu okna: w zasięgu kciuka. `main` ma padding-bottom = safe-area, a sticky
          liczy od jego krawędzi, więc `bottom: -safe-area` rozciąga pasek aż do dołu okna (treść
          nie prześwituje pod nim), a własny padding trzyma przyciski nad wskaźnikiem „home". */}
      <div
        data-testid="free-practice-cta"
        className="sticky bottom-[calc(-1*env(safe-area-inset-bottom))] z-10 mt-auto -mx-3 sm:-mx-4 border-t border-line-soft bg-bg/90 px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <div className="flex gap-3">
          {step !== 'type' && (
            <Button
              type="button"
              variant="secondary"
              data-testid="free-practice-prev"
              onClick={goBack}
              className="min-h-12 flex-1 text-text-hi!"
            >
              {t('Wstecz')}
            </Button>
          )}
          <Button
            type="button"
            data-testid="free-practice-next"
            onClick={primaryAction}
            disabled={primaryDisabled}
            className="min-h-12 flex-[2]"
          >
            {primaryLabel}
          </Button>
        </div>
        {step === 'scope' && blockerMessage && (
          <p data-testid="free-practice-blocker" className="mt-2 text-center text-sm text-text-2">
            {blockerMessage}
          </p>
        )}
      </div>
    </section>
  );
};

export default FreePracticeScreen;

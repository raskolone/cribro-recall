import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Languages, Layers, Link2, ListChecks, Plus, Search, SpellCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FlashcardSet } from '../../types';
import Button from '../ui/Button';
import { useStaggerIn } from '../../hooks/useStaggerIn';
import {
  DEFAULT_FREE_PRACTICE_MODE,
  FREE_PRACTICE_STEPS,
  FREE_PRACTICE_TYPES,
  MAX_FREE_PRACTICE_SETS,
  MAX_SENTENCE_SOURCES,
  buildFreeLaunch,
  categorizeFreePracticeSets,
  filterSetsByQuery,
  groupFreePracticeSets,
  isSentenceMode,
  isSetSelectable,
  nextFreePracticeMode,
  nextStep,
  previousStep,
  pruneSelection,
  sentenceSourceCount,
  sentenceStartBlocker,
  setCardCount,
  startBlocker,
  stepNumber,
  summarizeSelection,
  toggleSetSelection,
  type AnyFreeLaunch,
  type FreePracticeAccent,
  type FreePracticeIcon,
  type FreePracticeInitial,
  type FreePracticeMode,
  type FreePracticeStep,
  type SentenceScope,
  type StartBlocker,
} from '../../utils/freePractice';
import { filterLessonsByQuery, pruneLessonSelection, type LessonLike } from '../../utils/freeSentenceScope';
import CreateCustomSetModal from './CreateCustomSetModal';
import SentenceCountSlider from './SentenceCountSlider';

export type SetTab = 'lessons' | 'general' | 'user';

interface FreePracticeScreenProps {
  /** Zestawy kursanta (własne, z lekcji i słownictwo ogólne) — `useFlashcards().sets`. */
  sets: ReadonlyArray<FlashcardSet>;
  /** Lekcje kursanta (zestawy słownictwa z lekcji) — źródło dla zdań z AI. */
  lessons?: ReadonlyArray<LessonLike>;
  /** Start wybranego ćwiczenia; rodzic przechodzi do modułu fiszek albo do generatora zdań. */
  onStart: (launch: AnyFreeLaunch) => void;
  /** Powrót na pulpit. */
  onBack: () => void;
  /** Brak zestawów → przejście do słownictwa, gdzie można je utworzyć. */
  onOpenVocabulary?: () => void;
  /** Tworzenie własnego zestawu bez AI. */
  onCreateSet?: (name: string, pairs: Array<{ term: string; definition: string }>) => Promise<string>;
  initial?: FreePracticeInitial;
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
const NO_LESSONS: ReadonlyArray<LessonLike> = [];

const FreePracticeScreen: React.FC<FreePracticeScreenProps> = ({
  sets,
  lessons = NO_LESSONS,
  onStart,
  onBack,
  onOpenVocabulary,
  onCreateSet,
  initial,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<FreePracticeStep>(initial?.step ?? 'type');
  const [mode, setMode] = useState<FreePracticeMode>(initial?.mode ?? DEFAULT_FREE_PRACTICE_MODE);
  const [selected, setSelected] = useState<string[]>(initial?.setIds ?? []);
  const [selectedLessons, setSelectedLessons] = useState<string[]>(initial?.lessonIds ?? []);
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
  const validLessons = useMemo(() => pruneLessonSelection(selectedLessons, lessons), [selectedLessons, lessons]);
  const summary = useMemo(() => summarizeSelection(sets, validSelected), [sets, validSelected]);
  const sentences = isSentenceMode(mode);
  const scope: SentenceScope = {
    setIds: validSelected,
    lessonIds: validLessons,
    topics: [],
  };
  const sourceCount = sentenceSourceCount(scope);
  const study = startBlocker(mode, summary);
  const min = study.min;
  const blocker: StartBlocker | null = sentences ? sentenceStartBlocker(scope) : study.blocker;
  const categorized = useMemo(() => categorizeFreePracticeSets(sets), [sets]);
  const initialTab = useMemo<SetTab>(() => {
    if (categorized.lessons.length > 0 || (sentences && lessons.length > 0)) return 'lessons';
    if (categorized.user.length > 0) return 'user';
    if (categorized.general.length > 0) return 'general';
    return 'lessons';
  }, [categorized, sentences, lessons]);
  const [activeTab, setActiveTab] = useState<SetTab>(initialTab);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sentenceCount, setSentenceCount] = useState(5);
  const hasSets = sets.filter((s) => !s.isDraft).length > 0;
  const hasLessons = sentences && lessons.length > 0;


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
    onStart(buildFreeLaunch(mode, scope, sentenceCount));
  };

  const primaryAction = () => {
    if (step === 'start') start();
    else setStep(nextStep(step));
  };

  const primaryDisabled = step === 'type' ? false : blocker !== null;
  const primaryLabel = step === 'start' ? t('Start') : t('Dalej');

  const stepLabel = (s: FreePracticeStep) => (s === 'type' ? t('Rodzaj') : s === 'scope' ? t('Materiał') : t('Start'));

  const blockerMessage =
    blocker === 'no-sets'
      ? t('Wybierz co najmniej jeden zestaw')
      : blocker === 'no-scope'
        ? t('Wybierz co najmniej jedno źródło')
        : blocker === 'too-many-sources'
          ? t('Wybierz najwyżej {{max}} źródeł', { max: MAX_SENTENCE_SOURCES })
          : blocker === 'too-few-cards'
            ? t('Ten rodzaj potrzebuje co najmniej {{min}} kart', { min })
            : null;

  // --- Krok 1: rodzaj ------------------------------------------------------------------------
  const warmupTypes = FREE_PRACTICE_TYPES.filter((type) => type.section === 'warmup');
  const advancedTypes = FREE_PRACTICE_TYPES.filter((type) => type.section === 'advanced');

  const renderTypeTile = (type: (typeof FREE_PRACTICE_TYPES)[number], isLarge: boolean) => {
    const selectedTile = type.mode === mode;
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
        aria-checked={selectedTile}
        tabIndex={selectedTile ? 0 : -1}
        onClick={() => setMode(type.mode)}
        className={`relative flex flex-col items-start gap-2 text-left rounded-2xl border-2 transition-colors motion-reduce:transition-none ${focusRing} ${
          isLarge ? 'min-h-36 sm:min-h-40 p-4 sm:p-5' : 'min-h-24 p-3.5 sm:p-4'
        } ${
          selectedTile
            ? 'border-primary bg-primary/10 text-text-hi cursor-pointer shadow-sm shadow-primary/10'
            : 'border-line-strong bg-surface-flat text-text-hi hover:border-primary/50 cursor-pointer'
        }`}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.chip}`}>
            <Icon size={22} aria-hidden="true" />
          </span>
          {type.recommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
              ★ {t('Polecane na start')}
            </span>
          )}
        </div>
        <span data-testid="tile-title" className={`block font-bold leading-tight ${isLarge ? 'text-lg sm:text-xl' : 'text-base'}`}>
          {t(type.titleKey)}
        </span>
        <span className="block text-sm leading-snug text-text-2">{t(type.descriptionKey)}</span>
        {selectedTile && (
          <span
            data-testid="free-practice-selected-mark"
            className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-accent-ink"
          >
            <Check size={14} strokeWidth={3} aria-hidden="true" />
          </span>
        )}
      </button>
    );
  };

  const renderTypeStep = () => (
    <div className="space-y-6">
      <div
        role="radiogroup"
        aria-label={t('Rodzaj ćwiczenia')}
        className="space-y-6"
        onKeyDown={onRadioKeyDown}
      >
        {/* Sekcja 1: Rozpocznij tutaj – rozgrzewka */}
        <div className="space-y-3">
          <h2
            ref={stepHeadingRef}
            tabIndex={-1}
            className="text-[12px] font-mono font-bold uppercase tracking-wider text-content-muted focus:outline-none"
          >
            {t('Rozpocznij tutaj – rozgrzewka')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {warmupTypes.map((type) => renderTypeTile(type, true))}
          </div>
        </div>

        {/* Sekcja 2: Trudniejsza praktyka */}
        <div className="space-y-3">
          <div>
            <h3 className="text-[12px] font-mono font-bold uppercase tracking-wider text-content-muted">
              {t('Trudniejsza praktyka')}
            </h3>
            <p className="text-xs text-text-2 mt-0.5">
              {t('Najlepiej po rozgrzewce — utrwal wiedzę w praktyce')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {advancedTypes.map((type) => renderTypeTile(type, false))}
          </div>
        </div>
      </div>
    </div>
  );

  // --- Krok 2: zakres ------------------------------------------------------------------------
  // Fiszki, quiz i dopasowanie: do 10 zestawów. Zdania z AI: łącznie do 5 źródeł (zestawy + lekcje).
  const limitReached = sentences ? sourceCount >= MAX_SENTENCE_SOURCES : validSelected.length >= MAX_FREE_PRACTICE_SETS;
  const limitMax = sentences ? MAX_SENTENCE_SOURCES : MAX_FREE_PRACTICE_SETS;
  const setsMax = sentences ? Math.max(0, MAX_SENTENCE_SOURCES - validLessons.length) : MAX_FREE_PRACTICE_SETS;
  const lessonsMax = Math.max(0, MAX_SENTENCE_SOURCES - validSelected.length);

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
            onChange={() => setSelected((current) => toggleSetSelection(pruneSelection(current, sets), set.id, setsMax))}
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

  const renderLessonRow = (lesson: LessonLike) => {
    const checked = validLessons.includes(lesson.id);
    const disabled = !checked && limitReached;
    return (
      <li key={lesson.id} data-stagger>
        <label
          data-testid="free-practice-lesson"
          data-lesson-id={lesson.id}
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
            onChange={() =>
              setSelectedLessons((current) => toggleSetSelection(pruneLessonSelection(current, lessons), lesson.id, lessonsMax))
            }
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
            <span className="block text-base font-semibold break-words text-text-hi">{lesson.title || lesson.topic}</span>
            {lesson.title && lesson.topic && <span className="block text-sm text-text-2 truncate">{lesson.topic}</span>}
          </span>
        </label>
      </li>
    );
  };

  const lessonSetsForScope = sentences && lessons.length > 0 ? [] : categorized.lessons;
  const visibleLessonsSets = filterSetsByQuery(lessonSetsForScope, query);
  const visibleGeneralSets = filterSetsByQuery(categorized.general, query);
  const visibleUserSets = filterSetsByQuery(categorized.user, query);
  const searching = query.trim().length > 0;
  const visibleLessons = hasLessons ? filterLessonsByQuery(lessons, query) : [];
  const totalVisibleCount =
    visibleLessonsSets.length +
    visibleGeneralSets.length +
    visibleUserSets.length +
    (sentences ? visibleLessons.length : 0);
  const nothingFound = searching && totalVisibleCount === 0;
  const searchLabel = sentences ? t('Szukaj zestawów i lekcji') : t('Szukaj zestawów');
  const counterText = sentences
    ? t('Źródła {{count}} z {{max}}', { count: sourceCount, max: MAX_SENTENCE_SOURCES })
    : t('Zestawy {{sets}} · Karty {{cards}}', { sets: summary.sets, cards: summary.cards });

  const selectedLessonsCount =
    validSelected.filter((id) => categorized.lessons.some((s) => s.id === id)).length +
    (sentences ? validLessons.length : 0);
  const selectedGeneralCount = validSelected.filter((id) => categorized.general.some((s) => s.id === id)).length;
  const selectedUserCount = validSelected.filter((id) => categorized.user.some((s) => s.id === id)).length;

  const activeTabCount =
    activeTab === 'lessons'
      ? visibleLessonsSets.length + (sentences ? visibleLessons.length : 0)
      : activeTab === 'general'
        ? visibleGeneralSets.length
        : activeTab === 'user'
          ? visibleUserSets.length
          : totalVisibleCount;

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

      {!hasSets && !hasLessons ? (
        <div
          data-testid="free-practice-empty"
          className="text-center py-10 px-4 rounded-2xl border border-dashed border-line-strong text-content-muted space-y-4"
        >
          <p className="text-sm">{t('Nie masz jeszcze żadnych zestawów')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="free-practice-empty-create"
              onClick={() => setIsCreateModalOpen(true)}
              className={`inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-primary text-accent-ink text-sm font-bold shadow-sm transition-colors motion-reduce:transition-none cursor-pointer ${focusRing}`}
            >
              <Plus size={16} aria-hidden="true" />
              {t('Utwórz własny zestaw')}
            </button>
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
        </div>
      ) : (
        <>
          <div data-stagger className="relative">
            <label htmlFor={searchId} className="sr-only">
              {searchLabel}
            </label>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
            <input
              id={searchId}
              type="search"
              data-testid="free-practice-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchLabel}
              autoComplete="off"
              className={`w-full min-h-12 rounded-xl border-2 border-line-strong bg-surface-flat pl-10 pr-10 text-base text-text-hi placeholder:text-text-3 ${focusRing}`}
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('Wyczyść wyszukiwanie')}
                className={`absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-text-2 hover:text-text-hi cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          <div data-stagger className="flex min-h-11 items-center justify-between gap-3">
            <p data-testid="free-practice-counter" role="status" aria-live="polite" className="text-sm font-semibold text-text-hi">
              {counterText}
            </p>
            {sourceCount > 0 && (
              <button
                type="button"
                data-testid="free-practice-clear"
                onClick={() => {
                  setSelected([]);
                  setSelectedLessons([]);
                }}
                className={`min-h-11 px-3 rounded-lg text-sm font-semibold text-text-2 hover:text-text-hi cursor-pointer transition-colors motion-reduce:transition-none ${focusRing}`}
              >
                {t('Wyczyść wybór')}
              </button>
            )}
          </div>
          {limitReached && (
            <p className="text-sm text-text-2">
              {sentences
                ? t('Limit źródeł w jednym ćwiczeniu {{max}}', { max: limitMax })
                : t('Limit zestawów w jednym ćwiczeniu {{max}}', { max: limitMax })}
            </p>
          )}

          {/* Zakładki kategorii zestawów oraz przycisk tworzenia */}
          <div data-stagger className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div
              role="tablist"
              aria-label={t('Kategorie zestawów')}
              className="flex items-center gap-1 p-1 rounded-xl bg-surface-flat border border-line-strong overflow-x-auto"
            >
              <button
                type="button"
                role="tab"
                data-testid="free-practice-tab-lessons"
                aria-selected={activeTab === 'lessons'}
                onClick={() => setActiveTab('lessons')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors motion-reduce:transition-none cursor-pointer ${focusRing} ${
                  activeTab === 'lessons'
                    ? 'bg-primary text-accent-ink shadow-xs'
                    : 'text-text-2 hover:text-text-hi hover:bg-base-100/50'
                }`}
              >
                <span>{t('Z moich lekcji')}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs font-mono ${
                    activeTab === 'lessons' ? 'bg-black/20 text-white' : 'bg-surface text-text-3'
                  }`}
                >
                  {visibleLessonsSets.length + (sentences ? visibleLessons.length : 0)}
                </span>
                {selectedLessonsCount > 0 && (
                  <span className="flex h-2 w-2 rounded-full bg-accent-ink ring-1 ring-white/50" />
                )}
              </button>

              <button
                type="button"
                role="tab"
                data-testid="free-practice-tab-general"
                aria-selected={activeTab === 'general'}
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors motion-reduce:transition-none cursor-pointer ${focusRing} ${
                  activeTab === 'general'
                    ? 'bg-primary text-accent-ink shadow-xs'
                    : 'text-text-2 hover:text-text-hi hover:bg-base-100/50'
                }`}
              >
                <span>{t('Gotowe zestawy')}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs font-mono ${
                    activeTab === 'general' ? 'bg-black/20 text-white' : 'bg-surface text-text-3'
                  }`}
                >
                  {visibleGeneralSets.length}
                </span>
                {selectedGeneralCount > 0 && (
                  <span className="flex h-2 w-2 rounded-full bg-accent-ink ring-1 ring-white/50" />
                )}
              </button>

              <button
                type="button"
                role="tab"
                data-testid="free-practice-tab-user"
                aria-selected={activeTab === 'user'}
                onClick={() => setActiveTab('user')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors motion-reduce:transition-none cursor-pointer ${focusRing} ${
                  activeTab === 'user'
                    ? 'bg-primary text-accent-ink shadow-xs'
                    : 'text-text-2 hover:text-text-hi hover:bg-base-100/50'
                }`}
              >
                <span>{sentences && (visibleLessons.length > 0 || hasLessons) ? t('Zestawy') : t('Moje zestawy')}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs font-mono ${
                    activeTab === 'user' ? 'bg-black/20 text-white' : 'bg-surface text-text-3'
                  }`}
                >
                  {visibleUserSets.length}
                </span>
                {selectedUserCount > 0 && (
                  <span className="flex h-2 w-2 rounded-full bg-accent-ink ring-1 ring-white/50" />
                )}
              </button>
            </div>

            <button
              type="button"
              data-testid="free-practice-create-set-button"
              onClick={() => setIsCreateModalOpen(true)}
              className={`inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm font-semibold transition-colors motion-reduce:transition-none cursor-pointer ${focusRing}`}
            >
              <Plus size={16} aria-hidden="true" />
              <span>{t('Utwórz własny zestaw')}</span>
            </button>
          </div>

          {nothingFound ? (
            <p role="status" data-testid="free-practice-nothing" className="py-6 text-center text-sm text-text-2">
              {t('Nic nie znaleziono')}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Sekcja 1: Z moich lekcji */}
              {activeTab === 'lessons' &&
                (visibleLessons.length > 0 || visibleLessonsSets.length > 0) && (
                  <div data-testid="free-practice-tab-content-lessons" className="space-y-4">
                    {visibleLessons.length > 0 && (
                      <div data-testid="free-practice-lessons" className="space-y-2">
                        <h3 id="free-practice-lessons-label" className="px-1 text-sm font-semibold text-text-2">
                          {t('Lekcje')}
                        </h3>
                        <ul aria-labelledby="free-practice-lessons-label" className="space-y-2">
                          {visibleLessons.map(renderLessonRow)}
                        </ul>
                      </div>
                    )}
                    {visibleLessonsSets.length > 0 && (
                      <div className="space-y-2">
                        {visibleLessons.length > 0 && (
                          <h3 id="free-practice-lesson-sets-label" className="px-1 text-sm font-semibold text-text-2">
                            {t('Zestawy słownictwa z lekcji')}
                          </h3>
                        )}
                        <ul
                          aria-labelledby={visibleLessons.length > 0 ? 'free-practice-lesson-sets-label' : 'free-practice-sets-label'}
                          className="space-y-2"
                        >
                          {visibleLessonsSets.map(renderSetRow)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              {activeTab === 'lessons' && visibleLessons.length === 0 && visibleLessonsSets.length === 0 && (
                <p className="py-6 text-center text-sm text-text-2">{t('Brak zestawów w tej kategorii')}</p>
              )}

              {/* Sekcja 2: Moje zestawy */}
              {activeTab === 'user' && (
                <div data-testid="free-practice-tab-content-user" className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 id="free-practice-own-sets-label" className="text-sm font-semibold text-text-2">
                      {sentences && (visibleLessons.length > 0 || hasLessons) ? t('Zestawy') : t('Moje zestawy')}
                    </h3>
                    <button
                      type="button"
                      data-testid="free-practice-create-set"
                      onClick={() => setIsCreateModalOpen(true)}
                      className={`inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer ${focusRing}`}
                    >
                      <Plus size={14} aria-hidden="true" />
                      {t('Utwórz własny zestaw')}
                    </button>
                  </div>
                  {visibleUserSets.length > 0 ? (
                    <ul aria-labelledby="free-practice-own-sets-label" className="space-y-2">
                      {visibleUserSets.map(renderSetRow)}
                    </ul>
                  ) : (
                    activeTab === 'user' && (
                      <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-text-2">
                        <p className="font-semibold text-text-hi">{t('Brak własnych zestawów')}</p>
                        <p className="mt-1 text-xs text-text-3">
                          {t('Utwórz swój pierwszy zestaw słówek klikając przycisk powyżej')}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Sekcja 3: Gotowe zestawy */}
              {activeTab === 'general' && (
                <div data-testid="free-practice-tab-content-general" className="space-y-2">
                  {visibleGeneralSets.length > 0 ? (
                    <details data-testid="free-practice-general" open={searching || activeTab === 'general' ? true : undefined} className="group">
                      <summary
                        className={`min-h-11 flex items-center gap-2 px-1 text-sm font-semibold text-text-2 hover:text-text-hi cursor-pointer select-none transition-colors motion-reduce:transition-none ${focusRing}`}
                      >
                        <ChevronRight
                          size={14}
                          className="shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-90"
                          aria-hidden="true"
                        />
                        {t('Gotowe zestawy')} ({visibleGeneralSets.length})
                      </summary>
                      <ul aria-label={t('Gotowe zestawy')} className="space-y-2 mt-2">{visibleGeneralSets.map(renderSetRow)}</ul>
                    </details>
                  ) : (
                    activeTab === 'general' && (
                      <p className="py-6 text-center text-sm text-text-2">{t('Brak zestawów w tej kategorii')}</p>
                    )
                  )}
                </div>
              )}

              {/* Informacja o wynikach w innych zakładkach podczas wyszukiwania */}
              {activeTabCount === 0 && !nothingFound && searching && (
                <div className="rounded-xl border border-line-strong bg-surface-flat p-4 text-center text-sm text-text-2 space-y-2">
                  <p>{t('Brak wyników w tej zakładce dla „{{query}}"', { query })}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {visibleLessonsSets.length + (sentences ? visibleLessons.length : 0) > 0 && activeTab !== 'lessons' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('lessons')}
                        className="text-xs font-semibold text-primary underline"
                      >
                        {t('Zobacz w')} {t('Z moich lekcji')} ({visibleLessonsSets.length + (sentences ? visibleLessons.length : 0)})
                      </button>
                    )}
                    {visibleGeneralSets.length > 0 && activeTab !== 'general' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className="text-xs font-semibold text-primary underline"
                      >
                        {t('Zobacz w')} {t('Gotowe zestawy')} ({visibleGeneralSets.length})
                      </button>
                    )}
                    {visibleUserSets.length > 0 && activeTab !== 'user' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('user')}
                        className="text-xs font-semibold text-primary underline"
                      >
                        {t('Zobacz w')} {t('Moje zestawy')} ({visibleUserSets.length})
                      </button>
                    )}
                  </div>
                </div>
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
    const chosenSets = validSelected.map((id) => sets.find((set) => set.id === id)).filter((set): set is FlashcardSet => Boolean(set));
    const chosenLessons = validLessons.map((id) => lessons.find((lesson) => lesson.id === id)).filter((l): l is LessonLike => Boolean(l));
    const chosen = [
      ...chosenSets.map((set) => ({ id: set.id, title: set.title })),
      ...chosenLessons.map((lesson) => ({ id: lesson.id, title: lesson.title || lesson.topic || '' })),
    ];
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
              <p className="text-sm text-text-2">{counterText}</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={sentences ? t('Wybrane źródła') : t('Wybrane zestawy')}>
            {chosen.map((set) => (
              <li key={set.id} className="max-w-full truncate rounded-full border border-line-strong px-3 py-1 text-sm text-text-hi">
                {set.title}
              </li>
            ))}
          </ul>
        </div>
        {sentences && (
          <div data-testid="free-practice-sentence-count-wrapper" className="rounded-2xl border-2 border-line-strong bg-surface-flat p-4">
            <SentenceCountSlider
              id="free-practice-sentence-count"
              value={sentenceCount}
              onChange={setSentenceCount}
            />
          </div>
        )}
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
            {t('Wybierz rodzaj ćwiczenia i materiał')}
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

      <CreateCustomSetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={async (setName, pairs) => {
          let newId: string;
          if (onCreateSet) {
            newId = await onCreateSet(setName, pairs);
          } else {
            newId = `set-custom-${Date.now()}`;
          }
          if (newId) {
            setSelected((prev) => (prev.includes(newId) ? prev : [...prev, newId].slice(0, setsMax)));
            setActiveTab('user');
          }
          return newId;
        }}
      />
    </section>
  );

};

export default FreePracticeScreen;

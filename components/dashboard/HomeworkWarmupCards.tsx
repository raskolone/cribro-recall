import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
// Nazwany eksport (sam rdzeń, bez wtyczek) — domyślny import w Node (testy)
// daje obiekt modułu CJS zamiast instancji gsap.
import { gsap } from 'gsap';
import { ArrowLeft, ArrowRight, Check, Flame, Keyboard, RotateCw, SkipForward, Volume2, Zap } from 'lucide-react';
import i18n from 'i18next';
import type { WarmupCard } from '../../types';
import {
  createWarmupCardsQueue,
  intentToAction,
  resolveWarmupCardsKey,
  shouldSuppressKeyUp,
  warmupCardsProgressPercent,
  type WarmupCardsIntent,
} from '../../utils/warmupCardsKeys';

interface HomeworkWarmupCardsProps {
  cards: WarmupCard[];
  /** Ostatnia karta → „Zakończ karty" (przejście do kolejnej fazy rozgrzewki lub zadań). */
  onDone: () => void;
  /** „Pomiń rozgrzewkę" — omija całą rozgrzewkę (karty i rozsypkę). */
  onSkip: () => void;
}

// Czasy w sekundach (GSAP).
const FLIP_DURATION = 0.5;
const PROGRESS_DURATION = 0.35;

// Zmiana karty = odrzucenie karty: bieżąca odlatuje w bok („Dalej" w lewo,
// „Wstecz" w prawo) z obrotem w tę samą stronę i lekkim opadnięciem, a następna
// wychodzi spod spodu. Czas i ease wyjścia jak w FlashcardsMode
// (FlashcardStudyScreen); kierunek, obrót, opadnięcie i wejście spod spodu według
// ustaleń — tam „dalej" leci w prawo z obrotem 20°, a nowa karta wjeżdża z boku.
const EXIT_DURATION = 0.3;
const EXIT_EASE = 'power2.in';
const EXIT_X_PERCENT = 120; // szerokość karty z zapasem na obrót — dalej i tak przycina ramka
const EXIT_DROP_PX = 60;
const EXIT_ROTATION_DEG = 15;
const ENTER_FROM_SCALE = 0.92;
const ENTER_FROM_OPACITY = 0.6;
const ENTER_DURATION = 0.3;
const ENTER_EASE = 'power2.out';
// Nowa karta rośnie od połowy wyjścia starej — wcześniej całą zasłania odlatująca
// kopia, więc nie byłoby widać powiększenia. Całe przejście ≈ 0,45 s.
const ENTER_DELAY = EXIT_DURATION / 2;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canSpeak = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Wymowa natywnym speechSynthesis (bez chmurowego TTS) — wołane wprost z obsługi kliknięcia (wymóg iOS). */
const speakEnglish = (text: string) => {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB';
  utterance.rate = 0.95;
  const voices = synth.getVoices?.() ?? [];
  const voice =
    voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200';

const hiddenBackface: React.CSSProperties = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };
// Obie strony w tej samej komórce siatki: karta ma wysokość dłuższej strony (nic
// nie jest ucinane), a min-h trzyma stały rozmiar przy krótkich tekstach.
const faceBase =
  '[grid-area:1/1] relative min-h-[15rem] sm:min-h-[17rem] rounded-2xl border px-5 sm:px-8 pt-12 pb-8 flex flex-col items-center justify-center text-center gap-3 min-w-0';
const faceCaption = 'absolute top-4 left-5 text-[10px] font-mono font-bold uppercase tracking-wider';
// Wygląd przycisku wymowy — także jego nieklikalnej kopii na odlatującej karcie.
const speakBadge = 'absolute top-2.5 right-2.5 z-10 p-2 rounded-full bg-base-200/90 border border-line-strong text-content-muted';

interface CardFacesProps {
  card: WarmupCard;
  flipped: boolean;
  /** Bez obrotu 3D (ograniczenie ruchu): strony zamieniają się klasą `invisible`. */
  flat: boolean;
  /** Identyfikatory testowe tylko na żywej karcie — odlatująca kopia ich nie dubluje. */
  live: boolean;
}

/** Awers i rewers — wspólne dla żywej karty i jej odlatującej kopii. */
const CardFaces: React.FC<CardFacesProps> = ({ card, flipped, flat, live }) => (
  <>
    {/* Awers: angielska fraza. Przy ograniczeniu ruchu strony zamieniają się bez obrotu. */}
    <div
      data-testid={live ? 'warmup-card-front' : undefined}
      aria-hidden={flipped}
      className={`${faceBase} border-line-strong bg-base-100 ${flat && flipped ? 'invisible' : ''}`}
      style={flat ? undefined : hiddenBackface}
    >
      <span className={`${faceCaption} text-content-muted`}>{i18n.t('Fraza')}</span>
      <p className="text-2xl sm:text-3xl font-black text-text-hi leading-snug break-words max-w-full">
        {card.term}
      </p>
      <span className="inline-flex items-center gap-1 text-xs text-content-muted">
        <RotateCw size={13} className="shrink-0" />
        {i18n.t('Kliknij lub wciśnij spację, aby zobaczyć znaczenie')}
      </span>
    </div>

    {/* Rewers: polskie znaczenie + opcjonalny przykład. */}
    <div
      data-testid={live ? 'warmup-card-back' : undefined}
      aria-hidden={!flipped}
      className={`${faceBase} border-primary/40 bg-base-100 ${flat && !flipped ? 'invisible' : ''}`}
      style={flat ? undefined : { ...hiddenBackface, transform: 'rotateY(180deg)' }}
    >
      <span className={`${faceCaption} text-primary`}>{i18n.t('Znaczenie')}</span>
      <p className="text-xl sm:text-2xl font-bold text-primary leading-snug break-words max-w-full">
        {card.definition}
      </p>
      {card.contextSentence && (
        <p className="text-sm text-content italic leading-relaxed max-w-md break-words">
          &ldquo;{card.contextSentence}&rdquo;
        </p>
      )}
    </div>
  </>
);

interface LeavingCard {
  card: WarmupCard;
  /** Nowy klucz = nowy element kopii przy każdym przejściu, bez stylów GSAP z poprzedniego. */
  key: number;
}

export const HomeworkWarmupCards: React.FC<HomeworkWarmupCardsProps> = ({ cards, onDone, onSkip }) => {
  const total = cards.length;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Kopia karty, która właśnie odlatuje — istnieje tylko w trakcie przejścia.
  const [leaving, setLeaving] = useState<LeavingCard | null>(null);
  // Odczyt raz przy wejściu w fazę kart (jak dotąd) — zmiana ustawienia systemu w trakcie
  // animacji zostawiałaby obrócony element w trybie bez obrotów.
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const speechAvailable = useMemo(canSpeak, []);

  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0;
  const card = cards[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === total - 1;

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostFlipRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const barReadyRef = useRef(false);
  const queueRef = useRef(createWarmupCardsQueue());
  const ghostKeyRef = useRef(0);
  // Źródło prawdy dla animacji obrotu — stan Reacta jest jego odbiciem dla renderu.
  const flippedRef = useRef(false);
  const doneRef = useRef(false);
  // Bieżące wartości dla obsług wołanych z GSAP i z listenera dokumentu.
  const liveRef = useRef({ index: safeIndex, total, card, onDone });
  liveRef.current = { index: safeIndex, total, card, onDone };

  // Wszystkie tweeny tego ekranu żyją w jednym kontekście GSAP — revert przy
  // odmontowaniu zabija niedokończone animacje i ich onComplete.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {}, rootRef);
    ctxRef.current = ctx;
    return () => {
      ctx.revert();
      ctxRef.current = null;
      barReadyRef.current = false;
    };
  }, []);

  const withGsap = (fn: () => void) => {
    if (ctxRef.current) ctxRef.current.add(fn);
    else fn();
  };

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    liveRef.current.onDone();
  };

  // Brak kart → nie ma czego pokazać, od razu dalej.
  useEffect(() => {
    if (total === 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const applyFlip = (value: boolean, animate: boolean) => {
    flippedRef.current = value;
    setFlipped(value);
    const el = flipRef.current;
    if (!el || reducedMotion) return;
    withGsap(() => {
      // Kolejne odwrócenie w trakcie obrotu startuje od bieżącego kąta — karta
      // nigdy nie zostaje w połowie.
      gsap.killTweensOf(el);
      if (animate) {
        gsap.to(el, { rotationY: value ? 180 : 0, duration: FLIP_DURATION, ease: 'power2.inOut' });
      } else {
        gsap.set(el, { rotationY: value ? 180 : 0 });
      }
    });
  };

  const releaseQueue = () => {
    const queued = queueRef.current.release();
    if (queued) runIntent(queued);
  };

  const endTransition = () => {
    // Scena wraca do wysokości nowej karty dopiero wtedy, gdy kopia już zniknęła.
    if (stageRef.current) stageRef.current.style.minHeight = '';
    releaseQueue();
  };

  const navigate = (dir: 1 | -1) => {
    const stageEl = stageRef.current;
    const cardEl = cardRef.current;
    const flipEl = flipRef.current;
    if (reducedMotion || !stageEl || !cardEl || !flipEl) {
      applyFlip(false, false);
      setIndex((i) => i + dir);
      return;
    }
    queueRef.current.lock();
    // Kopia startuje z kątem bieżącej karty — także w połowie odwracania.
    const angle = Number(gsap.getProperty(flipEl, 'rotationY')) || 0;
    // Krótsza nowa karta nie może od razu podciągnąć przycisków pod odlatującą kopię.
    stageEl.style.minHeight = `${stageEl.offsetHeight}px`;
    ghostKeyRef.current += 1;
    const outgoing: LeavingCard = { card: liveRef.current.card, key: ghostKeyRef.current };
    // Nowa karta i kopia starej trafiają do DOM-u razem, zanim ruszą tweeny.
    flushSync(() => {
      flippedRef.current = false;
      setFlipped(false);
      setLeaving(outgoing);
      setIndex((i) => i + dir);
    });
    const ghostEl = ghostRef.current;
    const ghostFlipEl = ghostFlipRef.current;
    withGsap(() => {
      gsap.killTweensOf(cardEl);
      gsap.killTweensOf(flipEl);
      // Nowa karta zaczyna awersem.
      gsap.set(flipEl, { rotationY: 0 });
      if (ghostEl && ghostFlipEl) {
        gsap.set(ghostFlipEl, { rotationY: angle });
        gsap.to(ghostEl, {
          xPercent: -dir * EXIT_X_PERCENT,
          y: EXIT_DROP_PX,
          rotation: -dir * EXIT_ROTATION_DEG,
          opacity: 0,
          duration: EXIT_DURATION,
          ease: EXIT_EASE,
          onComplete: () => setLeaving(null),
        });
      }
      // fromTo ustawia stan początkowy od razu, więc nowa karta czeka pod kopią
      // pomniejszona i przygaszona, zanim po ENTER_DELAY zacznie rosnąć.
      gsap.fromTo(
        cardEl,
        { scale: ENTER_FROM_SCALE, opacity: ENTER_FROM_OPACITY },
        {
          scale: 1,
          opacity: 1,
          duration: ENTER_DURATION,
          delay: ENTER_DELAY,
          ease: ENTER_EASE,
          // Nie „all": inline `perspective` tego elementu musi zostać.
          clearProps: 'transform,opacity',
          onComplete: endTransition,
        }
      );
    });
  };

  function runIntent(intent: WarmupCardsIntent) {
    const { index: current, total: count } = liveRef.current;
    const action = intentToAction(intent, current, count);
    if (action === 'finish') finish();
    else if (action === 'flip') applyFlip(!flippedRef.current, true);
    else if (action === 'next') navigate(1);
    else if (action === 'prev') navigate(-1);
  }

  const dispatch = (intent: WarmupCardsIntent, repeat = false) => {
    if (doneRef.current) return;
    const run = queueRef.current.request(intent, repeat);
    if (run) runIntent(run);
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Klawiatura bez fokusu na przycisku: listener dokumentu żyje tylko, póki faza
  // kart jest zamontowana. Klawisze z elementów spoza kart (np. okno nad nimi)
  // i z pól tekstowych zostają nietknięte.
  const hasCards = total > 0;
  useEffect(() => {
    if (!hasCards) return;
    const inScope = (target: EventTarget | null) => {
      if (!target || target === document || target === document.body || target === document.documentElement) {
        return true;
      }
      const root = rootRef.current;
      return Boolean(root && (target as Node).nodeType !== undefined && root.contains(target as Node));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!inScope(e.target)) return;
      const { intent, preventDefault } = resolveWarmupCardsKey(e);
      if (preventDefault) e.preventDefault();
      if (intent) dispatchRef.current(intent, e.repeat);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (inScope(e.target) && shouldSuppressKeyUp(e)) e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [hasCards]);

  // Cienki pasek postępu: pierwsze ustawienie bez animacji, potem szerokość dociąga GSAP.
  const percent = warmupCardsProgressPercent(safeIndex, total);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const width = `${percent}%`;
    withGsap(() => {
      if (!barReadyRef.current || reducedMotion) {
        gsap.set(bar, { width });
      } else {
        gsap.to(bar, { width, duration: PROGRESS_DURATION, ease: 'power2.out', overwrite: true });
      }
    });
    barReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, reducedMotion]);

  if (!card) return null;

  const navButton = `inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 sm:px-4 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi hover:bg-base-100 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${focusRing}`;

  return (
    <section
      ref={rootRef}
      aria-label={i18n.t('Fiszki rozgrzewki')}
      data-testid="warmup-cards-root"
      className="max-w-2xl mx-auto px-4 py-5 space-y-5 animate-in fade-in duration-300"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/35 text-primary text-xs font-bold uppercase tracking-wider">
          <Flame size={14} className="text-primary" />
          {i18n.t('Rozgrzewka językowa')}
        </span>

        <button
          type="button"
          onClick={onSkip}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi text-xs font-semibold transition-all cursor-pointer ${focusRing}`}
        >
          <span>{i18n.t('Pomiń rozgrzewkę')}</span>
          <SkipForward size={13} />
        </button>
      </div>

      <div className="rounded-2xl border border-line-strong bg-base-200/80 p-4 sm:p-6 shadow-lg space-y-4">
        {/* Nagłówek: rodzaj ćwiczenia, licznik (ogłaszany czytnikom ekranu) i pasek postępu */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={13} />
              {i18n.t('Niepunktowane • Fiszki')}
            </span>
            <span
              data-testid="warmup-cards-progress"
              aria-live="polite"
              aria-atomic="true"
              className="text-xs font-mono font-semibold text-content-muted tabular-nums"
            >
              {i18n.t('Karta {{current}} z {{total}}', { current: safeIndex + 1, total })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={i18n.t('Postęp fiszek')}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={safeIndex + 1}
            className="h-1 w-full rounded-full bg-line-strong overflow-hidden"
          >
            <div ref={barRef} data-testid="warmup-cards-bar" className="h-full rounded-full bg-primary" />
          </div>
        </div>

        {/* Scena karty: przy zmianie bieżąca karta wychodzi spod spodu (GSAP scale/opacity),
            a nad nią odlatuje kopia poprzedniej; przy odwróceniu karta obraca się (rotationY) */}
        <div ref={stageRef} data-testid="warmup-cards-stage" className="relative isolate">
          <div ref={cardRef} className="relative" style={{ perspective: '1200px' }}>
            <div
              ref={flipRef}
              data-testid="warmup-card"
              data-flipped={flipped ? 'true' : 'false'}
              onClick={() => dispatch('flip')}
              className="grid cursor-pointer select-none"
              style={{ transformStyle: reducedMotion ? 'flat' : 'preserve-3d' }}
            >
              <CardFaces card={card} flipped={flipped} flat={reducedMotion} live />
            </div>

            {/* Wymowa w rogu — poza obracanym elementem, więc dostępna na obu stronach */}
            {speechAvailable && (
              <button
                type="button"
                data-testid="warmup-cards-speak"
                onClick={() => speakEnglish(card.term)}
                aria-label={i18n.t('Odsłuchaj wymowę')}
                title={i18n.t('Odsłuchaj wymowę')}
                className={`${speakBadge} hover:text-text-hi transition-colors cursor-pointer ${focusRing}`}
              >
                <Volume2 size={18} />
              </button>
            )}
          </div>

          {/* Odlatująca kopia poprzedniej karty. Ramka przycina ją do wnętrza panelu:
              w poziomie do jego krawędzi (-inset-x = p-4/sm:p-6 panelu), w pionie do
              odstępów nad kartą i pod nią (-inset-y = space-y-4) — kopia nie wjeżdża
              na przyciski i nie rozpycha strony w poziomie. */}
          {leaving && (
            <div
              key={leaving.key}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-4 sm:-inset-x-6 -inset-y-4 z-20 overflow-hidden"
            >
              <div
                ref={ghostRef}
                data-testid="warmup-card-ghost"
                className="absolute inset-x-4 sm:inset-x-6 top-4"
                style={{ perspective: '1200px' }}
              >
                <div ref={ghostFlipRef} className="grid" style={{ transformStyle: 'preserve-3d' }}>
                  <CardFaces card={leaving.card} flipped={false} flat={false} live={false} />
                </div>
                {speechAvailable && (
                  <span className={speakBadge}>
                    <Volume2 size={18} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => dispatch('prev')}
            disabled={isFirst}
            aria-label={i18n.t('Poprzednia karta')}
            className={navButton}
          >
            <ArrowLeft size={15} className="shrink-0" />
            <span className="hidden sm:inline">{i18n.t('Wstecz')}</span>
          </button>

          <button
            type="button"
            onClick={() => dispatch('flip')}
            aria-label={i18n.t('Odwróć fiszkę')}
            className={navButton}
          >
            <RotateCw size={15} className="shrink-0" />
            <span className="hidden sm:inline">{i18n.t('Odwróć')}</span>
          </button>

          {/* Etykieta zmienia się już na starcie przejścia, więc klik w jego trakcie
              (np. drugi klik podwójnego „Dalej" z przedostatniej karty) nie kończy kart. */}
          <button
            type="button"
            data-testid="warmup-cards-next"
            onClick={() => dispatch(isLast && !queueRef.current.busy ? 'enter' : 'next')}
            aria-label={isLast ? i18n.t('Zakończ karty') : i18n.t('Następna karta')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 px-5 rounded-xl bg-primary text-accent-ink text-sm font-extrabold shadow-md transition-opacity cursor-pointer hover:opacity-90 ${focusRing}`}
          >
            <span className="whitespace-nowrap">{isLast ? i18n.t('Zakończ karty') : i18n.t('Dalej')}</span>
            {isLast ? <Check size={15} className="shrink-0" /> : <ArrowRight size={15} className="shrink-0" />}
          </button>
        </div>

        {/* Podpowiedź klawiatury tylko przy precyzyjnym wskaźniku (mysz/gładzik) */}
        <p
          data-testid="warmup-cards-hint"
          className="hidden pointer-fine:flex items-center justify-center gap-1.5 text-[11px] text-content-muted"
        >
          <Keyboard size={12} className="shrink-0" />
          <span>
            {i18n.t('← → zmiana karty, spacja odwraca')}
            {isLast ? ` · ${i18n.t('Enter kończy')}` : ''}
          </span>
        </p>
      </div>
    </section>
  );
};

export default HomeworkWarmupCards;

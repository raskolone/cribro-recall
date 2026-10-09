import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
// Nazwany eksport (sam rdzeń, bez wtyczek) — domyślny import w Node (testy)
// daje obiekt modułu CJS zamiast instancji gsap.
import { gsap } from 'gsap';
import { ArrowLeft, ArrowRight, Check, Flame, Keyboard, RotateCw, SkipForward, Zap } from 'lucide-react';
import i18n from 'i18next';
import type { WarmupCard } from '../../types';
import FlashcardFace from '../flashcards/FlashcardFace';
import PronunciationButtons, { type PronunciationLang } from '../flashcards/PronunciationButtons';
import {
  createWarmupCardsQueue,
  intentToAction,
  resolveWarmupCardsKey,
  shouldSuppressKeyUp,
  warmupCardsProgressPercent,
  type WarmupCardsIntent,
} from '../../utils/warmupCardsKeys';
import {
  FLIP_DEGREES,
  FLIP_DURATION,
  dragFollowVars,
  enterVars,
  exitFadeVars,
  exitMoveVars,
  snapBackVars,
  springEase,
  type CardDirection,
} from '../../utils/flashcardCardMotion';
import { SWIPE_TOUCH_ACTION_CLASS, useCardSwipe } from '../../hooks/useCardSwipe';

interface HomeworkWarmupCardsProps {
  cards: WarmupCard[];
  /** Ostatnia karta → „Zakończ karty" (przejście do kolejnej fazy rozgrzewki lub zadań). */
  onDone: () => void;
  /** „Pomiń rozgrzewkę" — omija całą rozgrzewkę (karty i rozsypkę). */
  onSkip: () => void;
}

// Ruch karty (obrót sprężyną, odlot/wjazd, przeciąganie) — parametry jak w module fiszek,
// patrz utils/flashcardCardMotion.ts. Tu zostaje tylko pasek postępu (w module: CSS 300 ms).
const PROGRESS_DURATION = 0.3;
// Obrót odwzorowuje sprężynę z modułu (stiffness 200, damping 20) własną funkcją easingu.
const FLIP_EASE = springEase();

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canSpeak = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Wymowa natywnym speechSynthesis (bez chmurowego TTS) — wołane wprost z obsługi kliknięcia (wymóg iOS). */
const speakEnglish = (text: string, lang: PronunciationLang, onEnd?: () => void) => {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  const voices = synth.getVoices?.() ?? [];
  const voice =
    voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
  if (voice) utterance.voice = voice;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  synth.speak(utterance);
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200';

/** UK/US w rogu karty — wygląd jak w module fiszek (PronunciationButtons), głos natywny. */
const WarmupSpeechButtons: React.FC<{ text: string }> = ({ text }) => {
  const [playing, setPlaying] = useState<PronunciationLang | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onPlay = (e: React.MouseEvent, lang: PronunciationLang) => {
    e.stopPropagation();
    setPlaying(lang);
    if (timer.current) clearTimeout(timer.current);
    // Zabezpieczenie: niektóre przeglądarki nie wołają onend po cancel().
    timer.current = setTimeout(() => setPlaying(null), 8000);
    speakEnglish(text, lang, () => setPlaying(null));
  };
  return <PronunciationButtons playing={playing} onPlay={onPlay} />;
};

export const HomeworkWarmupCards: React.FC<HomeworkWarmupCardsProps> = ({ cards, onDone, onSkip }) => {
  const total = cards.length;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
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
  const barRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const barReadyRef = useRef(false);
  const queueRef = useRef(createWarmupCardsQueue());
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
        gsap.to(el, { rotationY: value ? FLIP_DEGREES : 0, duration: FLIP_DURATION, ease: FLIP_EASE });
      } else {
        gsap.set(el, { rotationY: value ? FLIP_DEGREES : 0 });
      }
    });
  };

  const releaseQueue = () => {
    const queued = queueRef.current.release();
    if (queued) runIntent(queued);
  };

  // Zmiana karty jak w module fiszek: bieżąca odlatuje (x, obrót, krycie), dopiero
  // potem podmieniamy treść i nowa wjeżdża z boku (kierunek odwrotny do odlotu).
  const navigate = (dir: CardDirection) => {
    const cardEl = cardRef.current;
    const flipEl = flipRef.current;
    const step = dir === 'next' ? 1 : -1;
    if (reducedMotion || !cardEl || !flipEl) {
      applyFlip(false, false);
      setIndex((i) => i + step);
      return;
    }
    queueRef.current.lock();
    const swap = () => {
      // Nowa karta zawsze zaczyna awersem; obrót ustawiany bez animacji.
      flippedRef.current = false;
      setFlipped(false);
      setIndex((i) => i + step);
      withGsap(() => {
        gsap.killTweensOf(flipEl);
        gsap.set(flipEl, { rotationY: 0 });
        const enter = enterVars(dir);
        // fromTo ustawia stan początkowy od razu, więc nowa treść nie błyska w spoczynku.
        gsap.fromTo(cardEl, enter.from, { ...enter.to, onComplete: releaseQueue });
      });
    };
    withGsap(() => {
      gsap.killTweensOf(cardEl);
      // Ruch i krycie to dwa tweeny: karta znika (0,25 s), zanim doleci do krawędzi panelu,
      // a podmiana treści czeka na koniec ruchu (0,3 s), jak dotąd.
      gsap.to(cardEl, { ...exitMoveVars(dir, window.innerWidth), onComplete: swap });
      gsap.to(cardEl, exitFadeVars());
    });
  };

  function runIntent(intent: WarmupCardsIntent) {
    const { index: current, total: count } = liveRef.current;
    const action = intentToAction(intent, current, count);
    if (action === 'finish') finish();
    else if (action === 'flip') applyFlip(!flippedRef.current, true);
    else if (action === 'next') navigate('next');
    else if (action === 'prev') navigate('prev');
  }

  const dispatch = (intent: WarmupCardsIntent, repeat = false) => {
    if (doneRef.current) return;
    const run = queueRef.current.request(intent, repeat);
    if (run) runIntent(run);
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // --- Przeciąganie kartą (dotyk i mysz) -------------------------------------------
  // Wspólny hook PointerEvents (jak w module fiszek): karta podąża za palcem (opór, gdy
  // nieodwrócona), po zwolnieniu powyżej progu zmienia się karta w stronę ruchu palca
  // (lewo = następna, prawo = poprzednia), inaczej — albo gdy przeglądarka przejmie gest
  // (`pointercancel`) — wraca na miejsce. W rozgrzewce nie ma oceny: gest to zawsze nawigacja.
  const swipe = useCardSwipe({
    canStart: (e) => !(e.target as Element).closest?.('button') && !doneRef.current && !queueRef.current.busy,
    onFollow: (dx) => {
      const cardEl = cardRef.current;
      if (!cardEl || reducedMotion) return;
      withGsap(() => {
        gsap.to(cardEl, dragFollowVars(dx, flippedRef.current));
      });
    },
    onSwipe: ({ direction }) => {
      const { index: current, total: count } = liveRef.current;
      if (direction && intentToAction(direction, current, count)) {
        dispatchRef.current(direction);
        return true;
      }
      return false;
    },
    onSnapBack: () => {
      const cardEl = cardRef.current;
      if (cardEl && !reducedMotion) {
        withGsap(() => {
          gsap.killTweensOf(cardEl);
          gsap.to(cardEl, snapBackVars());
        });
      }
    },
  });

  const onCardClick = () => {
    if (swipe.consumeSuppressedClick()) return;
    dispatch('flip');
  };

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

  // Pasek postępu: pierwsze ustawienie bez animacji, potem szerokość dociąga GSAP.
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
  const speech = speechAvailable ? <WarmupSpeechButtons text={card.term} /> : undefined;

  return (
    // Bez overflow na tym panelu ani na żadnym przodku karty w jego obrębie: karta zajmuje całą
    // szerokość panelu, więc jakikolwiek clip ścinałby ją pionową krawędzią zaraz po starcie
    // odlotu. Poziomy scroll strony blokuje kontener strony (`main` w Dashboard,
    // `overflow-x-hidden` w powłoce DirectHomeworkScreen), a karta jest wtedy już przezroczysta.
    <section
      ref={rootRef}
      aria-label={i18n.t('Fiszki rozgrzewki')}
      data-testid="warmup-cards-root"
      className="max-w-3xl mx-auto px-4 py-5 space-y-6 animate-in fade-in duration-300"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/35 text-primary text-xs font-bold uppercase tracking-wider">
          <Flame size={14} className="text-primary" />
          {i18n.t('Rozgrzewka językowa')}
        </span>

        <button
          type="button"
          onClick={onSkip}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line-strong pointer-coarse:min-h-11 bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi text-xs font-semibold transition-all cursor-pointer ${focusRing}`}
        >
          <span>{i18n.t('Pomiń rozgrzewkę')}</span>
          <SkipForward size={13} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Nagłówek: rodzaj ćwiczenia, licznik (ogłaszany czytnikom ekranu) i pasek postępu —
            układ licznika i paska jak w module fiszek */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={13} />
              {i18n.t('Niepunktowane • Fiszki')}
            </span>
            <span
              data-testid="warmup-cards-progress"
              aria-live="polite"
              aria-atomic="true"
              className="font-mono text-sm tabular-nums"
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
            className="w-full bg-base-300 h-2 rounded-full overflow-hidden"
          >
            <div ref={barRef} data-testid="warmup-cards-bar" className="bg-primary h-full" />
          </div>
        </div>

        {/* Scena karty. Kontener (cardRef) dostaje od GSAP odlot/wjazd i przeciąganie, a
            element obracany (flipRef) — obrót sprężyną; perspektywa na kontenerze. */}
        <div ref={stageRef} data-testid="warmup-cards-stage" className="relative">
          <div
            ref={cardRef}
            className={`relative perspective-1000 ${SWIPE_TOUCH_ACTION_CLASS}`}
            {...swipe.bind}
          >
            <div
              ref={flipRef}
              data-testid="warmup-card"
              data-flipped={flipped ? 'true' : 'false'}
              onClick={onCardClick}
              className="grid cursor-pointer select-none"
              style={{ transformStyle: reducedMotion ? 'flat' : 'preserve-3d' }}
            >
              {/* Awers: angielska fraza + UK/US; rewers: znaczenie + przykład. Wspólny markup z
                  modułem fiszek (FlashcardFace). */}
              <FlashcardFace
                side="front"
                testId="warmup-card-front"
                label={i18n.t('Pojęcie')}
                turnedAway={flipped}
                flat={reducedMotion}
                actions={speech}
              >
                {card.term}
              </FlashcardFace>
              <FlashcardFace
                side="back"
                testId="warmup-card-back"
                label={i18n.t('Definicja')}
                turnedAway={!flipped}
                flat={reducedMotion}
                actions={speech}
                footer={
                  card.contextSentence ? (
                    <p className="mt-4 text-sm text-content italic leading-relaxed max-w-md break-words">
                      &ldquo;{card.contextSentence}&rdquo;
                    </p>
                  ) : undefined
                }
              >
                {card.definition}
              </FlashcardFace>
            </div>
          </div>
        </div>

        {/* Podpowiedź, przyciski i podpowiedź klawiatury leżą nad sceną (z-10): odlatująca,
            obracana karta przechodzi pod nimi i nie zasłania ani nie przechwytuje kliknięć. */}
        <div data-testid="warmup-cards-controls" className="relative z-10 space-y-6">
          {/* Podpowiedź jak pod kartą w module; stała wysokość, żeby przyciski nie skakały */}
          <p className="min-h-5 flex items-center justify-center gap-1.5 text-center text-content-muted text-sm">
            {!flipped && (
              <>
                <RotateCw size={13} className="shrink-0" />
                <span>{i18n.t('Kliknij lub wciśnij spację, aby zobaczyć znaczenie')}</span>
              </>
            )}
          </p>

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

            {/* W trakcie przejścia drugi klik (np. podwójne „Dalej" z przedostatniej karty)
                trafia do kolejki jako „next", który na ostatniej karcie nic nie robi. */}
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
      </div>
    </section>
  );
};

export default HomeworkWarmupCards;

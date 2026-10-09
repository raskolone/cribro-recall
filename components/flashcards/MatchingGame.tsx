import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
// Nazwany eksport (sam rdzeń, bez wtyczek) — domyślny import w Node (testy)
// daje obiekt modułu CJS zamiast instancji gsap.
import { gsap } from 'gsap';
import { Check, Star, X } from 'lucide-react';
import i18n from 'i18next';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TTSButtons from './TTSButtons';
import {
  buildRound,
  initialMatchState,
  isRoundComplete,
  matchingScore,
  resolveWrong,
  selectTile,
  starsFor,
  type MatchCardInput,
  type MatchState,
  type MatchTile,
} from '../../utils/matchingGame';

export interface MatchingResult {
  pairs: number;
  mistakes: number;
  elapsedSeconds: number;
  score: number;
  stars: 1 | 2 | 3;
}

interface MatchingGameProps {
  cards: MatchCardInput[];
  onBack: () => void;
  /** „Wyjdź" w trakcie gry — rodzic pokazuje potwierdzenie. */
  onQuit: () => void;
  /** Wołane RAZ po dopasowaniu ostatniej pary (zapis sesji robi rodzic, jak dotąd). */
  onFinish: (result: MatchingResult) => void | Promise<void>;
  onPracticeSentences?: () => void;
  /** Przyciski wymowy kafelka; domyślnie TTSButtons (ta sama ścieżka TTS co wcześniej). */
  renderPronunciation?: (text: string) => React.ReactNode;
  /** Wymuszenie trybu bez ruchu (testy); domyślnie prefers-reduced-motion. */
  reducedMotion?: boolean;
}

// Czasy w sekundach (GSAP).
const SELECT_SCALE = 1.05;
const SELECT_DURATION = 0.15;
const SELECT_EASE = 'back.out(2)';
const MATCH_NUDGE_PX = 10;
const MATCH_PULSE_SCALE = 1.12;
const MATCH_IN = 0.12;
const MATCH_OUT = 0.35;
const MATCH_EASE = 'elastic.out(1, 0.5)';
const SHAKE_STEPS = [-8, 8, -6, 6, 0]; // ≈ 0,35 s łącznie
const SHAKE_STEP_DURATION = 0.07;
const WRONG_REDUCED_MS = 700;
const ENTER_DURATION = 0.3;
const ENTER_STAGGER = 0.04;
const ENTER_OFFSET_PX = 14;
const PROGRESS_DURATION = 0.35;
const COMBO_DURATION = 0.9;
const FINISH_DELAY_MS = 750;
const BURST_PAIR_COUNT = 8; // na kafelek → 16 iskier na parę
const BURST_FINAL_COUNT = 28;
const STAR_STAGGER = 0.25;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

type Phase = 'play' | 'done';

const MatchingGame: React.FC<MatchingGameProps> = ({
  cards,
  onBack,
  onQuit,
  onFinish,
  onPracticeSentences,
  renderPronunciation,
  reducedMotion,
}) => {
  const reduced = useMemo(() => reducedMotion ?? prefersReducedMotion(), [reducedMotion]);

  // Aktualne karty na potrzeby „Zagraj ponownie" — plansza NIE czyta ich w renderze.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Plansza i jej kolejność: raz na rundę (leniwa inicjalizacja / „Zagraj ponownie").
  const [round, setRound] = useState(0);
  const [tiles, setTiles] = useState<MatchTile[]>(() => buildRound(cards));
  const [game, setGame] = useState<MatchState>(initialMatchState);
  const gameRef = useRef<MatchState>(game);
  const [phase, setPhase] = useState<Phase>('play');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MatchingResult | null>(null);

  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const tileEls = useRef(new Map<string, HTMLElement>());
  const ctxRef = useRef<gsap.Context | null>(null);
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  const particles = useRef(new Set<HTMLElement>());

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeouts.current.delete(id);
      fn();
    }, ms);
    timeouts.current.add(id);
  }, []);

  // Jeden gsap.context na całe życie komponentu; revert + sprzątanie przy odmontowaniu.
  useLayoutEffect(() => {
    ctxRef.current = gsap.context(() => {}, rootRef);
    return () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current.clear();
      particles.current.forEach(p => p.remove());
      particles.current.clear();
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
  }, []);

  const run = useCallback((fn: () => void) => {
    if (reduced) return;
    if (ctxRef.current) ctxRef.current.add(fn);
  }, [reduced]);

  // --- Liczniki ---------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'play') return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, round]);

  const totalPairs = tiles.length / 2;
  const matchedCount = game.matchedPairIds.length;

  // Pasek postępu — animowana szerokość.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const width = `${totalPairs > 0 ? (matchedCount / totalPairs) * 100 : 0}%`;
    if (reduced || matchedCount === 0) {
      gsap.set(bar, { width });
    } else {
      run(() => {
        gsap.to(bar, { width, duration: PROGRESS_DURATION, ease: 'power2.out', overwrite: true });
      });
    }
  }, [matchedCount, totalPairs, round, phase, reduced, run]);

  // Wejście planszy — raz na rundę, kafelki kaskadowo.
  useLayoutEffect(() => {
    if (phase !== 'play' || reduced) return;
    const els = tiles.map(t => tileEls.current.get(t.key)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    run(() => {
      gsap.fromTo(
        els,
        { y: ENTER_OFFSET_PX, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: ENTER_DURATION,
          stagger: ENTER_STAGGER,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      );
    });
    // Celowo tylko [round, phase]: tiles zmienia się razem z round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, phase]);

  // Nakładka kombinacji („x2", „x3") — czysto wizualna.
  useLayoutEffect(() => {
    const el = comboRef.current;
    if (!el || game.combo < 2 || reduced) return;
    run(() => {
      gsap.killTweensOf(el);
      gsap.fromTo(
        el,
        { scale: 0.6, opacity: 1, y: 0 },
        { scale: 1.1, y: -12, duration: 0.25, ease: 'back.out(2)' },
      );
      gsap.to(el, { opacity: 0, duration: COMBO_DURATION - 0.25, delay: 0.25, ease: 'power1.in' });
    });
  }, [game.combo, reduced, run]);

  // Gwiazdki na ekranie końcowym: wskakują po kolei, z błyskiem.
  useLayoutEffect(() => {
    if (phase !== 'done' || !result || reduced) return;
    const root = starsRef.current;
    if (!root) return;
    const earned = root.querySelectorAll<HTMLElement>('[data-star]');
    run(() => {
      gsap.fromTo(
        earned,
        { scale: 0, rotation: -90, opacity: 0 },
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.5,
          stagger: STAR_STAGGER,
          ease: 'back.out(2.5)',
          clearProps: 'opacity',
        },
      );
      gsap.fromTo(
        root.querySelectorAll('[data-star-filled]'),
        { filter: 'brightness(2.2)' },
        { filter: 'brightness(1)', duration: 0.4, stagger: STAR_STAGGER, delay: 0.25, clearProps: 'filter' },
      );
    });
    // Burst cząsteczek (canvas-confetti nie jest zależnością).
    const rootEl = rootRef.current;
    if (rootEl) {
      const target = root.getBoundingClientRect();
      const base = rootEl.getBoundingClientRect();
      later(() => {
        spawnBurst(base, target.left + target.width / 2, target.top + target.height / 2, BURST_FINAL_COUNT, 110);
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, reduced]);

  // --- Efekty pomocnicze ------------------------------------------------------

  const spawnBurst = useCallback(
    (base: DOMRect, cx: number, cy: number, count: number, radius: number) => {
      const root = rootRef.current;
      if (!root || reduced) return;
      const colors = ['var(--accent)', 'var(--accent-soft)', 'var(--warn)'];
      run(() => {
        for (let i = 0; i < count; i++) {
          const dot = document.createElement('span');
          dot.setAttribute('aria-hidden', 'true');
          dot.style.cssText =
            `position:absolute;left:${cx - base.left}px;top:${cy - base.top}px;` +
            `width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;pointer-events:none;z-index:30;` +
            `background:${colors[i % colors.length]}`;
          root.appendChild(dot);
          particles.current.add(dot);
          const angle = Math.random() * Math.PI * 2;
          const dist = radius * (0.4 + Math.random() * 0.6);
          gsap.to(dot, {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            scale: 0.2,
            opacity: 0,
            duration: 0.5 + Math.random() * 0.3,
            ease: 'power2.out',
            onComplete: () => {
              dot.remove();
              particles.current.delete(dot);
            },
          });
        }
      });
    },
    [reduced, run],
  );

  const animateSelect = useCallback(
    (key: string | null, selected: boolean) => {
      if (!key) return;
      const el = tileEls.current.get(key);
      if (!el) return;
      run(() => {
        gsap.killTweensOf(el);
        gsap.to(el, {
          scale: selected ? SELECT_SCALE : 1,
          duration: SELECT_DURATION,
          ease: selected ? SELECT_EASE : 'power2.out',
        });
      });
    },
    [run],
  );

  const animateMatch = useCallback(
    (pair: [string, string]) => {
      const [a, b] = pair.map(k => tileEls.current.get(k)) as [HTMLElement | undefined, HTMLElement | undefined];
      if (!a || !b) return;
      const base = rootRef.current?.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2);
      const dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const nx = (dx / dist) * MATCH_NUDGE_PX;
      const ny = (dy / dist) * MATCH_NUDGE_PX;
      run(() => {
        [
          [a, nx, ny],
          [b, -nx, -ny],
        ].forEach(([el, x, y]) => {
          gsap.killTweensOf(el as HTMLElement);
          gsap
            .timeline()
            .to(el as HTMLElement, { x: x as number, y: y as number, scale: MATCH_PULSE_SCALE, duration: MATCH_IN, ease: 'power2.out' })
            .to(el as HTMLElement, { x: 0, y: 0, scale: 1, duration: MATCH_OUT, ease: MATCH_EASE });
        });
      });
      if (base) {
        spawnBurst(base, ra.left + ra.width / 2, ra.top + ra.height / 2, BURST_PAIR_COUNT, 60);
        spawnBurst(base, rb.left + rb.width / 2, rb.top + rb.height / 2, BURST_PAIR_COUNT, 60);
      }
    },
    [run, spawnBurst],
  );

  const settleWrong = useCallback(() => {
    gameRef.current = resolveWrong(gameRef.current);
    setGame(gameRef.current);
  }, []);

  const animateWrong = useCallback(
    (pair: [string, string]) => {
      if (reduced) {
        later(settleWrong, WRONG_REDUCED_MS);
        return;
      }
      const els = pair.map(k => tileEls.current.get(k)).filter((el): el is HTMLElement => !!el);
      if (els.length === 0) {
        settleWrong();
        return;
      }
      run(() => {
        els.forEach((el, i) => {
          gsap.killTweensOf(el);
          gsap.set(el, { scale: 1 });
          const tl = gsap.timeline(i === 0 ? { onComplete: settleWrong } : undefined);
          SHAKE_STEPS.forEach(x => tl.to(el, { x, duration: SHAKE_STEP_DURATION, ease: 'none' }));
        });
      });
    },
    [reduced, run, later, settleWrong],
  );

  // --- Kliknięcie kafelka -----------------------------------------------------

  const handleTileClick = useCallback(
    (key: string) => {
      if (phase !== 'play' || finishedRef.current) return;
      const before = gameRef.current;
      const r = selectTile(before, tiles, key);
      if (r.event === 'ignored') return;
      gameRef.current = r.state;
      setGame(r.state);

      switch (r.event) {
        case 'select':
          animateSelect(key, true);
          break;
        case 'deselect':
          animateSelect(key, false);
          break;
        case 'switch':
          animateSelect(before.selectedKey, false);
          animateSelect(key, true);
          break;
        case 'match':
          if (r.pair) animateMatch(r.pair);
          break;
        case 'wrong':
          if (r.pair) animateWrong(r.pair);
          break;
      }

      if (r.event === 'match' && isRoundComplete(r.state, tiles)) {
        finishedRef.current = true;
        const elapsedSeconds = Math.floor((Date.now() - startRef.current) / 1000);
        const pairs = tiles.length / 2;
        const final: MatchingResult = {
          pairs,
          mistakes: r.state.mistakes,
          elapsedSeconds,
          score: matchingScore(elapsedSeconds, r.state.mistakes),
          stars: starsFor(pairs, r.state.mistakes),
        };
        setElapsed(elapsedSeconds);
        void onFinishRef.current(final);
        later(() => {
          setResult(final);
          setPhase('done');
        }, reduced ? 0 : FINISH_DELAY_MS);
      }
    },
    [phase, tiles, animateSelect, animateMatch, animateWrong, later, reduced],
  );

  const handleReplay = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current.clear();
    finishedRef.current = false;
    startRef.current = Date.now();
    const fresh = initialMatchState();
    gameRef.current = fresh;
    setTiles(buildRound(cardsRef.current)); // jedyne miejsce ponownego tasowania
    setGame(fresh);
    setElapsed(0);
    setResult(null);
    setRound(r => r + 1);
    setPhase('play');
  }, []);

  // --- Widok ------------------------------------------------------------------

  if (tiles.length === 0) return null;

  const pronunciation = renderPronunciation ?? ((text: string) => <TTSButtons text={text} />);

  if (phase === 'done' && result) {
    // Bez „:" w kluczu i18n — i18next traktuje go jako separator przestrzeni nazw.
    const starsLabel = `${i18n.t('Zdobyte gwiazdki')}: ${i18n.t('{{n}} z 3', { n: result.stars })}`;
    return (
      <div ref={rootRef} className="relative max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold text-text-hi">{i18n.t('Brawo!')}</h2>
        <div ref={starsRef} className="flex justify-center gap-3" role="img" aria-label={starsLabel}>
          {[1, 2, 3].map(n => {
            const earned = n <= result.stars;
            return (
              <Star
                key={n}
                aria-hidden="true"
                data-star=""
                {...(earned ? { 'data-star-filled': '' } : {})}
                className={`w-14 h-14 ${earned ? 'text-warn fill-current' : 'text-text-faint'}`}
              />
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {starsLabel}
        </p>
        <Card className="py-8">
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs font-mono uppercase tracking-widest text-text-2">{i18n.t('Pary')}</dt>
              <dd className="text-3xl font-black text-text-hi" data-testid="summary-pairs">{result.pairs}</dd>
            </div>
            <div>
              <dt className="text-xs font-mono uppercase tracking-widest text-text-2">{i18n.t('Błędy')}</dt>
              <dd className="text-3xl font-black text-text-hi" data-testid="summary-mistakes">{result.mistakes}</dd>
            </div>
            <div>
              <dt className="text-xs font-mono uppercase tracking-widest text-text-2">{i18n.t('Czas')}</dt>
              <dd className="text-3xl font-black text-text-hi" data-testid="summary-time">{formatTime(result.elapsedSeconds)}</dd>
            </div>
          </dl>
        </Card>
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
          <Button onClick={handleReplay} className="flex-1">{i18n.t('Zagraj ponownie')}</Button>
          <Button onClick={onBack} variant="secondary" className="flex-1">{i18n.t('Zakończ')}</Button>
          {onPracticeSentences && (
            <Button onClick={onPracticeSentences} variant="secondary" className="flex-1">
              {i18n.t('Przećwicz w zdaniach')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const wrongKeys: string[] = game.wrongPair ?? [];

  return (
    <div ref={rootRef} className="relative max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onQuit} className="text-text-2 hover:text-text-hi flex items-center gap-2">
          ← {i18n.t('Zakończ')}
        </button>
        <div className="font-mono text-xl font-bold text-text-hi" aria-label={i18n.t('Czas')}>
          {formatTime(elapsed)}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm text-text-2 mb-2">
          <span data-testid="match-progress">
            {i18n.t('Dopasowano {{done}} z {{total}}', { done: matchedCount, total: totalPairs })}
          </span>
          <span data-testid="match-mistakes">
            {i18n.t('Błędy')}: {game.mistakes}
          </span>
        </div>
        <div
          className="w-full bg-line-soft h-2 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalPairs}
          aria-valuenow={matchedCount}
        >
          <div ref={barRef} className="bg-primary h-full" style={{ width: 0 }} />
        </div>
      </div>

      {game.combo >= 2 && !reduced && (
        <div
          ref={comboRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 text-4xl font-black text-primary"
        >
          x{game.combo}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4" key={round}>
        {tiles.map(tile => {
          const matched = game.matchedPairIds.includes(tile.pairId);
          const selected = game.selectedKey === tile.key;
          const wrong = wrongKeys.includes(tile.key);
          const state = matched ? 'matched' : wrong ? 'wrong' : selected ? 'selected' : 'idle';
          const tone =
            state === 'matched'
              ? 'border-primary/40 bg-primary/10 opacity-70 cursor-default'
              : state === 'wrong'
                ? 'border-danger bg-danger/10 cursor-pointer'
                : state === 'selected'
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/30 cursor-pointer'
                  : 'border-line-strong bg-line-soft hover:border-primary/50 cursor-pointer';
          return (
            <div
              key={tile.key}
              ref={el => {
                if (el) tileEls.current.set(tile.key, el);
                else tileEls.current.delete(tile.key);
              }}
              role="button"
              tabIndex={matched ? -1 : 0}
              aria-pressed={selected}
              aria-disabled={matched}
              data-tile-key={tile.key}
              data-state={state}
              onClick={() => handleTileClick(tile.key)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTileClick(tile.key);
                }
              }}
              className={`relative min-h-[104px] md:min-h-[128px] rounded-xl border-2 px-3 pb-3 pt-9 flex items-center justify-center text-center text-text-hi select-none touch-manipulation transition-colors duration-150 ${tone}`}
            >
              <div className="absolute top-1 right-1" data-pronunciation onClick={e => e.stopPropagation()}>
                {pronunciation(tile.text)}
              </div>
              {matched && <Check aria-hidden="true" className="absolute top-2 left-2 w-4 h-4 text-primary" />}
              {wrong && <X aria-hidden="true" className="absolute top-2 left-2 w-4 h-4 text-danger" />}
              <span
                className="font-medium text-base md:text-lg leading-snug break-words"
                dangerouslySetInnerHTML={{ __html: tile.text }}
              />
              {matched && <span className="sr-only">{i18n.t('Dopasowano')}</span>}
              {wrong && <span className="sr-only">{i18n.t('Błędna para')}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchingGame;

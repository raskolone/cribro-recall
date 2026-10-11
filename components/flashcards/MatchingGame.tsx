import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
// Nazwany eksport (sam rdzeń, bez wtyczek) — domyślny import w Node (testy)
// daje obiekt modułu CJS zamiast instancji gsap.
import { gsap } from 'gsap';
import { Star } from 'lucide-react';
import i18n from 'i18next';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TTSButtons from './TTSButtons';
import WhatsNextSection from '../practice/WhatsNextSection';
import MatchingBoard from '../ui/MatchingBoard';
import {
  buildRound,
  columnsOf,
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
  wrongWords?: string[];
}

interface MatchingGameProps {
  cards: MatchCardInput[];
  onBack: () => void;
  /** „Wyjdź" w trakcie gry — rodzic pokazuje potwierdzenie. */
  onQuit: () => void;
  /** Wołane RAZ po dopasowaniu ostatniej pary (zapis sesji robi rodzic, jak dotąd). */
  onFinish: (result: MatchingResult) => void | Promise<void>;
  onPracticeSentences?: () => void;
  onStartQuiz?: (wrongWords: string[]) => void;
  onStartSentences?: (format: 'translation' | 'correction', wrongWords: string[]) => void;
  /** Przyciski wymowy kafelka; domyślnie TTSButtons (ta sama ścieżka TTS co wcześniej). */
  renderPronunciation?: (text: string) => React.ReactNode;
  /** Wymuszenie trybu bez ruchu (testy); domyślnie prefers-reduced-motion. */
  reducedMotion?: boolean;
}

// Czasy w sekundach (GSAP).
// Czas pokazania błędnej pary (stan „wrong” w CSS: krótkie wstrząśnięcie ramką, ikona i tekst).
const WRONG_SETTLE_MS = 700;
const PROGRESS_DURATION = 0.35;
const COMBO_DURATION = 0.9;
const FINISH_DELAY_MS = 750;
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
  onStartQuiz,
  onStartSentences,
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
  const wrongWordsRef = useRef<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('play');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MatchingResult | null>(null);

  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const rootRef = useRef<HTMLDivElement>(null);
  // Warstwa cząsteczek: JEDYNE dziecko `rootRef`, do którego trafiają `span`y wybuchu. Dodawane wprost do
  // korzenia (`space-y-6`) odbierały siatce „ostatnie dziecko" i dokładały jej margines na czas animacji,
  // więc cała plansza skakała o kilka pikseli w górę i z powrotem.
  const particleLayerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
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
      const root = particleLayerRef.current;
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

  const settleWrong = useCallback(() => {
    gameRef.current = resolveWrong(gameRef.current);
    setGame(gameRef.current);
  }, []);

  // --- Kliknięcie kafelka -----------------------------------------------------

  const handleTileClick = useCallback(
    (key: string) => {
      if (phase !== 'play' || finishedRef.current) return;
      const before = gameRef.current;
      const r = selectTile(before, tiles, key);
      if (r.event === 'ignored') return;
      gameRef.current = r.state;
      setGame(r.state);

      if (r.event === 'wrong' && r.pair) {
        const [k1, k2] = r.pair;
        [tiles.find(t => t.key === k1), tiles.find(t => t.key === k2)].forEach(t => {
          if (t) {
            const card = cardsRef.current.find(c => c.id === t.pairId);
            if (card?.term) wrongWordsRef.current.add(card.term);
          }
        });
        later(settleWrong, WRONG_SETTLE_MS);
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
          wrongWords: Array.from(wrongWordsRef.current),
        };
        setElapsed(elapsedSeconds);
        void onFinishRef.current(final);
        later(() => {
          setResult(final);
          setPhase('done');
        }, reduced ? 0 : FINISH_DELAY_MS);
      }
    },
    [phase, tiles, later, settleWrong, reduced],
  );

  const handleReplay = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current.clear();
    finishedRef.current = false;
    startRef.current = Date.now();
    const fresh = initialMatchState();
    gameRef.current = fresh;
    wrongWordsRef.current.clear();
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
      <div ref={rootRef} className="relative max-w-2xl mx-auto text-center space-y-8 w-full flex-1 flex flex-col justify-center min-h-[calc(100dvh-5rem)] px-3 sm:px-0 py-8">
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
        {onStartQuiz || onStartSentences ? (
          <WhatsNextSection
            weakWords={result.wrongWords || []}
            onStartQuiz={() => onStartQuiz?.(result.wrongWords || [])}
            onStartSentences={(format) => onStartSentences?.(format, result.wrongWords || [])}
            onBack={onBack}
            onReplay={handleReplay}
          />
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
            <Button onClick={handleReplay} className="flex-1">{i18n.t('Zagraj ponownie')}</Button>
            <Button onClick={onBack} variant="secondary" className="flex-1">{i18n.t('Zakończ')}</Button>
            {onPracticeSentences && (
              <Button onClick={onPracticeSentences} variant="secondary" className="flex-1">
                {i18n.t('Przećwicz w zdaniach')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const wrongKeys: string[] = game.wrongPair ?? [];
  const columns = columnsOf(tiles);

  return (
    <div ref={rootRef} className="relative max-w-5xl mx-auto space-y-6 w-full flex-1 flex flex-col justify-between min-h-[calc(100dvh-5rem)] px-3 sm:px-0 pb-8">
      <div ref={particleLayerRef} data-testid="match-particles" aria-hidden="true" className="pointer-events-none absolute inset-0 z-30" />
      <div className="flex items-center justify-between">
        <button onClick={onQuit} className="text-text-2 hover:text-text-hi flex items-center gap-2 pointer-coarse:min-h-11">
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

      <div className="flex-1" key={round}>
        <MatchingBoard
          left={columns.left}
          right={columns.right}
          hits={game.matchedPairIds}
          selectedKey={game.selectedKey}
          wrongKeys={wrongKeys}
          onPick={handleTileClick}
          renderLeftAddon={tile => pronunciation(tile.text)}
        />
      </div>
    </div>
  );
};

export default MatchingGame;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Flame, RotateCw, SkipForward, Volume2, Zap } from 'lucide-react';
import i18n from 'i18next';
import type { WarmupCard } from '../../types';

interface HomeworkWarmupCardsProps {
  cards: WarmupCard[];
  /** Ostatnia karta → „Zakończ karty" (przejście do kolejnej fazy rozgrzewki lub zadań). */
  onDone: () => void;
  /** „Pomiń rozgrzewkę" — omija całą rozgrzewkę (karty i rozsypkę). */
  onSkip: () => void;
}

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

export const HomeworkWarmupCards: React.FC<HomeworkWarmupCardsProps> = ({ cards, onDone, onSkip }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const speechAvailable = useMemo(canSpeak, []);

  const total = cards.length;
  const card = cards[index];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Brak kart → nie ma czego pokazać, od razu dalej.
  useEffect(() => {
    if (total === 0) onDone();
  }, [total, onDone]);

  const flip = useCallback(() => setFlipped((v) => !v), []);

  const goNext = useCallback(() => {
    if (isLast) {
      onDone();
      return;
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  }, [isLast, onDone]);

  const goBack = useCallback(() => {
    if (isFirst) return;
    setFlipped(false);
    setIndex((i) => i - 1);
  }, [isFirst]);

  if (!card) return null;

  const handleWrapperKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goBack();
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    // Klawisze z przycisków wewnątrz karty obsługuje sam przycisk.
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flip();
    }
  };

  const faceBase =
    'absolute inset-0 rounded-2xl border p-5 sm:p-7 flex flex-col items-center justify-center text-center gap-3 overflow-hidden break-words';

  return (
    <div
      className="max-w-2xl mx-auto px-4 py-5 space-y-5 animate-in fade-in duration-300"
      onKeyDown={handleWrapperKeyDown}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/35 text-primary text-xs font-bold uppercase tracking-wider">
            <Flame size={14} className="text-primary" />
            {i18n.t('Rozgrzewka językowa')}
          </span>
          <span className="text-[11px] font-mono text-content-muted" data-testid="warmup-cards-progress">
            {i18n.t('Karta {{current}} z {{total}}', { current: index + 1, total })}
          </span>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi text-xs font-semibold transition-all cursor-pointer"
        >
          <span>{i18n.t('Pomiń rozgrzewkę')}</span>
          <SkipForward size={13} />
        </button>
      </div>

      <div className="rounded-2xl border border-line-strong bg-base-200/80 p-5 sm:p-7 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={13} />
            {i18n.t('Niepunktowane • Fiszki')}
          </span>
          {speechAvailable && (
            <button
              type="button"
              data-testid="warmup-cards-speak"
              onClick={() => speakEnglish(card.term)}
              aria-label={i18n.t('Odsłuchaj wymowę')}
              title={i18n.t('Odsłuchaj wymowę')}
              className="p-2 rounded-full bg-base-100/80 border border-line-strong text-content-muted hover:text-text-hi transition-colors cursor-pointer"
            >
              <Volume2 size={18} />
            </button>
          )}
        </div>

        <div className="w-full h-64 sm:h-72" style={{ perspective: '1000px' }}>
          <div
            role="button"
            tabIndex={0}
            data-testid="warmup-card"
            data-flipped={flipped ? 'true' : 'false'}
            aria-label={i18n.t('Odwróć fiszkę')}
            onClick={flip}
            onKeyDown={handleCardKeyDown}
            className="relative w-full h-full cursor-pointer select-none rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{
              transformStyle: reducedMotion ? 'flat' : 'preserve-3d',
              transition: reducedMotion ? 'none' : 'transform 500ms ease',
              transform: !reducedMotion && flipped ? 'rotateY(180deg)' : 'none',
            }}
          >
            {/* Awers: angielska fraza. Przy ograniczeniu ruchu pokazujemy tylko aktywną stronę. */}
            {(!reducedMotion || !flipped) && (
              <div
                data-testid="warmup-card-front"
                aria-hidden={flipped}
                className={`${faceBase} border-line-strong bg-base-100/90`}
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
              >
                <p className="text-2xl sm:text-3xl font-black text-text-hi leading-snug">{card.term}</p>
                <span className="inline-flex items-center gap-1 text-xs text-content-muted">
                  <RotateCw size={13} />
                  {i18n.t('Kliknij lub wciśnij spację, aby zobaczyć znaczenie')}
                </span>
              </div>
            )}

            {/* Rewers: polskie znaczenie + opcjonalny przykład. */}
            {(!reducedMotion || flipped) && (
              <div
                data-testid="warmup-card-back"
                aria-hidden={!flipped}
                className={`${faceBase} border-primary/40 bg-base-100`}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: reducedMotion ? 'none' : 'rotateY(180deg)',
                }}
              >
                <p className="text-xl sm:text-2xl font-bold text-primary leading-snug">{card.definition}</p>
                {card.contextSentence && (
                  <p className="text-sm text-content italic leading-relaxed max-w-md">&ldquo;{card.contextSentence}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirst}
            aria-label={i18n.t('Poprzednia karta')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>{i18n.t('Wstecz')}</span>
          </button>

          <button
            type="button"
            onClick={flip}
            aria-label={i18n.t('Odwróć fiszkę')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi text-sm font-semibold transition-colors cursor-pointer"
          >
            <RotateCw size={15} />
            <span>{i18n.t('Odwróć')}</span>
          </button>

          <button
            type="button"
            data-testid="warmup-cards-next"
            onClick={goNext}
            aria-label={isLast ? i18n.t('Zakończ karty') : i18n.t('Następna karta')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-ink text-sm font-extrabold shadow-md transition-all cursor-pointer hover:opacity-90"
          >
            <span>{isLast ? i18n.t('Zakończ karty') : i18n.t('Dalej')}</span>
            {isLast ? <Check size={15} /> : <ArrowRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeworkWarmupCards;

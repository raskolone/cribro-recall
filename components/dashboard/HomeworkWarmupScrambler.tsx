import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  RotateCcw,
  Flame,
  CheckCircle2,
  Lightbulb,
  SkipForward,
  Zap,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import i18n from 'i18next';
import { buildWarmupRounds, WarmupRound } from '../../utils/warmupRounds';
import { classifyUnscrambleAttempt, UnscrambleResult } from '../../utils/unscrambleGrading';
import { HomeworkType } from '../../types';

export interface WarmupAttemptResult {
  /** Indeks elementu w oryginalnej tablicy `sentences` — identyfikator zgodny z istniejącym modelem odpowiedzi. */
  itemIndex: number;
  /** Rzeczywista odpowiedź kursanta, w kolejności, w jakiej ułożył słowa. */
  answerOrder: string[];
  result: UnscrambleResult;
}

interface HomeworkWarmupScramblerProps {
  sentences: any[];
  task?: { type?: HomeworkType } | null;
  onComplete: () => void;
  onSkip: () => void;
  /** Wywoływany raz na każdą ukończoną (w pełni ułożoną) próbę — wywołujący decyduje, jak i czy zapisać próbę trwale. */
  onAttemptResult?: (attempt: WarmupAttemptResult) => void;
}

function extractWords(sentence: string): string[] {
  if (!sentence) return [];
  const clean = sentence.trim().replace(/\s+/g, ' ');
  return clean.split(' ').filter(Boolean);
}

// Kolorowe, estetyczne palety kafelków w stylu Nocturne Green & Emerald
const TILE_COLORS = [
  'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25',
  'bg-teal-500/15 border-teal-500/35 text-teal-300 hover:bg-teal-500/25',
  'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25',
  'bg-rose-500/15 border-rose-500/35 text-rose-300 hover:bg-rose-500/25',
  'bg-indigo-500/15 border-indigo-500/35 text-indigo-300 hover:bg-indigo-500/25',
];

export const HomeworkWarmupScrambler: React.FC<HomeworkWarmupScramblerProps> = ({
  sentences,
  task,
  onComplete,
  onSkip,
  onAttemptResult,
}) => {
  const warmupItems: WarmupRound[] = useMemo(() => buildWarmupRounds(sentences, task), [sentences, task]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Aktualnie wybrane kafelki (indeksy ze shuffled banku)
  const [selectedWordIndices, setSelectedWordIndices] = useState<number[]>([]);
  const [result, setResult] = useState<UnscrambleResult | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Zabezpiecza przed podwójnym kliknięciem "Następne zdanie" w tym samym evencie
  // (np. podwójny tap na dotyku), zanim React zdąży przerenderować z nowym currentIndex.
  const transitionLockRef = useRef(false);
  // Gwarantuje, że onComplete wywoła się dokładnie raz po ostatnim zdaniu, nawet
  // jeśli handleNext zostanie wywołane ponownie zanim rodzic zdąży odmontować komponent.
  const completeOnceRef = useRef(false);

  // Jeśli brak odpowiednich zdań na rozgrzewkę, od razu przechodzimy do zadań
  useEffect(() => {
    if (warmupItems.length === 0) {
      onSkip();
    }
  }, [warmupItems, onSkip]);

  const currentItem = warmupItems[currentIndex];

  // Zwalnia blokadę przejścia dopiero, gdy runda wskazywana przez currentIndex
  // faktycznie się wyrenderowała — chroni przed drugim, szybkim dotknięciem
  // "Następne zdanie" zanim React zdąży scalić stan nowej rundy.
  useEffect(() => {
    transitionLockRef.current = false;
  }, [currentIndex]);

  // Słowa wzorcowe
  const targetWords = useMemo(() => {
    if (!currentItem) return [];
    return extractWords(currentItem.targetSentence);
  }, [currentItem]);

  // Pomieszany bank słów z unikalnymi identyfikatorami
  const shuffledBank = useMemo(() => {
    if (!targetWords || targetWords.length === 0) return [];
    const bank = targetWords.map((word, originalIdx) => ({
      word,
      originalIdx,
    }));
    // Fisher-Yates shuffle
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bank[i], bank[j]] = [bank[j], bank[i]];
    }
    return bank;
  }, [targetWords]);

  if (!currentItem || warmupItems.length === 0) {
    return null;
  }

  const isDone = result === 'correct' || result === 'close';

  // Sprawdzamy czy ułożone słowa tworzą prawidłowe (lub "bliskie") zdanie
  const handleSelectTile = (bankIndex: number) => {
    if (isDone || selectedWordIndices.includes(bankIndex)) return;

    const nextSelected = [...selectedWordIndices, bankIndex];
    setSelectedWordIndices(nextSelected);

    // Jeśli wybrano wszystkie kafelki, klasyfikujemy próbę
    if (nextSelected.length === shuffledBank.length) {
      const answerOrder = nextSelected.map((idx) => shuffledBank[idx].word);
      const classification = classifyUnscrambleAttempt(answerOrder, targetWords);
      setResult(classification);

      onAttemptResult?.({
        itemIndex: currentItem.itemIndex,
        answerOrder,
        result: classification,
      });
      // `incorrect` zostaje bez specjalnego ekranu — kursant widzi ułożone,
      // niepasujące kafelki i może użyć "Resetuj" (istniejące zachowanie retry).
    }
  };

  const handleRemoveTile = (positionInSelected: number) => {
    if (isDone) return;
    setSelectedWordIndices((prev) => prev.filter((_, i) => i !== positionInSelected));
  };

  const handleReset = () => {
    setSelectedWordIndices([]);
    setResult(null);
  };

  const handleNext = () => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;

    if (currentIndex < warmupItems.length - 1) {
      // Reset stanu rundy w TYM SAMYM evencie co zmiana indeksu — jeśli reset
      // trafiał do osobnego useEffect uruchamianego po zmianie currentIndex,
      // pierwszy render nowej (krótszej) rundy widział jeszcze indeksy kafelków
      // z poprzedniej (dłuższej) rundy, więc `shuffledBank[bankIndex]` wypadało
      // poza zakres nowego banku i renderowanie kończyło się crashem
      // "Cannot read properties of undefined (reading 'word')".
      setSelectedWordIndices([]);
      setResult(null);
      setShowHint(false);
      setCurrentIndex((prev) => prev + 1);
      // Odblokowane dopiero, gdy nowa runda faktycznie się wyrenderuje (patrz
      // useEffect niżej) — zwolnienie od razu tutaj nie chroniłoby przed
      // szybkim podwójnym dotknięciem w tym samym momencie.
    } else if (!completeOnceRef.current) {
      completeOnceRef.current = true;
      onComplete();
    }
  };

  const isLast = currentIndex === warmupItems.length - 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 animate-in fade-in duration-300">
      {/* Pasek górny rozgrzewki */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/35 text-primary text-xs font-bold uppercase tracking-wider">
            <Flame size={14} className="text-primary animate-pulse" />
            Rozgrzewka językowa
          </span>
          <span className="text-[11px] font-mono text-content-muted">
            {currentIndex + 1} z {warmupItems.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 hover:text-white text-content-muted text-xs font-semibold transition-all cursor-pointer"
          title="Przejdź od razu do właściwych zadań"
        >
          <span>Pomiń rozgrzewkę</span>
          <SkipForward size={13} />
        </button>
      </div>

      {/* Główna karta rozgrzewki */}
      <div className="rounded-2xl border border-emerald-500/30 bg-base-200/80 p-5 sm:p-7 shadow-lg relative overflow-hidden backdrop-blur-md">
        {/* Subtelny ambient glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Informacja o braku oceny (ADHD-friendly: zero presji) — nagłówek odpowiada rzeczywistemu typowi zadania, nie zawsze "rozsypance" */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={13} className="text-emerald-400" />
            Niepunktowane • {currentItem.heading}
          </span>

          {currentItem.hint && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-content-muted hover:text-primary font-bold transition-colors cursor-pointer"
            >
              <Lightbulb size={12} />
              <span>{showHint ? 'Ukryj podpowiedź' : 'Podpowiedź'}</span>
            </button>
          )}
        </div>

        {/* Zdanie źródłowe (polskie zdanie do przetłumaczenia / zdanie z błędem), gdy istnieje */}
        {currentItem.sourceLabel && (
          <div className="p-4 rounded-xl bg-base-100/90 border border-line-strong mb-3 shadow-inner">
            <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
              {currentItem.sourceLabel}
            </p>
          </div>
        )}

        {/* Polecenie zgodne z rzeczywistym typem zadania (te same statyczne klucze i18n co HomeworkExercise.tsx) */}
        <div className="p-3 rounded-xl bg-base-100/60 border border-line-strong/60 mb-5">
          <p className="text-xs sm:text-sm text-content-muted leading-relaxed">
            {currentItem.instruction}
          </p>
          {showHint && currentItem.hint && (
            <p className="text-xs text-content mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-1.5">
              <span className="font-semibold text-text-hi">Wskazówka:</span> {currentItem.hint}
            </p>
          )}
        </div>

        {/* Obszar ułożonego zdania (Builder Slot) */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-content-muted">Twoje zdanie:</span>
            {selectedWordIndices.length > 0 && !isDone && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-[11px] text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw size={11} /> Resetuj
              </button>
            )}
          </div>

          <div
            className={`min-h-[4.5rem] rounded-xl border-2 p-3 flex flex-wrap gap-2 items-center transition-all ${
              result === 'correct'
                ? 'border-emerald-500 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : result === 'close'
                ? 'border-info bg-info/10 shadow-[0_0_20px_rgba(111,168,240,0.15)]'
                : 'border-dashed border-line-strong bg-base-100/50'
            }`}
          >
            {selectedWordIndices.length === 0 && (
              <span className="text-sm text-content-muted/60 px-2 py-1 select-none flex items-center gap-2">
                <Shuffle size={14} /> Dotykaj kafelków poniżej, aby ułożyć zdanie…
              </span>
            )}

            {selectedWordIndices.map((bankIndex, pos) => {
              const item = shuffledBank[bankIndex];
              if (!item) return null;
              return (
                <button
                  key={`selected-${bankIndex}-${pos}`}
                  type="button"
                  data-testid="warmup-selected-tile"
                  onClick={() => handleRemoveTile(pos)}
                  className="px-3.5 py-2 rounded-xl bg-primary/20 border border-primary/50 text-primary text-[15px] font-bold shadow-sm transition-transform active:scale-95 cursor-pointer hover:border-danger/60 hover:bg-danger/15 hover:text-danger flex items-center gap-1"
                  title="Kliknij, aby cofnąć słowo"
                >
                  <span>{item.word}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bank dostępnych kafelków ze słowami */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-content-muted">Dostępne słowa:</span>
          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-base-100/40 border border-line">
            {shuffledBank.map((item, bankIndex) => {
              const isUsed = selectedWordIndices.includes(bankIndex);
              const colorClass = TILE_COLORS[bankIndex % TILE_COLORS.length];

              return (
                <button
                  key={`bank-${bankIndex}`}
                  type="button"
                  data-testid="warmup-bank-tile"
                  disabled={isUsed || isDone}
                  onClick={() => handleSelectTile(bankIndex)}
                  className={`px-3.5 py-2 rounded-xl border text-[15px] font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                    isUsed
                      ? 'opacity-20 border-transparent bg-base-100/20 text-content-muted cursor-not-allowed scale-90'
                      : `${colorClass} shadow-sm hover:scale-105`
                  }`}
                >
                  {item.word}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wynik próby — aria-live, żeby czytnik ekranu ogłosił zmianę bez polegania wyłącznie na kolorze */}
        <div role="status" aria-live="polite">
          {result === 'correct' && (
            <div className="mt-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-300 text-sm block">{i18n.t('Świetnie ułożone!')} 🔥</span>
                  <span className="text-xs text-emerald-200/80">
                    {isLast ? 'Rozgrzewka zakończona, przejdź do zadań' : 'Gotowy na kolejne zdanie?'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                data-testid="warmup-next-button"
                onClick={handleNext}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isLast ? 'Rozpocznij pracę domową →' : 'Następne zdanie →'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {result === 'close' && (
            <div className="mt-6 p-4 rounded-xl bg-info/15 border border-info/40 flex flex-col gap-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-2.5">
                <Sparkles size={22} className="text-info shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <span className="font-bold text-info text-sm block">
                    {i18n.t('Byłeś/Byłaś blisko!')}
                  </span>
                  <p className="text-xs text-content">
                    {i18n.t('Miałeś/Miałaś wszystkie właściwe słowa — tylko szyk był inny. Poprawna kolejność:')}
                  </p>
                  <p className="text-sm font-semibold text-white bg-black/20 rounded-lg px-3 py-2">
                    {currentItem.targetSentence}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="warmup-next-button"
                onClick={handleNext}
                className="w-full sm:w-auto self-end px-5 py-2.5 rounded-xl bg-info hover:bg-info/85 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isLast ? 'Rozpocznij pracę domową →' : 'Następne zdanie →'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stopka z szybkim pominięciem */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-content-muted hover:text-white transition-colors cursor-pointer underline underline-offset-4"
        >
          Przejdź od razu do głównych ćwiczeń (bez rozgrzewki)
        </button>
      </div>
    </div>
  );
};

export default HomeworkWarmupScrambler;

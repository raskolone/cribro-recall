import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  Flame, 
  CheckCircle2, 
  Lightbulb, 
  SkipForward, 
  Zap, 
  Shuffle 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface WarmupSentenceItem {
  prompt: string;
  targetSentence: string;
  hint?: string;
}

interface HomeworkWarmupScramblerProps {
  sentences: any[];
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Normalizuje tekst zdania i rozbija na kafelki słów.
 */
function extractWords(sentence: string): string[] {
  if (!sentence) return [];
  // Czyścimy wielokrotne spacje i dzielimy po słowach, zachowując interpunkcję przy słowach lub czyszcząc
  const clean = sentence.trim().replace(/\s+/g, ' ');
  return clean.split(' ').filter(Boolean);
}

/**
 * Wyciąga sensowne zdania do rozgrzewki z przekazanej listy zadań domowych.
 */
function extractWarmupItems(rawSentences: any[]): WarmupSentenceItem[] {
  if (!Array.isArray(rawSentences) || rawSentences.length === 0) return [];

  const items: WarmupSentenceItem[] = [];

  for (const item of rawSentences) {
    if (!item) continue;
    let target = '';
    let prompt = '';
    let hint = item.hint || item.hintSmall || '';

    if (item.correctTranslation || item.englishSentence || item.modelAnswer || item.targetSentence) {
      target = item.correctTranslation || item.englishSentence || item.modelAnswer || item.targetSentence;
      prompt = item.polishSentence || item.prompt || item.instruction || 'Przetłumacz na angielski:';
    } else if (item.correctSentence) {
      target = item.correctSentence;
      prompt = item.incorrectSentence ? `Zdanie z błędem: ${item.incorrectSentence}` : (item.instruction || 'Popraw zdanie:');
    } else if (item.chunks && Array.isArray(item.chunks)) {
      target = item.chunks.join(' ');
      prompt = item.polishHint || item.instruction || 'Ułóż zdanie z rozsypanki:';
    } else if (item.sentence && typeof item.sentence === 'string') {
      target = item.sentence;
      prompt = item.polishSentence || item.instruction || 'Ułóż zdanie:';
    } else if (item.polishSentence && typeof item.polishSentence === 'string') {
      prompt = item.polishSentence;
      target = item.hint || item.expectedAnswer || '';
    }

    if (target && typeof target === 'string' && target.trim().length > 0) {
      const words = extractWords(target);
      // Wybieramy zdania o długości od 3 do 20 słów — idealne na rozgrzewkę
      if (words.length >= 3 && words.length <= 20) {
        items.push({
          prompt: prompt || 'Ułóż zdanie w języku angielskim:',
          targetSentence: target.trim(),
          hint: hint || undefined,
        });
      }
    }
  }

  // Maksymalnie 3 zdania na rozgrzewkę, żeby nie przeciążać kursanta przed właściwą pracą domową
  return items.slice(0, 3);
}

// Kolorowe, estetyczne palety kafelków w stylu Nocturne Green & Emerald
const TILE_COLORS = [
  'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25',
  'bg-teal-500/15 border-teal-500/35 text-teal-300 hover:bg-teal-500/25',
  'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25',
  'bg-amber-500/15 border-amber-500/35 text-amber-300 hover:bg-amber-500/25',
  'bg-indigo-500/15 border-indigo-500/35 text-indigo-300 hover:bg-indigo-500/25',
];

export const HomeworkWarmupScrambler: React.FC<HomeworkWarmupScramblerProps> = ({
  sentences,
  onComplete,
  onSkip,
}) => {
  const warmupItems = useMemo(() => extractWarmupItems(sentences), [sentences]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Aktualnie wybrane kafelki (indeksy ze shuffled banku)
  const [selectedWordIndices, setSelectedWordIndices] = useState<number[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Jeśli brak odpowiednich zdań na rozgrzewkę, od razu przechodzimy do zadań
  useEffect(() => {
    if (warmupItems.length === 0) {
      onSkip();
    }
  }, [warmupItems, onSkip]);

  const currentItem = warmupItems[currentIndex];

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

  // Reset stanu po zmianie zdania
  useEffect(() => {
    setSelectedWordIndices([]);
    setIsSuccess(false);
    setShowHint(false);
  }, [currentIndex]);

  if (!currentItem || warmupItems.length === 0) {
    return null;
  }

  // Sprawdzamy czy ułożone słowa tworzą prawidłowe zdanie
  const handleSelectTile = (bankIndex: number) => {
    if (isSuccess || selectedWordIndices.includes(bankIndex)) return;

    const nextSelected = [...selectedWordIndices, bankIndex];
    setSelectedWordIndices(nextSelected);

    // Jeśli wybrano wszystkie kafelki, sprawdzamy zgodność
    if (nextSelected.length === shuffledBank.length) {
      const constructedSentence = nextSelected.map((idx) => shuffledBank[idx].word).join(' ').toLowerCase().replace(/[.,!?;:]/g, '');
      const cleanTarget = targetWords.join(' ').toLowerCase().replace(/[.,!?;:]/g, '');

      if (constructedSentence === cleanTarget) {
        setIsSuccess(true);
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#10b981', '#06b6d4', '#f59e0b'],
          });
        } catch (e) {}
      }
    }
  };

  const handleRemoveTile = (positionInSelected: number) => {
    if (isSuccess) return;
    setSelectedWordIndices((prev) => prev.filter((_, i) => i !== positionInSelected));
  };

  const handleReset = () => {
    setSelectedWordIndices([]);
    setIsSuccess(false);
  };

  const handleNext = () => {
    if (currentIndex < warmupItems.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const isLast = currentIndex === warmupItems.length - 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 animate-in fade-in duration-300">
      {/* Pasek górny rozgrzewki */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Flame size={14} className="text-amber-400 animate-pulse" />
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

        {/* Informacja o braku oceny (ADHD-friendly: zero presji) */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={13} className="text-emerald-400" />
            Niepunktowane • Ułóż zdanie z rozsypanki
          </span>

          {currentItem.hint && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
            >
              <Lightbulb size={12} />
              <span>{showHint ? 'Ukryj podpowiedź' : 'Podpowiedź'}</span>
            </button>
          )}
        </div>

        {/* Prompt / Zdanie wyjściowe */}
        <div className="p-4 rounded-xl bg-base-100/90 border border-line-strong mb-5 shadow-inner">
          <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {currentItem.prompt}
          </p>
          {showHint && currentItem.hint && (
            <p className="text-xs text-amber-300/90 mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-1.5">
              <span className="font-semibold">Wskazówka:</span> {currentItem.hint}
            </p>
          )}
        </div>

        {/* Obszar ułożonego zdania (Builder Slot) */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-content-muted">Twoje zdanie:</span>
            {selectedWordIndices.length > 0 && !isSuccess && (
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
              isSuccess
                ? 'border-emerald-500 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
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
              return (
                <button
                  key={`selected-${bankIndex}-${pos}`}
                  type="button"
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
                  disabled={isUsed || isSuccess}
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

        {/* Ekran sukcesu dla danego zdania */}
        {isSuccess && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-300 text-sm block">Świetnie ułożone! 🔥</span>
                <span className="text-xs text-emerald-200/80">
                  {isLast ? 'Rozgrzewka zakończona, przejdź do zadań' : 'Gotowy na kolejne zdanie?'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLast ? 'Rozpocznij pracę domową →' : 'Następne zdanie →'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
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

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Sparkles,
  Trophy,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Flame,
  Loader2,
  ListFilter,
} from 'lucide-react';
import { RecallCard, RecallRating } from '../../types/recall';
import {
  getDueCardsForStudent,
  getAllCardsForStudent,
  processCardReview,
} from '../../services/recallService';
import { RecallFlashcard } from './RecallFlashcard';

interface StudentRecallHubProps {
  studentId: string;
  studentName?: string;
  onClose?: () => void;
}

export const StudentRecallHub: React.FC<StudentRecallHubProps> = ({
  studentId,
  studentName = 'Kursancie',
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [dueCards, setDueCards] = useState<RecallCard[]>([]);
  const [allCards, setAllCards] = useState<RecallCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [reviewedCount, setReviewedCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ratingsBreakdown, setRatingsBreakdown] = useState<{
    hard: number;
    good: number;
    easy: number;
  }>({ hard: 0, good: 0, easy: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [due, all] = await Promise.all([
        getDueCardsForStudent(studentId),
        getAllCardsForStudent(studentId),
      ]);
      setDueCards(due);
      setAllCards(all);
      setCurrentIndex(0);
      setReviewedCount(0);
      setSessionCompleted(due.length === 0);
      setRatingsBreakdown({ hard: 0, good: 0, easy: 0 });
    } catch (err) {
      console.error('[StudentRecallHub] Error loading recall cards:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRate = async (rating: RecallRating) => {
    if (isProcessing || currentIndex >= dueCards.length) return;
    setIsProcessing(true);

    const activeCard = dueCards[currentIndex];

    // Zapisz statystykę w bieżącej sesji
    setRatingsBreakdown((prev) => ({
      ...prev,
      [rating]: prev[rating] + 1,
    }));

    try {
      await processCardReview(studentId, activeCard.id, rating);
    } catch (e) {
      console.error('[StudentRecallHub] Failed to review card:', e);
    }

    const nextIdx = currentIndex + 1;
    setReviewedCount((prev) => prev + 1);

    if (nextIdx >= dueCards.length) {
      setSessionCompleted(true);
    } else {
      setCurrentIndex(nextIdx);
    }

    setIsProcessing(false);
  };

  const handleRestartSession = () => {
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
        <p className="text-slate-300 font-medium">Ładowanie Twoich powtórek interwałowych...</p>
        <span className="text-xs text-slate-500 mt-1">Algorytm Spaced Repetition analizuje interwały</span>
      </div>
    );
  }

  const totalDue = dueCards.length;
  const currentCard = dueCards[currentIndex];
  const progressPercent = totalDue > 0 ? Math.round((reviewedCount / totalDue) * 100) : 100;

  // Obliczenie statystyk poziomu opanowania (0-5)
  const levelCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  allCards.forEach((c) => {
    const lvl = Math.min(5, Math.max(0, c.intervalLevel || 0));
    levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* ================= GŁÓWNY NAGŁÓWEK HUBU ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Brain className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Spaced Repetition &amp; Recall
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Faza 4
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Cześć, {studentName}! Utrwalaj słownictwo i struktury zgodnie z krzywą zapominania Ebbinghausa.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="self-end sm:self-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            Wróć do kokpitu
          </button>
        )}
      </div>

      {/* ================= PODSUMOWANIE UKOŃCZENIA LUB BRAK KART ================= */}
      {sessionCompleted ? (
        <div className="flex flex-col items-center text-center p-8 sm:p-12 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-emerald-500/30 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 shadow-inner">
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Wszystkie powtórki na dziś ukończone!
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-md mt-2">
            Świetna robota! Twój mózg utrwalił dzisiejszą dawkę materiału. Algorytm wyznaczył kolejne
            terminy dla powtórzeń.
          </p>

          {/* Podsumowanie ocen w tej sesji */}
          {reviewedCount > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 w-full max-w-md">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="block text-xl sm:text-2xl font-black text-rose-400">
                  {ratingsBreakdown.hard}
                </span>
                <span className="text-[11px] font-semibold text-rose-300">Trudne</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="block text-xl sm:text-2xl font-black text-amber-400">
                  {ratingsBreakdown.good}
                </span>
                <span className="text-[11px] font-semibold text-amber-300">Dobre</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="block text-xl sm:text-2xl font-black text-emerald-400">
                  {ratingsBreakdown.easy}
                </span>
                <span className="text-[11px] font-semibold text-emerald-300">Łatwe</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            <button
              type="button"
              onClick={handleRestartSession}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Sprawdź ponownie
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all"
              >
                Przejdź do lekcji
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ================= AKTYWNA SESJA POWTÓRKOWA ================= */
        <div className="flex flex-col gap-6">
          {/* Status Bar */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Karta {currentIndex + 1} z {totalDue}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Do powtórzenia dzisiaj: <strong className="text-white">{totalDue - reviewedCount}</strong>
              </span>
            </div>

            {/* Pasek Postępu */}
            <div className="flex items-center gap-3 w-full sm:w-64">
              <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-400 min-w-[36px] text-right">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* Fiszka 3D */}
          {currentCard && (
            <RecallFlashcard
              card={currentCard}
              onRate={handleRate}
              disabled={isProcessing}
            />
          )}
        </div>
      )}

      {/* ================= STATYSTYKI OGÓLNE BAZY RECALL ================= */}
      <div className="mt-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Stan Twojej Bazy Zwrotów ({allCards.length} łącznie)</span>
          </div>
          <span className="text-xs text-slate-500">Rozkład poziomów biegłości</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-slate-400 font-semibold mb-1">Nowe</div>
            <div className="text-base font-bold text-slate-200">{levelCounts[0] || 0}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-slate-400 font-semibold mb-1">1 dzień</div>
            <div className="text-base font-bold text-indigo-300">{levelCounts[1] || 0}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-slate-400 font-semibold mb-1">3 dni</div>
            <div className="text-base font-bold text-indigo-300">{levelCounts[2] || 0}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-slate-400 font-semibold mb-1">7 dni</div>
            <div className="text-base font-bold text-indigo-300">{levelCounts[3] || 0}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="text-slate-400 font-semibold mb-1">14 dni</div>
            <div className="text-base font-bold text-indigo-300">{levelCounts[4] || 0}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-emerald-400 font-semibold mb-1">Opanowane</div>
            <div className="text-base font-bold text-emerald-400">{levelCounts[5] || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

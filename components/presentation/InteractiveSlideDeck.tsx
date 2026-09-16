import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  Volume2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Check,
  ChevronRight,
  Layers,
  Award,
  BookOpen,
  MessageSquare,
  HelpCircle as QuestionIcon
} from 'lucide-react';

export interface FlipCardItem {
  term: string;
  definition: string;
  example?: string;
  hint?: string;
}

export interface ProcessStepItem {
  title: string;
  subtitle?: string;
  content: string;
  keyPoints?: string[];
}

interface InteractiveSlideDeckProps {
  type: 'flip_cards' | 'process_tabs' | 'interactive_quiz' | 'slide' | 'scenario_item' | 'image_prompt';
  title?: string;
  cards?: FlipCardItem[];
  steps?: ProcessStepItem[];
  question?: string;
  prompt?: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer?: string | number;
  explanation?: string;
  hints?: string[];
  isTeacher?: boolean;
  onSelectOption?: (option: string | number) => void;
  selectedOption?: string | number | null;
  revealedAnswer?: boolean;
}

export const InteractiveSlideDeck: React.FC<InteractiveSlideDeckProps> = ({
  type,
  title,
  cards = [],
  steps = [],
  question,
  prompt,
  imageUrl,
  options = [],
  correctAnswer,
  explanation,
  hints = [],
  isTeacher = false,
  onSelectOption,
  selectedOption,
  revealedAnswer,
}) => {
  // Stan dla Flip Cards
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Stan dla Process Tabs
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Stan dla Quizu
  const [localSelected, setLocalSelected] = useState<string | number | null>(selectedOption ?? null);
  const [showExplanation, setShowExplanation] = useState(revealedAnswer ?? false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = () => {
    if (activeCardIndex < cards.length - 1) {
      setIsFlipped(false);
      setActiveCardIndex(prev => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (activeCardIndex > 0) {
      setIsFlipped(false);
      setActiveCardIndex(prev => prev - 1);
    }
  };

  // ── 1. MODUŁ INTERAKTYWNYCH KART (FLIP CARDS / E-LEARNING) ──
  if (type === 'flip_cards' && cards.length > 0) {
    const currentCard = cards[activeCardIndex] || cards[0];
    const progressPercent = Math.round(((activeCardIndex + 1) / cards.length) * 100);

    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
        {/* Pasek postępu modułu e-learningowego */}
        <div className="w-full max-w-2xl flex items-center justify-between gap-4 mb-4 text-xs font-semibold dark:text-slate-300 text-slate-600">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <Layers size={15} /> Karta {activeCardIndex + 1} z {cards.length}
          </span>
          <div className="flex-1 max-w-xs dark:bg-slate-800 bg-slate-200 rounded-full h-2.5 overflow-hidden border dark:border-white/10 border-slate-300">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono">{progressPercent}% opanowano</span>
        </div>

        {/* Główna karta 3D z obrotem */}
        <div
          onClick={handleFlip}
          className="w-full max-w-2xl min-h-[320px] sm:min-h-[380px] cursor-pointer perspective-1000 group select-none"
        >
          <div
            className={`w-full h-full min-h-[320px] sm:min-h-[380px] rounded-3xl border-2 transition-transform duration-500 transform-style-3d relative shadow-2xl ${
              isFlipped
                ? 'rotate-y-180 dark:bg-slate-900 bg-emerald-50/90 dark:border-emerald-500/60 border-emerald-400'
                : 'dark:bg-[#111827] bg-white dark:border-white/15 border-slate-200 hover:border-emerald-400/80 dark:hover:border-emerald-500/60'
            }`}
            style={{
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* PRZÓD KARTY */}
            <div
              className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-between items-center text-center backface-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="w-full flex justify-between items-center text-xs font-medium">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold tracking-wider uppercase">
                  Term / Expression
                </span>
                <span className="flex items-center gap-1.5 dark:text-slate-400 text-slate-500 group-hover:text-emerald-500 transition-colors font-semibold">
                  <RotateCcw size={13} /> Kliknij, aby obrócić
                </span>
              </div>

              <div className="my-auto py-6">
                <h3 className="text-3xl sm:text-5xl font-black dark:text-white text-slate-900 tracking-tight mb-4 leading-tight">
                  {currentCard.term}
                </h3>
                {currentCard.hint && (
                  <div className="inline-block px-4 py-2 rounded-xl dark:bg-amber-950/40 bg-amber-50 border dark:border-amber-500/30 border-amber-200">
                    <p className="text-xs sm:text-sm dark:text-amber-300 text-amber-900 font-medium italic">
                      💡 Podpowiedź: {currentCard.hint}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-xs dark:text-slate-400 text-slate-500 flex items-center gap-1.5 font-medium">
                <Sparkles size={14} className="text-amber-400" />
                Dotknij lub kliknij, aby odkryć znaczenie i przykład w kontekście
              </div>
            </div>

            {/* TYŁ KARTY (OBRÓT) */}
            <div
              className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-between items-center text-center backface-hidden"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="w-full flex justify-between items-center text-xs font-medium">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 font-bold tracking-wider uppercase">
                  Znaczenie i Kontekst
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 size={15} /> Odkryto
                </span>
              </div>

              <div className="my-auto py-4 w-full">
                <h4 className="text-2xl sm:text-3xl font-bold dark:text-emerald-300 text-emerald-800 mb-4">
                  {currentCard.definition}
                </h4>
                {currentCard.example && (
                  <div className="p-4 rounded-2xl dark:bg-slate-950/80 bg-white border dark:border-emerald-500/30 border-emerald-200 shadow-md text-left">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1 uppercase tracking-wider">
                      Przykładowe zdanie w kontekście:
                    </span>
                    <p className="dark:text-slate-100 text-slate-800 text-sm sm:text-base font-medium leading-relaxed">
                      „{currentCard.example}”
                    </p>
                  </div>
                )}
              </div>

              <div className="text-xs dark:text-slate-400 text-slate-500 font-medium">
                Kliknij ponownie, aby powrócić do hasła
              </div>
            </div>
          </div>
        </div>

        {/* Nawigacja po kartach */}
        <div className="flex items-center gap-3.5 mt-6">
          <button
            type="button"
            onClick={handlePrevCard}
            disabled={activeCardIndex === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border dark:border-white/15 border-slate-300 dark:bg-slate-800/80 bg-white dark:text-white text-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            <ArrowLeft size={16} /> Poprzednia
          </button>

          <button
            type="button"
            onClick={handleFlip}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border dark:border-emerald-500/30 border-emerald-300 dark:bg-emerald-950/30 bg-emerald-50 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer shadow-md"
          >
            <RotateCcw size={14} /> Obróć kartę
          </button>

          <button
            type="button"
            onClick={handleNextCard}
            disabled={activeCardIndex === cards.length - 1}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/30"
          >
            Następna <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── 2. MODUŁ KROKÓW PROCESU (INTERACTIVE PROCESS / ACCORDION STYLE) ──
  if (type === 'process_tabs' && steps.length > 0) {
    const currentStep = steps[activeStepIndex] || steps[0];

    return (
      <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 flex flex-col gap-6 animate-in fade-in duration-200">
        {/* Pasek zakładek procesowych */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b dark:border-white/10 border-slate-200 scrollbar-thin">
          {steps.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveStepIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400'
                    : 'dark:bg-slate-800/80 bg-white dark:text-slate-300 text-slate-700 border dark:border-white/10 border-slate-200 hover:border-emerald-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'dark:bg-slate-900 bg-slate-100 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {idx + 1}
                </span>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Zawartość aktywnego kroku */}
        <div className="p-6 sm:p-10 rounded-3xl dark:bg-[#111827] bg-white border dark:border-white/15 border-slate-200 shadow-2xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Krok {activeStepIndex + 1} z {steps.length}
            </span>
            {currentStep.subtitle && (
              <span className="text-xs font-semibold dark:text-slate-300 text-slate-600 dark:bg-slate-800 bg-slate-100 px-3 py-1 rounded-full border dark:border-white/10 border-slate-200">
                {currentStep.subtitle}
              </span>
            )}
          </div>

          <h3 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 mb-4">
            {currentStep.title}
          </h3>

          <div className="text-base sm:text-lg dark:text-slate-200 text-slate-700 leading-relaxed mb-6 whitespace-pre-wrap font-medium">
            {currentStep.content}
          </div>

          {currentStep.keyPoints && currentStep.keyPoints.length > 0 && (
            <div className="mt-6 p-4 sm:p-6 rounded-2xl dark:bg-emerald-950/40 bg-emerald-50 border dark:border-emerald-500/30 border-emerald-200">
              <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lightbulb size={15} /> Kluczowe wnioski (Key Takeaways):
              </h5>
              <ul className="space-y-2.5">
                {currentStep.keyPoints.map((pt, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2.5 text-sm sm:text-base dark:text-slate-100 text-slate-800 font-medium">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nawigacja po krokach */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t dark:border-white/10 border-slate-200">
            <button
              type="button"
              onClick={() => setActiveStepIndex(p => Math.max(0, p - 1))}
              disabled={activeStepIndex === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border dark:border-white/15 border-slate-300 dark:bg-slate-800/80 bg-white dark:text-white text-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <ArrowLeft size={16} /> Wróć
            </button>
            <button
              type="button"
              onClick={() => setActiveStepIndex(p => Math.min(steps.length - 1, p + 1))}
              disabled={activeStepIndex === steps.length - 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/30"
            >
              Kolejny krok <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. MODUŁ QUIZU I INTERAKTYWNEGO WYBORU ──
  if (type === 'interactive_quiz' || (options && options.length > 0)) {
    return (
      <div className="w-full max-w-3xl mx-auto p-2 sm:p-4 flex flex-col gap-6 animate-in fade-in duration-200">
        {question && (
          <div className="p-6 sm:p-8 rounded-3xl dark:bg-[#111827] bg-white border dark:border-white/15 border-slate-200 shadow-xl text-center">
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 block">
              Pytanie / Zadanie
            </span>
            <h3 className="text-xl sm:text-3xl font-black dark:text-white text-slate-900 leading-snug">
              {question}
            </h3>
            {prompt && (
              <p className="text-sm dark:text-slate-300 text-slate-600 mt-2 font-medium">
                {prompt}
              </p>
            )}
          </div>
        )}

        {options.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = localSelected === opt || localSelected === idx || String(localSelected) === String(opt);
              const isCorrect = correctAnswer !== undefined && (correctAnswer === opt || correctAnswer === idx || String(correctAnswer) === String(opt));
              const showOutcome = showExplanation;

              let cardStyles = 'dark:bg-slate-900/90 bg-white border-2 dark:border-white/10 border-slate-200 dark:text-white text-slate-900 hover:border-emerald-500';
              if (showOutcome) {
                if (isCorrect) {
                  cardStyles = 'dark:bg-emerald-950/60 bg-emerald-50 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/40 shadow-lg';
                } else if (isSelected && !isCorrect) {
                  cardStyles = 'dark:bg-rose-950/50 bg-rose-50 border-2 border-rose-500 text-rose-800 dark:text-rose-200 ring-2 ring-rose-500/40';
                }
              } else if (isSelected) {
                cardStyles = 'dark:bg-emerald-950/50 bg-emerald-50 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/40 shadow-lg';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setLocalSelected(opt);
                    onSelectOption?.(opt);
                  }}
                  className={`p-4 sm:p-5 rounded-2xl text-left font-semibold text-sm sm:text-base flex items-start gap-3.5 transition-all cursor-pointer shadow-md ${cardStyles}`}
                >
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center flex-shrink-0">
                    {letter}
                  </span>
                  <span className="flex-1 leading-snug pt-1">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Wyjaśnienie odpowiedzi */}
        {showExplanation && explanation && (
          <div className="p-5 sm:p-6 rounded-2xl dark:bg-emerald-950/50 bg-emerald-50 border-2 border-emerald-500/40 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm mb-1.5">
              <CheckCircle2 size={16} /> Wyjaśnienie językowe:
            </div>
            <p className="dark:text-slate-100 text-slate-800 text-sm sm:text-base leading-relaxed font-medium">
              {explanation}
            </p>
          </div>
        )}

        {isTeacher && !showExplanation && (
          <div className="flex justify-center mt-2">
            <button
              type="button"
              onClick={() => setShowExplanation(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Sparkles size={15} className="text-amber-300" /> Odkryj poprawną odpowiedź kursantowi
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 4. STANDARDOWY SLAJD DYSKUSYJNY / WPROWADZAJĄCY ──
  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col items-center justify-center gap-6 text-center animate-in fade-in duration-200">
      {imageUrl && (
        <div className="w-full max-h-[36vh] rounded-3xl overflow-hidden border dark:border-white/10 border-slate-200 shadow-2xl bg-slate-900">
          <img
            src={imageUrl}
            alt={title || 'Slajd'}
            className="w-full h-full object-contain max-h-[36vh] rounded-3xl"
          />
        </div>
      )}

      <div className="w-full p-8 sm:p-12 rounded-3xl dark:bg-[#111827] bg-white border-2 dark:border-white/15 border-slate-200 shadow-2xl space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
          <MessageSquare size={14} />
          <span>{title || 'Dyskusja & Praktyka językowa'}</span>
        </div>

        {question && (
          <h3 className="text-2xl sm:text-4xl font-black dark:text-white text-slate-900 leading-tight max-w-2xl mx-auto">
            {question}
          </h3>
        )}

        {prompt && (
          <p className="text-base sm:text-lg dark:text-slate-300 text-slate-600 leading-relaxed max-w-2xl mx-auto font-medium">
            {prompt}
          </p>
        )}

        {hints && hints.length > 0 && (
          <div className="pt-4 border-t dark:border-white/10 border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              💡 Przydatne zwroty do wypowiedzi:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hints.map((hint, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-white/10 border-slate-200 dark:text-slate-200 text-slate-700 text-xs font-medium shadow-sm"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveSlideDeck;

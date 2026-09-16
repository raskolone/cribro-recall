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
  BookOpen
} from 'lucide-react';
import Button from '../ui/Button';

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
  type: 'flip_cards' | 'process_tabs' | 'interactive_quiz' | 'slide';
  title?: string;
  cards?: FlipCardItem[];
  steps?: ProcessStepItem[];
  question?: string;
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
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  // Stan dla Process Tabs
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Stan dla Quizu
  const [localSelected, setLocalSelected] = useState<string | number | null>(selectedOption ?? null);
  const [showExplanation, setShowExplanation] = useState(revealedAnswer ?? false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setFlippedCards(prev => ({ ...prev, [activeCardIndex]: true }));
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
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4">
        {/* Pasek postępu modułu e-learningowego */}
        <div className="w-full flex items-center justify-between gap-4 mb-4 text-xs font-semibold text-text-muted">
          <span className="flex items-center gap-1.5 text-accent">
            <Layers size={14} /> Karta {activeCardIndex + 1} z {cards.length}
          </span>
          <div className="flex-1 max-w-xs bg-bg-surface/80 rounded-full h-2 overflow-hidden border border-border-subtle">
            <div
              className="bg-accent h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{progressPercent}% opanowano</span>
        </div>

        {/* Główna karta 3D z obrotem */}
        <div
          onClick={handleFlip}
          className="w-full max-w-2xl min-h-[300px] sm:min-h-[360px] cursor-pointer perspective-1000 group select-none"
        >
          <div
            className={`w-full h-full min-h-[300px] sm:min-h-[360px] rounded-3xl border transition-transform duration-500 transform-style-3d relative shadow-2xl ${
              isFlipped ? 'rotate-y-180 bg-accent/10 border-accent/40' : 'bg-bg-surface/90 border-border-subtle hover:border-accent/50'
            }`}
            style={{
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* PRZÓD KARTY */}
            <div
              className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-between items-center text-center backface-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="w-full flex justify-between items-center text-xs font-medium text-text-muted">
                <span className="px-2.5 py-1 rounded-full bg-accent/15 text-accent font-semibold tracking-wider uppercase">
                  Term / Expression
                </span>
                <span className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <RotateCcw size={12} /> Kliknij, aby obrócić
                </span>
              </div>

              <div className="my-auto py-6">
                <h3 className="text-2xl sm:text-4xl font-extrabold text-text-hi tracking-tight mb-3">
                  {currentCard.term}
                </h3>
                {currentCard.hint && (
                  <p className="text-sm sm:text-base text-text-muted italic max-w-lg">
                    💡 Podpowiedź: {currentCard.hint}
                  </p>
                )}
              </div>

              <div className="text-xs text-text-muted/80 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" />
                Dotknij lub kliknij, aby odkryć znaczenie i przykład w kontekście
              </div>
            </div>

            {/* TYŁ KARTY (OBRÓT) */}
            <div
              className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-between items-center text-center backface-hidden"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <div className="w-full flex justify-between items-center text-xs font-medium text-text-muted">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold tracking-wider uppercase">
                  Znaczenie i Kontekst
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={13} /> Odkryto
                </span>
              </div>

              <div className="my-auto py-4">
                <h4 className="text-xl sm:text-3xl font-bold text-emerald-300 mb-4">
                  {currentCard.definition}
                </h4>
                {currentCard.example && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-bg-surface/80 border border-emerald-500/20 text-text-hi text-sm sm:text-base text-left">
                    <span className="text-xs font-bold text-emerald-400 block mb-1 uppercase tracking-wide">
                      Przykładowe zdanie:
                    </span>
                    „{currentCard.example}”
                  </div>
                )}
              </div>

              <div className="text-xs text-text-muted">
                Kliknij ponownie, aby wrócić do hasła
              </div>
            </div>
          </div>
        </div>

        {/* Nawigacja po kartach */}
        <div className="flex items-center gap-4 mt-6">
          <Button
            variant="secondary"
            onClick={handlePrevCard}
            disabled={activeCardIndex === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Poprzednia
          </Button>

          <Button
            variant="ghost"
            onClick={handleFlip}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-hi"
          >
            <RotateCcw size={14} /> Obróć kartę
          </Button>

          <Button
            variant={activeCardIndex === cards.length - 1 ? 'primary' : 'secondary'}
            onClick={handleNextCard}
            disabled={activeCardIndex === cards.length - 1}
            className="flex items-center gap-2"
          >
            Następna <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  // ── 2. MODUŁ KROKÓW PROCESU (INTERACTIVE PROCESS / ACCORDION STYLE) ──
  if (type === 'process_tabs' && steps.length > 0) {
    const currentStep = steps[activeStepIndex] || steps[0];

    return (
      <div className="w-full max-w-5xl mx-auto p-4 flex flex-col gap-6">
        {/* Pasek zakładek procesowych w stylu Articulate */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border-subtle scrollbar-thin">
          {steps.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={idx}
                onClick={() => setActiveStepIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-accent text-white shadow-lg shadow-accent/20 ring-2 ring-accent/30'
                    : 'bg-bg-surface/70 text-text-muted hover:text-text-hi hover:bg-bg-surface'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-bg-base text-text-muted'
                  }`}
                >
                  {idx + 1}
                </span>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Zawartość aktywnego kroku z animacją przejścia */}
        <div className="p-6 sm:p-10 rounded-3xl bg-bg-surface/80 border border-border-subtle shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Krok {activeStepIndex + 1} z {steps.length}
            </span>
            {currentStep.subtitle && (
              <span className="text-xs font-medium text-text-muted bg-bg-base/70 px-3 py-1 rounded-full border border-border-subtle">
                {currentStep.subtitle}
              </span>
            )}
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-text-hi mb-4">
            {currentStep.title}
          </h3>

          <div className="text-base sm:text-lg text-text-subtle leading-relaxed mb-6 whitespace-pre-wrap">
            {currentStep.content}
          </div>

          {currentStep.keyPoints && currentStep.keyPoints.length > 0 && (
            <div className="mt-6 p-4 sm:p-6 rounded-2xl bg-accent/10 border border-accent/20">
              <h5 className="text-xs font-bold text-accent uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lightbulb size={14} /> Kluczowe wnioski (Key Takeaways):
              </h5>
              <ul className="space-y-2.5">
                {currentStep.keyPoints.map((pt, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2.5 text-sm sm:text-base text-text-hi">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nawigacja po krokach */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border-subtle">
            <Button
              variant="secondary"
              onClick={() => setActiveStepIndex(p => Math.max(0, p - 1))}
              disabled={activeStepIndex === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Wróć
            </Button>
            <Button
              variant={activeStepIndex === steps.length - 1 ? 'primary' : 'secondary'}
              onClick={() => setActiveStepIndex(p => Math.min(steps.length - 1, p + 1))}
              disabled={activeStepIndex === steps.length - 1}
              className="flex items-center gap-2"
            >
              Kolejny krok <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. MODUŁ QUIZU I INTERAKTYWNEGO WYBORU ──
  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col gap-6">
      {question && (
        <div className="p-6 sm:p-8 rounded-3xl bg-bg-surface/90 border border-border-subtle shadow-xl text-center">
          <span className="text-xs font-bold text-accent uppercase tracking-wider mb-2 block">
            Pytanie / Zadanie
          </span>
          <h3 className="text-xl sm:text-3xl font-extrabold text-text-hi leading-snug">
            {question}
          </h3>
        </div>
      )}

      {options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = localSelected === opt || localSelected === idx;
            const isCorrect = correctAnswer !== undefined && (correctAnswer === opt || correctAnswer === idx);
            const showOutcome = showExplanation;

            let cardStyles = 'bg-bg-surface/80 border-border-subtle text-text-hi hover:border-accent/40';
            if (showOutcome) {
              if (isCorrect) {
                cardStyles = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30';
              } else if (isSelected && !isCorrect) {
                cardStyles = 'bg-rose-500/20 border-rose-500 text-rose-200 ring-2 ring-rose-500/30';
              }
            } else if (isSelected) {
              cardStyles = 'bg-accent/20 border-accent text-accent-light ring-2 ring-accent/30';
            }

            return (
              <button
                key={idx}
                onClick={() => {
                  setLocalSelected(opt);
                  onSelectOption?.(opt);
                }}
                className={`p-4 sm:p-5 rounded-2xl border text-left font-medium text-sm sm:text-base flex items-start gap-3.5 transition-all cursor-pointer shadow-md ${cardStyles}`}
              >
                <span className="w-7 h-7 rounded-xl bg-bg-base/70 border border-border-subtle text-accent font-bold flex items-center justify-center flex-shrink-0">
                  {letter}
                </span>
                <span className="flex-1 leading-snug pt-0.5">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Wyjaśnienie odpowiedzi */}
      {showExplanation && explanation && (
        <div className="p-5 sm:p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1.5">
            <CheckCircle2 size={16} /> Wyjaśnienie językowe:
          </div>
          <p className="text-text-hi text-sm sm:text-base leading-relaxed">
            {explanation}
          </p>
        </div>
      )}

      {isTeacher && !showExplanation && (
        <div className="flex justify-center mt-2">
          <Button
            variant="secondary"
            onClick={() => setShowExplanation(true)}
            className="flex items-center gap-2 text-xs"
          >
            <Sparkles size={14} className="text-amber-400" /> Odkryj poprawną odpowiedź kursantowi
          </Button>
        </div>
      )}
    </div>
  );
};

export default InteractiveSlideDeck;

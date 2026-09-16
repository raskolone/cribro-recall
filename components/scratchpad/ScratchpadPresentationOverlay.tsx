import React from 'react';
import { Airplay, CheckCircle2, HelpCircle, Image as ImageIcon, Lightbulb, MessageSquare, Sparkles, X } from 'lucide-react';
import Button from '../ui/Button';

export interface PresentationState {
  active: boolean;
  title: string;
  type: 'image_prompt' | 'slide' | 'scenario_item';
  imageUrl?: string;
  prompt?: string;
  hints?: string[];
  question?: string;
  slideIndex?: number;
  totalSlides?: number;
}

interface ScratchpadPresentationOverlayProps {
  presentation: PresentationState;
  isTeacher: boolean;
  onClose: () => void;
  onNextSlide?: () => void;
  onPrevSlide?: () => void;
}

export const ScratchpadPresentationOverlay: React.FC<ScratchpadPresentationOverlayProps> = ({
  presentation,
  isTeacher,
  onClose,
}) => {
  const [showHints, setShowHints] = React.useState(false);

  if (!presentation.active) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-1/95 backdrop-blur-xl animate-in fade-in duration-300 text-text-hi select-none overflow-y-auto p-4 sm:p-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-line-strong max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary animate-pulse">
            <Airplay size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                Prezentacja Live (Prototyp)
              </span>
              <span className="text-xs text-content-muted">Widok kursanta</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-text-hi mt-0.5">
              {presentation.title || 'Ćwiczenie interaktywne'}
            </h2>
          </div>
        </div>

        {isTeacher ? (
          <Button
            size="sm"
            onClick={onClose}
            className="text-xs font-bold py-2 px-4 bg-line-soft hover:bg-rose-500/20 text-text-hi hover:text-rose-300 border border-line-strong hover:border-rose-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <X size={14} />
            Zakończ i wróć do notatnika
          </Button>
        ) : (
          <span className="text-xs text-content-muted flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Lektor prowadzi prezentację
          </span>
        )}
      </div>

      {/* Main Slide Content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full my-6 sm:my-10 space-y-6">
        {/* Optional Image */}
        {presentation.imageUrl && (
          <div className="relative group max-h-[42vh] rounded-2xl overflow-hidden border border-line-strong bg-base-300 shadow-2xl">
            <img
              src={presentation.imageUrl}
              alt={presentation.title}
              className="w-full h-full object-contain max-h-[42vh] rounded-2xl"
            />
          </div>
        )}

        {/* Prompt / Question Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-base-200/80 border border-primary/30 shadow-[0_0_40px_rgba(114,240,180,0.12)] space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
            <Sparkles size={13} />
            <span>Zadanie dla kursanta</span>
          </div>

          {presentation.question && (
            <h3 className="text-xl sm:text-2xl font-black text-text-hi leading-tight tracking-tight">
              {presentation.question}
            </h3>
          )}

          {presentation.prompt && (
            <p className="text-sm sm:text-base text-content-muted leading-relaxed max-w-2xl mx-auto">
              {presentation.prompt}
            </p>
          )}

          {/* Hints / Keywords */}
          {presentation.hints && presentation.hints.length > 0 && (
            <div className="pt-4 border-t border-line-strong/60 space-y-3">
              <button
                type="button"
                onClick={() => setShowHints(!showHints)}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Lightbulb size={14} />
                {showHints ? 'Ukryj podpowiedzi i słownictwo' : 'Pokaż podpowiedzi / Useful vocabulary'}
              </button>

              {showHints && (
                <div className="flex flex-wrap items-center justify-center gap-2 animate-in fade-in duration-200">
                  {presentation.hints.map((hint, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-line-soft border border-line-strong text-text-hi text-xs font-medium shadow-sm"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="border-t border-line-strong/60 pt-4 max-w-5xl mx-auto w-full text-center text-xs text-content-muted flex items-center justify-between">
        <span>CRIBRO Recall Live Classroom</span>
        <span>Gdy lektor zamknie prezentację, widok automatycznie powróci do notatnika.</span>
      </div>
    </div>
  );
};

export default ScratchpadPresentationOverlay;

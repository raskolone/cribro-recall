import React, { useState } from 'react';
import { Volume2, RotateCw, Check, HelpCircle, XCircle } from 'lucide-react';
import { RecallCard, RecallRating } from '../../types/recall';

interface RecallFlashcardProps {
  card: RecallCard;
  onRate: (rating: RecallRating) => void;
  disabled?: boolean;
}

export const RecallFlashcard: React.FC<RecallFlashcardProps> = ({
  card,
  onRate,
  disabled = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleRatingClick = (rating: RecallRating) => {
    if (disabled) return;
    setIsFlipped(false);
    onRate(rating);
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      {/* 3D Flashcard Container */}
      <div
        className="w-full h-80 sm:h-96 cursor-pointer select-none perspective-1000 group"
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        aria-label="Kliknij, aby odwrócić fiszkę"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleFlip();
          }
        }}
      >
        <div
          className={`relative w-full h-full duration-500 transform-style-3d transition-transform rounded-3xl shadow-2xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* ================= AWERS (FRONT): Język Angielski ================= */}
          <div
            className="absolute inset-0 w-full h-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backface-hidden shadow-indigo-500/10 shadow-2xl hover:border-indigo-500/50 transition-colors"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Poziom {card.intervalLevel} / 5
              </span>
              <button
                type="button"
                onClick={(e) => handleSpeak(e, card.term)}
                className={`p-2 rounded-full transition-all ${
                  isSpeaking
                    ? 'bg-indigo-500 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Odsłuchaj wymowę (TTS)"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            {/* Central Term & Context */}
            <div className="flex flex-col items-center text-center my-auto px-2">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-50 tracking-tight leading-snug">
                {card.term}
              </h2>

              {card.phonetic && (
                <p className="mt-2 text-sm sm:text-base font-mono text-indigo-400/80">
                  {card.phonetic}
                </p>
              )}

              {card.contextSentence && (
                <div className="mt-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 max-w-md">
                  <p className="text-xs sm:text-sm text-slate-300 italic font-medium">
                    &ldquo;{card.contextSentence}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Hint to Flip */}
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">
              <RotateCw className="w-3.5 h-3.5" />
              <span>Kliknij lub wciśnij Spację, aby zobaczyć tłumaczenie</span>
            </div>
          </div>

          {/* ================= REWERS (BACK): Język Polski & Wskazówki ================= */}
          <div
            className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 backdrop-blur-xl border border-indigo-500/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-2xl"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Tłumaczenie
              </span>
              <button
                type="button"
                onClick={(e) => handleSpeak(e, card.term)}
                className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                title="Odsłuchaj wymowę (TTS)"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            {/* Translation Content */}
            <div className="flex flex-col items-center text-center my-auto px-2">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                {card.term}
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 leading-snug">
                {card.translation}
              </h2>

              {card.contextSentence && (
                <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-md font-medium">
                  {card.contextSentence}
                </p>
              )}
            </div>

            {/* Back Hint */}
            <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
              <RotateCw className="w-3.5 h-3.5" />
              <span>Oceń stopień opanowania poniżej</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3 PRZYCISKI OCENY ZNAJOMOŚCI ================= */}
      <div className="w-full mt-6 grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Przycisk Czerwony: Trudne / Zapomniałem */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleRatingClick('hard')}
          className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all duration-200 shadow-lg disabled:opacity-50"
        >
          <XCircle className="w-6 h-6 mb-1 text-rose-500" />
          <span className="font-bold text-xs sm:text-sm text-center">Trudne</span>
          <span className="text-[10px] text-rose-400/80 hidden sm:inline mt-0.5">Reset (jutro)</span>
        </button>

        {/* Przycisk Żółty: Dobre / Zastanawiałem się */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleRatingClick('good')}
          className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 border border-amber-500/30 text-amber-400 hover:text-amber-300 transition-all duration-200 shadow-lg disabled:opacity-50"
        >
          <HelpCircle className="w-6 h-6 mb-1 text-amber-400" />
          <span className="font-bold text-xs sm:text-sm text-center">Dobre</span>
          <span className="text-[10px] text-amber-400/80 hidden sm:inline mt-0.5">Standard x1.5</span>
        </button>

        {/* Przycisk Zielony: Łatwe / Pamiętam bez wahania */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleRatingClick('easy')}
          className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-all duration-200 shadow-lg disabled:opacity-50"
        >
          <Check className="w-6 h-6 mb-1 text-emerald-400" />
          <span className="font-bold text-xs sm:text-sm text-center">Łatwe</span>
          <span className="text-[10px] text-emerald-400/80 hidden sm:inline mt-0.5">Biegłość x2.5</span>
        </button>
      </div>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
};

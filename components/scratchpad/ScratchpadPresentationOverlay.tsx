import React, { useState, useEffect, useRef } from 'react';
import {
  Airplay,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Sparkles,
  X,
  Eye,
  Check,
  AlertCircle,
  Trophy,
  Zap,
  Volume2,
  Music,
  Sun,
  Moon,
} from 'lucide-react';
import Button from '../ui/Button';
import { ScratchpadDocument, LessonRecord } from '../../types';
import { WheelOfFortune } from '../presentation/WheelOfFortune';
import { InteractiveSlideDeck } from '../presentation/InteractiveSlideDeck';
import { EMPTY_SLIDE_INTERACTION } from '../admin/presentation/SlideCard';
import { useTheme } from '../../context/ThemeContext';

export type PresentationState = NonNullable<ScratchpadDocument['presentationState']>;

interface ScratchpadPresentationOverlayProps {
  presentation: PresentationState;
  isTeacher: boolean;
  studentName?: string | null;
  lessonRecords?: LessonRecord[];
  onClose: () => void;
  onRevealAnswer?: () => void;
  onSubmitAnswer?: (answer: string) => void;
  onUpdatePresentation?: (pres: Partial<PresentationState>) => void;
  onAddToNotes?: (text: string) => void;
}

const OPTION_THEMES = [
  {
    letter: 'A',
    symbol: '▲',
    cardBg: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-200',
    badgeBg: 'bg-rose-500 text-white',
    ringColor: 'ring-rose-400',
  },
  {
    letter: 'B',
    symbol: '◆',
    cardBg: 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-200',
    badgeBg: 'bg-sky-500 text-white',
    ringColor: 'ring-sky-400',
  },
  {
    letter: 'C',
    symbol: '●',
    cardBg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-200',
    badgeBg: 'bg-amber-500 text-ink-base font-bold',
    ringColor: 'ring-amber-400',
  },
  {
    letter: 'D',
    symbol: '■',
    cardBg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-200',
    badgeBg: 'bg-emerald-500 text-ink-base font-bold',
    ringColor: 'ring-emerald-400',
  },
];

export const ScratchpadPresentationOverlay: React.FC<ScratchpadPresentationOverlayProps> = ({
  presentation,
  isTeacher,
  studentName,
  lessonRecords = [],
  onClose,
  onRevealAnswer,
  onSubmitAnswer,
  onUpdatePresentation,
  onAddToNotes,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [localInputAnswer, setLocalInputAnswer] = useState<string>('');
  const [showHints, setShowHints] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [listeningNotes, setListeningNotes] = useState<string>('');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  let theme: 'light' | 'dark' = 'dark';
  let toggleTheme = () => {};
  try {
    const t = useTheme();
    theme = t.theme;
    toggleTheme = t.toggleTheme;
  } catch {}

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleSkipAudio = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
    }
  };

  // Obsługa klawisza ESC do wyjścia z prezentacji
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!presentation.active) return null;

  const isInteractive =
    presentation.type === 'interactive_quiz' ||
    presentation.type === 'sentence_scramble' ||
    presentation.type === 'error_hunt' ||
    Boolean(presentation.options && presentation.options.length > 0);

  const isAnswerRevealed = Boolean(presentation.revealedAnswer);
  const currentAnswer = presentation.studentAnswer != null ? String(presentation.studentAnswer) : null;
  const correctAnswerStr = presentation.correctAnswer != null ? String(presentation.correctAnswer) : '';
  const isStreamAudio = Boolean(presentation.audioUrl && (presentation.audioUrl.startsWith('http') && !presentation.audioUrl.startsWith('data:')));

  const handleSelectOption = (opt: string) => {
    if (isAnswerRevealed) return; // locked once revealed
    if (onSubmitAnswer) {
      onSubmitAnswer(opt);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInputAnswer.trim() || isAnswerRevealed) return;
    if (onSubmitAnswer) {
      onSubmitAnswer(localInputAnswer.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col dark:bg-[#0b0f17]/95 bg-slate-50/98 backdrop-blur-2xl animate-in fade-in duration-300 dark:text-white text-slate-900 select-none overflow-y-auto p-4 sm:p-8 transition-colors duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b dark:border-white/10 border-slate-200 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(114,240,180,0.25)] animate-pulse">
            <Zap size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">
                {presentation.type === 'wheel_of_fortune'
                  ? '🎡 Koło Fortuny Live'
                  : presentation.type === 'listening'
                  ? '🎧 Słuchanie & Audio Live'
                  : isInteractive
                  ? '⚡ Interaktywne Ćwiczenie Live'
                  : 'Prezentacja Live'}
              </span>
              <span className="text-xs text-content-muted">
                {isTeacher ? 'Widok lektora (sterowanie)' : 'Twój widok na żywo'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold dark:text-white text-slate-900 mt-0.5">
              {presentation.title || 'Ćwiczenie z lektorem'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Niezależny przełącznik motywu dla lektora i kursanta */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
            className="p-2 rounded-xl border dark:border-white/15 border-slate-200 dark:bg-white/5 bg-white text-content-muted hover:text-text-hi transition-colors cursor-pointer shadow-sm"
          >
            {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-500" />}
          </button>
          {/* Teacher Action: Reveal Answer */}
          {isTeacher && isInteractive && !isAnswerRevealed && onRevealAnswer && (
            <button
              type="button"
              onClick={onRevealAnswer}
              className="text-xs font-bold py-2 px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-ink-base flex items-center gap-1.5 shadow-lg shadow-primary/25 transition-all cursor-pointer"
            >
              <Eye size={15} />
              Odkryj poprawną odpowiedź
            </button>
          )}

          {isTeacher ? (
            <button
              type="button"
              onClick={onClose}
              title="Zakończ prezentację (Klawisz Esc)"
              className="text-xs font-bold py-2 px-4 rounded-xl bg-white/10 hover:bg-rose-500/20 text-text-hi hover:text-rose-300 border border-white/15 hover:border-rose-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <X size={15} />
              <span>Zakończ i wróć</span>
              <kbd className="text-[10px] font-mono opacity-70 px-1 py-0.2 rounded bg-white/10">Esc</kbd>
            </button>
          ) : (
            <span className="text-xs text-content-muted flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Lektor prowadzi ćwiczenie
            </span>
          )}
        </div>
      </div>

      {/* Main Container */}
      {presentation.type === 'wheel_of_fortune' ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full my-4 sm:my-6 animate-in fade-in zoom-in-95 duration-200">
          <WheelOfFortune
            slide={{
              id: 'scratchpad-live-wheel',
              type: 'wheel_of_fortune',
              title: presentation.title || 'Warm-up: Koło Fortuny',
              subtitle: presentation.prompt || 'Zakręć kołem i wylosuj pytanie rozgrzewkowe na start lekcji',
            }}
            lessonRecords={lessonRecords}
            studentName={studentName}
            isFullscreen={false}
            isStudent={!isTeacher}
            interaction={{
              ...EMPTY_SLIDE_INTERACTION,
              wheelRotation: presentation.wheelRotation,
              drawnQuestionId: presentation.drawnQuestionId,
              questionSource: presentation.questionSource,
            }}
            onInteractionChange={(next) => {
              if (onUpdatePresentation) {
                onUpdatePresentation({
                  wheelRotation: next.wheelRotation,
                  drawnQuestionId: next.drawnQuestionId,
                  questionSource: next.questionSource,
                });
              }
            }}
            onAddToNotes={onAddToNotes}
          />
        </div>
      ) : presentation.type === 'flip_cards' || presentation.type === 'process_tabs' ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full my-4 sm:my-6 animate-in fade-in duration-200">
          <InteractiveSlideDeck
            type={presentation.type}
            title={presentation.title}
            cards={presentation.cards}
            steps={presentation.steps}
            question={presentation.question}
            options={presentation.options}
            correctAnswer={presentation.correctAnswer}
            explanation={presentation.explanation}
            hints={presentation.hints}
            isTeacher={isTeacher}
            revealedAnswer={presentation.revealedAnswer}
            selectedOption={presentation.studentAnswer}
            onSelectOption={(opt) => onSubmitAnswer && onSubmitAnswer(String(opt))}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full my-6 sm:my-8 space-y-6">
        {/* Optional Image */}
        {presentation.imageUrl && (
          <div className="relative group max-h-[36vh] rounded-2xl overflow-hidden border border-white/10 bg-base-300 shadow-2xl">
            <img
              src={presentation.imageUrl}
              alt={presentation.title}
              className="w-full h-full object-contain max-h-[36vh] rounded-2xl"
            />
          </div>
        )}

        {/* Audio Player Banner (jeśli dołączono audioUrl lub tryb listening) */}
        {presentation.audioUrl && (
          <div className="w-full max-w-2xl p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-950/70 via-base-200 to-purple-950/50 border border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.2)] flex flex-col gap-3.5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 w-full sm:w-auto">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  <Volume2 size={24} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono font-bold text-purple-400 tracking-wider">
                      {isStreamAudio ? 'Strumień audio live' : 'Plik audio do odsłuchania'}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white truncate max-w-[280px] sm:max-w-xs" title={presentation.audioName || 'Ścieżka dźwiękowa'}>
                    {presentation.audioName || 'Ścieżka dźwiękowa do odsłuchania'}
                  </h4>
                </div>
              </div>

              {/* Kontrola prędkości i cofania */}
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleSkipAudio(-10)}
                  title="Cofnij o 10 sekund"
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-purple-200 transition-colors cursor-pointer"
                >
                  -10s
                </button>
                <button
                  type="button"
                  onClick={() => handleSkipAudio(10)}
                  title="Przewiń o 10 sekund do przodu"
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-purple-200 transition-colors cursor-pointer"
                >
                  +10s
                </button>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                  {[0.75, 1, 1.25, 1.5].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        playbackSpeed === speed
                          ? 'bg-purple-500 text-white shadow-sm'
                          : 'text-purple-300/70 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full">
              <audio
                ref={audioRef}
                controls
                src={presentation.audioUrl}
                className="w-full h-10 rounded-xl accent-purple-400 shadow-inner"
                preload="metadata"
              />
            </div>
          </div>
        )}

        {/* Prompt / Question Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-base-200/90 border border-primary/30 shadow-[0_0_50px_rgba(114,240,180,0.1)] space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>
              {presentation.type === 'sentence_scramble'
                ? 'Ułóż zdanie we właściwej kolejności'
                : presentation.type === 'error_hunt'
                ? 'Znajdź i popraw błąd'
                : presentation.type === 'listening'
                ? 'Rozumienie ze słuchu (Listening Comprehension)'
                : 'Pytanie do zadania'}
            </span>
          </div>

          {presentation.question && (
            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight max-w-3xl mx-auto">
              {presentation.question}
            </h3>
          )}

          {presentation.prompt && (
            <p className="text-sm sm:text-base text-content-muted leading-relaxed max-w-2xl mx-auto font-medium">
              {presentation.prompt}
            </p>
          )}

          {/* Multiple Choice Options (Kahoot-Style) */}
          {presentation.options && presentation.options.length > 0 && (
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-3xl mx-auto w-full">
              {presentation.options.map((opt, idx) => {
                const theme = OPTION_THEMES[idx % OPTION_THEMES.length];
                const isSelected = currentAnswer === opt || currentAnswer === String(idx);
                const isCorrect =
                  correctAnswerStr === opt ||
                  correctAnswerStr === String(idx) ||
                  correctAnswerStr.toLowerCase().trim() === opt.toLowerCase().trim();

                let cardStyle = `${theme.cardBg} border`;
                if (isAnswerRevealed) {
                  if (isCorrect) {
                    cardStyle =
                      'bg-emerald-600/35 border-emerald-400 text-emerald-100 ring-4 ring-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.02]';
                  } else if (isSelected && !isCorrect) {
                    cardStyle = 'bg-rose-600/30 border-rose-400 text-rose-200 line-through opacity-80';
                  } else {
                    cardStyle = 'bg-white/5 border-white/5 text-content-muted opacity-40';
                  }
                } else if (isSelected) {
                  cardStyle = `bg-primary/20 border-primary text-white ring-4 ring-primary/40 shadow-[0_0_25px_rgba(114,240,180,0.3)] scale-[1.02]`;
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isAnswerRevealed}
                    onClick={() => handleSelectOption(opt)}
                    className={`p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all duration-200 cursor-pointer disabled:cursor-default ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${theme.badgeBg}`}
                      >
                        {theme.letter}
                      </span>
                      <span className="font-semibold text-sm sm:text-base leading-snug break-words">
                        {opt}
                      </span>
                    </div>

                    {/* Status icon */}
                    <div className="shrink-0">
                      {isAnswerRevealed && isCorrect && (
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-ink-base flex items-center justify-center font-bold">
                          <Check size={18} strokeWidth={3} />
                        </div>
                      )}
                      {isAnswerRevealed && isSelected && !isCorrect && (
                        <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
                          <X size={18} strokeWidth={3} />
                        </div>
                      )}
                      {!isAnswerRevealed && isSelected && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary text-ink-base uppercase">
                          Wybrano
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Text input / non-multiple-choice interactive answers */}
          {(!presentation.options || presentation.options.length === 0) && isInteractive && (
            <div className="pt-3 max-w-xl mx-auto w-full space-y-3">
              {!isAnswerRevealed ? (
                <form onSubmit={handleCustomSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={localInputAnswer || currentAnswer || ''}
                    onChange={(e) => setLocalInputAnswer(e.target.value)}
                    placeholder="Wpisz swoją odpowiedź..."
                    className="flex-1 px-4 py-3 rounded-xl bg-ink-2/80 border border-white/15 text-white placeholder:text-content-muted focus:outline-none focus:border-primary text-sm font-medium"
                  />
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-ink-base font-bold text-sm shadow-md transition-all cursor-pointer"
                  >
                    Wyślij
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-xl bg-ink-2/90 border border-emerald-400/40 text-left space-y-1">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    Poprawne rozwiązanie:
                  </div>
                  <div className="text-base font-bold text-white font-mono">{correctAnswerStr}</div>
                </div>
              )}
            </div>
          )}

          {/* Status info bar for student or teacher */}
          <div className="pt-2 flex items-center justify-center gap-2 text-xs font-medium">
            {currentAnswer ? (
              <span className="text-primary flex items-center gap-1">
                <CheckCircle2 size={13} />
                {isTeacher
                  ? `Kursant wybrał: "${currentAnswer}"`
                  : isAnswerRevealed
                  ? 'Ćwiczenie rozwiązane!'
                  : 'Twoja odpowiedź została zarejestrowana. Czekaj na lektora.'}
              </span>
            ) : (
              <span className="text-content-muted flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {isTeacher ? 'Oczekiwanie na wybór kursanta...' : 'Wybierz jedną z opcji powyżej'}
              </span>
            )}
          </div>

          {/* Answer Revealed Explanation Callout */}
          {isAnswerRevealed && presentation.explanation && (
            <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-left space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Trophy size={15} />
                <span>Wyjaśnienie i reguła językowa</span>
              </div>
              <p className="text-sm text-text-hi leading-relaxed font-medium">
                {presentation.explanation}
              </p>
            </div>
          )}

          {/* Hints / Keywords */}
          {presentation.hints && presentation.hints.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-3">
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
                      className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-text-hi text-xs font-medium shadow-sm"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sekcja notatek ze słuchania dla lektora i kursanta */}
          {(presentation.type === 'listening' || presentation.audioUrl) && (
            <div className="pt-4 border-t border-white/10 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                <span>📝 Twoje notatki ze słuchania (kluczowe myśli, nowe słówka):</span>
                {onAddToNotes && listeningNotes.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToNotes(`\n### 🎧 Notatki ze słuchania: ${presentation.audioName || presentation.title || 'Nagranie'}\n${listeningNotes.trim()}\n`);
                      setCopiedNotes(true);
                      setTimeout(() => setCopiedNotes(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-accent-ink font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Check size={12} />
                    <span>{copiedNotes ? 'Dodano do notatnika!' : 'Wklej do notatnika'}</span>
                  </button>
                )}
              </div>
              <textarea
                value={listeningNotes}
                onChange={(e) => setListeningNotes(e.target.value)}
                placeholder="Notuj na bieżąco podczas odtwarzania nagrania..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-2/90 border border-purple-500/30 text-white placeholder:text-content-muted focus:outline-none focus:border-purple-400 text-xs font-medium"
              />
            </div>
          )}
        </div>
      </div>
    )}

      {/* Footer */}
      <div className="border-t border-white/10 pt-4 max-w-5xl mx-auto w-full text-center text-xs text-content-muted flex items-center justify-between">
        <span className="font-mono">CRIBRO Recall Live Classroom</span>
        <span>Po zamknięciu ćwiczenia przez lektora nastąpi natychmiastowy powrót do notatnika.</span>
      </div>
    </div>
  );
};

export default ScratchpadPresentationOverlay;

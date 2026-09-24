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
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ZoomIn,
} from 'lucide-react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../../services/gsapAnimations';
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
    cardBg: 'dark:bg-rose-950/40 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border-2 border-rose-500/40 dark:text-rose-100 text-rose-900',
    badgeBg: 'bg-rose-500 text-white',
    ringColor: 'ring-rose-400',
  },
  {
    letter: 'B',
    symbol: '◆',
    cardBg: 'dark:bg-sky-950/40 bg-sky-50 hover:bg-sky-100 dark:hover:bg-sky-900/50 border-2 border-sky-500/40 dark:text-sky-100 text-sky-900',
    badgeBg: 'bg-sky-500 text-white',
    ringColor: 'ring-sky-400',
  },
  {
    letter: 'C',
    symbol: '●',
    cardBg: 'dark:bg-amber-950/40 bg-amber-50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-2 border-amber-500/40 dark:text-amber-100 text-amber-900',
    badgeBg: 'bg-amber-500 text-slate-900 font-bold',
    ringColor: 'ring-amber-400',
  },
  {
    letter: 'D',
    symbol: '■',
    cardBg: 'dark:bg-emerald-950/40 bg-emerald-50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-2 border-emerald-500/40 dark:text-emerald-100 text-emerald-900',
    badgeBg: 'bg-emerald-500 text-slate-900 font-bold',
    ringColor: 'ring-emerald-400',
  },
];

import {
  calculateFocusTransform,
  DocumentRect,
  FocusTransformResult,
} from '../../utils/focusZoomGeometry';

const FocusZoomPresentationView: React.FC<{
  presentation: PresentationState;
  onClose: () => void;
  isTeacher: boolean;
}> = ({ presentation, onClose, isTeacher }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isReset, setIsReset] = useState<boolean>(false);

  const rect = presentation.focusZoom?.rect;
  const html = presentation.focusZoom?.htmlSnippet || presentation.question || '';

  const paperW = rect?.paperWidth || 794;
  const paperH = rect?.paperHeight || 1123;

  useEffect(() => {
    if (!contentRef.current || !rect || !containerRef.current) return;

    const reducedMotion = prefersReducedMotion();
    const containerW = containerRef.current.clientWidth || window.innerWidth;
    const containerH = containerRef.current.clientHeight || window.innerHeight;

    if (isReset || rect.width <= 0 || rect.height <= 0) {
      // Widok pełnej strony (dopasowanie do okna)
      const fitScale = Math.min(
        (containerW - 48) / paperW,
        (containerH - 90) / paperH,
        1.0
      );
      const fitX = Math.max(0, (containerW - paperW * fitScale) / 2);
      const fitY = Math.max(0, (containerH - paperH * fitScale) / 2 + 20);

      setZoomLevel(Number(fitScale.toFixed(2)));

      if (reducedMotion) {
        gsap.set(contentRef.current, {
          scale: fitScale,
          x: fitX,
          y: fitY,
          transformOrigin: '0 0',
        });
      } else {
        gsap.to(contentRef.current, {
          scale: fitScale,
          x: fitX,
          y: fitY,
          transformOrigin: '0 0',
          duration: 0.45,
          ease: 'power2.inOut',
        });
      }
      return;
    }

    // Oblicz geometryczną transformację Focus Zoom
    const transform = calculateFocusTransform({
      focusRect: rect,
      paperWidth: paperW,
      paperHeight: paperH,
      viewportWidth: containerW,
      viewportHeight: containerH,
      padding: { top: 60, right: 30, bottom: 30, left: 30 },
      maxScale: rect.sourceType === 'object' ? 3.5 : 3.0,
      minScale: 1.0,
      marginRatio: 0.10,
    });

    setZoomLevel(transform.scale);

    if (reducedMotion) {
      gsap.set(contentRef.current, {
        scale: transform.scale,
        x: transform.targetX,
        y: transform.targetY,
        transformOrigin: '0 0',
      });
    } else {
      gsap.fromTo(
        contentRef.current,
        {
          scale: 1,
          x: (containerW - paperW) / 2,
          y: 60,
          transformOrigin: '0 0',
        },
        {
          scale: transform.scale,
          x: transform.targetX,
          y: transform.targetY,
          transformOrigin: '0 0',
          duration: 0.45,
          ease: 'power2.inOut',
        }
      );
    }
  }, [rect, isReset, paperW, paperH]);

  return (
    <div
      ref={containerRef}
      data-testid="focus-zoom-presentation-view"
      className="flex-1 w-full h-full relative overflow-hidden select-none"
    >
      {/* Pasek kontrolny Focus Zoom */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center justify-between gap-3 px-4 py-2 rounded-2xl bg-slate-900/90 border border-white/15 shadow-2xl backdrop-blur-xl text-white">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/15 font-bold flex items-center gap-1.5"
            title="Wróć do całej strony (Esc)"
          >
            <ArrowLeft size={14} />
            <span>Wróć do strony</span>
            <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] bg-white/20 rounded font-mono">Esc</kbd>
          </Button>

          <span className="w-px h-5 bg-white/20" />

          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
            <ZoomIn size={13} />
            <span>{zoomLevel}x</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsReset(!isReset)}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isReset ? 'Przywróć kadr Focus Zoom' : 'Pokaż pełną stronę (1x)'}
            aria-label="Resetuj zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Pojedynczy, stabilny wrapper prezentacyjny */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          ref={contentRef}
          className="pad-paper pad-sheet relative shadow-2xl rounded-sm pointer-events-auto"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${paperW}px`,
            minHeight: `${paperH}px`,
            padding: '76px',
            backgroundColor: '#fcfbf7',
            color: '#1e293b',
            transformOrigin: '0 0',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};

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

  const hasSlides = Boolean(presentation.slides && presentation.slides.length > 0);
  const slides = presentation.slides || [];
  const slideIndex = Math.min(Math.max(0, presentation.slideIndex || 0), Math.max(0, slides.length - 1));
  const activeSlideData = hasSlides ? slides[slideIndex] : presentation;

  const currentType = activeSlideData.type || presentation.type;
  const currentTitle = activeSlideData.title || presentation.title;
  const currentQuestion = activeSlideData.question ?? presentation.question;
  const currentPrompt = activeSlideData.prompt ?? presentation.prompt;
  const currentImageUrl = activeSlideData.imageUrl ?? presentation.imageUrl;
  const currentAudioUrl = activeSlideData.audioUrl ?? presentation.audioUrl;
  const currentAudioName = (activeSlideData as any).audioName ?? presentation.audioName;
  const currentHints = activeSlideData.hints ?? presentation.hints ?? [];
  const currentCards = activeSlideData.cards ?? presentation.cards ?? [];
  const currentSteps = activeSlideData.steps ?? presentation.steps ?? [];
  const currentOptions = activeSlideData.options ?? presentation.options ?? [];
  const currentCorrectAnswer = activeSlideData.correctAnswer ?? presentation.correctAnswer;
  const currentExplanation = activeSlideData.explanation ?? presentation.explanation;

  const isInteractive =
    currentType === 'interactive_quiz' ||
    currentType === 'sentence_scramble' ||
    currentType === 'error_hunt' ||
    Boolean(currentOptions && currentOptions.length > 0);

  const isAnswerRevealed = Boolean(presentation.revealedAnswer);
  const currentAnswer = presentation.studentAnswer != null ? String(presentation.studentAnswer) : null;
  const correctAnswerStr = currentCorrectAnswer != null ? String(currentCorrectAnswer) : '';
  const isStreamAudio = Boolean(currentAudioUrl && (currentAudioUrl.startsWith('http') && !currentAudioUrl.startsWith('data:')));

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

  // Nawigacja po slajdach w talii
  const handlePrevSlide = () => {
    if (!hasSlides || slideIndex <= 0) return;
    onUpdatePresentation?.({
      slideIndex: slideIndex - 1,
      revealedAnswer: false,
      studentAnswer: null,
    });
  };

  const handleNextSlide = () => {
    if (!hasSlides || slideIndex >= slides.length - 1) return;
    onUpdatePresentation?.({
      slideIndex: slideIndex + 1,
      revealedAnswer: false,
      studentAnswer: null,
    });
  };

  const handleJumpToSlide = (idx: number) => {
    if (!hasSlides || idx < 0 || idx >= slides.length) return;
    onUpdatePresentation?.({
      slideIndex: idx,
      revealedAnswer: false,
      studentAnswer: null,
    });
  };

  // Obsługa skrótów klawiszowych (ESC, Strzałki ← / →)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Nie przechwytuj, gdy użytkownik wpisuje tekst
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && isTeacher && hasSlides) {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'ArrowRight' && isTeacher && hasSlides) {
        e.preventDefault();
        handleNextSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isTeacher, hasSlides, slideIndex, slides.length]);

  if (!presentation.active) return null;

  const handleSelectOption = (opt: string) => {
    if (isAnswerRevealed) return;
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
    <div className="fixed inset-0 z-50 flex flex-col dark:bg-[#070b12]/98 bg-slate-100/98 backdrop-blur-2xl animate-in fade-in duration-300 dark:text-white text-slate-900 select-none overflow-y-auto p-3 sm:p-6 transition-colors duration-200">
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between pb-3.5 border-b dark:border-white/10 border-slate-300 max-w-5xl mx-auto w-full flex-wrap sm:flex-nowrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse shrink-0">
            <Zap size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-extrabold">
                {hasSlides
                  ? `Slajd ${slideIndex + 1} z ${slides.length}`
                  : currentType === 'focus_zoom'
                  ? '🔍 Focus Zoom • Kadr Lekcji'
                  : currentType === 'wheel_of_fortune'
                  ? '🎡 Koło Fortuny Live'
                  : currentType === 'listening'
                  ? '🎧 Słuchanie & Audio Live'
                  : currentType === 'flip_cards'
                  ? '🎴 Fiszki 3D E-Learning'
                  : currentType === 'process_tabs'
                  ? '📋 Etapy Procesu'
                  : isInteractive
                  ? '⚡ Interaktywne Ćwiczenie'
                  : 'Prezentacja Live'}
              </span>
              <span className="text-xs font-semibold dark:text-slate-400 text-slate-500">
                {isTeacher ? 'Widok lektora (sterowanie)' : 'Twój widok na żywo'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black dark:text-white text-slate-900 mt-0.5 truncate max-w-lg">
              {currentTitle || presentation.title || 'Lekcja na żywo'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          {/* Przełącznik motywu */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
            className="p-2 rounded-xl border dark:border-white/15 border-slate-300 dark:bg-slate-800/80 bg-white text-slate-700 dark:text-slate-200 hover:text-emerald-500 transition-colors cursor-pointer shadow-sm"
          >
            {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
          </button>

          {/* Odkrywanie poprawnej odpowiedzi przez lektora */}
          {isTeacher && isInteractive && !isAnswerRevealed && onRevealAnswer && (
            <button
              type="button"
              onClick={onRevealAnswer}
              className="text-xs font-bold py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Eye size={15} />
              <span className="hidden sm:inline">Odkryj odpowiedź</span>
            </button>
          )}

          {isTeacher ? (
            <button
              type="button"
              onClick={onClose}
              title="Zakończ prezentację (Klawisz Esc)"
              className="text-xs font-bold py-2 px-3.5 rounded-xl dark:bg-slate-800 bg-white hover:bg-rose-500 hover:text-white dark:text-white text-slate-800 border dark:border-white/15 border-slate-300 hover:border-rose-500 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <X size={15} />
              <span>Zakończ i wróć</span>
              <kbd className="text-[10px] font-mono opacity-75 px-1 py-0.2 rounded dark:bg-white/10 bg-slate-200">Esc</kbd>
            </button>
          ) : (
            <span className="text-xs font-bold dark:text-slate-300 text-slate-600 flex items-center gap-1.5 dark:bg-slate-800/80 bg-white border dark:border-white/10 border-slate-300 px-3 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Lektor prowadzi lekcję
            </span>
          )}
        </div>
      </div>

      {/* ── MULTI-SLIDE NAVIGATION HEADER (DLA TALII WIELOSLAJDOWYCH) ── */}
      {hasSlides && (
        <div className="max-w-5xl mx-auto w-full pt-3 flex items-center justify-between gap-2">
          {/* Miniaturki / Wskaźniki slajdów */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {slides.map((s, idx) => {
              const isActive = idx === slideIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => isTeacher && handleJumpToSlide(idx)}
                  disabled={!isTeacher}
                  title={`Slajd ${idx + 1}: ${s.title || s.type}`}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                      : 'dark:bg-slate-800/70 bg-white dark:text-slate-300 text-slate-700 border dark:border-white/10 border-slate-300 hover:border-emerald-500'
                  } ${isTeacher ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="opacity-80">#{idx + 1}</span>
                  <span className="hidden md:inline max-w-[120px] truncate">{s.title || s.type}</span>
                </button>
              );
            })}
          </div>

          {/* Przycisk nawigacji dla lektora */}
          {isTeacher && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrevSlide}
                disabled={slideIndex === 0}
                title="Poprzedni slajd (Klawisz ←)"
                className="p-1.5 px-2.5 rounded-lg border dark:border-white/15 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Poprzedni</span>
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                disabled={slideIndex === slides.length - 1}
                title="Następny slajd (Klawisz →)"
                className="p-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shadow-md"
              >
                <span className="hidden sm:inline">Następny</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN PRESENTATION CONTAINER ── */}
      {currentType === 'focus_zoom' ? (
        <FocusZoomPresentationView
          presentation={presentation}
          onClose={onClose}
          isTeacher={isTeacher}
        />
      ) : currentType === 'wheel_of_fortune' ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full my-4 sm:my-6 animate-in fade-in zoom-in-95 duration-200">
          <WheelOfFortune
            items={presentation.customItems}
            removeOnHit={presentation.removeOnHit}
            exerciseTitle={currentTitle}
            mode="presentation"
            onExitPresentation={onClose}
            slide={{
              id: 'scratchpad-live-wheel',
              type: 'wheel_of_fortune',
              title: currentTitle || 'Warm-up: Koło Fortuny',
              subtitle: currentPrompt || 'Zakręć kołem i wylosuj pytanie rozgrzewkowe na start lekcji',
            }}
            lessonRecords={lessonRecords}
            studentName={studentName}
            isFullscreen={true}
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
      ) : currentType === 'flip_cards' || currentType === 'process_tabs' || currentType === 'interactive_quiz' ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full my-4 sm:my-6 animate-in fade-in duration-200">
          <InteractiveSlideDeck
            type={currentType}
            title={currentTitle}
            cards={currentCards}
            steps={currentSteps}
            question={currentQuestion}
            prompt={currentPrompt}
            imageUrl={currentImageUrl}
            options={currentOptions}
            correctAnswer={currentCorrectAnswer}
            explanation={currentExplanation}
            hints={currentHints}
            isTeacher={isTeacher}
            revealedAnswer={presentation.revealedAnswer}
            selectedOption={presentation.studentAnswer}
            onSelectOption={(opt) => onSubmitAnswer && onSubmitAnswer(String(opt))}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full my-4 sm:my-6 space-y-6">
          {/* Optional Image */}
          {currentImageUrl && (
            <div className="relative group max-h-[36vh] rounded-3xl overflow-hidden border dark:border-white/10 border-slate-300 bg-slate-900 shadow-2xl">
              <img
                src={currentImageUrl}
                alt={currentTitle}
                className="w-full h-full object-contain max-h-[36vh] rounded-3xl"
              />
            </div>
          )}

          {/* Audio Player Banner */}
          {currentAudioUrl && (
            <div className="w-full max-w-2xl p-4 sm:p-5 rounded-3xl dark:bg-purple-950/50 bg-purple-50 border-2 dark:border-purple-500/40 border-purple-200 shadow-xl flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-md">
                    <Volume2 size={24} className="animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-extrabold text-purple-700 dark:text-purple-300 tracking-wider">
                        {isStreamAudio ? 'Strumień audio live' : 'Plik audio do odsłuchania'}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <h4 className="text-sm sm:text-base font-black dark:text-white text-slate-900 truncate max-w-[280px] sm:max-w-xs" title={currentAudioName || 'Ścieżka dźwiękowa'}>
                      {currentAudioName || 'Ścieżka dźwiękowa do odsłuchania'}
                    </h4>
                  </div>
                </div>

                {/* Kontrola prędkości i przewijania */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleSkipAudio(-10)}
                    title="Cofnij o 10 sekund"
                    className="px-2 py-1 rounded-lg dark:bg-slate-800 bg-white border dark:border-white/10 border-slate-300 text-xs font-mono font-bold dark:text-purple-200 text-purple-800 transition-colors cursor-pointer shadow-sm"
                  >
                    -10s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkipAudio(10)}
                    title="Przewiń o 10 sekund do przodu"
                    className="px-2 py-1 rounded-lg dark:bg-slate-800 bg-white border dark:border-white/10 border-slate-300 text-xs font-mono font-bold dark:text-purple-200 text-purple-800 transition-colors cursor-pointer shadow-sm"
                  >
                    +10s
                  </button>
                  <div className="flex items-center gap-1 dark:bg-slate-800 bg-white p-1 rounded-lg border dark:border-white/10 border-slate-300">
                    {[0.75, 1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold transition-all cursor-pointer ${
                          playbackSpeed === speed
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'dark:text-purple-300 text-purple-700 hover:bg-purple-100'
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
                  src={currentAudioUrl}
                  className="w-full h-10 rounded-xl accent-purple-500 shadow-inner"
                  preload="metadata"
                />
              </div>
            </div>
          )}

          {/* Prompt / Question Card */}
          <div className="w-full p-6 sm:p-10 rounded-3xl dark:bg-[#111827] bg-white border-2 dark:border-white/15 border-slate-200 shadow-2xl space-y-5 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
              <Sparkles size={14} />
              <span>
                {currentType === 'sentence_scramble'
                  ? 'Ułóż zdanie we właściwej kolejności'
                  : currentType === 'error_hunt'
                  ? 'Znajdź i popraw błąd'
                  : currentType === 'listening'
                  ? 'Rozumienie ze słuchu (Listening Comprehension)'
                  : currentType === 'scenario_item'
                  ? 'Zadanie komunikacyjne & Wyzwanie'
                  : 'Pytanie do zadania'}
              </span>
            </div>

            {currentQuestion && (
              <h3 className="text-2xl sm:text-4xl font-black dark:text-white text-slate-900 leading-tight max-w-3xl mx-auto">
                {currentQuestion}
              </h3>
            )}

            {currentPrompt && (
              <p className="text-base sm:text-lg dark:text-slate-300 text-slate-600 leading-relaxed max-w-2xl mx-auto font-medium">
                {currentPrompt}
              </p>
            )}

            {/* Kahoot-Style Multiple Choice Options */}
            {currentOptions && currentOptions.length > 0 && (
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-3xl mx-auto w-full">
                {currentOptions.map((opt, idx) => {
                  const optTheme = OPTION_THEMES[idx % OPTION_THEMES.length];
                  const isSelected = currentAnswer === opt || currentAnswer === String(idx);
                  const isCorrect =
                    correctAnswerStr === opt ||
                    correctAnswerStr === String(idx) ||
                    correctAnswerStr.toLowerCase().trim() === opt.toLowerCase().trim();

                  let cardStyle = optTheme.cardBg;
                  if (isAnswerRevealed) {
                    if (isCorrect) {
                      cardStyle =
                        'dark:bg-emerald-950/70 bg-emerald-100 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-4 ring-emerald-500/40 shadow-xl scale-[1.02]';
                    } else if (isSelected && !isCorrect) {
                      cardStyle = 'dark:bg-rose-950/50 bg-rose-100 border-2 border-rose-500 text-rose-900 dark:text-rose-200 line-through opacity-80';
                    } else {
                      cardStyle = 'dark:bg-slate-900/40 bg-slate-100 border dark:border-white/5 border-slate-200 text-slate-400 opacity-40';
                    }
                  } else if (isSelected) {
                    cardStyle = `dark:bg-emerald-950/60 bg-emerald-50 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-4 ring-emerald-500/40 shadow-lg scale-[1.02]`;
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswerRevealed}
                      onClick={() => handleSelectOption(opt)}
                      className={`p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all duration-200 cursor-pointer disabled:cursor-default shadow-md ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${optTheme.badgeBg}`}
                        >
                          {optTheme.letter}
                        </span>
                        <span className="font-bold text-sm sm:text-base leading-snug break-words">
                          {opt}
                        </span>
                      </div>

                      {/* Status icon */}
                      <div className="shrink-0">
                        {isAnswerRevealed && isCorrect && (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md">
                            <Check size={18} strokeWidth={3} />
                          </div>
                        )}
                        {isAnswerRevealed && isSelected && !isCorrect && (
                          <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold shadow-md">
                            <X size={18} strokeWidth={3} />
                          </div>
                        )}
                        {!isAnswerRevealed && isSelected && (
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-600 text-white uppercase shadow-sm">
                            Wybrano
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom text input */}
            {(!currentOptions || currentOptions.length === 0) && isInteractive && (
              <div className="pt-3 max-w-xl mx-auto w-full space-y-3">
                {!isAnswerRevealed ? (
                  <form onSubmit={handleCustomSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={localInputAnswer || currentAnswer || ''}
                      onChange={(e) => setLocalInputAnswer(e.target.value)}
                      placeholder="Wpisz swoją odpowiedź..."
                      className="flex-1 px-4 py-3 rounded-2xl dark:bg-slate-900 bg-slate-50 border-2 dark:border-white/15 border-slate-300 dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 text-sm font-semibold shadow-inner"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      Wyślij
                    </button>
                  </form>
                ) : (
                  <div className="p-4 rounded-2xl dark:bg-emerald-950/60 bg-emerald-50 border-2 border-emerald-500/50 text-left space-y-1 shadow-md">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      Poprawne rozwiązanie:
                    </div>
                    <div className="text-base font-extrabold dark:text-white text-slate-900 font-mono">{correctAnswerStr}</div>
                  </div>
                )}
              </div>
            )}

            {/* Status info bar */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs font-bold">
              {currentAnswer ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  {isTeacher
                    ? `Kursant wybrał: "${currentAnswer}"`
                    : isAnswerRevealed
                    ? 'Ćwiczenie rozwiązane!'
                    : 'Twoja odpowiedź została zarejestrowana. Czekaj na lektora.'}
                </span>
              ) : (
                <span className="dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {isTeacher ? 'Oczekiwanie na wybór kursanta...' : 'Wybierz jedną z opcji powyżej'}
                </span>
              )}
            </div>

            {/* Answer Revealed Explanation Callout */}
            {isAnswerRevealed && currentExplanation && (
              <div className="mt-4 p-5 sm:p-6 rounded-2xl dark:bg-emerald-950/50 bg-emerald-50 border-2 border-emerald-500/40 text-left space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold uppercase tracking-wider">
                  <Trophy size={16} />
                  <span>Wyjaśnienie i reguła językowa</span>
                </div>
                <p className="text-sm sm:text-base dark:text-slate-100 text-slate-800 leading-relaxed font-medium">
                  {currentExplanation}
                </p>
              </div>
            )}

            {/* Hints / Useful Vocabulary */}
            {currentHints && currentHints.length > 0 && (
              <div className="pt-4 border-t dark:border-white/10 border-slate-200 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowHints(!showHints)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lightbulb size={14} />
                  {showHints ? 'Ukryj podpowiedzi i słownictwo' : 'Pokaż podpowiedzi / Useful vocabulary'}
                </button>

                {showHints && (
                  <div className="flex flex-wrap items-center justify-center gap-2 animate-in fade-in duration-200">
                    {currentHints.map((hint, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-white/10 border-slate-300 dark:text-slate-200 text-slate-700 text-xs font-medium shadow-sm"
                      >
                        {hint}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sekcja notatek ze słuchania */}
            {(currentType === 'listening' || currentAudioUrl) && (
              <div className="pt-4 border-t dark:border-white/10 border-slate-200 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                  <span>📝 Notatki ze słuchania (kluczowe myśli, nowe słówka):</span>
                  {onAddToNotes && listeningNotes.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        onAddToNotes(`\n### 🎧 Notatki ze słuchania: ${currentAudioName || currentTitle || 'Nagranie'}\n${listeningNotes.trim()}\n`);
                        setCopiedNotes(true);
                        setTimeout(() => setCopiedNotes(false), 2000);
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-sm"
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
                  className="w-full px-4 py-3 rounded-2xl dark:bg-slate-900 bg-slate-50 border-2 dark:border-purple-500/30 border-purple-200 dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 text-xs font-medium shadow-inner"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div className="border-t dark:border-white/10 border-slate-300 pt-3 max-w-5xl mx-auto w-full text-center text-xs dark:text-slate-400 text-slate-500 flex items-center justify-between flex-wrap gap-2">
        <span className="font-mono font-semibold">CRIBRO Recall Live Classroom</span>
        <span className="hidden sm:inline">Po zakończeniu prezentacji następuje automatyczny powrót do wspólnego notatnika.</span>
        <span className="font-mono text-[11px]">Skróty: Esc (Wyjście) | ← / → (Slajdy)</span>
      </div>
    </div>
  );
};

export default ScratchpadPresentationOverlay;

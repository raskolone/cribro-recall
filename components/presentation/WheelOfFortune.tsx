import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import {
  Sparkles, RotateCcw, Volume2, CheckCircle2, Clock,
  HelpCircle, ChevronRight, Plus, Shuffle, Copy, Check,
  BookOpen, History, MessageSquare, Award, ArrowRight, Play, Pause,
  Sun, Moon, Pencil, X, Save
} from 'lucide-react';
import { PresentationSlide, LessonRecord } from '../../types';
import { SlideInteraction } from '../admin/presentation/SlideCard';
import TTSButtons from '../flashcards/TTSButtons';
import Button from '../ui/Button';
import { 
  WheelQuestionItem, 
  extractQuestionsFromScenario, 
  extractQuestionsFromPastLessons, 
  generateWheelQuestionsAI 
} from '../../services/wheelQuestionService';
import { animateDropletSuccess, prefersReducedMotion, cubicBezierEase } from '../../services/gsapAnimations';
import { useTheme } from '../../context/ThemeContext';

// Naturalna krzywa zwalniania koła fortuny — odpowiednik CSS
// `cubic-bezier(0.15, 0.9, 0.2, 1.0)`, policzona raz przy starcie modułu.
const WHEEL_SPIN_EASE = cubicBezierEase(0.15, 0.9, 0.2, 1.0);

// Skraca treść pytania do czytelnej etykiety na wycinku koła (pełny tekst trafia do karty wyniku).
const truncateForWheel = (text: string, max = 20): string =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

interface WheelOfFortuneProps {
  slide?: PresentationSlide;
  lessonRecords?: LessonRecord[];
  studentName?: string | null;
  isFullscreen?: boolean;
  interaction?: SlideInteraction;
  onInteractionChange?: (next: SlideInteraction) => void;
  onAddToNotes?: (text: string) => void;
  isStudent?: boolean;
}

// Stonowana, elegancka paleta dla sektorów koła w trybie ciemnym (Nocturne)
const SECTOR_PALETTE_DARK = [
  { fill: 'rgba(16, 185, 129, 0.32)', stroke: '#10b981', text: '#6ee7b7', name: 'Emerald' },
  { fill: 'rgba(14, 165, 233, 0.32)', stroke: '#0ea5e9', text: '#7dd3fc', name: 'Sky' },
  { fill: 'rgba(245, 158, 11, 0.32)', stroke: '#f59e0b', text: '#fcd34d', name: 'Amber' },
  { fill: 'rgba(139, 92, 246, 0.32)', stroke: '#8b5cf6', text: '#c4b5fd', name: 'Violet' },
  { fill: 'rgba(236, 72, 153, 0.32)', stroke: '#ec4899', text: '#f472b6', name: 'Rose' },
  { fill: 'rgba(20, 184, 166, 0.32)', stroke: '#14b8a6', text: '#5eead4', name: 'Teal' },
  { fill: 'rgba(99, 102, 241, 0.32)', stroke: '#6366f1', text: '#a5b4fc', name: 'Indigo' },
  { fill: 'rgba(249, 115, 22, 0.32)', stroke: '#f97316', text: '#fdba74', name: 'Orange' },
];

// Wyrazista, świeża paleta o wysokim kontraście dla sektorów koła w trybie jasnym (Clean Studio)
const SECTOR_PALETTE_LIGHT = [
  { fill: 'rgba(16, 185, 129, 0.22)', stroke: '#059669', text: '#064e3b', name: 'Emerald' },
  { fill: 'rgba(14, 165, 233, 0.22)', stroke: '#0284c7', text: '#075985', name: 'Sky' },
  { fill: 'rgba(245, 158, 11, 0.22)', stroke: '#d97706', text: '#78350f', name: 'Amber' },
  { fill: 'rgba(139, 92, 246, 0.22)', stroke: '#7c3aed', text: '#4c1d95', name: 'Violet' },
  { fill: 'rgba(236, 72, 153, 0.22)', stroke: '#db2777', text: '#831843', name: 'Rose' },
  { fill: 'rgba(20, 184, 166, 0.22)', stroke: '#0d9488', text: '#134e4a', name: 'Teal' },
  { fill: 'rgba(99, 102, 241, 0.22)', stroke: '#4f46e5', text: '#312e81', name: 'Indigo' },
  { fill: 'rgba(249, 115, 22, 0.22)', stroke: '#ea580c', text: '#7c2d12', name: 'Orange' },
];

export const WheelOfFortune: React.FC<WheelOfFortuneProps> = ({
  slide,
  lessonRecords = [],
  studentName,
  isFullscreen = false,
  interaction,
  onInteractionChange,
  onAddToNotes,
  isStudent = false,
}) => {
  // Bezpieczne pobranie motywu lektora/kursanta (niezależne w każdym oknie)
  let currentTheme: 'light' | 'dark' = 'dark';
  let toggleTheme = () => {};
  try {
    const themeCtx = useTheme();
    currentTheme = themeCtx.theme;
    toggleTheme = themeCtx.toggleTheme;
  } catch {
    // Fallback gdy komponent jest renderowany poza ThemeProvider
  }
  const isDark = currentTheme === 'dark';
  const sectorPalette = isDark ? SECTOR_PALETTE_DARK : SECTOR_PALETTE_LIGHT;

  // Wybór źródła pytań (scenariusz vs poprzednie lekcje kursanta)
  const [questionSource, setQuestionSource] = useState<'scenario' | 'past_lessons'>(() => {
    if (slide?.wheelQuestions && slide.wheelQuestions.length > 0) return 'scenario';
    if (lessonRecords && lessonRecords.length > 0) return 'past_lessons';
    return 'scenario';
  });

  // Pula pytań dla obu źródeł
  const scenarioQuestions = useMemo(() => {
    return extractQuestionsFromScenario(slide, null);
  }, [slide]);

  const pastLessonQuestions = useMemo(() => {
    return extractQuestionsFromPastLessons(lessonRecords, studentName);
  }, [lessonRecords, studentName]);

  // Automatyczne przełączenie na historię gdy załadują się rekordy lekcji i brak pytań ze scenariusza
  useEffect(() => {
    if (lessonRecords && lessonRecords.length > 0 && (!slide?.wheelQuestions || slide.wheelQuestions.length === 0)) {
      setQuestionSource('past_lessons');
    }
  }, [lessonRecords?.length, slide?.wheelQuestions]);

  // Aktywna lista pytań
  const [activeQuestions, setActiveQuestions] = useState<WheelQuestionItem[]>(() => {
    return lessonRecords && lessonRecords.length > 0 && (!slide?.wheelQuestions || slide.wheelQuestions.length === 0)
      ? pastLessonQuestions
      : scenarioQuestions;
  });
  const [discussedQuestionIds, setDiscussedQuestionIds] = useState<Set<string>>(new Set());
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [drawnQuestion, setDrawnQuestion] = useState<WheelQuestionItem | null>(null);
  const [showQuestionPool, setShowQuestionPool] = useState<boolean>(false);
  const [copiedQuestion, setCopiedQuestion] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isEditingQuestions, setIsEditingQuestions] = useState<boolean>(false);
  const [questionsDraft, setQuestionsDraft] = useState<string>('');

  // Stoper wypowiedzi (60 sekund dla kursanta)
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Referencje DOM i animacji GSAP
  const wheelSvgRef = useRef<SVGSVGElement | null>(null);
  const wheelGroupRef = useRef<SVGGElement | null>(null);
  const needleRef = useRef<SVGSVGElement | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef<number>(0);
  const lastPegIndexRef = useRef<number>(-1);
  const lastTickTimeRef = useRef<number>(0);

  // Synchronizacja źródła pytań
  useEffect(() => {
    if (questionSource === 'scenario') {
      setActiveQuestions(scenarioQuestions);
    } else {
      setActiveQuestions(pastLessonQuestions);
    }
  }, [questionSource, scenarioQuestions, pastLessonQuestions]);

  // Synchronizacja zewnętrzna (z LiveSession przez interaction)
  useEffect(() => {
    if (!interaction) return;

    if (interaction.questionSource && interaction.questionSource !== questionSource) {
      setQuestionSource(interaction.questionSource);
    }

    if (
      interaction.wheelRotation != null &&
      Math.abs(interaction.wheelRotation - rotationRef.current) > 1
    ) {
      // Zewnętrzny trigger obrotu koła (np. lektor zakręcił, kursant płynnie odbiera ruch)
      performWheelSpin(interaction.wheelRotation, interaction.drawnQuestionId, true);
    }
  }, [interaction?.wheelRotation, interaction?.questionSource, interaction?.drawnQuestionId]);

  // Obsługa stopera
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  // Liczba sektorów i kąt pojedynczego wycinka
  const questionsCount = Math.max(1, activeQuestions.length);
  const sliceAngle = 360 / questionsCount;
  const wheelRadius = 175;
  const centerCoord = 200;

  // Główna funkcja wykonująca obrót koła z ulepszoną, płynną fizyką
  const performWheelSpin = (targetRotation: number, forcedWinnerId?: string | null, isRemote = false) => {
    if (!wheelGroupRef.current) return;

    setIsSpinning(true);
    setIsTimerRunning(false);
    setTimerSeconds(60);
    lastPegIndexRef.current = -1;

    if (prefersReducedMotion()) {
      rotationRef.current = targetRotation;
      gsap.set(wheelGroupRef.current, { rotation: targetRotation });
      setIsSpinning(false);
      finishSpin(targetRotation, forcedWinnerId);
      return;
    }

    gsap.killTweensOf(wheelGroupRef.current);
    if (needleRef.current) gsap.killTweensOf(needleRef.current);

    // Naturalny, "fizyczny" czas trwania: 4.5s (oraz 4.0s dla zdalnej synchronizacji kursanta, aby nie lagował)
    const spinDuration = isRemote ? 4.0 : 4.5;

    gsap.to(wheelGroupRef.current, {
      rotation: targetRotation,
      duration: spinDuration,
      ease: WHEEL_SPIN_EASE,
      onUpdate: () => {
        if (!wheelGroupRef.current) return;
        const currentRot = gsap.getProperty(wheelGroupRef.current, 'rotation') as number;
        const normalizedRot = ((currentRot % 360) + 360) % 360;
        const currentPeg = Math.floor(normalizedRot / sliceAngle);

        if (currentPeg !== lastPegIndexRef.current && needleRef.current) {
          lastPegIndexRef.current = currentPeg;
          const now = performance.now();
          // Ograniczenie częstotliwości animacji iglicy (max ~25 fps) – koniec z lagami CPU!
          if (now - lastTickTimeRef.current > 38) {
            lastTickTimeRef.current = now;
            gsap.to(needleRef.current, {
              rotation: -14,
              duration: 0.04,
              yoyo: true,
              repeat: 1,
              overwrite: 'auto',
              ease: 'power1.out',
            });
          }
        }
      },
      onComplete: () => {
        rotationRef.current = targetRotation;
        if (needleRef.current) {
          gsap.to(needleRef.current, { rotation: 0, duration: 0.15, ease: 'back.out(2)' });
        }
        setIsSpinning(false);
        finishSpin(targetRotation, forcedWinnerId);
      }
    });
  };

  // Zakończenie obrotu, wyznaczenie wylosowanego pytania
  const finishSpin = (finalRotation: number, forcedWinnerId?: string | null) => {
    const normalizedRotation = ((finalRotation % 360) + 360) % 360;
    const pointerAngle = (360 - normalizedRotation + 270) % 360;
    const winningIndex = Math.floor(pointerAngle / sliceAngle) % questionsCount;

    let winner = activeQuestions[winningIndex];
    if (forcedWinnerId) {
      const found = activeQuestions.find(q => q.id === forcedWinnerId);
      if (found) winner = found;
    }

    setDrawnQuestion(winner || null);

    if (resultCardRef.current) {
      animateDropletSuccess(resultCardRef.current);
    }

    // Subtelne konfetti świętujące wylosowanie pytania
    try {
      confetti({
        particleCount: 28,
        spread: 55,
        origin: { y: 0.7 },
        colors: isDark 
          ? ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6'] 
          : ['#059669', '#0284c7', '#d97706', '#7c3aed'],
        disableForReducedMotion: true
      });
    } catch {}
  };

  // Wywołanie zakręcenia przez użytkownika
  const handleSpinClick = () => {
    if (isSpinning || activeQuestions.length === 0) return;

    const undiscussedIndices = activeQuestions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => !discussedQuestionIds.has(q.id));

    const poolToChooseFrom = undiscussedIndices.length > 0
      ? undiscussedIndices
      : activeQuestions.map((q, idx) => ({ q, idx }));

    const randomPick = poolToChooseFrom[Math.floor(Math.random() * poolToChooseFrom.length)];
    const chosenIndex = randomPick.idx;
    const chosenQuestion = randomPick.q;

    // Kąt środka wybranego wycinka
    const sliceCenterAngle = chosenIndex * sliceAngle + sliceAngle / 2;
    // Dopasowanie do iglicy na 270° (godzina 12:00)
    const targetAngleAtPointer = (270 - sliceCenterAngle + 360) % 360;

    // Min. 5 pełnych obrotów (1800°) dla spektakularnego, satysfakcjonującego ruchu
    const extraSpins = (5 + Math.floor(Math.random() * 2)) * 360;
    const currentRot = rotationRef.current;
    const currentModulo = ((currentRot % 360) + 360) % 360;
    const angleDelta = ((targetAngleAtPointer - currentModulo) + 360) % 360;

    const finalTargetRotation = currentRot + extraSpins + angleDelta;

    if (onInteractionChange) {
      onInteractionChange({
        revealedAnswers: interaction?.revealedAnswers || {},
        highlightedItemId: chosenQuestion.id,
        randomQuestionIndex: chosenIndex,
        wheelRotation: finalTargetRotation,
        isWheelSpinning: true,
        drawnQuestionId: chosenQuestion.id,
        drawnQuestionText: chosenQuestion.question,
        questionSource
      });
    }

    performWheelSpin(finalTargetRotation, chosenQuestion.id, false);
  };

  // Oznaczenie pytania jako omówionego
  const toggleQuestionDiscussed = (id: string) => {
    setDiscussedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Kopiowanie do schowka / notatek
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestion(true);
    setTimeout(() => setCopiedQuestion(false), 2000);
    if (onAddToNotes) {
      onAddToNotes(text);
    }
  };

  // Otwarcie panelu szybkiej edycji puli pytań (lektor)
  const handleOpenQuestionEditor = () => {
    setQuestionsDraft(activeQuestions.map(q => q.question).join('\n'));
    setIsEditingQuestions(true);
  };

  // Zapis ręcznie edytowanej puli pytań — jedna linia = jedno pytanie
  const handleSaveEditedQuestions = () => {
    const lines = questionsDraft
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const editedQuestions: WheelQuestionItem[] = lines.map((line, idx) => ({
      id: `custom-${Date.now()}-${idx}`,
      question: line,
      category: 'custom',
      sourceTag: 'Edycja lektora'
    }));

    setActiveQuestions(editedQuestions);
    setDiscussedQuestionIds(new Set());
    setDrawnQuestion(null);
    setIsEditingQuestions(false);
  };

  // Generowanie pytań przez AI
  const handleGenerateAiQuestions = async () => {
    setIsAiGenerating(true);
    try {
      const topic = slide?.title || 'Everyday and Business English';
      const level = 'B2';
      const aiQuestions = await generateWheelQuestionsAI(topic, level);
      if (aiQuestions && aiQuestions.length > 0) {
        setActiveQuestions(aiQuestions);
        setDiscussedQuestionIds(new Set());
        setDrawnQuestion(null);
      }
    } catch (e) {
      console.error('Błąd generowania pytań AI do koła:', e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300 select-none">
      {/* ─── GÓRNY PASEK WYBORU ŹRÓDŁA I AKCJI LEKTORA / KURSANTA ─── */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-colors duration-200 backdrop-blur-xl ${
        isDark 
          ? 'bg-slate-900/80 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-white/90 border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.06)]'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-mono uppercase font-bold flex items-center gap-1.5 mr-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <Sparkles size={13} className="text-primary" /> Źródło pytań:
          </span>

          {/* Przełącznik: Aktualny Scenariusz */}
          <button
            type="button"
            disabled={isSpinning}
            onClick={() => {
              setQuestionSource('scenario');
              if (onInteractionChange) {
                onInteractionChange({
                  revealedAnswers: interaction?.revealedAnswers || {},
                  highlightedItemId: interaction?.highlightedItemId || null,
                  randomQuestionIndex: interaction?.randomQuestionIndex || null,
                  questionSource: 'scenario'
                });
              }
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              questionSource === 'scenario'
                ? isDark
                  ? 'bg-primary/25 border-primary text-primary shadow-[0_0_15px_rgba(114,240,180,0.25)] ring-1 ring-primary/40'
                  : 'bg-emerald-500/15 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500/40 shadow-sm'
                : isDark
                ? 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <BookOpen size={13} />
            <span>Aktualny scenariusz</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              isDark ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {scenarioQuestions.length}
            </span>
          </button>

          {/* Przełącznik: Poprzednie Lekcje Kursanta */}
          <button
            type="button"
            disabled={isSpinning}
            onClick={() => {
              setQuestionSource('past_lessons');
              if (onInteractionChange) {
                onInteractionChange({
                  revealedAnswers: interaction?.revealedAnswers || {},
                  highlightedItemId: interaction?.highlightedItemId || null,
                  randomQuestionIndex: interaction?.randomQuestionIndex || null,
                  questionSource: 'past_lessons'
                });
              }
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              questionSource === 'past_lessons'
                ? isDark
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.25)] ring-1 ring-amber-400/40'
                  : 'bg-amber-500/15 border-amber-500 text-amber-900 ring-1 ring-amber-500/40 shadow-sm'
                : isDark
                ? 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <History size={13} />
            <span>Z poprzednich lekcji</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              isDark ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {pastLessonQuestions.length}
            </span>
          </button>
        </div>

        {/* Akcje pomocnicze */}
        <div className="flex items-center gap-2 ml-auto">
          {!isStudent && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isSpinning || isAiGenerating}
              onClick={handleGenerateAiQuestions}
              className={`h-8 px-2.5 text-xs font-bold flex items-center gap-1.5 border ${
                isDark 
                  ? 'border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary' 
                  : 'border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
              }`}
              title="Wygeneruj 8 świeżych pytań rozgrzewkowych przez AI"
            >
              <Sparkles size={12} className={isAiGenerating ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Nowe pytania AI</span>
            </Button>
          )}

          {!isStudent && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isSpinning}
              onClick={handleOpenQuestionEditor}
              className={`h-8 px-2.5 text-xs font-bold flex items-center gap-1.5 ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Szybko dopisz lub usuń pytania z puli"
            >
              <Pencil size={12} />
              <span className="hidden sm:inline">Edytuj pytania</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowQuestionPool(!showQuestionPool)}
            className={`h-8 px-2.5 text-xs flex items-center gap-1 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle size={13} />
            <span>{showQuestionPool ? 'Ukryj listę' : 'Pokaż pytania'}</span>
          </Button>

          {/* Przełącznik motywu (Lektor i kursant zmieniają niezależnie w swoim oknie) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
            className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
              isDark
                ? 'border-white/10 bg-white/5 text-amber-400 hover:bg-white/10 hover:border-white/20'
                : 'border-slate-200 bg-slate-100/80 text-indigo-600 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* ─── PODGLĄD LISTY PYTAŃ (JEŚLI ROZWINIĘTA) ─── */}
      {showQuestionPool && (
        <div className={`p-4 rounded-2xl border space-y-2.5 animate-fadeIn backdrop-blur-xl ${
          isDark 
            ? 'bg-slate-900/85 border-white/10' 
            : 'bg-white/95 border-slate-200 shadow-md'
        }`}>
          <div className={`flex items-center justify-between pb-2 border-b ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}>
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <span>🎯</span> Pula pytań na kole ({activeQuestions.length}):
            </span>
            <span className="text-[11px] font-mono text-primary font-bold">
              Omówione: {discussedQuestionIds.size} / {activeQuestions.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {activeQuestions.map((q, idx) => {
              const isDiscussed = discussedQuestionIds.has(q.id);
              const isCurrent = drawnQuestion?.id === q.id;
              return (
                <div
                  key={q.id}
                  onClick={() => toggleQuestionDiscussed(q.id)}
                  className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                    isCurrent
                      ? isDark
                        ? 'bg-primary/20 border-primary text-white ring-1 ring-primary/40'
                        : 'bg-emerald-500/15 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/40'
                      : isDiscussed
                      ? isDark
                        ? 'bg-base-200/40 border-white/5 text-content-muted line-through opacity-60'
                        : 'bg-slate-100 border-slate-200 text-slate-400 line-through opacity-60'
                      : isDark
                      ? 'bg-base-200/80 border-white/10 text-text-hi hover:border-white/20'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`w-5 h-5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-white/10' : 'bg-slate-200'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{q.question}</p>
                      {q.sourceTag && (
                        <span className={`text-[9px] font-mono ${isDark ? 'text-content-muted' : 'text-slate-500'}`}>
                          {q.sourceTag}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`p-1 rounded-md transition-colors ${
                      isDiscussed ? 'text-primary' : isDark ? 'text-content-muted hover:text-white' : 'text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SZYBKA EDYCJA PULI PYTAŃ (LEKTOR) ─── */}
      {isEditingQuestions && !isStudent && (
        <div className={`p-4 rounded-2xl border space-y-3 animate-fadeIn backdrop-blur-xl ${
          isDark
            ? 'bg-slate-900/85 border-white/10'
            : 'bg-white/95 border-slate-200 shadow-md'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Pencil size={13} /> Edytuj pulę pytań (jedno pytanie na wiersz)
            </span>
            <button
              type="button"
              onClick={() => setIsEditingQuestions(false)}
              className={`p-1 rounded-md ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              title="Zamknij bez zapisywania"
            >
              <X size={14} />
            </button>
          </div>

          <textarea
            value={questionsDraft}
            onChange={(e) => setQuestionsDraft(e.target.value)}
            rows={8}
            placeholder={"What was the highlight of your week?\nHow do you usually unwind after work?\n..."}
            className={`w-full text-xs font-mono rounded-xl border p-3 resize-y focus:outline-none focus:ring-1 ${
              isDark
                ? 'bg-black/30 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary/40'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500/40'
            }`}
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditingQuestions(false)}
              className={`h-8 px-3 text-xs ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Anuluj
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSaveEditedQuestions}
              className="h-8 px-3 text-xs font-bold flex items-center gap-1.5 bg-primary text-accent-ink hover:brightness-110"
            >
              <Save size={13} />
              Zapisz pulę
            </Button>
          </div>
        </div>
      )}

      {/* ─── CENTRALNY OBSZAR: KOŁO FORTUNY + WYNIK ROZGRZEWKI ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* LEWA STRONA / ŚRODEK: ANIMOWANE KOŁO W GSAP */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative py-2">
          {/* Pojemnik Koła */}
          <div className="relative w-[340px] h-[340px] sm:w-[380px] sm:h-[380px] flex items-center justify-center">
            {/* Optyczna poświata tła */}
            <div className={`absolute inset-0 rounded-full blur-2xl pointer-events-none ${
              isDark 
                ? 'bg-gradient-to-tr from-primary/20 via-sky-500/15 to-purple-500/15'
                : 'bg-gradient-to-tr from-emerald-500/15 via-sky-400/10 to-amber-400/10'
            }`} />

            {/* Wskaźnik iglicy na godzinie 12:00 */}
            <div className="absolute -top-3 z-30 flex flex-col items-center pointer-events-none">
              <svg
                ref={needleRef}
                width="34"
                height="44"
                viewBox="0 0 34 44"
                fill="none"
                className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] origin-top"
              >
                <path
                  d="M17 44L4 12C2.5 8 5.5 2 10 2H24C28.5 2 31.5 8 30 12L17 44Z"
                  fill="url(#needle-gradient)"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle cx="17" cy="10" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
                <defs>
                  <linearGradient id="needle-gradient" x1="17" y1="2" x2="17" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f59e0b" />
                    <stop offset="0.6" stopColor="#d97706" />
                    <stop offset="1" stopColor="#b45309" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Główny SVG Koła z wycinkami */}
            <svg
              ref={wheelSvgRef}
              width="380"
              height="380"
              viewBox="0 0 400 400"
              className={`w-full h-full max-w-[380px] max-h-[380px] select-none ${
                isDark ? 'drop-shadow-[0_12px_35px_rgba(0,0,0,0.7)]' : 'drop-shadow-[0_12px_28px_rgba(15,23,42,0.14)]'
              }`}
            >
              <defs>
                {/* Gradient ramki - Tryb ciemny */}
                <radialGradient id="rim-gradient-dark" cx="50%" cy="50%" r="50%">
                  <stop offset="88%" stopColor="#182234" />
                  <stop offset="96%" stopColor="#25344d" />
                  <stop offset="100%" stopColor="#0b101b" />
                </radialGradient>
                {/* Gradient ramki - Tryb jasny */}
                <radialGradient id="rim-gradient-light" cx="50%" cy="50%" r="50%">
                  <stop offset="88%" stopColor="#f8fafc" />
                  <stop offset="96%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </radialGradient>
                {/* Wewnętrzny blask soczewki */}
                <radialGradient id="center-glaze" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.45)'} />
                  <stop offset="70%" stopColor={isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)'} />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>

              {/* Zewnętrzna obwódka koła */}
              <circle
                cx={centerCoord}
                cy={centerCoord}
                r={wheelRadius + 14}
                fill={isDark ? 'url(#rim-gradient-dark)' : 'url(#rim-gradient-light)'}
                stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.15)'}
                strokeWidth="3"
              />

              {/* Obracająca się grupa wycinków koła */}
              <g ref={wheelGroupRef} className="origin-[200px_200px]">
                {activeQuestions.map((q, idx) => {
                  const startAngle = idx * sliceAngle;
                  const endAngle = startAngle + sliceAngle;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;

                  const x1 = centerCoord + wheelRadius * Math.cos(startRad);
                  const y1 = centerCoord + wheelRadius * Math.sin(startRad);
                  const x2 = centerCoord + wheelRadius * Math.cos(endRad);
                  const y2 = centerCoord + wheelRadius * Math.sin(endRad);

                  const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                  const pathData = `M ${centerCoord} ${centerCoord} L ${x1} ${y1} A ${wheelRadius} ${wheelRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                  const colorInfo = sectorPalette[idx % sectorPalette.length];
                  const midAngle = startAngle + sliceAngle / 2;
                  const isWinner = drawnQuestion?.id === q.id && !isSpinning;

                  // Pozycja tekstu/numeru sektora wewnątrz wycinka
                  const textRadius = wheelRadius * 0.72;
                  const textRad = (midAngle * Math.PI) / 180;
                  const tx = centerCoord + textRadius * Math.cos(textRad);
                  const ty = centerCoord + textRadius * Math.sin(textRad);

                  // Inteligentna orientacja tekstu — koniec z obróconymi do góry nogami cyframi!
                  const isBottomHalf = midAngle > 90 && midAngle < 270;
                  const textRotation = isBottomHalf ? midAngle - 90 : midAngle + 90;

                  return (
                    <g key={q.id || idx}>
                      <title>{q.question}</title>
                      {/* Sektor / Wedge */}
                      <path
                        d={pathData}
                        fill={
                          isWinner 
                            ? isDark ? 'rgba(114, 240, 180, 0.45)' : 'rgba(16, 185, 129, 0.38)' 
                            : colorInfo.fill
                        }
                        stroke={isWinner ? (isDark ? '#72f0b4' : '#059669') : colorInfo.stroke}
                        strokeWidth={isWinner ? '2.5' : '1.2'}
                        className="transition-colors duration-200"
                      />

                      {/* Treść pytania (skrócona) — zawsze biały tekst z text-shadow, czytelny na każdym kolorze i w obu motywach */}
                      <text
                        x={tx}
                        y={ty}
                        fill="#ffffff"
                        fontSize="10.5"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.75), 0 1px 4px rgba(0,0,0,0.55)' }}
                        className="pointer-events-none"
                      >
                        {truncateForWheel(q.question)}
                      </text>
                    </g>
                  );
                })}

                {/* Kołki (pegs) na obrzeżu koła */}
                {activeQuestions.map((_, idx) => {
                  const angle = idx * sliceAngle;
                  const rad = (angle * Math.PI) / 180;
                  const px = centerCoord + (wheelRadius + 6) * Math.cos(rad);
                  const py = centerCoord + (wheelRadius + 6) * Math.sin(rad);
                  return (
                    <circle
                      key={`peg-${idx}`}
                      cx={px}
                      cy={py}
                      r="3.5"
                      fill="#ffffff"
                      stroke={isDark ? '#0f172a' : '#475569'}
                      strokeWidth={isDark ? '1' : '1.2'}
                      className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                    />
                  );
                })}
              </g>

              {/* Szklana soczewka na całym kole */}
              <circle
                cx={centerCoord}
                cy={centerCoord}
                r={wheelRadius}
                fill="url(#center-glaze)"
                pointerEvents="none"
              />
            </svg>

            {/* Środkowy przycisk 3D (SPIN / ZAKRĘĆ) dopasowany do motywu */}
            <div className="absolute z-20 flex items-center justify-center">
              <button
                type="button"
                onClick={handleSpinClick}
                disabled={isSpinning || activeQuestions.length === 0}
                title="Kliknij, aby zakręcić kołem fortuny"
                className={`w-24 h-24 sm:w-26 sm:h-26 rounded-full border flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none ${
                  isSpinning
                    ? isDark
                      ? 'scale-95 bg-primary/25 border-primary text-primary animate-pulse'
                      : 'scale-95 bg-emerald-500/20 border-emerald-500 text-emerald-700 animate-pulse'
                    : isDark
                    ? 'bg-gradient-to-b from-slate-800/95 via-slate-900 to-black border-white/25 text-white shadow-[0_6px_25px_rgba(0,0,0,0.7),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:border-primary hover:text-primary hover:scale-105 active:scale-95'
                    : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 text-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.12),inset_0_2px_4px_#ffffff] hover:border-emerald-500 hover:text-emerald-700 hover:scale-105 active:scale-95'
                }`}
              >
                <div className={`p-1 rounded-full mb-0.5 ${
                  isDark ? 'bg-primary/20 text-primary' : 'bg-emerald-500/15 text-emerald-600'
                }`}>
                  <RotateCcw size={16} className={isSpinning ? 'animate-spin' : ''} />
                </div>
                <span className="font-black text-[13px] tracking-wider uppercase">
                  {isSpinning ? 'LOSUJĘ…' : 'ZAKRĘĆ'}
                </span>
                <span className={`text-[8px] font-mono opacity-80 uppercase tracking-widest ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  SPIN
                </span>
              </button>
            </div>
          </div>

          <p className={`text-[11px] mt-2 font-mono flex items-center gap-1.5 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span>💡</span> Kliknij środek koła, aby wylosować pytanie do dyskusji
          </p>
        </div>

        {/* PRAWA STRONA: WYNIK LOSOWANIA I KARTA ROZGRZEWKI */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div
            ref={resultCardRef}
            className={`p-6 rounded-3xl border relative overflow-hidden flex flex-col justify-between min-h-[340px] transition-colors duration-200 backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/80 border-primary/30 shadow-[0_12px_40px_rgba(0,0,0,0.5)]'
                : 'bg-white/95 border-emerald-500/30 shadow-[0_12px_36px_rgba(15,23,42,0.08)]'
            }`}
          >
            {/* Tło akcentowe */}
            <div className={`absolute top-0 right-0 w-60 h-60 rounded-full blur-3xl pointer-events-none ${
              isDark ? 'bg-primary/10' : 'bg-emerald-500/10'
            }`} />

            <div className="relative z-10 space-y-4">
              {/* Nagłówek statusu pytania */}
              <div className={`flex items-center justify-between gap-2 flex-wrap pb-3 border-b ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}>
                    <Award size={13} />
                    {drawnQuestion ? 'Wylosowane pytanie' : 'Gotowy do rozgrzewki'}
                  </span>
                  {drawnQuestion?.sourceTag && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {drawnQuestion.sourceTag}
                    </span>
                  )}
                </div>

                {drawnQuestion && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleQuestionDiscussed(drawnQuestion.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                        discussedQuestionIds.has(drawnQuestion.id)
                          ? isDark
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isDark
                          ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title="Oznacz jako omówione (nie pojawi się w kolejnych losowaniach)"
                    >
                      <CheckCircle2 size={13} />
                      <span>{discussedQuestionIds.has(drawnQuestion.id) ? 'Omówione ✓' : 'Zakończone'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(drawnQuestion.question)}
                      className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                        isDark 
                          ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5' 
                          : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="Kopiuj treść pytania lub dodaj do notatnika"
                    >
                      {copiedQuestion ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Treść wylosowanego pytania */}
              {drawnQuestion ? (
                <div className="space-y-3 pt-1 animate-fadeIn">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className={`font-extrabold leading-relaxed tracking-tight ${
                      isDark ? 'text-white' : 'text-slate-900'
                    } ${
                      isFullscreen ? 'text-xl sm:text-2xl md:text-3xl' : 'text-xl sm:text-2xl'
                    }`}>
                      "{drawnQuestion.question}"
                    </h3>
                    <TTSButtons text={drawnQuestion.question} />
                  </div>

                  {drawnQuestion.followUpHint && (
                    <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                      isDark 
                        ? 'bg-base-300/70 border-primary/20 text-slate-300' 
                        : 'bg-emerald-50/70 border-emerald-200 text-slate-700'
                    }`}>
                      <span className="font-bold text-primary flex items-center gap-1 text-[11px] font-mono uppercase">
                        <Sparkles size={11} /> Wskazówka do dyskusji:
                      </span>
                      <p>{drawnQuestion.followUpHint}</p>
                    </div>
                  )}

                  {drawnQuestion.relatedWord && (
                    <div className={`text-xs font-mono p-2 rounded-lg inline-block border ${
                      isDark 
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' 
                        : 'text-amber-900 bg-amber-50 border-amber-200'
                    }`}>
                      🎯 Słówko kluczowe do użycia: <span className="font-bold underline">{drawnQuestion.relatedWord}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className={`w-14 h-14 rounded-3xl border flex items-center justify-center mx-auto text-2xl shadow-inner ${
                    isDark 
                      ? 'bg-primary/10 border-primary/25 text-primary' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  }`}>
                    🎯
                  </div>
                  <div>
                    <h4 className={`text-base sm:text-lg font-extrabold ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      Zakręć kołem fortuny!
                    </h4>
                    <p className={`text-xs max-w-sm mx-auto mt-1 leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Wylosuj pierwsze pytanie do rozgrzewki. Wybierz powyżej, czy chcesz pytania ze scenariusza czy z poprzednich lekcji.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ─── DOLNY PASEK: STOPER WYPOWIEDZI & PRZYCISK PONOWNEGO LOSOWANIA ─── */}
            <div className={`relative z-10 pt-4 border-t mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              {/* Mini-stoper mówienia (Speaking pace) */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                  isDark ? 'bg-base-300/90 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}>
                  <Clock size={13} className={isTimerRunning ? 'text-primary animate-pulse' : isDark ? 'text-slate-400' : 'text-slate-500'} />
                  <span>{timerSeconds}s</span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (isTimerRunning) {
                      setIsTimerRunning(false);
                    } else {
                      if (timerSeconds === 0) setTimerSeconds(60);
                      setIsTimerRunning(true);
                    }
                  }}
                  className={`h-8 px-2.5 text-xs ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
                  <span className="ml-1">{isTimerRunning ? 'Pauza' : 'Start (60s)'}</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(60);
                  }}
                  className={`h-8 px-2 text-xs ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Resetuj stoper"
                >
                  <RotateCcw size={12} />
                </Button>
              </div>

              {/* Przycisk zakręć ponownie */}
              <Button
                size="sm"
                variant="primary"
                disabled={isSpinning || activeQuestions.length === 0}
                onClick={handleSpinClick}
                className="w-full sm:w-auto text-xs font-extrabold flex items-center justify-center gap-1.5 bg-primary text-accent-ink hover:brightness-110 shadow-[0_0_15px_rgba(114,240,180,0.3)] h-9 px-4 rounded-xl cursor-pointer"
              >
                <RotateCcw size={13} className={isSpinning ? 'animate-spin' : ''} />
                <span>{drawnQuestion ? 'Zakręć ponownie' : 'Zakręć kołem'}</span>
                <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WheelOfFortune;

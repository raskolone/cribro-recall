import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import {
  Sparkles, RotateCcw, Volume2, CheckCircle2, Clock,
  HelpCircle, ChevronRight, Plus, Shuffle, Copy, Check,
  BookOpen, History, MessageSquare, Award, ArrowRight, Play, Pause,
  Sun, Moon, Pencil, X, Save, Maximize2, Minimize2,
  Link2, ShieldAlert, Mic, Puzzle, Languages, Gem, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { PresentationSlide, LessonRecord } from '../../types';
import { SlideInteraction } from '../admin/presentation/SlideCard';
import TTSButtons from '../flashcards/TTSButtons';
import Button from '../ui/Button';
import {
  WheelQuestionItem,
  ChallengeCategoryId,
  CHALLENGE_CATEGORIES,
  assignChallengeCategory,
  extractQuestionsFromScenario,
  extractQuestionsFromPastLessons,
  generateWheelQuestionsAI
} from '../../services/wheelQuestionService';
import { animateDropletSuccess, animateAccentPulse, animateGlowReveal, prefersReducedMotion, cubicBezierEase } from '../../services/gsapAnimations';
import { useTheme } from '../../context/ThemeContext';
import { WheelItem, RandomWheelPayload } from '../../types/exerciseStudio';

const CHALLENGE_ICONS: Record<ChallengeCategoryId, React.ComponentType<{ size?: number; className?: string }>> = {
  collocation: Link2,
  fix_error: ShieldAlert,
  pitch_60s: Mic,
  fill_gap: Puzzle,
  translation: Languages,
  upgrade_c1: Gem,
};

const WHEEL_SPIN_EASE = cubicBezierEase(0.12, 0.8, 0.2, 1.0);

export interface WheelOfFortuneProps {
  /** Nowa lista segmentów (Exercise Studio / Reusable Wheel) */
  items?: WheelItem[];
  /** Czy segment po wylosowaniu ma znikać / być oznaczany jako zużyty */
  removeOnHit?: boolean;
  /** Tytuł ćwiczenia */
  exerciseTitle?: string;
  /** Tryb wyświetlania */
  mode?: 'standard' | 'focus' | 'presentation';
  onExitPresentation?: () => void;
  onSaveToStudio?: (payload: RandomWheelPayload) => void;

  // Istniejące propsy dla wstecznej kompatybilności z LessonPresentationView i ScratchpadPresentationOverlay
  slide?: PresentationSlide;
  lessonRecords?: LessonRecord[];
  studentName?: string | null;
  isFullscreen?: boolean;
  interaction?: SlideInteraction;
  onInteractionChange?: (next: SlideInteraction) => void;
  onAddToNotes?: (text: string) => void;
  isStudent?: boolean;
}

// Elegancka paleta segmentów koła dla Dark Mode
const SECTOR_PALETTE_DARK = [
  { fill: 'rgba(16, 185, 129, 0.35)', stroke: '#10b981', text: '#6ee7b7', name: 'Emerald' },
  { fill: 'rgba(14, 165, 233, 0.35)', stroke: '#0ea5e9', text: '#7dd3fc', name: 'Sky' },
  { fill: 'rgba(245, 158, 11, 0.35)', stroke: '#f59e0b', text: '#fcd34d', name: 'Amber' },
  { fill: 'rgba(139, 92, 246, 0.35)', stroke: '#8b5cf6', text: '#c4b5fd', name: 'Violet' },
  { fill: 'rgba(236, 72, 153, 0.35)', stroke: '#ec4899', text: '#f472b6', name: 'Rose' },
  { fill: 'rgba(20, 184, 166, 0.35)', stroke: '#14b8a6', text: '#5eead4', name: 'Teal' },
  { fill: 'rgba(99, 102, 241, 0.35)', stroke: '#6366f1', text: '#a5b4fc', name: 'Indigo' },
  { fill: 'rgba(249, 115, 22, 0.35)', stroke: '#f97316', text: '#fdba74', name: 'Orange' },
];

// Wyrazista paleta segmentów koła dla Light Mode (Clean Studio)
const SECTOR_PALETTE_LIGHT = [
  { fill: 'rgba(16, 185, 129, 0.24)', stroke: '#059669', text: '#064e3b', name: 'Emerald' },
  { fill: 'rgba(14, 165, 233, 0.24)', stroke: '#0284c7', text: '#075985', name: 'Sky' },
  { fill: 'rgba(245, 158, 11, 0.24)', stroke: '#d97706', text: '#78350f', name: 'Amber' },
  { fill: 'rgba(139, 92, 246, 0.24)', stroke: '#7c3aed', text: '#4c1d95', name: 'Violet' },
  { fill: 'rgba(236, 72, 153, 0.24)', stroke: '#db2777', text: '#831843', name: 'Rose' },
  { fill: 'rgba(20, 184, 166, 0.24)', stroke: '#0d9488', text: '#134e4a', name: 'Teal' },
  { fill: 'rgba(99, 102, 241, 0.24)', stroke: '#4f46e5', text: '#312e81', name: 'Indigo' },
  { fill: 'rgba(249, 115, 22, 0.24)', stroke: '#ea580c', text: '#7c2d12', name: 'Orange' },
];

/** Oblicza kąt docelowy obrotu koła dla zadanego wycinka (iglica u góry na 270°) */
export function calculateTargetRotation(
  winningIndex: number,
  totalSlices: number,
  currentRotation: number,
  minFullSpins = 5
): number {
  if (totalSlices <= 0) return currentRotation;
  const sliceAngle = 360 / totalSlices;
  const sliceCenterAngle = winningIndex * sliceAngle + sliceAngle / 2;
  const targetAngleAtPointer = (270 - sliceCenterAngle + 360) % 360;

  const currentModulo = ((currentRotation % 360) + 360) % 360;
  const angleDelta = ((targetAngleAtPointer - currentModulo) + 360) % 360;
  const extraSpins = minFullSpins * 360;

  return currentRotation + extraSpins + angleDelta;
}

export const WheelOfFortune: React.FC<WheelOfFortuneProps> = ({
  items: customItems,
  removeOnHit = false,
  exerciseTitle,
  mode = 'standard',
  onExitPresentation,
  onSaveToStudio,
  slide,
  lessonRecords = [],
  studentName,
  isFullscreen = false,
  interaction,
  onInteractionChange,
  onAddToNotes,
  isStudent = false,
}) => {
  // Pobranie motywu lektora/kursanta
  let currentTheme: 'light' | 'dark' = 'dark';
  let toggleTheme = () => {};
  try {
    const themeCtx = useTheme();
    currentTheme = themeCtx.theme;
    toggleTheme = themeCtx.toggleTheme;
  } catch {
    // fallback
  }
  const isDark = currentTheme === 'dark';
  const sectorPalette = isDark ? SECTOR_PALETTE_DARK : SECTOR_PALETTE_LIGHT;

  // Tryb widoku (Standard / Focus / Presentation)
  const [viewMode, setViewMode] = useState<'standard' | 'focus' | 'presentation'>(
    isFullscreen ? 'presentation' : mode
  );

  // Synchronizacja trybu przy zmianie propa
  useEffect(() => {
    if (isFullscreen) setViewMode('presentation');
    else if (mode) setViewMode(mode);
  }, [isFullscreen, mode]);

  // Wybór źródła pytań (jeśli nie przekazano customItems)
  const [questionSource, setQuestionSource] = useState<'custom' | 'scenario' | 'past_lessons'>(() => {
    if (customItems && customItems.length > 0) return 'custom';
    if (slide?.wheelQuestions && slide.wheelQuestions.length > 0) return 'scenario';
    if (lessonRecords && lessonRecords.length > 0) return 'past_lessons';
    return 'scenario';
  });

  const scenarioQuestions = useMemo(() => {
    return extractQuestionsFromScenario(slide, null);
  }, [slide]);

  const pastLessonQuestions = useMemo(() => {
    return extractQuestionsFromPastLessons(lessonRecords, studentName);
  }, [lessonRecords, studentName]);

  // Ujednolicona lista segmentów koła
  const normalizedItems = useMemo<WheelItem[]>(() => {
    if (customItems && customItems.length > 0) {
      return customItems;
    }
    const questions = questionSource === 'past_lessons' ? pastLessonQuestions : scenarioQuestions;
    if (questions.length > 0) {
      return questions.map((q, idx) => ({
        id: q.id || `q-${idx}`,
        label: q.relatedWord || q.challengeCategory ? CHALLENGE_CATEGORIES.find(c => c.id === q.challengeCategory)?.label || `Pytanie ${idx + 1}` : `Pytanie ${idx + 1}`,
        prompt: q.question,
        category: q.challengeCategory || 'Warm-up',
        used: false,
      }));
    }
    // Fallback ze stałych kategorii wyzwań
    return CHALLENGE_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      prompt: cat.label,
      category: cat.label,
      used: false,
    }));
  }, [customItems, questionSource, pastLessonQuestions, scenarioQuestions]);

  // Stan zużytych segmentów (gdy removeOnHit lub ręczne odznaczenie)
  const [usedItemIds, setUsedItemIds] = useState<Set<string>>(new Set());
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningItemId, setWinningItemId] = useState<string | null>(null);
  const [drawnItem, setDrawnItem] = useState<WheelItem | null>(null);
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
  const pulseRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef<number>(0);
  const lastPegIndexRef = useRef<number>(-1);
  const lastTickTimeRef = useRef<number>(0);

  // Synchronizacja zewnętrzna (z LiveSession / SlideInteraction)
  useEffect(() => {
    if (!interaction) return;

    if (interaction.questionSource && (interaction.questionSource === 'scenario' || interaction.questionSource === 'past_lessons')) {
      if (interaction.questionSource !== questionSource && !customItems) {
        setQuestionSource(interaction.questionSource);
      }
    }

    if (
      interaction.wheelRotation != null &&
      Math.abs(interaction.wheelRotation - rotationRef.current) > 1
    ) {
      performWheelSpin(interaction.wheelRotation, interaction.drawnQuestionId, true);
    }
  }, [interaction?.wheelRotation, interaction?.questionSource, interaction?.drawnQuestionId, customItems]);

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

  // Geometria koła
  const itemsCount = Math.max(normalizedItems.length, 1);
  const sliceAngle = 360 / itemsCount;
  const wheelRadius = 175;
  const centerCoord = 200;

  // Główna funkcja wykonująca obrót koła z fizyką GSAP
  const performWheelSpin = useCallback((targetRotation: number, forcedWinnerId?: string | null, isRemote = false) => {
    if (!wheelGroupRef.current) return;

    setIsSpinning(true);
    setIsTimerRunning(false);
    setTimerSeconds(60);
    lastPegIndexRef.current = -1;

    // Obsługa prefers-reduced-motion: natychmiastowe ustawienie pozycji
    if (prefersReducedMotion()) {
      rotationRef.current = targetRotation;
      gsap.set(wheelGroupRef.current, { rotation: targetRotation, svgOrigin: '200 200' });
      setIsSpinning(false);
      finishSpin(targetRotation, forcedWinnerId);
      return;
    }

    gsap.killTweensOf(wheelGroupRef.current);
    if (needleRef.current) gsap.killTweensOf(needleRef.current);

    const spinDuration = isRemote ? 3.8 : 4.5;

    gsap.to(wheelGroupRef.current, {
      rotation: targetRotation,
      svgOrigin: '200 200',
      transformOrigin: '50% 50%',
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
  }, [normalizedItems, sliceAngle, removeOnHit]);

  // Zakończenie losowania — wyznaczenie wylosowanego elementu i animacja wyniku
  const finishSpin = useCallback((finalRotation: number, forcedWinnerId?: string | null) => {
    let winner: WheelItem | null = null;
    if (forcedWinnerId) {
      winner = normalizedItems.find(i => i.id === forcedWinnerId) || null;
    }

    if (!winner) {
      const normalizedRotation = ((finalRotation % 360) + 360) % 360;
      const pointerAngle = (360 - normalizedRotation + 270) % 360;
      const winningIndex = Math.floor(pointerAngle / sliceAngle) % itemsCount;
      winner = normalizedItems[winningIndex] || null;
    }

    if (winner) {
      setWinningItemId(winner.id);
      setDrawnItem(winner);

      if (removeOnHit) {
        setUsedItemIds(prev => new Set(prev).add(winner!.id));
      }
    }

    // Efekt zoom/fade wyniku
    if (resultCardRef.current) {
      animateDropletSuccess(resultCardRef.current);
      const glowColor = isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(5, 150, 105, 0.35)';
      animateGlowReveal(resultCardRef.current, glowColor);
    }

    if (pulseRef.current) {
      animateAccentPulse(pulseRef.current);
    }
  }, [normalizedItems, sliceAngle, itemsCount, removeOnHit, isDark]);

  // Wywołanie zakręcenia przez użytkownika (deterministyczny wybór)
  const handleSpinClick = () => {
    if (isSpinning || normalizedItems.length === 0) return;

    // 1. Logiczny wybór elementu PRZED startem animacji z puli niezużytych
    const available = normalizedItems.filter(item => !item.used && !usedItemIds.has(item.id));
    const pool = available.length > 0 ? available : normalizedItems;

    const chosenItem = pool[Math.floor(Math.random() * pool.length)];
    const chosenIndex = normalizedItems.findIndex(item => item.id === chosenItem.id);

    // 2. Precyzyjne obliczenie kąta zatrzymania dokładnie na wybranym segmencie
    const finalTargetRotation = calculateTargetRotation(
      chosenIndex >= 0 ? chosenIndex : 0,
      itemsCount,
      rotationRef.current,
      5 + Math.floor(Math.random() * 2)
    );

    if (onInteractionChange) {
      onInteractionChange({
        revealedAnswers: interaction?.revealedAnswers || {},
        highlightedItemId: chosenItem.id,
        randomQuestionIndex: chosenIndex,
        wheelRotation: finalTargetRotation,
        isWheelSpinning: true,
        drawnQuestionId: chosenItem.id,
        drawnQuestionText: chosenItem.prompt || chosenItem.label,
        questionSource: questionSource === 'custom' ? undefined : questionSource
      });
    }

    performWheelSpin(finalTargetRotation, chosenItem.id, false);
  };

  // Reset koła do stanu początkowego
  const handleResetWheel = () => {
    if (isSpinning) return;
    if (wheelGroupRef.current) {
      gsap.killTweensOf(wheelGroupRef.current);
      gsap.to(wheelGroupRef.current, {
        rotation: 0,
        duration: 0.6,
        ease: 'power2.out',
        svgOrigin: '200 200'
      });
    }
    rotationRef.current = 0;
    setDrawnItem(null);
    setWinningItemId(null);
    setUsedItemIds(new Set());
    setIsTimerRunning(false);
    setTimerSeconds(60);
  };

  // Oznaczenie segmentu jako omówionego/użytego
  const toggleItemUsed = (id: string) => {
    setUsedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Kopiowanie pytania do schowka
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuestion(true);
      setTimeout(() => setCopiedQuestion(false), 2000);
      if (onAddToNotes) {
        onAddToNotes(text);
      }
    } catch {
      // ignore
    }
  };

  // AI Generator pytań rozgrzewkowych
  const handleGenerateAiQuestions = async () => {
    if (isAiGenerating || isSpinning) return;
    setIsAiGenerating(true);
    try {
      const prompt = `Generate 8 warm-up discussion questions for English lesson${studentName ? ` with student ${studentName}` : ''}`;
      const generated = await generateWheelQuestionsAI(prompt, 'B2', '');
      if (generated && generated.length > 0) {
        setQuestionSource('scenario');
      }
    } catch (err) {
      console.warn('AI question generation failed:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleOpenQuestionEditor = () => {
    const currentList = normalizedItems.map(i => i.prompt || i.label).join('\n');
    setQuestionsDraft(currentList);
    setIsEditingQuestions(true);
  };

  const handleSaveEditedQuestions = () => {
    setIsEditingQuestions(false);
  };

  const isPresentationOrFocus = viewMode === 'presentation' || viewMode === 'focus';

  return (
    <div
      data-testid="wheel-of-fortune-container"
      className={`relative w-full rounded-3xl transition-all duration-300 ${
        isPresentationOrFocus
          ? 'p-4 sm:p-8 bg-ink-2/95 border border-line-strong shadow-2xl'
          : 'p-4 sm:p-6 bg-base-200/90 border border-white/10'
      }`}
      style={{
        backgroundColor: 'var(--exercise-surface, rgba(15, 23, 42, 0.95))',
        color: 'var(--exercise-text, #f8fafc)',
      }}
    >
      {/* ─── GÓRNY PASEK KONTROLNY ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <RotateCcw size={16} className={isSpinning ? 'animate-spin' : ''} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-text-hi flex items-center gap-2">
              {exerciseTitle || (slide?.title ? slide.title : 'Koło Fortuny')}
              {removeOnHit && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Znikające segmenty
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {normalizedItems.length} pozycji • {usedItemIds.size} wylosowanych
            </p>
          </div>
        </div>

        {/* Przyciski trybów i narzędzi */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Przełącznik listy pytań */}
          <button
            type="button"
            onClick={() => setShowQuestionPool(!showQuestionPool)}
            className={`h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <HelpCircle size={13} />
            <span className="hidden sm:inline">{showQuestionPool ? 'Ukryj pozycje' : 'Pokaż pozycje'}</span>
          </button>

          {/* Reset koła */}
          <button
            type="button"
            onClick={handleResetWheel}
            disabled={isSpinning}
            title="Zresetuj koło i wylosowane pozycje"
            className={`h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Przełącznik Focus / Presentation Mode */}
          {viewMode === 'standard' ? (
            <button
              type="button"
              onClick={() => setViewMode('focus')}
              title="Tryb skupienia (Focus Mode)"
              className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline">Focus</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onExitPresentation) onExitPresentation();
                setViewMode('standard');
              }}
              title="Wyjdź z trybu prezentacji"
              className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-white/20 bg-white/10 text-text-hi hover:bg-white/20 cursor-pointer"
            >
              <Minimize2 size={13} />
              <span>Wyjdź</span>
            </button>
          )}

          {/* Przełącznik motywu */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
            className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-amber-400 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer shadow-sm"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* ─── ROZWIJANA LISTA ELEMENTÓW ─── */}
      {showQuestionPool && (
        <div
          className="p-4 mb-4 rounded-2xl border space-y-2.5 animate-fadeIn"
          style={{
            backgroundColor: 'var(--exercise-surface-elevated, #1e293b)',
            borderColor: 'var(--exercise-border, rgba(255,255,255,0.12))',
          }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              🎯 Pozycje na kole ({normalizedItems.length}):
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              Wylosowane: {usedItemIds.size} / {normalizedItems.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {normalizedItems.map((item, idx) => {
              const isUsed = usedItemIds.has(item.id);
              const isCurrent = drawnItem?.id === item.id;
              return (
                <div
                  key={item.id || `pool-${idx}`}
                  onClick={() => toggleItemUsed(item.id)}
                  className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400/40'
                      : isUsed
                      ? 'opacity-45 line-through bg-black/20 border-white/5 text-slate-500'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold truncate">{item.label}</div>
                    {item.prompt && <p className="text-[11px] text-slate-400 line-clamp-1">{item.prompt}</p>}
                  </div>
                  <span className="text-[10px] font-mono shrink-0">
                    {isCurrent ? '🎯' : isUsed ? '✓' : `#${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── GŁÓWNY OBSZAR: KOŁO + PANEL WYNIKU ─── */}
      <div className={`grid grid-cols-1 gap-8 items-center ${
        isPresentationOrFocus
          ? 'lg:grid-cols-12 min-h-[480px]'
          : 'lg:grid-cols-12 min-h-[380px]'
      }`}>
        {/* LEWA STRONA: KOŁO FORTUNY (55-65% szerokości w trybie focus/desktop) */}
        <div className={`${
          isPresentationOrFocus ? 'lg:col-span-7' : 'lg:col-span-6'
        } flex flex-col items-center justify-center relative py-4`}>
          {/* Kontener koła */}
          <div className={`relative flex items-center justify-center ${
            isPresentationOrFocus
              ? 'w-[340px] h-[340px] sm:w-[420px] sm:h-[420px]'
              : 'w-[320px] h-[320px] sm:w-[380px] sm:h-[380px]'
          }`}>
            {/* Optyczna poświata */}
            <div className="absolute inset-0 rounded-full blur-2xl pointer-events-none bg-gradient-to-tr from-emerald-500/20 via-sky-500/15 to-amber-500/10" />

            {/* Iglica wskazująca na godzinie 12:00 (270°) */}
            <div className="absolute -top-3.5 z-30 flex flex-col items-center pointer-events-none">
              <svg
                ref={needleRef}
                width="36"
                height="46"
                viewBox="0 0 34 44"
                fill="none"
                className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] origin-top"
              >
                <path
                  d="M17 44L4 12C2.5 8 5.5 2 10 2H24C28.5 2 31.5 8 30 12L17 44Z"
                  fill="url(#needle-gradient-v2)"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle cx="17" cy="10" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
                <defs>
                  <linearGradient id="needle-gradient-v2" x1="17" y1="2" x2="17" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f59e0b" />
                    <stop offset="0.6" stopColor="#d97706" />
                    <stop offset="1" stopColor="#b45309" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* SVG Koła */}
            <svg
              ref={wheelSvgRef}
              width="400"
              height="400"
              viewBox="0 0 400 400"
              className="w-full h-full select-none drop-shadow-[0_12px_35px_rgba(0,0,0,0.4)]"
            >
              <defs>
                <radialGradient id="rim-gradient-modern" cx="50%" cy="50%" r="50%">
                  <stop offset="85%" stopColor={isDark ? '#1e293b' : '#f1f5f9'} />
                  <stop offset="95%" stopColor={isDark ? '#0f172a' : '#cbd5e1'} />
                  <stop offset="100%" stopColor={isDark ? '#020617' : '#94a3b8'} />
                </radialGradient>
              </defs>

              {/* Zewnętrzna obwódka */}
              <circle
                cx={centerCoord}
                cy={centerCoord}
                r={wheelRadius + 14}
                fill="url(#rim-gradient-modern)"
                stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)'}
                strokeWidth="2.5"
              />

              {/* Obracająca się grupa segmentów */}
              <g ref={wheelGroupRef} className="origin-[200px_200px]">
                {normalizedItems.map((item, idx) => {
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
                  const isWinner = !isSpinning && winningItemId === item.id;
                  const isUsed = usedItemIds.has(item.id);

                  const labelRadius = wheelRadius * 0.72;
                  const lx = centerCoord + labelRadius * Math.cos((midAngle * Math.PI) / 180);
                  const ly = centerCoord + labelRadius * Math.sin((midAngle * Math.PI) / 180);

                  const isBottomHalf = midAngle > 90 && midAngle < 270;
                  const contentRotation = isBottomHalf ? midAngle - 90 : midAngle + 90;

                  return (
                    <g key={item.id || `slice-${idx}`}>
                      <path
                        d={pathData}
                        fill={
                          isWinner
                            ? isDark ? 'rgba(16, 185, 129, 0.55)' : 'rgba(16, 185, 129, 0.45)'
                            : isUsed
                            ? isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.5)'
                            : colorInfo.fill
                        }
                        stroke={isWinner ? '#10b981' : colorInfo.stroke}
                        strokeWidth={isWinner ? '3' : '1.2'}
                        className="transition-colors duration-200"
                      />

                      {/* Etykieta segmentu — wysoki kontrast i automatyczna czytelność */}
                      <text
                        x={lx}
                        y={ly}
                        fill={
                          isWinner
                            ? '#ffffff'
                            : isUsed
                            ? isDark ? '#64748b' : '#94a3b8'
                            : isDark ? colorInfo.text : colorInfo.text
                        }
                        fontSize={itemsCount > 10 ? '9' : itemsCount > 6 ? '11' : '12'}
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${contentRotation}, ${lx}, ${ly})`}
                        style={{
                          textShadow: isDark ? '0 1px 3px rgba(0,0,0,0.9)' : '0 1px 2px rgba(255,255,255,0.8)',
                          letterSpacing: '0.02em',
                        }}
                        className="pointer-events-none select-none"
                      >
                        {item.label.length > 18 ? `${item.label.slice(0, 16)}…` : item.label}
                      </text>
                    </g>
                  );
                })}

                {/* Kołki (pegs) na obrzeżu */}
                {Array.from({ length: itemsCount }).map((_, idx) => {
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
                      strokeWidth="1.2"
                      className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                    />
                  );
                })}
              </g>
            </svg>

            {/* Accent Pulse przy zatrzymaniu */}
            <div
              ref={pulseRef}
              className="absolute z-10 w-32 h-32 rounded-full pointer-events-none opacity-0 bg-emerald-500/40"
              style={{ boxShadow: '0 0 50px 15px rgba(16,185,129,0.4)' }}
            />

            {/* Środkowy przycisk SPIN / ZAKRĘĆ */}
            <div className="absolute z-20 flex items-center justify-center">
              <button
                type="button"
                data-testid="wheel-spin-button"
                onClick={handleSpinClick}
                disabled={isSpinning || normalizedItems.length === 0}
                title="Kliknij, aby zakręcić kołem"
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none ${
                  isSpinning
                    ? 'scale-95 bg-emerald-500/20 border-emerald-500 text-emerald-400 animate-pulse'
                    : isDark
                    ? 'bg-gradient-to-b from-slate-800 via-slate-900 to-black border-emerald-500/40 text-white shadow-[0_8px_30px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.2)] hover:border-emerald-400 hover:text-emerald-300 hover:scale-105 active:scale-95'
                    : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-emerald-500/50 text-slate-900 shadow-[0_8px_25px_rgba(15,23,42,0.15),inset_0_2px_4px_#ffffff] hover:border-emerald-600 hover:text-emerald-700 hover:scale-105 active:scale-95'
                }`}
              >
                <div className="p-1 rounded-full mb-0.5 bg-emerald-500/20 text-emerald-400">
                  <RotateCcw size={16} className={isSpinning ? 'animate-spin' : ''} />
                </div>
                <span className="font-extrabold text-[12px] sm:text-[13px] tracking-wider uppercase">
                  {isSpinning ? 'LOSUJĘ…' : 'ZAKRĘĆ'}
                </span>
                <span className="text-[8px] font-mono opacity-80 uppercase tracking-widest text-slate-400">
                  SPIN
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* PRAWA STRONA: PANEL WYNIKU (35-45% szerokości) */}
        <div className={`${
          isPresentationOrFocus ? 'lg:col-span-5' : 'lg:col-span-6'
        } flex flex-col gap-4`}>
          <div
            ref={resultCardRef}
            data-testid="wheel-result-card"
            className="p-6 sm:p-7 rounded-3xl border relative overflow-hidden flex flex-col justify-between min-h-[360px] transition-all duration-300 shadow-xl backdrop-blur-xl"
            style={{
              backgroundColor: 'var(--exercise-surface-elevated, #1e293b)',
              borderColor: 'var(--exercise-border, rgba(255, 255, 255, 0.12))',
              color: 'var(--exercise-text, #f8fafc)',
            }}
          >
            {/* Tło akcentowe */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none bg-emerald-500/10" />

            <div className="relative z-10 space-y-4">
              {/* Status wylosowanego elementu */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <Award size={13} />
                    {drawnItem ? 'Wylosowany segment' : 'Gotowy do losowania'}
                  </span>
                  {drawnItem?.category && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                      {drawnItem.category}
                    </span>
                  )}
                </div>

                {drawnItem && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleItemUsed(drawnItem.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                        usedItemIds.has(drawnItem.id)
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                      }`}
                      title="Oznacz jako zużyty"
                    >
                      <CheckCircle2 size={13} />
                      <span>{usedItemIds.has(drawnItem.id) ? 'Użyty ✓' : 'Zakończ'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(drawnItem.prompt || drawnItem.label)}
                      className="p-1.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      title="Kopiuj do schowka"
                    >
                      {copiedQuestion ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Treść wylosowanego segmentu */}
              {drawnItem ? (
                <div className="space-y-4 pt-1 animate-fadeIn">
                  <div className="space-y-2">
                    <span className="text-xs uppercase font-mono font-bold tracking-wider text-emerald-400">
                      {drawnItem.label}
                    </span>
                    <h3
                      className="text-lg sm:text-2xl font-bold leading-snug tracking-tight"
                      style={{
                        color: 'var(--exercise-text, #f8fafc)',
                      }}
                    >
                      {drawnItem.prompt ? `"${drawnItem.prompt}"` : drawnItem.label}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <TTSButtons text={drawnItem.prompt || drawnItem.label} />
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
                    🎯
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-extrabold text-text-hi">
                      Zakręć kołem fortuny!
                    </h4>
                    <p className="text-xs max-w-sm mx-auto mt-1 leading-relaxed text-slate-400">
                      Wybierz losowy element do dyskusji, powtórki lub aktywnego ćwiczenia podczas lekcji.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Dolny pasek: Stoper i przycisk Ponownego Losowania */}
            <div className="relative z-10 pt-4 border-t border-white/10 mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Mini-stoper */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-black/20 text-xs font-mono font-bold text-text-hi">
                  <Clock size={13} className={isTimerRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
                  <span>{timerSeconds}s</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isTimerRunning) {
                      setIsTimerRunning(false);
                    } else {
                      if (timerSeconds === 0) setTimerSeconds(60);
                      setIsTimerRunning(true);
                    }
                  }}
                  className="h-8 px-2.5 rounded-full text-xs font-bold flex items-center border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
                  <span className="ml-1">{isTimerRunning ? 'Pauza' : 'Start'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(60);
                  }}
                  title="Resetuj stoper"
                  className="h-8 px-2 rounded-full flex items-center border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              {/* Przycisk akcji zakręcenia */}
              <Button
                size="sm"
                variant="primary"
                disabled={isSpinning || normalizedItems.length === 0}
                onClick={handleSpinClick}
                className="w-full sm:w-auto text-xs font-extrabold flex items-center justify-center gap-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] h-9 px-4 rounded-xl cursor-pointer"
              >
                <RotateCcw size={13} className={isSpinning ? 'animate-spin' : ''} />
                <span>{drawnItem ? 'Zakręć ponownie' : 'Zakręć kołem'}</span>
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

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, GraduationCap, Lightbulb, X } from 'lucide-react';

export type CoachPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface CoachStep {
  /** Wartość atrybutu `data-coach` na opisywanym elemencie. */
  coachId: string;
  /** Nazwa grupy pokazywana w nagłówku dymka, np. „Narzędzia na żywo”. */
  group: string;
  title: string;
  /** Co ta funkcja robi — pełnym zdaniem, językiem lektora, nie interfejsu. */
  description: string;
  /** Jedna praktyczna wskazówka użycia na lekcji. */
  tip?: string;
  shortcut?: string;
  preferredPlacement?: CoachPlacement;
  /**
   * Uruchamiane przed pokazaniem kroku — służy do rozwinięcia menu, w którym
   * schowana jest opisywana pozycja. Bez tego samouczek celowałby w element,
   * którego nie ma jeszcze w DOM.
   */
  onBeforeShow?: () => void;
  /** Sprzątanie po kroku, np. zamknięcie rozwiniętego menu. */
  onAfterShow?: () => void;
}

interface CoachMarksProps {
  steps: CoachStep[];
  isOpen: boolean;
  onClose: () => void;
  /** Nazwa samouczka w stopce dymka. */
  title?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const BUBBLE_WIDTH = 360;
const SPOTLIGHT_PADDING = 7;
const TAIL = 9;
const MARGIN = 14;
const MOBILE_BREAKPOINT = 860;

const findTarget = (coachId: string): HTMLElement | null =>
  (document.querySelector(`[data-coach="${coachId}"]`) as HTMLElement | null) ?? null;

const readRect = (element: HTMLElement): Rect => {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
};

/**
 * Samouczek z dymkami przypiętymi do konkretnych przycisków.
 *
 * Różni się od przewodnika powitalnego tym, że opisuje pojedyncze narzędzia
 * w miejscu, w którym leżą — łącznie z tymi schowanymi w menu, które krok
 * potrafi sam rozwinąć przez `onBeforeShow`.
 */
export const CoachMarks: React.FC<CoachMarksProps> = ({
  steps,
  isOpen,
  onClose,
  title = 'Samouczek',
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(260);
  const [isCompact, setIsCompact] = useState(false);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<CoachStep | null>(null);

  const step: CoachStep | undefined = steps[stepIndex];

  useEffect(() => {
    const syncViewport = () => setIsCompact(window.innerWidth < MOBILE_BREAKPOINT);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  const measure = useCallback(() => {
    if (!step) return;
    const element = findTarget(step.coachId);
    setTargetRect(element ? readRect(element) : null);
  }, [step]);

  // Krok najpierw przygotowuje scenę (rozwija menu), a dopiero potem mierzymy —
  // stąd dwie klatki zwłoki: pierwsza na commit Reacta, druga na layout.
  useEffect(() => {
    if (!isOpen || !step) return;

    const previous = previousStepRef.current;
    if (previous && previous.coachId !== step.coachId) previous.onAfterShow?.();
    previousStepRef.current = step;

    step.onBeforeShow?.();

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const element = findTarget(step.coachId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          setTargetRect(readRect(element));
          // Po płynnym przewinięciu prostokąt się przesuwa — domierzamy po animacji.
          setTimeout(() => setTargetRect(readRect(element)), 320);
        } else {
          setTargetRect(null);
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) {
      previousStepRef.current?.onAfterShow?.();
      previousStepRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, measure]);

  useLayoutEffect(() => {
    if (!bubbleRef.current) return;
    setBubbleHeight(bubbleRef.current.offsetHeight);
  }, [stepIndex, isOpen, isCompact]);

  const goNext = useCallback(() => {
    setStepIndex(current => (current < steps.length - 1 ? current + 1 : current));
    if (stepIndex >= steps.length - 1) onClose();
  }, [stepIndex, steps.length, onClose]);

  const goPrevious = useCallback(() => {
    setStepIndex(current => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      }
    };
    // Faza przechwytywania: prezentacja słucha strzałek globalnie i bez tego
    // przewijałaby slajdy pod spodem razem z krokami samouczka.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, goNext, goPrevious, onClose]);

  if (!isOpen || !step) return null;

  const placement: CoachPlacement | 'center' = (() => {
    if (!targetRect || isCompact) return 'center';

    const preferred = step.preferredPlacement ?? 'bottom';
    const fits = {
      bottom: targetRect.top + targetRect.height + TAIL + bubbleHeight + MARGIN < window.innerHeight,
      top: targetRect.top - TAIL - bubbleHeight - MARGIN > 0,
      right: targetRect.left + targetRect.width + TAIL + BUBBLE_WIDTH + MARGIN < window.innerWidth,
      left: targetRect.left - TAIL - BUBBLE_WIDTH - MARGIN > 0,
    };

    if (fits[preferred]) return preferred;
    return (['bottom', 'top', 'right', 'left'] as const).find(option => fits[option]) ?? 'center';
  })();

  const bubblePosition = (() => {
    if (placement === 'center' || !targetRect) return null;

    let top = 0;
    let left = 0;

    if (placement === 'bottom' || placement === 'top') {
      left = targetRect.left + targetRect.width / 2 - BUBBLE_WIDTH / 2;
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - BUBBLE_WIDTH - MARGIN));
      top =
        placement === 'bottom'
          ? targetRect.top + targetRect.height + TAIL + SPOTLIGHT_PADDING
          : targetRect.top - TAIL - SPOTLIGHT_PADDING - bubbleHeight;
    } else {
      top = targetRect.top + targetRect.height / 2 - bubbleHeight / 2;
      top = Math.max(MARGIN, Math.min(top, window.innerHeight - bubbleHeight - MARGIN));
      left =
        placement === 'right'
          ? targetRect.left + targetRect.width + TAIL + SPOTLIGHT_PADDING
          : targetRect.left - TAIL - SPOTLIGHT_PADDING - BUBBLE_WIDTH;
    }

    return { top, left };
  })();

  /** Ogonek dymka celuje w środek opisywanego elementu, ale nie wychodzi poza róg. */
  const tailStyle = (() => {
    if (!bubblePosition || !targetRect || placement === 'center') return null;

    const base: React.CSSProperties = {
      position: 'absolute',
      width: TAIL * 2,
      height: TAIL * 2,
      background: 'var(--color-ink-2)',
      transform: 'rotate(45deg)',
    };

    if (placement === 'bottom' || placement === 'top') {
      const center = targetRect.left + targetRect.width / 2 - bubblePosition.left - TAIL;
      const offset = Math.max(18, Math.min(center, BUBBLE_WIDTH - 18 - TAIL * 2));
      return {
        ...base,
        left: offset,
        ...(placement === 'bottom'
          ? {
              top: -TAIL,
              borderLeft: '1px solid var(--color-line-strong)',
              borderTop: '1px solid var(--color-line-strong)',
            }
          : {
              bottom: -TAIL,
              borderRight: '1px solid var(--color-line-strong)',
              borderBottom: '1px solid var(--color-line-strong)',
            }),
      };
    }

    const center = targetRect.top + targetRect.height / 2 - bubblePosition.top - TAIL;
    const offset = Math.max(18, Math.min(center, bubbleHeight - 18 - TAIL * 2));
    return {
      ...base,
      top: offset,
      ...(placement === 'right'
        ? {
            left: -TAIL,
            borderLeft: '1px solid var(--color-line-strong)',
            borderBottom: '1px solid var(--color-line-strong)',
          }
        : {
            right: -TAIL,
            borderTop: '1px solid var(--color-line-strong)',
            borderRight: '1px solid var(--color-line-strong)',
          }),
    };
  })();

  const isLastStep = stepIndex === steps.length - 1;

  const spotlightGeometry = targetRect
    ? {
        top: targetRect.top - SPOTLIGHT_PADDING,
        left: targetRect.left - SPOTLIGHT_PADDING,
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  return createPortal(
    <>
      {/* WARSTWA PRZYCIEMNIENIA — pod rozwiniętym menu (z-500).
          Krok potrafi otworzyć menu, żeby opisać schowaną w nim pozycję; gdyby
          ciemność leżała nad menu, samouczek wskazywałby przyciemniony element. */}
      <div className="fixed inset-0 z-[400]">
        <div
          className={`absolute inset-0 ${spotlightGeometry && !isCompact ? '' : 'bg-black/75 backdrop-blur-[2px]'}`}
          onClick={onClose}
        />
        {spotlightGeometry && !isCompact && (
          <motion.div
            initial={false}
            animate={spotlightGeometry}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="absolute rounded-xl pointer-events-none"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)' }}
          />
        )}
      </div>

      {/* WARSTWA WSKAZAŃ — nad menu, żeby obwódka i dymek były widoczne także
          wtedy, gdy opisywana pozycja leży w rozwiniętym menu. */}
      <div
        className="fixed inset-0 z-[600] pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {spotlightGeometry && !isCompact && (
          <motion.div
            initial={false}
            animate={spotlightGeometry}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="absolute rounded-xl border border-accent"
            style={{ boxShadow: '0 0 22px rgba(114,240,180,0.45)' }}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step.coachId}
            ref={bubbleRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={
              bubblePosition
                ? { top: bubblePosition.top, left: bubblePosition.left, width: BUBBLE_WIDTH }
                : undefined
            }
            // Menu zamyka się przy kliknięciu poza sobą — bez zatrzymania zdarzenia
            // klik w „Dalej" zwijałby menu, które następny krok zaraz otwiera z powrotem.
            onMouseDown={event => event.stopPropagation()}
            className={
              bubblePosition
                ? 'fixed rounded-2xl bg-ink-2 border border-line-strong shadow-ambient-lg p-4 pointer-events-auto'
                : 'fixed left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6 w-[calc(100vw-24px)] max-w-[420px] rounded-2xl bg-ink-2 border border-line-strong shadow-ambient-lg p-4 pointer-events-auto'
            }
          >
            {tailStyle && <span style={tailStyle} aria-hidden />}

            <div className="relative">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/12 border border-accent/30 text-accent text-[10px] font-mono uppercase tracking-[0.1em]">
                  <GraduationCap size={11} />
                  {step.group}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Zamknij samouczek"
                  className="shrink-0 w-6 h-6 rounded-full bg-white/[0.05] border border-line flex items-center justify-center text-text-2 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              <h4 className="text-sm font-bold text-text-hi leading-snug flex items-center gap-2 flex-wrap">
                {step.title}
                {step.shortcut && (
                  <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-line text-[10px] font-mono text-text-2">
                    {step.shortcut}
                  </kbd>
                )}
              </h4>

              <p className="mt-1.5 text-xs leading-relaxed text-text-3">{step.description}</p>

              {step.tip && (
                <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-white/[0.04] border border-line px-2.5 py-2 text-[11px] leading-relaxed text-text-2">
                  <Lightbulb size={13} className="shrink-0 mt-px text-warn" />
                  <span>{step.tip}</span>
                </p>
              )}

              <div className="mt-3.5 pt-3 border-t border-line-soft flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono text-text-faint tabular-nums">
                  {stepIndex + 1} / {steps.length}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={goPrevious}
                    disabled={stepIndex === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-line text-text-2 text-[11px] font-semibold flex items-center gap-1 transition-colors hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    Wstecz
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-3 py-1.5 rounded-lg bg-accent text-accent-ink text-[11px] font-bold flex items-center gap-1 shadow-btn transition-all hover:brightness-110 active:brightness-95 cursor-pointer"
                  >
                    {isLastStep ? 'Zakończ' : 'Dalej'}
                    {!isLastStep && <ChevronRight size={13} />}
                  </button>
                </div>
                </div>
              </div>
            </motion.div>
        </AnimatePresence>
      </div>
    </>,
    document.body
  );
};

export default CoachMarks;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  BookOpen, 
  ShoppingBag, 
  LayoutGrid, 
  Keyboard, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  X, 
  HelpCircle, 
  Lightbulb, 
  Check
} from 'lucide-react';

interface OnboardingOverlayProps {
  onComplete: () => void;
  language?: 'pl' | 'en';
}

interface StepData {
  targetId: string;
  placement: 'top' | 'bottom' | 'center';
  badge: { pl: string; en: string };
  title: { pl: string; en: string };
  desc: { pl: string; en: string };
  renderMockup: (lang: 'pl' | 'en') => React.ReactNode;
}

const steps: StepData[] = [
  // Krok 1: Wprowadzenie
  {
    targetId: 'tour-generator-header',
    placement: 'bottom',
    badge: { pl: 'KROK 1 Z 6 • WPROWADZENIE', en: 'STEP 1 OF 6 • WELCOME' },
    title: { 
      pl: 'Inteligentny trening językowy Cribro', 
      en: 'Cribro Smart AI Training' 
    },
    desc: {
      pl: 'Witaj w swoim centrum codziennego treningu! Zamiast biernego wypełniania testów, tutaj uczysz się aktywnego budowania zdań i formułowania myśli po angielsku. Sztuczna inteligencja na bieżąco analizuje Twoje odpowiedzi i pomaga przełamać barierę językową.',
      en: 'Welcome to your daily training center! Instead of passive multiple choice tests, you practice active sentence formation. AI analyzes your responses instantly to build true fluency.'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-base-300/80 rounded-2xl border border-emerald-500/25 space-y-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>{lang === 'pl' ? 'Praktyczne Formaty Ćwiczeń z AI' : 'AI-Powered Practice Formats'}</span>
        </div>
        <div className="text-white font-bold text-sm">
          {lang === 'pl' ? '🎯 Cel: Swobodne budowanie zdań i mówienie' : '🎯 Goal: Fluent speaking and writing in English'}
        </div>
      </div>
    )
  },

  // Krok 2: Wybór Źródła Słownictwa
  {
    targetId: 'tour-vocab-source',
    placement: 'top',
    badge: { pl: 'KROK 2 Z 6 • ŹRÓDŁO SŁOWNICTWA', en: 'STEP 2 OF 6 • VOCABULARY SOURCE' },
    title: { 
      pl: 'Moje lekcje lub Słownictwo Ogólne (A1-C2)', 
      en: 'My Lessons or General Vocabulary (A1-C2)' 
    },
    desc: {
      pl: 'Wybieraj materiał z własnych lekcji z lektorem ALBO korzystaj z bogatej bazy Słownictwa Ogólnego podzielonego na 6 poziomów (A1, A2, B1, B2, C1, C2) oraz kategorie tematyczne (np. Biznes, Podróże, Praca, Codzienność, IT).',
      en: 'Select words from your tutor lessons OR explore General Vocabulary organized by 6 levels (A1 to C2) and categories (Business, Travel, Work, Daily Life, IT).'
    },
    renderMockup: (lang) => (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-white">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <div>
              <span className="font-bold">{lang === 'pl' ? 'Moje Lekcje' : 'My Lessons'}</span>
              <span className="text-blue-300/80 text-[10px] ml-2 font-mono">
                {lang === 'pl' ? '(Materiały z zajęć)' : '(From your tutor)'}
              </span>
            </div>
          </div>
          <span className="bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
            {lang === 'pl' ? 'Własne' : 'Custom'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
          <div className="flex items-center justify-between text-white font-bold">
            <span className="text-emerald-300">{lang === 'pl' ? 'Baza Słownictwa Ogólnego' : 'General Vocabulary Database'}</span>
            <span className="text-emerald-400 font-mono text-[10px] font-bold">A1 • A2 • B1 • B2 • C1 • C2</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {['Biznes', 'Podróże', 'Praca', 'Życie codzienne', 'Technologia'].map((cat, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-white/10 text-gray-200 text-[10px] font-medium">{cat}</span>
            ))}
          </div>
        </div>
      </div>
    )
  },

  // Krok 3: Działanie "Mój Koszyk"
  {
    targetId: 'tour-vocab-source',
    placement: 'top',
    badge: { pl: 'KROK 3 Z 6 • PERSONALIZACJA', en: 'STEP 3 OF 6 • WORD BASKET' },
    title: { 
      pl: 'Jak działa „Mój Koszyk” (+)?', 
      en: 'How the "Word Basket" (+) Works' 
    },
    desc: {
      pl: 'Podczas przeglądania dowolnej listy słów kliknij ikonę plusa (+) obok trudnego słowa, aby dorzucić je do koszyka. Gdy jako źródło treningu wybierzesz „Koszyk słówek”, wygenerujesz ćwiczenia wyłącznie z tych wyselekcjonowanych przez siebie haseł!',
      en: 'While browsing any word set, click the plus icon (+) next to any difficult word to add it to your basket. Selecting "Word Basket" creates exercises focused solely on these handpicked words!'
    },
    renderMockup: (lang) => (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-purple-500/30 text-purple-300 flex items-center justify-center font-bold">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-white">sustainable</span>
              <span className="text-gray-300 text-[10px] ml-2">zrównoważony</span>
            </div>
          </div>
          <span className="text-[10px] text-purple-200 bg-purple-500/30 px-2 py-0.5 rounded-full font-bold">
            {lang === 'pl' ? 'W koszyku ✓' : 'In Basket ✓'}
          </span>
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-white">negotiate</span>
              <span className="text-gray-400 text-[10px] ml-2">negocjować</span>
            </div>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            {lang === 'pl' ? 'Kliknij + aby dodać' : 'Click + to add'}
          </span>
        </div>
      </div>
    )
  },

  // Krok 4: Zalecany Krok 1: Układanka
  {
    targetId: 'tour-mode-puzzle',
    placement: 'top',
    badge: { pl: 'KROK 4 Z 6 • KROK 1 TRENINGU', en: 'STEP 4 OF 6 • STEP 1: PUZZLE' },
    title: { 
      pl: 'Zacznij od Układanki (Puzzle)', 
      en: 'Start with the Puzzle Mode' 
    },
    desc: {
      pl: 'Zalecamy, aby najpierw wykonać zadanie „Układanka”. Składanie zdań z interaktywnych klocków pozwala bezstresowo poznać słownictwo w naturalnym kontekście i opanować prawidłowy szyk angielskich zdań.',
      en: 'We recommend starting with the "Puzzle" mode. Assembling sentences from interactive blocks helps you internalize new vocabulary and master English word order without stress.'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-emerald-950/60 rounded-2xl border-2 border-emerald-500/40 space-y-2.5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
        <div className="text-[11px] text-emerald-200 font-semibold text-center">
          {lang === 'pl' ? '🇵🇱 Lubię czytać książki po pracy.' : '🇵🇱 Lubię czytać książki po pracy.'}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {['I', 'enjoy', 'reading', 'books', 'after work'].map((tile, i) => (
            <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400 text-emerald-300 text-xs font-mono font-bold shadow-md">
              {tile}
            </span>
          ))}
        </div>
      </div>
    )
  },

  // Krok 5: Zalecany Krok 2: Prawdziwe Wyzwanie (Wpisywanie)
  {
    targetId: 'tour-mode-typing',
    placement: 'top',
    badge: { pl: 'KROK 5 Z 6 • KROK 2 TRENINGU', en: 'STEP 5 OF 6 • STEP 2: TYPING' },
    title: { 
      pl: 'Krok 2: Prawdziwe Wyzwanie (Pisanie)', 
      en: 'Step 2: Real Challenge (Typing)' 
    },
    desc: {
      pl: 'Po ukończeniu układanki z konkretnych słów, przejdź do „Prawdziwego Wyzwania”. Na bazie opanowanego materiału system wygeneruje dla Ciebie zdania, które tłumaczysz i wpisujesz w całości z pamięci.',
      en: 'After completing the puzzle, switch to the "Real Challenge". The AI generates full sentences for you to translate and type directly from memory.'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-cyan-950/60 rounded-2xl border-2 border-cyan-500/40 space-y-2 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
        <div className="text-[11px] text-cyan-200 font-semibold">
          {lang === 'pl' ? 'Tłumacz z pamięci: Zwykle chodzę na siłownię wieczorem.' : 'Translate: Zwykle chodzę na siłownię wieczorem.'}
        </div>
        <div className="p-2.5 rounded-xl bg-black/60 border border-cyan-400/50 text-cyan-300 font-mono text-xs flex items-center justify-between">
          <span>I usually go to the gym in the evening...</span>
          <span className="w-2 h-3.5 bg-cyan-400 animate-pulse"></span>
        </div>
      </div>
    )
  },

  // Krok 6: Ocena i Feedback AI
  {
    targetId: 'tour-generator-header',
    placement: 'bottom',
    badge: { pl: 'KROK 6 Z 6 • OCENA I FEEDBACK', en: 'STEP 6 OF 6 • AI SCORING' },
    title: { 
      pl: 'Precyzyjna ocena AI i native audio', 
      en: 'Deep AI Scoring & Native Audio' 
    },
    desc: {
      pl: 'Każde Twoje zdanie otrzymuje szczegółową ocenę: Znaczenie (40 pkt), Gramatyka (40 pkt) oraz Słownictwo (20 pkt). AI wskazuje ewentualne literówki, sugeruje naturalniejsze zwroty i pozwala odsłuchać poprawną wymowę!',
      en: 'Every sentence is scored across Meaning (40 pts), Grammar (40 pts), and Vocabulary (20 pts). AI highlights mistakes, suggests natural phrases, and plays audio.'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-[#0a111e] rounded-2xl border border-emerald-500/30 space-y-2 text-xs">
        <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
          <span className="font-bold text-emerald-400 text-sm">{lang === 'pl' ? 'Wynik: 100% (Świetnie!)' : 'Score: 100% (Great!)'}</span>
          <div className="flex gap-2 text-[10px] font-mono text-gray-300">
            <span className="text-emerald-400">Zn: 40/40</span>
            <span className="text-emerald-400">Gr: 40/40</span>
            <span className="text-emerald-400">Sł: 20/20</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-300 text-[11px] pt-1">
          <Lightbulb className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{lang === 'pl' ? 'Zdanie w 100% poprawne gramatycznie i naturalne.' : 'Sentence is grammatically correct and natural.'}</span>
        </div>
      </div>
    )
  }
];

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete, language = 'pl' }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check screen width
  useEffect(() => {
    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Update target rect on step change or resize
  useEffect(() => {
    const updateTargetPosition = () => {
      if (!isDesktop) {
        setTargetRect(null);
        return;
      }
      const targetId = steps[currentStep].targetId;
      const el = document.getElementById(targetId);
      if (el) {
        // Scroll element smoothly into center view so it's fully visible
        const rect = el.getBoundingClientRect();
        const inView = rect.top >= 40 && rect.bottom <= window.innerHeight - 40;
        if (!inView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
          if (el) {
            setTargetRect(el.getBoundingClientRect());
          }
        }, 120);
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    updateTargetPosition();
    const t1 = setTimeout(updateTargetPosition, 100);
    const t2 = setTimeout(updateTargetPosition, 300);
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
    };
  }, [currentStep, isDesktop]);

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  // Determine popover positioning for Desktop
  const getPopoverPosition = () => {
    if (!targetRect || !isDesktop) return { style: {}, actualPlacement: 'center' as const };

    const popoverWidth = Math.min(480, window.innerWidth - 32);
    const popoverHeight = 440;
    const gap = 16;
    let top = 0;
    let left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
    let actualPlacement = step.placement;

    // Keep within horizontal boundaries
    const maxLeft = window.innerWidth - popoverWidth - 20;
    left = Math.max(20, Math.min(left, maxLeft));

    // Check if space exists above or below
    if (step.placement === 'top') {
      top = targetRect.top - popoverHeight - gap;
      if (top < 20) {
        // If not enough room at top, flip to bottom
        top = targetRect.bottom + gap;
        actualPlacement = 'bottom';
      }
    } else if (step.placement === 'bottom') {
      top = targetRect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - 20) {
        // If not enough room at bottom, flip to top
        top = targetRect.top - popoverHeight - gap;
        actualPlacement = 'top';
      }
    } else {
      top = targetRect.bottom + gap;
    }

    // Keep within vertical boundaries
    top = Math.max(20, Math.min(top, window.innerHeight - popoverHeight - 20));

    return {
      style: {
        position: 'fixed' as const,
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: 260
      },
      actualPlacement
    };
  };

  const { style: popoverStyle } = getPopoverPosition();

  return (
    <div className="fixed inset-0 z-[250] overflow-hidden pointer-events-auto select-none">
      {/* Invisible click catcher that covers the whole screen */}
      <div 
        className="absolute inset-0 cursor-pointer" 
        onClick={onComplete} 
      />

      {/* Spotlight cutout hole using a single div with huge box-shadow */}
      {isDesktop && targetRect ? (
        <div
          className="absolute border-2 border-emerald-400 rounded-3xl pointer-events-none transition-all duration-300 ease-out z-[255]"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.85), inset 0 0 15px rgba(16,185,129,0.1)'
          }}
        >
          <div className="absolute -top-3.5 left-6 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-widest shadow-[0_0_12px_rgba(16,185,129,0.6)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
            <span>{language === 'pl' ? 'Podświetlona sekcja' : 'Active Feature'}</span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/85 pointer-events-none transition-opacity duration-300" />
      )}

      {/* Main Tour Container */}
      <div className={`relative z-[260] w-full h-full flex ${isDesktop && targetRect ? 'block' : 'items-center justify-center p-4'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ duration: 0.25 }}
            style={isDesktop && targetRect ? popoverStyle : undefined}
            className={`${
              isDesktop && targetRect 
                ? '' 
                : 'max-w-md w-full'
            } bg-[#0a101b] border-2 border-emerald-500/40 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(16,185,129,0.25)] p-6 text-white overflow-hidden`}
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500" />

            {/* Header row */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                {step.badge[language]}
              </span>
              <button
                type="button"
                onClick={onComplete}
                title={language === 'pl' ? 'Zamknij / Pomiń' : 'Close / Skip'}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Description */}
            <div className="space-y-2 mb-3.5">
              <h3 className="text-xl font-bold font-serif text-white tracking-tight leading-snug">
                {step.title[language]}
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-sans">
                {step.desc[language]}
              </p>
            </div>

            {/* Visual Mockup Preview */}
            <div className="mb-4">
              {step.renderMockup(language)}
            </div>

            {/* Progress indicators and controls */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentStep 
                        ? 'w-6 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                        : idx < currentStep 
                          ? 'w-2 bg-emerald-500/40' 
                          : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{language === 'pl' ? 'Wstecz' : 'Back'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-extrabold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {currentStep < steps.length - 1 ? (
                    <>
                      <span>{language === 'pl' ? 'Dalej' : 'Next'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === 'pl' ? 'Zakończ' : 'Done'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingOverlay;

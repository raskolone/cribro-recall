import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  HelpCircle, 
  Lightbulb, 
  Check,
  Library,
  History,
  Settings,
  Flame,
  Volume2,
  ArrowRight,
  ShieldCheck,
  Key,
  Layers
} from 'lucide-react';

interface OnboardingOverlayProps {
  onComplete: () => void;
  language?: 'pl' | 'en';
}

interface StepData {
  targetId: string;
  placement: 'top' | 'bottom' | 'right' | 'left' | 'center';
  badge: { pl: string; en: string };
  title: { pl: string; en: string };
  desc: { pl: string; en: string };
  renderMockup: (lang: 'pl' | 'en') => React.ReactNode;
}

const steps: StepData[] = [
  // Krok 1: Wprowadzenie i Panel Główny
  {
    targetId: 'tour-generator',
    placement: 'right',
    badge: { pl: 'KROK 1 Z 7 • WPROWADZENIE', en: 'STEP 1 OF 7 • WELCOME' },
    title: { 
      pl: 'Witaj w CRIBRO ENGLISH!', 
      en: 'Welcome to CRIBRO ENGLISH!' 
    },
    desc: {
      pl: 'Twój osobisty asystent językowy i centrum codziennego treningu. Zamiast biernego zapamiętywania regułek, tutaj uczysz się aktywnego budowania zdań, mówienia i płynnego formułowania myśli po angielsku.',
      en: 'Your personal language trainer and daily study center. Instead of passive memorization, you practice active sentence formation, fluent speech, and real communication in English.'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-base-300/90 rounded-2xl border border-primary/30 space-y-2.5 text-center shadow-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold border border-primary/30">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>{lang === 'pl' ? 'Nowoczesny Trening Językowy' : 'Smart Language Coaching'}</span>
        </div>
        <div className="text-white font-bold text-sm">
          {lang === 'pl' ? '🎯 Cel: Płynność, precyzja i pewność siebie w mówieniu' : '🎯 Goal: Fluency, accuracy, and confident speaking'}
        </div>
        <div className="flex justify-center items-center gap-2 pt-1 text-[11px] text-content-muted">
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Metoda Recall</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">AI Feedback</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Notion Sync</span>
        </div>
      </div>
    )
  },

  // Krok 2: Prace Domowe
  {
    targetId: 'tour-homework',
    placement: 'right',
    badge: { pl: 'KROK 2 Z 7 • PRACE DOMOWE', en: 'STEP 2 OF 7 • HOMEWORK' },
    title: { 
      pl: 'Zadania i Prace Domowe od Lektora', 
      en: 'Assignments & Homework from Tutor' 
    },
    desc: {
      pl: 'Tutaj znajdziesz wszystkie zadania domowe przypisane przez lektora. Każde zadanie możesz otworzyć bezpośrednio w aplikacji lub poprzez unikalny link z wiadomości e-mail — nawet bez logowania!',
      en: 'Find all homework tasks assigned by your tutor. Open them in the app or via unique secure links from your email — even without having to log in manually!'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-ink-2 rounded-2xl border border-primary/30 space-y-2.5 text-xs shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-bold text-white">Present Perfect vs Past Simple</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-warn/20 text-warn border border-warn/30 font-mono text-[10px] font-bold">
            {lang === 'pl' ? 'Do wykonania' : 'Due soon'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-1.5 font-mono text-[11px]">
          <div className="text-content-muted">PL: Od jak dawna tu pracujesz?</div>
          <div className="text-primary flex items-center gap-1 font-semibold">
            <span>EN: How long have you worked here?</span>
            <span className="w-1.5 h-3 bg-primary animate-pulse inline-block" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-primary">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          <span>{lang === 'pl' ? 'Natychmiastowa ewaluacja gramatyczna i lektorska' : 'Instant grammar check & tutor evaluation'}</span>
        </div>
      </div>
    )
  },

  // Krok 3: Baza Słownictwa i Fiszki SRS
  {
    targetId: 'tour-flashcards',
    placement: 'right',
    badge: { pl: 'KROK 3 Z 7 • SŁOWNICTWO I FISZKI', en: 'STEP 3 OF 7 • VOCABULARY & FLASHCARDS' },
    title: { 
      pl: 'Fiszki i Inteligentne Powtórki (SRS)', 
      en: 'Flashcards & Spaced Repetition (SRS)' 
    },
    desc: {
      pl: 'Dostęp do słownictwa z Twoich lekcji oraz bogatej bazy haseł ogólnych (od A1 do C2). Inteligentny algorytm podsuwa słówka do powtórki dokładnie wtedy, gdy Twój mózg zaczyna je zacierać.',
      en: 'Access words from your lessons and the general database (A1 to C2). The spaced repetition algorithm schedules revisions right when you need them most.'
    },
    renderMockup: (lang) => (
      <div className="p-3.5 bg-base-300/80 rounded-2xl border border-primary/25 space-y-2.5 text-xs shadow-md">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 via-base-200 to-base-300 border border-primary/30 text-center space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">
            {lang === 'pl' ? 'Fiszka SRS • Poziom B2' : 'SRS Flashcard • Level B2'}
          </div>
          <div className="text-base font-bold text-white font-serif">breakthrough</div>
          <div className="text-xs text-content-muted">przełom, krok milowy</div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-content mt-1">
            <Volume2 className="w-3 h-3 text-primary" />
            <span>/ˈbreɪkˌθruː/</span>
          </div>
        </div>
        <div className="flex justify-between items-center text-[10px] text-content-muted font-mono">
          <span>{lang === 'pl' ? 'Algorytm: SuperMemo 2' : 'Algorithm: SuperMemo 2'}</span>
          <span className="text-primary font-bold">{lang === 'pl' ? 'Opanowane w 92%' : '92% Mastered'}</span>
        </div>
      </div>
    )
  },

  // Krok 4: Historia Lekcji i Notion
  {
    targetId: 'tour-history',
    placement: 'right',
    badge: { pl: 'KROK 4 Z 7 • HISTORIA LEKCJI', en: 'STEP 4 OF 7 • LESSON HISTORY' },
    title: { 
      pl: 'Notatki z Lekcji i Format 4 Bloków', 
      en: 'Lesson Notes & 4-Block Format' 
    },
    desc: {
      pl: 'Wszystkie Twoje lekcje są automatycznie synchronizowane z Notion i poukładane w przejrzysty 4-blokowy format: Words & Phrases, Grammar & Accuracy, Pronunciation oraz Homework.',
      en: 'All your lessons sync directly with Notion in our structured 4-block layout: Words & Phrases, Grammar & Accuracy, Pronunciation, and Homework.'
    },
    renderMockup: (lang) => (
      <div className="space-y-1.5 text-xs">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/25">
            <div className="font-bold text-primary text-[11px]">1. Words & Phrases</div>
            <div className="text-[10px] text-content-muted mt-0.5">Słownictwo z zajęć</div>
          </div>
          <div className="p-2 rounded-xl bg-accent/10 border border-accent/25">
            <div className="font-bold text-accent text-[11px]">2. Grammar</div>
            <div className="text-[10px] text-content-muted mt-0.5">Struktury i reguły</div>
          </div>
          <div className="p-2 rounded-xl bg-secondary/10 border border-secondary/25">
            <div className="font-bold text-secondary text-[11px]">3. Pronunciation</div>
            <div className="text-[10px] text-content-muted mt-0.5">Akcent i fonetyka</div>
          </div>
          <div className="p-2 rounded-xl bg-warn/10 border border-warn/25">
            <div className="font-bold text-warn text-[11px]">4. Homework</div>
            <div className="text-[10px] text-content-muted mt-0.5">Zadania utrwalające</div>
          </div>
        </div>
      </div>
    )
  },

  // Krok 5: Generator Treningu AI
  {
    targetId: 'tour-generator-header',
    placement: 'bottom',
    badge: { pl: 'KROK 5 Z 7 • TRENING AI', en: 'STEP 5 OF 7 • AI PRACTICE' },
    title: { 
      pl: 'Układanka i Tłumaczenie z Pamięci', 
      en: 'Puzzle & Sentence Formation' 
    },
    desc: {
      pl: 'Ćwicz w dwóch trybach: zacznij od bezstresowej „Układanki”, układając klocki w naturalny szyk zdań, a potem przejdź do wpisywania całych zdań z pamięci z natychmiastowym feedbackiem sztucznej inteligencji.',
      en: 'Practice in two modes: start with the stress-free "Puzzle" mode assembling words, then advance to full typing from memory with instant AI feedback.'
    },
    renderMockup: (lang) => (
      <div className="p-3 bg-primary/60 rounded-2xl border-2 border-primary/40 space-y-2 text-xs shadow-md">
        <div className="text-[11px] text-primary font-semibold text-center">
          {lang === 'pl' ? '🇵🇱 Lubię czytać książki po pracy.' : '🇵🇱 Lubię czytać książki po pracy.'}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {['I', 'enjoy', 'reading', 'books', 'after work'].map((tile, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg bg-primary/25 border border-primary text-primary text-xs font-mono font-bold shadow-sm">
              {tile}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1 text-[10px] text-primary pt-1">
          <Lightbulb className="w-3 h-3 text-warn" />
          <span>{lang === 'pl' ? 'Ocena: 100% (Znaczenie 40/40 • Gramatyka 40/40)' : 'Score: 100% (Meaning 40/40 • Grammar 40/40)'}</span>
        </div>
      </div>
    )
  },

  // Krok 6: Ustawienia, Bezpieczeństwo i Google
  {
    targetId: 'tour-nav-settings',
    placement: 'right',
    badge: { pl: 'KROK 6 Z 7 • USTAWIENIA', en: 'STEP 6 OF 7 • SETTINGS' },
    title: { 
      pl: 'Personalizacja, Hasło i Konto Google', 
      en: 'Personalization, Password & Google' 
    },
    desc: {
      pl: 'W Ustawieniach zmienisz hasło tymczasowe na własne, połączysz profil z kontem Google (dla logowania 1-kliknięciem) oraz dostosujesz głos i akcent lektora (US/UK, szybkość wymowy).',
      en: 'In Settings you can set your private password, link your Google account for 1-click logins, and customize tutor voice and accent (US/UK, speed).'
    },
    renderMockup: (lang) => (
      <div className="p-3 bg-base-300/90 rounded-2xl border border-white/15 space-y-2 text-xs shadow-md">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span className="font-semibold text-white">Logowanie przez Google</span>
          </div>
          <span className="text-primary font-bold text-[10px]">Dostępne ✓</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="text-content">Akcent lektora</span>
          </div>
          <span className="font-mono text-white text-[11px]">British / American</span>
        </div>
      </div>
    )
  },

  // Krok 7: Przycisk Pomoc
  {
    targetId: 'tour-help-button',
    placement: 'right',
    badge: { pl: 'KROK 7 Z 7 • POMOC ZAWSZE POD RĘKĄ', en: 'STEP 7 OF 7 • HELP ANYTIME' },
    title: { 
      pl: 'Zawsze możesz tu wrócić!', 
      en: 'You Can Always Replay This!' 
    },
    desc: {
      pl: 'Ten przewodnik możesz uruchomić ponownie w dowolnym momencie. Wystarczy, że klikniesz widoczny w dolnej części menu bocznego przycisk „Pomoc”. Miłej i owocnej nauki!',
      en: 'You can replay this onboarding tour anytime. Simply click the "Help" button located at the bottom of the sidebar. Enjoy your learning journey!'
    },
    renderMockup: (lang) => (
      <div className="p-4 bg-primary/20 rounded-2xl border border-primary/40 text-center space-y-2 shadow-lg">
        <div className="w-10 h-10 rounded-full bg-primary/30 text-primary flex items-center justify-center mx-auto border border-primary/50 shadow-[0_0_15px_rgba(114,240,180,0.4)]">
          <HelpCircle className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-white font-bold text-sm">
          {lang === 'pl' ? 'Przycisk „Pomoc” w menu bocznym' : '“Help” button in the sidebar'}
        </div>
        <p className="text-xs text-content-muted">
          {lang === 'pl' 
            ? 'Kliknij „Zakończ”, aby rozpocząć korzystanie z aplikacji CRIBRO ENGLISH.' 
            : 'Click “Done” to begin using CRIBRO ENGLISH.'}
        </p>
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
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    updateTargetPosition();
    const timeout = setTimeout(updateTargetPosition, 250);
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      clearTimeout(timeout);
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

    const popoverWidth = 470;
    const padding = 18;
    let top = 0;
    let left = 0;
    let actualPlacement = step.placement;

    if (step.placement === 'right') {
      left = targetRect.right + padding;
      top = targetRect.top + (targetRect.height / 2) - 200;

      // If falls off right edge, flip to bottom or center
      if (left + popoverWidth > window.innerWidth - 20) {
        left = Math.max(20, targetRect.left);
        top = targetRect.bottom + padding;
        actualPlacement = 'bottom';
      }
    } else if (step.placement === 'top') {
      left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
      top = targetRect.top - 460 - padding;
      if (top < 20) {
        top = targetRect.bottom + padding;
        actualPlacement = 'bottom';
      }
    } else if (step.placement === 'bottom') {
      left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
      top = targetRect.bottom + padding;
      if (top + 460 > window.innerHeight) {
        top = targetRect.top - 460 - padding;
        actualPlacement = 'top';
      }
    } else {
      left = targetRect.right + padding;
      top = targetRect.top;
    }

    // Keep within horizontal boundaries
    const maxLeft = window.innerWidth - popoverWidth - 20;
    left = Math.max(20, Math.min(left, maxLeft));

    // Keep within vertical boundaries
    top = Math.max(20, Math.min(top, window.innerHeight - 490));

    return {
      style: {
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`
      },
      actualPlacement
    };
  };

  const { style: popoverStyle, actualPlacement } = getPopoverPosition();

  return (
    <div className="fixed inset-0 z-[250] overflow-hidden pointer-events-auto select-none">
      {/* Dimmed backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500"
        onClick={onComplete}
      />

      {/* Spotlight cutout for Desktop when target element is found */}
      {isDesktop && targetRect && (
        <div
          className="absolute border-2 border-primary rounded-2xl pointer-events-none transition-all duration-400 ease-out"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.78), 0 0 30px rgba(114, 240, 180, 0.7)'
          }}
        >
          <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-primary text-accent-ink font-extrabold text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
            <span>{language === 'pl' ? 'Wskazywany element' : 'Active Feature'}</span>
          </div>
        </div>
      )}

      {/* Main Tour Container */}
      <div className={`relative z-10 w-full h-full flex ${isDesktop && targetRect ? 'block' : 'items-center justify-center p-4'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={isDesktop && targetRect ? popoverStyle : undefined}
            className={`${
              isDesktop && targetRect 
                ? 'absolute' 
                : 'max-w-md w-full'
            } bg-ink-2 border-2 border-primary/40 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(114,240,180,0.25)] p-6 text-white overflow-hidden`}
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />

            {/* Header row */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary">
                {step.badge[language]}
              </span>
              <button
                type="button"
                onClick={onComplete}
                title={language === 'pl' ? 'Zamknij / Pomiń przewodnik' : 'Close / Skip tour'}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-text-2 hover:text-text-hi transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Description */}
            <div className="space-y-2 mb-3.5">
              <h3 className="text-xl font-bold font-serif text-white tracking-tight leading-snug">
                {step.title[language]}
              </h3>
              <p className="text-xs sm:text-sm text-content leading-relaxed font-sans">
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
                        ? 'w-6 bg-primary shadow-[0_0_8px_rgba(114,240,180,0.8)]' 
                        : idx < currentStep 
                          ? 'w-2 bg-primary/40' 
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
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-content text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{language === 'pl' ? 'Wstecz' : 'Back'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 rounded-xl bg-primary hover:brightness-110 text-accent-ink font-extrabold text-xs transition-all shadow-[0_0_15px_rgba(114,240,180,0.4)] flex items-center gap-1.5 active:scale-95 cursor-pointer"
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

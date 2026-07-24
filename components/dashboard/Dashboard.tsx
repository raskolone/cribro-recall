
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Sidebar from './Sidebar';
import ConfirmModal from '../ui/ConfirmModal';
import BugReporter from '../ui/BugReporter';
import VocabularyGenerator from './VocabularyGenerator';
import WordList from './WordList';
import ProgressOverview from './ProgressOverview';
import LessonHistory from './LessonHistory';
import AssignedTasks from './AssignedTasks';
import PracticeZone from '../practice/PracticeZone';
import SettingsScreen from '../settings/SettingsScreen';
import FlashcardSetsScreen from '../flashcards/FlashcardSetsScreen';
import FlashcardEditScreen from '../flashcards/FlashcardEditScreen';
import FlashcardStudyScreen from '../flashcards/FlashcardStudyScreen';
import FlashcardStatsScreen from '../flashcards/FlashcardStatsScreen';
import AdminPanel from '../admin/AdminPanel';
import AdminDebuggingScreen from '../admin/AdminDebuggingScreen';
import LearningProgressChart from './LearningProgressChart';
import { useSettings } from '../../context/SettingsContext';
import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';
import { OnboardingTour } from './OnboardingTour';
import LessonHistoryScreen from './LessonHistoryScreen';
import StudentTestsScreen from '../tests/StudentTestsScreen';
import { useAuth } from '../../context/AuthContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import OnboardingOverlay from './OnboardingOverlay';
import { ExerciseType, PracticeHistory } from '../../types';
import Button from '../ui/Button';
import { ChevronDown, ChevronRight, LayoutDashboard, Library, ClipboardList, Settings, User, BookOpen, Sparkles, BarChart3 } from 'lucide-react';

import FlashcardPresentationScreen from '../flashcards/FlashcardPresentationScreen';
import i18n from "i18next";

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests' | 'admin-debugging' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests';
type PracticeView = { type: 'exercise'; exercise: ExerciseType; isRevisionMode?: boolean; isSpacedRepetitionMode?: boolean } | null;


const GoogleLinkBanner = () => {
    const { user, linkGoogleAccount } = useAuth();
    const { language } = useLanguage();
    const [isLinking, setIsLinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);

    const isLinked = auth.currentUser?.providerData?.some((p: any) => p.providerId === 'google.com');

    // Show if loginCount === 1 and not linked and not dismissed
    if (user && user.loginCount === 1 && !isLinked && !isDismissed) {
        return (
            <div className="bg-primary/10 border border-primary text-content p-4 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-lg mb-1">{language === 'pl' ? 'Witamy po raz pierwszy!' : 'Welcome!'}</h3>
                    <p className="text-sm opacity-90 mb-2">{language === 'pl' ? 'Połącz swoje konto z Google, aby w przyszłości logować się jednym kliknięciem.' : 'Link your account with Google to log in with one click in the future.'}</p>
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <Button variant="ghost" className="text-sm" onClick={() => setIsDismissed(true)}>
                        {language === 'pl' ? 'Pomiń' : 'Dismiss'}
                    </Button>
                    <Button 
                        variant="primary" 
                        isLoading={isLinking}
                        className="whitespace-nowrap"
                        onClick={async () => {
                            setIsLinking(true);
                            setError(null);
                            try {
                                await linkGoogleAccount();
                            } catch (err: any) {
                                setError(err.message || 'Error linking account');
                            } finally {
                                setIsLinking(false);
                            }
                        }}
                    >
                        {language === 'pl' ? 'Połącz z Google' : 'Link with Google'}
                    </Button>
                </div>
            </div>
        )
    }
    return null;
}

const PracticeSetSelector = ({ onSelectSet, onCancel }: { onSelectSet: (id: string) => void, onCancel: () => void }) => {
  const { sets } = useFlashcards();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);
  
  if (sets.length === 0) {
    return (
      <div className="text-center p-12 liquid-glass-card shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] mx-auto max-w-2xl mt-12">
        <h2 className="text-2xl font-bold mb-4">{i18n.t("No Word Lists found")}</h2>
        <p className="text-content-muted mb-8">{i18n.t("You need to create a Word List before practicing.")}</p>
        <Button onClick={onCancel}>{i18n.t("Back to Dashboard")}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pt-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">{i18n.t("Select a Word List to Practice")}</h2>
        <Button variant="ghost" onClick={onCancel}>{i18n.t("Cancel")}</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map(set => (
          <div 
            key={set.id} 
            className="liquid-glass-card p-6 cursor-pointer transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
            onClick={() => onSelectSet(set.id)}
          >
            <h3 className="font-bold text-lg mb-2">{set.title}</h3>
            <p className="text-sm text-content-muted mb-4">{set.cardCount}  {i18n.t("cards")}</p>
            <Button className="w-full pointer-events-none" variant="secondary">{i18n.t("Start Practice")}</Button>
          </div>
        ))}
      </div>
    </div>
  );
};


const AnimatedFlame = () => {
  const flameGroupRef = useRef<SVGGElement>(null);
  const outerFlameRef = useRef<SVGPathElement>(null);
  const innerFlameRef = useRef<SVGPathElement>(null);
  const coreFlameRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!flameGroupRef.current) return;
    
    let ctx = gsap.context(() => {
      // Main wind flicker effect
      gsap.to(flameGroupRef.current, {
        skewX: "random(-8, 8)",
        scaleY: "random(0.9, 1.15)",
        scaleX: "random(0.9, 1.05)",
        rotation: "random(-5, 5)",
        duration: 0.15,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        repeatRefresh: true,
        transformOrigin: "center bottom"
      });
      
      // Outer flame path morphing/flicker
      gsap.to(outerFlameRef.current, {
        opacity: "random(0.7, 1)",
        duration: 0.1,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        repeatRefresh: true
      });

      // Inner flame dynamic scaling
      gsap.to(innerFlameRef.current, {
        scaleY: "random(0.8, 1.2)",
        duration: 0.12,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        repeatRefresh: true,
        transformOrigin: "center bottom"
      });
      
      // Core flame glowing
      gsap.to(coreFlameRef.current, {
        opacity: "random(0.8, 1)",
        duration: 0.08,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        repeatRefresh: true
      });

      // Sparks/particles flying up
      if (particlesRef.current && particlesRef.current.children) {
        gsap.utils.toArray(particlesRef.current.children).forEach((spark: any, i) => {
          gsap.set(spark, { opacity: 0, y: 0, x: 0, scale: gsap.utils.random(0.4, 1) });
          gsap.to(spark, {
            y: "random(-40, -20)",
            x: "random(-15, 15)",
            opacity: 0,
            scale: 0,
            duration: gsap.utils.random(0.6, 1.2),
            delay: gsap.utils.random(0, 1),
            repeat: -1,
            ease: "power1.out"
          });
          gsap.to(spark, {
            opacity: 1,
            duration: 0.2,
            delay: gsap.utils.random(0, 1),
            repeat: -1,
            repeatDelay: gsap.utils.random(0.4, 1) - 0.2,
            yoyo: true
          });
        });
      }

    }, flameGroupRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      {/* Glow effect behind */}
      <div className="absolute inset-0 bg-orange-500 blur-[8px] rounded-full opacity-40 animate-pulse"></div>
      
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible z-10" style={{ filter: 'drop-shadow(0 0 4px rgba(255,100,0,0.8))' }}>
        <g ref={particlesRef}>
          <circle cx="50" cy="80" r="3" fill="#ffeb3b" />
          <circle cx="45" cy="75" r="2" fill="#ff9800" />
          <circle cx="55" cy="85" r="2.5" fill="#ffc107" />
        </g>
        
        <g ref={flameGroupRef}>
          {/* Outer Flame */}
          <path 
            ref={outerFlameRef}
            d="M50,90 C50,90 20,70 20,40 C20,10 50,0 50,0 C50,0 80,10 80,40 C80,70 50,90 50,90 Z" 
            fill="url(#flameGrad1)" 
          />
          {/* Inner Flame */}
          <path 
            ref={innerFlameRef}
            d="M50,85 C50,85 30,70 30,45 C30,25 50,15 50,15 C50,15 70,25 70,45 C70,70 50,85 50,85 Z" 
            fill="url(#flameGrad2)" 
          />
          {/* Core Flame */}
          <path 
            ref={coreFlameRef}
            d="M50,80 C50,80 40,70 40,55 C40,40 50,35 50,35 C50,35 60,40 60,55 C60,70 50,80 50,80 Z" 
            fill="#ffffff" 
          />
        </g>
        
        <defs>
          <linearGradient id="flameGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff0000" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ff5722" />
            <stop offset="100%" stopColor="#ff9800" />
          </linearGradient>
          <linearGradient id="flameGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff9800" />
            <stop offset="60%" stopColor="#ffc107" />
            <stop offset="100%" stopColor="#ffeb3b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { sets } = useFlashcards();
  const { words, difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  const { showLearningProgressChart } = useSettings();
  const [view, setView] = useState<View>(() => {
    const isMobile = window.innerWidth < 768;
    const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
    
    if (isTeacher) {
      return isMobile ? 'ai-generator' : 'admin';
    } else {
      return 'ai-generator';
    }
  });
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<string | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeView>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [user?.onboardingCompleted]);
  
  const handleCompleteOnboarding = async () => {
    setShowOnboarding(false);
    if (user?.id) {
      try {
        await updateDoc(doc(db, 'users', user.id), { onboardingCompleted: true });
      } catch(e) { console.error(e); }
    }
  };

  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const [greeting, setGreeting] = useState('');
  const [slogan, setSlogan] = useState('');
  const [exerciseResetKey, setExerciseResetKey] = useState(0);
  const [isProgressCollapsed, setIsProgressCollapsed] = useState(true);
  const [isStudentViewCollapsed, setIsStudentViewCollapsed] = useState(true);
  
  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    window.history.replaceState({ view, activeSetId, practiceView, adminSelectedUserId }, '');

    const handlePopState = (event) => {
      if (event.state) {
        setView(event.state.view || 'dashboard');
        if (event.state.activeSetId !== undefined) setActiveSetId(event.state.activeSetId);
        if (event.state.practiceView !== undefined) setPracticeView(event.state.practiceView);
        if (event.state.adminSelectedUserId !== undefined) setAdminSelectedUserId(event.state.adminSelectedUserId);
      } else {
        setView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeView = (newView: View, stateUpdates?: { activeSetId?: string | null, practiceView?: PracticeView, adminSelectedUserId?: string | null }) => {
    setView(newView);
    let nextActiveSetId = activeSetId;
    let nextPracticeView = practiceView;
    let nextAdminSelectedUserId = adminSelectedUserId;

    if (stateUpdates) {
      if (stateUpdates.activeSetId !== undefined) {
        setActiveSetId(stateUpdates.activeSetId);
        nextActiveSetId = stateUpdates.activeSetId;
      }
      if (stateUpdates.practiceView !== undefined) {
        setPracticeView(stateUpdates.practiceView);
        nextPracticeView = stateUpdates.practiceView;
      }
      if (stateUpdates.adminSelectedUserId !== undefined) {
        setAdminSelectedUserId(stateUpdates.adminSelectedUserId);
        nextAdminSelectedUserId = stateUpdates.adminSelectedUserId;
      }
    }

    window.history.pushState({ 
      view: newView, 
      activeSetId: nextActiveSetId, 
      practiceView: nextPracticeView, 
      adminSelectedUserId: nextAdminSelectedUserId 
    }, '');
  };
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalState({ isOpen: true, title, message, onConfirm });
  };
  
  const closeConfirm = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    let name = user?.firstName;
    
    // Fallback do username i wyciągnięcie samego imienia (bez nazwiska)
    if (!name && user?.username) {
      name = user.username.split(' ')[0];
    }
    
    let options: string[] = [];

    if (name) {
      const nameTitleCase = name.charAt(0).toUpperCase() + name.slice(1);
      
      // Prosta heurystyka do Wołacza (Vocative) dla popularnych polskich imion
      const getVocative = (n: string) => {
        const lower = n.toLowerCase();
        if (lower.endsWith('a')) return n.slice(0, -1) + 'o'; // Anna -> Anno
        if (lower.endsWith('ek')) return n.slice(0, -2) + 'ku'; // Marek -> Marku
        if (lower.endsWith('r')) return n + 'ze'; // Piotr -> Piotrze
        if (lower.endsWith('eł')) return n.slice(0, -2) + 'le'; // Paweł -> Pawle
        if (lower.endsWith('ł')) return n.slice(0, -1) + 'le'; // Michał -> Michale
        if (lower.endsWith('j')) return n + 'u'; // Maciej -> Macieju
        if (lower.endsWith('sz') || lower.endsWith('cz')) return n + 'u'; // Tomasz -> Tomaszu
        if (lower.endsWith('n') || lower.endsWith('m') || lower.endsWith('d') || lower.endsWith('t') || lower.endsWith('w')) return n + 'ie'; // Marcin -> Marcinie
        return n; // fallback
      };
      
      const vocativeName = language === 'pl' ? getVocative(nameTitleCase) : nameTitleCase;
      
      const isFemale = nameTitleCase.toLowerCase().endsWith('a');
      const gotowy = isFemale ? 'gotowa' : 'gotowy';
      
      const greetingsPl = [
        `${vocativeName}, witaj ponownie!`,
        `${vocativeName}, ${gotowy} na nową lekcję?`,
        `${vocativeName}, miło Cię widzieć!`,
        `${vocativeName}, czas na codzienną porcję wiedzy!`,
        `${vocativeName}, co dzisiaj ćwiczymy?`
      ];
      
      const greetingsEn = [
        `Welcome back, ${nameTitleCase}!`,
        `Ready for a new lesson, ${nameTitleCase}?`,
        `Good to see you, ${nameTitleCase}!`,
        `Time to learn, ${nameTitleCase}!`,
        `What are we practicing today, ${nameTitleCase}?`
      ];
      
      options = language === 'pl' ? greetingsPl : greetingsEn;
    } else {
      const greetingsPlNoName = [
        `Witaj ponownie!`,
        `Gotowy na nową lekcję?`,
        `Miło Cię widzieć!`,
        `Czas na codzienną porcję wiedzy!`,
        `Co dzisiaj ćwiczymy?`
      ];
      
      const greetingsEnNoName = [
        `Welcome back!`,
        `Ready for a new lesson?`,
        `Good to see you!`,
        `Time to learn!`,
        `What are we practicing today?`
      ];

      options = language === 'pl' ? greetingsPlNoName : greetingsEnNoName;
    }
    
    setGreeting(options[Math.floor(Math.random() * options.length)]);

    
    let slogans: string[] = [];
    const easyWordsCount = (words && difficultWords) ? words.length - difficultWords.length : 0;
    const dueCount = dueWords ? dueWords.length : 0;

    if (language === 'pl') {
       if (user?.streakCount && user.streakCount > 2) {
          slogans = [
            'Niesamowita passa! Masz już ' + user.streakCount + ' dni z rzędu. Oby tak dalej!',
            'Twój płomień płonie! ' + user.streakCount + ' dni nauki z rzędu. Lecimy dalej?',
            'Znakomita regularność! Co dzisiaj szlifujemy?'
          ];
       } else if (easyWordsCount > 10) {
          slogans = [
            'Świetna robota! Opanowałeś już ' + easyWordsCount + ' słówek. Działaj dalej!',
            'Twoja wiedza rośnie, masz już ' + easyWordsCount + ' znanych słów!',
            'Udało Ci się już opanować ' + easyWordsCount + ' słówek! Co dzisiaj poćwiczymy?'
          ];
       } else if (dueCount > 0) {
          slogans = [
            'Czas na powtórkę! Masz ' + dueCount + ' słówek do przejrzenia.',
            'Nie traćmy czasu, czeka na Ciebie ' + dueCount + ' słówek w powtórkach.',
            'Systematyczność to klucz, masz dzisiaj ' + dueCount + ' słów do przypomnienia.'
          ];
       } else if (user?.loginCount && user.loginCount > 10) {
          slogans = [
            'Jesteś tu już stałym bywalcem! Gotowy na kolejne wyzwanie?',
            'Świetnie Ci idzie, nie zwalniaj tempa!',
            'Gotowy pobić swoje kolejne rekordy?'
          ];
       } else {
          slogans = [
            'Co dzisiaj poćwiczymy?',
            'Kolejny dzień, kolejna szansa na nową wiedzę!',
            'Pamiętaj, że małe kroki prowadzą do wielkich sukcesów!',
            'Masz chwilę? Zróbmy szybką powtórkę.'
          ];
       }
    } else {
       if (user?.streakCount && user.streakCount > 2) {
          slogans = [
            'Amazing streak! ' + user.streakCount + ' days in a row. Keep it up!',
            'Your flame is burning! ' + user.streakCount + ' days of learning. Ready for more?',
            'Great consistency! What are we practicing today?'
          ];
       } else if (easyWordsCount > 10) {
          slogans = [
            'Great job! You\'ve mastered ' + easyWordsCount + ' words. Keep going!',
            'Your vocabulary is growing, you know ' + easyWordsCount + ' words now!',
            'You\'ve successfully learned ' + easyWordsCount + ' words! What\'s next?'
          ];
       } else if (dueCount > 0) {
          slogans = [
            'Time for a review! You have ' + dueCount + ' words waiting.',
            'Let\'s not waste time, ' + dueCount + ' words need your attention.',
            'Consistency is key, you have ' + dueCount + ' words to review today.'
          ];
       } else if (user?.loginCount && user.loginCount > 10) {
          slogans = [
            'You are a regular here! Ready for another challenge?',
            'You\'re doing great, keep up the pace!',
            'Ready to beat your own records?'
          ];
       } else {
          slogans = [
            'What are we practicing today?',
            'Another day, another chance to learn something new!',
            'Remember, small steps lead to big success!',
            'Got a minute? Let\'s do a quick review.'
          ];
       }
    }
    setSlogan(slogans[Math.floor(Math.random() * slogans.length)]);


  }, [user?.firstName, language, user?.streakCount, user?.loginCount, words, difficultWords, dueWords]);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [view, practiceView, activeSetId, adminSelectedUserId]);

  const [checkedSets, setCheckedSets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('checked_sets') || '[]');
    } catch {
      return [];
    }
  });

  const handleCheckSet = (setId: string) => {
    const updated = [...checkedSets, setId];
    setCheckedSets(updated);
    localStorage.setItem('checked_sets', JSON.stringify(updated));
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSidebarOpen) {
          setIsSidebarOpen(false);
          return;
        }

        const openModals = document.querySelectorAll('.fixed.inset-0.z-50');
        let hasActiveModal = false;
        openModals.forEach(el => {
          if (!el.classList.contains('bg-transparent')) { // simple heuristic, just check if it's a real modal
            hasActiveModal = true;
          }
        });
        
        if (hasActiveModal) return;

        if (view !== 'dashboard') {
          if (isExerciseActive) {
            const isPl = language === 'pl';
            showConfirm(
              isPl ? 'Zakończ sesję' : 'End session',
              isPl ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
              () => {
                closeConfirm();
                setIsExerciseActive(false);
                changeView('dashboard', { activeSetId: null, practiceView: null, adminSelectedUserId: null });
              }
            );
            return;
          }
          setIsExerciseActive(false);
          changeView('dashboard', { activeSetId: null, practiceView: null, adminSelectedUserId: null });
        } else if (isExerciseActive) {
          const isPl = language === 'pl';
          showConfirm(
            isPl ? 'Zakończ sesję' : 'End session',
            isPl ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
            () => {
              closeConfirm();
              setIsExerciseActive(false);
              setExerciseResetKey(k => k + 1);
            }
          );
          return;
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [view, isSidebarOpen, isExerciseActive, language]);

  const isRevisionDue = useMemo(() => {
    if (difficultWords.length < 4) return false;
    if (!lastRevisionDate) return true;

    const lastRev = new Date(lastRevisionDate).getTime();
    const now = new Date().getTime();
    const diffHours = (now - lastRev) / (1000 * 60 * 60);

    if (frequency === 'Daily' && diffHours >= 24) return true;
    if (frequency === 'Weekly' && diffHours >= 24 * 7) return true;
    if (frequency === 'Monthly' && diffHours >= 24 * 30) return true;

    return false;
  }, [difficultWords.length, frequency, lastRevisionDate]);

  const startPractice = (exercise: ExerciseType, isRevisionMode = false, isSpacedRepetitionMode = false) => {
    changeView('practice');
    setPracticeView({ type: 'exercise', exercise, isRevisionMode, isSpacedRepetitionMode });
  };

  const renderContent = () => {
    if (view === 'practice' && practiceView) {
      if (practiceView.isRevisionMode || practiceView.isSpacedRepetitionMode) {
        return <PracticeZone 
          exerciseType={practiceView.exercise} 
          isRevisionMode={practiceView.isRevisionMode} 
          isSpacedRepetitionMode={practiceView.isSpacedRepetitionMode}
          onExit={() => changeView('dashboard', { activeSetId: null, practiceView: null, adminSelectedUserId: null })} 
        />;
      }
      return <PracticeSetSelector 
        onSelectSet={(setId) => {
          setActiveSetId(setId);
          changeView('flashcard-study');
        }}
        onCancel={() => changeView('dashboard', { activeSetId: null, practiceView: null, adminSelectedUserId: null })}
      />;
    }
    if (view === 'settings') {
      return <SettingsScreen />;
    }
    if (view === 'flashcard-sets') {
      return <FlashcardSetsScreen 
        onStudySet={(setId) => changeView('flashcard-study', { activeSetId: setId, practiceView: null })}
        onEditSet={(setId) => changeView('flashcard-edit', { activeSetId: setId })}
        onStatsSet={(setId) => changeView('flashcard-stats', { activeSetId: setId })}
        onPresentSet={(setId) => changeView('presentation', { activeSetId: setId })}
      />;
    }
    if (view === 'flashcard-edit' && activeSetId) {
      return <FlashcardEditScreen setId={activeSetId} onBack={() => changeView('flashcard-sets', { activeSetId: null })} onStudy={(setId) => changeView('flashcard-study', { activeSetId: setId, practiceView: null })} />;
    }
    if (view === 'flashcard-study' && activeSetId) {
      const modeMapping: Record<string, 'intro' | 'flashcards' | 'quiz' | 'writing' | 'matching'> = {
        'intro': 'intro',
        'flashcards': 'flashcards',
        'quiz': 'quiz',
        'fill-in-the-blank': 'writing',
        'match': 'matching'
      };
      const initialMode = practiceView ? modeMapping[practiceView.exercise] : undefined;
      
      return <FlashcardStudyScreen 
        setId={activeSetId} 
        initialMode={initialMode} 
        onBack={() => changeView('flashcard-sets', { activeSetId: null, practiceView: null })} 
        onStartAIPractice={() => {
          changeView('ai-generator');
          // In the future we might want to pass the activeSetId to the AI generator
          // But for now it just navigates there
        }}
      />;
    }
    if (view === 'flashcard-stats' && activeSetId) {
      return <FlashcardStatsScreen setId={activeSetId} onBack={() => changeView('flashcard-sets', { activeSetId: null })} />;
    }
    if (view === 'presentation' && activeSetId) {
      return <FlashcardPresentationScreen setId={activeSetId} onBack={() => changeView('flashcard-sets', { activeSetId: null })} />;
    }
    if (view === 'admin-debugging' && user?.role === 'admin') {
      return <AdminDebuggingScreen onBack={() => changeView('dashboard')} />;
    }
    if (view.startsWith('admin') && (user?.role === 'admin' || user?.role === 'teacher')) {
      return <AdminPanel initialTab={view === 'admin' ? null : view.replace('admin-', '')} onViewChange={changeView} initialSelectedUserId={adminSelectedUserId} onUserSelect={(id) => changeView(view, { adminSelectedUserId: id })} />;
    }
    if (view === 'ai-generator') {
      return <AIExerciseGeneratorScreen key={`ai-gen-${exerciseResetKey}`} initialSetId={activeSetId} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} />;
    }
    if (view === 'lesson-history') {
      return <LessonHistoryScreen />;
    }

    if (view === 'tests') {
      const isTeacherUser = user?.role === 'admin' || user?.role === 'teacher';
      if (isTeacherUser) {
        return <AdminPanel initialTab="tests" onViewChange={changeView} initialSelectedUserId={adminSelectedUserId} onUserSelect={(id) => changeView(view, { adminSelectedUserId: id })} />;
      }
      return <StudentTestsScreen onBack={() => changeView('dashboard', { activeSetId: null, practiceView: null, adminSelectedUserId: null })} />;
    }
        // Default to dashboard view
    const isTeacher = user?.role === 'admin' || user?.role === 'teacher';

    if (!isTeacher && view === 'dashboard') {
      return <AIExerciseGeneratorScreen key={`ai-gen-${exerciseResetKey}`} initialSetId={activeSetId} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} />;
    }

    return (
      <div className="space-y-6 flex flex-col min-h-[calc(100vh-8rem)]">
        {showOnboarding && <OnboardingOverlay onComplete={handleCompleteOnboarding} language={language} />}

        <GoogleLinkBanner />

        
        {isTeacher ? (
          <div className="space-y-6">
            <AdminPanel initialTab={null} onViewChange={changeView} initialSelectedUserId={adminSelectedUserId} onUserSelect={(id) => changeView(view, { adminSelectedUserId: id })} />
            
            {user?.role === 'teacher' && (
              <div className="mt-8 liquid-glass-card !p-0 overflow-hidden">
                <button 
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                  onClick={() => setIsProgressCollapsed(!isProgressCollapsed)}
                >
                  <h2 className="text-xl font-bold">{language === 'pl' ? 'Postępy w nauce' : 'Learning Progress'}</h2>
                  {isProgressCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                </button>
                {!isProgressCollapsed && (
                  <div className="p-6 border-t border-white/10 space-y-6">
                    <ProgressOverview />
                    {showLearningProgressChart && <LearningProgressChart />}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            {/* Welcome message / header for students */}
            
            <AnimatePresence>
              {user?.hasNewVocabulary && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="relative group cursor-pointer"
                  onClick={() => changeView('ai-generator')}
                >
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
                  <div className="relative liquid-glass-card !border-primary/40 bg-gradient-to-r from-primary/10 to-base-200/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-base-100 animate-ping" />
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-base-100" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm md:text-base">
                          {language === 'pl' ? 'Masz nowy zestaw słownictwa! 🎉' : 'You have a new vocabulary set! 🎉'}
                        </h3>
                        <p className="text-primary/80 text-xs md:text-sm">
                          {language === 'pl' ? 'Twój nauczyciel udostępnił nowe słówka z lekcji. Kliknij, aby poćwiczyć.' : 'Your teacher shared new vocabulary. Click here to practice.'}
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary font-semibold rounded-lg text-sm transition-colors shrink-0">
                      {language === 'pl' ? 'Przejdź do ćwiczeń' : 'Go to exercises'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="liquid-glass-card p-6 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {language === 'pl' ? `Cześć, ${user?.firstName || 'Uczniu'}! 👋` : `Hi, ${user?.firstName || 'Student'}! 👋`}
                </h1>
                <p className="text-content-muted text-sm mt-1">
                  {language === 'pl' 
                    ? 'Witaj w swoim panelu nauki. Sprawdź swoje postępy lub przejdź bezpośrednio do ćwiczeń.'
                    : 'Welcome to your learning panel. Check your progress or go directly to exercises.'}
                </p>
              </div>
              
              <button 
                onClick={() => changeView('ai-generator')} 
                className="flex items-center gap-2 px-5 py-3 bg-primary text-black font-bold rounded-xl shadow-[0_0_20px_rgba(114,240,180,0.3)] hover:scale-105 active:scale-95 transition-all self-start md:self-auto"
              >
                <Sparkles size={18} />
                {language === 'pl' ? 'Uruchom widok kursanta ✨' : 'Launch Student View ✨'}
              </button>
            </div>

            <div className="liquid-glass-card p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-3">
                <BarChart3 className="w-5 h-5 text-primary" />
                {language === 'pl' ? 'Twoje postępy w nauce' : 'Your Learning Progress'}
              </h2>
              <ProgressOverview />
              {showLearningProgressChart && <LearningProgressChart />}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-transparent transition-colors duration-300 overflow-hidden">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView) => {
          if (isExerciseActive) {
            const isPl = language === 'pl';
            showConfirm(
              isPl ? 'Zakończ sesję' : 'End session',
              isPl ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
              () => {
                closeConfirm();
                if (newView === view) {
                  setExerciseResetKey(k => k + 1);
                }
                setIsExerciseActive(false);
                changeView(newView, { practiceView: null });
              }
            );
            return;
          }
          setIsExerciseActive(false);
          changeView(newView, { practiceView: null });
        }} 
        onStartPractice={startPractice}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">
        <header className="relative z-40 flex flex-col md:flex-row md:justify-between items-center mb-6 p-4 rounded-2xl liquid-glass-card gap-4">
          <div className="w-full flex items-center justify-between md:justify-start gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start flex-wrap gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {greeting}
                </h1>
                {user?.streakCount !== undefined && user?.streakCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-full border border-base-300 shadow-sm" title={i18n.t("Your current streak")}>
                    <AnimatedFlame />
                    <span className="font-bold text-sm text-white">{user.streakCount}</span>
                  </div>
                )}
              </div>
              {user?.role !== 'admin' && user?.role !== 'teacher' && (
                <p className="text-sm text-content-muted mt-1 font-medium">{slogan}</p>
              )}
            </div>
            
            {/* Empty div to balance flex spacing on mobile (hamburger on left, this on right) */}
            <div className="w-10 md:hidden"></div>
          </div>
        </header>
        <div ref={contentRef} className="w-full h-full">
          {renderContent()}
        </div>
      </main>
      {/* Mobile Bottom Navigation */}
      {!(user?.role === 'admin' || user?.role === 'teacher') && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 liquid-glass-panel rounded-none border-0 border-t border-white/10 px-4 py-2 flex justify-between items-center z-50 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] pb-safe">
          <button 
            onClick={() => {
               if (isExerciseActive) {
                  showConfirm(
                    language === 'pl' ? 'Zakończ sesję' : 'End session',
                    language === 'pl' ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
                    () => {
                      closeConfirm();
                      setExerciseResetKey(k => k + 1);
                      setIsExerciseActive(false);
                      changeView('dashboard', { practiceView: null });
                    }
                  );
               } else {
                 changeView('dashboard', { practiceView: null });
               }
            }}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${view === 'dashboard' ? 'text-primary' : 'text-content-muted hover:text-white'}`}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] mt-1 font-medium">{language === 'pl' ? 'Start' : 'Home'}</span>
          </button>
          
          <button 
            onClick={() => {
               if (isExerciseActive) {
                  showConfirm(
                    language === 'pl' ? 'Zakończ sesję' : 'End session',
                    language === 'pl' ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
                    () => {
                      closeConfirm();
                      setIsExerciseActive(false);
                      changeView('flashcard-sets', { practiceView: null });
                    }
                  );
               } else {
                 changeView('flashcard-sets', { practiceView: null });
               }
            }}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${view === 'flashcard-sets' ? 'text-primary' : 'text-content-muted hover:text-white'}`}
          >
            <Library size={24} />
            <span className="text-[10px] mt-1 font-medium">{language === 'pl' ? 'Fiszki' : 'Cards'}</span>
          </button>

          <button 
            onClick={() => {
               if (isExerciseActive) {
                  showConfirm(
                    language === 'pl' ? 'Zakończ sesję' : 'End session',
                    language === 'pl' ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
                    () => {
                      closeConfirm();
                      setIsExerciseActive(false);
                      changeView('tests', { practiceView: null });
                    }
                  );
               } else {
                 changeView('tests', { practiceView: null });
               }
            }}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${view === 'tests' ? 'text-primary' : 'text-content-muted hover:text-white'}`}
          >
            <ClipboardList size={24} />
            <span className="text-[10px] mt-1 font-medium">{language === 'pl' ? 'Testy' : 'Tests'}</span>
          </button>
          
          <button 
            onClick={() => {
               if (isExerciseActive) {
                  showConfirm(
                    language === 'pl' ? 'Zakończ sesję' : 'End session',
                    language === 'pl' ? 'Czy na pewno chcesz zakończyć aktywne ćwiczenie?' : 'Are you sure you want to end the active exercise?',
                    () => {
                      closeConfirm();
                      setIsExerciseActive(false);
                      changeView('settings', { practiceView: null });
                    }
                  );
               } else {
                 changeView('settings', { practiceView: null });
               }
            }}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${view === 'settings' ? 'text-primary' : 'text-content-muted hover:text-white'}`}
          >
            <Settings size={24} />
            <span className="text-[10px] mt-1 font-medium">{language === 'pl' ? 'Menu' : 'Menu'}</span>
          </button>
        </div>
      )}
      {user?.role === "user" && <BugReporter />}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={closeConfirm}
        confirmText={language === 'pl' ? 'Potwierdź' : 'Confirm'}
        cancelText={language === 'pl' ? 'Anuluj' : 'Cancel'}
      />
    </div>
  );
};

export default Dashboard;

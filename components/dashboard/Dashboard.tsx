import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { auth, db } from '../../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import Sidebar from './Sidebar';
import ConfirmModal from '../ui/ConfirmModal';
import BugReporter from '../ui/BugReporter';
import AdminMessageModal from '../ui/AdminMessageModal';
import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';

import StudentNotifications from './StudentNotifications';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { ExerciseType } from '../../types';
import Button from '../ui/Button';
import { ChevronDown, Sparkles, Menu } from 'lucide-react';
import AssignedTasks from './AssignedTasks';
import i18n from "i18next";

type View = 'dashboard' | 'extra-practice' | 'student-today' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests' | 'admin-debugging' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests' | 'topic-database' | 'student-stats' | 'homework' | 'gmail';

import AdminPanel from '../admin/AdminPanel';
import StudentStatsScreen from './StudentStatsScreen';
import LessonHistoryScreen from './LessonHistoryScreen';
import TodayScreen from './TodayScreen';
import { isModuleVisible } from '../../config/featureFlags';
import StudentTestsScreen from '../tests/StudentTestsScreen';
import AdminStatsScreen from '../admin/AdminStatsScreen';
import FlashcardSetsScreen from '../flashcards/FlashcardSetsScreen';
import FlashcardStudyScreen from '../flashcards/FlashcardStudyScreen';
import FlashcardEditScreen from '../flashcards/FlashcardEditScreen';
import FlashcardStatsScreen from '../flashcards/FlashcardStatsScreen';
import FlashcardPresentationScreen from '../flashcards/FlashcardPresentationScreen';
import SettingsScreen from '../settings/SettingsScreen';
import TopicDatabaseScreen from '../admin/TopicDatabaseScreen';
import HomeworkScreen from './HomeworkScreen';
import AdminDebuggingScreen from '../admin/AdminDebuggingScreen';
import OnboardingOverlay from './OnboardingOverlay';
import GmailView from '../gmail/GmailView';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { sets } = useFlashcards();
  const { words, difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  
  // Nauczyciel ląduje we własnym panelu niezależnie od szerokości ekranu.
  // Wcześniej telefon rzucał go do generatora ćwiczeń, czyli do widoku
  // kursanta — obejście z czasów, gdy panel nie był responsywny. Jest.
  const [view, setView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [slogan, setSlogan] = useState('');
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  // Handle browser back button
  useEffect(() => {
    window.history.replaceState({ view, activeSetId }, '');
    
    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        if (e.state.view) setView(e.state.view);
        if (e.state.activeSetId !== undefined) setActiveSetId(e.state.activeSetId);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const handleNavigate = (newView: View, extra?: any) => {
    let newSetId = activeSetId;
    if (extra && (extra.setId || extra.activeSetId)) {
      newSetId = extra.setId || extra.activeSetId;
    } else if (newView === 'dashboard' || newView === 'flashcard-sets' || newView === 'topic-database') {
      newSetId = null;
    }

    if (extra && extra.taskId) {
      setActiveTaskId(extra.taskId);
    } else if (newView !== 'homework') {
      setActiveTaskId(null);
    }
    
    if (newView !== view || newSetId !== activeSetId) {
      window.history.pushState({ view: newView, activeSetId: newSetId, activeTaskId: extra?.taskId || null }, '');
      setView(newView);
      setActiveSetId(newSetId);
    }
  };

  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (isTeacher || !user) return;
    if (user.onboardingCompleted) return;
    try {
      if (localStorage.getItem('has_seen_onboarding') === 'true') return;
    } catch (e) {}
    setShowOnboarding(true);
  }, [user?.id, user?.onboardingCompleted, isTeacher]);



  const sloganContainerRef = useRef<HTMLDivElement>(null);
  
  // Slogan logic refactored
  useEffect(() => {
    const slogans: { text: string; color: string }[] = [];
    const colors = ['text-primary', 'text-accent-soft', 'text-content', 'text-primary', 'text-text-2'];
    
    // Hasła o passie wracają wyłącznie przez flagę `streak` — passa nie ma być
    // mechanizmem, wokół którego kręci się główny widok, ale kod zostaje na
    // miejscu i wystarczy przestawić jedną wartość w config/featureFlags.ts.
    const showStreak = isModuleVisible('streak');
    const baseSlogans: string[] = [];
    if (language === 'pl') {
      if (showStreak && user?.streakCount && user.streakCount > 2) baseSlogans.push('Niesamowita passa! Masz już ' + user.streakCount + ' dni z rzędu.');
      baseSlogans.push('Wierzę w Ciebie!');
      baseSlogans.push('Każde słowo ma znaczenie.');
      baseSlogans.push('Sukces to suma małych wysiłków.');
    } else {
      if (showStreak && user?.streakCount && user.streakCount > 2) baseSlogans.push('Amazing streak! ' + user.streakCount + ' days in a row.');
      baseSlogans.push('I believe in you!');
      baseSlogans.push('Every word matters.');
      baseSlogans.push('Success is the sum of small efforts.');
    }
    baseSlogans.forEach((text, i) => {
      slogans.push({ text, color: colors[i % colors.length] });
    });
    let currentIndex = 0;
    const animateSlogan = () => {
      if (slogans.length === 0) return;
      const currentSlogan = slogans[currentIndex];
      if (!currentSlogan) return;
      setSlogan(currentSlogan.text || '');
      
      if (sloganContainerRef.current) {
        // Apply color
        sloganContainerRef.current.className = `font-bold ${currentSlogan.color || 'text-primary'}`;
        
        try {
          gsap.fromTo(sloganContainerRef.current,
            { opacity: 0, x: 20 },
            { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }
          );
        } catch (e) {
          console.warn('GSAP animation error:', e);
        }
      }
      
      currentIndex = (currentIndex + 1) % slogans.length;
    };
    animateSlogan();
    const interval = setInterval(animateSlogan, 10000); // Change slogan every 10 seconds
    
    return () => clearInterval(interval);
  }, [language, user?.streakCount, words, difficultWords, dueWords]);

  const renderContent = () => {
    if (view === 'student-stats') {
        return <StudentStatsScreen />;
    }
    if (view === 'admin-stats') {
        return <AdminStatsScreen />;
    }
    if (view === 'lesson-history') {
      return (
        <LessonHistoryScreen 
          onStudySet={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }}
          onNavigate={(v: any, extra?: any) => {
            if (extra && (extra.setId || extra.activeSetId)) {
              setActiveSetId(extra.setId || extra.activeSetId);
            }
            setView(v as View);
          }}
        />
      );
    }
    if (view === 'tests') {
      return <StudentTestsScreen onBack={() => handleNavigate('dashboard')} />;
    }
    if (view === 'flashcard-sets') {
      return (
        <FlashcardSetsScreen 
          onStudySet={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }} 
          onEditSet={(setId) => {
            handleNavigate('flashcard-edit', { setId });
          }} 
          onStatsSet={(setId) => {
            handleNavigate('flashcard-stats', { setId });
          }} 
          onPresentSet={(setId) => {
            handleNavigate('presentation', { setId });
          }} 
          onNavigate={(v: any, extra?: any) => {
            if (extra && (extra.setId || extra.activeSetId)) {
              setActiveSetId(extra.setId || extra.activeSetId);
            }
            setView(v as View);
          }}
        />
      );
    }
    if (view === 'flashcard-study') {
      return <FlashcardStudyScreen 
        setId={activeSetId || ''} 
        initialMode={(window as any)._initialStudyMode} 
        onBack={() => handleNavigate('dashboard')} 
        onNavigate={(v: any, extra?: any) => {
          if (extra && (extra.setId || extra.activeSetId)) setActiveSetId(extra.setId || extra.activeSetId);
          if (extra && extra.initialMode) {
            (window as any)._initialStudyMode = extra.initialMode === 'match' ? 'matching' : extra.initialMode;
          }
          if (extra && extra.autoGenerate !== undefined) {
              (window as any)._autoGenerate = extra.autoGenerate;
            } else {
              delete (window as any)._autoGenerate;
            }
          setView(v as View);
        }} 
        onStartAIPractice={() => {
          setView('ai-generator');
        }}
      />;
    }
    if (view === 'flashcard-edit') {
      return (
        <FlashcardEditScreen 
          setId={activeSetId || ''} 
          onBack={() => handleNavigate('flashcard-sets')} 
          onStudy={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }} 
        />
      );
    }
    if (view === 'flashcard-stats') {
      return (
        <FlashcardStatsScreen 
          setId={activeSetId || ''} 
          onBack={() => handleNavigate('flashcard-sets')} 
        />
      );
    }
    if (view === 'presentation') {
      return (
        <FlashcardPresentationScreen 
          setId={activeSetId || ''} 
          onBack={() => handleNavigate('flashcard-sets')} 
        />
      );
    }
    if (view === 'homework') {
      return (
        <HomeworkScreen 
          initialTaskId={activeTaskId} 
          onBack={() => handleNavigate('dashboard')} 
        />
      );
    }
    if (view === 'settings') {
      return <SettingsScreen />;
    }
    if (view === 'topic-database') {
      return <TopicDatabaseScreen />;
    }
    if (view === 'admin-debugging') {
      return <AdminDebuggingScreen onBack={() => handleNavigate('dashboard')} />;
    }
    if (view === 'gmail') {
      return <GmailView />;
    }
    if (view === 'admin' || (isTeacher && view === 'dashboard')) {
      return <AdminPanel />;
    }

    // Domyślne wejście kursanta to kolejka zatwierdzonych elementów, nie
    // generator. Generator nadal istnieje i działa pod dwoma wejściami:
    // „Praktyka dodatkowa" w menu oraz `ai-generator`, którego używają
    // przyciski „Generuj zdania AI z tego zestawu" w zestawach, fiszkach
    // i historii lekcji. Gdyby `ai-generator` też trafiał tutaj, te przyciski
    // przestałyby cokolwiek robić.
    if (view !== 'extra-practice' && view !== 'ai-generator') {
      return (
        <TodayScreen
          onOpenExtraPractice={() => handleNavigate('extra-practice')}
          onOpenLastLesson={() => handleNavigate('lesson-history')}
          onStudySet={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }}
          onNavigate={(v: any, extra?: any) => {
            if (extra && (extra.setId || extra.activeSetId)) {
              setActiveSetId(extra.setId || extra.activeSetId);
            }
            setView(v as View);
          }}
        />
      );
    }

    return <AIExerciseGeneratorScreen 
      onShowOnboarding={() => setShowOnboarding(true)}
      initialSetId={activeSetId}
      autoGenerate={(window as any)._autoGenerate}
      onChangeView={(newView, extra) => {
        if (extra && (extra.setId || extra.activeSetId)) setActiveSetId(extra.setId || extra.activeSetId);
        if (extra && extra.initialMode) {
          (window as any)._initialStudyMode = extra.initialMode === 'match' ? 'matching' : extra.initialMode;
        }
        setView(newView as View);
      }}
      onStartPractice={(type, mode1, mode2) => {
        // Fallback or specific logic if needed
      }}
    />;
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView) => handleNavigate(newView)}
        onStartPractice={(exercise) => console.log('start practice', exercise)} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
        isDesktopCollapsed={isDesktopCollapsed}
        onShowOnboarding={() => setShowOnboarding(true)}
        onToggleCollapse={() => {
          setIsDesktopCollapsed(prev => {
            const next = !prev;
            try {
              localStorage.setItem('sidebar_collapsed', String(next));
            } catch (e) {}
            return next;
          });
        }}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative min-w-0">
        <StudentNotifications onNavigate={(newView) => handleNavigate(newView)} />
        {showOnboarding && <OnboardingOverlay onComplete={() => {
          setShowOnboarding(false);
          try { localStorage.setItem('has_seen_onboarding', 'true'); } catch(e) {}
          if (user?.id && !user.onboardingCompleted) {
            updateDoc(doc(db, 'users', user.id), { onboardingCompleted: true }).catch(console.error);
          }
        }} language={language} />}
        {renderContent()}
      </main>
      <AdminMessageModal />
    </div>
  );
};

export default Dashboard;

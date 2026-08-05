import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
import MobileTopMenu from './MobileTopMenu';
import AssignedTasks from './AssignedTasks';
import i18n from "i18next";

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests' | 'admin-debugging' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests' | 'topic-database' | 'student-stats' | 'homework';

import AdminPanel from '../admin/AdminPanel';
import StudentStatsScreen from './StudentStatsScreen';
import LessonHistoryScreen from './LessonHistoryScreen';
import StudentTestsScreen from '../tests/StudentTestsScreen';
import AdminStatsScreen from '../admin/AdminStatsScreen';
import FlashcardSetsScreen from '../flashcards/FlashcardSetsScreen';
import SettingsScreen from '../settings/SettingsScreen';
import TopicDatabaseScreen from '../admin/TopicDatabaseScreen';
import FlashcardStudyScreen from '../flashcards/FlashcardStudyScreen';
import HomeworkScreen from './HomeworkScreen';
import AdminDebuggingScreen from '../admin/AdminDebuggingScreen';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { sets } = useFlashcards();
  const { words, difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  
  const [view, setView] = useState<View>(() => {
    const isMobile = window.innerWidth < 768;
    if (isTeacher) {
      return isMobile ? 'ai-generator' : 'dashboard';
    } else {
      return 'dashboard';
    }
  });
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
  const [isExerciseActive, setIsExerciseActive] = useState(false);



  const sloganContainerRef = useRef<HTMLDivElement>(null);
  
  // Slogan logic refactored
  useEffect(() => {
    const slogans: { text: string; color: string }[] = [];
    const colors = ['text-primary', 'text-secondary', 'text-accent', 'text-info', 'text-success'];
    
    const baseSlogans: string[] = [];
    if (language === 'pl') {
      if (user?.streakCount && user.streakCount > 2) baseSlogans.push('Niesamowita passa! Masz już ' + user.streakCount + ' dni z rzędu.');
      baseSlogans.push('Wierzę w Ciebie!');
      baseSlogans.push('Każde słowo ma znaczenie.');
      baseSlogans.push('Sukces to suma małych wysiłków.');
    } else {
      if (user?.streakCount && user.streakCount > 2) baseSlogans.push('Amazing streak! ' + user.streakCount + ' days in a row.');
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
      return <LessonHistoryScreen />;
    }
    if (view === 'tests') {
      return <StudentTestsScreen onBack={() => setView('dashboard')} />;
    }
    if (view === 'flashcard-sets') {
      return <FlashcardSetsScreen onStudySet={() => {}} onEditSet={() => {}} onStatsSet={() => {}} onPresentSet={() => {}} />;
    }
    if (view === 'flashcard-study') {
      return <FlashcardStudyScreen setId={activeSetId || ''} initialMode={(window as any)._initialStudyMode} onBack={() => setView('dashboard')} onNavigate={(v) => setView(v as View)} />;
    }
    if (view === 'homework') {
      return <HomeworkScreen />;
    }
    if (view === 'settings') {
      return <SettingsScreen />;
    }
    if (view === 'topic-database') {
      return <TopicDatabaseScreen />;
    }
    if (view === 'admin-debugging') {
      return <AdminDebuggingScreen onBack={() => setView('dashboard')} />;
    }
    if (view === 'admin' || (isTeacher && view === 'dashboard')) {
      return <AdminPanel />;
    }
    return <AIExerciseGeneratorScreen 
      onChangeView={(newView, extra) => {
        if (extra && extra.setId) setActiveSetId(extra.setId);
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
    <div className="flex h-screen bg-base-100">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView) => setView(newView)}
        onStartPractice={(exercise) => console.log('start practice', exercise)} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
        isDesktopCollapsed={isDesktopCollapsed}
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
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
      <AdminMessageModal />
    </div>
  );
};

export default Dashboard;

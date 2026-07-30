import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Sidebar from './Sidebar';
import ConfirmModal from '../ui/ConfirmModal';
import BugReporter from '../ui/BugReporter';
import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';
import StudentStatsScreen from './StudentStatsScreen';
import StudentNotifications from './StudentNotifications';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { ExerciseType } from '../../types';
import Button from '../ui/Button';
import { ChevronDown, Sparkles } from 'lucide-react';
import NewVocabularyModal from './NewVocabularyModal';
import MobileTopMenu from './MobileTopMenu';
import i18n from "i18next";

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests' | 'admin-debugging' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests' | 'topic-database' | 'student-stats';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { sets } = useFlashcards();
  const { words, difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  
  const [view, setView] = useState<View>(() => {
    const isMobile = window.innerWidth < 768;
    const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
    if (isTeacher) {
      return isMobile ? 'ai-generator' : 'admin';
    } else {
      return 'ai-generator';
    }
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      const currentSlogan = slogans[currentIndex];
      setSlogan(currentSlogan.text);
      
      if (sloganContainerRef.current) {
        // Apply color
        sloganContainerRef.current.className = `font-bold ${currentSlogan.color}`;
        
        gsap.fromTo(sloganContainerRef.current,
          { opacity: 0, x: 50 },
          { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' }
        );
      }
      
      currentIndex = (currentIndex + 1) % slogans.length;
    };

    animateSlogan();
    const interval = setInterval(animateSlogan, 5000); // Change slogan every 5 seconds
    
    return () => clearInterval(interval);
  }, [language, user?.streakCount, words, difficultWords, dueWords]);

  const renderContent = () => {
    // Simplified renderContent for brevity, focusing on Stats removal
    if (view === 'student-stats') {
        return <StudentStatsScreen />;
    }
    return <AIExerciseGeneratorScreen />;
  };

  return (
    <div className="flex h-screen bg-base-100">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView) => setView(newView)} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="flex-1 overflow-y-auto">
        <header className="p-4 bg-base-100 border-b border-white/10 flex justify-between items-center">
          <div ref={sloganContainerRef} className="text-primary font-bold">
            {slogan}
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2">Menu</button>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;

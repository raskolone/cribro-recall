
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './Sidebar';
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
import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';
import LessonHistoryScreen from './LessonHistoryScreen';
import StudentTestsScreen from '../tests/StudentTestsScreen';
import { useAuth } from '../../context/AuthContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { ExerciseType, PracticeHistory } from '../../types';
import Button from '../ui/Button';

import FlashcardPresentationScreen from '../flashcards/FlashcardPresentationScreen';

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests';
type PracticeView = { type: 'exercise'; exercise: ExerciseType; isRevisionMode?: boolean; isSpacedRepetitionMode?: boolean } | null;

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
      <div className="text-center p-12 bg-base-200/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] mx-auto max-w-2xl mt-12">
        <h2 className="text-2xl font-bold mb-4">No Word Lists found</h2>
        <p className="text-content-muted mb-8">You need to create a Word List before practicing.</p>
        <Button onClick={onCancel}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pt-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Select a Word List to Practice</h2>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map(set => (
          <div 
            key={set.id} 
            className="p-6 bg-base-200/40 hover:bg-base-200/60 backdrop-blur-xl border border-white/10 hover:border-primary/50 cursor-pointer rounded-2xl transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
            onClick={() => onSelectSet(set.id)}
          >
            <h3 className="font-bold text-lg mb-2">{set.title}</h3>
            <p className="text-sm text-content-muted mb-4">{set.cardCount} cards</p>
            <Button className="w-full pointer-events-none" variant="secondary">Start Practice</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { sets } = useFlashcards();
  const { difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  const [view, setView] = useState<View>('dashboard');
  const [practiceView, setPracticeView] = useState<PracticeView>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const [greeting, setGreeting] = useState('');

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
  }, [user?.firstName, language]);

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
        if (isProfileMenuOpen) {
          setIsProfileMenuOpen(false);
          return;
        }
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
          setView('dashboard');
          setPracticeView(null);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [view, isProfileMenuOpen, isSidebarOpen]);

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
    setView('practice');
    setPracticeView({ type: 'exercise', exercise, isRevisionMode, isSpacedRepetitionMode });
  };

  const renderContent = () => {
    if (view === 'practice' && practiceView) {
      if (practiceView.isRevisionMode || practiceView.isSpacedRepetitionMode) {
        return <PracticeZone 
          exerciseType={practiceView.exercise} 
          isRevisionMode={practiceView.isRevisionMode} 
          isSpacedRepetitionMode={practiceView.isSpacedRepetitionMode}
          onExit={() => setView('dashboard')} 
        />;
      }
      return <PracticeSetSelector 
        onSelectSet={(setId) => {
          setActiveSetId(setId);
          setView('flashcard-study');
        }}
        onCancel={() => setView('dashboard')}
      />;
    }
    if (view === 'settings') {
      return <SettingsScreen />;
    }
    if (view === 'flashcard-sets') {
      return <FlashcardSetsScreen 
        onStudySet={(setId) => { setActiveSetId(setId); setView('flashcard-study'); setPracticeView(null); }}
        onEditSet={(setId) => { setActiveSetId(setId); setView('flashcard-edit'); }}
        onStatsSet={(setId) => { setActiveSetId(setId); setView('flashcard-stats'); }}
        onPresentSet={(setId) => { setActiveSetId(setId); setView('presentation'); }}
      />;
    }
    if (view === 'flashcard-edit' && activeSetId) {
      return <FlashcardEditScreen setId={activeSetId} onBack={() => setView('flashcard-sets')} onStudy={(setId) => { setActiveSetId(setId); setView('flashcard-study'); setPracticeView(null); }} />;
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
        onBack={() => { setView('flashcard-sets'); setPracticeView(null); }} 
        onStartAIPractice={() => {
          setView('ai-generator');
          // In the future we might want to pass the activeSetId to the AI generator
          // But for now it just navigates there
        }}
      />;
    }
    if (view === 'flashcard-stats' && activeSetId) {
      return <FlashcardStatsScreen setId={activeSetId} onBack={() => setView('flashcard-sets')} />;
    }
    if (view === 'presentation' && activeSetId) {
      return <FlashcardPresentationScreen setId={activeSetId} onBack={() => setView('flashcard-sets')} />;
    }
    if (view === 'admin' && (user?.role === 'admin' || user?.role === 'admin_student')) {
      return <AdminPanel />;
    }
    if (view === 'ai-generator') {
      return <AIExerciseGeneratorScreen initialSetId={activeSetId} onStartPractice={startPractice} />;
    }
    if (view === 'lesson-history') {
      return <LessonHistoryScreen />;
    }

    if (view === 'tests') {
      return <StudentTestsScreen onBack={() => setView('dashboard')} />;
    }
    // Default to dashboard view
    return (
      <div className="space-y-6 flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="flex-1">
          <AIExerciseGeneratorScreen onStartPractice={startPractice} />
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/10">
          <ProgressOverview />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-transparent transition-colors duration-300 overflow-hidden">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView) => {
          setView(newView)
          setPracticeView(null)
        }} 
        onStartPractice={startPractice}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-6 p-4 rounded-2xl bg-base-200/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {greeting}
            </h1>
            {user?.streakCount !== undefined && user?.streakCount > 0 && (
                <div className="flex items-center gap-1.5 ml-2 bg-black/20 px-3 py-1.5 rounded-full border border-base-300 shadow-sm" title="Your current streak">
                  <span className="text-orange-500 text-lg">🔥</span>
                  <span className="font-bold text-sm text-white">{user.streakCount}</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary/20 hover:border-primary/50 transition-colors bg-base-300 overflow-hidden"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.username || 'User'} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-primary font-mono text-lg">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
              )}
            </button>

            {isProfileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 mt-2 w-48 bg-base-200/40 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden divide-y divide-base-300">
                  <div className="px-4 py-3">
                    <p className="text-sm text-white font-medium truncate">{user?.username}</p>
                    <p className="text-xs text-content-muted truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setView('settings');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-content hover:bg-base-300 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-base-300 hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;

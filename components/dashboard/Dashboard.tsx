
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './Sidebar';
import ConfirmModal from '../ui/ConfirmModal';
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
import LearningProgressChart from './LearningProgressChart';
import { useSettings } from '../../context/SettingsContext';
import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';
import LessonHistoryScreen from './LessonHistoryScreen';
import StudentTestsScreen from '../tests/StudentTestsScreen';
import { useAuth } from '../../context/AuthContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { ExerciseType, PracticeHistory } from '../../types';
import Button from '../ui/Button';
import { ChevronDown, ChevronRight } from 'lucide-react';

import FlashcardPresentationScreen from '../flashcards/FlashcardPresentationScreen';

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests';
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
  const { user } = useAuth();
  const { sets } = useFlashcards();
  const { difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  const { showLearningProgressChart } = useSettings();
  const [view, setView] = useState<View>('dashboard');
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<string | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeView>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);

  const [greeting, setGreeting] = useState('');
  const [exerciseResetKey, setExerciseResetKey] = useState(0);
  const [isProgressCollapsed, setIsProgressCollapsed] = useState(true);
  const [isStudentViewCollapsed, setIsStudentViewCollapsed] = useState(true);
  
  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

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
                setView('dashboard');
                setPracticeView(null);
              }
            );
            return;
          }
          setIsExerciseActive(false);
          setView('dashboard');
          setPracticeView(null);
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
    if (view.startsWith('admin') && (user?.role === 'admin' || user?.role === 'admin_student')) {
      return <AdminPanel initialTab={view === 'admin' ? null : view.replace('admin-', '')} onViewChange={setView} initialSelectedUserId={adminSelectedUserId} onUserSelect={setAdminSelectedUserId} />;
    }
    if (view === 'ai-generator') {
      return <AIExerciseGeneratorScreen key={`ai-gen-${exerciseResetKey}`} initialSetId={activeSetId} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} />;
    }
    if (view === 'lesson-history') {
      return <LessonHistoryScreen />;
    }

    if (view === 'tests') {
      return <StudentTestsScreen onBack={() => setView('dashboard')} />;
    }
    // Default to dashboard view
    const isTeacher = user?.role === 'admin' || user?.role === 'admin_student';



    return (
      <div className="space-y-6 flex flex-col min-h-[calc(100vh-8rem)]">

        
        {isTeacher ? (
          <div className="space-y-6">
            <AdminPanel initialTab={null} onViewChange={setView} initialSelectedUserId={adminSelectedUserId} onUserSelect={setAdminSelectedUserId} />
            
            {user?.role === 'admin_student' && (
              <>
                <div className="flex items-center gap-4 my-10 pt-4">
                  <div className="h-px bg-white/10 flex-1"></div>
                  <div className="text-content-muted text-sm font-bold uppercase tracking-wider">{language === 'pl' ? 'Twoja strefa nauki' : 'Your Learning Zone'}</div>
                  <div className="h-px bg-white/10 flex-1"></div>
                </div>
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-base-200/20 backdrop-blur-sm mt-8">
                <button 
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                  onClick={() => setIsStudentViewCollapsed(!isStudentViewCollapsed)}
                >
                  <h2 className="text-xl font-bold">{language === 'pl' ? 'Widok kursanta' : 'Student View'}</h2>
                  {isStudentViewCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                </button>
                {!isStudentViewCollapsed && (
                  <div className="p-6 border-t border-white/10">
                    <AIExerciseGeneratorScreen key={exerciseResetKey} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} />
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1">
            <AIExerciseGeneratorScreen key={exerciseResetKey} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} />
          </div>
        )}
        
        {user?.role !== 'admin' && (
          <div className="mt-8">
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-base-200/20 backdrop-blur-sm">
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
                setView(newView);
                setPracticeView(null);
              }
            );
            return;
          }
          setIsExerciseActive(false);
          setView(newView);
          setPracticeView(null);
        }} 
        onStartPractice={startPractice}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="relative z-50 flex justify-between items-center mb-6 p-4 rounded-2xl bg-base-200/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
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

        </header>
        {renderContent()}
      </main>
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

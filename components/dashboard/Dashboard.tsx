
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './Sidebar';
import VocabularyGenerator from './VocabularyGenerator';
import WordList from './WordList';
import AISuggestions from './AISuggestions';
import ProgressOverview from './ProgressOverview';
import PracticeZone from '../practice/PracticeZone';
import SettingsScreen from '../settings/SettingsScreen';
import FlashcardSetsScreen from '../flashcards/FlashcardSetsScreen';
import FlashcardEditScreen from '../flashcards/FlashcardEditScreen';
import FlashcardStudyScreen from '../flashcards/FlashcardStudyScreen';
import FlashcardStatsScreen from '../flashcards/FlashcardStatsScreen';
import AdminPanel from '../admin/AdminPanel';
import { useAuth } from '../../context/AuthContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { ExerciseType, PracticeHistory } from '../../types';
import Button from '../ui/Button';

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin';
type PracticeView = { type: 'exercise'; exercise: ExerciseType; isRevisionMode?: boolean; isSpacedRepetitionMode?: boolean } | null;

const PracticeSetSelector = ({ onSelectSet, onCancel }: { onSelectSet: (id: string) => void, onCancel: () => void }) => {
  const { sets } = useFlashcards();
  
  if (sets.length === 0) {
    return (
      <div className="text-center p-12 bg-base-200 border border-base-300 rounded-2xl mx-auto max-w-2xl mt-12">
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
            className="p-6 bg-base-100 hover:bg-base-200 border border-base-300 hover:border-primary cursor-pointer rounded-2xl transition-all"
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
  const [view, setView] = useState<View>('dashboard');
  const [practiceView, setPracticeView] = useState<PracticeView>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

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
      />;
    }
    if (view === 'flashcard-edit' && activeSetId) {
      return <FlashcardEditScreen setId={activeSetId} onBack={() => setView('flashcard-sets')} onStudy={(setId) => { setActiveSetId(setId); setView('flashcard-study'); setPracticeView(null); }} />;
    }
    if (view === 'flashcard-study' && activeSetId) {
      const modeMapping: Record<string, 'flashcards' | 'quiz' | 'writing' | 'matching'> = {
        'flashcards': 'flashcards',
        'quiz': 'quiz',
        'fill-in-the-blank': 'writing',
        'match': 'matching'
      };
      const initialMode = practiceView ? modeMapping[practiceView.exercise] : undefined;
      
      return <FlashcardStudyScreen setId={activeSetId} initialMode={initialMode} onBack={() => { setView('flashcard-sets'); setPracticeView(null); }} />;
    }
    if (view === 'flashcard-stats' && activeSetId) {
      return <FlashcardStatsScreen setId={activeSetId} onBack={() => setView('flashcard-sets')} />;
    }
    if (view === 'admin' && user?.role === 'admin') {
      return <AdminPanel />;
    }
    // Default to dashboard view
    
    // Find the most recently assigned teacher set
    const teacherSets = sets.filter(s => s.assignedByTeacher);
    const latestTeacherSet = teacherSets.length > 0 ? teacherSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;

    return (
      <div className="space-y-6">
        {latestTeacherSet && (
          <div className="bg-base-200 border-[1.5px] border-secondary/40 p-8 rounded-lg shadow-[0_0_32px_rgba(201,168,108,0.15)] relative overflow-hidden mt-2 group hover:border-secondary/80 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-64 w-64 -mt-12 -mr-12 transform rotate-12 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
              </svg>
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary/10 rounded text-xs font-mono font-bold mb-4 border border-secondary/30 text-secondary">
                   <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                   NEW ASSIGNMENT
                </div>
                <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-3">Teacher's Task: {latestTeacherSet.title}</h2>
                <p className="text-content-muted text-lg max-w-xl">
                  Your teacher assigned a new word list. Start practicing today to master these words!
                </p>
              </div>
              <Button onClick={() => {
                setActiveSetId(latestTeacherSet.id);
                setView('flashcard-study');
              }} size="lg" className="whitespace-nowrap">
                Start Practice
              </Button>
            </div>
          </div>
        )}

        {dueWords.length >= 4 && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 p-6 rounded-2xl shadow-xl border border-green-500/20 dark:border-green-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-300">
            <div>
              <h3 className="text-lg font-bold text-green-600 dark:text-green-400">Spaced Repetition Review Due!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">You have {dueWords.length} words scheduled for review today.</p>
            </div>
            <Button onClick={() => startPractice('flashcards', false, true)} className="bg-green-600 hover:bg-green-700 border-green-600">
              Review Now
            </Button>
          </div>
        )}
        {isRevisionDue && (
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 p-6 rounded-2xl shadow-xl border border-primary/20 dark:border-primary/40 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-300">
            <div>
              <h3 className="text-lg font-bold text-primary">Time for your {frequency.toLowerCase()} revision!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">You have {difficultWords.length} difficult words waiting to be practiced.</p>
            </div>
            <Button onClick={() => startPractice('flashcards', true)}>
              Start Revision
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProgressOverview />
            <VocabularyGenerator />
            <WordList />
          </div>
          <div className="space-y-6">
            <AISuggestions />
          </div>
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
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-6">
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
              Welcome, {user?.username}! 
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
                <div className="absolute right-0 top-12 mt-2 w-48 bg-base-200 border border-base-300 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden divide-y divide-base-300">
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

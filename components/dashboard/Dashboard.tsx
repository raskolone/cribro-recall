
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
import ListenLearnScreen from '../listen/ListenLearnScreen';
import AdminPanel from '../admin/AdminPanel';
import { useAuth } from '../../context/AuthContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { ExerciseType, PracticeHistory } from '../../types';
import Button from '../ui/Button';

type View = 'dashboard' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'listen-learn' | 'admin';
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
  const { difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const [view, setView] = useState<View>('dashboard');
  const [practiceView, setPracticeView] = useState<PracticeView>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    if (view === 'listen-learn') {
      return <ListenLearnScreen />;
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
    return (
      <div className="space-y-6">
        {/* Main CTA - Kurs Audio */}
        <div className="bg-gradient-to-r from-primary to-secondary p-8 rounded-2xl shadow-2xl relative overflow-hidden text-black mt-2">
          <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-48 w-48 -mt-12 -mr-12 transform rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/10 rounded-full text-sm font-bold mb-3 border border-black/20">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse"></span>
                NAJWAŻNIEJSZE
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Twój główny Kurs audio</h2>
              <p className="text-black/80 font-medium text-lg max-w-xl">
                Ten kurs to serce aplikacji i najważniejszy filar Twojej nauki. Przejdź do niego już teraz, by zanurzyć się w języku z inteligentnym asystentem!
              </p>
            </div>
            <button 
              onClick={() => setView('listen-learn')} 
              className="bg-black text-white hover:bg-black/80 shadow-xl font-bold rounded-xl text-lg py-4 px-8 whitespace-nowrap transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              Rozpocznij naukę ▸
            </button>
          </div>
        </div>

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
          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              className="text-sm font-bold text-gray-500 hover:text-primary transition-colors"
            >
              Logout
            </button>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;

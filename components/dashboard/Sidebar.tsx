
import React, { useState } from 'react';
import { ExerciseType } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: 'dashboard' | 'settings' | 'flashcard-sets' | 'admin' | 'listen-learn') => void;
  onStartPractice: (exercise: ExerciseType) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NavLink: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ onClick, isActive, children }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-primary text-black shadow-[0_0_15px_rgba(74,222,128,0.3)]'
        : 'text-content-muted hover:bg-white/5 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onStartPractice, isOpen, onClose }) => {
  const [practiceOpen, setPracticeOpen] = useState(false);
  const { user } = useAuth();

  const handleNavigate = (view: 'dashboard' | 'settings' | 'flashcard-sets' | 'admin' | 'listen-learn') => {
    onNavigate(view);
    onClose();
  };

  const handleStartPractice = (exercise: ExerciseType) => {
    onStartPractice(exercise);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-base-100/80 backdrop-blur-md flex-shrink-0 border-r border-base-300 shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-base-300 mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v1.5M12 9.75v6.5M18.375 9a8.25 8.25 0 01-12.75 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5a4.125 4.125 0 004.125-4.125h-8.25A4.125 4.125 0 0012 16.5z" />
              </svg>
            </div>
            <span className="text-xl font-display font-bold tracking-tight">VocabBoost</span>
          </div>
          <button onClick={onClose} className="md:hidden text-content-muted hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <NavLink onClick={() => handleNavigate('dashboard')} isActive={currentView === 'dashboard'}>
              <span>Dashboard</span>
          </NavLink>
          
          <NavLink onClick={() => handleNavigate('listen-learn')} isActive={currentView === 'listen-learn'}>
              <div className="relative w-full">
                {currentView !== 'listen-learn' && (
                  <div className="absolute inset-0 rounded-lg animate-pulse z-0" style={{ boxShadow: '0 0 16px 4px rgba(74, 222, 128, 0.45)' }}></div>
                )}
                <div className={`relative z-10 w-full flex items-center justify-between rounded-lg px-3 py-1.5 transition-all ${
                  currentView === 'listen-learn' 
                    ? 'bg-black/10 text-black' 
                    : 'bg-gradient-to-r from-primary to-secondary text-black'
                }`}>
                    <span className="font-extrabold tracking-tight">Kurs audio</span>
                    <span className={`w-2 h-2 rounded-full animate-pulse ${currentView === 'listen-learn' ? 'bg-black/60' : 'bg-black'}`}></span>
                </div>
              </div>
          </NavLink>

          <NavLink onClick={() => handleNavigate('flashcard-sets')} isActive={currentView === 'flashcard-sets'}>
              <span>My Word Lists</span>
          </NavLink>
          <div>
            <button
              onClick={() => setPracticeOpen(!practiceOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-xl text-content-muted hover:bg-white/5 hover:text-white transition-colors"
            >
              <span>Practice</span>
              <svg className={`w-4 h-4 transition-transform ${practiceOpen ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"></path></svg>
            </button>
            {practiceOpen && (
              <div className="mt-2 pl-4 space-y-1 border-l border-base-300 ml-4">
                <NavLink onClick={() => handleStartPractice('flashcards')} isActive={false}><span>Flashcards</span></NavLink>
                <NavLink onClick={() => handleStartPractice('quiz')} isActive={false}><span>Quiz</span></NavLink>
                <NavLink onClick={() => handleStartPractice('fill-in-the-blank')} isActive={false}><span>Fill in the Blank</span></NavLink>
                <NavLink onClick={() => handleStartPractice('match')} isActive={false}><span>Match</span></NavLink>
              </div>
            )}
          </div>
          {user?.role === 'admin' && (
            <div className="pt-4 mt-4 border-t border-base-300">
              <NavLink onClick={() => handleNavigate('admin')} isActive={currentView === 'admin'}>
                <span className="text-secondary">Admin Panel</span>
              </NavLink>
            </div>
          )}
        </nav>
        <div className="p-4 border-t border-base-300">
          <NavLink onClick={() => handleNavigate('settings')} isActive={currentView === 'settings'}>
              <span>Settings</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

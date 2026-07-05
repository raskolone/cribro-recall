
import React, { useState } from 'react';
import { ExerciseType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: any) => void;
  onStartPractice: (exercise: ExerciseType) => void;
  isOpen: boolean;
  onClose: () => void;
  isDesktopCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

import BrandLogo from '../ui/BrandLogo';

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

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onStartPractice, isOpen, onClose, isDesktopCollapsed = false, onToggleCollapse }) => {
  const [practiceOpen, setPracticeOpen] = useState(false);
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isAdminExpanded, setIsAdminExpanded] = useState(currentView.startsWith('admin'));

  React.useEffect(() => {
    if (currentView.startsWith('admin')) setIsAdminExpanded(true);
  }, [currentView]);

  const handleNavigate = (view: any) => {
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
        className={`fixed inset-y-0 left-0 z-50 bg-base-100/40 backdrop-blur-xl border-r border-white/10 shadow-[8px_0_32px_rgba(0,0,0,0.5)] flex flex-col transform transition-all duration-300 ease-in-out md:relative flex-shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isDesktopCollapsed ? 'md:hidden md:w-0 overflow-hidden opacity-0' : 'w-64 opacity-100'}`}
        style={{
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), 8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className="p-6 flex items-center justify-between border-b border-base-300 mb-6">
          <BrandLogo className="text-xl" showTagline={false} />
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <button 
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 text-content-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Collapse sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="md:hidden text-content-muted hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <NavLink onClick={() => handleNavigate('dashboard')} isActive={currentView === 'dashboard'}>
              <span>{language === 'pl' ? 'Panel główny' : 'Dashboard'}</span>
          </NavLink>

          <NavLink onClick={() => handleNavigate('flashcard-sets')} isActive={currentView === 'flashcard-sets'}>
              <span>{language === 'pl' ? 'Słownictwo' : 'My Word Lists'}</span>
          </NavLink>

          <NavLink onClick={() => handleNavigate('lesson-history')} isActive={currentView === 'lesson-history'}>
              <span>{language === 'pl' ? 'Historia lekcji' : 'Lesson History'}</span>
          </NavLink>
          <NavLink onClick={() => handleNavigate('tests')} isActive={currentView === 'tests'}>
              <span>{language === 'pl' ? 'Testy' : 'Tests'}</span>
          </NavLink>
          
          <div className="pt-4 mt-4 border-t border-base-300">
            <NavLink onClick={() => handleNavigate('settings')} isActive={currentView === 'settings'}>
              <span>{language === 'pl' ? 'Ustawienia' : 'Settings'}</span>
            </NavLink>
          </div>
          
          {(user?.role === 'admin' || user?.role === 'admin_student') && (
            <div className="pt-4 mt-4 border-t border-base-300">
              <div className="flex flex-col">
                <div className="flex items-center group">
                  <div className="flex-1">
                    <NavLink onClick={() => { handleNavigate('admin'); setIsAdminExpanded(true); }} isActive={currentView === 'admin' || currentView.startsWith('admin-')}>
                      <div className="flex items-center justify-between w-full">
                        <span className="text-secondary">{language === 'pl' ? 'Panel nauczyciela' : 'Teacher Panel'}</span>
                      </div>
                    </NavLink>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsAdminExpanded(!isAdminExpanded); }} 
                    className="p-2 ml-1 text-content-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors absolute right-4"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isAdminExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {isAdminExpanded && (
                  <div className="pl-4 mt-1 space-y-1 overflow-hidden transition-all duration-300">
                    <NavLink onClick={() => handleNavigate('admin-stats')} isActive={currentView === 'admin-stats'}>
                      <span className="text-sm">{language === 'pl' ? 'Statystyki' : 'Statistics'}</span>
                    </NavLink>
                    <NavLink onClick={() => handleNavigate('admin-history')} isActive={currentView === 'admin-history'}>
                      <span className="text-sm">{language === 'pl' ? 'Historia' : 'History'}</span>
                    </NavLink>
                    <NavLink onClick={() => handleNavigate('admin-profile')} isActive={currentView === 'admin-profile'}>
                      <span className="text-sm">{language === 'pl' ? 'Profil kursanta' : 'Student Profile'}</span>
                    </NavLink>
                    <NavLink onClick={() => handleNavigate('admin-tests')} isActive={currentView === 'admin-tests'}>
                      <span className="text-sm">{language === 'pl' ? 'Testy' : 'Tests'}</span>
                    </NavLink>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>

      </aside>
      {/* Floating expand button when collapsed */}
      {isDesktopCollapsed && onToggleCollapse && (
        <button 
          onClick={onToggleCollapse}
          className="hidden md:flex fixed left-0 top-6 z-40 p-2 bg-base-200/60 backdrop-blur-md border border-white/10 rounded-r-xl shadow-lg hover:bg-base-200 hover:text-primary transition-colors text-content-muted"
          title="Expand sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );
};

export default Sidebar;

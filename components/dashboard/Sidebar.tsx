
import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ExerciseType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LogOut, Bug } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: any) => void;
  onStartPractice: (exercise: ExerciseType) => void;
  isOpen: boolean;
  onClose: () => void;
  isDesktopCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

import { 
  LayoutDashboard, 
  Library, 
  History, 
  ClipboardList, 
  Settings, 
  ShieldAlert, 
  BarChart2, 
  User, 
  Menu,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';

const NavLink: React.FC<{
  id?: string;
  onClick: () => void;
  isActive: boolean;
  icon?: React.ReactNode;
  isCollapsed?: boolean;
  children: React.ReactNode;
}> = ({ id, onClick, isActive, icon, isCollapsed, children }) => (
  <button id={id}
    onClick={onClick}
    title={isCollapsed ? (typeof children === 'string' ? children : undefined) : undefined}
    className={`group relative z-10 hover:z-20 w-full flex items-center ${isCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border ${isActive ? 'bg-primary/10 border-primary/20 text-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]' : 'text-content-muted border-transparent hover:bg-white/5 hover:border-white/10 hover:text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]'} active:scale-[0.98]`}
  >
    {icon && (
      <div className={`flex items-center justify-center transition-transform duration-300 ${isCollapsed ? 'mr-3 md:mr-0' : 'mr-3'} group-hover:scale-110 group-hover:text-primary ${isActive ? 'scale-110 text-primary' : ''}`}>
        {icon}
      </div>
    )}
    <span className={`transition-all duration-300 group-hover:translate-x-0.5 ${isCollapsed ? 'md:hidden' : 'block'}`}>{children}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onStartPractice, isOpen, onClose, isDesktopCollapsed = false, onToggleCollapse }) => {
  const [practiceOpen, setPracticeOpen] = useState(false);
  const { user, logout } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current && navRef.current.children && navRef.current.children.length > 0) {
      gsap.fromTo(gsap.utils.toArray(navRef.current.children), 
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, []);
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const [isAdminExpanded, setIsAdminExpanded] = useState(currentView.startsWith('admin'));
  const [newBugsCount, setNewBugsCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      const q = query(collection(db, 'bug_reports'), where('status', '==', 'new'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNewBugsCount(snapshot.size);
      });
      return () => unsubscribe();
    }
  }, [isAdmin]);

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
        className={`fixed inset-y-0 left-0 h-full w-[280px] z-50 liquid-glass-panel !rounded-none !border-0 !border-r !border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:h-screen flex-shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isDesktopCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div className={`p-4 md:p-6 flex items-center ${isDesktopCollapsed ? 'justify-between md:justify-center' : 'justify-between'} border-b border-base-300 mb-6`}>
          <div className={`${isDesktopCollapsed ? 'md:hidden' : 'block'}`}>
            <BrandLogo className="text-xl" showTagline={false} isCollapsed={false} />
          </div>
          
          <div className="flex items-center">
            {onToggleCollapse && (
              <button 
                onClick={onToggleCollapse}
                className="hidden md:flex p-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title={isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
            <button onClick={onClose} className="md:hidden p-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <NavLink id="tour-generator" icon={<LayoutDashboard size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('dashboard')} isActive={currentView === 'dashboard'}>
              {isTeacher ? (language === 'pl' ? 'Panel nauczyciela' : 'Dashboard') : (language === 'pl' ? 'Panel kursanta' : 'Practice Panel')}
          </NavLink>

          {isTeacher && (
            <NavLink icon={<Sparkles size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('ai-generator')} isActive={currentView === 'ai-generator'}>
                {language === 'pl' ? 'Panel kursanta' : 'Student View'}
            </NavLink>
          )}

          
          <NavLink id="tour-flashcards" icon={<Library size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('flashcard-sets')} isActive={currentView === 'flashcard-sets'}>
              {language === 'pl' ? 'Moje słownictwo' : 'My Word Lists'}
          </NavLink>

          <NavLink id="tour-history" icon={<History size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('lesson-history')} isActive={currentView === 'lesson-history'}>
              {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
          </NavLink>
          <NavLink icon={<ClipboardList size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('tests')} isActive={currentView === 'tests'}>
              {language === 'pl' ? 'Testy' : 'Tests'}
          </NavLink>
          
          <div className="pt-4 mt-4 border-t border-base-300">
            {isAdmin && (
            <div className="relative">
              <NavLink 
                icon={
                  <div className="relative">
                    <Bug size={20} className={newBugsCount > 0 ? "text-red-400" : ""} />
                    {newBugsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black"></span>
                      </span>
                    )}
                  </div>
                } 
                isCollapsed={isDesktopCollapsed} 
                onClick={() => handleNavigate('admin-debugging')} 
                isActive={currentView === 'admin-debugging'}
              >
                  <span className={newBugsCount > 0 ? "text-red-400 font-bold" : ""}>
                    {language === 'pl' ? 'Zgłoszone błędy' : 'Reported bugs'}
                    {newBugsCount > 0 && ` (${newBugsCount})`}
                  </span>
              </NavLink>
            </div>
          )}
<NavLink icon={<Settings size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('settings')} isActive={currentView === 'settings'}>
              {language === 'pl' ? 'Ustawienia' : 'Settings'}
            </NavLink>
            <div className={`flex ${isDesktopCollapsed ? 'md:flex-col' : 'flex-row'} gap-2`}>
              <button 
                onClick={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium border border-white/5 bg-black/20 hover:bg-black/40 text-content-muted hover:text-white group ${isDesktopCollapsed ? 'md:justify-center' : 'w-full'}`}
                title={language === 'pl' ? 'Zmień język' : 'Change language'}
              >
                <div className="text-primary font-bold">{language === 'pl' ? 'EN' : 'PL'}</div>
                <span className={`transition-all duration-300 group-hover:translate-x-0.5 ${isDesktopCollapsed ? 'md:hidden' : 'block'}`}>{language === 'pl' ? 'Język / Language' : 'Language / Język'}</span>
              </button>
              <button onClick={() => logout()} className={`group relative z-10 hover:z-20 w-full flex items-center ${isDesktopCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border border-transparent text-red-400 hover:bg-red-500/10 active:scale-[0.98]`}>
              <div className={`flex items-center justify-center transition-transform duration-300 ${isDesktopCollapsed ? 'mr-3 md:mr-0' : 'mr-3'} group-hover:scale-110`}>
                <LogOut size={20} />
              </div>
              <span className={`transition-all duration-300 group-hover:translate-x-0.5 ${isDesktopCollapsed ? 'md:hidden' : 'block'}`}>{language === 'pl' ? 'Wyloguj się' : 'Logout'}</span>
            </button>
            </div>
          </div>
        </nav>

      </aside>

    </>
  );
};

export default Sidebar;

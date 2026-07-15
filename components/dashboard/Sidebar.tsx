
import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ExerciseType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LogOut } from 'lucide-react';

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
  ChevronRight
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';

const NavLink: React.FC<{
  onClick: () => void;
  isActive: boolean;
  icon?: React.ReactNode;
  isCollapsed?: boolean;
  children: React.ReactNode;
}> = ({ onClick, isActive, icon, isCollapsed, children }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? (typeof children === 'string' ? children : undefined) : undefined}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-primary text-black shadow-[0_0_15px_rgba(74,222,128,0.3)]'
        : 'text-content-muted hover:bg-white/5 hover:text-white'
    }`}
  >
    {icon && (
      <div className={`flex items-center justify-center ${isCollapsed ? '' : 'mr-3'}`}>
        {icon}
      </div>
    )}
    {!isCollapsed && <span>{children}</span>}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onStartPractice, isOpen, onClose, isDesktopCollapsed = false, onToggleCollapse }) => {
  const [practiceOpen, setPracticeOpen] = useState(false);
  const { user, logout } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) {
      gsap.fromTo(navRef.current.children, 
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, []);
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
        } ${isDesktopCollapsed ? 'w-20' : 'w-64'}`}
        style={{
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), 8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className={`p-4 md:p-6 flex items-center ${isDesktopCollapsed ? 'justify-center' : 'justify-between'} border-b border-base-300 mb-6`}>
          {!isDesktopCollapsed && <BrandLogo className="text-xl" showTagline={false} isCollapsed={false} />}
          
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
          <NavLink icon={<LayoutDashboard size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('dashboard')} isActive={currentView === 'dashboard'}>
              {language === 'pl' ? 'Panel główny' : 'Dashboard'}
          </NavLink>

          <NavLink icon={<Library size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('flashcard-sets')} isActive={currentView === 'flashcard-sets'}>
              {language === 'pl' ? 'Słownictwo' : 'My Word Lists'}
          </NavLink>

          <NavLink icon={<History size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('lesson-history')} isActive={currentView === 'lesson-history'}>
              {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
          </NavLink>
          <NavLink icon={<ClipboardList size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('tests')} isActive={currentView === 'tests'}>
              {language === 'pl' ? 'Testy' : 'Tests'}
          </NavLink>
          
          <div className="pt-4 mt-4 border-t border-base-300">
            <NavLink icon={<Settings size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('settings')} isActive={currentView === 'settings'}>
              {language === 'pl' ? 'Ustawienia' : 'Settings'}
            </NavLink>
            <button onClick={() => logout()} className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-0' : 'px-4'} py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-red-400 hover:bg-red-500/10`}>
              <div className={`flex items-center justify-center ${isDesktopCollapsed ? '' : 'mr-3'}`}>
                <LogOut size={20} />
              </div>
              {!isDesktopCollapsed && <span>{language === 'pl' ? 'Wyloguj się' : 'Logout'}</span>}
            </button>
          </div>
          

        </nav>

      </aside>

    </>
  );
};

export default Sidebar;

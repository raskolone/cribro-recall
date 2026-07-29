import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Library, ClipboardList, Settings, MoreVertical } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

interface MobileTopMenuProps {
  currentView: string;
  onChangeView: (view: any) => void;
  isExerciseActive?: boolean;
  onConfirmEndSession?: (onEnd: () => void) => void;
}

const MobileTopMenu: React.FC<MobileTopMenuProps> = ({
  currentView,
  onChangeView,
  isExerciseActive,
  onConfirmEndSession
}) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (view: string) => {
    setIsOpen(false);
    if (isExerciseActive && onConfirmEndSession) {
      onConfirmEndSession(() => onChangeView(view));
    } else {
      onChangeView(view);
    }
  };

  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: language === 'pl' ? 'Start' : 'Home' },
    { id: 'flashcard-sets', icon: <Library size={18} />, label: language === 'pl' ? 'Fiszki' : 'Cards' },
    { id: 'tests', icon: <ClipboardList size={18} />, label: language === 'pl' ? 'Testy' : 'Tests' },
    { id: 'settings', icon: <Settings size={18} />, label: language === 'pl' ? 'Menu' : 'Menu' },
  ];

  return (
    <div className="relative md:hidden z-[100]" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 -mr-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
      >
        <MoreVertical className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-48 bg-[#0a0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2"
          >
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  currentView === item.id 
                    ? 'text-primary bg-primary/10 font-bold' 
                    : 'text-content hover:bg-white/5 hover:text-white font-medium'
                }`}
              >
                {React.cloneElement(item.icon as React.ReactElement, {
                  className: currentView === item.id ? 'text-primary' : 'text-content-muted'
                })}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileTopMenu;

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
  className?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Adjust position to keep menu within viewport
  const getAdjustedPosition = () => {
    if (!menuRef.current) return position;
    
    const rect = menuRef.current.getBoundingClientRect();
    const x = position.x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : position.x;
    const y = position.y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : position.y;
    
    return { x, y };
  };

  const adjustedPosition = isOpen && menuRef.current ? getAdjustedPosition() : position;

  return (
    <>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[1000] min-w-[180px] bg-base-100 border border-white/10 rounded-lg shadow-2xl py-1 overflow-hidden"
            style={{ 
              left: adjustedPosition.x, 
              top: adjustedPosition.y,
            }}
          >
            {items.map((item, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors ${
                  item.variant === 'danger' ? 'text-red-400 hover:text-red-300' : 'text-content hover:text-white'
                }`}
              >
                {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ContextMenu;

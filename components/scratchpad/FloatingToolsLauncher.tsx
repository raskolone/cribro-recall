import React from 'react';
import { Wrench, Sparkles } from 'lucide-react';

interface FloatingToolsLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  isTeacher: boolean;
}

export const FloatingToolsLauncher: React.FC<FloatingToolsLauncherProps> = ({
  isOpen,
  onToggle,
  isTeacher,
}) => {
  if (!isTeacher) return null;

  return (
    <button
      type="button"
      data-testid="floating-tools-launcher"
      onClick={onToggle}
      className={`fixed right-6 top-24 z-[70] px-3 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-2 font-bold text-xs transition-all duration-200 cursor-pointer select-none ${
        isOpen
          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/25 scale-105 ring-2 ring-emerald-400/40'
          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-100 border-white/15 hover:border-emerald-500/40 hover:text-emerald-300'
      }`}
      style={{
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      }}
      title="Otwórz paletę narzędzi (Tools)"
      aria-label="Otwórz paletę narzędzi"
    >
      <div className={`p-1 rounded-lg ${isOpen ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-500/20 text-emerald-400'}`}>
        <Wrench size={14} />
      </div>
      <span>Tools</span>
    </button>
  );
};

export default FloatingToolsLauncher;

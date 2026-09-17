import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, X, Lightbulb, CheckCircle2 } from 'lucide-react';
import { MODULE_GUIDES } from '../../config/moduleGuides';

interface ModuleHelpButtonProps {
  guideId: string;
}

export const ModuleHelpButton: React.FC<ModuleHelpButtonProps> = ({ guideId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const guide = MODULE_GUIDES[guideId];

  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Blokuje scroll body gdy modal jest otwarty
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!guide) return null;

  return (
    <>
      {/* ── TRIGGER BUTTON ── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Pomoc: ${guide.title}`}
        title={`Jak używać: ${guide.title}`}
        className="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-base-200 border border-line text-content-muted hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 cursor-pointer shrink-0 group"
      >
        {/* Pulsujący ring */}
        <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 opacity-0 group-hover:opacity-100 animate-ping pointer-events-none" />
        <HelpCircle size={15} />
      </button>

      {/* ── MODAL OVERLAY ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="module-help-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-base-200 border border-line-strong shadow-2xl flex flex-col">

            {/* ── NAGŁÓWEK ── */}
            <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b border-line sticky top-0 bg-base-200 rounded-t-3xl z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <HelpCircle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2
                      id="module-help-title"
                      className="text-base font-black text-text-hi tracking-tight"
                    >
                      {guide.title}
                    </h2>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold shrink-0">
                      {guide.badge}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-xl bg-base-300 hover:bg-line-strong text-content-muted hover:text-text-hi flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Zamknij"
              >
                <X size={15} />
              </button>
            </div>

            {/* ── TREŚĆ ── */}
            <div className="p-5 space-y-5">
              {/* Summary */}
              <p className="text-sm text-content leading-relaxed">
                {guide.summary}
              </p>

              {/* Kroki */}
              <div className="space-y-2.5">
                <h3 className="text-xs uppercase font-bold text-content-muted tracking-wider">
                  Jak zacząć
                </h3>
                <ol className="space-y-2.5">
                  {guide.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 p-3 rounded-2xl bg-base-100/60 border border-line hover:border-primary/30 transition-colors"
                    >
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[11px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-hi mb-0.5">{step.title}</p>
                        <p className="text-xs text-content-muted leading-relaxed">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Pro Tip */}
              {guide.proTip && (
                <div className="flex gap-3 p-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/25">
                  <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                      Wskazówka lektorska
                    </p>
                    <p className="text-xs text-content-muted leading-relaxed">{guide.proTip}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── STOPKA ── */}
            <div className="p-5 pt-3 border-t border-line sticky bottom-0 bg-base-200 rounded-b-3xl">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-2xl bg-primary hover:brightness-110 text-accent-ink font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-primary/20"
              >
                <CheckCircle2 size={16} />
                Rozumiem, zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModuleHelpButton;

import React from 'react';
import { 
  X, BookOpen, Sparkles, CheckCircle2, Layers, Award,
  Cpu, Target, HelpCircle, ArrowRight
} from 'lucide-react';
import { 
  PEDAGOGICAL_GUIDELINES, 
  OPENAI_LUNA_DISPLAY_NAME, 
  OPENAI_LUNA_MODEL_NAME 
} from '../../../services/presentationGuidelines';
import Button from '../../ui/Button';

interface AiGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDeckGenerator?: () => void;
}

export const AiGuidelinesModal: React.FC<AiGuidelinesModalProps> = ({
  isOpen,
  onClose,
  onOpenDeckGenerator
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-200 border border-primary/30 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_60px_rgba(114,240,180,0.15)] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-base-300/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/30">
              <Award size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Wytyczne Dydaktyczne & OpenAI 5.6 Luna</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
                  Standard CELTA / ESA
                </span>
              </div>
              <p className="text-xs text-content-muted">
                Zasady konstruowania interaktywnych prezentacji, modułów Practice i Enclosure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Active Model Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-base-300 to-base-300 border border-primary/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Cpu size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-primary block">
                  Domyślny Silnik Generowania
                </span>
                <span className="font-extrabold text-white text-sm md:text-base">
                  {OPENAI_LUNA_DISPLAY_NAME}
                </span>
                <p className="text-xs text-content-muted mt-0.5">
                  Identyfikator API: <code className="text-primary font-mono">{OPENAI_LUNA_MODEL_NAME}</code>
                </p>
              </div>
            </div>
            {onOpenDeckGenerator && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenDeckGenerator();
                }}
                className="shrink-0 text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles size={13} /> Generuj slajdy
              </Button>
            )}
          </div>

          {/* Guideline Sections */}
          <div className="space-y-4">
            {PEDAGOGICAL_GUIDELINES.map((sec, idx) => (
              <div 
                key={sec.id || idx}
                className="p-5 rounded-2xl bg-base-300/60 border border-white/10 space-y-3 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                    {sec.title}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white border border-white/15">
                    {sec.badge}
                  </span>
                </div>

                <p className="text-xs text-content-muted leading-relaxed">
                  {sec.description}
                </p>

                {/* Principles list */}
                <div className="space-y-1.5 pt-1">
                  {sec.keyPrinciples.map((pr, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2 text-xs text-slate-200">
                      <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
                      <span>{pr}</span>
                    </div>
                  ))}
                </div>

                {/* Example Structure */}
                {sec.exampleStructure && (
                  <div className="mt-2 p-3 rounded-xl bg-base-200/90 border border-white/5 text-[11px] font-mono text-content-muted">
                    <span className="text-primary font-bold block mb-1">📐 Wzorzec / Implementacja:</span>
                    <span className="text-slate-300">{sec.exampleStructure}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-base-300/80 flex items-center justify-between">
          <span className="text-xs text-content-muted">
            Standard dydaktyczny zgodny z profilem Cribro Recall & CELTA.
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={onClose}
          >
            Zamknij
          </Button>
        </div>
      </div>
    </div>
  );
};

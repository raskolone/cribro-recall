import React from 'react';
import { X, Clock, Target, LifeBuoy } from 'lucide-react';
import { ScenarioModule, ScenarioModuleId } from '../../types/scenario';

export const SCENARIO_MODULE_LABELS: Record<ScenarioModuleId, string> = {
  warmup_followup: 'Warm-up & follow-up',
  error_work: 'Praca nad błędami',
  main_topic: 'Główny temat',
  wrapup_feedback: 'Podsumowanie & feedback',
};

interface ScenarioModuleCardProps {
  module: ScenarioModule;
  /** Tryb podglądu (np. karta w czacie) — bez edycji punktów, tylko do odczytu. */
  readOnly?: boolean;
  onEditItem?: (itemId: string, text: string) => void;
  onRemoveItem?: (itemId: string) => void;
}

/**
 * Pojedynczy moduł scenariusza lekcji 2.0. Współdzielona między edytorem
 * (`ScenarioPreviewPanel`) i kompaktowym, tylko-do-odczytu podglądem w
 * czacie Asystenta Lektora (`TeacherAssistant`) — jedna karta, dwa tryby.
 */
export const ScenarioModuleCard: React.FC<ScenarioModuleCardProps> = ({ module: mod, readOnly, onEditItem, onRemoveItem }) => {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-base-300/50 overflow-hidden">
      <div className="p-3 bg-violet-950/20 flex items-center justify-between gap-2 border-b border-violet-500/15">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-extrabold text-violet-200">{SCENARIO_MODULE_LABELS[mod.moduleId]}</span>
          <span className="text-[11px] text-violet-300/70 flex items-center gap-1 shrink-0">
            <Clock size={12} /> {mod.durationMin} min
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-1.5 text-[11px] text-violet-200/80 italic">
          <Target size={12} className="mt-0.5 shrink-0 text-violet-400" />
          <span>{mod.objective}</span>
        </div>
        <ul className="space-y-1.5">
          {mod.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              {readOnly ? (
                <span className="flex-1 text-xs text-content px-2.5 py-1.5">{item.text}</span>
              ) : (
                <>
                  <input
                    value={item.text}
                    onChange={(e) => onEditItem?.(item.id, e.target.value)}
                    className="flex-1 text-xs bg-base-300/70 border border-white/10 rounded-lg px-2.5 py-1.5 text-content focus:outline-none focus:border-violet-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.id)}
                    className="shrink-0 p-1.5 rounded-lg text-content-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label="Usuń punkt"
                  >
                    <X size={13} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {mod.moduleId === 'main_topic' && mod.teacherNotes && mod.teacherNotes.length > 0 && (
          <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 mb-1.5">
              <LifeBuoy size={12} /> Wskazówki ratunkowe (dla lektora)
            </div>
            <ul className="space-y-1 list-disc list-inside">
              {mod.teacherNotes.map((note, idx) => (
                <li key={idx} className="text-[11px] text-amber-100/80">{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioModuleCard;

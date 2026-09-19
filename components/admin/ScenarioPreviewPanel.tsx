import React, { useState } from 'react';
import { Sparkles, X, Wand2, Save, Trash2, AlertTriangle, Clock, Target, LifeBuoy } from 'lucide-react';
import { useScenarioGenerator } from '../../hooks/useScenarioGenerator';
import { ScenarioDurationMin, ScenarioModuleId } from '../../types/scenario';
import Button from '../ui/Button';

const MODULE_LABELS: Record<ScenarioModuleId, string> = {
  warmup_followup: 'Warm-up & follow-up',
  error_work: 'Praca nad błędami',
  main_topic: 'Główny temat',
  wrapup_feedback: 'Podsumowanie & feedback',
};

const DURATION_OPTIONS: ScenarioDurationMin[] = [45, 60, 90];

interface ScenarioPreviewPanelProps {
  studentId: string;
  targetLessonId: string;
}

export const ScenarioPreviewPanel: React.FC<ScenarioPreviewPanelProps> = ({ studentId, targetLessonId }) => {
  const [durationMin, setDurationMin] = useState<ScenarioDurationMin>(60);
  const { state, draft, error, generate, editItem, removeItem, discard, save } = useScenarioGenerator(studentId, targetLessonId);

  const isGenerating = state === 'generating';
  const isSaving = state === 'saving';
  const hasDraft = state === 'draft' || state === 'saving' || state === 'saved';

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-950/15 overflow-hidden shadow-sm">
      <div className="p-3.5 bg-gradient-to-r from-violet-900/40 via-violet-950/30 to-transparent flex items-center justify-between gap-3 border-b border-violet-500/15">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Wand2 size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Scenariusz 2.0
              </span>
              <h4 className="font-extrabold text-sm text-white">Generator scenariusza lekcji</h4>
            </div>
            <p className="text-[11px] text-violet-200/70">AI proponuje przebieg kolejnej lekcji na podstawie profilu i historii kursanta</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!hasDraft && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-200/80">Długość lekcji:</span>
              <div className="flex rounded-full border border-violet-500/30 overflow-hidden">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDurationMin(opt)}
                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                      durationMin === opt
                        ? 'bg-violet-500/30 text-violet-100'
                        : 'text-violet-300/70 hover:bg-violet-500/10'
                    }`}
                  >
                    {opt} min
                  </button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              isLoading={isGenerating}
              onClick={() => generate(durationMin)}
              className="shrink-0 flex items-center gap-1.5 font-bold text-xs"
            >
              <Sparkles size={14} /> Generuj scenariusz lekcji 2.0
            </Button>
          </div>
        )}

        {state === 'error' && error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {draft && (
          <div className="space-y-3">
            {draft.mode === 'cold_start' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                <span>Scenariusz diagnostyczny — brak historii lekcji tego kursanta.</span>
              </div>
            )}

            {draft.modules.map((mod) => (
              <div key={mod.moduleId} className="rounded-xl border border-violet-500/20 bg-base-300/50 overflow-hidden">
                <div className="p-3 bg-violet-950/20 flex items-center justify-between gap-2 border-b border-violet-500/15">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-extrabold text-violet-200">{MODULE_LABELS[mod.moduleId]}</span>
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
                        <input
                          value={item.text}
                          onChange={(e) => editItem(mod.moduleId, item.id, e.target.value)}
                          className="flex-1 text-xs bg-base-300/70 border border-white/10 rounded-lg px-2.5 py-1.5 text-content focus:outline-none focus:border-violet-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(mod.moduleId, item.id)}
                          className="shrink-0 p-1.5 rounded-lg text-content-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          aria-label="Usuń punkt"
                        >
                          <X size={13} />
                        </button>
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
            ))}

            {state === 'error' && error && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {state === 'saved' ? (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary font-bold text-center">
                ✓ Scenariusz zapisany do lekcji.
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={discard} className="flex items-center gap-1.5 text-xs">
                  <Trash2 size={13} /> Odrzuć draft
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isSaving}
                  onClick={save}
                  className="flex items-center gap-1.5 font-bold text-xs"
                >
                  <Save size={13} /> Zapisz scenariusz do lekcji
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioPreviewPanel;

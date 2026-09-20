import React, { useState } from 'react';
import { Sparkles, LayoutGrid, Save, Trash2, AlertTriangle, RefreshCw, Target } from 'lucide-react';
import { useScenarioCanvas } from '../../hooks/useScenarioCanvas';
import { ScenarioDurationMin } from '../../types/scenario';
import { ScenarioCanvasBlockCard } from './ScenarioCanvasBlockCard';
import Button from '../ui/Button';

const DURATION_OPTIONS: ScenarioDurationMin[] = [45, 60, 90];

interface ScenarioCanvasPanelProps {
  studentId: string;
  targetLessonId: string;
}

/**
 * Kreator Scenariuszy i Interaktywny Canvas (MVP) — lekki, bez DnD.
 * Obok istniejącego `ScenarioPreviewPanel` (v1); nic tu nie nadpisuje
 * kontraktu `plannedScenario`.
 */
export const ScenarioCanvasPanel: React.FC<ScenarioCanvasPanelProps> = ({ studentId, targetLessonId }) => {
  const [durationMin, setDurationMin] = useState<ScenarioDurationMin>(60);
  const { state, canvas, error, hasRejectedItems, generate, setItemReview, setRejectionReason, discard, save, refresh } =
    useScenarioCanvas(studentId, targetLessonId);

  const isGenerating = state === 'generating';
  const isSaving = state === 'saving';
  const isRefreshing = state === 'refreshing';
  const hasDraft = !!canvas;

  const lessonGoalBlock = canvas?.blocks.find((b) => b.blockId === 'lesson_goal');
  const otherBlocks = canvas?.blocks.filter((b) => b.blockId !== 'lesson_goal') || [];

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-950/15 overflow-hidden shadow-sm">
      <div className="p-3.5 bg-gradient-to-r from-violet-900/40 via-violet-950/30 to-transparent flex items-center justify-between gap-3 border-b border-violet-500/15">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center justify-center shrink-0">
            <LayoutGrid size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Canvas
              </span>
              <h4 className="font-extrabold text-sm text-white">Kreator Scenariuszy — Canvas</h4>
            </div>
            <p className="text-[11px] text-violet-200/70">9 bloków lekcji do przejrzenia, zaakceptowania i selektywnego odświeżenia</p>
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
                      durationMin === opt ? 'bg-violet-500/30 text-violet-100' : 'text-violet-300/70 hover:bg-violet-500/10'
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
              <Sparkles size={14} /> Generuj Canvas
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {canvas && (
          <div className="space-y-3">
            {canvas.mode === 'cold_start' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                <span>Canvas diagnostyczny — brak historii lekcji tego kursanta.</span>
              </div>
            )}

            {lessonGoalBlock && !lessonGoalBlock.skipped && lessonGoalBlock.items[0] && (
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-2.5">
                <Target size={16} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary/80 mb-0.5">Cel lekcji</div>
                  <p className="text-sm text-content font-medium">{lessonGoalBlock.items[0].text}</p>
                </div>
              </div>
            )}

            {otherBlocks.map((block) => (
              <ScenarioCanvasBlockCard
                key={block.blockId}
                block={block}
                onAcceptItem={(itemId) => setItemReview(block.blockId, itemId, 'accepted')}
                onRejectItem={(itemId) => setItemReview(block.blockId, itemId, 'rejected')}
                onReasonChange={(itemId, reason) => setRejectionReason(itemId, reason)}
              />
            ))}

            {state === 'saved' ? (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary font-bold text-center">
                ✓ Canvas zapisany do lekcji.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!hasRejectedItems || isRefreshing}
                  isLoading={isRefreshing}
                  onClick={refresh}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw size={13} /> Lesson Refresh {hasRejectedItems ? `(${otherBlocks.flatMap((b) => b.items).filter((it) => it.review.state === 'rejected').length})` : ''}
                </Button>
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
                  <Save size={13} /> Zapisz Canvas do lekcji
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioCanvasPanel;

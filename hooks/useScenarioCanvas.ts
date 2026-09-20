import { useCallback, useState } from 'react';
import { generateScenarioCanvas, refreshScenarioCanvas, saveScenarioCanvas } from '../services/scenarioCanvasClient';
import { ScenarioDurationMin } from '../types/scenario';
import { CanvasBlockId, CanvasReviewState, LessonRefreshTeacherNote, ScenarioCanvasV2 } from '../types/scenarioCanvas';

export type ScenarioCanvasState = 'idle' | 'generating' | 'draft' | 'saving' | 'saved' | 'refreshing' | 'error';

function randomMutationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `mut-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useScenarioCanvas(studentId: string, targetLessonId: string) {
  const [state, setState] = useState<ScenarioCanvasState>('idle');
  const [canvas, setCanvas] = useState<ScenarioCanvasV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teacherNotesDraft, setTeacherNotesDraft] = useState<Record<string, string>>({});

  const generate = useCallback(async (durationMin: ScenarioDurationMin) => {
    setState('generating');
    setError(null);
    try {
      const result = await generateScenarioCanvas(studentId, durationMin);
      setCanvas(result);
      setTeacherNotesDraft({});
      setState('draft');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się wygenerować canvasu.');
      setState('error');
    }
  }, [studentId]);

  const setItemReview = useCallback((blockId: CanvasBlockId, itemId: string, reviewState: CanvasReviewState) => {
    setCanvas((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((block) => (
          block.blockId !== blockId
            ? block
            : {
              ...block,
              items: block.items.map((item) => (
                item.itemId !== itemId
                  ? item
                  : { ...item, review: { state: reviewState, rejectionReason: reviewState === 'rejected' ? item.review.rejectionReason : null } }
              )),
            }
        )),
      };
    });
  }, []);

  const setRejectionReason = useCallback((itemId: string, reason: string) => {
    setTeacherNotesDraft((prev) => ({ ...prev, [itemId]: reason }));
    setCanvas((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((block) => ({
          ...block,
          items: block.items.map((item) => (
            item.itemId !== itemId ? item : { ...item, review: { ...item.review, rejectionReason: reason } }
          )),
        })),
      };
    });
  }, []);

  const discard = useCallback(() => {
    setCanvas(null);
    setTeacherNotesDraft({});
    setError(null);
    setState('idle');
  }, []);

  const save = useCallback(async () => {
    if (!canvas) return;
    setState('saving');
    setError(null);
    try {
      await saveScenarioCanvas(studentId, targetLessonId, canvas);
      setState('saved');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać canvasu.');
      setState('error');
    }
  }, [canvas, studentId, targetLessonId]);

  const hasRejectedItems = !!canvas && canvas.blocks.some((b) => b.items.some((it) => it.review.state === 'rejected'));

  const refresh = useCallback(async () => {
    if (!canvas || !hasRejectedItems) return;
    setState('refreshing');
    setError(null);
    try {
      const teacherNotes: LessonRefreshTeacherNote[] = canvas.blocks
        .flatMap((b) => b.items)
        .filter((it) => it.review.state === 'rejected')
        .map((it) => ({ itemId: it.itemId, note: teacherNotesDraft[it.itemId] || it.review.rejectionReason || '' }));

      const refreshed = await refreshScenarioCanvas({
        studentId,
        targetLessonId,
        scenarioId: canvas.canvasId,
        expectedRevision: canvas.revision,
        mutationId: randomMutationId(),
        teacherNotes,
      });
      setCanvas(refreshed);
      setTeacherNotesDraft({});
      setState('draft');
    } catch (err: any) {
      if (err?.status === 409 && err?.canvas) {
        setCanvas(err.canvas);
      }
      setError(err?.message || 'Nie udało się odświeżyć canvasu.');
      setState('error');
    }
  }, [canvas, hasRejectedItems, studentId, targetLessonId, teacherNotesDraft]);

  return {
    state,
    canvas,
    error,
    hasRejectedItems,
    generate,
    setItemReview,
    setRejectionReason,
    discard,
    save,
    refresh,
  };
}

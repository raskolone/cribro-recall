import { useCallback, useState } from 'react';
import { generateScenario, saveScenario } from '../services/scenarioClient';
import { LessonScenario, ScenarioDurationMin } from '../types/scenario';

export type ScenarioGeneratorState = 'idle' | 'generating' | 'draft' | 'saving' | 'saved' | 'error';

export function useScenarioGenerator(studentId: string, targetLessonId: string) {
  const [state, setState] = useState<ScenarioGeneratorState>('idle');
  const [draft, setDraft] = useState<LessonScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (durationMin: ScenarioDurationMin) => {
    setState('generating');
    setError(null);
    try {
      const scenario = await generateScenario(studentId, durationMin);
      setDraft(scenario);
      setState('draft');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się wygenerować scenariusza.');
      setState('error');
    }
  }, [studentId]);

  const editItem = useCallback((moduleId: string, itemId: string, text: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map((mod) => (
          mod.moduleId !== moduleId
            ? mod
            : {
              ...mod,
              items: mod.items.map((item) => (
                item.id !== itemId ? item : { ...item, text, editedByTeacher: true }
              )),
            }
        )),
      };
    });
  }, []);

  const removeItem = useCallback((moduleId: string, itemId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map((mod) => (
          mod.moduleId !== moduleId
            ? mod
            : { ...mod, items: mod.items.filter((item) => item.id !== itemId) }
        )),
      };
    });
  }, []);

  const discard = useCallback(() => {
    setDraft(null);
    setError(null);
    setState('idle');
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setState('saving');
    setError(null);
    try {
      await saveScenario(studentId, targetLessonId, draft);
      setState('saved');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać scenariusza.');
      setState('error');
    }
  }, [draft, studentId, targetLessonId]);

  return {
    state,
    draft,
    error,
    generate,
    editItem,
    removeItem,
    discard,
    save,
  };
}

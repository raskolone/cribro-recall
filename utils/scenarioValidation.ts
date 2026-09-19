import {
  LessonScenario,
  ScenarioDurationMin,
  ScenarioMode,
  ScenarioModelOutput,
  SCENARIO_DURATION_BUDGETS,
  SCENARIO_MODULE_IDS,
  ScenarioModule,
} from '../types/scenario';

/**
 * Waliduje odpowiedź modelu przed nadaniem czasów/ID: dokładnie 4 moduły,
 * w stałej kolejności `SCENARIO_MODULE_IDS`, 1-6 niepustych punktów każdy.
 * Rzuca błąd z czytelnym opisem, jeśli model odbiegł od kontraktu.
 */
export function validateScenarioModelOutput(parsed: ScenarioModelOutput | null | undefined): void {
  if (!parsed || !Array.isArray(parsed.modules) || parsed.modules.length !== 4) {
    throw new Error('Model zwrócił nieprawidłową liczbę modułów scenariusza.');
  }

  for (let i = 0; i < SCENARIO_MODULE_IDS.length; i++) {
    const expectedId = SCENARIO_MODULE_IDS[i];
    const mod = parsed.modules[i];
    if (!mod || mod.moduleId !== expectedId) {
      throw new Error(`Nieprawidłowa kolejność lub identyfikator modułu na pozycji ${i}: oczekiwano "${expectedId}".`);
    }
    if (!mod.objective || !String(mod.objective).trim()) {
      throw new Error(`Moduł "${expectedId}" nie ma celu (objective).`);
    }
    if (!Array.isArray(mod.items) || mod.items.length < 1 || mod.items.length > 6) {
      throw new Error(`Moduł "${expectedId}" musi mieć od 1 do 6 punktów.`);
    }
    for (const item of mod.items) {
      if (!item?.text || !String(item.text).trim()) {
        throw new Error(`Moduł "${expectedId}" zawiera pusty punkt.`);
      }
    }

    if (expectedId === 'main_topic') {
      if (!Array.isArray(mod.teacherNotes) || mod.teacherNotes.length < 1) {
        throw new Error('Moduł "main_topic" musi mieć co najmniej jedną wskazówkę ratunkową (teacherNotes).');
      }
      for (const note of mod.teacherNotes) {
        if (!note || !String(note).trim()) {
          throw new Error('Moduł "main_topic" zawiera pustą wskazówkę ratunkową (teacherNotes).');
        }
      }
    } else if (mod.teacherNotes !== undefined && !Array.isArray(mod.teacherNotes)) {
      throw new Error(`Moduł "${expectedId}" ma nieprawidłowy format teacherNotes.`);
    }
  }
}

/**
 * Wzbogaca zwalidowaną odpowiedź modelu o czasy trwania (z budżetu stałego
 * dla wybranej długości lekcji) i identyfikatory — model nigdy ich nie zwraca.
 */
export function buildLessonScenario(
  parsed: ScenarioModelOutput,
  opts: { studentId: string; durationMin: ScenarioDurationMin; mode: ScenarioMode; generatedAt: string },
  makeId: () => string
): LessonScenario {
  const budgets = SCENARIO_DURATION_BUDGETS[opts.durationMin];
  const modules: ScenarioModule[] = parsed.modules.map((mod) => ({
    moduleId: mod.moduleId,
    objective: mod.objective.trim(),
    durationMin: budgets[mod.moduleId],
    items: mod.items.map((item) => ({
      id: makeId(),
      text: item.text.trim(),
    })),
    ...(mod.teacherNotes ? { teacherNotes: mod.teacherNotes.map((note) => note.trim()) } : {}),
  }));

  return {
    id: makeId(),
    studentId: opts.studentId,
    durationMin: opts.durationMin,
    mode: opts.mode,
    modules,
    generatedAt: opts.generatedAt,
  };
}

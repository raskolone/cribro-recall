/**
 * Pipeline generowania — spina serwisy w jedną pętlę.
 *
 * Trzymany osobno od `endpoints.ts`, żeby dał się przetestować bez Firebase,
 * bez sieci i bez klucza: cały kontakt ze światem to `ModelCall` i gotowy
 * `AssembledContext`, oba wstrzykiwane.
 */

import { AssembledContext } from './contextAssembler';
import { ExerciseContractV2 } from './contracts';
import {
  DraftExercise,
  finalizeContract,
  generateExercises,
  regenerateDraft,
} from './exerciseGenerator';
import { ExercisePlan, PlannedSlot, planExercises } from './exercisePlanner';
import { ModelCall } from './openai';
import { validateAll } from './qualityValidator';

export interface BuildSetInput {
  context: AssembledContext;
  plan: ExercisePlan;
  call: ModelCall;
  teacherId: string;
  studentId?: string;
  groupId?: string;
}

export interface BuildSetResult {
  exercises: ExerciseContractV2[];
  /** Ostrzeżenia plannera plus to, co wyszło w trakcie budowania. */
  warnings: string[];
  /** Ile zadań wymaga decyzji lektora, bo nie przeszły walidacji. */
  needsReviewCount: number;
  modelUsed: string;
}

/**
 * Buduje gotowy zestaw: generuje, waliduje, regeneruje i domyka kontrakty.
 *
 * Zadania, które nie przeszły walidacji po dwóch regeneracjach, **zostają**
 * w wyniku — oznaczone `requiresTeacherReview`. Nie wypadają po cichu, bo
 * lektor musi zobaczyć, że zamówił osiem zadań, a silnik ma pewność co do
 * sześciu. Odsianie ich tutaj dałoby ekran podglądu, który kłamie.
 */
export const buildExerciseSet = async (input: BuildSetInput): Promise<BuildSetResult> => {
  const warnings = [...input.plan.warnings];

  const generated = await generateExercises({
    context: input.context,
    slots: input.plan.slots,
    call: input.call,
  });

  if (generated.drafts.length === 0) {
    throw new Error('Model nie zwrócił ani jednego poprawnego zadania.');
  }

  if (generated.missingSlots > 0) {
    warnings.push(
      `Zamówiono ${input.plan.slots.length} zadań, a model zwrócił ${generated.drafts.length}. ` +
        'Brakujące pozycje zostały pominięte.'
    );
  }

  const validated = await validateAll({
    context: input.context,
    drafts: generated.drafts,
    call: input.call,
    regenerate: (draft: DraftExercise, failedChecks: string[]) =>
      regenerateDraft({ context: input.context, draft, failedChecks, call: input.call }),
  });

  const exercises = validated.map((item, index) => {
    const slot: PlannedSlot = input.plan.slots[index] || input.plan.slots[0];
    return finalizeContract({
      draft: item.draft,
      slot,
      context: input.context,
      teacherId: input.teacherId,
      studentId: input.studentId,
      groupId: input.groupId,
      modelVersion: generated.modelUsed,
      validation: item.validation,
      requiresTeacherReview: item.requiresTeacherReview,
    });
  });

  const needsReviewCount = exercises.filter((e) => e.requiresTeacherReview).length;

  if (needsReviewCount > 0) {
    warnings.push(
      `${needsReviewCount} z ${exercises.length} zadań nie przeszło kontroli jakości ` +
        'i wymaga Twojej decyzji przed wysłaniem.'
    );
  }

  return { exercises, warnings, needsReviewCount, modelUsed: generated.modelUsed };
};

export { planExercises };

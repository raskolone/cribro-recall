/**
 * ExercisePlanner — jakie typy, w jakiej proporcji, na jakie cele.
 *
 * Planner jest deterministyczny i nie pyta modelu. To celowe: rozkład typów
 * wynika z tego, co lektor wybrał i ile jest materiału, a nie z opinii AI.
 * Jedno wywołanie modelu mniej na zestaw, jeden powód awarii mniej, a lektor
 * dostaje rozkład, który da się przewidzieć bez odpalania generatora.
 *
 * Trudność ustala się TU, przy generowaniu — nigdy w środku zestawu.
 * Zestaw po wysłaniu jest stały (§18).
 */

import { AssembledContext } from './contextAssembler';
import { ExerciseTypeV2, EXERCISE_TYPES_V2 } from './contracts';

export interface PlanInput {
  context: AssembledContext;
  /** Typy wybrane przez lektora. Puste = wszystkie trzy. */
  requestedTypes?: ExerciseTypeV2[];
  /** Liczba zadań ustawiona ręcznie przez lektora. */
  itemCount: number;
  /** Planowany czas w minutach, ustawiony ręcznie przez lektora. */
  plannedMinutes?: number;
}

export interface PlannedSlot {
  exerciseType: ExerciseTypeV2;
  /** 1–5. */
  difficulty: number;
}

export interface ExercisePlan {
  slots: PlannedSlot[];
  /**
   * Ostrzeżenia dla lektora.
   *
   * Silnik OSTRZEGA przy niespójności i nigdy nie zmienia parametrów sam
   * (§3.1). Lektor ustawia czas i liczbę zadań ręcznie i ma prawo do
   * decyzji, która silnikowi się nie podoba.
   */
  warnings: string[];
}

/** Ile minut zajmuje jedno zadanie danego typu — do sprawdzenia spójności. */
const MINUTES_PER_TYPE: Readonly<Record<ExerciseTypeV2, number>> = {
  micro_translation: 3,
  fix_sentence: 2,
  gap_from_context: 1.5,
};

/** Poziom CEFR → bazowa trudność 1–5. */
const difficultyForCefr = (cefr: string): number => {
  const level = String(cefr || '').trim().toUpperCase();
  if (level.startsWith('A1')) return 1;
  if (level.startsWith('A2')) return 2;
  if (level.startsWith('B1')) return 3;
  if (level.startsWith('B2')) return 4;
  if (level.startsWith('C')) return 5;
  return 3;
};

/**
 * Układa listę slotów.
 *
 * Rozkład jest równomierny i cykliczny, a nie losowy: kursant dostaje typy
 * na przemian, więc zestaw nie zamienia się w blok dziesięciu tłumaczeń pod
 * rząd. Przy tym kolejność jest powtarzalna, co ratuje testy i pozwala
 * lektorowi wiedzieć, czego się spodziewać.
 */
export const planExercises = (input: PlanInput): ExercisePlan => {
  const warnings: string[] = [];

  const types =
    input.requestedTypes && input.requestedTypes.length > 0
      ? input.requestedTypes.filter((t) => EXERCISE_TYPES_V2.includes(t))
      : [...EXERCISE_TYPES_V2];

  if (types.length === 0) {
    throw new Error('Nie wybrano żadnego typu zadania objętego silnikiem v2.');
  }

  const itemCount = Math.max(1, Math.floor(input.itemCount));
  const baseDifficulty = difficultyForCefr(input.context.student.cefr);

  const slots: PlannedSlot[] = Array.from({ length: itemCount }, (_, index) => ({
    exerciseType: types[index % types.length],
    difficulty: baseDifficulty,
  }));

  // --- ostrzeżenia o niespójności -----------------------------------------

  const estimatedMinutes = slots.reduce((sum, slot) => sum + MINUTES_PER_TYPE[slot.exerciseType], 0);

  if (input.plannedMinutes && input.plannedMinutes > 0) {
    const ratio = estimatedMinutes / input.plannedMinutes;
    if (ratio > 1.5) {
      warnings.push(
        `${itemCount} zadań to około ${Math.round(estimatedMinutes)} min pracy, a zaplanowano ${input.plannedMinutes} min. ` +
          'Kursant prawdopodobnie nie skończy w założonym czasie.'
      );
    } else if (ratio < 0.5) {
      warnings.push(
        `${itemCount} zadań to około ${Math.round(estimatedMinutes)} min pracy przy zaplanowanych ${input.plannedMinutes} min. ` +
          'Zestaw może być za krótki na tę lekcję.'
      );
    }
  }

  // Materiał musi wystarczyć na liczbę zadań — inaczej generator zacznie
  // powtarzać to samo słowo w kółko albo wymyślać cele spoza lekcji.
  const vocabularyLines = input.context.lessons.reduce(
    (sum, lesson) => sum + lesson.vocabulary.split('\n').filter((l) => l.trim()).length,
    0
  );
  const correctionLines = input.context.lessons.reduce(
    (sum, lesson) => sum + lesson.corrections.split('\n').filter((l) => l.trim()).length,
    0
  );
  const availableMaterial = vocabularyLines + correctionLines;

  if (availableMaterial > 0 && itemCount > availableMaterial) {
    warnings.push(
      `Zamówiono ${itemCount} zadań, a w wybranych lekcjach jest ${availableMaterial} pozycji materiału. ` +
        'Część zadań będzie powtarzać ten sam cel.'
    );
  }

  if (types.includes('fix_sentence') && correctionLines === 0) {
    warnings.push(
      'Wybrano „Napraw zdanie", ale w lekcjach nie ma bloku korekt. ' +
        'Błędy powstaną z typowych pomyłek na tym poziomie, a nie z realnych pomyłek kursanta.'
    );
  }

  return { slots, warnings };
};

/** Ile zadań danego typu jest w planie — do podglądu lektora. */
export const summarizePlan = (plan: ExercisePlan): Record<string, number> =>
  plan.slots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.exerciseType] = (acc[slot.exerciseType] || 0) + 1;
    return acc;
  }, {});

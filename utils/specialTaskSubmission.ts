/**
 * Czy ukończenie ćwiczenia w generatorze zdań ma oznaczyć zadanie lektora jako oddane.
 *
 * Generator ma dwa tryby:
 *  - domyślny (lektor, skróty historyczne): źródłem może być zadanie lektora `special-task-<id>`
 *    i wtedy ukończenie ustawia `specialTasks/<id>.status = 'submitted'`;
 *  - `free` („Ćwiczenia dowolne"): NIGDY — niezależnie od `setId`. Ćwiczenia dowolne nie zmieniają
 *    statusu żadnej pracy domowej ani zadania lektora.
 *
 * Jedna funkcja używana w obu miejscach zapisu (patrz test strukturalny `freeModeHomework.test.ts`).
 */
export type GeneratorMode = 'free' | 'default';

export const SPECIAL_TASK_PREFIX = 'special-task-';

/** `id` zadania lektora z `selectedSetId`, albo `null`, gdy to nie zadanie lektora. */
export function specialTaskIdFrom(setId: string | null | undefined): string | null {
  if (!setId || !setId.startsWith(SPECIAL_TASK_PREFIX)) return null;
  const id = setId.slice(SPECIAL_TASK_PREFIX.length);
  return id.length > 0 ? id : null;
}

/** Czy oznaczyć zadanie lektora jako oddane (tryb `free`: nigdy). `id` zadania daje `specialTaskIdFrom`. */
export function shouldMarkTaskSubmitted(mode: GeneratorMode | undefined, setId: string | null | undefined): boolean {
  if (mode === 'free') return false;
  return specialTaskIdFrom(setId) !== null;
}

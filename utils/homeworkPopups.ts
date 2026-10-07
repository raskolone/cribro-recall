import { SpecialTask } from '../types';
import { isStudentTodoStatus } from './homework';

/**
 * Zwraca listę zadań, które powinny wyświetlić się w pop-upie nowej pracy domowej.
 * Zadanie trafia do pop-upu, jeśli jego status to "do zrobienia" (pending/assigned)
 * i jego ID nie znajduje się jeszcze w zbiorze zadań, dla których pop-up już pokazano.
 */
export const getHomeworkTasksForPopup = (
  tasks: SpecialTask[],
  shownIds: Set<string>
): SpecialTask[] => {
  if (!tasks || !Array.isArray(tasks)) return [];
  
  return tasks.filter((task) => {
    if (!task || !task.id) return false;
    const isPending = isStudentTodoStatus(task.status);
    const isAlreadyShown = shownIds.has(task.id);
    return isPending && !isAlreadyShown;
  });
};

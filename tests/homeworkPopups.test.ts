import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getHomeworkTasksForPopup } from '../utils/homeworkPopups';
import { SpecialTask } from '../types';

describe('getHomeworkTasksForPopup', () => {
  it('zwraca nowe zadanie w stanie assigned (nie pokazane wcześniej)', () => {
    const tasks = [
      { id: 't1', status: 'assigned' } as SpecialTask,
    ];
    const shownIds = new Set<string>();
    const result = getHomeworkTasksForPopup(tasks, shownIds);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 't1');
  });

  it('zwraca nowe zadanie w stanie pending (nie pokazane wcześniej)', () => {
    const tasks = [
      { id: 't2', status: 'pending' } as SpecialTask,
    ];
    const shownIds = new Set<string>();
    const result = getHomeworkTasksForPopup(tasks, shownIds);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 't2');
  });

  it('nie zwraca zadania w stanie submitted ani graded', () => {
    const tasks = [
      { id: 't3', status: 'submitted' } as SpecialTask,
      { id: 't4', status: 'graded' } as SpecialTask,
    ];
    const shownIds = new Set<string>();
    const result = getHomeworkTasksForPopup(tasks, shownIds);
    assert.strictEqual(result.length, 0);
  });

  it('nie zwraca zadania, które było już pokazane', () => {
    const tasks = [
      { id: 't5', status: 'pending' } as SpecialTask,
    ];
    const shownIds = new Set<string>(['t5']);
    const result = getHomeworkTasksForPopup(tasks, shownIds);
    assert.strictEqual(result.length, 0);
  });

  it('zwraca wszystkie nowe zadania (wiele na raz), pomijając już pokazane', () => {
    const tasks = [
      { id: 't6', status: 'pending' } as SpecialTask,
      { id: 't7', status: 'assigned' } as SpecialTask,
      { id: 't8', status: 'pending' } as SpecialTask,
    ];
    const shownIds = new Set<string>(['t6']);
    const result = getHomeworkTasksForPopup(tasks, shownIds);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result.map((t) => t.id), ['t7', 't8']);
  });
});

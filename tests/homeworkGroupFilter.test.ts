import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialTask } from '../types';
import { buildHomeworkRows, filterTasksByGroup, GroupHomeworkRow } from '../utils/groupHomeworkRows';
import { expandHomeworkRow } from '../utils/homeworkBulkDelete';

const task = (id: string, over: Partial<SpecialTask> = {}): SpecialTask =>
  ({
    id,
    studentId: `u_${id}`,
    studentUid: `u_${id}`,
    studentName: `Kursant ${id}`,
    title: `Praca ${id}`,
    type: 'translation',
    sentences: [],
    status: 'assigned',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...over,
  }) as unknown as SpecialTask;

const g1 = (id: string, over: Partial<SpecialTask> = {}) =>
  task(id, { homeworkSetId: 'hwset_grp_g1', groupId: 'g1', groupName: 'Grupa Wtorek', title: 'Travel', ...over });

const tasks = [
  g1('a'),
  g1('b', { status: 'submitted' }),
  g1('c', { status: 'graded' }),
  // Druga praca tej samej grupy — jeden dokument (np. grupa miała wtedy jednego aktywnego członka)
  g1('solo', { homeworkSetId: 'hwset_grp_g1_old', title: 'Phrasal verbs' }),
  // Inna grupa
  task('x', { homeworkSetId: 'hwset_grp_g2', groupId: 'g2', groupName: 'Grupa Czwartek' }),
  task('y', { homeworkSetId: 'hwset_grp_g2', groupId: 'g2', groupName: 'Grupa Czwartek' }),
  // „Kilku kursantów" — wspólny zestaw, ale bez groupId
  task('m1', { homeworkSetId: 'hwset_multi_1' }),
  task('m2', { homeworkSetId: 'hwset_multi_1' }),
  // Praca pojedyncza bez grupy
  task('p'),
];

test('filterTasksByGroup: zostają tylko dokumenty z groupId grupy', () => {
  assert.deepEqual(
    filterTasksByGroup(tasks, 'g1').map((t) => t.id),
    ['a', 'b', 'c', 'solo']
  );
  assert.deepEqual(filterTasksByGroup(tasks, 'g2').map((t) => t.id), ['x', 'y'], 'inna grupa osobno');
});

test('filterTasksByGroup: „Kilku kursantów" (bez groupId) i prace pojedyncze nie wchodzą', () => {
  const ids = filterTasksByGroup(tasks, 'g1').map((t) => t.id);
  for (const id of ['m1', 'm2', 'p', 'x', 'y']) assert.ok(!ids.includes(id), id);
  assert.deepEqual(filterTasksByGroup(tasks, 'nieznana'), []);
});

test('filterTasksByGroup: bez grupy (null/undefined/pusty) lista bez zmian', () => {
  assert.equal(filterTasksByGroup(tasks, null), tasks);
  assert.equal(filterTasksByGroup(tasks, undefined), tasks);
  assert.equal(filterTasksByGroup(tasks, ''), tasks);
});

test('wiersze po filtrze grupy: zestaw zwinięty po homeworkSetId, pojedynczy dokument osobno', () => {
  const rows = buildHomeworkRows(filterTasksByGroup(tasks, 'g1'));
  assert.equal(rows.length, 2);
  const group = rows.find((r) => r.kind === 'group') as GroupHomeworkRow;
  assert.ok(group);
  assert.equal(group.homeworkSetId, 'hwset_grp_g1');
  assert.equal(group.groupName, 'Grupa Wtorek');
  assert.equal(group.total, 3);
  assert.equal(group.submittedCount, 2);
  const single = rows.find((r) => r.kind === 'single');
  assert.equal(single?.kind === 'single' && single.task.id, 'solo');
});

test('wiersz grupowy po filtrze rozwija się wyłącznie do dokumentów tej grupy', () => {
  const rows = buildHomeworkRows(filterTasksByGroup(tasks, 'g1'));
  const keys = rows.flatMap((r) => expandHomeworkRow(r)).map((i) => i.key).sort();
  assert.deepEqual(keys, ['hw:a', 'hw:b', 'hw:c', 'hw:solo']);
});

test('filtr grupy + wybrany kursant (bez zwijania): pojedyncze dokumenty tej grupy', () => {
  const rows = buildHomeworkRows(filterTasksByGroup(tasks, 'g1'), { group: false });
  assert.ok(rows.every((r) => r.kind === 'single'));
  assert.equal(rows.length, 4);
});

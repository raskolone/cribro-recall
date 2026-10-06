import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHomeworkRows,
  isActiveRow,
  isArchivedRow,
  GroupHomeworkRow,
  MULTI_RECIPIENTS_LABEL,
} from '../utils/groupHomeworkRows';
import { SpecialTask } from '../types';

const mk = (over: Partial<SpecialTask> & { id: string }): SpecialTask =>
  ({
    studentId: over.id,
    studentUid: over.id,
    studentName: `Kursant ${over.id}`,
    title: 'Praca',
    createdAt: '2026-10-06T10:00:00.000Z',
    status: 'assigned',
    sentences: [],
    ...over,
  }) as SpecialTask;

const group = (id: string, status: SpecialTask['status'], extra: Partial<SpecialTask> = {}) =>
  mk({ id, homeworkSetId: 'hwset_grp_a', groupId: 'g1', groupName: 'Test061026', status, ...extra });

test('3 dokumenty z tym samym setId → jeden wiersz grupowy N=3', () => {
  const rows = buildHomeworkRows([group('a', 'assigned'), group('b', 'assigned'), group('c', 'assigned')]);
  assert.equal(rows.length, 1);
  const row = rows[0] as GroupHomeworkRow;
  assert.equal(row.kind, 'group');
  assert.equal(row.total, 3);
  assert.equal(row.groupName, 'Test061026');
  assert.equal(row.submittedCount, 0);
  assert.equal(row.status, 'pending');
  assert.equal(row.members.length, 3);
});

test('jedyny dokument z setId zostaje pojedynczy', () => {
  const rows = buildHomeworkRows([group('a', 'assigned')]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'single');
});

test('dokumenty bez setId zostają bez zmian', () => {
  const rows = buildHomeworkRows([mk({ id: 'x', status: 'pending' }), mk({ id: 'y', status: 'submitted' })]);
  assert.deepEqual(rows.map((r) => r.kind), ['single', 'single']);
});

test('status zbiorczy: mieszanka → do sprawdzenia z licznikiem; oddane/N liczy też sprawdzone', () => {
  const row = buildHomeworkRows([
    group('a', 'graded', { teacherRead: true }),
    group('b', 'submitted'),
    group('c', 'submitted'),
    group('d', 'assigned'),
  ])[0] as GroupHomeworkRow;
  assert.equal(row.status, 'submitted');
  assert.equal(row.toCheckCount, 2);
  assert.equal(row.submittedCount, 3);
  assert.equal(row.total, 4);
});

test('status zbiorczy: bez oddanych → pending; wszyscy sprawdzeni → graded', () => {
  const pending = buildHomeworkRows([group('a', 'pending'), group('b', 'assigned')])[0] as GroupHomeworkRow;
  assert.equal(pending.status, 'pending');
  const done = buildHomeworkRows([group('a', 'graded'), group('b', 'completed')])[0] as GroupHomeworkRow;
  assert.equal(done.status, 'graded');
});

test('hwset_multi_ bez groupId → „Kilku kursantów"', () => {
  const rows = buildHomeworkRows([
    mk({ id: 'a', homeworkSetId: 'hwset_multi_1', status: 'pending' }),
    mk({ id: 'b', homeworkSetId: 'hwset_multi_1', status: 'pending' }),
  ]);
  assert.equal((rows[0] as GroupHomeworkRow).groupName, MULTI_RECIPIENTS_LABEL);
});

test('group=false (wybrany kursant) i canGroup nie zwijają', () => {
  const tasks = [group('a', 'assigned'), group('b', 'assigned')];
  assert.equal(buildHomeworkRows(tasks, { group: false }).length, 2);
  assert.equal(buildHomeworkRows(tasks, { canGroup: () => false }).length, 2);
});

test('sortowanie po dacie zadania, od najnowszych; grupa ma datę najnowszego członka', () => {
  const rows = buildHomeworkRows([
    mk({ id: 'old', status: 'pending', createdAt: '2026-10-01T10:00:00.000Z' }),
    group('a', 'assigned', { createdAt: '2026-10-05T10:00:00.000Z' }),
    group('b', 'assigned', { createdAt: '2026-10-05T10:00:00.000Z' }),
    mk({ id: 'new', status: 'pending', createdAt: '2026-10-06T10:00:00.000Z' }),
  ]);
  assert.deepEqual(
    rows.map((r) => (r.kind === 'single' ? r.task.id : r.homeworkSetId)),
    ['new', 'hwset_grp_a', 'old']
  );
});

test('grupa trafia do „Sprawdzone" dopiero, gdy wszystkie dokumenty sprawdzone', () => {
  const partial = buildHomeworkRows([group('a', 'graded'), group('b', 'assigned')])[0];
  assert.equal(isArchivedRow(partial), false);
  assert.equal(isActiveRow(partial, 'all'), true);
  const full = buildHomeworkRows([group('a', 'graded'), group('b', 'graded')])[0];
  assert.equal(isArchivedRow(full), true);
  assert.equal(isActiveRow(full, 'all'), false);
});

test('filtry statusu: grupa pasuje, jeśli którykolwiek dokument pasuje; pojedyncze jak dotąd', () => {
  const g = buildHomeworkRows([group('a', 'submitted'), group('b', 'assigned')])[0];
  assert.equal(isActiveRow(g, 'submitted'), true);
  assert.equal(isActiveRow(g, 'pending'), true);
  assert.equal(isActiveRow(g, 'graded'), false);
  const onlyPending = buildHomeworkRows([group('a', 'assigned'), group('b', 'assigned')])[0];
  assert.equal(isActiveRow(onlyPending, 'submitted'), false);

  const s = buildHomeworkRows([mk({ id: 's', status: 'submitted' })])[0];
  assert.equal(isActiveRow(s, 'submitted'), true);
  assert.equal(isActiveRow(s, 'pending'), false);
  const noStatus = buildHomeworkRows([mk({ id: 'n', status: undefined as any })])[0];
  assert.equal(isActiveRow(noStatus, 'all'), false);
  assert.equal(isArchivedRow(noStatus), false);
});

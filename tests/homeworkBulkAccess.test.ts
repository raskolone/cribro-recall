import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpecialTask } from '../types';
import { canUseBulkActions } from '../utils/homeworkBulkAccess';
import { selectHomeworkViewRows } from '../utils/homeworkListView';
import { collectViewItems } from '../utils/homeworkBulkDelete';

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const base = {
  bulkActions: false,
  openedFromGroup: false,
  isTeacher: true,
  activeTab: 'list',
  hasActiveTask: false,
};

test('canUseBulkActions: wejście z modułu „Zadania i testy" (prop) włącza menu', () => {
  assert.equal(canUseBulkActions({ ...base, bulkActions: true }), true);
});

test('canUseBulkActions: wejście z karty grupy włącza menu nawet bez propa', () => {
  assert.equal(canUseBulkActions({ ...base, openedFromGroup: true }), true);
});

test('canUseBulkActions: karta kursanta (bez propa i bez grupy) zostaje bez menu', () => {
  assert.equal(canUseBulkActions(base), false);
});

test('canUseBulkActions: tylko lektor, tylko na liście, nie w trakcie rozwiązywania', () => {
  const on = { ...base, bulkActions: true, openedFromGroup: true };
  assert.equal(canUseBulkActions({ ...on, isTeacher: false }), false);
  assert.equal(canUseBulkActions({ ...on, activeTab: 'create' }), false);
  assert.equal(canUseBulkActions({ ...on, activeTab: 'flashcards' }), false);
  assert.equal(canUseBulkActions({ ...on, hasActiveTask: true }), false);
});

test('HomeworkScreen liczy dostępność menu przez canUseBulkActions z initialGroupId', () => {
  const screen = src('components/dashboard/HomeworkScreen.tsx');
  assert.match(screen, /const bulkEnabled = canUseBulkActions\(\{[^}]*openedFromGroup: Boolean\(initialGroupId\)/s);
  assert.match(screen, /\{bulkEnabled && \(\s*<MenuDropdown/);
});

test('oba wejścia z karty grupy (karta grupy i modal grup) kończą w tym samym TeacherWorkScreen', () => {
  const admin = src('components/admin/AdminPanel.tsx');
  // GroupDetailView i GroupManagementModal: oba ustawiają grupę i zakładkę prac.
  for (const marker of ['<GroupDetailView', '<GroupManagementModal']) {
    const start = admin.indexOf(marker);
    assert.ok(start > 0, `brak ${marker}`);
    const handler = admin.slice(start, start + 2500);
    const call = handler.slice(handler.indexOf('onAssignHomework'));
    assert.match(call, /setHomeworkInitialGroupId\(group\.id\)/);
    assert.match(call, /setActiveTab\('homework'\)/);
  }
  // Zakładka „homework" bez wybranego kursanta to TeacherWorkScreen z grupą.
  assert.match(admin, /<TeacherWorkScreen\s+initialGroupId=\{homeworkInitialGroupId\}/);
});

test('TeacherWorkScreen przekazuje do HomeworkScreen i grupę, i bulkActions (jeden mechanizm)', () => {
  const work = src('components/dashboard/TeacherWorkScreen.tsx');
  const start = work.indexOf('<HomeworkScreen');
  const tag = work.slice(start, work.indexOf('/>', start));
  assert.match(tag, /\bbulkActions\b/);
  assert.match(tag, /initialGroupId=\{initialGroupId\}/);
});

test('karta kursanta montuje HomeworkScreen bez bulkActions i bez grupy', () => {
  const admin = src('components/admin/AdminPanel.tsx');
  const start = admin.indexOf('<HomeworkScreen');
  const tag = admin.slice(start, admin.indexOf('/>', start));
  assert.doesNotMatch(tag, /bulkActions|initialGroupId/);
});

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

test('„Zaznacz wszystko w widoku" przy filtrze grupy obejmuje tylko prace tej grupy', () => {
  const tasks = [
    task('a', { homeworkSetId: 'set_g1', groupId: 'g1', groupName: 'G1' }),
    task('b', { homeworkSetId: 'set_g1', groupId: 'g1', groupName: 'G1' }),
    task('x', { homeworkSetId: 'set_g2', groupId: 'g2', groupName: 'G2' }),
    task('y', { homeworkSetId: 'set_g2', groupId: 'g2', groupName: 'G2' }),
    task('p'),
  ];
  const rows = selectHomeworkViewRows({
    tasks,
    groupId: 'g1',
    collapseGroups: true,
    status: 'all',
    search: '',
    getName: (t) => t.studentName || '',
  }).visibleActive;
  const ids = collectViewItems(rows, []).map((i) => i.id).sort();
  assert.deepEqual(ids, ['a', 'b']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeworkRows } from '../utils/groupHomeworkRows';
import { matchesHomeworkSearch, normalizeSearchText, filterHomeworkRows } from '../utils/homeworkSearch';
import { SpecialTask } from '../types';

const task = (over: Partial<SpecialTask>): SpecialTask =>
  ({
    id: 't',
    studentId: 's',
    studentUid: 's',
    studentName: 'Jan Kowalski',
    title: 'Past Simple',
    type: 'translation',
    sentences: [],
    status: 'pending',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...over,
  }) as SpecialTask;

const single = task({ id: 'a', studentName: 'Łukasz Żółć', title: 'Phrasal verbs' });
const groupTasks = [
  task({ id: 'g1', studentUid: 'u1', studentId: 'u1', studentName: 'Anna Nowak', homeworkSetId: 'hwset_grp_1', groupId: 'grp', groupName: 'Grupa Wtorek', title: 'Travel vocabulary' }),
  task({ id: 'g2', studentUid: 'u2', studentId: 'u2', studentName: 'Piotr Wiśniewski', homeworkSetId: 'hwset_grp_1', groupId: 'grp', groupName: 'Grupa Wtorek', title: 'Travel vocabulary' }),
];
const rows = buildHomeworkRows([single, ...groupTasks]);
const singleRow = rows.find((r) => r.kind === 'single')!;
const groupRow = rows.find((r) => r.kind === 'group')!;

test('pusta fraza (też same spacje) pasuje do wszystkiego', () => {
  assert.equal(matchesHomeworkSearch(singleRow, ''), true);
  assert.equal(matchesHomeworkSearch(groupRow, '   '), true);
});

test('imię i nazwisko kursanta w wierszu pojedynczym', () => {
  assert.equal(matchesHomeworkSearch(singleRow, 'łukasz'), true);
  assert.equal(matchesHomeworkSearch(singleRow, 'Żółć'), true);
  assert.equal(matchesHomeworkSearch(singleRow, 'anna'), false);
});

test('nazwa grupy i tytuł pracy', () => {
  assert.equal(matchesHomeworkSearch(groupRow, 'wtorek'), true);
  assert.equal(matchesHomeworkSearch(groupRow, 'travel'), true);
  assert.equal(matchesHomeworkSearch(singleRow, 'phrasal'), true);
  assert.equal(matchesHomeworkSearch(singleRow, 'travel'), false);
});

test('wiersz grupowy pasuje przez członka, ale słowa z różnych członków się nie sumują', () => {
  assert.equal(matchesHomeworkSearch(groupRow, 'wiśniewski'), true);
  assert.equal(matchesHomeworkSearch(groupRow, 'anna nowak'), true);
  assert.equal(matchesHomeworkSearch(groupRow, 'anna wisniewski'), false);
  assert.equal(matchesHomeworkSearch(groupRow, 'piotr travel'), true);
});

test('bez wrażliwości na wielkość liter i polskie znaki diakrytyczne', () => {
  assert.equal(matchesHomeworkSearch(singleRow, 'LUKASZ ZOLC'), true);
  assert.equal(matchesHomeworkSearch(groupRow, 'WISNIEWSKI'), true);
  assert.equal(normalizeSearchText('ŁÓDŹ Żaba'), 'lodz zaba');
});

test('getName nadpisuje imię z dokumentu', () => {
  assert.equal(matchesHomeworkSearch(singleRow, 'zosia', () => 'Zosia Test'), true);
});

test('filterHomeworkRows: pusta fraza zwraca wszystko, fraza zawęża', () => {
  assert.equal(filterHomeworkRows(rows, '').length, 2);
  assert.deepEqual(filterHomeworkRows(rows, 'wtorek').map((r) => r.kind), ['group']);
});

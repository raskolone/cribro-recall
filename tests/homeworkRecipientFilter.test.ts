import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpecialTask, StudentTest } from '../types';
import {
  ALL_RECIPIENTS,
  buildRecipientFilterOptions,
  filterTestsForRecipient,
  groupFilterValue,
  initialRecipientFilter,
  parseRecipientFilter,
  recipientFilterParts,
  studentFilterValue,
} from '../utils/homeworkRecipientFilter';
import { homeworkRowKey, selectHomeworkViewRows } from '../utils/homeworkListView';
import { collectViewItems } from '../utils/homeworkBulkDelete';

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// ── wartość filtra ─────────────────────────────────────────────────────────

test('filtr: wartości kursanta i grupy przechodzą tam i z powrotem', () => {
  assert.deepEqual(parseRecipientFilter(studentFilterValue('u1')), { kind: 'student', id: 'u1' });
  assert.deepEqual(parseRecipientFilter(groupFilterValue('g1')), { kind: 'group', id: 'g1' });
  assert.deepEqual(parseRecipientFilter(ALL_RECIPIENTS), { kind: 'all', id: null });
});

test('filtr: pusta, nieznana albo bez id wartość → „Wszyscy"', () => {
  for (const v of [null, undefined, '', 'student:', 'group:', 'u1', 'teacher:x']) {
    assert.deepEqual(parseRecipientFilter(v), { kind: 'all', id: null }, String(v));
  }
  assert.equal(studentFilterValue(null), ALL_RECIPIENTS);
  assert.equal(studentFilterValue('all'), ALL_RECIPIENTS, 'dawne „all" nie robi kursanta o id all');
  assert.equal(groupFilterValue(''), ALL_RECIPIENTS);
});

test('filtr: kursant i grupa wykluczają się — jedno pole stanu', () => {
  assert.deepEqual(recipientFilterParts(studentFilterValue('u1')), { studentId: 'u1', groupId: null });
  assert.deepEqual(recipientFilterParts(groupFilterValue('g1')), { studentId: 'all', groupId: 'g1' });
  assert.deepEqual(recipientFilterParts(ALL_RECIPIENTS), { studentId: 'all', groupId: null });
});

test('filtr: wejście z karty grupy wygrywa z kursantem; bez obu → „Wszyscy"', () => {
  assert.equal(initialRecipientFilter('u1', 'g1'), 'group:g1');
  assert.equal(initialRecipientFilter('u1', null), 'student:u1');
  assert.equal(initialRecipientFilter(null, null), ALL_RECIPIENTS);
});

// ── opcje listy rozwijanej ─────────────────────────────────────────────────

const students = [
  { id: 'u2', name: 'Zofia' },
  { id: '', name: 'bez id' },
  { id: 'u1', name: 'Adam' },
];
const studentLabel = (s: { id?: string | null; name?: string }) => s.name || '';

const groups = [
  { id: 'g_z', name: 'Żurawie C1', status: 'active', memberProfileIds: ['a', 'b'] },
  { id: 'g_arch', name: 'Archiwalna', status: 'archived', memberProfileIds: ['a'] },
  { id: 'g_l', name: 'Łabędzie B2', status: 'active', memberProfileIds: ['a', 'b', 'c'] },
  { id: 'g_a', name: 'anglicy A2', status: 'active' },
  { id: 'g_e', name: 'Ekipa', status: 'active', memberProfileIds: [] },
];

test('opcje: grupy tylko aktywne, alfabetycznie po polsku, z liczbą członków', () => {
  const { groups: opts } = buildRecipientFilterOptions({ groups, students, studentLabel });
  assert.deepEqual(
    opts.map((o) => [o.value, o.name, o.memberCount]),
    [
      ['group:g_a', 'anglicy A2', 0],
      ['group:g_e', 'Ekipa', 0],
      ['group:g_l', 'Łabędzie B2', 3],
      ['group:g_z', 'Żurawie C1', 2],
    ]
  );
});

test('opcje: kursanci w kolejności wejścia, bez rekordów bez id, wartości `student:`', () => {
  const { students: opts } = buildRecipientFilterOptions({ groups, students, studentLabel });
  assert.deepEqual(opts, [
    { value: 'student:u2', label: 'Zofia' },
    { value: 'student:u1', label: 'Adam' },
  ]);
});

test('opcje: brak grup albo lista się nie wczytała → sama sekcja kursantów, bez błędu', () => {
  for (const g of [null, undefined, []]) {
    const opts = buildRecipientFilterOptions({ groups: g, students, studentLabel });
    assert.deepEqual(opts.groups, []);
    assert.equal(opts.students.length, 2);
  }
});

test('opcje: wybrana grupa spoza listy (archiwalna / niewczytana) dostaje własną opcję', () => {
  const archived = buildRecipientFilterOptions({ groups, students, studentLabel, selected: 'group:g_arch' });
  assert.ok(archived.groups.some((o) => o.value === 'group:g_arch' && o.name === 'Archiwalna' && o.memberCount === 1));

  const notLoaded = buildRecipientFilterOptions({
    groups: null,
    students,
    studentLabel,
    selected: 'group:g9',
    selectedGroupName: 'Test061026',
  });
  assert.deepEqual(notLoaded.groups, [{ value: 'group:g9', name: 'Test061026', memberCount: 0 }]);

  // Grupa już na liście — bez duplikatu.
  const listed = buildRecipientFilterOptions({ groups, students, studentLabel, selected: 'group:g_l' });
  assert.equal(listed.groups.filter((o) => o.value === 'group:g_l').length, 1);
});

// ── filtrowanie wierszy i spójność Lista / Kafelki ─────────────────────────

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
  task(id, { homeworkSetId: 'set_g1', groupId: 'g1', groupName: 'Test061026', title: 'Travel', ...over });

// Zrzut z kafelkami Doroty i Aleksandry pod wierszem Test061026: ich prace
// to inne zestawy (indywidualne i „Kilku kursantów"), nie praca grupy.
const tasks = [
  g1('a'),
  g1('b', { status: 'submitted' }),
  g1('c'),
  g1('done1', { homeworkSetId: 'set_g1_done', status: 'graded', teacherRead: true }),
  g1('done2', { homeworkSetId: 'set_g1_done', status: 'graded', teacherRead: true }),
  task('dorota', { studentId: 'u_dorota', studentUid: 'u_dorota', studentName: 'Dorota', title: 'Phrasal verbs' }),
  task('ola', { studentId: 'u_ola', studentUid: 'u_ola', studentName: 'Aleksandra', status: 'submitted' }),
  // „Kilku kursantów": wspólny zestaw bez groupId — nie należy do żadnej grupy.
  task('m1', { homeworkSetId: 'hwset_multi_1', studentName: 'Dorota' }),
  task('m2', { homeworkSetId: 'hwset_multi_1', studentName: 'Aleksandra' }),
];

const rowsFor = (value: string, over: { status?: string; search?: string } = {}) => {
  const { studentId, groupId } = recipientFilterParts(value);
  return selectHomeworkViewRows({
    tasks,
    groupId,
    matchesStudent: studentId === 'all' ? undefined : (t) => t.studentId === studentId,
    collapseGroups: studentId === 'all',
    status: over.status ?? 'all',
    search: over.search ?? '',
    getName: (t) => t.studentName || '',
  });
};
const keys = (rows: ReturnType<typeof rowsFor>['visibleActive']) => rows.map(homeworkRowKey).sort();

const cases: Array<{ name: string; value: string; over?: { status?: string; search?: string }; active: string[]; archived: string[] }> = [
  {
    name: 'grupa: tylko jej prace, zestaw zwinięty; „Kilku kursantów" i indywidualne odpadają',
    value: 'group:g1',
    active: ['set:set_g1'],
    archived: ['set:set_g1_done'],
  },
  {
    name: 'grupa + status „przesłane"',
    value: 'group:g1',
    over: { status: 'submitted' },
    active: ['set:set_g1'],
    archived: ['set:set_g1_done'],
  },
  {
    name: 'grupa + wyszukiwarka spoza grupy → pusto',
    value: 'group:g1',
    over: { search: 'phrasal' },
    active: [],
    archived: [],
  },
  {
    name: 'kursant: jego dokumenty osobno, bez zwijania',
    value: 'student:u_dorota',
    active: ['task:dorota'],
    archived: [],
  },
  {
    name: 'wszyscy: wszystko, zestawy zwinięte',
    value: 'all',
    active: ['set:hwset_multi_1', 'set:set_g1', 'task:dorota', 'task:ola'],
    archived: ['set:set_g1_done'],
  },
  {
    name: 'grupa bez prac → pusto',
    value: 'group:g404',
    active: [],
    archived: [],
  },
];

for (const c of cases) {
  test(`wiersze po filtrze: ${c.name}`, () => {
    const rows = rowsFor(c.value, c.over);
    assert.deepEqual(keys(rows.visibleActive), [...c.active].sort());
    assert.deepEqual(keys(rows.visibleArchived), [...c.archived].sort());
  });
}

test('wiersze po filtrze: licznik zakładki liczy wiersze po filtrze grupy', () => {
  assert.equal(rowsFor('group:g1').active.length, 1);
  assert.equal(rowsFor('all').active.length, 4);
});

test('„Zaznacz wszystko w widoku" przy filtrze grupy: tylko dokumenty grupy, bez testów', () => {
  const tests = [{ id: 't1', studentId: 'u_dorota', status: 'completed' } as unknown as StudentTest];
  const value = 'group:g1';
  const items = collectViewItems(rowsFor(value).visibleActive, filterTestsForRecipient(tests, value));
  assert.deepEqual(items.map((i) => i.key).sort(), ['hw:a', 'hw:b', 'hw:c']);

  const archivedItems = collectViewItems(rowsFor(value).visibleArchived, filterTestsForRecipient(tests, value));
  assert.deepEqual(archivedItems.map((i) => i.key).sort(), ['hw:done1', 'hw:done2']);
});

test('testy: filtr grupy je chowa, kursant i „Wszyscy" zostawiają bez zmian', () => {
  const tests = [1, 2];
  assert.deepEqual(filterTestsForRecipient(tests, 'group:g1'), []);
  assert.deepEqual(filterTestsForRecipient(tests, 'student:u1'), tests);
  assert.deepEqual(filterTestsForRecipient(tests, 'all'), tests);
});

// ── podpięcie w HomeworkScreen ─────────────────────────────────────────────

test('HomeworkScreen: jeden stan filtra, chip i lista na nim, osobnych setterów brak', () => {
  const screen = src('components/dashboard/HomeworkScreen.tsx');
  assert.match(screen, /useState<RecipientFilterValue>/);
  assert.match(screen, /recipientFilterParts\(recipientFilter\)/);
  assert.doesNotMatch(screen, /setFilterStudentId|setFilterGroupId/, 'dawne dwa stany usunięte');
  assert.match(screen, /onClick=\{\(\) => setRecipientFilter\(ALL_RECIPIENTS\)\}/, 'chip czyści ten sam stan');
  assert.match(screen, /setRecipientFilter\(groupFilterValue\(initialGroupId\)\)/, 'karta grupy ustawia filtr grupy');
});

test('HomeworkScreen: lista z grupami w obu zakładkach, sekcje i etykiety przez i18n', () => {
  const screen = src('components/dashboard/HomeworkScreen.tsx');
  assert.equal(screen.match(/\{renderRecipientSelect\(\)\}/g)?.length, 2, 'Prace domowe + Sprawdzone');
  assert.match(screen, /<optgroup label=\{i18n\.t\('Grupy'\)\}>/);
  assert.match(screen, /<optgroup label=\{i18n\.t\('Kursanci'\)\}>/);
  assert.match(screen, /i18n\.t\('Wszyscy kursanci'\)/);
  assert.match(screen, /fetchGroupsForCaller\(\)/);
  assert.match(screen, /filterTestsForRecipient\(completedStudentTests, recipientFilter\)/);
});

test('i18n: nowe klucze w obu językach, bez dwukropka (separator przestrzeni nazw i18next)', () => {
  const pl = JSON.parse(src('pl.json'));
  const en = JSON.parse(src('en.json'));
  for (const key of ['Wszyscy kursanci', 'Grupy', 'Kursanci', 'Kursant', 'Kursant lub grupa', '{{name}} ({{count}} os.)']) {
    assert.ok(pl[key], `pl: ${key}`);
    assert.ok(en[key], `en: ${key}`);
    assert.ok(!key.includes(':'), key);
  }
});

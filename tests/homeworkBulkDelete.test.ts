import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialTask, StudentTest } from '../types';
import { buildHomeworkRows, GroupHomeworkRow, isActiveRow } from '../utils/groupHomeworkRows';
import { filterHomeworkRows } from '../utils/homeworkSearch';
import {
  aggregateBulkResults,
  BulkDeleteItem,
  chunkItems,
  collectViewItems,
  countHandedIn,
  describeDeleteError,
  expandHomeworkRow,
  homeworkItemKey,
  isHomeworkHandedIn,
  KNOWN_DELETE_ERROR_REASONS,
  runBulkDelete,
  selectionState,
  setItemsSelected,
  summarizeSelection,
  testBulkItem,
  testItemKey,
  toggleItems,
} from '../utils/homeworkBulkDelete';

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

const inGroup = (id: string, status: string, over: Partial<SpecialTask> = {}) =>
  task(id, {
    status: status as SpecialTask['status'],
    homeworkSetId: 'hwset_grp_1',
    groupId: 'g1',
    groupName: 'Grupa Wtorek',
    title: 'Travel',
    ...over,
  });

const studentTest = (id: string, over: Partial<StudentTest> = {}): StudentTest =>
  ({
    id,
    studentId: `s_${id}`,
    studentName: `Uczeń ${id}`,
    title: `Test ${id}`,
    status: 'pending',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...over,
  }) as unknown as StudentTest;

const item = (key: string, over: Partial<BulkDeleteItem> = {}): BulkDeleteItem => ({
  key,
  kind: 'homework',
  id: key,
  title: `Tytuł ${key}`,
  studentName: `Kursant ${key}`,
  handedIn: false,
  ...over,
});

// --- rozwinięcie wierszy ---------------------------------------------------

test('expandHomeworkRow: wiersz pojedynczy → jeden dokument specialTasks', () => {
  const [row] = buildHomeworkRows([task('a')]);
  assert.deepEqual(expandHomeworkRow(row), [
    {
      key: 'hw:a',
      kind: 'homework',
      id: 'a',
      title: 'Praca a',
      studentName: 'Kursant a',
      setId: undefined,
      groupName: undefined,
      handedIn: false,
    },
  ]);
});

test('expandHomeworkRow: wiersz grupowy → WSZYSTKIE dokumenty zestawu, z nazwą grupy i kursanta', () => {
  const rows = buildHomeworkRows([inGroup('a', 'assigned'), inGroup('b', 'submitted'), inGroup('c', 'graded')]);
  assert.equal(rows.length, 1);
  const group = rows[0] as GroupHomeworkRow;
  const items = expandHomeworkRow(group);
  assert.equal(items.length, group.total);
  assert.deepEqual(items.map((i) => i.key).sort(), ['hw:a', 'hw:b', 'hw:c']);
  assert.ok(items.every((i) => i.setId === 'hwset_grp_1' && i.groupName === 'Grupa Wtorek'));
  assert.deepEqual(
    items.map((i) => [i.studentName, i.handedIn]).sort(),
    [
      ['Kursant a', false],
      ['Kursant b', true],
      ['Kursant c', true],
    ]
  );
});

test('expandHomeworkRow: getName z listy lektora i dokument bez id pomijany', () => {
  const [row] = buildHomeworkRows([task('a')]);
  assert.equal(expandHomeworkRow(row, { getName: () => 'Anna Nowak' })[0].studentName, 'Anna Nowak');
  const [noId] = buildHomeworkRows([task('', {})]);
  assert.deepEqual(expandHomeworkRow(noId), []);
});

test('isHomeworkHandedIn: oddane/ocenione po statusie, dacie oddania albo sygnale v2', () => {
  for (const status of ['submitted', 'graded', 'completed']) {
    assert.equal(isHomeworkHandedIn(task('x', { status: status as SpecialTask['status'] })), true, status);
  }
  for (const status of ['assigned', 'pending']) {
    assert.equal(isHomeworkHandedIn(task('x', { status: status as SpecialTask['status'] })), false, status);
  }
  assert.equal(isHomeworkHandedIn(task('x', { submittedAt: '2026-10-02T10:00:00.000Z' })), true);
  // v2: status stoi na „assigned", a próba czeka na ocenę
  const v2 = task('v2');
  assert.equal(isHomeworkHandedIn(v2, (t) => t.id === 'v2'), true);
  assert.equal(expandHomeworkRow(buildHomeworkRows([v2])[0], { isHandedIn: (t) => t.id === 'v2' })[0].handedIn, true);
});

test('testBulkItem: ścieżka users/{studentId}/tests/{id}, oddany = completed/graded/completedAt', () => {
  const pending = testBulkItem(studentTest('t1'));
  assert.equal(pending?.key, 'test:s_t1/t1');
  assert.equal(pending?.studentId, 's_t1');
  assert.equal(pending?.kind, 'test');
  assert.equal(pending?.handedIn, false);
  assert.equal(testBulkItem(studentTest('t2', { status: 'completed' }))?.handedIn, true);
  assert.equal(testBulkItem(studentTest('t3', { status: 'graded' }))?.handedIn, true);
  assert.equal(testBulkItem(studentTest('t4', { completedAt: '2026-10-02' }))?.handedIn, true);
  assert.equal(testBulkItem(studentTest('t5', { studentId: '' })), null);
  assert.equal(testBulkItem(studentTest('', {})), null);
  assert.equal(testItemKey('s', 't'), 'test:s/t');
  assert.equal(homeworkItemKey('a'), 'hw:a');
});

// --- zaznaczanie z uwzględnieniem filtrów -------------------------------------

test('collectViewItems: tylko wiersze po wyszukiwarce/filtrach, zestaw rozwinięty, bez duplikatów', () => {
  const tasks = [
    inGroup('a', 'assigned'),
    inGroup('b', 'submitted'),
    task('c', { title: 'Phrasal verbs' }),
    task('d', { title: 'Travel diary' }),
  ];
  const rows = buildHomeworkRows(tasks);
  const visible = filterHomeworkRows(rows, 'travel');
  const keys = collectViewItems(visible, []).map((i) => i.key).sort();
  assert.deepEqual(keys, ['hw:a', 'hw:b', 'hw:d'], '„Phrasal verbs" odfiltrowane — nie trafia do zaznaczenia');

  const withTests = collectViewItems(visible, [studentTest('t1'), studentTest('t1')]);
  assert.equal(withTests.filter((i) => i.kind === 'test').length, 1, 'ten sam test raz');
  assert.equal(collectViewItems([...visible, ...visible], []).length, 3, 'ten sam dokument raz');
});

test('selectionState: none / some / all; pusty widok = none', () => {
  const a = item('a');
  const b = item('b');
  assert.equal(selectionState(new Map(), [a, b]), 'none');
  assert.equal(selectionState(new Map([[a.key, a]]), [a, b]), 'some');
  assert.equal(selectionState(new Map([[a.key, a], [b.key, b]]), [a, b]), 'all');
  assert.equal(selectionState(new Map([[a.key, a]]), []), 'none');
});

test('toggleItems: część zaznaczona → zaznacza resztę; wszystko zaznaczone → odznacza; nie rusza reszty', () => {
  const a = item('a');
  const b = item('b');
  const outside = item('poza-widokiem');
  const start = new Map([[a.key, a], [outside.key, outside]]);

  const all = toggleItems(start, [a, b]);
  assert.deepEqual([...all.keys()].sort(), ['a', 'b', 'poza-widokiem']);
  const none = toggleItems(all, [a, b]);
  assert.deepEqual([...none.keys()], ['poza-widokiem'], 'zaznaczenie spoza widoku zostaje');
  assert.equal(start.size, 2, 'wejście nie jest mutowane');
});

test('„Zaznacz wszystko w widoku" po filtrze statusu: łapie tylko widoczne, wiersz grupowy liczy się w całości', () => {
  const tasks = [inGroup('a', 'submitted'), inGroup('b', 'assigned'), task('c', { status: 'assigned' })];
  const rows = buildHomeworkRows(tasks);
  // Filtr „Przesłane do oceny": grupa pasuje (ktoś oddał), pojedyncza praca w trakcie — nie.
  const submittedOnly = rows.filter((r) => isActiveRow(r, 'submitted'));
  const view = collectViewItems(submittedOnly, []);
  const selected = toggleItems(new Map(), view);
  assert.deepEqual([...selected.keys()].sort(), ['hw:a', 'hw:b']);
  assert.equal(setItemsSelected(selected, view, false).size, 0);
});

// --- ostrzeżenia i wypis ----------------------------------------------------

test('countHandedIn: liczba oddanych/ocenionych w zaznaczeniu', () => {
  assert.equal(countHandedIn([item('a'), item('b', { handedIn: true }), item('c', { handedIn: true })]), 2);
  assert.equal(countHandedIn([]), 0);
});

test('summarizeSelection: zestaw grupowy jako jedna linia z liczbą, testy i pojedyncze osobno, reszta jako liczba', () => {
  const items = [
    item('a', { setId: 's1', groupName: 'Grupa Wtorek', title: 'Travel' }),
    item('b', { setId: 's1', groupName: 'Grupa Wtorek', title: 'Travel' }),
    item('c', { title: 'Phrasal verbs', studentName: 'Anna' }),
    item('t', { kind: 'test', title: 'Unit 3', studentName: 'Jan' }),
    item('d', { title: 'D' }),
    item('e', { title: 'E' }),
  ];
  const { lines, moreLines } = summarizeSelection(items, 3);
  assert.deepEqual(lines, [
    { kind: 'homework', title: 'Travel', who: 'Grupa Wtorek', count: 2 },
    { kind: 'homework', title: 'Phrasal verbs', who: 'Anna', count: 1 },
    { kind: 'test', title: 'Unit 3', who: 'Jan', count: 1 },
  ]);
  assert.equal(moreLines, 2);
  assert.equal(summarizeSelection([], 5).lines.length, 0);
});

// --- partie i wykonanie -------------------------------------------------------

test('chunkItems: partie po N, reszta w ostatniej; rozmiar < 1 traktowany jako 1', () => {
  const xs = Array.from({ length: 25 }, (_, i) => i);
  assert.deepEqual(chunkItems(xs, 10).map((c) => c.length), [10, 10, 5]);
  assert.deepEqual(chunkItems(xs).map((c) => c.length), [10, 10, 5], 'domyślnie 10');
  assert.deepEqual(chunkItems([1, 2], 0), [[1], [2]]);
  assert.deepEqual(chunkItems([], 10), []);
});

test('runBulkDelete: błąd jednej pozycji nie przerywa reszty; postęp po każdej; raport w kolejności wejścia', async () => {
  const items = Array.from({ length: 23 }, (_, i) => item(`k${i}`));
  const progress: Array<[number, number]> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const report = await runBulkDelete(
    items,
    async (it) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      if (it.key === 'k3') throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
      if (it.key === 'k17') throw new Error('boom');
    },
    { onProgress: (done, total) => progress.push([done, total]) }
  );

  assert.equal(report.deleted.length, 21);
  assert.deepEqual(report.failed.map((f) => [f.item.key, f.reason]), [
    ['k3', 'brak uprawnień'],
    ['k17', 'boom'],
  ]);
  assert.deepEqual(
    report.deleted.map((d) => d.key),
    items.map((i) => i.key).filter((k) => k !== 'k3' && k !== 'k17')
  );
  assert.equal(progress.length, 23);
  assert.deepEqual(progress[progress.length - 1], [23, 23]);
  assert.ok(progress.every(([done], i) => done === i + 1), 'postęp rośnie o 1');
  assert.ok(maxInFlight <= 10, `najwyżej jedna partia naraz (było ${maxInFlight})`);
});

test('runBulkDelete: partia mniejsza niż domyślna i pusta lista', async () => {
  let maxInFlight = 0;
  let inFlight = 0;
  const report = await runBulkDelete(
    [item('a'), item('b'), item('c')],
    async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
    },
    { chunkSize: 1 }
  );
  assert.equal(maxInFlight, 1, 'sekwencyjnie przy partii 1');
  assert.equal(report.deleted.length, 3);
  assert.deepEqual(await runBulkDelete([], async () => {}), { deleted: [], failed: [] });
});

test('describeDeleteError: kody Firestore → powód z i18n, inaczej komunikat, na końcu „nieznany błąd"', () => {
  assert.equal(describeDeleteError({ code: 'permission-denied' }), 'brak uprawnień');
  assert.equal(describeDeleteError({ code: 'firestore/permission-denied' }), 'brak uprawnień');
  assert.equal(describeDeleteError({ code: 'unavailable' }), 'brak połączenia z bazą');
  assert.equal(describeDeleteError({ code: 'not-found' }), 'dokument już nie istnieje');
  assert.equal(describeDeleteError(new Error('  boom  ')), 'boom');
  assert.equal(describeDeleteError(undefined), 'nieznany błąd');
  assert.equal(describeDeleteError({ message: '' }), 'nieznany błąd');
  for (const reason of ['brak uprawnień', 'brak połączenia z bazą', 'dokument już nie istnieje', 'nieznany błąd']) {
    assert.ok(KNOWN_DELETE_ERROR_REASONS.has(reason), reason);
  }
});

test('aggregateBulkResults: brak wyniku pozycji liczy się jako błąd', () => {
  const report = aggregateBulkResults([item('a'), item('b'), item('c')], [{ ok: true }, undefined, { ok: false, reason: 'x' }]);
  assert.deepEqual(report.deleted.map((d) => d.key), ['a']);
  assert.deepEqual(report.failed.map((f) => [f.item.key, f.reason]), [
    ['b', 'nieznany błąd'],
    ['c', 'x'],
  ]);
});

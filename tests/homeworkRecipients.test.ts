import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_RECIPIENTS_MESSAGE,
  filterByName,
  selectAllIds,
  toggleId,
  buildAdHocHomeworkPayloads,
  newAdHocHomeworkSetId,
  validateMultipleRecipients,
} from '../utils/homeworkRecipients';
import { buildV2TaskPayload, newHomeworkSetId } from '../functions/src/homeworkV2/assignment';

const students = [
  { id: 'a', name: 'Anna Kowalska' },
  { id: 'b', name: 'Bartek Nowak' },
  { id: 'c', name: 'Celina Kowal' },
];
const label = (s: { id: string; name: string }) => s.name;

test('ad-hoc: 3 kursantów → 3 dokumenty ze wspólnym homeworkSetId, bez groupId', () => {
  const homeworkSetId = newHomeworkSetId();
  const docs = ['a', 'b', 'c'].map((studentUid) =>
    buildV2TaskPayload({
      studentUid,
      exercises: [],
      teacherId: 't1',
      title: 'Praca domowa',
      groupId: undefined,
      homeworkSetId,
      createdAt: '2026-09-29T10:00:00.000Z',
    } as any)
  );
  assert.equal(docs.length, 3);
  assert.equal(new Set(docs.map((d) => d.homeworkSetId)).size, 1);
  assert.equal(new Set(docs.map((d) => d.studentUid)).size, 3);
  docs.forEach((d) => assert.equal('groupId' in d, false));
});

test('wyszukiwarka filtruje listę po imieniu', () => {
  assert.deepEqual(filterByName(students, 'kowal', label).map((s) => s.id), ['a', 'c']);
  assert.deepEqual(filterByName(students, '  BARTEK ', label).map((s) => s.id), ['b']);
  assert.equal(filterByName(students, '', label).length, 3);
  assert.equal(filterByName(students, 'zzz', label).length, 0);
});

test('„Zaznacz wszystkich" dokłada widocznych bez duplikatów, „Wyczyść" = pusta lista', () => {
  assert.deepEqual(selectAllIds(['b'], ['a', 'b', 'c']).sort(), ['a', 'b', 'c']);
  const visible = filterByName(students, 'kowal', label).map((s) => s.id);
  assert.deepEqual(selectAllIds([], visible), ['a', 'c']);
});

test('toggleId zaznacza i odznacza', () => {
  assert.deepEqual(toggleId([], 'a'), ['a']);
  assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
});

test('0 kursantów blokuje przypisanie z czytelnym komunikatem', () => {
  assert.equal(validateMultipleRecipients([]), NO_RECIPIENTS_MESSAGE);
  assert.match(NO_RECIPIENTS_MESSAGE, /co najmniej jednego kursanta/);
  assert.equal(validateMultipleRecipients(['a']), null);
});

test('V1 ad-hoc: 3 kursantów → 3 dokumenty, wspólny homeworkSetId, bez groupId i engineVersion', () => {
  let n = 0;
  const setId = newAdHocHomeworkSetId(() => 'abcd');
  const docs = buildAdHocHomeworkPayloads(
    [
      { id: 'a', name: 'Anna', email: 'a@x.pl' },
      { id: 'b', name: 'Bartek' },
      { id: 'c', name: 'Celina', username: 'cel' },
    ],
    {
      title: 'Praca domowa',
      type: 'translation',
      types: ['translation'],
      instructions: 'x',
      sentences: [{ type: 'translation' }],
      dueDate: '2026-10-06',
      createdAt: '2026-09-29T10:00:00.000Z',
      origin: 'https://app.test',
    },
    setId,
    () => `tok${++n}`
  );
  assert.equal(docs.length, 3);
  assert.equal(new Set(docs.map((d) => d.homeworkSetId)).size, 1);
  assert.match(String(docs[0].homeworkSetId), /^hwset_multi_/);
  assert.deepEqual(docs.map((d) => d.studentUid), ['a', 'b', 'c']);
  assert.equal(new Set(docs.map((d) => d.accessToken)).size, 3);
  assert.equal(docs[0].accessUrl, 'https://app.test/hw?token=tok1');
  docs.forEach((d) => {
    assert.equal('groupId' in d, false);
    assert.equal('engineVersion' in d, false);
    assert.equal(d.status, 'pending');
    assert.equal(d.skipAutoEmail, true);
    assert.deepEqual(d.studentIds, [d.studentUid]);
  });
});

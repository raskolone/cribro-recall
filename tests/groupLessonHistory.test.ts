import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeGroupLessonCopies,
  pickActiveGroupMemberIds,
  buildGroupLessonFormPreset,
  resolveGroupLessonIdForSave,
  resolveStudentsForAiSummary,
  buildGroupSourceLessons,
  GROUP_COPIES_DIFFER_TOLERANCE_MS,
} from '../utils/groupLessonHistory';
import type { LessonRecord } from '../types';

/**
 * Karta grupy: historia lekcji grupy sklejana z kopii (po jednej na kursanta)
 * po `groupLessonId`, oraz stan formularza „+ Lekcja" otwieranego z karty.
 */

const GLID = 'grouplesson-1790954168181-b2of9fhpb';

const copy = (studentId: string, overrides: Partial<LessonRecord> = {}): LessonRecord =>
  ({
    id: `rec_${studentId}`,
    studentId,
    groupId: 'grp_jacobs',
    groupName: 'Jacobs_test',
    groupLessonId: GLID,
    date: '2026-10-02',
    topic: 'To Be and Present Simple: My Workday',
    vocabularyText: '',
    createdAt: '2026-10-02T15:20:00.000Z',
    updatedAt: '2026-10-02T15:20:00.000Z',
    ...overrides,
  }) as LessonRecord;

test('3 identyczne kopie → 1 wpis reprezentatywny, bez flagi różnic', () => {
  const entries = mergeGroupLessonCopies([copy('usr_a'), copy('usr_b'), copy('usr_c')], 'grp_jacobs');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].groupLessonId, GLID);
  assert.equal(entries[0].copyCount, 3);
  assert.deepEqual(entries[0].memberIds, ['usr_a', 'usr_b', 'usr_c']);
  assert.equal(entries[0].copiesDiffer, false);
  assert.equal(entries[0].representative.topic, 'To Be and Present Simple: My Workday');
});

test('kopie zapisane po kolei (kilka sekund różnicy) nie są „różne"', () => {
  const entries = mergeGroupLessonCopies(
    [
      copy('usr_a', { updatedAt: '2026-10-02T15:20:00.000Z' }),
      copy('usr_b', { updatedAt: '2026-10-02T15:20:04.000Z' }),
      copy('usr_c', { updatedAt: '2026-10-02T15:20:09.000Z' }),
    ],
    'grp_jacobs'
  );
  assert.equal(entries[0].copiesDiffer, false);
  assert.equal(entries[0].representative.studentId, 'usr_c');
});

test('rozjechane updatedAt → flaga „kopie się różnią", reprezentantem najnowsza kopia', () => {
  const edited = copy('usr_b', { updatedAt: '2026-10-03T09:00:00.000Z', topic: 'Poprawiony temat' });
  const entries = mergeGroupLessonCopies([copy('usr_a'), edited, copy('usr_c')], 'grp_jacobs');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].copiesDiffer, true);
  assert.equal(entries[0].representative.studentId, 'usr_b');
  assert.equal(entries[0].representative.topic, 'Poprawiony temat');
});

test('rozjazd dokładnie na granicy tolerancji nie jest flagowany', () => {
  const base = Date.parse('2026-10-02T15:20:00.000Z');
  const entries = mergeGroupLessonCopies(
    [copy('usr_a'), copy('usr_b', { updatedAt: new Date(base + GROUP_COPIES_DIFFER_TOLERANCE_MS).toISOString() })],
    'grp_jacobs'
  );
  assert.equal(entries[0].copiesDiffer, false);
});

test('grupa bez lekcji → pusty stan, nie błąd', () => {
  assert.deepEqual(mergeGroupLessonCopies([], 'grp_jacobs'), []);
  assert.deepEqual(mergeGroupLessonCopies(undefined as unknown as LessonRecord[], 'grp_jacobs'), []);
  assert.deepEqual(mergeGroupLessonCopies([copy('usr_a')], ''), []);
});

test('lekcje innej grupy i lekcje indywidualne są pomijane', () => {
  const other = copy('usr_a', { id: 'rec_other', groupId: 'grp_other', groupLessonId: 'grouplesson-x' });
  const individual = { ...copy('usr_a', { id: 'rec_ind' }), groupId: undefined, groupLessonId: undefined } as LessonRecord;
  const entries = mergeGroupLessonCopies([other, individual, copy('usr_b')], 'grp_jacobs');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].copyCount, 1);
});

test('rekord z groupId, ale bez groupLessonId → pominięty bez wyjątku', () => {
  const legacy = copy('usr_a', { id: 'rec_legacy', groupLessonId: undefined });
  const blank = copy('usr_b', { id: 'rec_blank', groupLessonId: '   ' });
  assert.deepEqual(mergeGroupLessonCopies([legacy, blank], 'grp_jacobs'), []);
});

test('kopia u kursanta spoza składu grupy → savedCopyCount z pola studentIds', () => {
  const ids = ['usr_a', 'usr_b', 'usr_outside'];
  const entries = mergeGroupLessonCopies(
    [copy('usr_a', { studentIds: ids }), copy('usr_b', { studentIds: ids })],
    'grp_jacobs'
  );
  assert.equal(entries[0].copyCount, 2);
  assert.equal(entries[0].savedCopyCount, 3);
});

test('kopie bez pola studentIds → savedCopyCount = liczba odczytanych kopii', () => {
  const entries = mergeGroupLessonCopies([copy('usr_a'), copy('usr_b')], 'grp_jacobs');
  assert.equal(entries[0].savedCopyCount, 2);
});

test('ten sam dokument podany dwa razy liczy się raz', () => {
  const entries = mergeGroupLessonCopies([copy('usr_a'), copy('usr_a'), copy('usr_b')], 'grp_jacobs');
  assert.equal(entries[0].copyCount, 2);
});

test('kilka lekcji grupy → osobne wpisy, najnowsza data pierwsza', () => {
  const older = copy('usr_a', { id: 'rec_old', groupLessonId: 'grouplesson-old', date: '2026-09-25' });
  const entries = mergeGroupLessonCopies([older, copy('usr_a'), copy('usr_b')], 'grp_jacobs');
  assert.deepEqual(entries.map((e) => e.groupLessonId), [GLID, 'grouplesson-old']);
});

const users = [
  { id: 'usr_a' },
  { id: 'usr_b', isArchived: true },
  { id: 'usr_c', isSuspended: true },
  { id: 'usr_d', statusWspolpracy: 'Nieaktywny' },
  { id: 'usr_e' },
] as any[];

test('pickActiveGroupMemberIds: tylko aktywni, znani kursanci', () => {
  assert.deepEqual(pickActiveGroupMemberIds(['usr_a', 'usr_b', 'usr_c', 'usr_d', 'usr_e', 'usr_ghost'], users), ['usr_a', 'usr_e']);
  assert.deepEqual(pickActiveGroupMemberIds(undefined, users), []);
});

test('„+ Lekcja" z karty grupy → formularz z wybraną grupą i aktywnymi członkami', () => {
  const preset = buildGroupLessonFormPreset(
    { id: 'grp_jacobs', name: 'Jacobs_test', memberProfileIds: ['usr_b', 'usr_a', 'usr_e'] },
    users
  );
  assert.deepEqual(preset, {
    groupId: 'grp_jacobs',
    groupName: 'Jacobs_test',
    studentIds: ['usr_a', 'usr_e'],
    primaryStudentId: 'usr_a',
  });
});

test('„+ Lekcja" dla grupy bez aktywnych członków → pusta lista, bez wyjątku', () => {
  const preset = buildGroupLessonFormPreset({ id: 'grp_x', name: 'X', memberProfileIds: ['usr_b'] }, users);
  assert.deepEqual(preset.studentIds, []);
  assert.equal(preset.primaryStudentId, '');
});

test('resolveGroupLessonIdForSave: edycja kopii tej samej grupy zachowuje groupLessonId', () => {
  const gen = () => 'grouplesson-new';
  assert.equal(resolveGroupLessonIdForSave('grp_jacobs', { groupId: 'grp_jacobs', groupLessonId: GLID }, gen), GLID);
});

test('resolveGroupLessonIdForSave: nowa lekcja / zmiana grupy / brak grupy', () => {
  const gen = () => 'grouplesson-new';
  assert.equal(resolveGroupLessonIdForSave('grp_jacobs', null, gen), 'grouplesson-new');
  assert.equal(resolveGroupLessonIdForSave('grp_other', { groupId: 'grp_jacobs', groupLessonId: GLID }, gen), 'grouplesson-new');
  assert.equal(resolveGroupLessonIdForSave('grp_jacobs', { groupId: 'grp_jacobs' }, gen), 'grouplesson-new');
  assert.equal(resolveGroupLessonIdForSave('', { groupId: 'grp_jacobs', groupLessonId: GLID }, gen), undefined);
});

/**
 * „Z transkrypcji (AI)": AI wykrywa z notatek jednego kursanta. Grupa wybrana
 * PRZED uruchomieniem AI ma wygrać; grupa wybrana PO wyniku AI nadpisuje
 * kursantów jak dotąd (dropdown w formularzu → `buildGroupLessonFormPreset`).
 */
const jacobs = { id: 'grp_jacobs', name: 'Jacobs_test', memberProfileIds: ['usr_a', 'usr_e'] };

test('grupa PRZED AI: AI wykrywa innego kursanta → lista zostaje listą członków grupy', () => {
  const preset = buildGroupLessonFormPreset(jacobs, users);
  const result = resolveStudentsForAiSummary({
    formGroupId: preset.groupId,
    currentStudentIds: preset.studentIds,
    currentPrimaryStudentId: preset.primaryStudentId,
    aiStudentIds: ['usr_outsider'],
  });
  assert.deepEqual(result, { studentIds: ['usr_a', 'usr_e'], primaryStudentId: 'usr_a' });
});

test('grupa PRZED AI: odznaczony nieobecny zostaje odznaczony po wyniku AI', () => {
  const result = resolveStudentsForAiSummary({
    formGroupId: 'grp_jacobs',
    currentStudentIds: ['usr_e'],
    currentPrimaryStudentId: 'usr_e',
    aiStudentIds: ['usr_a'],
  });
  assert.deepEqual(result, { studentIds: ['usr_e'], primaryStudentId: 'usr_e' });
});

test('grupa PRZED AI: brak aktywnych członków → pusta lista, nie kursant z AI', () => {
  const result = resolveStudentsForAiSummary({
    formGroupId: 'grp_jacobs',
    currentStudentIds: [],
    currentPrimaryStudentId: '',
    aiStudentIds: ['usr_outsider'],
  });
  assert.deepEqual(result, { studentIds: [], primaryStudentId: '' });
});

test('bez grupy: kursanci z AI jak dotąd', () => {
  const result = resolveStudentsForAiSummary({
    formGroupId: '',
    currentStudentIds: ['usr_a'],
    currentPrimaryStudentId: 'usr_a',
    aiStudentIds: ['usr_x', 'usr_y'],
  });
  assert.deepEqual(result, { studentIds: ['usr_x', 'usr_y'], primaryStudentId: 'usr_x' });
});

test('AI PRZED grupą: wynik AI, potem wybór grupy w dropdownie → członkowie grupy (bez zmian)', () => {
  // 1. AI zastosowane bez grupy.
  const afterAi = resolveStudentsForAiSummary({
    formGroupId: '',
    currentStudentIds: [],
    currentPrimaryStudentId: '',
    aiStudentIds: ['usr_outsider'],
  });
  assert.deepEqual(afterAi.studentIds, ['usr_outsider']);
  // 2. Dropdown grupy: ta sama funkcja co przy „+ Lekcja" z karty grupy.
  const afterGroup = buildGroupLessonFormPreset(jacobs, users);
  assert.deepEqual(afterGroup.studentIds, ['usr_a', 'usr_e']);
  assert.equal(afterGroup.groupId, 'grp_jacobs');
});

/**
 * Źródło „Z historii lekcji" w kreatorze prac domowych, tryb „Grupa".
 */

test('buildGroupSourceLessons: grupa z dwiema lekcjami grupowymi — po jednej pozycji na lekcję, od najnowszej', () => {
  const records = [
    copy('usr_a', { id: 'a1', groupLessonId: 'gl-old', date: '2026-09-25', topic: 'Old topic' }),
    copy('usr_b', { id: 'b1', groupLessonId: 'gl-old', date: '2026-09-25', topic: 'Old topic' }),
    copy('usr_a', { id: 'a2', groupLessonId: 'gl-new', date: '2026-10-02' }),
    copy('usr_b', { id: 'b2', groupLessonId: 'gl-new', date: '2026-10-02' }),
  ];
  const lessons = buildGroupSourceLessons(records, 'grp_jacobs');
  assert.deepEqual(lessons.map((l) => l.id), ['gl-new', 'gl-old']);
  assert.equal(lessons[0].topic, 'To Be and Present Simple: My Workday');
});

test('buildGroupSourceLessons: grupa bez lekcji z groupId — pusta lista (lekcje innej grupy i bez tagu nie wchodzą)', () => {
  const records = [
    copy('usr_a', { groupId: 'grp_other', groupName: 'Inna' }),
    copy('usr_a', { id: 'untagged', groupId: undefined, groupLessonId: undefined }),
    copy('usr_b', { id: 'no_glid', groupLessonId: undefined }),
  ];
  assert.deepEqual(buildGroupSourceLessons(records, 'grp_jacobs'), []);
  assert.deepEqual(buildGroupSourceLessons([], 'grp_jacobs'), []);
});

test('buildGroupSourceLessons: rozjechane kopie — treść z kopii o najnowszym updatedAt', () => {
  const records = [
    copy('usr_a', { id: 'a1', vocabularyText: 'stara wersja', updatedAt: '2026-10-02T15:20:00.000Z' } as any),
    copy('usr_b', { id: 'b1', vocabularyText: 'poprawiona wersja', updatedAt: '2026-10-03T09:00:00.000Z' } as any),
  ];
  const lessons = buildGroupSourceLessons(records, 'grp_jacobs');
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].id, GLID);
  assert.equal(lessons[0].vocabularyText, 'poprawiona wersja');
});

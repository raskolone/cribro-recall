import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGroup } from '../types/group';

/**
 * SLICE 1 (grupy — unifikacja modelu): `normalizeGroup` jest jedynym miejscem,
 * które widoki mogą użyć do odczytu dokumentu grupy — musi znosić dokument
 * kanoniczny, legacy `StudentGroup` i dane uszkodzone/puste bez rzucania.
 */

test('normalizeGroup: dokument kanoniczny (memberProfileIds/teacherProfileId) przechodzi bez zmian', () => {
  const group = normalizeGroup({
    id: 'grp_1',
    name: 'Business English B2',
    teacherProfileId: 'usr_teacher',
    status: 'active',
    level: 'B2',
    company: 'Acme Corp',
    memberProfileIds: ['usr_a', 'usr_b'],
    activeScratchpadId: 'sp_group_grp_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  assert.equal(group.id, 'grp_1');
  assert.equal(group.teacherProfileId, 'usr_teacher');
  assert.deepEqual(group.memberProfileIds, ['usr_a', 'usr_b']);
  assert.equal(group.company, 'Acme Corp');
  assert.equal(group.activeScratchpadId, 'sp_group_grp_1');
});

test('normalizeGroup: dokument legacy (memberIds/teacherId) mapuje się na pola kanoniczne', () => {
  const group = normalizeGroup({
    id: 'grp_legacy',
    name: 'Grupa Jacobs',
    teacherId: 'usr_teacher_legacy',
    type: 'group',
    level: 'C1',
    memberIds: ['usr_x', 'usr_y'],
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(group.teacherProfileId, 'usr_teacher_legacy');
  assert.deepEqual(group.memberProfileIds, ['usr_x', 'usr_y']);
  assert.equal(group.name, 'Grupa Jacobs');
});

test('normalizeGroup: dokument pusty lub uszkodzony nie rzuca i zwraca bezpieczne domyślne wartości', () => {
  assert.doesNotThrow(() => normalizeGroup(null));
  assert.doesNotThrow(() => normalizeGroup(undefined));
  assert.doesNotThrow(() => normalizeGroup({}));
  assert.doesNotThrow(() => normalizeGroup('not-an-object'));
  assert.doesNotThrow(() => normalizeGroup({ memberProfileIds: 'not-an-array', memberIds: [123, null, 'usr_ok'] }));

  const empty = normalizeGroup(null);
  assert.equal(empty.id, '');
  assert.deepEqual(empty.memberProfileIds, []);
  assert.equal(empty.status, 'active');

  const corrupted = normalizeGroup({ memberProfileIds: 'not-an-array', memberIds: [123, null, 'usr_ok'] });
  assert.deepEqual(corrupted.memberProfileIds, ['usr_ok']);
});

test('normalizeGroup: status inny niż "archived" zawsze normalizuje się do "active"', () => {
  assert.equal(normalizeGroup({ status: 'archived' }).status, 'archived');
  assert.equal(normalizeGroup({ status: 'weird' }).status, 'active');
  assert.equal(normalizeGroup({}).status, 'active');
});

test('normalizeGroup: puste pola opcjonalne (company/activeScratchpadId) nie trafiają do wyniku', () => {
  const group = normalizeGroup({ id: 'grp_2', name: 'Grupa', company: '   ', activeScratchpadId: '' });
  assert.ok(!('company' in group));
  assert.ok(!('activeScratchpadId' in group));
});

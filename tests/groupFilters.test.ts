import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findLegacyGroupUserIdsCoveredByCanonical,
  filterCanonicalGroupsForCrm,
  filterGroupsForPicker,
} from '../utils/groupFilters';
import { normalizeGroup } from '../types/group';

/**
 * SLICE 1 domknięcie — CRM (StandaloneStudentDatabaseScreen) pokazywał 0
 * rekordów dla grup kanonicznych, bo "Moi kursanci & Grupy" buduje listę
 * wyłącznie z `users/{uid}` (isGroup), nigdy z kolekcji `groups`. Pasek
 * wyboru notatnika (ScratchpadStudentPicker) miał sekcję "Grupy zajęciowe"
 * w kodzie, ale `teacherGroups` w AdminPanel.tsx nigdy się nie wypełniał
 * (legacy `getGroups()` bez filtra — permission-denied dla nie-admina,
 * cicho połykane). Te testy pokrywają czyste funkcje filtrujące wydzielone
 * z obu komponentów.
 */

const makeGroup = (overrides: Partial<ReturnType<typeof normalizeGroup>> = {}) =>
  normalizeGroup({
    id: 'grp_1',
    name: 'Jacobs_test',
    teacherProfileId: 'usr_teacher',
    status: 'active',
    level: 'B2',
    memberProfileIds: ['usr_a', 'usr_b'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

test('findLegacyGroupUserIdsCoveredByCanonical: dopasowanie po ID', () => {
  const users = [{ id: 'grp_1', isGroup: true, name: 'Jacobs_test' }];
  const covered = findLegacyGroupUserIdsCoveredByCanonical(users, [makeGroup()]);
  assert.ok(covered.has('grp_1'));
});

test('findLegacyGroupUserIdsCoveredByCanonical: dopasowanie po nazwie (bez rozróżniania wielkości liter/spacji)', () => {
  const users = [{ id: 'legacy_xyz', isGroup: true, displayName: '  jacobs_test  ' }];
  const covered = findLegacyGroupUserIdsCoveredByCanonical(users, [makeGroup({ id: 'grp_1', name: 'Jacobs_test' })]);
  assert.ok(covered.has('legacy_xyz'));
});

test('findLegacyGroupUserIdsCoveredByCanonical: kursant indywidualny nigdy nie trafia do zbioru', () => {
  const users = [{ id: 'usr_a', isGroup: false, name: 'Jacobs_test' }];
  const covered = findLegacyGroupUserIdsCoveredByCanonical(users, [makeGroup()]);
  assert.equal(covered.size, 0);
});

test('findLegacyGroupUserIdsCoveredByCanonical: legacy grupa bez odpowiednika kanonicznego zostaje (nie jest dedupikowana)', () => {
  const users = [{ id: 'legacy_only', isGroup: true, name: 'Stara para Kowalski/Nowak' }];
  const covered = findLegacyGroupUserIdsCoveredByCanonical(users, [makeGroup()]);
  assert.equal(covered.size, 0);
});

test('findLegacyGroupUserIdsCoveredByCanonical: puste/uszkodzone wejście nie rzuca', () => {
  assert.doesNotThrow(() => findLegacyGroupUserIdsCoveredByCanonical([], []));
  assert.doesNotThrow(() => findLegacyGroupUserIdsCoveredByCanonical(null as any, null as any));
  assert.doesNotThrow(() => findLegacyGroupUserIdsCoveredByCanonical([{}], [makeGroup()]));
});

test('filterCanonicalGroupsForCrm: zakładka "Grupy & Pary" (group) zwraca grupę', () => {
  const result = filterCanonicalGroupsForCrm([makeGroup()], 'group', '');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Jacobs_test');
});

test('filterCanonicalGroupsForCrm: zakładka "Wszyscy" (all) też zwraca grupę', () => {
  assert.equal(filterCanonicalGroupsForCrm([makeGroup()], 'all', '').length, 1);
});

test('filterCanonicalGroupsForCrm: zakładka "Indywidualni (1:1)" nigdy nie pokazuje grup', () => {
  assert.deepEqual(filterCanonicalGroupsForCrm([makeGroup()], 'individual', ''), []);
});

test('filterCanonicalGroupsForCrm: zakładka "Aktywni" filtruje po statusie', () => {
  const active = makeGroup({ id: 'grp_active', status: 'active' });
  const archived = makeGroup({ id: 'grp_archived', status: 'archived' });
  const result = filterCanonicalGroupsForCrm([active, archived], 'active', '');
  assert.deepEqual(result.map((g) => g.id), ['grp_active']);
});

test('filterCanonicalGroupsForCrm: wyszukiwanie po nazwie, firmie i poziomie', () => {
  const group = makeGroup({ name: 'Jacobs_test', company: 'Acme Corp', level: 'C1' });
  assert.equal(filterCanonicalGroupsForCrm([group], 'all', 'jaco').length, 1);
  assert.equal(filterCanonicalGroupsForCrm([group], 'all', 'acme').length, 1);
  assert.equal(filterCanonicalGroupsForCrm([group], 'all', 'c1').length, 1);
  assert.equal(filterCanonicalGroupsForCrm([group], 'all', 'nieistniejące').length, 0);
});

test('filterGroupsForPicker: pusta fraza zwraca wszystkie grupy (sekcja "Grupy" w pasku wyboru)', () => {
  const groups = [makeGroup({ id: 'grp_1' }), makeGroup({ id: 'grp_2', name: 'Business B2B' })];
  assert.equal(filterGroupsForPicker(groups, '').length, 2);
});

test('filterGroupsForPicker: filtruje po nazwie, bez rozróżniania wielkości liter', () => {
  const groups = [makeGroup({ name: 'Jacobs_test' }), makeGroup({ id: 'grp_2', name: 'Business B2B' })];
  const result = filterGroupsForPicker(groups, 'JACO');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Jacobs_test');
});

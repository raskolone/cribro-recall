import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStudentNotebookEntries, type StudentGroupInput } from '../utils/studentNotebookEntries';

/**
 * Strona główna kursanta: jedno wejście do notatnika grupy zamiast paska +
 * kafelka, bez grup zarchiwizowanych; notatnik indywidualny przechodzi do
 * „Moich zasobów", gdy kursant ma aktywną grupę.
 */

const group = (id: string, overrides: Partial<StudentGroupInput> = {}): StudentGroupInput => ({
  id,
  name: id,
  status: 'active',
  hasNotebook: true,
  ...overrides,
});

test('kursant bez grupy: sam notatnik indywidualny, bez zmian', () => {
  assert.deepEqual(resolveStudentNotebookEntries([]), {
    tiles: [{ kind: 'individual' }],
    individualNotebookInResources: false,
  });
});

test('jedna aktywna grupa: kafelek grupy zamiast indywidualnego, indywidualny w zasobach', () => {
  assert.deepEqual(resolveStudentNotebookEntries([group('g1', { name: 'Jacobs_test' })]), {
    tiles: [{ kind: 'group', groupId: 'g1', name: 'Jacobs_test' }],
    individualNotebookInResources: true,
  });
});

test('jedna zarchiwizowana grupa: jak kursant bez grupy', () => {
  assert.deepEqual(resolveStudentNotebookEntries([group('g1', { status: 'archived' })]), {
    tiles: [{ kind: 'individual' }],
    individualNotebookInResources: false,
  });
});

test('aktywna i zarchiwizowana: tylko aktywna', () => {
  const result = resolveStudentNotebookEntries([
    group('old', { name: 'Jacobs', status: 'archived' }),
    group('new', { name: 'Jacobs_test' }),
  ]);
  assert.deepEqual(result, {
    tiles: [{ kind: 'group', groupId: 'new', name: 'Jacobs_test' }],
    individualNotebookInResources: true,
  });
});

test('dwie aktywne grupy: po kafelku na grupę, posortowane po nazwie', () => {
  const result = resolveStudentNotebookEntries([
    group('b', { name: 'Beta' }),
    group('a', { name: 'Alfa' }),
  ]);
  assert.deepEqual(result.tiles, [
    { kind: 'group', groupId: 'a', name: 'Alfa' },
    { kind: 'group', groupId: 'b', name: 'Beta' },
  ]);
  assert.equal(result.individualNotebookInResources, true);
});

test('aktywna grupa bez notatnika nie daje kafelka i nie zabiera indywidualnego', () => {
  assert.deepEqual(resolveStudentNotebookEntries([group('g1', { hasNotebook: false })]), {
    tiles: [{ kind: 'individual' }],
    individualNotebookInResources: false,
  });
});

test('aktywna grupa bez notatnika obok aktywnej z notatnikiem: tylko ta z notatnikiem', () => {
  const result = resolveStudentNotebookEntries([
    group('empty', { name: 'A', hasNotebook: false }),
    group('full', { name: 'B' }),
  ]);
  assert.deepEqual(result.tiles, [{ kind: 'group', groupId: 'full', name: 'B' }]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNewGroupPayload, MissingTeacherProfileError } from '../utils/groupPayload';

/**
 * Regresja dla "Cannot use 'undefined' as a Firestore value (teacherProfileId)":
 * requireFirebaseAdmin ustawia (req as any).adminUid, nie userUid — endpoint
 * POST /api/groups czytał złe pole i wysyłał do Firestore payload z
 * teacherProfileId: undefined.
 */

test('brak identyfikatora lektora -> jawny błąd, brak payloadu', () => {
  assert.throws(
    () => buildNewGroupPayload(undefined, 'grp_1', { name: 'Test' }, '2026-09-28T00:00:00.000Z'),
    MissingTeacherProfileError
  );
  assert.throws(
    () => buildNewGroupPayload('', 'grp_1', { name: 'Test' }, '2026-09-28T00:00:00.000Z'),
    MissingTeacherProfileError
  );
});

test('poprawny identyfikator lektora -> zapis bez pól undefined', () => {
  const payload = buildNewGroupPayload(
    'teacher_123',
    'grp_1',
    { name: '  Business English B2  ', level: 'B2', memberProfileIds: ['usr_a', 'usr_a', ' usr_b '] },
    '2026-09-28T00:00:00.000Z'
  );

  assert.equal(payload.teacherProfileId, 'teacher_123');
  assert.equal(payload.name, 'Business English B2');
  assert.deepEqual(payload.memberProfileIds, ['usr_a', 'usr_b']);
  assert.equal(payload.status, 'active');

  // Firestore .set() odrzuca dowolne pole z wartością undefined — sprawdzamy
  // to bezpośrednio, żeby regresja tego typu nie wróciła przez inne pole.
  for (const [key, value] of Object.entries(payload)) {
    assert.notEqual(value, undefined, `Pole "${key}" nie powinno być undefined`);
  }
  assert.ok(!('company' in payload), 'Puste pole company nie powinno w ogóle trafić do payloadu');
  assert.ok(!('activeScratchpadId' in payload), 'Puste pole activeScratchpadId nie powinno trafić do payloadu');
});

test('opcjonalne pola trafiają do payloadu tylko, gdy mają realną wartość', () => {
  const payload = buildNewGroupPayload(
    'teacher_123',
    'grp_2',
    { name: 'Grupa B2B', company: '  Acme Corp  ', activeScratchpadId: ' sp_1 ' },
    '2026-09-28T00:00:00.000Z'
  );

  assert.equal(payload.company, 'Acme Corp');
  assert.equal(payload.activeScratchpadId, 'sp_1');
});

test('domyślny poziom to B2, gdy nie podano', () => {
  const payload = buildNewGroupPayload('teacher_123', 'grp_3', { name: 'Grupa' }, '2026-09-28T00:00:00.000Z');
  assert.equal(payload.level, 'B2');
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRawId, formatStudentDisplayName, formatStudentFirstName } from '../utils/studentFormat';

describe('studentFormat utility', () => {
  it('correctly detects Firebase Auth UID as raw ID', () => {
    assert.equal(isRawId('MOojhPA5hhXZmGZtJoyr4JJfvWv2'), true);
    assert.equal(isRawId('abcde12345ABCDE1234567'), true);
    assert.equal(isRawId('52e0cde3-26fe-4c43-900a-f43c653075f0'), true);
  });

  it('correctly identifies normal human names and labels as not raw ID', () => {
    assert.equal(isRawId('Maciej Wyrozumski'), false);
    assert.equal(isRawId('Bartłomiej'), false);
    assert.equal(isRawId('anna_nowak'), false);
    assert.equal(isRawId('Kursant'), false);
    assert.equal(isRawId(''), false);
    assert.equal(isRawId(undefined), false);
    assert.equal(isRawId(null), false);
  });

  it('formatStudentDisplayName formats full name when available', () => {
    const user = { firstName: 'Jan', lastName: 'Kowalski' };
    assert.equal(formatStudentDisplayName(user), 'Jan Kowalski');
  });

  it('formatStudentDisplayName falls back to username or displayName', () => {
    const user = { username: 'jankowalski' };
    assert.equal(formatStudentDisplayName(user), 'jankowalski');
  });

  it('formatStudentDisplayName NEVER returns raw UID even if passed as fallbackName or username', () => {
    const rawUid = 'MOojhPA5hhXZmGZtJoyr4JJfvWv2';
    // User with raw UID as username
    const user = { username: rawUid };
    assert.equal(formatStudentDisplayName(user, rawUid), 'Kursant');

    // No user, only raw UID fallback
    assert.equal(formatStudentDisplayName(null, rawUid), 'Kursant');
    assert.equal(formatStudentDisplayName(undefined, rawUid, 'Uczeń'), 'Uczeń');
  });

  it('formatStudentDisplayName uses clean fallbackName when user is null', () => {
    assert.equal(formatStudentDisplayName(null, 'Anna Nowak'), 'Anna Nowak');
  });

  it('formatStudentFirstName extracts only first name and capitalizes it', () => {
    assert.equal(formatStudentFirstName({ firstName: 'Jan', lastName: 'Kowalski' }), 'Jan');
    assert.equal(formatStudentFirstName(null, 'Maciej Wyrozumski'), 'Maciej');
    assert.equal(formatStudentFirstName(null, 'milena.miksa-matyjasik'), 'Milena');
    assert.equal(formatStudentFirstName(null, 'anna_nowak'), 'Anna');
    assert.equal(formatStudentFirstName({ username: 'piotrek' }), 'Piotrek');
    assert.equal(formatStudentFirstName(null, 'MOojhPA5hhXZmGZtJoyr4JJfvWv2', 'Kursant'), 'Kursant');
  });
});


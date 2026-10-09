import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatHomeworkStatus } from '../utils/homeworkStatus';

describe('formatHomeworkStatus', () => {
  it('mapuje znane statusy na czytelne polskie etykiety', () => {
    assert.equal(formatHomeworkStatus('submitted', 'pl'), 'Do sprawdzenia');
    assert.equal(formatHomeworkStatus('graded', 'pl'), 'Sprawdzona');
    assert.equal(formatHomeworkStatus('completed', 'pl'), 'Sprawdzona');
    assert.equal(formatHomeworkStatus('pending', 'pl'), 'W trakcie');
    assert.equal(formatHomeworkStatus('assigned', 'pl'), 'W trakcie');
  });

  it('mapuje statusy na język angielski przy language="en"', () => {
    assert.equal(formatHomeworkStatus('submitted', 'en'), 'To review');
    assert.equal(formatHomeworkStatus('graded', 'en'), 'Graded');
    assert.equal(formatHomeworkStatus('completed', 'en'), 'Completed');
    assert.equal(formatHomeworkStatus('pending', 'en'), 'In progress');
    assert.equal(formatHomeworkStatus('assigned', 'en'), 'In progress');
  });

  it('dla nieznanego statusu zwraca surową wartość bez zmian', () => {
    assert.equal(formatHomeworkStatus('custom_status', 'pl'), 'custom_status');
    assert.equal(formatHomeworkStatus('archived_draft', 'en'), 'archived_draft');
  });

  it('dla pustych, null lub undefined wartości zwraca pusty string', () => {
    assert.equal(formatHomeworkStatus(null, 'pl'), '');
    assert.equal(formatHomeworkStatus(undefined, 'pl'), '');
    assert.equal(formatHomeworkStatus('', 'pl'), '');
  });

  it('jest odporny na wielkość liter i białe znaki w kluczu', () => {
    assert.equal(formatHomeworkStatus('  SUBMITTED  ', 'pl'), 'Do sprawdzenia');
    assert.equal(formatHomeworkStatus('Graded', 'pl'), 'Sprawdzona');
  });
});

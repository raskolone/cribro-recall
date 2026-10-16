import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoEmailNewHomework } from '../functions/src/homeworkEmailGate';

test('zwykła praca z kreatora bez flag wstrzymania -> mail wychodzi (zachowanie bez zmian)', () => {
  assert.deepEqual(shouldAutoEmailNewHomework({ studentUid: 'u1', title: 'Praca' }), { send: true });
});

test('flagi ręcznego potwierdzenia / wstrzymania / już wysłano -> bez maila (zachowanie bez zmian)', () => {
  for (const flags of [
    { manualEmailConfirmationRequired: true },
    { skipAutoEmail: true },
    { emailNotificationSent: true },
  ]) {
    assert.deepEqual(shouldAutoEmailNewHomework({ studentUid: 'u1', ...flags }), {
      send: false,
      reason: 'manual_confirmation_or_skipped',
    });
  }
});

test('praca z serii bez potwierdzonych automatycznych maili -> bez maila, nawet przy przepuszczających flagach', () => {
  const base = { studentUid: 'u1', seriesId: 'series_1', skipAutoEmail: false, manualEmailConfirmationRequired: false, emailNotificationSent: false };
  assert.deepEqual(shouldAutoEmailNewHomework(base), { send: false, reason: 'series_auto_email_not_confirmed' });
  assert.deepEqual(shouldAutoEmailNewHomework({ ...base, seriesAutoEmailConfirmed: false }), {
    send: false,
    reason: 'series_auto_email_not_confirmed',
  });
  assert.deepEqual(shouldAutoEmailNewHomework({ ...base, seriesAutoEmailConfirmed: 'true' }), {
    send: false,
    reason: 'series_auto_email_not_confirmed',
  });
});

test('praca z serii z potwierdzonymi automatycznymi mailami -> mail wychodzi', () => {
  assert.deepEqual(
    shouldAutoEmailNewHomework({
      studentUid: 'u1',
      seriesId: 'series_1',
      seriesAutoEmailConfirmed: true,
      skipAutoEmail: false,
      manualEmailConfirmationRequired: false,
      emailNotificationSent: false,
    }),
    { send: true }
  );
});

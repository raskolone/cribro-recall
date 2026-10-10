import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, createUser, ADMIN_EMAIL, type RouteHarness } from './harness';

let h: RouteHarness;
before(async () => { h = await startHarness(); });
after(async () => { await h.close(); });

// Dymny test samego harnessu: istniejąca trasa administracyjna musi dawać 401 / 403 / OK.
test('harness: istniejąca trasa requireFirebaseAdmin — brak tokenu 401, kursant 403, admin 200', async () => {
  const student = await createUser(h.db, { role: 'user' });
  const admin = await createUser(h.db, { email: ADMIN_EMAIL, role: 'admin' });
  assert.equal((await h.call('GET', '/api/mailing/status')).status, 401);
  assert.equal((await h.call('GET', '/api/mailing/status', { token: student.token })).status, 403);
  assert.equal((await h.call('GET', '/api/mailing/status', { token: admin.token })).status, 200);
});

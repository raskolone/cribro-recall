import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('server.ts rejestruje trasy serii przez registerHomeworkSeriesRoutes z requireFirebaseAdmin', () => {
  const src = read('server.ts');
  assert.match(src, /registerHomeworkSeriesRoutes\(app, \{\s*requireTeacher: requireFirebaseAdmin,/);
  assert.match(src, /getCronSecret: \(\) => process\.env\.CRON_SECRET/);
  // Stary, bezpośredni układ tras (cron za `/:id`) nie może wrócić do server.ts.
  assert.equal(/app\.(get|post)\('\/api\/homework-series/.test(src), false);
  // Zachowanie tras (kolejność cron przed `/:id`) sprawdza tests/homeworkSeriesCronRoute.test.ts
  // na prawdziwym routerze Expressa.
});

test('vercel.json definiuje harmonogram crona: 0 5 * * * (05:00 UTC codziennie)', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(Array.isArray(vercel.crons), 'vercel.json musi zawierać tablicę crons');
  assert.equal(vercel.crons.length, 1);
  assert.equal(vercel.crons[0].path, '/api/homework-series/cron-release');
  assert.equal(vercel.crons[0].schedule, '0 5 * * *');
});

test('.env.example dokumentuje zmienną CRON_SECRET dla Vercela', () => {
  const env = read('.env.example');
  assert.match(env, /CRON_SECRET=/);
  assert.match(env, /Bearer <CRON_SECRET>/);
});

test('reguły firestore.rules i storage.rules pozostają NIETKNIĘTE (zero client access)', () => {
  const fRules = read('firestore.rules');
  const sRules = read('storage.rules');
  assert.equal(fRules.includes('homeworkSeries'), false, 'homeworkSeries nie może mieć reguły klienckiej');
  assert.equal(sRules.includes('homeworkSeries'), false);
});

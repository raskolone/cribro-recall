import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { registerHomeworkSeriesRoutes } from '../utils/homeworkSeriesRoutes';
import { handleCreateSeries } from '../utils/homeworkSeriesHandler';
import { InMemorySeriesDb } from './helpers/inMemorySeriesDb';

/**
 * P0 z S1: `GET /api/homework-series/:id` (requireFirebaseAdmin) był rejestrowany przed
 * `GET …/cron-release`, więc wywołanie Vercel Cron (GET + `Bearer <CRON_SECRET>`) trafiało
 * do weryfikacji tokenu Firebase i dostawało 401 — seria nigdy by się nie wydała.
 *
 * Testy idą przez PRAWDZIWY router Expressa (żądania HTTP), nie przez wyrażenia regularne
 * na źródle: (1) moduł tras z fałszywą bazą — pełny przebieg z poprawnym sekretem,
 * (2) prawdziwy createApp() z server.ts — wyłącznie z BŁĘDNYM sekretem, więc żadna ścieżka
 * nie dotyka bazy; rozstrzyga, który handler odpowiedział, po treści błędu.
 */

const CRON_SECRET = 'cron_test_secret_7f3a';
const TEACHER_TOKEN = 'teacher-token';

const listen = async (app: express.Express): Promise<{ server: Server; base: string }> => {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

const call = async (base: string, method: string, path: string, auth?: string) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(auth ? { Authorization: auth } : {}), 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  });
  return { status: res.status, body: await res.json() };
};

// ---------------------------------------------------------------------------
// 1. Moduł tras na prawdziwym routerze Expressa, fałszywa baza
// ---------------------------------------------------------------------------

let db: InMemorySeriesDb;
let base: string;
let server: Server;
let teacherGuardHits = 0;
let dbAccesses = 0;
let cronSecret: string | undefined = CRON_SECRET;

before(async () => {
  db = new InMemorySeriesDb();
  db.data.set('users/student_1', { role: 'user' });
  const created = await handleCreateSeries(
    // Zegar tworzenia przed slotem: serwer odrzuca sloty na dziś i z przeszłości.
    { db, now: () => new Date('2019-12-01T12:00:00.000Z') },
    {
      callerUid: 'teacher_1',
      body: {
        title: 'Seria',
        studentUid: 'student_1',
        ownerUid: 'teacher_1',
        // Slot z przeszłości — gotowy przy każdej dacie uruchomienia testu.
        items: [{ itemId: 'item_1', slotDate: '2020-01-01', dueInDays: 3 }],
        itemPayloads: {
          item_1: {
            type: 'translation',
            sentences: [{ id: '1', polishSentence: 'Pies', englishTranslation: 'Dog', type: 'translation' }],
          },
        },
      },
    }
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const app = express();
  app.use(express.json());
  // Zachowuje się jak requireFirebaseAdmin: 401 dla wszystkiego, co nie jest tokenem lektora.
  const requireTeacher: express.RequestHandler = (req, res, next) => {
    teacherGuardHits++;
    if (req.headers.authorization !== `Bearer ${TEACHER_TOKEN}`) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    (req as any).adminUid = 'teacher_1';
    next();
  };
  registerHomeworkSeriesRoutes(app, {
    requireTeacher,
    getDb: () => {
      dbAccesses++;
      return db;
    },
    getCronSecret: () => cronSecret,
  });
  ({ server, base } = await listen(app));
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const resetCounters = () => {
  teacherGuardHits = 0;
  dbAccesses = 0;
};

test('GET cron-release z Bearer <CRON_SECRET> trafia do crona (nie do requireFirebaseAdmin) i wydaje slot', async () => {
  resetCounters();
  const r = await call(base, 'GET', '/api/homework-series/cron-release', `Bearer ${CRON_SECRET}`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.success, true);
  assert.equal(r.body.releasedCount, 1);
  assert.equal(teacherGuardHits, 0, 'trasa /:id z requireFirebaseAdmin nie może przechwycić crona');
  assert.equal(
    Array.from(db.data.keys()).filter((k) => k.startsWith('specialTasks/')).length,
    1,
    'praca powstała w bazie'
  );
});

test('POST cron-release też działa (ręczne wywołanie), ponowne uruchomienie nic nie dubluje', async () => {
  resetCounters();
  const r = await call(base, 'POST', '/api/homework-series/cron-release', `Bearer ${CRON_SECRET}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.releasedCount, 0);
  assert.equal(teacherGuardHits, 0);
});

test('błędny lub brakujący sekret: 401 z handlera crona, bez dotykania bazy', async () => {
  resetCounters();
  const wrong = await call(base, 'GET', '/api/homework-series/cron-release', 'Bearer nope');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'Invalid CRON_SECRET');
  const missing = await call(base, 'GET', '/api/homework-series/cron-release');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error, 'Missing Bearer token');
  assert.equal(teacherGuardHits, 0);
  assert.equal(dbAccesses, 0);
});

test('brak CRON_SECRET na serwerze: 500, bez dotykania bazy', async () => {
  resetCounters();
  cronSecret = undefined;
  try {
    const r = await call(base, 'GET', '/api/homework-series/cron-release', `Bearer ${CRON_SECRET}`);
    assert.equal(r.status, 500);
    assert.match(r.body.error, /CRON_SECRET is not configured/);
    assert.equal(dbAccesses, 0);
  } finally {
    cronSecret = CRON_SECRET;
  }
});

test('trasy lektora nadal za requireFirebaseAdmin: sekret crona nie otwiera /:id', async () => {
  resetCounters();
  const asCron = await call(base, 'GET', '/api/homework-series/series_x', `Bearer ${CRON_SECRET}`);
  assert.equal(asCron.status, 401);
  assert.equal(teacherGuardHits, 1);

  const seriesId = Array.from(db.data.keys())
    .find((k) => /^homeworkSeries\/[^/]+$/.test(k))!
    .split('/')[1];
  const asTeacher = await call(base, 'GET', `/api/homework-series/${seriesId}`, `Bearer ${TEACHER_TOKEN}`);
  assert.equal(asTeacher.status, 200);
  assert.equal(asTeacher.body.series.id, seriesId);
});

// ---------------------------------------------------------------------------
// 2. Prawdziwy createApp() z server.ts — kolejność rejestracji w aplikacji produkcyjnej
// ---------------------------------------------------------------------------

test('createApp(): GET i POST cron-release odpowiada handler crona, GET /:id — requireFirebaseAdmin', async () => {
  // Bezpieczniki, bo createApp() przy starcie sam czyta `system/ai` przez Admin SDK:
  // (1) projekt demo i nieosiągalny emulator zamiast domyślnego projektu z ADC,
  // (2) wszystkie operacje Firestore odrzucane od razu na prototypach — żaden odczyt
  //     ani zapis nie wychodzi z procesu, a test nie czeka na ponawianie połączenia.
  // Wołamy wyłącznie BŁĘDNYM sekretem, więc handler crona i tak nie sięga po bazę.
  process.env.GOOGLE_CLOUD_PROJECT = 'demo-cribro';
  process.env.FIREBASE_PROJECT_ID = 'demo-cribro';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9';
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  process.env.CRON_SECRET = CRON_SECRET;

  const firestore = await import('firebase-admin/firestore');
  const deny = () => Promise.reject(new Error('test: Firestore zablokowany w teście tras'));
  const blocked: Array<[any, string[]]> = [
    [firestore.DocumentReference, ['get', 'set', 'update', 'delete', 'create']],
    [firestore.Query, ['get']],
    [firestore.CollectionReference, ['add']],
    [firestore.Firestore, ['runTransaction', 'getAll']],
  ];
  for (const [cls, methods] of blocked) {
    for (const m of methods) cls.prototype[m] = deny;
  }

  const { createApp } = await import('../server');
  const real = await listen(createApp());
  try {
    for (const method of ['GET', 'POST']) {
      const r = await call(real.base, method, '/api/homework-series/cron-release', 'Bearer definitely-not-the-secret');
      assert.equal(r.status, 401);
      assert.equal(
        r.body.error,
        'Invalid CRON_SECRET',
        `${method} cron-release musi trafić do handlera crona, nie do requireFirebaseAdmin (dostał: ${JSON.stringify(r.body)})`
      );
    }

    const byId = await call(real.base, 'GET', '/api/homework-series/some-series', 'Bearer definitely-not-the-secret');
    assert.equal(byId.status, 401);
    assert.notEqual(byId.body.error, 'Invalid CRON_SECRET', 'trasa /:id obsługiwana przez requireFirebaseAdmin');
  } finally {
    real.server.closeAllConnections?.();
    await new Promise<void>((resolve) => real.server.close(() => resolve()));
  }
});

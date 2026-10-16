import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleCreateSeries,
  handleCronRelease,
  handleGetSeries,
  handleListSeries,
  handleReleaseNow,
  releaseSingleSeriesItem,
  verifyCronSecret,
} from '../utils/homeworkSeriesHandler';
import { buildSeriesTaskId } from '../utils/homeworkSeries';
import { InMemorySeriesDb as InMemoryDb } from './helpers/inMemorySeriesDb';

test('DECYZJA 7: verifyCronSecret autoryzuje Bearer stałoczasowo i zwraca 500 przy braku zmiennej', () => {
  // Brak zmiennej na serwerze -> 500 bez wykonania
  assert.equal(verifyCronSecret('Bearer abc', undefined).status, 500);
  assert.equal(verifyCronSecret('Bearer abc', '').status, 500);

  // Brak nagłówka -> 401
  assert.equal(verifyCronSecret(undefined, 'my_secret_123').status, 401);
  assert.equal(verifyCronSecret('Basic abc', 'my_secret_123').status, 401);

  // Błędny sekret -> 401
  assert.equal(verifyCronSecret('Bearer wrong', 'my_secret_123').status, 401);
  assert.equal(verifyCronSecret('Bearer my_secret_1234', 'my_secret_123').status, 401);

  // Poprawny sekret -> 200
  assert.equal(verifyCronSecret('Bearer my_secret_123', 'my_secret_123').status, 200);
});

test('DECYZJA 7: handleCreateSeries i handleGetSeries pilnują ownerUid (inny lektor 403)', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 'secret' };

  const validBody = {
    title: 'Seria 1',
    studentUid: 'student_1',
    ownerUid: 'teacher_1',
    items: [
      { itemId: 'item_1', slotDate: '2026-10-15', dueInDays: 3 },
    ],
    itemPayloads: {
      item_1: {
        itemId: 'item_1',
        type: 'translation',
        sentences: [
          { id: '1', polishSentence: 'Cześć', englishTranslation: 'Hello', type: 'translation' },
        ],
      },
    },
  };

  // Próba podszycia się pod innego lektora w body -> 403
  const forgeRes = await handleCreateSeries(deps, {
    callerUid: 'teacher_2',
    body: validBody, // ownerUid: 'teacher_1'
  });
  assert.equal(forgeRes.status, 403);

  // Poprawne utworzenie przez teacher_1 -> 201
  const createRes = await handleCreateSeries(deps, {
    callerUid: 'teacher_1',
    body: validBody,
  });
  assert.equal(createRes.status, 201);
  const seriesId = createRes.body.series.id;

  // Inny lektor próbuje odczytać serię -> 403
  const getForbidden = await handleGetSeries(deps, {
    callerUid: 'teacher_2',
    seriesId,
  });
  assert.equal(getForbidden.status, 403);

  // Właściciel odczytuje serię -> 200
  const getOk = await handleGetSeries(deps, {
    callerUid: 'teacher_1',
    seriesId,
  });
  assert.equal(getOk.status, 200);
  assert.equal(getOk.body.series.title, 'Seria 1');
  assert.equal(getOk.body.itemsPayloads.item_1.type, 'translation');
});

test('DECYZJA 6: Idempotencja i test równoległych wydań tej samej pozycji (tylko 1 zadanie powołane)', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 'secret' };

  // Utwórz serię z 1 pozycją na dziś
  const createRes = await handleCreateSeries(deps, {
    callerUid: 'teacher_1',
    body: {
      title: 'Seria Idempotencja',
      studentUid: 'student_1',
      ownerUid: 'teacher_1',
      items: [
        { itemId: 'item_1', slotDate: '2026-10-10', dueInDays: 3 },
      ],
      itemPayloads: {
        item_1: {
          itemId: 'item_1',
          type: 'translation',
          sentences: [
            { id: '1', polishSentence: 'Pies', englishTranslation: 'Dog', type: 'translation' },
          ],
        },
      },
    },
  });

  const seriesId = createRes.body.series.id;
  const expectedTaskId = buildSeriesTaskId(seriesId, 'item_1');

  // RÓWNOLEGŁE wydanie tej samej pozycji przez dwa procesy/żądania
  const [res1, res2] = await Promise.all([
    releaseSingleSeriesItem(deps, {
      seriesId,
      itemId: 'item_1',
      todayWarsaw: '2026-10-10',
    }),
    releaseSingleSeriesItem(deps, {
      seriesId,
      itemId: 'item_1',
      todayWarsaw: '2026-10-10',
    }),
  ]);

  // Dokładnie jedno z wywołań dokonało wydania, drugie zostało pominięte bez błędu
  const oneSucceeded = res1.success && res2.success;
  assert.equal(oneSucceeded, true);
  const tasksCreated = [res1, res2].filter((r) => !r.skipped);
  assert.equal(tasksCreated.length, 1, 'Tylko jedno równoległe wywołanie tworzy zadanie');

  // Sprawdź czy w bazie powstał DOKŁADNIE jeden dokument pracy o deterministycznym ID
  const taskSnap = await db.collection('specialTasks').doc(expectedTaskId).get();
  assert.equal(taskSnap.exists, true);
  assert.equal(taskSnap.data().seriesId, seriesId);
  assert.equal(taskSnap.data().seriesItemId, 'item_1');
  assert.equal(taskSnap.data().status, 'pending');

  // Ponowne (kolejne) uruchomienie nic nie zmienia
  const res3 = await releaseSingleSeriesItem(deps, {
    seriesId,
    itemId: 'item_1',
    todayWarsaw: '2026-10-10',
  });
  assert.equal(res3.success, true);
  assert.equal(res3.skipped, true);
});

test('cron release: skanuje aktywne serie, wydaje gotowe pozycje i zamyka serię po wydaniu wszystkich', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 'cron_super_secret_123' };

  // Utwórz serię z 2 pozycjami: 1 zaległa, 1 przyszła
  const createRes = await handleCreateSeries(deps, {
    callerUid: 'teacher_1',
    body: {
      title: 'Seria Harmonogram',
      studentUid: 'student_1',
      ownerUid: 'teacher_1',
      items: [
        { itemId: 'item_1', slotDate: '2026-10-09', dueInDays: 3 }, // zaległa
        { itemId: 'item_2', slotDate: '2026-10-15', dueInDays: 3 }, // przyszła
      ],
      itemPayloads: {
        item_1: {
          itemId: 'item_1',
          type: 'translation',
          sentences: [
            { id: '1', polishSentence: 'Zadanie 1', englishTranslation: 'Task 1', type: 'translation' },
          ],
        },
        item_2: {
          itemId: 'item_2',
          type: 'translation',
          sentences: [
            { id: '1', polishSentence: 'Zadanie 2', englishTranslation: 'Task 2', type: 'translation' },
          ],
        },
      },
    },
  });

  const seriesId = createRes.body.series.id;

  // Uruchom crona na dzień 2026-10-10
  const cronRes1 = await handleCronRelease(deps, {
    authHeader: 'Bearer cron_super_secret_123',
    todayWarsaw: '2026-10-10',
  });

  assert.equal(cronRes1.status, 200);
  assert.equal(cronRes1.body.releasedCount, 1); // Wydano tylko item_1
  assert.equal(cronRes1.body.seriesProcessed, 1);

  // Sprawdź stan serii: nadal active, item_1 released, item_2 ready
  const seriesSnap1 = await db.collection('homeworkSeries').doc(seriesId).get();
  const seriesData1 = seriesSnap1.data();
  assert.equal(seriesData1.status, 'active');
  assert.equal(seriesData1.items[0].state, 'released');
  assert.equal(seriesData1.items[0].releasedDelayed, true); // zaległa -> delayed
  assert.equal(seriesData1.items[1].state, 'ready');

  // Uruchom crona w przyszłości (2026-10-15)
  const cronRes2 = await handleCronRelease(deps, {
    authHeader: 'Bearer cron_super_secret_123',
    todayWarsaw: '2026-10-15',
  });

  assert.equal(cronRes2.status, 200);
  assert.equal(cronRes2.body.releasedCount, 1); // Wydano item_2

  // Sprawdź stan serii: teraz completed!
  const seriesSnap2 = await db.collection('homeworkSeries').doc(seriesId).get();
  const seriesData2 = seriesSnap2.data();
  assert.equal(seriesData2.status, 'completed');
  assert.equal(seriesData2.items[1].state, 'released');
});

const payloadFor = (itemId: string) => ({
  itemId,
  type: 'translation',
  sentences: [{ id: '1', polishSentence: `Zdanie ${itemId}`, englishTranslation: `Sentence ${itemId}`, type: 'translation' }],
});

const createSeries = async (
  deps: { db: InMemoryDb; cronSecret?: string; now?: () => Date },
  opts: { studentUid: string; slots: string[]; title?: string; extra?: Record<string, unknown> }
) => {
  const items = opts.slots.map((slotDate, i) => ({ itemId: `item_${i + 1}`, slotDate, dueInDays: 3 }));
  const res = await handleCreateSeries(deps, {
    callerUid: 'teacher_1',
    body: {
      title: opts.title || 'Seria',
      studentUid: opts.studentUid,
      ownerUid: 'teacher_1',
      items,
      itemPayloads: Object.fromEntries(items.map((it) => [it.itemId, payloadFor(it.itemId)])),
      ...(opts.extra || {}),
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.series.id as string;
};

const releasedTasks = (db: InMemoryDb) =>
  Array.from(db.data.entries()).filter(([k]) => k.startsWith('specialTasks/')).map(([, v]) => v);

test('limit crona: najwyżej jeden slot na kursanta na uruchomienie, także przy dwóch seriach; zaległe czekają', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret' };
  // Kursant A: dwie serie, łącznie trzy zaległe sloty. Kursant B: jeden zaległy slot.
  const a1 = await createSeries(deps, { studentUid: 'student_A', slots: ['2026-10-05', '2026-10-07'] });
  const a2 = await createSeries(deps, { studentUid: 'student_A', slots: ['2026-10-06'] });
  await createSeries(deps, { studentUid: 'student_B', slots: ['2026-10-09'] });

  const run = (day: string) => handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: day });

  const r1 = await run('2026-10-10');
  assert.equal(r1.status, 200);
  assert.equal(r1.body.releasedCount, 2, 'po jednym slocie dla A i dla B');
  assert.equal(r1.body.deferredCount, 2, 'dwa zaległe sloty A czekają');
  const afterRun1 = releasedTasks(db).filter((t) => t.studentUid === 'student_A');
  assert.equal(afterRun1.length, 1);
  assert.equal(afterRun1[0].seriesId, a1, 'najstarszy slot A (05.10) wychodzi pierwszy');

  const r2 = await run('2026-10-11');
  assert.equal(r2.body.releasedCount, 1);
  assert.equal(r2.body.deferredCount, 1);
  assert.deepEqual(
    releasedTasks(db).filter((t) => t.studentUid === 'student_A').map((t) => t.seriesId).sort(),
    [a1, a2].sort(),
    'drugie uruchomienie: slot 06.10 z drugiej serii'
  );

  const r3 = await run('2026-10-12');
  assert.equal(r3.body.releasedCount, 1);
  assert.equal(r3.body.deferredCount, 0);

  // Wszystko wydane, nic nie przepadło (brak wygasania), kolejne uruchomienie nic nie robi.
  assert.equal(releasedTasks(db).length, 4);
  const r4 = await run('2026-10-13');
  assert.equal(r4.body.releasedCount, 0);
});

test('wydanie bez profilu kursanta nie wywraca transakcji; z profilem ustawia hasNewHomework', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret' };
  const noProfile = await createSeries(deps, { studentUid: 'student_ghost', slots: ['2026-10-10'] });
  db.data.set('users/student_real', { firstName: 'Ola', email: 'ola@example.test' });
  await createSeries(deps, { studentUid: 'student_real', slots: ['2026-10-10'] });

  const res = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-10' });
  assert.equal(res.body.releasedCount, 2);
  assert.equal(res.body.errorCount, 0);
  assert.equal(db.data.has('users/student_ghost'), false, 'nie tworzymy profilu-widma');
  assert.equal(db.data.get('users/student_real').hasNewHomework, true);
  const ghostSeries = (await db.collection('homeworkSeries').doc(noProfile).get()).data();
  assert.equal(ghostSeries.items[0].state, 'released');
  assert.equal('lastError' in ghostSeries.items[0], false);
});

test('autoEmail: bez potwierdzenia 400; z potwierdzeniem data potwierdzenia i flaga na wydanej pracy', async () => {
  const db = new InMemoryDb();
  const fixedNow = new Date('2026-10-10T06:00:00.000Z');
  const deps = { db, cronSecret: 's3cret', now: () => fixedNow };
  const base = {
    title: 'Seria z mailem',
    studentUid: 'student_1',
    ownerUid: 'teacher_1',
    items: [{ itemId: 'item_1', slotDate: '2026-10-10', dueInDays: 3 }],
    itemPayloads: { item_1: payloadFor('item_1') },
  };

  const rejected = await handleCreateSeries(deps, { callerUid: 'teacher_1', body: { ...base, autoEmail: true } });
  assert.equal(rejected.status, 400);
  assert.equal(releasedTasks(db).length, 0);

  // Domyślnie: wyłączony, bez daty potwierdzenia
  const plain = await handleCreateSeries(deps, { callerUid: 'teacher_1', body: base });
  assert.equal(plain.body.series.autoEmail, false);
  assert.equal('autoEmailConfirmedAt' in plain.body.series, true); // w odpowiedzi undefined…
  const plainStored = (await db.collection('homeworkSeries').doc(plain.body.series.id).get()).data();
  assert.equal('autoEmailConfirmedAt' in plainStored, false); // …ale w bazie pola nie ma

  const confirmed = await handleCreateSeries(deps, {
    callerUid: 'teacher_1',
    body: { ...base, studentUid: 'student_2', autoEmail: true, autoEmailConfirmed: true },
  });
  assert.equal(confirmed.status, 201);
  const stored = (await db.collection('homeworkSeries').doc(confirmed.body.series.id).get()).data();
  assert.equal(stored.autoEmail, true);
  assert.equal(stored.autoEmailConfirmedAt, fixedNow.toISOString());

  await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-10' });
  const byStudent = Object.fromEntries(releasedTasks(db).map((t) => [t.studentUid, t]));
  assert.equal(byStudent.student_1.seriesAutoEmailConfirmed, false);
  assert.equal(byStudent.student_1.skipAutoEmail, true);
  assert.equal(byStudent.student_2.seriesAutoEmailConfirmed, true);
  assert.equal(byStudent.student_2.skipAutoEmail, false);
});

test('handleReleaseNow: tylko właściciel; bez itemId wydaje najwyżej jedną, najstarszą pozycję', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret', now: () => new Date('2026-10-10T10:00:00.000Z') };
  const seriesId = await createSeries(deps, { studentUid: 'student_1', slots: ['2026-10-08', '2026-10-09', '2026-10-20'] });

  const forbidden = await handleReleaseNow(deps, { callerUid: 'teacher_2', seriesId });
  assert.equal(forbidden.status, 403);
  assert.equal(releasedTasks(db).length, 0);

  const missing = await handleReleaseNow(deps, { callerUid: 'teacher_1', seriesId: 'series_nope' });
  assert.equal(missing.status, 404);

  const badItem = await handleReleaseNow(deps, { callerUid: 'teacher_1', seriesId, itemId: { $gt: '' } });
  assert.equal(badItem.status, 400);

  const first = await handleReleaseNow(deps, { callerUid: 'teacher_1', seriesId });
  assert.equal(first.status, 200);
  assert.equal(first.body.released.length, 1);
  assert.equal(releasedTasks(db)[0].seriesItemId, 'item_1');

  // Pozycja z przyszłości po itemId — nie wychodzi przed terminem
  const future = await handleReleaseNow(deps, { callerUid: 'teacher_1', seriesId, itemId: 'item_3' });
  assert.equal(future.body.skipped, true);
  assert.equal(releasedTasks(db).length, 1);
});

const grpcError = (code: number, message: string) => Object.assign(new Error(message), { code });

/** Błąd przy `create()` pracy w transakcji wydania — zapis próby (osobna transakcja bez create) przechodzi. */
const failReleaseCreate = (db: InMemoryDb, times: number, code = 4, message = 'DEADLINE_EXCEEDED') => {
  const original = db.runTransaction.bind(db);
  let left = times;
  (db as any).runTransaction = (fn: any) =>
    original((tx: any) =>
      fn({
        ...tx,
        create: (ref: any, val: any) => {
          if (left > 0) {
            left--;
            throw grpcError(code, message);
          }
          return tx.create(ref, val);
        },
      })
    );
};

const seriesDoc = async (db: InMemoryDb, seriesId: string) => (await db.collection('homeworkSeries').doc(seriesId).get()).data();

test('błąd przejściowy wydania: pozycja zostaje ready z licznikiem prób i wychodzi przy kolejnym uruchomieniu', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret' };
  const seriesId = await createSeries(deps, { studentUid: 'student_1', slots: ['2026-10-10'] });
  failReleaseCreate(db, 1);

  const r1 = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-10' });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.errorCount, 1);
  assert.equal(r1.body.retryCount, 1);
  assert.equal(r1.body.failedCount, 0);
  let item = (await seriesDoc(db, seriesId)).items[0];
  assert.equal(item.state, 'ready');
  assert.equal(item.releaseAttempts, 1);
  assert.equal(item.lastError, 'DEADLINE_EXCEEDED');
  assert.equal(releasedTasks(db).length, 0);

  const r2 = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-11' });
  assert.equal(r2.body.releasedCount, 1);
  item = (await seriesDoc(db, seriesId)).items[0];
  assert.equal(item.state, 'released');
  assert.equal('lastError' in item, false);
  assert.equal(releasedTasks(db).length, 1);
});

test('błąd przejściowy: po 5 nieudanych próbach (UNAVAILABLE, ABORTED, nieznany…) pozycja przechodzi w failed', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret' };
  const seriesId = await createSeries(deps, { studentUid: 'student_1', slots: ['2026-10-01'] });
  const codes: Array<[number | undefined, string]> = [
    [14, 'UNAVAILABLE'],
    [10, 'ABORTED'],
    [8, 'RESOURCE_EXHAUSTED'],
    [13, 'INTERNAL'],
    [undefined, 'coś zupełnie nieznanego'],
  ];
  for (let i = 0; i < codes.length; i++) {
    failReleaseCreate(db, 1, codes[i][0] as number, codes[i][1]);
    const res = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: `2026-10-1${i}` });
    assert.equal(res.status, 200);
    const item = (await seriesDoc(db, seriesId)).items[0];
    assert.equal(item.releaseAttempts, i + 1);
    assert.equal(item.state, i + 1 < 5 ? 'ready' : 'failed', `próba ${i + 1}`);
  }
  assert.equal(releasedTasks(db).length, 0);
  const after = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-20' });
  assert.equal(after.body.plannedCount, 0, 'pozycji failed cron już nie bierze');
});

test('błąd deterministyczny: brak lub niepoprawny payload — pozycja od razu failed', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret' };
  const missing = await createSeries(deps, { studentUid: 'student_1', slots: ['2026-10-10'] });
  const invalid = await createSeries(deps, { studentUid: 'student_2', slots: ['2026-10-10'] });
  db.data.delete(`homeworkSeries/${missing}/items/item_1`);
  db.data.set(`homeworkSeries/${invalid}/items/item_1`, { itemId: 'item_1', type: 'translation', sentences: [] });

  const res = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-10' });
  assert.equal(res.status, 200);
  assert.equal(res.body.failedCount, 2);
  assert.equal(res.body.retryCount, 0);
  for (const id of [missing, invalid]) {
    const item = (await seriesDoc(db, id)).items[0];
    assert.equal(item.state, 'failed');
    assert.equal(item.releaseAttempts, 1);
    assert.match(item.lastError, /payload/i);
  }
  assert.equal(releasedTasks(db).length, 0);
});

test('pętla crona: wyjątek przy odczycie payloadu jednej pozycji nie zatrzymuje pozostałych kursantów', async () => {
  const db = new InMemoryDb();
  const deps = { db, cronSecret: 's3cret' };
  const broken = await createSeries(deps, { studentUid: 'student_1', slots: ['2026-10-10'] });
  await createSeries(deps, { studentUid: 'student_2', slots: ['2026-10-10'] });
  await createSeries(deps, { studentUid: 'student_3', slots: ['2026-10-10'] });

  // Odczyt payloadu zepsutej serii rzuca UNAVAILABLE (wcześniej: poza try → cały cron 500).
  const originalCollection = db.collection.bind(db);
  (db as any).collection = (name: string) => {
    const col = originalCollection(name);
    if (name !== 'homeworkSeries') return col;
    return {
      ...col,
      doc: (id?: string) => {
        const ref = col.doc(id);
        if (id !== broken) return ref;
        return {
          ...ref,
          collection: (sub: string) => {
            const subCol = ref.collection(sub);
            return {
              ...subCol,
              doc: (itemId?: string) => ({
                ...subCol.doc(itemId),
                get: async () => {
                  throw grpcError(14, 'UNAVAILABLE');
                },
              }),
            };
          },
        };
      },
    };
  };

  const res = await handleCronRelease(deps, { authHeader: 'Bearer s3cret', todayWarsaw: '2026-10-10' });
  assert.equal(res.status, 200);
  assert.equal(res.body.plannedCount, 3);
  assert.equal(res.body.releasedCount, 2);
  assert.equal(res.body.errorCount, 1);
  assert.equal(res.body.retryCount, 1);
  assert.deepEqual(releasedTasks(db).map((t) => t.studentUid).sort(), ['student_2', 'student_3']);
  const item = (await seriesDoc(db, broken)).items[0];
  assert.equal(item.state, 'ready');
  assert.equal(item.releaseAttempts, 1);
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BadRequest,
  MAX_TRANSCRIPT_CHARS,
  storeTranscript,
  type Db,
} from '../functions/src/transcript/store';

/**
 * Odbiór transkrypcji z Cribro Sift.
 *
 * Testowana jest warstwa decyzji, nie HTTP: komu przypisać lekcję, kiedy to
 * nowa sesja a kiedy poprawka poprzedniej, i czy surowy zapis rozmowy
 * na pewno nie wychodzi do kursanta. Baza wchodzi jako atrapa, więc test
 * nie potrzebuje ani emulatora, ani sieci.
 */

type Doc = Record<string, unknown>;

/** Atrapa Firestore: dwa słowniki i tyle zachowań, ile logika naprawdę używa. */
const fakeDb = (users: Record<string, Doc>) => {
  const lessons = new Map<string, Doc>();
  const writes: Array<{ op: 'set' | 'update'; path: string; data: Doc }> = [];

  const lessonRef = (path: string) => ({
    async get() {
      return { exists: lessons.has(path), id: path };
    },
    async set(data: Doc) {
      lessons.set(path, data);
      writes.push({ op: 'set', path, data });
    },
    async update(data: Doc) {
      lessons.set(path, { ...(lessons.get(path) ?? {}), ...data });
      writes.push({ op: 'update', path, data });
    },
    collection() {
      throw new Error('nieużywane');
    },
  });

  const db = {
    collection(name: string) {
      assert.equal(name, 'users');
      return {
        doc(uid: string) {
          return {
            async get() {
              return { exists: uid in users, id: uid };
            },
            async set() {
              throw new Error('nieużywane');
            },
            async update() {
              throw new Error('nieużywane');
            },
            collection(sub: string) {
              assert.equal(sub, 'lessonRecords');
              return {
                doc: (id: string) => lessonRef(`users/${uid}/lessonRecords/${id}`),
                where() {
                  throw new Error('nieużywane');
                },
              };
            },
          };
        },
        where(field: string, op: string, value: unknown) {
          assert.equal(field, 'email');
          assert.equal(op, '==');
          const matches = Object.entries(users)
            .filter(([, data]) => data.email === value)
            .map(([id]) => ({ id }));
          const query = {
            limit: () => query,
            async get() {
              return { empty: matches.length === 0, size: matches.length, docs: matches };
            },
          };
          return query;
        },
      };
    },
  } as unknown as Db;

  return { db, lessons, writes };
};

const payload = (extra: Record<string, unknown> = {}) => ({
  siftSessionId: 'spotkanie-2026-09-13-0930',
  transcript: 'Teacher: how was your week? Student: I was commuting a lot.',
  studentUid: 'ala',
  ...extra,
});

const students = { ala: { email: 'ala@example.com' }, bob: { email: 'bob@example.com' } };

describe('odbiór transkrypcji — zapis lekcji', () => {
  it('zapisuje lekcję ukrytą przed kursantem, z transkrypcją w całości', async () => {
    const { db, lessons } = fakeDb(students);

    const result = await storeTranscript(db, payload({ date: '2026-09-13', topic: 'Small talk' }));

    assert.equal(result.action, 'created');
    assert.equal(result.studentUid, 'ala');
    const saved = lessons.get(`users/ala/lessonRecords/${result.lessonId}`)!;

    assert.equal(saved.source, 'live_transcript');
    assert.equal(saved.sessionStatus, 'draft');
    assert.equal(saved.topic, 'Small talk');
    assert.equal(saved.date, '2026-09-13');
    assert.equal(saved.liveTranscript, payload().transcript);

    // Trzy flagi niewidoczności — każdą czyta isLessonPendingConfirmation osobno.
    assert.equal(saved.status, 'pending_confirmation');
    assert.equal(saved.isPendingConfirmation, true);
    assert.ok(String(saved.pendingReason).length > 0);
  });

  it('ta sama sesja przysłana dwa razy podmienia lekcję, nie zakłada drugiej', async () => {
    const { db, lessons, writes } = fakeDb(students);

    const first = await storeTranscript(db, payload({ topic: 'Small talk' }));
    const second = await storeTranscript(
      db,
      payload({ transcript: 'poprawiona wersja zapisu', topic: 'Cokolwiek innego' })
    );

    assert.equal(second.action, 'updated');
    assert.equal(second.lessonId, first.lessonId);
    assert.equal(lessons.size, 1);

    const saved = lessons.get(`users/ala/lessonRecords/${first.lessonId}`)!;
    assert.equal(saved.liveTranscript, 'poprawiona wersja zapisu');
    // Temat wpisany przez lektora zostaje — poprawka dotyczy transkrypcji.
    assert.equal(saved.topic, 'Small talk');
    // Zmieniony zapis rozmowy cofa domknięcie lekcji.
    assert.equal(saved.sessionStatus, 'draft');
    assert.equal(writes[1].op, 'update');
  });

  it('wskazanie kursanta adresem e-mail trafia do właściwego konta', async () => {
    const { db } = fakeDb(students);

    const result = await storeTranscript(
      db,
      payload({ studentUid: undefined, studentEmail: 'Bob@Example.com' })
    );

    assert.equal(result.studentUid, 'bob');
  });

  it('bez daty bierze dzisiejszy dzień, a nie pustą datę', async () => {
    const { db, lessons } = fakeDb(students);

    const result = await storeTranscript(db, payload());
    const saved = lessons.get(`users/ala/lessonRecords/${result.lessonId}`)!;

    // Data musi przejść walidację reguł (`isValidSimpleDateString`).
    assert.match(String(saved.date), /^\d{4}-\d{2}-\d{2}$/);
    // Bez tematu też ma być czym nazwać lekcję w panelu.
    assert.ok(String(saved.topic).length > 0);
  });
});

describe('odbiór transkrypcji — co zostaje odrzucone', () => {
  const rejects = async (body: Record<string, unknown>, status: number) => {
    const { db } = fakeDb(students);
    await assert.rejects(
      () => storeTranscript(db, body),
      (error: unknown) => {
        assert.ok(error instanceof BadRequest, `oczekiwano BadRequest, było: ${String(error)}`);
        assert.equal(error.status, status);
        return true;
      }
    );
  };

  it('nieznany kursant', () => rejects(payload({ studentUid: 'nie-ma-takiego' }), 404));
  it('nieznany adres', () =>
    rejects(payload({ studentUid: undefined, studentEmail: 'nikt@example.com' }), 404));
  it('brak wskazania kursanta', () => rejects(payload({ studentUid: undefined }), 400));
  it('brak identyfikatora sesji', () => rejects(payload({ siftSessionId: '' }), 400));
  it('pusta transkrypcja', () => rejects(payload({ transcript: '   ' }), 400));
  it('data w złym formacie', () => rejects(payload({ date: '13.09.2026' }), 400));

  it('transkrypcja ponad sufit reguł — zanim zabije cały dokument', () =>
    // 1 MB to twardy limit dokumentu Firestore; odrzucenie tu jest błędem
    // widocznym od razu, przekroczenie tam kasuje zapis całej lekcji.
    rejects(payload({ transcript: 'x'.repeat(MAX_TRANSCRIPT_CHARS + 1) }), 413));
});

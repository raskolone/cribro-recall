// Kontekst kursanta czytany po stronie serwera (Admin SDK): poziom, krzywa uczenia, słabości, lekcje.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWeaknessesList, NO_WEAKNESSES } from '../utils/weaknesses';
import { hydrateProfile } from '../utils/learningProfileHydrate';
import { createProfile, normalizeLevel } from '../utils/learningCurve';
import { DEFAULT_LESSON_CONTEXT, loadStudentContext, readUserDoc } from '../utils/freePracticeContext';

/** Atrapa Admin Firestore: rejestruje ścieżki, z których czytano. */
function fakeDb(store: Record<string, any>, failing: string[] = []) {
  const reads: string[] = [];
  const snap = (path: string) => ({ exists: path in store, id: path.split('/').pop()!, data: () => store[path] });
  const docRef = (path: string): any => ({
    get: async () => {
      reads.push(path);
      if (failing.some((f) => path.includes(f))) throw new Error('permission-denied');
      return snap(path);
    },
    collection: (name: string) => collRef(`${path}/${name}`),
  });
  const collRef = (path: string): any => ({
    doc: (id: string) => docRef(`${path}/${id}`),
    orderBy: (field: string, dir: string) => ({
      limit: (n: number) => ({
        get: async () => {
          reads.push(`${path}?orderBy=${field}:${dir}&limit=${n}`);
          if (failing.some((f) => path.includes(f))) throw new Error('permission-denied');
          const docs = Object.keys(store)
            .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'))
            .map((k) => snap(k))
            .sort((a, b) => (dir === 'desc' ? -1 : 1) * (String(a.data()[field] ?? '') < String(b.data()[field] ?? '') ? -1 : 1))
            .slice(0, n);
          return { docs };
        },
      }),
    }),
  });
  return { db: { collection: (name: string) => collRef(name) }, reads };
}

const store = {
  'users/u1': { role: 'user', level: 'A2', aiPrompt: 'Lubi kino', description: 'Programistka', frequentErrors: ['articles', 'Prepositions'] },
  'users/u1/profile/learningCurve': { currentLevel: 'B1', recentMistakes: [{ prompt: 'x', expected: 'a', given: 'b', exerciseType: 'translation', date: '2026-10-01' }] },
  'users/u1/weaknesses/w1': { name: 'articles', frequency: 4, description: 'a/the' },
  'users/u1/weaknesses/w2': { name: 'tenses', frequency: 9 },
  'users/u1/lessonRecords/rec1': { topic: 'Travel', date: '2026-10-01' },
  'users/u1/lessonRecords/rec2': { topic: 'Food', date: '2026-10-05' },
  'users/u1/lessonRecords/rec3': { topic: 'Work', date: '2026-10-07' },
  'users/u1/lessonRecords/rec4': { topic: 'Health', date: '2026-10-09' },
  'users/u2/lessonRecords/secret': { topic: 'CUDZA LEKCJA', date: '2026-10-09' },
};

test('lista słabości: ten sam format co dotychczasowy getUserWeaknesses (kolekcja + frequentErrors z profilu)', () => {
  assert.equal(formatWeaknessesList([], []), NO_WEAKNESSES);
  assert.equal(NO_WEAKNESSES, 'Brak zidentyfikowanych błędów.');
  const text = formatWeaknessesList([{ id: 'x', name: 'articles', frequency: 4, description: 'a/the' }, { id: 'w2' }], ['Articles', 'prepositions']);
  assert.equal(
    text,
    ['- Błąd/Problem: "articles" (częstość: 4) [Kontekst: a/the]', '- Błąd/Problem: "w2" (częstość: 1) ', '- Częsty błąd z profilu: "prepositions"'].join('\n'),
  );
});

test('profil: hydrateProfile odświeża poziom bazowy z dokumentu kursanta i uzupełnia brakujące pola', () => {
  const now = '2026-10-10T10:00:00.000Z';
  assert.deepEqual(hydrateProfile('u1', 'B2', null, now), createProfile('u1', normalizeLevel('B2'), now));
  const profile = hydrateProfile('u1', 'A2', { currentLevel: 'B1' } as any, now);
  assert.equal(profile.currentLevel, 'B1');
  assert.equal(profile.baseLevel, 'A2');
  assert.deepEqual(profile.recentMistakes, []);
  assert.equal(profile.studentId, 'u1');
  assert.equal(hydrateProfile('u1', 'A2', { currentLevel: 'zły' } as any, now).currentLevel, 'A2', 'nieznany poziom → bazowy');
});

test('kontekst: poziom z krzywej uczenia (nad poziomem z dokumentu), słabości i pola profilu, tylko odczyty pod users/{uid}', async () => {
  const { db, reads } = fakeDb(store);
  const user = await readUserDoc(db, 'u1');
  const ctx = await loadStudentContext(db, 'u1', user, []);
  assert.equal(ctx.level, 'B1', 'poziom z krzywej uczenia bierze górę nad wpisanym');
  assert.match(ctx.weaknesses, /"tenses" \(częstość: 9\)/);
  assert.match(ctx.weaknesses, /"articles" \(częstość: 4\)/);
  assert.match(ctx.weaknesses, /Częsty błąd z profilu: "Prepositions"/);
  assert.doesNotMatch(ctx.weaknesses, /Częsty błąd z profilu: "articles"/, 'duplikat z kolekcji pominięty');
  assert.equal(ctx.aiPrompt, 'Lubi kino');
  assert.equal(ctx.description, 'Programistka');
  assert.equal(typeof ctx.briefing, 'string');
  assert.ok(reads.every((path) => path.startsWith('users/u1')), reads.join('\n'));
  assert.ok(reads.some((path) => path.includes('weaknesses?orderBy=frequency:desc&limit=15')), 'top 15 po częstości');
});

test('kontekst: lekcje wskazane przez kursanta; bez wskazania — trzy najnowsze; cudze lekcje nieosiągalne', async () => {
  const { db, reads } = fakeDb(store);
  const user = await readUserDoc(db, 'u1');
  const picked = await loadStudentContext(db, 'u1', user, ['rec2', 'rec1', 'nieistnieje', 'secret']);
  assert.deepEqual(picked.lessons.map((l) => l.topic), ['Food', 'Travel'], 'kolejność wskazania, brakujące pominięte');
  assert.ok(!picked.lessons.some((l) => l.topic === 'CUDZA LEKCJA'), 'id cudzej lekcji nie wychodzi poza users/{uid}');
  assert.ok(reads.every((p) => p.startsWith('users/u1')));

  const latest = await loadStudentContext(db, 'u1', user, []);
  assert.equal(latest.lessons.length, DEFAULT_LESSON_CONTEXT);
  assert.deepEqual(latest.lessons.map((l) => l.topic), ['Health', 'Work', 'Food']);
});

test('kontekst: błędy odczytu nie blokują ćwiczenia — zostaje poziom z dokumentu i brak historii', async () => {
  const { db } = fakeDb(store, ['profile', 'weaknesses', 'lessonRecords']);
  const user = await readUserDoc(db, 'u1');
  const ctx = await loadStudentContext(db, 'u1', user, ['rec1']);
  assert.equal(ctx.level, 'A2');
  assert.match(ctx.weaknesses, /Częsty błąd z profilu: "articles"/, 'frequentErrors z dokumentu kursanta nadal działają');
  assert.deepEqual(ctx.lessons, []);
  const empty = await loadStudentContext(fakeDb({}).db, 'nowy', {}, []);
  assert.equal(empty.level, 'B1');
  assert.equal(empty.weaknesses, NO_WEAKNESSES);
});

test('kontekst jest tylko do odczytu: moduł nie zapisuje do bazy', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../utils/freePracticeContext.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /\.(set|update|add|delete|create|batch|runTransaction)\(/);
  assert.doesNotMatch(src, /firebase\/firestore|firebase['"]/);
});

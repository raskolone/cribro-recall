/**
 * Jednorazowa migracja przypisań prac domowych.
 *
 * Dopisuje `studentUid` do dokumentów w kolekcji `specialTasks`. Po zaostrzeniu
 * reguł Firestore to jedyne pole, po którym kursant może odnaleźć własne
 * zadania — dokument bez niego jest dla kursanta niewidoczny.
 *
 * To samo dzieje się samo, gdy nauczyciel otworzy panel (utils/backfillTaskOwners.ts).
 * Skrypt przydaje się, gdy chcesz mieć to z głowy od razu albo sprawdzić stan
 * bazy bez klikania po aplikacji.
 *
 * Użycie — najpierw ZAWSZE suchy przebieg:
 *   FB_USER=nauczyciel@example.com FB_PASS='...' node scripts/backfill-task-owners.mjs
 *   FB_USER=... FB_PASS='...' node scripts/backfill-task-owners.mjs --apply
 *
 * Logowanie musi być na koncie nauczyciela: reguły dają prawo zapisu w
 * specialTasks wyłącznie jemu. Hasło podawaj zmienną środowiskową, nigdy
 * w pliku ani w historii poleceń.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'firebase-applet-config.json'), 'utf8'));
const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';

const apply = process.argv.includes('--apply');
const { FB_USER, FB_PASS } = process.env;
if (!FB_USER || !FB_PASS) {
  console.error('Ustaw FB_USER i FB_PASS (konto nauczyciela).');
  process.exit(1);
}

const norm = (t) =>
  (t ?? '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const EVERYONE = ['all', 'wszyscy', '*', 'all_students', 'allstudents'];

/** Właściciel zadania — tylko gdy pasuje dokładnie jeden kursant. */
const resolveOwner = (task, candidates) => {
  const raw = (task.studentUid || task.studentId || task.userId || task.assignedTo || '')
    .toString()
    .trim();
  const rawNorm = norm(raw);
  if (!raw || EVERYONE.includes(rawNorm)) return null;

  const exact = candidates.find((c) => c.id === raw);
  if (exact) return exact.id;

  const nameNorm = norm(task.studentName || task.studentUsername || '');
  const emailNorm = norm(task.studentEmail || (raw.includes('@') ? raw : ''));
  for (const needle of [emailNorm, rawNorm, nameNorm].filter(Boolean)) {
    const hits = candidates.filter(
      (c) => c.email === needle || c.username === needle || c.fullName === needle
    );
    if (hits.length === 1) return hits[0].id;
  }
  return null;
};

const app = initializeApp(config);
const cred = await signInWithEmailAndPassword(getAuth(app), FB_USER, FB_PASS);
const db = initializeFirestore(app, {}, DATABASE_ID);
console.log(`Zalogowano jako ${cred.user.uid}${apply ? '' : ' (suchy przebieg)'}`);

const [usersSnap, tasksSnap] = await Promise.all([
  getDocs(collection(db, 'users')),
  getDocs(collection(db, 'specialTasks')),
]);

const candidates = usersSnap.docs.map((d) => {
  const u = d.data();
  return {
    id: d.id,
    username: norm(u.username),
    email: norm(u.email),
    fullName: norm(`${u.firstName || ''} ${u.lastName || ''}`.trim()),
  };
});

const stale = tasksSnap.docs.filter((d) => {
  const uid = d.data().studentUid;
  return typeof uid !== 'string' || uid.length === 0;
});
console.log(`Zadań: ${tasksSnap.size}, do uzupełnienia: ${stale.length}`);

const updates = [];
const unresolved = [];
for (const d of stale) {
  const owner = resolveOwner(d.data(), candidates);
  if (owner) updates.push({ id: d.id, owner });
  else unresolved.push(d.id);
}
updates.forEach((u) => console.log(`  ${u.id} -> ${u.owner}`));
unresolved.forEach((id) => console.log(`  ${id} -> NIEROZSTRZYGNIĘTE (pomijam)`));

if (!apply) {
  console.log('\nNic nie zapisano. Uruchom ponownie z --apply, żeby wprowadzić zmiany.');
  process.exit(0);
}

const CHUNK = 400;
for (let i = 0; i < updates.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const u of updates.slice(i, i + CHUNK)) {
    batch.update(doc(db, 'specialTasks', u.id), {
      studentUid: u.owner,
      studentId: u.owner,
      userId: u.owner,
      studentIds: [u.owner],
    });
  }
  await batch.commit();
}
console.log(`Zapisano: ${updates.length}. Nierozstrzygnięte: ${unresolved.length}.`);
process.exit(0);

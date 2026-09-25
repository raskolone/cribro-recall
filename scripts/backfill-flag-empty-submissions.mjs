/**
 * Jednorazowa migracja: oznaczenie prac domowych oddanych bez żadnej
 * odpowiedzi (`status: 'submitted'` lub `'graded'`, ale wszystkie pola w
 * `studentAnswers` puste).
 *
 * Kontekst: do naprawy w `server.ts` (`/api/homework/direct-submit`),
 * `HomeworkScreen.tsx` (`handleSubmitTask`) i `AIExerciseGeneratorScreen.tsx`
 * (`handleFinishAll`) puste zgłoszenie przechodziło jako "Nadesłano" bez
 * żadnego ostrzeżenia — ten skrypt znajduje historyczne przypadki sprzed
 * naprawy. Nie zmienia `status` (żeby nie ruszać wyzwalacza mailowego
 * `notifyStudentOnHomeworkGraded` ani kolejki lektora) — dopisuje wyłącznie
 * `isEmptySubmission: true`, żeby dało się je odróżnić od realnie
 * ocenionych prac.
 *
 * Definicja "pusty" zgodna z `isAnswerBlank` w `server.ts` i
 * `answeredCount` w `HomeworkScreen.tsx` / `DirectHomeworkScreen.tsx`:
 * brak wartości, pusty string po trim, pusta tablica, pusty obiekt.
 *
 * Użycie — najpierw ZAWSZE suchy przebieg:
 *   FB_USER=nauczyciel@example.com FB_PASS='...' node scripts/backfill-flag-empty-submissions.mjs
 *   FB_USER=... FB_PASS='...' node scripts/backfill-flag-empty-submissions.mjs --apply
 *
 * Logowanie musi być na koncie nauczyciela: reguły dają prawo odczytu
 * wszystkich `specialTasks` (i zapisu dowolnych pól) wyłącznie jemu.
 * Hasło podawaj zmienną środowiskową, nigdy w pliku ani w historii poleceń.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';

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

const isAnswerBlank = (val) => {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') return Object.keys(val).length === 0;
  return false;
};

const isEmptySubmission = (task) => {
  const items = Array.isArray(task.sentences) ? task.sentences : [];
  if (items.length === 0) return false; // nic do porównania — pomijamy, nie zgadujemy
  const answers = task.studentAnswers && typeof task.studentAnswers === 'object' ? task.studentAnswers : {};
  return items.every((_, i) => isAnswerBlank(answers[i]));
};

const app = initializeApp(config);
const cred = await signInWithEmailAndPassword(getAuth(app), FB_USER, FB_PASS);
const db = initializeFirestore(app, {}, DATABASE_ID);
console.log(`Zalogowano jako ${cred.user.uid}${apply ? '' : ' (suchy przebieg)'}`);

const [usersSnap, submittedSnap, gradedSnap] = await Promise.all([
  getDocs(collection(db, 'users')),
  getDocs(query(collection(db, 'specialTasks'), where('status', '==', 'submitted'))),
  getDocs(query(collection(db, 'specialTasks'), where('status', '==', 'graded'))),
]);

const usersById = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
const displayName = (uid) => {
  const u = usersById.get(uid);
  if (!u) return uid || '(brak studentUid)';
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || uid;
};

const candidates = [...submittedSnap.docs, ...gradedSnap.docs].filter((d) => !d.data().isEmptySubmission);
const empties = candidates.filter((d) => isEmptySubmission(d.data()));

console.log(`Sprawdzono: ${candidates.length} (submitted: ${submittedSnap.size}, graded: ${gradedSnap.size})`);
console.log(`Puste zgłoszenia: ${empties.length}\n`);

empties.forEach((d) => {
  const t = d.data();
  console.log(
    `  [${t.status}] ${d.id} — "${t.title || 'Praca domowa'}" — ${displayName(t.studentUid)} — oddano: ${t.submittedAt || '?'}`
  );
});

if (!apply) {
  console.log('\nNic nie zapisano. Uruchom ponownie z --apply, żeby dopisać isEmptySubmission: true.');
  process.exit(0);
}

const CHUNK = 400;
for (let i = 0; i < empties.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const d of empties.slice(i, i + CHUNK)) {
    batch.update(doc(db, 'specialTasks', d.id), { isEmptySubmission: true });
  }
  await batch.commit();
}
console.log(`Oznaczono: ${empties.length}.`);
process.exit(0);

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeText, taskOwnerFields, TASK_OWNER_FIELD } from './homework';

/**
 * Uzupełnia `studentUid` w starych pracach domowych.
 *
 * Dopóki kolekcja `specialTasks` była otwarta dla każdego zalogowanego, pole
 * przypisania bywało zapisywane jako imię, e-mail albo nazwa użytkownika —
 * aplikacja i tak dopasowywała je w przeglądarce. Reguły Firestore takiego
 * zgadywania nie zrobią, więc dokument bez dosłownego UID-a stałby się dla
 * kursanta niewidoczny. Ta migracja domyka lukę: uruchamia się raz na sesję
 * u nauczyciela (jedynego konta, które ma prawo zapisu) i dopisuje UID tam,
 * gdzie da się go jednoznacznie wskazać.
 *
 * Zadania, których nie da się przypisać jednoznacznie — w tym stare zadania
 * „dla wszystkich" — zostają nietknięte i trafiają do konsoli. Zgadywanie
 * właściciela pracy domowej to dokładnie ten rodzaj cichej decyzji, przez
 * którą cudze odpowiedzi lądują na niewłaściwym koncie.
 */

const EVERYONE = ['all', 'wszyscy', '*', 'all_students', 'allstudents'];

interface Candidate {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

/**
 * Wskazuje właściciela zadania — ale tylko wtedy, gdy pasuje dokładnie jeden
 * kursant. Świadomie nie używamy tu isTaskForStudent: ten helper sięga po
 * auth.currentUser i dopuszcza dopasowania częściowe, więc przy przeglądaniu
 * listy kandydatów potrafi potwierdzić każdego po kolei.
 */
const resolveOwner = (task: any, candidates: Candidate[]): string | null => {
  const raw = (task.studentUid || task.studentId || task.userId || task.assignedTo || '')
    .toString()
    .trim();
  const rawNorm = normalizeText(raw);
  if (!raw || EVERYONE.includes(rawNorm)) return null;

  // 1. Dokładny UID — jedyne dopasowanie, któremu można ufać bez zastrzeżeń.
  const byId = candidates.find(c => c.id === raw);
  if (byId) return byId.id;

  // 2. E-mail, nazwa użytkownika, imię i nazwisko — każde musi trafić dokładnie
  //    w jednego kursanta, inaczej rezygnujemy.
  const nameNorm = normalizeText(task.studentName || task.studentUsername || '');
  const emailNorm = normalizeText(task.studentEmail || (raw.includes('@') ? raw : ''));

  for (const needle of [emailNorm, rawNorm, nameNorm].filter(Boolean)) {
    const hits = candidates.filter(
      c => c.email === needle || c.username === needle || c.fullName === needle
    );
    if (hits.length === 1) return hits[0].id;
  }

  return null;
};

let done = false;

export async function backfillTaskOwners(): Promise<void> {
  if (done) return;
  done = true;

  try {
    const [usersSnap, tasksSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'specialTasks')),
    ]);

    const candidates: Candidate[] = usersSnap.docs.map(d => {
      const u = d.data() as any;
      return {
        id: d.id,
        email: normalizeText(u.email),
        username: normalizeText(u.username),
        fullName: normalizeText(`${u.firstName || ''} ${u.lastName || ''}`.trim()),
      };
    });

    const stale = tasksSnap.docs.filter(d => {
      const uid = (d.data() as any)[TASK_OWNER_FIELD];
      return typeof uid !== 'string' || uid.length === 0;
    });
    if (stale.length === 0) return;

    const unresolved: string[] = [];
    const updates: Array<{ id: string; owner: string }> = [];

    for (const d of stale) {
      const owner = resolveOwner(d.data(), candidates);
      if (owner) updates.push({ id: d.id, owner });
      else unresolved.push(d.id);
    }

    // Batch Firestore'a mieści 500 operacji — dzielimy z zapasem.
    const CHUNK = 400;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const u of updates.slice(i, i + CHUNK)) {
        batch.update(doc(db, 'specialTasks', u.id), taskOwnerFields(u.owner));
      }
      await batch.commit();
    }
    const patched = updates.length;

    console.info(
      `[specialTasks] Uzupełniono ${TASK_OWNER_FIELD} w ${patched} zadaniach.`
    );
    if (unresolved.length > 0) {
      console.warn(
        `[specialTasks] ${unresolved.length} zadań bez jednoznacznego właściciela — ` +
        `kursanci ich nie zobaczą, dopóki nie przypiszesz ich ręcznie. ID: ${unresolved.join(', ')}`
      );
    }
  } catch (err) {
    // Migracja jest wygodą, nie warunkiem działania ekranu — jej porażka nie
    // może wywrócić panelu nauczyciela.
    console.warn('[specialTasks] Migracja przypisań nie powiodła się:', err);
  }
}

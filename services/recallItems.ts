import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import {
  RecallCandidate,
  RecallItem,
  RetrievalAttempt,
  RetrievalResult,
} from '../types';

/**
 * Elementy do powtórek — jedyne źródło materiału dla panelu kursanta.
 *
 * Kolekcja siedzi pod `users/{studentId}/recallItems`, a nie w korzeniu bazy:
 * cała reszta danych kursanta (lessonRecords, vocabularySets, weaknesses) jest
 * już podkolekcją profilu, a reguły w firestore.rules przyznają dostęp właśnie
 * na tym poziomie. Osobna kolekcja główna wymagałaby powtórzenia tych reguł
 * i filtrowania po `studentId` przy każdym odczycie.
 */

const itemsRef = (studentId: string) => collection(db, `users/${studentId}/recallItems`);

/** Dzień w formacie YYYY-MM-DD — powtórki planujemy z dokładnością do doby. */
const toDayString = (d: Date): string => d.toISOString().split('T')[0];

const addDays = (from: Date, days: number): string => {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return toDayString(next);
};

/**
 * Kiedy element wraca do kolejki.
 *
 * Odstępy wprost z briefu. Górny widełek z zakresów („2–3", „6–7") wybieramy
 * losowo, żeby elementy zatwierdzone tego samego dnia nie wracały zawsze
 * jednym blokiem — inaczej po kilku lekcjach kursant dostaje sesje po 30 pozycji
 * na przemian z pustymi dniami.
 */
export function scheduleNextDue(result: RetrievalResult, from: Date = new Date()): string {
  if (result === 'fail') return addDays(from, 1);
  if (result === 'effort') return addDays(from, 2 + Math.round(Math.random()));
  return addDays(from, 6 + Math.round(Math.random()));
}

/**
 * Zapisuje kandydatów ze szkicu AI jako `draft`.
 *
 * Nic tu nie trafia do kursanta — dopóki lektor nie zatwierdzi, element jest
 * niewidoczny w kolejce (patrz `getDueRecallItems`).
 */
export async function createRecallDrafts(
  studentId: string,
  lessonId: string,
  candidates: RecallCandidate[]
): Promise<string[]> {
  if (!studentId || !lessonId || candidates.length === 0) return [];

  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const ids: string[] = [];

  candidates.forEach((candidate, idx) => {
    const id = `recall-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;
    ids.push(id);
    batch.set(doc(itemsRef(studentId), id), {
      studentId,
      lessonId,
      targetForm: candidate.targetForm,
      meaningOrFunction: candidate.meaningOrFunction,
      learningType: candidate.learningType,
      ...(candidate.teacherNote ? { teacherNote: candidate.teacherNote } : {}),
      approvalStatus: 'draft',
      retrievalHistory: [],
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
  return ids;
}

/**
 * Zapisuje elementy po przeglądzie lektora.
 *
 * Zatwierdzone i odrzucone lecą jednym batchem, bo to jedna decyzja: element
 * nietknięty zostaje `draft` i nigdy nie trafia do kursanta.
 */
export async function saveRecallReview(
  studentId: string,
  lessonId: string,
  reviewed: Array<RecallCandidate & { approved: boolean }>
): Promise<{ approved: number; drafts: number }> {
  if (!studentId || !lessonId || reviewed.length === 0) return { approved: 0, drafts: 0 };

  const batch = writeBatch(db);
  const now = new Date().toISOString();
  let approved = 0;
  let drafts = 0;

  reviewed.forEach((item, idx) => {
    const id = `recall-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;
    if (item.approved) approved += 1;
    else drafts += 1;
    batch.set(doc(itemsRef(studentId), id), {
      studentId,
      lessonId,
      targetForm: item.targetForm,
      meaningOrFunction: item.meaningOrFunction,
      learningType: item.learningType,
      ...(item.teacherNote ? { teacherNote: item.teacherNote } : {}),
      approvalStatus: item.approved ? 'approved' : 'draft',
      retrievalHistory: [],
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
  return { approved, drafts };
}

/** Wszystkie elementy kursanta — dla widoku lektora. */
export async function getRecallItems(studentId: string): Promise<RecallItem[]> {
  if (!studentId) return [];
  const snapshot = await getDocs(query(itemsRef(studentId), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RecallItem));
}

/**
 * Kolejka na dziś: zatwierdzone i wymagalne.
 *
 * Warunek „nextDueAt <= dziś LUB brak historii" jest w Firestore jednym
 * zapytaniem nie do wyrażenia (to alternatywa na dwóch różnych polach), więc
 * filtrujemy po `approvalStatus` w bazie, a wymagalność liczymy na miejscu.
 * Przy skali tego produktu — kilkanaście lekcji na kursanta — to kilkadziesiąt
 * dokumentów, nie tysiące.
 */
export async function getDueRecallItems(
  studentId: string,
  max: number = 10
): Promise<RecallItem[]> {
  if (!studentId) return [];

  const snapshot = await getDocs(
    query(itemsRef(studentId), where('approvalStatus', '==', 'approved'))
  );
  const today = toDayString(new Date());

  const items = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as RecallItem))
    .filter((item) => {
      const noHistory = !item.retrievalHistory || item.retrievalHistory.length === 0;
      if (noHistory) return true;
      return !item.nextDueAt || item.nextDueAt <= today;
    });

  // Nowe przed powtarzanymi, a w obrębie grupy — najdawniej widziane pierwsze.
  items.sort((a, b) => {
    const aNew = !a.retrievalHistory?.length;
    const bNew = !b.retrievalHistory?.length;
    if (aNew !== bNew) return aNew ? -1 : 1;
    return (a.nextDueAt || a.createdAt).localeCompare(b.nextDueAt || b.createdAt);
  });

  return items.slice(0, max);
}

/** Dopisuje próbę do historii i przesuwa termin kolejnej powtórki. */
export async function recordRetrievalAttempt(
  studentId: string,
  itemId: string,
  result: RetrievalResult
): Promise<RetrievalAttempt> {
  const attempt: RetrievalAttempt = {
    date: new Date().toISOString(),
    result,
    nextDueAt: scheduleNextDue(result),
  };

  await updateDoc(doc(itemsRef(studentId), itemId), {
    retrievalHistory: arrayUnion(attempt),
    // Duplikat na wierzchu dokumentu — patrz komentarz przy `nextDueAt` w types.ts.
    nextDueAt: attempt.nextDueAt,
    updatedAt: new Date().toISOString(),
  });

  return attempt;
}

/** Zmiana statusu pojedynczego elementu z panelu lektora. */
export async function setRecallItemStatus(
  studentId: string,
  itemId: string,
  approvalStatus: RecallItem['approvalStatus']
): Promise<void> {
  await updateDoc(doc(itemsRef(studentId), itemId), {
    approvalStatus,
    updatedAt: new Date().toISOString(),
  });
}

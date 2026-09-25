import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { NoteDraft } from '../types';
import { getOrCreateStudentScratchpad } from './scratchpadService';

const DRAFTS_COLLECTION = 'drafts';

/**
 * Normalizuje pole daty do znacznika liczbowego (ms) dla deterministycznego sortowania.
 */
export const normalizeTimestamp = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (val.toMillis && typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  if (val.seconds !== undefined) {
    return val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1e6 : 0);
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  return 0;
};

/**
 * Formatuje datę szkicu do czytelnego formatu Cribro ("Dzisiaj, 14:20", "Wczoraj, 09:15" lub "DD.MM, HH:mm").
 */
export const formatDraftDate = (dateVal: any): string => {
  const ms = normalizeTimestamp(dateVal);
  if (!ms) return 'Przed chwilą';

  const date = new Date(ms);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Dzisiaj, ${timeStr}`;
  if (isYesterday) return `Wczoraj, ${timeStr}`;

  const dayMonth = date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  return `${dayMonth}, ${timeStr}`;
};

const mapDraft = (id: string, data: any): NoteDraft => ({
  id,
  teacherId: data.teacherId,
  title: data.title || 'Bez tytułu',
  scratchpadId: data.scratchpadId,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
});

const sortByUpdatedDesc = (drafts: NoteDraft[]): NoteDraft[] =>
  [...drafts].sort((a, b) => normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt));

/**
 * Pobiera listę szkiców danego lektora posortowaną po `updatedAt` (desc).
 */
export async function getDrafts(teacherId: string): Promise<NoteDraft[]> {
  if (!teacherId) return [];
  const q = query(collection(db, DRAFTS_COLLECTION), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);
  const drafts: NoteDraft[] = [];
  snapshot.forEach(docSnap => drafts.push(mapDraft(docSnap.id, docSnap.data())));
  return sortByUpdatedDesc(drafts);
}

/**
 * Subskrypcja na żywo do listy szkiców danego lektora.
 */
export function subscribeDrafts(
  teacherId: string,
  callback: (drafts: NoteDraft[]) => void
): () => void {
  if (!teacherId) return () => {};

  const q = query(collection(db, DRAFTS_COLLECTION), where('teacherId', '==', teacherId));

  return onSnapshot(
    q,
    snapshot => {
      const drafts: NoteDraft[] = [];
      snapshot.forEach(docSnap => drafts.push(mapDraft(docSnap.id, docSnap.data())));
      callback(sortByUpdatedDesc(drafts));
    },
    err => console.warn('[DraftsService] Błąd subskrypcji szkiców:', err?.message || err)
  );
}

/**
 * Tworzy nowy szkic: zakłada notatnik roboczy (kolekcja `scratchpads`, ten sam
 * mechanizm co notatnik kursanta) i dopisuje go do nazwanej listy szkiców
 * lektora, żeby dało się do niego wrócić.
 */
export async function createDraft(
  teacherId: string,
  teacherName: string,
  title: string
): Promise<NoteDraft> {
  if (!teacherId) {
    throw new Error('Brak teacherId — nie można utworzyć szkicu bez identyfikatora lektora.');
  }

  const trimmedTitle = title.trim() || 'Notatnik roboczy';

  const scratchpad = await getOrCreateStudentScratchpad(
    { id: null, name: trimmedTitle },
    { uid: teacherId, name: teacherName }
  );

  const id = doc(collection(db, DRAFTS_COLLECTION)).id;
  const draftData = {
    teacherId,
    title: trimmedTitle,
    scratchpadId: scratchpad.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, DRAFTS_COLLECTION, id), draftData);

  return {
    id,
    teacherId,
    title: trimmedTitle,
    scratchpadId: scratchpad.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Zmienia tytuł istniejącego szkicu.
 */
export async function renameDraft(draftId: string, title: string): Promise<void> {
  if (!draftId) return;
  const trimmedTitle = title.trim() || 'Notatnik roboczy';
  await updateDoc(doc(db, DRAFTS_COLLECTION, draftId), {
    title: trimmedTitle,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Usuwa wpis szkicu z listy. Sam notatnik (kolekcja `scratchpads`) zostaje
 * nietknięty — usuwamy tylko nazwany wpis na liście, nie cudzą/własną treść.
 */
export async function deleteDraft(draftId: string): Promise<void> {
  if (!draftId) return;
  await deleteDoc(doc(db, DRAFTS_COLLECTION, draftId));
}

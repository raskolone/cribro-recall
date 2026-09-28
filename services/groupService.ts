import { db, auth } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { StudentGroup, ScratchpadDocument } from '../types';
import { Group, normalizeGroup } from '../types/group';

const GROUPS_COLLECTION = 'groups';

/**
 * Grupy widoczne dla zalogowanego lektora/admina, przez `/api/groups`
 * (Admin SDK po stronie serwera, filtr po roli i `teacherProfileId`).
 *
 * To jedyne poprawne źródło listy grup dla widoków lektora — bezpośrednie
 * zapytanie klienckie bez `where` na kolekcji `groups` (jak stara
 * `getGroups()` poniżej) trafia w regułę Firestore, która wymaga, żeby
 * KAŻDY zwrócony dokument spełniał `teacherProfileId == uid` lub
 * `uid in memberProfileIds` — bez takiego filtra w zapytaniu odmawia
 * całego `list`, więc lektor (nie-admin) dostawał permission-denied,
 * cicho połykane przez `.catch(() => [])` u wołających.
 */
export async function fetchGroupsForCaller(): Promise<Group[]> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/groups', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(data.error || 'Nie udało się pobrać grup');
  }
  return (data.groups || []).map(normalizeGroup);
}

export async function getGroups(): Promise<StudentGroup[]> {
  try {
    const q = query(collection(db, GROUPS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentGroup));
  } catch (err) {
    console.warn('[groupService] Błąd pobierania grup (fallback do pustej tablicy):', err);
    try {
      const snap = await getDocs(collection(db, GROUPS_COLLECTION));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentGroup));
    } catch {
      return [];
    }
  }
}

export async function getGroupById(groupId: string): Promise<StudentGroup | null> {
  if (!groupId) return null;
  try {
    const docRef = doc(db, GROUPS_COLLECTION, groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as StudentGroup;
  } catch (err) {
    console.warn(`[groupService] Błąd pobierania grupy ${groupId}:`, err);
    return null;
  }
}

export async function getGroupsForTeacher(teacherId: string): Promise<StudentGroup[]> {
  if (!teacherId) return [];
  try {
    const q = query(collection(db, GROUPS_COLLECTION), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentGroup));
  } catch (err) {
    console.warn(`[groupService] Błąd pobierania grup dla lektora ${teacherId}:`, err);
    return [];
  }
}

/**
 * Grupy, których dany kursant jest członkiem — po polu kanonicznym
 * (`memberProfileIds`) LUB legacy (`memberIds`). Firestore nie umożliwia OR
 * na dwóch polach w jednym zapytaniu, więc odpytujemy dwa razy i mergujemy
 * po ID, tak by kursant zapisany tylko przez stary klient nie zniknął.
 */
export async function getGroupsForStudent(studentId: string): Promise<Group[]> {
  if (!studentId) return [];
  try {
    const [byCanonicalField, byLegacyField] = await Promise.all([
      getDocs(query(collection(db, GROUPS_COLLECTION), where('memberProfileIds', 'array-contains', studentId))),
      getDocs(query(collection(db, GROUPS_COLLECTION), where('memberIds', 'array-contains', studentId))),
    ]);

    const byId = new Map<string, Group>();
    [...byCanonicalField.docs, ...byLegacyField.docs].forEach((d) => {
      const normalized = normalizeGroup({ id: d.id, ...d.data() });
      if (normalized.id) byId.set(normalized.id, normalized);
    });
    return Array.from(byId.values());
  } catch (err) {
    console.warn(`[groupService] Błąd pobierania grup dla kursanta ${studentId}:`, err);
    return [];
  }
}

export async function createGroup(
  data: Omit<StudentGroup, 'id' | 'createdAt' | 'updatedAt'>
): Promise<StudentGroup> {
  const newRef = doc(collection(db, GROUPS_COLLECTION));
  const now = new Date().toISOString();

  const newGroup: StudentGroup = {
    id: newRef.id,
    name: data.name.trim(),
    type: data.type || 'group',
    teacherId: data.teacherId,
    teacherName: data.teacherName || '',
    level: data.level || 'B2',
    company: data.company || '',
    memberIds: data.memberIds || [],
    memberNames: data.memberNames || [],
    memberEmails: data.memberEmails || [],
    status: data.status || 'active',
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(newRef, newGroup);
  return newGroup;
}

export async function updateGroup(
  groupId: string,
  updates: Partial<Omit<StudentGroup, 'id' | 'createdAt'>>
): Promise<void> {
  if (!groupId) return;
  const docRef = doc(db, GROUPS_COLLECTION, groupId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (!groupId) return;
  const docRef = doc(db, GROUPS_COLLECTION, groupId);
  await deleteDoc(docRef);
}

import {
  scratchpadDocRef,
  ensureScratchpadPinIndex,
  getInitialScratchpadContent,
} from './scratchpadService';
import { generateAccessCode, normalizeAccessCode } from '../utils/accessCode';

/**
 * Upewnia się, że grupa posiada przypisany notatnik grupowy (`activeScratchpadId`).
 * Jeśli nie, automatycznie go tworzy i zapisuje ID w dokumencie grupy.
 */
export async function ensureGroupScratchpad(
  group: StudentGroup,
  teacher: { uid: string; name: string }
): Promise<string> {
  if (group.activeScratchpadId) {
    return group.activeScratchpadId;
  }

  const docId = `sp_group_${group.id}`;
  const pin = normalizeAccessCode(generateAccessCode(6));
  const now = new Date().toISOString();
  const initial = getInitialScratchpadContent(group.name);

  const newDoc: ScratchpadDocument = {
    id: docId,
    pin,
    groupId: group.id,
    groupName: group.name,
    memberIds: group.memberIds,
    studentName: group.name,
    teacherUid: teacher.uid,
    teacherName: teacher.name || 'Lektor CRIBRO',
    title: `Notatnik: ${group.name} (${group.level})`,
    contentHtml: initial.html,
    contentText: initial.text,
    allowStudentEdit: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const ref = scratchpadDocRef(docId);
  await setDoc(ref, newDoc, { merge: true });
  await ensureScratchpadPinIndex(pin, docId);

  // Zapisujemy powiązanie w dokumencie grupy
  await updateGroup(group.id, { activeScratchpadId: docId });

  return docId;
}

/**
 * Wariant `ensureGroupScratchpad` dla kanonicznego modelu `Group`
 * (`memberProfileIds` / `teacherProfileId`, z `services/groupService.ts` +
 * `/api/groups`). W odróżnieniu od wariantu legacy powyżej, powiązanie
 * `activeScratchpadId` zapisuje WYŁĄCZNIE przez backend (`PUT /api/groups/:id`,
 * Admin SDK) — nigdy przez `updateDoc` z klienta, zgodnie z zasadą "read nie
 * mutuje danych" z lekcji z 20.09. Tworzenie dokumentu notatnika jest
 * idempotentne: drugi klik (gdy zapis `activeScratchpadId` już się udał)
 * kończy się wcześniejszym `return`; jeśli pierwszy klik zdążył utworzyć
 * dokument, ale PUT się nie powiódł, kolejny klik NIE nadpisuje treści
 * (sprawdzamy `getDoc` przed `setDoc`).
 */
export async function ensureCanonicalGroupScratchpad(
  group: Group,
  teacher: { uid: string; name: string },
  idToken?: string | null
): Promise<string> {
  if (group.activeScratchpadId) {
    return group.activeScratchpadId;
  }

  const docId = `sp_group_${group.id}`;
  const ref = scratchpadDocRef(docId);
  const existing = await getDoc(ref);

  if (!existing.exists()) {
    const pin = normalizeAccessCode(generateAccessCode(6));
    const now = new Date().toISOString();
    const initial = getInitialScratchpadContent(group.name);

    const newDoc: ScratchpadDocument = {
      id: docId,
      pin,
      groupId: group.id,
      groupName: group.name,
      memberIds: group.memberProfileIds || [],
      studentName: group.name,
      teacherUid: teacher.uid,
      teacherName: teacher.name || 'Lektor CRIBRO',
      title: `Notatnik: ${group.name}${group.level ? ` (${group.level})` : ''}`,
      contentHtml: initial.html,
      contentText: initial.text,
      allowStudentEdit: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(ref, newDoc);
    await ensureScratchpadPinIndex(pin, docId);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`/api/groups/${group.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ activeScratchpadId: docId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as any));
    throw new Error(data.message || 'Nie udało się przypisać notatnika do grupy.');
  }

  return docId;
}

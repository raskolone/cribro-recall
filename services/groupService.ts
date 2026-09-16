import { db } from '../firebase';
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

const GROUPS_COLLECTION = 'groups';

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

export async function getGroupsForStudent(studentId: string): Promise<StudentGroup[]> {
  if (!studentId) return [];
  try {
    const q = query(
      collection(db, GROUPS_COLLECTION),
      where('memberIds', 'array-contains', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentGroup));
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

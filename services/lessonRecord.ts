import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { LessonRecord, VocabularySet } from '../types';
import { buildVocabularySetTitle, countVocabularyItems } from '../utils/vocabulary';

export async function createLessonRecordWithVocabularySet(input: {
  studentId: string;
  date: string;
  topic: string;
  vocabularyText: string;
  lessonSummary?: string;
}): Promise<{ lessonRecordId: string; vocabularySetId: string }> {
  // Generate IDs
  const lessonRecordId = `lesson-${Date.now()}`;
  const vocabularySetId = `vocab-${Date.now()}`;
  const now = new Date().toISOString();

  // 1. Create LessonRecord object
  const lessonRecord: LessonRecord = {
    id: lessonRecordId,
    studentId: input.studentId,
    date: input.date,
    topic: input.topic,
    vocabularyText: input.vocabularyText,
    lessonSummary: input.lessonSummary,
    vocabularySetId: vocabularySetId,
    createdAt: now,
    updatedAt: now,
  };

  // 2. Create VocabularySet object
  const vocabularySet: VocabularySet = {
    id: vocabularySetId,
    studentId: input.studentId,
    lessonRecordId: lessonRecordId,
    title: buildVocabularySetTitle(input.date, input.topic),
    date: input.date,
    topic: input.topic,
    vocabularyText: input.vocabularyText,
    itemCount: countVocabularyItems(input.vocabularyText),
    status: 'draft',
    source: 'lesson_record',
    createdAt: now,
    updatedAt: now,
  };

  // 3. Save both to Firestore
  // We save them in root level collections for easier querying, or under the student's subcollection depending on how current code works.
  // The prompt says "create a lesson record in Firestore" and "create a vocabulary set in Firestore".
  // Looking at AdminPanel.tsx, lesson records are saved at: users/${studentId}/lessonRecords/${recordId}
  
  const recordRef = doc(db, `users/${input.studentId}/lessonRecords/${lessonRecordId}`);
  const setRef = doc(db, `users/${input.studentId}/vocabularySets/${vocabularySetId}`);

  const { id: _rId, ...recordData } = lessonRecord;
  const { id: _sId, ...setData } = vocabularySet;

  await setDoc(recordRef, recordData);
  await setDoc(setRef, setData);

  return { lessonRecordId, vocabularySetId };
}

export async function getLessonRecordsForStudent(studentId: string): Promise<LessonRecord[]> {
  const recordsRef = collection(db, `users/${studentId}/lessonRecords`);
  const q = query(recordsRef, orderBy('createdAt', 'desc'));
  
  const snapshot = await getDocs(q);
  const records: LessonRecord[] = [];
  
  snapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as LessonRecord);
  });
  
  return records;
}

export async function getVocabularySetsForStudent(studentId: string): Promise<VocabularySet[]> {
  const setsRef = collection(db, `users/${studentId}/vocabularySets`);
  const q = query(setsRef, orderBy('createdAt', 'desc'));
  
  const snapshot = await getDocs(q);
  const sets: VocabularySet[] = [];
  
  snapshot.forEach((doc) => {
    sets.push({ id: doc.id, ...doc.data() } as VocabularySet);
  });
  
  return sets;
}

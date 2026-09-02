import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { LessonRecord, VocabularySet } from '../types';
import { buildVocabularySetTitle, countVocabularyItems, getApprovedVocabularyText, splitVocabularyLines } from '../utils/vocabulary';

export function parseVocabularyTextToCards(vocabularyText: string) {
  if (!vocabularyText) return [];
  const lines = vocabularyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.map((line, idx) => {
    let term = line;
    let definition = '';
    if (line.includes(' - ')) {
      const parts = line.split(' - ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' - ').trim();
    } else if (line.includes(' – ')) {
      const parts = line.split(' – ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' – ').trim();
    } else if (line.includes(':')) {
      const parts = line.split(':');
      term = parts[0].trim();
      definition = parts.slice(1).join(':').trim();
    } else if (line.includes('=')) {
      const parts = line.split('=');
      term = parts[0].trim();
      definition = parts.slice(1).join('=').trim();
    }
    return {
      position: idx,
      term,
      definition,
      termLanguage: 'English',
      definitionLanguage: 'Polish'
    };
  });
}

export async function syncFlashcardSetForLesson(
  lessonRecordId: string,
  studentId: string,
  date: string,
  topic: string,
  vocabularyText: string
) {
  if (!vocabularyText || vocabularyText.trim().length === 0) {
    return;
  }

  try {
    const flashcardSetId = `set-lesson-${lessonRecordId}`;
    const cards = parseVocabularyTextToCards(vocabularyText);
    const title = buildVocabularySetTitle(date, topic);

    const flashcardSetRef = doc(db, `sets/${flashcardSetId}`);
    await setDoc(flashcardSetRef, {
      userId: studentId,
      title: title,
      description: `Słownictwo z lekcji: ${date}`,
      isPublic: false,
      cardCount: cards.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      assignedByTeacher: true,
      isLessonVocabulary: true,
      lessonTopic: topic,
      lessonDate: date
    }, { merge: true });

    // Re-create the subcollection cards by deleting old ones and writing new ones
    const cardsRef = collection(db, `sets/${flashcardSetId}/flashcards`);
    const existingSnapshot = await getDocs(cardsRef);
    const batch = writeBatch(db);
    
    // Delete existing cards
    existingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Add new cards
    cards.forEach((card, index) => {
      const cardRef = doc(db, `sets/${flashcardSetId}/flashcards/card-${index}`);
      batch.set(cardRef, card);
    });

    await batch.commit();
    console.log(`Successfully synced flashcard set for lesson ${lessonRecordId}`);
  } catch (e) {
    console.warn("Could not sync flashcard set for lesson:", e);
  }
}

export async function createLessonRecordWithVocabularySet(input: {
  studentId: string;
  date: string;
  topic: string;
  vocabularyText: string;
  lessonSummary?: string;
  studentSpeaking?: string;
  thingsToImprove?: string;
  suggestedFollowUp?: string;
  scenarioId?: string;
  scenarioTopic?: string;
  scenarioContent?: string;
  /** Pozycje zatwierdzone do powtórek. Pominięcie = cały `vocabularyText`. */
  approvedItems?: string[];
}): Promise<{ lessonRecordId: string; vocabularySetId: string }> {
  // Generate IDs
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const lessonRecordId = `lesson-${Date.now()}-${randomSuffix}`;
  const vocabularySetId = `vocab-${Date.now()}-${randomSuffix}`;
  const now = new Date().toISOString();

  const title = buildVocabularySetTitle(input.date, input.topic);

  // 1. Create LessonRecord object
  const lessonRecord: LessonRecord = {
    id: lessonRecordId,
    studentId: input.studentId,
    date: input.date,
    topic: input.topic,
    vocabularyText: input.vocabularyText,
    lessonSummary: input.lessonSummary,
    studentSpeaking: input.studentSpeaking,
    thingsToImprove: input.thingsToImprove,
    suggestedFollowUp: input.suggestedFollowUp,
    vocabularySetId: vocabularySetId,
    scenarioId: input.scenarioId,
    scenarioTopic: input.scenarioTopic,
    scenarioContent: input.scenarioContent,
    createdAt: now,
    updatedAt: now,
  };

  // 2. Create VocabularySet object with used: false
  const vocabularySet: VocabularySet = {
    id: vocabularySetId,
    studentId: input.studentId,
    lessonRecordId: lessonRecordId,
    title: title,
    date: input.date,
    topic: input.topic,
    vocabularyText: input.vocabularyText,
    approvedItems: input.approvedItems ?? splitVocabularyLines(input.vocabularyText),
    itemCount: countVocabularyItems(input.vocabularyText),
    status: 'draft',
    source: 'lesson_record',
    createdAt: now,
    updatedAt: now,
    used: false,
  };

  // 3. Save both to Firestore
  const recordRef = doc(db, `users/${input.studentId}/lessonRecords/${lessonRecordId}`);
  const setRef = doc(db, `users/${input.studentId}/vocabularySets/${vocabularySetId}`);

  const { id: _rId, ...recordData } = lessonRecord;
  const { id: _sId, ...setData } = vocabularySet;

  await setDoc(recordRef, recordData);
  await setDoc(setRef, setData);

  // Mark student user record as having a new lesson & new vocabulary for notification popups & badges
  try {
    await updateDoc(doc(db, 'users', input.studentId), {
      hasNewLesson: true,
      hasNewVocabulary: true
    });
  } catch (e) {
    console.warn("Could not set hasNewLesson on user doc:", e);
  }

  // 4. Extract vocabulary as a dedicated FlashcardSet
  if (input.vocabularyText && input.vocabularyText.trim().length > 0) {
    await syncFlashcardSetForLesson(
      lessonRecordId,
      input.studentId,
      input.date,
      input.topic,
      getApprovedVocabularyText({
        vocabularyText: input.vocabularyText,
        approvedItems: input.approvedItems,
      })
    );
  }

  return { lessonRecordId, vocabularySetId };
}

export async function getLessonRecordsForStudent(studentId: string): Promise<LessonRecord[]> {
  const recordsRef = collection(db, `users/${studentId}/lessonRecords`);
  const q = query(recordsRef, orderBy('date', 'desc'));
  
  const snapshot = await getDocs(q);
  const records: LessonRecord[] = [];
  
  snapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as LessonRecord);
  });
  
  return records;
}

export async function getVocabularySetsForStudent(studentId: string): Promise<VocabularySet[]> {
  const setsRef = collection(db, `users/${studentId}/vocabularySets`);
  const q = query(setsRef, orderBy('date', 'desc'));
  
  const snapshot = await getDocs(q);
  let sets: VocabularySet[] = [];
  
  snapshot.forEach((doc) => {
    sets.push({ id: doc.id, ...doc.data() } as VocabularySet);
  });
  
  // Backward compatibility: fetch old lessonRecords that don't have a corresponding vocabularySet
  const recordsRef = collection(db, `users/${studentId}/lessonRecords`);
  const qRecords = query(recordsRef, orderBy('date', 'desc'));
  const recordsSnapshot = await getDocs(qRecords);
  
  recordsSnapshot.forEach((docSnap) => {
    const record = { id: docSnap.id, ...docSnap.data() } as LessonRecord;
    // Check if this record has vocabulary but doesn't have a corresponding vocabulary set
    if (record.vocabularyText && record.vocabularyText.trim().length > 0) {
       const alreadyExists = sets.some(s => s.lessonRecordId === record.id || s.date === record.date && s.topic === record.topic);
       if (!alreadyExists) {
          sets.push({
            id: `generated-${record.id}`,
            studentId: record.studentId,
            lessonRecordId: record.id,
            title: buildVocabularySetTitle(record.date, record.topic),
            date: record.date,
            topic: record.topic,
            vocabularyText: record.vocabularyText,
            itemCount: countVocabularyItems(record.vocabularyText),
            status: 'ready',
            source: 'lesson_record',
            createdAt: record.createdAt || record.date,
            updatedAt: record.updatedAt || record.date
          });
       }
    }
  });
  
  // Sort by date descending again after merging
  sets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return sets;
}

export async function markVocabularySetAsUsed(studentId: string, setId: string): Promise<void> {
  if (!setId || setId.startsWith('generated-')) {
    return;
  }
  try {
    const setRef = doc(db, `users/${studentId}/vocabularySets/${setId}`);
    await updateDoc(setRef, { used: true });
  } catch (err) {
    console.error("Failed to mark vocabulary set as used:", err);
  }
}

export async function deleteLessonRecord(studentId: string, lessonRecord: LessonRecord): Promise<void> {
  const recordId = lessonRecord.id;
  const vocabId = lessonRecord.vocabularySetId;

  // 1. Delete lesson record
  const recordRef = doc(db, `users/${studentId}/lessonRecords/${recordId}`);
  await deleteDoc(recordRef);

  // 2. Delete vocabulary set if it exists
  if (vocabId) {
    const setRef = doc(db, `users/${studentId}/vocabularySets/${vocabId}`);
    await deleteDoc(setRef);
  }

  // 3. Delete flashcard set if it exists
  const flashcardSetId = `set-lesson-${recordId}`;
  const flashcardSetRef = doc(db, `sets/${flashcardSetId}`);
  await deleteDoc(flashcardSetRef);
}


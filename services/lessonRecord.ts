import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { LessonRecord, VocabularySet } from '../types';
import { buildVocabularySetTitle, countVocabularyItems } from '../utils/vocabulary';

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

export async function createLessonRecordWithVocabularySet(input: {
  studentId: string;
  date: string;
  topic: string;
  vocabularyText: string;
  lessonSummary?: string;
  studentSpeaking?: string;
  thingsToImprove?: string;
  suggestedFollowUp?: string;
}): Promise<{ lessonRecordId: string; vocabularySetId: string }> {
  // Generate IDs
  const lessonRecordId = `lesson-${Date.now()}`;
  const vocabularySetId = `vocab-${Date.now()}`;
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

  // 4. Extract vocabulary as a dedicated FlashcardSet
  if (input.vocabularyText && input.vocabularyText.trim().length > 0) {
    try {
      const flashcardSetId = `set-lesson-${Date.now()}`;
      const cards = parseVocabularyTextToCards(input.vocabularyText);
      const flashcardSetRef = doc(db, `sets/${flashcardSetId}`);
      await setDoc(flashcardSetRef, {
        userId: input.studentId,
        title: title,
        description: `Słownictwo z lekcji: ${input.date}`,
        isPublic: false,
        cardCount: cards.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        assignedByTeacher: true,
        isLessonVocabulary: true,
        lessonTopic: input.topic,
        lessonDate: input.date
      });

      if (cards.length > 0) {
        const batch = writeBatch(db);
        cards.forEach((card, index) => {
          const cardRef = doc(db, `sets/${flashcardSetId}/flashcards/card-${index}`);
          batch.set(cardRef, card);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Could not create flashcard set for lesson:", e);
    }
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

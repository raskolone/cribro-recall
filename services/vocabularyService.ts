import { collection, addDoc, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VocabularyItem } from '../types/vocabulary';
import { LessonRecord } from '../types';

export const importVocabularyFromLessons = async (studentId: string): Promise<{ added: number, skipped: number }> => {
  try {
    // 1. Fetch lesson records
    const lessonsRef = collection(db, `users/${studentId}/lessonRecords`);
    const lessonsSnapshot = await getDocs(lessonsRef);
    const lessons = lessonsSnapshot.docs.map(doc => doc.data() as LessonRecord);
    
    // Sort lessons by date to assign lessonNumber chronologically
    lessons.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Fetch existing vocabulary to prevent duplicates
    const vocabRef = collection(db, "vocabulary");
    const vocabQuery = query(vocabRef, where("studentId", "==", studentId));
    const vocabSnapshot = await getDocs(vocabQuery);
    const existingVocab = new Set(vocabSnapshot.docs.map(doc => doc.data().english.toLowerCase().trim()));

    let added = 0;
    let skipped = 0;

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const lessonNumber = i + 1; // 1-based index
      if (!lesson.words) continue;

      // Parse words: recognize commas or newlines
      const rawItems = lesson.words.split(/[\n,;]+/).map(item => item.trim()).filter(item => item.length > 0);

      for (const rawItem of rawItems) {
        // Try to split into english and polish (usually separated by -, =, or :)
        const parts = rawItem.split(/\s*[-=:]\s*/);
        let english = "";
        let polish = "";

        if (parts.length >= 2) {
          english = parts[0].trim();
          polish = parts.slice(1).join(" ").trim();
        } else {
          english = rawItem;
          polish = "";
        }

        if (!english) continue;

        const englishKey = english.toLowerCase().trim();

        if (existingVocab.has(englishKey)) {
          skipped++;
        } else {
          // Add to vocabulary
          const newItem: Omit<VocabularyItem, "id"> = {
            studentId,
            lessonNumber,
            english,
            polish,
            status: "new",
            mistakeCount: 0,
          };

          await addDoc(collection(db, "vocabulary"), newItem);
          existingVocab.add(englishKey);
          added++;
        }
      }
    }

    return { added, skipped };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "vocabulary_import");
    throw error;
  }
};

export const addVocabularyItem = async (item: Omit<VocabularyItem, "id">): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, "vocabulary"), item);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "vocabulary");
    throw error;
  }
};

export const getVocabularyByStudentAndLesson = async (studentId: string, lessonRange: number[]): Promise<VocabularyItem[]> => {
  if (!lessonRange || lessonRange.length === 0) {
    return [];
  }

  try {
    const q = query(
      collection(db, "vocabulary"),
      where("studentId", "==", studentId),
      where("lessonNumber", "in", lessonRange)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnapshot => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    } as VocabularyItem));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "vocabulary");
    throw error;
  }
};

export const updateVocabularyStatus = async (id: string, status: VocabularyItem["status"]): Promise<void> => {
  try {
    const docRef = doc(db, "vocabulary", id);
    await updateDoc(docRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vocabulary/${id}`);
    throw error;
  }
};

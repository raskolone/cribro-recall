
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { Word, WordSet, RevisionFrequency, PracticeHistory, ExerciseType } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface VocabularyContextType {
  words: Word[];
  wordSets: WordSet[];
  addWords: (newWords: Omit<Word, 'id' | 'isDifficult'>[]) => Promise<void>;
  addWordSet: (set: Omit<WordSet, 'id' | 'createdAt'>) => Promise<void>;
  updateWordSet: (setId: string, data: Partial<WordSet>) => Promise<void>;
  deleteWordSet: (setId: string) => Promise<void>;
  updateWord: (wordId: string, data: Partial<Word>) => Promise<void>;
  deleteWord: (wordId: string) => Promise<void>;
  deleteAllWords: () => Promise<void>;
  reorderSetWords: (setId: string, reorderedWords: Word[]) => Promise<void>;
  toggleWordDifficulty: (wordId: string) => Promise<void>;
  updateWordSpacedRepetition: (wordId: string, isCorrect: boolean) => Promise<void>;
  difficultWords: Word[];
  dueWords: Word[];
  frequency: RevisionFrequency;
  setFrequency: (freq: RevisionFrequency) => Promise<void>;
  lastPractice: PracticeHistory | null;
  lastRevisionDate: string | null;
  savePracticeHistory: (exerciseType: ExerciseType, isRevisionMode: boolean) => Promise<void>;
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

export const VocabularyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [words, setWords] = useState<Word[]>([]);
  const [wordSets, setWordSets] = useState<WordSet[]>([]);
  const [frequency, setFrequencyState] = useState<RevisionFrequency>('Daily');
  const [lastPractice, setLastPractice] = useState<PracticeHistory | null>(null);
  const [lastRevisionDate, setLastRevisionDate] = useState<string | null>(null);
  const { user } = useAuth(); // Assume we can get user here to check if it's a mocked Demo
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    // If no real UID but user is populated -> it is a demo mock, bypass firestore
    if (!userId && user) return; 
    if (!userId) return;

    const wordsRef = collection(db, `users/${userId}/words`);
    const unsubscribeWords = onSnapshot(query(wordsRef), (snapshot) => {
      const wordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
      setWords(wordsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/words`);
    });

    const setsRef = collection(db, `users/${userId}/wordSets`);
    const unsubscribeSets = onSnapshot(query(setsRef), (snapshot) => {
      const setsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WordSet));
      setWordSets(setsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/wordSets`);
    });

    const settingsRef = doc(db, `users/${userId}/settings/practice`);
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.revisionFrequency) setFrequencyState(data.revisionFrequency as RevisionFrequency);
        if (data.lastExerciseType && data.lastPracticeDate) {
          setLastPractice({
            lastExerciseType: data.lastExerciseType,
            lastPracticeDate: data.lastPracticeDate,
          });
        }
        if (data.lastRevisionDate) {
          setLastRevisionDate(data.lastRevisionDate);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/settings/practice`);
    });

    return () => {
      unsubscribeWords();
      unsubscribeSets();
      unsubscribeSettings();
    };
  }, [userId]);

  const addWords = async (newWords: Omit<Word, 'id' | 'isDifficult'>[]) => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      newWords.forEach(w => {
        const wordId = `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const wordRef = doc(db, `users/${userId}/words/${wordId}`);
        batch.set(wordRef, { ...w, isDifficult: false });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/words`);
    }
  };

  const addWordSet = async (set: Omit<WordSet, 'id' | 'createdAt'>) => {
    if (!userId) return;
    try {
      const setId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const setRef = doc(db, `users/${userId}/wordSets/${setId}`);
      await setDoc(setRef, {
        ...set,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${userId}/wordSets`);
    }
  };

  const updateWordSet = async (setId: string, data: Partial<WordSet>) => {
    if (!userId) return;
    try {
      const setRef = doc(db, `users/${userId}/wordSets/${setId}`);
      await updateDoc(setRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/wordSets/${setId}`);
    }
  };

  const deleteWordSet = async (setId: string) => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      const setRef = doc(db, `users/${userId}/wordSets/${setId}`);
      batch.delete(setRef);
      
      const wordsToDelete = words.filter(w => w.setId === setId);
      wordsToDelete.forEach(w => {
        const wordRef = doc(db, `users/${userId}/words/${w.id}`);
        batch.delete(wordRef);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/wordSets/${setId}`);
    }
  };

  const updateWord = async (wordId: string, data: Partial<Word>) => {
    if (!userId) return;
    try {
      const wordRef = doc(db, `users/${userId}/words/${wordId}`);
      await updateDoc(wordRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/words/${wordId}`);
    }
  };

  const deleteWord = async (wordId: string) => {
    if (!userId) return;
    try {
      const wordRef = doc(db, `users/${userId}/words/${wordId}`);
      await deleteDoc(wordRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/words/${wordId}`);
    }
  };

  const deleteAllWords = async () => {
    if (!userId) return;
    try {
      const chunks = [];
      for (let i = 0; i < words.length; i += 500) {
        chunks.push(words.slice(i, i + 500));
      }
      
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(word => {
          const wordRef = doc(db, `users/${userId}/words/${word.id}`);
          batch.delete(wordRef);
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/words`);
    }
  };

  const reorderSetWords = async (setId: string, reorderedWords: Word[]) => {
    // Firestore doesn't inherently support manual ordering without an order field.
    // We would need to add an 'order' field to Word to support this properly in DB.
    // For now, we'll update local state immediately, but to persist we need 'order' field.
    // Let's update the local state for immediate UI feedback, but we should ideally update DB.
    // Since we don't have an order field, we won't persist order to DB in this simple implementation
    // unless we add an order field to the Word type.
    setWords(prev => {
      const otherWords = prev.filter(w => w.setId !== setId);
      return [...reorderedWords, ...otherWords];
    });
  };

  const toggleWordDifficulty = async (wordId: string) => {
    if (!userId) return;
    const word = words.find(w => w.id === wordId);
    if (!word) return;
    try {
      const wordRef = doc(db, `users/${userId}/words/${wordId}`);
      await updateDoc(wordRef, { isDifficult: !word.isDifficult });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/words/${wordId}`);
    }
  };

  const updateWordSpacedRepetition = async (wordId: string, isCorrect: boolean) => {
    if (!userId) return;
    const word = words.find(w => w.id === wordId);
    if (!word) return;

    // SRA Algorithm: 1, 3, 7, 14 days
    const intervals = [1, 3, 7, 14]; 
    let nextLevel = isCorrect ? (word.repetitionLevel !== undefined ? word.repetitionLevel + 1 : 0) : 0;
    
    // Cap level at intervals.length - 1
    if (nextLevel >= intervals.length) nextLevel = intervals.length - 1;

    const daysToAdd = intervals[nextLevel];
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);

    try {
      const wordRef = doc(db, `users/${userId}/words/${wordId}`);
      await updateDoc(wordRef, {
        repetitionLevel: nextLevel,
        nextReviewDate: nextReviewDate.toISOString(),
        // If incorrect, mark as difficult. If correct and high level, maybe unmark?
        // For now, let's just update SRA fields.
        isDifficult: !isCorrect || word.isDifficult
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/words/${wordId}`);
    }
  };

  const setFrequency = async (freq: RevisionFrequency) => {
    if (!userId) return;
    try {
      const settingsRef = doc(db, `users/${userId}/settings/practice`);
      await setDoc(settingsRef, { revisionFrequency: freq }, { merge: true });
      setFrequencyState(freq);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/settings/practice`);
    }
  };

  const savePracticeHistory = async (exerciseType: ExerciseType, isRevisionMode: boolean) => {
    if (!userId) return;
    try {
      const now = new Date().toISOString();
      
      // Add to practiceLogs FIRST
      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const logRef = doc(db, `users/${userId}/practiceLogs/${logId}`);
      await setDoc(logRef, {
        exerciseType,
        date: now,
        isRevisionMode
      });
      
      // Update settings SECOND (if it fails, at least log is saved)
      try {
        const settingsRef = doc(db, `users/${userId}/settings/practice`);
        const updateData: any = {
          lastExerciseType: exerciseType,
          lastPracticeDate: now,
        };
        if (isRevisionMode) {
          updateData.lastRevisionDate = now;
        }
        await setDoc(settingsRef, updateData, { merge: true });
      } catch (e) {
        console.warn("Failed to update practice settings:", e);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/settings/practice`);
    }
  };
  
  const difficultWords = words.filter(w => w.isDifficult);
  const dueWords = words.filter(w => {
    if (!w.nextReviewDate) return true; // New words are always "due" for initial learning
    return new Date(w.nextReviewDate) <= new Date();
  });

  return (
    <VocabularyContext.Provider value={{ 
      words, 
      wordSets, 
      addWords, 
      addWordSet, 
      updateWordSet,
      deleteWordSet, 
      updateWord,
      deleteWord, 
      deleteAllWords,
      reorderSetWords,
      toggleWordDifficulty, 
      updateWordSpacedRepetition,
      difficultWords, 
      dueWords,
      frequency, 
      setFrequency,
      lastPractice,
      lastRevisionDate,
      savePracticeHistory
    }}>
      {children}
    </VocabularyContext.Provider>
  );
};

export const useVocabulary = (): VocabularyContextType => {
  const context = useContext(VocabularyContext);
  if (!context) {
    throw new Error('useVocabulary must be used within a VocabularyProvider');
  }
  return context;
};

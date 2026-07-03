import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { FlashcardSet, Flashcard, StudySession, SessionResult, AISuggestionCache } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, getDoc, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface FlashcardContextType {
  sets: FlashcardSet[];
  sessions: StudySession[];
  createSet: (data: Partial<FlashcardSet>) => Promise<string>;
  updateSet: (setId: string, data: Partial<FlashcardSet>) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  
  getFlashcards: (setId: string) => Promise<Flashcard[]>;
  saveFlashcards: (setId: string, cards: Partial<Flashcard>[]) => Promise<void>;
  
  saveSession: (sessionData: Partial<StudySession>, results: Partial<SessionResult>[]) => Promise<void>;
  getSessions: (setId?: string) => Promise<StudySession[]>;
  getSessionResults: (sessionId: string) => Promise<SessionResult[]>;
}

const FlashcardContext = createContext<FlashcardContextType | undefined>(undefined);

export const FlashcardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const { user } = useAuth();
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId && user) return; 
    if (!userId) return;

    let currentDbSets: FlashcardSet[] = [];
    let currentLessonSets: FlashcardSet[] = [];

    const updateMergedSets = () => {
      setSets([...currentDbSets, ...currentLessonSets]);
    };

    const setsRef = collection(db, 'sets');
    const q = query(setsRef, where('userId', '==', userId));
    
    const unsubscribeSets = onSnapshot(q, (snapshot) => {
      currentDbSets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashcardSet));
      updateMergedSets();
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sets');
    });

    const lessonsRef = collection(db, `users/${userId}/lessonRecords`);
    const qLessons = query(lessonsRef, orderBy('date', 'desc'));
    const unsubscribeLessons = onSnapshot(qLessons, (snapshot) => {
      const lessonSets: FlashcardSet[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.vocabularyText && data.vocabularyText.trim().length > 0) {
            let rawLines: string[] = [];
            if (data.vocabularyText.includes('\n')) {
              rawLines = data.vocabularyText.split('\n');
            } else {
              rawLines = data.vocabularyText.split(/[,;]+/);
            }
            const vocabList = rawLines.map((i: string) => i.trim()).filter((i: string) => i.length > 0);
            if (vocabList.length > 0) {
                lessonSets.push({
                    id: `lesson_${doc.id}`,
                    userId: userId,
                    title: `[Lekcja] ${data.topic || 'Bez tematu'}`,
                    description: `Słownictwo z lekcji: ${data.date}`,
                    isPublic: false,
                    cardCount: vocabList.length,
                    createdAt: data.createdAt || data.date,
                    updatedAt: data.date,
                    isLessonVocabulary: true
                });
            }
        }
      });
      currentLessonSets = lessonSets;
      updateMergedSets();
    }, (error) => {
      console.error('Error fetching lessons for vocab:', error);
    });

    const sessionsRef = collection(db, 'sessions');
    const qSessions = query(sessionsRef, where('userId', '==', userId));
    
    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession));
      setSessions(sessionsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });

    return () => {
      unsubscribeSets();
      unsubscribeLessons();
      unsubscribeSessions();
    };
  }, [userId]);

  const createSet = async (data: Partial<FlashcardSet>) => {
    if (!userId) throw new Error('Not authenticated');
    try {
      const setId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const setRef = doc(db, `sets/${setId}`);
      
      const newSet = {
        ...data,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cardCount: data.cardCount || 0,
        isPublic: data.isPublic || false,
      };
      
      await setDoc(setRef, newSet);
      return setId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sets');
      throw error;
    }
  };

  const updateSet = async (setId: string, data: Partial<FlashcardSet>) => {
    if (!userId) return;
    try {
      const setRef = doc(db, `sets/${setId}`);
      await updateDoc(setRef, { ...data, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sets/${setId}`);
    }
  };

  const deleteSet = async (setId: string) => {
    if (!userId) return;
    try {
      const setRef = doc(db, `sets/${setId}`);
      const cardsRef = collection(db, `sets/${setId}/flashcards`);
      const cardsSnapshot = await getDocs(cardsRef);
      
      const batch = writeBatch(db);
      batch.delete(setRef);
      
      cardsSnapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sets/${setId}`);
    }
  };

  const parseVocabularyLine = (line: string) => {
    let cleanLine = line.replace(/^[\s\*\-\•\d\.]+\s*/, '').trim();
    const separatorMatch = cleanLine.match(/\s+[\-\–\—\:=]\s+/);
    if (separatorMatch && separatorMatch.index !== undefined) {
      const word = cleanLine.substring(0, separatorMatch.index).trim();
      const translation = cleanLine.substring(separatorMatch.index + separatorMatch[0].length).trim();
      return { word, translation };
    } else {
      const fallbackMatch = cleanLine.match(/[:=]/) || cleanLine.match(/[\-\–\—]/);
      if (fallbackMatch && fallbackMatch.index !== undefined) {
        const word = cleanLine.substring(0, fallbackMatch.index).trim();
        const translation = cleanLine.substring(fallbackMatch.index + fallbackMatch[0].length).trim();
        return { word, translation };
      }
    }
    return { word: cleanLine, translation: null };
  };

  const getFlashcards = async (setId: string) => {
    if (!userId) return [];
    
    if (setId.startsWith('lesson_')) {
      const lessonId = setId.replace('lesson_', '');
      try {
        const lessonRef = doc(db, `users/${userId}/lessonRecords`, lessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (lessonSnap.exists()) {
          const lessonData = lessonSnap.data();
          if (lessonData.vocabularyText) {
            let rawLines: string[] = [];
            if (lessonData.vocabularyText.includes('\n')) {
              rawLines = lessonData.vocabularyText.split('\n');
            } else {
              rawLines = lessonData.vocabularyText.split(/[,;]+/);
            }
            const vocabList = rawLines.map((i: string) => i.trim()).filter((i: string) => i.length > 0).map(parseVocabularyLine);
            return vocabList.map((item: any, idx: number) => ({
              id: `card_${idx}`,
              setId: setId,
              term: item.word,
              termLanguage: 'en',
              definition: item.translation || '',
              definitionLanguage: 'pl',
              position: idx,
              masteryLevel: 0,
              nextReview: Date.now(),
              imageUrl: null
            } as unknown as Flashcard));
          }
        }
      } catch (error) {
        console.error('Error fetching lesson vocabulary:', error);
      }
      return [];
    }

    try {
      const cardsRef = collection(db, `sets/${setId}/flashcards`);
      const q = query(cardsRef, orderBy('position', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `sets/${setId}/flashcards`);
      return [];
    }
  };

  const saveFlashcards = async (setId: string, cards: Partial<Flashcard>[]) => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      
      // First, get existing cards to delete ones that are removed
      const existingCardsRef = collection(db, `sets/${setId}/flashcards`);
      const existingSnapshot = await getDocs(existingCardsRef);
      const existingIds = existingSnapshot.docs.map(d => d.id);
      
      const newIds = cards.filter(c => c.id).map(c => c.id);
      const idsToDelete = existingIds.filter(id => !newIds.includes(id));
      
      idsToDelete.forEach(id => {
        batch.delete(doc(db, `sets/${setId}/flashcards/${id}`));
      });
      
      cards.forEach((card, index) => {
        const cardId = card.id || `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const cardRef = doc(db, `sets/${setId}/flashcards/${cardId}`);
        
        batch.set(cardRef, {
          ...card,
          id: cardId,
          position: index,
          updatedAt: serverTimestamp(),
          ...(existingIds.includes(cardId) ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });
      });
      
      // Update card count
      const setRef = doc(db, `sets/${setId}`);
      batch.update(setRef, { cardCount: cards.length, updatedAt: serverTimestamp() });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sets/${setId}/flashcards`);
    }
  };

  const saveSession = async (sessionData: Partial<StudySession>, results: Partial<SessionResult>[]) => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sessionRef = doc(db, `sessions/${sessionId}`);
      
      batch.set(sessionRef, {
        ...sessionData,
        userId,
        completedAt: serverTimestamp()
      });
      
      results.forEach(result => {
        const resultId = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const resultRef = doc(db, `sessions/${sessionId}/results/${resultId}`);
        batch.set(resultRef, result);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  const getSessions = async (setId?: string) => {
    if (!userId) return [];
    try {
      const sessionsRef = collection(db, 'sessions');
      let q = query(sessionsRef, where('userId', '==', userId), orderBy('completedAt', 'desc'));
      
      if (setId) {
        q = query(sessionsRef, where('userId', '==', userId), where('setId', '==', setId), orderBy('completedAt', 'desc'));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'sessions');
      return [];
    }
  };

  const getSessionResults = async (sessionId: string) => {
    if (!userId) return [];
    try {
      const resultsRef = collection(db, `sessions/${sessionId}/results`);
      const snapshot = await getDocs(resultsRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionResult));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}/results`);
      return [];
    }
  };

  return (
    <FlashcardContext.Provider value={{
      sets,
      sessions,
      createSet,
      updateSet,
      deleteSet,
      getFlashcards,
      saveFlashcards,
      saveSession,
      getSessions,
      getSessionResults
    }}>
      {children}
    </FlashcardContext.Provider>
  );
};

export const useFlashcards = (): FlashcardContextType => {
  const context = useContext(FlashcardContext);
  if (!context) {
    throw new Error('useFlashcards must be used within a FlashcardProvider');
  }
  return context;
};

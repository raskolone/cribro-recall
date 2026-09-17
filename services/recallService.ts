import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { RecallCard, RecallRating } from '../types/recall';

const LOCAL_RECALL_KEY = 'cribro_recall_cards_v1';

/**
 * Zwraca dzisiejszą datę w formacie YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Dodaje liczbę dni do podanej daty i zwraca YYYY-MM-DD
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Poziomy interwałów (w dniach) na podstawie intervalLevel (0 do 5)
 * 0: nowy (0 dni / natychmiast)
 * 1: 1 dzień
 * 2: 3 dni
 * 3: 7 dni
 * 4: 14 dni
 * 5: 30 dni (opanowany)
 */
export const INTERVAL_DAYS_MAP: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

/**
 * Oblicza nowy poziom interwału i datę następnej powtórki
 */
export function calculateNextInterval(
  currentLevel: number,
  rating: RecallRating,
  baseDate: string = getTodayDateString()
): { nextLevel: number; nextReviewDate: string } {
  let nextLevel = currentLevel;

  switch (rating) {
    case 'hard':
      // Reset lub spadek do poziomu 1 (powtórka jutro)
      nextLevel = 1;
      break;
    case 'good':
      // Stopniowy wzrost o 1 poziom (maks. 5)
      nextLevel = Math.min(5, Math.max(1, currentLevel + 1));
      break;
    case 'easy':
      // Szybki skok o 2 poziomy (lub od razu wysoki)
      nextLevel = Math.min(5, Math.max(2, currentLevel + 2));
      break;
  }

  const daysToAdd = INTERVAL_DAYS_MAP[nextLevel] ?? 1;
  const nextReviewDate = addDaysToDate(baseDate, daysToAdd);

  return { nextLevel, nextReviewDate };
}

// ==========================================
// PAMIĘĆ LOKALNA (Offline Fallback & Cache)
// ==========================================

function getLocalCards(studentId: string): RecallCard[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_RECALL_KEY}_${studentId}`);
    return raw ? (JSON.parse(raw) as RecallCard[]) : [];
  } catch (err) {
    console.warn('[RecallService] Error reading local cards:', err);
    return [];
  }
}

function saveLocalCards(studentId: string, cards: RecallCard[]): void {
  try {
    localStorage.setItem(`${LOCAL_RECALL_KEY}_${studentId}`, JSON.stringify(cards));
  } catch (err) {
    console.warn('[RecallService] Error saving local cards:', err);
  }
}

function upsertLocalCard(studentId: string, updatedCard: RecallCard): void {
  const cards = getLocalCards(studentId);
  const idx = cards.findIndex((c) => c.id === updatedCard.id);
  if (idx >= 0) {
    cards[idx] = updatedCard;
  } else {
    cards.push(updatedCard);
  }
  saveLocalCards(studentId, cards);
}

// ==========================================
// OPERACJE FIRESTORE
// ==========================================

/**
 * Pobiera karty dla kursanta, których nextReviewDate <= dzisiejsza data.
 */
export async function getDueCardsForStudent(studentId: string): Promise<RecallCard[]> {
  if (!studentId) return [];
  const today = getTodayDateString();

  try {
    const recallRef = collection(db, 'students', studentId, 'recall_cards');
    const q = query(recallRef, where('nextReviewDate', '<=', today));
    const snapshot = await getDocs(q);

    const cards: RecallCard[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        studentId: data.studentId || studentId,
        sourceLessonId: data.sourceLessonId,
        term: data.term || '',
        translation: data.translation || '',
        contextSentence: data.contextSentence,
        phonetic: data.phonetic,
        intervalLevel: typeof data.intervalLevel === 'number' ? data.intervalLevel : 0,
        nextReviewDate: data.nextReviewDate || today,
        reviewHistory: Array.isArray(data.reviewHistory) ? data.reviewHistory : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    // Zaktualizuj cache
    const cached = getLocalCards(studentId);
    const merged = [...cached];
    for (const card of cards) {
      const idx = merged.findIndex((c) => c.id === card.id);
      if (idx >= 0) merged[idx] = card;
      else merged.push(card);
    }
    saveLocalCards(studentId, merged);

    return cards;
  } catch (err) {
    console.warn('[RecallService] Firestore fetch error, fallback to local storage:', err);
    // Fallback do localStorage
    const local = getLocalCards(studentId);
    return local.filter((c) => (c.nextReviewDate || '') <= today);
  }
}

/**
 * Pobiera wszystkie karty kursanta (np. do widoku podsumowania/statystyk)
 */
export async function getAllCardsForStudent(studentId: string): Promise<RecallCard[]> {
  if (!studentId) return [];

  try {
    const recallRef = collection(db, 'students', studentId, 'recall_cards');
    const snapshot = await getDocs(recallRef);

    const cards: RecallCard[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        studentId: data.studentId || studentId,
        sourceLessonId: data.sourceLessonId,
        term: data.term || '',
        translation: data.translation || '',
        contextSentence: data.contextSentence,
        phonetic: data.phonetic,
        intervalLevel: typeof data.intervalLevel === 'number' ? data.intervalLevel : 0,
        nextReviewDate: data.nextReviewDate || getTodayDateString(),
        reviewHistory: Array.isArray(data.reviewHistory) ? data.reviewHistory : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    saveLocalCards(studentId, cards);
    return cards;
  } catch (err) {
    console.warn('[RecallService] Firestore getAllCards error, fallback to local:', err);
    return getLocalCards(studentId);
  }
}

/**
 * Przelicza następny interwał i aktualizuje rekord w kolekcji students/{studentId}/recall_cards
 */
export async function processCardReview(
  studentId: string,
  cardId: string,
  rating: RecallRating
): Promise<RecallCard> {
  const today = getTodayDateString();

  // 1. Sprawdź obecną kartę z pamięci podręcznej lub bazy
  let existingCard: RecallCard | null = null;
  const localList = getLocalCards(studentId);
  const foundLocal = localList.find((c) => c.id === cardId);

  if (foundLocal) {
    existingCard = foundLocal;
  } else {
    try {
      const cardRef = doc(db, 'students', studentId, 'recall_cards', cardId);
      const snap = await getDoc(cardRef);
      if (snap.exists()) {
        existingCard = { id: snap.id, ...(snap.data() as Omit<RecallCard, 'id'>) };
      }
    } catch (e) {
      console.warn('[RecallService] Error fetching single card:', e);
    }
  }

  const currentLevel = existingCard?.intervalLevel ?? 0;
  const { nextLevel, nextReviewDate } = calculateNextInterval(currentLevel, rating, today);

  const newHistoryEntry = {
    date: today,
    grade: rating,
  };

  const updatedHistory = existingCard?.reviewHistory
    ? [...existingCard.reviewHistory, newHistoryEntry]
    : [newHistoryEntry];

  const updatedCard: RecallCard = {
    id: cardId,
    studentId,
    sourceLessonId: existingCard?.sourceLessonId,
    term: existingCard?.term || '',
    translation: existingCard?.translation || '',
    contextSentence: existingCard?.contextSentence,
    phonetic: existingCard?.phonetic,
    intervalLevel: nextLevel,
    nextReviewDate,
    reviewHistory: updatedHistory,
    createdAt: existingCard?.createdAt || today,
    updatedAt: new Date().toISOString(),
  };

  // 2. Zapisz w lokalnym cache
  upsertLocalCard(studentId, updatedCard);

  // 3. Zapisz w Firestore
  try {
    const cardRef = doc(db, 'students', studentId, 'recall_cards', cardId);
    await updateDoc(cardRef, {
      intervalLevel: nextLevel,
      nextReviewDate,
      reviewHistory: updatedHistory,
      updatedAt: updatedCard.updatedAt,
    });
  } catch (err) {
    console.warn('[RecallService] Firestore updateDoc failed, trying setDoc fallback:', err);
    try {
      const cardRef = doc(db, 'students', studentId, 'recall_cards', cardId);
      await setDoc(cardRef, updatedCard, { merge: true });
    } catch (innerErr) {
      console.error('[RecallService] Failed to persist review to Firestore:', innerErr);
    }
  }

  return updatedCard;
}

/**
 * Szybki import zwrotów z notatnika lekcji do kolekcji powtórek kursanta
 */
export async function batchAddCardsFromLesson(
  studentId: string,
  lessonId: string,
  items: Array<{ term: string; translation: string; context?: string; phonetic?: string }>
): Promise<number> {
  if (!studentId || items.length === 0) return 0;

  const today = getTodayDateString();
  const createdCards: RecallCard[] = [];

  try {
    const batch = writeBatch(db);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.term || !item.term.trim()) continue;

      const cardId = `rc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      const cardRef = doc(db, 'students', studentId, 'recall_cards', cardId);

      const newCard: RecallCard = {
        id: cardId,
        studentId,
        sourceLessonId: lessonId,
        term: item.term.trim(),
        translation: (item.translation || '').trim(),
        contextSentence: item.context?.trim() || undefined,
        phonetic: item.phonetic?.trim() || undefined,
        intervalLevel: 0, // nowy
        nextReviewDate: today, // do powtórzenia od razu / dziś
        reviewHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      batch.set(cardRef, newCard);
      createdCards.push(newCard);
    }

    if (createdCards.length > 0) {
      await batch.commit();

      // Zaktualizuj localStorage
      const cached = getLocalCards(studentId);
      saveLocalCards(studentId, [...cached, ...createdCards]);
    }

    return createdCards.length;
  } catch (err) {
    console.error('[RecallService] batchAddCardsFromLesson failed:', err);
    // Fallback zapis w pamięci lokalnej
    if (createdCards.length > 0) {
      const cached = getLocalCards(studentId);
      saveLocalCards(studentId, [...cached, ...createdCards]);
      return createdCards.length;
    }
    return 0;
  }
}

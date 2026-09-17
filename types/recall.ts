export type RecallRating = 'hard' | 'good' | 'easy';

export interface RecallHistoryEntry {
  date: string;
  grade: RecallRating;
}

export interface RecallCard {
  id: string;
  studentId: string;
  sourceLessonId?: string;
  term: string; // zwrot / idiom / kolokacja
  translation: string;
  contextSentence?: string; // zdanie w kontekście z lekcji
  phonetic?: string;
  intervalLevel: number; // 0: nowy, 1: 1 dzień, 2: 3 dni, 3: 7 dni, 4: 14 dni, 5: opanowany
  nextReviewDate: string; // YYYY-MM-DD
  reviewHistory: RecallHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyReviewSession {
  dueCards: RecallCard[];
  totalDueCount: number;
}

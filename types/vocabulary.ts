export interface VocabularyItem {
  id: string;
  studentId: string;
  lessonNumber: number;
  english: string;
  polish: string;
  example?: string;
  difficulty?: 'A2' | 'B1' | 'B2' | 'C1';
  status: 'new' | 'learning' | 'review' | 'mastered';
  mistakeCount: number;
  lastReviewedAt?: string;
}

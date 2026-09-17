export type BlockType = 
  | 'warmup' 
  | 'recall' 
  | 'input' 
  | 'practice' 
  | 'speaking' 
  | 'feedback' 
  | 'homework';

export interface LessonBlock {
  id: string;
  type: BlockType;
  title: string;
  durationMinutes: number;
  content: string; // opis ćwiczenia / notatki
  linkedPresentationId?: string; // opcjonalne powiązanie ze slajdem/prezentacją
}

export interface LessonScenario {
  id?: string;
  teacherId: string;
  studentId: string;
  date: string;
  topic: string;
  mainGoal: string;
  blocks: LessonBlock[];
  totalDurationMinutes: number;
  status: 'draft' | 'planned' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

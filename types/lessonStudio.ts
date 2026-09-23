export type LessonBlockInteractionMode = 'view' | 'collaborate' | 'student_response';

export type LessonInstanceStatus = 'draft' | 'approved' | 'published';

export interface PersonalizableSlot {
  slotId: string;
  name: string;
  type: 'text' | 'choice' | 'scenario' | 'vocab_list';
  defaultValue: any;
  customValue?: any;
  description?: string;
}

export interface LessonBlock {
  id: string;
  type: 'check_in' | 'mission_briefing' | 'input' | 'guided_practice' | 'production' | 'final_mission' | 'debrief' | 'custom';
  title: string;
  audience: 'teacher_only' | 'student_only' | 'both';
  interactionMode: LessonBlockInteractionMode;
  locked: boolean;
  baseContent: {
    description?: string;
    instructions?: string;
    targetVocab?: string[];
    grammarFocus?: string;
    prompts?: string[];
    materialsUrl?: string;
    [key: string]: any;
  };
  personalizableSlots: PersonalizableSlot[];
}

export interface LevelVariant {
  level: string; // e.g. 'A1', 'A2', 'B1', 'B2', 'C1'
  goals: string[];
  recommendedDurationMinutes?: number;
  complexityModifier?: string;
}

export interface MissionPack {
  id: string;
  title: string;
  communicativeGoal: string;
  levelVariants: LevelVariant[];
  lessonBlueprintIds: string[];
  status: 'draft' | 'ready' | 'archived';
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LessonBlueprint {
  id: string;
  missionPackId: string;
  blocks: LessonBlock[];
  version: number;
  title?: string;
  targetLevel?: string;
  estimatedMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonalizationSettings {
  contextMode: 'auto' | 'work' | 'life' | 'custom';
  focusArea: 'speaking' | 'grammar' | 'vocabulary' | 'fluency' | 'accuracy' | 'pronunciation';
  depthLevel: 'fast' | 'standard' | 'deep_dive';
  studentNotes?: string;
  customContextPrompt?: string;
  selectedSlots?: Record<string, any>;
}

export interface LessonInstance {
  id: string;
  blueprintId: string;
  studentId: string;
  lessonDate: string;
  personalizationSettings: PersonalizationSettings;
  status: LessonInstanceStatus;
  customBlocks?: LessonBlock[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LessonRun {
  id: string;
  lessonInstanceId: string;
  activeBlockId: string;
  completedBlockIds: string[];
  runtimeOverrides: Record<string, any>;
  startedAt?: string;
  endedAt?: string;
  liveNotes?: string;
}

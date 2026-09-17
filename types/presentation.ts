export type SlideElementType = 'text' | 'image' | 'vocabulary' | 'exercise';

export interface SlideElementStyle {
  fontSize?: number; // px lub rem względny
  fontWeight?: 'normal' | 'bold' | 'black';
  color?: string; // hex / Tailwind class
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right';
  border?: string;
  width?: number; // w procentach canvasu (0-100) lub px
  height?: number;
  opacity?: number;
  shadow?: boolean;
}

export interface VocabularyItemPayload {
  term: string;
  translation: string;
  example?: string;
  ipa?: string;
}

export interface ExerciseItemPayload {
  instruction: string;
  prompt: string;
  answer?: string;
  options?: string[];
  revealed?: boolean;
}

export interface SlideElement {
  id: string;
  type: SlideElementType;
  content: string; // Tekst, markdown, lub Base64 / Storage URL dla obrazka
  position: {
    x: number; // procent płótna (0 - 100)
    y: number; // procent płótna (0 - 100)
  };
  style?: SlideElementStyle;
  // Opcjonalne dane strukturalne dla 'vocabulary' lub 'exercise'
  vocabularyData?: VocabularyItemPayload[];
  exerciseData?: ExerciseItemPayload;
}

export interface Slide {
  id: string;
  title: string;
  notes: string;
  elements: SlideElement[];
  layoutTemplate?: 'title_points' | 'dialogue' | 'vocabulary' | 'image_exercise' | 'blank';
  backgroundColor?: string;
}

export interface Presentation {
  id: string;
  teacherId: string;
  assignedStudentIds: string[];
  title: string;
  topic: string;
  slides: Slide[];
  isTemplate: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SlideLayoutTemplateId = 'title_points' | 'dialogue' | 'vocabulary' | 'image_exercise';

const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');
code = code.replace(
  "export interface PracticeLog {\n  id: string;\n  exerciseType: ExerciseType;\n  date: string;\n  isRevisionMode?: boolean;\n  score?: number;\n  totalWords?: number;\n  testName?: string;\n  exercisesData?: TranslationEvaluationResult[] | string | any;\n  detailedFeedback?: TranslationEvaluationResult[] | any[];\n}",
  "export interface PracticeLog {\n  id: string;\n  exerciseType: ExerciseType;\n  date: string;\n  isRevisionMode?: boolean;\n  score?: number;\n  totalWords?: number;\n  testName?: string;\n  exercisesData?: TranslationEvaluationResult[] | string | any;\n  detailedFeedback?: TranslationEvaluationResult[] | any[];\n  exerciseFormat?: string;\n  practiceMode?: string;\n  selectedSetId?: string;\n  setDisplayName?: string;\n}"
);
fs.writeFileSync('types.ts', code);

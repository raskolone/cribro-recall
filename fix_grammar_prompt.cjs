const fs = require('fs');
let file = fs.readFileSync('services/geminiService.ts', 'utf8');

file = file.replace(
  `export const generateTranslationExercises = async (
  level: string,
  words: string[],
  customPrompt?: string,
  lessonContext?: string,
  studentProfileContext?: string,
  numSentences: number = 5,
  pastExercisesContext?: string
): Promise<TranslationExercise[]> => {`,
  `export const generateTranslationExercises = async (
  level: string,
  words: string[],
  customPrompt?: string,
  lessonContext?: string,
  studentProfileContext?: string,
  numSentences: number = 5,
  pastExercisesContext?: string,
  isGrammar?: boolean
): Promise<TranslationExercise[]> => {`
);

file = file.replace(
  `Target CEFR Level: \${level || 'B2'}`,
  `Target CEFR Level: \${isGrammar ? 'ZIGNORUJ poziom kursanta (bypassed). Poziom trudności musi być dokładnie dopasowany do dostarczonych przykładów z bazy.' : (level || 'B2')}`
);

fs.writeFileSync('services/geminiService.ts', file);

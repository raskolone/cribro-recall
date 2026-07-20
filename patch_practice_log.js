import fs from 'fs';

// Patch firestore.rules
let rules = fs.readFileSync('firestore.rules', 'utf-8');
rules = rules.replace(
  "hasOnlyAllowedFields(['exerciseType', 'date', 'isRevisionMode', 'score', 'totalWords', 'exercisesData'])",
  "hasOnlyAllowedFields(['exerciseType', 'date', 'isRevisionMode', 'score', 'totalWords', 'exercisesData', 'testName'])"
);
rules = rules.replace(
  "(!( 'exercisesData' in data ) || data.exercisesData is string);",
  "(!( 'exercisesData' in data ) || data.exercisesData is string) && (!( 'testName' in data ) || data.testName is string);"
);
fs.writeFileSync('firestore.rules', rules);

// Patch AIExerciseGeneratorScreen.tsx
let aiContent = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');
aiContent = aiContent.replace(
  `      const logData = {
        exerciseType: 'ai_translation',
        testName: testName || undefined,
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails
      };`,
  `      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails
      };
      if (testName) logData.testName = testName;`
);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', aiContent);
console.log("Patched practice log");

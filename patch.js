const fs = require('fs');
let file = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');
file = file.replace(
  `      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails
      };`,
  `      const detailedFeedback = results.map((r) => ({
        polishSentence: r?.polishSentence || '',
        studentAnswer: r?.studentAnswer || '',
        correctTranslation: r?.correctTranslation || '',
        isCorrect: r?.isCorrect || false,
        score: r?.score || 0,
        explanation: r?.explanation || '',
        feedbackSyntax: r?.feedbackSyntax || '',
        feedbackVocab: r?.feedbackVocab || '',
        feedbackRule: r?.feedbackRule || ''
      }));

      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails,
        detailedFeedback: detailedFeedback
      };`
);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', file);

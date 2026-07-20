import fs from 'fs';

let content = fs.readFileSync('context/FlashcardContext.tsx', 'utf-8');

content = content.replace(
  `      results.forEach(result => {
        const resultId = \`result-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
        const resultRef = doc(db, \`sessions/\${sessionId}/results/\${resultId}\`);
        batch.set(resultRef, result);
      });
      
      await batch.commit();`,
  `      results.forEach(result => {
        const resultId = \`result-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
        const resultRef = doc(db, \`sessions/\${sessionId}/results/\${resultId}\`);
        batch.set(resultRef, result);
      });
      
      // Also add to practiceLogs so it appears in LessonHistoryScreen
      const logId = \`log-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const logRef = doc(db, \`users/\${userId}/practiceLogs/\${logId}\`);
      
      // Determine exercise type
      let exType = sessionData.mode || 'flashcards';
      
      batch.set(logRef, {
        exerciseType: exType,
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: sessionData.scorePercent || 0,
        totalWords: sessionData.totalCards || 0,
        testName: sessionData.setId || 'Flashcard Set'
      });
      
      await batch.commit();`
);

fs.writeFileSync('context/FlashcardContext.tsx', content);
console.log("Patched FlashcardContext");

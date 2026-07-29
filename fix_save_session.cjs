const fs = require('fs');
let file = fs.readFileSync('context/FlashcardContext.tsx', 'utf8');

const targetStr = `      // Determine exercise type
      let exType = sessionData.mode || 'flashcards';

      batch.set(logRef, {`;

const replacementStr = `      // Determine exercise type
      let exType = sessionData.mode || 'flashcards';

      batch.set(logRef, {`;

// Let's rewrite the whole saveSession to fetch progress first and then batch.
const fullTarget = `  const saveSession = async (sessionData: Partial<StudySession>, results: Partial<SessionResult>[]) => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      const sessionId = \`session-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const sessionRef = doc(db, \`sessions/\${sessionId}\`);
      
      batch.set(sessionRef, {
        ...sessionData,
        userId,
        completedAt: serverTimestamp()
      });
      
      results.forEach(result => {
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
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };`;

const fullReplacement = `  const saveSession = async (sessionData: Partial<StudySession>, results: Partial<SessionResult>[]) => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      const sessionId = \`session-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const sessionRef = doc(db, \`sessions/\${sessionId}\`);
      
      batch.set(sessionRef, {
        ...sessionData,
        userId,
        completedAt: serverTimestamp()
      });
      
      results.forEach(result => {
        const resultId = \`result-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
        const resultRef = doc(db, \`sessions/\${sessionId}/results/\${resultId}\`);
        batch.set(resultRef, result);
      });
      
      // SM-2 Spaced Repetition Logic
      if (sessionData.setId) {
        // Fetch existing progress for this set
        const progressRef = collection(db, \`users/\${userId}/flashcardProgress\`);
        const q = query(progressRef, where('setId', '==', sessionData.setId));
        const progressSnapshot = await getDocs(q);
        const existingProgress: Record<string, any> = {};
        progressSnapshot.forEach(doc => {
          existingProgress[doc.data().flashcardId] = { id: doc.id, ...doc.data() };
        });

        const now = new Date();
        results.forEach(result => {
          if (!result.flashcardId) return;
          const isCorrect = result.isCorrect;
          const quality = isCorrect ? 4 : 1;
          const prog = existingProgress[result.flashcardId] || {
            repetitions: 0, interval: 0, easeFactor: 2.5
          };
          
          let { repetitions, interval, easeFactor } = prog;
          
          if (quality >= 3) {
            if (repetitions === 0) {
              interval = 1;
            } else if (repetitions === 1) {
              interval = 6;
            } else {
              interval = Math.round(interval * easeFactor);
            }
            repetitions += 1;
          } else {
            repetitions = 0;
            interval = 1;
          }
          
          easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
          if (easeFactor < 1.3) easeFactor = 1.3;
          
          const nextReviewDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
          
          const progDocId = prog.id || \`prog-\${result.flashcardId}\`;
          const progDocRef = doc(db, \`users/\${userId}/flashcardProgress/\${progDocId}\`);
          
          batch.set(progDocRef, {
            flashcardId: result.flashcardId,
            setId: sessionData.setId,
            userId,
            repetitions,
            interval,
            easeFactor,
            nextReviewDate,
            lastReviewedAt: now.toISOString()
          }, { merge: true });
        });
      }

      // Also add to practiceLogs so it appears in LessonHistoryScreen
      const logId = \`log-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const logRef = doc(db, \`users/\${userId}/practiceLogs/\${logId}\`);
      
      let exType = sessionData.mode || 'flashcards';

      batch.set(logRef, {
        exerciseType: exType,
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: sessionData.scorePercent || 0,
        totalWords: sessionData.totalCards || 0,
        testName: sessionData.setId || 'Flashcard Set'
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };`;

file = file.replace(fullTarget, fullReplacement);
fs.writeFileSync('context/FlashcardContext.tsx', file);

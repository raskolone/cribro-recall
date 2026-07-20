import fs from 'fs';

let content = fs.readFileSync('context/VocabularyContext.tsx', 'utf-8');

content = content.replace(
  `      // Update settings
      const settingsRef = doc(db, \`users/\${userId}/settings/practice\`);
      const updateData: any = {
        lastExerciseType: exerciseType,
        lastPracticeDate: now,
      };
      if (isRevisionMode) {
        updateData.lastRevisionDate = now;
      }
      await setDoc(settingsRef, updateData, { merge: true });

      // Add to practiceLogs
      const logId = \`log-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const logRef = doc(db, \`users/\${userId}/practiceLogs/\${logId}\`);
      await setDoc(logRef, {
        exerciseType,
        date: now,
        isRevisionMode
      });`,
  `      // Add to practiceLogs FIRST
      const logId = \`log-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const logRef = doc(db, \`users/\${userId}/practiceLogs/\${logId}\`);
      await setDoc(logRef, {
        exerciseType,
        date: now,
        isRevisionMode
      });
      
      // Update settings SECOND (if it fails, at least log is saved)
      try {
        const settingsRef = doc(db, \`users/\${userId}/settings/practice\`);
        const updateData: any = {
          lastExerciseType: exerciseType,
          lastPracticeDate: now,
        };
        if (isRevisionMode) {
          updateData.lastRevisionDate = now;
        }
        await setDoc(settingsRef, updateData, { merge: true });
      } catch (e) {
        console.warn("Failed to update practice settings:", e);
      }`
);

fs.writeFileSync('context/VocabularyContext.tsx', content);
console.log("Patched Vocab Context");

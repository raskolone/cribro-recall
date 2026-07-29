const fs = require('fs');
let file = fs.readFileSync('context/FlashcardContext.tsx', 'utf8');

if (!file.includes('const getProgress = async')) {
  const target = `const getSessions = async (setId?: string) => {`;
  const replacement = `const getProgress = async (setId?: string) => {
    if (!userId) return [];
    try {
      const progressRef = collection(db, \`users/\${userId}/flashcardProgress\`);
      let q = query(progressRef);
      if (setId) {
        q = query(progressRef, where('setId', '==', setId));
      }
      const snapshot = await getDocs(q);
      const progress: any[] = [];
      snapshot.forEach(doc => {
        progress.push({ id: doc.id, ...doc.data() });
      });
      return progress;
    } catch (error) {
      console.error('Error fetching progress:', error);
      return [];
    }
  };

  const getSessions = async (setId?: string) => {`;
  file = file.replace(target, replacement);
  
  const ctxTarget = `saveSession: (sessionData: Partial<StudySession>, results: Partial<SessionResult>[]) => Promise<void>;`;
  const ctxReplacement = `saveSession: (sessionData: Partial<StudySession>, results: Partial<SessionResult>[]) => Promise<void>;
  getProgress: (setId?: string) => Promise<any[]>;`;
  file = file.replace(ctxTarget, ctxReplacement);
  
  const valTarget = `getFlashcards,
    createFlashcard,`;
  const valReplacement = `getFlashcards,
    createFlashcard,
    getProgress,`;
  file = file.replace(valTarget, valReplacement);
  
  fs.writeFileSync('context/FlashcardContext.tsx', file);
}

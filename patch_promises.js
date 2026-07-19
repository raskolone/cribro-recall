import fs from 'fs';
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const targetStr = content.substring(content.indexOf('// Fetch user\'s recent lesson records'), content.indexOf('let finalGenPrompt = customGenPrompt;'));

if (targetStr.length > 100) {
const replacement = `
      // Parallelize Firebase fetches to significantly speed up generation
      let wordsToUse: string[] = [];
      let lessonContextString = '';
      let pastExercisesContext = "";
      let weaknessesListStr = "Brak zidentyfikowanych błędów";
      
      const fetchPromises: Promise<void>[] = [];

      // Fetch user's recent lesson records for context
      if (user) {
        fetchPromises.push((async () => {
          try {
            const lessonRecordsRef = collection(db, \`users/\${user.id}/lessonRecords\`);
            const qLR = query(lessonRecordsRef, orderBy('date', 'desc'), limit(3));
            const lrSnapshot = await getDocs(qLR);
            const lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
            
            if (lrList.length > 0) {
              lessonContextString = lrList.map((lr, idx) => {
                let ctx = \`Lesson \${idx + 1} (\${lr.date}): Topic: \${lr.topic}. \`;
                if (lr.lessonSummary) ctx += \`Revision Notes: \${lr.lessonSummary}. \`;
                if (lr.studentSpeaking) ctx += \`Kursant o czym mówił: \${lr.studentSpeaking}. \`;
                if (lr.thingsToImprove) ctx += \`Things to Improve: \${lr.thingsToImprove}. \`;
                if (lr.suggestedFollowUp) ctx += \`Suggested follow-up: \${lr.suggestedFollowUp}. \`;
                if (lr.vocabularyText) ctx += \`Vocabulary & Pronunciation: \${lr.vocabularyText}.\`;
                return ctx;
              }).join('\\n\\n');
            }
          } catch (lrErr) {
            console.warn('Could not fetch lesson records:', lrErr);
          }
        })());

        // Fetch practice logs
        fetchPromises.push((async () => {
          try {
            const practiceLogsRef = collection(db, \`users/\${user.id}/practiceLogs\`);
            const qPL = query(practiceLogsRef, orderBy('date', 'desc'), limit(3));
            const plSnapshot = await getDocs(qPL);
            const plList = plSnapshot.docs.map(doc => doc.data() as PracticeLog);
            
            const pastExercises = plList.map((pl, index) => {
              if (pl.exercisesData) {
                return \`Session \${index + 1} (\${new Date(pl.date).toLocaleDateString()}): \${pl.exercisesData}\`;
              }
              return null;
            }).filter(Boolean);
            
            if (pastExercises.length > 0) {
              pastExercisesContext = pastExercises.join('\\n');
            }
          } catch (e) {
            console.warn("Could not fetch recent practice logs", e);
          }
        })());
        
        // Fetch weaknesses
        fetchPromises.push((async () => {
          try {
            weaknessesListStr = await getUserWeaknesses(user.id);
          } catch (e) {
            console.warn("Could not fetch user weaknesses", e);
          }
        })());
      }

      // Extract words from chosen set if applicable
      if (selectedSetId !== 'general') {
        fetchPromises.push((async () => {
          try {
            if (selectedSetId === 'lessons' || selectedLessonIds.length > 0) {
              const selectedSets = vocabularySets.filter(s => selectedLessonIds.includes(s.id));
              const allWords: string[] = [];
              selectedSets.forEach(set => {
                if (set.vocabularyText) {
                  const items = set.vocabularyText.split(/[\\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
                  allWords.push(...items);
                }
              });
              wordsToUse = Array.from(new Set(allWords)).slice(0, 15);
            } else if (selectedSetId.startsWith('vocab-')) {
              const matchedVocab = vocabularySets.find(s => \`vocab-\${s.id}\` === selectedSetId);
              if (matchedVocab && matchedVocab.vocabularyText) {
                 const items = matchedVocab.vocabularyText.split(/[\\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
                 wordsToUse = Array.from(new Set(items)); // AI analyzes all vocabulary from lesson
              }
            } else {
              let setsToProcess: FlashcardSet[] = [];
              if (selectedSetId === 'all') {
                setsToProcess = availableSets;
              } else {
                const matchedSet = availableSets.find(s => s.id === selectedSetId);
                if (matchedSet) setsToProcess = [matchedSet];
              }
              // Fetch cards for each chosen set
              const allCardsPromises = setsToProcess.map(s => getFlashcards(s.id));
              const allCardsLists = await Promise.all(allCardsPromises);
              const allCards = allCardsLists.flat();
              
              // Pick unique words/terms
              wordsToUse = Array.from(new Set(allCards.map(c => c.term))).slice(0, 15);
            }
          } catch (e) {
            console.warn("Could not fetch flashcards for wordsToUse", e);
          }
        })());
      }

      await Promise.all(fetchPromises);

      // Call Gemini API service function
      const studentProfileContext = \`Kluczowy profil kursanta: \${user?.firstName ? \`Imię kursanta: \${user.firstName}. \` : ''}\${user?.description ? \`Cały wpis z profilu kursanta (zainteresowania, cele, przykładowe zdania): \${user.description}\` : 'Brak dodatkowych danych profilu.'}\${user?.aiPrompt ? \`\\nSpersonalizowany Prompt (ŻELAZNA ZASADA DLA AI - uczeń musi widzieć przykłady w tym stylu): \${user.aiPrompt}\` : ''}\`;
      
      let userProfileStr = user?.description || "Brak danych";
      
`;
  content = content.replace(targetStr, replacement);
  fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
  console.log("Patched correctly");
}

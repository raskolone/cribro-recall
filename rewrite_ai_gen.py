import re

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add selectedLessonIds to state
state_search = "const [selectedSetId, setSelectedSetId] = useState<string>('all');"
state_replace = "const [selectedSetId, setSelectedSetId] = useState<string>('all');\n  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);"
code = code.replace(state_search, state_replace)

# Modify the generate logic
# Let's find "if (selectedSetId !== 'general') {" inside handleGenerate
handle_gen_search = """      // Extract words from chosen set if applicable
      if (selectedSetId !== 'general') {
        if (selectedSetId.startsWith('vocab-')) {
          const matchedVocab = vocabularySets.find(s => `vocab-${s.id}` === selectedSetId);
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
      }"""

handle_gen_replace = """      // Extract words from chosen sets
      if (selectedLessonIds.length > 0) {
        const matchedVocabs = vocabularySets.filter(s => selectedLessonIds.includes(s.id));
        const allItems = matchedVocabs.flatMap(v => v.vocabularyText ? v.vocabularyText.split(/[\\n,;]+/).map(i => i.trim()).filter(i => i.length > 0) : []);
        wordsToUse = Array.from(new Set(allItems));
        
        lessonContextString = matchedVocabs.map((lr, idx) => {
          let ctx = `Lesson ${idx + 1} (${lr.date}): Topic: ${lr.topic}. `;
          if (lr.lessonSummary) ctx += `Revision Notes: ${lr.lessonSummary}. `;
          if (lr.studentSpeaking) ctx += `Kursant o czym mówił: ${lr.studentSpeaking}. `;
          return ctx;
        }).join('\\n\\n');
      } else if (selectedSetId !== 'general') {
        if (selectedSetId.startsWith('vocab-')) {
          const matchedVocab = vocabularySets.find(s => `vocab-${s.id}` === selectedSetId);
          if (matchedVocab && matchedVocab.vocabularyText) {
             const items = matchedVocab.vocabularyText.split(/[\\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
             wordsToUse = Array.from(new Set(items));
          }
        } else {
          let setsToProcess: FlashcardSet[] = [];
          if (selectedSetId === 'all') {
            setsToProcess = availableSets;
          } else {
            const matchedSet = availableSets.find(s => s.id === selectedSetId);
            if (matchedSet) setsToProcess = [matchedSet];
          }
          const allCardsPromises = setsToProcess.map(s => getFlashcards(s.id));
          const allCardsLists = await Promise.all(allCardsPromises);
          const allCards = allCardsLists.flat();
          wordsToUse = Array.from(new Set(allCards.map(c => c.term))).slice(0, 15);
        }
      }"""

code = code.replace(handle_gen_search, handle_gen_replace)

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)


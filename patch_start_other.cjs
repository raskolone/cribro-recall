const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target = `    if (user?.id && (selectedSetId === 'lessons' || selectedLessonIds.length > 0)) {
      selectedLessonIds.forEach(id => {
        const set = vocabularySets.find(s => s.id === id);
        if (set && set.used === false) {
          set.used = true;
          markVocabularySetAsUsed(user.id, id).catch(console.error);
        }
      });
    }
    onStartPractice?.(type, mode1, mode2);
  };`;

const replacement = `    if (user?.id && (selectedSetId === 'lessons' || selectedLessonIds.length > 0)) {
      selectedLessonIds.forEach(id => {
        const set = vocabularySets.find(s => s.id === id);
        if (set && set.used === false) {
          set.used = true;
          markVocabularySetAsUsed(user.id, id).catch(console.error);
        }
      });
    }
    
    // Instead of using onStartPractice which does nothing, we switch view to flashcards.
    // If multiple selected, we just pass the first one for now (or a combined set if possible).
    // The Dashboard needs to support initialMode.
    const setIdToUse = selectedSetId === 'lessons' && selectedLessonIds.length > 0 ? selectedLessonIds[0] : (selectedSetId === 'grammar' ? null : selectedSetId);
    if (setIdToUse && onChangeView) {
      onChangeView('flashcard-study', { setId: setIdToUse, initialMode: type });
    } else {
      onStartPractice?.(type, mode1, mode2);
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

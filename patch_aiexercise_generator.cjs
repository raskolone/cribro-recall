const fs = require('fs');

let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target = `    if (setIdToUse && onChangeView) {
      onChangeView('flashcard-study', { setId: setIdToUse, initialMode: type });
    } else {
      onStartPractice?.(type, mode1, mode2);
    }`;
const newCode = `    if (onChangeView) {
      onChangeView('flashcard-study', { setId: setIdToUse || '', initialMode: type });
    } else {
      onStartPractice?.(type, mode1, mode2);
    }`;

code = code.replace(target, newCode);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

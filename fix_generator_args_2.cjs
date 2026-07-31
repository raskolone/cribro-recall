const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(
  "        pastExercisesContext, \\n        weaknessesList,\\n        selectedSetId === 'grammar',",
  "        pastExercisesContext, \\n        weaknessesListStr,\\n        selectedSetId === 'grammar',"
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(
  "selectedSetId: selectedSetId,\n        setDisplayName: setDisplayName",
  "selectedSetId: selectedSetId,\n        setDisplayName: setDisplayName,\n        wordsUsed: lastUsedWords"
);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(
  /sentence=\{exercises\[activeSentenceIndex\].englishTranslation\}\n                    level=\{level\}/,
  `sentence={exercises[activeSentenceIndex].englishTranslation}\n                    puzzleChunks={exercises[activeSentenceIndex].puzzleChunks}\n                    level={level}`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log("Patched usage");

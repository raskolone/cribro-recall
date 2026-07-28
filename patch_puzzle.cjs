const fs = require('fs');
let code = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

code = code.replace(
  /sentence: string;\n  level: string;/,
  `sentence: string;\n  puzzleChunks?: string[];\n  level: string;`
);

// update component signature
code = code.replace(
  /export const PuzzleExercise: React.FC<PuzzleExerciseProps> = \(\{ sentence, level, currentAnswer, onAnswerChange \}\) => \{/,
  `export const PuzzleExercise: React.FC<PuzzleExerciseProps> = ({ sentence, puzzleChunks, level, currentAnswer, onAnswerChange }) => {`
);

// update logic inside useEffect where it splits chunks
code = code.replace(
  /const chunks = semanticChunking\(sentence\);/,
  `const chunks = puzzleChunks && puzzleChunks.length > 0 ? puzzleChunks : semanticChunking(sentence);`
);

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', code);
console.log("Patched puzzle");

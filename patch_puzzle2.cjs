const fs = require('fs');
let code = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

code = code.replace(
  /const PuzzleExercise: React.FC<PuzzleExerciseProps> = \(\{ sentence, level, currentAnswer, onAnswerChange \}\) => \{/,
  `const PuzzleExercise: React.FC<PuzzleExerciseProps> = ({ sentence, puzzleChunks, level, currentAnswer, onAnswerChange }) => {`
);

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', code);
console.log("Patched puzzle 2");

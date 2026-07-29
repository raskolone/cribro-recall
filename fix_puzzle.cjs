const fs = require('fs');
let code = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

code = code.replace(/<>\s*\{selectedTiles\.length > 0 && !isCompleted && \(/, '{selectedTiles.length > 0 && !isCompleted && (');

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', code);

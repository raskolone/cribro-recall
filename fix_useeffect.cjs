const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

content = content.replace(
  /handleGenerateExercises\(\);/g,
  `handleGenerate();`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);

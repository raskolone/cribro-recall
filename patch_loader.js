const fs = require('fs');
const file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const loaderRegex = /const AIGenerationLoader: React\.FC<\{.*?\}> = \(\{ language, level, currentModel \}\) => \{[\s\S]*?\n\};\n\nconst AILoadingButton/m;

if (loaderRegex.test(content)) {
  console.log("Matched AIGenerationLoader");
} else {
  console.log("Not matched");
}

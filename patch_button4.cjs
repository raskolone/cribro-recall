const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const oldText = `loadingText={language === 'pl' ? 'Generowanie...' : 'Generating...'}`;
const newText = `loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}`;

code = code.split(oldText).join(newText);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

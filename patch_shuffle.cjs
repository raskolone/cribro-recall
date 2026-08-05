const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target1 = `wordsToUse = Array.from(new Set(allWords)).slice(0, 15);`;
const replacement1 = `wordsToUse = Array.from(new Set(allWords)).sort(() => 0.5 - Math.random()).slice(0, 20);`;
code = code.replace(target1, replacement1);

const target2 = `wordsToUse = Array.from(new Set(allCards.map(c => c.term))).slice(0, 15);`;
const replacement2 = `wordsToUse = Array.from(new Set(allCards.map(c => c.term))).sort(() => 0.5 - Math.random()).slice(0, 20);`;
code = code.replace(target2, replacement2);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

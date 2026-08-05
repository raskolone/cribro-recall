const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// We can just add a global shuffle function or use a simple sort.
// Since it's inside an async function:
const shuffleArr = (arr) => arr.sort(() => 0.5 - Math.random());

const target1 = `              wordsToUse = basketWords.map(w => w.definition ? \`\${w.term} (\${w.definition})\` : w.term);`;
const replacement1 = `              wordsToUse = basketWords.map(w => w.definition ? \`\${w.term} (\${w.definition})\` : w.term);
              wordsToUse = wordsToUse.sort(() => 0.5 - Math.random()).slice(0, 20);`;

code = code.replace(target1, replacement1);

const target2 = `                 wordsToUse = Array.from(new Set(items)); // AI analyzes all vocabulary from lesson`;
const replacement2 = `                 wordsToUse = Array.from(new Set(items)).sort(() => 0.5 - Math.random()).slice(0, 20);`;

code = code.replace(target2, replacement2);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

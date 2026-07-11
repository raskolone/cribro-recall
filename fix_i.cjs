const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/ACCENTS\[i % ACCENTS\.length\]/g, 'ACCENTS[index % ACCENTS.length]');
code = code.replace(/playingAudioIndex === i/g, 'playingAudioIndex === index');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed index');

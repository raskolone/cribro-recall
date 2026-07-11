const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/playingAudioIndex === indexndex/g, 'playingAudioIndex === index');
code = code.replace(/ACCENTS\[index % ACCENTS\.length\], i\)/g, 'ACCENTS[index % ACCENTS.length], index)');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed indexndex');

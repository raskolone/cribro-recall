const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/const isNewAndPulsing = index === 0 && user\?\.hasNewVocabulary && !isBannerDismissed;/, '');
code = code.replace(/isNewAndPulsing \? 'border-primary shadow-\[0_0_20px_rgba\(114,240,180,0\.5\)\] animate-pulse bg-primary\/20' :/, '');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('Fixed pulsing');

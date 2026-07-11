const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/handlePlaySentenceAudio\(res\.correctTranslation, ACCENTS\[index % ACCENTS\.length\], index\)/g, 'handlePlaySentenceAudio(res.correctTranslation, ACCENTS[idx % ACCENTS.length], idx)');
code = code.replace(/playingAudioIndex === index/g, 'playingAudioIndex === idx');
code = code.replace(/ACCENT_FLAGS\[ACCENTS\[index % ACCENTS\.length\]\]/g, 'ACCENT_FLAGS[ACCENTS[idx % ACCENTS.length]]');
code = code.replace(/playingAudioIndex === indexndex/g, 'playingAudioIndex === idx');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed idx');

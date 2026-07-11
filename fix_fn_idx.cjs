const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(/const handlePlaySentenceAudio = async \(text: string, lang: string, index: number\) => \{\n    if \(playingAudioIndex === idx\)/g, 'const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {\n    if (playingAudioIndex === index)');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('fixed fn idx');

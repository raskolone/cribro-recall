const fs = require('fs');
let code = fs.readFileSync('components/practice/MatchExercise.tsx', 'utf8');

const target = `  const playAudio = async (text: string) => {
    try {
      const audio = await generateSpeech(text, 'en-US');
      await audio.play();
    } catch (e) {
      console.error(e);
    }
  };`;

const replacement = `  const playAudio = async (text: string) => {
    const audio = new Audio();
    audio.play().catch(() => {});
    try {
      const generatedAudio = await generateSpeech(text, 'en-US');
      audio.src = generatedAudio.src;
      await audio.play();
    } catch (e) {
      console.error(e);
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/practice/MatchExercise.tsx', code);

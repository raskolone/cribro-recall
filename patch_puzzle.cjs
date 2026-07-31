const fs = require('fs');
let code = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

const target = `  const playAudio = async (text: string, lang: 'en-US' | 'en-GB' = 'en-US') => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      const audio = await generateSpeech(text, lang);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
    } catch (err) {
      console.error(err);
      setIsPlayingAudio(false);
    }
  };`;

const replacement = `  const playAudio = async (text: string, lang: 'en-US' | 'en-GB' = 'en-US') => {
    if (!text) return;
    setIsPlayingAudio(true);
    const audio = new Audio();
    audio.play().catch(() => {});
    try {
      const generatedAudio = await generateSpeech(text, lang);
      audio.src = generatedAudio.src;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
    } catch (err) {
      console.error(err);
      setIsPlayingAudio(false);
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', code);

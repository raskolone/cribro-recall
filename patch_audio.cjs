const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetAudio = `  const playAudio = async (text: string, lang: string) => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      const audio = await generateSpeech(text, lang as any);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlayingAudio(false);
    }
  };`;

const newAudio = `  const playAudio = async (text: string, lang: string) => {
    if (!text) return;
    setIsPlayingAudio(true);
    
    const audio = new Audio();
    audio.play().catch(() => {});

    try {
      const generatedAudio = await generateSpeech(text, lang as any);
      audio.src = generatedAudio.src;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlayingAudio(false);
    }
  };`;

code = code.replace(targetAudio, newAudio);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetHandle = `  const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {
    if (playingAudioIndex === index) return;
    setPlayingAudioIndex(index);
    try {
      const audio = await generateSpeech(text, lang as any);
      audio.onended = () => {
        setPlayingAudioIndex(null);
      };
      audio.onerror = () => {
        setPlayingAudioIndex(null);
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      setPlayingAudioIndex(null);
    }
  };`;

const replacementHandle = `  const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {
    if (playingAudioIndex === index) return;
    setPlayingAudioIndex(index);
    
    const audio = new Audio();
    audio.play().catch(() => {});

    try {
      const generatedAudio = await generateSpeech(text, lang as any);
      audio.src = generatedAudio.src;
      audio.onended = () => {
        setPlayingAudioIndex(null);
      };
      audio.onerror = () => {
        setPlayingAudioIndex(null);
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      setPlayingAudioIndex(null);
    }
  };`;

code = code.replace(targetHandle, replacementHandle);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

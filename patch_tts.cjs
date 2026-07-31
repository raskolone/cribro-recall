const fs = require('fs');
let code = fs.readFileSync('components/flashcards/TTSButtons.tsx', 'utf8');

const targetTTS = `    setIsPlaying(lang);
    try {
      const audio = await generateSpeech(cleanText, lang);
      audio.onended = () => setIsPlaying(null);
      audio.onerror = () => setIsPlaying(null);
      await audio.play();
    } catch (err) {
      console.warn("Audio playback failed:", err);
      setIsPlaying(null);
    }`;

const newTTS = `    setIsPlaying(lang);
    const audio = new Audio();
    audio.play().catch(() => {});
    
    try {
      const generatedAudio = await generateSpeech(cleanText, lang);
      audio.src = generatedAudio.src;
      audio.onended = () => setIsPlaying(null);
      audio.onerror = () => setIsPlaying(null);
      await audio.play();
    } catch (err) {
      console.warn("Audio playback failed:", err);
      setIsPlaying(null);
    }`;

code = code.replace(targetTTS, newTTS);
fs.writeFileSync('components/flashcards/TTSButtons.tsx', code);

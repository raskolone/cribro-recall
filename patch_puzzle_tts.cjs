const fs = require('fs');
let content = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf8');

const oldPlayAudio = `  const playAudio = async (text: string) => {
    try {
      const audioData = await getAudioPronunciation(text, 'en');
      if (!audioData) return;
      const audio = new Audio(\`data:audio/mp3;base64,\${audioData}\`);
      audio.play();
    } catch (e) {
      console.error(e);
    }
  };`;

const newPlayAudio = `  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const playAudio = async (text: string, lang: string = 'en-US') => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      const res = await fetch(\`/api/tts?text=\${encodeURIComponent(text)}&lang=\${lang}\`);
      if (!res.ok) throw new Error('Audio generation failed');
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Empty audio blob');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      
      audio.play().catch(err => {
        console.warn("Audio playback failed:", err);
        setIsPlayingAudio(false);
      });
    } catch (err) {
      console.error(err);
      setIsPlayingAudio(false);
    }
  };`;

content = content.replace(oldPlayAudio, newPlayAudio);
fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', content);

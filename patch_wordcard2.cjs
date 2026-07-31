const fs = require('fs');
let code = fs.readFileSync('components/dashboard/WordCard.tsx', 'utf8');

const target = `  const handlePlayAudio = async (variant: string) => {
    if (isPlaying) return;
    setIsPlaying(variant);
    try {
      if (word.language === 'English') {
        const accent = variant === 'American' ? 'en-US' : 'en-GB';
        const audio = await generateSpeech(word.word, accent);
        await audio.play();
      } else {
        const voice = VOICE_CONFIG[word.language];
        const audio = await getAudioPronunciation(word.word, voice);
        await playAudio(audio);
      }
    } catch (error) {
      console.error(\`Failed to play \${variant} audio\`, error);
    } finally {
      setIsPlaying(null);
    }
  };`;

const replacement = `  const handlePlayAudio = async (variant: string) => {
    if (isPlaying) return;
    setIsPlaying(variant);
    
    // iOS Workaround
    let nativeAudio: HTMLAudioElement | null = null;
    if (word.language === 'English') {
      nativeAudio = new Audio();
      nativeAudio.play().catch(() => {});
    } else {
      unlockAudioContext();
    }
    
    try {
      if (word.language === 'English') {
        const accent = variant === 'American' ? 'en-US' : 'en-GB';
        const generatedAudio = await generateSpeech(word.word, accent);
        if (nativeAudio) {
           nativeAudio.src = generatedAudio.src;
           await nativeAudio.play();
        }
      } else {
        const voice = VOICE_CONFIG[word.language];
        const audio = await getAudioPronunciation(word.word, voice);
        await playAudio(audio);
      }
    } catch (error) {
      console.error(\`Failed to play \${variant} audio\`, error);
    } finally {
      setIsPlaying(null);
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/WordCard.tsx', code);

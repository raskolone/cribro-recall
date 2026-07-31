const fs = require('fs');
let code = fs.readFileSync('components/dashboard/WordCard.tsx', 'utf8');

const target = `  const playTTS = async (e: React.MouseEvent, variant: 'American' | 'British') => {
    e.stopPropagation();
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlaying(null);
    }
  };`;

const replacement = `  const playTTS = async (e: React.MouseEvent, variant: 'American' | 'British') => {
    e.stopPropagation();
    if (isPlaying) return;
    setIsPlaying(variant);
    
    // iOS Workaround
    let nativeAudio: HTMLAudioElement | null = null;
    if (word.language === 'English') {
      nativeAudio = new Audio();
      nativeAudio.play().catch(() => {});
    } else {
      // For base64 audio playAudio handles Context creation, but iOS might block AudioContext if not resumed synchronously. 
      // Fortunately playAudio in audioUtils tries to resume it.
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlaying(null);
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/WordCard.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const playAudioRegex = /const playAudio = \([\s\S]*?audio\.onerror = \(\) => \{[\s\S]*?window\.speechSynthesis\.speak\(utterance\);[\s\S]*?\} else \{[\s\S]*?handleStop\(\);[\s\S]*?\}[\s\S]*?\};[\s\S]*?audio\.play\(\)\.catch\(err => \{[\s\S]*?window\.speechSynthesis\.speak\(utterance\);[\s\S]*?\} else \{[\s\S]*?handleStop\(\);[\s\S]*?\}[\s\S]*?\}\);/g;

code = code.replace(playAudioRegex, `const playAudio = (text: string, lang: string) => {
    if (!text) return;
    setIsPlayingAudio(true);
    const audio = createSpeechAudio(text, lang as any);
    const handleStop = () => setIsPlayingAudio(false);
    audio.onended = handleStop;
    
    audio.onerror = () => {
      console.error("ElevenLabs audio streaming error.");
      handleStop();
    };
    
    audio.play().catch(err => {
      console.error("Mobile HTML5 audio play error (ElevenLabs):", err);
      handleStop();
    });`);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// The original AIExerciseGeneratorScreen has this pattern:
//     audio.play().catch(err => {
//       console.warn("Mobile HTML5 audio play error:", err);
//       if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
//         window.speechSynthesis.cancel();
//         ...
//         window.speechSynthesis.speak(utterance);
//       } else {
//         handleStop();
//       }
//     });
// Also, inside audio.onerror = () => { ... } it does the same fallback.

const replacementAudioError = `audio.onerror = () => {
      console.error("ElevenLabs audio streaming error.");
      handleStop();
    };
    audio.play().catch(err => {
      console.error("Mobile HTML5 audio play error (ElevenLabs):", err);
      handleStop();
    });`;

// we need to find the `const handlePlaySentenceAudio` block and replace it correctly
const playSentenceRegex = /const handlePlaySentenceAudio[\s\S]*?audio\.onerror = \(\) => \{[\s\S]*?window\.speechSynthesis\.speak\(utterance\);[\s\S]*?\} else \{[\s\S]*?handleStop\(\);[\s\S]*?\}[\s\S]*?\};[\s\S]*?audio\.play\(\)\.catch\(err => \{[\s\S]*?window\.speechSynthesis\.speak\(utterance\);[\s\S]*?\} else \{[\s\S]*?handleStop\(\);[\s\S]*?\}[\s\S]*?\}\);/g;

code = code.replace(playSentenceRegex, `const handlePlaySentenceAudio = (text: string, lang: string, index: number) => {
    if (!text) return;
    setPlayingAudioIndex(index);
    const audio = createSpeechAudio(text, lang as any);
    const handleStop = () => setPlayingAudioIndex(null);
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

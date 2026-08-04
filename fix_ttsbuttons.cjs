const fs = require('fs');
let code = fs.readFileSync('components/flashcards/TTSButtons.tsx', 'utf8');

const regex = /audio\.onerror = \(\) => \{[\s\S]*?\} else \{[\s\S]*?handleStop\(\);[\s\S]*?\}[\s\S]*?\};[\s\S]*?audio\.play\(\)\.catch\(\(err\) => \{[\s\S]*?\} else \{[\s\S]*?handleStop\(\);[\s\S]*?\}[\s\S]*?\}\);/g;

code = code.replace(regex, `audio.onerror = () => {
      console.error("ElevenLabs audio streaming error.");
      handleStop();
    };
    audio.play().catch((err) => {
      console.error("Direct HTML5 audio playback error on mobile (ElevenLabs):", err);
      handleStop();
    });`);

fs.writeFileSync('components/flashcards/TTSButtons.tsx', code);

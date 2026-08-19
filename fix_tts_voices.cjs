const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldBlock = `      const fileName = \`tts_cache/\${hash}.mp3\`;
      
      const os = await import('os');`;

const newBlock = `      const fileName = \`tts_cache/\${hash}.mp3\`;

      const hashInt = parseInt(hash.charAt(hash.length - 1), 16);
      const isMale = hashInt % 2 === 0;
      
      const os = await import('os');`;

content = content.replace(oldBlock, newBlock);

const oldEleven = `      if (!finalAudioBuffer && elevenLabsKey) {
        const voiceId = isUK ? "NbkKnEAZ7Bqw4EAkVEaz" : "S9WrLrqYPJzmQyWPWbZ5";`;
const newEleven = `      if (!finalAudioBuffer && elevenLabsKey) {
        let voiceId = "S9WrLrqYPJzmQyWPWbZ5";
        if (isUK) {
          voiceId = isMale ? "JBFqnCBcs6TWROtGMCA3" : "Xb7hH8MSALEjdAclc2Uj"; // George : Alice
        } else {
          voiceId = isMale ? "29vD33N1CtxCmqQRPOHJ" : "21m00Tcm4TlvDq8ikWAM"; // Drew : Rachel
        }`;
content = content.replace(oldEleven, newEleven);

const oldOpenAI = `      if (!finalAudioBuffer && openaiKey) {
        const voice = isUK ? "fable" : "nova";`;
const newOpenAI = `      if (!finalAudioBuffer && openaiKey) {
        const voice = isUK ? (isMale ? "fable" : "shimmer") : (isMale ? "echo" : "nova");`;
content = content.replace(oldOpenAI, newOpenAI);

const oldGCP = `        try {
          const langCode = isUK ? 'en-GB' : 'en-US';
          const voiceName = isUK ? 'en-GB-Neural2-B' : 'en-US-Neural2-F';`;
const newGCP = `        try {
          const langCode = isUK ? 'en-GB' : 'en-US';
          const voiceName = isUK ? (isMale ? 'en-GB-Neural2-B' : 'en-GB-Neural2-A') : (isMale ? 'en-US-Neural2-D' : 'en-US-Neural2-F');`;
content = content.replace(oldGCP, newGCP);

const oldGemini = `                  language: langCode.toLowerCase(),
                  voice: isUK ? "charon" : "kore"
                } as any`;
const newGemini = `                  language: langCode.toLowerCase(),
                  voice: isUK ? (isMale ? "fenrir" : "zephyr") : (isMale ? "charon" : "kore")
                } as any`;
content = content.replace(oldGemini, newGemini);

fs.writeFileSync('server.ts', content);
console.log('Fixed TTS voices successfully.');

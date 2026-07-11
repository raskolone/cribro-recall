const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newTtsLogic = `
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      
      // If ElevenLabs API key is present, use it
      if (elevenLabsKey) {
        // Voice selection based on language
        let voiceId = 'cgSgspJ2msm6clMCkdW9'; // Default to Jessica (US)
        
        const usVoices = ['EXAVITQu4vr4xnSDxMaL', 'cgSgspJ2msm6clMCkdW9', '21m00Tcm4TlvDq8ikWAM'];
        const gbVoices = ['Xb7hH8MSUJpSbSDYk0k2', 'CYw3kZ02Hs0563khs1Fj', 'JBFqnCBsd6RMkjVDRZzb'];
        const auVoices = ['IKne3meq5aSn9XLyUdCD', 'ZQe5CZNOzWyzPSCn5a3c'];
        const sctVoices = ['D38z5RcWu1voky8WS1ja', 'N2lVS1w4EtoT3dr4eOWO'];

        if (lang === 'en-GB') {
          voiceId = gbVoices[Math.floor(Math.random() * gbVoices.length)];
        } else if (lang === 'en-AU') {
          voiceId = auVoices[Math.floor(Math.random() * auVoices.length)];
        } else if (lang === 'en-SCT') {
          voiceId = sctVoices[Math.floor(Math.random() * sctVoices.length)];
        } else if (lang === 'en-US') {
          voiceId = usVoices[Math.floor(Math.random() * usVoices.length)];
        }

        const response = await fetch(\`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}?output_format=mp3_44100_128\`, {
`;

code = code.replace(/const elevenLabsKey = process\.env\.ELEVENLABS_API_KEY;\s*\/\/\s*If ElevenLabs API key is present, use it\s*if \(elevenLabsKey\) \{\s*\/\/ Voice selection based on language\s*let voiceId = 'cgSgspJ2msm6clMCkdW9'; \/\/ Default to Jessica \(US\)\s*if \(lang === 'en-GB'\) \{\s*voiceId = 'Xb7hH8MSUJpSbSDYk0k2'; \/\/ Alice \(GB\)\s*\} else if \(lang === 'en-US'\) \{\s*voiceId = 'EXAVITQu4vr4xnSDxMaL'; \/\/ Sarah \(US\)\s*\}\s*const response = await fetch\(`https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/\$\{voiceId\}\?output_format=mp3_44100_128`, \{/, newTtsLogic.trim());

fs.writeFileSync('server.ts', code);
console.log('patched server tts');

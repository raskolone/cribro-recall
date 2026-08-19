const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldBlock = `            const interaction = await ai.interactions.create({
              model: 'gemini-3.1-flash-tts-preview',
              input: formattedText,
              response_modalities: ['AUDIO'],
              generation_config: {
                speech_config: {
                  language: langCode.toLowerCase(),
                  voice: isUK ? "charon" : "kore" } as any
                }
              }
            });`;

const newBlock = `            const interaction = await ai.interactions.create({
              model: 'gemini-3.1-flash-tts-preview',
              input: formattedText,
              response_modalities: ['AUDIO'],
              generation_config: {
                speech_config: {
                  language: langCode.toLowerCase(),
                  voice: isUK ? "charon" : "kore"
                } as any
              }
            });`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync('server.ts', content);
  console.log('Fixed successfully.');
} else {
  console.log('Could not find oldBlock to fix.');
}

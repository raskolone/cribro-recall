const fs = require('fs');
let code = fs.readFileSync('services/elevenLabsService.ts', 'utf8');

code = code.replace(
  /export const DEFAULT_VOICE_SETTINGS = \{[^}]+\};/,
  `export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.95, // Bardzo wysoka stabilność (lektorski, spokojny ton)
  similarity_boost: 0.90, // Wyrazista i poprawna dykcja
  style: 0.0,
  use_speaker_boost: true
};`
);

code = code.replace(
  /export const ELEVENLABS_VOICES = \{[\s\S]+?\} as const;/,
  `export const ELEVENLABS_VOICES = {
  'en-US': "pqHfZKP75CvOlQylNhV4", // Bill (US, spokojny, lektor)
  'en-GB': "JBFqnCBsd6RMkjVDRZzb", // George (GB, spokojny, lektor)
  'AmE': "pqHfZKP75CvOlQylNhV4",
  'BrE': "JBFqnCBsd6RMkjVDRZzb",
} as const;`
);

fs.writeFileSync('services/elevenLabsService.ts', code);

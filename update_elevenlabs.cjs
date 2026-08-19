const fs = require('fs');
let content = fs.readFileSync('services/elevenLabsService.ts', 'utf8');

const oldUrlFunction = `export function getTTSUrl(
  text: string,
  accent: Accent | string = 'en-US'
): string {
  const formattedText = formatTextForTTS(text);
  const selectedVoiceId = getVoiceId(accent);
  return \`/api/tts?text=\${encodeURIComponent(formattedText)}&accent=\${encodeURIComponent(accent)}&voice_id=\${encodeURIComponent(selectedVoiceId)}\`;
}`;

const newUrlFunction = `export function getTTSUrl(
  text: string,
  accent: Accent | string = 'en-US'
): string {
  const formattedText = formatTextForTTS(text);
  return \`/api/tts?text=\${encodeURIComponent(formattedText)}&accent=\${encodeURIComponent(accent)}\`;
}`;

if (content.includes(oldUrlFunction)) {
  content = content.replace(oldUrlFunction, newUrlFunction);
  fs.writeFileSync('services/elevenLabsService.ts', content);
  console.log('Updated getTTSUrl successfully.');
} else {
  console.log('Could not find oldUrlFunction');
}

const fs = require('fs');
let code = fs.readFileSync('services/elevenLabsService.ts', 'utf8');

// Replace playSpeech
code = code.replace(/export async function playSpeech\([\s\S]*?\} catch \(err\) \{[\s\S]*?\}\n  return audio;\n\}/m, `export async function playSpeech(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<HTMLAudioElement> {
  const formattedText = formatTextForTTS(text);
  const audio = createSpeechAudio(text, accent);
  
  try {
    await audio.play();
  } catch (err) {
    console.error("Audio play error:", err);
    // Explicitly removed SpeechSynthesis fallback to force ElevenLabs usage
  }
  return audio;
}`);

fs.writeFileSync('services/elevenLabsService.ts', code);

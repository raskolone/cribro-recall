export type Accent = 'en-US' | 'en-GB' | 'AmE' | 'BrE';

export const ELEVENLABS_VOICES = {
  'en-US': "pqHfZKP75CvOlQylNhV4", // Bill (US, spokojny, lektor)
  'en-GB': "JBFqnCBsd6RMkjVDRZzb", // George (GB, spokojny, lektor)
  'AmE': "pqHfZKP75CvOlQylNhV4",
  'BrE': "JBFqnCBsd6RMkjVDRZzb",
} as const;

export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.95, // Bardzo wysoka stabilność (lektorski, spokojny ton)
  similarity_boost: 0.90, // Wyrazista i poprawna dykcja
  style: 0.0,
  use_speaker_boost: true
};

export const MODEL_ID = "eleven_turbo_v2_5";

/**
 * Formats text for TTS:
 * Checks if the text or single word ends with '.', '?', or '!'.
 * If not, automatically appends a period '.' at the end.
 * Examples: "apple" -> "apple.", "How are you" -> "How are you."
 */
export function formatTextForTTS(text: string): string {
  if (!text) return '';
  const trimmed = text.replace(/<[^>]+>/g, '').trim();
  if (!trimmed) return '';
  if (/[.?!]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

/**
 * Returns the correct ElevenLabs voice ID for a given accent.
 */
export function getVoiceId(accent: Accent | string = 'en-US'): string {
  if (accent === 'en-GB' || accent === 'BrE') {
    return ELEVENLABS_VOICES['en-GB'];
  }
  return ELEVENLABS_VOICES['en-US'];
}

/**
 * Generates speech using ElevenLabs.
 * Sends HTTP POST request to: https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}
 * with body:
 * {
 *   "text": formattedText,
 *   "model_id": "eleven_turbo_v2_5",
 *   "voice_settings": {
 *     "stability": 0.75,
 *     "similarity_boost": 0.85,
 *     "style": 0.0,
 *     "use_speaker_boost": true
 *   }
 * }
 * Returns an HTMLAudioElement ready for playback.
 */
export function getTTSUrl(
  text: string,
  accent: Accent | string = 'en-US'
): string {
  const formattedText = formatTextForTTS(text);
  const selectedVoiceId = getVoiceId(accent);
  return `/api/tts?text=${encodeURIComponent(formattedText)}&accent=${encodeURIComponent(accent)}&voice_id=${encodeURIComponent(selectedVoiceId)}`;
}

let sharedAudioPlayer: HTMLAudioElement | null = null;

export function getSharedAudioPlayer(): HTMLAudioElement {
  if (typeof window === 'undefined') return new Audio();
  if (!sharedAudioPlayer) {
    sharedAudioPlayer = new Audio();
    // Pre-load a tiny silent 1-second WAV file to safely initialize on mobile
    sharedAudioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    sharedAudioPlayer.load();
  }
  return sharedAudioPlayer;
}

export function unlockMobileAudio() {
  const player = getSharedAudioPlayer();
  if (player) {
    player.play().then(() => {
      player.pause();
    }).catch((e) => {
      console.warn("Shared audio context pre-unlock bypassed or blocked:", e);
    });
  }
}

// Add event listeners on initial file load to unlock on first user click/touch
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockMobileAudio();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('mousedown', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('touchstart', unlock);
  window.addEventListener('mousedown', unlock);
}

/**
 * Creates an HTMLAudioElement pointing directly to the streaming /api/tts proxy endpoint.
 * Calling .play() on this returned object inside a click/tap event handler guarantees
 * mobile Safari/Chrome playback authorization.
 */
export function createSpeechAudio(
  text: string,
  accent: Accent | string = 'en-US'
): HTMLAudioElement {
  const url = getTTSUrl(text, accent);
  const audio = getSharedAudioPlayer();
  audio.src = url;
  return audio;
}

export async function generateSpeech(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<HTMLAudioElement> {
  return createSpeechAudio(text, accent);
}

/**
 * Returns a Blob containing the audio for the given text and accent.
 */
export async function getSpeechBlob(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<Blob> {
  const url = getTTSUrl(text, accent);
  const response = await fetch(url);
  return await response.blob();
}

/**
 * Returns an Object URL containing the audio for the given text and accent.
 */
export async function getSpeechUrl(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<string> {
  return getTTSUrl(text, accent);
}

/**
 * Generates and plays ElevenLabs speech immediately with mobile tap support and Web Speech fallback.
 */
export async function playSpeech(
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
}

export default {
  ELEVENLABS_VOICES,
  DEFAULT_VOICE_SETTINGS,
  MODEL_ID,
  formatTextForTTS,
  getVoiceId,
  getTTSUrl,
  createSpeechAudio,
  generateSpeech,
  getSpeechBlob,
  getSpeechUrl,
  playSpeech
};

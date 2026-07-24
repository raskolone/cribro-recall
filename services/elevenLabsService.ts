export type Accent = 'en-US' | 'en-GB' | 'AmE' | 'BrE';

export const ELEVENLABS_VOICES = {
  'en-US': "S9WrLrqYPJzmQyWPWbZ5",
  'en-GB': "NbkKnEAZ7Bqw4EAkVEaz",
  'AmE': "S9WrLrqYPJzmQyWPWbZ5",
  'BrE': "NbkKnEAZ7Bqw4EAkVEaz",
} as const;

export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.75,
  similarity_boost: 0.85,
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
export async function generateSpeech(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<HTMLAudioElement> {
  const formattedText = formatTextForTTS(text);
  if (!formattedText) {
    throw new Error('Empty text provided for speech generation');
  }

  const selectedVoiceId = getVoiceId(accent);
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;

  const requestBody = {
    text: formattedText,
    model_id: MODEL_ID,
    voice_settings: DEFAULT_VOICE_SETTINGS
  };

  // 1. Try client-side direct request if ELEVENLABS_API_KEY is available in browser env
  const apiKey = (import.meta as any).env?.VITE_ELEVENLABS_API_KEY || (process as any).env?.ELEVENLABS_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        return new Audio(audioUrl);
      } else {
        console.warn(`Direct ElevenLabs API returned ${response.status}, trying server proxy.`);
      }
    } catch (err) {
      console.warn('Direct ElevenLabs request failed, trying server proxy:', err);
    }
  }

  // 2. Try POST to server endpoint /api/tts which proxies ElevenLabs
  try {
    const proxyResponse = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: formattedText,
        accent: accent,
        voice_id: selectedVoiceId
      })
    });

    if (proxyResponse.ok) {
      const audioBlob = await proxyResponse.blob();
      if (audioBlob.size > 0) {
        const audioUrl = URL.createObjectURL(audioBlob);
        return new Audio(audioUrl);
      }
    }
  } catch (proxyErr) {
    console.warn('Server proxy POST /api/tts failed:', proxyErr);
  }

  // 3. Fallback GET /api/tts
  const fallbackUrl = `/api/tts?text=${encodeURIComponent(formattedText)}&lang=${encodeURIComponent(accent)}`;
  return new Audio(fallbackUrl);
}

/**
 * Returns a Blob containing the audio for the given text and accent.
 */
export async function getSpeechBlob(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<Blob> {
  const audio = await generateSpeech(text, accent);
  const response = await fetch(audio.src);
  return await response.blob();
}

/**
 * Returns a Object URL (blob:...) containing the audio for the given text and accent.
 */
export async function getSpeechUrl(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<string> {
  const audio = await generateSpeech(text, accent);
  return audio.src;
}

/**
 * Generates and plays the speech immediately.
 */
export async function playSpeech(
  text: string,
  accent: Accent | string = 'en-US'
): Promise<HTMLAudioElement> {
  const audio = await generateSpeech(text, accent);
  await audio.play();
  return audio;
}

export default {
  ELEVENLABS_VOICES,
  DEFAULT_VOICE_SETTINGS,
  MODEL_ID,
  formatTextForTTS,
  getVoiceId,
  generateSpeech,
  getSpeechBlob,
  getSpeechUrl,
  playSpeech
};

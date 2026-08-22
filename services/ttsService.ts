import { SoundSettings, TTSAccent, VoiceGender, VoiceSpeed, SoundEngine } from '../types';
import { aiMonitor } from './aiMonitorService';
import { getCachedIdToken } from './authToken';
import { formatAIModelName } from './geminiService';

export type Accent = 'en-US' | 'en-GB' | 'AmE' | 'BrE';

export interface TTSPlayOptions {
  accent?: Accent | string;
  gender?: VoiceGender | string;
  speed?: number;
  engine?: SoundEngine | string;
}

export const OPENAI_VOICES = {
  'en-US': {
    male: 'echo',
    female: 'nova'
  },
  'en-GB': {
    male: 'fable',
    female: 'shimmer'
  }
} as const;

// Backward-compatibility alias
export const ELEVENLABS_VOICES = {
  'en-US': 'openai-echo',
  'en-GB': 'openai-fable',
  'AmE': 'openai-echo',
  'BrE': 'openai-fable',
} as const;

export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.85,
  similarity_boost: 0.85,
  style: 0.0,
  use_speaker_boost: true
};

export const MODEL_ID = "openai-tts-1";

/**
 * Reads stored user sound settings from localStorage for instant fallback.
 */
export function getStoredSoundSettings(): Partial<SoundSettings> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('cribro_sound_settings_v2');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/**
 * Formats text for TTS:
 * Checks if the text ends with '.', '?', or '!'.
 * If not, automatically appends a period '.' at the end.
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
 * Returns voice identifier for a given accent.
 */
export function getVoiceId(accent: Accent | string = 'en-US', gender: VoiceGender | string = 'male'): string {
  const isUK = accent === 'en-GB' || accent === 'BrE' || accent === 'UK';
  const isMale = gender === 'male' || gender === 'm' || (!gender.includes('female') && !gender.includes('f'));
  
  if (isUK) {
    return isMale ? OPENAI_VOICES['en-GB'].male : OPENAI_VOICES['en-GB'].female;
  }
  return isMale ? OPENAI_VOICES['en-US'].male : OPENAI_VOICES['en-US'].female;
}

/**
 * Generates URL pointing to the streaming /api/tts endpoint with query parameters.
 */
export function getTTSUrl(
  text: string,
  options?: Accent | string | TTSPlayOptions
): string {
  const formattedText = formatTextForTTS(text);
  const stored = getStoredSoundSettings();
  
  let accent = stored.ttsAccent || 'en-US';
  let gender = stored.voiceGender || 'male';
  let speed = stored.voiceSpeed || 1.0;
  let engine = stored.soundEngine || 'auto';

  if (typeof options === 'string') {
    accent = options as any;
  } else if (options && typeof options === 'object') {
    if (options.accent) accent = options.accent as any;
    if (options.gender) gender = options.gender as any;
    if (options.speed !== undefined) speed = options.speed as any;
    if (options.engine) engine = options.engine as any;
  }

  const params = new URLSearchParams({
    text: formattedText,
    accent: String(accent),
    gender: String(gender),
    speed: String(speed),
    engine: String(engine)
  });

  // Synteza mowy kosztuje, więc endpoint wymaga zalogowania. Adres ląduje
  // w `audio.src`, gdzie nie ma jak podać nagłówka Authorization — token
  // idzie parametrem i serwer sprawdza go tak samo jak nagłówek.
  const token = getCachedIdToken();
  if (token) params.set('t', token);

  return `/api/tts?${params.toString()}`;
}

/**
 * Web Speech API native browser fallback.
 * Guaranteed to produce audio on any device without internet or API keys.
 */
export function speakWithWebSpeech(
  text: string,
  options?: Accent | string | TTSPlayOptions,
  parentReqId?: string
): Promise<void> {
  return new Promise((resolve) => {
    const cleanText = formatTextForTTS(text);
    const displaySample = cleanText.length > 32 ? cleanText.slice(0, 30) + '...' : cleanText;

    const reqId = parentReqId || aiMonitor.startRequest({
      taskName: `Wymowa (Web Speech API): "${displaySample}"`,
      initialModel: 'Web Speech API (Browser)',
      category: 'tts',
      provider: 'Native',
      promptSnippet: cleanText,
      statusMessage: `Odtwarzanie syntezy w przeglądarce (Web Speech)...`
    });

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn("Web Speech API not supported in this environment.");
      aiMonitor.failRequest(reqId, 'Brak wsparcia Web Speech API w tej przeglądarce');
      return resolve();
    }

    const stored = getStoredSoundSettings();
    let accent = 'en-US';
    let speed = 1.0;
    let gender = 'male';

    if (typeof options === 'string') {
      accent = options;
    } else if (options && typeof options === 'object') {
      if (options.accent) accent = String(options.accent);
      if (options.speed !== undefined) speed = Number(options.speed);
      if (options.gender) gender = String(options.gender);
    } else {
      if (stored.ttsAccent) accent = stored.ttsAccent;
      if (stored.voiceSpeed) speed = stored.voiceSpeed;
      if (stored.voiceGender) gender = stored.voiceGender;
    }

    const isUK = accent === 'en-GB' || accent === 'BrE' || accent === 'UK';

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = isUK ? 'en-GB' : 'en-US';
      utterance.rate = Math.max(0.6, Math.min(1.5, speed));
      utterance.pitch = gender === 'female' ? 1.15 : 0.95;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langFilter = isUK ? 'en-GB' : 'en-US';
        const matchingVoices = voices.filter(v => 
          v.lang.replace('_', '-').toLowerCase().startsWith(langFilter.toLowerCase())
        );

        if (matchingVoices.length > 0) {
          const preferredVoice = matchingVoices.find(v => {
            const name = v.name.toLowerCase();
            if (gender === 'female') {
              return name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('victoria') || name.includes('karen') || name.includes('natural');
            } else {
              return name.includes('male') || name.includes('david') || name.includes('george') || name.includes('daniel') || name.includes('alex') || name.includes('natural');
            }
          }) || matchingVoices[0];
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
        }
      }

      utterance.onend = () => {
        aiMonitor.completeRequest(reqId, {
          modelUsed: 'Web Speech API (Browser)',
          message: 'Wymowa odtworzona przez Web Speech API'
        });
        resolve();
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis utterance error:", e);
        aiMonitor.failRequest(reqId, 'Błąd odtwarzania Web Speech API');
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      console.warn("SpeechSynthesis error:", err);
      aiMonitor.failRequest(reqId, err?.message || 'Błąd SpeechSynthesis');
      resolve();
    }
  });
}

/**
 * Plays audio resiliently using HTML5 Audio with automatic Web Speech fallback.
 */
export async function playSpeech(
  text: string,
  options?: Accent | string | TTSPlayOptions
): Promise<void> {
  const stored = getStoredSoundSettings();
  let engine: SoundEngine = stored.soundEngine || 'auto';
  if (typeof options === 'object' && options?.engine) {
    engine = options.engine as SoundEngine;
  }

  const cleanSample = text.replace(/<[^>]+>/g, '').trim();
  const displaySample = cleanSample.length > 32 ? cleanSample.slice(0, 30) + '...' : cleanSample;

  // If user explicitly configured browser engine, speak directly with Web Speech API
  if (engine === 'browser') {
    return speakWithWebSpeech(text, options);
  }

  // Model determining for monitor
  const initialModel = engine === 'gemini' 
    ? 'gemini-3.1-flash-tts-preview' 
    : engine === 'gpt4o-mini' 
    ? 'openai/gpt-4o-mini-audio-preview' 
    : 'openai/tts-1';

  const provider = engine === 'gemini' ? 'Google Gemini' : 'OpenAI';

  const reqId = aiMonitor.startRequest({
    taskName: `Generowanie wymowy TTS: "${displaySample}"`,
    initialModel,
    category: 'tts',
    provider,
    promptSnippet: cleanSample,
    statusMessage: `Wysyłam zapytanie audio do: ${formatAIModelName(initialModel)}...`
  });

  const url = getTTSUrl(text, options);
  
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (usedModel: string = initialModel, isError = false) => {
      if (!resolved) {
        resolved = true;
        if (!isError) {
          aiMonitor.completeRequest(reqId, {
            modelUsed: usedModel,
            message: `Dźwięk wygenerowany i odtworzony (${formatAIModelName(usedModel)})`
          });
        }
        resolve();
      }
    };

    try {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;

      // Handle loaded metadata / play
      audio.onplay = () => {
        aiMonitor.updateStatus(reqId, `Odtwarzanie audio: "${displaySample}"...`);
      };

      // Handle successful end
      audio.onended = () => {
        finish(initialModel, false);
      };

      // Fallback on error (e.g. 503 from server, offline, or outside AI Studio)
      audio.onerror = () => {
        console.info("[TTS] Server audio endpoint unreachable. Falling back to native Web Speech...");
        aiMonitor.updateModelAttempt(reqId, 'Web Speech API (Browser)', 'Serwer TTS niedostępny - fallback do Web Speech API');
        speakWithWebSpeech(text, options, reqId).then(() => finish('Web Speech API (Browser)', false));
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[TTS] Audio.play() blocked or failed. Using Web Speech fallback:", err.message || err);
          aiMonitor.updateModelAttempt(reqId, 'Web Speech API (Browser)', 'Autoodtwarzanie zablokowane - fallback do Web Speech API');
          speakWithWebSpeech(text, options, reqId).then(() => finish('Web Speech API (Browser)', false));
        });
      }
    } catch (e: any) {
      console.warn("[TTS] Error initiating Audio element. Using Web Speech fallback:", e);
      aiMonitor.updateModelAttempt(reqId, 'Web Speech API (Browser)', 'Błąd Audio - fallback do Web Speech API');
      speakWithWebSpeech(text, options, reqId).then(() => finish('Web Speech API (Browser)', false));
    }
  });
}

/**
 * Creates an HTMLAudioElement ready for playback.
 */
export function createSpeechAudio(
  text: string,
  options?: Accent | string | TTSPlayOptions
): HTMLAudioElement {
  const cleanSample = text.replace(/<[^>]+>/g, '').trim();
  const displaySample = cleanSample.length > 32 ? cleanSample.slice(0, 30) + '...' : cleanSample;

  const reqId = aiMonitor.startRequest({
    taskName: `Tworzenie audio TTS: "${displaySample}"`,
    initialModel: 'openai/tts-1',
    category: 'tts',
    provider: 'OpenAI',
    promptSnippet: cleanSample,
    statusMessage: `Wysyłam zapytanie audio do: OpenAI (TTS-1)...`
  });

  const url = getTTSUrl(text, options);
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.src = url;

  audio.onplay = () => {
    aiMonitor.updateStatus(reqId, `Odtwarzanie audio: "${displaySample}"...`);
  };
  audio.onended = () => {
    aiMonitor.completeRequest(reqId, {
      modelUsed: 'openai/tts-1',
      message: `Audio odtworzone (${formatAIModelName('openai/tts-1')})`
    });
  };
  audio.onerror = () => {
    aiMonitor.failRequest(reqId, 'Błąd pobierania audio z serwera');
  };

  return audio;
}

export async function generateSpeech(
  text: string,
  options?: Accent | string | TTSPlayOptions
): Promise<HTMLAudioElement> {
  return createSpeechAudio(text, options);
}

export async function getSpeechBlob(
  text: string,
  options?: Accent | string | TTSPlayOptions
): Promise<Blob> {
  const cleanSample = text.replace(/<[^>]+>/g, '').trim();
  const displaySample = cleanSample.length > 32 ? cleanSample.slice(0, 30) + '...' : cleanSample;

  const reqId = aiMonitor.startRequest({
    taskName: `Pobieranie bufora TTS: "${displaySample}"`,
    initialModel: 'openai/tts-1',
    category: 'tts',
    provider: 'OpenAI',
    promptSnippet: cleanSample,
    statusMessage: `Pobieranie bufora mowy z OpenAI (TTS-1)...`
  });

  try {
    const url = getTTSUrl(text, options);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    aiMonitor.completeRequest(reqId, {
      modelUsed: 'openai/tts-1',
      message: `Bufor audio TTS pobrany (${(blob.size / 1024).toFixed(1)} KB)`
    });
    return blob;
  } catch (err: any) {
    aiMonitor.failRequest(reqId, err?.message || 'Błąd pobierania blob');
    throw err;
  }
}

export async function getSpeechUrl(
  text: string,
  options?: Accent | string | TTSPlayOptions
): Promise<string> {
  return getTTSUrl(text, options);
}

// Unlock audio on initial user touch/click
if (typeof window !== 'undefined') {
  const unlock = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('mousedown', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('touchstart', unlock);
  window.addEventListener('mousedown', unlock);
}

export default {
  OPENAI_VOICES,
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
  playSpeech,
  speakWithWebSpeech,
  getStoredSoundSettings
};

import elevenLabsService, {
  ELEVENLABS_VOICES,
  DEFAULT_VOICE_SETTINGS,
  MODEL_ID,
  formatTextForTTS,
  getVoiceId,
  generateSpeech,
  getSpeechBlob,
  getSpeechUrl,
  playSpeech,
  Accent
} from './elevenLabsService';

export type { Accent };
export {
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

export default elevenLabsService;

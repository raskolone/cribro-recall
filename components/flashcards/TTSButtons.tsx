import React, { useState } from 'react';
import { playSpeech } from '../../services/ttsService';
import { useSettings } from '../../context/SettingsContext';
import PronunciationButtons, { type PronunciationLang } from './PronunciationButtons';

interface TTSButtonsProps {
  text: string;
  size?: 'sm' | 'md';
}

const TTSButtons: React.FC<TTSButtonsProps> = ({ text, size = 'md' }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const { soundSettings } = useSettings();
  const cleanText = text.replace(/<[^>]+>/g, '').trim();

  const handlePlayTTS = async (e: React.MouseEvent, lang: PronunciationLang) => {
    e.stopPropagation();
    if (!cleanText || isPlaying) return;
    
    setIsPlaying(lang);
    try {
      await playSpeech(cleanText, {
        accent: lang,
        gender: soundSettings?.voiceGender || 'male',
        speed: soundSettings?.voiceSpeed || 1.0,
        engine: soundSettings?.soundEngine || 'auto'
      });
    } catch (err) {
      console.warn("TTS button play error:", err);
    } finally {
      setIsPlaying(null);
    }
  };

  return <PronunciationButtons playing={isPlaying as PronunciationLang | null} onPlay={handlePlayTTS} disabled={!!isPlaying} />;
};

export default TTSButtons;

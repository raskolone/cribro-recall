import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import i18n from "i18next";
import { playSpeech } from '../../services/ttsService';
import { useSettings } from '../../context/SettingsContext';

interface TTSButtonsProps {
  text: string;
  size?: 'sm' | 'md';
}

const TTSButtons: React.FC<TTSButtonsProps> = ({ text, size = 'md' }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const { soundSettings } = useSettings();
  const cleanText = text.replace(/<[^>]+>/g, '').trim();

  const handlePlayTTS = async (e: React.MouseEvent, lang: 'en-US' | 'en-GB') => {
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

  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={(e) => handlePlayTTS(e, 'en-GB')}
        disabled={!!isPlaying}
        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md border transition-all active:scale-95 group/btn disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${isPlaying === 'en-GB' ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_10px_rgba(114, 240, 180,0.3)]' : 'bg-white/5 text-content border-white/10 hover:bg-white/10 hover:text-white'}`}
        title={i18n.t("British English Pronunciation")}
      >
        <span className="text-xs leading-none">🇬🇧</span>
        <span className="text-[9px] font-mono uppercase tracking-wider">{i18n.t("UK")}</span>
        {isPlaying === 'en-GB' ? (
          <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Volume2 className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 text-primary" />
        )}
      </button>
      <button 
        onClick={(e) => handlePlayTTS(e, 'en-US')}
        disabled={!!isPlaying}
        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md border transition-all active:scale-95 group/btn disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${isPlaying === 'en-US' ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_10px_rgba(114, 240, 180,0.3)]' : 'bg-white/5 text-content border-white/10 hover:bg-white/10 hover:text-white'}`}
        title={i18n.t("American English Pronunciation")}
      >
        <span className="text-xs leading-none">🇺🇸</span>
        <span className="text-[9px] font-mono uppercase tracking-wider">{i18n.t("US")}</span>
        {isPlaying === 'en-US' ? (
          <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Volume2 className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 text-primary" />
        )}
      </button>
    </div>
  );
};

export default TTSButtons;

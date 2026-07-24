import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import i18n from "i18next";
import { generateSpeech } from '../../services/elevenLabsService';

interface TTSButtonsProps {
  text: string;
}

const TTSButtons: React.FC<TTSButtonsProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const cleanText = text.replace(/<[^>]+>/g, '').trim();

  const playTTS = async (e: React.MouseEvent, lang: 'en-US' | 'en-GB') => {
    e.stopPropagation();
    if (!cleanText) return;
    
    setIsPlaying(lang);
    try {
      const audio = await generateSpeech(cleanText, lang);
      audio.onended = () => setIsPlaying(null);
      audio.onerror = () => setIsPlaying(null);
      await audio.play();
    } catch (err) {
      console.warn("Audio playback failed:", err);
      setIsPlaying(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={(e) => playTTS(e, 'en-GB')}
        disabled={!!isPlaying}
        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded transition-colors group/btn disabled:opacity-50 disabled:cursor-not-allowed ${isPlaying === 'en-GB' ? 'bg-primary/20 text-primary' : 'text-content-muted hover:bg-primary/10 hover:text-primary'}`}
        title={i18n.t("British English Pronunciation")}
      >
        <span className="text-[9px] uppercase tracking-wider">{i18n.t("UK")}</span>
        {isPlaying === 'en-GB' ? (
          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Volume2 className="w-3 h-3 opacity-60 group-hover/btn:opacity-100" />
        )}
      </button>
      <div className="w-px h-3 bg-white/10" />
      <button 
        onClick={(e) => playTTS(e, 'en-US')}
        disabled={!!isPlaying}
        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded transition-colors group/btn disabled:opacity-50 disabled:cursor-not-allowed ${isPlaying === 'en-US' ? 'bg-primary/20 text-primary' : 'text-content-muted hover:bg-primary/10 hover:text-primary'}`}
        title={i18n.t("American English Pronunciation")}
      >
        <span className="text-[9px] uppercase tracking-wider">{i18n.t("US")}</span>
        {isPlaying === 'en-US' ? (
          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Volume2 className="w-3 h-3 opacity-60 group-hover/btn:opacity-100" />
        )}
      </button>
    </div>
  );
};

export default TTSButtons;
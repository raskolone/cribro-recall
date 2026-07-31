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
    const audio = new Audio();
    audio.play().catch(() => {});
    
    try {
      const generatedAudio = await generateSpeech(cleanText, lang);
      audio.src = generatedAudio.src;
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
        className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all active:scale-95 group/btn disabled:opacity-50 disabled:cursor-not-allowed ${isPlaying === 'en-GB' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}
        title={i18n.t("British English Pronunciation")}
      >
        <span className="text-sm">🇬🇧</span>
        <span className="text-[10px] font-mono uppercase tracking-wider">{i18n.t("UK")}</span>
        {isPlaying === 'en-GB' ? (
          <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin inline-block ml-0.5" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 opacity-70 group-hover/btn:opacity-100 text-emerald-400" />
        )}
      </button>
      <button 
        onClick={(e) => playTTS(e, 'en-US')}
        disabled={!!isPlaying}
        className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all active:scale-95 group/btn disabled:opacity-50 disabled:cursor-not-allowed ${isPlaying === 'en-US' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}
        title={i18n.t("American English Pronunciation")}
      >
        <span className="text-sm">🇺🇸</span>
        <span className="text-[10px] font-mono uppercase tracking-wider">{i18n.t("US")}</span>
        {isPlaying === 'en-US' ? (
          <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin inline-block ml-0.5" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 opacity-70 group-hover/btn:opacity-100 text-cyan-400" />
        )}
      </button>
    </div>
  );
};

export default TTSButtons;
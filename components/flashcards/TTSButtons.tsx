import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface TTSButtonsProps {
  text: string;
}

const TTSButtons: React.FC<TTSButtonsProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const cleanText = text.replace(/<[^>]+>/g, '').trim();

  const playTTS = (e: React.MouseEvent, lang: string) => {
    e.stopPropagation();
    if (!cleanText) return;
    
    // Use the backend proxy for TTS which supports ElevenLabs and high-quality Google fallback
    const url = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${lang}`;
    const audio = new Audio(url);
    
    setIsPlaying(lang);
    
    audio.onended = () => setIsPlaying(null);
    audio.onerror = () => {
      setIsPlaying(null);
      // Fallback to local Web Speech API if backend completely fails
      const synth = window.speechSynthesis;
      if (synth) {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang;
        const voices = synth.getVoices();
        let voice = voices.find(v => (v.lang === lang || v.lang.replace('_', '-') === lang) && v.name.includes('Google'));
        if (!voice) voice = voices.find(v => v.lang === lang || v.lang.replace('_', '-') === lang);
        if (voice) utterance.voice = voice;
        synth.speak(utterance);
      }
    };
    
    audio.play().catch(err => {
      console.warn("Audio playback failed:", err);
      setIsPlaying(null);
    });
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={(e) => playTTS(e, 'en-GB')}
        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded transition-colors group/btn ${isPlaying === 'en-GB' ? 'bg-primary/20 text-primary' : 'text-content-muted hover:bg-primary/10 hover:text-primary'}`}
        title="British English Pronunciation"
      >
        <span className="text-[9px] uppercase tracking-wider">UK</span>
        <Volume2 className={`w-3 h-3 ${isPlaying === 'en-GB' ? 'opacity-100 animate-pulse' : 'opacity-60 group-hover/btn:opacity-100'}`} />
      </button>
      <div className="w-px h-3 bg-white/10" />
      <button 
        onClick={(e) => playTTS(e, 'en-US')}
        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded transition-colors group/btn ${isPlaying === 'en-US' ? 'bg-primary/20 text-primary' : 'text-content-muted hover:bg-primary/10 hover:text-primary'}`}
        title="American English Pronunciation"
      >
        <span className="text-[9px] uppercase tracking-wider">US</span>
        <Volume2 className={`w-3 h-3 ${isPlaying === 'en-US' ? 'opacity-100 animate-pulse' : 'opacity-60 group-hover/btn:opacity-100'}`} />
      </button>
    </div>
  );
};

export default TTSButtons;
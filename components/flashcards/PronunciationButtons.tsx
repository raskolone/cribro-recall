import React from 'react';
import { Volume2 } from 'lucide-react';
import i18n from "i18next";

export type PronunciationLang = 'en-GB' | 'en-US';

interface PronunciationButtonsProps {
  /** Który akcent właśnie gra (spinner na przycisku). */
  playing: PronunciationLang | null;
  onPlay: (e: React.MouseEvent, lang: PronunciationLang) => void;
  /** Blokada przycisków (TTSButtons blokuje je na czas odtwarzania). */
  disabled?: boolean;
}

/**
 * Wygląd przycisków wymowy UK/US w rogu karty — czysto prezentacyjny, bez TTS.
 * Używają go TTSButtons (moduł fiszek, playSpeech) i rozgrzewka (natywne speechSynthesis).
 */
const PronunciationButtons: React.FC<PronunciationButtonsProps> = ({ playing, onPlay, disabled = false }) => {
  // Strefa kliknięcia na dotyku ≥ 44 px bez zmiany wyglądu: niewidoczny ::before wystaje poza chip.
  const hit = "relative pointer-coarse:before:content-[''] pointer-coarse:before:absolute pointer-coarse:before:-inset-x-1 pointer-coarse:before:-inset-y-[11px]";
  const base = `flex items-center gap-1 text-[12px] font-bold px-1.5 py-1 rounded-md border transition-all active:scale-95 group/btn disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${hit}`;
  const active = 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_10px_rgba(114, 240, 180,0.3)]';
  const idle = 'bg-white/5 text-content border-white/10 hover:bg-white/10 hover:text-white';
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button 
        type="button"
        data-lang="en-GB"
        onClick={(e) => onPlay(e, 'en-GB')}
        disabled={disabled}
        className={`${base} ${playing === 'en-GB' ? active : idle}`}
        title={i18n.t("British English Pronunciation")}
      >
        <span className="text-xs leading-none">🇬🇧</span>
        <span className="text-[12px] font-mono uppercase tracking-wider">{i18n.t("UK")}</span>
        {playing === 'en-GB' ? (
          <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Volume2 className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 text-primary" />
        )}
      </button>
      <button 
        type="button"
        data-lang="en-US"
        onClick={(e) => onPlay(e, 'en-US')}
        disabled={disabled}
        className={`${base} ${playing === 'en-US' ? active : idle}`}
        title={i18n.t("American English Pronunciation")}
      >
        <span className="text-xs leading-none">🇺🇸</span>
        <span className="text-[12px] font-mono uppercase tracking-wider">{i18n.t("US")}</span>
        {playing === 'en-US' ? (
          <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Volume2 className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 text-primary" />
        )}
      </button>
    </div>
  );
};

export default PronunciationButtons;

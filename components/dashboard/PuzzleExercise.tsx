import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { getAudioPronunciation } from '../../services/geminiService';
import i18n from "i18next";

gsap.registerPlugin(useGSAP);

const CuteMascot = ({ state }: { state: 'idle' | 'happy' | 'error' | 'thinking' }) => {
  return (
    <div className="absolute -top-12 right-0 md:-right-16 w-24 h-24 pointer-events-none z-0 opacity-80 md:opacity-100 hidden sm:block">
      <motion.div
        animate={{ 
          y: state === 'happy' ? [0, -15, 0] : state === 'error' ? [0, 5, -5, 0] : [0, -4, 0],
          rotate: state === 'happy' ? [0, -15, 15, 0] : state === 'error' ? [0, -10, 10, 0] : [0, 2, -2, 0],
          scale: state === 'happy' ? [1, 1.1, 1] : 1
        }}
        transition={{
          repeat: state === 'idle' || state === 'thinking' ? Infinity : 0,
          duration: state === 'happy' ? 0.6 : state === 'error' ? 0.4 : 3,
          ease: "easeInOut"
        }}
        className="w-full h-full"
      >
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_10px_20px_rgba(52,211,153,0.3)]">
          {/* Main Body - Liquid Blob */}
          <motion.path 
            d="M 60,10 C 90,10 110,30 110,60 C 110,90 85,110 60,110 C 35,110 10,90 10,60 C 10,30 30,10 60,10 Z"
            fill="url(#bodyGradient)"
            animate={{
              d: state === 'idle' || state === 'thinking' 
                ? [
                    "M 60,10 C 90,10 110,30 110,60 C 110,90 85,110 60,110 C 35,110 10,90 10,60 C 10,30 30,10 60,10 Z",
                    "M 60,15 C 85,10 115,35 105,65 C 95,95 85,105 60,110 C 30,115 15,90 15,60 C 15,25 35,15 60,15 Z",
                    "M 60,10 C 90,10 110,30 110,60 C 110,90 85,110 60,110 C 35,110 10,90 10,60 C 10,30 30,10 60,10 Z"
                  ]
                : "M 60,10 C 90,10 110,30 110,60 C 110,90 85,110 60,110 C 35,110 10,90 10,60 C 10,30 30,10 60,10 Z"
            }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Eyes */}
          <g transform="translate(0, -5)">
            {/* Left Eye */}
            <circle cx="45" cy="55" r="7" fill="#0f172a" />
            <circle cx="47" cy="53" r="2.5" fill="white" />
            
            {/* Right Eye */}
            <circle cx="75" cy="55" r="7" fill="#0f172a" />
            <circle cx="77" cy="53" r="2.5" fill="white" />

            {/* Happy Eyes Overlay */}
            <motion.g 
              initial={{ opacity: 0 }}
              animate={{ opacity: state === 'happy' ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M 38 55 Q 45 45 52 55" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
              <path d="M 68 55 Q 75 45 82 55" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            </motion.g>

            {/* Error Eyes Overlay */}
            <motion.g 
              initial={{ opacity: 0 }}
              animate={{ opacity: state === 'error' ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M 40 50 L 50 60 M 50 50 L 40 60" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
              <path d="M 70 50 L 80 60 M 80 50 L 70 60" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            </motion.g>
          </g>

          {/* Mouth */}
          <motion.path 
            d={
              state === 'happy' ? "M 45 70 Q 60 85 75 70" :
              state === 'error' ? "M 50 75 Q 60 65 70 75" :
              state === 'thinking' ? "M 55 70 Q 60 70 65 70" :
              "M 50 70 Q 60 75 70 70"
            } 
            fill="none" 
            stroke="#0f172a" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            animate={{
              d: state === 'happy' ? "M 45 70 Q 60 85 75 70" :
                 state === 'error' ? "M 50 75 Q 60 65 70 75" :
                 state === 'thinking' ? "M 55 70 Q 60 70 65 70" :
                 "M 50 70 Q 60 75 70 70"
            }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </motion.div>
    </div>
  );
};

interface PuzzleExerciseProps {
  sentence: string;
  level: string;
  currentAnswer: string;
  onAnswerChange: (answer: string) => void;
}

const TILE_COLORS = [
  'bg-blue-500/20 border-blue-400/30 text-blue-50 hover:bg-blue-400/30',
  'bg-purple-500/20 border-purple-400/30 text-purple-50 hover:bg-purple-400/30',
  'bg-teal-500/20 border-teal-400/30 text-teal-50 hover:bg-teal-400/30',
  'bg-amber-500/20 border-amber-400/30 text-amber-50 hover:bg-amber-400/30',
  'bg-pink-500/20 border-pink-400/30 text-pink-50 hover:bg-pink-400/30',
  'bg-indigo-500/20 border-indigo-400/30 text-indigo-50 hover:bg-indigo-400/30',
];

interface TileData {
  id: string;
  text: string;
  isCorrect: boolean;
  colorClass: string;
}

const PuzzleExercise: React.FC<PuzzleExerciseProps> = ({ sentence, level, currentAnswer, onAnswerChange }) => {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [selectedTiles, setSelectedTiles] = useState<TileData[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorTileId, setErrorTileId] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<'idle' | 'happy' | 'error' | 'thinking'>('idle');
  
  const lastClickedRects = useRef<Record<string, DOMRect>>({});
  const answerTileRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useGSAP(() => {
    selectedTiles.forEach((st) => {
      const el = answerTileRefs.current[st.id];
      const startRect = lastClickedRects.current[st.id];
      
      if (el && startRect && !el.dataset.animated) {
        el.dataset.animated = 'true';
        
        const endRect = el.getBoundingClientRect();
        
        const deltaX = startRect.left - endRect.left;
        const deltaY = startRect.top - endRect.top;
        
        gsap.set(el, {
          x: deltaX,
          y: deltaY,
          opacity: 1,
          scale: 1,
          transformOrigin: "center center"
        });

        const duration = 0.55;

        // X movement with a smooth in-out for the arc
        gsap.to(el, {
          x: 0,
          duration: duration,
          ease: "power2.inOut"
        });

        // Y movement with a slight overshoot for a natural settle
        gsap.to(el, {
          y: 0,
          duration: duration,
          ease: "back.out(1.2)",
          onComplete: () => {
            gsap.set(el, { clearProps: "all" });
          }
        });

        // The "Genie" squish effect - warp dimensions during flight
        gsap.to(el, {
          scaleX: 0.7,
          scaleY: 1.2,
          rotation: deltaX > 0 ? -8 : 8,
          duration: duration * 0.45,
          yoyo: true,
          repeat: 1,
          ease: "power1.inOut"
        });
        
        delete lastClickedRects.current[st.id];
      }
    });
  }, { dependencies: [selectedTiles] });
    
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const playAudio = async (text: string, lang: string = 'en-US') => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
      if (!res.ok) throw new Error('Audio generation failed');
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Empty audio blob');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      
      audio.play().catch(err => {
        console.warn("Audio playback failed:", err);
        setIsPlayingAudio(false);
      });
    } catch (err) {
      console.error(err);
      setIsPlayingAudio(false);
    }
  };

  
  const playSentence = (accent: 'en-GB' | 'en-US') => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence as string);
    utterance.lang = accent;
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang === accent || v.lang.startsWith(accent));
    if (targetVoice) {
      utterance.voice = targetVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const answerAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentence || typeof sentence !== 'string') {
      setTiles([]);
      setSelectedTiles([]);
      setIsCompleted(false);
      return;
    }

    const semanticChunking = (sentence: string): string[] => {
      const words = sentence.trim().split(/\s+/);
      const chunks: string[] = [];
      let currentChunk: string[] = [];
      
      const dontBreakAfter = new Set([
        'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those',
        'of', 'very', 'not', 'no', 'to', 'in', 'on', 'at', 'with', 'about', 'by', 'from', 'as', 'into', 'like', 'for'
      ]);

      const phrasalVerbParticles = new Set([
        'up', 'down', 'out', 'in', 'on', 'off', 'over', 'away', 'back', 'through', 'along', 'forward'
      ]);
      
      const phraseStarters = new Set([
        'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those',
        'in', 'on', 'at', 'to', 'for', 'with', 'about', 'by', 'from', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
        'and', 'but', 'or', 'so', 'because', 'although', 'if', 'when', 'while', 'which', 'who', 'where',
        'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must'
      ]);

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
        const nextWord = i < words.length - 1 ? words[i + 1] : null;
        const cleanNextWord = nextWord ? nextWord.replace(/[^a-zA-Z]/g, '').toLowerCase() : '';
        
        currentChunk.push(word);
        
        const hasPunctuation = /[.,!?;:]$/.test(word);
        
        let shouldBreak = false;
        
        if (hasPunctuation) {
          shouldBreak = true;
        } else if (phrasalVerbParticles.has(cleanNextWord)) {
          // Keep phrasal verbs together
          shouldBreak = false;
        } else if (dontBreakAfter.has(cleanWord)) {
          // Don't break after articles/prepositions
          shouldBreak = false;
        } else if (phraseStarters.has(cleanNextWord)) {
          // Break before new phrases, prepositions, pronouns, verbs
          shouldBreak = true;
        } else if (currentChunk.length >= 2) {
          // Break every 2-3 words otherwise to keep fragments small
          shouldBreak = true;
        }

        if (shouldBreak) {
          if (i !== words.length - 1) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
          }
        }
      }
      
      if (currentChunk.length > 0) {
        if (currentChunk.length <= 1 && chunks.length > 0) {
           chunks[chunks.length - 1] += ' ' + currentChunk[0];
        } else {
           chunks.push(currentChunk.join(' '));
        }
      }
      
      return chunks;
    };

    const chunks = semanticChunking(sentence);
    
    const initialTiles = chunks.map((chunk, idx) => ({
      id: `tile-${idx}-${chunk.replace(/[^a-zA-Z0-9]/g, '')}`,
      text: chunk,
      isCorrect: false,
      colorClass: TILE_COLORS[idx % TILE_COLORS.length]
    }));
    
    const shuffled = [...initialTiles].sort(() => Math.random() - 0.5);
    setTiles(shuffled);
    setSelectedTiles([]);
    setIsCompleted(false);
    onAnswerChange('');
  }, [sentence, level]);

  useEffect(() => {
    if (!sentence || typeof sentence !== 'string') {
      setIsCompleted(false);
      return;
    }
    const currentText = selectedTiles.map(t => t.text).join(' ');
    if (currentText === sentence.trim() && selectedTiles.length > 0) {
      setIsCompleted(true);
    } else {
      setIsCompleted(false);
    }
  }, [selectedTiles, sentence]);

  const handleTileClick = (tile: TileData, e: React.MouseEvent<HTMLButtonElement>) => {
    if (tile.isCorrect || isCompleted) return;
    
    const nextExpectedString = selectedTiles.map(t => t.text).join(' ') + (selectedTiles.length > 0 ? ' ' : '') + tile.text;
    
    if (sentence.startsWith(nextExpectedString)) {
      lastClickedRects.current[tile.id] = e.currentTarget.getBoundingClientRect();
      setTiles(prev => prev.map(t => t.id === tile.id ? { ...t, isCorrect: true } : t));
      const newSelected = [...selectedTiles, { ...tile }];
      setSelectedTiles(newSelected);
      onAnswerChange(newSelected.map(t => t.text).join(' '));
      setErrorTileId(null);
      setMascotState('happy');
      setTimeout(() => setMascotState(prev => prev === 'happy' ? 'idle' : prev), 800);
    } else {
      setErrorTileId(tile.id);
      setMascotState('error');
      setTimeout(() => setErrorTileId(null), 500);
      setTimeout(() => setMascotState(prev => prev === 'error' ? 'idle' : prev), 800);
    }
  };

  const handleRemoveTile = (tile: TileData, index: number) => {
    if (isCompleted) return;
    
    // Cannot remove inner tiles to not break sequence, only last
    if (index === selectedTiles.length - 1) {
      const newSelected = selectedTiles.slice(0, -1);
      setSelectedTiles(newSelected);
      setTiles(prev => prev.map(t => t.id === tile.id ? { ...t, isCorrect: false } : t));
      onAnswerChange(newSelected.map(t => t.text).join(' '));
    }
  };

  return (
    <div className="space-y-4 relative max-w-4xl mx-auto mt-4" ref={containerRef}>
      <CuteMascot state={mascotState} />
      
      {/* Answer Area */}
      <div 
        ref={answerAreaRef}
        className={`min-h-[80px] p-4 bg-base-300 border rounded-xl flex flex-wrap gap-2 items-center relative transition-all duration-500 z-10 ${
          isCompleted ? 'border-primary/50 bg-primary/5 shadow-[0_0_30px_rgba(114,240,180,0.4)]' : 'border-base-200'
        }`}
      >
        {isCompleted && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 rounded-xl bg-primary/20 pointer-events-none"
            transition={{
              duration: 1,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
          />
        )}
        
        {selectedTiles.length === 0 && (
          <span className="text-content-muted text-sm italic absolute left-4 pointer-events-none">{i18n.t("Ułóż zdanie z kafelków...")}</span>
        )}
        
        <>
          {selectedTiles.map((st, idx) => (
            <button
              ref={(el) => {
                answerTileRefs.current[st.id] = el;
              }}
              key={st.id + '-ans'}
              type="button"
              onClick={() => handleRemoveTile(st, idx)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm z-20 backdrop-blur-md ${
                isCompleted 
                  ? 'bg-primary text-black border border-primary/50 cursor-default' 
                  : `${st.colorClass} border hover:bg-red-500/80 hover:text-white hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.6)] cursor-pointer`
              }`}
            >
              {st.text}
            </button>
          ))}
        </>
        {isCompleted && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-30 bg-base-100/80 p-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-lg animate-in fade-in zoom-in duration-300">
            <button onClick={(e) => { e.stopPropagation(); playAudio(sentence, 'en-US'); }} className={`text-lg hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title={i18n.t("🇺🇸 Amerykański")} disabled={isPlayingAudio}>🇺🇸</button>
            <button onClick={(e) => { e.stopPropagation(); playAudio(sentence, 'en-GB'); }} className={`text-lg hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title={i18n.t("🇬🇧 Brytyjski")} disabled={isPlayingAudio}>🇬🇧</button>
          </div>
        )}
      </div>

      {/* Available Tiles */}
      <div className="flex flex-wrap gap-3 justify-center p-4 min-h-[120px]">
        <>
          {tiles.filter(t => !t.isCorrect).map((tile) => {
            const isError = errorTileId === tile.id;
                        
            return (
              <button
                key={tile.id}
                id={tile.id}
                type="button"
                onClick={(e) => handleTileClick(tile, e)}
                onContextMenu={(e) => { e.preventDefault(); playAudio(tile.text); }}
                disabled={isCompleted}
                
                className={`px-5 py-2.5 rounded-xl font-bold text-sm md:text-base shadow-sm backdrop-blur-md border z-10
                  ${isError 
                    ? 'bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.9)] scale-105' 
                    : `${tile.colorClass} hover:scale-105 hover:-translate-y-1 hover:shadow-lg cursor-pointer active:scale-95 transition-colors duration-200`
                  }`}
              >
                {tile.text}
              </button>
            );
          })}
        </>
      </div>
      
      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-center text-primary font-bold text-3xl drop-shadow-[0_0_25px_rgba(114,240,180,0.8)] pt-4"
        >
          
                            {i18n.t("Świetnie! Całe zdanie ułożone.")}
                          </motion.div>
      )}

      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-3 mt-4"
        >
          <p className="text-content-muted text-sm uppercase tracking-widest">{i18n.t("Przeczytaj zdanie")}</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => playSentence('en-GB')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-base-300 hover:bg-base-200 transition-colors shadow-sm"
              title={i18n.t("Wymowa brytyjska")}
            >
              <span className="text-xl">🇬🇧</span>
              <span className="font-bold text-sm">BrE</span>
            </button>
            <button
              onClick={() => playSentence('en-US')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-base-300 hover:bg-base-200 transition-colors shadow-sm"
              title={i18n.t("Wymowa amerykańska")}
            >
              <span className="text-xl">🇺🇸</span>
              <span className="font-bold text-sm">AmE</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PuzzleExercise;

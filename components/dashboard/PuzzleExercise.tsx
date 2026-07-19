import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { getAudioPronunciation } from '../../services/geminiService';

gsap.registerPlugin(useGSAP);

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
        
        gsap.fromTo(
          el,
          { 
            x: deltaX, 
            y: deltaY, 
            opacity: 0,
            scale: 0.8,
            rotation: (Math.random() - 0.5) * 15 
          },
          { 
            x: 0, 
            y: 0, 
            opacity: 1,
            scale: 1,
            rotation: 0,
            duration: 0.6, 
            ease: 'back.out(1.4)',
            clearProps: "all"
          }
        );
        
        delete lastClickedRects.current[st.id];
      }
    });
  }, { dependencies: [selectedTiles] });
    
  const playAudio = async (text: string) => {
    try {
      const audioData = await getAudioPronunciation(text, 'en');
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audio.play();
    } catch (e) {
      console.error(e);
    }
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
      
      // Słowa, przed którymi najlepiej łamać frazę
      const breakBefore = new Set([
        'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those',
        'in', 'on', 'at', 'to', 'for', 'with', 'about', 'by', 'from', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
        'and', 'but', 'or', 'so', 'because', 'although', 'if', 'when', 'while', 'which', 'who', 'where',
        'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must'
      ]);

      // Słowa, po których lepiej nie łamać frazy, tylko dołączyć następne słowo
      const dontBreakAfter = new Set([
        'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those',
        'of', 'very', 'not', 'no', 'to', 'in', 'on', 'at'
      ]);

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
        const nextWord = i < words.length - 1 ? words[i + 1] : null;
        const cleanNextWord = nextWord ? nextWord.replace(/[^a-zA-Z]/g, '').toLowerCase() : '';
        
        currentChunk.push(word);
        
        const hasPunctuation = /[.,!?;:]$/.test(word);
        const shouldBreakBeforeNext = breakBefore.has(cleanNextWord);
        const shouldNotBreakAfterCurrent = dontBreakAfter.has(cleanWord);
        
        let shouldBreak = false;
        
        if (hasPunctuation) {
          shouldBreak = true;
        } else if (currentChunk.length >= 2 && shouldBreakBeforeNext && !shouldNotBreakAfterCurrent) {
          shouldBreak = true;
        } else if (currentChunk.length >= 4) { // Hard limit 4-5 words
          // Try to wait for a better break point if we are at a "dont break after" word
          if (!shouldNotBreakAfterCurrent) {
             shouldBreak = true;
          } else if (currentChunk.length >= 5) {
             shouldBreak = true;
          }
        }
        
        // Specjalne dostrojenie dla prepozycji takich jak "of" – chcemy, by tworzyły zbitki typu "value of"
        if (cleanNextWord === 'of' && currentChunk.length >= 2) {
           shouldBreak = false; // "the hidden value" + "of", don't break yet, keep "the hidden value of"
        } else if (cleanWord === 'of' && currentChunk.length >= 2) {
           shouldBreak = true; // after "of", break! "the hidden value of" -> BREAK
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
    } else {
      setErrorTileId(tile.id);
      setTimeout(() => setErrorTileId(null), 500);
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
    <div className="space-y-4 relative" ref={containerRef}>
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
          <span className="text-content-muted text-sm italic absolute left-4 pointer-events-none">Ułóż zdanie z kafelków...</span>
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
          Świetnie! Całe zdanie ułożone.
        </motion.div>
      )}
    </div>
  );
};

export default PuzzleExercise;

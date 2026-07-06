import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';

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
  const [correctFlashingTileId, setCorrectFlashingTileId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const answerAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Combine 2-3 words together for all levels to reduce the number of separate elements
    const words = sentence.trim().split(/\s+/);
    let chunks: string[] = [];
    
    for (let i = 0; i < words.length; ) {
      const chunkLen = (words[i].length % 2) + 2; // 2 or 3 words
      const chunk = words.slice(i, i + chunkLen).join(' ');
      chunks.push(chunk);
      i += chunkLen;
    }
    
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
    const currentText = selectedTiles.map(t => t.text).join(' ');
    if (currentText === sentence.trim() && selectedTiles.length > 0) {
      setIsCompleted(true);
    } else {
      setIsCompleted(false);
    }
  }, [selectedTiles, sentence]);

  const handleTileClick = (tile: TileData) => {
    if (tile.isCorrect || isCompleted || correctFlashingTileId) return;
    
    const nextExpectedString = selectedTiles.map(t => t.text).join(' ') + (selectedTiles.length > 0 ? ' ' : '') + tile.text;
    
    if (sentence.startsWith(nextExpectedString)) {
      setCorrectFlashingTileId(tile.id);
      setTimeout(() => {
        setCorrectFlashingTileId(null);
        setTiles(prev => prev.map(t => t.id === tile.id ? { ...t, isCorrect: true } : t));
        const newSelected = [...selectedTiles, { ...tile }];
        setSelectedTiles(newSelected);
        onAnswerChange(newSelected.map(t => t.text).join(' '));
        setErrorTileId(null);
      }, 400); // Wait for the green flash/shake animation
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
        
        <AnimatePresence>
          {selectedTiles.map((st, idx) => (
            <motion.button
              layoutId={st.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
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
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Available Tiles */}
      <div className="flex flex-wrap gap-3 justify-center p-4 min-h-[120px]">
        <AnimatePresence>
          {tiles.filter(t => !t.isCorrect).map((tile) => {
            const isError = errorTileId === tile.id;
            const isFlashingCorrect = correctFlashingTileId === tile.id;
            
            return (
              <motion.button
                layoutId={tile.id}
                key={tile.id}
                type="button"
                onClick={() => handleTileClick(tile)}
                disabled={isCompleted || correctFlashingTileId !== null}
                animate={
                  isError ? { x: [-10, 10, -10, 10, 0] } :
                  isFlashingCorrect ? { y: [-5, 5, -5, 5, 0], scale: 1.05 } : 
                  { x: 0, y: 0, scale: 1 }
                }
                transition={
                  isError ? { duration: 0.4 } : 
                  isFlashingCorrect ? { duration: 0.4 } :
                  { type: "spring", stiffness: 400, damping: 25 }
                }
                className={`px-5 py-2.5 rounded-xl font-bold text-sm md:text-base shadow-sm transition-all duration-300 backdrop-blur-md border
                  ${isError 
                    ? 'bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.9)] z-10 scale-105' 
                    : isFlashingCorrect
                      ? 'bg-primary text-black border-primary/50 shadow-[0_0_20px_rgba(114,240,180,0.9)] z-10'
                      : `${tile.colorClass} hover:scale-105 hover:-translate-y-1 hover:shadow-lg cursor-pointer active:scale-95`
                  }`}
              >
                {tile.text}
              </motion.button>
            );
          })}
        </AnimatePresence>
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

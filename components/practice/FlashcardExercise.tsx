
import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Word } from '../../types';
import Button from '../ui/Button';

import { useVocabulary } from '../../context/VocabularyContext';

interface FlashcardExerciseProps {
  words: Word[];
  onExit: () => void;
  onComplete: () => void;
}

const FlashcardExercise: React.FC<FlashcardExerciseProps> = ({ words, onExit, onComplete }) => {
  const { updateWordSpacedRepetition } = useVocabulary();
  const shuffledWords = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const currentWord = shuffledWords[currentIndex];

  useEffect(() => {
    if (isFinished) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isFinished]);

  const handleResponse = (isCorrect: boolean) => {
    updateWordSpacedRepetition(currentWord.id, isCorrect);
    setResults(prev => ({ ...prev, [currentWord.id]: isCorrect }));
    
    if (currentIndex === shuffledWords.length - 1) {
      setIsFinished(true);
      onComplete();
    } else {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };
  
  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + shuffledWords.length) % shuffledWords.length);
  };

  if (isFinished) {
    const correctCount = Object.values(results).filter(Boolean).length;
    return (
      <div className="text-center p-8 bg-base-200/40 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">Flashcards Complete!</h2>
          <p className="text-lg mb-2">You've reviewed all {shuffledWords.length} words.</p>
          <p className="text-sm text-content-muted mb-6">Accuracy: {Math.round((correctCount / shuffledWords.length) * 100)}%</p>
          <div className="flex gap-4 justify-center">
              <Button onClick={() => { setIsFinished(false); setCurrentIndex(0); setResults({}); }}>Review Again</Button>
              <Button onClick={onExit} variant="secondary">Exit</Button>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Flashcards</h2>
            <Button onClick={onExit} variant="ghost">Exit</Button>
        </div>
        
        <div
          className="relative w-full h-80 cursor-pointer transition-transform duration-500"
          onClick={() => setIsFlipped(!isFlipped)}
          style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front of card */}
          <div className="absolute w-full h-full flex items-center justify-center p-6 backface-hidden bg-base-200/40 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl">
            <h3 className="text-4xl font-bold text-primary">{currentWord.word}</h3>
          </div>
          {/* Back of card */}
          <div className="absolute w-full h-full p-6 backface-hidden bg-primary/40 backdrop-blur-xl border border-white/20 text-white rounded-xl shadow-2xl flex flex-col justify-center text-center" style={{ transform: 'rotateY(180deg)' }}>
            <p className="text-xl font-semibold">{currentWord.definition}</p>
            <p className="mt-4 text-base italic opacity-80">"{currentWord.example}"</p>
          </div>
        </div>
        
        <p className="text-center mt-4 text-gray-500">
          Card {currentIndex + 1} of {shuffledWords.length}
        </p>

        <div className="flex justify-between mt-8 gap-4">
          <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0}>Previous</Button>
          <div className="flex gap-4">
            <Button variant="secondary" className="bg-red-500/20 hover:bg-red-500/40 border-red-500/50 text-red-500" onClick={() => handleResponse(false)}>
              Need Practice
            </Button>
            <Button className="bg-green-500/20 hover:bg-green-500/40 border-green-500/50 text-green-500" onClick={() => handleResponse(true)}>
              Got It!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardExercise;

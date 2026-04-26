
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
  
  // Multiple choice state
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const currentWord = shuffledWords[currentIndex];

  useEffect(() => {
    if (!isFinished && currentWord) {
      const correctOption = currentWord.definition;
      const wrongOptions = words
        .filter(w => w.id !== currentWord.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.definition);
      
      setOptions([correctOption, ...wrongOptions].sort(() => Math.random() - 0.5));
      setSelectedAnswer(null);
      setIsFlipped(false);
    }
  }, [currentIndex, isFinished, currentWord, words]);

  useEffect(() => {
    if (isFinished) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isFinished]);

  const handleAnswer = (option: string) => {
    if (selectedAnswer) return; // Prevent multiple submissions
    
    setSelectedAnswer(option);
    const isCorrect = option === currentWord.definition;
    
    // Provide visual feedback by flipping the card to show back content
    setIsFlipped(true);

    updateWordSpacedRepetition(currentWord.id, isCorrect);
    setResults(prev => ({ ...prev, [currentWord.id]: isCorrect }));
    
    // Automatically advance after a delay so they can see the visual feedback
    setTimeout(() => {
      if (currentIndex === shuffledWords.length - 1) {
        setIsFinished(true);
        onComplete();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }, isCorrect ? 1500 : 3000);
  };
  
  const handlePrev = () => {
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
          className="relative w-full h-80 transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front of card */}
          <div className="absolute w-full h-full flex items-center justify-center p-6 backface-hidden bg-base-200/40 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl">
            <h3 className="text-4xl font-bold text-primary">{currentWord?.word}</h3>
          </div>
          {/* Back of card */}
          <div className="absolute w-full h-full p-6 backface-hidden bg-primary/40 backdrop-blur-xl border border-white/20 text-white rounded-xl shadow-2xl flex flex-col justify-center text-center" style={{ transform: 'rotateY(180deg)' }}>
            <p className="text-xl font-semibold">{currentWord?.definition}</p>
            <p className="mt-4 text-base italic opacity-80">"{currentWord?.example}"</p>
          </div>
        </div>
        
        <p className="text-center mt-4 text-gray-500">
          Card {currentIndex + 1} of {shuffledWords.length}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3">
          {options.map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const isCorrectAnswer = option === currentWord?.definition;
            
            let btnClass = "bg-base-200/40 hover:bg-base-200/60 border-white/10 text-left";
            
            // Visual feedback after submission
            if (selectedAnswer) {
              if (isSelected) {
                btnClass = isCorrectAnswer 
                  ? 'bg-green-500 text-white border-green-500 ring-2 ring-green-400' 
                  : 'bg-red-500 text-white border-red-500';
              } else if (isCorrectAnswer) {
                // Highlight the correct answer if the user chose incorrectly
                btnClass = 'bg-green-500 text-white border-green-500 ring-2 ring-green-400 animate-pulse';
              } else {
                btnClass = 'opacity-50 cursor-not-allowed';
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(option)}
                disabled={!!selectedAnswer}
                className={`w-full p-4 rounded-lg border-2 transition-all duration-300 ${btnClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between mt-8">
          <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0 || !!selectedAnswer}>Previous</Button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardExercise;

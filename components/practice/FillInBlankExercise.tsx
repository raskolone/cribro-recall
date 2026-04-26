
import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Word } from '../../types';
import Button from '../ui/Button';

import { useVocabulary } from '../../context/VocabularyContext';

interface FillInBlankExerciseProps {
  words: Word[];
  onExit: () => void;
  onComplete: () => void;
}

const FillInBlankExercise: React.FC<FillInBlankExerciseProps> = ({ words, onExit, onComplete }) => {
  const { updateWordSpacedRepetition } = useVocabulary();
  const [practiceQueue, setPracticeQueue] = useState<Word[]>(() => [...words].sort(() => Math.random() - 0.5));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [firstAttempts, setFirstAttempts] = useState<Record<string, boolean>>({});
  const [isFinished, setIsFinished] = useState(false);
  
  const currentWord = practiceQueue[currentIndex];
  const sentenceParts = currentWord ? currentWord.example.split(new RegExp(`\\b${currentWord.word}\\b`, 'i')) : ['', ''];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitted) return;
    
    const correct = inputValue.trim().toLowerCase() === currentWord.word.toLowerCase();
    setIsSubmitted(true);
    setIsCorrect(correct);
    
    if (correct && firstAttempts[currentWord.id] === undefined) {
      setScore(s => s + 1);
    }

    if (firstAttempts[currentWord.id] === undefined) {
      setFirstAttempts(prev => ({ ...prev, [currentWord.id]: correct }));
    }

    // Update Spaced Repetition
    updateWordSpacedRepetition(currentWord.id, correct);
  };
  
  const handleNext = () => {
    let newQueue = practiceQueue;
    // If incorrect, add word to the end of the queue to be repeated later
    if (!isCorrect) {
      newQueue = [...practiceQueue, practiceQueue[currentIndex]];
      setPracticeQueue(newQueue);
    }

    if (currentIndex < newQueue.length - 1) {
      setCurrentIndex(i => i + 1);
      setInputValue('');
      setIsSubmitted(false);
      setIsCorrect(false);
    } else {
      setIsFinished(true);
      onComplete();
    }
  };

  const restart = () => {
    setPracticeQueue([...words].sort(() => Math.random() - 0.5));
    setFirstAttempts({});
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setInputValue('');
    setIsSubmitted(false);
    setIsCorrect(false);
  };

  useEffect(() => {
    if (isFinished) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isFinished]);
  
  if (isFinished) {
    return (
      <div className="text-center p-8 bg-base-200/40 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">Exercise Complete!</h2>
          <p className="text-lg mb-6">Your score: <span className="font-bold text-primary">{score} / {words.length}</span></p>
          <div className="flex gap-4 justify-center">
              <Button onClick={restart}>Try Again</Button>
              <Button onClick={onExit} variant="secondary">Exit</Button>
          </div>
      </div>
    )
  }

  if (!currentWord) return null;

  return (
    <div className="p-4 max-w-3xl mx-auto">
       <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Fill in the Blank</h2>
        <p className="font-semibold text-content-muted">
           Progress: {Math.min(currentIndex + 1, practiceQueue.length)} / {practiceQueue.length} <span className="ml-4 text-white">Score: {score}</span>
        </p>
      </div>
      <div className="bg-base-200/40 backdrop-blur-xl border border-white/20 p-6 rounded-lg shadow-2xl transition-all duration-300">
        <p className="text-lg text-center mb-2">Complete the sentence:</p>
        <p className="text-center text-gray-600 mb-8">(Hint: the word means "{currentWord.definition}")</p>

        <div className="text-2xl text-center flex flex-wrap justify-center items-center gap-2 font-medium">
            <span>{sentenceParts[0]}</span>
            <form onSubmit={handleSubmit} className="inline-block relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isSubmitted}
                    autoFocus
                    className={`w-36 text-center border-b-4 bg-transparent focus:outline-none transition-all duration-300 rounded-lg ${
                        isSubmitted 
                          ? (isCorrect 
                              ? 'border-green-500 bg-green-500/10 shadow-[0_0_25px_rgba(34,197,94,0.5)] ring-2 ring-green-400/50 scale-105' 
                              : 'border-red-500 bg-red-500/10 shadow-[0_0_25px_rgba(239,68,68,0.5)] ring-2 ring-red-400/50 animate-shake') 
                          : 'border-gray-400 focus:border-primary focus:bg-primary/5 focus:shadow-[0_0_20px_rgba(var(--color-primary),0.2)]'
                    }`}
                    style={{ minWidth: `${Math.max(currentWord.word.length * 0.8, 5)}em`, padding: '4px 8px' }}
                />
            </form>
            <span>{sentenceParts.slice(1).join(currentWord.word)}</span>
        </div>

        <div className="mt-12 flex justify-center min-h-[5rem]">
            {!isSubmitted ? (
                <Button onClick={handleSubmit} disabled={!inputValue.trim()}>Check Answer</Button>
            ) : (
                <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {isCorrect ? (
                        <p className="text-green-500 font-bold text-xl drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]">Correct!</p>
                    ) : (
                        <p className="text-red-500 font-bold text-xl drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                            Not quite. The correct answer is: <strong className="underline decoration-2 underline-offset-4 decoration-red-400">{currentWord.word}</strong>
                        </p>
                    )}
                    <Button onClick={handleNext} autoFocus className="mt-4">
                      {currentIndex === practiceQueue.length - 1 && isCorrect ? 'Finish' : 'Next'}
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FillInBlankExercise;

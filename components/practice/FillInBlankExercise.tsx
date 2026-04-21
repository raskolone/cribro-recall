
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
  const shuffledWords = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const currentWord = shuffledWords[currentIndex];
  const sentenceParts = currentWord.example.split(new RegExp(`\\b${currentWord.word}\\b`, 'i'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const correct = inputValue.trim().toLowerCase() === currentWord.word.toLowerCase();
    setIsSubmitted(true);
    setIsCorrect(correct);
    if (correct) {
      setScore(s => s + 1);
    }

    // Update Spaced Repetition
    updateWordSpacedRepetition(currentWord.id, correct);
  };
  
  const handleNext = () => {
    if (currentIndex < shuffledWords.length - 1) {
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
          <p className="text-lg mb-6">Your score: <span className="font-bold text-primary">{score} / {shuffledWords.length}</span></p>
          <div className="flex gap-4 justify-center">
              <Button onClick={restart}>Try Again</Button>
              <Button onClick={onExit} variant="secondary">Exit</Button>
          </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
       <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Fill in the Blank</h2>
        <p className="font-semibold">Score: {score}</p>
      </div>
      <div className="bg-base-200/40 backdrop-blur-xl border border-white/20 p-6 rounded-lg shadow-2xl">
        <p className="text-lg text-center mb-2">Complete the sentence:</p>
        <p className="text-center text-gray-600 mb-6">(Hint: the word means "{currentWord.definition}")</p>

        <div className="text-xl text-center flex flex-wrap justify-center items-center gap-2">
            <span>{sentenceParts[0]}</span>
            <form onSubmit={handleSubmit} className="inline-block">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isSubmitted}
                    className={`w-36 text-center border-b-2 bg-transparent focus:outline-none transition-colors ${
                        isSubmitted ? (isCorrect ? 'border-green-500 bg-green-500/20' : 'border-red-500 bg-red-500/20') : 'border-gray-400 focus:border-primary'
                    }`}
                    style={{ minWidth: `${currentWord.word.length * 0.8}em` }}
                />
            </form>
            <span>{sentenceParts.slice(1).join(currentWord.word)}</span>
        </div>

        <div className="mt-8 flex justify-center">
            {!isSubmitted ? (
                <Button onClick={handleSubmit} disabled={!inputValue.trim()}>Check Answer</Button>
            ) : (
                <div className="text-center">
                    {isCorrect ? (
                        <p className="text-green-600 font-bold mb-4">Correct!</p>
                    ) : (
                        <p className="text-red-600 font-bold mb-4">Not quite. The correct answer is: <strong className="underline">{currentWord.word}</strong></p>
                    )}
                    <Button onClick={handleNext}>{currentIndex === shuffledWords.length - 1 ? 'Finish' : 'Next'}</Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FillInBlankExercise;


import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Word } from '../../types';
import Button from '../ui/Button';

import { useVocabulary } from '../../context/VocabularyContext';
import i18n from "i18next";

interface QuizExerciseProps {
  words: Word[];
  onExit: () => void;
  onComplete: () => void;
}

const QuizExercise: React.FC<QuizExerciseProps> = ({ words, onExit, onComplete }) => {
  const { updateWordSpacedRepetition } = useVocabulary();
  const shuffledWords = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentWord = shuffledWords[currentIndex];

  useEffect(() => {
    if (!isFinished) {
      const correctOption = currentWord.word;
      const wrongOptions = words
        .filter(w => w.id !== currentWord.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word);
      
      setOptions([correctOption, ...wrongOptions].sort(() => Math.random() - 0.5));
      setSelectedAnswer(null);
      setIsCorrect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isFinished]);

  const handleAnswer = (option: string) => {
    if (selectedAnswer) return;

    const correct = option === currentWord.word;
    setSelectedAnswer(option);
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
    } else {
      setIsFinished(true);
      onComplete();
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
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
            <h2 className="text-2xl font-bold mb-4">{i18n.t("Quiz Complete!")}</h2>
            <p className="text-lg mb-6">{i18n.t("Your score:")} <span className="font-bold text-primary">{score} / {shuffledWords.length}</span></p>
            <div className="flex gap-4 justify-center">
                <Button onClick={restart}>{i18n.t("Try Again")}</Button>
                <Button onClick={onExit} variant="secondary">{i18n.t("Exit")}</Button>
            </div>
        </div>
      )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{i18n.t("Quiz")}</h2>
        <p className="font-semibold">{i18n.t("Score:")} {score}</p>
      </div>
      <div className="bg-base-200/40 backdrop-blur-xl border border-white/20 p-6 rounded-lg shadow-2xl">
        <p className="text-lg text-center mb-6">{i18n.t("Which word means: \"")}{currentWord.definition}"?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map(option => {
            const isSelected = selectedAnswer === option;
            const isCorrectAnswer = option === currentWord.word;
            let buttonClass = 'bg-base-200/40 hover:bg-base-200/60 border-white/10';
            if (isSelected) {
              buttonClass = isCorrect ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500';
            } else if (selectedAnswer && isCorrectAnswer) {
              buttonClass = 'bg-green-500 text-white border-green-500';
            }

            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={!!selectedAnswer}
                className={`w-full p-4 rounded-lg border-2 text-center transition-colors duration-200 disabled:cursor-not-allowed ${buttonClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {selectedAnswer && (
          <div className="mt-6 text-center">
            <Button onClick={handleNext}>
              {currentIndex === shuffledWords.length - 1 ? 'Finish' : 'Next Question'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizExercise;

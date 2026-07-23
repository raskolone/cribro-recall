
import React, { useState } from 'react';
import { ExerciseType, PracticeHistory } from '../../types';
import FlashcardExercise from './FlashcardExercise';
import QuizExercise from './QuizExercise';
import FillInBlankExercise from './FillInBlankExercise';
import MatchExercise from './MatchExercise';
import { useVocabulary } from '../../context/VocabularyContext';
import Button from '../ui/Button';
import i18n from "i18next";

interface PracticeZoneProps {
  exerciseType: ExerciseType;
  isRevisionMode?: boolean;
  isSpacedRepetitionMode?: boolean;
  onExit: () => void;
}

const PracticeZone: React.FC<PracticeZoneProps> = ({ 
  exerciseType, 
  isRevisionMode = false, 
  isSpacedRepetitionMode = false,
  onExit 
}) => {
  const { words, difficultWords, dueWords, wordSets, savePracticeHistory } = useVocabulary();
  const [selectedSetId, setSelectedSetId] = useState<string>('all');

  const baseWords = isSpacedRepetitionMode ? dueWords : (isRevisionMode ? difficultWords : words);
  
  const practiceWords = selectedSetId === 'all'
    ? baseWords
    : selectedSetId === 'global'
      ? baseWords.filter(w => !w.setId)
      : baseWords.filter(w => w.setId === selectedSetId);

  const handleComplete = () => {
    savePracticeHistory(exerciseType, isRevisionMode);
  };

  if (practiceWords.length < 4) {
    return (
      <div className="space-y-6">
        {!isRevisionMode && wordSets.length > 0 && (
          <div className="flex justify-end">
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              className="px-4 py-2 bg-base-100/40 backdrop-blur-md border border-white/10 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
            >
              <option value="all">{i18n.t("All Words")}</option>
              <option value="global">{i18n.t("Global Words")}</option>
              {wordSets.map(set => (
                <option key={set.id} value={set.id}>{set.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="text-center p-8 bg-base-200/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] shadow-xl transition-colors duration-300">
          <h2 className="text-xl font-bold mb-4">{i18n.t("Not Enough Words")}</h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            {isRevisionMode 
              ? "You need at least 4 difficult words to start a revision session. Mark more words as difficult in your vocabulary list."
              : selectedSetId !== 'all' 
                ? "You need at least 4 words in this set to start practicing."
                : "You need at least 4 words in your vocabulary list to start practicing. Please generate more words."}
          </p>
          <Button onClick={onExit}>{i18n.t("Back to Dashboard")}</Button>
        </div>
      </div>
    );
  }

  const renderExercise = () => {
    switch (exerciseType) {
      case 'flashcards':
        return <FlashcardExercise words={practiceWords} onExit={onExit} onComplete={handleComplete} />;
      case 'quiz':
        return <QuizExercise words={practiceWords} onExit={onExit} onComplete={handleComplete} />;
      case 'fill-in-the-blank':
        return <FillInBlankExercise words={practiceWords} onExit={onExit} onComplete={handleComplete} />;
      case 'match':
        return <MatchExercise words={practiceWords} onExit={onExit} onComplete={handleComplete} />;
      default:
        return <p>{i18n.t("Select an exercise to begin.")}</p>;
    }
  };

  return (
    <div className="space-y-6">
      {!isRevisionMode && wordSets.length > 0 && (
        <div className="flex justify-end">
          <select
            value={selectedSetId}
            onChange={(e) => setSelectedSetId(e.target.value)}
            className="px-4 py-2 bg-base-100/40 backdrop-blur-md border border-white/10 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
          >
            <option value="all">{i18n.t("All Words")}</option>
            <option value="global">{i18n.t("Global Words")}</option>
            {wordSets.map(set => (
              <option key={set.id} value={set.id}>{set.name}</option>
            ))}
          </select>
        </div>
      )}
      {renderExercise()}
    </div>
  );
};

export default PracticeZone;

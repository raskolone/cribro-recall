import React, { useState, useEffect, useMemo } from 'react';
import { Word } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import confetti from 'canvas-confetti';
import ContextMenu from '../ui/ContextMenu';
import { getAudioPronunciation } from '../../services/geminiService';

interface MatchExerciseProps {
  words: Word[];
  onExit: () => void;
  onComplete: () => void;
}

interface MatchCard {
  id: string;
  wordId: string;
  text: string;
  type: 'word' | 'definition';
}

import { useVocabulary } from '../../context/VocabularyContext';

interface MatchExerciseProps {
  words: Word[];
  onExit: () => void;
  onComplete: () => void;
}

interface MatchCard {
  id: string;
  wordId: string;
  text: string;
  type: 'word' | 'definition';
}

const MatchExercise: React.FC<MatchExerciseProps> = ({ words, onExit, onComplete }) => {
  const { updateWordSpacedRepetition } = useVocabulary();
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongMatch, setWrongMatch] = useState<[string, string] | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [wrongAttempts, setWrongAttempts] = useState<Set<string>>(new Set());
  
  const playAudio = async (text: string) => {
    try {
      const audioData = await getAudioPronunciation(text, 'en');
      if (!audioData) return;
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audio.play();
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize game
  useEffect(() => {
    // Select up to 6 random words for the match game to fit on screen well
    const shuffledWords = [...words].sort(() => Math.random() - 0.5).slice(0, 6);
    
    const initialCards: MatchCard[] = [];
    shuffledWords.forEach(word => {
      initialCards.push({ id: `w-${word.id}`, wordId: word.id, text: word.word, type: 'word' });
      initialCards.push({ id: `d-${word.id}`, wordId: word.id, text: word.definition, type: 'definition' });
    });

    setCards(initialCards.sort(() => Math.random() - 0.5));
    setStartTime(Date.now());
  }, [words]);

  // Timer
  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isFinished]);

  const handleCardClick = (card: MatchCard) => {
    if (matchedIds.has(card.wordId) || wrongMatch) return;

    if (!selectedCard) {
      setSelectedCard(card);
      return;
    }

    if (selectedCard.id === card.id) {
      setSelectedCard(null); // Deselect
      return;
    }

    if (selectedCard.wordId === card.wordId && selectedCard.type !== card.type) {
      // Match found!
      const newMatched = new Set(matchedIds).add(card.wordId);
      setMatchedIds(newMatched);
      setSelectedCard(null);

      // Update SRA for this word (if it wasn't already marked wrong in this session)
      if (!wrongAttempts.has(card.wordId)) {
        updateWordSpacedRepetition(card.wordId, true);
      }

      if (newMatched.size === cards.length / 2) {
        setIsFinished(true);
        onComplete();
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } else {
      // Wrong match
      setWrongMatch([selectedCard.id, card.id]);
      
      // Mark both words as wrong for SRA
      const newWrong = new Set(wrongAttempts);
      newWrong.add(selectedCard.wordId);
      newWrong.add(card.wordId);
      setWrongAttempts(newWrong);
      
      updateWordSpacedRepetition(selectedCard.wordId, false);
      updateWordSpacedRepetition(card.wordId, false);

      setTimeout(() => {
        setWrongMatch(null);
        setSelectedCard(null);
      }, 800);
    }
  };

  if (isFinished) {
    return (
      <div className="text-center p-8 bg-base-200/40 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl">
        <h2 className="text-3xl font-bold mb-4 text-primary">Match Completed!</h2>
        <p className="text-xl mb-6">Time: {timeElapsed} seconds</p>
        <div className="flex justify-center gap-4">
          <Button onClick={onExit}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Match the Words</h2>
        <div className="text-xl font-mono bg-base-200/50 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
          {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
        </div>
        <Button onClick={onExit} variant="secondary">Exit</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const isMatched = matchedIds.has(card.wordId);
          const isSelected = selectedCard?.id === card.id;
          const isWrong = wrongMatch?.includes(card.id);

          if (isMatched) {
            return <div key={'ctx-' + card.id} className="h-32 rounded-xl opacity-0 transition-opacity duration-500" />;
          }

          return (
            <ContextMenu
              key={'ctx-' + card.id}
              items={[
                { label: 'Odsłuchaj (Wymowa)', onClick: () => playAudio(card.text) }
              ]}
            >
            <div
              key={card.id + '-inner'}
              onClick={() => handleCardClick(card)}
              className={`
                h-32 p-4 rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-center text-center
                backdrop-blur-xl border-2 shadow-lg
                ${isSelected ? 'bg-primary/20 border-primary scale-105' : 'bg-base-100/60 border-white/20 hover:bg-base-100/80 hover:scale-105'}
                ${isWrong ? 'bg-red-500/20 border-red-500 animate-shake' : ''}
              `}
            >
              <span className={`font-medium ${card.type === 'word' ? 'text-lg text-primary' : 'text-sm text-gray-700'}`}>
                {card.text}
              </span>
            </div>
            </ContextMenu>
          );
        })}
      </div>
    </div>
  );
};

export default MatchExercise;


import React, { useState } from 'react';
import { Word } from '../../types';
import { useVocabulary } from '../../context/VocabularyContext';
import { getAudioPronunciation } from '../../services/geminiService';
import { playAudio } from '../../utils/audioUtils';
import { VOICE_CONFIG } from '../../constants';
import PronunciationMic from '../ui/PronunciationMic';
import i18n from "i18next";

interface WordCardProps {
  word: Word;
}

const WordCard: React.FC<WordCardProps> = ({ word }) => {
  const { toggleWordDifficulty, deleteWord } = useVocabulary();
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const handlePlayAudio = async (variant: string) => {
    if (isPlaying) return;
    setIsPlaying(variant);
    try {
      let voice: string;
      if (word.language === 'English') {
        voice = VOICE_CONFIG.English[variant as 'American' | 'British'];
      } else {
        voice = VOICE_CONFIG[word.language];
      }
      const audio = await getAudioPronunciation(word.word, voice);
      await playAudio(audio);
    } catch (error) {
      console.error(`Failed to play ${variant} audio`, error);
    } finally {
      setIsPlaying(null);
    }
  };

  return (
    <div className="p-4 bg-base-200 dark:bg-dark-base-200 rounded-xl border border-base-300 dark:border-dark-base-300 shadow-md relative group transition-colors duration-300">
      <button
        onClick={() => deleteWord(word.id)}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
        title={i18n.t("Delete word")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-primary">{word.word}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">/{word.ipa}/</p>
        </div>
        <div className="flex items-center space-x-2">
          {word.language === 'English' ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-primary/10 rounded-full pr-1 overflow-hidden">
                <span className="px-3 text-xs font-bold text-primary border-r border-primary/20 hidden sm:block">
                  
                                                    {i18n.t("Audio Pronunciation")}
                                                  </span>
                <AudioButton
                  label={i18n.t("US")}
                  onClick={() => handlePlayAudio('American')}
                  isLoading={isPlaying === 'American'}
                  className="bg-transparent hover:bg-primary/20"
                />
                <AudioButton
                  label={i18n.t("UK")}
                  onClick={() => handlePlayAudio('British')}
                  isLoading={isPlaying === 'British'}
                  className="bg-transparent hover:bg-primary/20"
                />
              </div>
              <PronunciationMic targetWord={word.word} />
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <AudioButton
                label={`Audio Pronunciation (${word.language === 'Spanish' ? 'ES' : word.language === 'French' ? 'FR' : 'NL'})`}
                onClick={() => handlePlayAudio(word.language)}
                isLoading={isPlaying === word.language}
              />
              <PronunciationMic targetWord={word.word} />
            </div>
          )}
          <button
            onClick={() => toggleWordDifficulty(word.id)}
            title={word.isDifficult ? 'Mark as easy' : 'Mark as difficult'}
            className={`p-1.5 rounded-full transition-colors ${
              word.isDifficult ? 'text-yellow-500 bg-yellow-500/20' : 'text-gray-400 dark:text-gray-500 hover:bg-base-300 dark:hover:bg-dark-base-300'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        </div>
      </div>
      <p className="mt-2 text-gray-700 dark:text-gray-300">{word.definition}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">"{word.example}"</p>
    </div>
  );
};

const AudioButton: React.FC<{ label: string; onClick: () => void; isLoading: boolean; className?: string }> = ({ label, onClick, isLoading, className = "" }) => (
    <button
        onClick={onClick}
        disabled={isLoading}
        className={`h-8 px-3 flex items-center justify-center gap-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold disabled:opacity-50 ${className}`}
        title={`Play ${label} pronunciation`}
    >
        {isLoading ? (
            <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
        )}
        {label}
    </button>
);


export default WordCard;

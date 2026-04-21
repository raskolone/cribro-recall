
import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useVocabulary } from '../../context/VocabularyContext';
import { getAISuggestions } from '../../services/geminiService';
import { AISuggestion } from '../../types';

const AISuggestions: React.FC = () => {
  const { difficultWords } = useVocabulary();
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    if (difficultWords.length < 3) {
      setSuggestion(null);
      setError("Mark at least 3 words as difficult to get personalized suggestions.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAISuggestions(difficultWords);
      setSuggestion(result);
    } catch (err) {
      setError("Could not fetch AI suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Clear suggestions if difficult words change
    setSuggestion(null);
    if(difficultWords.length < 3){
       setError("Mark at least 3 words as difficult to get personalized suggestions.");
    } else {
        setError(null);
    }
  }, [difficultWords]);

  return (
    <Card className="h-full">
      <h2 className="text-xl font-bold mb-4">AI Study Helper</h2>
      {suggestion ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Context is Key:</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 bg-base-100 dark:bg-dark-base-100 p-4 rounded-xl border border-base-300 dark:border-dark-base-300 shadow-sm leading-relaxed">{suggestion.paragraph}</p>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Expand Your Vocabulary:</h3>
            <ul className="mt-3 space-y-3">
              {suggestion.wordSuggestions.map(ws => (
                <li key={ws.word} className="text-sm border-b border-base-300 dark:border-dark-base-300 pb-3">
                  <strong className="text-primary text-base block mb-1">{ws.word}</strong>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span><span className="font-semibold">Synonym:</span> {ws.synonym}</span>
                    <span><span className="font-semibold">Antonym:</span> {ws.antonym}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
           <Button onClick={() => setSuggestion(null)} variant="ghost" size="sm" className="w-full mt-4">
            Clear Suggestions
           </Button>
        </div>
      ) : (
        <div className="text-center flex flex-col items-center justify-center h-full">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || "Struggling with some words? Mark them as difficult and get AI-powered learning suggestions!"}
          </p>
          <Button onClick={fetchSuggestions} isLoading={isLoading} disabled={difficultWords.length < 3}>
            Get Suggestions
          </Button>
        </div>
      )}
    </Card>
  );
};

export default AISuggestions;


import React, { useState } from 'react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Button from '../ui/Button';
import AISkeletonLoader from '../ui/AISkeletonLoader';
import { Language, Difficulty } from '../../types';
import { LANGUAGES, DIFFICULTIES } from '../../constants';
import { useVocabulary } from '../../context/VocabularyContext';
import { generateVocabulary } from '../../services/geminiService';
import { useLanguage } from '../../context/LanguageContext';

const VocabularyGenerator: React.FC = () => {
  const { language: uiLanguage } = useLanguage();
  const [language, setLanguage] = useState<Language>('English');
  const [difficulty, setDifficulty] = useState<Difficulty>('A1-A2');
  const [targetSetId, setTargetSetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addWords, wordSets } = useVocabulary();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const newWords = await generateVocabulary(language, difficulty);
      const wordsWithLanguage = newWords.map(word => ({ 
        ...word, 
        language,
        ...(targetSetId ? { setId: targetSetId } : {})
      }));
      addWords(wordsWithLanguage);
    } catch (err) {
      setError('Failed to generate vocabulary. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Generate New Vocabulary</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            id="language"
            label="Language"
            options={LANGUAGES}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          />
          <Select
            id="difficulty"
            label="Difficulty"
            options={DIFFICULTIES}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          />
          <div>
            <label htmlFor="targetSet" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
              Add to Set (Optional)
            </label>
            <select
              id="targetSet"
              value={targetSetId}
              onChange={(e) => setTargetSetId(e.target.value)}
              className="block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
            >
              <option value="">None (Global)</option>
              {wordSets.map(set => (
                <option key={set.id} value={set.id}>{set.name}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {isLoading ? (
          <div className="pt-2">
            <AISkeletonLoader 
              variant="cards" 
              count={3} 
              message={uiLanguage === 'pl' ? 'AI analizuje bazę i układa zestaw 10 słówek...' : 'AI is designing a perfect list of 10 vocabulary words...'} 
            />
          </div>
        ) : (
          <Button type="submit" className="w-full">
            Generate 10 Words
          </Button>
        )}
      </form>
    </Card>
  );
};

export default VocabularyGenerator;

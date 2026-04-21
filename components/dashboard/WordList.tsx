
import React, { useState } from 'react';
import { useVocabulary } from '../../context/VocabularyContext';
import WordCard from './WordCard';
import Card from '../ui/Card';

const WordList: React.FC = () => {
  const { words, wordSets } = useVocabulary();
  const [filterSetId, setFilterSetId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredWords = (filterSetId === 'all' 
    ? words 
    : filterSetId === 'global'
      ? words.filter(w => !w.setId)
      : words.filter(w => w.setId === filterSetId)
  ).filter(w => w.word.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Card>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className="text-xl font-bold">My Vocabulary</h2>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
          <input
            type="text"
            placeholder="Search words..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-48 px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
          />
          {wordSets.length > 0 && (
            <select
              value={filterSetId}
              onChange={(e) => setFilterSetId(e.target.value)}
              className="px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
            >
              <option value="all">All Words</option>
              <option value="global">Global Words</option>
              {wordSets.map(set => (
                <option key={set.id} value={set.id}>{set.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      {filteredWords.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {filteredWords.map((word) => (
            <WordCard key={word.id} word={word} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          {words.length === 0 
            ? "Your vocabulary list is empty. Generate some new words to get started!"
            : "No words found matching your search or in this set."}
        </p>
      )}
    </Card>
  );
};

export default WordList;

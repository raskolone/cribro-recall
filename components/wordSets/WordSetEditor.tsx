import React from 'react';
import { useVocabulary } from '../../context/VocabularyContext';
import { Language, Word } from '../../types';
import { LANGUAGES } from '../../constants';
import Card from '../ui/Card';

interface WordSetEditorProps {
  setId: string;
  onBack: () => void;
}

const WordEditItem: React.FC<{
  word: Word;
  index: number;
  onUpdate: (id: string, data: Partial<Word>) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}> = ({ word, index, onUpdate, onDelete, onDragStart, onDragOver, onDrop }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className="p-4 bg-base-200 dark:bg-dark-base-200 rounded-xl border border-base-300 dark:border-dark-base-300 shadow-md mb-4 flex gap-4 cursor-move group transition-colors duration-300"
    >
      <div className="flex flex-col justify-center text-gray-400 group-hover:text-primary transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Word</label>
          <input
            value={word.word}
            onChange={(e) => onUpdate(word.id, { word: e.target.value })}
            className="mt-1 block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Translation / Definition</label>
          <input
            value={word.definition}
            onChange={(e) => onUpdate(word.id, { definition: e.target.value })}
            className="mt-1 block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Pronunciation (IPA)</label>
          <input
            value={word.ipa}
            onChange={(e) => onUpdate(word.id, { ipa: e.target.value })}
            className="mt-1 block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Example Sentence</label>
          <input
            value={word.example}
            onChange={(e) => onUpdate(word.id, { example: e.target.value })}
            className="mt-1 block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
          />
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <button onClick={() => onDelete(word.id)} className="text-red-500 hover:text-red-700 p-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const WordSetEditor: React.FC<WordSetEditorProps> = ({ setId, onBack }) => {
  const { wordSets, words, updateWordSet, updateWord, deleteWord, reorderSetWords, addWords } = useVocabulary();
  const set = wordSets.find(s => s.id === setId);
  
  if (!set) return null;

  const setWords = words.filter(w => w.setId === setId);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('wordIndex', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    const dragIndex = Number(e.dataTransfer.getData('wordIndex'));
    if (dragIndex === dropIndex) return;
    
    const newWords = [...setWords];
    const [draggedWord] = newWords.splice(dragIndex, 1);
    newWords.splice(dropIndex, 0, draggedWord);
    
    reorderSetWords(setId, newWords);
  };

  const handleAddWord = () => {
    addWords([{
      word: '',
      definition: '',
      ipa: '',
      example: '',
      language: set.language || 'English',
      setId: setId
    }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-gray-500 hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Edit Word Set</h1>
      </div>

      <Card>
        <h2 className="text-xl font-bold mb-4">Set Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              value={set.name}
              onChange={(e) => updateWordSet(setId, { name: e.target.value })}
              className="block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Language</label>
            <select
              value={set.language || ''}
              onChange={(e) => updateWordSet(setId, { language: e.target.value as Language })}
              className="block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
            >
              <option value="">Not specified</option>
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={set.description}
              onChange={(e) => updateWordSet(setId, { description: e.target.value })}
              rows={2}
              className="block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition-all duration-200"
            />
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-xl font-bold mb-4">Words in Set ({setWords.length})</h2>
        {setWords.length === 0 ? (
          <p className="text-gray-500 mb-4">No words in this set yet. Generate some words and add them to this set, or add them manually below!</p>
        ) : (
          <div className="space-y-2 mb-4">
            {setWords.map((word, index) => (
              <WordEditItem
                key={word.id}
                word={word}
                index={index}
                onUpdate={updateWord}
                onDelete={deleteWord}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
        <button
          onClick={handleAddWord}
          className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add New Word
        </button>
      </div>
    </div>
  );
};

export default WordSetEditor;

import React, { useState } from 'react';
import { useVocabulary } from '../../context/VocabularyContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import WordSetEditor from './WordSetEditor';
import i18n from "i18next";

const WordSetsScreen: React.FC = () => {
  const { wordSets, addWordSet, deleteWordSet, words } = useVocabulary();
  const [isCreating, setIsCreating] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const handleCreateSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSetName.trim()) {
      addWordSet({
        name: newSetName.trim(),
        description: newSetDescription.trim(),
      });
      setNewSetName('');
      setNewSetDescription('');
      setIsCreating(false);
    }
  };

  if (editingSetId) {
    return <WordSetEditor setId={editingSetId} onBack={() => setEditingSetId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{i18n.t("Word Sets")}</h1>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : 'Create New Set'}
        </Button>
      </div>

      {isCreating && (
        <Card className="max-w-md">
          <h2 className="text-xl font-bold mb-4">{i18n.t("Create Word Set")}</h2>
          <form onSubmit={handleCreateSet} className="space-y-4">
            <div>
              <label htmlFor="setName" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{i18n.t("Set Name")}</label>
              <input
                id="setName"
                type="text"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                required
                className="block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                placeholder={i18n.t("e.g., Travel Vocabulary")}
              />
            </div>
            <div>
              <label htmlFor="setDescription" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{i18n.t("Description (Optional)")}</label>
              <textarea
                id="setDescription"
                value={newSetDescription}
                onChange={(e) => setNewSetDescription(e.target.value)}
                className="block w-full px-4 py-2 bg-base-100 dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                placeholder={i18n.t("e.g., Words for my upcoming trip to Paris")}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={!newSetName.trim()}>{i18n.t("Create Set")}</Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wordSets.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 col-span-full">{i18n.t("You haven't created any word sets yet.")}</p>
        ) : (
          wordSets.map(set => {
            const wordCount = words.filter(w => w.setId === set.id).length;
            return (
              <Card key={set.id} className="flex flex-col">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-primary">{set.name}</h3>
                  {set.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{set.description}</p>}
                  <p className="text-sm text-gray-500 mt-4">{wordCount}  {i18n.t("word")}{wordCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                  <button
                    onClick={() => setEditingSetId(set.id)}
                    className="text-primary hover:text-blue-700 text-sm font-bold transition-colors"
                  >
                    
                                                {i18n.t("Edit Set")}
                                              </button>
                  <button
                    onClick={() => deleteWordSet(set.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors"
                  >
                    
                                                {i18n.t("Delete Set")}
                                              </button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WordSetsScreen;

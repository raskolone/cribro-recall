import React, { useState } from 'react';
import { Sparkles, Check, Plus, BookOpen, Volume2, X, AlertCircle } from 'lucide-react';
import { ExtractedEmailVocab } from '../../services/gmailService';
import { useFlashcards } from '../../context/FlashcardContext';
import { playSpeech } from '../../services/ttsService';
import Button from '../ui/Button';

interface EmailVocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailSubject: string;
  vocabList: ExtractedEmailVocab[];
  isLoading: boolean;
  onSuccess: (count: number) => void;
}

export const EmailVocabModal: React.FC<EmailVocabModalProps> = ({
  isOpen,
  onClose,
  emailSubject,
  vocabList,
  isLoading,
  onSuccess
}) => {
  const { sets, createSet, saveFlashcards } = useFlashcards();
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => vocabList.map((_, i) => i));
  const [selectedSetId, setSelectedSetId] = useState<string>('new');
  const [newSetName, setNewSetName] = useState<string>(`Słownictwo z Gmail: ${emailSubject.slice(0, 30)}`);
  const [isSaving, setIsSaving] = useState(false);

  // Sync selected indices if vocabList changes
  React.useEffect(() => {
    setSelectedIndices(vocabList.map((_, i) => i));
  }, [vocabList]);

  if (!isOpen) return null;

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleSaveToRecall = async () => {
    const chosenItems = selectedIndices.map(i => vocabList[i]).filter(Boolean);
    if (chosenItems.length === 0) return;

    setIsSaving(true);
    try {
      let targetSetId = selectedSetId;

      if (targetSetId === 'new') {
        targetSetId = await createSet({
          title: newSetName || `Gmail Słownictwo (${new Date().toLocaleDateString()})`,
          description: `Wyodrębnione z e-maila: "${emailSubject}"`,
          isPublic: false
        } as any);
      }

      // Convert to flashcards
      const cardsToSave = chosenItems.map(item => ({
        term: item.term,
        definition: item.definition + (item.ipa ? ` [${item.ipa}]` : ''),
        contextSentence: item.contextSentence || '',
        termLanguage: 'en',
        definitionLanguage: 'pl'
      } as any));

      await saveFlashcards(targetSetId, cardsToSave);
      onSuccess(chosenItems.length);
      onClose();
    } catch (err) {
      console.error('Błąd zapisu fiszek z Gmaila:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'phrasal_verb':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Phrasal Verb</span>;
      case 'idiom':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">Idiom</span>;
      case 'collocation':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Collocation</span>;
      case 'business_formal':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Business English</span>;
      case 'grammar_pattern':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Grammar Pattern</span>;
      default:
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-500/20 text-gray-300 border border-gray-500/30">Vocabulary</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div 
        className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                Wyodrębnione słownictwo z e-maila
              </h3>
              <p className="text-xs text-content-muted truncate max-w-md">
                Wiadomość: <span className="text-white/80">{emailSubject}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-sm font-medium text-white">AI analizuje treść wiadomości e-mail...</p>
              <p className="text-xs text-content-muted">Wyszukujemy zaawansowane zwroty biznesowe, kolokacje i phrasal verbs</p>
            </div>
          ) : vocabList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-content-muted">
              <AlertCircle size={32} />
              <p className="text-sm">Nie znaleziono charakterystycznych fraz w tej wiadomości.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-content-muted px-1">
                <span>Zaznacz frazy, które chcesz zapisać do bazy powtórek Cribro Recall:</span>
                <span className="font-bold text-primary">
                  Wybrano {selectedIndices.length} z {vocabList.length}
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {vocabList.map((item, index) => {
                  const isSelected = selectedIndices.includes(index);
                  return (
                    <div
                      key={index}
                      onClick={() => toggleSelect(index)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/30 text-white' 
                          : 'bg-white/5 border-white/5 text-content-muted hover:border-white/10'
                      }`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-primary border-primary text-black' : 'border-white/20'
                      }`}>
                        {isSelected && <Check size={14} className="stroke-[3]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-base text-white">{item.term}</span>
                          {item.ipa && (
                            <span className="text-xs font-mono text-content-muted">{item.ipa}</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playSpeech(item.term, 'en-US');
                            }}
                            className="p-1 hover:text-primary transition-colors text-content-muted"
                            title="Odsłuchaj wymowę"
                          >
                            <Volume2 size={14} />
                          </button>
                          {getCategoryBadge(item.category)}
                        </div>

                        <p className="text-sm text-primary/90 font-medium mb-1.5">
                          {item.definition}
                        </p>

                        {item.contextSentence && (
                          <p className="text-xs text-content-muted italic bg-black/20 p-2 rounded-lg border border-white/5">
                            "{item.contextSentence}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Set selector */}
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                <label className="text-xs font-bold text-content-muted uppercase tracking-wider">
                  Gdzie zapisać te fiszki?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={selectedSetId}
                    onChange={(e) => setSelectedSetId(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  >
                    <option value="new" className="bg-surface text-white">+ Utwórz nowy zestaw fiszek</option>
                    {sets.filter(s => !s.isGeneral).map(set => (
                      <option key={set.id} value={set.id} className="bg-surface text-white">
                        {set.title} ({set.flashcards?.length || 0} słówek)
                      </option>
                    ))}
                  </select>

                  {selectedSetId === 'new' && (
                    <input
                      type="text"
                      value={newSetName}
                      onChange={(e) => setNewSetName(e.target.value)}
                      placeholder="Nazwa nowego zestawu..."
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 bg-black/20">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Anuluj
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveToRecall}
            disabled={selectedIndices.length === 0 || isLoading}
            isLoading={isSaving}
            className="bg-primary hover:bg-primary-hover text-black font-bold flex items-center gap-2"
          >
            <BookOpen size={16} />
            <span>Zapisz {selectedIndices.length} fraz do Cribro Recall</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

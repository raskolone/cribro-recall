import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Check, CheckSquare, Square, Layers, BookOpen, Users, Plus, Sparkles, Filter } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { db } from '../../firebase';
import { collection, getDocs, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { cleanVocabularyTopic } from '../../utils/vocabulary';
import AddResourceModal from './AddResourceModal';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface WordItem {
  id: string;
  english: string;
  polish: string;
}

interface VocabularyTileOption {
  id: string;
  title: string;
  studentName: string;
  studentId: string;
  sourceType: 'lesson' | 'set';
  words: WordItem[];
  date?: string;
}

interface AssignVocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: { id: string; firstName?: string; lastName?: string; username: string } | null;
  onSetAssigned: () => void;
}

export function parseVocabularyText(vocabularyText: string): WordItem[] {
  if (!vocabularyText) return [];
  const lines = vocabularyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.map((line, idx) => {
    let english = line;
    let polish = '';
    const match = line.match(/^(.*?)(?:\s*[-=–:]\s*)(.*)$/);
    if (match) {
      english = match[1].trim();
      polish = match[2].trim();
    }
    return {
      id: `word-${idx}-${Math.random().toString(36).substr(2, 6)}`,
      english,
      polish
    };
  });
}

export default function AssignVocabularyModal({
  isOpen,
  onClose,
  targetUser,
  onSetAssigned
}: AssignVocabularyModalProps) {
  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<VocabularyTileOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'set'>('all');

  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedWords, setSelectedWords] = useState<Record<string, WordItem>>({});
  const [customTitle, setCustomTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);

  useEscapeModal(isOpen, onClose, 0);
  useEscapeModal(isAddResourceModalOpen, () => setIsAddResourceModalOpen(false), 5);

  useEffect(() => {
    if (isOpen) {
      fetchAllVocabularyData();
    } else {
      setSelectedTileId(null);
      setSelectedWords({});
      setCustomTitle('');
    }
  }, [isOpen]);

  const fetchAllVocabularyData = async () => {
    setLoading(true);
    try {
      const allTiles: VocabularyTileOption[] = [];

      // 1. Fetch all users for student names
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const uData = d.data();
        const name = (uData.firstName || uData.lastName)
          ? `${uData.firstName || ''} ${uData.lastName || ''}`.trim()
          : uData.username || 'Kursant';
        usersMap[d.id] = name;
      });

      // 2. Fetch custom flashcard sets from collection('sets')
      const setsSnap = await getDocs(collection(db, 'sets'));
      for (const setDoc of setsSnap.docs) {
        const data = setDoc.data();
        const setId = setDoc.id;
        // Fetch cards
        const cardsSnap = await getDocs(collection(db, `sets/${setId}/flashcards`));
        const words: WordItem[] = cardsSnap.docs.map((cd, idx) => {
          const cData = cd.data();
          return {
            id: cd.id || `card-${idx}`,
            english: cData.english || cData.term || '',
            polish: cData.polish || cData.definition || ''
          };
        }).filter(w => w.english.trim().length > 0);

        if (words.length > 0) {
          allTiles.push({
            id: `set-${setId}`,
            title: data.title || 'Zestaw słówek',
            studentName: usersMap[data.userId] || 'System / Admin',
            studentId: data.userId || 'system',
            sourceType: 'set',
            words,
            date: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : undefined
          });
        }
      }

      // 3. Fetch lessonRecords for all users
      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const studentName = usersMap[userId];
        const lessonsSnap = await getDocs(collection(db, `users/${userId}/lessonRecords`));
        
        lessonsSnap.docs.forEach((lDoc, idx) => {
          const lData = lDoc.data();
          if (lData.vocabularyText && lData.vocabularyText.trim().length > 0) {
            const words = parseVocabularyText(lData.vocabularyText);
            if (words.length > 0) {
              const cleanedTopic = cleanVocabularyTopic(lData.topic);
              const title = cleanedTopic || `Lekcja z dnia ${lData.date || ''}`;
              
              allTiles.push({
                id: `lesson-${lDoc.id}`,
                title: title,
                studentName: studentName,
                studentId: userId,
                sourceType: 'lesson',
                words,
                date: lData.date
              });
            }
          }
        });
      }

      setTiles(allTiles);
    } catch (err) {
      console.error('Error loading vocabulary tiles for assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTile = (tile: VocabularyTileOption) => {
    setSelectedTileId(tile.id);
    if (!customTitle || customTitle === selectedTile?.title) {
      setCustomTitle(tile.title);
    }
    // Automatically select all words in this tile by default
    const wordMap: Record<string, WordItem> = {};
    tile.words.forEach(w => {
      wordMap[w.id] = w;
    });
    setSelectedWords(wordMap);
  };

  const handleToggleSelectAll = (tile: VocabularyTileOption) => {
    const allSelected = tile.words.every(w => selectedWords[w.id]);
    if (allSelected) {
      // Unselect all
      setSelectedWords({});
    } else {
      // Select all
      const wordMap: Record<string, WordItem> = {};
      tile.words.forEach(w => {
        wordMap[w.id] = w;
      });
      setSelectedWords(wordMap);
    }
  };

  const handleToggleWord = (word: WordItem) => {
    setSelectedWords(prev => {
      const next = { ...prev };
      if (next[word.id]) {
        delete next[word.id];
      } else {
        next[word.id] = word;
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (!targetUser) return;
    const selectedWordsList = Object.values(selectedWords);
    if (selectedWordsList.length === 0) {
      alert('Wybierz przynajmniej jedno słówko do zestawu.');
      return;
    }

    const titleToUse = customTitle.trim() || 'Przypisany zestaw słówek';

    setIsSubmitting(true);
    try {
      const newSetId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newSetData = {
        id: newSetId,
        userId: targetUser.id,
        title: titleToUse,
        description: `Przypisano przez nauczyciela dla ${targetUser.firstName || targetUser.username}`,
        isPublic: false,
        cardCount: selectedWordsList.length,
        assignedByTeacher: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const batch = writeBatch(db);
      // Write to sets collection
      batch.set(doc(db, `sets/${newSetId}`), newSetData);
      // Also write to user's wordSets collection for redundancy
      batch.set(doc(db, `users/${targetUser.id}/wordSets/${newSetId}`), newSetData);

      // Add flashcard items
      selectedWordsList.forEach((w, idx) => {
        const cardId = `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`;
        const cardData = {
          id: cardId,
          setId: newSetId,
          english: w.english,
          polish: w.polish,
          createdAt: new Date().toISOString()
        };
        batch.set(doc(db, `sets/${newSetId}/flashcards/${cardId}`), cardData);
        batch.set(doc(db, `users/${targetUser.id}/wordSets/${newSetId}/flashcards/${cardId}`), cardData);
      });

            // Set hasNewVocabulary flag for the target student
      batch.update(doc(db, `users/${targetUser.id}`), { hasNewVocabulary: true });
      await batch.commit();

      alert(`Pomyślnie przypisano zestaw (${selectedWordsList.length} słówek) do kursanta ${targetUser.firstName || targetUser.username}!`);
      onSetAssigned();
      onClose();
    } catch (err: any) {
      console.error('Error assigning vocabulary set:', err);
      alert('Błąd podczas przypisywania zestawu: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredTiles = tiles.filter(t => {
    if (filterType === 'lesson' && t.sourceType !== 'lesson') return false;
    if (filterType === 'set' && t.sourceType !== 'set') return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const matchesTitle = t.title.toLowerCase().includes(q);
    const matchesStudent = t.studentName.toLowerCase().includes(q);
    const matchesWords = t.words.some(w => w.english.toLowerCase().includes(q) || w.polish.toLowerCase().includes(q));
    return matchesTitle || matchesStudent || matchesWords;
  });

  const selectedTile = tiles.find(t => t.id === selectedTileId);
  const selectedWordsCount = Object.keys(selectedWords).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div 
        className="bg-[var(--surface-flat)] rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-white/10 shadow-[0_16px_64px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-[var(--surface-flat)]/95 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Przypisz zestaw słówek
                <span className="text-xs bg-primary/20 text-primary font-mono px-2.5 py-0.5 rounded-full border border-primary/30 font-semibold">
                  {targetUser?.firstName || targetUser?.username}
                </span>
              </h2>
              <p className="text-xs text-content-muted">
                Wybierz kafelkę lekcji z bazy danych, zaznacz całą lekcję lub wybrane słówka i przypisz kursantowi.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-text-2 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            {/* Search Input */}
            <Button onClick={() => setIsAddResourceModalOpen(true)} className="bg-primary text-accent-ink font-bold shrink-0">
                <Sparkles size={16} className="mr-2" /> Wygeneruj zestaw (AI)
              </Button>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" size={16} />
              <input
                type="text"
                placeholder="Szukaj lekcji, słówka lub kursanta..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-base-200/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-content-muted focus:border-primary/50 outline-none"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-base-200/60 p-1 rounded-xl border border-white/10 text-xs w-full sm:w-auto justify-center">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${filterType === 'all' ? 'bg-primary text-accent-ink font-bold shadow' : 'text-content-muted hover:text-white'}`}
              >
                Wszystkie ({tiles.length})
              </button>
              <button
                onClick={() => setFilterType('lesson')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${filterType === 'lesson' ? 'bg-primary text-accent-ink font-bold shadow' : 'text-content-muted hover:text-white'}`}
              >
                Z Lekcji
              </button>
              <button
                onClick={() => setFilterType('set')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${filterType === 'set' ? 'bg-primary text-accent-ink font-bold shadow' : 'text-content-muted hover:text-white'}`}
              >
                Zestawy
              </button>
            </div>
          </div>

          {/* Tiles Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-content-muted">Pobieranie baz słownictwa wszystkich kursantów...</p>
            </div>
          ) : filteredTiles.length === 0 ? (
            <div className="text-center p-12 bg-base-200/30 rounded-2xl border border-white/5 text-content-muted">
              Nie znaleziono żadnych baz słownictwa pasujących do kryteriów.
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
                Wybierz lekcję / zestaw słownictwa:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredTiles.map(tile => {
                  const isSelected = selectedTileId === tile.id;
                  return (
                    <div
                      key={tile.id}
                      onClick={() => handleSelectTile(tile)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all border relative overflow-hidden group ${
                        isSelected
                          ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary shadow-lg shadow-primary/10 scale-[1.01]'
                          : 'bg-base-200/50 hover:bg-base-200/80 border-white/10 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider border ${
                            tile.sourceType === 'lesson' 
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-primary/10 text-primary border-primary/30'
                          }`}>
                            {tile.sourceType === 'lesson' ? 'Lekcja' : 'Zestaw'}
                          </span>
                          <span className="text-[11px] text-content-muted truncate">
                            {tile.studentName}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-primary text-accent-ink flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-white text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {tile.title}
                      </h4>

                      <div className="flex items-center justify-between text-xs text-content-muted pt-2 border-t border-white/5">
                        <span className="font-mono text-primary font-bold">
                          {tile.words.length} słówek
                        </span>
                        {tile.date && (
                          <span className="text-[11px]">
                            {tile.date}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Tile Details & Word Picker */}
          {selectedTile && (
            <div className="bg-base-200/80 rounded-2xl border border-primary/30 p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-mono font-bold uppercase">Wybrana lekcja:</span>
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white font-medium">
                      Źródło: {selectedTile.studentName}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {selectedTile.title}
                  </h3>
                </div>

                {/* "Wybierz całą lekcję" Button */}
                <Button
                  size="sm"
                  variant={selectedTile.words.every(w => selectedWords[w.id]) ? 'primary' : 'secondary'}
                  onClick={() => handleToggleSelectAll(selectedTile)}
                  className="shrink-0"
                >
                  {selectedTile.words.every(w => selectedWords[w.id]) ? (
                    <>
                      <CheckSquare size={16} className="mr-1.5" />
                      Odznacz całą lekcję
                    </>
                  ) : (
                    <>
                      <Square size={16} className="mr-1.5" />
                      Wybierz całą lekcję ({selectedTile.words.length})
                    </>
                  )}
                </Button>
              </div>

              {/* Word Checkboxes List */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {selectedTile.words.map((w, idx) => {
                  const isChecked = !!selectedWords[w.id];
                  return (
                    <div
                      key={w.id || idx}
                      onClick={() => handleToggleWord(w)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-base-100/40 border-white/5 text-content-muted hover:bg-base-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div onClick
                        className="checkbox checkbox-xs checkbox-primary shrink-0"
                      />
                      <span className="font-bold text-primary w-1/2 truncate">{w.english}</span>
                      <span className="text-content-muted w-1/2 truncate">{w.polish || '—'}</span>
                    </div>
                  );
                })}
              </div>

              {/* Custom Title Input */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-content-muted mb-1 uppercase tracking-wider">
                    Nazwa nowego zestawu dla kursanta:
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder="Np. Lekcja 5 - Słownictwo praca"
                    className="w-full bg-base-100 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-6 bg-[var(--surface-flat)]/95 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-sm">
            <span className="text-content-muted">Wybranych słówek: </span>
            <span className="font-bold font-mono text-primary text-base">
              {selectedWordsCount}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Anuluj
            </Button>
            <Button
              onClick={handleAssign}
              isLoading={isSubmitting}
              disabled={selectedWordsCount === 0 || !selectedTileId}
              className="bg-primary text-accent-ink font-bold shadow-lg shadow-primary/20"
            >
              <Sparkles size={18} className="mr-2" />
              Przypisz zestaw ({selectedWordsCount})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { User, TranslationExercise, LessonRecord } from '../../types';
import Button from '../ui/Button';
import { X, Sparkles, Check, Trash2, Plus, RefreshCw, BookOpen, Eye, EyeOff, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { generateTranslationExercises } from '../../services/geminiService';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

interface TeacherSpecialTaskModalProps {
  user: User;
  onClose: () => void;
  onTaskCreated: () => void;
}

const TeacherSpecialTaskModal: React.FC<TeacherSpecialTaskModalProps> = ({ user, onClose, onTaskCreated }) => {
  const [manualPrompt, setManualPrompt] = useState('');
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [numSentences, setNumSentences] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSentences, setGeneratedSentences] = useState<(TranslationExercise & { id: string; accepted: boolean })[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Lesson history state
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showVocabPreview, setShowVocabPreview] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setIsLoadingLessons(true);
      getLessonRecordsForStudent(user.id)
        .then((records) => {
          setLessonRecords(records);
          if (records.length > 0) {
            setSelectedLessonId(records[0].id);
          }
        })
        .catch((err) => {
          console.error('Błąd pobierania historii lekcji:', err);
        })
        .finally(() => {
          setIsLoadingLessons(false);
        });
    }
  }, [user?.id]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Parse vocabulary text into array of clean word items
  const parseVocabularyItems = (text: string): string[] => {
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  // Get full combined instructions string
  const getCombinedInstructions = () => {
    const parts: string[] = [];
    if (manualPrompt.trim()) {
      parts.push(manualPrompt.trim());
    }
    if (selectedWords.length > 0) {
      parts.push(`Użyj słówek: ${selectedWords.join(', ')}.`);
    }
    return parts.join('\n\n');
  };

  const handleToggleWord = (word: string) => {
    setSelectedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  const handleSelectAllFromLesson = (words: string[]) => {
    const allSelected = words.every((w) => selectedWords.includes(w));
    if (allSelected) {
      setSelectedWords((prev) => prev.filter((w) => !words.includes(w)));
    } else {
      const newWords = Array.from(new Set([...selectedWords, ...words]));
      setSelectedWords(newWords);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');

    try {
      const studentProfileContext = `Kluczowy profil kursanta: ${user?.firstName ? `Imię kursanta: ${user.firstName}. ` : ''}${user?.description ? `Cały wpis z profilu kursanta (zainteresowania, cele, przykładowe zdania): ${user.description}` : 'Brak dodatkowych danych profilu.'}`;
      const finalPromptInstructions = getCombinedInstructions();
      const finalPrompt = `Jesteś nauczycielem przygotowującym zdania do przetłumaczenia z polskiego na angielski dla tego ucznia. 
INSTRUKCJE OD NAUCZYCIELA: ${finalPromptInstructions || 'Wygeneruj losowe zdania odpowiednie dla poziomu ucznia.'}`;

      const newSentences = await generateTranslationExercises(
        user.level || 'B1-B2',
        selectedWords, // pass selected words directly if any
        finalPrompt,
        '', // no extra lesson context
        studentProfileContext,
        numSentences
      );

      if (newSentences && newSentences.length > 0) {
        setGeneratedSentences(
          newSentences.map((s) => ({ ...s, id: generateId(), accepted: true }))
        );
      } else {
        setError('Brak wygenerowanych zdań. Spróbuj zmienić instrukcje lub wybrane słówka.');
      }
    } catch (err: any) {
      console.error(err);
      setError(`Błąd AI: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateRejected = async () => {
    const acceptedSentences = generatedSentences.filter((s) => s.accepted);
    const numToRegenerate = generatedSentences.length - acceptedSentences.length;

    if (numToRegenerate <= 0) return;

    setIsGenerating(true);
    setError('');

    try {
      const studentProfileContext = `Kluczowy profil kursanta: ${user?.firstName ? `Imię kursanta: ${user.firstName}. ` : ''}`;
      const finalPromptInstructions = getCombinedInstructions();
      const finalPrompt = `Jesteś nauczycielem przygotowującym zdania do przetłumaczenia. INSTRUKCJE: ${finalPromptInstructions}. Wygeneruj INNE zdania niż poprzednio.`;

      const newSentences = await generateTranslationExercises(
        user.level || 'B1-B2',
        selectedWords,
        finalPrompt,
        '',
        studentProfileContext,
        numToRegenerate
      );

      if (newSentences && newSentences.length > 0) {
        setGeneratedSentences([
          ...acceptedSentences,
          ...newSentences.map((s) => ({ ...s, id: generateId(), accepted: true })),
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Błąd AI: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSentence = (id: string) => {
    setGeneratedSentences((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: !s.accepted } : s))
    );
  };

  const handleSaveTask = async () => {
    const finalSentences = generatedSentences.filter((s) => s.accepted);
    if (finalSentences.length === 0) {
      setError('Musisz zaakceptować przynajmniej jedno zdanie.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const taskData = {
        studentId: user.id,
        title: `Zadanie specjalne - ${new Date().toLocaleDateString()}`,
        createdAt: serverTimestamp(),
        status: 'pending',
        sentences: finalSentences.map(({ polishSentence, englishTranslation, hint }) => ({
          polishSentence,
          englishTranslation,
          hint,
        })),
      };

      await addDoc(collection(db, 'specialTasks'), taskData);
      onTaskCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(`Błąd zapisu: ${err.message}`);
      setIsSaving(false);
    }
  };

  const currentSelectedLesson = lessonRecords.find((l) => l.id === selectedLessonId);
  const currentLessonVocabItems = currentSelectedLesson
    ? parseVocabularyItems(currentSelectedLesson.vocabularyText)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-base-100 border border-white/10 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Sparkles className="w-6 h-6 text-primary" />
              Zadanie specjalne (AI)
            </h2>
            <p className="text-sm text-content-muted mt-1">
              Dla ucznia: {user.firstName} {user.lastName || ''} ({user.email || user.username})
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-content-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Section: Lesson Selection & Vocabulary Preview */}
          <div className="bg-base-200/40 border border-white/5 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Wybierz lekcję z historii kursanta:
              </label>
              {selectedWords.length > 0 && (
                <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                  Wybrane słówka ({selectedWords.length})
                </span>
              )}
            </div>

            {isLoadingLessons ? (
              <div className="flex items-center gap-2 text-sm text-content-muted p-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Ładowanie historii lekcji...
              </div>
            ) : lessonRecords.length === 0 ? (
              <p className="text-sm text-content-muted italic">Brak zapisanych lekcji dla tego kursanta.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={selectedLessonId || ''}
                    onChange={(e) => {
                      setSelectedLessonId(e.target.value);
                      setShowVocabPreview(true);
                    }}
                    className="flex-1 bg-base-100 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-primary/50"
                  >
                    {lessonRecords.map((record, index) => (
                      <option key={record.id} value={record.id}>
                        Lekcja #{lessonRecords.length - index} — {record.topic} ({record.date})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setShowVocabPreview((prev) => !prev)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-base-100 hover:bg-base-200 border border-white/10 rounded-xl text-sm font-bold text-white transition-all hover:border-primary/40"
                  >
                    {showVocabPreview ? <EyeOff className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4 text-primary" />}
                    <span>{showVocabPreview ? 'Ukryj słownictwo' : 'Podgląd słownictwa'}</span>
                  </button>
                </div>

                {/* Vocabulary Preview Grid */}
                {showVocabPreview && currentSelectedLesson && (
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-content-muted">
                        Słownictwo z lekcji: <span className="text-white">{currentSelectedLesson.topic}</span>
                      </span>
                      {currentLessonVocabItems.length > 0 && (
                        <button
                          onClick={() => handleSelectAllFromLesson(currentLessonVocabItems)}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          {currentLessonVocabItems.every((w) => selectedWords.includes(w))
                            ? 'Odznacz wszystkie z tej lekcji'
                            : 'Zaznacz wszystkie z tej lekcji'}
                        </button>
                      )}
                    </div>

                    {currentLessonVocabItems.length === 0 ? (
                      <p className="text-xs text-content-muted italic">Brak słówek w opisie tej lekcji.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {currentLessonVocabItems.map((word, idx) => {
                          const isChecked = selectedWords.includes(word);
                          return (
                            <div
                              key={idx}
                              onClick={() => handleToggleWord(word)}
                              className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-primary/10 border-primary/50 text-white shadow-[0_0_15px_rgba(114,240,180,0.15)]'
                                  : 'bg-base-100/60 border-white/5 text-content-muted hover:border-white/20 hover:text-white'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded flex items-center justify-center transition-all shrink-0 ${
                                isChecked ? 'bg-primary text-black font-bold' : 'border border-white/20'
                              }`}>
                                {isChecked && <Check className="w-3.5 h-3.5" />}
                              </div>
                              <span className="text-xs font-medium line-clamp-2">{word}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Manual Prompt & Instructions */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-content-muted mb-2">
                Instrukcje / Sugestie dla AI
              </label>

              {/* Display selected words pill summary above or inside */}
              {selectedWords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-base-200/50 rounded-xl border border-white/5">
                  <span className="text-xs text-content-muted self-center mr-1">Dodane słówka:</span>
                  {selectedWords.map((w, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-lg"
                    >
                      {w}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWord(w);
                        }}
                        className="hover:text-red-400 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                value={manualPrompt}
                onChange={(e) => setManualPrompt(e.target.value)}
                placeholder="Np. Użyj słówek związanych z podróżowaniem. Skup się na czasie Past Simple..."
                className="w-full bg-base-200/50 border border-white/10 rounded-xl p-4 outline-none focus:border-primary/50 transition-colors h-24 resize-none text-white text-sm"
              />

              {/* Realtime combined preview note */}
              <p className="text-xs text-content-muted mt-1 italic">
                {selectedWords.length > 0
                  ? `Pełna instrukcja AI uwzględni wybrane ${selectedWords.length} słówek oraz powyższe wytyczne.`
                  : 'Wpisz własne wytyczne lub zaznacz słówka z historii lekcji powyżej.'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-bold text-content-muted mb-2">
                  Liczba zdań
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numSentences}
                  onChange={(e) => setNumSentences(parseInt(e.target.value) || 5)}
                  className="w-24 bg-base-200/50 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white font-mono text-center"
                />
              </div>
              <div className="flex-1 flex items-end">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full sm:w-auto"
                >
                  {isGenerating && generatedSentences.length === 0 ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Wygeneruj zdania
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Generated sentences list */}
          {generatedSentences.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-white">Wygenerowane zdania</h3>
                <span className="text-sm font-mono text-content-muted">
                  {generatedSentences.filter((s) => s.accepted).length} / {generatedSentences.length} zaakceptowanych
                </span>
              </div>

              <div className="space-y-3">
                {generatedSentences.map((s) => (
                  <div
                    key={s.id}
                    className={`p-4 rounded-xl border transition-all ${
                      s.accepted
                        ? 'bg-base-200 border-primary/30'
                        : 'bg-base-200/30 border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <p className="font-bold text-white">{s.polishSentence}</p>
                        <p className="text-content-muted text-sm">{s.englishTranslation}</p>
                        {s.hint && <p className="text-xs text-primary/70">Wskazówka: {s.hint}</p>}
                      </div>
                      <button
                        onClick={() => toggleSentence(s.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          s.accepted
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                        }`}
                        title={s.accepted ? 'Odrzuć' : 'Zaakceptuj'}
                      >
                        {s.accepted ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {generatedSentences.some((s) => !s.accepted) && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="secondary"
                    onClick={handleRegenerateRejected}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Wygeneruj brakujące zdania (zamiast odrzuconych)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {generatedSentences.length > 0 && (
          <div className="p-6 border-t border-white/5 bg-base-200/50 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Anuluj
            </Button>
            <Button onClick={handleSaveTask} disabled={isSaving || generatedSentences.filter((s) => s.accepted).length === 0}>
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Zapisz jako Zadanie specjalne
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherSpecialTaskModal;

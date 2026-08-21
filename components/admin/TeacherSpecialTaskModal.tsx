import React, { useState, useEffect, useRef } from 'react';
import { User, TranslationExercise, LessonRecord } from '../../types';
import Button from '../ui/Button';
import { X, Sparkles, Check, Trash2, Plus, RefreshCw, BookOpen, Eye, EyeOff, Send, MessageSquare, Bot, User as UserIcon, Edit2 } from 'lucide-react';
import { generateHomeworkChatPipeline, HomeworkChatMessage } from '../../services/geminiService';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import i18n from "i18next";
import { LessonSelectionModal } from '../dashboard/LessonSelectionModal';

interface TeacherSpecialTaskModalProps {
  user: User;
  onClose: () => void;
  onTaskCreated: () => void;
  initialLesson?: LessonRecord;
  initialWords?: string[];
  initialTopic?: string;
  autoGenerate?: boolean;
}

interface ChatTurnItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sentences?: (TranslationExercise & { accepted: boolean })[];
  summaryText?: string;
  modelInfo?: string;
  timestamp: string;
}

const TeacherSpecialTaskModal: React.FC<TeacherSpecialTaskModalProps> = ({ 
  user, 
  onClose, 
  onTaskCreated,
  initialLesson,
  initialWords,
  initialTopic,
  autoGenerate 
}) => {
  const [chatInput, setChatInput] = useState('');
  const [selectedWords, setSelectedWords] = useState<string[]>(() => {
    if (initialWords && initialWords.length > 0) return initialWords;
    if (initialLesson?.vocabularyText) {
      return initialLesson.vocabularyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }
    return [];
  });
  const [numSentences, setNumSentences] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<string>('');
  const [generatedSentences, setGeneratedSentences] = useState<(TranslationExercise & { id: string; accepted: boolean })[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  // Chat conversation state
  const [chatTurns, setChatTurns] = useState<ChatTurnItem[]>(() => {
    if (initialLesson) {
      const wordsCount = initialLesson.vocabularyText ? initialLesson.vocabularyText.split('\n').map(l => l.trim()).filter(l => l.length > 0).length : 0;
      return [
        {
          id: 'welcome',
          role: 'assistant',
          content: `Witaj! Tworzymy pracę domową na podstawie lekcji: **"${initialLesson.topic}"**.\n\nAutomatycznie załadowano **${wordsCount} słówek** z tej lekcji. Kliknij przycisk **„Generuj zdania”** poniżej lub napisz dodatkowe wskazówki do AI.`,
          modelInfo: 'OpenAI (GPT-4o mini) → Gemini 3.1 Flash',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Witaj! Jestem Asystentem Generatora Prac Domowych AI.\nDziałam w oparciu o dwustopniową komunikację modeli:\n1️⃣ **OpenAI (GPT-4o mini)** tworzy pierwotny szkic zdań na podstawie Twoich uwag.\n2️⃣ **Gemini 3.1 Flash** analizuje historię lekcji i ćwiczeń kursanta, weryfikuje logikę i dostosowuje poziom.\n\nNapisz, jakie zdania chcesz wygenerować lub wybierz słówka z lekcji poniżej!',
        modelInfo: 'OpenAI (GPT-4o mini) → Gemini 3.1 Flash',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  // Lesson history & Exercise history state
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>(() => {
    return initialLesson ? [initialLesson.id] : [];
  });
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [showVocabPreview, setShowVocabPreview] = useState(false);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      setIsLoadingLessons(true);
      
      // Fetch lessons
      getLessonRecordsForStudent(user.id)
        .then((records) => {
          let updatedRecords = records;
          if (initialLesson && !records.some(r => r.id === initialLesson.id)) {
            updatedRecords = [initialLesson, ...records];
          }
          setLessonRecords(updatedRecords);
          if (initialLesson) {
            setSelectedLessonIds([initialLesson.id]);
            const words = parseVocabularyItems(initialLesson.vocabularyText);
            setSelectedWords(words);
          }
        })
        .catch((err) => {
          console.error('Błąd pobierania historii lekcji:', err);
        })
        .finally(() => {
          setIsLoadingLessons(false);
        });

      // Fetch practice logs for exercise history
      getDocs(collection(db, `users/${user.id}/practiceLogs`))
        .then((snap) => {
          const logs: any[] = [];
          snap.forEach((d) => logs.push(d.data()));
          setExerciseHistory(logs);
        })
        .catch((e) => console.warn('History logs fetch:', e));
    }
  }, [user?.id, initialLesson]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatTurns, isGenerating, statusUpdate]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const parseVocabularyItems = (text: string): string[] => {
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
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

  const toggleLessonSelection = (id: string) => {
    setSelectedLessonIds((prev) =>
      prev.includes(id) ? prev.filter((lId) => lId !== id) : [...prev, id]
    );
  };

  const handleSelectAllLessons = () => {
    if (selectedLessonIds.length === lessonRecords.length) {
      setSelectedLessonIds([]);
    } else {
      setSelectedLessonIds(lessonRecords.map((l) => l.id));
    }
  };

  const handleSelectLastNLessons = (n: number) => {
    setSelectedLessonIds(lessonRecords.slice(0, n).map((l) => l.id));
  };

  const selectedLessons = lessonRecords.filter((l) => selectedLessonIds.includes(l.id));

  const currentSelectedVocabItems = Array.from(
    new Set(selectedLessons.flatMap((l) => parseVocabularyItems(l.vocabularyText)))
  );

  const handleSendChatMessage = async (overridePrompt?: string) => {
    const instructionToSend = overridePrompt || chatInput;
    if (!instructionToSend.trim() && selectedWords.length === 0) {
      setError('Wpisz instrukcję lub zaznacz słówka do wygenerowania.');
      return;
    }

    setError('');
    setIsGenerating(true);
    setStatusUpdate('Inicjalizacja pipeline\'u dwumodelowego AI...');

    const userMessageTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userTurn: ChatTurnItem = {
      id: generateId(),
      role: 'user',
      content: instructionToSend.trim() || `Wygeneruj ${numSentences} zdań z wybranymi słówkami (${selectedWords.join(', ')})`,
      timestamp: userMessageTime
    };

    setChatTurns((prev) => [...prev, userTurn]);
    if (!overridePrompt) setChatInput('');

    try {
      const formattedHistory: HomeworkChatMessage[] = chatTurns.map((turn) => ({
        role: turn.role,
        content: turn.content
      }));

      const pipelineResult = await generateHomeworkChatPipeline({
        studentProfile: {
          firstName: user.firstName,
          lastName: user.lastName,
          level: user.level,
          description: user.description,
          aiPrompt: user.aiPrompt
        },
        lessonHistory: selectedLessons,
        exerciseHistory: exerciseHistory.concat(user.frequentErrors || []),
        chatHistory: formattedHistory,
        teacherInstruction: instructionToSend,
        numSentences: numSentences,
        selectedWords: selectedWords,
        level: user.level || 'B1-B2',
        onStatusUpdate: (msg) => setStatusUpdate(msg)
      });

      const newMappedSentences = pipelineResult.sentences.map((s) => ({
        ...s,
        id: generateId(),
        accepted: true
      }));

      setGeneratedSentences(newMappedSentences);

      const aiTurn: ChatTurnItem = {
        id: generateId(),
        role: 'assistant',
        content: `Wygenerowano ${newMappedSentences.length} zdań dopasowanych do profilu kursanta i Twoich instrukcji.`,
        sentences: newMappedSentences,
        summaryText: pipelineResult.summaryText,
        modelInfo: pipelineResult.modelUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatTurns((prev) => [...prev, aiTurn]);
    } catch (err: any) {
      console.error(err);
      setError(`Błąd wygenerowania zdań przez AI: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
      setStatusUpdate('');
    }
  };

  const toggleSentenceAcceptance = (id: string) => {
    setGeneratedSentences((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: !s.accepted } : s))
    );
  };

  const handleUpdateSentence = (id: string, newPol: string, newEng: string, newHint: string) => {
    setGeneratedSentences((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, polishSentence: newPol, englishTranslation: newEng, englishSentence: newEng, hint: newHint }
          : s
      )
    );
  };

  const handleSaveTask = async () => {
    if (isSaving || isSavingRef.current) return;
    const finalSentences = generatedSentences.filter((s) => s.accepted);
    if (finalSentences.length === 0) {
      setError('Musisz zaakceptować przynajmniej jedno zdanie.');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setError('');

    try {
      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Kursant';
      const taskData = {
        studentId: user.id,
        studentIds: [user.id],
        userId: user.id,
        studentUid: user.id,
        studentName: studentName,
        studentEmail: user.email || '',
        studentUsername: user.username || '',
        assignedBy: 'Nauczyciel',
        type: 'translation',
        title: initialLesson ? `Praca domowa: ${initialLesson.topic}` : `Praca domowa - ${new Date().toLocaleDateString('pl-PL')}`,
        instructions: initialLesson ? `Ćwiczenia na tłumaczenie zdań z lekcji: ${initialLesson.topic}` : '',
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        sentences: finalSentences.map(({ polishSentence, englishTranslation, hint }) => ({
          polishSentence,
          englishTranslation,
          hint: hint || '',
        })),
      };

      await addDoc(collection(db, 'specialTasks'), taskData);
      await updateDoc(doc(db, 'users', user.id), { hasNewHomework: true });
      onTaskCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(`Błąd zapisu w bazie danych: ${err.message}`);
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-base-100 border border-white/10 rounded-2xl w-full max-w-4xl flex flex-col h-[92vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-base-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {i18n.t("Czat Generatora AI z 2-Modelową Pipeline")}
                </h2>
                <span className="text-[10px] font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                  GPT-4o mini → Gemini 3.1 Flash
                </span>
              </div>
              <p className="text-xs text-content-muted mt-0.5">
                {i18n.t("Kursant:")} <span className="text-white font-medium">{user.firstName} {user.lastName || ''}</span> ({user.level || 'B1-B2'})
                {initialLesson && (
                  <span className="ml-2 text-primary font-semibold">• Baza: {initialLesson.topic}</span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-content-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Initial Lesson Active Banner */}
        {initialLesson && (
          <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-b border-primary/25 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary font-bold uppercase text-[10px]">
                Lekcja źródłowa
              </span>
              <span className="text-white font-bold">{initialLesson.topic}</span>
              <span className="text-content-muted">({selectedWords.length} słówek wybranych)</span>
            </div>
            <button
              type="button"
              onClick={() => handleSendChatMessage(`Wygeneruj ${numSentences} zdań do tłumaczenia ze słownictwa z lekcji "${initialLesson.topic}": ${selectedWords.join(', ')}`)}
              disabled={isGenerating || selectedWords.length === 0}
              className="bg-primary hover:bg-primary/90 text-accent-ink font-bold px-3 py-1.5 rounded-xl shadow-[0_0_12px_rgba(114,240,180,0.3)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs hover:scale-105"
            >
              <Sparkles size={13} /> {isGenerating ? 'Generowanie...' : 'Generuj zdania teraz'}
            </button>
          </div>
        )}

        {/* Modal Body: Main Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Options: Multi-Lesson Selector Trigger & Vocabulary Picker */}
          <div className="p-3 sm:p-4 bg-base-200/30 border-b border-white/5 space-y-3 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(true)}
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                    selectedLessonIds.length > 0
                      ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/15'
                      : 'bg-base-100 border-white/10 text-content hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">
                      {selectedLessonIds.length === 0
                        ? 'Wybór lekcji kursanta: Brak wybranych (Kliknij, aby wybrać do analizy AI)'
                        : `Lekcje do analizy AI: ${selectedLessonIds.length} z ${lessonRecords.length} wybranych`}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold bg-white/10 px-2 py-0.5 rounded-lg shrink-0 text-white hover:bg-white/20">
                    {selectedLessonIds.length === 0 ? 'Wybierz lekcje ↗' : 'Zmień ↗'}
                  </span>
                </button>
              </div>

              {selectedLessonIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowVocabPreview((prev) => !prev)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-[11px] font-bold text-primary transition-all"
                  >
                    {showVocabPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showVocabPreview ? 'Ukryj słowa' : `Słówka z lekcji (${currentSelectedVocabItems.length})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLessonIds([])}
                    className="text-xs text-danger hover:underline px-2 py-1"
                  >
                    Wyczyść
                  </button>
                </div>
              )}
            </div>

            {/* Vocabulary Preview Section if lessons are selected */}
            {showVocabPreview && selectedLessonIds.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-content-muted">
                    Słownictwo z wybranych lekcji ({currentSelectedVocabItems.length} słówek):
                  </span>
                  {currentSelectedVocabItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllFromLesson(currentSelectedVocabItems)}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      {currentSelectedVocabItems.every((w) => selectedWords.includes(w))
                        ? 'Odznacz wszystkie'
                        : 'Zaznacz wszystkie'}
                    </button>
                  )}
                </div>

                {currentSelectedVocabItems.length === 0 ? (
                  <p className="text-[11px] text-content-muted italic">Brak zapisanych słówek w wybranych lekcjach.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {currentSelectedVocabItems.map((word, idx) => {
                      const isChecked = selectedWords.includes(word);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleWord(word)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                            isChecked
                              ? 'bg-primary text-accent-ink font-bold border-primary shadow-[0_0_10px_rgba(114,240,180,0.2)]'
                              : 'bg-base-100 border-white/10 text-content-muted hover:text-white hover:border-white/30'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '}{word}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat Messages Feed */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-base-100/50">
            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger p-3 rounded-xl text-xs flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError('')} className="hover:text-white">✕</button>
              </div>
            )}

            {chatTurns.map((turn) => (
              <div
                key={turn.id}
                className={`flex gap-3 max-w-3xl ${turn.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs ${
                    turn.role === 'user'
                      ? 'bg-primary text-accent-ink font-bold'
                      : 'bg-info/30 border border-info/30 text-info'
                  }`}
                >
                  {turn.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`flex flex-col space-y-2 max-w-[85%] ${
                    turn.role === 'user'
                      ? 'items-end'
                      : 'items-start'
                  }`}
                >
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      turn.role === 'user'
                        ? 'bg-primary/20 border border-primary/30 text-accent-ink rounded-tr-none'
                        : 'bg-base-200/90 border border-white/10 text-content-body rounded-tl-none space-y-3'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{turn.content}</div>

                    {turn.summaryText && (
                      <div className="p-2.5 bg-info/40 border border-info/20 rounded-xl text-xs text-info mt-2">
                        <div className="font-bold text-info mb-1 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-info" />
                          Analiza Gemini 3.1 Flash:
                        </div>
                        {turn.summaryText}
                      </div>
                    )}

                    {turn.modelInfo && (
                      <div className="text-[10px] text-content-muted font-mono pt-1">
                        Model: {turn.modelInfo} • {turn.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* In Progress Pipeline Status Banner */}
            {isGenerating && (
              <div className="flex gap-3 max-w-2xl animate-fadeIn">
                <div className="w-8 h-8 rounded-xl bg-info/30 border border-info/30 text-info flex items-center justify-center shrink-0 text-xs">
                  <div className="w-4 h-4 border-2 border-info border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="p-3 bg-info/40 border border-info/30 rounded-2xl rounded-tl-none text-xs text-info flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-info animate-pulse" />
                  <span>{statusUpdate || 'Przetwarzanie przez pipeline AI...'}</span>
                </div>
              </div>
            )}

            {/* Active Generated Sentences Preview Box */}
            {generatedSentences.length > 0 && (
              <div className="mt-4 p-4 bg-base-200/70 border border-primary/30 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    Wygenerowane zdania ({generatedSentences.filter((s) => s.accepted).length} / {generatedSentences.length} zaakceptowane)
                  </h3>
                  <span className="text-[11px] text-content-muted">
                    Możesz odznaczyć niechciane lub edytować treść
                  </span>
                </div>

                <div className="space-y-2.5">
                  {generatedSentences.map((s, index) => (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border transition-all ${
                        s.accepted
                          ? 'bg-base-100 border-white/10'
                          : 'bg-base-100/40 border-white/5 opacity-50'
                      }`}
                    >
                      {editingSentenceId === s.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-content-muted uppercase">Polski:</label>
                            <input
                              type="text"
                              value={s.polishSentence}
                              onChange={(e) => handleUpdateSentence(s.id, e.target.value, s.englishTranslation, s.hint)}
                              className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-content-muted uppercase">Angielski:</label>
                            <input
                              type="text"
                              value={s.englishTranslation}
                              onChange={(e) => handleUpdateSentence(s.id, s.polishSentence, e.target.value, s.hint)}
                              className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                          </div>
                          <button
                            onClick={() => setEditingSentenceId(null)}
                            className="text-xs bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-lg font-bold"
                          >
                            Zapisz edycję
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <p className="text-xs font-bold text-white">
                              {index + 1}. {s.polishSentence}
                            </p>
                            <p className="text-xs text-primary/90 font-medium">
                              {s.englishTranslation}
                            </p>
                            {s.hint && <p className="text-[11px] text-content-muted">Wskazówka: {s.hint}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingSentenceId(s.id)}
                              className="p-1.5 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
                              title="Edytuj zdanie"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleSentenceAcceptance(s.id)}
                              className={`p-1.5 rounded-lg text-xs transition-colors ${
                                s.accepted
                                  ? 'text-danger hover:bg-danger/20'
                                  : 'text-primary hover:bg-primary/20'
                              }`}
                              title={s.accepted ? 'Odrzuć' : 'Zaakceptuj'}
                            >
                              {s.accepted ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick Chat Modifiers */}
                <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2">
                  <span className="text-[11px] text-content-muted self-center mr-1">Szybka modyfikacja:</span>
                  <button
                    onClick={() => handleSendChatMessage("Zmień zdania na trudniejszy poziom z bardziej zaawansowanym słownictwem.")}
                    disabled={isGenerating}
                    className="text-[11px] bg-base-100 hover:bg-base-200 border border-white/10 text-content-body px-2.5 py-1 rounded-lg"
                  >
                    ⚡ Trudniejszy poziom
                  </button>
                  <button
                    onClick={() => handleSendChatMessage("Spraw, aby zdania brzmiały bardziej naturalnie i potocznie.")}
                    disabled={isGenerating}
                    className="text-[11px] bg-base-100 hover:bg-base-200 border border-white/10 text-content-body px-2.5 py-1 rounded-lg"
                  >
                    💬 Bardziej potoczne
                  </button>
                  <button
                    onClick={() => handleSendChatMessage("Zamień zdania na krótsze i prostsze struktury.")}
                    disabled={isGenerating}
                    className="text-[11px] bg-base-100 hover:bg-base-200 border border-white/10 text-content-body px-2.5 py-1 rounded-lg"
                  >
                    🌱 Prostsze zdania
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Chat Bar */}
          <div className="p-3 sm:p-4 bg-base-200/60 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-base-100 border border-white/10 rounded-xl px-3 py-2">
                <span className="text-xs text-content-muted">Liczba zdań:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numSentences}
                  onChange={(e) => setNumSentences(Math.max(1, parseInt(e.target.value) || 5))}
                  className="w-12 bg-transparent text-xs font-bold text-white outline-none text-center font-mono"
                />
              </div>

              <div className="flex-1 flex items-center gap-2 bg-base-100 border border-white/10 rounded-xl p-1.5 focus-within:border-primary/50 transition-colors">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Napisz instrukcję lub co chcesz zmienić w wygenerowanych zdaniach..."
                  className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-white outline-none"
                  disabled={isGenerating}
                />

                <Button
                  onClick={() => handleSendChatMessage()}
                  disabled={isGenerating || (!chatInput.trim() && selectedWords.length === 0)}
                  size="sm"
                  className="shrink-0"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1" />
                      <span>Wyślij</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-base-200 flex items-center justify-between">
          <span className="text-xs text-content-muted">
            {generatedSentences.filter((s) => s.accepted).length} z {generatedSentences.length} zdań zostanie przypisanych
          </span>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSaving} size="sm">
              Anuluj
            </Button>
            <Button
              onClick={handleSaveTask}
              disabled={isSaving || generatedSentences.filter((s) => s.accepted).length === 0}
              size="sm"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Zapisz i przypisz pracę domową
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <LessonSelectionModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        lessons={lessonRecords}
        isLoading={isLoadingLessons}
        selectedLessonIds={selectedLessonIds}
        onSave={(ids) => setSelectedLessonIds(ids)}
        studentName={user.firstName}
      />
    </div>
  );
};

export default TeacherSpecialTaskModal;

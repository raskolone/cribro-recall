import React, { useState, useEffect, useMemo } from 'react';
import { User, LessonRecord, HomeworkType } from '../../types';
import { BlueprintTopicMeta, BlueprintChapter, CEFRLevel, BlueprintSentence } from '../../types/blueprints';
import { getBlueprintIndex, getTopicsByLevel, getChapterDetails } from '../../services/blueprintService';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { generateSecureHomeworkToken } from '../../utils/token';
import { taskOwnerFields } from '../../utils/homework';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import Button from '../ui/Button';
import HomeworkEmailConfirmationModal from './HomeworkEmailConfirmationModal';
import {
  X,
  BookOpen,
  Sparkles,
  FileText,
  Check,
  CheckSquare,
  Square,
  Calendar,
  Layers,
  Search,
  ChevronDown,
  AlertTriangle,
  Send,
  Loader2
} from 'lucide-react';
import { formatStudentDisplayName } from '../../utils/studentFormat';

export interface AssignHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  students?: User[];
  initialLesson?: LessonRecord;
  onTaskCreated?: (task?: any) => void;
}

type MaterialSourceMode = 'lesson_notes' | 'grammar_blueprints';

const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const todayPlusDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const AssignHomeworkModal: React.FC<AssignHomeworkModalProps> = ({
  isOpen,
  onClose,
  user: initialUser,
  students = [],
  initialLesson,
  onTaskCreated,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialUser?.id || '');
  const [sourceMode, setSourceMode] = useState<MaterialSourceMode>(
    initialLesson ? 'lesson_notes' : 'grammar_blueprints'
  );

  // --- Grammar Blueprints state ---
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>(
    (initialUser?.level as CEFRLevel) && CEFR_LEVELS.includes(initialUser?.level as CEFRLevel)
      ? (initialUser?.level as CEFRLevel)
      : 'B1'
  );
  const [availableTopics, setAvailableTopics] = useState<BlueprintTopicMeta[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [currentChapter, setCurrentChapter] = useState<BlueprintChapter | null>(null);
  const [selectedSentenceIndexes, setSelectedSentenceIndexes] = useState<number[]>([]);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [contextualTopic, setContextualTopic] = useState('');

  // --- Lesson Notes state ---
  const [studentLessons, setStudentLessons] = useState<LessonRecord[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(initialLesson?.id || '');
  const [customVocabularyText, setCustomVocabularyText] = useState(initialLesson?.vocabularyText || '');
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);

  // --- Common Settings ---
  const [taskFormat, setTaskFormat] = useState<HomeworkType>('translation');
  const [dueDate, setDueDate] = useState(() => todayPlusDays(7));
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState('');

  // --- Email confirmation modal ---
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [pendingEmailTask, setPendingEmailTask] = useState<any>(null);

  useEscapeModal(isOpen && !isEmailModalOpen, onClose);

  // Sync active student
  useEffect(() => {
    if (initialUser?.id) {
      setSelectedStudentId(initialUser.id);
    }
  }, [initialUser]);

  const activeStudent = useMemo(() => {
    if (initialUser && initialUser.id === selectedStudentId) return initialUser;
    return students.find((s) => s.id === selectedStudentId) || initialUser || null;
  }, [initialUser, selectedStudentId, students]);

  // Load topics for selected level
  useEffect(() => {
    try {
      const topics = getTopicsByLevel(selectedLevel);
      setAvailableTopics(topics);
      if (topics.length > 0) {
        setSelectedTopicId(topics[0].id);
      } else {
        setSelectedTopicId('');
      }
    } catch (e) {
      console.error('Błąd ładowania tematów:', e);
    }
  }, [selectedLevel]);

  // Load chapter sentences when topic changes
  useEffect(() => {
    if (!selectedTopicId) {
      setCurrentChapter(null);
      setSelectedSentenceIndexes([]);
      return;
    }
    let active = true;
    setIsLoadingChapter(true);
    getChapterDetails(selectedLevel, selectedTopicId)
      .then((chap) => {
        if (!active) return;
        if (chap) {
          setCurrentChapter(chap);
          // Domyślnie zaznacz pierwsze 6 zdań
          const count = Math.min(6, chap.sentences.length);
          setSelectedSentenceIndexes(Array.from({ length: count }, (_, i) => i));
        } else {
          setCurrentChapter(null);
          setSelectedSentenceIndexes([]);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Błąd wczytywania rozdziału:', err);
        setCurrentChapter(null);
      })
      .finally(() => {
        if (active) setIsLoadingChapter(false);
      });

    return () => {
      active = false;
    };
  }, [selectedLevel, selectedTopicId]);

  // Load student lessons if in lesson_notes mode
  useEffect(() => {
    if (sourceMode !== 'lesson_notes' || !selectedStudentId) return;
    setIsLoadingLessons(true);
    getLessonRecordsForStudent(selectedStudentId)
      .then((records) => {
        setStudentLessons(records);
        if (records.length > 0 && !selectedLessonId) {
          setSelectedLessonId(records[0].id);
          setCustomVocabularyText(records[0].vocabularyText || '');
        }
      })
      .catch((e) => console.error('Błąd ładowania lekcji:', e))
      .finally(() => setIsLoadingLessons(false));
  }, [sourceMode, selectedStudentId]);

  // Update vocabulary text when lesson selection changes
  useEffect(() => {
    if (selectedLessonId) {
      const l = studentLessons.find((rec) => rec.id === selectedLessonId);
      if (l) {
        setCustomVocabularyText(l.vocabularyText || '');
      }
    }
  }, [selectedLessonId, studentLessons]);

  if (!isOpen) return null;

  const toggleSentence = (idx: number) => {
    setSelectedSentenceIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const selectFirstN = (n: number) => {
    if (!currentChapter) return;
    const count = Math.min(n, currentChapter.sentences.length);
    setSelectedSentenceIndexes(Array.from({ length: count }, (_, i) => i));
  };

  const selectAll = () => {
    if (!currentChapter) return;
    setSelectedSentenceIndexes(Array.from({ length: currentChapter.sentences.length }, (_, i) => i));
  };

  const clearAll = () => {
    setSelectedSentenceIndexes([]);
  };

  const filteredTopics = availableTopics.filter((t) => {
    if (!topicSearchQuery.trim()) return true;
    const q = topicSearchQuery.toLowerCase();
    return (
      (t.titlePl && t.titlePl.toLowerCase().includes(q)) ||
      (t.titleEn && t.titleEn.toLowerCase().includes(q))
    );
  });

  const handleAssign = async () => {
    if (!selectedStudentId) {
      setError('Wybierz kursanta, któremu przypisujesz zadanie.');
      return;
    }

    if (sourceMode === 'grammar_blueprints' && selectedSentenceIndexes.length === 0) {
      setError('Zaznacz przynajmniej jedno zdanie do pracy domowej.');
      return;
    }

    setIsAssigning(true);
    setError('');

    try {
      const studentName = activeStudent ? formatStudentDisplayName(activeStudent) : 'Kursant';
      const nowIso = new Date().toISOString();
      const accessToken = generateSecureHomeworkToken();
      const accessExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro';
      const accessUrl = `${origin}/hw?token=${accessToken}`;

      let title = '';
      let sentencesPayload: any[] = [];
      let instructions = '';

      if (sourceMode === 'grammar_blueprints') {
        const topic = availableTopics.find((t) => t.id === selectedTopicId);
        const topicName = topic ? `${topic.titlePl} (${selectedLevel})` : `Wzorce gramatyczne ${selectedLevel}`;
        title = topicName;
        if (contextualTopic.trim()) {
          title += ` • ${contextualTopic.trim()}`;
        }

        instructions =
          taskFormat === 'find_errors'
            ? 'Znajdź i popraw błędy w poniższych zdaniach, stosując właściwy wzorzec gramatyczny.'
            : taskFormat === 'word_order'
            ? 'Ułóż słowa w poprawnej kolejności, aby utworzyć poprawne zdanie.'
            : 'Przetłumacz poniższe zdania na język angielski, zwracając uwagę na precyzję i ćwiczony wzorzec.';

        const chosen = (currentChapter?.sentences || []).filter((_, idx) =>
          selectedSentenceIndexes.includes(idx)
        );

        sentencesPayload = chosen.map((s) => ({
          polishSentence: s.polish,
          englishTranslation: s.english,
          hint: topic?.titleEn || '',
          targetWordUsed: topic?.titleEn || '',
        }));
      } else {
        // Lesson notes mode
        const selLesson = studentLessons.find((l) => l.id === selectedLessonId);
        title = selLesson ? `Praca domowa: ${selLesson.topic}` : `Praca domowa z notatek`;
        instructions = 'Przetłumacz zdania oparte o słownictwo i zagadnienia z lekcji.';

        const lines = customVocabularyText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

        sentencesPayload = lines.slice(0, 8).map((line) => {
          const parts = line.split(/[—–-]/).map((p) => p.trim());
          if (parts.length >= 2) {
            return {
              polishSentence: parts[1],
              englishTranslation: parts[0],
              hint: '',
            };
          }
          return {
            polishSentence: line,
            englishTranslation: line,
            hint: '',
          };
        });
      }

      const taskPayload: any = {
        ...taskOwnerFields(selectedStudentId),
        studentName,
        studentEmail: activeStudent?.email || '',
        studentUsername: activeStudent?.username || '',
        title,
        type: taskFormat,
        instructions,
        createdAt: nowIso,
        dueDate,
        status: 'pending',
        sentences: sentencesPayload,
        manualEmailConfirmationRequired: true,
        skipAutoEmail: true,
        emailNotificationSent: false,
        accessToken,
        accessExpiresAt,
        accessUrl,
        ...(sourceMode === 'lesson_notes' && selectedLessonId ? { lessonId: selectedLessonId } : {}),
      };

      const docRef = await addDoc(collection(db, 'specialTasks'), taskPayload);

      try {
        await updateDoc(doc(db, 'users', selectedStudentId), { hasNewHomework: true });
      } catch (err) {
        console.warn('Nie udało się zaktualizować flagi hasNewHomework:', err);
      }

      const createdTask = {
        id: docRef.id,
        ...taskPayload,
        itemCount: sentencesPayload.length,
      };

      if (onTaskCreated) {
        onTaskCreated(createdTask);
      }

      setPendingEmailTask(createdTask);
      setIsEmailModalOpen(true);
    } catch (err: any) {
      console.error('Błąd przypisywania pracy domowej:', err);
      setError(err?.message || 'Nie udało się przypisać pracy domowej.');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div className="bg-ink-2 border border-white/10 rounded-2xl w-full max-w-3xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 bg-base-200/50 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white">Zadaj pracę domową</h2>
                  {activeStudent && (
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {formatStudentDisplayName(activeStudent)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-content-muted mt-0.5">
                  Wybierz materiał z bazy wzorców lub notatek z lekcji i przypisz zadanie kursantowi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
            {/* Opcjonalny wybór kursanta (jeśli nie przekazano lub zmiana) */}
            {students.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Kursant docelowy:</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-base-100 border border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-primary focus:outline-none"
                >
                  <option value="">— Wybierz kursanta —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatStudentDisplayName(s)} {s.level ? `(${s.level})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Źródło materiału (Switcher) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Źródło materiału:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSourceMode('lesson_notes')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    sourceMode === 'lesson_notes'
                      ? 'bg-primary/15 border-primary text-primary shadow-sm'
                      : 'border-white/10 text-content-muted hover:text-white bg-base-100/40'
                  }`}
                >
                  <FileText size={15} />
                  <span>📝 Notatka lekcyjna</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('grammar_blueprints')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    sourceMode === 'grammar_blueprints'
                      ? 'bg-primary/15 border-primary text-primary shadow-sm'
                      : 'border-white/10 text-content-muted hover:text-white bg-base-100/40'
                  }`}
                >
                  <BookOpen size={15} />
                  <span>📚 Wzorce Gramatyczne</span>
                </button>
              </div>
            </div>

            {/* SEKJCA 1: Wzorce gramatyczne */}
            {sourceMode === 'grammar_blueprints' && (
              <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
                {/* CEFR Level Tabs */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Poziom zaawansowania (CEFR):</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CEFR_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSelectedLevel(lvl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedLevel === lvl
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-base-100 border border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      Wybierz temat ({availableTopics.length} w poziomie {selectedLevel}):
                    </label>
                    <div className="relative w-44">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Szukaj tematu..."
                        value={topicSearchQuery}
                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                        className="w-full bg-base-100/80 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full bg-base-100 border border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-emerald-400 focus:outline-none"
                  >
                    {filteredTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.chapterNumber}. {t.titlePl} ({t.titleEn})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sentences List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-300">
                      Zdania wzorcowe ({selectedSentenceIndexes.length} z {currentChapter?.sentences.length || 0} zaznaczonych):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectFirstN(6)}
                        className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition"
                      >
                        Zaznacz pierwsze 6
                      </button>
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-[11px] font-semibold px-2 py-1 rounded bg-white/5 text-slate-300 hover:bg-white/10 transition"
                      >
                        Wszystkie
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-[11px] font-semibold px-2 py-1 rounded bg-white/5 text-slate-400 hover:bg-white/10 transition"
                      >
                        Wyczyść
                      </button>
                    </div>
                  </div>

                  {isLoadingChapter ? (
                    <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      Ładowanie zdań wzorcowych...
                    </div>
                  ) : currentChapter && currentChapter.sentences.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-base-100/60 border border-white/10 custom-scrollbar">
                      {currentChapter.sentences.map((sent, idx) => {
                        const isChecked = selectedSentenceIndexes.includes(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleSentence(idx)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                              isChecked
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                                : 'bg-base-200/40 border-white/5 text-slate-400 hover:border-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSentence(idx)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded mt-0.5 border-slate-700 bg-slate-900 text-emerald-400 focus:ring-0 cursor-pointer accent-emerald-400 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white">{sent.polish}</div>
                              <div className="text-[11px] text-emerald-400/90 font-mono mt-0.5">{sent.english}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 p-4 text-center">Brak zdań dla wybranego tematu.</p>
                  )}
                </div>

                {/* Kontekst tematyczny (opcjonalny) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Kontekst tematyczny <span className="text-slate-500 font-normal">(opcjonalny, np. podróże, zakupy, praca w IT)</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="np. Sytuacje na lotnisku i odprawa celna"
                    value={contextualTopic}
                    onChange={(e) => setContextualTopic(e.target.value)}
                    className="w-full bg-base-100 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* SEKCJA 2: Notatki lekcyjne */}
            {sourceMode === 'lesson_notes' && (
              <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Wybierz lekcję kursanta:</label>
                  {isLoadingLessons ? (
                    <p className="text-xs text-slate-400">Ładowanie lekcji...</p>
                  ) : studentLessons.length > 0 ? (
                    <select
                      value={selectedLessonId}
                      onChange={(e) => setSelectedLessonId(e.target.value)}
                      className="w-full bg-base-100 border border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-primary focus:outline-none"
                    >
                      {studentLessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.date || 'Brak daty'} — {l.topic || 'Bez tematu'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-400">Ten kursant nie ma zapisanych lekcji. Możesz wpisać słownictwo poniżej.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Słownictwo / zdania z lekcji:</label>
                  <textarea
                    rows={4}
                    value={customVocabularyText}
                    onChange={(e) => setCustomVocabularyText(e.target.value)}
                    placeholder="Wklej słówka lub zdania (np. word — słowo)..."
                    className="w-full bg-base-100 border border-white/15 rounded-xl p-3 text-xs text-white font-mono focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Ustawienia zadania: Format i Termin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Format zadania:</label>
                <select
                  value={taskFormat}
                  onChange={(e) => setTaskFormat(e.target.value as HomeworkType)}
                  className="w-full bg-base-100 border border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-primary focus:outline-none"
                >
                  <option value="translation">Tłumaczenie zdań (PL ➔ EN)</option>
                  <option value="word_order">Rozsypanka słów (Puzzle zdań)</option>
                  <option value="find_errors">Poprawianie błędów</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Termin oddania (Due date):</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-base-100 border border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-white/10 bg-base-200/50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-base-100 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              Anuluj
            </button>

            <button
              type="button"
              onClick={handleAssign}
              disabled={isAssigning}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isAssigning ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Przypisywanie...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Przypisz zadanie domowe</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Email confirmation modal */}
      {isEmailModalOpen && pendingEmailTask && (
        <HomeworkEmailConfirmationModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setPendingEmailTask(null);
            onClose();
          }}
          task={pendingEmailTask}
          student={activeStudent}
          onEmailSent={() => {
            setIsEmailModalOpen(false);
            setPendingEmailTask(null);
            onClose();
          }}
          onSkip={() => {
            setIsEmailModalOpen(false);
            setPendingEmailTask(null);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default AssignHomeworkModal;

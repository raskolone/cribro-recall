import React, { useEffect, useState, useMemo } from 'react';
import {
  BookMarked,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Tag,
  Target,
  AlertCircle,
  ArrowRight,
  Loader2,
  BookOpen,
  Layers,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Play,
  Brain,
  X,
  Volume2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LessonRecord } from '../../types';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { getApprovedItemsForLesson } from '../../services/studentContext';
import { splitVocabularyLines, cleanVocabularyTopic } from '../../utils/vocabulary';
import TTSButtons from '../flashcards/TTSButtons';

interface StudentLessonHistoryProps {
  onStudySet?: (setId: string) => void;
  onNavigate?: (view: string, extra?: any) => void;
}

interface ParsedVocabItem {
  word: string;
  translation: string | null;
}

const parseVocabularyLine = (line: string): ParsedVocabItem => {
  let cleanLine = line.replace(/^[\s\*\-\•\d\.]+\s*/, '').trim();
  const separatorMatch = cleanLine.match(/\s+[\-\–\—\:=]\s+/);
  if (separatorMatch && separatorMatch.index !== undefined) {
    const word = cleanLine.substring(0, separatorMatch.index).trim();
    const translation = cleanLine.substring(separatorMatch.index + separatorMatch[0].length).trim();
    return { word, translation };
  } else {
    const fallbackMatch = cleanLine.match(/[:=]/) || cleanLine.match(/[\-\–\—]/);
    if (fallbackMatch && fallbackMatch.index !== undefined) {
      const word = cleanLine.substring(0, fallbackMatch.index).trim();
      const translation = cleanLine.substring(fallbackMatch.index + fallbackMatch[0].length).trim();
      return { word, translation };
    }
  }
  return { word: cleanLine, translation: null };
};

const StudentLessonHistory: React.FC<StudentLessonHistoryProps> = ({
  onStudySet,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';

  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLessonIds, setExpandedLessonIds] = useState<Record<string, boolean>>({});
  const [approvedItemsMap, setApprovedItemsMap] = useState<Record<string, string[]>>({});
  const [showRepeatModal, setShowRepeatModal] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.id || user.id === 'demo-id') {
        setIsLoading(false);
        return;
      }
      try {
        const records = await getLessonRecordsForStudent(user.id);
        if (!active) return;
        setLessons(records);

        // Fetch approved items for the latest lesson (and others as needed)
        if (records.length > 0) {
          const latest = records[0];
          if (latest.vocabularySetId) {
            const approved = await getApprovedItemsForLesson(user.id, latest.vocabularySetId);
            if (active && approved) {
              setApprovedItemsMap((prev) => ({ ...prev, [latest.id]: approved }));
            }
          }
        }
      } catch (error) {
        console.error('Nie udało się wczytać historii lekcji:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggleExpand = async (lesson: LessonRecord) => {
    const isCurrentlyExpanded = expandedLessonIds[lesson.id];
    setExpandedLessonIds((prev) => ({
      ...prev,
      [lesson.id]: !isCurrentlyExpanded,
    }));

    // If expanding and approved items not fetched yet, fetch them
    if (!isCurrentlyExpanded && !approvedItemsMap[lesson.id] && lesson.vocabularySetId && user?.id) {
      try {
        const approved = await getApprovedItemsForLesson(user.id, lesson.vocabularySetId);
        if (approved) {
          setApprovedItemsMap((prev) => ({ ...prev, [lesson.id]: approved }));
        }
      } catch (e) {
        console.warn('Could not fetch approved items for lesson:', lesson.id, e);
      }
    }
  };

  const L =
    language === 'pl'
      ? {
          sectionTitle: 'Historia lekcji',
          latestLessonBadge: 'Ostatnia lekcja',
          pastLessonsTitle: 'Wcześniejsze lekcje',
          summary: 'Co przerabialiśmy',
          items: 'Słownictwo z lekcji',
          nextStep: 'Twój następny krok',
          teacherSpeaking: 'O czym mówił kursant (notatka lektora)',
          thingsToImprove: 'Do poprawy (wskazówki lektora)',
          studyFlashcards: 'Fiszki z lekcji',
          practiceAI: 'Przećwicz z AI',
          repeatLessonBtn: 'Powtórz ostatnią lekcję',
          repeatModalTitle: 'Powtórka ostatniej lekcji',
          repeatModalSubtitle: 'Wybierz formę utrwalenia materiału z ostatnich zajęć:',
          searchPlaceholder: 'Szukaj w lekcjach (temat, słownictwo)...',
          noLessonTitle: 'Pierwsza lekcja jeszcze przed Tobą',
          noLessonBody:
            'Gdy lektor zapisze notatki po zajęciach, znajdziesz tu pełne podsumowanie, słownictwo i wskazówki.',
          emptyNotes: 'Lektor nie dodał jeszcze szczegółowych notatek do tej lekcji.',
          wordsCount: (n: number) => `${n} ${n === 1 ? 'słowo' : n < 5 ? 'słowa' : 'słów'}`,
          lessonNumber: (n: number) => `Lekcja #${n}`,
          viewNotes: 'Rozwiń notatki',
          hideNotes: 'Zwiń notatki',
          noSearchResults: 'Brak lekcji pasujących do wyszukiwania.',
          expandAll: 'Rozwiń wszystkie',
          collapseAll: 'Zwiń wszystkie',
        }
      : {
          sectionTitle: 'Lesson History',
          latestLessonBadge: 'Latest Lesson',
          pastLessonsTitle: 'Previous Lessons',
          summary: 'What we covered',
          items: 'Vocabulary from lesson',
          nextStep: 'Your next step',
          teacherSpeaking: 'Student speaking (Teacher note)',
          thingsToImprove: 'Things to improve (Teacher feedback)',
          studyFlashcards: 'Study Flashcards',
          practiceAI: 'Practice with AI',
          repeatLessonBtn: 'Repeat latest lesson',
          repeatModalTitle: 'Review Latest Lesson',
          repeatModalSubtitle: 'Choose how you want to review the latest lesson material:',
          searchPlaceholder: 'Search lessons (topic, vocabulary)...',
          noLessonTitle: 'Your first lesson is still ahead',
          noLessonBody:
            'Once your teacher saves a record after class, you will find the summary, vocabulary and tips here.',
          emptyNotes: 'Your teacher has not added detailed notes to this lesson yet.',
          wordsCount: (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`,
          lessonNumber: (n: number) => `Lesson #${n}`,
          viewNotes: 'Expand notes',
          hideNotes: 'Collapse notes',
          noSearchResults: 'No lessons matching your search.',
          expandAll: 'Expand all',
          collapseAll: 'Collapse all',
        };

  const filteredLessons = useMemo(() => {
    if (!searchQuery.trim()) return lessons;
    const q = searchQuery.toLowerCase().trim();
    return lessons.filter((lesson) => {
      const topicMatch = lesson.topic?.toLowerCase().includes(q);
      const summaryMatch = lesson.lessonSummary?.toLowerCase().includes(q);
      const vocabMatch = lesson.vocabularyText?.toLowerCase().includes(q);
      const dateMatch = lesson.date?.includes(q);
      return topicMatch || summaryMatch || vocabMatch || dateMatch;
    });
  }, [lessons, searchQuery]);

  const formatDate = (dateStr: string) => {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getLessonItems = (lesson: LessonRecord): ParsedVocabItem[] => {
    const approved = approvedItemsMap[lesson.id];
    if (approved && approved.length > 0) {
      return approved.map(parseVocabularyLine);
    }
    if (lesson.vocabularyText) {
      return splitVocabularyLines(lesson.vocabularyText).map(parseVocabularyLine);
    }
    return [];
  };

  const handleStartFlashcardReview = (lessonId: string) => {
    setShowRepeatModal(false);
    if (onStudySet) {
      onStudySet(`lesson_${lessonId}`);
    } else if (onNavigate) {
      onNavigate('flashcard-study', { setId: `lesson_${lessonId}` });
    }
  };

  const handleStartAIPractice = (lessonId: string) => {
    setShowRepeatModal(false);
    if (onNavigate) {
      onNavigate('ai-generator', { setId: `lesson_${lessonId}` });
    }
  };

  const handleStartGeneralPractice = (lessonId: string) => {
    setShowRepeatModal(false);
    if (onNavigate) {
      onNavigate('practice', { setId: `lesson_${lessonId}` });
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-8 flex items-center justify-center gap-3 text-content-muted text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span>{language === 'pl' ? 'Wczytywanie historii lekcji…' : 'Loading lesson history…'}</span>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-base-200/50 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto text-primary">
          <BookMarked className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">{L.noLessonTitle}</h2>
        <p className="text-sm text-content-muted max-w-md mx-auto leading-relaxed">
          {L.noLessonBody}
        </p>
      </section>
    );
  }

  const latestLesson = lessons[0];
  const pastLessons = lessons.slice(1);
  const latestItems = getLessonItems(latestLesson);
  const latestCleanTopic = cleanVocabularyTopic(latestLesson.topic) || latestLesson.topic;

  return (
    <div className="space-y-6">
      {/* Section Header with count, search and Repeat Latest Lesson Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              {L.sectionTitle}
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-primary border border-primary/20">
                {lessons.length}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Repeat Latest Lesson Button */}
          {latestLesson && (
            <button
              onClick={() => setShowRepeatModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary text-accent-ink hover:brightness-110 font-bold text-xs shadow-[0_0_15px_rgba(114,240,180,0.3)] transition-all active:scale-95 shrink-0"
              title={L.repeatLessonBtn}
            >
              <RotateCcw size={14} className="animate-spin-slow" />
              <span>{L.repeatLessonBtn}</span>
            </button>
          )}

          {lessons.length > 1 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={L.searchPlaceholder}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-base-200/80 border border-white/10 rounded-xl text-white placeholder-content-muted focus:border-primary/50 focus:outline-none transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* Featured Latest Lesson Card (only when no active search filtering out the latest lesson) */}
      {!searchQuery && latestLesson && (
        <section className="rounded-2xl border border-primary/30 bg-base-200/70 shadow-lg shadow-black/20 overflow-hidden relative group">
          {/* Subtle top accent line */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-transparent" />

          {/* Header Bar */}
          <header className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-mono font-bold">
                {L.lessonNumber(lessons.length)}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-primary text-accent-ink text-xs font-extrabold uppercase tracking-wider">
                {L.latestLessonBadge}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-content-muted font-mono">
                <Calendar size={13} className="text-primary" />
                {formatDate(latestLesson.date)}
              </span>
            </div>

            {/* Action buttons for latest lesson */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowRepeatModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-accent-ink hover:brightness-110 font-bold text-xs shadow-sm transition-all active:scale-95"
                title={L.repeatLessonBtn}
              >
                <RotateCcw size={13} />
                <span>{L.repeatLessonBtn}</span>
              </button>
              {latestItems.length > 0 && onStudySet && (
                <button
                  onClick={() => onStudySet(`lesson_${latestLesson.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-accent-ink font-bold text-xs border border-primary/30 transition-all active:scale-95 shadow-sm"
                  title={L.studyFlashcards}
                >
                  <span>🎴</span>
                  <span>{L.studyFlashcards}</span>
                </button>
              )}
              {latestItems.length > 0 && onNavigate && (
                <button
                  onClick={() =>
                    onNavigate('ai-generator', { setId: `lesson_${latestLesson.id}` })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-content hover:text-white font-bold text-xs border border-white/10 hover:border-primary/30 transition-all active:scale-95"
                  title={L.practiceAI}
                >
                  <Sparkles size={13} className="text-primary" />
                  <span>{L.practiceAI}</span>
                </button>
              )}
            </div>
          </header>

          {/* Body Content - ONLY Summary, Vocabulary and Things to Improve for students */}
          <div className="p-5 sm:p-6 space-y-6">
            {/* Topic Title */}
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                {latestCleanTopic}
              </h3>
            </div>

            {/* Summary (PODSUMOWANIE - Tekst wyjustowany) */}
            {latestLesson.lessonSummary && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" />
                  {L.summary}
                </h4>
                <div className="text-sm text-content leading-relaxed text-justify [text-align:justify] hyphens-auto prose prose-invert max-w-none [&>p]:text-justify [&>p]:leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                  <Markdown>{latestLesson.lessonSummary}</Markdown>
                </div>
              </div>
            )}

            {/* Vocabulary list with TTS (SŁOWNICTWO) */}
            {latestItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={13} className="text-primary" />
                    {L.items}
                    <span className="text-[11px] font-mono text-primary font-bold ml-1">
                      ({latestItems.length})
                    </span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {latestItems.map((item, idx) => (
                    <div
                      key={`${idx}-${item.word}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 transition-colors group/item"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white text-sm group-hover/item:text-primary transition-colors truncate">
                          {item.word}
                        </p>
                        {item.translation && (
                          <p className="text-xs text-content-muted truncate mt-0.5">
                            {item.translation}
                          </p>
                        )}
                      </div>
                      <TTSButtons text={item.word} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Things to improve (RZECZY DO POPRAWY) */}
            {latestLesson.thingsToImprove && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  {L.thingsToImprove}
                </h4>
                <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none bg-danger/10 p-4 rounded-xl border border-danger/20">
                  <Markdown>{latestLesson.thingsToImprove}</Markdown>
                </div>
              </div>
            )}

            {/* Teacher-only: Student Speaking (O czym mówił kursant) */}
            {isTeacher && latestLesson.studentSpeaking && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-info uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  {L.teacherSpeaking}
                </h4>
                <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none bg-info/10 p-4 rounded-xl border border-info/20">
                  <Markdown>{latestLesson.studentSpeaking}</Markdown>
                </div>
              </div>
            )}

            {/* Teacher-only: Suggested next step */}
            {isTeacher && latestLesson.suggestedFollowUp && (
              <div className="rounded-xl bg-warn/10 border border-warn/20 p-4 space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-warn uppercase tracking-wider">
                  <Target size={14} />
                  {L.nextStep}
                </h4>
                <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none">
                  <Markdown>{latestLesson.suggestedFollowUp}</Markdown>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Past Lessons / Search Results List */}
      {searchQuery ? (
        /* Search results view */
        <div className="space-y-4">
          {filteredLessons.length === 0 ? (
            <div className="text-center p-8 rounded-2xl border border-white/10 bg-base-200/50 text-content-muted text-sm">
              {L.noSearchResults}
            </div>
          ) : (
            filteredLessons.map((lesson) => {
              const globalIndex = lessons.findIndex((l) => l.id === lesson.id);
              const lessonNum = lessons.length - globalIndex;
              const isExpanded = expandedLessonIds[lesson.id] ?? true;
              const items = getLessonItems(lesson);
              const cleanTopic = cleanVocabularyTopic(lesson.topic) || lesson.topic;

              return (
                <div
                  key={lesson.id}
                  className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden transition-all hover:border-white/20"
                >
                  <div
                    onClick={() => toggleExpand(lesson)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        #{lessonNum}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-base truncate">{cleanTopic}</h4>
                        <div className="flex items-center gap-2 text-xs font-mono text-content-muted mt-0.5">
                          <Calendar size={12} className="text-primary" />
                          <span>{formatDate(lesson.date)}</span>
                          {items.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{L.wordsCount(items.length)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-content-muted" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-content-muted" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-white/10 space-y-5 bg-black/20">
                      {/* Summary (Podsumowanie wyjustowane) */}
                      {lesson.lessonSummary && (
                        <div>
                          <h5 className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Sparkles size={13} className="text-primary" />
                            {L.summary}
                          </h5>
                          <div className="text-sm text-content leading-relaxed text-justify [text-align:justify] hyphens-auto prose prose-invert max-w-none [&>p]:text-justify [&>p]:leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                            <Markdown>{lesson.lessonSummary}</Markdown>
                          </div>
                        </div>
                      )}

                      {/* Vocabulary (Słownictwo) */}
                      {items.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Tag size={13} className="text-primary" />
                            {L.items} ({items.length})
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white">{item.word}</span>
                                  {item.translation && (
                                    <span className="text-content-muted ml-2">
                                      - {item.translation}
                                    </span>
                                  )}
                                </div>
                                <TTSButtons text={item.word} size="sm" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Things to improve (Rzeczy do poprawy) */}
                      {lesson.thingsToImprove && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                            <AlertCircle size={13} />
                            {L.thingsToImprove}
                          </h5>
                          <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none bg-danger/10 p-4 rounded-xl border border-danger/20">
                            <Markdown>{lesson.thingsToImprove}</Markdown>
                          </div>
                        </div>
                      )}

                      {/* Teacher-only: Student Speaking */}
                      {isTeacher && lesson.studentSpeaking && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-info uppercase tracking-wider flex items-center gap-1.5">
                            <AlertCircle size={13} />
                            {L.teacherSpeaking}
                          </h5>
                          <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none bg-info/10 p-4 rounded-xl border border-info/20">
                            <Markdown>{lesson.studentSpeaking}</Markdown>
                          </div>
                        </div>
                      )}

                      {/* Teacher-only: Suggested Follow-up */}
                      {isTeacher && lesson.suggestedFollowUp && (
                        <div className="rounded-lg bg-warn/10 border border-warn/20 p-3">
                          <h5 className="text-xs font-bold text-warn uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Target size={13} /> {L.nextStep}
                          </h5>
                          <div className="text-sm text-content prose prose-invert max-w-none">
                            <Markdown>{lesson.suggestedFollowUp}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Standard Past Lessons Section */
        pastLessons.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} className="text-primary" />
                {L.pastLessonsTitle} ({pastLessons.length})
              </h3>

              <button
                onClick={() => {
                  const allExpanded = pastLessons.every((l) => expandedLessonIds[l.id]);
                  const nextState: Record<string, boolean> = {};
                  pastLessons.forEach((l) => {
                    nextState[l.id] = !allExpanded;
                  });
                  setExpandedLessonIds((prev) => ({ ...prev, ...nextState }));
                }}
                className="text-xs font-semibold text-content-muted hover:text-primary transition-colors"
              >
                {pastLessons.every((l) => expandedLessonIds[l.id])
                  ? L.collapseAll
                  : L.expandAll}
              </button>
            </div>

            <div className="space-y-3">
              {pastLessons.map((lesson, idx) => {
                const lessonNum = pastLessons.length - idx;
                const isExpanded = expandedLessonIds[lesson.id] ?? false;
                const items = getLessonItems(lesson);
                const cleanTopic = cleanVocabularyTopic(lesson.topic) || lesson.topic;

                return (
                  <div
                    key={lesson.id}
                    className={`rounded-2xl border transition-all ${
                      isExpanded
                        ? 'border-primary/30 bg-base-200/80 shadow-md'
                        : 'border-white/10 bg-base-200/50 hover:border-white/20 hover:bg-base-200/70'
                    } overflow-hidden`}
                  >
                    {/* Collapsible Card Header */}
                    <div
                      onClick={() => toggleExpand(lesson)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-xl font-mono font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                            isExpanded
                              ? 'bg-primary text-accent-ink'
                              : 'bg-primary/10 border border-primary/30 text-primary group-hover:bg-primary/20'
                          }`}
                        >
                          #{lessonNum}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-base group-hover:text-primary transition-colors truncate">
                            {cleanTopic}
                          </h4>
                          <div className="flex items-center gap-2 text-xs font-mono text-content-muted mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-primary" />
                              {formatDate(lesson.date)}
                            </span>
                            {items.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-primary/90 font-medium">
                                  {L.wordsCount(items.length)}
                                </span>
                              </>
                            )}
                            {lesson.lessonSummary && (
                              <>
                                <span>•</span>
                                <span className="text-content-muted hidden sm:inline truncate max-w-xs">
                                  {lesson.lessonSummary.replace(/[#*`_]/g, '').slice(0, 50)}...
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-content-muted group-hover:text-primary transition-colors hidden sm:inline">
                          {isExpanded ? L.hideNotes : L.viewNotes}
                        </span>
                        <div
                          className={`p-1.5 rounded-lg bg-white/5 text-content-muted group-hover:text-white transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-primary' : ''
                          }`}
                        >
                          <ChevronDown size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 border-t border-white/10 space-y-6 bg-black/20">
                        {/* Quick actions for past lesson */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {items.length > 0 && onStudySet && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStudySet(`lesson_${lesson.id}`);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-accent-ink font-bold text-xs border border-primary/30 transition-all active:scale-95 shadow-sm"
                            >
                              <span>🎴</span>
                              <span>{L.studyFlashcards}</span>
                            </button>
                          )}
                          {items.length > 0 && onNavigate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('ai-generator', { setId: `lesson_${lesson.id}` });
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-content hover:text-white font-bold text-xs border border-white/10 hover:border-primary/30 transition-all active:scale-95"
                            >
                              <Sparkles size={13} className="text-primary" />
                              <span>{L.practiceAI}</span>
                            </button>
                          )}
                        </div>

                        {/* Summary (Wyjustowane) */}
                        {lesson.lessonSummary ? (
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles size={13} className="text-primary" />
                              {L.summary}
                            </h5>
                            <div className="text-sm text-content leading-relaxed text-justify [text-align:justify] hyphens-auto prose prose-invert max-w-none [&>p]:text-justify [&>p]:leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                              <Markdown>{lesson.lessonSummary}</Markdown>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-content-muted italic">{L.emptyNotes}</p>
                        )}

                        {/* Vocabulary */}
                        {items.length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                              <Tag size={13} className="text-primary" />
                              {L.items} ({items.length})
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {items.map((item, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-white text-sm truncate">
                                      {item.word}
                                    </p>
                                    {item.translation && (
                                      <p className="text-xs text-content-muted truncate mt-0.5">
                                        {item.translation}
                                      </p>
                                    )}
                                  </div>
                                  <TTSButtons text={item.word} size="sm" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Things to improve */}
                        {lesson.thingsToImprove && (
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                              <AlertCircle size={13} />
                              {L.thingsToImprove}
                            </h5>
                            <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none bg-danger/10 p-4 rounded-xl border border-danger/20">
                              <Markdown>{lesson.thingsToImprove}</Markdown>
                            </div>
                          </div>
                        )}

                        {/* Teacher-only: Student speaking */}
                        {isTeacher && lesson.studentSpeaking && (
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold text-info uppercase tracking-wider flex items-center gap-1.5">
                              <AlertCircle size={13} />
                              {L.teacherSpeaking}
                            </h5>
                            <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none bg-info/10 p-4 rounded-xl border border-info/20">
                              <Markdown>{lesson.studentSpeaking}</Markdown>
                            </div>
                          </div>
                        )}

                        {/* Teacher-only: Suggested Follow-up / Next Step */}
                        {isTeacher && lesson.suggestedFollowUp && (
                          <div className="rounded-xl bg-warn/10 border border-warn/20 p-4 space-y-2">
                            <h5 className="flex items-center gap-1.5 text-xs font-bold text-warn uppercase tracking-wider">
                              <Target size={13} />
                              {L.nextStep}
                            </h5>
                            <div className="text-sm text-content leading-relaxed prose prose-invert max-w-none">
                              <Markdown>{lesson.suggestedFollowUp}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Repeat Latest Lesson Modal */}
      {showRepeatModal && latestLesson && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowRepeatModal(false)}
        >
          <div 
            className="bg-base-100 rounded-3xl w-full max-w-lg border border-primary/30 shadow-[0_16px_64px_rgba(0,0,0,0.8)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-b from-primary/15 via-base-100 to-base-100 border-b border-white/10 relative">
              <button 
                onClick={() => setShowRepeatModal(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-content-muted hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 text-primary flex items-center justify-center mb-3">
                <RotateCcw size={24} />
              </div>
              <h3 className="text-xl font-extrabold text-white">
                {L.repeatModalTitle}
              </h3>
              <p className="text-xs text-content-muted mt-1">
                {latestCleanTopic} • {formatDate(latestLesson.date)}
              </p>
            </div>

            {/* Modal Body: Options */}
            <div className="p-6 space-y-3">
              <p className="text-xs text-content-muted mb-2">
                {L.repeatModalSubtitle}
              </p>

              {/* Option 1: Flashcards */}
              <button
                onClick={() => handleStartFlashcardReview(latestLesson.id)}
                className="w-full p-4 rounded-2xl bg-base-200/80 hover:bg-base-200 border border-primary/30 hover:border-primary transition-all text-left flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-lg">
                    🎴
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                      {language === 'pl' ? 'Fiszki ze słownictwa' : 'Vocabulary Flashcards'}
                    </h4>
                    <p className="text-xs text-content-muted mt-0.5">
                      {language === 'pl' 
                        ? `Powtórz ${latestItems.length} słówek z ostatniej lekcji w inteligentnym systemie fiszek`
                        : `Review ${latestItems.length} words with the smart flashcard system`}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-primary group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
              </button>

              {/* Option 2: AI Sentence Practice */}
              <button
                onClick={() => handleStartAIPractice(latestLesson.id)}
                className="w-full p-4 rounded-2xl bg-base-200/80 hover:bg-base-200 border border-white/10 hover:border-primary/40 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                      {language === 'pl' ? 'Trening zdań z AI' : 'AI Sentence Practice'}
                    </h4>
                    <p className="text-xs text-content-muted mt-0.5">
                      {language === 'pl' 
                        ? 'Układaj i tłumacz nowe zdania kontekstowe wygenerowane z materiału lekcji'
                        : 'Translate and assemble new context sentences generated from the lesson'}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-content-muted group-hover:text-primary group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
              </button>

              {/* Option 3: General Practice / Puzzle */}
              <button
                onClick={() => handleStartGeneralPractice(latestLesson.id)}
                className="w-full p-4 rounded-2xl bg-base-200/80 hover:bg-base-200 border border-white/10 hover:border-primary/40 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-base-300 text-content-muted group-hover:text-primary flex items-center justify-center">
                    <Brain size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                      {language === 'pl' ? 'Układanka i quiz sprawdzający' : 'Puzzle & Quiz Practice'}
                    </h4>
                    <p className="text-xs text-content-muted mt-0.5">
                      {language === 'pl' 
                        ? 'Sprawdź opanowanie materiału w szybkim quizie'
                        : 'Test your mastery with interactive puzzles and quizzes'}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-content-muted group-hover:text-primary group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 bg-white/5 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowRepeatModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-content-muted hover:text-white transition-colors"
              >
                {language === 'pl' ? 'Zamknij' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentLessonHistory;


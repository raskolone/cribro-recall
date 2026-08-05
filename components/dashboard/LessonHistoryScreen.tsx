import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LessonRecord, PracticeLog } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TTSButtons from '../flashcards/TTSButtons';
import { Calendar, Tag, Sparkles, X, FileText, Clock, Search, BookOpen, AlertCircle, ArrowLeft, LayoutGrid, List, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import gsap from 'gsap';

interface LessonHistoryScreenProps {
  onStudySet?: (setId: string) => void;
  onNavigate?: (view: string, extra?: any) => void;
}

const LessonHistoryScreen: React.FC<LessonHistoryScreenProps> = ({ onStudySet, onNavigate }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'sessions'>('lessons');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedLesson, setSelectedLesson] = useState<LessonRecord | null>(null);
  const [selectedLog, setSelectedLog] = useState<PracticeLog | null>(null);

  const isRecentLesson = (lesson: LessonRecord) => {
    if (!lesson || (!lesson.createdAt && !lesson.date)) return false;
    let checkedLessons: string[] = [];
    try {
      checkedLessons = JSON.parse(localStorage.getItem('checked_lessons') || '[]');
    } catch(e) {}
    if (checkedLessons.includes(lesson.id)) return false;
    
    const dateStr = lesson.createdAt || lesson.date;
    const date = typeof dateStr === 'string' ? new Date(dateStr) : ((dateStr as any).toDate ? (dateStr as any).toDate() : new Date());
    if (isNaN(date.getTime())) return false;
    const diffDays = Math.ceil(Math.abs(Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  const handleLessonSelect = (lesson: LessonRecord) => {
    setSelectedLesson(lesson);
    try {
      const local = JSON.parse(localStorage.getItem('checked_lessons') || '[]');
      if (!local.includes(lesson.id)) {
        localStorage.setItem('checked_lessons', JSON.stringify([...local, lesson.id]));
      }
    } catch(e) {}
    
    if (user?.hasNewLesson && user?.id) {
       import('firebase/firestore').then(({ doc, updateDoc }) => {
         updateDoc(doc(db, 'users', user.id), { hasNewLesson: false }).catch(console.error);
       });
    }
  };

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      
      const fetchLessons = async () => {
        const q = query(collection(db, `users/${user.id}/lessonRecords`));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
        return data.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      };

      const fetchPracticeLogs = async () => {
        const q = query(collection(db, `users/${user.id}/practiceLogs`));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
        return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      };

      Promise.allSettled([fetchLessons(), fetchPracticeLogs()])
        .then((results) => {
          if (results[0].status === 'fulfilled') {
            setLessons(results[0].value);
          } else {
            console.error('Failed to fetch lessons:', results[0].reason);
          }
          if (results[1].status === 'fulfilled') {
            setPracticeLogs(results[1].value);
          } else {
            console.error('Failed to fetch practice logs:', results[1].reason);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [user?.id]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedLesson) setSelectedLesson(null);
        if (selectedLog) setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedLesson, selectedLog]);

  // Modal animations
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((selectedLesson || selectedLog) && modalRef.current) {
      gsap.fromTo(modalRef.current, 
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)', clearProps: 'all' }
      );
    }
  }, [selectedLesson, selectedLog]);

  const parseVocabularyLine = (line: string) => {
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

  const getVocabList = (vocabText: string) => {
    let rawLines: string[] = [];
    if (vocabText) {
      if (vocabText.includes('\n')) {
        rawLines = vocabText.split('\n');
      } else {
        rawLines = vocabText.split(/[,;]+/);
      }
    }
    return rawLines.map(i => i.trim()).filter(i => i.length > 0).map(parseVocabularyLine);
  };

  const parseExercisesData = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map(item => typeof item === 'string' ? item : (item.polishSentence ? `${item.polishSentence} -> ${item.englishTranslation || item.correctTranslation || ''}` : JSON.stringify(item)));
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parseExercisesData(parsed);
      } catch {}
      return data.split(' | ');
    }
    return [String(data)];
  };

  const getNormalizedDetails = (log: PracticeLog) => {
    if (!log) return [];
    if (Array.isArray((log as any).detailedFeedback) && (log as any).detailedFeedback.length > 0) {
      return (log as any).detailedFeedback.map((item: any) => ({
        polish: item.polishSentence || item.polish || '',
        english: item.correctTranslation || item.englishTranslation || item.english || '',
        studentAnswer: item.studentAnswer || '',
        explanation: item.explanation || item.feedbackRule || item.feedbackVocab || '',
        isCorrect: item.isCorrect,
        score: item.score
      }));
    }
    if (Array.isArray(log.sentences) && log.sentences.length > 0) {
      return log.sentences.map((s: any) => ({
        polish: s.polishTranslation || s.polish_translation || s.polishSentence || '',
        english: s.englishSentence || s.english_sentence || s.englishTranslation || '',
        studentAnswer: s.studentAnswer || '',
        explanation: s.feedback || s.explanation || '',
        isCorrect: s.isCorrect,
        score: s.score
      }));
    }
    if (Array.isArray(log.exercisesData) && log.exercisesData.length > 0) {
      return log.exercisesData.map((ex: any) => {
        if (typeof ex === 'string') {
          const parts = ex.split(' -> ');
          return { polish: parts[0] || ex, english: parts[1] || '', studentAnswer: '', explanation: '' };
        }
        return {
          polish: ex.polishSentence || ex.polish || '',
          english: ex.correctTranslation || ex.englishTranslation || ex.english || '',
          studentAnswer: ex.studentAnswer || '',
          explanation: ex.explanation || '',
          isCorrect: ex.isCorrect,
          score: ex.score
        };
      });
    }
    if (typeof log.exercisesData === 'string' && log.exercisesData) {
      return log.exercisesData.split(' | ').map(itemStr => {
        const parts = itemStr.split(' -> ');
        return { polish: parts[0] || itemStr, english: parts[1] || '', studentAnswer: '', explanation: '' };
      });
    }
    return [];
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {language === 'pl' ? 'Historia i postępy' : 'History & Progress'}
          </h1>
          <p className="text-content-muted text-sm mt-1">
             {language === 'pl' 
                 ? 'Przeglądaj notatki z lekcji i historię sesji ćwiczeniowych.' 
                 : 'Review lesson notes and practice session history.'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Grid / List Switcher (Visible when in lessons tab) */}
          {activeTab === 'lessons' && (
            <div className="flex items-center gap-1 bg-[#0a0f1a] border border-white/10 p-1 rounded-xl shadow-inner">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={language === 'pl' ? 'Widok kafelkowy' : 'Tile view'}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>{language === 'pl' ? 'Kafelki' : 'Tiles'}</span>
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={language === 'pl' ? 'Widok listy' : 'List view'}
              >
                <List className="w-4 h-4" />
                <span>{language === 'pl' ? 'Lista' : 'List'}</span>
              </button>
            </div>
          )}

          {/* Main Tabs (Lesson Notes vs Session History) */}
          <div className="flex liquid-glass-tile p-1 rounded-xl border border-white/10">
             <button 
               onClick={() => setActiveTab('lessons')}
               className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'lessons' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-content-muted hover:text-white'}`}
             >
               <FileText className="w-4 h-4" />
               {language === 'pl' ? 'Notatki z lekcji' : 'Lesson Notes'}
             </button>
             <button 
               onClick={() => setActiveTab('sessions')}
               className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'sessions' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-content-muted hover:text-white'}`}
             >
               <Clock className="w-4 h-4" />
               {language === 'pl' ? 'Historia Sesji' : 'Session History'}
             </button>
          </div>
        </div>
      </div>

      {isLoading ? (
         <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
         </div>
      ) : activeTab === 'lessons' ? (
         lessons.length === 0 ? (
           <div className="text-center p-12 liquid-glass-card rounded-2xl mx-auto max-w-2xl mt-8 shadow-sm">
             <Search className="w-12 h-12 text-content-muted mx-auto mb-4 opacity-50" />
             <h2 className="text-xl font-bold mb-2">
               {language === 'pl' ? 'Brak historii lekcji' : 'No lesson history'}
             </h2>
             <p className="text-content-muted text-sm">
               {language === 'pl' 
                   ? 'Nie masz jeszcze przypisanych żadnych kart lekcji.' 
                   : 'You do not have any lesson records assigned yet.'}
             </p>
           </div>
        ) : viewMode === 'grid' ? (
          /* Grid View (Kafelki) - Błyszczące kafelki jak w bazie tematów */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lessons.map((lesson, index) => {
              const lessonNumber = lessons.length - index;
              const vocabCount = lesson.vocabularyText ? getVocabList(lesson.vocabularyText).length : 0;
              const cleanTopic = lesson.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim();

              return (
                <div
                  key={lesson.id}
                  onClick={() => handleLessonSelect(lesson)}
                  className={`bg-[#0a0e17] hover:border-emerald-500/50 hover:bg-[#0e1524] shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_36px_rgba(16,185,129,0.25)] rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group cursor-pointer hover:-translate-y-1.5 min-h-[220px] ${isRecentLesson(lesson) ? 'border-emerald-500/80 animate-pulse drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/10'}`}
                >
                  {/* Glass & Shiny Effects */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="absolute -inset-full top-0 block bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 group-hover:animate-shine pointer-events-none" />

                  <div>
                    {/* Top Row: Lesson Number Badge & Date Pill */}
                    {isRecentLesson(lesson) && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black font-extrabold text-[10px] uppercase rounded-bl-xl z-20">
                        {language === 'pl' ? 'Nowe' : 'New'}
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <span className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-black text-sm flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                        #{lessonNumber}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        {new Date(lesson.date).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Topic Title */}
                    <h3 className="text-lg font-serif font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2 mb-3 relative z-10">
                      {cleanTopic}
                    </h3>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 relative z-10">
                      {lesson.lessonSummary && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          {language === 'pl' ? 'Podsumowanie' : 'Summary'}
                        </span>
                      )}
                      {vocabCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          <Tag className="w-3 h-3 text-cyan-400" />
                          {vocabCount} {language === 'pl' ? 'słów' : 'words'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Footer Action */}
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300 mt-5 pt-3 border-t border-white/5 relative z-10">
                    <span>{language === 'pl' ? 'Zobacz notatki' : 'View notes'}</span>
                    <div className="flex items-center gap-2">
                      {vocabCount > 0 && onStudySet && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onStudySet(`lesson_${lesson.id}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-bold transition-all border border-emerald-500/30 flex items-center gap-1 text-[11px] shadow-sm"
                          title={language === 'pl' ? 'Generuj / Ucz się fiszek z tej lekcji' : 'Study flashcards from this lesson'}
                        >
                          <span>🎴</span> {language === 'pl' ? 'Fiszki' : 'Flashcards'}
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform text-emerald-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View (Lista) */
          <div className="grid grid-cols-1 gap-4">
            {lessons.map((lesson, index) => {
              const lessonNumber = lessons.length - index;
              const cleanTopic = lesson.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim();

              return (
              <Card 
                key={lesson.id} 
                onClick={() => handleLessonSelect(lesson)}
                className={`p-4 cursor-pointer hover:border-emerald-500/50 transition-colors group flex items-center justify-between rounded-xl border ${isRecentLesson(lesson) ? 'border-emerald-500/80 animate-pulse bg-emerald-500/10' : 'border-white/10 bg-base-200/50'}`}
              >
                  <div className="flex items-center gap-4 pr-4">
                    <div className="w-12 h-12 flex-shrink-0 bg-emerald-500/10 text-emerald-400 font-mono font-bold rounded-xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                      #{lessonNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-lg line-clamp-1 group-hover:text-emerald-400 transition-colors">
                        {cleanTopic}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-mono text-content-muted mt-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        {new Date(lesson.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-content-muted">
                     <div className="hidden sm:flex gap-2 flex-wrap">
                       {lesson.lessonSummary && (
                         <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                           <Sparkles className="w-3 h-3" />
                           {language === 'pl' ? 'Podsumowanie' : 'Summary'}
                         </span>
                       )}
                     </div>
                     <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-emerald-400" />
                  </div>
              </Card>
            )})}
          </div>
        )
      ) : (
         practiceLogs.length === 0 ? (
           <div className="text-center p-12 liquid-glass-card rounded-2xl mx-auto max-w-2xl mt-8 shadow-sm">
             <BookOpen className="w-12 h-12 text-content-muted mx-auto mb-4 opacity-50" />
             <h2 className="text-xl font-bold mb-2">
               {language === 'pl' ? 'Brak historii sesji' : 'No session history'}
             </h2>
             <p className="text-content-muted text-sm">
               {language === 'pl' 
                   ? 'Nie masz jeszcze żadnych zapisanych sesji ćwiczeniowych.' 
                   : 'You do not have any recorded practice sessions yet.'}
             </p>
           </div>
         ) : (
           <div className="space-y-3">
             {practiceLogs.map(log => (
               <div 
                 key={log.id} 
                 onClick={() => setSelectedLog(log)}
                 className="liquid-glass-tile p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:border-primary/50 hover:liquid-glass-tile/80 transition-colors group gap-4"
               >
                 <div className="flex flex-col gap-2">
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-white text-base group-hover:text-primary transition-colors flex items-center gap-2">
                       {log.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                        log.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                        log.exerciseType}
                       {log.exerciseFormat && (
                         <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono font-medium text-emerald-400">
                           {log.exerciseFormat === 'puzzle' ? (language === 'pl' ? 'Układanka' : 'Puzzle') : 
                            log.exerciseFormat === 'typing' ? (language === 'pl' ? 'Wpisywanie' : 'Typing') : 
                            log.exerciseFormat}
                         </span>
                       )}
                     </span>
                     {log.isRevisionMode && (
                       <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                         {language === 'pl' ? 'Powtórka' : 'Revision'}
                       </span>
                     )}
                   </div>
                   <div className="text-xs text-content-muted font-mono flex items-center gap-1.5 flex-wrap">
                     <Calendar className="w-3 h-3" />
                     {new Date(log.date).toLocaleString()}
                     {log.setDisplayName && (
                       <>
                         <span className="opacity-50 text-[10px]">•</span>
                         <BookOpen className="w-3 h-3" />
                         <span className="text-teal-300/80">{log.setDisplayName}</span>
                       </>
                     )}
                   </div>
                   {log.wordsUsed && log.wordsUsed.length > 0 && (
                     <div className="text-xs text-content-muted mt-1 max-w-xl">
                       <strong>{language === 'pl' ? 'Wykorzystane słownictwo:' : 'Vocabulary used:'}</strong> {log.wordsUsed.join(', ')}
                     </div>
                   )}
                 </div>
                 
                 <div className="flex gap-4 text-sm font-mono text-right shrink-0">
                   {log.totalWords && (
                     <div>
                       <div className="text-content-muted text-[10px] uppercase">{language === 'pl' ? 'Słów/Zdań' : 'Items'}</div>
                       <div className="font-bold text-white">{log.totalWords}</div>
                     </div>
                   )}
                   {log.score !== undefined && (
                     <div>
                       <div className="text-content-muted text-[10px] uppercase">{language === 'pl' ? 'Wynik' : 'Score'}</div>
                       <div className={`font-bold ${log.score >= 80 ? 'text-green-400' : log.score >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                         {log.score}%
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             ))}
           </div>
         )
      )}

      {/* Lesson Details Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLesson(null)}>
          <div 
            ref={modalRef} 
            className="bg-base-100 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between p-6 bg-base-100/95 backdrop-blur-xl border-b border-white/10">
              <div>
                 <div className="inline-flex items-center gap-2 text-primary font-mono text-sm mb-1">
                   <Calendar className="w-4 h-4" />
                   {new Date(selectedLesson.date).toLocaleDateString()}
                 </div>
                 <h2 className="text-2xl font-extrabold text-white">
                   {selectedLesson.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                 </h2>
              </div>
              <button 
                onClick={() => setSelectedLesson(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full liquid-glass-tile hover:bg-base-300 text-content-muted hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedLesson.lessonSummary && (
                <div className="space-y-3">
                   <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                     <Sparkles className="w-4 h-4 text-primary" />
                     {language === 'pl' ? 'Podsumowanie Lekcji' : 'Lesson Summary'}
                   </h3>
                   <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 text-content">
                      <div className="markdown-body text-sm leading-relaxed prose prose-invert max-w-none">
                        <Markdown>{selectedLesson.lessonSummary}</Markdown>
                      </div>
                   </div>
                </div>
              )}

              {isTeacher && selectedLesson.studentSpeaking && (
                <div className="space-y-3">
                   <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                     <AlertCircle className="w-4 h-4 text-blue-400" />
                     {language === 'pl' ? 'O czym mówił kursant' : 'Student Speaking'}
                   </h3>
                   <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 text-content text-sm whitespace-pre-wrap">
                      <Markdown>{selectedLesson.studentSpeaking}</Markdown>
                   </div>
                </div>
              )}

              {selectedLesson.thingsToImprove && (
                <div className="space-y-3">
                   <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                     <AlertCircle className="w-4 h-4 text-red-400" />
                     {language === 'pl' ? 'Do poprawy (błędy)' : 'Things to improve'}
                   </h3>
                   <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-content text-sm whitespace-pre-wrap">
                      <Markdown>{selectedLesson.thingsToImprove}</Markdown>
                   </div>
                </div>
              )}

              {isTeacher && selectedLesson.suggestedFollowUp && (
                <div className="space-y-3">
                   <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                     <Clock className="w-4 h-4 text-amber-400" />
                     {language === 'pl' ? 'Zadanie / Następna lekcja' : 'Suggested Follow-up'}
                   </h3>
                   <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 text-content text-sm whitespace-pre-wrap">
                      <Markdown>{selectedLesson.suggestedFollowUp}</Markdown>
                   </div>
                </div>
              )}

              {selectedLesson.vocabularyText && getVocabList(selectedLesson.vocabularyText).length > 0 && (
                <div className="space-y-4 pt-4">
                   <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                     <div>
                       <div className="font-bold text-white text-base flex items-center gap-2">
                         <span>🎴</span> {language === 'pl' ? 'Ćwiczenia ze słownictwa z tej lekcji' : 'Vocabulary exercises from this lesson'}
                       </div>
                       <p className="text-xs text-content-muted mt-0.5">
                         {language === 'pl' 
                           ? 'Rozpocznij naukę fiszek lub przejdź do generowania zdań AI z tych słów.' 
                           : 'Start studying flashcards or generate AI sentences with these words.'}
                       </p>
                     </div>
                     <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                       {onStudySet && (
                         <Button 
                           onClick={(e) => {
                             e.stopPropagation();
                             const lId = selectedLesson.id;
                             setSelectedLesson(null);
                             onStudySet(`lesson_${lId}`);
                           }}
                           className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex-1 sm:flex-none shadow-md"
                         >
                           🎴 {language === 'pl' ? 'Generuj / Ucz się Fiszek' : 'Study Flashcards'}
                         </Button>
                       )}
                       {onNavigate && (
                         <Button 
                           variant="secondary"
                           onClick={(e) => {
                             e.stopPropagation();
                             const lId = selectedLesson.id;
                             setSelectedLesson(null);
                             onNavigate('ai-generator', { setId: `lesson_${lId}` });
                           }}
                           className="flex-1 sm:flex-none border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                         >
                           ✨ {language === 'pl' ? 'Przećwicz w zdaniach AI' : 'Practice in AI Sentences'}
                         </Button>
                       )}
                     </div>
                   </div>

                   <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                     <Tag className="w-4 h-4 text-secondary" />
                     {language === 'pl' ? 'Nowe Słownictwo' : 'New Vocabulary'}
                     <span className="ml-2 bg-secondary/20 text-secondary px-2 py-0.5 rounded-full text-[10px]">
                       {getVocabList(selectedLesson.vocabularyText).length} {language === 'pl' ? 'słów' : 'words'}
                     </span>
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {getVocabList(selectedLesson.vocabularyText).map((item, i) => (
                       <div key={i} className="flex flex-col p-3 rounded-xl liquid-glass-tile border border-white/5">
                         <div className="flex items-center justify-between gap-2">
                           <span className="font-bold text-white text-base">{item.word}</span>
                           <TTSButtons text={item.word} />
                         </div>
                         {item.translation && (
                           <span className="text-secondary text-sm font-medium">{item.translation}</span>
                         )}
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div 
            ref={modalRef} 
            className="bg-base-100 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between p-6 bg-base-100/95 backdrop-blur-xl border-b border-white/10">
              <div>
                 <div className="inline-flex items-center gap-2 text-primary font-mono text-sm mb-1">
                   <Calendar className="w-4 h-4" />
                   {new Date(selectedLog.date).toLocaleString()}
                 </div>
                 <h2 className="text-2xl font-extrabold text-white">
                   {selectedLog.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                    selectedLog.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                    selectedLog.exerciseType}
                 </h2>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full liquid-glass-tile hover:bg-base-300 text-content-muted hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-4 text-sm font-mono">
                {selectedLog.totalWords !== undefined && (
                  <div className="liquid-glass-tile p-4 rounded-xl flex-1 text-center border border-white/5">
                    <div className="text-content-muted text-[10px] uppercase mb-1">{language === 'pl' ? 'Słów/Zdań' : 'Items'}</div>
                    <div className="font-bold text-2xl text-white">{selectedLog.totalWords}</div>
                  </div>
                )}
                {selectedLog.score !== undefined && (
                  <div className="liquid-glass-tile p-4 rounded-xl flex-1 text-center border border-white/5">
                    <div className="text-content-muted text-[10px] uppercase mb-1">{language === 'pl' ? 'Wynik' : 'Score'}</div>
                    <div className={`font-bold text-2xl ${selectedLog.score >= 80 ? 'text-green-400' : selectedLog.score >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                      {selectedLog.score}%
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const details = getNormalizedDetails(selectedLog);
                if (details.length > 0) {
                  return (
                    <div className="space-y-3 pt-4">
                      <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        {language === 'pl' ? 'Wykonane tłumaczenia i ćwiczenia' : 'Completed Translations & Exercises'}
                      </h3>
                      <div className="space-y-3">
                        {details.map((item, idx) => (
                          <div key={idx} className="p-4 rounded-xl liquid-glass-tile border border-white/10 space-y-2 text-sm">
                            <div className="font-bold text-white flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 font-mono text-xs">#{idx + 1}</span>
                                <span>{item.polish}</span>
                              </div>
                              {item.score !== undefined && (
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${item.score >= 80 ? 'bg-green-500/20 text-green-400' : item.score >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {item.score}%
                                </span>
                              )}
                            </div>
                            {item.english && (
                              <div className="text-emerald-300 text-xs font-mono">
                                EN: {item.english}
                              </div>
                            )}
                            {item.studentAnswer && (
                              <div className="text-blue-300 text-xs bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                                <strong>{language === 'pl' ? 'Twoja odpowiedź:' : 'Your answer:'}</strong> "{item.studentAnswer}"
                              </div>
                            )}
                            {item.explanation && (
                              <div className="text-amber-300 text-xs bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                                <strong>{language === 'pl' ? 'Komentarz / Błędy:' : 'Feedback:'}</strong> {item.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonHistoryScreen;

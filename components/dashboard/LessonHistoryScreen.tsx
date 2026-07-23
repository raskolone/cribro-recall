import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LessonRecord, PracticeLog } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Calendar, Tag, Sparkles, X, FileText, Clock, Search, BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';
import Markdown from 'react-markdown';
import gsap from 'gsap';

const LessonHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'sessions'>('lessons');
  const [selectedLesson, setSelectedLesson] = useState<LessonRecord | null>(null);
  const [selectedLog, setSelectedLog] = useState<PracticeLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      
      const fetchLessons = async () => {
        const q = query(collection(db, `users/${user.id}/lessonRecords`), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
      };

      const fetchPracticeLogs = async () => {
        const q = query(collection(db, `users/${user.id}/practiceLogs`), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
      };

      Promise.all([fetchLessons(), fetchPracticeLogs()])
        .then(([fetchedLessons, fetchedLogs]) => {
          setLessons(fetchedLessons);
          setPracticeLogs(fetchedLogs);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
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
        
        <div className="flex liquid-glass-tile p-1 rounded-lg border border-base-300">
           <button 
             onClick={() => setActiveTab('lessons')}
             className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'lessons' ? 'bg-primary text-black' : 'text-content-muted hover:text-white'}`}
           >
             <FileText className="w-4 h-4" />
             {language === 'pl' ? 'Notatki z lekcji' : 'Lesson Notes'}
           </button>
           <button 
             onClick={() => setActiveTab('sessions')}
             className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'sessions' ? 'bg-primary text-black' : 'text-content-muted hover:text-white'}`}
           >
             <Clock className="w-4 h-4" />
             {language === 'pl' ? 'Historia Sesji' : 'Session History'}
           </button>
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
        ) : (
           <div className="grid grid-cols-1 gap-4">
           {lessons.map((lesson, index) => {
             const lessonNumber = lessons.length - index;
             return (
             <Card 
               key={lesson.id} 
               onClick={() => setSelectedLesson(lesson)}
               className="p-4 cursor-pointer hover:border-primary/50 transition-colors liquid-glass-tile group flex items-center justify-between"
             >
                 <div className="flex items-center gap-4 pr-4">
                   <div className="w-12 h-12 flex-shrink-0 bg-primary/10 text-primary font-mono font-bold rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-colors">
                     #{lessonNumber}
                   </div>
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-white text-lg line-clamp-1 group-hover:text-primary transition-colors">
                       {lesson.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                     </h3>
                     <div className="flex items-center gap-2 text-xs font-mono text-content-muted mt-1">
                       <Calendar className="w-3.5 h-3.5" />
                       {new Date(lesson.date).toLocaleDateString()}
                     </div>
                   </div>
                 </div>
                 <div className="flex items-center gap-4 text-content-muted">
                    <div className="hidden sm:flex gap-2 flex-wrap">
                      {lesson.lessonSummary && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-primary/10 text-primary">
                          <Sparkles className="w-3 h-3" />
                          {language === 'pl' ? 'Podsumowanie' : 'Summary'}
                        </span>
                      )}
                    </div>
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
                 className="liquid-glass-tile p-4 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer hover:border-primary/50 hover:liquid-glass-tile/80 transition-colors group"
               >
                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-white text-base group-hover:text-primary transition-colors">
                       {log.exerciseType === 'ai_translation' ? (language === 'pl' ? 'Trening z AI' : 'AI Translation') : 
                        log.exerciseType === 'flashcards' ? (language === 'pl' ? 'Fiszki' : 'Flashcards') : 
                        log.exerciseType}
                     </span>
                     {log.isRevisionMode && (
                       <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                         {language === 'pl' ? 'Powtórka' : 'Revision'}
                       </span>
                     )}
                   </div>
                   <div className="text-xs text-content-muted font-mono flex items-center gap-1.5">
                     <Calendar className="w-3 h-3" />
                     {new Date(log.date).toLocaleString()}
                   </div>
                 </div>
                 
                 <div className="flex gap-4 text-sm font-mono text-right">
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

              {selectedLesson.studentSpeaking && (
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

              {selectedLesson.suggestedFollowUp && (
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
                         <span className="font-bold text-white text-base">{item.word}</span>
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

              {selectedLog.exercisesData && (
                <div className="space-y-3 pt-4">
                  <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    {language === 'pl' ? 'Przećwiczone elementy' : 'Practiced items'}
                  </h3>
                  <div className="liquid-glass-tile border border-white/5 rounded-2xl p-4">
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
                      {selectedLog.exercisesData.split(' | ').map((ex, idx) => (
                        <li key={idx} className="leading-relaxed">{ex}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonHistoryScreen;

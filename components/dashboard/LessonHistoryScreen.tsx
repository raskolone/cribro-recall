import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { LessonRecord, PracticeLog } from '../../types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Calendar, ChevronLeft, FileText, CheckCircle, Tag, Search, Sparkles, BookOpen, Clock } from 'lucide-react';
import Markdown from 'react-markdown';

const LessonHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'sessions'>('lessons');
  const [selectedLesson, setSelectedLesson] = useState<LessonRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      Promise.all([
        getLessonRecordsForStudent(user.id),
        getDocs(query(collection(db, `users/${user.id}/practiceLogs`), orderBy('date', 'desc')))
      ])
        .then(([lessonsData, logsSnapshot]) => {
          setLessons(lessonsData);
          const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
          setPracticeLogs(logs);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [user?.id]);

  if (selectedLesson) {
    // Parse vocabulary
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

    let rawLines: string[] = [];
    if (selectedLesson.vocabularyText) {
      if (selectedLesson.vocabularyText.includes('\n')) {
        rawLines = selectedLesson.vocabularyText.split('\n');
      } else {
        rawLines = selectedLesson.vocabularyText.split(/[,;]+/);
      }
    }

    const vocabList = rawLines.map(i => i.trim()).filter(i => i.length > 0).map(parseVocabularyLine);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedLesson(null)}
          className="flex items-center gap-2 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {language === 'pl' ? 'Wróć do historii' : 'Back to history'}
        </Button>
        
        <Card className="p-8 shadow-xl border-primary/20 space-y-8 bg-base-100/95 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
             <FileText className="w-64 h-64 text-primary" />
          </div>

          <div className="relative z-10 border-b border-white/10 pb-6">
             <div className="inline-flex items-center gap-2 text-primary font-mono text-sm mb-3">
               <Calendar className="w-4 h-4" />
               {new Date(selectedLesson.date).toLocaleDateString()}
             </div>
             <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
               {selectedLesson.topic}
             </h1>
          </div>

          {selectedLesson.lessonSummary && (
            <div className="relative z-10 space-y-3">
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

          {vocabList.length > 0 && (
            <div className="relative z-10 space-y-3">
               <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                 <Tag className="w-4 h-4 text-amber-500" />
                 {language === 'pl' ? 'Słownictwo z lekcji' : 'Lesson Vocabulary'}
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                 {vocabList.map((item, idx) => (
                   <div key={idx} className="bg-base-200 border border-white/5 rounded-xl p-4 flex flex-col justify-center shadow-sm hover:border-primary/30 hover:bg-base-200/80 transition-all group">
                      <span className="font-bold text-white text-base group-hover:text-primary transition-colors">{item.word}</span>
                      {item.translation && (
                        <span className="text-sm text-content-muted mt-1">{item.translation}</span>
                      )}
                   </div>
                 ))}
               </div>
            </div>
          )}

          {(!selectedLesson.lessonSummary && vocabList.length === 0) && (
            <div className="relative z-10 text-center p-8 text-content-muted">
              {language === 'pl' ? 'Ta lekcja nie ma przypisanego podsumowania ani słownictwa.' : 'This lesson has no summary or vocabulary attached.'}
            </div>
          )}
        </Card>
      </div>
    );
  }

return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
             <FileText className="w-8 h-8 text-primary" />
             {language === 'pl' ? 'Historia i Postępy' : 'History & Progress'}
          </h1>
          <p className="text-content-muted text-sm mt-1">
             {language === 'pl' 
                ? 'Przeglądaj notatki z lekcji i historię sesji ćwiczeniowych.' 
                : 'Review lesson notes and practice session history.'}
          </p>
        </div>
        
        <div className="flex bg-base-200 p-1 rounded-lg border border-base-300">
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
           <div className="text-center p-12 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-2xl mx-auto max-w-2xl mt-8 shadow-sm">
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
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {lessons.map(lesson => (
             <Card 
               key={lesson.id} 
               onClick={() => setSelectedLesson(lesson)}
               className="p-5 cursor-pointer hover:border-primary/50 transition-all hover:-translate-y-1 hover:shadow-lg group"
             >
               <div className="flex items-center gap-2 text-xs font-mono text-content-muted mb-2">
                 <Calendar className="w-3.5 h-3.5" />
                 {new Date(lesson.date).toLocaleDateString()}
               </div>
               <h3 className="font-bold text-white text-lg mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                 {lesson.topic}
               </h3>
               
               <div className="flex gap-2 flex-wrap mt-auto pt-4 border-t border-white/5">
                  {lesson.lessonSummary && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-primary/10 text-primary">
                      <Sparkles className="w-3 h-3" />
                      {language === 'pl' ? 'Podsumowanie' : 'Summary'}
                    </span>
                  )}
                  {lesson.vocabularyText && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-amber-500/10 text-amber-500">
                      <Tag className="w-3 h-3" />
                      {language === 'pl' ? 'Słówka' : 'Vocab'}
                    </span>
                  )}
               </div>
             </Card>
))}
         </div>
        )
      ) : (
         practiceLogs.length === 0 ? (
           <div className="text-center p-12 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-2xl mx-auto max-w-2xl mt-8 shadow-sm">
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
               <div key={log.id} className="bg-base-200 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                   <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-white text-base">
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
               {log.exercisesData && (
                 <div className="mt-3 text-sm text-content-muted bg-base-300 p-3 rounded border border-base-300/50">
                   <p className="font-bold mb-1">{language === 'pl' ? 'Przećwiczone zdania:' : 'Practiced sentences:'}</p>
                   <ul className="list-disc pl-5 space-y-1">
                     {log.exercisesData.split(' | ').map((ex, idx) => (
                       <li key={idx} className="italic opacity-80">{ex}</li>
                     ))}
                   </ul>
                 </div>
               )}
             </div>
             ))}
           </div>
         )
      )}
    </div>
  );
};
;

export default LessonHistoryScreen;

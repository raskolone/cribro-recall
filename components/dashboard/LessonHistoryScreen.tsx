import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { LessonRecord } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Calendar, ChevronLeft, FileText, CheckCircle, Tag, Search, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const LessonHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      getLessonRecordsForStudent(user.id)
        .then(setLessons)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [user?.id]);

  if (selectedLesson) {
    // Parse vocabulary
    const vocabList = selectedLesson.vocabularyText
      ? selectedLesson.vocabularyText.split(/[\n,;]+/).map(i => i.trim()).filter(i => i.length > 0)
      : [];

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
                    <ReactMarkdown>{selectedLesson.lessonSummary}</ReactMarkdown>
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
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                 {vocabList.map((word, idx) => (
                   <div key={idx} className="bg-base-200 border border-white/5 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center shrink-0">
                         <span className="text-xs font-mono text-content-muted">{idx + 1}</span>
                      </div>
                      <span className="font-medium text-sm text-white">{word}</span>
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
             {language === 'pl' ? 'Historia Lekcji' : 'Lesson History'}
          </h1>
          <p className="text-content-muted text-sm mt-1">
             {language === 'pl' 
               ? 'Przeglądaj podsumowania i słownictwo z poprzednich zajęć.' 
               : 'Review summaries and vocabulary from past classes.'}
          </p>
        </div>
      </div>

      {isLoading ? (
         <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
         </div>
      ) : lessons.length === 0 ? (
         <div className="text-center p-12 bg-base-200 border border-base-300 rounded-2xl mx-auto max-w-2xl mt-8 shadow-sm">
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
      )}
    </div>
  );
};

export default LessonHistoryScreen;

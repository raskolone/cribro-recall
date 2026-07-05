import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { LessonRecord } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { generateHomework } from '../../services/geminiService';
import Markdown from 'react-markdown';

const LessonHistory: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [generatingHomeworkFor, setGeneratingHomeworkFor] = useState<string | null>(null);
  const [generatedHomework, setGeneratedHomework] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchLessons = async () => {
      if (!user?.id) return;
      try {
        const q = query(
          collection(db, `users/${user.id}/lessonRecords`),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedLessons = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LessonRecord));
        setLessons(fetchedLessons);
      } catch (error) {
        console.error('Error fetching lesson records:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessons();
  }, [user]);

  const handleGenerateHomework = async (lesson: LessonRecord) => {
    setGeneratingHomeworkFor(lesson.id);
    try {
      const hw = await generateHomework(lesson.topic, lesson.lessonSummary || '', lesson.vocabularyText || '');
      setGeneratedHomework(prev => ({ ...prev, [lesson.id]: hw }));
    } catch (error) {
      console.error('Error generating homework:', error);
      alert(language === 'pl' ? 'Wystąpił błąd podczas generowania pracy domowej.' : 'Failed to generate homework.');
    } finally {
      setGeneratingHomeworkFor(null);
    }
  };

  const isRecent = (dateStr: string) => {
    const lessonDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lessonDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 2;
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="h-6 w-1/3 bg-base-300 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-base-300/50 rounded-xl"></div>
          <div className="h-20 bg-base-300/50 rounded-xl"></div>
        </div>
      </Card>
    );
  }

  if (lessons.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
        {lessons.some(l => isRecent(l.date)) && (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
          </span>
        )}
      </h2>
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {lessons.map((lesson, index) => (
          <div key={lesson.id} className="p-4 bg-base-200/50 rounded-xl border border-white/5 relative overflow-hidden group">
            {isRecent(lesson.date) && (
               <div className="absolute top-0 right-0 px-2 py-1 bg-secondary text-secondary-content text-[10px] font-bold uppercase rounded-bl-lg z-10 animate-pulse">
                 {language === 'pl' ? 'Nowe' : 'New'}
               </div>
            )}
            <div className="font-mono text-xs uppercase tracking-wider text-primary mb-1">
              Lekcja {lessons.length - index}
            </div>
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold text-white pr-12 text-lg">{lesson.topic}</h4>
              <span className="text-xs font-mono text-content-muted">{lesson.date}</span>
            </div>

            <div className="space-y-3 mb-4">
              {lesson.studentSpeaking && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-[#242424]">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    Kursant — o czym mówił
                  </div>
                  <div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{lesson.studentSpeaking}</div>
                </div>
              )}

              {lesson.thingsToImprove && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-[#2a1616]">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Things to Improve
                  </div>
                  <div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{lesson.thingsToImprove}</div>
                </div>
              )}

              {lesson.suggestedFollowUp && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-[#2a2816]">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    Suggested follow-up
                  </div>
                  <div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{lesson.suggestedFollowUp}</div>
                </div>
              )}

              {(lesson.lessonSummary || lesson.vocabularyText) && (
                <div className="rounded-xl overflow-hidden border border-white/5 bg-base-200/50 mt-4">
                  <div className="px-3 py-2 font-bold flex items-center gap-2 border-b border-white/5 text-sm">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    Podstawowe informacje
                  </div>
                  <div className="p-3 space-y-3">
                    {lesson.lessonSummary && (
                      <div>
                        <div className="text-xs font-bold text-content-muted uppercase mb-1">Podsumowanie</div>
                        <div className="text-sm text-gray-300 whitespace-pre-wrap">{lesson.lessonSummary}</div>
                      </div>
                    )}
                    {lesson.vocabularyText && (
                      <div>
                        <div className="text-xs font-bold text-content-muted uppercase mb-1">Słownictwo</div>
                        <div className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-black/20 p-2 rounded-lg">{lesson.vocabularyText}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!generatedHomework[lesson.id] && (
               <Button 
                 size="sm" 
                 variant="secondary" 
                 isLoading={generatingHomeworkFor === lesson.id}
                 onClick={() => handleGenerateHomework(lesson)}
               >
                 {language === 'pl' ? 'Generuj pracę domową (AI)' : 'Generate Homework (AI)'}
               </Button>
            )}

            {generatedHomework[lesson.id] && (
              <div className="mt-4 p-4 bg-base-300/50 rounded-lg border border-primary/20">
                <h5 className="font-bold text-sm text-primary mb-2">
                  {language === 'pl' ? 'Praca domowa:' : 'Homework:'}
                </h5>
                <div className="text-sm prose prose-invert max-w-none">
                  <Markdown>{generatedHomework[lesson.id]}</Markdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LessonHistory;

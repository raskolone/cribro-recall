import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { LessonRecord } from '../../types';
import Card from '../ui/Card';
import { useLanguage } from '../../context/LanguageContext';

const LessonHistory: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, `users/${user.uid}/lessonRecords`),
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
      <h2 className="text-xl font-bold mb-4">
        {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
      </h2>
      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {lessons.map(lesson => (
          <div key={lesson.id} className="p-4 bg-base-200/50 rounded-xl border border-white/5">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-primary">{lesson.topic}</h4>
              <span className="text-xs font-mono text-content-muted">{lesson.date}</span>
            </div>
            <div className="text-sm text-white/80 mb-2 whitespace-pre-wrap">{lesson.summary}</div>
            {lesson.words && (
              <div className="mt-2 pt-2 border-t border-white/5">
                <span className="text-xs text-content-muted font-bold block mb-1">
                  {language === 'pl' ? 'Słownictwo z lekcji:' : 'Lesson vocabulary:'}
                </span>
                <span className="text-xs text-white">{lesson.words}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LessonHistory;

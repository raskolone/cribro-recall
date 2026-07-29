import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import Card from '../ui/Card';
import { Trophy, Flame, Target, BookOpen, Loader2 } from 'lucide-react';
import { PracticeLog } from '../../types';

const StudentStatsScreen: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user?.id) return;
      try {
        const q = query(
          collection(db, `users/${user.id}/practiceLogs`),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedLogs: PracticeLog[] = [];
        snapshot.forEach(doc => {
          fetchedLogs.push({ id: doc.id, ...doc.data() } as PracticeLog);
        });
        setLogs(fetchedLogs);
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [user?.id]);

  const stats = useMemo(() => {
    let totalScoreSum = 0;
    let totalWords = 0;
    let currentStreak = 0;
    let longestStreak = 0;

    const dates = logs.map(l => new Date(l.date).toLocaleDateString()).filter((v, i, a) => a.indexOf(v) === i);
    dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // descending

    let tempStreak = 0;
    let previousDate: Date | null = null;
    
    // Sort dates ascending for streak calculation
    const ascDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    for (const dateStr of ascDates) {
      const dateObj = new Date(dateStr);
      if (!previousDate) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(dateObj.getTime() - previousDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 1;
        }
      }
      previousDate = dateObj;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    
    // Check if current streak is active (practiced today or yesterday)
    if (previousDate) {
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - previousDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        currentStreak = tempStreak;
      } else {
        currentStreak = 0;
      }
    }

    logs.forEach(l => {
      totalScoreSum += (l.score || 0);
      totalWords += (l.totalWords || 0);
    });

    const averageScore = logs.length > 0 ? Math.round(totalScoreSum / logs.length) : 0;

    return {
      totalExercises: logs.length,
      averageScore,
      totalWords,
      currentStreak,
      longestStreak
    };
  }, [logs]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-8 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {language === 'pl' ? 'Twoje Statystyki' : 'Your Statistics'}
          </h1>
          <p className="text-content-muted">
            {language === 'pl' ? 'Śledź swoje postępy i buduj nawyk nauki.' : 'Track your progress and build a learning habit.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-xl text-primary">
                <Flame size={24} className={stats.currentStreak > 0 ? "animate-pulse" : ""} />
              </div>
              <div>
                <p className="text-sm font-medium text-content-muted mb-1">
                  {language === 'pl' ? 'Obecny Streak' : 'Current Streak'}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-white">{stats.currentStreak}</h3>
                  <span className="text-sm text-content-muted">{language === 'pl' ? 'dni' : 'days'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-content-muted mb-1">
                  {language === 'pl' ? 'Najdłuższy Streak' : 'Longest Streak'}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-white">{stats.longestStreak}</h3>
                  <span className="text-sm text-content-muted">{language === 'pl' ? 'dni' : 'days'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                <Target size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-content-muted mb-1">
                  {language === 'pl' ? 'Średni Wynik' : 'Average Score'}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-white">{stats.averageScore}%</h3>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-content-muted mb-1">
                  {language === 'pl' ? 'Przetłumaczone Zdania' : 'Translated Sentences'}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-white">{stats.totalWords}</h3>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentStatsScreen;

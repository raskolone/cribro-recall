import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Brain, Dumbbell, Flame, Languages, Layers } from 'lucide-react';
import { db } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { PracticeLog, RecallItem } from '../../types';
import { getRecallItems, isConsolidated } from '../../services/recallItems';

/**
 * Wąski pasek postępu na szczycie panelu kursanta.
 *
 * Liczby przerobionych ćwiczeń, zdań i fiszek mają rzucać się w oczy — to one
 * pokazują realną pracę włożoną w naukę. Passa jest tu wyłącznie małą ikonką
 * z liczbą dni z boku: motywuje inaczej niż wynik, łatwo przywiązać się do
 * niej bardziej niż do samej nauki, więc kursant może ją schować w ustawieniach
 * (patrz `streakHidden` w SettingsScreen), a pasek dalej działa bez niej.
 */

interface StudentProgressBarProps {
  studentId: string;
  streakCount: number;
  streakHidden?: boolean;
}

/** Liczba zdań/pozycji w jednej sesji — jedno miejsce, bo kształt logów bywa różny. */
const countItems = (log: PracticeLog): number => {
  if (log.totalWords !== undefined && log.totalWords !== null) {
    const n = Number(log.totalWords);
    return isNaN(n) ? 0 : n;
  }
  if (Array.isArray(log.exercisesData)) return log.exercisesData.length;
  if (Array.isArray(log.detailedFeedback)) return log.detailedFeedback.length;
  return 1;
};

const StudentProgressBar: React.FC<StudentProgressBarProps> = ({
  studentId,
  streakCount,
  streakHidden,
}) => {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const load = async () => {
      if (!studentId || studentId === 'demo-id') {
        if (active) {
          setLogs([]);
          setRecallItems([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const [logsSnap, recall] = await Promise.all([
          getDocs(collection(db, `users/${studentId}/practiceLogs`)),
          getRecallItems(studentId),
        ]);
        if (!active) return;
        const fetchedLogs = logsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as PracticeLog))
          // „Aktywność" to wpis służbowy do liczenia passy, nie sesja ćwiczeń.
          .filter((log) => (log.exerciseType as string) !== 'Aktywność');
        setLogs(fetchedLogs);
        setRecallItems(recall);
      } catch (error) {
        console.error('Nie udało się wczytać statystyk kursanta:', error);
        if (active) {
          setLogs([]);
          setRecallItems([]);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [studentId]);

  const exercisesDone = logs.length;
  const sentencesTranslated = logs
    .filter(
      (l) => l.exerciseType === 'ai_translation' || (l.exerciseType as string) === 'homework'
    )
    .reduce((sum, l) => sum + countItems(l), 0);
  const flashcardsDone = logs
    .filter((l) => l.exerciseType === 'flashcards')
    .reduce((sum, l) => sum + countItems(l), 0);
  const consolidatedWords = recallItems.filter(
    (item) => item.approvalStatus === 'approved' && isConsolidated(item)
  ).length;

  const L =
    language === 'pl'
      ? { exercises: 'Ćwiczenia', sentences: 'Zdania', flashcards: 'Fiszki', consolidated: 'Utrwalone', days: 'dni' }
      : { exercises: 'Exercises', sentences: 'Sentences', flashcards: 'Flashcards', consolidated: 'Mastered', days: 'days' };

  // Zero treści na koncie — pasek nie ma nic do pokazania, więc znika zamiast
  // wystawiać rząd samych zer nad pustym panelem.
  if (isLoading || exercisesDone + flashcardsDone + consolidatedWords === 0) return null;

  const stats: Array<{ icon: React.ReactNode; value: number; label: string }> = [
    { icon: <Dumbbell size={14} />, value: exercisesDone, label: L.exercises },
    { icon: <Languages size={14} />, value: sentencesTranslated, label: L.sentences },
    { icon: <Layers size={14} />, value: flashcardsDone, label: L.flashcards },
    { icon: <Brain size={14} />, value: consolidatedWords, label: L.consolidated },
  ];

  return (
    <section className="stats-rail flex items-center gap-2 rounded-2xl border bg-base-200/50 px-3 sm:px-4 py-3 overflow-x-auto">
      <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5 shrink-0">
            <span className="text-primary">{stat.icon}</span>
            <span className="font-mono font-black text-base sm:text-lg text-white leading-none">
              {stat.value}
            </span>
            <span className="text-[12px] text-content-muted uppercase tracking-wide hidden sm:inline">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {!streakHidden && streakCount > 0 && (
        <div
          className="flex items-center gap-1 shrink-0 pl-2.5 border-l border-white/10 text-warn/80"
          title={`${streakCount} ${L.days}`}
        >
          <Flame size={13} />
          <span className="font-mono text-xs font-bold">{streakCount}</span>
        </div>
      )}
    </section>
  );
};

export default StudentProgressBar;

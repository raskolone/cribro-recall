import React, { useEffect, useState, useMemo } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  Languages,
  Award,
  ChevronRight,
  Flame,
  Dumbbell,
  GraduationCap
} from 'lucide-react';
import { db } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SpecialTask, PracticeLog, User, StudentTest } from '../../types';
import { isStudentTodoStatus, studentTasksQuery } from '../../utils/homework';
import { formatPolishGreeting } from '../../utils/polishVocative';
import StudentHeroAction from './StudentHeroAction';

interface StudentHeroHeaderProps {
  studentId: string;
  onOpenHomework: (taskId?: string) => void;
  onOpenFreePractice: () => void;
  onOpenTests?: (testId?: string) => void;
  streakCount?: number;
  streakHidden?: boolean;
}

const countItems = (log: PracticeLog): number => {
  if (log.totalWords !== undefined && log.totalWords !== null) {
    const n = Number(log.totalWords);
    return isNaN(n) ? 0 : n;
  }
  if (Array.isArray(log.exercisesData)) return log.exercisesData.length;
  if (Array.isArray(log.detailedFeedback)) return log.detailedFeedback.length;
  return 1;
};

const getMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds !== undefined) return val.seconds * 1000;
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

function plZdania(n: number, lang: 'pl' | 'en' = 'pl'): string {
  if (lang === 'en') {
    return n === 1 ? '1 translated sentence' : `${n} translated sentences`;
  }
  if (n === 1) return '1 przetłumaczone zdanie';
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 >= 2 && r10 <= 4 && (r100 < 10 || r100 >= 20)) {
    return `${n} przetłumaczone zdania`;
  }
  return `${n} przetłumaczonych zdań`;
}

export const StudentHeroHeader: React.FC<StudentHeroHeaderProps> = ({
  studentId,
  onOpenHomework,
  onOpenFreePractice,
  onOpenTests,
  streakCount = 0,
  streakHidden = false,
}) => {
  const { language, tText } = useLanguage();
  const { user: currentUser } = useAuth();

  const [studentUser, setStudentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetId = studentId || currentUser?.id || '';

  // 1. Listen to target student's User document in Firestore
  useEffect(() => {
    if (!targetId || targetId === 'demo-id') {
      setIsLoading(false);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, 'users', targetId),
      (snap) => {
        if (snap.exists()) {
          setStudentUser({ id: snap.id, ...snap.data() } as User);
        }
      },
      (err) => console.warn('Błąd odczytu profilu kursanta:', err)
    );

    // 2. Listen to student's assigned tasks
    const unsubTasks = onSnapshot(
      studentTasksQuery(targetId),
      (snap) => {
        const loadedTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SpecialTask));
        setTasks(loadedTasks);
      },
      (err) => console.warn('Błąd odczytu zadań kursanta:', err)
    );

    // 3. Listen to student's practice logs
    const unsubLogs = onSnapshot(
      collection(db, `users/${targetId}/practiceLogs`),
      (snap) => {
        const loadedLogs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as PracticeLog))
          .filter((l) => (l.exerciseType as string) !== 'Aktywność');
        setPracticeLogs(loadedLogs);
      },
      (err) => console.warn('Błąd odczytu historii ćwiczeń kursanta:', err)
    );

    // 4. Listen to student's tests
    const unsubTests = onSnapshot(
      collection(db, `users/${targetId}/tests`),
      (snap) => {
        const loadedTests = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentTest));
        setTests(loadedTests);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Błąd odczytu testów kursanta:', err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubUser();
      unsubTasks();
      unsubLogs();
      unsubTests();
    };
  }, [targetId]);

  // Derived calculations
  const pendingTasks = useMemo(() => {
    return tasks
      .filter((t) => isStudentTodoStatus(t.status))
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  }, [tasks]);

  const completedHomeworkTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'submitted' || t.status === 'graded');
  }, [tasks]);

  const completedTestsCount = useMemo(() => {
    return tests.filter((t) => t.completedAt || t.status === 'completed' || t.status === 'graded').length;
  }, [tests]);

  // Total translated sentences: from logs + persisted counter
  const sentencesFromLogs = useMemo(() => {
    return practiceLogs
      .filter((l) => l.exerciseType === 'ai_translation' || (l.exerciseType as string) === 'homework')
      .reduce((sum, l) => sum + countItems(l), 0);
  }, [practiceLogs]);

  const totalSentences = Math.max(studentUser?.translatedSentencesCount || 0, sentencesFromLogs);

  // Total non-homework and non-test practice sessions (to prevent double-counting)
  const standaloneExercisesCount = useMemo(() => {
    return practiceLogs.filter(
      (l) => (l.exerciseType as string) !== 'homework' && (l.exerciseType as string) !== 'test'
    ).length;
  }, [practiceLogs]);

  const totalTasksDone = completedHomeworkTasks.length + completedTestsCount + standaloneExercisesCount;
  const currentStreak = studentUser?.streakCount ?? streakCount;

  // Sync statistics back to Firestore so every student document is guaranteed to be up-to-date in DB
  useEffect(() => {
    if (!targetId || targetId === 'demo-id') return;
    if (!studentUser) return;

    const needsSentencesUpdate = studentUser.translatedSentencesCount !== totalSentences;
    const needsTasksUpdate = (studentUser as any).completedTasksCount !== totalTasksDone;

    if (needsSentencesUpdate || needsTasksUpdate) {
      updateDoc(doc(db, 'users', targetId), {
        translatedSentencesCount: totalSentences,
        completedTasksCount: totalTasksDone,
      }).catch((err) => console.warn('Błąd synchronizacji statystyk kursanta w bazie:', err));
    }
  }, [targetId, studentUser, totalSentences, totalTasksDone]);

  // Student name resolution
  const studentRawName =
    studentUser?.displayName ||
    studentUser?.name ||
    studentUser?.firstName ||
    (currentUser?.id === targetId ? currentUser?.name || currentUser?.displayName : '') ||
    (language === 'pl' ? 'Kursant' : 'Student');

  const firstName = studentRawName.trim().split(' ')[0] || studentRawName;
  const greeting = language === 'pl' ? formatPolishGreeting(firstName) : `Hello, ${firstName}!`;

  return (
    <header className="relative w-full rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-base-200/90 to-base-200/95 backdrop-blur-xl p-5 sm:p-7 shadow-2xl overflow-hidden transition-all">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top row: Minimalist Greeting */}
      <div className="relative z-10 space-y-1 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-text-hi">
          {greeting}
        </h1>
        <p className="text-sm sm:text-base text-primary font-semibold">
          {language === 'pl' ? 'Dobrze Ci idzie!' : "You're doing great!"}
        </p>
      </div>

      {/* Kafelek akcji: praca domowa albo „nic nie czeka"; pod nim wejście do Ćwiczeń dowolnych */}
      <div className="relative z-10 pt-2">
        <StudentHeroAction
          pendingTasks={pendingTasks}
          language={language}
          onOpenHomework={onOpenHomework}
          onOpenFreePractice={onOpenFreePractice}
        />
      </div>
    </header>
  );
};

export default StudentHeroHeader;

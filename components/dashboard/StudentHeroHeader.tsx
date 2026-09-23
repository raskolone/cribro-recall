import React, { useEffect, useState, useMemo } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Languages,
  Award,
  ChevronRight,
  ArrowRight,
  Flame,
  Dumbbell,
  GraduationCap
} from 'lucide-react';
import { db } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SpecialTask, PracticeLog, User, StudentTest } from '../../types';
import { studentTasksQuery } from '../../utils/homework';
import { formatPolishGreeting } from '../../utils/polishVocative';

interface StudentHeroHeaderProps {
  studentId: string;
  onOpenHomework: (taskId?: string) => void;
  onOpenExtraPractice: () => void;
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

function formatTaskDate(dateStr?: string, lang: 'pl' | 'en' = 'pl'): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function plZadania(n: number, lang: 'pl' | 'en' = 'pl'): string {
  if (lang === 'en') {
    return n === 1 ? '1 completed task' : `${n} completed tasks`;
  }
  if (n === 1) return '1 wykonane zadanie';
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 >= 2 && r10 <= 4 && (r100 < 10 || r100 >= 20)) {
    return `${n} wykonane zadania`;
  }
  return `${n} wykonanych zadań`;
}

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
  onOpenExtraPractice,
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
      .filter((t) => t.status === 'pending' || !t.status)
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

      {/* Action Hero Card (Pojedynczy Kafelek Akcji) */}
      <div className="relative z-10 pt-2">
        {pendingTasks.length > 0 ? (
          <div
            onClick={() => onOpenHomework(pendingTasks[0].id)}
            className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-primary/40 hover:border-primary shadow-lg hover:shadow-[0_0_25px_rgba(114,240,180,0.2)] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/20 text-primary border border-primary/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
                    {tText('Zadania od lektora', 'Teacher assignments')}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    {pendingTasks.length} {plZadania(pendingTasks.length, language)}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-text-hi truncate group-hover:text-primary transition-colors mt-0.5">
                  {pendingTasks[0].title || (language === 'pl' ? 'Praca domowa' : 'Homework')}
                </h3>
                {pendingTasks[0].dueDate && (
                  <p className="text-xs text-content-muted flex items-center gap-1.5 mt-0.5 font-mono">
                    <Clock size={12} className="text-warn" />
                    <span>Termin: {formatTaskDate(pendingTasks[0].dueDate, language)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-btn group-hover:brightness-110 transition-all">
              <span>{tText('Rozwiąż zadania', 'Solve tasks')}</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100/60 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="text-sm sm:text-base font-bold text-text-hi block">
                  {tText(
                    'Brak nowych zadań od lektora. Sprawdź ćwiczenia w Moich zasobach',
                    'No new homework from your teacher. Check exercises in My Resources'
                  )}
                </span>
                <p className="text-xs text-content-muted mt-0.5">
                  {tText(
                    'Wszystkie przypisane prace są wykonane. Możesz powtórzyć materiał w zakładkach poniżej.',
                    'All assigned tasks are completed. You can practice in the tabs below.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenExtraPractice}
              className="px-4 py-2.5 rounded-xl bg-primary text-accent-ink hover:bg-primary/90 font-bold text-xs flex items-center justify-center gap-2 shadow-btn transition-all shrink-0 cursor-pointer active:scale-95"
            >
              <Sparkles size={14} />
              <span>{tText('Wykonaj ćwiczenia', 'Do exercises')}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default StudentHeroHeader;

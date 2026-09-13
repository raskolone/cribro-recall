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

function formatTaskDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function plZadania(n: number): string {
  if (n === 1) return '1 wykonane zadanie';
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 >= 2 && r10 <= 4 && (r100 < 10 || r100 >= 20)) {
    return `${n} wykonane zadania`;
  }
  return `${n} wykonanych zadań`;
}

function plZdania(n: number): string {
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
  const { language } = useLanguage();
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
      (err) => console.warn('Błąd odczytu danych kursanta:', err)
    );

    // 2. Listen to student's tasks (homework)
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
  const totalTasksDone = completedHomeworkTasks.length + completedTestsCount + practiceLogs.length;
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
    'Kursant';

  const firstName = studentRawName.trim().split(' ')[0] || studentRawName;
  const greeting = formatPolishGreeting(firstName);

  return (
    <header className="relative w-full rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-base-200/90 to-base-200/95 backdrop-blur-xl p-5 sm:p-7 shadow-2xl overflow-hidden transition-all">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top row: Greeting & Real-time Stats */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 pb-5 border-b border-line-strong">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-text-hi">
              {greeting}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary font-mono text-[11px] font-bold">
              <Sparkles size={12} />
              Panel kursanta
            </span>
          </div>

          <p className="text-sm text-content-muted leading-relaxed max-w-xl">
            {totalTasksDone > 0 || totalSentences > 0 ? (
              <>
                Świetna regularność! Masz już na swoim koncie{' '}
                <strong className="text-text-hi font-bold">{plZadania(totalTasksDone)}</strong> oraz{' '}
                <strong className="text-primary font-bold">{plZdania(totalSentences)}</strong>.
              </>
            ) : (
              'Twój panel jest gotowy do pracy! Zacznij od dzisiejszych powtórek lub dodatkowych ćwiczeń.'
            )}
          </p>
        </div>

        {/* Liczniki.

            Na telefonie w JEDNYM rzędzie, ciaśniejsze: przy trzech
            pigułkach w rozmiarze desktopowym rząd się zawijał i nagłówek
            rósł o kolejne 74 px, przez co listwa kafelków spadała pod
            zgięcie. To one mają być widoczne od razu, nie liczniki. */}
        {/* `flex-1` na każdym liczniku: dwa czy trzy, zawsze dzielą rząd po
            równo, więc rząd jest symetryczny niezależnie od tego, czy passa
            jest widoczna. Bez tego trzeci licznik rozpychał dwa pierwsze
            i środek rzędu wypadał raz tu, raz tam. */}
        <div className="flex items-stretch gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
          <div className="glass-tile flex-1 sm:flex-none flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="font-mono text-base font-black text-text-hi leading-none">
                {totalTasksDone}
              </div>
              <div className="text-[10px] uppercase font-bold text-content-muted tracking-wider mt-0.5">
                Zadania
              </div>
            </div>
          </div>

          <div className="glass-tile flex-1 sm:flex-none flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Languages size={16} />
            </div>
            <div>
              <div className="font-mono text-base font-black text-text-hi leading-none">
                {totalSentences}
              </div>
              <div className="text-[10px] uppercase font-bold text-content-muted tracking-wider mt-0.5">
                Zdania
              </div>
            </div>
          </div>

          {!streakHidden && currentStreak > 0 && (
            <div className="glass-tile flex-1 sm:flex-none flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl text-amber-400">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Flame size={16} />
              </div>
              <div>
                <div className="font-mono text-base font-black text-text-hi leading-none">
                  {currentStreak}
                </div>
                <div className="text-[10px] uppercase font-bold text-amber-300/80 tracking-wider mt-0.5">
                  Dni passy
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Homework Status or Invitation to Extra Practice */}
      <div className="relative z-10 pt-5">
        {pendingTasks.length === 0 ? (
          /* STAN: BRAK PRZYPISANYCH ZADAŃ -> ZACHĘTA DO DODATKOWYCH ĆWICZEŃ */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-base-100/60 border border-primary/20">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-text-hi">Brak przypisanych zadań</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/20 text-primary uppercase tracking-wide">
                    Na bieżąco
                  </span>
                </div>
                <p className="text-xs text-content-muted mt-0.5 leading-relaxed">
                  Nie masz obecnie żadnych zaległych prac domowych. To doskonały moment na dodatkową praktykę ze słownictwa z lekcji!
                </p>
              </div>
            </div>

            <button
              onClick={onOpenExtraPractice}
              className="px-4 py-2.5 rounded-xl bg-primary text-accent-ink hover:bg-primary/90 font-bold text-xs flex items-center justify-center gap-2 shadow-btn transition-all shrink-0 cursor-pointer active:scale-95"
            >
              <Sparkles size={15} />
              <span>Wykonaj dodatkowe ćwiczenia</span>
            </button>
          </div>
        ) : (
          /* STAN: SĄ PRZYPISANE ZADANIA -> LISTA ZADAŃ I PRZEJŚCIE DO ICH ROZWIĄZANIA */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warn opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warn"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-text-hi">
                  Zadania od lektora ({pendingTasks.length})
                </span>
              </div>

              <button
                onClick={() => onOpenHomework()}
                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Wszystkie prace domowe</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Na telefonie JEDNO zadanie, na dużym ekranie dwa.

                Nagłówek ma się zmieścić nad zgięciem razem z listwą
                kafelków. Drugie zadanie nie znika — stoi w kafelku „Moje
                zadania" i pod „Wszystkie prace domowe" obok. Tu ma być to,
                co najbliżej terminu, a nie cała kolejka. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pendingTasks.slice(0, 2).map((task, position) => (
                <div
                  key={task.id}
                  onClick={() => onOpenHomework(task.id)}
                  className={`glass-tile p-3.5 rounded-2xl cursor-pointer flex-col justify-between gap-3 group ${
                    position === 0 ? 'flex' : 'hidden sm:flex'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold text-primary truncate">
                        {task.type === 'fill_in_the_blank' ? 'Znajdź błędy' : 'Tłumaczenie zdań'}
                      </span>
                      {task.dueDate && (
                        <span className="text-[10px] font-medium text-warn flex items-center gap-1 shrink-0 font-mono">
                          <Clock size={11} />
                          {formatTaskDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-text-hi group-hover:text-primary transition-colors line-clamp-1">
                      {task.title || 'Praca domowa'}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-content-muted">
                    <span>
                      {Array.isArray(task.sentences) && task.sentences.length > 0
                        ? `${task.sentences.length} zdań`
                        : 'Zadanie'}
                    </span>
                    <span className="text-primary font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Rozwiąż <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Zachęta do praktyki dodatkowej — tylko na dużym ekranie.

                Na telefonie to trzecie wejście do tego samego miejsca
                (menu boczne i kafelek już je mają) i kosztowało 60 px
                nad zgięciem. */}
            <div className="hidden sm:flex items-center justify-between pt-1 px-1 text-xs text-content-muted">
              <span>Chcesz poćwiczyć więcej zdań poza pracą domową?</span>
              <button
                onClick={onOpenExtraPractice}
                className="font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={12} />
                Praktyka dodatkowa
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default StudentHeroHeader;

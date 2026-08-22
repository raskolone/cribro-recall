import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ChevronDown, Users, Clock, ClipboardList, AlertCircle } from 'lucide-react';
import { db } from '../../firebase';
import { User } from '../../types';
import Badge from '../ui/Badge';
import { backfillTaskOwners } from '../../utils/backfillTaskOwners';

/**
 * Przegląd całego panelu nauczyciela.
 *
 * Zwinięty pokazuje trzy liczby, które da się policzyć z listy kursantów już
 * wczytanej przez panel — czyli bez żadnego dodatkowego odczytu z Firestore.
 * Zadania (kolekcja `specialTasks`) dociągamy dopiero przy pierwszym
 * rozwinięciu: to jeden odczyt całej kolekcji i nie ma powodu płacić za niego,
 * dopóki nikt na te dane nie patrzy.
 *
 * Świadomie nie sięgamy po `isTaskForStudent` do agregacji — ten helper
 * zagląda do `auth.currentUser`, więc przy zliczaniu w skali panelu
 * dopasowywałby zadania do zalogowanego nauczyciela, nie do kursantów.
 */

interface TeacherOverviewProps {
  students: User[];
  language: 'pl' | 'en';
}

interface TaskRow {
  status?: string;
  dueDate?: string;
  createdAt?: string;
  type?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const T = {
  pl: {
    title: 'Przegląd panelu', kicker: 'Podsumowanie',
    students: 'Kursanci', active7: 'Aktywni (7 dni)', new30: 'Nowi (30 dni)',
    byLevel: 'Poziomy', noLevel: 'Bez poziomu', suspended: 'Zawieszeni',
    recent: 'Ostatnie logowania', never: 'nigdy się nie logował', logins: 'logowań',
    tasks: 'Ćwiczenia', pending: 'Oczekujące', submitted: 'Przesłane', graded: 'Ocenione',
    overdue: 'Po terminie', last7: 'Dodane w 7 dni', noTasks: 'Brak przypisanych zadań',
    loading: 'Wczytywanie…', failed: 'Nie udało się wczytać zadań',
    expand: 'Rozwiń szczegóły', collapse: 'Zwiń szczegóły',
    today: 'dziś', yesterday: 'wczoraj', daysAgo: 'dni temu', noStudents: 'Brak kursantów',
  },
  en: {
    title: 'Panel overview', kicker: 'Summary',
    students: 'Students', active7: 'Active (7 days)', new30: 'New (30 days)',
    byLevel: 'Levels', noLevel: 'No level', suspended: 'Suspended',
    recent: 'Recent logins', never: 'never logged in', logins: 'logins',
    tasks: 'Exercises', pending: 'Pending', submitted: 'Submitted', graded: 'Graded',
    overdue: 'Overdue', last7: 'Added in 7 days', noTasks: 'No assigned tasks',
    loading: 'Loading…', failed: 'Could not load tasks',
    expand: 'Show details', collapse: 'Hide details',
    today: 'today', yesterday: 'yesterday', daysAgo: 'days ago', noStudents: 'No students',
  },
};

const parseDate = (value?: string): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

const TeacherOverview: React.FC<TeacherOverviewProps> = ({ students, language }) => {
  const t = T[language === 'en' ? 'en' : 'pl'];
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [taskState, setTaskState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Zadania dociągamy raz, przy pierwszym rozwinięciu.
  //
  // Strażnik siedzi w ref, a nie w stanie: gdyby `taskState` był zależnością
  // efektu, ustawienie go na 'loading' natychmiast przeładowałoby efekt,
  // sprzątanie anulowałoby trwające pobranie, a kolejne przejście odbiłoby się
  // od wczesnego return — i wczytywanie nigdy by się nie skończyło.
  const started = useRef(false);
  useEffect(() => {
    if (!isOpen || started.current) return;
    started.current = true;
    let cancelled = false;
    setTaskState('loading');
    // Przy okazji domykamy migrację przypisań: to pierwszy ekran, który
    // nauczyciel otwiera, a tylko jego konto ma prawo zapisu w specialTasks.
    // Bez `studentUid` kursant nie zobaczy zadania po zaostrzeniu reguł.
    backfillTaskOwners();
    getDocs(collection(db, 'specialTasks'))
      .then(snap => {
        if (cancelled) return;
        setTasks(snap.docs.map(d => d.data() as TaskRow));
        setTaskState('idle');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('TeacherOverview: nie udało się wczytać specialTasks', err);
        setTaskState('error');
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const stats = useMemo(() => {
    const now = Date.now();
    const learners = students.filter(s => s.role === 'user');

    const active7 = learners.filter(s => {
      const last = parseDate(s.lastLoginDate);
      return last !== null && now - last <= 7 * DAY;
    }).length;

    const new30 = learners.filter(s => {
      const created = parseDate(s.createdAt);
      return created !== null && now - created <= 30 * DAY;
    }).length;

    const byLevel = LEVELS.map(level => ({
      level,
      count: learners.filter(s => (s.level || '').toUpperCase() === level).length,
    }));
    const noLevel = learners.filter(s => !LEVELS.includes((s.level || '').toUpperCase() as any)).length;

    const recent = [...learners]
      .map(s => ({ user: s, last: parseDate(s.lastLoginDate) }))
      .sort((a, b) => (b.last ?? -1) - (a.last ?? -1))
      .slice(0, 6);

    return {
      total: learners.length,
      active7,
      new30,
      byLevel,
      noLevel,
      suspended: learners.filter(s => s.isSuspended).length,
      recent,
      levelMax: Math.max(1, ...byLevel.map(l => l.count), noLevel),
    };
  }, [students]);

  const taskStats = useMemo(() => {
    if (!tasks) return null;
    const now = Date.now();
    const by = (s: string) => tasks.filter(x => (x.status || 'pending') === s).length;
    const overdue = tasks.filter(x => {
      const due = parseDate(x.dueDate);
      const open = (x.status || 'pending') === 'pending';
      return open && due !== null && due < now;
    }).length;
    const last7 = tasks.filter(x => {
      const created = parseDate(x.createdAt);
      return created !== null && now - created <= 7 * DAY;
    }).length;
    const types = new Map<string, number>();
    tasks.forEach(x => {
      const key = x.type || 'translation';
      types.set(key, (types.get(key) || 0) + 1);
    });
    return {
      total: tasks.length,
      pending: by('pending'),
      submitted: by('submitted'),
      graded: by('graded') + by('completed'),
      overdue,
      last7,
      types: [...types.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [tasks]);

  const relative = (ms: number | null): string => {
    if (ms === null) return t.never;
    const days = Math.floor((Date.now() - ms) / DAY);
    if (days <= 0) return t.today;
    if (days === 1) return t.yesterday;
    return `${days} ${t.daysAgo}`;
  };

  return (
    <section className="liquid-glass-panel overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        aria-expanded={isOpen}
        title={isOpen ? t.collapse : t.expand}
        className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2.5 rounded-2xl bg-primary/12 text-primary border border-primary/30 shrink-0">
            <Users size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-text-mute">
              {t.kicker}
            </span>
            <span className="block text-lg font-bold text-text-hi truncate">{t.title}</span>
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6 min-w-0">
            <Figure value={stats.total} label={t.students} />
            <Figure value={stats.active7} label={t.active7} />
            <Figure value={stats.new30} label={t.new30} />
          </span>
          <ChevronDown
            size={20}
            className={`text-text-mute transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-line p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Kursanci wg poziomu */}
          <Block icon={<Users size={15} />} title={t.byLevel}>
            {stats.total === 0 ? (
              <Empty>{t.noStudents}</Empty>
            ) : (
              <div className="space-y-1.5">
                {stats.byLevel.map(({ level, count }) => (
                  <LevelRow key={level} label={level} count={count} max={stats.levelMax} />
                ))}
                {stats.noLevel > 0 && (
                  <LevelRow label={t.noLevel} count={stats.noLevel} max={stats.levelMax} muted />
                )}
                {stats.suspended > 0 && (
                  <p className="pt-2 text-xs text-text-mute">
                    {t.suspended}: <span className="font-mono text-danger">{stats.suspended}</span>
                  </p>
                )}
              </div>
            )}
          </Block>

          {/* Ostatnie logowania */}
          <Block icon={<Clock size={15} />} title={t.recent}>
            {stats.recent.length === 0 ? (
              <Empty>{t.noStudents}</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {stats.recent.map(({ user, last }) => (
                  <li key={user.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm text-content truncate">
                        {user.firstName || user.displayName || user.username}
                      </span>
                      <span className="block font-mono text-[11px] text-text-faint">
                        {user.loginCount ?? 0} {t.logins}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-[11px] shrink-0 ${last === null ? 'text-text-faint' : 'text-text-mute'}`}
                    >
                      {relative(last)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {/* Ćwiczenia */}
          <Block icon={<ClipboardList size={15} />} title={t.tasks}>
            {taskState === 'loading' && <Empty>{t.loading}</Empty>}
            {taskState === 'error' && (
              <p className="flex items-center gap-2 text-xs text-danger">
                <AlertCircle size={14} /> {t.failed}
              </p>
            )}
            {taskStats && taskState === 'idle' && (
              taskStats.total === 0 ? (
                <Empty>{t.noTasks}</Empty>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge status="wait" plain>{t.pending}: {taskStats.pending}</Badge>
                    <Badge tone="info" plain>{t.submitted}: {taskStats.submitted}</Badge>
                    <Badge status="ok" plain>{t.graded}: {taskStats.graded}</Badge>
                    {taskStats.overdue > 0 && (
                      <Badge status="low" plain>{t.overdue}: {taskStats.overdue}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-mute">
                    {t.last7}: <span className="font-mono text-content">{taskStats.last7}</span>
                  </p>
                  <ul className="divide-y divide-line-soft">
                    {taskStats.types.map(([type, count]) => (
                      <li key={type} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-text-3">{type}</span>
                        <span className="font-mono text-xs text-primary">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </Block>
        </div>
      )}
    </section>
  );
};

const Figure: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <span className="text-right min-w-0">
    <span className="block font-display text-2xl font-bold leading-none text-primary">{value}</span>
    <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-mute">
      {label}
    </span>
  </span>
);

const Block: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon, title, children,
}) => (
  <div className="min-w-0">
    <h3 className="flex items-center gap-2 mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-mute">
      <span className="text-primary">{icon}</span>
      {title}
    </h3>
    {children}
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-text-faint">{children}</p>
);

const LevelRow: React.FC<{ label: string; count: number; max: number; muted?: boolean }> = ({
  label, count, max, muted = false,
}) => (
  <div className="flex items-center gap-3">
    <span className={`w-24 font-mono text-[11px] shrink-0 truncate ${muted ? 'text-text-faint' : 'text-text-2'}`}>
      {label}
    </span>
    <span className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
      <span
        className={`block h-full rounded-full transition-[width] duration-400 ${muted ? 'bg-text-faint' : 'bg-primary'}`}
        style={{ width: `${count === 0 ? 0 : Math.max(6, (count / max) * 100)}%` }}
      />
    </span>
    <span className="w-6 text-right font-mono text-[11px] text-content shrink-0">{count}</span>
  </div>
);

export default TeacherOverview;

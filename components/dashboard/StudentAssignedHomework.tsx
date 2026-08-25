import React, { useEffect, useState } from 'react';
import { 
  BookOpen, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  Award, 
  Check, 
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SpecialTask } from '../../types';
import { studentTasksQuery } from '../../utils/homework';
import { onSnapshot } from 'firebase/firestore';
import { getTaskDateMillis } from './HomeworkScreen';

interface StudentAssignedHomeworkProps {
  onNavigate?: (view: string, extra?: any) => void;
}

export const StudentAssignedHomework: React.FC<StudentAssignedHomeworkProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);

    const unsubscribe = onSnapshot(
      studentTasksQuery(user.id),
      (snapshot) => {
        const loadedTasks: SpecialTask[] = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as SpecialTask)
        );
        loadedTasks.sort((a, b) => getTaskDateMillis(b.createdAt) - getTaskDateMillis(a.createdAt));
        setTasks(loadedTasks);
        setIsLoading(false);
      },
      (error) => {
        console.error('Błąd pobierania prac domowych kursanta:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'submitted' || t.status === 'completed' || t.status === 'graded');

  const displayedTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'completed') return t.status !== 'pending';
    return true;
  });

  const getDueDateLabel = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueMidnight = new Date(due);
    dueMidnight.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueMidnight.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: language === 'pl' ? `Po terminie (${due.toLocaleDateString('pl-PL')})` : `Overdue (${due.toLocaleDateString()})`,
        isUrgent: true,
      };
    } else if (diffDays === 0) {
      return {
        text: language === 'pl' ? 'Termin: Dzisiaj' : 'Due: Today',
        isUrgent: true,
      };
    } else if (diffDays === 1) {
      return {
        text: language === 'pl' ? 'Termin: Jutro' : 'Due: Tomorrow',
        isUrgent: true,
      };
    } else {
      return {
        text: language === 'pl' ? `Termin: do ${due.toLocaleDateString('pl-PL')}` : `Due: ${due.toLocaleDateString()}`,
        isUrgent: false,
      };
    }
  };

  const getTaskTypeInfo = (type?: string) => {
    if (type === 'fill_in_the_blank' || type === 'find_errors') {
      return {
        icon: AlertTriangle,
        name: language === 'pl' ? 'Korekta błędów w zdaniach' : 'Sentence error correction',
        badgeClass: 'bg-warn/15 text-warn border-warn/30',
      };
    }
    return {
      icon: BookOpen,
      name: language === 'pl' ? 'Tłumaczenie zdań' : 'Sentence translation',
      badgeClass: 'bg-primary/15 text-primary border-primary/30',
    };
  };

  if (isLoading) {
    return null;
  }

  // If student has no tasks ever assigned
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
            <BookOpen size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">
                {language === 'pl' ? 'Powtórki i zadania od lektora' : 'Assigned Reviews & Homework'}
              </h2>
              {pendingTasks.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-accent-ink animate-pulse">
                  {pendingTasks.length} {language === 'pl' ? (pendingTasks.length === 1 ? 'nowe' : 'nowe') : 'new'}
                </span>
              )}
            </div>
            <p className="text-xs text-content-muted">
              {language === 'pl' 
                ? 'Dedykowane zadania domowe przygotowane przez Twojego nauczyciela' 
                : 'Personalized homework exercises prepared by your teacher'}
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-base-200/80 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              filter === 'pending'
                ? 'bg-primary text-accent-ink font-bold shadow-sm'
                : 'text-content-muted hover:text-white'
            }`}
          >
            {language === 'pl' ? `Do zrobienia (${pendingTasks.length})` : `To do (${pendingTasks.length})`}
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              filter === 'completed'
                ? 'bg-primary text-accent-ink font-bold shadow-sm'
                : 'text-content-muted hover:text-white'
            }`}
          >
            {language === 'pl' ? `Oddane / Ocenione (${completedTasks.length})` : `Done (${completedTasks.length})`}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-primary text-accent-ink font-bold shadow-sm'
                : 'text-content-muted hover:text-white'
            }`}
          >
            {language === 'pl' ? `Wszystkie (${tasks.length})` : `All (${tasks.length})`}
          </button>
        </div>
      </div>

      {/* List of Tasks */}
      {displayedTasks.length === 0 ? (
        <div className="p-6 rounded-2xl bg-base-200/40 border border-white/10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-primary/60 mx-auto" />
          <p className="text-sm font-semibold text-white">
            {filter === 'pending'
              ? (language === 'pl' ? 'Wszystkie powtórki od lektora są zrobione!' : 'All teacher homework is completed!')
              : (language === 'pl' ? 'Brak zadań w tej kategorii.' : 'No tasks in this category.')}
          </p>
          <p className="text-xs text-content-muted">
            {language === 'pl' 
              ? 'Nowe zadania pojawią się tutaj po ich przypisaniu przez nauczyciela.' 
              : 'New homework will appear here once assigned by your teacher.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {displayedTasks.map((task) => {
            const typeInfo = getTaskTypeInfo(task.type);
            const TypeIcon = typeInfo.icon;
            const dueInfo = getDueDateLabel(task.dueDate);
            const isPending = task.status === 'pending';
            const isGraded = task.status === 'graded';
            const isSubmitted = task.status === 'submitted' || task.status === 'completed';
            const sentenceCount = task.sentences?.length || 0;

            return (
              <div
                key={task.id}
                onClick={() => onNavigate && onNavigate('homework', { taskId: task.id })}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between ${
                  isPending
                    ? 'liquid-glass-tile border-primary/40 hover:border-primary shadow-[0_0_18px_rgba(114,240,180,0.12)] hover:shadow-[0_0_24px_rgba(114,240,180,0.2)]'
                    : 'liquid-glass-tile border-white/10 hover:border-white/25 opacity-90'
                }`}
              >
                <div>
                  {/* Top Tags Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border font-mono ${typeInfo.badgeClass}`}>
                      <TypeIcon size={12} />
                      {typeInfo.name}
                    </span>

                    {/* Status Pill */}
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warn/20 text-warn border border-warn/30">
                        {language === 'pl' ? 'Do zrobienia' : 'To do'}
                      </span>
                    )}
                    {isSubmitted && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {language === 'pl' ? 'Oddane' : 'Submitted'}
                      </span>
                    )}
                    {isGraded && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                        <Award size={11} />
                        {task.grade !== undefined ? `${task.grade}%` : (language === 'pl' ? 'Ocenione' : 'Graded')}
                      </span>
                    )}
                  </div>

                  {/* Title & Instructions */}
                  <h3 className="font-bold text-base text-white group-hover:text-primary transition-colors leading-snug">
                    {task.title || (language === 'pl' ? 'Praca domowa' : 'Homework')}
                  </h3>

                  {task.instructions && (
                    <p className="text-xs text-content-muted mt-1.5 line-clamp-2 leading-relaxed">
                      {task.instructions}
                    </p>
                  )}

                  {/* Teacher Feedback Preview (if graded) */}
                  {isGraded && task.teacherFeedback && (
                    <div className="mt-3 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-content flex items-start gap-2">
                      <MessageSquare size={14} className="text-primary shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-primary block">
                          {language === 'pl' ? 'Komentarz lektora:' : 'Teacher feedback:'}
                        </span>
                        <p className="text-content-muted line-clamp-2">{task.teacherFeedback}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Meta & Action */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-content-muted">
                    <span className="font-mono">
                      {sentenceCount} {sentenceCount === 1 ? (language === 'pl' ? 'zdanie' : 'sentence') : (language === 'pl' ? 'zdań' : 'sentences')}
                    </span>
                    {dueInfo && (
                      <span className={`flex items-center gap-1 font-medium ${dueInfo.isUrgent ? 'text-warn font-semibold' : ''}`}>
                        <Clock size={12} />
                        {dueInfo.text}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-primary font-bold group-hover:translate-x-1 transition-transform">
                    <span>
                      {isPending
                        ? (language === 'pl' ? 'Rozwiąż powtórkę' : 'Start review')
                        : (language === 'pl' ? 'Zobacz szczegóły' : 'View details')}
                    </span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default StudentAssignedHomework;

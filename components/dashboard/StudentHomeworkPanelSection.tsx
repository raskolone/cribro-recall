import React, { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { BookOpen, ChevronRight, Clock, Award, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SpecialTask } from '../../types';
import { studentTasksQuery } from '../../utils/homework';
import PanelSection from './PanelSection';

interface StudentHomeworkPanelSectionProps {
  /** Bez własnego nagłówka — używane, gdy nagłówkiem jest kafelek listwy. */
  headless?: boolean;
  studentId?: string;
  onOpenHomework: (taskId?: string) => void;
}

const getMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds !== undefined) return val.seconds * 1000;
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

export const StudentHomeworkPanelSection: React.FC<StudentHomeworkPanelSectionProps> = ({
  headless,
  studentId,
  onOpenHomework,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetId = studentId || user?.id;

  useEffect(() => {
    if (!targetId || targetId === 'demo-id') {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      studentTasksQuery(targetId),
      (snapshot) => {
        const loadedTasks = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as SpecialTask))
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setTasks(loadedTasks);
        setIsLoading(false);
      },
      (error) => {
        console.error('Błąd wczytywania prac domowych w panelu:', error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [targetId]);

  if (isLoading) return null;

  const pendingTasks = tasks.filter((t) => t.status === 'pending' || !t.status);
  const submittedTasks = tasks.filter((t) => t.status === 'submitted');
  const gradedTasks = tasks.filter(
    (t) => t.status === 'graded' || Boolean(t.reviewedAt) || Boolean(t.teacherFeedback)
  );

  const metaText = (() => {
    if (pendingTasks.length > 0) {
      return language === 'pl'
        ? `${pendingTasks.length} ${pendingTasks.length === 1 ? 'do zrobienia' : 'do zrobienia'}`
        : `${pendingTasks.length} pending`;
    }
    if (gradedTasks.length > 0) {
      return language === 'pl'
        ? `${gradedTasks.length} ${gradedTasks.length === 1 ? 'sprawdzona' : 'sprawdzonych'}`
        : `${gradedTasks.length} graded`;
    }
    return language === 'pl' ? `${tasks.length} prac` : `${tasks.length} tasks`;
  })();

  const typeLabel = (type?: string) => {
    if (type === 'fill_in_the_blank') return language === 'pl' ? 'Korekta błędów' : 'Find mistakes';
    return language === 'pl' ? 'Tłumaczenie zdań' : 'Translation';
  };

  return (
    <PanelSection
      headless={headless}
      title={language === 'pl' ? 'Prace domowe' : 'Homework'}
      meta={metaText}
      icon={<BookOpen size={16} />}
      defaultOpen={pendingTasks.length > 0}
    >
      <div className="p-4 sm:p-5 space-y-3.5">
        {tasks.length === 0 ? (
          <div className="py-4 text-center">
            <BookOpen className="w-8 h-8 text-content-muted/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-content-muted">
              {language === 'pl'
                ? 'Brak przypisanych prac domowych'
                : 'No homework assigned yet'}
            </p>
            <p className="text-xs text-content-muted/70 mt-0.5">
              {language === 'pl'
                ? 'Gdy lektor przypisze nowe zadanie, pojawi się ono w tym spisie.'
                : 'When your teacher assigns homework, it will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Lista oczekujących zadań */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                <span className="block text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
                  {language === 'pl' ? 'Czekają na zrobienie' : 'To do'}
                </span>
                <ul className="space-y-2">
                  {pendingTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <button
                        onClick={() => onOpenHomework(task.id)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-base-100/60 hover:bg-base-100 border border-primary/25 text-left transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-text-hi truncate">{task.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-content-muted mt-0.5">
                            <span className="font-semibold text-primary">{typeLabel(task.type)}</span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-warn font-mono text-[11px]">
                                · <Clock size={11} /> do {task.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg bg-primary text-black font-bold text-xs flex items-center gap-1 shrink-0">
                          <span>{language === 'pl' ? 'Rozwiąż' : 'Start'}</span>
                          <ChevronRight size={13} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ostatnio sprawdzone przez nauczyciela */}
            {gradedTasks.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="block text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary/90 flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  {language === 'pl' ? 'Sprawdzone przez nauczyciela' : 'Checked by teacher'}
                </span>
                <ul className="space-y-2">
                  {gradedTasks.slice(0, 2).map((task) => (
                    <li key={task.id}>
                      <button
                        onClick={() => onOpenHomework(task.id)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-primary/[0.06] hover:bg-primary/[0.10] border border-primary/20 text-left transition-all cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-text-hi truncate">{task.title}</h4>
                            {task.grade !== undefined && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-primary/20 text-primary border border-primary/30">
                                {task.grade}%
                              </span>
                            )}
                          </div>
                          {task.teacherFeedback && (
                            <p className="text-xs text-content-muted mt-1 truncate italic">
                              „{task.teacherFeedback}”
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-bold text-primary flex items-center gap-1 shrink-0">
                          <Award size={13} />
                          <span>{language === 'pl' ? 'Zobacz ocenę' : 'View feedback'}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Przycisk przejścia do pełnego modułu */}
            <div className="pt-2">
              <button
                onClick={() => onOpenHomework()}
                className="w-full py-2.5 px-4 rounded-xl bg-base-100 hover:bg-line-soft text-xs font-bold text-primary border border-primary/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{language === 'pl' ? 'Przejdź do wszystkich prac domowych' : 'Open full homework view'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </PanelSection>
  );
};

export default StudentHomeworkPanelSection;

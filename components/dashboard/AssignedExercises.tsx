import React, { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ChevronRight, ClipboardList, Clock, FlaskConical } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SpecialTask } from '../../types';
import { isStudentTodoStatus, studentTasksQuery } from '../../utils/homework';

/**
 * Ćwiczenia przypisane przez lektora — szczyt panelu kursanta.
 *
 * Zadania są zwinięte do jednej linijki każde: tytuł, typ, termin. Rozwinięta
 * treść zadania należy do ekranu pracy domowej, bo tam się je rozwiązuje —
 * gdyby panel pokazywał zdania wprost, kursant czytałby ćwiczenie zanim
 * zdecyduje, że siada do niego na poważnie.
 *
 * Gdy nic nie czeka, miejsce nie znika — wchodzi zaproszenie do praktyki
 * dodatkowej, żeby pusta kolejka nigdy nie znaczyła „nic do roboty".
 */

interface AssignedExercisesProps {
  onOpenHomework: (taskId?: string) => void;
  onOpenExtraPractice: () => void;
  /** Podgląd konkretnego kursanta (panel lektora). Domyślnie: zalogowany. */
  studentId?: string;
}

/** Ile zadań pokazujemy wprost, zanim zwiniemy resztę do jednej linijki. */
const MAX_VISIBLE_TASKS = 3;

const getMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds !== undefined) return val.seconds * 1000;
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

const AssignedExercises: React.FC<AssignedExercisesProps> = ({
  onOpenHomework,
  onOpenExtraPractice,
  studentId,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [pending, setPending] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetId = studentId || user?.id;

  useEffect(() => {
    if (!targetId || targetId === 'demo-id') {
      setPending([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      studentTasksQuery(targetId),
      (snapshot) => {
        const tasks = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as SpecialTask))
          .filter((t) => isStudentTodoStatus(t.status))
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setPending(tasks);
        setIsLoading(false);
      },
      (error) => {
        console.error('Nie udało się wczytać zadań od lektora:', error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [targetId]);

  const L =
    language === 'pl'
      ? {
          heading: 'Od lektora',
          translation: 'Tłumaczenie zdań',
          errors: 'Znajdź błędy',
          due: (d: string) => `do ${d}`,
          sentences: (n: number) => `${n} zdań`,
          rest: (n: number) => `+ ${n} więcej w pracach domowych`,
          emptyTitle: 'Nic nie czeka od lektora',
          emptyBody: 'Dobry moment na dodatkową praktykę ze słownictwa z lekcji.',
          emptyCta: 'Praktyka dodatkowa',
        }
      : {
          heading: 'From your teacher',
          translation: 'Sentence translation',
          errors: 'Spot the mistakes',
          due: (d: string) => `by ${d}`,
          sentences: (n: number) => `${n} sentences`,
          rest: (n: number) => `+ ${n} more in homework`,
          emptyTitle: 'Nothing from your teacher',
          emptyBody: 'A good moment for extra practice with vocabulary from your lessons.',
          emptyCta: 'Extra practice',
        };

  if (isLoading) return null;

  if (pending.length === 0) {
    // Nic nie czeka — wtedy praktyka dodatkowa jest jedyną rzeczą do zrobienia
    // teraz, więc cała karta jest przyciskiem i to ona (jedyna w panelu) pulsuje.
    return (
      <button
        onClick={onOpenExtraPractice}
        className="neon-breathe w-full rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.09] via-base-200/60 to-base-200/60 p-4 sm:p-5 text-left active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <FlaskConical className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-white leading-snug">{L.emptyTitle}</h2>
            <p className="text-[13px] text-content-muted mt-0.5 leading-relaxed">{L.emptyBody}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-primary shrink-0" />
        </div>
        <span className="mt-3 flex items-center justify-center min-h-[2.75rem] rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold text-sm">
          {L.emptyCta}
        </span>
      </button>
    );
  }

  const visible = pending.slice(0, MAX_VISIBLE_TASKS);
  const hidden = pending.length - visible.length;

  return (
    <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.09] via-base-200/60 to-base-200/60 overflow-hidden">
      <header className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-white/[0.07]">
        <ClipboardList className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
          {L.heading}
        </h2>
        <span className="ml-auto text-[12px] font-mono font-bold text-primary/80">
          {pending.length}
        </span>
      </header>

      <ul className="divide-y divide-white/[0.06]">
        {visible.map((task) => (
          <li key={task.id}>
            <button
              onClick={() => onOpenHomework(task.id)}
              className="w-full min-h-[3.75rem] flex items-center gap-3 px-4 sm:px-5 py-3 text-left active:bg-white/[0.04] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <span className="block font-bold text-white text-[15px] leading-snug truncate">
                  {task.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-content-muted mt-0.5">
                  <span>
                    {task.type === 'fill_in_the_blank' ? L.errors : L.translation}
                  </span>
                  {task.sentences?.length > 0 && (
                    <span>· {L.sentences(task.sentences.length)}</span>
                  )}
                  {task.dueDate && (
                    <span className="inline-flex items-center gap-1 text-warn">
                      <Clock size={11} />
                      {L.due(task.dueDate)}
                    </span>
                  )}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-primary shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          onClick={() => onOpenHomework()}
          className="w-full min-h-[2.75rem] px-4 sm:px-5 text-[12px] font-semibold text-content-muted border-t border-white/[0.06] active:bg-white/[0.04]"
        >
          {L.rest(hidden)}
        </button>
      )}
    </section>
  );
};

export default AssignedExercises;

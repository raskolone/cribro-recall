import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock } from 'lucide-react';
import type { SpecialTask } from '../../types';
import { plZadania } from '../../utils/taskCountLabel';
import FreePracticeEntry from './FreePracticeEntry';

interface StudentHeroActionProps {
  /** Prace do zrobienia (status pending/assigned), od najnowszej. */
  pendingTasks: ReadonlyArray<Pick<SpecialTask, 'id' | 'title' | 'dueDate'>>;
  language: 'pl' | 'en';
  onOpenHomework: (taskId?: string) => void;
  onOpenFreePractice: () => void;
}

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

/**
 * Kafelek akcji w nagłówku pulpitu kursanta: praca domowa do zrobienia albo informacja,
 * że nic nie czeka. Pod nim, w obu stanach, wejście do „Ćwiczeń dowolnych".
 *
 * Wydzielone z `StudentHeroHeader` — nagłówek czyta Firestore, a ta część to czysty widok
 * na propsach, więc da się go sprawdzić w teście. Kafelek pracy domowej wygląda jak dotąd.
 * W stanie „nic nie czeka" zniknął przycisk „Wykonaj ćwiczenia" (prowadził do Praktyki
 * dodatkowej): jego miejsce zajmuje wejście do Ćwiczeń dowolnych pod kafelkiem, to samo
 * w obu stanach.
 */
const StudentHeroAction: React.FC<StudentHeroActionProps> = ({
  pendingTasks,
  language,
  onOpenHomework,
  onOpenFreePractice,
}) => {
  const tText = (pl: string, en: string): string => (language === 'pl' ? pl : en);

  return (
    <div className="space-y-3">
      {pendingTasks.length > 0 ? (
        <div
          data-testid="hero-homework-card"
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
                  {plZadania(pendingTasks.length, language)}
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
        <div
          data-testid="hero-no-homework"
          className="p-4 sm:p-5 rounded-2xl bg-base-100/60 border border-primary/20 flex items-start sm:items-center gap-3.5 min-w-0"
        >
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
      )}

      <FreePracticeEntry onOpen={onOpenFreePractice} />
    </div>
  );
};

export default StudentHeroAction;

import React from 'react';
import { Award, CheckCircle2, Clock, Edit3, Eye, FileText } from 'lucide-react';
import { SpecialTask } from '../../types';

/**
 * Prace domowe jako kompaktowa lista.
 *
 * ══ PO CO OBOK KAFELKÓW ══
 *
 * Kafelek jest dobry, kiedy prac jest kilka: pokazuje wszystko naraz i nie
 * wymaga czytania nagłówków. Przy trzydziestu pracach od dwunastu kursantów
 * ta sama forma znaczy metr przewijania na znalezienie jednej — bo każda
 * praca zajmuje tyle miejsca, ile potrzebuje najdłuższa.
 *
 * Lista odpowiada na inne pytanie. Nie „co to za praca", ale „czyja, w jakim
 * stanie i czy czeka na mnie" — czyli to, co lektor porównuje MIĘDZY
 * pracami. Dlatego te same dane stoją w kolumnach, jedna praca w jednym
 * wierszu, a szczegóły otwierają się dopiero po dotknięciu.
 *
 * ══ DLACZEGO NIE TABELA ══
 *
 * `<table>` przy tej liczbie kolumn nie mieści się na żadnym wąskim ekranie
 * i wymaga poziomego przewijania, którego reszta aplikacji nie ma nigdzie.
 * To jest siatka, która na mniejszych szerokościach zwija kolumny mniej
 * ważne (termin, liczba zdań), zostawiając kursanta, tytuł i stan.
 *
 * Na telefonie ta forma nie jest używana wcale — tam wracają kafelki
 * (patrz `HomeworkScreen`), bo cel dotyku w wierszu listy jest za mały.
 */

interface HomeworkTaskListProps {
  tasks: SpecialTask[];
  /** Czy pokazywać kolumnę kursanta — u kursanta to zawsze on sam. */
  showStudent?: boolean;
  /** Czy praca jest dla lektora nowa (kropka po lewej). */
  isNew?: (task: SpecialTask) => boolean;
  onPreview: (task: SpecialTask) => void;
  onEdit?: (task: SpecialTask) => void;
  onReview?: (task: SpecialTask) => void;
  formatDate: (value?: string) => string;
}

const STATUS = {
  submitted: { label: 'Do sprawdzenia', icon: CheckCircle2, cls: 'bg-primary/20 text-primary' },
  graded: { label: 'Oceniona', icon: Award, cls: 'bg-primary/15 text-primary' },
  completed: { label: 'Zrobiona', icon: CheckCircle2, cls: 'bg-line-soft text-content-muted' },
  pending: { label: 'Do zrobienia', icon: Clock, cls: 'bg-warn/20 text-warn' },
} as const;

const TYPE_LABEL: Record<string, string> = {
  find_errors: 'Poprawianie błędów',
  fill_in_the_blank: 'Uzupełnij luki',
  translation: 'Tłumaczenie zdań',
};

const HomeworkTaskList: React.FC<HomeworkTaskListProps> = ({
  tasks,
  showStudent = true,
  isNew,
  onPreview,
  onEdit,
  onReview,
  formatDate,
}) => (
  <div className="rounded-2xl border border-line-strong bg-base-200/40 overflow-hidden">
    {/* Nagłówek kolumn tylko tam, gdzie kolumny są widoczne. */}
    <div className="hidden lg:grid grid-cols-[1fr_9rem_8rem_9rem_11rem] gap-3 px-4 py-2.5 border-b border-line-strong bg-base-100/40 text-[10px] font-mono font-bold uppercase tracking-wider text-content-muted">
      <span>{showStudent ? 'Kursant · praca' : 'Praca'}</span>
      <span>Rodzaj</span>
      <span>Stan</span>
      <span>Zadano · termin</span>
      <span className="text-right">Działanie</span>
    </div>

    <ul className="divide-y divide-line">
      {tasks.map((task) => {
        const status = STATUS[task.status] ?? STATUS.pending;
        const StatusIcon = status.icon;
        const fresh = isNew?.(task);

        return (
          <li
            key={task.id}
            className="grid grid-cols-1 lg:grid-cols-[1fr_9rem_8rem_9rem_11rem] gap-2 lg:gap-3 items-center px-4 py-3 hover:bg-line-soft transition-colors"
          >
            {/* Kursant i tytuł — jedyna kolumna, która nigdy nie znika. */}
            <button
              type="button"
              onClick={() => onPreview(task)}
              className="text-left min-w-0 group"
              title="Otwórz podgląd pracy"
            >
              <span className="flex items-center gap-1.5">
                {fresh && (
                  // Kolor jako sygnał stanu: jedna kropka zamiast plakietki
                  // „NOWA", bo w wierszu plakietka wypycha tytuł.
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
                {showStudent && (
                  <span className="text-[12px] font-bold text-primary truncate">
                    {task.studentName || task.studentId}
                  </span>
                )}
              </span>
              <span className="block text-sm font-semibold text-text-hi truncate group-hover:text-primary transition-colors">
                {task.title || 'Praca domowa'}
              </span>
            </button>

            <span className="text-[11px] text-content-muted truncate">
              {TYPE_LABEL[task.type ?? 'translation'] ?? 'Tłumaczenie zdań'}
              <span className="lg:hidden"> · {task.sentences?.length || 0} zdań</span>
            </span>

            <span
              className={`inline-flex items-center gap-1 w-fit text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}
            >
              <StatusIcon size={11} />
              {status.label}
            </span>

            <span className="text-[11px] font-mono text-content-muted leading-tight">
              {formatDate(task.createdAt)}
              {task.dueDate && (
                <span className="block text-content-muted/75">termin {task.dueDate}</span>
              )}
            </span>

            <span className="flex items-center gap-1.5 lg:justify-end">
              <button
                type="button"
                onClick={() => onPreview(task)}
                className="p-2 rounded-lg border border-line-strong text-content-muted hover:text-primary hover:border-primary/40 transition-colors"
                title="Podgląd"
                aria-label="Podgląd pracy"
              >
                <Eye size={14} />
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="p-2 rounded-lg border border-line-strong text-content-muted hover:text-primary hover:border-primary/40 transition-colors"
                  title="Edytuj"
                  aria-label="Edytuj pracę"
                >
                  <Edit3 size={14} />
                </button>
              )}
              {/* „Sprawdź" tylko przy pracach, które naprawdę czekają na ocenę —
                  przycisk przy pracy niewysłanej nie miałby czego otworzyć. */}
              {onReview && task.status === 'submitted' && (
                <button
                  type="button"
                  onClick={() => onReview(task)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-accent-ink text-[11px] font-bold hover:brightness-110 transition-all"
                >
                  <FileText size={13} />
                  Sprawdź
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);

export default HomeworkTaskList;

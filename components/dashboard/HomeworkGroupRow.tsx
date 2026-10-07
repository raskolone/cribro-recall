import React, { useState } from 'react';
import { Award, CheckCircle2, ChevronDown, ChevronRight, Clock, Eye, FileText, Users } from 'lucide-react';
import { SpecialTask } from '../../types';
import { GroupHomeworkRow, HomeworkMemberState } from '../../utils/groupHomeworkRows';

/**
 * Jedna praca przypisana wielu kursantom naraz (N dokumentów ze wspólnym
 * `homeworkSetId`) jako jeden, rozwijany wiersz listy lektora.
 *
 * Zwinięty: nazwa grupy, tytuł, data, „X/N oddało" i status zbiorczy.
 * Rozwinięty: kursanci ze swoim stanem i przyciskami działającymi na
 * POJEDYNCZYM dokumencie (podgląd, sprawdzenie/ocena) — ta sama logika, co przy
 * pracy jednego kursanta. Edycji ani usuwania całego zestawu tu nie ma.
 */

interface HomeworkGroupRowProps {
  row: GroupHomeworkRow;
  formatDate: (value?: string) => string;
  onPreview: (task: SpecialTask) => void;
  onReview: (task: SpecialTask) => void;
  /** `tile` — karta w siatce kafelków; `row` — wiersz listy i archiwum. */
  layout?: 'row' | 'tile';
}

const AGGREGATE: Record<HomeworkMemberState, { label: string; icon: typeof Clock; cls: string }> = {
  submitted: { label: 'Do sprawdzenia', icon: CheckCircle2, cls: 'bg-primary/20 text-primary' },
  graded: { label: 'Sprawdzone', icon: Award, cls: 'bg-primary/15 text-primary' },
  pending: { label: 'W trakcie', icon: Clock, cls: 'bg-warn/20 text-warn' },
};

const MEMBER_LABEL: Record<HomeworkMemberState, string> = {
  submitted: 'Do sprawdzenia',
  graded: 'Sprawdzone',
  pending: 'W trakcie',
};

const HomeworkGroupRow: React.FC<HomeworkGroupRowProps> = ({ row, formatDate, onPreview, onReview, layout = 'row' }) => {
  const [open, setOpen] = useState(false);
  const status = AGGREGATE[row.status];
  const StatusIcon = status.icon;
  const statusText = row.status === 'submitted' ? `${status.label} (${row.toCheckCount})` : status.label;

  return (
    <div
      className={
        layout === 'tile'
          ? 'rounded-2xl border border-line-strong bg-base-200/60 overflow-hidden'
          : 'border-b border-line last:border-b-0'
      }
      data-testid="homework-group-row"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-line-soft transition-colors"
      >
        {open ? <ChevronDown size={16} className="text-content-muted shrink-0" /> : <ChevronRight size={16} className="text-content-muted shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-primary truncate">
            <Users size={13} className="shrink-0" />
            <span className="truncate">{row.groupName}</span>
          </span>
          <span className="block text-sm font-semibold text-text-hi truncate">{row.title || 'Praca domowa'}</span>
        </span>
        <span className="hidden sm:block text-[11px] font-mono text-content-muted whitespace-nowrap">
          {formatDate(row.createdAt)}
        </span>
        <span className="text-[11px] font-mono text-content-muted whitespace-nowrap">
          {row.submittedCount}/{row.total} oddało
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${status.cls}`}>
          <StatusIcon size={11} />
          {statusText}
        </span>
      </button>

      {open && (
        <ul className="border-t border-line bg-base-100/30 divide-y divide-line">
          {row.members.map((m) => (
            <li key={m.task.id} className="flex flex-wrap items-center gap-2 pl-11 pr-4 py-2.5">
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-text-hi truncate">{m.name}</span>
              <span className="text-[11px] text-content-muted">{MEMBER_LABEL[m.state]}</span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onPreview(m.task)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-line-strong text-[11px] font-bold text-content-muted hover:text-primary hover:border-primary/40 transition-colors"
                  title="Podgląd pracy tego kursanta"
                >
                  <Eye size={13} />
                  Podgląd
                </button>
                {(m.state === 'submitted' || m.state === 'graded') && (
                  <button
                    type="button"
                    onClick={() => onReview(m.task)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-accent-ink text-[11px] font-bold hover:brightness-110 transition-all"
                  >
                    <FileText size={13} />
                    {m.state === 'submitted' ? 'Sprawdź / Oceń' : 'Ocena'}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HomeworkGroupRow;

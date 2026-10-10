import React, { useId, useState } from 'react';
import { AlertTriangle, Award, Check, ChevronDown, ChevronRight, MessageSquareQuote, Sparkles } from 'lucide-react';
import i18n from 'i18next';
import type { SpecialTask } from '../../types';
import { TONE_CLASSES } from '../../utils/scoreTone';
import {
  formatReviewDate,
  gradeTone,
  isFreshlyReviewed,
  sortNewestReviewed,
  splitVisible,
  stripHomeworkPrefix,
} from '../../utils/gradedHomeworkList';

interface Props {
  tasks: ReadonlyArray<SpecialTask>;
  /** Ile dobrych / do poprawy ma praca (liczone przez ekran z wyników zadań). */
  summarize: (task: SpecialTask) => { correct: number; errors: number };
  /** Wejście w „Zobacz ocenę i feedback" — ekran ustawia też znacznik „obejrzane". */
  onOpen: (task: SpecialTask) => void;
  /** Czy praca była już oglądana na tym urządzeniu (localStorage); każdy odczyt w try/catch po stronie ekranu. */
  seenLocally: (task: SpecialTask) => boolean;
  nowMs?: number;
}

const GradedHomeworkTiles: React.FC<Props> = ({ tasks, summarize, onOpen, seenLocally, nowMs }) => {
  const [expanded, setExpanded] = useState(false);
  const olderId = useId();
  const now = nowMs ?? Date.now();
  const sorted = sortNewestReviewed(tasks);
  const { visible, older, hiddenCount, canToggle } = splitVisible(sorted, expanded);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-line-strong bg-surface-flat p-5 text-center" data-testid="graded-empty">
        <Award className="mx-auto mb-2 h-7 w-7 text-text-3" aria-hidden="true" />
        <p className="text-sm font-semibold text-text-hi">{i18n.t('Brak sprawdzonych prac')}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-2">
          {i18n.t('Gdy lektor sprawdzi Twoją odesłaną pracę domową i wystawi ocenę lub komentarz, pojawi się ona w tym miejscu.')}
        </p>
      </div>
    );
  }

  const renderTile = (task: SpecialTask) => {
    const { correct, errors } = summarize(task);
    const fresh = isFreshlyReviewed(task, now, seenLocally(task));
    const tone = gradeTone(task.grade);
    const date = formatReviewDate(task.reviewedAt);
    const title = stripHomeworkPrefix(task.title);
    return (
      <li key={task.id}>
        <button
          type="button"
          data-testid="graded-tile"
          data-fresh={fresh ? 'true' : 'false'}
          onClick={() => onOpen(task)}
          aria-label={`${title}. ${i18n.t('Zobacz ocenę i feedback')}`}
          className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            fresh ? 'border-2 border-primary bg-primary/10' : 'border border-line-strong bg-surface-flat hover:border-primary'
          }`}
        >
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-[15px] font-bold leading-snug text-text-hi line-clamp-2 break-words [overflow-wrap:anywhere]">{title}</span>
              {tone && (
                <span
                  data-testid="graded-score"
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 bg-surface-flat px-2.5 py-0.5 font-mono text-[13px] font-bold text-text-hi ${TONE_CLASSES[tone].border}`}
                >
                  <Award size={14} className={TONE_CLASSES[tone].icon} aria-hidden="true" />
                  {task.grade}%
                </span>
              )}
            </span>

            {(date || fresh) && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-2">
                {fresh && (
                  <span data-testid="graded-new" className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-accent-ink">
                    <Sparkles size={11} aria-hidden="true" /> {i18n.t('Nowe')}
                  </span>
                )}
                {date && <span className="font-mono">{i18n.t('Sprawdzono: {{date}}', { date })}</span>}
              </span>
            )}

            <span className="flex flex-wrap items-center gap-2 text-xs font-mono text-text-hi">
              <span className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-0.5">
                <Check size={11} className="stroke-[3] text-primary" aria-hidden="true" /> {i18n.t('{{count}} dobrych', { count: correct })}
              </span>
              {errors > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-warn px-2 py-0.5">
                  <AlertTriangle size={11} className="text-warn" aria-hidden="true" /> {i18n.t('{{count}} do poprawy', { count: errors })}
                </span>
              )}
            </span>

            {task.teacherFeedback && (
              <span className="flex items-start gap-2 text-xs italic leading-snug text-text-2">
                <MessageSquareQuote size={13} className="mt-0.5 shrink-0 text-text-3" aria-hidden="true" />
                <span className="min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere]">„{task.teacherFeedback}”</span>
              </span>
            )}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-text-2" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-2.5" data-testid="graded-list">
      <ul className="space-y-2.5">{visible.map(renderTile)}</ul>
      {canToggle && (
        <>
          <ul id={olderId} hidden={!expanded} className="space-y-2.5">{older.map(renderTile)}</ul>
          <button
            type="button"
            data-testid="graded-toggle"
            aria-expanded={expanded}
            aria-controls={olderId}
            onClick={() => setExpanded((v) => !v)}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong px-4 text-sm font-bold text-text-hi hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronDown size={16} className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            {expanded ? i18n.t('Ukryj starsze') : i18n.t('Pokaż starsze ({{count}})', { count: hiddenCount })}
          </button>
        </>
      )}
    </div>
  );
};

export default GradedHomeworkTiles;

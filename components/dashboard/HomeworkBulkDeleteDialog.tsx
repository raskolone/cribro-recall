import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, GraduationCap } from 'lucide-react';
import i18n from 'i18next';
import ConfirmModal from '../ui/ConfirmModal';
import {
  BulkDeleteItem,
  BulkDeleteReport,
  countHandedIn,
  KNOWN_DELETE_ERROR_REASONS,
  summarizeSelection,
} from '../../utils/homeworkBulkDelete';

export type BulkDeletePhase = 'confirm' | 'running' | 'done';

interface HomeworkBulkDeleteDialogProps {
  /** null = zamknięte. */
  phase: BulkDeletePhase | null;
  items: BulkDeleteItem[];
  progress: { done: number; total: number };
  report: BulkDeleteReport | null;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
}

const SUMMARY_LIMIT = 5;
const FAILURES_LIMIT = 8;

/**
 * Masowe usuwanie w trzech krokach, wszystkie w istniejącym `ConfirmModal`:
 * potwierdzenie (liczba, pierwsze pozycje, ostrzeżenia, fokus na „Anuluj") →
 * postęp → raport (usunięto N, błędy M z powodem).
 */
const HomeworkBulkDeleteDialog: React.FC<HomeworkBulkDeleteDialogProps> = ({
  phase,
  items,
  progress,
  report,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (phase === 'confirm') setAcknowledged(false);
  }, [phase]);

  if (!phase) return null;

  if (phase === 'running') {
    const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    // Osobny `key` na każdy krok: modal montuje się od nowa, więc fokus startowy
    // (autoFocus) trafia na właściwy przycisk także po zmianie kroku.
    return (
      <ConfirmModal
        key="running"
        isOpen
        title={i18n.t('Usuwanie…')}
        message=""
        cancelText={i18n.t('Proszę czekać…')}
        cancelDisabled
        hideConfirm
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        <div className="space-y-2" data-testid="bulk-delete-progress">
          <div
            role="progressbar"
            aria-label={i18n.t('Postęp usuwania')}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-2 w-full rounded-full bg-line-strong overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-danger transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-content-muted tabular-nums" aria-live="polite">
            {i18n.t('Usunięto {{done}} z {{total}}', { done: progress.done, total: progress.total })}
          </p>
        </div>
      </ConfirmModal>
    );
  }

  if (phase === 'done') {
    const deleted = report?.deleted.length ?? 0;
    const failed = report?.failed ?? [];
    return (
      <ConfirmModal
        key="done"
        isOpen
        title={failed.length > 0 ? i18n.t('Usuwanie zakończone z błędami') : i18n.t('Usuwanie zakończone')}
        message=""
        cancelText={i18n.t('Zamknij')}
        hideConfirm
        initialFocus="cancel"
        onConfirm={onClose}
        onCancel={onClose}
      >
        <div role="status" className="space-y-3 text-sm" data-testid="bulk-delete-report">
          <p className="font-semibold text-text-hi">{i18n.t('Usunięto: {{count}}', { count: deleted })}</p>
          {failed.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-semibold text-danger">{i18n.t('Błędy: {{count}}', { count: failed.length })}</p>
              <ul className="space-y-1 text-content-muted">
                {failed.slice(0, FAILURES_LIMIT).map(({ item, reason }) => (
                  <li key={item.key} className="break-words">
                    „{item.title}" — {item.studentName}:{' '}
                    <span className="text-danger">
                      {KNOWN_DELETE_ERROR_REASONS.has(reason) ? i18n.t(reason) : reason}
                    </span>
                  </li>
                ))}
              </ul>
              {failed.length > FAILURES_LIMIT && (
                <p className="text-content-muted">
                  {i18n.t('…i jeszcze {{count}}', { count: failed.length - FAILURES_LIMIT })}
                </p>
              )}
            </div>
          )}
        </div>
      </ConfirmModal>
    );
  }

  const handedIn = countHandedIn(items);
  const needsAck = handedIn > 0;
  const { lines, moreLines } = summarizeSelection(items, SUMMARY_LIMIT);

  return (
    <ConfirmModal
      key="confirm"
      isOpen
      title={i18n.t('Usunąć zaznaczone pozycje?')}
      message={i18n.t(
        'Do usunięcia: {{count}}. Tej operacji nie można cofnąć — razem z pracami i testami znikną odpowiedzi kursantów, wyniki i komentarze.',
        { count: items.length }
      )}
      confirmText={i18n.t('Usuń ({{count}})', { count: items.length })}
      cancelText={i18n.t('Anuluj')}
      confirmDisabled={items.length === 0 || (needsAck && !acknowledged)}
      initialFocus="cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <ul className="space-y-1.5 text-sm" data-testid="bulk-delete-summary">
        {lines.map((line, i) => {
          const Icon = line.kind === 'test' ? GraduationCap : BookOpen;
          return (
            <li key={`${line.kind}-${i}`} className="flex items-start gap-2 min-w-0">
              <Icon size={14} className="shrink-0 mt-0.5 text-content-muted" aria-hidden />
              <span className="min-w-0 break-words">
                {line.kind === 'test' && <span className="text-content-muted">{i18n.t('Test')} </span>}
                <span className="font-semibold text-text-hi">„{line.title}"</span>
                <span className="text-content-muted"> — {line.who}</span>
                {line.count > 1 && (
                  <span className="text-content-muted"> · {i18n.t('cały zestaw: {{count}}', { count: line.count })}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {moreLines > 0 && (
        <p className="mt-1.5 text-sm text-content-muted">{i18n.t('…i jeszcze {{count}}', { count: moreLines })}</p>
      )}

      {needsAck && (
        <div role="alert" className="mt-4 p-3 rounded-xl border border-danger/40 bg-danger/10 space-y-2.5" data-testid="bulk-delete-handed-in">
          <p className="flex items-start gap-2 text-sm font-bold text-danger">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden />
            <span>
              {i18n.t(
                'Oddane lub ocenione: {{count}}. Są w nich rozwiązania kursantów i oceny — po usunięciu nie da się ich odzyskać.',
                { count: handedIn }
              )}
            </span>
          </p>
          <label className="flex items-start gap-2 text-sm text-text-hi cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              data-testid="bulk-delete-ack"
              className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer accent-danger"
            />
            <span>{i18n.t('Rozumiem, usuwam także oddane i ocenione prace')}</span>
          </label>
        </div>
      )}
    </ConfirmModal>
  );
};

export default HomeworkBulkDeleteDialog;

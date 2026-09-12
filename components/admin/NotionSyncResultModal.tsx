import React from 'react';
import { AlertTriangle, Check, KeyRound, X } from 'lucide-react';
import { ImportReport } from '../../services/notionSync';

/**
 * Wynik importu jako okno, a nie komunikat pod przyciskiem.
 *
 * Import trwa dziesiątki sekund i lektor w tym czasie patrzy gdzie indziej.
 * Komunikat doklejony na dole listy potrafił mu umknąć — a razem z nim hasła
 * startowe, które pokazujemy tylko raz.
 */

interface Props {
  report?: ImportReport | null;
  error?: string;
  onClose: () => void;
}

const NotionSyncResultModal: React.FC<Props> = ({ report, error, onClose }) => {
  if (!report && !error) return null;

  const failed = Boolean(error);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notion-result-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/12 bg-base-200 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            id="notion-result-title"
            className={`flex items-center gap-2 text-base font-extrabold ${failed ? 'text-warn' : 'text-primary'}`}
          >
            {failed ? <AlertTriangle size={18} /> : <Check size={18} />}
            {failed ? 'Import się nie udał' : 'Import zakończony'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-white/12 text-content-muted hover:text-text-hi"
          >
            <X size={16} />
          </button>
        </div>

        {failed && (
          <p className="text-sm text-content bg-warn/10 border border-warn/25 rounded-xl p-3 break-words">
            {error}
          </p>
        )}

        {report && (
          <>
            <dl className="grid grid-cols-2 gap-2">
              {[
                ['Zaimportowane lekcje', report.lessonsImported],
                ['Założone konta', report.accountsCreated.length],
                ['Uzupełnione adresy', report.emailsUpdated],
                ['Do przejrzenia', report.needsReview],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-xl bg-base-100/50 border border-white/8 px-3 py-2">
                  <dt className="text-[11px] text-content-muted">{label}</dt>
                  <dd className="text-lg font-extrabold text-white font-mono">{value as number}</dd>
                </div>
              ))}
            </dl>

            {report.accountsCreated.length > 0 && (
              <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 space-y-2">
                <p className="flex items-center gap-2 text-xs font-bold text-warn">
                  <KeyRound size={13} /> Hasła startowe — zapisz je teraz, nie pokażemy ich ponownie
                </p>
                <ul className="space-y-1">
                  {report.accountsCreated.map((a) => (
                    <li key={a.email} className="text-[11px] font-mono text-content break-all">
                      {a.name} · {a.email} · <strong className="text-warn">{a.tempPassword}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-content-muted">Pominięte pozycje</p>
                <ul className="space-y-1">
                  {report.warnings.map((w, i) => (
                    <li key={i} className="text-[11px] text-warn/90">· {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.lessonsImported === 0 && report.accountsCreated.length === 0 && (
              <p className="text-xs text-content-muted">
                Nic nie weszło. Najczęstszy powód: zaznaczeni kursanci nie mają konta
                w aplikacji, a zakładanie kont nie było zaznaczone.
              </p>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="w-full min-h-[2.75rem] rounded-xl bg-primary text-accent-ink font-bold text-sm"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
};

export default NotionSyncResultModal;

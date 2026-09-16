import React from 'react';
import { AlertCircle, Calendar, CheckCircle2, FileQuestion, HelpCircle, X } from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';

export interface UnmatchedTranscriptItem {
  id: string;
  title: string;
  date: string;
  snippet?: string;
  reason?: string;
}

interface NotionUnmatchedTranscriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unmatched: UnmatchedTranscriptItem[];
  importedCount: number;
}

export const NotionUnmatchedTranscriptsModal: React.FC<NotionUnmatchedTranscriptsModalProps> = ({
  isOpen,
  onClose,
  unmatched,
  importedCount,
}) => {
  useEscapeModal(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notion-unmatched-modal-title"
        className="relative w-full max-w-2xl bg-base-200 border border-line-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 id="notion-unmatched-modal-title" className="text-base sm:text-lg font-bold text-text-hi">
                Raport pobierania z Notion
              </h3>
              <p className="text-xs text-content-muted">
                Weryfikacja spotkań i dopasowanie do bazy kursantów
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij raport"
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {importedCount > 0 && (
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-primary shrink-0" />
              <div className="text-xs text-text-hi">
                <span className="font-bold text-primary">{importedCount}</span> {importedCount === 1 ? 'transkrypcja została pomyślnie dopasowana i zaimportowana' : 'transkrypcje zostały pomyślnie dopasowane i zaimportowane'} do lekcji kursantów.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <FileQuestion size={14} />
                Pominięte transkrypcje ({unmatched.length})
              </h4>
              <span className="text-[11px] text-content-muted">Nie utworzono wpisów lekcji</span>
            </div>
            <p className="text-xs text-content-muted leading-relaxed">
              Poniższe transkrypcje nie pasują do żadnego kursanta ani grupy w Twojej bazie CRM. Zostały zignorowane, aby nie zaśmiecać historii lekcji spotkaniami prywatnymi lub niedotyczącymi zajęć językowych.
            </p>
          </div>

          <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
            {unmatched.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3.5 rounded-xl bg-base-100/60 border border-line-strong hover:border-line-soft transition-all space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-text-hi">{item.title}</span>
                  <span className="text-[10px] font-mono text-content-muted bg-line-soft px-2 py-0.5 rounded border border-line-strong shrink-0 flex items-center gap-1">
                    <Calendar size={10} />
                    {item.date}
                  </span>
                </div>
                {item.snippet && (
                  <p className="text-[11px] text-content-muted italic line-clamp-2 bg-base-200/40 p-2 rounded border border-line">
                    „{item.snippet}…”
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 font-medium">
                  <HelpCircle size={12} className="shrink-0" />
                  <span>{item.reason || 'Brak powiązania z kursantem'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line-strong bg-base-300/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-accent-ink text-xs font-bold hover:bg-primary/90 transition-colors shadow-btn cursor-pointer"
          >
            Rozumiem, zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
export default NotionUnmatchedTranscriptsModal;

import React, { useState } from 'react';
import { CheckCircle2, Database, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import Button from '../ui/Button';

export interface NotionPreviewItem {
  id: string;
  title: string;
  studentName: string;
  date: string;
  status: string;
}

interface NotionImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  items: NotionPreviewItem[];
  isImporting: boolean;
  onConfirmImport: (pageIds: string[]) => void;
}

/**
 * Podgląd Pull-on-Demand: lektor widzi, co znalazłoby się w Notion dla
 * WYBRANEGO kursanta, i sam zaznacza, co ma wejść do bazy — nic nie zapisuje
 * się automatycznie samym otwarciem tego modala.
 */
export const NotionImportPreviewModal: React.FC<NotionImportPreviewModalProps> = ({
  isOpen,
  onClose,
  studentName,
  items,
  isImporting,
  onConfirmImport,
}) => {
  useEscapeModal(isOpen, onClose);

  const importable = items.filter((item) => item.status === 'do importu');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (isOpen) setSelected(new Set(importable.map((item) => item.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, items]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notion-preview-modal-title"
        className="relative w-full max-w-2xl bg-base-200 border border-line-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/25 flex items-center justify-center text-primary shrink-0">
              <Database size={20} />
            </div>
            <div className="min-w-0">
              <h3 id="notion-preview-modal-title" className="text-base sm:text-lg font-bold text-text-hi truncate">
                Podgląd z Notion — {studentName}
              </h3>
              <p className="text-xs text-content-muted">
                Nic nie zostało jeszcze zapisane. Zaznacz, co ma trafić do historii lekcji.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij podgląd"
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5">
          {items.length === 0 && (
            <p className="text-sm text-content-muted italic text-center py-6">
              Brak stron w Notion powiązanych z tym kursantem.
            </p>
          )}

          {items.map((item) => {
            const isImportable = item.status === 'do importu';
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  isImportable
                    ? 'bg-base-100/60 border-line-strong hover:border-primary/40'
                    : 'bg-base-100/30 border-line opacity-60'
                }`}
              >
                {isImportable ? (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
                  />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 text-content-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-content-muted">{item.date}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        isImportable
                          ? 'bg-primary/15 text-primary border-primary/25'
                          : 'bg-line-soft text-content-muted border-line-strong'
                      }`}
                    >
                      {item.status === 'istnieje' ? 'Już zaimportowano' : item.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-text-hi truncate mt-0.5">{item.title}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-line-strong bg-base-300/50 flex items-center justify-between gap-3">
          <span className="text-xs text-content-muted">
            {selected.size} z {importable.length} zaznaczonych
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose} disabled={isImporting}>
              Anuluj
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onConfirmImport(Array.from(selected))}
              isLoading={isImporting}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              Zaimportuj zaznaczone
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotionImportPreviewModal;

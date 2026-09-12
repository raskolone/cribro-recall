import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ScratchpadTemplate } from '../../types';
import {
  createScratchpadTemplate,
  deleteScratchpadTemplate,
  listScratchpadTemplates,
  updateScratchpadTemplate,
} from '../../services/scratchpadTemplateService';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface ScratchpadTemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { uid: string; name: string };
  /** Aktualna treść edytora — pozwala zapisać ją jako nowy szablon jednym kliknięciem. */
  currentContentHtml?: string;
  /** Wołane po każdej udanej zmianie (dodaniu/edycji/usunięciu), żeby edytor odświeżył listę do wstawiania. */
  onTemplatesChanged?: () => void;
}

type FormMode = 'list' | 'new' | 'new-from-current' | string; // string = ID edytowanego szablonu

/**
 * Prosty modal zarządzania szablonami wspólnego notatnika — wyłącznie dla
 * lektora/admina (kolekcja `scratchpadTemplates` jest zamknięta regułą
 * `isAdmin()` w `firestore.rules`). Kursant nigdy tego nie widzi ani nie
 * wybiera szablonu sam — tylko lektor wstawia gotową treść do jego notatnika.
 */
export const ScratchpadTemplateManagerModal: React.FC<ScratchpadTemplateManagerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentContentHtml,
  onTemplatesChanged,
}) => {
  useEscapeModal(isOpen, onClose, 5);

  const [templates, setTemplates] = useState<ScratchpadTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>('list');
  const [formTitle, setFormTitle] = useState('');
  const [formHtml, setFormHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listScratchpadTemplates();
      setTemplates(list);
    } catch (err: any) {
      console.error('[Scratchpad] Błąd pobierania szablonów:', err);
      setError(err?.message || 'Nie udało się pobrać szablonów.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setMode('list');
    setConfirmDeleteId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const startNew = () => {
    setFormTitle('');
    setFormHtml('');
    setMode('new');
  };

  const startNewFromCurrent = () => {
    setFormTitle('');
    setFormHtml(currentContentHtml || '');
    setMode('new-from-current');
  };

  const startEdit = (tpl: ScratchpadTemplate) => {
    setFormTitle(tpl.title);
    setFormHtml(tpl.contentHtml);
    setMode(tpl.id);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      if (mode === 'new' || mode === 'new-from-current') {
        await createScratchpadTemplate(
          { title: formTitle.trim(), contentHtml: formHtml },
          currentUser.uid
        );
      } else {
        await updateScratchpadTemplate(mode, { title: formTitle.trim(), contentHtml: formHtml });
      }
      setMode('list');
      await load();
      onTemplatesChanged?.();
    } catch (err: any) {
      console.error('[Scratchpad] Błąd zapisu szablonu:', err);
      setError(err?.message || 'Nie udało się zapisać szablonu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteScratchpadTemplate(id);
      setConfirmDeleteId(null);
      await load();
      onTemplatesChanged?.();
    } catch (err: any) {
      console.error('[Scratchpad] Błąd usuwania szablonu:', err);
      setError(err?.message || 'Nie udało się usunąć szablonu.');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormMode = mode !== 'list';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg max-h-[85vh] bg-base-100 rounded-3xl border border-line-strong shadow-2xl flex flex-col overflow-hidden">
        <header className="px-5 py-4 border-b border-line-strong flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-text-hi">
            {isFormMode ? (mode === 'new' || mode === 'new-from-current' ? 'Nowy szablon' : 'Edycja szablonu') : 'Szablony notatnika'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isFormMode ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-2 mb-1">Tytuł szablonu</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="np. Nowa lekcja — struktura"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-line-strong text-sm text-text-hi placeholder:text-text-faint focus:outline-none focus:border-accent/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-2 mb-1">Treść (HTML)</label>
                <textarea
                  value={formHtml}
                  onChange={e => setFormHtml(e.target.value)}
                  rows={10}
                  placeholder="<h3>Nowe słownictwo</h3><ul><li>...</li></ul>"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-line-strong text-xs font-mono text-text-hi placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode('list')} disabled={isSaving}>
                  Anuluj
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  disabled={!formTitle.trim()}
                >
                  Zapisz szablon
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={startNew} className="flex items-center gap-1.5">
                  <Plus size={14} /> Nowy pusty szablon
                </Button>
                {typeof currentContentHtml === 'string' && currentContentHtml.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startNewFromCurrent}
                    className="flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Z aktualnej treści notatnika
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-text-2">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-xs text-text-faint py-4 text-center">
                  Brak zapisanych szablonów — dodaj pierwszy powyżej.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {templates.map(tpl => (
                    <li
                      key={tpl.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-line-strong"
                    >
                      <span className="text-xs font-semibold text-text-hi truncate">{tpl.title}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {confirmDeleteId === tpl.id ? (
                          <>
                            <span className="text-[11px] text-text-2 mr-1">Na pewno?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(tpl.id)}
                              disabled={isSaving}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors cursor-pointer"
                            >
                              Usuń
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-text-2 hover:text-content transition-colors cursor-pointer"
                            >
                              Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(tpl)}
                              title="Edytuj szablon"
                              aria-label="Edytuj szablon"
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tpl.id)}
                              title="Usuń szablon"
                              aria-label="Usuń szablon"
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-text-2 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScratchpadTemplateManagerModal;

import React, { useMemo, useState } from 'react';
import { FileEdit, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { NoteDraft, StudentGroup, User } from '../../types';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import { formatDraftDate } from '../../services/draftsService';

interface ScratchpadStudentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  students: User[];
  onPick: (student: { id?: string; name: string }) => void;
  /**
   * Grupy zajęciowe, wyświetlane w osobnej sekcji nad listą kursantów
   * indywidualnych — każda ma jeden wspólny notatnik (`notebooks/{groupId}`
   * w opisie zlecenia, w tym repo `sp_group_{groupId}`, patrz `groupService.ts`).
   */
  groups?: StudentGroup[];
  onPickGroup?: (group: StudentGroup) => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /**
   * Dodatkowa decyzja podejmowana razem z wyborem kursanta — stoi nad polem
   * wyszukiwania, bo dotyczy tego, co się stanie PO wybraniu, a nie tego,
   * kogo się szuka. Kontekst przed lekcją wstawia tu wybór zakresu
   * („ostatnia / 2 ostatnie / 3 ostatnie lekcje").
   */
  headerExtra?: React.ReactNode;
  /**
   * Akcja pomocnicza pod listą — dla wejść, które mają też opcję pominięcia
   * wyboru kursanta (np. notatnik roboczy bez przypisania).
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Wersje robocze (szkice) lektora — niezależne od profilu kursanta.
   * Gdy podane, obok listy kursantów pojawia się osobna zakładka.
   */
  drafts?: NoteDraft[];
  onPickDraft?: (draft: NoteDraft) => void;
  onCreateDraft?: () => void;
  onRenameDraft?: (draft: NoteDraft, title: string) => void;
  onDeleteDraft?: (draft: NoteDraft) => void;
}

const displayName = (student: User): string => formatStudentDisplayName(student);

/**
 * Wybór kursanta przed otwarciem jego brudnopisu.
 *
 * Brudnopis jest jeden na kursanta i trwały, więc wejście „z góry" panelu musi
 * najpierw ustalić, czyj dokument otworzyć — inaczej lektor musiałby wracać do
 * profilu kursanta tylko po to, żeby kliknąć notatki.
 */
export const ScratchpadStudentPicker: React.FC<ScratchpadStudentPickerProps> = ({
  isOpen,
  onClose,
  students,
  onPick,
  groups = [],
  onPickGroup,
  title = 'Otwórz notatnik',
  subtitle = 'Wybierz kursanta, którego notatki chcesz otworzyć',
  icon,
  headerExtra,
  secondaryAction,
  drafts,
  onPickDraft,
  onCreateDraft,
  onRenameDraft,
  onDeleteDraft,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'drafts'>('students');
  const [renamingDraftId, setRenamingDraftId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const hasDraftsTab = Boolean(drafts && onCreateDraft);

  const commitRename = (draft: NoteDraft) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== draft.title) {
      onRenameDraft?.(draft, trimmed);
    }
    setRenamingDraftId(null);
  };

  const matches = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const sorted = [...students].sort((a, b) =>
      displayName(a).localeCompare(displayName(b), 'pl')
    );
    if (!needle) return sorted;
    return sorted.filter(student =>
      [displayName(student), student.username, student.email]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(needle))
    );
  }, [students, searchTerm]);

  const matchingGroups = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter(g => g.name.toLowerCase().includes(needle));
  }, [groups, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-ink-2 border border-line-strong shadow-ambient-lg flex flex-col overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-accent/12 text-accent border border-accent/25 shrink-0">
              {icon || <FileEdit size={16} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-hi">{title}</h2>
              <p className="text-[11px] text-text-faint">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="shrink-0 h-8 w-8 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </header>

        {headerExtra && (
          <div className="px-4 py-3 border-b border-line-soft">{headerExtra}</div>
        )}

        {hasDraftsTab && (
          <div className="px-4 pt-3">
            <div className="flex p-1 bg-ink rounded-xl border border-line-strong">
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'students'
                    ? 'bg-ink-2 text-text-hi shadow-sm border border-line-strong'
                    : 'text-text-faint hover:text-text-2'
                }`}
              >
                Kursanci
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('drafts')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'drafts'
                    ? 'bg-ink-2 text-accent shadow-sm border border-line-strong'
                    : 'text-text-faint hover:text-text-2'
                }`}
              >
                Wersje robocze
              </button>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="px-4 py-3 border-b border-line-soft">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Szukaj po imieniu, loginie lub adresie e-mail…"
                autoFocus
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-ink border border-line-strong text-xs text-content placeholder:text-text-faint focus:outline-none focus:border-accent/55"
              />
            </div>
          </div>
        )}

        {activeTab === 'drafts' && hasDraftsTab && (
          <div className="flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={onCreateDraft}
              className="w-full mb-2 px-2.5 py-2 rounded-xl flex items-center justify-center gap-2 border border-dashed border-accent/40 text-accent text-xs font-bold hover:bg-accent/10 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Nowy szkic
            </button>
            {(!drafts || drafts.length === 0) ? (
              <p className="py-10 text-center text-xs text-text-faint">
                Brak wersji roboczych — zacznij od nowego szkicu.
              </p>
            ) : (
              drafts.map(draft => (
                <div
                  key={draft.id}
                  className="w-full px-2.5 py-2 rounded-xl flex items-center gap-3 hover:bg-white/[0.07] transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => onPickDraft?.(draft)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-500 flex items-center justify-center">
                      <FileEdit size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      {renamingDraftId === draft.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          autoFocus
                          onChange={event => setRenameValue(event.target.value)}
                          onClick={event => event.stopPropagation()}
                          onBlur={() => commitRename(draft)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') commitRename(draft);
                            if (event.key === 'Escape') setRenamingDraftId(null);
                          }}
                          className="w-full px-1.5 py-0.5 rounded-lg bg-ink border border-accent/55 text-xs font-semibold text-content focus:outline-none"
                        />
                      ) : (
                        <span
                          className="block text-xs font-semibold text-content truncate"
                          onDoubleClick={event => {
                            if (!onRenameDraft) return;
                            event.stopPropagation();
                            setRenamingDraftId(draft.id);
                            setRenameValue(draft.title);
                          }}
                        >
                          {draft.title}
                        </span>
                      )}
                      <span className="block text-[11px] text-text-faint truncate">
                        {formatDraftDate(draft.updatedAt)}
                      </span>
                    </span>
                  </button>
                  {onDeleteDraft && (
                    <button
                      type="button"
                      aria-label="Usuń szkic"
                      onClick={() => onDeleteDraft(draft)}
                      className="shrink-0 h-7 w-7 rounded-lg text-text-faint hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'students' && (
        <div className="flex-1 overflow-y-auto p-2">
          {matchingGroups.length > 0 && onPickGroup && (
            <div className="mb-2 pb-2 border-b border-line-soft">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-faint">
                Grupy zajęciowe
              </p>
              {matchingGroups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onPickGroup(group)}
                  className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-3 hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 shrink-0 rounded-xl bg-primary/12 border border-primary/25 text-primary flex items-center justify-center">
                    <Users size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-content truncate">{group.name}</span>
                    <span className="block text-[11px] text-text-faint truncate">
                      {group.memberIds.length} kursantów
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {matches.length === 0 ? (
            <p className="py-10 text-center text-xs text-text-faint">
              Brak kursantów pasujących do wyszukiwania.
            </p>
          ) : (
            matches.map(student => {
              const name = displayName(student);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onPick({ id: student.id, name })}
                  className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-3 hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 shrink-0 rounded-xl bg-accent/12 border border-accent/25 text-accent flex items-center justify-center text-xs font-bold overflow-hidden">
                    {student.photoURL ? (
                      <img src={student.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-content truncate">{name}</span>
                    <span className="block text-[11px] text-text-faint truncate">
                      @{student.username}
                      {student.level ? ` · ${student.level}` : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="text-slate-400 hover:text-slate-200 text-sm font-medium py-2 border-t border-slate-800 w-full text-center block cursor-pointer"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default ScratchpadStudentPicker;

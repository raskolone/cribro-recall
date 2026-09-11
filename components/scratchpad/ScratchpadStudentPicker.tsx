import React, { useMemo, useState } from 'react';
import { FileEdit, Search, X } from 'lucide-react';
import { User } from '../../types';

interface ScratchpadStudentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  students: User[];
  onPick: (student: { id: string; name: string }) => void;
}

const displayName = (student: User): string =>
  student.firstName
    ? `${student.firstName} ${student.lastName || ''}`.trim()
    : student.username;

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
}) => {
  const [searchTerm, setSearchTerm] = useState('');

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
              <FileEdit size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-hi">Otwórz brudnopis</h2>
              <p className="text-[11px] text-text-faint">
                Wybierz kursanta, którego notatki chcesz otworzyć
              </p>
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

        <div className="flex-1 overflow-y-auto p-2">
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
      </div>
    </div>
  );
};

export default ScratchpadStudentPicker;

import React from 'react';
import { CalendarClock, X } from 'lucide-react';
import PreLessonContext from './PreLessonContext';
import { BriefingScope } from '../../services/preLessonBriefing';

/**
 * Kontekst przed lekcją jako okno nad panelem, a nie zakładka w profilu.
 *
 * ══ DLACZEGO OKNO ══
 *
 * Kontekst czyta się na minutę przed zajęciami i zamyka — to nie jest
 * miejsce, w którym się pracuje, tylko rzecz, którą się sprawdza. Zakładka
 * w profilu kursanta wymagała najpierw wejścia w profil, czyli dokładnie
 * tych trzech kliknięć, które ten ekran miał usunąć. Kafelek na pulpicie
 * pyta „o kogo chodzi" i od razu pokazuje odpowiedź.
 *
 * Lekcji nie przekazujemy: wybrany kursant nie musi być tym otwartym
 * w panelu, więc `PreLessonContext` dociąga je sam po `studentId`.
 */
interface PreLessonContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: { id: string; name: string } | null;
  /** Imię lektora — odprawa zwraca się do niego wprost. */
  teacherName: string;
  /** Zakres wybrany przy kliknięciu kafelka; da się go zmienić w oknie. */
  scope: BriefingScope;
  onScopeChange: (scope: BriefingScope) => void;
}

const PreLessonContextModal: React.FC<PreLessonContextModalProps> = ({
  isOpen,
  onClose,
  student,
  teacherName,
  scope,
  onScopeChange,
}) => {
  if (!isOpen || !student) return null;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-start justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-4 rounded-2xl bg-base-200 border border-line-strong shadow-[var(--shadow-lg)] flex flex-col overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <header className="px-4 py-3 bg-base-300/80 border-b border-line-strong flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-accent/12 text-accent border border-accent/25 shrink-0">
              <CalendarClock size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-hi truncate">Kontekst przed lekcją</h2>
              <p className="text-[11px] text-text-faint truncate">{student.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij kontekst"
            className="shrink-0 h-9 w-9 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-4 sm:p-5">
          <PreLessonContext
            studentId={student.id}
            studentName={student.name}
            teacherName={teacherName}
            scope={scope}
            onScopeChange={onScopeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default PreLessonContextModal;

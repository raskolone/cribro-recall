import React from 'react';
import { ArrowLeft, MoreHorizontal, UserCheck } from 'lucide-react';
import { User } from '../../types';
import MenuDropdown from '../ui/MenuDropdown';

/**
 * NAGŁÓWEK PROFILU KURSANTA — minimalny pasek tożsamości.
 *
 * Metryki konta (e-mail, poziom, logowania, ostatnia wizyta) i akcje
 * dot. hasła/zaproszenia żyją wyłącznie w zakładce „Profil & Dane" —
 * tutaj byłyby duplikatem. Nagłówek pokazuje tylko to, co trzeba widzieć
 * niezależnie od tego, która zakładka jest otwarta: kto to jest i czy
 * już się kiedyś zalogował.
 */

interface StudentProfileHeaderProps {
  student: User & { id: string };
  /** Powrót do panelu lektora — jedyne wyjście z widoku kursanta. */
  onBack: () => void;
  onChangeStudent: () => void;
  /** Zachowane w propsach dla zgodności z wywołaniami z AdminPanel.tsx —
   *  edycja kontaktu/poziomu dostępna teraz wyłącznie z zakładki „Profil & Dane". */
  onEditContact: () => void;
  onEditLevel: () => void;
  onToggleInvitationSent?: (sent: boolean) => void;
}

const StudentProfileHeader: React.FC<StudentProfileHeaderProps> = ({
  student,
  onBack,
  onChangeStudent,
}) => {
  const fullName =
    `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username;
  const initial = (student.firstName || student.username || '?')[0].toUpperCase();

  const hasLoggedInBefore = Boolean(
    student.isActivated || (student.loginCount && student.loginCount > 0) || student.lastLoginDate
  );

  const lastVisitLabel = student.lastLoginDate
    ? new Date(student.lastLoginDate).toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section className="rounded-2xl border border-line-strong bg-base-200/60 shadow-ambient-sm overflow-hidden">
      {/* ── Piętro 1: kto to jest ── */}
      <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-strong bg-base-100/30">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center font-bold text-primary text-lg shrink-0 overflow-hidden">
            {student.photoURL ? (
              <img src={student.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
                ID kursanta
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-text-hi truncate">{fullName}</h2>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  hasLoggedInBefore ? 'bg-emerald-400' : 'bg-content-muted/40'
                }`}
              />
              <span className={hasLoggedInBefore ? 'text-content-muted' : 'text-warn'}>
                {hasLoggedInBefore
                  ? `Ostatnia wizyta: ${lastVisitLabel}`
                  : 'Oczekuje na 1. logowanie'}
              </span>
            </div>
          </div>
        </div>

        {/* Wyjście i menu */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi hover:border-primary/40 text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Wróć do panelu lektora"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Panel lektora</span>
          </button>

          <MenuDropdown
            align="end"
            width={248}
            aria-label="Więcej czynności dla kursanta"
            triggerTitle="Więcej czynności"
            triggerClassName="p-2 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi hover:border-primary/40 transition-colors cursor-pointer flex items-center justify-center"
            trigger={<MoreHorizontal size={16} />}
            sections={[
              {
                id: 'student',
                items: [
                  {
                    id: 'switch',
                    label: 'Zmień kursanta',
                    description: 'Otwórz profil kogoś innego',
                    icon: <UserCheck size={14} />,
                    onSelect: onChangeStudent,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
};

export default StudentProfileHeader;

import React, { useMemo, useState } from 'react';
import { ChevronRight, Search, ShieldCheck, GraduationCap } from 'lucide-react';
import { User } from '../../types';

/**
 * Uproszczona lista kont — domyślne wejście w „Profil kursantów".
 *
 * ══ PO CO OSOBNY WIDOK, SKORO JEST BAZA ══
 *
 * Baza kursantów jest arkuszem: siedem kolumn, zaznaczanie wielu wierszy,
 * zmiana ról, edycja adresów, eksport CSV, filtry uprawnień. Wszystko to jest
 * potrzebne — raz na jakiś czas. Dziewięć razy na dziesięć lektor wchodzi tu
 * po jedną rzecz: kliknąć nazwisko i wejść w profil. Arkusz każe wtedy
 * przebiec wzrokiem przez uprawnienia, adresy i liczniki logowań, żeby trafić
 * w jedną komórkę, która go interesuje — a na telefonie jeszcze przewinąć go
 * w poziomie.
 *
 * Ta lista robi tylko to jedno: nazwisko, poziom, wejście. Pełny arkusz jest
 * o jedno kliknięcie dalej i nic nie traci.
 */

interface StudentSimpleListProps {
  users: User[];
  onSelectUser: (user: User) => void;
}

const displayName = (user: User): string =>
  user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username;

const StudentSimpleList: React.FC<StudentSimpleListProps> = ({ users, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const groups = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const matching = users.filter(user => {
      if (!needle) return true;
      return [displayName(user), user.username, user.email]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(needle));
    });

    const byName = (a: User, b: User) =>
      displayName(a).localeCompare(displayName(b), 'pl');

    return {
      /* Kursanci na górze i bez nagłówka — to po nich się tu przychodzi.
         Konta lektorów i adminów są niżej, pod własnym podpisem: trzeba je
         widzieć, ale wymieszane z kursantami tylko wydłużałyby szukanie. */
      students: matching.filter(u => !u.role || u.role === 'user').sort(byName),
      staff: matching.filter(u => u.role === 'teacher' || u.role === 'admin').sort(byName),
    };
  }, [users, searchTerm]);

  const renderRow = (user: User) => {
    const name = displayName(user);
    return (
      <button
        key={user.id}
        type="button"
        onClick={() => onSelectUser(user)}
        className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-white/[0.06] transition-colors cursor-pointer group"
      >
        <span className="w-9 h-9 shrink-0 rounded-xl bg-primary/12 border border-primary/25 text-primary flex items-center justify-center text-sm font-bold overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-hi truncate">{name}</span>
          <span className="block text-[11px] text-content-muted font-mono truncate">
            @{user.username}
          </span>
        </span>

        {user.level && (
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-line-soft border border-line text-[11px] font-mono font-bold text-text-2">
            {user.level}
          </span>
        )}

        {(user.role === 'admin' || user.role === 'teacher') && (
          <span
            className="shrink-0 text-content-muted"
            title={user.role === 'admin' ? 'Administrator' : 'Nauczyciel'}
          >
            {user.role === 'admin' ? <ShieldCheck size={14} /> : <GraduationCap size={14} />}
          </span>
        )}

        <ChevronRight
          size={15}
          className="shrink-0 text-content-muted group-hover:text-primary transition-colors"
        />
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          placeholder="Szukaj po imieniu, loginie lub adresie e-mail…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-ink border border-line-strong text-sm text-content placeholder:text-text-faint focus:outline-none focus:border-primary/55"
        />
      </div>

      {groups.students.length === 0 && groups.staff.length === 0 ? (
        <p className="py-10 text-center text-sm text-content-muted">
          Brak kont pasujących do wyszukiwania.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-0.5">{groups.students.map(renderRow)}</div>

          {groups.staff.length > 0 && (
            <div className="space-y-0.5 pt-3 border-t border-line-soft">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
                Nauczyciele i administratorzy
              </p>
              {groups.staff.map(renderRow)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentSimpleList;

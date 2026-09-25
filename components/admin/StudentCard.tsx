import React from 'react';
import { User } from '../../types';
import { BookOpen, FileEdit, User as UserIcon, Users } from 'lucide-react';

export interface StudentCardProps {
  student: User;
  isSelected?: boolean;
  isActive?: boolean;
  onSelect: (studentId: string, targetTab?: string) => void;
  onToggleSelect: (studentId: string) => void;
  onOpenScratchpad?: (studentId: string, isGroup?: boolean) => void;
}

export function getStudentInitials(student: User, isGrp?: boolean): string {
  if (isGrp) return 'GRP';
  const firstName = (student.firstName || '').trim();
  const lastName = (student.lastName || '').trim();
  if (firstName && lastName) {
    const f = Array.from(firstName)[0] || '';
    const l = Array.from(lastName)[0] || '';
    return `${f}${l}`.toUpperCase();
  }
  const name = (student.displayName || student.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const f = Array.from(parts[0])[0] || '';
      const l = Array.from(parts[parts.length - 1])[0] || '';
      return `${f}${l}`.toUpperCase();
    }
    return Array.from(parts[0] || '').slice(0, 2).join('').toUpperCase();
  }
  if (student.username) {
    return Array.from(student.username).slice(0, 2).join('').toUpperCase();
  }
  return '?';
}

export function formatStudentMeta(student: User, isGrp?: boolean): string {
  const parts: string[] = ['Angielski'];
  if (student.level) {
    parts.push(student.level);
  }
  if (student.company) {
    parts.push(student.company);
  } else if (student.contractor) {
    parts.push(student.contractor);
  }
  if (parts.length === 1) {
    parts.push(isGrp ? 'Grupa' : 'Indywidualny');
  }
  return parts.join(' • ');
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  isSelected = false,
  isActive = false,
  onSelect,
  onToggleSelect,
  onOpenScratchpad,
}) => {
  const sId = student.id || student.username;
  const sName =
    student.displayName ||
    student.name ||
    `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
    student.username;
  const isGrp = Boolean(student.isGroup || student.lessonType === 'Group');
  const initials = getStudentInitials(student, isGrp);
  const metaText = formatStudentMeta(student, isGrp);

  return (
    <div
      onClick={() => onSelect(student.id || student.username || '', 'profile')}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none
        bg-white border-slate-200/90 shadow-sm hover:border-emerald-400 hover:shadow-md
        dark:bg-slate-900/90 dark:border-slate-800 dark:hover:border-emerald-500/60 dark:hover:bg-slate-850 ${
        isSelected ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 border-emerald-500 dark:border-emerald-400' : ''
      } ${isActive ? 'ring-2 ring-emerald-500 dark:ring-emerald-400' : ''}`}
    >
      {/* 1. Mikro-wskaźnik statusu */}
      <div className="w-1 h-7 bg-slate-300 dark:bg-slate-700 rounded-full group-hover:bg-emerald-500 dark:group-hover:bg-emerald-400 transition-colors shrink-0" />

      {/* 2. Checkbox masowego zaznaczania */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          if (student.id) onToggleSelect(student.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 focus:ring-0 cursor-pointer accent-emerald-600 dark:accent-emerald-400 shrink-0"
        title={isSelected ? 'Odznacz' : 'Zaznacz'}
      />

      {/* 3. Awatar z inicjałami */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-700/60 dark:text-emerald-300 tracking-wide font-sans shadow-sm">
        {isGrp ? <Users className="w-4 h-4" /> : initials}
      </div>

      {/* 4. Blok tekstowy (Imię + Metadane) */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h4 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
          {sName}
        </h4>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5 truncate">
          {metaText}
        </p>
      </div>

      {/* 5. Zintegrowany dok mikro-akcji */}
      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Lekcje / Dziennik */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(student.id || student.username || '', 'history');
          }}
          title="Lekcje / Dziennik"
          className="p-1.5 sm:p-2 rounded-lg border transition-colors bg-slate-100 border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700/70 dark:text-slate-300 dark:hover:text-emerald-400 dark:hover:bg-slate-700 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* 2. Notatki lekcyjne */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenScratchpad) {
              onOpenScratchpad(student.id || student.username || '', isGrp);
            } else {
              onSelect(student.id || student.username || '', 'scratchpad');
            }
          }}
          title="Notatki lekcyjne"
          className="p-1.5 sm:p-2 rounded-lg border transition-colors bg-slate-100 border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700/70 dark:text-slate-300 dark:hover:text-emerald-400 dark:hover:bg-slate-700 cursor-pointer"
        >
          <FileEdit className="w-3.5 h-3.5" />
        </button>

        {/* 3. Profil kursanta */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(student.id || student.username || '', 'profile');
          }}
          title="Profil kursanta"
          className="p-1.5 sm:p-2 rounded-lg border transition-colors bg-slate-100 border-slate-200 text-slate-700 hover:text-emerald-600 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700/70 dark:text-slate-300 dark:hover:text-emerald-400 dark:hover:bg-slate-700 cursor-pointer"
        >
          <UserIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default StudentCard;

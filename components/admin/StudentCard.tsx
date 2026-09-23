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
      className={`specular-student-card group relative px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-2.5 select-none min-h-[70px] max-h-[74px] ${
        isSelected ? 'is-selected' : ''
      } ${isActive ? 'is-active' : ''}`}
    >
      {/* 1. Mikro-wskaźnik statusu */}
      <div className="w-1 h-6 bg-slate-300 dark:bg-slate-700 rounded-full specular-accent-bar shrink-0" />

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

      {/* 3. Awatar z inicjałami (Squircle) */}
      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 tracking-wide font-sans">
        {isGrp ? <Users className="w-4 h-4" /> : initials}
      </div>

      {/* 4. Blok tekstowy (Imię + Metadane) */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h3 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 truncate transition-colors">
          {sName}
        </h3>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
          {metaText}
        </p>
      </div>

      {/* 5. Zintegrowany dok mikro-akcji */}
      <div
        className="flex items-center gap-0.5 shrink-0 bg-slate-100 dark:bg-slate-900/70 group-hover:bg-slate-200/80 dark:group-hover:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-emerald-500/30 rounded-lg p-0.5 transition"
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
          className="p-1 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition cursor-pointer"
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
          className="p-1 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition cursor-pointer"
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
          className="p-1 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition cursor-pointer"
        >
          <UserIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default StudentCard;

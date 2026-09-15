import React, { useState, useMemo } from 'react';
import { User, LessonRecord } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import CreateGroupModal from './CreateGroupModal';
import {
  Users,
  User as UserIcon,
  Search,
  Plus,
  Filter,
  Building,
  Mail,
  GraduationCap,
  Briefcase,
  Layers,
  ArrowRight,
  Sparkles,
  Edit2,
  BookOpen,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface TeacherNotionDatabaseViewProps {
  students: User[];
  lessons: LessonRecord[];
  onSelectStudent?: (student: User) => void;
  onOpenNotebook?: (student: User) => void;
  onOpenHomework?: (student: User) => void;
  onOpenLessonPlanner?: (student: User) => void;
  onRefreshNotion?: () => void;
  isRefreshingNotion?: boolean;
}

type TabFilter = 'all' | 'jcl' | 'inspiro' | 'axell' | 'direct' | 'individual' | 'group' | 'active';

export const TeacherNotionDatabaseView: React.FC<TeacherNotionDatabaseViewProps> = ({
  students,
  lessons,
  onSelectStudent,
  onOpenNotebook,
  onOpenHomework,
  onOpenLessonPlanner,
  onRefreshNotion,
  isRefreshingNotion = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<User | null>(null);

  // Filter students based on active tab and search query
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Role filter - only students & groups (exclude pure teachers/admins unless they take lessons)
      if (s.role === 'admin' && !s.isGroup && !s.level) return false;

      // Tab filter
      if (activeTab === 'jcl' && s.contractor?.toLowerCase() !== 'jcl') return false;
      if (activeTab === 'inspiro' && s.contractor?.toLowerCase() !== 'inspiro') return false;
      if (activeTab === 'axell' && s.contractor?.toLowerCase() !== 'axell') return false;
      if (activeTab === 'direct' && s.contractor?.toLowerCase() !== 'direct') return false;
      if (activeTab === 'individual' && (s.isGroup || s.lessonType === 'Group')) return false;
      if (activeTab === 'group' && !(s.isGroup || s.lessonType === 'Group')) return false;
      if (activeTab === 'active' && (s.isSuspended || s.isArchived || s.statusWspolpracy === 'Nieaktywny')) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (s.displayName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.username).toLowerCase();
        const email = (s.email || '').toLowerCase();
        const company = (s.company || '').toLowerCase();
        const level = (s.level || '').toLowerCase();
        const contractor = (s.contractor || '').toLowerCase();
        return name.includes(q) || email.includes(q) || company.includes(q) || level.includes(q) || contractor.includes(q);
      }

      return true;
    });
  }, [students, activeTab, searchQuery]);

  // Helper to count lessons for a student/group
  const getStudentLessons = (student: User) => {
    const sId = student.id;
    if (!sId) return [];
    return lessons.filter((l) => l.studentId === sId || (l.studentIds && l.studentIds.includes(sId)));
  };

  const getRecentLesson = (student: User) => {
    const studentLessons = getStudentLessons(student);
    if (studentLessons.length === 0) return null;
    return studentLessons.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  };

  return (
    <div className="space-y-4 pt-6 mt-8 border-t border-white/10">
      {/* Header bar styled like Notion Database */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Kursanci i grupy
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-content-muted">
                {filteredStudents.length} {filteredStudents.length === 1 ? 'rekord' : 'rekordów'}
              </span>
            </h2>
            <p className="text-xs text-content-muted">
              Baza kursantów indywidualnych, par, trójek i grup firmowych
            </p>
          </div>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefreshNotion && (
            <Button
              variant="secondary"
              onClick={onRefreshNotion}
              isLoading={isRefreshingNotion}
              className="text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <RefreshCw size={13} className={isRefreshingNotion ? 'animate-spin' : ''} />
              Synchronizuj z Notion
            </Button>
          )}

          <Button
            onClick={() => {
              setEditingGroup(null);
              setIsGroupModalOpen(true);
            }}
            className="text-xs flex items-center gap-1.5 py-1.5 px-3 bg-primary hover:bg-primary/90 text-black font-bold"
          >
            <Plus size={14} />
            Nowa grupa / para
          </Button>
        </div>
      </div>

      {/* Notion Database Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-2 border-b border-white/10">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-white/15 text-white font-bold border border-white/20'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={13} />
            Wszyscy
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'active'
                ? 'bg-primary/20 text-primary font-bold border border-primary/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 size={13} />
            Aktywni
          </button>

          <button
            onClick={() => setActiveTab('individual')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'individual'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <UserIcon size={13} />
            Indywidualni (1:1)
          </button>

          <button
            onClick={() => setActiveTab('group')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'group'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={13} />
            Grupy & Pary
          </button>

          <div className="h-4 w-[1px] bg-white/15 mx-1" />

          {/* Contractors */}
          <button
            onClick={() => setActiveTab('jcl')}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              activeTab === 'jcl'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            🏢 JCL
          </button>

          <button
            onClick={() => setActiveTab('inspiro')}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              activeTab === 'inspiro'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            🏢 Inspiro
          </button>

          <button
            onClick={() => setActiveTab('axell')}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              activeTab === 'axell'
                ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            🏢 Axell
          </button>

          <button
            onClick={() => setActiveTab('direct')}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              activeTab === 'direct'
                ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            ⚡ Direct
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj kursanta, firmy, poziomu..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white text-xs placeholder:text-content-muted/60 focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Notion Styled Table */}
      <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-content-muted border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-base-300/60 font-semibold text-content uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[200px]">Nazwa</th>
                <th className="py-3 px-3 min-w-[90px]">Typ</th>
                <th className="py-3 px-3 min-w-[180px]">Poziom / profil</th>
                <th className="py-3 px-3 min-w-[180px]">Adresy e-mail</th>
                <th className="py-3 px-3 min-w-[100px]">Kontraktor</th>
                <th className="py-3 px-3 min-w-[120px]">Gdzie pracuje</th>
                <th className="py-3 px-3 min-w-[180px]">Ostatnia Lekcja</th>
                <th className="py-3 px-3 min-w-[100px]">Status</th>
                <th className="py-3 px-3 min-w-[100px]">Typ zajęć</th>
                <th className="py-3 px-4 text-right min-w-[140px]">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-content-muted">
                    Nie znaleziono kursantów ani grup odpowiadających wybranym kryteriom.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const sName =
                    student.displayName ||
                    student.name ||
                    `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
                    student.username;
                  const isGrp = Boolean(student.isGroup || student.lessonType === 'Group');
                  const recentLesson = getRecentLesson(student);
                  const isActive = !student.isSuspended && !student.isArchived && student.statusWspolpracy !== 'Nieaktywny';

                  return (
                    <tr
                      key={student.id || student.username}
                      className="hover:bg-white/[0.04] transition-colors group"
                    >
                      {/* Nazwa */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onSelectStudent?.(student)}
                          className="flex items-center gap-2.5 text-left text-white font-semibold hover:text-primary transition-colors group-hover:translate-x-0.5 transform duration-150"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isGrp
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                          >
                            {isGrp ? (
                              <Users size={14} />
                            ) : student.photoURL ? (
                              <img
                                src={student.photoURL}
                                alt={sName}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <span>{sName[0]?.toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          <div>
                            <span className="block font-bold leading-tight">{sName}</span>
                            {isGrp && student.memberNames && student.memberNames.length > 0 && (
                              <span className="text-[10px] text-content-muted font-normal block truncate max-w-[180px]">
                                {student.memberNames.join(', ')}
                              </span>
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Typ */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isGrp
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                          }`}
                        >
                          {isGrp ? (
                            student.groupType === 'pair'
                              ? 'Para (2)'
                              : student.groupType === 'triplet'
                              ? 'Trójka (3)'
                              : 'Grupa'
                          ) : (
                            'Kursant'
                          )}
                        </span>
                      </td>

                      {/* Poziom / Profil */}
                      <td className="py-3 px-3">
                        <span className="text-white font-medium block truncate max-w-[200px]" title={student.level || '-'}>
                          {student.level || (
                            <span className="text-content-muted/50 italic">Brak poziomu</span>
                          )}
                        </span>
                      </td>

                      {/* E-mail */}
                      <td className="py-3 px-3">
                        <span className="text-content-muted block truncate max-w-[180px] font-mono text-[11px]" title={student.email}>
                          {student.email || '-'}
                        </span>
                      </td>

                      {/* Kontraktor */}
                      <td className="py-3 px-3">
                        {student.contractor ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              student.contractor.toLowerCase() === 'jcl'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : student.contractor.toLowerCase() === 'inspiro'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : student.contractor.toLowerCase() === 'axell'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-white/10 text-white border-white/20'
                            }`}
                          >
                            {student.contractor}
                          </span>
                        ) : (
                          <span className="text-content-muted/40">-</span>
                        )}
                      </td>

                      {/* Gdzie pracuje */}
                      <td className="py-3 px-3">
                        <span className="text-white font-medium block truncate max-w-[130px]">
                          {student.company || '-'}
                        </span>
                      </td>

                      {/* Ostatnia Lekcja */}
                      <td className="py-3 px-3">
                        {recentLesson ? (
                          <div className="truncate max-w-[180px]">
                            <span className="text-white font-medium block truncate" title={recentLesson.topic}>
                              {recentLesson.topic}
                            </span>
                            <span className="text-[10px] text-content-muted font-mono">
                              {recentLesson.date}
                            </span>
                          </div>
                        ) : (
                          <span className="text-content-muted/40 italic">Brak lekcji</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {isActive ? 'Aktywny' : 'Nieaktywny'}
                        </span>
                      </td>

                      {/* Typ zajęć */}
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-mono text-content-muted">
                          {isGrp ? 'Group' : 'Individual'}
                        </span>
                      </td>

                      {/* Szybkie Akcje */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onOpenNotebook && (
                            <button
                              onClick={() => onOpenNotebook(student)}
                              title="Otwórz Notatnik / Brudnopis"
                              className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                          {onOpenLessonPlanner && (
                            <button
                              onClick={() => onOpenLessonPlanner(student)}
                              title="Planer Lekcji"
                              className="p-1.5 rounded-lg text-content-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <BookOpen size={14} />
                            </button>
                          )}
                          {onOpenHomework && (
                            <button
                              onClick={() => onOpenHomework(student)}
                              title="Zadaj Pracę Domową"
                              className="p-1.5 rounded-lg text-content-muted hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                            >
                              <Send size={14} />
                            </button>
                          )}
                          {isGrp && (
                            <button
                              onClick={() => {
                                setEditingGroup(student);
                                setIsGroupModalOpen(true);
                              }}
                              title="Edytuj grupę"
                              className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Group Create/Edit Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setEditingGroup(null);
        }}
        availableStudents={students}
        groupToEdit={editingGroup}
      />
    </div>
  );
};

export default TeacherNotionDatabaseView;

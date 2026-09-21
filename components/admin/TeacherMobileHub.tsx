import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Users, BookOpen, X, Search, ChevronRight, Loader2, Mail, ClipboardCheck } from 'lucide-react';
import { User, LessonRecord, TeacherCockpitData } from '../../types';
import { fetchTeacherCockpitData } from '../../services/teacherCockpitService';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import { useEscapeModal } from '../../hooks/useEscapeModal';

type UserWithId = User & { id: string };

interface TeacherMobileHubProps {
  currentUser: UserWithId | null;
  users: UserWithId[];
  lessons: LessonRecord[];
  onSelectStudent: (studentId: string) => void;
  onOpenHistory: (studentId?: string, lessonId?: string) => void;
  onOpenHomeworkReview: (taskId: string, studentId: string) => void;
  onOpenAssistant: () => void;
}

type MobileTileId = 'today' | 'students' | 'history';

/**
 * Sheet pełnoekranowy — jeden wzorzec dla wszystkich trzech kafelków, żeby
 * "Pocket Companion" na telefonie nie mieszał ciężkich ekranów desktopowych
 * z prostym podsumowaniem, po które kursant... właściwie lektor sięga w biegu.
 */
const MobileSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useEscapeModal(true, onClose, 5);
  return (
    <div className="fixed inset-0 z-[95] bg-base-100 flex flex-col animate-fade-in">
      <header className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-line-strong bg-base-200/80">
        <h2 className="text-base font-bold text-text-hi truncate">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-line-strong text-content-muted hover:text-text-hi cursor-pointer"
          aria-label="Zamknij"
        >
          <X size={18} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">{children}</div>
    </div>
  );
};

const workflowLabel: Record<string, string> = {
  scheduled: 'Zaplanowana',
  draft: 'Szkic',
  in_progress: 'W trakcie',
  completed: 'Odbyta',
  closed: 'Domknięta',
};

const TeacherMobileHub: React.FC<TeacherMobileHubProps> = ({
  currentUser,
  users,
  lessons,
  onSelectStudent,
  onOpenHistory,
  onOpenHomeworkReview,
  onOpenAssistant,
}) => {
  const [openModal, setOpenModal] = useState<MobileTileId | null>(null);
  const [cockpit, setCockpit] = useState<TeacherCockpitData | null>(null);
  const [cockpitLoading, setCockpitLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const activeStudents = useMemo(
    () => users.filter((u) => u.role === 'user' && !u.isSuspended && !u.isArchived),
    [users]
  );

  useEffect(() => {
    if (openModal !== 'today') return;
    let cancelled = false;
    setCockpitLoading(true);
    fetchTeacherCockpitData({ students: users, lessons })
      .then((data) => {
        if (!cancelled) setCockpit(data);
      })
      .catch((err) => console.warn('[TeacherMobileHub] Błąd pobierania cockpitu:', err))
      .finally(() => {
        if (!cancelled) setCockpitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openModal, users, lessons]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return activeStudents;
    return activeStudents.filter((s) => {
      const name = formatStudentDisplayName(s, s.username).toLowerCase();
      return name.includes(q) || (s.email || '').toLowerCase().includes(q);
    });
  }, [activeStudents, studentSearch]);

  const recentLessons = useMemo(
    () => [...lessons].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30),
    [lessons]
  );

  const selectedStudent = selectedStudentId ? users.find((u) => u.id === selectedStudentId) || null : null;
  const selectedStudentLastLesson = useMemo(() => {
    if (!selectedStudentId) return null;
    return [...lessons]
      .filter((l) => l.studentId === selectedStudentId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
  }, [selectedStudentId, lessons]);

  const closeAll = () => {
    setOpenModal(null);
    setSelectedStudentId(null);
    setStudentSearch('');
  };

  const tiles: Array<{ id: MobileTileId; title: string; desc: string; icon: React.ElementType; badge?: number }> = [
    {
      id: 'today',
      title: 'Dzisiaj',
      desc: 'Rozkład dnia i praca domowa do sprawdzenia',
      icon: Calendar,
      badge: cockpit ? cockpit.pendingHomeworkReviews.length : undefined,
    },
    {
      id: 'students',
      title: 'Kursanci',
      desc: 'Szybki podgląd i kontakt',
      icon: Users,
    },
    {
      id: 'history',
      title: 'Historia lekcji',
      desc: 'Ostatnio przeprowadzone lekcje',
      icon: BookOpen,
    },
  ];

  return (
    <div className="pb-24">
      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto w-full pt-1">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setOpenModal(tile.id)}
              className="liquid-glass-tile flex items-center gap-3.5 p-4 rounded-2xl text-left cursor-pointer relative"
            >
              <div className="p-3 rounded-xl bg-ink/72 text-primary border border-line-strong shrink-0">
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-base text-text-hi">{tile.title}</h3>
                <p className="text-xs text-content-muted mt-0.5 leading-relaxed">{tile.desc}</p>
              </div>
              {Boolean(tile.badge) && (
                <span className="shrink-0 h-6 min-w-[1.5rem] px-1.5 rounded-full bg-amber-500 text-black text-[11px] font-bold flex items-center justify-center border border-black/20">
                  {tile.badge}
                </span>
              )}
              <ChevronRight size={18} className="text-content-muted shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Pasek stopki — jedyny punkt wejścia do Asystenta AI na telefonie */}
      <div className="fixed bottom-0 left-0 right-0 z-[90] p-3 bg-base-100/95 backdrop-blur-md border-t border-line-strong">
        <button
          type="button"
          onClick={onOpenAssistant}
          className="w-full h-12 rounded-2xl bg-primary text-accent-ink font-bold text-sm flex items-center justify-center gap-2 shadow-btn cursor-pointer"
        >
          💬 Zapytaj Asystenta AI
        </button>
      </div>

      {openModal === 'today' && (
        <MobileSheet title="Dzisiaj" onClose={closeAll}>
          {cockpitLoading || !cockpit ? (
            <div className="flex items-center justify-center py-10 text-content-muted gap-2">
              <Loader2 size={18} className="animate-spin" /> Wczytywanie…
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-content-muted">
                  Dzisiejsze lekcje ({cockpit.todayLessons.length})
                </h3>
                {cockpit.todayLessons.length === 0 ? (
                  <p className="text-sm text-content-muted">Brak zaplanowanych lekcji na dziś.</p>
                ) : (
                  cockpit.todayLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="p-3 rounded-xl border border-line-strong bg-base-200/60 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-hi truncate">{lesson.studentName}</p>
                        <p className="text-xs text-content-muted truncate">{lesson.topic || 'Bez tematu'}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-line-soft text-content-muted border border-line-strong">
                        {workflowLabel[lesson.workflowStatus] || lesson.workflowStatus}
                      </span>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-2 pt-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                  <ClipboardCheck size={14} /> Do sprawdzenia ({cockpit.pendingHomeworkReviews.length})
                </h3>
                {cockpit.pendingHomeworkReviews.length === 0 ? (
                  <p className="text-sm text-content-muted">Nic nie czeka na sprawdzenie.</p>
                ) : (
                  cockpit.pendingHomeworkReviews.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        onOpenHomeworkReview(task.id, task.studentId);
                        closeAll();
                      }}
                      className="w-full p-3 rounded-xl border border-amber-400/50 bg-amber-500/[0.08] flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-hi truncate">{task.studentName}</p>
                        <p className="text-xs text-content-muted truncate">{task.title}</p>
                      </div>
                      <ChevronRight size={16} className="text-amber-400 shrink-0" />
                    </button>
                  ))
                )}
              </section>
            </>
          )}
        </MobileSheet>
      )}

      {openModal === 'students' && (
        <MobileSheet title="Kursanci" onClose={closeAll}>
          {selectedStudent ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                ← Wróć do listy
              </button>
              <div className="p-4 rounded-2xl border border-line-strong bg-base-200/60 space-y-3">
                <h3 className="text-lg font-extrabold text-text-hi">
                  {formatStudentDisplayName(selectedStudent, selectedStudent.username)}
                </h3>
                <div className="flex items-center gap-2 text-sm text-content-muted">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{selectedStudent.email || 'Brak adresu e-mail'}</span>
                </div>
                <div className="pt-2 border-t border-line-strong">
                  <p className="text-xs font-bold uppercase tracking-wider text-content-muted mb-1">Ostatnia lekcja</p>
                  {selectedStudentLastLesson ? (
                    <div>
                      <p className="text-sm text-text-hi">{selectedStudentLastLesson.topic || 'Bez tematu'}</p>
                      <p className="text-xs text-content-muted">{selectedStudentLastLesson.date}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-content-muted">Brak zapisanych lekcji.</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectStudent(selectedStudent.id);
                  closeAll();
                }}
                className="w-full h-11 rounded-xl bg-primary text-accent-ink font-bold text-sm cursor-pointer"
              >
                Otwórz pełny profil
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Szukaj kursanta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-base-200/80 border border-line-strong text-sm text-text-hi placeholder:text-content-muted/70"
                />
              </div>
              <div className="space-y-2">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-content-muted text-center py-6">Brak wyników.</p>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="w-full p-3 rounded-xl border border-line-strong bg-base-200/60 flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-text-hi truncate">
                        {formatStudentDisplayName(s, s.username)}
                      </span>
                      <ChevronRight size={16} className="text-content-muted shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </MobileSheet>
      )}

      {openModal === 'history' && (
        <MobileSheet title="Historia lekcji" onClose={closeAll}>
          {recentLessons.length === 0 ? (
            <p className="text-sm text-content-muted text-center py-6">Brak zapisanych lekcji.</p>
          ) : (
            recentLessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => {
                  onOpenHistory(lesson.studentId, lesson.id);
                  closeAll();
                }}
                className="w-full p-3 rounded-xl border border-line-strong bg-base-200/60 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-hi truncate">{lesson.studentName || 'Kursant'}</p>
                  <p className="text-xs text-content-muted truncate">{lesson.topic || 'Bez tematu'} · {lesson.date}</p>
                </div>
                <ChevronRight size={16} className="text-content-muted shrink-0" />
              </button>
            ))
          )}
        </MobileSheet>
      )}
    </div>
  );
};

export default TeacherMobileHub;

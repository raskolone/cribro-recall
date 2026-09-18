import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  FileText,
  ArrowRight,
  UserCheck,
  Plus,
  RefreshCw,
  ChevronRight,
  Presentation,
  ClipboardList,
  Flame,
  Search,
  ExternalLink,
  Users,
  ShieldCheck,
  Check,
  Layers
} from 'lucide-react';
import {
  TeacherCockpitData,
  ScheduledLessonCard,
  CloseoutLessonCard,
  ReviewHomeworkCard,
  StudentWithoutPlanCard,
  User,
  LessonRecord
} from '../../types';
import { fetchTeacherCockpitData } from '../../services/teacherCockpitService';
import { toPolishVocative } from '../../utils/polishVocative';
import { openScratchpadTab } from '../../services/scratchpadService';
import ManualTranscriptImportModal from './ManualTranscriptImportModal';

interface TeacherTodayCockpitProps {
  currentUser?: User | null;
  students?: User[];
  lessons?: LessonRecord[];
  onSelectStudent: (studentId: string, targetTab?: string) => void;
  onOpenPlanner: (studentId?: string, lessonId?: string) => void;
  onOpenHistory: (studentId?: string, lessonId?: string) => void;
  onOpenHomeworkReview: (taskId: string, studentId: string) => void;
  onOpenScratchpad: (studentId?: string) => void;
  onOpenTopicDatabase: () => void;
}

export const TeacherTodayCockpit: React.FC<TeacherTodayCockpitProps> = ({
  currentUser,
  students,
  lessons,
  onSelectStudent,
  onOpenPlanner,
  onOpenHistory,
  onOpenHomeworkReview,
  onOpenScratchpad,
  onOpenTopicDatabase,
}) => {
  const [data, setData] = useState<TeacherCockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'closeout' | 'homework' | 'unplanned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotionImportOpen, setIsNotionImportOpen] = useState(false);

  const teacherName = currentUser?.displayName || currentUser?.username || 'Lektorze';
  const teacherVocative = toPolishVocative(teacherName);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchTeacherCockpitData({ students, lessons });
      setData(result);
    } catch (err) {
      console.error('[TeacherCockpit] Błąd ładowania danych:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [students, lessons]);

  const todayDisplay = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const stats = data?.stats || {
    todayCount: 0,
    closeoutCount: 0,
    reviewCount: 0,
    unplannedCount: 0
  };

  if (loading && !data) {
    return (
      <div className="w-full max-w-7xl mx-auto p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-text-hi">Wczytuję kokpit lektora…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-24">
      {/* ── Top Hero Greeting Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-base-200/90 via-base-200/70 to-primary/10 border border-line-strong p-6 sm:p-8 backdrop-blur-xl shadow-ambient">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold font-mono uppercase tracking-wider">
              <Calendar size={13} />
              <span>{todayDisplay}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-hi tracking-tight flex items-center gap-3">
              <span>Witaj, {teacherVocative}!</span>
              <span className="text-xl sm:text-2xl">👋</span>
            </h1>
            <p className="text-sm text-content-muted max-w-2xl leading-relaxed">
              Oto Twój operacyjny kokpit na dzisiaj. Zobacz rozkład zajęć, dokończ podsumowania po odbytych lekcjach i przejrzyj nadesłane zadania domowe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              title="Odśwież dane"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Odśwież</span>
            </button>
            <button
              onClick={() => setIsNotionImportOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-focus text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              title="Wklej notatki ze spotkania z Notion AI i wygeneruj lekcję"
            >
              <FileText size={15} />
              <span>Wklej z Notion AI</span>
            </button>
            <button
              onClick={() => onOpenPlanner()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-focus hover:from-primary-focus hover:to-primary text-accent-ink font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Zaplanuj nową lekcję</span>
            </button>
          </div>
        </div>

        {/* ── 4 KPI Action Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-line-soft">
          <button
            onClick={() => setActiveFilter(activeFilter === 'today' ? 'all' : 'today')}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
              activeFilter === 'today'
                ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/30'
                : 'bg-base-100/40 hover:bg-base-100/70 border-line-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-content-muted uppercase tracking-wider font-mono">Lekcje dziś</span>
              <Calendar size={16} className={stats.todayCount > 0 ? 'text-primary' : 'text-content-muted'} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-text-hi font-display">{stats.todayCount}</span>
              <span className="text-xs text-content-muted">{stats.todayCount === 1 ? 'lekcja' : 'lekcji'}</span>
            </div>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'closeout' ? 'all' : 'closeout')}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
              activeFilter === 'closeout'
                ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
                : stats.closeoutCount > 0
                ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30'
                : 'bg-base-100/40 hover:bg-base-100/70 border-line-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">Do domknięcia</span>
              <AlertCircle size={16} className={stats.closeoutCount > 0 ? 'text-amber-400' : 'text-content-muted'} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-display">{stats.closeoutCount}</span>
              <span className="text-xs text-content-muted">czeka na podsumowanie</span>
            </div>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'homework' ? 'all' : 'homework')}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
              activeFilter === 'homework'
                ? 'bg-sky-500/20 border-sky-500 shadow-lg shadow-sky-500/10 ring-2 ring-sky-500/30'
                : stats.reviewCount > 0
                ? 'bg-sky-500/10 hover:bg-sky-500/15 border-sky-500/30'
                : 'bg-base-100/40 hover:bg-base-100/70 border-line-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider font-mono">Do sprawdzenia</span>
              <ClipboardList size={16} className={stats.reviewCount > 0 ? 'text-sky-400' : 'text-content-muted'} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-sky-300 font-display">{stats.reviewCount}</span>
              <span className="text-xs text-content-muted">nadesłanych prac</span>
            </div>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'unplanned' ? 'all' : 'unplanned')}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
              activeFilter === 'unplanned'
                ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/30'
                : 'bg-base-100/40 hover:bg-base-100/70 border-line-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono">Bez planu</span>
              <UserCheck size={16} className={stats.unplannedCount > 0 ? 'text-purple-400' : 'text-content-muted'} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-purple-300 font-display">{stats.unplannedCount}</span>
              <span className="text-xs text-content-muted">aktywnych kursantów</span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Filter & Search Pills Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-base-200/80 border border-line-strong overflow-x-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-primary text-accent-ink shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            Wszystko
          </button>
          <button
            onClick={() => setActiveFilter('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'today'
                ? 'bg-primary text-accent-ink shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            <span>Dzisiaj ({stats.todayCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('closeout')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'closeout'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            <span>Do domknięcia ({stats.closeoutCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('homework')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'homework'
                ? 'bg-sky-400 text-slate-950 shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            <span>Prace domowe ({stats.reviewCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('unplanned')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'unplanned'
                ? 'bg-purple-400 text-slate-950 shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            <span>Bez planu ({stats.unplannedCount})</span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Szukaj kursanta lub tematu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-base-200/80 border border-line-strong text-xs text-text-hi placeholder-content-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* ── Main Content Columns / Grids ── */}
      <div className="space-y-8">
        {/* SEKCJA 1: Dzisiejsze i Nadchodzące Lekcje */}
        {(activeFilter === 'all' || activeFilter === 'today') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-text-hi flex items-center gap-2.5">
                <span className="p-1.5 rounded-xl bg-primary/15 text-primary border border-primary/30">
                  <Calendar size={16} />
                </span>
                <span>Rozkład lekcji (Dzisiaj i nadchodzące)</span>
              </h2>
              <span className="text-xs font-mono text-content-muted">
                {data?.todayLessons?.length || 0} dziś · {data?.upcomingLessons?.length || 0} wkrótce
              </span>
            </div>

            {(data?.todayLessons?.length || 0) === 0 && (data?.upcomingLessons?.length || 0) === 0 ? (
              <div className="p-8 rounded-2xl bg-base-200/40 border border-line-strong text-center space-y-2">
                <Calendar size={28} className="text-content-muted mx-auto opacity-50" />
                <p className="text-sm font-bold text-text-hi">Brak lekcji w kalendarzu na najbliższe dni</p>
                <p className="text-xs text-content-muted max-w-md mx-auto">
                  Wybierz kursanta z listy poniżej, aby przygotować scenariusz lekcji i zaplanować termin zajęć.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Lekcje na dziś */}
                {(data?.todayLessons || [])
                  .filter(l => !searchQuery || l.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || l.topic.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(lesson => (
                    <div
                      key={lesson.id}
                      className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/[0.07] to-base-200/80 p-5 space-y-4 hover:border-primary/60 transition-all shadow-md group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary text-accent-ink text-[11px] font-black font-mono uppercase tracking-wider">
                            <Clock size={11} />
                            <span>Dzisiaj {lesson.time || ''}</span>
                          </span>
                          <h3
                            onClick={() => onSelectStudent(lesson.studentId)}
                            className="text-base font-extrabold text-text-hi mt-2 hover:text-primary transition-colors cursor-pointer truncate"
                          >
                            {lesson.studentName}
                          </h3>
                        </div>
                        {lesson.level && (
                          <span className="px-2 py-0.5 rounded-md bg-base-100 border border-line-strong text-xs font-bold text-primary font-mono shrink-0">
                            {lesson.level}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-content-muted tracking-wider">Temat:</span>
                        <p className="text-xs text-content font-medium line-clamp-2">{lesson.topic || 'Lekcja bez zdefiniowanego tematu'}</p>
                      </div>

                      <div className="pt-2 border-t border-line-soft flex items-center justify-between gap-2">
                        <button
                          onClick={() => openScratchpadTab(lesson.studentId)}
                          className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-primary-focus text-accent-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                          title="Otwórz Notatnik / Prezentację na żywo z kursantem"
                        >
                          <Presentation size={14} />
                          <span>Prowadź zajęcia</span>
                        </button>
                        <button
                          onClick={() => onOpenPlanner(lesson.studentId, lesson.id)}
                          className="p-2 rounded-xl border border-line-strong bg-base-100 hover:bg-base-200 text-content-muted hover:text-text-hi transition-colors cursor-pointer"
                          title="Podgląd i edycja scenariusza lekcji"
                        >
                          <Sparkles size={15} />
                        </button>
                        <button
                          onClick={() => onSelectStudent(lesson.studentId)}
                          className="p-2 rounded-xl border border-line-strong bg-base-100 hover:bg-base-200 text-content-muted hover:text-text-hi transition-colors cursor-pointer"
                          title="Otwórz kartę kursanta"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  ))}

                {/* Nadchodzące lekcje (kolejne dni) */}
                {(data?.upcomingLessons || [])
                  .filter(l => !searchQuery || l.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || l.topic.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(lesson => (
                    <div
                      key={lesson.id}
                      className="rounded-2xl border border-line-strong bg-base-200/60 p-5 space-y-4 hover:border-line-soft transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-base-100 text-content-muted border border-line-strong text-[11px] font-bold font-mono">
                            <Calendar size={11} />
                            <span>{lesson.date}</span>
                          </span>
                          <h3
                            onClick={() => onSelectStudent(lesson.studentId)}
                            className="text-base font-extrabold text-text-hi mt-2 hover:text-primary transition-colors cursor-pointer truncate"
                          >
                            {lesson.studentName}
                          </h3>
                        </div>
                        {lesson.level && (
                          <span className="px-2 py-0.5 rounded-md bg-base-100 border border-line-strong text-xs font-bold text-content-muted font-mono shrink-0">
                            {lesson.level}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-content-muted tracking-wider">Temat:</span>
                        <p className="text-xs text-content font-medium line-clamp-2">{lesson.topic || 'Lekcja bez zdefiniowanego tematu'}</p>
                      </div>

                      <div className="pt-2 border-t border-line-soft flex items-center justify-between gap-2">
                        <button
                          onClick={() => onOpenPlanner(lesson.studentId, lesson.id)}
                          className="flex-1 py-2 px-3 rounded-xl border border-line-strong bg-base-100 hover:bg-base-300 text-content font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles size={14} className="text-primary" />
                          <span>{lesson.hasScenario ? 'Edytuj plan' : 'Przygotuj plan'}</span>
                        </button>
                        <button
                          onClick={() => onSelectStudent(lesson.studentId)}
                          className="p-2 rounded-xl border border-line-strong bg-base-100 hover:bg-base-200 text-content-muted hover:text-text-hi transition-colors cursor-pointer"
                          title="Otwórz kartę kursanta"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* SEKCJA 2: Lekcje Wymagające Zamknięcia (Closeout Queue) */}
        {(activeFilter === 'all' || activeFilter === 'closeout') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-text-hi flex items-center gap-2.5">
                <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <AlertCircle size={16} />
                </span>
                <span>Lekcje wymagające zamknięcia (Action Required)</span>
              </h2>
              <span className="text-xs font-mono text-amber-400">
                {data?.requiringCloseout?.length || 0} oczekujących
              </span>
            </div>

            {(data?.requiringCloseout?.length || 0) === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center gap-3 text-emerald-400 text-xs">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>Wszystkie odbyte lekcje są zamknięte, a materiały i zadania opublikowane dla kursantów. Doskonała robota!</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data?.requiringCloseout || [])
                  .filter(l => !searchQuery || l.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || l.topic.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(item => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5 space-y-3 hover:border-amber-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                            {item.source === 'live_transcript' ? 'Transkrypcja Sift' : 'Do domknięcia'} · {item.date}
                          </span>
                          <h3
                            onClick={() => onSelectStudent(item.studentId)}
                            className="text-base font-extrabold text-text-hi mt-1.5 hover:text-primary transition-colors cursor-pointer truncate"
                          >
                            {item.studentName}
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs text-content font-medium line-clamp-2">{item.topic || 'Podsumowanie lekcji'}</p>

                      <div className="flex items-center gap-2 text-[11px] text-content-muted">
                        <span className={`px-2 py-0.5 rounded ${item.hasSummary ? 'bg-emerald-500/15 text-emerald-300' : 'bg-base-200 text-content-muted'}`}>
                          Podsumowanie {item.hasSummary ? '✓' : '–'}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${item.hasHomework ? 'bg-emerald-500/15 text-emerald-300' : 'bg-base-200 text-content-muted'}`}>
                          Zadanie {item.hasHomework ? '✓' : '–'}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${item.hasVocabulary ? 'bg-emerald-500/15 text-emerald-300' : 'bg-base-200 text-content-muted'}`}>
                          Słówka {item.hasVocabulary ? '✓' : '–'}
                        </span>
                      </div>

                      <button
                        onClick={() => onOpenHistory(item.studentId, item.id)}
                        className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Przejrzyj & Zamknij lekcję</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* SEKCJA 3: Prace Domowe Nadesłane do Sprawdzenia */}
        {(activeFilter === 'all' || activeFilter === 'homework') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-text-hi flex items-center gap-2.5">
                <span className="p-1.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  <ClipboardList size={16} />
                </span>
                <span>Nadesłane prace domowe do weryfikacji</span>
              </h2>
              <span className="text-xs font-mono text-sky-400">
                {data?.pendingHomeworkReviews?.length || 0} prac
              </span>
            </div>

            {(data?.pendingHomeworkReviews?.length || 0) === 0 ? (
              <div className="p-6 rounded-2xl bg-base-200/40 border border-line-strong text-center text-xs text-content-muted">
                Brak oczekujących prac domowych do sprawdzenia.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data?.pendingHomeworkReviews || [])
                  .filter(h => !searchQuery || h.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || h.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(task => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.04] p-5 space-y-3 hover:border-sky-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-md border border-sky-500/30">
                            Nadesłana praca · {task.type}
                          </span>
                          <h3
                            onClick={() => onSelectStudent(task.studentId)}
                            className="text-base font-extrabold text-text-hi mt-1.5 hover:text-primary transition-colors cursor-pointer truncate"
                          >
                            {task.studentName}
                          </h3>
                        </div>
                        {task.score !== undefined && task.maxScore && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-xs font-bold shrink-0">
                            {task.score}/{task.maxScore} pkt
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-content font-medium line-clamp-2">{task.title}</p>

                      <button
                        onClick={() => onOpenHomeworkReview(task.id, task.studentId)}
                        className="w-full py-2 px-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>Sprawdź & Wystaw ocenę</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* SEKCJA 4: Kursanci Bez Przygotowanego Planu */}
        {(activeFilter === 'all' || activeFilter === 'unplanned') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-text-hi flex items-center gap-2.5">
                <span className="p-1.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  <UserCheck size={16} />
                </span>
                <span>Aktywni kursanci bez przygotowanego planu</span>
              </h2>
              <span className="text-xs font-mono text-purple-400">
                {data?.studentsWithoutPlan?.length || 0} kursantów
              </span>
            </div>

            {(data?.studentsWithoutPlan?.length || 0) === 0 ? (
              <div className="p-6 rounded-2xl bg-base-200/40 border border-line-strong text-center text-xs text-content-muted">
                Wszyscy aktywni kursanci mają zaplanowane lekcje.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {(data?.studentsWithoutPlan || [])
                  .filter(s => !searchQuery || s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || (s.company || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(st => (
                    <div
                      key={st.studentId}
                      className="rounded-2xl border border-line-strong bg-base-200/60 p-4 space-y-3 hover:border-purple-500/40 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            onClick={() => onSelectStudent(st.studentId)}
                            className="text-sm font-extrabold text-text-hi hover:text-primary transition-colors cursor-pointer truncate"
                          >
                            {st.studentName}
                          </h4>
                          {st.level && (
                            <span className="px-1.5 py-0.5 rounded bg-base-100 text-[10px] font-mono font-bold text-primary shrink-0">
                              {st.level}
                            </span>
                          )}
                        </div>
                        {st.company && (
                          <p className="text-[11px] text-content-muted truncate">{st.company}</p>
                        )}
                        {st.lastLessonDate && (
                          <p className="text-[11px] text-content-muted">
                            Ost. lekcja: <span className="font-mono text-text-2">{st.lastLessonDate}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => onOpenPlanner(st.studentId)}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>Zaplanuj lekcję</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Szybki Pasek Narzędziowy Lektora na dole ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-base-200/80 border border-line-strong flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <BookOpen size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text-hi">Biblioteka & Szybkie Narzędzia Lektora</h4>
            <p className="text-xs text-content-muted">Przeglądaj bazę tematów, gotowe scenariusze i materiały wielokrotnego użytku.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenTopicDatabase}
            className="px-3.5 py-2 rounded-xl bg-base-100 hover:bg-base-300 border border-line-strong text-xs font-bold text-content flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers size={14} className="text-primary" />
            <span>Baza tematów</span>
          </button>
          <button
            onClick={() => onOpenScratchpad()}
            className="px-3.5 py-2 rounded-xl bg-base-100 hover:bg-base-300 border border-line-strong text-xs font-bold text-content flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Presentation size={14} className="text-primary" />
            <span>Wspólny Notatnik</span>
          </button>
        </div>
      </div>

      {/* Modal ręcznego importu z Notion AI — na poziomie głównym kokpitu */}
      <ManualTranscriptImportModal
        isOpen={isNotionImportOpen}
        onClose={() => setIsNotionImportOpen(false)}
        students={students}
        currentTeacherId={currentUser?.id || 'teacher'}
        onLessonCreated={(newLessonId, studentId) => {
          loadData();
          if (studentId) {
            onOpenHistory(studentId, newLessonId);
          }
        }}
      />
    </div>
  );
};

export default TeacherTodayCockpit;

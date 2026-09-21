import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LessonRecord } from '../../types';
import { extractLessonBlocks, isLessonPendingConfirmation, findDuplicatePendingLessons } from '../../utils/lessonBlocks';
import { getDisplayLessonTopic, formatLessonDateDDMMYYYY } from '../../utils/lessonDisplay';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import { openScratchpadTab } from '../../services/scratchpadService';
import { auth } from '../../firebase';
import Card from '../ui/Card';
import Button from '../ui/Button';
import {
  BookOpen,
  Clock,
  Search,
  Filter,
  Users,
  User as UserIcon,
  FileText,
  CheckCircle2,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
  FileEdit,
  ClipboardList,
  Airplay,
  X,
  Layers,
  RefreshCw,
  Plus,
  Award,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  Trash2,
  Database,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { NotionImportPreviewModal, NotionPreviewItem } from './NotionImportPreviewModal';
import { CascadingLessonDetails } from './CascadingLessonDetails';

interface TeacherLessonHistoryViewProps {
  lessons: LessonRecord[];
  students: User[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectStudent?: (student: User, targetTab?: string) => void;
  onOpenNotebook?: (student: User) => void;
  onOpenHomework?: (student: User, lesson?: LessonRecord) => void;
  onOpenPresentation?: (lesson: LessonRecord, student?: User) => void;
  onDeleteLesson?: (studentId: string, lesson: LessonRecord) => Promise<void>;
  onEditLesson?: (studentId: string, lesson: LessonRecord) => void;
  onGenerateHomeworkFromLesson?: (studentId: string, lesson: LessonRecord) => void;
  onConfirmLesson?: (studentId: string, lesson: LessonRecord) => void | Promise<void>;
  onRejectLesson?: (studentId: string, lesson: LessonRecord) => void | Promise<void>;
  onUpdateLesson?: (studentId: string, lesson: LessonRecord, updates: Partial<LessonRecord>) => Promise<void>;
  onCleanupDuplicatePendingLessons?: (duplicates: LessonRecord[]) => Promise<void>;
  onAddNewLesson?: () => void;
}

type StatusFilter = 'all' | 'completed' | 'planned' | 'draft';
type SortOrder = 'desc' | 'asc';

export const TeacherLessonHistoryView: React.FC<TeacherLessonHistoryViewProps> = ({
  lessons,
  students,
  isLoading = false,
  onRefresh,
  onSelectStudent,
  onOpenNotebook,
  onOpenHomework,
  onOpenPresentation,
  onDeleteLesson,
  onEditLesson,
  onGenerateHomeworkFromLesson,
  onConfirmLesson,
  onRejectLesson,
  onUpdateLesson,
  onCleanupDuplicatePendingLessons,
  onAddNewLesson,
}) => {
  const [selectedStudentTab, setSelectedStudentTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [previewLesson, setPreviewLesson] = useState<LessonRecord | null>(null);
  const [isCheckingNotion, setIsCheckingNotion] = useState(false);
  const [notionCheckMsg, setNotionCheckMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastImportedCount, setLastImportedCount] = useState(0);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const [notionPreviewItems, setNotionPreviewItems] = useState<NotionPreviewItem[]>([]);
  const [isNotionPreviewOpen, setIsNotionPreviewOpen] = useState(false);
  const [isImportingNotion, setIsImportingNotion] = useState(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  // Wpisy „Weryfikacja”, dla których ten sam kursant ma już potwierdzoną lekcję tego samego dnia —
  // zwykle zdublowany wpis z importu Notion obok ręcznie uzupełnionego rekordu.
  const duplicatePendingLessons = useMemo(() => findDuplicatePendingLessons(lessons) as LessonRecord[], [lessons]);

  const handleCleanupDuplicates = async () => {
    if (!onCleanupDuplicatePendingLessons || duplicatePendingLessons.length === 0) return;
    if (
      !window.confirm(
        `Usunąć ${duplicatePendingLessons.length} zdublowanych wpisów „Weryfikacja”, dla których kursant ma już potwierdzoną lekcję tego samego dnia?`
      )
    ) {
      return;
    }
    setIsCleaningDuplicates(true);
    try {
      await onCleanupDuplicatePendingLessons(duplicatePendingLessons);
      setNotionCheckMsg({
        type: 'success',
        text: `Usunięto ${duplicatePendingLessons.length} zdublowanych wpisów „Weryfikacja”.`,
      });
      setTimeout(() => setNotionCheckMsg(null), 6000);
    } catch (e: any) {
      setNotionCheckMsg({ type: 'error', text: `Błąd czyszczenia duplikatów: ${e.message || String(e)}` });
      setTimeout(() => setNotionCheckMsg(null), 7000);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const callNotionSync = async (body: Record<string, unknown>) => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/notion/fetch-transcripts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get('content-type') || '';
    const data: any = contentType.includes('application/json') ? await res.json() : {};
    if (!res.ok) {
      throw new Error(data.error || 'Nie udało się połączyć z Notion');
    }
    return data;
  };

  /**
   * Pull-on-Demand: krok 1. Tylko PATRZY — nic nie zapisuje. Wymaga
   * zaznaczonego kursanta, bo import z Notion nie skanuje już całej bazy
   * naraz w tle, tylko na wyraźne żądanie lektora dla jednej osoby.
   */
  const handleCheckNotion = async () => {
    if (selectedStudentTab === 'all') {
      setNotionCheckMsg({
        type: 'error',
        text: 'Wybierz najpierw kursanta z listy powyżej — sprawdzanie Notion działa dla jednej osoby naraz.',
      });
      setTimeout(() => setNotionCheckMsg(null), 6000);
      return;
    }

    setIsCheckingNotion(true);
    setNotionCheckMsg(null);
    try {
      const data = await callNotionSync({ mode: 'preview', studentId: selectedStudentTab });
      setNotionPreviewItems((data.items || []) as NotionPreviewItem[]);
      setIsNotionPreviewOpen(true);
    } catch (e: any) {
      setNotionCheckMsg({
        type: 'error',
        text: `Błąd sprawdzania Notion: ${e.message || String(e)}`,
      });
      setTimeout(() => setNotionCheckMsg(null), 7000);
    } finally {
      setIsCheckingNotion(false);
    }
  };

  /** Pull-on-Demand: krok 2. Zapisuje wyłącznie to, co lektor zaznaczył w modalu. */
  const handleConfirmNotionImport = async (pageIds: string[]) => {
    if (selectedStudentTab === 'all' || pageIds.length === 0) return;
    setIsImportingNotion(true);
    try {
      const data = await callNotionSync({ mode: 'import', studentId: selectedStudentTab, pageIds });
      const imported = Number(data.importedCount || 0);
      setLastImportedCount(imported);
      setIsNotionPreviewOpen(false);
      setNotionCheckMsg({
        type: 'success',
        text: `Zaimportowano ${imported} ${imported === 1 ? 'lekcję' : 'lekcji'} z Notion dla ${selectedStudentLabel}.`,
      });
      if (onRefresh) onRefresh();
      setTimeout(() => setNotionCheckMsg(null), 6000);
    } catch (e: any) {
      setNotionCheckMsg({
        type: 'error',
        text: `Błąd importu z Notion: ${e.message || String(e)}`,
      });
      setTimeout(() => setNotionCheckMsg(null), 7000);
    } finally {
      setIsImportingNotion(false);
    }
  };

  useEscapeModal(Boolean(previewLesson), () => setPreviewLesson(null), 10);
  useEscapeModal(isStudentDropdownOpen, () => setIsStudentDropdownOpen(false), 5);

  // Zamknięcie dropdownu wyboru kursanta po kliknięciu poza nim
  useEffect(() => {
    if (!isStudentDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStudentDropdownOpen]);

  // Map of studentId -> User for O(1) lookups
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => {
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [students]);

  // Count lessons per student
  const lessonCountsByStudent = useMemo(() => {
    const counts: Record<string, number> = {};
    lessons.forEach((l) => {
      const sId = l.studentId;
      if (sId) {
        counts[sId] = (counts[sId] || 0) + 1;
      }
      if (l.studentIds) {
        l.studentIds.forEach((id) => {
          counts[id] = (counts[id] || 0) + 1;
        });
      }
    });
    return counts;
  }, [lessons]);

  // Students list with at least 1 lesson or all active students sorted
  const sortedStudentTabs = useMemo(() => {
    return [...students]
      .filter((s) => s.role !== 'admin' || s.isGroup || (lessonCountsByStudent[s.id || ''] || 0) > 0)
      .sort((a, b) => {
        const countB = lessonCountsByStudent[b.id || ''] || 0;
        const countA = lessonCountsByStudent[a.id || ''] || 0;
        // Prioritize students with lessons, then alphabetical
        if (countB !== countA) return countB - countA;
        const nameA = (a.displayName || a.name || a.username || '').toLowerCase();
        const nameB = (b.displayName || b.name || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [students, lessonCountsByStudent]);

  // Lista kursantów przefiltrowana po wpisanej frazie w dropdownie wyboru kursanta
  const filteredStudentTabs = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return sortedStudentTabs;
    return sortedStudentTabs.filter((student) =>
      formatStudentDisplayName(student).toLowerCase().includes(q)
    );
  }, [sortedStudentTabs, studentSearchQuery]);

  // Etykieta aktualnie wybranego kursanta na przycisku dropdownu
  const selectedStudentLabel = useMemo(() => {
    if (selectedStudentTab === 'all') return 'Wszyscy kursanci';
    const student = studentMap.get(selectedStudentTab);
    return student ? formatStudentDisplayName(student) : 'Wszyscy kursanci';
  }, [selectedStudentTab, studentMap]);

  const selectedStudentForTab = selectedStudentTab === 'all' ? null : studentMap.get(selectedStudentTab);
  const isSelectedGroup = Boolean(
    selectedStudentForTab?.isGroup || selectedStudentForTab?.lessonType === 'Group'
  );

  // Filtered and sorted lessons
  const filteredLessons = useMemo(() => {
    return lessons
      .filter((lesson) => {
        // Tab filter
        if (selectedStudentTab !== 'all') {
          const matchPrimary = lesson.studentId === selectedStudentTab;
          const matchMultiple = lesson.studentIds?.includes(selectedStudentTab);
          if (!matchPrimary && !matchMultiple) return false;
        }

        // Status filter
        const isPending = isLessonPendingConfirmation(lesson);
        const isConfirmed = !isPending && lesson.status !== 'rejected';
        const isRejected = lesson.status === 'rejected';

        if (statusFilter === 'completed' && !isConfirmed) return false;
        if (statusFilter === 'draft' && !isPending) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const topic = (lesson.topic || '').toLowerCase();
          const vocab = (lesson.vocabularyText || '').toLowerCase();
          const date = (lesson.date || '').toLowerCase();
          const summary = (lesson.lessonSummary || '').toLowerCase();
          const student = studentMap.get(lesson.studentId);
          const studentName = (
            student?.displayName ||
            student?.name ||
            student?.username ||
            ''
          ).toLowerCase();

          return (
            topic.includes(q) ||
            vocab.includes(q) ||
            date.includes(q) ||
            summary.includes(q) ||
            studentName.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [lessons, selectedStudentTab, statusFilter, searchQuery, sortOrder, studentMap]);

  const formatDateLabel = (dateStr?: string) => {
    return formatLessonDateDDMMYYYY(dateStr) || dateStr || '-';
  };

  const getStudentForLesson = (lesson: LessonRecord): User | undefined => {
    return studentMap.get(lesson.studentId);
  };

  return (
    <div className="space-y-4 pt-6 mt-8 border-t border-line-strong">
      {/* Header bar Notion-style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-text-hi flex items-center gap-2.5">
              Historia Lekcji
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-line-soft/80 border border-line-strong text-content-muted">
                {filteredLessons.length} {filteredLessons.length === 1 ? 'lekcja' : 'lekcji'}
              </span>
            </h2>
            <p className="text-xs text-content-muted">
              Baza zrealizowanych tematów, słownictwa i 4 bloków Notion z szybkim podglądem
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCheckNotion}
            isLoading={isCheckingNotion}
            className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong hover:border-amber-400/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 font-semibold"
            title={
              selectedStudentTab === 'all'
                ? 'Wybierz kursanta z listy, żeby sprawdzić jego transkrypcje w Notion'
                : `Sprawdź w Notion, czy jest coś nowego do zaimportowania dla: ${selectedStudentLabel}`
            }
          >
            <Database size={13} className={isCheckingNotion ? 'animate-spin' : ''} />
            Sprawdź transkrypcje w Notion
          </Button>

          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              isLoading={isLoading}
              className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong hover:border-primary/40"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Odśwież
            </Button>
          )}

          {onCleanupDuplicatePendingLessons && duplicatePendingLessons.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCleanupDuplicates}
              isLoading={isCleaningDuplicates}
              title="Usuń wpisy „Weryfikacja”, dla których kursant ma już potwierdzoną lekcję tego samego dnia"
              className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong hover:border-rose-400/40 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 font-semibold"
            >
              <Trash2 size={13} />
              Wyczyść duplikaty Weryfikacja ({duplicatePendingLessons.length})
            </Button>
          )}

          {onAddNewLesson && (
            <Button
              size="sm"
              onClick={onAddNewLesson}
              className="text-xs flex items-center gap-1.5 py-1.5 px-3 bg-primary hover:bg-primary/90 text-accent-ink font-bold shadow-btn"
            >
              <Plus size={14} />
              Nowy wpis lekcji
            </Button>
          )}
        </div>
      </div>

      {/* Komunikat ze sprawdzania transkrypcji w Notion */}
      {notionCheckMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
            notionCheckMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notionCheckMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>{notionCheckMsg.text}</span>
          </div>
          <button
            onClick={() => setNotionCheckMsg(null)}
            className="p-1 hover:bg-white/10 rounded text-content-muted hover:text-text-hi"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Wybór kursanta / grupy — kompaktowy dropdown z wyszukiwarką */}
      <div className="relative border-b border-line-strong pb-3" ref={studentDropdownRef}>
        <button
          type="button"
          onClick={() => {
            setIsStudentDropdownOpen((v) => !v);
            setStudentSearchQuery('');
          }}
          className={`w-full sm:w-auto px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 font-medium text-xs border ${
            selectedStudentTab !== 'all'
              ? isSelectedGroup
                ? 'bg-purple-500 text-white font-bold border-purple-500 shadow-md shadow-purple-500/20'
                : 'bg-primary text-accent-ink font-bold border-primary shadow-md shadow-primary/20'
              : 'bg-line-soft/50 text-text-hi hover:bg-line-soft border-line-strong'
          }`}
        >
          {selectedStudentTab === 'all' ? (
            <Layers size={14} />
          ) : isSelectedGroup ? (
            <Users size={14} />
          ) : (
            <UserIcon size={14} />
          )}
          <span className="truncate max-w-[200px]">{selectedStudentLabel}</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedStudentTab !== 'all' ? 'bg-black/20 text-inherit' : 'bg-line-strong text-content-muted'
            }`}
          >
            {selectedStudentTab === 'all' ? lessons.length : lessonCountsByStudent[selectedStudentTab] || 0}
          </span>
          {isStudentDropdownOpen ? (
            <ChevronUp size={14} className="ml-auto sm:ml-0.5 opacity-70" />
          ) : (
            <ChevronDown size={14} className="ml-auto sm:ml-0.5 opacity-70" />
          )}
        </button>

        {isStudentDropdownOpen && (
          <div className="absolute z-20 mt-2 w-full sm:w-72 rounded-2xl border border-line-strong bg-base-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-2 border-b border-line-strong">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  autoFocus
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Szukaj kursanta lub grupy..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-base-100 border border-line-strong text-text-hi text-xs placeholder:text-content-muted/60 focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedStudentTab('all');
                  setIsStudentDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2 text-xs text-left transition-colors ${
                  selectedStudentTab === 'all'
                    ? 'bg-primary/15 text-primary font-bold'
                    : 'text-text-hi hover:bg-line-soft'
                }`}
              >
                <Layers size={13} />
                <span className="flex-1 truncate">Wszyscy kursanci</span>
                <span className="text-[10px] font-mono text-content-muted">{lessons.length}</span>
              </button>

              {filteredStudentTabs.length === 0 ? (
                <p className="px-3 py-3 text-xs text-content-muted/80 italic">Brak kursanta pasującego do frazy.</p>
              ) : (
                filteredStudentTabs.map((student) => {
                  const isGrp = Boolean(student.isGroup || student.lessonType === 'Group');
                  const count = lessonCountsByStudent[student.id || ''] || 0;
                  const isSelected = selectedStudentTab === student.id;
                  const name = formatStudentDisplayName(student);

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentTab(student.id || '');
                        setIsStudentDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-xs text-left transition-colors ${
                        isSelected
                          ? isGrp
                            ? 'bg-purple-500/15 text-purple-300 font-bold'
                            : 'bg-primary/15 text-primary font-bold'
                          : 'text-text-hi hover:bg-line-soft'
                      }`}
                    >
                      {isGrp ? <Users size={13} /> : <UserIcon size={13} />}
                      <span className="flex-1 truncate">{name}</span>
                      {count > 0 && (
                        <span className="text-[10px] font-mono text-content-muted">{count}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search & Status Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              statusFilter === 'all'
                ? 'bg-line-soft text-text-hi font-bold border border-line-strong'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            Wszystkie ({filteredLessons.length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Odbyte
          </button>
          <button
            onClick={() => setStatusFilter('planned')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'planned'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Zaplanowane
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'draft'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Weryfikacja / Brudnopis
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj tematu, słówek..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-base-200/80 border border-line-strong text-text-hi text-xs placeholder:text-content-muted/60 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            title={sortOrder === 'desc' ? 'Sortuj od najstarszych' : 'Sortuj od najnowszych'}
            className="p-1.5 rounded-xl bg-base-200/80 border border-line-strong text-content-muted hover:text-text-hi hover:border-primary/40 transition-colors"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* Notion-Style Lesson Feed Table */}
      <div className="rounded-2xl border border-line-strong bg-base-200/50 backdrop-blur-md overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-content-muted border-collapse">
            <thead>
              <tr className="border-b border-line-strong bg-base-300/60 font-semibold text-content uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[240px]">Temat lekcji</th>
                <th className="py-3 px-3 min-w-[160px]">Kursant / Grupa</th>
                <th className="py-3 px-3 min-w-[130px]">Data lekcji</th>
                <th className="py-3 px-3 min-w-[100px]">Status</th>
                <th className="py-3 px-3 min-w-[180px]">4 Bloki Notion</th>
                <th className="py-3 px-4 text-right min-w-[130px]">Szybkie akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft/40">
              {filteredLessons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-content-muted">
                    <BookOpen size={28} className="mx-auto mb-2 opacity-30 text-content-muted" />
                    <p className="font-semibold text-text-hi text-sm">Brak lekcji spełniających kryteria</p>
                    <p className="text-xs text-content-muted/80 mt-1">
                      Zmień filtr studenta lub dodaj nową lekcję do bazy.
                    </p>
                  </td>
                </tr>
              ) : (
                (isExpanded ? filteredLessons : filteredLessons.slice(0, 6)).map((lesson) => {
                  const student = getStudentForLesson(lesson);
                  const isGrp = Boolean(student?.isGroup || student?.lessonType === 'Group');
                  const sName = student
                    ? formatStudentDisplayName(student)
                    : 'Nieprzypisany';
                  const lessonTopicLabel = getDisplayLessonTopic(lesson);

                  const blocks = extractLessonBlocks(lesson);
                  const isPending = isLessonPendingConfirmation(lesson);
                  const isConfirmed = !isPending && lesson.status !== 'rejected';

                  const vocabCount = blocks.vocabulary
                    ? blocks.vocabulary.split('\n').filter((l) => l.trim().length > 0).length
                    : 0;
                  const hasCorrections = Boolean(blocks.corrections);
                  const hasHomework = Boolean(blocks.homework || lesson.homeworkText);
                  const hasNextPlan = Boolean(blocks.nextLesson || lesson.nextLessonPlan);

                  return (
                    <tr
                      key={lesson.id}
                      className="hover:bg-line-soft/40 transition-colors group cursor-pointer"
                      onClick={() => setPreviewLesson(lesson)}
                    >
                      {/* Temat lekcji */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 p-1 rounded bg-line-soft/80 border border-line-strong text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                            <FileText size={14} />
                          </div>
                          <div>
                            <span className="font-bold text-text-hi group-hover:text-primary transition-colors block text-sm leading-snug">
                              {lessonTopicLabel}
                            </span>
                            {lesson.lessonSummary && (
                              <span className="text-[11px] text-content-muted line-clamp-1 mt-0.5">
                                {lesson.lessonSummary}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kursant / Grupa */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (student) {
                              onSelectStudent?.(student, 'profile');
                            }
                          }}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              isGrp
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                          >
                            {isGrp ? <Users size={12} /> : sName[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="truncate max-w-[130px]">
                            <span className="font-semibold text-text-hi text-xs block truncate">
                              {sName}
                            </span>
                            {student?.level && (
                              <span className="text-[10px] font-mono text-content-muted">
                                {student.level}
                              </span>
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Data lekcji */}
                      <td className="py-3.5 px-3">
                        <span className="font-medium text-text-hi block">
                          {formatDateLabel(lesson.date)}
                        </span>
                        <span className="text-[10px] font-mono text-content-muted">
                          {lesson.date}
                        </span>
                      </td>

                      {/* Status */}
                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Weryfikacja
                          </span>
                        ) : isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Odbyta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Odrzucona
                          </span>
                        )}
                      </td>

                      {/* 4 Bloki Notion */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {vocabCount > 0 && (
                            <span
                              title={`Słownictwo: ${vocabCount} pozycji`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-line-soft text-content text-[10px] font-mono border border-line-strong"
                            >
                              <BookOpen size={10} className="text-primary" />
                              {vocabCount}
                            </span>
                          )}
                          {hasCorrections && (
                            <span
                              title="Korekty językowe i wymowa (Blok 2b)"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 text-[10px] border border-sky-500/20 font-mono"
                            >
                              <Sparkles size={10} />
                              Korekty
                            </span>
                          )}
                          {hasHomework && (
                            <span
                              title="Zadanie domowe (Blok 3)"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[10px] border border-purple-500/20 font-mono"
                            >
                              <ClipboardList size={10} />
                              HW
                            </span>
                          )}
                          {hasNextPlan && (
                            <span
                              title="Plan na kolejną lekcję (Blok 4)"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] border border-emerald-500/20 font-mono"
                            >
                              Plan
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Szybkie akcje */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Podgląd 4 bloków */}
                          <button
                            type="button"
                            onClick={() => setPreviewLesson(lesson)}
                            title="Podgląd 4 bloków Notion"
                            className="p-1.5 rounded-lg bg-line-soft hover:bg-primary/20 text-content-muted hover:text-primary transition-colors"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Notatnik / Scratchpad */}
                          {student && onOpenNotebook && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenNotebook(student);
                                openScratchpadTab(`sp_${student.id}`);
                              }}
                              title="Otwórz Notatnik / Live Scratchpad"
                              className="p-1.5 rounded-lg bg-line-soft hover:bg-emerald-500/20 text-content-muted hover:text-emerald-300 transition-colors"
                            >
                              <FileEdit size={14} />
                            </button>
                          )}

                          {/* Zadaj pracę domową */}
                          {student && onOpenHomework && (
                            <button
                              type="button"
                              onClick={() => onOpenHomework(student, lesson)}
                              title="Zadaj lub edytuj pracę domową"
                              className="p-1.5 rounded-lg bg-line-soft hover:bg-purple-500/20 text-content-muted hover:text-purple-300 transition-colors"
                            >
                              <ClipboardList size={14} />
                            </button>
                          )}

                          {/* Prezentacja */}
                          {onOpenPresentation && (
                            <button
                              type="button"
                              onClick={() => onOpenPresentation(lesson, student)}
                              title="Uruchom w trybie prezentacji"
                              className="p-1.5 rounded-lg bg-line-soft hover:bg-sky-500/20 text-content-muted hover:text-sky-300 transition-colors"
                            >
                              <Airplay size={14} />
                            </button>
                          )}

                          {/* Usuń lekcję */}
                          {onDeleteLesson && student && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `Czy na pewno chcesz usunąć lekcję „${lessonTopicLabel}” z dnia ${formatDateLabel(lesson.date)}?`
                                  )
                                ) {
                                  await onDeleteLesson(student.id || lesson.studentId, lesson);
                                }
                              }}
                              title="Usuń wpis lekcji"
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-content-muted hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={14} />
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

        {/* Pasek rozwijania / limit 6 ostatnich lekcji */}
        {filteredLessons.length > 6 && (
          <div className="p-3.5 border-t border-line-strong/60 bg-base-100/50 flex items-center justify-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-2 rounded-xl bg-line-soft hover:bg-line-soft/80 border border-line-strong text-xs font-bold text-content-muted hover:text-text-hi transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:border-primary/40"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={15} className="text-primary" />
                  <span>Zwiń listę do 6 ostatnich lekcji</span>
                </>
              ) : (
                <>
                  <ChevronDown size={15} className="text-primary" />
                  <span>Pokaż wszystkie lekcje (pokazano 6 z {filteredLessons.length})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal Podglądu Lekcji — dokładnie ten sam komponent (CascadingLessonDetails), co w profilu kursanta */}
      {previewLesson && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-base-200 border border-primary/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-line-strong flex items-start justify-between gap-4 bg-base-300/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const isPending = isLessonPendingConfirmation(previewLesson);
                    const isConfirmed = !isPending && previewLesson.status !== 'rejected';
                    if (isPending) {
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Weryfikacja
                        </span>
                      );
                    }
                    return (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                          isConfirmed
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isConfirmed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {isConfirmed ? 'Odbyta' : 'Odrzucona'}
                      </span>
                    );
                  })()}
                  <span className="text-xs font-mono text-content-muted flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDateLabel(previewLesson.date)}
                  </span>
                  {(() => {
                    const student = getStudentForLesson(previewLesson);
                    if (!student) return null;
                    const isGrp = Boolean(student.isGroup || student.lessonType === 'Group');
                    return (
                      <span className="px-2 py-0.5 rounded-lg bg-line-soft text-text-hi text-xs font-semibold flex items-center gap-1 border border-line-strong">
                        {isGrp ? <Users size={12} className="text-purple-400" /> : <UserIcon size={12} className="text-primary" />}
                        {formatStudentDisplayName(student)}
                      </span>
                    );
                  })()}
                </div>
                <h3 className="text-lg sm:text-xl font-black text-text-hi flex items-center gap-2">
                  <FileText className="text-primary w-5 h-5 shrink-0" />
                  <span>{getDisplayLessonTopic(previewLesson)}</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewLesson(null)}
                className="p-1.5 rounded-xl bg-line-soft text-content-muted hover:text-text-hi hover:bg-line-strong transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: CascadingLessonDetails — te same 4 Bloki Notion + Learning Curve co w profilu kursanta */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {(() => {
                const student = getStudentForLesson(previewLesson);
                const studentId = student?.id || previewLesson.studentId;
                return (
                  <CascadingLessonDetails
                    record={previewLesson}
                    studentName={student ? formatStudentDisplayName(student) : undefined}
                    studentLevel={student?.level}
                    onGenerateHomework={
                      onGenerateHomeworkFromLesson
                        ? () => {
                            setPreviewLesson(null);
                            onGenerateHomeworkFromLesson(studentId, previewLesson);
                          }
                        : undefined
                    }
                    onConfirmLesson={
                      onConfirmLesson ? () => onConfirmLesson(studentId, previewLesson) : undefined
                    }
                    onRejectLesson={
                      onRejectLesson ? () => onRejectLesson(studentId, previewLesson) : undefined
                    }
                    onUpdateRecord={
                      onUpdateLesson
                        ? (updates) => onUpdateLesson(studentId, previewLesson, updates)
                        : undefined
                    }
                  />
                );
              })()}
            </div>

            {/* Modal Footer Actions: Edytuj, Usuń, Otwórz Notatnik */}
            <div className="p-4 border-t border-line-strong flex items-center justify-between gap-3 bg-base-300/70">
              <div className="flex items-center gap-2">
                {(() => {
                  const student = getStudentForLesson(previewLesson);
                  const studentId = student?.id || previewLesson.studentId;
                  return (
                    <>
                      {onEditLesson && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPreviewLesson(null);
                            onEditLesson(studentId, previewLesson);
                          }}
                          className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong"
                        >
                          <FileEdit size={13} className="text-primary" />
                          Edytuj
                        </Button>
                      )}

                      {onDeleteLesson && student && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (
                              window.confirm(
                                `Czy na pewno chcesz usunąć lekcję „${getDisplayLessonTopic(previewLesson)}” z dnia ${formatDateLabel(previewLesson.date)}?`
                              )
                            ) {
                              setPreviewLesson(null);
                              await onDeleteLesson(studentId, previewLesson);
                            }
                          }}
                          className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong hover:border-rose-500/40 hover:text-rose-300"
                        >
                          <Trash2 size={13} className="text-rose-400" />
                          Usuń
                        </Button>
                      )}

                      {onOpenNotebook && student && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPreviewLesson(null);
                            onOpenNotebook(student);
                            openScratchpadTab(`sp_${student.id}`);
                          }}
                          className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong"
                        >
                          <FileEdit size={13} className="text-emerald-400" />
                          Otwórz Notatnik
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>

              <Button
                size="sm"
                onClick={() => setPreviewLesson(null)}
                className="text-xs py-1.5 px-4 bg-line-soft text-text-hi hover:bg-line-strong font-bold"
              >
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Podgląd Pull-on-Demand: lektor zaznacza, co z Notion wejdzie do historii tego kursanta */}
      <NotionImportPreviewModal
        isOpen={isNotionPreviewOpen}
        onClose={() => setIsNotionPreviewOpen(false)}
        studentName={selectedStudentLabel}
        items={notionPreviewItems}
        isImporting={isImportingNotion}
        onConfirmImport={handleConfirmNotionImport}
      />
    </div>
  );
};

export default TeacherLessonHistoryView;

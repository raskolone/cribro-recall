import React, { useState, useMemo, useEffect } from 'react';
import { User, LessonRecord } from '../../types';
import { extractLessonBlocks, isLessonPendingConfirmation } from '../../utils/lessonBlocks';
import { openScratchpadTab } from '../../services/scratchpadService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TTSButtons from '../flashcards/TTSButtons';
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
  Copy,
  Check,
  Award,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  KeyRound,
  Trash2
} from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';

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
  onAddNewLesson,
}) => {
  const [selectedStudentTab, setSelectedStudentTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [previewLesson, setPreviewLesson] = useState<LessonRecord | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState(false);

  useEscapeModal(Boolean(previewLesson), () => setPreviewLesson(null), 10);

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

  const handleCopyText = (text: string, sectionKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStudentForLesson = (lesson: LessonRecord): User | undefined => {
    return studentMap.get(lesson.studentId);
  };

  // Preview block data
  const previewBlocks = useMemo(() => {
    if (!previewLesson) return null;
    return extractLessonBlocks(previewLesson);
  }, [previewLesson]);

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

      {/* Notion Student / Group Horizontal Filter Tabs */}
      <div className="relative border-b border-line-strong pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {/* Wszystkie lekcje Tab */}
          <button
            onClick={() => setSelectedStudentTab('all')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 font-medium ${
              selectedStudentTab === 'all'
                ? 'bg-primary text-accent-ink font-bold shadow-md shadow-primary/20'
                : 'bg-line-soft/50 text-content-muted hover:text-text-hi hover:bg-line-soft border border-line-strong'
            }`}
          >
            <Layers size={13} />
            <span>Wszystkie lekcje</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                selectedStudentTab === 'all'
                  ? 'bg-black/20 text-accent-ink'
                  : 'bg-line-strong text-content-muted'
              }`}
            >
              {lessons.length}
            </span>
          </button>

          <div className="h-4 w-[1px] bg-line-strong mx-1 shrink-0" />

          {/* Student & Group Tabs */}
          {sortedStudentTabs.map((student) => {
            const isGrp = Boolean(student.isGroup || student.lessonType === 'Group');
            const count = lessonCountsByStudent[student.id || ''] || 0;
            const isSelected = selectedStudentTab === student.id;
            const name =
              student.displayName ||
              student.name ||
              `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
              student.username;

            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudentTab(student.id || '')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 font-medium ${
                  isSelected
                    ? isGrp
                      ? 'bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20'
                      : 'bg-primary text-accent-ink font-bold shadow-md shadow-primary/20'
                    : 'bg-line-soft/40 text-content-muted hover:text-text-hi hover:bg-line-soft border border-line-strong'
                }`}
              >
                {isGrp ? <Users size={12} /> : <UserIcon size={12} />}
                <span className="truncate max-w-[150px]">{name}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected
                        ? 'bg-black/20 text-inherit'
                        : 'bg-line-strong text-content-muted'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
                filteredLessons.map((lesson) => {
                  const student = getStudentForLesson(lesson);
                  const isGrp = Boolean(student?.isGroup || student?.lessonType === 'Group');
                  const sName =
                    student?.displayName ||
                    student?.name ||
                    `${student?.firstName || ''} ${student?.lastName || ''}`.trim() ||
                    student?.username ||
                    'Nieprzypisany';

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
                              {lesson.topic || 'Bez tematu'}
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
                                    `Czy na pewno chcesz usunąć lekcję „${lesson.topic}” z dnia ${lesson.date}?`
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
      </div>

      {/* Slide-over Drawer / Modal Podglądu 4 Bloków Lekcji */}
      {previewLesson && previewBlocks && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-base-200 border border-primary/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-line-strong flex items-start justify-between gap-4 bg-base-300/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Odbyta
                  </span>
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
                        {student.displayName || student.name || student.username}
                      </span>
                    );
                  })()}
                </div>
                <h3 className="text-lg sm:text-xl font-black text-text-hi flex items-center gap-2">
                  <FileText className="text-primary w-5 h-5 shrink-0" />
                  <span>{previewLesson.topic || 'Szczegóły lekcji'}</span>
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

            {/* Modal Body: 4 Notion Blocks */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 divide-y divide-line-soft">
              {/* Blok 1: Słownictwo (Words & Phrases) */}
              <div className="space-y-2.5 pt-2 first:pt-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <BookOpen size={14} />
                    Blok 1: Words & Phrases (Słownictwo)
                  </h4>
                  {previewBlocks.vocabulary && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(previewBlocks.vocabulary || '', 'vocab')}
                      className="text-[11px] text-content-muted hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      {copiedSection === 'vocab' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedSection === 'vocab' ? 'Skopiowano' : 'Kopiuj listę'}
                    </button>
                  )}
                </div>

                {previewBlocks.vocabulary ? (
                  <div className="space-y-1.5">
                    {previewBlocks.vocabulary
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((line, idx) => {
                        const parts = line.split(/[-–—:=]/);
                        const term = parts[0]?.trim() || line;
                        const def = parts.slice(1).join(' - ').trim();

                        return (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-base-300/50 border border-line-strong flex items-center justify-between gap-2 hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-text-hi text-xs">{term}</span>
                              {def && <span className="text-xs text-content-muted">— {def}</span>}
                            </div>
                            <TTSButtons text={term} size="sm" />
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-content-muted/60 italic">Brak zapisanego słownictwa.</p>
                )}
              </div>

              {/* Blok 2: Korekty językowe i wymowa (Corrections & Pronunciation) */}
              {previewBlocks.corrections && (
                <div className="space-y-2.5 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Blok 2: Corrections & Pronunciation (Korekty i wymowa)
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleCopyText(previewBlocks.corrections || '', 'grammar')}
                      className="text-[11px] text-content-muted hover:text-sky-300 flex items-center gap-1 transition-colors"
                    >
                      {copiedSection === 'grammar' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedSection === 'grammar' ? 'Skopiowano' : 'Kopiuj'}
                    </button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-sky-500/[0.04] border border-sky-500/20 text-xs text-text-hi whitespace-pre-wrap leading-relaxed">
                    {previewBlocks.corrections}
                  </div>
                </div>
              )}

              {/* Blok 3: Zadanie Domowe (Homework) */}
              {(previewBlocks.homework || previewLesson.homeworkText) && (
                <div className="space-y-2.5 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <ClipboardList size={14} />
                      Blok 3: Homework (Zadanie domowe)
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          previewBlocks.homework || previewLesson.homeworkText || '',
                          'hw'
                        )
                      }
                      className="text-[11px] text-content-muted hover:text-purple-300 flex items-center gap-1 transition-colors"
                    >
                      {copiedSection === 'hw' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedSection === 'hw' ? 'Skopiowano' : 'Kopiuj'}
                    </button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 text-xs text-text-hi whitespace-pre-wrap leading-relaxed">
                    {previewBlocks.homework || previewLesson.homeworkText}
                  </div>

                  {/* Answer key toggle if available */}
                  {(previewBlocks.answerKey || previewLesson.homeworkAnswerKey) && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setIsAnswerKeyOpen(!isAnswerKeyOpen)}
                        className="text-xs text-content-muted hover:text-purple-300 flex items-center gap-1.5 font-semibold transition-colors"
                      >
                        <KeyRound size={12} />
                        <span>{isAnswerKeyOpen ? 'Ukryj klucz odpowiedzi' : 'Pokaż klucz odpowiedzi (Answer Key)'}</span>
                      </button>
                      {isAnswerKeyOpen && (
                        <div className="mt-2 p-3 rounded-xl bg-base-300/80 border border-line-strong text-xs text-content-muted font-mono whitespace-pre-wrap">
                          {previewBlocks.answerKey || previewLesson.homeworkAnswerKey}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Blok 4: Plan na kolejną lekcję (Next Lesson Plan) */}
              {(previewBlocks.nextLesson || previewLesson.nextLessonPlan) && (
                <div className="space-y-2.5 pt-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    Blok 4: Next Lesson Plan (Plan na kolejną lekcję)
                  </h4>
                  <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs text-text-hi whitespace-pre-wrap leading-relaxed">
                    {previewBlocks.nextLesson || previewLesson.nextLessonPlan}
                  </div>
                </div>
              )}

              {/* Podsumowanie / Notatki */}
              {(previewBlocks.summary || previewLesson.lessonSummary) && (
                <div className="space-y-2 pt-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                    Podsumowanie lekcji
                  </h4>
                  <p className="text-xs text-content-muted leading-relaxed">
                    {previewBlocks.summary || previewLesson.lessonSummary}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-line-strong flex items-center justify-between gap-3 bg-base-300/70">
              <div className="flex items-center gap-2">
                {(() => {
                  const student = getStudentForLesson(previewLesson);
                  if (!student) return null;
                  return (
                    <>
                      {onOpenNotebook && (
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

                      {onOpenHomework && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPreviewLesson(null);
                            onOpenHomework(student, previewLesson);
                          }}
                          className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong"
                        >
                          <ClipboardList size={13} className="text-purple-400" />
                          Zadaj pracę domową
                        </Button>
                      )}

                      {onOpenPresentation && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPreviewLesson(null);
                            onOpenPresentation(previewLesson, student);
                          }}
                          className="text-xs flex items-center gap-1.5 py-1.5 px-3 border-line-strong"
                        >
                          <Airplay size={13} className="text-sky-400" />
                          Prezentacja
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
    </div>
  );
};

export default TeacherLessonHistoryView;

import React, { useEffect, useMemo, useState } from 'react';
import i18n from 'i18next';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit2,
  FileEdit,
  Loader2,
  Plus,
  Sparkles,
  Users,
  ChevronDown,
} from 'lucide-react';
import type { LessonRecord, User } from '../../types';
import type { Group } from '../../types/group';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { mergeGroupLessonCopies, GroupLessonEntry } from '../../utils/groupLessonHistory';
import StudentPanelSection from './StudentPanelSection';
import MenuDropdown from '../ui/MenuDropdown';

/**
 * Karta grupy — odpowiednik karty kursanta dla grupy z kolekcji `groups`.
 *
 * Historia lekcji grupy nie ma własnego źródła: to lekcje członków (cache
 * `getLessonRecordsForStudent`, 5 min) przefiltrowane po `groupId` i sklejone
 * po `groupLessonId` w `utils/groupLessonHistory.ts`. Formularz lekcji,
 * notatnik i prace domowe należą do AdminPanel — tu są tylko wejścia do nich.
 */
interface GroupDetailViewProps {
  group: Group;
  students: User[];
  /** Zmienia się po zapisie lekcji w AdminPanel — wtedy czytamy bez cache. */
  refreshKey: number;
  isNotebookLoading?: boolean;
  onBack: () => void;
  onOpenMember: (studentId: string) => void;
  onAddLesson: (group: Group) => void;
  onAddLessonFromTranscript: (group: Group) => void;
  onViewLesson: (record: LessonRecord) => void;
  onEditLesson: (record: LessonRecord) => void;
  onOpenNotebook: (group: Group) => void;
  onAssignHomework: (group: Group) => void;
}

function memberName(member: User | undefined): string {
  if (!member) return i18n.t('Nieznany kursant');
  return (
    `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
    member.displayName ||
    member.username ||
    i18n.t('Kursant')
  );
}

function formatLessonDate(date: string | undefined): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const GroupDetailView: React.FC<GroupDetailViewProps> = ({
  group,
  students,
  refreshKey,
  isNotebookLoading = false,
  onBack,
  onOpenMember,
  onAddLesson,
  onAddLessonFromTranscript,
  onViewLesson,
  onEditLesson,
  onOpenNotebook,
  onAssignHomework,
}) => {
  const [entries, setEntries] = useState<GroupLessonEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isArchived = group.status === 'archived';
  const memberIds = group.memberProfileIds || [];
  const memberKey = memberIds.join('|');

  const studentsById = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => {
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [students]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    const forceRefresh = refreshKey > 0;
    let failedCount = 0;
    Promise.all(
      memberIds.map((id) =>
        getLessonRecordsForStudent(id, forceRefresh)
          // Starsze kopie mogą nie mieć `studentId` — kursanta znamy z miejsca odczytu.
          .then((records) => records.map((r) => ({ ...r, studentId: r.studentId || id })))
          .catch((err) => {
            failedCount += 1;
            console.warn(`[GroupDetailView] Błąd odczytu lekcji kursanta ${id}:`, err);
            return [] as LessonRecord[];
          })
      )
    ).then((perMember) => {
      if (cancelled) return;
      setEntries(mergeGroupLessonCopies(perMember.flat(), group.id));
      if (failedCount > 0) {
        setLoadError(i18n.t('Nie udało się odczytać lekcji części kursantów — historia może być niepełna.'));
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // memberKey zamiast tablicy — ta sama lista członków nie powinna czytać od nowa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, memberKey, refreshKey]);

  return (
    <div className="max-w-[1640px] mx-auto px-3 sm:px-6 lg:px-8 pt-1">
      <div className="flex flex-col lg:flex-row items-start gap-5 sm:gap-6">
        {/* LEWA KOLUMNA — karta grupy i wejścia */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
          <div className="rounded-2xl border border-line-strong bg-base-200/80 shadow-ambient-sm overflow-hidden">
            <div className="px-4 py-3.5 bg-gradient-to-r from-primary/15 via-base-100/40 to-transparent border-b border-line-strong flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
                {i18n.t('Grupa')} · {group.level}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  isArchived
                    ? 'bg-line-soft text-content-muted border-line-strong'
                    : 'bg-primary/10 text-primary border-primary/25'
                }`}
              >
                {isArchived ? i18n.t('Zarchiwizowana') : i18n.t('Aktywna')}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/12 border border-primary/30 text-primary">
                  <Users size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-text-hi truncate">{group.name}</h2>
                  {group.company && (
                    <p className="text-xs text-content-muted truncate">
                      {i18n.t('Firma')}: {group.company}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-line-strong/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                  {i18n.t('Kursanci')} ({memberIds.length})
                </p>
                {memberIds.length === 0 ? (
                  <p className="text-xs text-content-muted">{i18n.t('Grupa nie ma jeszcze członków.')}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {memberIds.map((id) => {
                      const member = studentsById.get(id);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => onOpenMember(id)}
                            disabled={!member}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-text-hi hover:bg-line-soft hover:text-primary transition-colors cursor-pointer disabled:cursor-default disabled:text-content-muted disabled:hover:bg-transparent"
                            title={member ? i18n.t('Otwórz kartę kursanta') : undefined}
                          >
                            <span className="truncate">{memberName(member)}</span>
                            {member && <ChevronRight size={13} className="shrink-0 text-content-muted" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="pt-2 border-t border-line-strong/60">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full py-2 px-3 rounded-xl border border-line-strong bg-base-100/60 hover:bg-base-100 text-content-muted hover:text-text-hi hover:border-primary/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>{i18n.t('Wróć do bazy kursantów')}</span>
                </button>
              </div>
            </div>
          </div>

          <nav aria-label={i18n.t('Nawigacja grupy')} className="space-y-2">
            {[
              {
                id: 'notebook',
                label: i18n.t('Notatnik lekcyjny (A4)'),
                desc: i18n.t('Wspólny notatnik grupy'),
                icon: isNotebookLoading ? Loader2 : FileEdit,
                spin: isNotebookLoading,
                disabled: isArchived || isNotebookLoading,
                onClick: () => onOpenNotebook(group),
              },
              {
                id: 'homework',
                label: i18n.t('Prace domowe'),
                desc: i18n.t('Zadaj pracę całej grupie'),
                icon: ClipboardList,
                spin: false,
                disabled: isArchived,
                onClick: () => onAssignHomework(group),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className="w-full p-3.5 rounded-2xl border border-line-strong bg-base-200/60 text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 group hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-base-100/50 text-primary">
                      <Icon size={18} className={item.spin ? 'animate-spin' : ''} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs sm:text-sm font-extrabold truncate text-text-hi group-hover:text-primary transition-colors">
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-content-muted truncate mt-0.5">{item.desc}</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-content-muted shrink-0 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* PRAWA KOLUMNA — historia lekcji grupy */}
        <main className="flex-1 min-w-0 w-full space-y-4">
          <StudentPanelSection
            title={i18n.t('Historia lekcji grupy')}
            subtitle={i18n.t('Lekcje zapisane z wybraną grupą — jeden wpis na lekcję')}
            icon={<Clock size={16} />}
            count={entries.length}
            actions={
              <MenuDropdown
                align="end"
                width={292}
                aria-label={i18n.t('Dodaj lekcję grupy')}
                triggerTitle={i18n.t('Nowa lekcja z wybraną tą grupą i zaznaczonymi aktywnymi członkami')}
                triggerClassName={`px-3.5 py-2 rounded-xl bg-primary text-accent-ink text-xs sm:text-sm font-bold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-btn ${
                  isArchived ? 'opacity-50 pointer-events-none' : ''
                }`}
                trigger={
                  <>
                    <Plus size={15} />
                    <span>{i18n.t('Lekcja')}</span>
                    <ChevronDown size={13} />
                  </>
                }
                sections={[
                  {
                    id: 'add',
                    label: i18n.t('Dołóż lekcję'),
                    items: [
                      {
                        id: 'manual',
                        label: i18n.t('Wpis ręczny'),
                        description: i18n.t('Pusty formularz lekcji'),
                        icon: <Plus size={14} />,
                        disabled: isArchived,
                        onSelect: () => onAddLesson(group),
                      },
                      {
                        id: 'ai',
                        label: i18n.t('Z transkrypcji lub notatek (AI)'),
                        description: i18n.t('Wklej tekst albo wczytaj plik'),
                        icon: <Sparkles size={14} />,
                        disabled: isArchived,
                        onSelect: () => onAddLessonFromTranscript(group),
                      },
                    ],
                  },
                ]}
              />
            }
            toolbar={
              loadError ? <p className="text-[11px] font-semibold text-warn">{loadError}</p> : undefined
            }
          >
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 text-center">
                <BookOpen size={28} className="mx-auto mb-2 text-content-muted opacity-50" />
                <p className="text-sm font-semibold text-text-hi">{i18n.t('Brak lekcji tej grupy')}</p>
                <p className="text-xs text-content-muted mt-1 max-w-md mx-auto">
                  {i18n.t('Tu pojawiają się lekcje zapisane z wybraną grupą w formularzu lekcji. Starsze lekcje grupowe bez oznaczenia grupy zostają na kartach kursantów.')}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line-strong/60">
                {entries.map((entry) => {
                  const record = entry.representative;
                  const copyNames = entry.memberIds.map((id) => memberName(studentsById.get(id))).join(', ');
                  const missingCopies = entry.savedCopyCount - entry.copyCount;
                  const copiesTitle = missingCopies > 0
                    ? `${copyNames}\n${i18n.t('Pozostałe kopie leżą u kursantów spoza obecnego składu grupy.')}`
                    : copyNames;
                  return (
                    <li key={entry.groupLessonId} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onViewLesson(record)}
                        className="flex-1 min-w-0 text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-content-muted">
                            {formatLessonDate(record.date)}
                          </span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-line-soft text-content-muted border border-line-strong"
                            title={copiesTitle}
                          >
                            {i18n.t('Kopie')}: {entry.copyCount}
                            {missingCopies > 0 ? ` ${i18n.t('z')} ${entry.savedCopyCount}` : ''}
                          </span>
                          {entry.copiesDiffer && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/30"
                              title={i18n.t('Kopie tej lekcji były edytowane osobno — pokazana jest najnowsza.')}
                            >
                              {i18n.t('kopie się różnią')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-text-hi truncate mt-0.5 group-hover:text-primary transition-colors">
                          {record.topic || i18n.t('(bez tematu)')}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditLesson(record)}
                        className="p-2 rounded-lg border border-line-strong text-content-muted hover:text-text-hi hover:border-primary/40 transition-colors cursor-pointer shrink-0"
                        title={i18n.t('Edytuj tę kopię lekcji')}
                        aria-label={i18n.t('Edytuj tę kopię lekcji')}
                      >
                        <Edit2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </StudentPanelSection>
        </main>
      </div>
    </div>
  );
};

export default GroupDetailView;

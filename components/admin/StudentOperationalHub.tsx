import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  FileText,
  User,
  Mail,
  KeyRound,
  Lock,
  Globe,
  Copy,
  Check,
  Presentation,
  ClipboardList,
  Target,
  Briefcase,
  Building,
  GraduationCap,
  Layers,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Plus,
  Brain,
  RotateCcw
} from 'lucide-react';
import {
  StudentOperationalHubData,
  User as UserType,
  LessonRecord
} from '../../types';
import { fetchStudentHubContext } from '../../services/teacherCockpitService';
import PreLessonContext from './PreLessonContext';
import { openScratchpadTab } from '../../services/scratchpadService';
import { extractLessonBlocks } from '../../utils/lessonBlocks';
import { toPolishVocative } from '../../utils/polishVocative';
import { formatStudentFirstName } from '../../utils/studentFormat';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface StudentOperationalHubProps {
  studentId: string;
  cachedStudent?: UserType;
  currentUser?: UserType | null;
  onBack: () => void;
  onOpenPlanner: (studentId: string, lessonId?: string) => void;
  onOpenHistory: (studentId: string, lessonId?: string) => void;
  onOpenHomeworkModal?: (studentId: string) => void;
  onOpenRecall?: (studentId: string) => void;
  onEditContact?: () => void;
  onEditLevel?: () => void;
}

export const StudentOperationalHub: React.FC<StudentOperationalHubProps> = ({
  studentId,
  cachedStudent,
  currentUser,
  onBack,
  onOpenPlanner,
  onOpenHistory,
  onOpenHomeworkModal,
  onOpenRecall,
  onEditContact,
  onEditLevel,
}) => {
  const [hubData, setHubData] = useState<StudentOperationalHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'briefing' | 'lessons' | 'homework' | 'details'>('briefing');
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [briefingScope, setBriefingScope] = useState<1 | 2 | 3>(1);

  const teacherFirstName = formatStudentFirstName(currentUser, currentUser?.displayName || currentUser?.username, 'Maciej');
  const teacherVocative = toPolishVocative(teacherFirstName) || 'Macieju';

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchStudentHubContext(studentId, cachedStudent);
      setHubData(result);
    } catch (err) {
      console.error('[StudentOperationalHub] Błąd pobierania danych:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  const student = hubData?.student || (cachedStudent as any) || null;

  const fullName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.displayName || student.username
    : 'Profil kursanta';

  const initial = (student?.firstName || student?.username || '?')[0].toUpperCase();

  const handleCopyPassword = () => {
    if (!student?.tempPassword) return;
    navigator.clipboard.writeText(student.tempPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const isInviteSent = Boolean(student?.invitationSent || student?.lastInviteSentAt);
  const isAccountActivated = Boolean(student?.isActivated || (student?.loginCount && student.loginCount > 0));

  if (loading && !hubData) {
    return (
      <div className="w-full max-w-7xl mx-auto p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-text-hi">Wczytuję kompletny kontekst kursanta…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="w-full max-w-7xl mx-auto p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-danger mx-auto" />
        <h2 className="text-lg font-bold text-text-hi">Nie znaleziono kursanta</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-base-200 border border-line-strong text-xs font-bold cursor-pointer"
        >
          Wróć do listy
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-28">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl border border-line-strong bg-base-200/80 hover:bg-base-200 text-content-muted hover:text-text-hi text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <ArrowLeft size={15} />
          <span>Wróć do kokpitu</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-line-strong bg-base-200/80 hover:bg-base-200 text-content-muted hover:text-text-hi transition-colors cursor-pointer"
            title="Odśwież profil kursanta"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Main Profile & Operational Header ── */}
      <div className="rounded-3xl border border-line-strong bg-gradient-to-br from-base-200/90 via-base-200/70 to-base-100/50 p-6 sm:p-7 shadow-ambient backdrop-blur-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/40 flex items-center justify-center font-black text-primary text-xl sm:text-2xl shrink-0 shadow-inner overflow-hidden">
              {student.photoURL ? (
                <img src={student.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-text-hi tracking-tight truncate">
                  {fullName}
                </h1>
                {student.level && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-primary/15 border border-primary/30 text-primary font-mono text-xs font-black">
                    {student.level}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-base-100 border border-line-strong text-[11px] font-bold text-content-muted">
                  @{student.username}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
                {student.company && (
                  <span className="inline-flex items-center gap-1 text-content">
                    <Building size={12} className="text-primary" />
                    <span>{student.company}</span>
                  </span>
                )}
                {student.lessonType && (
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap size={12} className="text-primary" />
                    <span>{student.lessonType === 'Group' ? 'Zajęcia grupowe' : 'Zajęcia indywidualne'}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-mono">
                  <Mail size={12} className="text-content-muted" />
                  <span>{student.email}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ── Główny Pasek Działań (Action Bar) ── */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onOpenPlanner(studentId)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary-focus hover:from-primary-focus hover:to-primary text-accent-ink font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Sparkles size={17} />
              <span>✨ Przygotuj kolejną lekcję</span>
            </button>

            <button
              onClick={() => openScratchpadTab(studentId)}
              className="px-4 py-3 rounded-2xl border border-line-strong bg-base-100 hover:bg-base-300 text-content font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
              title="Otwórz Wspólny Notatnik na żywo"
            >
              <Presentation size={16} className="text-primary" />
              <span>Prowadź lekcję</span>
            </button>

            {onOpenRecall && (
              <button
                onClick={() => onOpenRecall(studentId)}
                className="px-4 py-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-500/10"
                title="Przejdź do sesji Spaced Repetition kursanta"
              >
                <Brain size={16} className="text-indigo-400" />
                <span>Rozpocznij dzisiejszy Recall</span>
              </button>
            )}

            {onOpenHomeworkModal && (
              <button
                onClick={() => onOpenHomeworkModal(studentId)}
                className="px-4 py-3 rounded-2xl border border-line-strong bg-base-100 hover:bg-base-300 text-content font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                title="Zadaj pracę domową"
              >
                <ClipboardList size={16} className="text-primary" />
                <span>Zadaj pracę</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Status Paska Konta i Bezpieczeństwa ── */}
        <div className="p-3.5 rounded-2xl bg-base-100/50 border border-line-strong flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {student.tempPassword ? (
              <button
                onClick={handleCopyPassword}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-warn/15 text-warn border border-warn/30 hover:bg-warn/25 font-mono text-[11px] font-bold transition-colors cursor-pointer"
                title="Kopiuj hasło startowe kursanta"
              >
                {copiedPassword ? <Check size={12} className="text-emerald-400" /> : <KeyRound size={12} />}
                <span>{copiedPassword ? `Skopiowano: ${student.tempPassword}` : 'Kopiuj hasło startowe'}</span>
                {!copiedPassword && <Copy size={11} className="opacity-70" />}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-semibold text-[11px]">
                <Lock size={12} />
                <span>Hasło własne kursanta</span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                isInviteSent
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
              }`}
            >
              {isInviteSent ? <CheckCircle2 size={12} /> : <Clock size={12} />}
              <span>{isInviteSent ? 'Zaproszenie wysłane' : 'Zaproszenie nie wysłane'}</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                isAccountActivated
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-base-200 text-content-muted border-line-strong'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAccountActivated ? 'bg-emerald-400' : 'bg-content-muted/40'}`} />
              <span>{isAccountActivated ? 'Konto aktywowane' : 'Oczekuje na 1. logowanie'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-content-muted">
            <span>Logowań: <strong className="text-text-hi font-mono">{student.loginCount || 0}</strong></span>
            <span>·</span>
            <span>Ost. logowanie: <strong className="text-text-hi font-mono">{student.lastLoginDate ? new Date(student.lastLoginDate).toLocaleDateString('pl-PL') : 'Nigdy'}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-line-strong pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('briefing')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'briefing'
              ? 'bg-primary text-accent-ink shadow-sm'
              : 'text-content-muted hover:text-text-hi hover:bg-base-200'
          }`}
        >
          <Target size={15} />
          <span>Briefing & Słabe punkty</span>
        </button>

        <button
          onClick={() => setActiveTab('lessons')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'lessons'
              ? 'bg-primary text-accent-ink shadow-sm'
              : 'text-content-muted hover:text-text-hi hover:bg-base-200'
          }`}
        >
          <Calendar size={15} />
          <span>Ostatnie lekcje & tematy ({hubData?.lastLessons?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('homework')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'homework'
              ? 'bg-primary text-accent-ink shadow-sm'
              : 'text-content-muted hover:text-text-hi hover:bg-base-200'
          }`}
        >
          <ClipboardList size={15} />
          <span>Prace domowe & Recall ({hubData?.currentTasks?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'details'
              ? 'bg-primary text-accent-ink shadow-sm'
              : 'text-content-muted hover:text-text-hi hover:bg-base-200'
          }`}
        >
          <BookOpen size={15} />
          <span>Cele & Profil kursanta</span>
        </button>
      </div>

      {/* ── Tab 1: Briefing Przedlekcyjny & Odprawa ── */}
      {activeTab === 'briefing' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-base-200/70 border border-line-strong backdrop-blur-md">
            <PreLessonContext
              studentId={studentId}
              studentName={formatStudentFirstName(student, fullName, 'Kursant')}
              teacherName={teacherVocative}
              scope={briefingScope}
              onScopeChange={setBriefingScope}
              lessonRecords={hubData?.lastLessons || []}
              onOpenHistory={() => setActiveTab('lessons')}
            />
          </div>
        </div>
      )}

      {/* ── Tab 2: Oś Czasu Ostatnich Lekcji & Tematów ── */}
      {activeTab === 'lessons' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-text-hi">Rejestr ostatnich lekcji i tematów</h2>
              <p className="text-xs text-content-muted">Przeglądaj historię spotkań, poruszone zagadnienia i słownictwo bez potrzeby wchodzenia do Notion.</p>
            </div>

            <button
              onClick={() => onOpenPlanner(studentId)}
              className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-focus text-accent-ink text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Nowa lekcja</span>
            </button>
          </div>

          {(hubData?.lastLessons?.length || 0) === 0 ? (
            <div className="p-8 rounded-2xl bg-base-200/40 border border-line-strong text-center text-xs text-content-muted">
              Brak zapisanych lekcji dla tego kursanta.
            </div>
          ) : (
            <div className="space-y-4">
              {(hubData?.lastLessons || []).map((lesson, idx) => {
                const blocks = extractLessonBlocks(lesson);
                return (
                  <div
                    key={lesson.id}
                    className="rounded-2xl border border-line-strong bg-base-200/60 p-5 space-y-4 hover:border-line-soft transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-base-100 border border-line-strong flex items-center justify-center font-mono text-xs font-bold text-primary">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-content-muted">{lesson.date}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-base-100 text-content-muted border border-line-strong">
                              {lesson.source === 'live_transcript' ? 'Transkrypcja' : 'Notion / Manual'}
                            </span>
                          </div>
                          <h3 className="text-base font-extrabold text-text-hi mt-0.5">{lesson.topic}</h3>
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenHistory(studentId, lesson.id)}
                        className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100 hover:bg-base-300 text-xs font-bold text-content transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                      >
                        <span>Szczegóły & Edycja</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>

                    {/* 4 Bloki w zwięzłym podglądzie */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-line-soft text-xs">
                      <div className="p-3 rounded-xl bg-base-100/40 border border-line-soft space-y-1">
                        <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">1. Podsumowanie / Wypowiedzi</span>
                        <p className="text-content-muted line-clamp-3">{blocks.summary || lesson.studentSpeaking || 'Brak wpisu'}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-base-100/40 border border-line-soft space-y-1">
                        <span className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider block">2. Słownictwo & Frazy</span>
                        <p className="text-content-muted line-clamp-3">{blocks.vocabulary || lesson.vocabularyText || 'Brak wpisu'}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-base-100/40 border border-line-soft space-y-1">
                        <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider block">3. Błędy & Korekty</span>
                        <p className="text-content-muted line-clamp-3">{blocks.corrections || lesson.thingsToImprove || 'Brak wpisu'}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-base-100/40 border border-line-soft space-y-1">
                        <span className="font-bold text-sky-400 uppercase text-[10px] tracking-wider block">4. Praca domowa & Plan</span>
                        <p className="text-content-muted line-clamp-3">{blocks.homework || lesson.nextLessonPlan || 'Brak wpisu'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Prace Domowe & Stan Recall ── */}
      {activeTab === 'homework' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lewa kolumna: Zadania domowe */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-text-hi flex items-center gap-2">
                  <ClipboardList size={17} className="text-primary" />
                  <span>Zadania domowe kursanta</span>
                </h2>
                {onOpenHomeworkModal && (
                  <button
                    onClick={() => onOpenHomeworkModal(studentId)}
                    className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-focus text-accent-ink text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Zadaj nowe ćwiczenie</span>
                  </button>
                )}
              </div>

              {(hubData?.currentTasks?.length || 0) === 0 ? (
                <div className="p-8 rounded-2xl bg-base-200/40 border border-line-strong text-center text-xs text-content-muted">
                  Brak przypisanych zadań domowych dla tego kursanta.
                </div>
              ) : (
                <div className="space-y-3">
                  {(hubData?.currentTasks || []).map(task => (
                    <div
                      key={task.id}
                      className="p-4 rounded-2xl bg-base-200/60 border border-line-strong flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              task.status === 'completed' || task.status === 'graded'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : task.status === 'submitted'
                                ? 'bg-sky-500/15 text-sky-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {task.status === 'completed' || task.status === 'graded'
                              ? 'Ocenione'
                              : task.status === 'submitted'
                              ? 'Nadesłane do sprawdzenia'
                              : 'W toku'}
                          </span>
                          {task.dueDate && (
                            <span className="text-[11px] text-content-muted font-mono">Termin: {task.dueDate}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-text-hi">{task.title}</h4>
                      </div>

                      {task.score !== undefined && (
                        <div className="px-3 py-1 rounded-xl bg-base-100 border border-line-strong font-mono text-xs font-bold text-primary shrink-0">
                          {task.score} pkt
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prawa kolumna: Recall & Pamięć słownictwa */}
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-text-hi flex items-center gap-2">
                <BookOpen size={17} className="text-primary" />
                <span>Stan bazy Recall (SRS)</span>
              </h2>

              <div className="p-5 rounded-2xl bg-base-200/60 border border-line-strong space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-content-muted font-semibold">Słówka w bazie</span>
                    <span className="font-mono font-bold text-text-hi">{hubData?.recallStats?.totalWords || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold">Opanowane</span>
                    <span className="font-mono font-bold text-emerald-300">{hubData?.recallStats?.masteredWords || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-semibold">W trakcie powtórek</span>
                    <span className="font-mono font-bold text-amber-300">{hubData?.recallStats?.learningWords || 0}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-line-soft">
                  <p className="text-[11px] text-content-muted leading-relaxed">
                    Słówka wprowadzone podczas zamykania lekcji trafiają do inteligentnego algorytmu powtórek w aplikacji kursanta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Cele & Profil Kursanta ── */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-base-200/60 border border-line-strong space-y-4">
              <h3 className="text-base font-extrabold text-text-hi flex items-center gap-2">
                <Target size={16} className="text-primary" />
                <span>Cele językowe & Kontekst</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-content-muted font-bold block mb-1">Główny cel kursanta:</span>
                  <p className="p-3 rounded-xl bg-base-100/60 border border-line-soft text-content leading-relaxed">
                    {student.goals || student.description || 'Brak sprecyzowanego celu. Możesz go uzupełnić w panelu edycji kursanta.'}
                  </p>
                </div>

                <div>
                  <span className="text-content-muted font-bold block mb-1">Branża / Stanowisko:</span>
                  <p className="p-3 rounded-xl bg-base-100/60 border border-line-soft text-content leading-relaxed">
                    {student.industry || student.company || 'Nie określono'}
                  </p>
                </div>

                <div>
                  <span className="text-content-muted font-bold block mb-1">Notatki lektora (Insights):</span>
                  <p className="p-3 rounded-xl bg-base-100/60 border border-line-soft text-content leading-relaxed">
                    {student.studentInsights || 'Brak dodatkowych notatek pedagogicznych.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-base-200/60 border border-line-strong space-y-4">
              <h3 className="text-base font-extrabold text-text-hi flex items-center gap-2">
                <Briefcase size={16} className="text-primary" />
                <span>Ustawienia organizacyjne</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-100/60 border border-line-soft">
                  <span className="text-content-muted font-semibold">Poziom CEFR:</span>
                  <span className="font-bold text-primary font-mono">{student.level || 'Brak'}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-base-100/60 border border-line-soft">
                  <span className="text-content-muted font-semibold">Status współpracy:</span>
                  <span className="font-bold text-text-hi">{student.statusWspolpracy || 'Aktywny'}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-base-100/60 border border-line-soft">
                  <span className="text-content-muted font-semibold">Format zajęć:</span>
                  <span className="font-bold text-text-hi">{student.lessonType || 'Indywidualne'}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-base-100/60 border border-line-soft">
                  <span className="text-content-muted font-semibold">Powiadomienia e-mail:</span>
                  <span className="font-bold text-text-hi">{student.emailNotificationsDisabled ? 'Wyłączone' : 'Włączone (Resend)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentOperationalHub;

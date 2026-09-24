import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Sparkles,
  X,
  Plus,
  History,
  Trash2,
  BookOpen,
  FileText,
  ClipboardList,
  Mail,
  User,
  ChevronRight,
  Copy,
  Check,
  Paperclip,
  FileCode,
  FileText as PdfIcon,
  Airplay,
  CheckCircle2,
  ArrowRight,
  ArrowUp,
  Users,
  Calendar,
  Zap,
  AtSign,
  Command,
  Volume2,
  ShieldCheck,
  RotateCcw,
  HelpCircle,
  Globe,
} from 'lucide-react';
import {
  askTeacherAssistant,
  buildStudentIndex,
  AssistantMessage,
  StudentIndexEntry,
  AssistantAction,
  ChatSession,
  LessonDraftProposal,
  ASSISTANT_SKILLS,
  AssistantSkill,
  AIAssistantMode,
  StudentsImportProposal,
  HtmlReportProposal,
  WebGroundingSource,
  ScenarioToolResult,
} from '../../services/teacherAssistant';
import { LessonAttachment, GeneratedLessonScenario } from '../../types';
import { saveGeneratedScenario } from '../../services/scenarioService';
import { ScenarioModuleCard } from './ScenarioModuleCard';
import { AIAssistantIcon } from '../ui/AIAssistantIcon';
import { useAuth } from '../../context/AuthContext';
import { toPolishVocative } from '../../utils/polishVocative';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { exportHtmlToPDF } from '../../utils/pdfExport';
import { invalidateUsersCache } from '../../services/userService';
import Markdown from 'react-markdown';

const STORAGE_KEY = 'cribro_teacher_assistant_sessions_v1';
const MODE_STORAGE_KEY = 'cribro_teacher_assistant_mode_v1';

/** Szybkie follow-up chips w trakcie aktywnej rozmowy */
const QUICK_FOLLOWUPS = [
  'Przygotuj dla niego zestaw 5 zdań do tłumaczenia',
  'Zaproponuj zadanie domowe z tego tematu',
  'Utwórz konspekt do Prezentacji Live',
  'Podsumuj słownictwo w 4 blokach Notion',
];

/**
 * Karta interaktywna do importu kursantów z poziomu czatu
 */
interface BulkStudentImportCardProps {
  studentsImport: StudentsImportProposal;
  isAdmin: boolean;
  onRefreshUsers: () => void;
}

const BulkStudentImportCard: React.FC<BulkStudentImportCardProps> = ({
  studentsImport,
  isAdmin,
  onRefreshUsers,
}) => {
  const { bulkImportUsers } = useFirebaseAdminApi();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    existing: number;
    failed: number;
    results: Array<{ username: string; email: string; password?: string; status: string; error?: string }>;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleExecuteImport = async () => {
    if (!isAdmin) {
      setErrorMsg('Operacja dodawania kursantów do CRM wymaga uprawnień administratora.');
      return;
    }
    setIsImporting(true);
    setErrorMsg('');
    try {
      const data = await bulkImportUsers(studentsImport.students);
      setImportResult(data);
      invalidateUsersCache();
      onRefreshUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Wystąpił błąd podczas importu kursantów.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!importResult?.results) return;
    const credsText = importResult.results
      .map(r => `Kursant: ${r.username}\nLogin/Email: ${r.email}\nHasło: ${r.password || '(bez zmian)'}\nStatus: ${r.status}`)
      .join('\n-------------------\n');
    navigator.clipboard.writeText(credsText);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-base-100/90 border border-primary/40 text-xs space-y-3 shadow-ambient-sm">
      <div className="flex items-center justify-between border-b border-line pb-2 flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <Users size={14} className="text-primary" />
          <span className="uppercase tracking-wider text-[10px] font-mono">
            Import Kursantów do Bazy CRM
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono font-bold border border-primary/30">
            {studentsImport.students.length} {studentsImport.students.length === 1 ? 'kursant' : 'kursantów'}
          </span>
          {isAdmin ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30 font-mono font-semibold">
              Admin OK
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 font-mono font-semibold">
              Wymaga Admina
            </span>
          )}
        </div>
      </div>

      <p className="text-text-2 text-[11px] leading-relaxed">
        {studentsImport.summary || 'Zweryfikuj listę osób poniżej i zatwierdź utworzenie kont w systemie:'}
      </p>

      {/* Tabela / Lista kursantów */}
      <div className="overflow-x-auto rounded-xl border border-line bg-base-200/50">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-line bg-base-300/40 text-text-mute font-mono text-[9px] uppercase">
              <th className="p-2">Imię i Nazwisko / Login</th>
              <th className="p-2">E-mail</th>
              <th className="p-2">Poziom</th>
              <th className="p-2">Firma / Grupa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {studentsImport.students.map((st, sIdx) => (
              <tr key={sIdx} className="hover:bg-base-100/50 transition-colors">
                <td className="p-2 font-semibold text-text-hi">
                  {`${st.firstName || ''} ${st.lastName || ''}`.trim() || st.username || 'Kursant'}
                </td>
                <td className="p-2 text-text-2 font-mono text-[10px]">
                  {st.email || <span className="text-text-mute italic">auto-generowany</span>}
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 rounded bg-base-100 text-text font-mono font-bold border border-line text-[9px]">
                    {st.level || 'A2-B1'}
                  </span>
                </td>
                <td className="p-2 text-text-2">
                  {st.company || <span className="text-text-mute">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errorMsg && (
        <div className="p-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-[11px]">
          {errorMsg}
        </div>
      )}

      {/* Raport po zaimportowaniu */}
      {importResult && (
        <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-text space-y-2">
          <div className="flex items-center justify-between text-success font-bold text-[11px]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Sukces: {importResult.created} utworzono, {importResult.existing} zaktualizowano ({importResult.failed} błędów)
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCredentials}
            className="w-full py-1.5 px-3 rounded-lg bg-base-100 border border-line hover:border-primary/50 text-text-hi font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedCreds ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
            <span>{copiedCreds ? 'Skopiowano dane logowania do schowka!' : 'Kopiuj listę loginów i haseł'}</span>
          </button>
        </div>
      )}

      {/* Przycisk akcji importu */}
      {!importResult && (
        <div className="pt-1">
          {isAdmin ? (
            <button
              type="button"
              disabled={isImporting}
              onClick={handleExecuteImport}
              className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Tworzenie kont w bazie CRM...</span>
                </>
              ) : (
                <>
                  <Plus size={13} />
                  <span>Zatwierdź i dodaj {studentsImport.students.length} kursantów do CRM</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-base-200 border border-line text-text-mute text-center text-[11px]">
              🔒 Opcja dodawania kursantów jest aktywna wyłącznie dla konta administratora.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Karta interaktywna dla wygenerowanego raportu HTML z eksportem do PDF
 */
interface HtmlReportCardProps {
  htmlReport: HtmlReportProposal;
}

const HtmlReportCard: React.FC<HtmlReportCardProps> = ({ htmlReport }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportHtmlToPDF(htmlReport.html, htmlReport.title);
    } catch (err) {
      console.error('Błąd generowania PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(htmlReport.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlReport.title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#0f172a;line-height:1.6;}table{width:100%;border-collapse:collapse;margin:16px 0;}th,td{border:1px solid #cbd5e1;padding:8px 12px;}th{background:#f1f5f9;}</style></head><body>${htmlReport.html}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-base-100/90 border border-primary/40 text-xs space-y-3 shadow-ambient-sm">
      <div className="flex items-center justify-between border-b border-line pb-2 flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <PdfIcon size={14} className="text-primary" />
          <span className="uppercase tracking-wider text-[10px] font-mono">
            Dokument HTML & Raport PDF
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono font-bold border border-primary/30">
            Format A4
          </span>
        </div>
      </div>

      <div className="font-extrabold text-sm text-text-hi">
        {htmlReport.title}
      </div>

      <p className="text-text-2 text-[11px] leading-relaxed">
        {htmlReport.summary || 'Wygenerowano sformatowany dokument gotowy do druku i eksportu.'}
      </p>

      {/* Przyciski akcji */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={isExportingPdf}
          onClick={handleDownloadPdf}
          className="flex-1 min-w-[140px] py-1.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {isExportingPdf ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Generowanie PDF...</span>
            </>
          ) : (
            <>
              <PdfIcon size={12} />
              <span>Pobierz plik PDF</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsPreviewOpen(!isPreviewOpen)}
          className="py-1.5 px-3 rounded-xl bg-base-200 hover:bg-base-300 border border-line text-text-hi font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileText size={12} />
          <span>{isPreviewOpen ? 'Zwiń podgląd' : 'Podgląd HTML'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyHtml}
          className="py-1.5 px-3 rounded-xl bg-base-200 hover:bg-base-300 border border-line text-text-hi font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Kopiuj surowy kod HTML"
        >
          {copiedHtml ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
          <span>{copiedHtml ? 'Skopiowano' : 'Kopiuj HTML'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenInNewTab}
          className="p-1.5 rounded-xl bg-base-200 hover:bg-base-300 border border-line text-text-mute hover:text-text-hi transition-colors cursor-pointer"
          title="Otwórz w nowej karcie"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Rozwijany podgląd HTML */}
      {isPreviewOpen && (
        <div className="mt-3 p-4 rounded-xl border border-line bg-white text-slate-900 overflow-x-auto max-h-[380px] overflow-y-auto shadow-inner text-[13px] leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: htmlReport.html }} />
        </div>
      )}
    </div>
  );
};

/**
 * Kompaktowy, tylko-do-odczytu podgląd scenariusza lekcji 2.0 wygenerowanego
 * przez tool czatu `generate_lesson_scenario`. Granica MVP: sam podgląd +
 * link do profilu kursanta, bez automatycznego zapisu do lekcji.
 */
interface ScenarioToolResultCardProps {
  result: ScenarioToolResult;
  onOpenProfile: () => void;
}

const ScenarioToolResultCard: React.FC<ScenarioToolResultCardProps> = ({ result, onOpenProfile }) => {
  const { scenario, studentName } = result;
  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-950/15 overflow-hidden shadow-sm">
      <div className="p-3 bg-gradient-to-r from-violet-900/40 via-violet-950/30 to-transparent flex items-center justify-between gap-2 border-b border-violet-500/15 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-300" />
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
            Scenariusz 2.0
          </span>
          <span className="text-[11px] font-bold text-violet-100">@{studentName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-base-200 text-text-mute font-mono border border-line">
            {scenario.durationMin} min
          </span>
          {scenario.mode === 'cold_start' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono border border-amber-500/30">
              diagnostyczny
            </span>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        {scenario.modules.map((mod) => (
          <ScenarioModuleCard key={mod.moduleId} module={mod} readOnly />
        ))}
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-200 hover:bg-base-200/90 text-text-hi border border-line-strong font-bold text-[11px] transition-all hover:scale-[1.02] cursor-pointer"
          >
            <User size={12} className="text-primary" />
            <span>Przejdź do profilu kursanta</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Lista źródeł internetowych
 */
interface WebSourcesListProps {
  sources: WebGroundingSource[];
}

const WebSourcesList: React.FC<WebSourcesListProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="pt-2 border-t border-line/60 space-y-1.5">
      <div className="text-[10px] font-mono uppercase text-text-mute flex items-center gap-1">
        <Globe size={11} className="text-primary" /> Źródła i materiały z sieci:
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, sIdx) => (
          <a
            key={sIdx}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base-100 hover:bg-base-200 border border-line text-[11px] text-text-hi hover:text-primary transition-colors truncate max-w-[280px]"
          >
            <span className="truncate">{s.title || s.url}</span>
            <ChevronRight size={10} className="text-text-mute shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
};

interface TeacherAssistantProps {
  /** Tryb wyświetlania: 'embedded' (centralny panel na stronie głównej) lub 'floating' (dymek w lewym dolnym rogu) */
  mode?: 'floating' | 'embedded';
  /** Czy całkowicie ukryć pływający dymek (np. gdy jesteśmy na stronie głównej z embedded chatem) */
  hidden?: boolean;
  onNavigateToModule?: (module: string, extra?: any) => void;
  onSelectStudent?: (studentId: string) => void;
  onCreateLessonRecord?: (lessonData: LessonDraftProposal) => void;
  onOpenInPresentation?: (scenarioData: any, studentId?: string, studentName?: string) => void;
  className?: string;
}

export const TeacherAssistant: React.FC<TeacherAssistantProps> = ({
  mode = 'floating',
  hidden = false,
  onNavigateToModule,
  onSelectStudent,
  onCreateLessonRecord,
  onOpenInPresentation,
  className = '',
}) => {
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(mode === 'embedded');
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat');
  const [index, setIndex] = useState<StudentIndexEntry[] | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<LessonAttachment[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [aiMode, setAiMode] = useState<AIAssistantMode>(() => {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      return (saved === 'thinking' ? 'thinking' : 'flash') as AIAssistantMode;
    } catch {
      return 'flash';
    }
  });

  const handleToggleMode = (newMode: AIAssistantMode) => {
    setAiMode(newMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {}
  };

  // Autouzupełnianie @ oraz /
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const floatingFileInputRef = useRef<HTMLInputElement>(null);

  // Pobranie imienia lektora do powitania w wołaczu (np. "Macieju", "Anno")
  const teacherFirstName = useMemo(() => {
    const raw = currentUser?.firstName || currentUser?.displayName || currentUser?.name || currentUser?.username || 'Maciej';
    return toPolishVocative(raw) || 'Macieju';
  }, [currentUser]);

  // Zapis sesji w LocalStorage
  const saveSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions.slice(0, 20)));
    } catch {}
  };

  /* Spis kursantów budujemy przy pierwszym wejściu */
  useEffect(() => {
    if (index) return;
    if (mode === 'embedded' || isOpen) {
      buildStudentIndex()
        .then(setIndex)
        .catch((err) => {
          console.error('[Asystent] Spis kursantów:', err);
          setError('Nie udało się wczytać listy kursantów.');
        });
    }
  }, [mode, isOpen, index]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  // Automatyczne dopasowanie wysokości pola tekstowego
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [draft]);

  const isAdmin = currentUser?.role === 'admin';

  const refreshStudentIndex = useCallback(() => {
    buildStudentIndex()
      .then(setIndex)
      .catch((err) => console.warn('[Asystent] Odświeżenie indeksu kursantów:', err));
  }, []);

  // Filtrowanie kursantów dla menu @
  const filteredStudents = useMemo(() => {
    if (!index) return [];
    if (!mentionQuery.trim()) return index.slice(0, 8);
    const q = mentionQuery.toLowerCase().trim();
    return index
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.aliases.some((a) => a.toLowerCase().includes(q)) ||
          (s.company && s.company.toLowerCase().includes(q)) ||
          (s.level && s.level.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [index, mentionQuery]);

  // Filtrowanie skilli dla menu /
  const filteredSkills = useMemo(() => {
    const list = ASSISTANT_SKILLS.filter((s) => !s.adminOnly || isAdmin);
    if (!slashQuery.trim()) return list;
    const q = slashQuery.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.command.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [slashQuery, isAdmin]);

  // Sprawdzanie wyzwalaczy @ i / przy edycji tekstu
  const handleDraftChange = (newText: string, cursorPos: number) => {
    setDraft(newText);

    const textBeforeCursor = newText.slice(0, cursorPos);

    // Sprawdzenie wyzwalacza @ (np. @da lub @)
    const mentionMatch = textBeforeCursor.match(/@([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9_\-\.\s]*)$/);
    if (mentionMatch) {
      setShowMentionMenu(true);
      setMentionQuery(mentionMatch[1] || '');
      setActiveMentionIndex(0);
      setShowSlashMenu(false);
      return;
    } else {
      setShowMentionMenu(false);
    }

    // Sprawdzenie wyzwalacza / (np. /kon)
    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_\-]*)$/);
    if (slashMatch) {
      setShowSlashMenu(true);
      setSlashQuery(slashMatch[1] || '');
      setActiveSlashIndex(0);
      setShowMentionMenu(false);
      return;
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectStudentMention = (student: StudentIndexEntry) => {
    const cursorPos = textareaRef.current?.selectionStart ?? draft.length;
    const textBeforeCursor = draft.slice(0, cursorPos);
    const textAfterCursor = draft.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/@[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9_\-\.\s]*$/, `@${student.name} `);
    const newDraft = newBefore + textAfterCursor;

    setDraft(newDraft);
    setShowMentionMenu(false);
    setMentionQuery('');
    textareaRef.current?.focus();
  };

  const handleSelectSkillCommand = (skill: AssistantSkill) => {
    const cursorPos = textareaRef.current?.selectionStart ?? draft.length;
    const textBeforeCursor = draft.slice(0, cursorPos);
    const textAfterCursor = draft.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/(?:^|\s)\/[a-zA-Z0-9_\-]*$/, ` ${skill.template}`);
    const newDraft = newBefore.trimStart() + textAfterCursor;

    setDraft(newDraft);
    setShowSlashMenu(false);
    setSlashQuery('');
    textareaRef.current?.focus();
  };

  // Obsługa klawiatury dla menu @ i /
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredStudents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex((prev) => (prev + 1) % filteredStudents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex((prev) => (prev - 1 + filteredStudents.length) % filteredStudents.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredStudents[activeMentionIndex];
        if (selected) handleSelectStudentMention(selected);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false);
        return;
      }
    }

    if (showSlashMenu && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSlashIndex((prev) => (prev + 1) % filteredSkills.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSlashIndex((prev) => (prev - 1 + filteredSkills.length) % filteredSkills.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSkills[activeSlashIndex];
        if (selected) handleSelectSkillCommand(selected);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(draft);
    }
  };

  // Przetwarzanie plików przeciągniętych / dodanych
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const newAttachments: LessonAttachment[] = [];

    for (const file of fileArr) {
      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: 'image',
          mimeType: file.type,
          dataUrl,
          size: file.size,
        });
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: 'pdf',
          mimeType: 'application/pdf',
          dataUrl,
          size: file.size,
        });
      } else if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.csv')
      ) {
        const textContent = await file.text();
        newAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: 'text',
          mimeType: file.type || 'text/plain',
          textContent: textContent.slice(0, 15000),
          size: file.size,
        });
      } else {
        newAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: 'text',
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        });
      }
    }

    setPendingAttachments((prev) => [...prev, ...newAttachments].slice(0, 6));
  }, []);

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Obsługa schowka (Ctrl+V screenshot / obrazek)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const ask = async (userText: string) => {
    const trimmed = userText.trim();
    if ((!trimmed && pendingAttachments.length === 0) || isThinking) return;

    const currentAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    setDraft('');
    setShowMentionMenu(false);
    setShowSlashMenu(false);
    setError('');

    const userMessage: AssistantMessage = {
      role: 'user',
      text: trimmed || '(Przesłano załączniki do analizy)',
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsThinking(true);

    try {
      const resp = await askTeacherAssistant(
        trimmed,
        index || [],
        newMessages,
        currentAttachments,
        aiMode
      );

      const assistantMessage: AssistantMessage = {
        role: 'assistant',
        text: resp.text,
        actions: resp.actions,
        lessonDraft: resp.lessonDraft,
        lessonScenario: resp.lessonScenario,
        scenarioToolResult: resp.scenarioToolResult,
        followUpSuggestions: resp.followUpSuggestions,
        timestamp: Date.now(),
        modelUsed: resp.modelUsed,
        isCouncil: resp.isCouncil,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Aktualizacja historii sesji
      const sessionTitle =
        messages.length === 0
          ? trimmed.slice(0, 38) || (currentAttachments[0]?.name ? `Plik: ${currentAttachments[0].name}` : 'Nowa rozmowa')
          : sessions.find((s) => s.id === currentSessionId)?.title || 'Rozmowa';

      const updatedSessions = [
        {
          id: currentSessionId,
          title: sessionTitle,
          createdAt: Date.now(),
          messages: finalMessages,
        },
        ...sessions.filter((s) => s.id !== currentSessionId),
      ];
      saveSessions(updatedSessions);
    } catch (err: any) {
      console.error('[TeacherAssistant] Błąd odpowiedzi:', err);
      setError(err?.message || 'Wystąpił problem z połączeniem z Radą Modeli AI.');
    } finally {
      setIsThinking(false);
    }
  };

  // Załadowanie sesji z historii
  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    setViewMode('chat');
  };

  // Nowa czysta rozmowa
  const startNewSession = () => {
    setCurrentSessionId(`sess_${Date.now()}`);
    setMessages([]);
    setDraft('');
    setPendingAttachments([]);
    setError('');
    setViewMode('chat');
  };

  // Usunięcie sesji
  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    saveSessions(filtered);
    if (currentSessionId === sessionId) {
      startNewSession();
    }
  };

  // Kopiowanie treści
  const copyMessage = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  // Wykonanie akcji 1-klikowej
  const handleExecuteAction = (action: AssistantAction) => {
    if (action.type === 'insert_lesson' && action.lessonDraft) {
      if (onCreateLessonRecord) {
        onCreateLessonRecord(action.lessonDraft);
      } else if (onNavigateToModule) {
        onNavigateToModule('admin', {
          tab: 'lessons',
          userId: action.studentId,
          lessonDraft: action.lessonDraft,
        });
      }
    } else if (action.type === 'presentation') {
      if (onOpenInPresentation) {
        onOpenInPresentation(action.lessonScenario || action.lessonDraft, action.studentId, action.studentName);
      } else if (onNavigateToModule) {
        onNavigateToModule('presentation', {
          studentId: action.studentId,
          studentName: action.studentName,
          topic: action.topic,
          initialScenario: action.lessonScenario,
        });
      }
    } else if (action.type === 'profile' && action.studentId) {
      if (onSelectStudent) {
        onSelectStudent(action.studentId);
      } else if (onNavigateToModule) {
        onNavigateToModule('admin', { tab: 'profile', userId: action.studentId });
      }
    } else if (action.type === 'planner') {
      if (action.lessonScenario) {
        saveGeneratedScenario(action.lessonScenario).catch(console.warn);
      }
      if (onNavigateToModule) {
        onNavigateToModule('lesson-planner', {
          tab: 'lesson-planner',
          userId: action.studentId,
          studentId: action.studentId,
          initialScenario: action.lessonScenario,
        });
      }
    } else if (action.type === 'homework') {
      if (onNavigateToModule) {
        onNavigateToModule('homework', { userId: action.studentId });
      }
    } else if (action.type === 'mailing') {
      if (onNavigateToModule) {
        onNavigateToModule('mailing', { userId: action.studentId });
      }
    } else if (action.type === 'scratchpad') {
      if (onNavigateToModule) {
        onNavigateToModule('scratchpad', { userId: action.studentId });
      }
    } else if (action.type === 'html_pdf' && action.htmlReport) {
      exportHtmlToPDF(action.htmlReport.html, action.htmlReport.title).catch(console.warn);
    }
  };

  // Odsłuch syntezą mowy
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*#_`>~]/g, '')
      .trim();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 300));
    utterance.lang = 'pl-PL';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  /* ═══════════════════════════════════════════════════════════════════
     TRYB EMBEDDED — CENTRALNY CHAT SPÓJNY Z NOCTURNE GREEN
     ═══════════════════════════════════════════════════════════════════ */
  if (mode === 'embedded') {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          if (e.dataTransfer?.files) processFiles(e.dataTransfer.files);
        }}
        onPaste={handlePaste}
        className={`w-full max-w-4xl mx-auto flex flex-col relative transition-all ${className}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf,.txt,.md,.doc,.docx,.csv,.json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Drag & drop overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-ink-2/95 backdrop-blur-md border-2 border-dashed border-primary rounded-3xl flex flex-col items-center justify-center gap-2 p-6 text-center pointer-events-none shadow-ambient-lg">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary border border-primary/40 flex items-center justify-center animate-bounce shadow-[0_0_25px_rgba(114,240,180,0.3)]">
              <Paperclip size={26} />
            </div>
            <p className="text-base font-extrabold text-text-hi">Upuść pliki tutaj, aby dodać je do analizy AI</p>
            <p className="text-xs text-text-mute">Obsługuje screenshoty, zadania ze zdjęć, pliki PDF oraz dokumenty tekstowe</p>
          </div>
        )}

        {/* ─── 1. WIDOK POWITALNY (SUBTELNY, ELEGANCKI HERO) ─── */}
        {messages.length === 0 && viewMode === 'chat' && (
          <div className="flex flex-col items-center text-center space-y-2.5 py-6 sm:py-8 max-w-xl mx-auto animate-fadeIn">
            {/* Ambient Background Mint Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[85%] max-w-xl h-40 bg-gradient-to-b from-primary/10 via-accent/5 to-transparent blur-3xl pointer-events-none -z-10" />

            {/* Subtle Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-mono font-semibold">
              <Sparkles size={12} />
              <span>Asystent Lektora CRIBRO</span>
            </div>

            {/* Subtelny slogan */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-text-hi">
              W czym mogę dzisiaj pomóc, {teacherFirstName}?
            </h1>
            <p className="text-xs sm:text-sm text-text-3 max-w-md mx-auto leading-relaxed">
              Konspekty lekcji, zadania domowe, baza kursantów CRM i analiza materiałów.
            </p>
          </div>
        )}

        {/* ─── 2. WIDOK: STRUMIEŃ ROZMOWY / HISTORIA ─── */}
        {(messages.length > 0 || viewMode === 'history') && (
          <div className="w-full max-w-3xl mx-auto rounded-3xl border border-line-strong bg-ink-2/95 backdrop-blur-2xl shadow-ambient-lg overflow-hidden mb-3.5 flex flex-col">
            {/* Pasek górny rozmowy */}
            <header className="px-4 py-3 border-b border-line-strong flex items-center justify-between bg-base-200/60 backdrop-blur-md flex-wrap gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <AIAssistantIcon size="xs" variant="badge" state={isThinking ? 'thinking' : 'online'} glow={true} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-hi truncate">Asystent Lektora CRIBRO</span>
                    <span className="text-[9px] font-mono uppercase bg-base-100 text-text-2 border border-line px-2 py-0.5 rounded-full font-bold">
                      Rada AI & CRM
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
                  className={`px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'history'
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'border-line-strong bg-base-100/60 text-text-2 hover:text-text-hi hover:bg-base-100'
                  }`}
                  title={viewMode === 'history' ? 'Wróć do rozmowy' : 'Historia poprzednich sesji'}
                >
                  <History size={13} />
                  <span className="hidden sm:inline">Historia</span>
                  {sessions.length > 0 && <span className="text-[10px] font-mono opacity-70">({sessions.length})</span>}
                </button>

                <button
                  type="button"
                  onClick={startNewSession}
                  className="px-3 py-1 rounded-xl bg-primary text-accent-ink hover:bg-primary-hover text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(114,240,180,0.3)] hover:scale-[1.02]"
                  title="Rozpocznij nowy wątek"
                >
                  <Plus size={13} className="stroke-[3]" />
                  <span>Nowy czat</span>
                </button>
              </div>
            </header>

            {/* Widok: Historia sesji */}
            {viewMode === 'history' ? (
              <div className="p-4 max-h-[420px] overflow-y-auto space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-line">
                  <span className="text-xs font-bold text-text-mute uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <History size={13} className="text-primary" /> Zapisane wątki ({sessions.length})
                  </span>
                  <button
                    onClick={startNewSession}
                    className="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Nowa rozmowa
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <div className="text-center py-12 text-text-mute">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-30 text-text-mute" />
                    <p className="font-semibold text-xs text-text-hi">Brak wcześniejszych rozmów w historii.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => loadSession(s)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          currentSessionId === s.id
                            ? 'bg-primary/15 border-primary/50 text-text-hi shadow-[0_0_16px_rgba(114,240,180,0.15)]'
                            : 'bg-base-200/50 border-line text-text-2 hover:bg-base-200 hover:text-text-hi hover:border-line-strong'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-text-hi truncate">{s.title}</p>
                          <p className="text-[10px] text-text-mute mt-0.5 flex items-center gap-1.5 font-mono">
                            <span>{new Date(s.createdAt).toLocaleDateString('pl-PL')}</span>
                            <span>·</span>
                            <span>{s.messages?.length || 0} wiadomości</span>
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteSession(s.id, e)}
                          className="p-1.5 text-text-mute hover:text-danger rounded-lg hover:bg-base-100 transition-colors"
                          title="Usuń tę rozmowę"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Widok: Wiadomości czatu */
              <div
                ref={scrollRef}
                className="p-3.5 sm:p-5 max-h-[560px] overflow-y-auto scroll-smooth space-y-3.5"
              >
                {messages.map((message, idx) => (
                  <div key={idx} className="space-y-1.5 animate-fadeIn">
                    {/* Wiadomość użytkownika */}
                    {message.role === 'user' ? (
                      <div className="flex items-end justify-end gap-2 max-w-[92%] sm:max-w-[82%] ml-auto">
                        <div className="bg-base-200/90 border border-line-strong text-text-hi p-3 sm:p-3.5 rounded-2xl rounded-tr-xs shadow-sm space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-[9px] text-text-mute font-mono">
                            <span className="font-bold flex items-center gap-1 text-primary">
                              <User size={10} /> Lektor
                            </span>
                            {message.timestamp && (
                              <span className="opacity-70">
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {/* Załączniki w wiadomości lektora */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5 pb-0.5">
                              {message.attachments.map((att, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-base-100 border border-line text-[11px] font-mono"
                                >
                                  {att.type === 'image' && att.dataUrl ? (
                                    <img src={att.dataUrl} alt={att.name} className="w-5 h-5 rounded object-cover border border-line" />
                                  ) : att.type === 'pdf' ? (
                                    <PdfIcon size={12} className="text-danger" />
                                  ) : (
                                    <FileCode size={12} className="text-primary" />
                                  )}
                                  <span className="truncate max-w-[130px] text-text-hi font-sans text-[11px]">{att.name}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-text">
                            {message.text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Wiadomość asystenta AI */
                      <div className="flex items-start gap-2.5 max-w-[98%] sm:max-w-[92%] mr-auto">
                        <AIAssistantIcon size="xs" variant="avatar" state="online" glow={false} className="mt-1 shrink-0" />

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="bg-ink-2/95 border border-line-strong text-text p-3.5 sm:p-4 rounded-2xl rounded-tl-xs shadow-ambient-sm space-y-2.5">
                            <div className="flex items-center justify-between border-b border-line pb-1.5 text-[10px] text-text-mute font-mono flex-wrap gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-primary flex items-center gap-1">
                                  <Sparkles size={11} className="text-primary" /> CRIBRO AI
                                </span>
                                <span className="text-[8px] bg-base-100 text-text-2 border border-line px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-0.5">
                                  <ShieldCheck size={9} className="text-primary" /> {message.modelUsed || 'Rada Modeli AI'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 ml-auto">
                                {message.timestamp && (
                                  <span className="opacity-70">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => speakText(message.text)}
                                  className="p-1 hover:text-text-hi text-text-mute rounded transition-colors flex items-center gap-1 cursor-pointer text-[9px]"
                                  title="Odsłuchaj syntezę mowy"
                                >
                                  <Volume2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyMessage(idx, message.text)}
                                  className="p-1 hover:text-text-hi text-text-mute rounded transition-colors flex items-center gap-1 cursor-pointer text-[9px]"
                                  title="Kopiuj treść odpowiedzi"
                                >
                                  {copiedMsgIdx === idx ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
                                  <span>{copiedMsgIdx === idx ? 'Skopiowano' : 'Kopiuj'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Podgląd karty lekcji i scenariusza Notion AI */}
                            {(message.lessonScenario || message.lessonDraft) && (
                              <div className="p-3.5 rounded-2xl bg-base-100/70 border border-primary/35 text-xs space-y-2.5 shadow-ambient-sm">
                                <div className="flex items-center justify-between border-b border-line pb-2 flex-wrap gap-1.5">
                                  <div className="flex items-center gap-1.5 font-bold text-primary">
                                    <Sparkles size={13} className="text-primary" />
                                    <span className="uppercase tracking-wider text-[10px] font-mono">
                                      {message.lessonScenario ? 'Scenariusz Lekcji AI (Studio & Live)' : 'Karta Lekcji AI (Format 4 Bloków)'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {message.lessonScenario?.targetLevel && (
                                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-base-200 text-text font-mono font-bold border border-line">
                                        {message.lessonScenario.targetLevel}
                                      </span>
                                    )}
                                    {message.lessonScenario?.lessonDuration && (
                                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-base-200 text-text-mute font-mono border border-line">
                                        {message.lessonScenario.lessonDuration}
                                      </span>
                                    )}
                                    {(message.lessonDraft?.studentName || message.lessonScenario?.studentName) && (
                                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold border border-primary/30">
                                        @{message.lessonDraft?.studentName || message.lessonScenario?.studentName}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="font-extrabold text-sm text-text-hi">
                                  {message.lessonScenario?.topic || message.lessonDraft?.topic}
                                </div>

                                {(message.lessonScenario?.goal || message.lessonDraft?.summary) && (
                                  <div className="text-text-2 leading-relaxed text-[11px]">
                                    {message.lessonScenario?.goal || message.lessonDraft?.summary}
                                  </div>
                                )}

                                {/* Podgląd etapów scenariusza (Stages pipeline) */}
                                {message.lessonScenario?.stages && message.lessonScenario.stages.length > 0 && (
                                  <div className="space-y-1 pt-1">
                                    <span className="font-bold text-text-mute text-[10px] block uppercase tracking-wide font-mono">
                                      Etapy scenariusza ({message.lessonScenario.stages.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {message.lessonScenario.stages.map((st, sIdx) => (
                                        <div
                                          key={sIdx}
                                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-base-200/90 border border-line text-[10px] font-mono text-text"
                                        >
                                          <span className="text-primary font-bold">{sIdx + 1}.</span>
                                          <span className="truncate max-w-[150px] font-medium">{st.title.replace(/^\d+\.\s*/, '')}</span>
                                          {st.duration && <span className="text-text-mute text-[9px]">({st.duration})</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {message.lessonDraft?.vocabulary && (
                                  <div>
                                    <span className="font-bold text-text-mute text-[10px] block uppercase tracking-wide mb-0.5 font-mono">
                                      Kluczowe słownictwo:
                                    </span>
                                    <div className="text-text text-[11px] font-mono whitespace-pre-line bg-ink p-2.5 rounded-xl border border-line max-h-32 overflow-y-auto">
                                      {message.lessonDraft.vocabulary}
                                    </div>
                                  </div>
                                )}

                                {/* Szybkie przyciski bezpośredniego uruchomienia w narzędziach */}
                                <div className="pt-2 border-t border-line flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleExecuteAction({
                                        type: 'planner',
                                        label: 'Studio Planera',
                                        studentId: message.lessonDraft?.studentId || message.lessonScenario?.studentId || undefined,
                                        studentName: message.lessonDraft?.studentName || message.lessonScenario?.studentName || undefined,
                                        topic: message.lessonScenario?.topic || message.lessonDraft?.topic,
                                        lessonDraft: message.lessonDraft,
                                        lessonScenario: message.lessonScenario,
                                      })
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-accent-ink font-bold text-[11px] shadow-sm hover:scale-[1.02] transition-all cursor-pointer"
                                  >
                                    <BookOpen size={12} />
                                    <span>Otwórz w Studio Planera</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleExecuteAction({
                                        type: 'presentation',
                                        label: 'Prezentacja Live',
                                        studentId: message.lessonDraft?.studentId || message.lessonScenario?.studentId || undefined,
                                        studentName: message.lessonDraft?.studentName || message.lessonScenario?.studentName || undefined,
                                        topic: message.lessonScenario?.topic || message.lessonDraft?.topic,
                                        lessonDraft: message.lessonDraft,
                                        lessonScenario: message.lessonScenario,
                                      })
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-200 hover:bg-base-200/90 text-text-hi border border-line-strong font-bold text-[11px] transition-all hover:scale-[1.02] cursor-pointer"
                                  >
                                    <Airplay size={12} className="text-primary" />
                                    <span>Uruchom w Prezentacji Live</span>
                                  </button>

                                  {message.lessonDraft && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleExecuteAction({
                                          type: 'insert_lesson',
                                          label: 'Dziennik',
                                          studentId: message.lessonDraft?.studentId || undefined,
                                          studentName: message.lessonDraft?.studentName || undefined,
                                          topic: message.lessonDraft.topic,
                                          lessonDraft: message.lessonDraft,
                                          lessonScenario: message.lessonScenario,
                                        })
                                      }
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-200 hover:bg-base-200/90 text-text-2 hover:text-text-hi border border-line font-medium text-[11px] transition-all cursor-pointer"
                                    >
                                      <CheckCircle2 size={12} className="text-primary" />
                                      <span>Zapisz w Dzienniku</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Karta importu kursantów do CRM */}
                            {message.studentsImport && (
                              <BulkStudentImportCard
                                studentsImport={message.studentsImport}
                                isAdmin={isAdmin}
                                onRefreshUsers={refreshStudentIndex}
                              />
                            )}

                            {/* Karta dokumentu HTML & raportu PDF */}
                            {message.htmlReport && (
                              <HtmlReportCard htmlReport={message.htmlReport} />
                            )}

                            {/* Podgląd scenariusza lekcji 2.0 wygenerowanego toolem czatu */}
                            {message.scenarioToolResult && (
                              <ScenarioToolResultCard
                                result={message.scenarioToolResult}
                                onOpenProfile={() =>
                                  handleExecuteAction({
                                    type: 'profile',
                                    label: 'Profil kursanta',
                                    studentId: message.scenarioToolResult!.studentId,
                                    studentName: message.scenarioToolResult!.studentName,
                                  })
                                }
                              />
                            )}

                            {/* Główna treść odpowiedzi Markdown */}
                            <div className="text-xs sm:text-[13px] leading-relaxed font-normal space-y-2 text-text">
                              <Markdown
                                components={{
                                  h1: ({ children }) => (
                                    <h3 className="text-sm font-black text-text-hi border-b border-line pb-1 mt-2.5 mb-1.5 flex items-center gap-1.5">
                                      {children}
                                    </h3>
                                  ),
                                  h2: ({ children }) => (
                                    <h4 className="text-[13px] font-extrabold text-primary border-b border-line pb-1 mt-2 mb-1 flex items-center gap-1.5">
                                      {children}
                                    </h4>
                                  ),
                                  h3: ({ children }) => (
                                    <h5 className="text-xs font-bold text-text-hi mt-2 mb-1 flex items-center gap-1">
                                      {children}
                                    </h5>
                                  ),
                                  p: ({ children }) => (
                                    <p className="leading-relaxed mb-1.5 text-text last:mb-0">
                                      {children}
                                    </p>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="pl-4 space-y-1 my-1.5 list-disc marker:text-primary">
                                      {children}
                                    </ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="pl-4 space-y-1 my-1.5 list-decimal marker:text-primary font-mono text-xs">
                                      {children}
                                    </ol>
                                  ),
                                  li: ({ children }) => (
                                    <li className="leading-relaxed pl-0.5 text-text">
                                      {children}
                                    </li>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="font-bold text-text-hi bg-primary/10 text-primary px-1 py-0.5 rounded-md border border-primary/20">
                                      {children}
                                    </strong>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="pl-3 border-l-2 border-primary text-text-2 italic my-2 bg-base-100/50 py-1.5 pr-2 rounded-r-xl">
                                      {children}
                                    </blockquote>
                                  ),
                                  code: ({ children }) => (
                                    <code className="font-mono text-[11px] bg-ink text-primary px-1.5 py-0.5 rounded border border-line">
                                      {children}
                                    </code>
                                  ),
                                }}
                              >
                                {message.text}
                              </Markdown>
                            </div>

                            {/* Źródła internetowe z researchu */}
                            {message.webSources && message.webSources.length > 0 && (
                              <WebSourcesList sources={message.webSources} />
                            )}
                          </div>

                          {/* 1-klikowe akcje Notion AI pod odpowiedzią */}
                          {message.actions && message.actions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5 pl-1">
                              {message.actions.map((act, aIdx) => {
                                const isPrimary = act.type === 'insert_lesson' || act.type === 'presentation' || act.type === 'html_pdf' || act.type === 'bulk_import';
                                return (
                                  <button
                                    key={aIdx}
                                    type="button"
                                    onClick={() => handleExecuteAction(act)}
                                    className={`flex items-center gap-1.5 py-1 px-3 rounded-xl border text-[11px] font-bold transition-all hover:scale-[1.02] shadow-sm cursor-pointer ${
                                      isPrimary
                                        ? 'border-primary/50 bg-primary text-accent-ink font-extrabold shadow-[0_0_15px_rgba(114,240,180,0.35)] hover:bg-primary-hover'
                                        : 'border-line-strong bg-base-200/80 hover:bg-base-200 text-text-2 hover:text-text-hi hover:border-primary/40'
                                    }`}
                                  >
                                    {act.type === 'insert_lesson' && <CheckCircle2 size={12} />}
                                    {act.type === 'presentation' && <Airplay size={12} />}
                                    {act.type === 'homework' && <ClipboardList size={12} />}
                                    {act.type === 'planner' && <BookOpen size={12} />}
                                    {act.type === 'scratchpad' && <FileText size={12} />}
                                    {act.type === 'mailing' && <Mail size={12} />}
                                    {act.type === 'profile' && <User size={12} />}
                                    {act.type === 'bulk_import' && <Users size={12} />}
                                    {act.type === 'html_pdf' && <PdfIcon size={12} />}
                                    <span>{act.label}</span>
                                    <ChevronRight size={11} className={isPrimary ? 'text-accent-ink' : 'opacity-60'} />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Stan generowania (Thinking / Flash) */}
                {isThinking && (
                  <div className="flex items-center gap-2.5 animate-fadeIn">
                    <AIAssistantIcon size="xs" variant="avatar" state="thinking" glow={true} />
                    <div className="rounded-2xl p-2.5 px-3.5 bg-ink-2/95 border border-line-strong text-text-2 flex items-center gap-2.5 shadow-ambient-sm">
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${aiMode === 'flash' ? 'bg-amber-400' : 'bg-primary'} animate-ping`} />
                        <span className={`w-1.5 h-1.5 rounded-full ${aiMode === 'flash' ? 'bg-amber-400/80' : 'bg-primary/80'} animate-pulse`} />
                        <span className={`w-1.5 h-1.5 rounded-full ${aiMode === 'flash' ? 'bg-amber-400/60' : 'bg-primary/60'}`} />
                      </div>
                      <span className="text-xs text-text-2 font-medium">
                        {aiMode === 'flash'
                          ? '⚡ Gemini Flash generuje błyskawiczną odpowiedź…'
                          : '🧠 Rada Modeli AI (Autor + Recenzenci) analizuje CRM i myśli nad odpowiedzią…'}
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-danger p-3 rounded-2xl bg-danger/10 border border-danger/30">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* Szybkie follow-up chips wewnątrz okna czatu */}
            {viewMode === 'chat' && messages.length > 0 && (
              <div className="px-4 py-2.5 border-t border-line bg-base-200/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] uppercase font-bold text-primary shrink-0 flex items-center gap-1 font-mono">
                  <Sparkles size={11} className="text-primary" /> Sugestie:
                </span>
                {(() => {
                  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
                  const currentSuggestions = (lastAssistantMsg?.followUpSuggestions && lastAssistantMsg.followUpSuggestions.length > 0)
                    ? lastAssistantMsg.followUpSuggestions
                    : QUICK_FOLLOWUPS;
                  return currentSuggestions.map((followup, fIdx) => (
                    <button
                      key={fIdx}
                      type="button"
                      onClick={() => {
                        setDraft(followup);
                        ask(followup);
                      }}
                      disabled={isThinking}
                      className="shrink-0 px-3 py-1 rounded-full border border-primary/50 bg-primary/20 hover:bg-primary/30 text-primary dark:text-primary light:text-emerald-800 text-[11px] font-medium transition-all hover:scale-105 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      {followup}
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        {/* ─── 3. GŁÓWNE POLE CZATU (INPUT CONTAINER) ─── */}
        {viewMode === 'chat' && (
          <div className="relative w-full max-w-3xl mx-auto space-y-2">
            {/* Follow-up suggestions box directly above the input container if there are suggestions */}
            {(() => {
              const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
              const activeFollowups = lastAssistantMsg?.followUpSuggestions && lastAssistantMsg.followUpSuggestions.length > 0
                ? lastAssistantMsg.followUpSuggestions
                : (messages.length === 0 ? QUICK_FOLLOWUPS.slice(0, 3) : []);
              if (!activeFollowups || activeFollowups.length === 0) return null;
              return (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
                  <span className="text-[11px] font-bold text-text-mute shrink-0 flex items-center gap-1 font-mono">
                    <Sparkles size={12} className="text-primary" /> Follow-up:
                  </span>
                  {activeFollowups.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDraft(item);
                        ask(item);
                      }}
                      disabled={isThinking}
                      className="shrink-0 px-3 py-1.5 rounded-xl border border-primary/50 bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold shadow-sm transition-all hover:scale-[1.03] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>{item}</span>
                      <ArrowUp size={11} className="rotate-45 opacity-70" />
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Ambient Subtle Mint Glow */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 blur-xl opacity-60 pointer-events-none" />

            {/* Menu Autouzupełniania @ Kursant */}
            {showMentionMenu && (
              <div className="absolute bottom-full left-2 right-2 mb-2 z-50 bg-ink-2/98 backdrop-blur-2xl border border-line-strong rounded-2xl shadow-ambient-lg p-2 max-h-[260px] overflow-y-auto animate-fadeIn">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-line px-2 text-[10px] font-bold text-text-mute uppercase tracking-wider font-mono">
                  <span className="flex items-center gap-1 text-primary">
                    <AtSign size={11} className="text-primary" /> Wskaż kursanta z bazy CRM
                  </span>
                  <span className="text-text-mute font-normal">Wybierz [Enter] lub kliknij</span>
                </div>
                {filteredStudents.length === 0 ? (
                  <div className="p-3 text-center text-xs text-text-mute">
                    Nie znaleziono kursanta pasującego do „{mentionQuery}”
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredStudents.map((st, sIdx) => {
                      const isSelected = sIdx === activeMentionIndex;
                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudentMention(st)}
                          onMouseEnter={() => setActiveMentionIndex(sIdx)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary/15 border-primary/40 text-text-hi shadow-[0_0_12px_rgba(114,240,180,0.15)]'
                              : 'bg-transparent border-transparent text-text-2 hover:bg-base-100 hover:text-text-hi'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-base-100 text-primary border border-primary/30 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {st.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-hi truncate">{st.name}</p>
                              <p className="text-[10px] text-text-mute truncate">
                                {st.company ? `${st.company} · ` : ''}lekcji: {st.lessonCount}
                                {st.lastLessonDate ? ` (ost. ${st.lastLessonDate})` : ''}
                              </p>
                            </div>
                          </div>
                          {st.level && (
                            <span className="text-[9px] px-2 py-0.5 rounded-md bg-base-100 text-primary font-mono font-bold border border-line shrink-0">
                              {st.level}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Menu Autouzupełniania / Skille */}
            {showSlashMenu && (
              <div className="absolute bottom-full left-2 right-2 mb-2 z-50 bg-ink-2/98 backdrop-blur-2xl border border-line-strong rounded-2xl shadow-ambient-lg p-2 max-h-[290px] overflow-y-auto animate-fadeIn">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-line px-2 text-[10px] font-bold text-text-mute uppercase tracking-wider font-mono">
                  <span className="flex items-center gap-1 text-primary">
                    <Command size={11} className="text-primary" /> Wybierz skill / szablon asystenta
                  </span>
                  <span className="text-text-mute font-normal">Wybierz [Enter] lub kliknij</span>
                </div>
                {filteredSkills.length === 0 ? (
                  <div className="p-3 text-center text-xs text-text-mute">
                    Nie znaleziono komendy dla „/{slashQuery}”
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredSkills.map((sk, skIdx) => {
                      const isSelected = skIdx === activeSlashIndex;
                      return (
                        <div
                          key={sk.id}
                          onClick={() => handleSelectSkillCommand(sk)}
                          onMouseEnter={() => setActiveSlashIndex(skIdx)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary/15 border-primary/40 text-text-hi shadow-[0_0_12px_rgba(114,240,180,0.15)]'
                              : 'bg-transparent border-transparent text-text-2 hover:bg-base-100 hover:text-text-hi'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono font-bold text-primary shrink-0 bg-base-100 px-1.5 py-0.5 rounded border border-line">
                              {sk.command}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-hi truncate">{sk.name}</p>
                              <p className="text-[10px] text-text-mute truncate">{sk.description}</p>
                            </div>
                          </div>
                          {sk.badge && (
                            <span className="text-[9px] px-2 py-0.5 rounded-md bg-base-100 text-text-2 font-mono font-bold border border-line shrink-0">
                              {sk.badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Główna ramka pola czatu */}
            <div className="relative rounded-3xl border border-line-strong bg-ink-2/95 backdrop-blur-2xl shadow-ambient-md transition-all focus-within:border-primary/50 focus-within:shadow-[0_0_25px_rgba(114,240,180,0.18)] flex flex-col p-3 sm:p-4">
              {/* Załączniki oczekujące (Chips) */}
              {pendingAttachments.length > 0 && (
                <div className="pb-2.5 mb-2 border-b border-line flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold text-text-mute uppercase font-mono mr-1">
                    Załączone pliki ({pendingAttachments.length}):
                  </span>
                  {pendingAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-base-100 border border-line-strong text-[11px] text-text-hi shadow-sm"
                    >
                      {att.type === 'image' && att.dataUrl ? (
                        <img src={att.dataUrl} alt={att.name} className="w-4 h-4 rounded object-cover" />
                      ) : att.type === 'pdf' ? (
                        <PdfIcon size={13} className="text-danger" />
                      ) : (
                        <FileCode size={13} className="text-primary" />
                      )}
                      <span className="truncate max-w-[130px] font-medium">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingAttachment(att.id)}
                        className="p-0.5 text-text-mute hover:text-danger rounded transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={draft}
                rows={2}
                onChange={(e) => {
                  const val = e.target.value;
                  const pos = e.target.selectionStart;
                  handleDraftChange(val, pos);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  pendingAttachments.length > 0
                    ? `Wpisz polecenie dla ${pendingAttachments.length} załącznika(ów) (Enter aby wysłać)…`
                    : index
                    ? 'Wpisz pytanie lub polecenie (użyj @ kursant, / skille, /help)...'
                    : 'Ładuję indeks kursantów CRM…'
                }
                disabled={isThinking}
                className="w-full bg-transparent text-sm sm:text-base text-text-hi placeholder:text-text-mute/50 focus:outline-none resize-none min-h-[44px] max-h-[160px] leading-relaxed"
              />

              {/* Dolny pasek wewnątrz pola tekstowego */}
              <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-line">
                {/* Lewa strona: Segmented Switcher (Flash vs Thinking) + Przyciski narzędziowe */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {/* Przełącznik trybu: ⚡ Flash vs 🧠 Thinking */}
                  <div className="inline-flex p-0.5 rounded-full bg-base-100 border border-line shadow-inner items-center">
                    <button
                      type="button"
                      onClick={() => handleToggleMode('flash')}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        aiMode === 'flash'
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.4)] font-extrabold scale-[1.02]'
                          : 'text-text-mute hover:text-text-2'
                      }`}
                      title="Tryb Flash: Błyskawiczna odpowiedź w ułamku sekundy (Gemini Flash)"
                    >
                      <Zap size={11} className={aiMode === 'flash' ? 'text-slate-950 fill-current' : 'text-amber-400'} />
                      <span>Flash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleMode('thinking')}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        aiMode === 'thinking'
                          ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.35)] font-extrabold scale-[1.02]'
                          : 'text-text-mute hover:text-text-2'
                      }`}
                      title="Tryb Thinking: Głęboka analiza Rady Modeli AI (Autor + Recenzenci)"
                    >
                      <Sparkles size={11} className={aiMode === 'thinking' ? 'text-accent-ink' : 'text-primary'} />
                      <span>Thinking</span>
                    </button>
                  </div>

                  {/* Szybki przycisk @ Kursant */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMentionMenu(true);
                      setMentionQuery('');
                      setShowSlashMenu(false);
                      textareaRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-base-100/60 hover:bg-base-100 border border-line-strong hover:border-primary/40 text-[11px] font-medium text-text-2 hover:text-text-hi flex items-center gap-1 cursor-pointer transition-all"
                    title="Wskaż kursanta (@)"
                  >
                    <AtSign size={12} className="text-primary" />
                    <span>Kursant</span>
                  </button>

                  {/* Szybki przycisk / Skille */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSlashMenu(true);
                      setSlashQuery('');
                      setShowMentionMenu(false);
                      textareaRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-base-100/60 hover:bg-base-100 border border-line-strong hover:border-primary/40 text-[11px] font-medium text-text-2 hover:text-text-hi flex items-center gap-1 cursor-pointer transition-all"
                    title="Wybierz skill (/)"
                  >
                    <Command size={12} className="text-primary" />
                    <span>Skille</span>
                  </button>

                  {/* Załącz plik */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-xl bg-base-100/60 hover:bg-base-100 border border-line-strong hover:border-primary/40 text-[11px] font-medium text-text-2 hover:text-text-hi flex items-center gap-1 cursor-pointer transition-all"
                    title="Załącz plik PDF, screenshot lub notatki"
                  >
                    <Paperclip size={12} className="text-primary" />
                    <span className="hidden sm:inline">Załącz</span>
                  </button>
                </div>

                {/* Prawa strona: Okrągły przycisk wysyłki ze strzałką w górę */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[10px] text-text-mute hidden md:inline font-mono">
                    Enter ↵
                  </span>
                  <button
                    type="button"
                    onClick={() => ask(draft)}
                    disabled={(!draft.trim() && pendingAttachments.length === 0) || isThinking}
                    className={`h-9 w-9 rounded-2xl flex items-center justify-center transition-all ${
                      (!draft.trim() && pendingAttachments.length === 0) || isThinking
                        ? 'bg-base-100/40 text-text-mute/30 cursor-not-allowed border border-line'
                        : 'bg-primary text-accent-ink hover:bg-primary-hover shadow-[0_0_16px_rgba(114,240,180,0.4)] cursor-pointer hover:scale-105 active:scale-95 border border-primary/40 font-bold'
                    }`}
                    title="Wyślij wiadomość"
                  >
                    {isThinking ? (
                      <Loader2 size={16} className="animate-spin text-accent-ink" />
                    ) : (
                      <ArrowUp size={16} className="stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Delikatna informacja o /help poniżej okna czatu */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-text-mute mt-3 flex-wrap">
              <span>💡 Wpisz</span>
              <button
                type="button"
                onClick={() => {
                  setDraft('/help');
                  textareaRef.current?.focus();
                }}
                className="px-1.5 py-0.5 rounded-md bg-base-100/80 border border-line-strong hover:border-primary/50 text-primary font-mono text-[11px] font-semibold transition-colors cursor-pointer"
                title="Kliknij, aby wstawić /help"
              >
                /help
              </button>
              <span>aby zobaczyć do czego możesz użyć czatu i poznać listę komend</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     TRYB FLOATING — PŁYWAJĄCY DYMEK W LEWYM DOLNYM ROGU EKRANU
     ═══════════════════════════════════════════════════════════════════ */
  if (mode === 'floating' && hidden) {
    return null;
  }

  const panel = (
    <div
      className="fixed bottom-0 left-3 sm:left-4 z-[9998] pointer-events-none flex flex-col items-start justify-end max-h-[100dvh]"
      style={{ paddingBottom: 'var(--rail-base)' }}
    >
      <input
        ref={floatingFileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.pdf,.txt,.md,.doc,.docx,.csv,.json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="pointer-events-auto flex flex-col-reverse items-start">
        {/* Przycisk aktywacyjny (Launcher) */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title="Asystent CRIBRO AI — zapytaj o kursantów i moduły"
          className={`h-11 px-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold shadow-ambient-lg backdrop-blur-xl transition-all cursor-pointer ${
            isOpen
              ? 'border-primary/60 bg-primary/20 text-primary ring-2 ring-primary/30 shadow-[0_0_20px_rgba(114,240,180,0.3)]'
              : 'border-line-strong bg-ink-2/95 text-text-hi hover:border-primary/50 hover:shadow-[0_0_18px_rgba(114,240,180,0.2)]'
          }`}
        >
          {isOpen ? (
            <X size={16} />
          ) : (
            <AIAssistantIcon size="xs" variant="badge" state={isThinking ? 'thinking' : 'online'} glow={false} />
          )}
          <span>Asystent AI</span>
        </button>

        {/* Okno czatu pływającego */}
        {isOpen && (
          <div
            onPaste={handlePaste}
            className="mb-2 w-[calc(100vw-1.5rem)] sm:w-[480px] max-h-[80vh] flex flex-col rounded-3xl border border-line-strong bg-ink-2/98 backdrop-blur-2xl shadow-ambient-lg overflow-hidden animate-fadeIn"
          >
            {/* Header Floating */}
            <header className="px-4 py-2.5 border-b border-line flex items-center justify-between bg-base-200/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <AIAssistantIcon size="xs" variant="badge" state={isThinking ? 'thinking' : 'online'} glow={true} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-hi truncate">Asystent Lektora CRIBRO</p>
                  <p className="text-[10px] text-text-mute truncate">
                    Rada Modeli AI · CRM & Komendy (@ i /)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => floatingFileInputRef.current?.click()}
                  className="p-1.5 rounded-lg border border-line text-text-mute hover:text-text-hi hover:border-primary/40 transition-colors"
                  title="Załącz plik"
                >
                  <Paperclip size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    viewMode === 'history'
                      ? 'bg-primary/20 text-primary border-primary/50'
                      : 'border-line text-text-mute hover:text-text-hi'
                  }`}
                  title={viewMode === 'history' ? 'Wróć do czatu' : 'Historia rozmów'}
                >
                  <History size={13} />
                </button>
                <button
                  type="button"
                  onClick={startNewSession}
                  className="p-1.5 rounded-lg border border-line text-text-mute hover:text-text-hi hover:border-primary/40 transition-colors"
                  title="Nowa rozmowa"
                >
                  <Plus size={13} />
                </button>
              </div>
            </header>

            {/* Widok historii w trybie floating */}
            {viewMode === 'history' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="flex items-center justify-between pb-1 mb-2 border-b border-line">
                  <span className="text-xs font-bold text-text-hi uppercase tracking-wider font-mono">
                    Historia rozmów ({sessions.length})
                  </span>
                  <button
                    onClick={startNewSession}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Nowy czat
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <p className="text-xs text-text-mute text-center py-8">
                    Brak wcześniejszych rozmów w historii.
                  </p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        currentSessionId === s.id
                          ? 'bg-primary/15 border-primary/50 text-text-hi'
                          : 'bg-base-200/50 border-line text-text-2 hover:bg-base-200 hover:text-text-hi'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate text-text-hi">{s.title}</p>
                        <p className="text-[10px] text-text-mute font-mono">
                          {new Date(s.createdAt).toLocaleDateString()} · {s.messages?.length || 0} wiadomości
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteSession(s.id, e)}
                        className="p-1 text-text-mute hover:text-danger rounded hover:bg-base-100"
                        title="Usuń sesję"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Widok czatu w trybie floating */
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-2.5 text-center py-6">
                    <AIAssistantIcon size="md" variant="avatar" state="idle" glow={true} className="mx-auto mb-2" />
                    <p className="text-xs text-text-2 leading-relaxed">
                      W czym mogę pomóc? Użyj <span className="text-primary font-mono font-bold">@</span> kursanta lub <span className="text-primary font-mono font-bold">/</span> skille.
                    </p>
                    <p className="text-[11px] text-text-mute font-mono">
                      Wpisz <span className="text-primary">/help</span>, aby poznać listę możliwości.
                    </p>
                  </div>
                )}

                {messages.map((message, idx) => (
                  <div key={idx} className="space-y-2">
                    <div
                      className={`max-w-[92%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                        message.role === 'user'
                          ? 'ml-auto bg-base-200/90 border border-line-strong text-text-hi font-medium rounded-tr-xs'
                          : 'bg-ink-2/95 border border-line text-text shadow-sm rounded-tl-xs'
                      }`}
                    >
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5 pb-1.5 border-b border-line">
                          {message.attachments.map((att, aIdx) => (
                            <div key={aIdx} className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-base-100 text-[11px]">
                              {att.type === 'image' && att.dataUrl ? (
                                <img src={att.dataUrl} alt={att.name} className="w-5 h-5 rounded object-cover" />
                              ) : (
                                <Paperclip size={11} className="text-primary" />
                              )}
                              <span className="truncate max-w-[100px]">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Podgląd karty lekcji i scenariusza w Floating */}
                      {(message.lessonScenario || message.lessonDraft) && (
                        <div className="mt-2 p-2.5 rounded-xl bg-base-100/70 border border-primary/35 text-[11px] space-y-2 shadow-inner">
                          <div className="flex items-center justify-between border-b border-line pb-1.5 flex-wrap gap-1">
                            <div className="flex items-center gap-1 font-bold text-primary">
                              <Sparkles size={12} className="text-primary" />
                              <span className="uppercase tracking-wider text-[9px] font-mono">
                                {message.lessonScenario ? 'Scenariusz AI' : 'Karta lekcji AI'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {message.lessonScenario?.targetLevel && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-base-200 text-text font-mono border border-line">
                                  {message.lessonScenario.targetLevel}
                                </span>
                              )}
                              {(message.lessonDraft?.studentName || message.lessonScenario?.studentName) && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold border border-primary/30">
                                  @{message.lessonDraft?.studentName || message.lessonScenario?.studentName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-xs text-text-hi">
                            {message.lessonScenario?.topic || message.lessonDraft?.topic}
                          </div>
                          {message.lessonScenario?.stages && message.lessonScenario.stages.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {message.lessonScenario.stages.map((st, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-base-200 border border-line text-text-2"
                                >
                                  {sIdx + 1}. {st.title.replace(/^\d+\.\s*/, '').slice(0, 18)}…
                                </span>
                              ))}
                            </div>
                          )}
                          {message.lessonDraft?.vocabulary && (
                            <div className="text-[10px] font-mono whitespace-pre-line bg-ink p-1.5 rounded border border-line text-text max-h-24 overflow-y-auto">
                              {message.lessonDraft.vocabulary}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Karta importu kursantów w floating */}
                      {message.studentsImport && (
                        <div className="mt-2">
                          <BulkStudentImportCard
                            studentsImport={message.studentsImport}
                            isAdmin={isAdmin}
                            onRefreshUsers={refreshStudentIndex}
                          />
                        </div>
                      )}

                      {/* Karta raportu HTML/PDF w floating */}
                      {message.htmlReport && (
                        <div className="mt-2">
                          <HtmlReportCard htmlReport={message.htmlReport} />
                        </div>
                      )}

                      {message.scenarioToolResult && (
                        <div className="mt-2">
                          <ScenarioToolResultCard
                            result={message.scenarioToolResult}
                            onOpenProfile={() =>
                              handleExecuteAction({
                                type: 'profile',
                                label: 'Profil kursanta',
                                studentId: message.scenarioToolResult!.studentId,
                                studentName: message.scenarioToolResult!.studentName,
                              })
                            }
                          />
                        </div>
                      )}

                      <div className="mt-1">{message.text}</div>

                      {/* Źródła internetowe w floating */}
                      {message.webSources && message.webSources.length > 0 && (
                        <WebSourcesList sources={message.webSources} />
                      )}
                    </div>

                    {/* Action buttons */}
                    {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                        {message.actions.map((act, aIdx) => {
                          const isPrimary = act.type === 'insert_lesson' || act.type === 'presentation' || act.type === 'html_pdf' || act.type === 'bulk_import';
                          return (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => handleExecuteAction(act)}
                              className={`flex items-center gap-1 py-1 px-2.5 rounded-xl border text-[11px] font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                                isPrimary
                                  ? 'border-primary/50 bg-primary text-accent-ink font-bold'
                                  : 'border-line bg-base-200/80 hover:bg-base-200 text-text-2'
                              }`}
                            >
                              {act.type === 'insert_lesson' && <CheckCircle2 size={11} />}
                              {act.type === 'presentation' && <Airplay size={11} />}
                              {act.type === 'homework' && <ClipboardList size={11} />}
                              {act.type === 'planner' && <BookOpen size={11} />}
                              {act.type === 'scratchpad' && <FileText size={11} />}
                              {act.type === 'bulk_import' && <Users size={11} />}
                              {act.type === 'html_pdf' && <PdfIcon size={11} />}
                              <span>{act.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 text-xs text-text-mute">
                    <Loader2 size={13} className="animate-spin text-primary" /> Rada Modeli AI analizuje dane…
                  </div>
                )}

                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
            )}

            {/* Załączniki oczekujące (Floating) */}
            {pendingAttachments.length > 0 && (
              <div className="px-3 py-1.5 border-t border-line bg-base-200/40 flex flex-wrap gap-1.5 items-center">
                {pendingAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-1 py-0.5 px-2 rounded-lg bg-base-100 border border-line text-[11px] text-text-hi">
                    <span className="truncate max-w-[90px]">{att.name}</span>
                    <button type="button" onClick={() => removePendingAttachment(att.id)} className="text-text-mute hover:text-danger">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Form (Floating) */}
            {viewMode === 'chat' && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(draft);
                }}
                className="p-2.5 border-t border-line flex items-center gap-2 bg-ink-2"
              >
                <button
                  type="button"
                  onClick={() => floatingFileInputRef.current?.click()}
                  className="p-2 rounded-xl border border-line bg-base-100/60 text-text-mute hover:text-text-hi transition-colors cursor-pointer"
                  title="Załącz plik"
                >
                  <Paperclip size={14} />
                </button>
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    pendingAttachments.length > 0
                      ? `Polecenie do ${pendingAttachments.length} pliku(ów)…`
                      : index
                      ? 'Wpisz pytanie (np. @Dariusz lub /help)…'
                      : 'Wczytuję listę kursantów…'
                  }
                  disabled={!index || isThinking}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-base-100 border border-line text-[13px] text-text-hi placeholder:text-text-mute/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={(!draft.trim() && pendingAttachments.length === 0) || isThinking || !index}
                  className="shrink-0 h-9 w-9 rounded-xl bg-primary text-accent-ink flex items-center justify-center disabled:opacity-40 disabled:cursor-default cursor-pointer hover:bg-primary-hover shadow-[0_0_15px_rgba(114,240,180,0.35)] transition-all font-bold"
                  aria-label="Wyślij pytanie"
                >
                  <ArrowUp size={15} className="stroke-[2.5]" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof window === 'undefined' || !window.document?.body) return panel;
  return createPortal(panel, window.document.body);
};

export default TeacherAssistant;

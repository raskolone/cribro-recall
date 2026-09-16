import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Send,
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
  CornerDownLeft,
  Users,
  Calendar,
  MessageSquare,
  Zap,
} from 'lucide-react';
import {
  askTeacherAssistant,
  buildStudentIndex,
  AssistantMessage,
  StudentIndexEntry,
  AssistantAction,
  ChatSession,
  LessonDraftProposal,
} from '../../services/teacherAssistant';
import { LessonAttachment } from '../../types';
import { AIAssistantIcon } from '../ui/AIAssistantIcon';
import Markdown from 'react-markdown';

const STORAGE_KEY = 'cribro_teacher_assistant_sessions_v1';

/** Zorganizowane tematycznie propozycje konwersacji dla widoku powitalnego */
const STARTER_PROMPTS = [
  {
    icon: Users,
    category: 'Kursanci & CRM',
    title: 'Ostatnia lekcja',
    prompt: 'Z kim i o czym była moja ostatnia lekcja?',
  },
  {
    icon: BookOpen,
    category: 'Planowanie',
    title: 'Przygotuj konspekt lekcji',
    prompt: 'Przygotuj temat lekcji dla Dariusza z powtórką czasów przeszłych',
  },
  {
    icon: ClipboardList,
    category: 'Zadania',
    title: 'Zaległe prace domowe',
    prompt: 'Kto ma obecnie niezrobioną lub zaległą pracę domową?',
  },
  {
    icon: Zap,
    category: 'Ćwiczenia',
    title: 'Szybka powtórka',
    prompt: 'Zaproponuj 5 angażujących pytań do powtórki na dzisiejsze zajęcia',
  },
  {
    icon: Paperclip,
    category: 'Multimodalne AI',
    title: 'Analiza materiału / screenshotu',
    prompt: 'Przeanalizuj załączony materiał i przygotuj z niego ćwiczenia',
  },
  {
    icon: Calendar,
    category: 'Postępy',
    title: 'Podsumowanie kursantów',
    prompt: 'Podsumuj postępy i trudności językowe moich kursantów',
  },
];

/** Szybkie follow-up chips w trakcie rozmowy */
const QUICK_FOLLOWUPS = [
  'Przygotuj dla niego zestaw 5 zdań do tłumaczenia',
  'Zaproponuj zadanie domowe z tego tematu',
  'Utwórz konspekt do Prezentacji Live',
  'Podsumuj słownictwo w 4 blokach',
];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const floatingFileInputRef = useRef<HTMLInputElement>(null);

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [draft]);

  // Przetwarzanie dodanych plików (obrazy, PDF, dokumenty tekstowe)
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const newAttachments: LessonAttachment[] = [];

    for (const file of list) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let detectedType: LessonAttachment['type'] = 'text';

      if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        detectedType = 'image';
      } else if (file.type === 'application/pdf' || ext === 'pdf') {
        detectedType = 'pdf';
      } else if (ext === 'md' || ext === 'markdown') {
        detectedType = 'markdown';
      } else if (ext === 'html' || ext === 'htm') {
        detectedType = 'html';
      } else {
        detectedType = 'text';
      }

      try {
        if (detectedType === 'image' || detectedType === 'pdf') {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          let textContent: string | undefined;
          if (detectedType === 'pdf') {
            try {
              const pdfjsLib = (window as any).pdfjsLib;
              if (pdfjsLib) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                  const page = await pdf.getPage(i);
                  const tc = await page.getTextContent();
                  fullText += tc.items.map((item: any) => item.str).join(' ') + '\n';
                }
                textContent = fullText;
              }
            } catch (pdfErr) {
              console.warn('PDF text extraction fallback:', pdfErr);
            }
          }

          newAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name || `plik-${Date.now()}.${ext || 'png'}`,
            type: detectedType,
            size: file.size,
            mimeType: file.type || (detectedType === 'pdf' ? 'application/pdf' : 'image/png'),
            dataUrl,
            textContent,
          });
        } else {
          // Pliki tekstowe
          const textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          newAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            type: detectedType,
            size: file.size,
            mimeType: file.type || 'text/plain',
            textContent,
          });
        }
      } catch (err) {
        console.error('Błąd wczytywania pliku:', err);
      }
    }

    setPendingAttachments((prev) => [...prev, ...newAttachments].slice(0, 6));
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter((item) => item.type.indexOf('image') !== -1);
        if (imageItems.length > 0) {
          const files: File[] = [];
          imageItems.forEach((item) => {
            const file = item.getAsFile();
            if (file) files.push(file);
          });
          if (files.length > 0) {
            processFiles(files);
          }
        }
      }
    },
    [processFiles]
  );

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  if (hidden) return null;

  const startNewSession = () => {
    if (messages.length > 0) {
      const title = messages[0]?.text?.slice(0, 30) || 'Rozmowa z asystentem';
      const newSession: ChatSession = {
        id: currentSessionId,
        title,
        createdAt: Date.now(),
        messages,
      };
      saveSessions([newSession, ...sessions.filter((s) => s.id !== currentSessionId)]);
    }
    setCurrentSessionId(`sess_${Date.now()}`);
    setMessages([]);
    setPendingAttachments([]);
    setViewMode('chat');
    setError('');
  };

  const loadSession = (sess: ChatSession) => {
    setCurrentSessionId(sess.id);
    setMessages(sess.messages || []);
    setPendingAttachments([]);
    setViewMode('chat');
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== sessionId);
    saveSessions(updated);
    if (currentSessionId === sessionId) {
      setMessages([]);
    }
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if ((!trimmed && pendingAttachments.length === 0) || isThinking) return;

    let activeIndex = index;
    if (!activeIndex) {
      try {
        activeIndex = await buildStudentIndex();
        setIndex(activeIndex);
      } catch {
        setError('Brak dostępu do indeksu kursantów.');
        return;
      }
    }

    const currentAttachments = [...pendingAttachments];
    const userMsg: AssistantMessage = {
      role: 'user',
      text: trimmed || (currentAttachments.length > 0 ? `[Załączono ${currentAttachments.length} plik(i/ów)]` : ''),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setDraft('');
    setPendingAttachments([]);
    setIsThinking(true);
    setError('');

    try {
      const { text, actions, lessonDraft } = await askTeacherAssistant(
        trimmed || 'Przeanalizuj załączone materiały i zaproponuj ćwiczenia lub podsumowanie.',
        activeIndex,
        messages,
        currentAttachments
      );
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        text,
        actions,
        lessonDraft,
        timestamp: Date.now(),
      };
      const updatedMessages = [...nextHistory, assistantMsg];
      setMessages(updatedMessages);

      const title = nextHistory[0]?.text?.slice(0, 35) || 'Rozmowa z asystentem';
      const currentSession: ChatSession = {
        id: currentSessionId,
        title,
        createdAt: Date.now(),
        messages: updatedMessages,
      };
      saveSessions([currentSession, ...sessions.filter((s) => s.id !== currentSessionId)]);
    } catch (err: any) {
      console.error('[Asystent] Odpowiedź nie powstała:', err);
      setError(err?.message || 'Model nie odpowiedział.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleExecuteAction = (action: AssistantAction) => {
    if (action.studentId && onSelectStudent) {
      onSelectStudent(action.studentId);
    }

    if (action.type === 'insert_lesson' && action.lessonDraft) {
      if (onCreateLessonRecord) {
        onCreateLessonRecord(action.lessonDraft);
      } else {
        onNavigateToModule?.('lesson-history', { lessonDraft: action.lessonDraft });
      }
    } else if (action.type === 'presentation') {
      if (onOpenInPresentation) {
        onOpenInPresentation(
          action.lessonDraft || { topic: action.topic },
          action.studentId,
          action.studentName
        );
      } else {
        onNavigateToModule?.('presentation', { topic: action.topic, studentId: action.studentId });
      }
    } else if (action.type === 'planner') {
      onNavigateToModule?.('lesson-planner', {
        studentId: action.studentId,
        topic: action.topic,
        lessonDraft: action.lessonDraft,
      });
    } else if (action.type === 'homework') {
      onNavigateToModule?.('homework', {
        studentId: action.studentId,
        topic: action.topic,
      });
    } else if (action.type === 'scratchpad') {
      onNavigateToModule?.('scratchpad', { studentId: action.studentId });
    } else if (action.type === 'mailing') {
      onNavigateToModule?.('mailing', { studentId: action.studentId });
    } else if (action.type === 'profile') {
      onNavigateToModule?.('profile', { studentId: action.studentId });
    }
  };

  const copyMessage = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  /* ═══════════════════════════════════════════════════════════════════
     TRYB EMBEDDED — CENTRALNY CHAT ASYSTENTA NA STRONIE GŁÓWNEJ
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
        className={`w-full max-w-5xl mx-auto rounded-3xl border border-primary/35 shadow-[0_12px_45px_rgba(0,0,0,0.45),0_0_25px_rgba(114,240,180,0.14)] liquid-glass-tile backdrop-blur-2xl text-text-hi overflow-hidden transition-all relative flex flex-col ${className}`}
      >
        {/* Subtelny pasek gradientu na samej górze karty */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

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
          <div className="absolute inset-0 z-50 bg-base-300/90 backdrop-blur-md border-2 border-dashed border-primary rounded-3xl flex flex-col items-center justify-center gap-2 p-4 text-center pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary border border-primary/40 flex items-center justify-center animate-bounce shadow-[0_0_24px_rgba(114,240,180,0.35)]">
              <Paperclip size={24} />
            </div>
            <p className="text-sm font-extrabold text-text-hi">Upuść pliki tutaj, aby dodać je do czatu z AI</p>
            <p className="text-[11px] text-content-muted">Obsługuje screenshoty, zadania ze zdjęć, pliki PDF oraz pliki tekstowe</p>
          </div>
        )}

        {/* ─── HEADER CZATU ─── */}
        <header className="px-4.5 sm:px-5 py-2.5 sm:py-3 border-b border-line-strong flex items-center justify-between bg-base-100/40 backdrop-blur-md flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <AIAssistantIcon
              size="sm"
              variant="badge"
              state={isThinking ? 'thinking' : 'online'}
              glow={true}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-text-hi tracking-tight flex items-center gap-1.5">
                  Asystent Lektora CRIBRO
                </h3>
                <span className="text-[9px] font-mono uppercase bg-primary/15 text-primary border border-primary/30 px-2 py-0.2 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse" />
                  Gemini 2.5 Flash & Workspace
                </span>
              </div>
              <p className="text-[11px] text-content-muted mt-0.2">
                Inteligentny asystent lekcji, analizy dokumentów i bazy Notion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                pendingAttachments.length > 0
                  ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(114,240,180,0.25)]'
                  : 'border-line-strong bg-white/[0.04] hover:bg-primary/15 hover:border-primary/40 text-content-muted hover:text-primary'
              }`}
              title="Załącz plik (PDF, screenshot, notatki)"
            >
              <Paperclip size={13} />
              <span className="hidden sm:inline text-xs">Załącz</span>
              {pendingAttachments.length > 0 && (
                <span className="px-1.5 py-0.2 bg-primary text-accent-ink rounded-full text-[9px] font-bold">
                  {pendingAttachments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
              className={`px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_12px_rgba(114,240,180,0.2)]'
                  : 'border-line-strong bg-white/[0.04] text-content-muted hover:text-text-hi hover:bg-white/[0.08]'
              }`}
              title={viewMode === 'history' ? 'Wróć do aktywnego czatu' : 'Historia poprzednich rozmów'}
            >
              <History size={13} />
              <span className="hidden sm:inline text-xs">Historia</span>
              {sessions.length > 0 && <span className="opacity-70 font-mono text-[10px]">({sessions.length})</span>}
            </button>

            <button
              type="button"
              onClick={startNewSession}
              className="px-3 py-1 rounded-xl bg-primary text-accent-ink hover:brightness-110 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(114,240,180,0.3)] hover:scale-[1.02]"
              title="Rozpocznij nowy wątek rozmowy"
            >
              <Plus size={13} className="stroke-[3]" />
              <span className="hidden sm:inline text-xs">Nowy czat</span>
            </button>
          </div>
        </header>

        {/* ─── WIDOK: HISTORIA ROZMÓW ─── */}
        {viewMode === 'history' ? (
          <div className="p-4 max-h-[340px] overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-line-soft">
              <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                <History size={13} className="text-primary" /> Zapisane sesje rozmów ({sessions.length})
              </span>
              <button
                onClick={startNewSession}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Nowa rozmowa
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-10 text-content-muted">
                <History className="w-9 h-9 mx-auto mb-1.5 opacity-30 text-primary" />
                <p className="font-semibold text-xs text-text-hi">Brak wcześniejszych rozmów w historii.</p>
                <p className="text-[11px] mt-0.5">Zadaj pierwsze pytanie asystentowi, a wątek zostanie tu zapisany.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      currentSessionId === s.id
                        ? 'bg-primary/15 border-primary/50 text-text-hi shadow-[0_0_16px_rgba(114,240,180,0.15)] ring-1 ring-primary/40'
                        : 'bg-base-100/70 border-line-strong text-content-muted hover:bg-base-100 hover:text-text-hi hover:border-primary/40'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-text-hi truncate">{s.title}</p>
                      <p className="text-[10px] text-content-muted mt-0.5 flex items-center gap-1.5 font-mono">
                        <span>{new Date(s.createdAt).toLocaleDateString('pl-PL')}</span>
                        <span>·</span>
                        <span>{s.messages?.length || 0} wiadomości</span>
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="p-1.5 text-content-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
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
          /* ─── WIDOK: CHAT STRUMIEŃ ─── */
          <div className="flex flex-col flex-1 min-h-[220px]">
            {/* Okno Wiadomości */}
            <div
              ref={scrollRef}
              className={`p-3 sm:p-4 flex-1 ${
                messages.length === 0
                  ? 'overflow-visible'
                  : 'min-h-[160px] max-h-[580px] overflow-y-auto scroll-smooth'
              } space-y-3`}
            >
              {/* STAN POWITALNY (COPILOT HUB) */}
              {messages.length === 0 ? (
                <div className="py-2 sm:py-2.5 space-y-2.5">
                  {/* Hero greeting */}
                  <div className="flex items-center justify-center gap-3 text-center sm:text-left max-w-xl mx-auto">
                    <AIAssistantIcon size="sm" variant="avatar" state="idle" glow={true} className="shrink-0" />
                    <div>
                      <h4 className="text-sm font-extrabold text-text-hi tracking-tight">
                        W czym mogę Ci dzisiaj pomóc?
                      </h4>
                      <p className="text-[11px] text-content-muted leading-snug">
                        Wybierz gotowy temat poniżej, wklej notatki lub zadaj pytanie w polu tekstowym:
                      </p>
                    </div>
                  </div>

                  {/* Kafelki propozycji rozmów */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-w-4xl mx-auto">
                    {STARTER_PROMPTS.map((starter, sIdx) => {
                      const IconComp = starter.icon;
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => ask(starter.prompt)}
                          disabled={isThinking}
                          className="group text-left p-2 rounded-xl border border-line-strong bg-base-100/60 hover:bg-primary/[0.08] hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-[0_2px_14px_rgba(114,240,180,0.1)] hover:-translate-y-0.5 flex items-start gap-2 min-h-[50px]"
                        >
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <IconComp size={12} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-mono uppercase tracking-wider text-primary font-bold truncate">
                                {starter.category}
                              </span>
                              <ArrowRight size={10} className="text-content-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100 shrink-0" />
                            </div>
                            <p className="text-xs font-bold text-text-hi group-hover:text-primary transition-colors truncate">
                              {starter.title}
                            </p>
                            <p className="text-[10px] text-content-muted line-clamp-1 leading-tight mt-0.5">
                              {starter.prompt}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* STRUMIEŃ WIADOMOŚCI */
                messages.map((message, idx) => (
                  <div key={idx} className="space-y-1.5 animate-fadeIn">
                    {/* WIADOMOŚĆ UŻYTKOWNIKA */}
                    {message.role === 'user' ? (
                      <div className="flex items-end justify-end gap-2 max-w-[88%] sm:max-w-[80%] ml-auto">
                        <div className="bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/35 text-text-hi p-3 rounded-2xl rounded-tr-xs shadow-sm space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-[9px] text-primary/80 font-mono">
                            <span className="font-bold">Lektor</span>
                            {message.timestamp && (
                              <span className="opacity-70">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </div>

                          {/* Załączniki w wiadomości lektora */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5 pb-0.5">
                              {message.attachments.map((att, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-base-100/90 border border-primary/30 text-[11px] font-mono"
                                >
                                  {att.type === 'image' && att.dataUrl ? (
                                    <img src={att.dataUrl} alt={att.name} className="w-5 h-5 rounded object-cover border border-primary/20" />
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

                          <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap font-medium">
                            {message.text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* WIADOMOŚĆ ASYSTENTA AI */
                      <div className="flex items-start gap-2.5 max-w-[94%] sm:max-w-[90%] mr-auto">
                        <AIAssistantIcon size="xs" variant="avatar" state="online" glow={false} className="mt-1" />

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="bg-base-100/95 border border-line-strong text-content p-3 sm:p-4 rounded-2xl rounded-tl-xs shadow-md space-y-2">
                            <div className="flex items-center justify-between border-b border-line-soft pb-1.5 text-[10px] text-content-muted font-mono">
                              <span className="font-bold text-primary flex items-center gap-1">
                                <Sparkles size={11} /> Asystent CRIBRO AI
                              </span>
                              <div className="flex items-center gap-2">
                                {message.timestamp && (
                                  <span className="opacity-70">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => copyMessage(idx, message.text)}
                                  className="p-1 hover:text-text-hi rounded transition-colors flex items-center gap-1 cursor-pointer text-[9px]"
                                  title="Kopiuj treść odpowiedzi"
                                >
                                  {copiedMsgIdx === idx ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
                                  <span>{copiedMsgIdx === idx ? 'Skopiowano' : 'Kopiuj'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Podgląd karty lekcji Notion AI */}
                            {message.lessonDraft && (
                              <div className="p-3 rounded-xl bg-base-300/80 border border-primary/40 text-xs space-y-2 shadow-inner">
                                <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                                  <div className="flex items-center gap-1 font-bold text-primary">
                                    <Sparkles size={12} />
                                    <span className="uppercase tracking-wider text-[10px]">Propozycja lekcji AI (Notion Sync)</span>
                                  </div>
                                  {message.lessonDraft.studentName && (
                                    <span className="text-[9px] px-2 py-0.2 rounded-full bg-primary/20 text-primary font-mono font-bold border border-primary/30">
                                      {message.lessonDraft.studentName}
                                    </span>
                                  )}
                                </div>
                                <div className="font-black text-xs sm:text-sm text-text-hi">{message.lessonDraft.topic}</div>
                                {message.lessonDraft.summary && (
                                  <div className="text-content-muted leading-relaxed text-[11px]">
                                    {message.lessonDraft.summary}
                                  </div>
                                )}
                                {message.lessonDraft.vocabulary && (
                                  <div>
                                    <span className="font-bold text-primary text-[10px] block uppercase tracking-wide mb-0.5">
                                      Kluczowe słownictwo:
                                    </span>
                                    <div className="text-content text-[11px] font-mono whitespace-pre-line bg-base-100/80 p-2 rounded-lg border border-line-strong">
                                      {message.lessonDraft.vocabulary}
                                    </div>
                                  </div>
                                )}
                                {message.lessonDraft.grammar && (
                                  <div className="text-[11px] text-content-muted flex items-start gap-1">
                                    <span className="font-bold text-amber-300 shrink-0">Gramatyka / Akcent:</span>
                                    <span>{message.lessonDraft.grammar}</span>
                                  </div>
                                )}
                                {message.lessonDraft.homework && (
                                  <div className="text-[11px] text-content-muted flex items-start gap-1">
                                    <span className="font-bold text-accent-light shrink-0">Zadanie domowe:</span>
                                    <span>{message.lessonDraft.homework}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Główna treść odpowiedzi tekstowej (bogato sformatowany Markdown) */}
                            <div className="text-xs sm:text-[13px] leading-relaxed font-normal space-y-2 text-content">
                              <Markdown
                                components={{
                                  h1: ({ children }) => (
                                    <h3 className="text-sm font-black text-text-hi border-b border-line-soft pb-1 mt-2.5 mb-1.5 flex items-center gap-1.5">
                                      {children}
                                    </h3>
                                  ),
                                  h2: ({ children }) => (
                                    <h4 className="text-[13px] font-extrabold text-primary border-b border-primary/20 pb-1 mt-2 mb-1 flex items-center gap-1.5">
                                      {children}
                                    </h4>
                                  ),
                                  h3: ({ children }) => (
                                    <h5 className="text-xs font-bold text-text-hi mt-2 mb-1 flex items-center gap-1">
                                      {children}
                                    </h5>
                                  ),
                                  p: ({ children }) => (
                                    <p className="leading-relaxed mb-1.5 text-content last:mb-0">
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
                                    <li className="leading-relaxed pl-0.5 text-content">
                                      {children}
                                    </li>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="font-bold text-text-hi bg-primary/10 text-primary px-1 py-0.2 rounded-md">
                                      {children}
                                    </strong>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="pl-3 border-l-2 border-primary/60 text-content-muted italic my-2 bg-primary/5 py-1.5 pr-2 rounded-r-xl">
                                      {children}
                                    </blockquote>
                                  ),
                                  code: ({ children }) => (
                                    <code className="font-mono text-[11px] bg-base-300/90 text-amber-300 px-1.5 py-0.5 rounded border border-line-strong">
                                      {children}
                                    </code>
                                  ),
                                }}
                              >
                                {message.text}
                              </Markdown>
                            </div>
                          </div>

                          {/* 1-klikowe akcje Notion AI pod odpowiedzią */}
                          {message.actions && message.actions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5 pl-1">
                              {message.actions.map((act, aIdx) => {
                                const isPrimary = act.type === 'insert_lesson' || act.type === 'presentation';
                                return (
                                  <button
                                    key={aIdx}
                                    type="button"
                                    onClick={() => handleExecuteAction(act)}
                                    className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border text-[11px] font-bold transition-all hover:scale-[1.02] shadow-sm cursor-pointer ${
                                      isPrimary
                                        ? 'border-primary bg-primary text-accent-ink hover:brightness-110 shadow-[0_0_12px_rgba(114,240,180,0.35)]'
                                        : 'border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary hover:border-primary/60'
                                    }`}
                                  >
                                    {act.type === 'insert_lesson' && <CheckCircle2 size={12} />}
                                    {act.type === 'presentation' && <Airplay size={12} />}
                                    {act.type === 'homework' && <ClipboardList size={12} />}
                                    {act.type === 'planner' && <BookOpen size={12} />}
                                    {act.type === 'scratchpad' && <FileText size={12} />}
                                    {act.type === 'mailing' && <Mail size={12} />}
                                    {act.type === 'profile' && <User size={12} />}
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
                ))
              )}

              {/* STAN GENEROWANIA / THINKING */}
              {isThinking && (
                <div className="flex items-center gap-2.5 animate-fadeIn">
                  <AIAssistantIcon size="xs" variant="avatar" state="thinking" glow={true} />
                  <div className="rounded-xl p-2.5 px-3 bg-base-100/90 border border-primary/40 text-content flex items-center gap-2.5 shadow-md">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    </div>
                    <span className="text-xs text-primary font-medium">
                      Asystent analizuje dane z CRM i Notion oraz przygotowuje odpowiedź…
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-danger p-2.5 rounded-xl bg-danger/10 border border-danger/25">
                  {error}
                </p>
              )}
            </div>

            {/* SZYBKIE PODPOWIEDZI (FOLLOW-UP) PODCZAS AKTYWNEJ ROZMOWY */}
            {messages.length > 0 && (
              <div className="px-4 py-1.5 border-t border-line-soft bg-base-100/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[9px] uppercase font-bold text-content-muted shrink-0 flex items-center gap-1 font-mono">
                  <Sparkles size={10} className="text-primary" /> Zapytaj:
                </span>
                {QUICK_FOLLOWUPS.map((followup, fIdx) => (
                  <button
                    key={fIdx}
                    type="button"
                    onClick={() => ask(followup)}
                    disabled={isThinking}
                    className="shrink-0 px-2 py-0.5 rounded-md border border-line-strong bg-base-100/60 hover:bg-primary/15 hover:border-primary/40 text-[10px] text-text-2 hover:text-primary transition-all cursor-pointer disabled:opacity-50"
                  >
                    {followup}
                  </button>
                ))}
              </div>
            )}

            {/* ZAŁĄCZNIKI OCZEKUJĄCE (CHIPS PREVIEW) */}
            {pendingAttachments.length > 0 && (
              <div className="px-3.5 py-1.5 border-t border-line-soft bg-base-200/50 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-primary uppercase font-mono mr-1">
                  Do analizy ({pendingAttachments.length}):
                </span>
                {pendingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-1 py-0.5 px-2 rounded-lg bg-base-100 border border-primary/30 text-[11px] text-text-hi shadow-sm"
                  >
                    {att.type === 'image' && att.dataUrl ? (
                      <img src={att.dataUrl} alt={att.name} className="w-3.5 h-3.5 rounded object-cover" />
                    ) : att.type === 'pdf' ? (
                      <PdfIcon size={12} className="text-danger" />
                    ) : (
                      <FileCode size={12} className="text-primary" />
                    )}
                    <span className="truncate max-w-[110px] font-medium">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(att.id)}
                      className="p-0.5 text-content-muted hover:text-danger rounded transition-colors cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ─── KOMPOZYTOR / POLE CZATU ─── */}
            <div className="p-2.5 sm:p-3 border-t border-line-strong bg-base-100/60 backdrop-blur-xl">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(draft);
                }}
                className="relative rounded-xl border border-line-strong bg-base-200/90 focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/25 shadow-inner transition-all flex flex-col p-1.5 sm:p-2"
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  rows={1}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      ask(draft);
                    }
                  }}
                  placeholder={
                    pendingAttachments.length > 0
                      ? `Polecenie dla ${pendingAttachments.length} załącznika(ów) (Enter)…`
                      : index
                      ? 'Napisz wiadomość (np. Przygotuj lekcję dla Dariusza)...'
                      : 'Ładuję indeks kursantów CRM…'
                  }
                  disabled={isThinking}
                  className="w-full px-2 py-1 bg-transparent text-xs sm:text-sm text-text-hi placeholder:text-content-muted focus:outline-none resize-none min-h-[28px] max-h-[90px] leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 px-2 rounded-lg text-content-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                      title="Załącz plik PDF, screenshot lub notatki"
                    >
                      <Paperclip size={13} />
                      <span className="hidden sm:inline text-[10px]">Załącz</span>
                    </button>
                    <span className="text-[9px] text-content-muted hidden md:inline font-mono opacity-60">
                      Wklejanie schowka (Ctrl+V)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-content-muted hidden sm:inline font-mono opacity-60">
                      Enter ↵ wyślij
                    </span>
                    <button
                      type="submit"
                      disabled={(!draft.trim() && pendingAttachments.length === 0) || isThinking}
                      className="h-7 px-3 rounded-lg bg-primary text-accent-ink font-bold flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-default cursor-pointer hover:brightness-110 shadow-[0_0_10px_rgba(114,240,180,0.3)] transition-all text-xs"
                      title="Wyślij wiadomość"
                    >
                      {isThinking ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      <span>Zapytaj</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     TRYB FLOATING — PŁYWAJĄCY DYMEK W LEWYM DOLNYM ROGU EKRANU
     ═══════════════════════════════════════════════════════════════════ */
  const panel = (
    <div
      className="fixed bottom-0 left-4 z-[9998] pointer-events-none flex flex-col items-start justify-end max-h-[100dvh]"
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
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title="Asystent CRIBRO AI — zapytaj o kursantów i moduły"
          className={`h-11 px-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all cursor-pointer ${
            isOpen
              ? 'border-primary/60 bg-primary/20 text-primary ring-2 ring-primary/30 shadow-[0_0_20px_rgba(114,240,180,0.3)]'
              : 'border-primary/30 bg-ink-2/95 text-text-hi hover:border-primary hover:shadow-[0_0_15px_rgba(114,240,180,0.25)]'
          }`}
        >
          {isOpen ? (
            <X size={16} />
          ) : (
            <AIAssistantIcon size="xs" variant="badge" state={isThinking ? 'thinking' : 'online'} glow={false} />
          )}
          <span>Asystent AI</span>
        </button>

        {isOpen && (
          <div
            onPaste={handlePaste}
            className="mb-2 w-[92vw] sm:w-[460px] max-h-[75vh] flex flex-col rounded-2xl border border-primary/30 bg-ink-2/95 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.6)] overflow-hidden animate-fadeIn"
          >
            {/* Header */}
            <header className="px-4 py-2.5 border-b border-line-soft flex items-center justify-between bg-base-300/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <AIAssistantIcon size="xs" variant="badge" state={isThinking ? 'thinking' : 'online'} glow={true} />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-text-hi truncate">Asystent Lektora CRIBRO</p>
                  <p className="text-[10px] text-content-muted truncate">
                    Zadawaj pytania, analizuj pliki i generuj lekcje
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => floatingFileInputRef.current?.click()}
                  className="p-1.5 rounded-lg border border-white/10 text-content-muted hover:text-primary hover:border-primary/30 transition-colors"
                  title="Załącz plik"
                >
                  <Paperclip size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    viewMode === 'history'
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'border-white/10 text-content-muted hover:text-white'
                  }`}
                  title={viewMode === 'history' ? 'Wróć do czatu' : 'Historia rozmów'}
                >
                  <History size={13} />
                </button>
                <button
                  type="button"
                  onClick={startNewSession}
                  className="p-1.5 rounded-lg border border-white/10 text-content-muted hover:text-primary hover:border-primary/30 transition-colors"
                  title="Nowa rozmowa"
                >
                  <Plus size={13} />
                </button>
              </div>
            </header>

            {/* Widok historii w trybie floating */}
            {viewMode === 'history' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="flex items-center justify-between pb-1 mb-2 border-b border-white/10">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
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
                  <p className="text-xs text-content-muted text-center py-8">
                    Brak wcześniejszych rozmów w historii.
                  </p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        currentSessionId === s.id
                          ? 'bg-primary/15 border-primary/40 text-white'
                          : 'bg-white/5 border-white/5 text-content-muted hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate">{s.title}</p>
                        <p className="text-[10px] opacity-60 font-mono">
                          {new Date(s.createdAt).toLocaleDateString()} · {s.messages?.length || 0} wiadomości
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteSession(s.id, e)}
                        className="p-1 text-content-muted hover:text-danger rounded hover:bg-white/10"
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
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-2.5">
                    <div className="text-center py-2">
                      <AIAssistantIcon size="md" variant="avatar" state="idle" glow={true} className="mx-auto mb-1.5" />
                      <p className="text-xs text-content-muted leading-relaxed">
                        W czym mogę pomóc? Wybierz szybki temat lub wpisz własne pytanie:
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {STARTER_PROMPTS.slice(0, 4).map((starter, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => ask(starter.prompt)}
                          disabled={!index || isThinking}
                          className="w-full text-left px-3 py-2 rounded-xl border border-line-strong bg-white/[0.03] text-xs text-text-2 hover:text-content hover:bg-white/[0.07] hover:border-primary/30 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-between"
                        >
                          <span className="truncate">{starter.title}</span>
                          <ChevronRight size={12} className="opacity-40" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, idx) => (
                  <div key={idx} className="space-y-2">
                    <div
                      className={`max-w-[92%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                        message.role === 'user'
                          ? 'ml-auto bg-primary/15 border border-primary/30 text-text-hi font-medium rounded-tr-xs'
                          : 'bg-base-200/90 border border-line text-content shadow-sm rounded-tl-xs'
                      }`}
                    >
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5 pb-1.5 border-b border-primary/20">
                          {message.attachments.map((att, aIdx) => (
                            <div key={aIdx} className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-base-100/70 text-[11px]">
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

                      {/* Podgląd karty lekcji w Floating */}
                      {message.lessonDraft && (
                        <div className="mt-2 p-2.5 rounded-lg bg-base-300/80 border border-primary/40 text-[11px] space-y-1.5 shadow-inner">
                          <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                            <div className="flex items-center gap-1 font-bold text-primary">
                              <Sparkles size={12} />
                              <span className="uppercase tracking-wider text-[10px]">Karta lekcji AI</span>
                            </div>
                            {message.lessonDraft.studentName && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold border border-primary/30">
                                {message.lessonDraft.studentName}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-xs text-text-hi">{message.lessonDraft.topic}</div>
                          {message.lessonDraft.vocabulary && (
                            <div className="text-[10px] font-mono whitespace-pre-line bg-base-100/70 p-1.5 rounded border border-line-strong text-content">
                              {message.lessonDraft.vocabulary}
                            </div>
                          )}
                        </div>
                      )}

                      {message.text}
                    </div>

                    {/* Action buttons */}
                    {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                        {message.actions.map((act, aIdx) => {
                          const isPrimary = act.type === 'insert_lesson' || act.type === 'presentation';
                          return (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => handleExecuteAction(act)}
                              className={`flex items-center gap-1 py-1 px-2 rounded-lg border text-[11px] font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                                isPrimary
                                  ? 'border-primary bg-primary text-accent-ink font-bold'
                                  : 'border-primary/30 bg-primary/10 hover:bg-primary/25 text-primary'
                              }`}
                            >
                              {act.type === 'insert_lesson' && <CheckCircle2 size={11} />}
                              {act.type === 'presentation' && <Airplay size={11} />}
                              {act.type === 'homework' && <ClipboardList size={11} />}
                              {act.type === 'planner' && <BookOpen size={11} />}
                              {act.type === 'scratchpad' && <FileText size={11} />}
                              <span>{act.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 text-xs text-content-muted">
                    <Loader2 size={13} className="animate-spin text-primary" /> Analizuję dane i przygotowuję odpowiedź…
                  </div>
                )}

                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
            )}

            {/* Załączniki oczekujące (Floating) */}
            {pendingAttachments.length > 0 && (
              <div className="px-3 py-1.5 border-t border-line-soft bg-base-300/40 flex flex-wrap gap-1.5 items-center">
                {pendingAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-1 py-0.5 px-2 rounded-lg bg-base-100 border border-primary/30 text-[11px] text-text-hi">
                    <span className="truncate max-w-[90px]">{att.name}</span>
                    <button type="button" onClick={() => removePendingAttachment(att.id)} className="text-content-muted hover:text-danger">
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
                className="p-2.5 border-t border-line-soft flex items-center gap-2 bg-base-300/30"
              >
                <button
                  type="button"
                  onClick={() => floatingFileInputRef.current?.click()}
                  className="p-2 rounded-xl border border-line-strong bg-ink text-content-muted hover:text-primary transition-colors cursor-pointer"
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
                      ? 'Zapytaj o kursanta lub zleć akcję…'
                      : 'Wczytuję listę kursantów…'
                  }
                  disabled={!index || isThinking}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-ink border border-line-strong text-[13px] text-content placeholder:text-text-faint focus:outline-none focus:border-primary/55 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={(!draft.trim() && pendingAttachments.length === 0) || isThinking || !index}
                  className="shrink-0 h-9 w-9 rounded-xl bg-primary text-accent-ink flex items-center justify-center disabled:opacity-40 disabled:cursor-default cursor-pointer hover:brightness-110 transition-all"
                  aria-label="Wyślij pytanie"
                >
                  <Send size={15} />
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

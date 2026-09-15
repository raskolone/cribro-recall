import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  MessageCircle,
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
} from 'lucide-react';
import {
  askTeacherAssistant,
  buildStudentIndex,
  AssistantMessage,
  StudentIndexEntry,
  AssistantAction,
  ChatSession,
} from '../../services/teacherAssistant';

const STORAGE_KEY = 'cribro_teacher_assistant_sessions_v1';

const SUGGESTIONS = [
  'Co ostatnio robiłem z Bartkiem?',
  'Kto najdłużej nie miał lekcji?',
  'Jakie słownictwo przerabiałem z Moniką?',
  'Zadaj pracę domową z Present Perfect',
];

interface TeacherAssistantProps {
  onNavigateToModule?: (module: string, extra?: any) => void;
  onSelectStudent?: (studentId: string) => void;
}

const TeacherAssistant: React.FC<TeacherAssistantProps> = ({
  onNavigateToModule,
  onSelectStudent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Save sessions to storage
  const saveSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions.slice(0, 20)));
    } catch {}
  };

  /* Spis kursantów budujemy dopiero przy pierwszym otwarciu — zamknięty
     asystent nie kosztuje ani jednego odczytu. */
  useEffect(() => {
    if (!isOpen || index) return;
    buildStudentIndex()
      .then(setIndex)
      .catch((err) => {
        console.error('[Asystent] Spis kursantów:', err);
        setError('Nie udało się wczytać listy kursantów.');
      });
  }, [isOpen, index]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  const startNewSession = () => {
    if (messages.length > 0) {
      // Save existing session if it has user messages
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
    setViewMode('chat');
    setError('');
  };

  const loadSession = (sess: ChatSession) => {
    setCurrentSessionId(sess.id);
    setMessages(sess.messages || []);
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
    if (!trimmed || isThinking || !index) return;

    const userMsg: AssistantMessage = {
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setDraft('');
    setIsThinking(true);
    setError('');

    try {
      const { text, actions } = await askTeacherAssistant(trimmed, index, messages);
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        text,
        actions,
        timestamp: Date.now(),
      };
      const updatedMessages = [...nextHistory, assistantMsg];
      setMessages(updatedMessages);

      // Auto update session in storage
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

    if (action.type === 'homework') {
      onNavigateToModule?.('homework', { studentId: action.studentId });
    } else if (action.type === 'planner') {
      onNavigateToModule?.('lesson-planner', { studentId: action.studentId, topic: action.topic });
    } else if (action.type === 'scratchpad') {
      onNavigateToModule?.('scratchpad', { studentId: action.studentId });
    } else if (action.type === 'mailing') {
      onNavigateToModule?.('mailing', { studentId: action.studentId });
    } else if (action.type === 'profile') {
      onNavigateToModule?.('profile', { studentId: action.studentId });
    }
  };

  const panel = (
    <div
      className="fixed bottom-0 left-4 z-[9998] pointer-events-none flex flex-col items-start justify-end max-h-[100dvh]"
      style={{ paddingBottom: 'var(--rail-base)' }}
    >
      <div className="pointer-events-auto flex flex-col-reverse items-start">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title="Asystent AI — zapytaj o kursantów i moduły"
          className={`h-11 px-3.5 rounded-2xl border flex items-center gap-2 text-xs font-semibold shadow-[var(--shadow-md)] backdrop-blur-xl transition-colors cursor-pointer ${
            isOpen
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-line-strong bg-ink-2/90 text-content-muted hover:text-text-hi hover:border-primary/40'
          }`}
        >
          {isOpen ? <X size={16} /> : <MessageCircle size={16} />}
          <span className="hidden sm:inline">Asystent AI</span>
        </button>

        {isOpen && (
          <div className="mb-2 w-[92vw] sm:w-[440px] max-h-[75vh] flex flex-col rounded-2xl border border-line-strong bg-ink-2/95 backdrop-blur-2xl shadow-[var(--shadow-lg)] overflow-hidden animate-fade-in">
            {/* Header */}
            <header className="px-4 py-2.5 border-b border-line-soft flex items-center justify-between bg-base-300/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
                  <Sparkles size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-hi">Asystent Lektora AI</p>
                  <p className="text-[10px] text-content-muted truncate">
                    Dostęp do notatek, prac domowych i planera
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
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
                  <History size={14} />
                </button>
                <button
                  type="button"
                  onClick={startNewSession}
                  className="p-1.5 rounded-lg border border-white/10 text-content-muted hover:text-primary hover:border-primary/30 transition-colors"
                  title="Nowa rozmowa"
                >
                  <Plus size={14} />
                </button>
              </div>
            </header>

            {/* View Mode: History */}
            {viewMode === 'history' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="flex items-center justify-between pb-1 mb-2 border-b border-white/10">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Historia rozmów ({sessions.length})
                  </span>
                  <button
                    onClick={startNewSession}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
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
                        <p className="text-[10px] opacity-60">
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
              /* View Mode: Chat */
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-content-muted leading-relaxed">
                      Zadaj dowolne pytanie o kursanta lub poproś o wygenerowanie materiałów.
                    </p>
                    <div className="space-y-1.5">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => ask(suggestion)}
                          disabled={!index}
                          className="w-full text-left px-3 py-2 rounded-xl border border-line-strong bg-white/[0.03] text-xs text-text-2 hover:text-content hover:bg-white/[0.07] transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {suggestion}
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
                          ? 'ml-auto bg-primary/15 border border-primary/25 text-text-hi font-medium'
                          : 'bg-base-200/80 border border-line text-content shadow-sm'
                      }`}
                    >
                      {message.text}
                    </div>

                    {/* Action buttons suggested by Assistant */}
                    {message.role === 'assistant' &&
                      message.actions &&
                      message.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                          {message.actions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => handleExecuteAction(act)}
                              className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/25 text-primary text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm"
                            >
                              {act.type === 'homework' && <ClipboardList size={12} />}
                              {act.type === 'planner' && <BookOpen size={12} />}
                              {act.type === 'scratchpad' && <FileText size={12} />}
                              {act.type === 'mailing' && <Mail size={12} />}
                              {act.type === 'profile' && <User size={12} />}
                              <span>{act.label}</span>
                              <ChevronRight size={11} className="opacity-60" />
                            </button>
                          ))}
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

            {/* Input Form */}
            {viewMode === 'chat' && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(draft);
                }}
                className="p-2.5 border-t border-line-soft flex items-center gap-2 bg-base-300/30"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={index ? 'Zapytaj o kursanta lub zleć akcję…' : 'Wczytuję listę kursantów…'}
                  disabled={!index || isThinking}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-ink border border-line-strong text-[13px] text-content placeholder:text-text-faint focus:outline-none focus:border-primary/55 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isThinking || !index}
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

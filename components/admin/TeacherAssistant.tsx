import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import {
  askTeacherAssistant,
  buildStudentIndex,
  AssistantMessage,
  StudentIndexEntry,
} from '../../services/teacherAssistant';

/**
 * Asystent lektora — PROTOTYP.
 *
 * ══ DLACZEGO PŁYWAJĄCY, A NIE EKRAN ══
 *
 * Pytanie „co ostatnio robiłem z Bartkiem" pada W TRAKCIE robienia czegoś
 * innego: przy układaniu pracy domowej, przy planowaniu tygodnia, minutę przed
 * lekcją. Osobny ekran kazałby porzucić to, co się robi, zadać pytanie i wrócić
 * — czyli dokładnie tyle zachodu, ile kosztuje sprawdzenie tego ręcznie.
 *
 * ══ CO WIE, A CZEGO NIE ══
 *
 * Czyta notatki z lekcji i spis kursantów. Nie zna prac domowych, testów ani
 * statystyk i niczego nie zmienia w bazie. To jest zakres prototypu wypisany
 * wprost — łatwiej rozszerzyć coś, co mówi, gdzie się kończy, niż zgadywać,
 * czemu odpowiedź była niepełna.
 */

const SUGGESTIONS = [
  'Co ostatnio robiłem z Bartkiem?',
  'Kto najdłużej nie miał lekcji?',
  'Jakie słownictwo przerabiałem z Moniką?',
];

const TeacherAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState<StudentIndexEntry[] | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Spis kursantów budujemy dopiero przy pierwszym otwarciu — zamknięty
     asystent nie kosztuje ani jednego odczytu. */
  useEffect(() => {
    if (!isOpen || index) return;
    buildStudentIndex()
      .then(setIndex)
      .catch(err => {
        console.error('[Asystent] Spis kursantów:', err);
        setError('Nie udało się wczytać listy kursantów.');
      });
  }, [isOpen, index]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isThinking || !index) return;

    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setDraft('');
    setIsThinking(true);
    setError('');

    try {
      const { text } = await askTeacherAssistant(trimmed, index, messages);
      setMessages([...nextHistory, { role: 'assistant', text }]);
    } catch (err: any) {
      console.error('[Asystent] Odpowiedź nie powstała:', err);
      setError(err?.message || 'Model nie odpowiedział.');
    } finally {
      setIsThinking(false);
    }
  };

  const panel = (
    <div className="fixed bottom-0 left-4 z-[9998] pointer-events-none flex flex-col items-start justify-end max-h-[100dvh]"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex flex-col-reverse items-start">
        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          title="Asystent — zapytaj o swoich kursantów"
          className={`h-11 px-3.5 rounded-2xl border flex items-center gap-2 text-xs font-semibold shadow-[var(--shadow-md)] backdrop-blur-xl transition-colors cursor-pointer ${
            isOpen
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-line-strong bg-ink-2/90 text-content-muted hover:text-text-hi hover:border-primary/40'
          }`}
        >
          {isOpen ? <X size={16} /> : <MessageCircle size={16} />}
          <span className="hidden sm:inline">Asystent</span>
        </button>

        {isOpen && (
          <div className="mb-2 w-[92vw] sm:w-[420px] max-h-[70vh] flex flex-col rounded-2xl border border-line-strong bg-ink-2/95 backdrop-blur-2xl shadow-[var(--shadow-lg)] overflow-hidden">
            <header className="px-4 py-3 border-b border-line-soft flex items-center gap-2.5">
              <Sparkles size={15} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-hi">Asystent</p>
                <p className="text-[11px] text-content-muted truncate">
                  Pyta o notatki z lekcji Twoich kursantów · prototyp
                </p>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs text-content-muted leading-relaxed">
                    Zapytaj zwykłym zdaniem. Odpowiadam z notatek lekcyjnych — nie znam prac
                    domowych ani testów.
                  </p>
                  {SUGGESTIONS.map(suggestion => (
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
              )}

              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`max-w-[92%] px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'ml-auto bg-primary/15 border border-primary/25 text-text-hi'
                      : 'bg-base-200/70 border border-line text-content'
                  }`}
                >
                  {message.text}
                </div>
              ))}

              {isThinking && (
                <div className="flex items-center gap-2 text-xs text-content-muted">
                  <Loader2 size={13} className="animate-spin text-primary" /> Czytam notatki…
                </div>
              )}

              {error && <p className="text-xs text-danger">{error}</p>}
            </div>

            <form
              onSubmit={event => {
                event.preventDefault();
                ask(draft);
              }}
              className="p-2.5 border-t border-line-soft flex items-center gap-2"
            >
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder={index ? 'Zapytaj o kursanta…' : 'Wczytuję listę kursantów…'}
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
          </div>
        )}
      </div>
    </div>
  );

  // Portal do <body>, tak samo jak monitor AI: poza `#root` żaden kontener
  // z `transform` nie odczepi panelu od krawędzi okna.
  if (typeof window === 'undefined' || !window.document?.body) return panel;
  return createPortal(panel, window.document.body);
};

export default TeacherAssistant;

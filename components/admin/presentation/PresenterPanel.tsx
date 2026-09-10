import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, ExternalLink, Play, Square, Timer,
  Radio, Users, Copy, Check, LogOut, Share2, Sparkles, X, AlertCircle
} from 'lucide-react';
import { 
  LessonPresentation, 
  LiveCorrectionItem, 
  LiveVocabItem, 
  PresentationSlide,
  LiveSession,
  LiveSessionStudent
} from '../../../types';
import { PRESENTER_PATH, PresenterLink, openPresenterLink } from '../../../utils/presenterChannel';
import { 
  createLiveSession, 
  updateLiveSessionState, 
  subscribeLiveSession, 
  endLiveSession,
  buildLiveSessionUrl 
} from '../../../services/liveSessionService';
import { formatAccessCode } from '../../../utils/accessCode';
import { EMPTY_SLIDE_INTERACTION, SlideInteraction } from './SlideCard';
import type { Shape } from './whiteboardShapes';
import SlideTimer from './SlideTimer';
import Button from '../../ui/Button';
import { useAuth } from '../../../context/AuthContext';

/**
 * Panel prowadzącego — zostaje na ekranie lektora, gdy okno ze slajdem idzie
 * do kursanta (zarówno przez BroadcastChannel, jak i przez chmurowy PIN dla kursantów zdalnych).
 */

interface PresenterPanelProps {
  deck: LessonPresentation;
  activeSlideIndex: number;
  onNavigate: (index: number) => void;
  /** Co lektor odkrył na slajdzie — leci do okna kursanta razem ze slajdem. */
  interaction?: SlideInteraction;
  /** Rysunek z tablicy, jeśli jest otwarta. */
  whiteboard?: { shapes: Shape[]; width: number; height: number } | null;
  /** Notatnik live — kursant widzi nowe słowa i poprawki na bieżąco. */
  liveNotebook?: { vocab: LiveVocabItem[]; corrections: LiveCorrectionItem[] } | null;
}

/** Czas w formacie mm:ss — lekcja rzadko przekracza godzinę. */
const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Skrót treści slajdu do podglądu — bez pełnego renderowania kolejnego slajdu. */
const slideSummary = (slide?: PresentationSlide): string => {
  if (!slide) return '';
  if (slide.content) return String(slide.content);
  if (Array.isArray(slide.items) && slide.items.length > 0) {
    return slide.items
      .map((item) => item?.term || item?.question || item?.definition || '')
      .filter(Boolean)
      .slice(0, 6)
      .join(' · ');
  }
  return '';
};

const PresenterPanel: React.FC<PresenterPanelProps> = ({
  deck,
  activeSlideIndex,
  onNavigate,
  interaction = EMPTY_SLIDE_INTERACTION,
  whiteboard = null,
  liveNotebook = null,
}) => {
  const { user } = useAuth();
  const linkRef = useRef<PresenterLink | null>(null);
  const [presenterWindow, setPresenterWindow] = useState<Window | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  /** Koniec odliczania ćwiczenia — trafia do okna kursanta, żeby widział to samo. */
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);

  // Stan chmurowej sesji Live na PIN
  const [activeLiveSession, setActiveLiveSession] = useState<LiveSession | null>(null);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const current = deck.slides[activeSlideIndex];
  const next = deck.slides[activeSlideIndex + 1];

  useEffect(() => {
    linkRef.current = openPresenterLink();
    return () => {
      linkRef.current?.close();
      linkRef.current = null;
    };
  }, []);

  // Subskrypcja stanu aktywnej sesji z Firestore (aktualizacja listy kursantów na żywo)
  useEffect(() => {
    if (!activeLiveSession?.pin) return;

    const unsubscribe = subscribeLiveSession(activeLiveSession.pin, (updated) => {
      if (updated) {
        setActiveLiveSession(updated);
      }
    });

    return () => unsubscribe();
  }, [activeLiveSession?.pin]);

  // Każda zmiana slajdu leci do okna kursanta lokalnego (BroadcastChannel) oraz chmurowego (Firestore)
  useEffect(() => {
    // 1. Lokalny BroadcastChannel
    linkRef.current?.send({
      slide: current || null,
      slideIndex: activeSlideIndex,
      totalSlides: deck.slides.length,
      deckTitle: deck.title,
      interaction,
      whiteboard,
      timerEndsAt,
      liveNotebook,
    });

    // 2. Chmurowa sesja Firestore (jeśli uruchomiona)
    if (activeLiveSession?.pin && activeLiveSession.status === 'active') {
      updateLiveSessionState(activeLiveSession.pin, {
        currentSlideIndex: activeSlideIndex,
        totalSlides: deck.slides.length,
        interaction,
        whiteboard,
        timerEndsAt,
        liveNotebook,
      }).catch((e) => console.warn('Błąd pushu stanu liveSession:', e));
    }
  }, [
    current,
    activeSlideIndex,
    deck.slides.length,
    deck.title,
    interaction,
    whiteboard,
    timerEndsAt,
    liveNotebook,
    activeLiveSession?.pin,
  ]);

  // Odliczanie należy do konkretnego ćwiczenia — przy przejściu dalej gasimy je
  useEffect(() => {
    setTimerEndsAt(null);
  }, [activeSlideIndex]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const openPresenterWindow = () => {
    const win = window.open(PRESENTER_PATH, 'cribro-presenter', 'width=1280,height=800');
    setPresenterWindow(win);
    setTimeout(() => {
      linkRef.current?.send({
        slide: current || null,
        slideIndex: activeSlideIndex,
        totalSlides: deck.slides.length,
        deckTitle: deck.title,
        interaction,
        whiteboard,
        timerEndsAt,
        liveNotebook,
      });
    }, 600);
    if (!isRunning) setIsRunning(true);
  };

  // Uruchomienie sesji w chmurze z kodem PIN
  const handleStartLiveSession = async () => {
    setIsStartingLive(true);
    try {
      const teacherName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user?.username || 'Lektor';

      const session = await createLiveSession({
        teacherUid: user?.id || 'teacher_local',
        teacherName,
        deck,
        initialSlideIndex: activeSlideIndex,
      });

      setActiveLiveSession(session);
      setIsLiveModalOpen(true);
      if (!isRunning) setIsRunning(true);
    } catch (err: any) {
      alert('Nie udało się utworzyć sesji live: ' + (err.message || err));
    } finally {
      setIsStartingLive(false);
    }
  };

  const handleEndLiveSession = async () => {
    if (!activeLiveSession?.pin) return;
    if (confirm('Czy na pewno chcesz zakończyć sesję na żywo? Kursanci zostaną powiadomieni.')) {
      try {
        await endLiveSession(activeLiveSession.pin);
        setActiveLiveSession(null);
        setIsLiveModalOpen(false);
      } catch (e) {
        console.warn('Błąd zamykania sesji:', e);
      }
    }
  };

  const copyLiveLink = () => {
    if (!activeLiveSession?.pin) return;
    const url = buildLiveSessionUrl(activeLiveSession.pin);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyPinOnly = () => {
    if (!activeLiveSession?.pin) return;
    navigator.clipboard.writeText(formatAccessCode(activeLiveSession.pin));
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2500);
  };

  const connectedStudents = activeLiveSession?.connectedStudents || [];

  return (
    <section className="rounded-2xl border border-white/10 bg-base-200/60 p-4 space-y-4 shadow-xl backdrop-blur-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
          Panel prowadzącego
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Przycisk Sesji Live z kodem PIN */}
          {activeLiveSession ? (
            <button
              onClick={() => setIsLiveModalOpen(true)}
              className="inline-flex items-center gap-2 min-h-[2.5rem] px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 transition-all shadow-lg shadow-emerald-950/20"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>PIN: <strong className="font-mono">{formatAccessCode(activeLiveSession.pin)}</strong></span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                {connectedStudents.length} online
              </span>
            </button>
          ) : (
            <button
              onClick={handleStartLiveSession}
              disabled={isStartingLive}
              className="inline-flex items-center gap-1.5 min-h-[2.5rem] px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Radio size={14} className={isStartingLive ? 'animate-spin' : 'animate-pulse'} />
              {isStartingLive ? 'Tworzenie sesji...' : 'Uruchom sesję Live (PIN)'}
            </button>
          )}

          {/* Stoper lekcji */}
          <button
            onClick={() => setIsRunning((v) => !v)}
            title={isRunning ? 'Zatrzymaj czas' : 'Licz czas lekcji'}
            className={`inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 rounded-xl border text-sm font-mono font-bold ${
              isRunning
                ? 'border-primary/35 text-primary bg-primary/10'
                : 'border-white/12 text-content-muted hover:text-white'
            }`}
          >
            <Timer size={14} />
            {formatElapsed(elapsed)}
          </button>

          {/* Minutnik ćwiczenia */}
          {current?.timerMinutes ? (
            timerEndsAt ? (
              <button
                onClick={() => setTimerEndsAt(null)}
                title="Zatrzymaj odliczanie ćwiczenia"
                className="inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 rounded-xl border border-warn/35 text-warn text-sm font-bold"
              >
                <Square size={13} /> Stop
              </button>
            ) : (
              <button
                onClick={() => setTimerEndsAt(Date.now() + current.timerMinutes! * 60_000)}
                title={`Odlicz ${current.timerMinutes} min na to ćwiczenie`}
                className="inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 rounded-xl border border-white/12 text-content-muted text-sm font-bold hover:text-white"
              >
                <Play size={13} /> {current.timerMinutes} min
              </button>
            )
          ) : null}

          <SlideTimer endsAt={timerEndsAt} compact />

          {/* Okno lokalne dla Zoom/Meet */}
          <button
            onClick={openPresenterWindow}
            className="inline-flex items-center gap-1.5 min-h-[2.5rem] px-3.5 rounded-xl bg-base-300 hover:bg-base-100 border border-white/10 text-content text-sm font-bold transition-all"
            title="Otwórz czyste okno slajdu do udostępniania na ekranie w tej przeglądarce"
          >
            <ExternalLink size={14} />
            {presenterWindow && !presenterWindow.closed ? 'Drugie okno' : 'Okno lokalne'}
          </button>
        </div>
      </header>

      <p className="text-[12px] text-content-muted leading-relaxed">
        Kursanci mogą wejść na <strong>/live</strong> i podać PIN, albo możesz otworzyć okno lokalne do udostępnienia przez Zoom/Meet.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Notatki do bieżącego slajdu */}
        <div className="rounded-xl border border-white/[0.07] bg-base-100/50 p-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-content-muted">
            Teraz na ekranie
          </span>
          <h3 className="text-[15px] font-bold text-white leading-snug">
            {current?.title || 'Brak slajdu'}
          </h3>
          {current?.speakerNotes ? (
            <p className="prose-justified text-[13px] text-warn leading-relaxed whitespace-pre-wrap">
              {current.speakerNotes}
            </p>
          ) : (
            <p className="text-[12px] text-content-muted">
              Ten slajd nie ma notatek prowadzącego.
            </p>
          )}
        </div>

        {/* Podgląd następnego */}
        <div className="rounded-xl border border-white/[0.07] bg-base-100/50 p-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-content-muted">
            Następny slajd
          </span>
          {next ? (
            <>
              <h3 className="text-[15px] font-bold text-content leading-snug">{next.title}</h3>
              <p className="text-[13px] text-content-muted leading-relaxed line-clamp-3">
                {slideSummary(next)}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-content-muted">To ostatni slajd w tej talii.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate(Math.max(0, activeSlideIndex - 1))}
          disabled={activeSlideIndex === 0}
          className="min-h-[2.75rem] px-4 inline-flex items-center gap-1.5 rounded-xl border border-white/12 text-content font-bold text-sm disabled:opacity-30 hover:bg-white/5 transition-all"
        >
          <ChevronLeft size={16} /> Wstecz
        </button>

        <span className="font-mono text-xs text-content-muted">
          {activeSlideIndex + 1}/{deck.slides.length}
        </span>

        <button
          onClick={() => onNavigate(Math.min(deck.slides.length - 1, activeSlideIndex + 1))}
          disabled={activeSlideIndex >= deck.slides.length - 1}
          className="ml-auto min-h-[2.75rem] px-4 inline-flex items-center gap-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold text-sm disabled:opacity-30 hover:bg-primary/25 transition-all"
        >
          Dalej <ChevronRight size={16} />
        </button>
      </div>

      {/* MODAL KONTROLNY SESJI NA ŻYWO (PIN + KURSANCI) */}
      {isLiveModalOpen && activeLiveSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-base-200 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsLiveModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-content-muted hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Radio size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Sesja Live Aktywna</h3>
                <p className="text-xs text-content-muted">
                  Kursanci widzą dokładnie to, co przełączasz w panelu
                </p>
              </div>
            </div>

            {/* Wielki PIN */}
            <div className="bg-base-300/80 p-5 rounded-2xl border border-white/10 text-center space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                Kod PIN dla kursantów
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-black text-primary tracking-widest">
                {formatAccessCode(activeLiveSession.pin)}
              </div>
              <p className="text-xs text-content-muted">
                Adres wejścia: <strong className="text-white">cribro.pl/live</strong>
              </p>
            </div>

            {/* Akcje kopiowania */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyPinOnly}
                className="flex items-center justify-center gap-2 py-2.5"
              >
                {copiedPin ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                {copiedPin ? 'Skopiowano PIN!' : 'Kopiuj sam PIN'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={copyLiveLink}
                className="flex items-center justify-center gap-2 py-2.5"
              >
                {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
                {copiedLink ? 'Skopiowano link!' : 'Kopiuj cały Link'}
              </Button>
            </div>

            {/* Lista połączonych kursantów */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-content-muted uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> Połączeni kursanci ({connectedStudents.length})
                </span>
                {connectedStudents.length > 0 && (
                  <span className="text-emerald-400 font-normal normal-case flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Aktywni
                  </span>
                )}
              </div>

              {connectedStudents.length === 0 ? (
                <div className="p-4 rounded-xl bg-base-300/40 border border-white/5 text-center text-xs text-content-muted">
                  Oczekiwanie na dołączenie kursantów... Podaj im PIN powyżej.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-base-300/40 border border-white/5">
                  {connectedStudents.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-100/60 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="font-semibold text-white">{s.name}</span>
                      </div>
                      <span className="text-[10px] text-content-muted font-mono">
                        od {new Date(s.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zakończ sesję */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => setIsLiveModalOpen(false)}
                className="text-xs text-content-muted hover:text-white transition-colors"
              >
                Ukryj to okno (sesja trwa dalej)
              </button>

              <Button
                variant="danger"
                size="sm"
                onClick={handleEndLiveSession}
                className="flex items-center gap-1.5"
              >
                <LogOut size={14} />
                Zakończ sesję na żywo
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PresenterPanel;

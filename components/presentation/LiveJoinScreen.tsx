import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Radio, Sparkles, User as UserIcon, ArrowRight, CheckCircle2, 
  AlertCircle, LogOut, BookOpen, Clock, Layers, MessageSquare,
  HelpCircle, RefreshCw, Volume2, Maximize2, Minimize2
} from 'lucide-react';
import { LiveSession } from '../../types';
import { 
  getLiveSession, 
  joinLiveSession, 
  subscribeLiveSession, 
  heartbeatLiveSession 
} from '../../services/liveSessionService';
import { 
  normalizeAccessCode, 
  formatAccessCode, 
  isValidAccessCode 
} from '../../utils/accessCode';
import { EMPTY_SLIDE_INTERACTION, SlideCard } from '../admin/presentation/SlideCard';
import { fitCanvasToDisplay, renderShapes, scaleShapes } from '../admin/presentation/whiteboardShapes';
import SlideTimer from '../admin/presentation/SlideTimer';
import LiveNotesForStudent from '../admin/presentation/LiveNotesForStudent';
import Button from '../ui/Button';

export function readPinFromCurrentLocation(): string {
  if (typeof window === 'undefined') return '';
  const searchParams = new URLSearchParams(window.location.search);
  const pinFromQuery = searchParams.get('pin') || searchParams.get('p') || searchParams.get('code');
  if (pinFromQuery) return normalizeAccessCode(pinFromQuery);

  const match = window.location.pathname.match(/^\/(?:live|join)\/([^/?#]+)/i);
  if (match && match[1]) {
    return normalizeAccessCode(match[1]);
  }
  return '';
}

export const LiveJoinScreen: React.FC = () => {
  const [pinInput, setPinInput] = useState(() => formatAccessCode(readPinFromCurrentLocation()));
  const [studentName, setStudentName] = useState(() => {
    try {
      return localStorage.getItem('cribro_live_student_name') || '';
    } catch {
      return '';
    }
  });

  const [joinedPin, setJoinedPin] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const boardRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Automatyczne dołączanie, jeśli PIN jest w adresie URL i mamy zapamiętane imię
  useEffect(() => {
    const urlPin = readPinFromCurrentLocation();
    if (urlPin && isValidAccessCode(urlPin) && studentName.trim() && !joinedPin && !isLoading) {
      handleJoin(urlPin, studentName);
    }
  }, []);

  // Subskrypcja stanu sesji w Firestore po dołączeniu
  useEffect(() => {
    if (!joinedPin) return;

    const unsubscribe = subscribeLiveSession(
      joinedPin,
      (updatedSession) => {
        if (!updatedSession) {
          setErrorMessage('Sesja została zamknięta lub usunięta.');
          return;
        }
        setSession(updatedSession);
      },
      (err) => {
        console.error('Błąd subskrypcji sesji:', err);
      }
    );

    // Heartbeat co 25 sekund
    const interval = setInterval(() => {
      if (studentId) {
        heartbeatLiveSession(joinedPin, studentId);
      }
    }, 25000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [joinedPin, studentId]);

  // Odrysowywanie tablicy lektora ze skalowaniem
  const whiteboard = session?.whiteboard;
  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas) return;

    const paint = () => {
      fitCanvasToDisplay(canvas);
      const rect = canvas.getBoundingClientRect();
      if (!whiteboard || whiteboard.shapes.length === 0 || !whiteboard.width || !whiteboard.height) {
        renderShapes(canvas, [], { background: null });
        return;
      }
      const scaled = scaleShapes(
        whiteboard.shapes,
        rect.width / whiteboard.width,
        rect.height / whiteboard.height
      );
      renderShapes(canvas, scaled, { background: null });
    };

    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, [whiteboard]);

  const handleJoin = async (pinToJoin?: string, nameToUse?: string) => {
    const targetPin = normalizeAccessCode(pinToJoin || pinInput);
    const targetName = (nameToUse || studentName).trim() || 'Kursant';

    if (!isValidAccessCode(targetPin)) {
      setErrorMessage('Wprowadź poprawny 6-znakowy kod PIN.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      try {
        localStorage.setItem('cribro_live_student_name', targetName);
      } catch {}

      const { studentId: newStudentId, session: initialSession } = await joinLiveSession(
        targetPin,
        targetName
      );

      setStudentId(newStudentId);
      setSession(initialSession);
      setJoinedPin(targetPin);
    } catch (err: any) {
      setErrorMessage(err.message || 'Nie udało się dołączyć do lekcji.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    setJoinedPin(null);
    setSession(null);
    setErrorMessage(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // EKRAN LOGOWANIA / DOŁĄCZANIA DO SESJI (PIN)
  if (!joinedPin || !session) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-4 selection:bg-primary/30">
        <div className="w-full max-w-md">
          {/* Logo & Nagłówek */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 mb-4 shadow-xl shadow-primary/10">
              <Radio className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Cribro <span className="text-primary font-normal">Live Classroom</span>
            </h1>
            <p className="text-content-muted text-sm mt-2">
              Dołącz do lekcji na żywo prowadzonej przez Twojego lektora
            </p>
          </div>

          {/* Karta z formularzem PIN */}
          <div className="bg-base-200/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-error/15 border border-error/30 flex items-start gap-3 text-error text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
              className="space-y-5"
            >
              {/* Kod PIN */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-content-muted mb-2">
                  Kod PIN Lekcji
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={pinInput}
                    onChange={(e) => setPinInput(formatAccessCode(e.target.value))}
                    placeholder="np. ABC-123"
                    maxLength={8}
                    autoFocus
                    className="w-full px-4 py-3.5 bg-base-300/80 border border-white/10 rounded-xl text-center font-mono text-2xl font-bold text-white tracking-widest placeholder:text-content-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted/40 text-xs">
                    PIN
                  </div>
                </div>
              </div>

              {/* Twoje Imię */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-content-muted mb-2">
                  Twoje Imię lub Pseudonim
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="np. Anna"
                    maxLength={50}
                    className="w-full pl-11 pr-4 py-3 bg-base-300/80 border border-white/10 rounded-xl text-white placeholder:text-content-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Przycisk Wejdź */}
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="w-full py-3.5 text-base font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Łączenie z salą...
                  </>
                ) : (
                  <>
                    Wejdź do lekcji na żywo
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Wskazówka */}
            <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-content-muted">
              Nie musisz posiadać konta ani się logować. Wystarczy kod podany przez nauczyciela.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // WIDOK ZAKOŃCZONEJ LEKCJI
  if (session.status === 'ended') {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-base-200/90 border border-white/10 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Lekcja została zakończona</h2>
            <p className="text-content-muted text-sm mt-2">
              Dziękujemy za udział w zajęciach prowadzonych przez <span className="text-white font-medium">{session.teacherName}</span>.
            </p>
          </div>

          {session.liveNotebook && (session.liveNotebook.vocab.length > 0 || session.liveNotebook.corrections.length > 0) && (
            <div className="text-left bg-base-300/60 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                Zanotowane słówka i poprawki ({session.liveNotebook.vocab.length + session.liveNotebook.corrections.length})
              </div>
              <LiveNotesForStudent
                vocab={session.liveNotebook.vocab || []}
                corrections={session.liveNotebook.corrections || []}
              />
            </div>
          )}

          <Button
            variant="secondary"
            onClick={handleLeave}
            className="w-full py-3"
          >
            Wyjdź do ekranu głównego
          </Button>
        </div>
      </div>
    );
  }

  // WIDOK AKTYWNEJ LEKCJI NA ŻYWO (PREZENTACJA DLA KURSANTA)
  const currentSlide = session.deck?.slides?.[session.currentSlideIndex] || null;

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-base-100 flex flex-col justify-between selection:bg-primary/30"
    >
      {/* Pasek statusu u góry */}
      <header className="bg-base-200/90 border-b border-white/10 px-4 py-3 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="hidden sm:inline">NA ŻYWO:</span> {session.teacherName}
          </div>
          <div className="truncate text-xs sm:text-sm font-semibold text-white/90">
            {session.deckTitle}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs font-mono px-2.5 py-1 bg-base-300/80 rounded-lg text-content-muted border border-white/5">
            Slajd {session.currentSlideIndex + 1} / {session.totalSlides}
          </div>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Wyłącz pełny ekran" : "Pełny ekran"}
            className="p-1.5 rounded-lg bg-base-300/80 hover:bg-white/10 text-content-muted hover:text-white transition-all border border-white/5"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLeave}
            title="Opuść lekcję"
            className="p-1.5 rounded-lg bg-error/15 hover:bg-error/25 text-error transition-all border border-error/30"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Główny obszar roboczy slajdu */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 flex flex-col justify-center max-w-6xl w-full mx-auto">
        {currentSlide ? (
          <div className="relative">
            <SlideCard
              slide={currentSlide}
              slideIndex={session.currentSlideIndex}
              totalSlides={session.totalSlides}
              isFullscreen
              interaction={session.interaction || EMPTY_SLIDE_INTERACTION}
              onInteractionChange={() => {}}
            />

            {/* Warstwa rysunku z tablicy lektora */}
            <canvas
              ref={boardRef}
              className="pointer-events-none absolute inset-0 w-full h-full"
            />

            {/* Wskaźnik laserowy lektora */}
            {session.laserPos && session.laserPos.active && (
              <div
                className="pointer-events-none absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-red-500 shadow-[0_0_15px_4px_rgba(239,68,68,0.8)] z-40 transition-all duration-75 ease-out"
                style={{
                  left: `${session.laserPos.x}%`,
                  top: `${session.laserPos.y}%`,
                }}
              />
            )}

            {/* Minutnik zsynchronizowany w czasie */}
            {session.timerEndsAt && (
              <div className="pointer-events-none absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <SlideTimer endsAt={session.timerEndsAt} />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-content-muted">
            Oczekiwanie na uruchomienie slajdu przez lektora...
          </div>
        )}

        {/* Notatki i słówka na żywo */}
        {session.liveNotebook && (
          <div className="mt-6">
            <LiveNotesForStudent
              vocab={session.liveNotebook.vocab || []}
              corrections={session.liveNotebook.corrections || []}
            />
          </div>
        )}
      </main>

      {/* Dyskretna stopka z informacją o połączeniu */}
      <footer className="text-center py-2 text-[11px] text-content-muted/60 border-t border-white/5">
        Połączono jako <span className="text-white/80">{studentName || 'Kursant'}</span> • PIN: {formatAccessCode(session.pin)}
      </footer>
    </div>
  );
};

export default LiveJoinScreen;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles, Maximize2, Minimize2, ChevronLeft, ChevronRight,
  Plus, Edit2, Trash2, Save, CheckCircle2,
  BookOpen, Layers, CloudUpload, CloudOff,
  Zap, MessageSquare, Folder, Wand2,
  PenLine, FileEdit, GraduationCap, SlidersHorizontal
} from 'lucide-react';

import { 
  User, 
  LessonRecord, 
  LessonPresentation, 
  PresentationSlide, 
  LiveCorrectionItem, 
  LiveVocabItem 
} from '../../../types';
import { 
  getDefaultPresentation, 
  savePresentationToStorage, 
  getSavedPresentationsList, 
  deleteSavedPresentation 
} from '../../../services/presentationService';
import { EMPTY_SLIDE_INTERACTION, SlideCard, SlideInteraction } from './SlideCard';
import { LiveNotebookPanel } from './LiveNotebookPanel';
import { SlideEditorModal } from './SlideEditorModal';
import { AiDeckGeneratorModal } from './AiDeckGeneratorModal';
import { ImportDeckModal } from './ImportDeckModal';
import { AiGuidelinesModal } from './AiGuidelinesModal';
import { SlideAiAssistantModal } from './SlideAiAssistantModal';
import Whiteboard from './Whiteboard';
import PresenterPanel from './PresenterPanel';
import type { Shape } from './whiteboardShapes';
import Button from '../../ui/Button';
import MenuDropdown, { MenuChevron } from '../../ui/MenuDropdown';
import CoachMarks from '../../ui/CoachMarks';
import { buildPresentationCoachSteps } from './presentationCoachSteps';
import ScratchpadModal from '../../scratchpad/ScratchpadModal';

/**
 * Przycisk paska narzędzi — jeden kształt dla wszystkich narzędzi na żywo.
 *
 * Etykiety chowają się dopiero poniżej `lg` i wtedy wszystkie naraz, więc pasek
 * ma dwa przewidywalne stany zamiast czterech progów `hidden sm/md/lg/xl`,
 * które wcześniej zostawiały w połowie szerokości rząd nieopisanych ikon.
 */
const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
  active?: boolean;
  coachId?: string;
  labelHidden?: boolean;
}> = ({ icon, label, onClick, title, active = false, coachId, labelHidden = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={label}
    aria-pressed={active}
    data-coach={coachId}
    className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
      active
        ? 'bg-accent/12 border-accent/40 text-accent'
        : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
    }`}
  >
    {icon}
    {!labelHidden && <span className="hidden lg:inline">{label}</span>}
  </button>
);


interface LessonPresentationViewProps {
  selectedUser?: User | null;
  lessonRecords?: LessonRecord[];
  onOpenLessonFormWithData?: (data: {
    topic: string;
    words: string;
    summary: string;
    thingsToImprove: string;
    followUp: string;
  }) => void;
}

export const LessonPresentationView: React.FC<LessonPresentationViewProps> = ({
  selectedUser,
  lessonRecords = [],
  onOpenLessonFormWithData
}) => {
  const studentName = selectedUser 
    ? (selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim() : selectedUser.username)
    : null;

  // Active Presentation State
  const [currentDeck, setCurrentDeck] = useState<LessonPresentation>(() => 
    getDefaultPresentation(selectedUser?.id, studentName, selectedUser?.level || 'B2')
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Layout & Presentation Modes
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  /**
   * Odkryte odpowiedzi i podświetlenia bieżącego slajdu.
   *
   * Stan żyje tutaj, a nie w SlideCard, bo ten sam slajd renderuje się w dwóch
   * oknach: u lektora i u kursanta. Zerujemy przy zmianie slajdu — inaczej
   * kolejny slajd otwierałby się z odpowiedziami odkrytymi na poprzednim.
   */
  const [slideInteraction, setSlideInteraction] = useState<SlideInteraction>(EMPTY_SLIDE_INTERACTION);
  /** Rysunek z tablicy — przekazywany do okna kursanta, żeby widział to samo. */
  const [whiteboardShapes, setWhiteboardShapes] = useState<{
    shapes: Shape[];
    width: number;
    height: number;
  } | null>(null);
  const [showNotebook, setShowNotebook] = useState(true);
  const [laserPointerActive, setLaserPointerActive] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: 0, y: 0 });

  // Modals
  const [isSlideEditorOpen, setIsSlideEditorOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<PresentationSlide | null>(null);
  const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSavedDecksOpen, setIsSavedDecksOpen] = useState(false);
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isSlideAssistantModalOpen, setIsSlideAssistantModalOpen] = useState(false);
  const [isScratchpadModalOpen, setIsScratchpadModalOpen] = useState(false);
  const [isDeckMenuOpen, setIsDeckMenuOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);

  /** Stan autozapisu pokazywany przy tytule — zastępuje osobny przycisk „Zapisz". */
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'local'>('idle');


  // Extract recent student weaknesses for AI practice generation
  const studentRecentImprovements = lessonRecords.length > 0 
    ? (lessonRecords.find(r => r.thingsToImprove && r.thingsToImprove.trim().length > 0)?.thingsToImprove || '')
    : '';

  // Saved Decks List
  const [savedDecks, setSavedDecks] = useState<LessonPresentation[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load Saved Decks
  const refreshSavedDecks = useCallback(async () => {
    try {
      const list = await getSavedPresentationsList(selectedUser?.id);
      setSavedDecks(list);
    } catch (e) {
      console.warn('Error loading saved decks:', e);
    }
  }, [selectedUser]);

  useEffect(() => {
    refreshSavedDecks();
  }, [refreshSavedDecks]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation for presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Samouczek przejmuje strzałki na swoje kroki — bez tego przewijałby
      // jednocześnie slajdy pod spodem i kursant widziałby skakanie talii.
      if (isCoachOpen) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setActiveSlideIndex(prev => Math.min(prev + 1, currentDeck.slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveSlideIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setLaserPointerActive(prev => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowNotebook(prev => !prev);
      } else if (e.key === 'w' || e.key === 'W') {
        // Tablica pod jednym klawiszem — sięga się po nią w środku zdania,
        // więc szukanie przycisku myszą byłoby przerwą w lekcji.
        e.preventDefault();
        setIsWhiteboardOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDeck.slides.length, isFullscreen, isCoachOpen]);

  /**
   * Obiekt notatnika w pamięci, nie tworzony przy każdym renderze.
   *
   * Trafia do zależności efektu wysyłającego stan do okna kursanta, więc świeża
   * tożsamość przy każdym renderze znaczyła jedną wiadomość na render — a
   * renderuje się tu także przy ruchu myszy ze wskaźnikiem laserowym i przy
   * każdym znaku wpisywanym w notatniku. Każda taka wiadomość to serializacja
   * całego slajdu z rysunkiem i zapis do schowka.
   */
  const liveNotebookForStudent = useMemo(
    () => ({
      vocab: currentDeck.liveVocab || [],
      corrections: currentDeck.liveCorrections || [],
    }),
    [currentDeck.liveVocab, currentDeck.liveCorrections]
  );

  // Stabilna tożsamość callbacku tablicy — inaczej każdy render rodzica
  // przekazywałby nową funkcję i uruchamiał efekt w Whiteboard od nowa.
  const handleShapesChange = useCallback(
    (shapes: Shape[], size: { width: number; height: number }) =>
      setWhiteboardShapes({ shapes, width: size.width, height: size.height }),
    []
  );

  useEffect(() => {
    setSlideInteraction(EMPTY_SLIDE_INTERACTION);
    // Rysunek należy do slajdu, na którym powstał — przeniesiony na następny
    // zasłaniałby treść kreskami, które już nic nie znaczą.
    setWhiteboardShapes(null);
  }, [activeSlideIndex, currentDeck.id]);

  // Laser Pointer mouse tracker
  const handleMouseMove = (e: React.MouseEvent) => {
    if (laserPointerActive) {
      setLaserPos({ x: e.clientX, y: e.clientY });
    }
  };

  // Deck Saving
  const handleSaveDeck = async () => {
    setSaveState('saving');
    const result = await savePresentationToStorage(currentDeck);
    refreshSavedDecks();
    setSaveState(result.cloud ? 'saved' : 'local');

    if (result.cloud) {
      showToast('Zapisano prezentację i notatnik.');
    } else if (result.local) {
      // Rozróżnienie jest tu istotne: talia zapisana tylko lokalnie zniknie po
      // przesiadce na drugi komputer, a lektor musi o tym wiedzieć przed lekcją,
      // nie w jej trakcie.
      showToast('Zapisano tylko w tej przeglądarce — nie udało się zapisać w chmurze.');
    } else {
      showToast('Nie udało się zapisać prezentacji.');
    }
  };

  /**
   * Autozapis talii i notatnika.
   *
   * Zapis był wyłącznie ręczny, więc zamknięta karta albo odświeżenie w trakcie
   * przygotowań kasowały całą pracę — a notatnik zapełnia się właśnie wtedy, gdy
   * lektor prowadzi lekcję i najmniej myśli o klikaniu „Zapisz".
   *
   * Zapisujemy dwie sekundy po ostatniej zmianie, nie przy każdym naciśnięciu
   * klawisza: notatnik live jest polem tekstowym, a zapis do Firestore przy
   * każdej literze to setki zapisów na lekcję.
   */
  const isFirstDeckRender = useRef(true);
  /** Ostrzeżenie o nieudanym zapisie do chmury pokazujemy raz, nie co autozapis. */
  const cloudSaveWarned = useRef(false);
  useEffect(() => {
    if (isFirstDeckRender.current) {
      isFirstDeckRender.current = false;
      return;
    }
    setSaveState('saving');
    const timer = setTimeout(() => {
      savePresentationToStorage(currentDeck)
        .then((result) => {
          setSaveState(result.cloud ? 'saved' : 'local');
          // Autozapis milczy, gdy się udał — komunikat w środku lekcji byłby
          // rozpraszaczem. O nieudanym zapisie do chmury mówimy raz, przy
          // pierwszym niepowodzeniu, żeby nie powtarzać go co dwie sekundy.
          if (!result.cloud && !cloudSaveWarned.current) {
            cloudSaveWarned.current = true;
            showToast('Zmiany zapisują się tylko w tej przeglądarce — chmura odmawia zapisu.');
          }
          if (result.cloud) cloudSaveWarned.current = false;
        })
        .catch((e) => {
          setSaveState('local');
          console.warn('Autozapis prezentacji nie powiódł się:', e);
        });
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentDeck]);

  // Slide CRUD
  const handleSaveSlide = (newSlide: PresentationSlide) => {
    if (editingSlide) {
      // Update
      const updatedSlides = currentDeck.slides.map(s => s.id === newSlide.id ? newSlide : s);
      setCurrentDeck(prev => ({ ...prev, slides: updatedSlides }));
      showToast('Zaktualizowano slajd');
    } else {
      // Add
      setCurrentDeck(prev => ({ ...prev, slides: [...prev.slides, newSlide] }));
      setActiveSlideIndex(currentDeck.slides.length);
      showToast('Dodano nowy slajd');
    }
    setEditingSlide(null);
  };

  const handleDeleteSlide = (idx: number) => {
    if (currentDeck.slides.length <= 1) {
      alert('Prezentacja musi zawierać przynajmniej jeden slajd.');
      return;
    }
    const updated = currentDeck.slides.filter((_, i) => i !== idx);
    setCurrentDeck(prev => ({ ...prev, slides: updated }));
    setActiveSlideIndex(prev => Math.max(0, Math.min(prev, updated.length - 1)));
    showToast('Usunięto slajd');
  };

  // Export to Lesson Record
  const handlePushToLessonRecord = () => {
    if (!onOpenLessonFormWithData) {
      alert('Otwórz panel lekcji kursanta, aby dodać wpis.');
      return;
    }

    const wordsText = currentDeck.liveVocab
      .map(v => `${v.term} ${v.translation ? `- ${v.translation}` : ''}`)
      .join('\n');

    const thingsToImproveText = currentDeck.liveCorrections
      .map(c => `• ${c.studentSaid} -> ${c.betterWay}${c.explanation ? ` (${c.explanation})` : ''}`)
      .join('\n');

    onOpenLessonFormWithData({
      topic: currentDeck.topic || currentDeck.title,
      words: wordsText,
      summary: currentDeck.liveNotes || currentDeck.title,
      thingsToImprove: thingsToImproveText,
      followUp: 'Utrwalenie słownictwa i poprawek z prezentacji live.'
    });

    showToast('Przeniesiono dane z prezentacji do formularza lekcji!');
  };

  const currentSlide = currentDeck.slides[activeSlideIndex] || currentDeck.slides[0];

  const coachSteps = useMemo(
    () => buildPresentationCoachSteps({ setDeckMenuOpen: setIsDeckMenuOpen }),
    []
  );

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full transition-colors ${
        isFullscreen 
          ? 'fixed inset-0 z-50 bg-black p-6 md:p-10 flex flex-col justify-between overflow-y-auto' 
          : 'space-y-4'
      }`}
    >
      {/* Laser pointer circle indicator */}
      {laserPointerActive && (
        <div 
          className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full w-5 h-5 bg-rose-500/80 shadow-[0_0_20px_#f43f5e] border-2 border-white animate-pulse"
          style={{ left: `${laserPos.x}px`, top: `${laserPos.y}px` }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-primary text-accent-ink font-bold text-xs shadow-2xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PASEK NARZĘDZI
          Trzy strefy: tożsamość talii, narzędzia sięgane w trakcie mówienia,
          reszta schowana w menu. Widoczne zostaje tylko to, po co lektor sięga
          bez zastanowienia — pozostałe operacje robi się przed lekcją. */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-2xl bg-base-200/95 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3 min-w-0" data-coach="pres-identity">
          <div className="p-2 rounded-xl bg-accent/12 text-accent border border-accent/25 shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-text-hi truncate">
                {currentDeck.title}
              </h2>
              {currentDeck.targetLevel && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/[0.07] border border-line text-text-2">
                  {currentDeck.targetLevel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-faint truncate">
              <span>{currentDeck.slides.length} slajdów</span>
              {studentName && (
                <>
                  <span aria-hidden>•</span>
                  <span className="truncate">{studentName}</span>
                </>
              )}
              <span aria-hidden>•</span>
              {/* Stan zapisu zamiast przycisku „Zapisz": talia zapisuje się sama,
                  więc lektor ma tu wiedzieć, czy trafiła do chmury — a nie
                  pamiętać o kliknięciu. */}
              {saveState === 'saving' ? (
                <span className="flex items-center gap-1 text-text-2">
                  <CloudUpload size={11} /> Zapisywanie…
                </span>
              ) : saveState === 'local' ? (
                <span
                  className="flex items-center gap-1 text-warn"
                  title="Zapisano tylko w tej przeglądarce — prezentacja nie otworzy się na innym komputerze."
                >
                  <CloudOff size={11} /> Tylko lokalnie
                </span>
              ) : (
                <span className="flex items-center gap-1 text-text-faint">
                  <CheckCircle2 size={11} /> Zapisano
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Narzędzia na żywo — jedyne, po które sięga się w środku zdania. */}
          <ToolbarButton
            icon={<PenLine size={15} />}
            label="Tablica"
            title="Tablica do rysowania na bieżącym slajdzie (skrót: W)"
            onClick={() => setIsWhiteboardOpen(true)}
            coachId="pres-whiteboard"
          />
          <ToolbarButton
            icon={<FileEdit size={15} />}
            label="Notatnik"
            title="Współdzielony notatnik kursanta — wspólna edycja na żywo, dostęp linkiem lub PIN-em"
            onClick={() => setIsScratchpadModalOpen(true)}
            coachId="pres-scratchpad"
          />
          <ToolbarButton
            icon={<Zap size={15} />}
            label="Laser"
            title="Wskaźnik laserowy (skrót: L)"
            onClick={() => setLaserPointerActive(!laserPointerActive)}
            active={laserPointerActive}
            coachId="pres-laser"
            labelHidden
          />

          <div className="h-6 w-px bg-line-strong mx-0.5" aria-hidden />

          {/* Operacje na talii — robione przed lekcją, więc pod jednym menu. */}
          <MenuDropdown
            open={isDeckMenuOpen}
            onOpenChange={setIsDeckMenuOpen}
            align="end"
            width={288}
            aria-label="Menu talii"
            coachId="pres-deck-menu"
            triggerTitle="Slajdy, generowanie AI, import i biblioteka prezentacji"
            triggerClassName={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              isDeckMenuOpen
                ? 'bg-white/[0.08] border-line-strong text-content'
                : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
            trigger={
              <>
                <SlidersHorizontal size={15} />
                <span>Talia</span>
                <MenuChevron open={isDeckMenuOpen} />
              </>
            }
            sections={[
              {
                id: 'build',
                label: 'Buduj lekcję',
                items: [
                  {
                    id: 'new-slide',
                    coachId: 'pres-menu-new-slide',
                    label: 'Nowy slajd',
                    description: 'Ręczna treść i typ ćwiczenia',
                    icon: <Plus size={14} />,
                    onSelect: () => {
                      setEditingSlide(null);
                      setIsSlideEditorOpen(true);
                    },
                  },
                  {
                    id: 'ai-deck',
                    coachId: 'pres-menu-ai-deck',
                    label: 'Generuj talię z AI',
                    description: 'Cała prezentacja na temat i poziom',
                    icon: <Sparkles size={14} />,
                    onSelect: () => setIsAiGeneratorOpen(true),
                  },
                  {
                    id: 'import',
                    coachId: 'pres-menu-import',
                    label: 'Importuj konspekt',
                    description: 'Z notatek, podręcznika lub lekcji',
                    icon: <Layers size={14} />,
                    onSelect: () => setIsImportModalOpen(true),
                  },
                ],
              },
              {
                id: 'library',
                label: 'Biblioteka i zapis',
                items: [
                  {
                    id: 'saved',
                    coachId: 'pres-menu-library',
                    label: `Zapisane prezentacje (${savedDecks.length})`,
                    description: 'Wczytaj wcześniejszą talię',
                    icon: <Folder size={14} />,
                    onSelect: () => setIsSavedDecksOpen(!isSavedDecksOpen),
                  },
                  {
                    id: 'save-now',
                    label: 'Zapisz teraz',
                    description: 'Poza autozapisem co 2 sekundy',
                    icon: <Save size={14} />,
                    onSelect: handleSaveDeck,
                  },
                ],
              },
              {
                id: 'method',
                label: 'Metodyka',
                items: [
                  {
                    id: 'guidelines',
                    coachId: 'pres-menu-guidelines',
                    label: 'Wytyczne CELTA / ESA',
                    description: 'Zasady budowy lekcji i generatora',
                    icon: <BookOpen size={14} />,
                    onSelect: () => setIsGuidelinesModalOpen(true),
                  },
                ],
              },
            ]}
          />

          <ToolbarButton
            icon={<MessageSquare size={15} />}
            label="Notatnik"
            title="Pokaż lub ukryj boczny notatnik lekcyjny (skrót: N)"
            onClick={() => setShowNotebook(!showNotebook)}
            active={showNotebook}
            coachId="pres-notebook"
          />
          <ToolbarButton
            icon={isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            label={isFullscreen ? 'Zwiń' : 'Pełny ekran'}
            title="Tryb pełnoekranowy (skrót: F)"
            onClick={toggleFullscreen}
            active={isFullscreen}
            coachId="pres-fullscreen"
            labelHidden
          />

          <div className="h-6 w-px bg-line-strong mx-0.5" aria-hidden />

          <ToolbarButton
            icon={<GraduationCap size={15} />}
            label="Samouczek"
            title="Samouczek — dymki opisujące każde narzędzie prezentacji"
            onClick={() => setIsCoachOpen(true)}
            labelHidden
          />
        </div>
      </div>

      {/* SAVED DECKS POPOVER */}
      {isSavedDecksOpen && (
        <div className="p-4 rounded-2xl bg-base-200 border border-white/15 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Folder size={14} className="text-primary" /> Twoje zapisane prezentacje
            </span>
            <button
              onClick={() => setIsSavedDecksOpen(false)}
              className="text-xs text-content-muted hover:text-white"
            >
              Zamknij
            </button>
          </div>

          {savedDecks.length === 0 ? (
            <p className="text-xs text-content-muted py-4 text-center">Brak zapisanych prezentacji w bibliotece.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
              {savedDecks.map(deck => (
                <div
                  key={deck.id}
                  onClick={() => {
                    setCurrentDeck(deck);
                    setActiveSlideIndex(0);
                    setIsSavedDecksOpen(false);
                    showToast(`Wczytano: ${deck.title}`);
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    currentDeck.id === deck.id
                      ? 'bg-primary/15 border-primary/40 shadow-md'
                      : 'bg-base-300/70 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div>
                    <h5 className="font-bold text-white text-xs line-clamp-1">{deck.title}</h5>
                    <p className="text-[10px] text-content-muted mt-0.5">
                      {deck.slides.length} slajdów {deck.studentName ? `• ${deck.studentName}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                    <span className="text-[10px] font-mono text-primary font-bold">Wczytaj</span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Czy na pewno chcesz usunąć prezentację "${deck.title}"?`)) {
                          await deleteSavedPresentation(deck.id, selectedUser?.id);
                          refreshSavedDecks();
                          showToast('Usunięto prezentację');
                        }
                      }}
                      className="text-content-muted hover:text-rose-400 p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAIN WORKSPACE AREA (SLIDES + LIVE NOTEBOOK) */}
      <div className={`grid gap-4 ${showNotebook ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        {/* LEFT / CENTER: SLIDE STAGE */}
        <div className={`${showNotebook ? 'lg:col-span-8' : 'w-full'} flex flex-col gap-3`}>
          {/* SLIDE CANVAS */}
          {currentSlide && (
            <SlideCard
              slide={currentSlide}
              slideIndex={activeSlideIndex}
              totalSlides={currentDeck.slides.length}
              isFullscreen={isFullscreen}
              interaction={slideInteraction}
              onInteractionChange={setSlideInteraction}
              onJumpToSlide={setActiveSlideIndex}
            />
          )}

          {/* Panel prowadzącego: notatki, następny slajd i okno dla kursanta.
              Stoi pod slajdem, bo lektor patrzy tu między jednym a drugim
              przejściem dalej, a nie w trakcie mówienia. */}
          <div data-coach="pres-presenter-panel">
            <PresenterPanel
              deck={currentDeck}
              activeSlideIndex={activeSlideIndex}
              onNavigate={setActiveSlideIndex}
              interaction={slideInteraction}
              whiteboard={whiteboardShapes}
              liveNotebook={liveNotebookForStudent}
            />
          </div>

          {/* SLIDE NAVIGATION CONTROLS */}
          <div
            data-coach="pres-slide-nav"
            className="p-3 rounded-2xl bg-base-200/90 border border-white/10 flex items-center justify-between gap-2 shadow-md"
          >
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={activeSlideIndex === 0}
                className="text-xs font-bold flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Poprzedni</span>
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveSlideIndex(prev => Math.min(currentDeck.slides.length - 1, prev + 1))}
                disabled={activeSlideIndex === currentDeck.slides.length - 1}
                className="text-xs font-bold flex items-center gap-1"
              >
                <span className="hidden sm:inline">Następny</span>
                <ChevronRight size={16} />
              </Button>
            </div>

            {/* SLIDE THUMBNAIL DOTS / NUMBERS */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[320px] py-1 px-2">
              {currentDeck.slides.map((s, idx) => (
                <button
                  key={s.id || idx}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center ${
                    activeSlideIndex === idx
                      ? 'bg-primary text-accent-ink shadow-[0_0_10px_rgba(114,240,180,0.4)] scale-110'
                      : 'bg-base-300 text-content-muted hover:text-white hover:bg-white/10'
                  }`}
                  title={`${idx + 1}. ${s.title}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5" data-coach="pres-slide-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsSlideAssistantModalOpen(true)}
                className="text-xs font-semibold text-content-muted hover:text-white p-2"
                title="Ulepsz ten slajd z pomocą AI"
              >
                <Wand2 size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingSlide(currentSlide);
                  setIsSlideEditorOpen(true);
                }}
                className="text-xs font-semibold text-content-muted hover:text-white p-2"
                title="Edytuj bieżący slajd ręcznie"
              >
                <Edit2 size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteSlide(activeSlideIndex)}
                className="text-xs font-semibold text-content-muted hover:text-rose-400 p-2"
                title="Usuń bieżący slajd"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT: LIVE COLLABORATIVE NOTEBOOK */}
        {showNotebook && (
          <div className="lg:col-span-4 min-h-[580px]" data-coach="pres-live-notebook">
            <LiveNotebookPanel
              liveNotes={currentDeck.liveNotes}
              onChangeLiveNotes={val => setCurrentDeck(prev => ({ ...prev, liveNotes: val }))}
              liveVocab={currentDeck.liveVocab}
              onChangeLiveVocab={vocab => setCurrentDeck(prev => ({ ...prev, liveVocab: vocab }))}
              liveCorrections={currentDeck.liveCorrections}
              onChangeLiveCorrections={corrections => setCurrentDeck(prev => ({ ...prev, liveCorrections: corrections }))}
              studentName={studentName}
              onPushToLessonRecord={handlePushToLessonRecord}
            />
          </div>
        )}
      </div>

      {/* FLOATING SHORTCUTS FOOTER IN FULLSCREEN */}
      {isFullscreen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-base-300/90 backdrop-blur-md border border-white/15 text-[11px] text-content-muted flex items-center gap-4 shadow-2xl font-mono">
          <span><strong className="text-white">Spacja / ➔</strong> Następny</span>
          <span><strong className="text-white">⬅</strong> Poprzedni</span>
          <span><strong className="text-white">W</strong> Tablica</span>
          <span><strong className="text-white">L</strong> Laser</span>
          <span><strong className="text-white">N</strong> Notatnik</span>
          <span><strong className="text-white">F / Esc</strong> Wyjście</span>
        </div>
      )}

      {/* Samouczek — dymki przypięte do narzędzi, łącznie ze schowanymi w menu. */}
      <CoachMarks
        steps={coachSteps}
        isOpen={isCoachOpen}
        onClose={() => {
          setIsCoachOpen(false);
          setIsDeckMenuOpen(false);
        }}
        title="Samouczek prezentacji"
      />

      {/* MODALS */}
      <SlideEditorModal
        isOpen={isSlideEditorOpen}
        onClose={() => {
          setIsSlideEditorOpen(false);
          setEditingSlide(null);
        }}
        slide={editingSlide}
        onSave={handleSaveSlide}
      />

      <AiDeckGeneratorModal
        isOpen={isAiGeneratorOpen}
        onClose={() => setIsAiGeneratorOpen(false)}
        onDeckGenerated={deck => {
          setCurrentDeck(deck);
          setActiveSlideIndex(0);
          showToast(`Wygenerowano prezentację z OpenAI 5.6 Luna: ${deck.title}`);
        }}
        defaultLevel={selectedUser?.level || 'B2'}
        studentName={studentName}
        defaultThingsToImprove={studentRecentImprovements}
        onOpenGuidelines={() => {
          setIsAiGeneratorOpen(false);
          setIsGuidelinesModalOpen(true);
        }}
      />

      <SlideAiAssistantModal
        isOpen={isSlideAssistantModalOpen}
        onClose={() => setIsSlideAssistantModalOpen(false)}
        topic={currentDeck.topic || currentDeck.title}
        level={currentDeck.targetLevel || selectedUser?.level || 'B2'}
        currentSlide={currentSlide}
        onSlideGenerated={newSlide => {
          setCurrentDeck(prev => ({ ...prev, slides: [...prev.slides, newSlide] }));
          setActiveSlideIndex(currentDeck.slides.length);
          showToast(`Dodano slajd AI (${newSlide.type})`);
        }}
        onSlideEnhanced={enhancedSlide => {
          const updatedSlides = currentDeck.slides.map(s => s.id === enhancedSlide.id ? enhancedSlide : s);
          setCurrentDeck(prev => ({ ...prev, slides: updatedSlides }));
          showToast('Ulepszono slajd z OpenAI 5.6 Luna');
        }}
      />

      <AiGuidelinesModal
        isOpen={isGuidelinesModalOpen}
        onClose={() => setIsGuidelinesModalOpen(false)}
        onOpenDeckGenerator={() => setIsAiGeneratorOpen(true)}
      />

      <ImportDeckModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={deck => {
          setCurrentDeck(deck);
          setActiveSlideIndex(0);
          showToast(`Zaimportowano materiał: ${deck.title}`);
        }}
        lessonRecords={lessonRecords}
        studentId={selectedUser?.id}
        studentName={studentName}
      />

      {/* Tablica otwiera się nad bieżącym slajdem, a nie jako pusta płachta:
          na lekcji najczęściej pisze się po materiale, który kursant właśnie
          widzi. Pusta tablica zostaje pod tym samym przyciskiem — wystarczy
          przejść na slajd `freeform` albo wyczyścić deck. */}
      {isWhiteboardOpen && (
        <Whiteboard
          onClose={() => {
            setIsWhiteboardOpen(false);
            setWhiteboardShapes(null);
          }}
          contextLabel={currentSlide?.title}
          onShapesChange={handleShapesChange}
          backdrop={
            currentSlide ? (
              <div className="p-4 sm:p-8">
                <SlideCard
                  slide={currentSlide}
                  slideIndex={activeSlideIndex}
                  totalSlides={currentDeck.slides.length}
                  isFullscreen
                  interaction={slideInteraction}
                  onInteractionChange={() => {}}
                  onJumpToSlide={setActiveSlideIndex}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {/* Współdzielony brudnopis lekcyjny (Google Docs) */}
      <ScratchpadModal
        isOpen={isScratchpadModalOpen}
        onClose={() => setIsScratchpadModalOpen(false)}
        student={{
          id: selectedUser?.id || null,
          name: studentName || 'Kursant',
        }}
        onPushToLessonRecord={onOpenLessonFormWithData}
      />
    </div>
  );
};


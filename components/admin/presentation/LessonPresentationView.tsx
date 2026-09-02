import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, Maximize2, Minimize2, ChevronLeft, ChevronRight, 
  Plus, Edit2, Trash2, Save, Download, Share2, Eye, EyeOff, 
  Clock, BookOpen, Layers, FileText, CheckCircle2, RotateCcw,
  Zap, Copy, Check, MessageSquare, Volume2, Folder, Wand2,
  Bookmark, Shield, AlertCircle
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
import { SlideCard } from './SlideCard';
import { LiveNotebookPanel } from './LiveNotebookPanel';
import { SlideEditorModal } from './SlideEditorModal';
import { AiDeckGeneratorModal } from './AiDeckGeneratorModal';
import { ImportDeckModal } from './ImportDeckModal';
import { AiGuidelinesModal } from './AiGuidelinesModal';
import { SlideAiAssistantModal } from './SlideAiAssistantModal';
import Button from '../../ui/Button';

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDeck.slides.length, isFullscreen]);

  // Laser Pointer mouse tracker
  const handleMouseMove = (e: React.MouseEvent) => {
    if (laserPointerActive) {
      setLaserPos({ x: e.clientX, y: e.clientY });
    }
  };

  // Deck Saving
  const handleSaveDeck = async () => {
    try {
      await savePresentationToStorage(currentDeck);
      refreshSavedDecks();
      showToast('Zapisano prezentację i notatnik w pamięci!');
    } catch (e: any) {
      alert('Błąd podczas zapisywania: ' + e.message);
    }
  };

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

      {/* TOP TOOLBAR */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-2xl bg-base-200/95 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                {currentDeck.title}
              </h2>
              {currentDeck.targetLevel && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/10 text-white">
                  {currentDeck.targetLevel}
                </span>
              )}
              {studentName && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                  Kursant: {studentName}
                </span>
              )}
            </div>
            <p className="text-xs text-content-muted truncate">
              {currentDeck.slides.length} slajdów • Interaktywna prezentacja & Wspólny notatnik live
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAiGeneratorOpen(true)}
            className="text-xs font-bold flex items-center gap-1.5 bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
            title="Generuj kompletną talię slajdów z OpenAI 5.6 Luna"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Generuj z Luna 5.6</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsSlideAssistantModalOpen(true)}
            className="text-xs font-bold flex items-center gap-1.5 bg-amber-400/15 text-amber-300 border-amber-400/30 hover:bg-amber-400/25"
            title="AI Copilot dla pojedynczego slajdu (dodaj ćwiczenie, popraw błędy, rozbuduj)"
          >
            <Wand2 size={14} />
            <span className="hidden md:inline">AI Slajd</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsGuidelinesModalOpen(true)}
            className="text-xs font-semibold text-content-muted hover:text-primary flex items-center gap-1.5"
            title="Wytyczne metodyczne CELTA/ESA oraz zasady OpenAI 5.6 Luna"
          >
            <BookOpen size={14} />
            <span className="hidden xl:inline">Wytyczne CELTA</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs font-bold flex items-center gap-1.5 bg-info/15 text-info border-info/30 hover:bg-info/25"
          >
            <Layers size={14} />
            <span className="hidden sm:inline">Importuj konspekt</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingSlide(null);
              setIsSlideEditorOpen(true);
            }}
            className="text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Slajd</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsSavedDecksOpen(!isSavedDecksOpen)}
            className="text-xs font-bold flex items-center gap-1.5"
          >
            <Folder size={14} />
            <span className="hidden sm:inline">Zapisane ({savedDecks.length})</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleSaveDeck}
            className="text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(114,240,180,0.25)]"
          >
            <Save size={14} />
            <span>Zapisz</span>
          </Button>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Toggle Notebook Split Screen */}
          <Button
            size="sm"
            variant={showNotebook ? 'primary' : 'ghost'}
            onClick={() => setShowNotebook(!showNotebook)}
            className={`text-xs font-bold flex items-center gap-1.5 ${
              !showNotebook ? 'text-content-muted hover:text-white' : ''
            }`}
            title="Włącz/Wyłącz boczny notatnik live"
          >
            <MessageSquare size={14} />
            <span className="hidden md:inline">Notatnik</span>
          </Button>

          {/* Laser Pointer toggle */}
          <button
            onClick={() => setLaserPointerActive(!laserPointerActive)}
            className={`p-2 rounded-xl transition-all border cursor-pointer ${
              laserPointerActive
                ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'bg-base-300 text-content-muted border-white/10 hover:text-white'
            }`}
            title="Wskaźnik laserowy (Skrót: L)"
          >
            <Zap size={15} />
          </button>

          {/* Fullscreen Mode */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="text-xs font-bold text-white hover:bg-white/10 flex items-center gap-1.5"
            title="Tryb pełnoekranowy (Skrót: F)"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden lg:inline">{isFullscreen ? 'Zwiń' : 'Pełny ekran'}</span>
          </Button>
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
            />
          )}

          {/* SLIDE NAVIGATION CONTROLS */}
          <div className="p-3 rounded-2xl bg-base-200/90 border border-white/10 flex items-center justify-between gap-2 shadow-md">
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

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsSlideAssistantModalOpen(true)}
                className="text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-400/20 p-2"
                title="Ulepsz ten slajd z OpenAI 5.6 Luna"
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
          <div className="lg:col-span-4 min-h-[580px]">
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
          <span><strong className="text-white">L</strong> Laser</span>
          <span><strong className="text-white">N</strong> Notatnik</span>
          <span><strong className="text-white">F / Esc</strong> Wyjście</span>
        </div>
      )}

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
    </div>
  );
};

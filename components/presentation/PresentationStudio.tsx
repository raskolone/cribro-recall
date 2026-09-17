import React, { useState, useEffect } from 'react';
import { Presentation, Slide, SlideElement } from '../../types/presentation';
import { UserWithId } from '../../services/userService';
import { SlideCanvas } from './SlideCanvas';
import { PresentationSidebar } from './PresentationSidebar';
import { 
  createEmptySlide, 
  saveTeacherPresentation, 
  getTeacherPresentations 
} from '../../services/presentationStudioService';
import { generatePresentationWithGeminiDualPass } from '../../services/geminiSlideGenerator';
import { 
  Save, 
  Users, 
  Bookmark, 
  Play, 
  FolderOpen, 
  Check, 
  AlertCircle, 
  ArrowLeft, 
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { ModuleHelpButton } from '../common/ModuleHelpButton';

interface PresentationStudioProps {
  currentUser: any;
  students?: UserWithId[];
  initialPresentation?: Presentation | null;
  onBack?: () => void;
  onLaunchLive?: (presentation: Presentation) => void;
}

/**
 * PresentationStudio: Główny widok interaktywnego PowerPointa dla lektorów w Cribro.
 * - Płótno 16:9 w centralnym obszarze roboczym
 * - Zwijany lewy panel boczny (Slajdy, Szablony, Multimedia z dysku, AI Generator)
 * - Prywatna baza lektora (teacherId)
 * - Elastyczne przypisywanie: 1 kursant, wielu kursantów lub szablon wielokrotnego użytku
 */
export const PresentationStudio: React.FC<PresentationStudioProps> = ({
  currentUser,
  students = [],
  initialPresentation,
  onBack,
  onLaunchLive,
}) => {
  const teacherId = currentUser?.uid || currentUser?.id || 'teacher_local';

  // Stan aktualnej prezentacji
  const [presentation, setPresentation] = useState<Presentation>(() => {
    if (initialPresentation) return initialPresentation;
    const initialSlide = createEmptySlide(1);
    return {
      id: `pres-${Date.now()}`,
      teacherId,
      assignedStudentIds: [],
      title: 'Nowa prezentacja interaktywna',
      topic: 'Konwersacje i słownictwo',
      slides: [initialSlide],
      isTemplate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Statusy zapisu i powiadomień
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Status generatora AI
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>('');

  // Modal / dropdown przypisywania kursantów
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showSavedListModal, setShowSavedListModal] = useState(false);
  const [savedPresentations, setSavedPresentations] = useState<Presentation[]>([]);

  // Załaduj listę zapisanych prezentacji lektora
  const loadSavedDecks = async () => {
    try {
      const list = await getTeacherPresentations(teacherId);
      setSavedPresentations(list);
    } catch (err) {
      console.warn('Nie udało się wczytać listy prezentacji:', err);
    }
  };

  useEffect(() => {
    loadSavedDecks();
  }, [teacherId]);

  const currentSlide = presentation.slides[activeSlideIndex] || null;

  // Aktualizacja bieżącego slajdu w stanie
  const handleUpdateCurrentSlide = (updatedSlide: Slide) => {
    setPresentation((prev) => {
      const nextSlides = [...prev.slides];
      nextSlides[activeSlideIndex] = updatedSlide;
      return { ...prev, slides: nextSlides };
    });
  };

  // Dodanie nowego slajdu
  const handleAddSlide = (slideToAdd?: Slide) => {
    const newSlide = slideToAdd || createEmptySlide(presentation.slides.length + 1);
    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
    setActiveSlideIndex(presentation.slides.length);
    setSelectedElementId(null);
  };

  // Usunięcie slajdu
  const handleDeleteSlide = (indexToDelete: number) => {
    if (presentation.slides.length <= 1) return;
    setPresentation((prev) => {
      const nextSlides = prev.slides.filter((_, idx) => idx !== indexToDelete);
      return { ...prev, slides: nextSlides };
    });
    if (activeSlideIndex >= indexToDelete) {
      setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
    }
    setSelectedElementId(null);
  };

  // Zmiana kolejności slajdów
  const handleMoveSlide = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= presentation.slides.length) return;
    setPresentation((prev) => {
      const nextSlides = [...prev.slides];
      const [moved] = nextSlides.splice(fromIndex, 1);
      nextSlides.splice(toIndex, 0, moved);
      return { ...prev, slides: nextSlides };
    });
    setActiveSlideIndex(toIndex);
  };

  // Dodanie elementu do aktywnego slajdu
  const handleAddElementToActiveSlide = (element: SlideElement) => {
    if (!currentSlide) return;
    const updated: Slide = {
      ...currentSlide,
      elements: [...currentSlide.elements, element],
    };
    handleUpdateCurrentSlide(updated);
    setSelectedElementId(element.id);
  };

  // Aktualizacja pozycji elementu na płótnie
  const handleUpdateElementPosition = (id: string, newPosition: { x: number; y: number }) => {
    if (!currentSlide) return;
    const updated: Slide = {
      ...currentSlide,
      elements: currentSlide.elements.map((el) =>
        el.id === id ? { ...el, position: newPosition } : el
      ),
    };
    handleUpdateCurrentSlide(updated);
  };

  // Usunięcie elementu ze slajdu
  const handleDeleteElement = (id: string) => {
    if (!currentSlide) return;
    const updated: Slide = {
      ...currentSlide,
      elements: currentSlide.elements.filter((el) => el.id !== id),
    };
    handleUpdateCurrentSlide(updated);
    if (selectedElementId === id) setSelectedElementId(null);
  };

  // Zapis do prywatnej bazy lektora
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
    try {
      const result = await saveTeacherPresentation(presentation, teacherId);
      if (result.success) {
        setSaveSuccessMessage('Zapisano w Twojej prywatnej bazie lektora!');
        loadSavedDecks();
        setTimeout(() => setSaveSuccessMessage(null), 3000);
      } else {
        setSaveErrorMessage(result.error || 'Wystąpił błąd podczas zapisu.');
      }
    } catch (err: any) {
      setSaveErrorMessage(err?.message || 'Błąd zapisu.');
    } finally {
      setIsSaving(false);
    }
  };

  // Przypisywanie kursanta (toggle)
  const handleToggleStudentAssignment = (studentId: string) => {
    setPresentation((prev) => {
      const exists = prev.assignedStudentIds.includes(studentId);
      const updated = exists
        ? prev.assignedStudentIds.filter((id) => id !== studentId)
        : [...prev.assignedStudentIds, studentId];
      return { ...prev, assignedStudentIds: updated };
    });
  };

  // Przełącznik "Zapisz jako szablon wielokrotnego użytku"
  const handleToggleTemplate = () => {
    setPresentation((prev) => ({
      ...prev,
      isTemplate: !prev.isTemplate,
    }));
  };

  // Generator AI — Dwuetapowa narada modeli Gemini
  const handleGenerateFromAI = async (notes: string, topic: string) => {
    setIsGeneratingAI(true);
    setAiStatusMessage('Inicjalizacja generatora Gemini...');
    try {
      const generatedSlides = await generatePresentationWithGeminiDualPass({
        notes,
        topic: topic || presentation.topic || presentation.title,
        onProgress: (_, message) => setAiStatusMessage(message),
      });

      if (generatedSlides && generatedSlides.length > 0) {
        setPresentation((prev) => ({
          ...prev,
          title: topic || prev.title,
          topic: topic || prev.topic,
          slides: generatedSlides,
        }));
        setActiveSlideIndex(0);
        setSelectedElementId(null);
        setAiStatusMessage('Slajdy pomyślnie wygenerowane przez Gemini 3.8 Flash!');
      }
    } catch (err: any) {
      console.error('[PresentationStudio] Błąd generowania AI:', err);
      setAiStatusMessage(`Błąd generowania: ${err?.message || 'Spróbuj ponownie'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-base-100 text-text-hi overflow-hidden font-sans">
      {/* ── GÓRNY PASEK APLIKACJI (TOP BAR) ── */}
      <header className="h-16 px-4 sm:px-6 bg-base-200 border-b border-line-strong flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-base-300 hover:bg-line-soft text-content-muted hover:text-text-hi transition-colors cursor-pointer"
              title="Wróć do panelu"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight truncate max-w-[200px] sm:max-w-xs">
              {presentation.title}
            </h1>
            <input
              type="text"
              value={presentation.title}
              onChange={(e) => setPresentation((p) => ({ ...p, title: e.target.value }))}
              placeholder="Zmień tytuł prezentacji..."
              className="hidden lg:block text-xs px-2 py-1 rounded-md bg-base-300 border border-line text-content-muted focus:text-text-hi focus:border-primary focus:outline-none"
            />
            <ModuleHelpButton guideId="presentation-studio" />
          </div>
        </div>

        {/* Akcje górnego paska: Przypisanie, Szablon, Zapis, Biblioteka */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Menu przypisywania do kursantów */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAssignDropdown((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                presentation.assignedStudentIds.length > 0
                  ? 'border-primary/80 bg-primary/15 text-primary'
                  : 'border-line bg-base-300 text-content-muted hover:text-text-hi'
              }`}
            >
              <Users size={14} />
              <span>
                {presentation.assignedStudentIds.length === 0
                  ? 'Przypisz kursantów'
                  : `Przypisano (${presentation.assignedStudentIds.length})`}
              </span>
              <ChevronDown size={13} />
            </button>

            {showAssignDropdown && (
              <div className="absolute right-0 mt-2 w-72 p-3 rounded-2xl bg-base-200 border border-line-strong shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-xs font-bold text-text-hi">Przypisanie materiału</span>
                  <span className="text-[10px] font-mono text-content-muted">Prywatna baza</span>
                </div>

                {/* Przełącznik szablonu wielokrotnego użytku */}
                <label className="flex items-center gap-2 p-2 rounded-xl bg-base-100 border border-line cursor-pointer">
                  <input
                    type="checkbox"
                    checked={presentation.isTemplate}
                    onChange={handleToggleTemplate}
                    className="accent-primary rounded"
                  />
                  <div>
                    <span className="text-xs font-bold block text-amber-300">Szablon w bibliotece</span>
                    <span className="text-[10px] text-content-muted block leading-snug">
                      Dostępny dla Ciebie do wielokrotnego użycia z różnymi kursantami.
                    </span>
                  </div>
                </label>

                {/* Lista kursantów */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <span className="text-[11px] font-bold text-content-muted block mb-1">
                    Wybierz kursantów (1 lub wielu):
                  </span>
                  {students.length === 0 ? (
                    <p className="text-[11px] text-content-muted italic">Brak kursantów w bazie.</p>
                  ) : (
                    students.map((st) => {
                      const isAssigned = presentation.assignedStudentIds.includes(st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => handleToggleStudentAssignment(st.id)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isAssigned
                              ? 'border-primary/60 bg-primary/10 text-primary font-bold'
                              : 'border-line hover:bg-base-300 text-content-muted'
                          }`}
                        >
                          <span className="truncate">{st.displayName || st.username || st.email}</span>
                          {isAssigned && <Check size={13} />}
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAssignDropdown(false)}
                  className="w-full py-1.5 rounded-lg bg-base-300 hover:bg-line-soft text-xs font-bold text-text-hi"
                >
                  Gotowe
                </button>
              </div>
            )}
          </div>

          {/* Otwórz moje zapisane prezentacje */}
          <button
            type="button"
            onClick={() => setShowSavedListModal(true)}
            className="px-3 py-1.5 rounded-xl border border-line bg-base-300 hover:bg-line-soft text-content-muted hover:text-text-hi text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Biblioteka prezentacji"
          >
            <FolderOpen size={14} />
            <span className="hidden sm:inline">Moja biblioteka</span>
          </button>

          {/* Przycisk zapisu */}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-primary text-accent-ink font-bold text-xs flex items-center gap-1.5 hover:brightness-110 transition-all shadow-[0_0_15px_rgba(114,240,180,0.3)] cursor-pointer"
          >
            <Save size={14} />
            <span>{isSaving ? 'Zapisuję...' : 'Zapisz'}</span>
          </button>

          {/* Uruchom na żywo (jeśli callback przekazany) */}
          {onLaunchLive && (
            <button
              type="button"
              onClick={() => onLaunchLive(presentation)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center gap-1.5 hover:brightness-110 transition-all cursor-pointer shadow-md"
            >
              <Play size={13} />
              <span>Prowadź lekcję</span>
            </button>
          )}
        </div>
      </header>

      {/* Komunikat o zapisie */}
      {saveSuccessMessage && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-1.5 text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
          <Check size={14} />
          <span>{saveSuccessMessage}</span>
        </div>
      )}
      {saveErrorMessage && (
        <div className="bg-red-500/15 border-b border-red-500/30 px-4 py-1.5 text-xs text-red-300 font-bold flex items-center justify-center gap-2">
          <AlertCircle size={14} />
          <span>{saveErrorMessage}</span>
        </div>
      )}

      {/* ── GŁÓWNY OBSZAR ROBOCZY: SIDEBAR + CANVAS ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Lewy panel boczny ze zwijanym menu */}
        <PresentationSidebar
          slides={presentation.slides}
          activeSlideIndex={activeSlideIndex}
          onSelectSlide={(idx) => {
            setActiveSlideIndex(idx);
            setSelectedElementId(null);
          }}
          onAddSlide={handleAddSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
          onAddElement={handleAddElementToActiveSlide}
          onGenerateFromAI={handleGenerateFromAI}
          isGeneratingAI={isGeneratingAI}
          aiStatusMessage={aiStatusMessage}
        />

        {/* Centralny obszar roboczy z płótnem 16:9 */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <SlideCanvas
            slide={currentSlide}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onUpdateElementPosition={handleUpdateElementPosition}
            onDeleteElement={handleDeleteElement}
          />
        </main>
      </div>

      {/* ── MODAL: BIBLIOTEKA PREZENTACJI LEKTORA ── */}
      {showSavedListModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-base-200 border border-line-strong rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <FolderOpen className="text-primary" size={20} />
                <h3 className="text-base font-bold text-text-hi">Moja Prywatna Biblioteka Prezentacji</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedListModal(false)}
                className="text-xs text-content-muted hover:text-text-hi font-bold"
              >
                Zamknij ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {savedPresentations.length === 0 ? (
                <div className="p-8 text-center text-content-muted text-xs">
                  Brak zapisanych prezentacji w Twojej bazie. Utwórz pierwszą i kliknij "Zapisz".
                </div>
              ) : (
                savedPresentations.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-base-100 border border-line-strong hover:border-primary/50 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-hi">{p.title}</span>
                        {p.isTemplate && (
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            Szablon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-content-muted mt-0.5">
                        {p.slides.length} slajdów • Zaktualizowano:{' '}
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('pl-PL') : 'brak daty'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPresentation(p);
                        setActiveSlideIndex(0);
                        setSelectedElementId(null);
                        setShowSavedListModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-accent-ink text-xs font-bold transition-all cursor-pointer"
                    >
                      Otwórz
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

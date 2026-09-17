import React, { useState } from 'react';
import { Slide, SlideElement, SlideLayoutTemplateId } from '../../types/presentation';
import { getLayoutTemplateSlides } from '../../services/presentationStudioService';
import { compressPresentationImage } from '../../utils/presentationImageCompression';
import { 
  Layers, 
  LayoutTemplate, 
  Upload, 
  Sparkles, 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface PresentationSidebarProps {
  slides: Slide[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: (slide?: Slide) => void;
  onDeleteSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onAddElement: (element: SlideElement) => void;
  onGenerateFromAI: (notes: string, topic: string) => Promise<void>;
  isGeneratingAI: boolean;
  aiStatusMessage?: string;
}

type SidebarSection = 'slides' | 'templates' | 'media' | 'ai';

/**
 * PresentationSidebar: Zwijane menu (Accordion) zawierające:
 * 1. [Slajdy] — miniatury, dodawanie nowego, zmiana kolejności
 * 2. [Treść i Szablony] — predefiniowane układy (Tytuł + Punkty, Dialog, Słownictwo, Ćwiczenie ze zdjęciem)
 * 3. [Multimedia z dysku] — upload z dysku -> Base64 i wstawienie na slajd
 * 4. [Generator AI] — załączanie plików tekstowych/notatek i dwuetapowa narada modeli Gemini
 */
export const PresentationSidebar: React.FC<PresentationSidebarProps> = ({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDeleteSlide,
  onMoveSlide,
  onAddElement,
  onGenerateFromAI,
  isGeneratingAI,
  aiStatusMessage,
}) => {
  const [openSection, setOpenSection] = useState<SidebarSection>('slides');
  const [aiNotes, setAiNotes] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const toggleSection = (sec: SidebarSection) => {
    setOpenSection((prev) => (prev === sec ? 'slides' : sec));
  };

  // Obsługa wczytania obrazu z dysku z kompresją i skalowaniem do max 1280x720 (limit Firestore 1 MB)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Wybierz plik graficzny (PNG, JPG, WEBP).');
      return;
    }

    try {
      // Automatyczna kompresja i przeskalowanie do max 1280x720
      const compressed = await compressPresentationImage(file);

      onAddElement({
        id: `img-${Date.now()}`,
        type: 'image',
        content: compressed.dataUrl,
        position: { x: 25, y: 25 },
        style: { width: 45, borderRadius: 12, shadow: true }
      });
    } catch (err: any) {
      console.error('[PresentationSidebar] Błąd kompresji obrazu:', err);
      setUploadError(err?.message || 'Nie udało się przetworzyć obrazu.');
    } finally {
      e.target.value = '';
    }
  };

  // Obsługa wczytania notatki tekstowej (.txt, .md) dla Generatora AI
  const handleNoteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const text = uploadEvent.target?.result as string;
      if (text) {
        setAiNotes(text);
        if (!aiTopic) {
          const autoTopic = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setAiTopic(autoTopic);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const templates = getLayoutTemplateSlides();

  return (
    <div className="w-80 sm:w-96 h-full flex flex-col bg-base-200 border-r border-line-strong overflow-y-auto select-none">
      {/* ── 1. SEKCJA: SLAJDY ── */}
      <div className="border-b border-line-strong">
        <button
          type="button"
          onClick={() => toggleSection('slides')}
          className="w-full px-4 py-3.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-text-hi hover:bg-base-300/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <span>Slajdy ({slides.length})</span>
          </div>
          {openSection === 'slides' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSection === 'slides' && (
          <div className="p-3 space-y-2 bg-base-300/30">
            <button
              type="button"
              onClick={() => onAddSlide()}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary/50 text-primary hover:bg-primary/10 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Plus size={15} />
              <span>Dodaj nowy slajd</span>
            </button>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {slides.map((s, idx) => {
                const isActive = activeSlideIndex === idx;
                return (
                  <div
                    key={s.id}
                    onClick={() => onSelectSlide(idx)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                      isActive
                        ? 'border-primary bg-primary/15 shadow-[0_0_15px_rgba(114,240,180,0.25)] ring-1 ring-primary'
                        : 'border-line-strong bg-base-100 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                        isActive ? 'bg-primary text-accent-ink' : 'bg-base-300 text-content-muted'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="truncate text-xs font-semibold text-text-hi">
                        {s.title || `Slajd ${idx + 1}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveSlide(idx, idx - 1);
                          }}
                          className="p-1 hover:text-primary text-content-muted"
                          title="Przesuń w górę"
                        >
                          ▲
                        </button>
                      )}
                      {idx < slides.length - 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveSlide(idx, idx + 1);
                          }}
                          className="p-1 hover:text-primary text-content-muted"
                          title="Przesuń w dół"
                        >
                          ▼
                        </button>
                      )}
                      {slides.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSlide(idx);
                          }}
                          className="p-1 hover:text-red-400 text-content-muted"
                          title="Usuń slajd"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. SEKCJA: TREŚĆ I SZABLONY ── */}
      <div className="border-b border-line-strong">
        <button
          type="button"
          onClick={() => toggleSection('templates')}
          className="w-full px-4 py-3.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-text-hi hover:bg-base-300/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <LayoutTemplate size={16} className="text-blue-400" />
            <span>Treść i Szablony</span>
          </div>
          {openSection === 'templates' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSection === 'templates' && (
          <div className="p-3 space-y-2.5 bg-base-300/30">
            <p className="text-[11px] text-content-muted leading-relaxed">
              Kliknij szablon, aby wstawić gotowy slajd z przetestowanym układem:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    const newSlide: Slide = {
                      ...tmpl.template,
                      id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    };
                    onAddSlide(newSlide);
                  }}
                  className="p-3 rounded-xl border border-line-strong bg-base-100 hover:border-blue-400/60 hover:bg-base-100/90 text-left transition-all group cursor-pointer shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-hi group-hover:text-blue-300">
                      {tmpl.name}
                    </span>
                    <Plus size={14} className="text-content-muted group-hover:text-blue-400" />
                  </div>
                  <p className="text-[11px] text-content-muted mt-1 leading-snug">
                    {tmpl.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. SEKCJA: MULTIMEDIA Z DYSKU ── */}
      <div className="border-b border-line-strong">
        <button
          type="button"
          onClick={() => toggleSection('media')}
          className="w-full px-4 py-3.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-text-hi hover:bg-base-300/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-amber-400" />
            <span>Multimedia z dysku</span>
          </div>
          {openSection === 'media' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSection === 'media' && (
          <div className="p-3.5 space-y-3 bg-base-300/30">
            <p className="text-[11px] text-content-muted leading-relaxed">
              Wgraj własną grafikę z dysku (zdjęcie, diagram, wycinek podręcznika). Zostanie bezpośrednio osadzona na aktywnym slajdzie.
            </p>

            <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-line-strong hover:border-amber-400/60 bg-base-100 cursor-pointer transition-all">
              <ImageIcon size={24} className="text-amber-400 mb-1.5" />
              <span className="text-xs font-bold text-text-hi">Wybierz obrazek z dysku</span>
              <span className="text-[10px] text-content-muted mt-0.5">PNG, JPG, WEBP do 5 MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {uploadError && (
              <div className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/30">
                <AlertCircle size={14} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. SEKCJA: GENERATOR AI (NARADA MODELI GEMINI) ── */}
      <div className="border-b border-line-strong">
        <button
          type="button"
          onClick={() => toggleSection('ai')}
          className="w-full px-4 py-3.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-text-hi hover:bg-base-300/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <span>Generator AI (Gemini DualPass)</span>
          </div>
          {openSection === 'ai' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {openSection === 'ai' && (
          <div className="p-3.5 space-y-3 bg-base-300/30">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                <Sparkles size={13} />
                <span>Dwustopniowa Narada Modeli</span>
              </div>
              <p className="text-[10px] text-content-muted leading-relaxed">
                Krok 1: Twórca (<span className="font-mono text-text-hi">gemini-3.8-flash</span>) analizuje notatki i tworzy strukturę.<br/>
                Krok 2: Recenzent weryfikuje zwięzłość (zasada max 5 punktów).
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-content-muted block mb-1">Temat prezentacji:</label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="np. Business Negotiations & Diplomatic Language"
                className="w-full text-xs px-3 py-2 rounded-lg bg-base-100 border border-line-strong text-text-hi focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-content-muted">Treść materiałów / notatek:</label>
                <label className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1">
                  <FileText size={10} />
                  <span>Załącz plik .txt</span>
                  <input
                    type="file"
                    accept=".txt,.md"
                    onChange={handleNoteFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                rows={5}
                placeholder="Wklej swoje notatki z lekcji, artykuł, fragment konspektu lub kliknij 'Załącz plik .txt'..."
                className="w-full text-xs p-2.5 rounded-lg bg-base-100 border border-line-strong text-text-hi focus:border-primary focus:outline-none leading-relaxed"
              />
            </div>

            {aiStatusMessage && (
              <div className="p-2.5 rounded-lg bg-base-200 border border-purple-500/40 text-[11px] text-purple-200 flex items-start gap-2">
                {isGeneratingAI ? (
                  <Loader2 size={14} className="animate-spin text-purple-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span>{aiStatusMessage}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isGeneratingAI || !aiNotes.trim()}
              onClick={() => onGenerateFromAI(aiNotes, aiTopic)}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                isGeneratingAI || !aiNotes.trim()
                  ? 'bg-line-strong text-content-muted cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:brightness-110'
              }`}
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generowanie slajdów...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Wygeneruj slajdy z AI</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

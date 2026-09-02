import React, { useState } from 'react';
import { 
  Sparkles, X, Wand2, Loader2, Layers, BookOpen, 
  CheckCircle2, ArrowRight, Lightbulb, RefreshCw, Cpu
} from 'lucide-react';
import { PresentationSlide, PresentationSlideType } from '../../../types';
import { 
  generateAISingleSlide, 
  enhanceAISlide 
} from '../../../services/presentationService';
import { 
  OPENAI_LUNA_DISPLAY_NAME 
} from '../../../services/presentationGuidelines';
import Button from '../../ui/Button';

interface SlideAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  level?: string;
  currentSlide?: PresentationSlide | null;
  onSlideGenerated: (slide: PresentationSlide) => void;
  onSlideEnhanced: (slide: PresentationSlide) => void;
}

export const SlideAiAssistantModal: React.FC<SlideAiAssistantModalProps> = ({
  isOpen,
  onClose,
  topic,
  level = 'B2',
  currentSlide,
  onSlideGenerated,
  onSlideEnhanced
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'create-slide' | 'enhance-current'>(
    currentSlide ? 'enhance-current' : 'create-slide'
  );

  // Mode: create-slide
  const [slideType, setSlideType] = useState<PresentationSlideType>('practice');
  const [customSlidePrompt, setCustomSlidePrompt] = useState('');

  // Mode: enhance-current
  const [enhanceInstruction, setEnhanceInstruction] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickEnhancePresets = [
    'Dodaj transkrypcję fonetyczną IPA i naturalniejsze przykłady zdań',
    'Przekształć w interaktywne ćwiczenie Practice ze wskazówkami i wzorcami',
    'Zwiększ poziom trudności na C1 z bardziej zaawansowanym słownictwem',
    'Uprość treść na poziom B1 i dodaj jasne wskazówki gramatyczne',
    'Dodaj moduł Enclosure: 3 pytania Quick Check i wyzwanie Exit Ticket'
  ];

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create-slide') {
        const newSlide = await generateAISingleSlide({
          topic,
          level,
          slideType,
          customPrompt: customSlidePrompt.trim() || undefined
        });
        onSlideGenerated(newSlide);
        onClose();
      } else if (mode === 'enhance-current' && currentSlide) {
        if (!enhanceInstruction.trim()) {
          setError('Wpisz lub wybierz instrukcję ulepszenia slajdu.');
          setLoading(false);
          return;
        }

        const enhanced = await enhanceAISlide({
          slide: currentSlide,
          instruction: enhanceInstruction.trim(),
          level
        });
        onSlideEnhanced(enhanced);
        onClose();
      }
    } catch (err: any) {
      console.error('Error in Slide AI Assistant:', err);
      setError(err?.message || 'Wystąpił błąd podczas pracy z modelem OpenAI 5.6 Luna.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-200 border border-primary/30 rounded-3xl w-full max-w-xl shadow-[0_0_50px_rgba(114,240,180,0.15)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-base-300/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">AI Slajd Copilot</h3>
              <p className="text-xs text-content-muted">
                Silnik: <span className="text-primary font-semibold">{OPENAI_LUNA_DISPLAY_NAME}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-2 bg-base-300/50 border-b border-white/5 flex gap-1">
          {currentSlide && (
            <button
              type="button"
              onClick={() => setMode('enhance-current')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'enhance-current' 
                  ? 'bg-primary text-black shadow-md' 
                  : 'text-content-muted hover:text-white'
              }`}
            >
              <RefreshCw size={13} /> Ulepsz obecny slajd
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('create-slide')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'create-slide' 
                ? 'bg-primary text-black shadow-md' 
                : 'text-content-muted hover:text-white'
            }`}
          >
            <Layers size={13} /> Stwórz nowy slajd AI
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAction} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          {mode === 'create-slide' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  Typ tworzonego slajdu
                </label>
                <select
                  value={slideType}
                  onChange={e => setSlideType(e.target.value as PresentationSlideType)}
                  className="w-full bg-base-300 border border-white/15 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary"
                  disabled={loading}
                >
                  <option value="practice">🎯 Practice & Interaktywne Drills</option>
                  <option value="enclosure">🏁 Enclosure (Podsumowanie, Quick Check, Exit Ticket)</option>
                  <option value="warmup">🎲 Warm-up & Conversation Starters</option>
                  <option value="vocabulary">📖 Słownictwo, Kolokacje & Wymowa IPA</option>
                  <option value="grammar">⚡ Struktury Językowe & Błędy</option>
                  <option value="speaking">💬 Speaking & Scenka Role-play</option>
                  <option value="freeform">📝 Notatki / Materiał dowolny</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-content-muted mb-1.5">
                  Dodatkowe instrukcje do slajdu (opcjonalnie)
                </label>
                <textarea
                  value={customSlidePrompt}
                  onChange={e => setCustomSlidePrompt(e.target.value)}
                  placeholder="np. Skup się na 4 trudnych sytuacjach w pracy z klientem z odkrywanymi odpowiedziami..."
                  rows={3}
                  className="w-full bg-base-300 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary resize-none"
                  disabled={loading}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-base-300/80 border border-white/10 text-xs space-y-1">
                <span className="text-primary font-bold block">Wybrany slajd:</span>
                <p className="text-white font-medium truncate">{currentSlide?.title || 'Bez tytułu'}</p>
                <span className="text-[11px] text-content-muted font-mono uppercase">
                  Typ: {currentSlide?.type}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  Instrukcja dla OpenAI 5.6 Luna *
                </label>
                <textarea
                  value={enhanceInstruction}
                  onChange={e => setEnhanceInstruction(e.target.value)}
                  placeholder="Wpisz, co AI ma poprawić, dodać lub zmienić na tym slajdzie..."
                  rows={3}
                  className="w-full bg-base-300 border border-white/15 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary resize-none"
                  disabled={loading}
                  required
                />
              </div>

              {/* Presets */}
              <div>
                <span className="text-[11px] text-content-muted block mb-1.5 font-medium">
                  Szybkie szablony ulepszeń:
                </span>
                <div className="space-y-1.5">
                  {quickEnhancePresets.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setEnhanceInstruction(preset)}
                      disabled={loading}
                      className="w-full p-2 rounded-lg bg-base-300 hover:bg-primary/20 hover:text-primary text-[11px] text-left text-content-muted border border-white/5 transition-all flex items-center gap-2"
                    >
                      <Sparkles size={12} className="shrink-0 text-primary" />
                      <span className="truncate">{preset}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading}
              className="flex items-center gap-2 font-bold"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Przetwarzanie (OpenAI 5.6 Luna)...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {mode === 'create-slide' ? 'Wygeneruj slajd' : 'Zastosuj ulepszenia'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

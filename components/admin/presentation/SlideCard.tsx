import React, { useState } from 'react';
import { 
  Sparkles, Volume2, HelpCircle, CheckCircle2, ChevronRight, 
  Clock, Eye, EyeOff, Dice5, AlertTriangle, Lightbulb, Bookmark,
  Layers, MessageSquare, ArrowRight, Check, X, Music, Maximize2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { PresentationSlide, PresentationSlideItem } from '../../../types';
import TTSButtons from '../../flashcards/TTSButtons';
import Button from '../../ui/Button';

/**
 * Stan interakcji na slajdzie: co jest odkryte i co podświetlone.
 *
 * Wyjęty na zewnątrz komponentu, bo w trybie prowadzącego slajd żyje w dwóch
 * oknach naraz. Gdy stan siedział wyłącznie w środku, lektor odkrywał odpowiedź
 * u siebie, a kursant w swoim oknie dalej widział zasłoniętą — czyli wszystko,
 * co na slajdzie klikalne, działało tylko dla prowadzącego.
 */
export interface SlideInteraction {
  revealedAnswers: Record<string, boolean>;
  highlightedItemId: string | null;
  randomQuestionIndex: number | null;
}

export const EMPTY_SLIDE_INTERACTION: SlideInteraction = {
  revealedAnswers: {},
  highlightedItemId: null,
  randomQuestionIndex: null,
};

interface SlideCardProps {
  slide: PresentationSlide;
  slideIndex: number;
  totalSlides: number;
  isFullscreen?: boolean;
  onUpdateSlideItem?: (itemId: string, updates: Partial<PresentationSlideItem>) => void;
  onJumpToSlide?: (slideIndex: number) => void;
  /**
   * Sterowanie interakcją z zewnątrz. Podane — komponent przestaje trzymać stan
   * u siebie i pokazuje to, co dostał; bez tego zachowuje się jak dotąd, więc
   * miejsca, które nie potrzebują synchronizacji, zostają bez zmian.
   */
  interaction?: SlideInteraction;
  onInteractionChange?: (next: SlideInteraction) => void;
}

export const SlideCard: React.FC<SlideCardProps> = ({
  slide,
  slideIndex,
  totalSlides,
  isFullscreen = false,
  onUpdateSlideItem,
  onJumpToSlide,
  interaction,
  onInteractionChange
}) => {
  const [localInteraction, setLocalInteraction] = useState<SlideInteraction>(EMPTY_SLIDE_INTERACTION);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const isControlled = Boolean(interaction && onInteractionChange);
  const state = isControlled ? (interaction as SlideInteraction) : localInteraction;
  const { revealedAnswers, highlightedItemId, randomQuestionIndex } = state;

  const applyInteraction = (next: SlideInteraction) => {
    if (isControlled) onInteractionChange!(next);
    else setLocalInteraction(next);
  };

  const setHighlightedItemId = (id: string | null) =>
    applyInteraction({ ...state, highlightedItemId: id });

  const toggleReveal = (itemId: string) => {
    applyInteraction({
      ...state,
      revealedAnswers: { ...state.revealedAnswers, [itemId]: !state.revealedAnswers[itemId] },
    });
  };

  const handleRollDice = () => {
    if (!slide.items || slide.items.length === 0) return;
    const nextIdx = Math.floor(Math.random() * slide.items.length);
    const targetItem = slide.items[nextIdx];
    applyInteraction({
      ...state,
      randomQuestionIndex: nextIdx,
      highlightedItemId: targetItem ? targetItem.id : state.highlightedItemId,
    });
  };

  // Theme styling
  const getThemeClasses = () => {
    switch (slide.bgTheme) {
      case 'emerald':
        return 'from-emerald-950/40 via-base-100 to-base-200 border-primary/25 shadow-[0_0_40px_rgba(114,240,180,0.1)]';
      case 'midnight':
        return 'from-blue-950/40 via-base-100 to-base-200 border-info/25 shadow-[0_0_40px_rgba(56,189,248,0.1)]';
      case 'amber':
        return 'from-amber-950/30 via-base-100 to-base-200 border-warn/25 shadow-[0_0_40px_rgba(251,191,36,0.1)]';
      case 'clean-light':
        return 'from-slate-900/60 via-base-100 to-base-200 border-white/20 shadow-2xl';
      case 'dark':
      default:
        return 'from-base-200/90 via-base-100 to-base-300/80 border-white/10 shadow-2xl';
    }
  };

  return (
    <div 
      className={`w-full rounded-3xl border bg-gradient-to-b ${getThemeClasses()} transition-all duration-300 flex flex-col justify-between overflow-hidden ${
        isFullscreen ? 'min-h-[78vh] p-8 md:p-12' : 'min-h-[580px] p-6 md:p-8'
      }`}
    >
      {/* Slide Top Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white border border-white/15">
            Slajd {slideIndex + 1} / {totalSlides}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider font-mono border ${
            slide.type === 'title' ? 'bg-primary/20 text-primary border-primary/30' :
            slide.type === 'toc' ? 'bg-indigo-400/20 text-indigo-300 border-indigo-400/30' :
            slide.type === 'warmup' ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' :
            slide.type === 'vocabulary' ? 'bg-sky-400/20 text-sky-300 border-sky-400/30' :
            slide.type === 'grammar' ? 'bg-purple-400/20 text-purple-300 border-purple-400/30' :
            slide.type === 'listening' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
            slide.type === 'practice' ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' :
            slide.type === 'speaking' ? 'bg-pink-400/20 text-pink-300 border-pink-400/30' :
            slide.type === 'correction' ? 'bg-rose-400/20 text-rose-300 border-rose-400/30' :
            'bg-white/10 text-content-muted border-white/10'
          }`}>
            {slide.type === 'title' && 'Wprowadzenie'}
            {slide.type === 'toc' && 'Plan lekcji & Agenda'}
            {slide.type === 'warmup' && 'Warm-up / Rozgrzewka'}
            {slide.type === 'vocabulary' && 'Słownictwo & Wymowa'}
            {slide.type === 'grammar' && 'Struktury & Wzorce'}
            {slide.type === 'listening' && 'Listening & Audio'}
            {slide.type === 'speaking' && 'Konwersacje & Scenka'}
            {slide.type === 'practice' && 'Practice / Drills'}
            {slide.type === 'enclosure' && 'Enclosure / Podsumowanie'}
            {slide.type === 'correction' && 'Poprawki & Błędy'}
            {slide.type === 'summary' && 'Podsumowanie'}
            {slide.type === 'freeform' && 'Materiały'}
          </span>
          {slide.aiModelUsed && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles size={11} /> {slide.aiModelUsed}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {slide.timerMinutes && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-base-300/80 text-content-muted text-xs font-mono border border-white/5">
              <Clock size={13} className="text-primary" />
              <span>Sugerowany czas: {slide.timerMinutes} min</span>
            </div>
          )}
          {slide.type === 'warmup' && slide.items && slide.items.length > 1 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRollDice}
              className="text-xs font-bold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
            >
              <Dice5 size={14} /> Losuj pytanie
            </Button>
          )}
        </div>
      </div>

      {/* Slide Main Content Area */}
      <div className="py-6 flex-1 flex flex-col justify-center">
        {/* Title & Subtitle */}
        <div className="mb-6 space-y-2">
          <h2 className={`font-display font-extrabold text-white tracking-tight ${
            isFullscreen ? 'text-3xl md:text-5xl' : 'text-2xl md:text-3xl'
          }`}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className={`text-content-muted font-medium ${
              isFullscreen ? 'text-lg md:text-xl' : 'text-sm md:text-base'
            }`}>
              {slide.subtitle}
            </p>
          )}
        </div>

        {/* Audio Player Banner (if audioUrl attached) */}
        {slide.audioUrl && (
          <div className="mb-6 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
                <Volume2 size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-mono font-bold text-purple-400 tracking-wider block">Nagranie audio lekcji</span>
                <h4 className="text-sm font-bold text-white truncate max-w-[280px]" title={slide.audioName || 'Ścieżka dźwiękowa'}>
                  {slide.audioName || 'Ścieżka dźwiękowa do odsłuchania'}
                </h4>
              </div>
            </div>
            <div className="w-full sm:w-auto flex-1 max-w-md">
              <audio 
                controls 
                src={slide.audioUrl} 
                className="w-full h-9 rounded-lg accent-primary"
                preload="metadata"
              />
            </div>
          </div>
        )}

        {/* Textbook Image / Screenshot Container (if imageUrl attached) */}
        {slide.imageUrl && (
          <div className="mb-6 relative rounded-2xl overflow-hidden border border-white/15 bg-black/40 group max-h-[300px] flex items-center justify-center">
            <img 
              src={slide.imageUrl} 
              alt="Materiały dydaktyczne do lekcji" 
              className="max-h-[300px] w-auto object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
              onClick={() => setIsImageModalOpen(true)}
            />
            <button
              type="button"
              onClick={() => setIsImageModalOpen(true)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black/90 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
            >
              <Eye size={14} /> Powiększ materiał
            </button>
          </div>
        )}

        {/* Content Type Renderers */}
        {slide.type === 'title' && (
          <div className="space-y-6 max-w-3xl">
            {slide.content && (
              <div className="p-5 rounded-2xl bg-base-300/50 border border-white/10 text-white text-base md:text-lg leading-relaxed shadow-lg">
                <Markdown>{slide.content}</Markdown>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap pt-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <Sparkles size={16} /> Interaktywna prezentacja
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-info/10 border border-info/20 text-info text-xs font-bold">
                <Volume2 size={16} /> Wbudowana wymowa audio TTS
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-content-muted text-xs font-bold">
                <MessageSquare size={16} /> Wspólny notatnik na bieżąco
              </div>
            </div>
          </div>
        )}

        {/* TABLE OF CONTENTS / LESSON PLAN (TOC) */}
        {slide.type === 'toc' && (
          <div className="space-y-4">
            {slide.content && (
              <p className="text-sm md:text-base text-content-muted leading-relaxed max-w-3xl">
                {slide.content}
              </p>
            )}
            {slide.items && slide.items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                {slide.items.map((item, tIdx) => {
                  const targetSlideIndex = tIdx + 2; // Slide 0 = Title, Slide 1 = TOC, Slide 2+ = stages
                  return (
                    <div
                      key={item.id || tIdx}
                      onClick={() => onJumpToSlide && onJumpToSlide(targetSlideIndex)}
                      className={`p-4 rounded-2xl bg-base-300/70 border border-white/10 hover:border-primary/50 hover:bg-base-300/90 transition-all flex flex-col justify-between space-y-2.5 group relative overflow-hidden ${
                        onJumpToSlide ? 'cursor-pointer hover:shadow-[0_0_20px_rgba(114,240,180,0.15)]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                          {tIdx + 1}
                        </span>
                        {item.definition && (
                          <span className="text-[11px] font-mono text-content-muted px-2 py-0.5 rounded bg-white/5 border border-white/10">
                            {item.definition}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-base group-hover:text-primary transition-colors flex items-center justify-between">
                          <span>{item.term}</span>
                          <ChevronRight size={16} className="text-content-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </h4>
                        {item.example && (
                          <p className="text-xs text-content-muted line-clamp-2 mt-1">
                            {item.example}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LISTENING & AUDIO COMPREHENSION */}
        {slide.type === 'listening' && (
          <div className="space-y-6">
            {slide.content && (
              <div className="p-5 rounded-2xl bg-base-300/60 border border-purple-500/20 text-white text-base leading-relaxed">
                <Markdown>{slide.content}</Markdown>
              </div>
            )}
            {slide.items && slide.items.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <HelpCircle size={15} /> Pytania i zadania do nagrania:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {slide.items.map((item, lIdx) => (
                    <div key={item.id || lIdx} className="p-4 rounded-xl bg-base-300/50 border border-white/10 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {lIdx + 1}
                        </span>
                        <p className="font-semibold text-white text-sm">{item.question || item.term}</p>
                      </div>
                      {item.answer && (
                        <div className="pl-7 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleReveal(item.id)}
                            className="h-6 px-2 text-[11px] text-purple-300 hover:bg-purple-500/10"
                          >
                            {revealedAnswers[item.id] ? 'Ukryj odpowiedź' : 'Pokaż odpowiedź'}
                          </Button>
                          {revealedAnswers[item.id] && (
                            <p className="mt-1 p-2 rounded-lg bg-purple-950/60 text-xs text-purple-200 font-bold animate-fadeIn">
                              {item.answer}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WARMUP / QUESTIONS */}
        {(slide.type === 'warmup' || slide.type === 'speaking') && slide.items && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slide.items.map((item, qIdx) => {
              const isSelected = highlightedItemId === item.id;
              return (
                <div
                  key={item.id || qIdx}
                  onClick={() => setHighlightedItemId(isSelected ? null : item.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer select-none space-y-3 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400/50 shadow-[0_0_25px_rgba(251,191,36,0.2)] ring-1 ring-amber-400/40 scale-[1.01]'
                      : 'bg-base-300/60 border-white/10 hover:border-white/20 hover:bg-base-300/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-7 h-7 rounded-xl bg-white/10 text-white font-mono font-extrabold text-xs flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    <div className="flex-1">
                      <p className={`font-semibold text-white leading-relaxed ${
                        isFullscreen ? 'text-lg md:text-xl' : 'text-base'
                      }`}>
                        {item.question || item.term}
                      </p>
                    </div>
                  </div>
                  {item.example && (
                    <p className="text-xs text-content-muted pl-10 italic">
                      np. "{item.example}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VOCABULARY TILES */}
        {slide.type === 'vocabulary' && slide.items && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slide.items.map((item, vIdx) => (
              <div
                key={item.id || vIdx}
                className="p-5 rounded-2xl bg-base-300/60 border border-white/10 hover:border-primary/30 transition-all space-y-2.5 shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-white text-lg md:text-xl tracking-tight">
                        {item.term}
                      </h4>
                      {item.ipa && (
                        <span className="font-mono text-xs text-primary/80 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {item.ipa}
                        </span>
                      )}
                    </div>
                    {item.term && <TTSButtons text={item.term} />}
                  </div>

                  {item.definition && (
                    <p className="text-sm font-medium text-amber-300/90 mt-1">
                      {item.definition}
                    </p>
                  )}
                </div>

                {item.example && (
                  <div className="p-3 rounded-xl bg-base-200/80 border border-white/5 text-xs text-content-muted italic flex items-start justify-between gap-2">
                    <span>"{item.example}"</span>
                    <TTSButtons text={item.example} size="sm" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* GRAMMAR & STRUCTURE */}
        {slide.type === 'grammar' && (
          <div className="space-y-4">
            {slide.content && (
              <div className="p-5 rounded-2xl bg-base-300/70 border border-purple-500/20 text-white text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                <Markdown>{slide.content}</Markdown>
              </div>
            )}

            {slide.items && slide.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {slide.items.map((item, gIdx) => (
                  <div key={item.id || gIdx} className="p-4 rounded-xl bg-base-300/50 border border-white/10 space-y-2">
                    {item.errorText && (
                      <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
                        <X size={14} className="text-rose-400 shrink-0" />
                        <span className="line-through">{item.errorText}</span>
                      </div>
                    )}
                    {item.correctionText && (
                      <div className="flex items-center gap-2 text-sm text-emerald-300 font-bold">
                        <Check size={14} className="text-emerald-400 shrink-0" />
                        <span>{item.correctionText}</span>
                      </div>
                    )}
                    {item.explanation && (
                      <p className="text-[11px] text-content-muted pt-1 border-t border-white/5">
                        💡 {item.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRACTICE & INTERACTIVE DRILLS */}
        {slide.type === 'practice' && slide.items && (
          <div className="space-y-3">
            {slide.items.map((item, pIdx) => {
              const isRevealed = revealedAnswers[item.id] || item.revealed;
              return (
                <div
                  key={item.id || pIdx}
                  className="p-5 rounded-2xl bg-base-300/60 border border-white/10 space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {pIdx + 1}
                      </span>
                      <p className="font-semibold text-white text-base md:text-lg">
                        {item.question || item.term}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleReveal(item.id)}
                      className="text-xs font-bold text-primary hover:bg-primary/10 flex items-center gap-1.5 shrink-0"
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                      {isRevealed ? 'Ukryj wzorzec' : 'Pokaż rozwiązanie'}
                    </Button>
                  </div>

                  {item.hint && !isRevealed && (
                    <div className="pl-9 text-xs text-warn flex items-center gap-1.5 font-medium">
                      <Lightbulb size={13} /> Wskazówka: {item.hint}
                    </div>
                  )}

                  {isRevealed && (
                    <div className="ml-9 p-3 rounded-xl bg-emerald-950/40 border border-emerald-400/30 text-emerald-300 text-sm font-bold flex items-center justify-between gap-3 animate-fadeIn">
                      <div>
                        <span className="text-[10px] uppercase font-mono block text-emerald-400/80 mb-0.5">Wzorcowa odpowiedź:</span>
                        {item.answer || item.correctionText || 'Brak wpisanej odpowiedzi'}
                      </div>
                      {(item.answer || item.correctionText) && (
                        <TTSButtons text={item.answer || item.correctionText || ''} size="sm" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CORRECTION SLIDE */}
        {slide.type === 'correction' && (
          <div className="space-y-4">
            {slide.content && (
              <div className="p-5 rounded-2xl bg-base-300/70 border border-rose-500/20 text-white text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                <Markdown>{slide.content}</Markdown>
              </div>
            )}
            {slide.items && slide.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {slide.items.map((item, cIdx) => (
                  <div key={item.id || cIdx} className="p-4 rounded-xl bg-base-300/60 border border-white/10 space-y-2">
                    <div className="text-xs text-rose-300 line-through">❌ {item.errorText}</div>
                    <div className="text-sm font-bold text-emerald-300">✅ {item.correctionText}</div>
                    {item.explanation && <div className="text-xs text-content-muted">💡 {item.explanation}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ENCLOSURE & CONSOLIDATION SLIDE */}
        {slide.type === 'enclosure' && (
          <div className="space-y-5">
            {slide.content && (
              <div className="p-5 rounded-2xl bg-base-300/70 border border-primary/20 text-white text-sm md:text-base leading-relaxed">
                <Markdown>{slide.content}</Markdown>
              </div>
            )}

            {/* Quick Check Questions */}
            {slide.quickCheck && slide.quickCheck.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <CheckCircle2 size={15} /> Quick Check (Szybkie sprawdzenie wiedzy)
                  </div>
                  <span className="text-[11px] text-content-muted">Kliknij, aby odkryć odpowiedź</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {slide.quickCheck.map((qc, qcIdx) => {
                    const qcId = `qc-${slide.id}-${qcIdx}`;
                    const isRevealed = revealedAnswers[qcId];
                    return (
                      <div 
                        key={qcIdx}
                        className="p-4 rounded-2xl bg-base-300/80 border border-white/10 flex flex-col justify-between space-y-3 hover:border-primary/30 transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="w-5 h-5 rounded-md bg-primary/20 text-primary text-[11px] font-mono font-bold flex items-center justify-center">
                              {qcIdx + 1}
                            </span>
                            {qc.hint && !isRevealed && (
                              <span className="text-[10px] text-warn font-medium flex items-center gap-1">
                                <Lightbulb size={11} /> {qc.hint}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white">
                            {qc.question}
                          </p>
                        </div>

                        <div>
                          {isRevealed ? (
                            <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
                              <span>{qc.answer}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleReveal(qcId)}
                                className="h-6 px-1 text-[10px] text-content-muted hover:text-text-hi"
                              >
                                <EyeOff size={12} />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => toggleReveal(qcId)}
                              className="w-full text-xs font-bold py-1.5 flex items-center justify-center gap-1.5"
                            >
                              <Eye size={13} /> Pokaż odpowiedź
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Exit Ticket Challenge */}
            {slide.exitTicketChallenge && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/15 via-base-300/80 to-primary/10 border border-primary/40 shadow-lg space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-primary">
                  <Sparkles size={15} /> Exit Ticket (Wyzwanie na koniec lekcji)
                </div>
                <p className="text-sm md:text-base font-bold text-white leading-relaxed">
                  {slide.exitTicketChallenge}
                </p>
                <div className="text-[11px] text-content-muted flex items-center gap-2 pt-1">
                  <span>🎯 Kursant formułuje wypowiedź przed opuszczeniem zajęć</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUMMARY / FREEFORM */}
        {(slide.type === 'summary' || slide.type === 'freeform') && slide.content && (
          <div className="p-6 rounded-2xl bg-base-300/60 border border-white/10 text-white text-base leading-relaxed shadow-lg">
            <Markdown>{slide.content}</Markdown>
          </div>
        )}
      </div>

      {/* Slide Speaker Notes Footer (if present) */}
      {slide.speakerNotes && (
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-content-muted">
          <div className="flex items-center gap-1.5 italic">
            <Bookmark size={13} className="text-primary" />
            <span>Wskazówka dydaktyczna: {slide.speakerNotes}</span>
          </div>
        </div>
      )}

      {/* Textbook Image Lightbox Modal */}
      {isImageModalOpen && slide.imageUrl && (
        <div 
          className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div 
            className="relative max-w-5xl max-h-[92vh] bg-base-100 border border-white/20 rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Eye size={14} className="text-primary" /> Podgląd materiału źródłowego ze scenariusza
              </span>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center">
              <img 
                src={slide.imageUrl} 
                alt="Pełny podgląd materiału" 
                className="max-w-full max-h-[80vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

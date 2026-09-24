import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  X,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Image as ImageIcon,
  Paperclip,
  Sparkles,
  Link2,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Bookmark,
  ArrowRightLeft,
  Highlighter,
  Underline,
  Strikethrough,
  StickyNote,
  Crosshair,
  Square,
  Lasso,
  RotateCcw,
  Airplay,
  PenTool,
  Paintbrush,
  Eraser,
  Minus,
  ArrowRight,
  Circle,
  Grid2x2,
  Move,
  Layers,
  Palette,
  Sliders,
  Check,
} from 'lucide-react';

export type ToolTab = 'CONTENT' | 'TEACH' | 'CANVAS' | 'DRAW';

export interface FloatingToolPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  // Akcje CONTENT
  onInsertText?: (tag: 'p' | 'h1' | 'h2' | 'h3' | 'blockquote') => void;
  onInsertImage?: () => void;
  onInsertAttachment?: () => void;
  onOpenExerciseStudio?: () => void;
  onInsertLink?: () => void;
  onInsertTable?: (rows: number) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
  // Akcje TEACH
  onApplyMark?: (type: 'error' | 'correct' | 'vocab' | 'correction' | 'highlight' | 'underline' | 'strike' | 'note') => void;
  onClearFormatting?: () => void;
  // Akcje CANVAS
  onStartFocusZoom?: (mode?: 'rectangle' | 'lasso' | 'object') => void;
  onResetCanvasView?: () => void;
  onOpenPresentation?: () => void;
  // Stan rysowania / adnotacji
  activeDrawTool?: 'pen' | 'marker' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | null;
  onSelectDrawTool?: (tool: 'pen' | 'marker' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | null) => void;
  drawColor?: string;
  onChangeDrawColor?: (color: string) => void;
  drawStrokeWidth?: number;
  onChangeDrawStrokeWidth?: (width: number) => void;
  drawOpacity?: number;
  onChangeDrawOpacity?: (opacity: number) => void;
}

const DRAW_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Dark Ink', value: '#1e293b' },
  { name: 'White', value: '#ffffff' },
];

const STROKE_WIDTHS = [
  { label: 'Cienki', value: 2 },
  { label: 'Średni', value: 4 },
  { label: 'Gruby', value: 8 },
  { label: 'Marker', value: 16 },
];

export const FloatingToolPalette: React.FC<FloatingToolPaletteProps> = ({
  isOpen,
  onClose,
  isTeacher,
  editorRef,
  onInsertText,
  onInsertImage,
  onInsertAttachment,
  onOpenExerciseStudio,
  onInsertLink,
  onInsertTable,
  onDuplicateSelection,
  onDeleteSelection,
  onApplyMark,
  onClearFormatting,
  onStartFocusZoom,
  onResetCanvasView,
  onOpenPresentation,
  activeDrawTool,
  onSelectDrawTool,
  drawColor = '#10b981',
  onChangeDrawColor,
  drawStrokeWidth = 4,
  onChangeDrawStrokeWidth,
  drawOpacity = 1,
  onChangeDrawOpacity,
}) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('CONTENT');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Pozycja początkowa: prawy górny róg workspace
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      const defaultX = Math.max(20, window.innerWidth - 380);
      const defaultY = 80;
      setPosition({ x: defaultX, y: defaultY });
    }
  }, [isOpen, position.x, position.y]);

  // Zamykanie klawiszem Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Przeciąganie panelu
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      const maxX = Math.max(0, window.innerWidth - (panelRef.current?.offsetWidth || 340) - 10);
      const maxY = Math.max(0, window.innerHeight - (panelRef.current?.offsetHeight || 400) - 10);

      const nextX = Math.max(10, Math.min(maxX, dragStartRef.current.posX + deltaX));
      const nextY = Math.max(60, Math.min(maxY, dragStartRef.current.posY + deltaY));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen || !isTeacher) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Floating Tool Palette"
      data-testid="floating-tool-palette"
      className="fixed z-[75] w-[340px] rounded-2xl bg-slate-900/95 border border-white/15 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── DRAG HEADER ── */}
      <div
        onMouseDown={handleDragStart}
        className="px-3.5 py-2.5 bg-slate-800/80 border-b border-white/10 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Wrench size={14} />
          </div>
          <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>Lesson Tools</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-emerald-300 font-normal">
              Canvas
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zamknij panel (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── TABS NAVIGATION (CONTENT | TEACH | CANVAS | DRAW) ── */}
      <div className="grid grid-cols-4 p-1.5 bg-slate-950/40 border-b border-white/10 gap-1 text-[11px] font-bold">
        {(['CONTENT', 'TEACH', 'CANVAS', 'DRAW'] as ToolTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span>{tab}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="p-3 space-y-3 max-h-[380px] overflow-y-auto">
        {/* TAB 1: CONTENT */}
        {activeTab === 'CONTENT' && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Wstawianie i edycja treści
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onInsertText?.('p')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Pilcrow size={14} className="text-emerald-400 shrink-0" />
                <span>Akapit (Tekst)</span>
              </button>

              <button
                type="button"
                onClick={() => onInsertText?.('h2')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Heading2 size={14} className="text-emerald-400 shrink-0" />
                <span>Nagłówek sekcji</span>
              </button>

              <button
                type="button"
                onClick={onInsertImage}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <ImageIcon size={14} className="text-sky-400 shrink-0" />
                <span>Wstaw obraz</span>
              </button>

              <button
                type="button"
                onClick={onInsertAttachment}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Paperclip size={14} className="text-sky-400 shrink-0" />
                <span>Załącznik lekcji</span>
              </button>

              <button
                type="button"
                onClick={onOpenExerciseStudio}
                className="col-span-2 p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs font-bold text-emerald-300"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-emerald-400" />
                  <span>Exercise Studio & Gry</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20">Nowe</span>
              </button>

              <button
                type="button"
                onClick={() => onInsertTable?.(2)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Grid2x2 size={14} className="text-amber-400 shrink-0" />
                <span>Tabela 2×2</span>
              </button>

              <button
                type="button"
                onClick={onInsertLink}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Link2 size={14} className="text-indigo-400 shrink-0" />
                <span>Wstaw link</span>
              </button>

              <button
                type="button"
                onClick={onDuplicateSelection}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Copy size={14} className="text-slate-300 shrink-0" />
                <span>Duplikuj blok</span>
              </button>

              <button
                type="button"
                onClick={onDeleteSelection}
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Trash2 size={14} className="text-rose-400 shrink-0" />
                <span>Usuń zaznaczone</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TEACH */}
        {activeTab === 'TEACH' && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Oznaczenia nauczycielskie (Notatki na żywo)
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onApplyMark?.('error')}
                className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <AlertCircle size={14} className="text-rose-400" />
                <span>❌ Błąd</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('correct')}
                className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>✅ Poprawnie</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('vocab')}
                className="p-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Bookmark size={14} className="text-cyan-400" />
                <span>💡 Słówko</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('correction')}
                className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowRightLeft size={14} className="text-amber-400" />
                <span>⇄ Korekta</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('highlight')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Highlighter size={14} className="text-yellow-400" />
                <span>Zakreślacz żółty</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('underline')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Underline size={14} className="text-indigo-400" />
                <span>Podkreślenie</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('strike')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Strikethrough size={14} className="text-slate-400" />
                <span>Przekreślenie</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyMark?.('note')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <StickyNote size={14} className="text-purple-400" />
                <span>Notatka lektora</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClearFormatting}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eraser size={13} />
              <span>Wyczyść formatowanie zaznaczenia</span>
            </button>
          </div>
        )}

        {/* TAB 3: CANVAS */}
        {activeTab === 'CANVAS' && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kierowanie uwagą & Prezentacja (Focus Zoom)
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Crosshair size={14} />
                <span>Focus Zoom — Wybierz tryb kadru</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onStartFocusZoom?.('rectangle')}
                  className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                >
                  <Square size={14} />
                  <span>Prostokąt</span>
                </button>

                <button
                  type="button"
                  onClick={() => onStartFocusZoom?.('lasso')}
                  className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                >
                  <Lasso size={14} />
                  <span>Lasso</span>
                </button>

                <button
                  type="button"
                  onClick={() => onStartFocusZoom?.('object')}
                  className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                >
                  <Crosshair size={14} />
                  <span>Obiekt</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onResetCanvasView}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} className="text-slate-400" />
                <span>Resetuj widok (1x)</span>
              </button>

              <button
                type="button"
                onClick={onOpenPresentation}
                className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Airplay size={14} />
                <span>Tryb Prezentacji</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: DRAW */}
        {activeTab === 'DRAW' && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Rysowanie, pisak i kształty
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'pen' ? null : 'pen')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'pen'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <PenTool size={14} />
                <span>Pióro</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'marker' ? null : 'marker')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'marker'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <Paintbrush size={14} />
                <span>Marker</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'eraser' ? null : 'eraser')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'eraser'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <Eraser size={14} />
                <span>Gumka</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'arrow' ? null : 'arrow')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'arrow'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <ArrowRight size={14} />
                <span>Strzałka</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'line' ? null : 'line')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'line'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <Minus size={14} />
                <span>Linia</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'rect' ? null : 'rect')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'rect'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <Square size={14} />
                <span>Prostokąt</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'circle' ? null : 'circle')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'circle'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                <Circle size={14} />
                <span>Koło</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(null)}
                className="p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 transition-all cursor-pointer"
                title="Wyłącz narzędzie rysowania"
              >
                <X size={14} />
                <span>Wyłącz</span>
              </button>
            </div>

            {/* PARAMETRY PISAKA / KSZTAŁTU */}
            {activeDrawTool && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2.5 animate-in fade-in duration-150">
                {/* Kolory */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400">Kolor</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DRAW_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onChangeDrawColor?.(c.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                          drawColor === c.value ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      >
                        {drawColor === c.value && (
                          <Check size={11} className={c.value === '#ffffff' ? 'text-slate-900' : 'text-white'} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grubość */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400">Grubość linii</span>
                  <div className="grid grid-cols-4 gap-1">
                    {STROKE_WIDTHS.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => onChangeDrawStrokeWidth?.(w.value)}
                        className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          drawStrokeWidth === w.value
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingToolPalette;

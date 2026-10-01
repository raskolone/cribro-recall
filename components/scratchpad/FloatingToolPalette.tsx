import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Wrench,
  X,
  ChevronDown,
  ChevronUp,
  Heading1,
  Heading2,
  Pilcrow,
  Image as ImageIcon,
  Paperclip,
  Sparkles,
  Link2,
  Copy,
  Square,
  PenTool,
  Paintbrush,
  Eraser,
  Minus,
  ArrowRight,
  Circle,
  Grid2x2,
  Check,
  CheckSquare,
} from 'lucide-react';

export type ToolTab = 'CONTENT' | 'DRAW';

export interface FloatingToolPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher: boolean;
  /** Motyw kartki (ten sam co `data-pad-theme` na powłoce notatnika) */
  paperTheme?: 'light' | 'dark';
  editorRef: React.RefObject<HTMLDivElement | null>;
  // Akcje CONTENT
  onInsertText?: (tag: 'p' | 'h1' | 'h2' | 'h3' | 'blockquote') => void;
  onInsertImage?: () => void;
  onInsertAttachment?: () => void;
  onOpenExerciseStudio?: () => void;
  onInsertLink?: () => void;
  onInsertTable?: (rows: number) => void;
  onInsertChecklist?: () => void;
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
  paperTheme = 'dark',
  editorRef,
  onInsertText,
  onInsertImage,
  onInsertAttachment,
  onOpenExerciseStudio,
  onInsertLink,
  onInsertTable,
  onInsertChecklist,
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
  // Domyślnie zwinięty: sam pasek tytułowy, pełne narzędzia po rozwinięciu
  const [isCollapsed, setIsCollapsed] = useState(true);
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
      const defaultX = Math.max(20, window.innerWidth - 320);
      const defaultY = 150;
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

      const maxX = Math.max(0, window.innerWidth - (panelRef.current?.offsetWidth || 300) - 10);
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

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Floating Tool Palette"
      data-testid="floating-tool-palette"
      data-pad-theme={paperTheme}
      data-collapsed={isCollapsed ? '1' : '0'}
      className={`pad-tools fixed z-[75] ${isCollapsed ? 'w-[220px]' : 'w-[300px]'} rounded-2xl border shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── DRAG HEADER ── */}
      <div
        onMouseDown={handleDragStart}
        className={`pad-tools-head px-3 py-2 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing ${isCollapsed ? '' : 'border-b'}`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Wrench size={14} />
          </div>
          <span className="text-xs font-bold tracking-tight flex items-center gap-1.5">
            <span>Lesson Tools</span>
            {!isCollapsed && (
              <span className="pad-tools-chip text-[10px] font-mono px-1.5 py-0.2 rounded font-normal">
                Canvas
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsCollapsed((v) => !v)}
            className="pad-tools-iconbtn p-1 rounded-lg transition-colors cursor-pointer"
            title={isCollapsed ? 'Rozwiń panel' : 'Zwiń panel'}
            aria-label={isCollapsed ? 'Rozwiń panel' : 'Zwiń panel'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="pad-tools-iconbtn p-1 rounded-lg transition-colors cursor-pointer"
            title="Zamknij panel (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isCollapsed && (<>
      {/* ── TABS NAVIGATION (CONTENT | DRAW) ── */}
      <div className="pad-tools-tabs grid grid-cols-2 p-1.5 border-b gap-1 text-[11px] font-bold">
        {(['CONTENT', 'DRAW'] as ToolTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                isActive
                  ? 'pad-tools-active shadow-sm font-extrabold'
                  : 'pad-tools-tab'
              }`}
            >
              <span>{tab}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="p-3 space-y-3 max-h-[min(380px,55vh)] overflow-y-auto">
        {/* TAB 1: CONTENT */}
        {activeTab === 'CONTENT' && (
          <div className="space-y-3">
            <div className="pad-tools-label text-[10px] font-bold uppercase tracking-wider">
              Wstawianie i edycja treści
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onInsertText?.('p')}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Pilcrow size={14} className="text-emerald-400 shrink-0" />
                <span>Akapit (Tekst)</span>
              </button>

              <button
                type="button"
                onClick={() => onInsertText?.('h1')}
                title="Główny nagłówek lekcji — pojawia się w spisie treści jako nadrzędny punkt"
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Heading1 size={14} className="text-emerald-400 shrink-0" />
                <span>Nagłówek lekcji (H1)</span>
              </button>

              <button
                type="button"
                onClick={() => onInsertText?.('h2')}
                title="Nagłówek sekcji — w spisie treści wcięty jako podelement bieżącej lekcji"
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Heading2 size={14} className="text-emerald-400 shrink-0" />
                <span>Nagłówek sekcji (H2)</span>
              </button>

              <button
                type="button"
                onClick={onInsertImage}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <ImageIcon size={14} className="text-sky-400 shrink-0" />
                <span>Wstaw obraz</span>
              </button>

              <button
                type="button"
                onClick={onInsertAttachment}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Paperclip size={14} className="text-sky-400 shrink-0" />
                <span>Załącznik lekcji</span>
              </button>

              <button
                type="button"
                onClick={onOpenExerciseStudio}
                className="pad-tools-studio col-span-2 p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-emerald-400" />
                  <span>Exercise Studio & Gry</span>
                </div>
                <span className="pad-tools-active text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">Nowe</span>
              </button>

              <button
                type="button"
                onClick={() => onInsertTable?.(2)}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Grid2x2 size={14} className="text-amber-400 shrink-0" />
                <span>Tabela 2×2</span>
              </button>

              <button
                type="button"
                onClick={onInsertLink}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Link2 size={14} className="text-indigo-400 shrink-0" />
                <span>Wstaw link</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onInsertChecklist}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
                title="Wstaw pole zadania z możliwością odhaczania (Checklist)"
              >
                <CheckSquare size={14} className="text-emerald-400 shrink-0" />
                <span>Lista zadań</span>
              </button>

              <button
                type="button"
                onClick={onDuplicateSelection}
                className="p-2 rounded-xl pad-tools-btn border text-left flex items-center gap-2 transition-colors cursor-pointer text-xs font-semibold"
              >
                <Copy size={14} className="pad-tools-neutral-ic shrink-0" />
                <span>Duplikuj blok</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DRAW */}
        {activeTab === 'DRAW' && (
          <div className="space-y-3">
            <div className="pad-tools-label text-[10px] font-bold uppercase tracking-wider">
              Rysowanie, pisak i kształty
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectDrawTool?.(activeDrawTool === 'pen' ? null : 'pen')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeDrawTool === 'pen'
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
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
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
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
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
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
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
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
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
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
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
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
                    ? 'pad-tools-active shadow-md'
                    : 'pad-tools-btn border'
                }`}
              >
                <Circle size={14} />
                <span>Koło</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectDrawTool?.(null)}
                className="p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 pad-tools-btn border transition-all cursor-pointer"
                title="Wyłącz narzędzie rysowania"
              >
                <X size={14} />
                <span>Wyłącz</span>
              </button>
            </div>

            {/* PARAMETRY PISAKA / KSZTAŁTU */}
            {activeDrawTool && (
              <div className="pad-tools-sub p-3 rounded-xl border space-y-2.5 animate-in fade-in duration-150">
                {/* Kolory */}
                <div className="space-y-1">
                  <span className="pad-tools-label text-[10px] font-bold">Kolor</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DRAW_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onChangeDrawColor?.(c.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                          drawColor === c.value ? 'pad-tools-swatch-on scale-110 shadow-sm' : 'border-transparent hover:scale-105'
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
                  <span className="pad-tools-label text-[10px] font-bold">Grubość linii</span>
                  <div className="grid grid-cols-4 gap-1">
                    {STROKE_WIDTHS.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => onChangeDrawStrokeWidth?.(w.value)}
                        className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          drawStrokeWidth === w.value
                            ? 'pad-tools-active shadow-sm'
                            : 'pad-tools-btn'
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
      </>)}
    </div>,
    document.body
  );
};

export default FloatingToolPalette;

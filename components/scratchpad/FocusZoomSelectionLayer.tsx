import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Square,
  Lasso,
  Crosshair,
  Maximize2,
  RotateCcw,
  X,
  Sparkles,
  Eye,
  Check,
  ZoomIn,
  AlertCircle,
} from 'lucide-react';
import { prefersReducedMotion } from '../../services/gsapAnimations';
import {
  DocumentRect,
  Point,
  viewportPointToDocumentPoint,
  viewportRectToDocumentRect,
  computeLassoBoundingBox,
  computeObjectBoundingBox,
  calculateFocusTransform,
} from '../../utils/focusZoomGeometry';

export type FocusZoomMode = 'rectangle' | 'lasso' | 'object';

export type FocusBoundingBox = DocumentRect;

interface FocusZoomSelectionLayerProps {
  isActive: boolean;
  onClose: () => void;
  onPresentFocus: (box: FocusBoundingBox) => void;
  paperRef: React.RefObject<HTMLDivElement | null>;
  isTeacher: boolean;
}

export const FocusZoomSelectionLayer: React.FC<FocusZoomSelectionLayerProps> = ({
  isActive,
  onClose,
  onPresentFocus,
  paperRef,
  isTeacher,
}) => {
  const [mode, setMode] = useState<FocusZoomMode>('rectangle');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentBox, setCurrentBox] = useState<FocusBoundingBox | null>(null);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [hoveredObjectBox, setHoveredObjectBox] = useState<FocusBoundingBox | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pobiera współrzędne w układzie dokumentu A4 (Document coordinates)
  const getDocumentCoords = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    if (!paperRef.current) return { x: 0, y: 0 };
    const rect = paperRef.current.getBoundingClientRect();
    return viewportPointToDocumentPoint({ x: e.clientX, y: e.clientY }, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, [paperRef]);

  // Obsługa skrótów klawiaturowych (F, R, L, Esc, 0, Enter)
  useEffect(() => {
    if (!isTeacher) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === 'Escape') {
        if (currentBox) {
          e.preventDefault();
          setCurrentBox(null);
          setLassoPoints([]);
        } else if (isActive) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (isInput) return;

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (isActive) {
          onClose();
        }
      } else if (isActive && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setMode('rectangle');
        setFeedbackNotice(null);
      } else if (isActive && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setMode('lasso');
        setFeedbackNotice(null);
      } else if (isActive && e.key === '0') {
        e.preventDefault();
        setCurrentBox(null);
        setLassoPoints([]);
        setFeedbackNotice(null);
      } else if (isActive && e.key === 'Enter' && currentBox) {
        e.preventDefault();
        onPresentFocus(currentBox);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTeacher, isActive, currentBox, onClose, onPresentFocus]);

  // Rozpoczęcie zaznaczania myszą
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isActive || e.button !== 0) return;
    const coords = getDocumentCoords(e);
    setFeedbackNotice(null);

    if (mode === 'object') {
      if (hoveredObjectBox) {
        setCurrentBox(hoveredObjectBox);
      }
      return;
    }

    setIsDrawing(true);
    setStartPoint(coords);
    if (!paperRef.current) return;
    const paperRect = paperRef.current.getBoundingClientRect();

    if (mode === 'rectangle') {
      setCurrentBox({
        left: coords.x,
        top: coords.y,
        width: 0,
        height: 0,
        sourceType: 'rectangle',
        paperWidth: paperRect.width,
        paperHeight: paperRect.height,
      });
    } else if (mode === 'lasso') {
      setLassoPoints([coords]);
      setCurrentBox(null);
    }
  };

  // Rysowanie / przeciąganie zaznaczenia (obsługuje dowolny kierunek i Document coordinates)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isActive) return;
    const coords = getDocumentCoords(e);

    if (mode === 'object' && !isDrawing) {
      const elem = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (elem && paperRef.current && paperRef.current.contains(elem) && elem !== paperRef.current) {
        const targetObj = elem.closest('img, table, [data-exercise-widget], .pad-locked-heading, p, blockquote, div') as HTMLElement | null;
        if (targetObj && paperRef.current) {
          const objBox = computeObjectBoundingBox(targetObj, paperRef.current);
          setHoveredObjectBox(objBox);
          return;
        }
      }
      setHoveredObjectBox(null);
      return;
    }

    if (!isDrawing || !startPoint || !paperRef.current) return;
    const paperRect = paperRef.current.getBoundingClientRect();

    if (mode === 'rectangle') {
      const left = Math.min(startPoint.x, coords.x);
      const top = Math.min(startPoint.y, coords.y);
      const width = Math.abs(coords.x - startPoint.x);
      const height = Math.abs(coords.y - startPoint.y);
      setCurrentBox({
        left,
        top,
        width,
        height,
        sourceType: 'rectangle',
        paperWidth: paperRect.width,
        paperHeight: paperRect.height,
      });
    } else if (mode === 'lasso') {
      setLassoPoints((prev) => [...prev, coords]);
    }
  };

  // Zakończenie zaznaczania myszą
  const handleMouseUp = () => {
    if (!isDrawing || !paperRef.current) return;
    setIsDrawing(false);
    const paperRect = paperRef.current.getBoundingClientRect();

    if (mode === 'lasso' && lassoPoints.length > 2) {
      const box = computeLassoBoundingBox(lassoPoints, {
        width: paperRect.width,
        height: paperRect.height,
      });

      if (box && (box.width < 12 || box.height < 12)) {
        setFeedbackNotice('Zaznaczony obszar jest zbyt mały (min. 12×12 px)');
        setCurrentBox(null);
        setLassoPoints([]);
      } else if (box) {
        setCurrentBox(box);
        setLassoPoints([]); // zamyka i czyści overlay lasso
      }
    } else if (mode === 'rectangle' && currentBox) {
      // Minimalny próg 12×12 px
      if (currentBox.width < 12 || currentBox.height < 12) {
        setFeedbackNotice('Zaznaczony obszar jest zbyt mały (min. 12×12 px)');
        setCurrentBox(null);
      }
    }
  };

  if (!isActive || !isTeacher) return null;

  // Ścieżka SVG dla lasso
  const lassoPathData =
    lassoPoints.length > 1
      ? `M ${lassoPoints.map((p) => `${p.x} ${p.y}`).join(' L ')}`
      : '';

  // Szacowany wskaźnik zoomu
  const calculateEstimatedZoom = (box: FocusBoundingBox): number => {
    if (!paperRef.current || box.width <= 0 || box.height <= 0) return 1.5;
    const paperW = paperRef.current.clientWidth || 794;
    const paperH = paperRef.current.clientHeight || 1123;
    const transform = calculateFocusTransform({
      focusRect: box,
      paperWidth: paperW,
      paperHeight: paperH,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    return transform.scale;
  };

  return (
    <div
      ref={containerRef}
      data-testid="focus-zoom-selection-layer"
      className="absolute inset-0 z-40 cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ pointerEvents: 'auto' }}
    >
      {/* PÓŁPRZEZROCZYSTA WARSTWA PRZYCIEMNIENIA */}
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[0.5px] transition-opacity" />

      {/* SVG DLA LASSO ORAZ RAMKI ZAZNACZENIA */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
        {/* Rysowana linia lasso */}
        {mode === 'lasso' && isDrawing && lassoPathData && (
          <path
            d={lassoPathData}
            fill="rgba(16, 185, 129, 0.12)"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Podgląd podświetlenia obiektu w trybie object */}
        {mode === 'object' && hoveredObjectBox && !currentBox && (
          <rect
            x={hoveredObjectBox.left}
            y={hoveredObjectBox.top}
            width={hoveredObjectBox.width}
            height={hoveredObjectBox.height}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4 4"
            rx="6"
          />
        )}
      </svg>

      {/* RAMKA AKTYWNEGO ZAZNACZENIA */}
      {currentBox && (
        <div
          data-testid="focus-zoom-bounding-box"
          className="absolute border-2 border-emerald-500 rounded-lg shadow-2xl pointer-events-none transition-all duration-75"
          style={{
            left: `${currentBox.left}px`,
            top: `${currentBox.top}px`,
            width: `${currentBox.width}px`,
            height: `${currentBox.height}px`,
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45), 0 0 30px rgba(16, 185, 129, 0.35)',
          }}
        >
          {/* NAROŻNIKI KADRU */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-sm" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-sm" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-sm" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-sm" />

          {/* ETYKIETA KADRU ZE WSKAŹNIKIEM ZOOMU */}
          <div className="absolute -top-7 left-0 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold font-mono tracking-tight flex items-center gap-1.5 shadow-md">
            <ZoomIn size={12} />
            <span>Kadr: {calculateEstimatedZoom(currentBox)}x</span>
          </div>
        </div>
      )}

      {/* PŁYWAJĄCY PASEK AKCJI PO ZAZNACZENIU */}
      {currentBox && (
        <div
          data-testid="focus-zoom-actions"
          className="absolute z-50 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          style={{
            left: `${Math.max(10, Math.min(window.innerWidth - 320, currentBox.left + currentBox.width / 2 - 130))}px`,
            top: `${currentBox.top + currentBox.height + 14}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onPresentFocus(currentBox)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            title="Powiększ i prezentuj zaznaczony kadr kursantowi (Enter)"
            aria-label="Prezentuj zaznaczony kadr"
          >
            <Maximize2 size={13} />
            <span>Prezentuj kadr</span>
            <kbd className="px-1 py-0.2 text-[9px] bg-slate-950/20 rounded font-mono font-normal">↵</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentBox(null);
              setLassoPoints([]);
            }}
            className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Wyczyść zaznaczenie (Esc)"
            aria-label="Wyczyść zaznaczenie"
          >
            <RotateCcw size={13} />
            <span>Wyczyść</span>
          </button>

          <span className="w-px h-4 bg-white/20 mx-0.5" />

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zamknij Focus Zoom"
            aria-label="Zamknij Focus Zoom"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* KOMUNIKAT BŁĘDU / ZBYT MAŁEGO ZAZNACZENIA */}
      {feedbackNotice && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl bg-amber-500/95 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in fade-in duration-200">
          <AlertCircle size={15} />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* GÓRNY MINI-TOOLBAR WYBORU TRYBU FOCUS ZOOM */}
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1.5 rounded-2xl bg-slate-900/95 border border-white/15 shadow-2xl backdrop-blur-xl text-white pointer-events-auto select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-2 text-xs font-bold text-emerald-400">
          <Sparkles size={14} />
          <span className="hidden sm:inline">Focus Zoom:</span>
        </div>

        <button
          type="button"
          onClick={() => setMode('rectangle')}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'rectangle'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title="Zaznacz prostokątem (skrót: R)"
          aria-label="Tryb prostokątnego zaznaczania"
        >
          <Square size={13} />
          <span>Prostokąt</span>
          <kbd className="hidden md:inline px-1 text-[9px] bg-slate-950/30 rounded font-mono">R</kbd>
        </button>

        <button
          type="button"
          onClick={() => setMode('lasso')}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'lasso'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title="Zaznacz lasso / odręcznie (skrót: L)"
          aria-label="Tryb zaznaczania lasso"
        >
          <Lasso size={13} />
          <span>Lasso</span>
          <kbd className="hidden md:inline px-1 text-[9px] bg-slate-950/30 rounded font-mono">L</kbd>
        </button>

        <button
          type="button"
          onClick={() => setMode('object')}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'object'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title="Wskaż i powiększ obiekt (obraz, ćwiczenie, tabelę)"
          aria-label="Tryb powiększania obiektów"
        >
          <Crosshair size={13} />
          <span>Obiekt</span>
        </button>

        <span className="w-px h-5 bg-white/20 mx-1" />

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Wyjdź z Focus Zoom (Esc)"
          aria-label="Wyjdź z Focus Zoom"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import { Slide, SlideElement } from '../../types/presentation';
import { Move, Type, Image as ImageIcon, BookOpen, HelpCircle, Trash2 } from 'lucide-react';

interface SlideCanvasProps {
  slide: Slide | null;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElementPosition: (id: string, newPosition: { x: number; y: number }) => void;
  onDeleteElement: (id: string) => void;
}

/**
 * SlideCanvas: Płótno slajdu o stałych proporcjach 16:9, skalujące się responsywnie do okna.
 * Obsługuje przesuwanie elementów drag & drop w układzie procentowym (0-100%).
 */
export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  selectedElementId,
  onSelectElement,
  onUpdateElementPosition,
  onDeleteElement,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragStartOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center text-content-muted text-sm font-semibold">
        Brak aktywnego slajdu. Dodaj slajd z menu po lewej stronie.
      </div>
    );
  }

  // Obsługa przesuwania elementu (Drag & Drop)
  const handleMouseDown = (e: React.MouseEvent, element: SlideElement) => {
    e.stopPropagation();
    onSelectElement(element.id);
    draggingIdRef.current = element.id;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Oblicz kliknięcie względem lewego-górnego rogu elementu
    const elemPixelX = (element.position.x / 100) * rect.width;
    const elemPixelY = (element.position.y / 100) * rect.height;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    dragStartOffsetRef.current = {
      offsetX: clickX - elemPixelX,
      offsetY: clickY - elemPixelY,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!draggingIdRef.current || !canvasRef.current) return;
      const currentRect = canvasRef.current.getBoundingClientRect();
      const currentClickX = moveEvent.clientX - currentRect.left;
      const currentClickY = moveEvent.clientY - currentRect.top;

      const newPixelX = currentClickX - dragStartOffsetRef.current.offsetX;
      const newPixelY = currentClickY - dragStartOffsetRef.current.offsetY;

      const newPercentX = Math.max(0, Math.min(85, (newPixelX / currentRect.width) * 100));
      const newPercentY = Math.max(0, Math.min(85, (newPixelY / currentRect.height) * 100));

      onUpdateElementPosition(draggingIdRef.current, {
        x: Math.round(newPercentX * 10) / 10,
        y: Math.round(newPercentY * 10) / 10,
      });
    };

    const handleMouseUp = () => {
      draggingIdRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden select-none bg-base-300/40"
      onClick={() => onSelectElement(null)}
    >
      {/* Kontener 16:9 z zachowaniem proporcji */}
      <div className="w-full max-w-5xl aspect-video max-h-full relative flex items-center justify-center">
        <div
          ref={canvasRef}
          className="w-full h-full rounded-2xl sm:rounded-3xl border border-line-strong bg-gradient-to-br from-base-200 via-base-100 to-base-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.55)] relative overflow-hidden flex flex-col justify-between"
          style={{ backgroundColor: slide.backgroundColor }}
        >
          {/* Siatka pomocnicza i tło techniczne */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40" />

          {/* Znacznik proporcji 16:9 */}
          <div className="absolute top-3 right-4 z-0 pointer-events-none flex items-center gap-2 text-[10px] font-mono uppercase text-content-muted/40 font-bold">
            <span>Slide Canvas</span>
            <span>•</span>
            <span>16:9 Aspect Ratio</span>
          </div>

          {/* Renderowanie elementów slajdu */}
          {slide.elements.map((el) => {
            const isSelected = selectedElementId === el.id;

            return (
              <div
                key={el.id}
                onMouseDown={(e) => handleMouseDown(e, el)}
                style={{
                  left: `${el.position.x}%`,
                  top: `${el.position.y}%`,
                  width: el.style?.width ? `${el.style.width}%` : undefined,
                }}
                className={`absolute cursor-move transition-shadow duration-150 group z-10 ${
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-300 shadow-2xl rounded-xl z-20'
                    : 'hover:ring-1 hover:ring-primary/50 rounded-xl'
                }`}
              >
                {/* Pasek kontrolny zaznaczonego elementu */}
                {isSelected && (
                  <div className="absolute -top-7 left-0 flex items-center gap-1.5 bg-base-300 border border-primary/40 px-2 py-0.5 rounded-md shadow-md text-[10px] font-mono text-text-hi z-30 pointer-events-auto">
                    <Move size={11} className="text-primary" />
                    <span>X: {el.position.x}% Y: {el.position.y}%</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteElement(el.id);
                      }}
                      className="ml-1 text-red-400 hover:text-red-300 p-0.5 rounded cursor-pointer"
                      title="Usuń element"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}

                {/* Zawartość zależna od typu elementu */}
                <div
                  style={{
                    fontSize: el.style?.fontSize ? `${el.style.fontSize}px` : undefined,
                    fontWeight: el.style?.fontWeight,
                    color: el.style?.color,
                    backgroundColor: el.style?.backgroundColor,
                    padding: el.style?.padding ? `${el.style.padding}px` : undefined,
                    borderRadius: el.style?.borderRadius ? `${el.style.borderRadius}px` : undefined,
                    border: el.style?.border,
                  }}
                  className="w-full"
                >
                  {el.type === 'text' && (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {el.content.startsWith('# ') ? (
                        <h1 className="text-xl sm:text-2xl font-black text-text-hi tracking-tight">
                          {el.content.replace('# ', '')}
                        </h1>
                      ) : el.content.startsWith('## ') ? (
                        <h2 className="text-lg sm:text-xl font-bold text-text-hi">
                          {el.content.replace('## ', '')}
                        </h2>
                      ) : el.content.startsWith('### ') ? (
                        <h3 className="text-base sm:text-lg font-bold text-text-hi">
                          {el.content.replace('### ', '')}
                        </h3>
                      ) : (
                        <p className="text-xs sm:text-sm text-text-hi/90">{el.content}</p>
                      )}
                    </div>
                  )}

                  {el.type === 'image' && (
                    <div className="relative overflow-hidden rounded-xl border border-line-strong group">
                      <img
                        src={el.content}
                        alt="Załączony materiał"
                        className="w-full h-auto object-cover max-h-[360px] rounded-xl"
                      />
                    </div>
                  )}

                  {el.type === 'vocabulary' && (
                    <div className="space-y-2 max-w-lg">
                      {el.vocabularyData && el.vocabularyData.length > 0 ? (
                        el.vocabularyData.map((voc, vIdx) => (
                          <div
                            key={vIdx}
                            className="p-2.5 sm:p-3 rounded-xl bg-base-200/90 border border-line-strong flex items-start justify-between gap-3 shadow-sm"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-amber-300">{voc.term}</span>
                                <span className="text-[11px] text-content-muted">({voc.translation})</span>
                              </div>
                              {voc.example && (
                                <p className="text-[11px] sm:text-xs text-content-muted mt-1 italic leading-snug">
                                  "{voc.example}"
                                </p>
                              )}
                            </div>
                            <BookOpen size={15} className="text-amber-400 shrink-0 mt-0.5" />
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-content-muted italic">Pusta lista słownictwa.</p>
                      )}
                    </div>
                  )}

                  {el.type === 'exercise' && (
                    <div className="p-3 sm:p-4 rounded-xl bg-base-200/90 border border-emerald-500/30 max-w-md shadow-md space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <HelpCircle size={14} />
                        <span>{el.exerciseData?.instruction || 'Ćwiczenie'}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-text-hi leading-relaxed whitespace-pre-wrap">
                        {el.exerciseData?.prompt || el.content}
                      </p>
                      {el.exerciseData?.answer && (
                        <div className="pt-2 border-t border-line text-[11px] text-content-muted">
                          <span className="font-semibold text-emerald-300">Wskazówka: </span>
                          <span>{el.exerciseData.answer}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Stopka slajdu: notatki lektora (dyskretny podgląd) */}
          <div className="px-6 py-3 bg-base-300/80 border-t border-line-strong flex items-center justify-between text-[11px] text-content-muted z-10">
            <div className="truncate max-w-[70%]">
              <span className="font-bold text-text-hi mr-1.5">Notatka lektora:</span>
              <span className="italic">{slide.notes || 'Brak notatek do tego slajdu.'}</span>
            </div>
            <div className="font-mono font-bold text-primary text-[10px] uppercase">
              {slide.title}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

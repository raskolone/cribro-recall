import React, { useEffect, useState, useRef } from 'react';
import {
  AlertCircle, CheckCircle2, Bookmark, ArrowRightLeft,
  Strikethrough, Bold, Italic, Palette, Eraser, Sparkles
} from 'lucide-react';

export interface SelectionCoord {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TeacherFormattingToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  isReadOnly?: boolean;
  isStudent?: boolean;
  onApplyFormat?: (tag: string, className?: string) => void;
  onContentChange?: () => void;
}

export const TeacherFormattingToolbar: React.FC<TeacherFormattingToolbarProps> = ({
  editorRef,
  isReadOnly = false,
  isStudent = false,
  onApplyFormat,
  onContentChange,
}) => {
  const [coords, setCoords] = useState<SelectionCoord | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Śledzenie zaznaczenia tekstu wewnątrz edytora
  useEffect(() => {
    if (isReadOnly || isStudent) {
      setCoords(null);
      return;
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setCoords(null);
        setSelectedText('');
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length === 0) {
        setCoords(null);
        setSelectedText('');
        return;
      }

      const range = selection.getRangeAt(0);
      const editor = editorRef.current;
      if (!editor || !editor.contains(range.commonAncestorContainer)) {
        setCoords(null);
        setSelectedText('');
        return;
      }

      const rect = range.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();

      // Pozycja nad zaznaczeniem
      const top = rect.top - editorRect.top + editor.scrollTop - 44;
      const left = Math.max(10, rect.left - editorRect.left + rect.width / 2);

      setSelectedText(text);
      setCoords({
        top: Math.max(10, top),
        left,
        width: rect.width,
        height: rect.height,
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editorRef, isReadOnly, isStudent]);

  if (!coords || isReadOnly || isStudent) return null;

  // Aplikowanie stylu oznaczenia
  const applyMarkup = (className: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedContent = range.extractContents();
    const span = document.createElement('span');
    span.className = className;
    span.appendChild(selectedContent);
    range.insertNode(span);

    selection.removeAllRanges();
    setCoords(null);
    if (onContentChange) onContentChange();
  };

  // Standardowe formatowanie execCommand
  const applyExecCommand = (cmd: string, value?: string) => {
    window.document.execCommand(cmd, false, value);
    if (onContentChange) onContentChange();
  };

  // Wyczyszczenie oznaczeń
  const clearFormatting = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    window.document.execCommand('removeFormat', false, undefined);

    // Usuń ewentualne spany wewnątrz zaznaczenia
    const parentSpan = (selection.anchorNode?.parentElement as HTMLElement);
    if (parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.className.includes('pad-mark')) {
      const text = parentSpan.textContent || '';
      const textNode = document.createTextNode(text);
      parentSpan.parentNode?.replaceChild(textNode, parentSpan);
    }

    selection.removeAllRanges();
    setCoords(null);
    if (onContentChange) onContentChange();
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Teacher Formatting Toolbar"
      data-testid="teacher-formatting-toolbar"
      onMouseDown={(e) => e.preventDefault()} // Zapobiega utracie zaznaczenia
      className="absolute z-50 -translate-x-1/2 flex items-center gap-0.5 p-1 rounded-2xl bg-ink-2/95 border border-line-strong shadow-2xl backdrop-blur-xl animate-fadeIn select-none"
      style={{
        top: coords.top,
        left: coords.left,
        backgroundColor: 'var(--exercise-surface-elevated, #1e293b)',
        borderColor: 'var(--exercise-border, rgba(255, 255, 255, 0.15))',
      }}
    >
      {/* 1. BŁĄD (pad-mark-error) */}
      <button
        type="button"
        onClick={() => applyMarkup('pad-mark-error')}
        title="Oznacz jako błąd"
        className="px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
      >
        <AlertCircle size={12} />
        <span>Błąd</span>
      </button>

      {/* 2. POPRAWNIE (pad-mark-correct) */}
      <button
        type="button"
        onClick={() => applyMarkup('pad-mark-correct')}
        title="Oznacz jako poprawną formę"
        className="px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
      >
        <CheckCircle2 size={12} />
        <span>Poprawnie</span>
      </button>

      {/* 3. SŁÓWKO (pad-mark-vocab) */}
      <button
        type="button"
        onClick={() => applyMarkup('pad-mark-vocab')}
        title="Oznacz jako nowe słówko (Target language)"
        className="px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer"
      >
        <Bookmark size={12} />
        <span>Słówko</span>
      </button>

      {/* 4. KOREKTA (pad-mark-correction) */}
      <button
        type="button"
        onClick={() => applyMarkup('pad-mark-correction')}
        title="Oznacz jako korektę"
        className="px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
      >
        <ArrowRightLeft size={12} />
        <span>Korekta</span>
      </button>

      <div className="w-[1px] h-4 bg-white/20 mx-0.5" />

      {/* 5. PRZEKREŚLENIE */}
      <button
        type="button"
        onClick={() => applyExecCommand('strikeThrough')}
        title="Przekreślenie"
        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Strikethrough size={13} />
      </button>

      {/* 6. POGRUBIENIE */}
      <button
        type="button"
        onClick={() => applyExecCommand('bold')}
        title="Pogrubienie"
        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Bold size={13} />
      </button>

      {/* 7. KURSYWA */}
      <button
        type="button"
        onClick={() => applyExecCommand('italic')}
        title="Kursywa"
        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Italic size={13} />
      </button>

      {/* 8. KOLOR AKCENTOWY */}
      <button
        type="button"
        onClick={() => applyMarkup('pad-mark-accent')}
        title="Kolor akcentowy CRIBRO"
        className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
      >
        <Palette size={13} />
      </button>

      {/* 9. WYCZYŚĆ OZNACZENIE */}
      <button
        type="button"
        onClick={clearFormatting}
        title="Wyczyść formatowanie"
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Eraser size={13} />
      </button>
    </div>
  );
};

export default TeacherFormattingToolbar;

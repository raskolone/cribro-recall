import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Calendar,
  Layers,
  Sparkles,
  Share2,
  Copy,
  Check,
  RotateCcw,
  RotateCw,
  Lock,
  Unlock,
  Eye,
  FileText,
  AlertCircle,
  CloudCheck,
  CloudUpload,
} from 'lucide-react';
import { ScratchpadDocument } from '../../types';
import { buildScratchpadUrl } from '../../services/scratchpadService';
import { formatAccessCode } from '../../utils/accessCode';
import Button from '../ui/Button';

interface ScratchpadEditorProps {
  document: ScratchpadDocument;
  onSaveContent?: (html: string, text: string) => Promise<any> | void;
  onToggleStudentEdit?: (allow: boolean) => Promise<void>;
  onPushToLessonRecord?: (data: {
    topic: string;
    words: string;
    summary: string;
    thingsToImprove: string;
    followUp: string;
  }) => void;
  currentUser?: {
    uid: string;
    name: string;
    role: 'teacher' | 'student' | 'admin';
  } | null;
  readOnly?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const ScratchpadEditor: React.FC<ScratchpadEditorProps> = ({
  document: docData,
  onSaveContent,
  onToggleStudentEdit,
  onPushToLessonRecord,
  currentUser,
  readOnly: explicitReadOnly,
  className = '',
  autoFocus = false,
}) => {
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  
  // Kursant może edytować tylko wtedy, gdy lektor włączył flagę `allowStudentEdit` i nie narzucono explicitReadOnly
  const isReadOnly = explicitReadOnly || (!isTeacher && !docData.allowStudentEdit);

  const editorRef = useRef<HTMLDivElement>(null);
  const isUserTypingRef = useRef(false);
  const typingResetTimeoutRef = useRef<any>(null);
  const saveTimeoutRef = useRef<any>(null);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'synced' | 'local_only'>('saved');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Funkcja wyciągająca czysty tekst z HTML
  const extractText = (html: string): string => {
    const tmp = window.document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || '';
  };

  // Inicjalizacja lub aktualizacja zawartości z zewnątrz
  useEffect(() => {
    if (!editorRef.current) return;

    // Aktualizuj tylko, gdy użytkownik aktualnie sam nie pisze
    if (!isUserTypingRef.current) {
      if (editorRef.current.innerHTML !== docData.contentHtml) {
        editorRef.current.innerHTML = docData.contentHtml || '';
        const txt = extractText(docData.contentHtml || '');
        setWordCount(txt.trim() ? txt.trim().split(/\s+/).length : 0);
        setSaveStatus('synced');
      }
    }
  }, [docData.contentHtml, docData.version]);

  useEffect(() => {
    if (autoFocus && editorRef.current && !isReadOnly) {
      editorRef.current.focus();
    }
  }, [autoFocus, isReadOnly]);

  // Debounce zapisu zmian do Firestore / LocalStorage
  const triggerDebouncedSave = useCallback(
    (html: string) => {
      if (isReadOnly || !onSaveContent) return;

      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const text = extractText(html);
          const res = await onSaveContent(html, text);
          if (res && typeof res === 'object' && res.cloud === false) {
            setSaveStatus('local_only');
          } else {
            setSaveStatus('saved');
          }
        } catch (err) {
          console.error('Błąd zapisu Scratchpada:', err);
          setSaveStatus('local_only');
        }
      }, 600);
    },
    [isReadOnly, onSaveContent]
  );

  const handleInput = () => {
    if (!editorRef.current || isReadOnly) return;

    isUserTypingRef.current = true;
    if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current);
    typingResetTimeoutRef.current = setTimeout(() => {
      isUserTypingRef.current = false;
    }, 1500);

    const html = editorRef.current.innerHTML;
    const txt = extractText(html);
    setWordCount(txt.trim() ? txt.trim().split(/\s+/).length : 0);

    triggerDebouncedSave(html);
  };

  // Komendy formatowania tekstu
  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (isReadOnly) return;
    window.document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const handleFormatBlock = (tag: string) => {
    if (isReadOnly) return;
    window.document.execCommand('formatBlock', false, `<${tag}>`);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  // Wstawienie dzisiejszej daty jako nagłówka nowej lekcji
  const handleInsertDate = () => {
    if (isReadOnly) return;
    const dateStr = new Date().toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const headerHtml = `<h2>📅 Lekcja — ${dateStr}</h2><p></p>`;
    window.document.execCommand('insertHTML', false, headerHtml);
    handleInput();
  };

  // Wstawienie szybkiego szablonu sekcji lekcji
  const handleInsertTemplate = () => {
    if (isReadOnly) return;
    const tpl = `
      <h3>💡 Nowe słownictwo</h3>
      <ul><li>...</li></ul>
      <h3>⚡ Poprawki językowe</h3>
      <ul><li>...</li></ul>
      <h3>📌 Ustalenia</h3>
      <p>...</p>
    `;
    window.document.execCommand('insertHTML', false, tpl);
    handleInput();
  };

  // Szybkie kolorowanie pod błędy / poprawki
  const handleHighlight = (bgColor: string, textColor: string) => {
    if (isReadOnly) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const span = window.document.createElement('span');
    span.style.backgroundColor = bgColor;
    span.style.color = textColor;
    span.style.padding = '1px 5px';
    span.style.borderRadius = '4px';
    span.style.fontWeight = '500';

    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      handleInput();
    } catch (e) {
      execCmd('hiliteColor', bgColor);
    }
  };

  // Kopiowanie linku lub kodu PIN
  const handleCopyLink = () => {
    const url = buildScratchpadUrl(docData.pin);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(docData.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Przeniesienie zawartości do formularza lekcji (4 bloki Notion)
  const handlePushToLesson = () => {
    if (!onPushToLessonRecord) return;

    const rawText = docData.contentText || (editorRef.current ? extractText(editorRef.current.innerHTML) : '');
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    // Prosta automatyczna ekstrakcja linii
    const vocabLines: string[] = [];
    const correctionLines: string[] = [];
    const generalLines: string[] = [];

    let currentSection: 'vocab' | 'corrections' | 'general' = 'general';

    for (const line of lines) {
      if (/słownictwo|vocabulary|nowe\s*słowa/i.test(line)) {
        currentSection = 'vocab';
        continue;
      }
      if (/poprawki|corrections|błędy|wymowa/i.test(line)) {
        currentSection = 'corrections';
        continue;
      }
      if (/ustalenia|notatki|zadanie|homework/i.test(line)) {
        currentSection = 'general';
        continue;
      }

      if (currentSection === 'vocab') {
        vocabLines.push(line.replace(/^[-*•]\s*/, ''));
      } else if (currentSection === 'corrections') {
        correctionLines.push(line.replace(/^[-*•]\s*/, ''));
      } else {
        generalLines.push(line);
      }
    }

    const todayStr = new Date().toLocaleDateString('pl-PL');
    onPushToLessonRecord({
      topic: `Lekcja ze Scratchpada (${todayStr})`,
      words: vocabLines.join('\n') || rawText.slice(0, 300),
      summary: generalLines.slice(0, 5).join('\n') || `Notatki ze wspólnego brudnopisu z dnia ${todayStr}`,
      thingsToImprove: correctionLines.join('\n'),
      followUp: 'Utrwalenie słownictwa i poprawek z brudnopisu lekcyjnego.',
    });
  };

  return (
    <div className={`flex flex-col bg-base-200 rounded-2xl border border-white/10 shadow-xl overflow-hidden ${className}`}>
      {/* 1. GÓRNY PASEK METADANYCH I UDOSTĘPNIANIA */}
      <header className="px-4 py-3 bg-base-300/80 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/20 shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
              <span>{docData.title || 'Brudnopis lekcyjny'}</span>
              {isReadOnly && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-content-muted flex items-center gap-1">
                  <Eye size={11} /> Podgląd na żywo
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-content-muted">
              <span>Kursant: <strong className="text-white/80">{docData.studentName}</strong></span>
              <span>•</span>
              {saveStatus === 'saving' && (
                <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                  <CloudUpload size={12} /> Zapisywanie...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CloudCheck size={12} /> Zapisano w chmurze
                </span>
              )}
              {saveStatus === 'synced' && (
                <span className="text-cyan-400 flex items-center gap-1">
                  <CloudCheck size={12} /> Zsynchronizowano
                </span>
              )}
              {saveStatus === 'local_only' && (
                <span className="text-amber-400 flex items-center gap-1" title="Zapisano w tej przeglądarce (wdrożenie reguł Firestore w toku)">
                  <CloudUpload size={12} /> Zapisano lokalnie
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Prawa strona: Kody PIN, Kopiowanie i Akcje Lektora */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Kod PIN */}
          <div className="flex items-center bg-base-200 px-2.5 py-1 rounded-xl border border-white/10 text-xs gap-2">
            <span className="text-content-muted text-[10px] uppercase font-mono">PIN:</span>
            <span className="font-mono font-bold text-primary tracking-wider">
              {formatAccessCode(docData.pin)}
            </span>
            <button
              type="button"
              onClick={handleCopyPin}
              className="text-content-muted hover:text-white transition-colors cursor-pointer p-0.5"
              title="Kopiuj kod PIN"
            >
              {copiedPin ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Przycisk Kopiuj link */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5"
          >
            {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span>{copiedLink ? 'Skopiowano!' : 'Udostępnij link'}</span>
          </Button>

          {/* Przełącznik uprawnień dla lektora */}
          {isTeacher && onToggleStudentEdit && (
            <button
              type="button"
              onClick={() => onToggleStudentEdit(!docData.allowStudentEdit)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                docData.allowStudentEdit
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-base-200 border-white/10 text-content-muted hover:text-white'
              }`}
              title={
                docData.allowStudentEdit
                  ? 'Kursant może obecnie edytować notatki. Kliknij, aby zablokować do podglądu.'
                  : 'Kursant ma tylko podgląd. Kliknij, aby zezwolić mu na pisanie.'
              }
            >
              {docData.allowStudentEdit ? <Unlock size={13} /> : <Lock size={13} />}
              <span>{docData.allowStudentEdit ? 'Edycja ucznia włączona' : 'Tylko podgląd ucznia'}</span>
            </button>
          )}

          {/* Przycisk Przenieś do Historii Lekcji */}
          {isTeacher && onPushToLessonRecord && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePushToLesson}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5"
            >
              <Layers size={13} />
              <span className="hidden sm:inline">Przenieś do Dziennika lekcji</span>
            </Button>
          )}
        </div>
      </header>

      {/* 2. PASEK NARZĘDZI EDYTORA (WYSIWYG GOOGLE DOCS STYLE) */}
      {!isReadOnly && (
        <div className="px-3 py-2 bg-base-300/40 border-b border-white/10 flex items-center gap-1 flex-wrap text-content-muted select-none">
          {/* Formaty blokowe */}
          <div className="flex items-center gap-0.5 bg-base-200/80 p-0.5 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => handleFormatBlock('p')}
              className="px-2 py-1 text-xs rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Zwykły akapit"
            >
              Zwykły
            </button>
            <button
              type="button"
              onClick={() => handleFormatBlock('h1')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Nagłówek 1"
            >
              <Heading1 size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleFormatBlock('h2')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Nagłówek 2 (Lekcja)"
            >
              <Heading2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleFormatBlock('h3')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Nagłówek 3 (Sekcja)"
            >
              <Heading3 size={15} />
            </button>
          </div>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Style tekstu */}
          <div className="flex items-center gap-0.5 bg-base-200/80 p-0.5 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => execCmd('bold')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Pogrubienie (Ctrl+B)"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('italic')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Kursywa (Ctrl+I)"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('underline')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Podkreślenie (Ctrl+U)"
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('strikeThrough')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Przekreślenie"
            >
              <Strikethrough size={15} />
            </button>
          </div>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Zakreślacze językowe */}
          <div className="flex items-center gap-1 bg-base-200/80 p-1 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => handleHighlight('rgba(239, 68, 68, 0.25)', '#fca5a5')}
              className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all"
              title="Zaznacz jako błąd kursanta"
            >
              ❌ Błąd
            </button>
            <button
              type="button"
              onClick={() => handleHighlight('rgba(16, 185, 129, 0.25)', '#6ee7b7')}
              className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all"
              title="Zaznacz jako poprawną formę"
            >
              ✅ Poprawnie
            </button>
            <button
              type="button"
              onClick={() => handleHighlight('rgba(245, 158, 11, 0.25)', '#fcd34d')}
              className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all"
              title="Wyróżnij nowe słówko"
            >
              💡 Słówko
            </button>
          </div>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Listy */}
          <div className="flex items-center gap-0.5 bg-base-200/80 p-0.5 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => execCmd('insertUnorderedList')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Lista wypunktowana"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('insertOrderedList')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Lista numerowana"
            >
              <ListOrdered size={15} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('insertHorizontalRule')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Linia pozioma"
            >
              <Minus size={15} />
            </button>
          </div>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Szybkie wstawianie daty i szablonu */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleInsertDate}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-base-200 text-content-muted hover:text-white hover:bg-white/10 border border-white/5 transition-colors"
              title="Wstaw dzisiejszą datę jako nagłówek lekcji"
            >
              <Calendar size={13} />
              <span>Data lekcji</span>
            </button>
            <button
              type="button"
              onClick={handleInsertTemplate}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-base-200 text-content-muted hover:text-white hover:bg-white/10 border border-white/5 transition-colors"
              title="Wstaw strukturę sekcji lekcji"
            >
              <Sparkles size={13} />
              <span>Szablon</span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => execCmd('undo')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Cofnij (Ctrl+Z)"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => execCmd('redo')}
              className="p-1.5 rounded hover:bg-white/10 hover:text-white transition-colors"
              title="Ponów (Ctrl+Y)"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 3. GŁÓWNA POWIERZCHNIA EDYCYJNA (DOKUMENT GOOGLE DOCS STYLE) */}
      <div className="p-4 md:p-8 flex-1 overflow-y-auto bg-base-100/60 min-h-[500px]">
        <div
          ref={editorRef}
          contentEditable={!isReadOnly}
          onInput={handleInput}
          suppressContentEditableWarning
          className={`max-w-4xl mx-auto min-h-[480px] p-6 md:p-10 rounded-2xl bg-base-200/90 border border-white/10 text-white shadow-2xl focus:outline-none focus:border-primary/40 transition-colors leading-relaxed font-sans prose prose-invert prose-headings:text-white prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 selection:bg-primary/30 ${
            isReadOnly ? 'cursor-default' : 'cursor-text'
          }`}
          style={{ wordBreak: 'break-word' }}
        />
      </div>

      {/* 4. DYSKRETNA STOPKA DOKUMENTU */}
      <footer className="px-4 py-2 bg-base-300/80 border-t border-white/10 flex items-center justify-between text-[11px] text-content-muted">
        <div className="flex items-center gap-3">
          <span>Słowa: <strong className="text-white/80">{wordCount}</strong></span>
          <span>•</span>
          <span>Wersja: #{docData.version}</span>
          {docData.lastEditedBy && (
            <>
              <span>•</span>
              <span>
                Ostatnia edycja: <strong className="text-white/80">{docData.lastEditedBy.name}</strong> ({docData.lastEditedBy.role === 'teacher' ? 'Lektor' : 'Kursant'})
              </span>
            </>
          )}
        </div>

        <div>
          {isReadOnly ? (
            <span className="text-amber-400/80 flex items-center gap-1">
              <Lock size={12} /> Dokument w trybie podglądu na żywo
            </span>
          ) : (
            <span className="text-emerald-400/80 flex items-center gap-1">
              <Check size={12} /> Współdzielona edycja na żywo
            </span>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ScratchpadEditor;

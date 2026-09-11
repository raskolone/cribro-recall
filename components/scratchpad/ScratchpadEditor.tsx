import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Check,
  RotateCcw,
  RotateCw,
  Lock,
  Unlock,
  Eye,
  FileText,
  CloudCheck,
  CloudUpload,
  KeyRound,
  Link2,
  Pilcrow,
  Plus,
  Type,
  GraduationCap,
} from 'lucide-react';
import { ScratchpadDocument } from '../../types';
import { buildScratchpadUrl } from '../../services/scratchpadService';
import { formatAccessCode } from '../../utils/accessCode';
import Button from '../ui/Button';
import MenuDropdown, { MenuChevron } from '../ui/MenuDropdown';
import CoachMarks from '../ui/CoachMarks';
import { buildScratchpadCoachSteps } from './scratchpadCoachSteps';

/** Przycisk paska formatowania — jeden kształt dla wszystkich narzędzi edytora. */
const FormatButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  coachId?: string;
}> = ({ icon, title, onClick, coachId }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    data-coach={coachId}
    // Bez tego kliknięcie zabiera fokus polu edycji i `execCommand` traci
    // zaznaczenie, na którym ma zadziałać.
    onMouseDown={event => event.preventDefault()}
    onClick={onClick}
    className="h-8 w-8 rounded-lg flex items-center justify-center text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
  >
    {icon}
  </button>
);

interface ScratchpadEditorProps {
  document: ScratchpadDocument;
  onSaveContent?: (html: string, text: string) => Promise<any> | void;
  onToggleStudentEdit?: (allow: boolean) => Promise<void>;
  onToggleRequirePin?: (require: boolean) => Promise<void>;
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
  onToggleRequirePin,
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

  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);

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
    const url = buildScratchpadUrl(docData.id);
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

  const coachSteps = useMemo(
    () =>
      buildScratchpadCoachSteps({
        setStyleMenuOpen: setIsStyleMenuOpen,
        setInsertMenuOpen: setIsInsertMenuOpen,
        setShareMenuOpen: setIsShareMenuOpen,
        isTeacher,
        canPushToLesson: isTeacher && !!onPushToLessonRecord,
        canFormat: !isReadOnly,
      }),
    [isTeacher, onPushToLessonRecord, isReadOnly]
  );

  return (
    <div className={`flex flex-col bg-base-200 rounded-2xl border border-white/10 shadow-xl overflow-hidden ${className}`}>
      {/* 1. NAGŁÓWEK DOKUMENTU
          Tożsamość po lewej, jedna akcja końcowa i jedno menu dostępu po prawej.
          Kod PIN i przełączniki uprawnień zeszły do menu — na ekranie zostaje
          to, czego lektor używa w trakcie pisania. */}
      <header className="px-4 py-3 bg-base-300/80 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0" data-coach="pad-identity">
          <div className="p-2 rounded-xl bg-accent/12 text-accent border border-accent/25 shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-hi truncate flex items-center gap-2">
              <span>{docData.title || 'Brudnopis lekcyjny'}</span>
              {isReadOnly && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.07] border border-line text-text-2 flex items-center gap-1">
                  <Eye size={11} /> Podgląd
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-text-faint">
              <span className="truncate">{docData.studentName}</span>
              <span aria-hidden>•</span>
              {saveStatus === 'saving' ? (
                <span className="text-text-2 flex items-center gap-1">
                  <CloudUpload size={11} /> Zapisywanie…
                </span>
              ) : saveStatus === 'local_only' ? (
                <span
                  className="text-warn flex items-center gap-1"
                  title="Zapisano w tej przeglądarce — kursant nie zobaczy tych zmian."
                >
                  <CloudUpload size={11} /> Tylko lokalnie
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <CloudCheck size={11} /> Zapisano
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {isTeacher && (
            <MenuDropdown
              open={isShareMenuOpen}
              onOpenChange={setIsShareMenuOpen}
              width={300}
              align="end"
              aria-label="Udostępnianie i uprawnienia"
              coachId="pad-share"
              triggerTitle="Link, kod PIN i uprawnienia kursanta"
              triggerClassName={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isShareMenuOpen
                  ? 'bg-white/[0.08] border-line-strong text-content'
                  : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
              }`}
              trigger={
                <>
                  <Share2 size={14} />
                  <span>Udostępnij</span>
                  <MenuChevron open={isShareMenuOpen} />
                </>
              }
              sections={[
                {
                  id: 'links',
                  label: 'Dostęp dla kursanta',
                  items: [
                    {
                      id: 'copy-link',
                      label: copiedLink ? 'Skopiowano link' : 'Kopiuj link bezpośredni',
                      description: 'Otwiera brudnopis bez logowania',
                      icon: copiedLink ? <Check size={14} /> : <Link2 size={14} />,
                      onSelect: handleCopyLink,
                    },
                    {
                      id: 'copy-pin',
                      label: copiedPin ? 'Skopiowano PIN' : `Kopiuj kod PIN — ${formatAccessCode(docData.pin)}`,
                      description: 'Do wpisania na stronie /scratchpad',
                      icon: copiedPin ? <Check size={14} /> : <KeyRound size={14} />,
                      onSelect: handleCopyPin,
                    },
                  ],
                },
                {
                  id: 'permissions',
                  label: 'Uprawnienia',
                  items: [
                    ...(onToggleRequirePin
                      ? [
                          {
                            id: 'require-pin',
                            label: 'Wymagaj kodu PIN',
                            description: 'Dodatkowa zapora przy wejściu z linku',
                            icon: <Lock size={14} />,
                            checked: !!docData.requirePin,
                            onSelect: () => onToggleRequirePin(!docData.requirePin),
                          },
                        ]
                      : []),
                    ...(onToggleStudentEdit
                      ? [
                          {
                            id: 'student-edit',
                            coachId: 'pad-menu-student-edit',
                            label: 'Kursant może pisać',
                            description: 'Wyłączone = sam podgląd na żywo',
                            icon: <Unlock size={14} />,
                            checked: !!docData.allowStudentEdit,
                            onSelect: () => onToggleStudentEdit(!docData.allowStudentEdit),
                          },
                        ]
                      : []),
                  ],
                },
              ]}
            />
          )}

          {isTeacher && onPushToLessonRecord && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePushToLesson}
              data-coach="pad-push"
              className="h-9 text-xs flex items-center gap-1.5"
              title="Rozłóż notatki na 4 bloki Notion i otwórz formularz lekcji"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Do dziennika</span>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setIsCoachOpen(true)}
            title="Samouczek — dymki opisujące każdą funkcję brudnopisu"
            aria-label="Samouczek"
            className="h-9 w-9 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <GraduationCap size={15} />
          </button>
        </div>
      </header>

      {/* 2. PASEK FORMATOWANIA
          Widoczne zostaje to, po co sięga się w trakcie notowania: pogrubienie,
          trzy zakreślacze lektorskie i lista. Nagłówki, pozostałe style oraz
          wstawki lekcyjne schowane są w dwóch menu. */}
      {!isReadOnly && (
        <div className="px-3 py-2 bg-base-300/40 border-b border-white/10 flex items-center gap-1.5 flex-wrap select-none">
          <MenuDropdown
            open={isStyleMenuOpen}
            onOpenChange={setIsStyleMenuOpen}
            preserveSelection
            width={252}
            align="start"
            aria-label="Styl tekstu"
            coachId="pad-style"
            triggerTitle="Nagłówki i style zapisu"
            triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              isStyleMenuOpen
                ? 'bg-white/[0.08] border-line-strong text-content'
                : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
            trigger={
              <>
                <Type size={14} />
                <span>Styl</span>
                <MenuChevron open={isStyleMenuOpen} />
              </>
            }
            sections={[
              {
                id: 'blocks',
                label: 'Blok tekstu',
                items: [
                  {
                    id: 'p',
                    label: 'Zwykły akapit',
                    icon: <Pilcrow size={14} />,
                    onSelect: () => handleFormatBlock('p'),
                  },
                  {
                    id: 'h1',
                    label: 'Nagłówek 1',
                    description: 'Tytuł dokumentu',
                    icon: <Heading1 size={14} />,
                    onSelect: () => handleFormatBlock('h1'),
                  },
                  {
                    id: 'h2',
                    label: 'Nagłówek 2',
                    description: 'Data lekcji',
                    icon: <Heading2 size={14} />,
                    onSelect: () => handleFormatBlock('h2'),
                  },
                  {
                    id: 'h3',
                    label: 'Nagłówek 3',
                    description: 'Sekcja w lekcji',
                    icon: <Heading3 size={14} />,
                    onSelect: () => handleFormatBlock('h3'),
                  },
                ],
              },
              {
                id: 'inline',
                label: 'Styl znaku',
                items: [
                  {
                    id: 'underline',
                    label: 'Podkreślenie',
                    shortcut: 'Ctrl+U',
                    icon: <Underline size={14} />,
                    onSelect: () => execCmd('underline'),
                  },
                  {
                    id: 'strike',
                    label: 'Przekreślenie',
                    icon: <Strikethrough size={14} />,
                    onSelect: () => execCmd('strikeThrough'),
                  },
                ],
              },
            ]}
          />

          <div className="w-px h-5 bg-line-strong" aria-hidden />

          <FormatButton
            icon={<Bold size={15} />}
            title="Pogrubienie (Ctrl+B)"
            onClick={() => execCmd('bold')}
          />
          <FormatButton
            icon={<Italic size={15} />}
            title="Kursywa (Ctrl+I)"
            onClick={() => execCmd('italic')}
          />
          <FormatButton
            icon={<List size={15} />}
            title="Lista wypunktowana"
            onClick={() => execCmd('insertUnorderedList')}
          />

          <div className="w-px h-5 bg-line-strong" aria-hidden />

          {/* Zakreślacze zostają na wierzchu — to one odróżniają brudnopis
              lektorski od zwykłego edytora i używa się ich co kilka zdań. */}
          <div className="flex items-center gap-1" data-coach="pad-highlighters">
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleHighlight('rgba(239, 68, 68, 0.25)', '#fca5a5')}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors cursor-pointer"
              title="Zaznacz fragment jako błąd kursanta"
            >
              ❌ Błąd
            </button>
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleHighlight('rgba(16, 185, 129, 0.25)', '#6ee7b7')}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-accent/12 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
              title="Zaznacz fragment jako poprawną formę"
            >
              ✅ Poprawnie
            </button>
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleHighlight('rgba(245, 158, 11, 0.25)', '#fcd34d')}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-warn/15 text-warn border border-warn/30 hover:bg-warn/25 transition-colors cursor-pointer"
              title="Wyróżnij nowe słówko"
            >
              💡 Słówko
            </button>
          </div>

          <div className="w-px h-5 bg-line-strong" aria-hidden />

          <MenuDropdown
            open={isInsertMenuOpen}
            onOpenChange={setIsInsertMenuOpen}
            preserveSelection
            width={264}
            align="start"
            aria-label="Wstaw element"
            coachId="pad-insert"
            triggerTitle="Data lekcji, szablon sekcji, listy i linia"
            triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              isInsertMenuOpen
                ? 'bg-white/[0.08] border-line-strong text-content'
                : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
            trigger={
              <>
                <Plus size={14} />
                <span>Wstaw</span>
                <MenuChevron open={isInsertMenuOpen} />
              </>
            }
            sections={[
              {
                id: 'lesson',
                label: 'Elementy lekcji',
                items: [
                  {
                    id: 'date',
                    label: 'Nagłówek z dzisiejszą datą',
                    description: 'Otwiera nową lekcję w dokumencie',
                    icon: <Calendar size={14} />,
                    onSelect: handleInsertDate,
                  },
                  {
                    id: 'template',
                    label: 'Szablon sekcji',
                    description: 'Słownictwo, poprawki, ustalenia',
                    icon: <Sparkles size={14} />,
                    onSelect: handleInsertTemplate,
                  },
                ],
              },
              {
                id: 'structure',
                label: 'Struktura',
                items: [
                  {
                    id: 'ol',
                    label: 'Lista numerowana',
                    icon: <ListOrdered size={14} />,
                    onSelect: () => execCmd('insertOrderedList'),
                  },
                  {
                    id: 'hr',
                    label: 'Linia pozioma',
                    icon: <Minus size={14} />,
                    onSelect: () => execCmd('insertHorizontalRule'),
                  },
                ],
              },
            ]}
          />

          <div className="ml-auto flex items-center gap-0.5" data-coach="pad-history">
            <FormatButton
              icon={<RotateCcw size={14} />}
              title="Cofnij (Ctrl+Z)"
              onClick={() => execCmd('undo')}
            />
            <FormatButton
              icon={<RotateCw size={14} />}
              title="Ponów (Ctrl+Y)"
              onClick={() => execCmd('redo')}
            />
          </div>
        </div>
      )}

      {/* 3. GŁÓWNA POWIERZCHNIA EDYCYJNA (DOKUMENT GOOGLE DOCS STYLE) */}
      <div className="p-4 md:p-8 flex-1 overflow-y-auto bg-base-100/60 min-h-[500px]">
        <div
          ref={editorRef}
          data-coach="pad-editor"
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
            <span className="text-text-2 flex items-center gap-1">
              <Lock size={12} /> Tryb podglądu na żywo
            </span>
          ) : (
            <span className="text-text-2 flex items-center gap-1">
              <Check size={12} /> Współdzielona edycja na żywo
            </span>
          )}
        </div>
      </footer>

      {/* Samouczek — dymki przypięte do narzędzi brudnopisu. */}
      <CoachMarks
        steps={coachSteps}
        isOpen={isCoachOpen}
        onClose={() => {
          setIsCoachOpen(false);
          setIsStyleMenuOpen(false);
          setIsInsertMenuOpen(false);
          setIsShareMenuOpen(false);
        }}
        title="Samouczek brudnopisu"
      />
    </div>
  );
};

export default ScratchpadEditor;

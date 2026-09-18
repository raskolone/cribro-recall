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
  X,
  AlertTriangle,
  Settings2,
  Download,
  FileDown,
  FileType2,
  ExternalLink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  CheckSquare,
  ListTree,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  Sun,
  Moon,
  Image as ImageIcon,
  Flashlight,
  LayoutTemplate,
  Printer,
  Bot,
  Send,
  Loader2,
  Copy,
  PlusCircle,
  MoveUp,
  MoveDown,
  FilePlus,
  Airplay,
  Compass,
  Paperclip,
  Trash2,
  Target,
  FileSignature,
} from 'lucide-react';
import { ScratchpadDocument, ScratchpadTemplate, LessonAttachment, LessonRecord } from '../../types';
import {
  buildScratchpadUrl,
  scratchpadContentBytes,
  SCRATCHPAD_MAX_CONTENT_BYTES,
  updateScratchpadLaser,
  updateScratchpadPresentation,
  updateScratchpadOrientation,
  revealScratchpadExerciseAnswer,
  submitStudentExerciseAnswer,
} from '../../services/scratchpadService';
import {
  imageFromClipboard,
  prepareImageForScratchpad,
} from '../../utils/scratchpadImages';
import { listScratchpadTemplates } from '../../services/scratchpadTemplateService';
import { formatAccessCode } from '../../utils/accessCode';
import {
  exportScratchpadToPDF,
  exportScratchpadToWord,
  exportScratchpadToGoogleDocs,
} from '../../utils/pdfExport';
import { AIAssistantIcon } from '../ui/AIAssistantIcon';
import Button from '../ui/Button';
import MenuDropdown, { MenuChevron } from '../ui/MenuDropdown';
import CoachMarks from '../ui/CoachMarks';
import { buildScratchpadCoachSteps } from './scratchpadCoachSteps';
import ScratchpadTemplateManagerModal from './ScratchpadTemplateManagerModal';
import { ScratchpadPresentationOverlay, PresentationState } from './ScratchpadPresentationOverlay';
import { ScratchpadLivePresentationModal } from './ScratchpadLivePresentationModal';
import { ScratchpadTeacherCompanionDrawer } from './ScratchpadTeacherCompanionDrawer';
import { InteractiveExercise } from '../../services/lessonPlannerMethod';
import { buildLessonTemplate, highestLessonNumber, LESSON_SECTIONS } from '../../utils/lessonTemplate';
import { NOTEBOOK_COLORS, NOTEBOOK_INK, NOTEBOOK_SWATCHES } from '../../utils/notebookPalette';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { generateTextWithUnifiedFallback } from '../../services/geminiService';
import { runCouncil, SCRATCHPAD_REVIEW_SYSTEM } from '../../services/aiCouncil';
import mammoth from 'mammoth';
import ScratchpadInsertPreviewModal, {
  parseRawTextToStructuredLesson,
  StructuredLessonContent,
} from './ScratchpadInsertPreviewModal';

/**
 * Wysokość strony A4 przy 96 dpi (297 mm) minus margines dolny, w pikselach.
 */
const PAGE_HEIGHT_PX = 1123;

/**
 * Szerokość arkusza A4 przy 96 dpi (210 mm).
 */
const PAGE_WIDTH_PX = 794;

/** Margines dokumentu — 2 cm, czyli standard Worda i Google Docs. */
const PAGE_MARGIN_PX = 76;

/** Pozycja w spisie treści — H1 (nadrzędny/lekcja) lub H2 (rozdział/sekcja). H3 nie trafia do spisu. */
interface TocEntry {
  id: string;
  level: 1 | 2;
  text: string;
  collapsed: boolean;
  parentId?: string;
}

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
  /** Zamknięcie brudnopisu. Bez tego przycisk zamykania się nie pojawia. */
  onClose?: () => void;
  /** Edytor wypełnia własną kartę przeglądarki — bez ramy, cienia i zaokrągleń. */
  standalone?: boolean;
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
  onClose,
  standalone = false,
}) => {
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  
  // Kursant może edytować tylko wtedy, gdy lektor włączył flagę `allowStudentEdit` i nie narzucono explicitReadOnly
  const isReadOnly = explicitReadOnly || (!isTeacher && !docData.allowStudentEdit);

  const editorRef = useRef<HTMLDivElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const isUserTypingRef = useRef(false);
  const typingResetTimeoutRef = useRef<any>(null);
  const saveTimeoutRef = useRef<any>(null);
  const lastLaserSendRef = useRef<number>(0);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'synced' | 'local_only'>('saved');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  /** Komunikat po wysłaniu do Google Docs — znika sam po kilku sekundach. */
  const [googleDocsHint, setGoogleDocsHint] = useState<'copied' | 'manual' | null>(null);
  /** Wskaźnik laserowy — światełko przy kursorze synchronizowane w czasie rzeczywistym. */
  const [isLaserOn, setIsLaserOn] = useState(false);
  /** Orientacja arkusza A4 — pionowa (portrait) lub pozioma (landscape). */
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>(
    (docData.pageOrientation as 'portrait' | 'landscape') || 'portrait'
  );

  /** Obraz zaznaczony kliknięciem — do zmiany rozmiaru lub przesuwania. */
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  /** Komunikat o wklejonym obrazie (za duży, nie wszedł). */
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  /** Ile zajmuje dokument — licznik w stopce, ostrzeżenie przed limitem. */
  const [contentBytes, setContentBytes] = useState(0);

  /* Spis treści, podział na strony i motyw kartki */
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [collapsedTocLessons, setCollapsedTocLessons] = useState<Record<string, boolean>>({});
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [paperTheme, setPaperTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('scratchpad_paper_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof document !== 'undefined') {
        const isLight = document.documentElement.classList.contains('light') ||
          document.documentElement.getAttribute('data-theme') === 'light';
        return isLight ? 'light' : 'dark';
      }
      return 'dark';
    } catch {
      return 'dark';
    }
  });
  const paperWrapRef = useRef<HTMLDivElement>(null);
  const structureTimeoutRef = useRef<any>(null);
  const measurePagesRef = useRef<(() => void) | null>(null);
  const tocSignatureRef = useRef<string>('');

  const [templates, setTemplates] = useState<ScratchpadTemplate[]>([]);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isLivePresentationModalOpen, setIsLivePresentationModalOpen] = useState(false);
  const [isScenarioDrawerOpen, setIsScenarioDrawerOpen] = useState(false);
  const [studentLessons, setStudentLessons] = useState<LessonRecord[]>([]);
  const [insertPreviewState, setInsertPreviewState] = useState<{
    isOpen: boolean;
    content: Partial<StructuredLessonContent>;
  }>({ isOpen: false, content: {} });

  // Pobieranie historii lekcji przypisanego kursanta pod kątem koła fortuny i asystenta
  useEffect(() => {
    const studentId = docData.studentId || (document as any)?.studentId || ((docData as any)?.studentIds && (docData as any)?.studentIds[0]);
    if (!studentId) return;
    let active = true;
    getLessonRecordsForStudent(studentId)
      .then((records) => {
        if (active && records) {
          setStudentLessons(records);
        }
      })
      .catch((err) => console.warn('[ScratchpadEditor] Błąd pobierania lekcji kursanta:', err));
    return () => {
      active = false;
    };
  }, [docData.studentId, (docData as any)?.studentIds]);

  // Synchronizacja orientacji z chmury
  useEffect(() => {
    if (docData.pageOrientation && docData.pageOrientation !== pageOrientation) {
      setPageOrientation(docData.pageOrientation as 'portrait' | 'landscape');
    }
  }, [docData.pageOrientation]);

  // Wymiary kartki w zależności od orientacji
  const isLandscape = pageOrientation === 'landscape';
  const activePageWidth = isLandscape ? PAGE_HEIGHT_PX : PAGE_WIDTH_PX;
  const activePageHeight = isLandscape ? PAGE_WIDTH_PX : PAGE_HEIGHT_PX;

  // ── Asystent AI w dokumencie ──
  interface ScratchpadChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: string;
    attachments?: LessonAttachment[];
  }

  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<ScratchpadChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`scratchpad_ai_chat_${docData.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [aiChatDraft, setAiChatDraft] = useState('');
  const [pendingAiAttachments, setPendingAiAttachments] = useState<LessonAttachment[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [copiedAiMsgId, setCopiedAiMsgId] = useState<string | null>(null);
  const [isAiDraggingOver, setIsAiDraggingOver] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (docData.id && aiChatMessages.length > 0) {
        localStorage.setItem(`scratchpad_ai_chat_${docData.id}`, JSON.stringify(aiChatMessages.slice(-25)));
      }
    } catch {}
  }, [docData.id, aiChatMessages]);

  useEffect(() => {
    if (isAiChatOpen) {
      aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isAiChatOpen, aiChatMessages, isAiGenerating]);

  // Funkcja wyciągająca czysty tekst z HTML
  const extractText = (html: string): string => {
    const tmp = window.document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || '';
  };

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

  /* ═══════════════════════════════════════════════════════════════════
     SPIS TREŚCI, NAGŁÓWKI ZWIJANE I PODZIAŁ NA STRONY
     - Nagłówek 1 (H1) = nadrzędny (lekcja), w spisie treści zwija swoje H2
     - Nagłówek 2 (H2) = rozdziały w lekcji
     - Nagłówek 3 (H3) = sekcja szczegółowa, NIE pojawia się w spisie treści
     ═══════════════════════════════════════════════════════════════════ */

  /** Nadaje nagłówkowi trwały identyfikator, jeśli jeszcze go nie ma. */
  const ensureHeadingId = (heading: HTMLElement, index: number): string => {
    const existing = heading.getAttribute('id');
    if (existing && existing.startsWith('pad-h-')) return existing;
    const id = `pad-h-${index}-${Math.random().toString(36).slice(2, 7)}`;
    heading.setAttribute('id', id);
    return id;
  };

  const rebuildToc = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    // Spis treści budujemy TYLKO z H1 i H2 — H3 celowo pomijamy!
    const headings = Array.from(root.querySelectorAll('h1, h2')) as HTMLElement[];
    let currentH1Id: string | undefined = undefined;

    const entries: TocEntry[] = headings.map((heading, index) => {
      const id = ensureHeadingId(heading, index);
      const level = Number(heading.tagName.charAt(1)) as 1 | 2;
      if (level === 1) {
        currentH1Id = id;
      }
      const clone = heading.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.pad-toggle').forEach(el => el.remove());
      return {
        id,
        level,
        text: (clone.textContent || '').trim() || 'Bez tytułu',
        collapsed: heading.getAttribute('data-collapsed') === '1',
        parentId: level === 2 ? currentH1Id : undefined,
      };
    });

    const signature = entries.map(e => `${e.level}|${e.id}|${e.text}|${e.collapsed}|${e.parentId}`).join('\n');
    if (signature === tocSignatureRef.current) return;
    tocSignatureRef.current = signature;
    setToc(entries);
  }, []);

  const scheduleStructureRefresh = useCallback(() => {
    if (structureTimeoutRef.current) clearTimeout(structureTimeoutRef.current);
    structureTimeoutRef.current = setTimeout(() => {
      rebuildToc();
      measurePagesRef.current?.();
    }, 250);
  }, [rebuildToc]);

  interface PageMarker {
    id: string;
    topPx: number;
    pageNumber: number;
    label: string;
    isVirtual?: boolean;
  }

  const [pageMarkers, setPageMarkers] = useState<PageMarker[]>([]);

  /** Liczba stron i dokładne pozycje podziałów A4 uwzględniające wymuszone podziały lekcji */
  const measurePages = useCallback(() => {
    const paper = editorRef.current;
    if (!paper) return;

    const pageBreaks = Array.from(paper.querySelectorAll<HTMLElement>('.pad-page-break'));
    const markers: PageMarker[] = [];
    let currentPage = 1;

    if (pageBreaks.length === 0) {
      const totalHeight = paper.scrollHeight || paper.offsetHeight;
      const totalPages = Math.max(1, Math.ceil(totalHeight / activePageHeight));
      for (let i = 1; i < totalPages; i++) {
        markers.push({
          id: `virtual-${i}`,
          topPx: i * activePageHeight,
          pageNumber: i + 1,
          label: `Strona ${i + 1}`,
          isVirtual: true,
        });
      }
      setPageCount(totalPages);
      setPageMarkers(markers);
      return;
    }

    let sectionStartTop = 0;

    for (let bIdx = 0; bIdx <= pageBreaks.length; bIdx++) {
      const breakEl = pageBreaks[bIdx];
      const sectionEndTop = breakEl ? breakEl.offsetTop : (paper.scrollHeight || paper.offsetHeight);
      const sectionHeight = Math.max(0, sectionEndTop - sectionStartTop);
      const sectionPages = Math.max(1, Math.ceil(sectionHeight / activePageHeight));

      // Wirtualne linie podziału wewnątrz sekcji, jeśli pojedyncza lekcja przekracza 1 stronę A4
      for (let p = 1; p < sectionPages; p++) {
        markers.push({
          id: `sec-${bIdx}-p-${p}`,
          topPx: sectionStartTop + p * activePageHeight,
          pageNumber: currentPage + p,
          label: `Strona ${currentPage + p}`,
          isVirtual: true,
        });
      }

      currentPage += sectionPages;

      if (breakEl) {
        sectionStartTop = breakEl.offsetTop + breakEl.offsetHeight;
      }
    }

    setPageCount(Math.max(1, currentPage - 1));
    setPageMarkers(markers);
  }, [activePageHeight]);

  measurePagesRef.current = measurePages;

  useEffect(() => () => {
    if (structureTimeoutRef.current) clearTimeout(structureTimeoutRef.current);
  }, []);

  useEffect(() => {
    const paper = editorRef.current;
    if (!paper || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measurePages();
      });
    });
    observer.observe(paper);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measurePages]);

  /**
   * Zwinięcie rozdziału w treści dokumentu:
   * H1 zwija wszystko do następnego H1.
   * H2 zwija wszystko do następnego H2 lub H1.
   */
  const setSectionCollapsed = useCallback(
    (heading: HTMLElement, collapsed: boolean) => {
      const level = Number(heading.tagName.charAt(1));
      let node = heading.nextElementSibling as HTMLElement | null;
      while (node) {
        const match = /^H([1-6])$/.exec(node.tagName);
        if (match && Number(match[1]) <= level) break;
        node.style.display = collapsed ? 'none' : '';
        node = node.nextElementSibling as HTMLElement | null;
      }
      heading.setAttribute('data-collapsed', collapsed ? '1' : '0');
    },
    []
  );

  /** Kliknięcie w kartkę — zaznaczanie obrazu i strzałki zwijania */
  const handlePaperClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target.tagName === 'IMG' && !isReadOnly) {
      editorRef.current
        ?.querySelectorAll('img.is-selected')
        .forEach(img => img.classList.remove('is-selected'));
      target.classList.add('is-selected');
      setSelectedImage(target as HTMLImageElement);
      return;
    }
    if (selectedImage) {
      selectedImage.classList.remove('is-selected');
      setSelectedImage(null);
    }

    const chevron = target.closest?.('.pad-toggle') as HTMLElement | null;
    if (!chevron) return;
    const heading = chevron.closest('h1, h2, h3') as HTMLElement | null;
    if (!heading) return;
    event.preventDefault();
    setSectionCollapsed(heading, heading.getAttribute('data-collapsed') !== '1');
    rebuildToc();
    measurePages();
    if (editorRef.current) triggerDebouncedSave(editorRef.current.innerHTML);
  };

  /**
   * Utworzenie nagłówka zwijanego (H1 lub H2) z wyraźną strzałką zwijania.
   */
  const handleToggleHeading = (tag: 'h1' | 'h2') => {
    if (isReadOnly || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.getRangeAt(0).startContainer as HTMLElement | null;
    if (node && node.nodeType === 3) node = node.parentElement;
    let heading = node?.closest?.('h1, h2, h3') as HTMLElement | null;

    if (!heading || heading.tagName.toLowerCase() !== tag) {
      window.document.execCommand('formatBlock', false, `<${tag}>`);
      let refreshed = window.getSelection()?.getRangeAt(0).startContainer as HTMLElement | null;
      if (refreshed && refreshed.nodeType === 3) refreshed = refreshed.parentElement;
      heading = refreshed?.closest?.('h1, h2, h3') as HTMLElement | null;
    }
    if (!heading) return;

    const existing = heading.querySelector('.pad-toggle');
    if (existing) {
      existing.remove();
      heading.removeAttribute('data-toggle');
      if (heading.getAttribute('data-collapsed') === '1') setSectionCollapsed(heading, false);
      heading.removeAttribute('data-collapsed');
    } else {
      const chevron = window.document.createElement('span');
      chevron.className = 'pad-toggle';
      chevron.setAttribute('contenteditable', 'false');
      chevron.setAttribute('title', 'Zwiń / rozwiń rozdział');
      chevron.textContent = '▾';
      heading.insertBefore(chevron, heading.firstChild);
      heading.setAttribute('data-toggle', '1');
      heading.setAttribute('data-collapsed', '0');
    }
    handleInput();
  };

  /** Standardowy format bloku (p, h1, h2, h3) bez automatycznych strzałek */
  const handleFormatBlock = (tag: string) => {
    if (isReadOnly) return;
    window.document.execCommand('formatBlock', false, `<${tag}>`);
    if (editorRef.current) {
      // Usuń ewentualne pozostałości pad-toggle z poprzedniego stanu
      const selection = window.getSelection();
      let node = selection?.getRangeAt(0).startContainer as HTMLElement | null;
      if (node && node.nodeType === 3) node = node.parentElement;
      const block = node?.closest?.('h1, h2, h3, p, div') as HTMLElement | null;
      if (block) {
        block.querySelector('.pad-toggle')?.remove();
        block.removeAttribute('data-toggle');
        block.removeAttribute('data-collapsed');
      }
      editorRef.current.focus();
      handleInput();
    }
  };

  /** Zwinięcie albo rozwinięcie wszystkich rozdziałów zwijanych w dokumencie */
  const handleCollapseAll = (collapsed: boolean) => {
    const root = editorRef.current;
    if (!root) return;
    (Array.from(root.querySelectorAll('[data-toggle="1"]')) as HTMLElement[]).forEach(heading =>
      setSectionCollapsed(heading, collapsed)
    );
    rebuildToc();
    measurePages();
    if (!isReadOnly) triggerDebouncedSave(root.innerHTML);
  };

  /** Przełączenie zwinięcia lekcji (H1) w samym spisie treści */
  const toggleTocLesson = (h1Id: string) => {
    setCollapsedTocLessons(prev => ({
      ...prev,
      [h1Id]: !prev[h1Id],
    }));
  };

  /** Przejście do nagłówka ze spisu treści */
  const handleJumpToHeading = (id: string) => {
    const heading = editorRef.current?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
    if (!heading) return;
    if (heading.getAttribute('data-collapsed') === '1') {
      setSectionCollapsed(heading, false);
      rebuildToc();
      measurePages();
    }
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeadingId(id);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem('scratchpad_paper_theme', paperTheme);
    } catch {}
    window.dispatchEvent(new CustomEvent('scratchpad-paper-theme', { detail: paperTheme }));
  }, [paperTheme]);

  // Inicjalizacja lub aktualizacja zawartości z zewnątrz
  useEffect(() => {
    if (!editorRef.current) return;

    if (!isUserTypingRef.current) {
      if (editorRef.current.innerHTML !== docData.contentHtml) {
        editorRef.current.innerHTML = docData.contentHtml || '';
        const txt = extractText(docData.contentHtml || '');
        setWordCount(txt.trim() ? txt.trim().split(/\s+/).length : 0);
        setContentBytes(scratchpadContentBytes(docData.contentHtml || ''));
        setSaveStatus('synced');
        rebuildToc();
        measurePages();
      }
    }
  }, [docData.contentHtml, docData.version, rebuildToc, measurePages]);

  /* ═══════════════════════════════════════════════════════════════════
     OBRAZY, WSKAŹNIK LASEROWY I ORIENTACJA STRONY
     ═══════════════════════════════════════════════════════════════════ */

  /** Wklejenie obrazu ze schowka */
  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    const file = imageFromClipboard(event.clipboardData);
    if (!file) return;

    event.preventDefault();
    setImageNotice('Przygotowuję obraz…');

    try {
      const paperWidth = editorRef.current
        ? Math.max(280, editorRef.current.clientWidth - PAGE_MARGIN_PX * 2)
        : activePageWidth - PAGE_MARGIN_PX * 2;
      const prepared = await prepareImageForScratchpad(file, paperWidth);

      const currentBytes = scratchpadContentBytes(editorRef.current?.innerHTML || '');
      if (currentBytes + prepared.bytes > SCRATCHPAD_MAX_CONTENT_BYTES) {
        setImageNotice(
          'Ten obraz nie zmieści się w notatniku — dokument ma twardy limit rozmiaru. ' +
            'Usuń wcześniejsze obrazy albo załóż notatnik na nową lekcję.'
        );
        return;
      }

      window.document.execCommand(
        'insertHTML',
        false,
        `<img class="pad-img" draggable="true" src="${prepared.dataUrl}" style="width:${prepared.width}px" alt="" />`
      );
      setImageNotice(null);
      handleInput();
    } catch (error: any) {
      console.error('[Notatnik] Wklejenie obrazu nie powiodło się:', error);
      setImageNotice(error?.message || 'Nie udało się wkleić obrazu.');
    }
  };

  /** Wstawienie pliku graficznego z dysku */
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isReadOnly) return;
    setImageNotice('Wgrywam zdjęcie…');

    try {
      const paperWidth = editorRef.current
        ? Math.max(280, editorRef.current.clientWidth - PAGE_MARGIN_PX * 2)
        : activePageWidth - PAGE_MARGIN_PX * 2;
      const prepared = await prepareImageForScratchpad(file, paperWidth);

      const currentBytes = scratchpadContentBytes(editorRef.current?.innerHTML || '');
      if (currentBytes + prepared.bytes > SCRATCHPAD_MAX_CONTENT_BYTES) {
        setImageNotice('Plik obrazu przekracza dopuszczalny limit rozmiaru dokumentu.');
        return;
      }

      window.document.execCommand(
        'insertHTML',
        false,
        `<img class="pad-img" draggable="true" src="${prepared.dataUrl}" style="width:${prepared.width}px" alt="" />`
      );
      setImageNotice(null);
      handleInput();
    } catch (err: any) {
      setImageNotice(err?.message || 'Nie udało się wgrać obrazu.');
    } finally {
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    }
  };

  /** Zmiana rozmiaru wklejonego obrazu */
  const resizeSelectedImage = (fraction: number) => {
    if (!selectedImage || !editorRef.current) return;
    const paperWidth = Math.max(280, editorRef.current.clientWidth - PAGE_MARGIN_PX * 2);
    selectedImage.style.width = `${Math.round(paperWidth * fraction)}px`;
    selectedImage.style.height = 'auto';
    handleInput();
  };

  /** Przesuwanie obrazu wyżej w strukturze sekcji */
  const moveSelectedImageUp = () => {
    if (!selectedImage || !editorRef.current) return;
    let target: HTMLElement = selectedImage;
    if (selectedImage.parentElement && selectedImage.parentElement !== editorRef.current) {
      target = selectedImage.parentElement;
    }
    const prev = target.previousElementSibling;
    if (prev && editorRef.current) {
      editorRef.current.insertBefore(target, prev);
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      handleInput();
    }
  };

  /** Przesuwanie obrazu niżej w strukturze sekcji */
  const moveSelectedImageDown = () => {
    if (!selectedImage || !editorRef.current) return;
    let target: HTMLElement = selectedImage;
    if (selectedImage.parentElement && selectedImage.parentElement !== editorRef.current) {
      target = selectedImage.parentElement;
    }
    const next = target.nextElementSibling;
    if (next && editorRef.current) {
      editorRef.current.insertBefore(target, next.nextElementSibling);
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      handleInput();
    }
  };

  const removeSelectedImage = () => {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    handleInput();
  };

  /** Synchronizowany wskaźnik laserowy na żywo */
  const handleLaserMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isLaserOn || !editorRef.current || !docData.id || !isTeacher) return;
    const now = Date.now();
    if (now - lastLaserSendRef.current < 50) return; // Throttling 50ms
    lastLaserSendRef.current = now;

    const rect = editorRef.current.getBoundingClientRect();
    const xPercent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

    updateScratchpadLaser(docData.id, {
      active: true,
      xPercent,
      yPercent,
      user: currentUser?.name || 'Lektor',
    });
  };

  const handleLaserMouseLeave = () => {
    if (!isLaserOn || !docData.id || !isTeacher) return;
    updateScratchpadLaser(docData.id, { active: false });
  };

  useEffect(() => {
    if (!isLaserOn && docData.id && isTeacher) {
      updateScratchpadLaser(docData.id, { active: false });
    }
  }, [isLaserOn, docData.id, isTeacher]);

  /** Zmiana orientacji arkusza (Pionowa / Pozioma) */
  const handleToggleOrientation = async () => {
    const nextOrientation = pageOrientation === 'portrait' ? 'landscape' : 'portrait';
    setPageOrientation(nextOrientation);
    if (isTeacher && docData.id) {
      try {
        await updateScratchpadOrientation(docData.id, nextOrientation);
      } catch (err) {
        console.error('Błąd zapisu orientacji:', err);
      }
    }
    measurePages();
  };

  const handleInput = () => {
    if (!editorRef.current || isReadOnly) return;

    isUserTypingRef.current = true;
    if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current);
    typingResetTimeoutRef.current = setTimeout(() => {
      isUserTypingRef.current = false;
    }, 1500);

    const html = editorRef.current.innerHTML.replace(/ class="pad-img is-selected"/g, ' class="pad-img"');
    const txt = extractText(html);
    setWordCount(txt.trim() ? txt.trim().split(/\s+/).length : 0);
    setContentBytes(scratchpadContentBytes(html));
    scheduleStructureRefresh();

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

  /** Wstawianie nowej lekcji z nagłówkiem H1 i sekcjami H2/H3 */
  const [isInsertingLesson, setIsInsertingLesson] = useState(false);

  const handleInsertLesson = async () => {
    if (isReadOnly || !editorRef.current || isInsertingLesson) return;
    setIsInsertingLesson(true);

    let recallItems: { corrections?: string[]; vocabulary?: string[] } | undefined = undefined;

    const studentId = docData.studentId || (document as any).studentId;
    if (studentId) {
      try {
        const records = await getLessonRecordsForStudent(studentId);
        if (records && records.length > 0) {
          const sorted = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          const latest = sorted[0];

          const rawCorrections =
            latest.thingsToImprove ||
            latest.corrections ||
            latest.structuredBlocks?.corrections ||
            '';

          const rawVocab =
            latest.vocabularyText ||
            latest.structuredBlocks?.vocabulary ||
            '';

          const correctionsList = rawCorrections
            .split('\n')
            .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
            .filter(l => l.length > 3)
            .slice(0, 3);

          const vocabList = rawVocab
            .split('\n')
            .map(l => {
              const clean = l.replace(/^[-*•\d.]+\s*/, '').trim();
              if (clean.includes(' - ')) return clean.split(' - ')[0].trim();
              if (clean.includes(' – ')) return clean.split(' – ')[0].trim();
              if (clean.includes(' — ')) return clean.split(' — ')[0].trim();
              if (clean.includes(':')) return clean.split(':')[0].trim();
              return clean;
            })
            .filter(w => w.length > 1)
            .slice(0, 5);

          if (correctionsList.length > 0 || vocabList.length > 0) {
            recallItems = {
              corrections: correctionsList,
              vocabulary: vocabList,
            };
          }
        }
      } catch (err) {
        console.warn('[Scratchpad] Błąd pobierania poprzedniej lekcji do powtórki:', err);
      }
    }

    try {
      const html = buildLessonTemplate({
        previousHtml: editorRef.current.innerHTML,
        recallItems,
      });

      editorRef.current.insertAdjacentHTML('beforeend', html);

      const headings = editorRef.current.querySelectorAll('h3');
      const firstSection = headings[headings.length - LESSON_SECTIONS.length];
      const target = firstSection?.nextElementSibling as HTMLElement | null;
      if (target) {
        const range = window.document.createRange();
        range.selectNodeContents(target);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      handleInput();
      setTimeout(() => {
        measurePages();
      }, 60);
    } finally {
      setIsInsertingLesson(false);
    }
  };

  /** Wstawia wymuszony podział strony A4 (nowa czysta strona) */
  const handleInsertPageBreak = () => {
    if (isReadOnly || !editorRef.current) return;
    const breakHtml = `<div class="pad-page-break" data-page-break="1" contenteditable="false"><span class="pad-page-break-badge">── Strona A4 • Nowa Lekcja ──</span></div><p><br></p>`;
    window.document.execCommand('insertHTML', false, breakHtml);
    handleInput();
    setTimeout(() => {
      measurePages();
    }, 60);
  };

  // ── Przetwarzanie plików i załączników do Asystenta AI Notatnika ──
  const processAiFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const newAtts: LessonAttachment[] = [];

    for (const file of list) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let detectedType: LessonAttachment['type'] = 'text';
      if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        detectedType = 'image';
      } else if (file.type === 'application/pdf' || ext === 'pdf') {
        detectedType = 'pdf';
      } else if (['docx', 'doc'].includes(ext) || file.type.includes('wordprocessingml') || file.type === 'application/msword') {
        detectedType = 'text';
      } else if (ext === 'md' || ext === 'markdown') {
        detectedType = 'markdown';
      } else if (ext === 'html' || ext === 'htm') {
        detectedType = 'html';
      } else {
        detectedType = 'text';
      }

      try {
        // Obsługa plików Microsoft Word (.docx)
        if (['docx', 'doc'].includes(ext) || file.type.includes('wordprocessingml') || file.type === 'application/msword') {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const mammothResult = await mammoth.extractRawText({ arrayBuffer });
            const docxText = mammothResult?.value || '';
            newAtts.push({
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              type: 'text',
              size: file.size,
              mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              textContent: docxText,
            });
            continue;
          } catch (docxErr) {
            console.warn('[Docx parsing error]:', docxErr);
          }
        }

        if (detectedType === 'image' || detectedType === 'pdf') {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          let textContent: string | undefined;
          if (detectedType === 'pdf') {
            try {
              const pdfjsLib = (window as any).pdfjsLib;
              if (pdfjsLib) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                  const page = await pdf.getPage(i);
                  const tc = await page.getTextContent();
                  fullText += tc.items.map((item: any) => item.str).join(' ') + '\n';
                }
                textContent = fullText;
              }
            } catch (pdfErr) {
              console.warn('PDF text extraction fallback:', pdfErr);
            }
          }

          newAtts.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name || `plik-${Date.now()}.${ext || 'png'}`,
            type: detectedType,
            size: file.size,
            mimeType: file.type || (detectedType === 'pdf' ? 'application/pdf' : 'image/png'),
            dataUrl,
            textContent,
          });
        } else {
          const textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          newAtts.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            type: detectedType,
            size: file.size,
            mimeType: file.type || 'text/plain',
            textContent,
          });
        }
      } catch (e) {
        console.warn('Błąd czytania pliku:', e);
      }
    }
    setPendingAiAttachments(prev => [...prev, ...newAtts]);
  };

  // ── Otwarcie modalu zatwierdzenia formatowania ──
  const handleOpenInsertPreview = (rawText: string) => {
    const structured = parseRawTextToStructuredLesson(rawText);
    setInsertPreviewState({
      isOpen: true,
      content: structured,
    });
  };

  // ── Potwierdzenie wstawienia z modalu podglądu ──
  const handleConfirmInsertFromModal = (
    html: string,
    mode: 'template' | 'append' | 'cursor' | 'replace'
  ) => {
    if (isReadOnly || !editorRef.current) return;

    if (mode === 'replace') {
      editorRef.current.innerHTML = html;
      handleInput();
      setTimeout(() => {
        measurePages();
      }, 80);
      return;
    }

    if (mode === 'cursor') {
      window.document.execCommand('insertHTML', false, html);
      handleInput();
      setTimeout(() => {
        measurePages();
      }, 80);
      return;
    }

    if (mode === 'template') {
      const hasExisting = editorRef.current.innerHTML.trim().length > 0 && editorRef.current.innerText.trim().length > 0;
      const pageBreakHtml = hasExisting
        ? `<div class="pad-page-break" data-page-break="1" contenteditable="false"><span class="pad-page-break-badge">── Strona A4 • Nowa Lekcja ──</span></div>`
        : '';
      editorRef.current.insertAdjacentHTML('beforeend', pageBreakHtml + html);
      handleInput();
      setTimeout(() => {
        measurePages();
        editorRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return;
    }

    // append
    editorRef.current.insertAdjacentHTML('beforeend', `<p><br></p>${html}<p><br></p>`);
    handleInput();
    setTimeout(() => {
      measurePages();
      editorRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  // ── Obsługa zapytań do wbudowanego Asystenta AI Notatnika ──
  const handleSendAiChat = async (customPrompt?: string) => {
    if (!isTeacher) return;
    const promptToSend = (customPrompt || aiChatDraft).trim();
    const attachmentsToSend = [...pendingAiAttachments];
    if ((!promptToSend && attachmentsToSend.length === 0) || isAiGenerating) return;

    const userTurn: ScratchpadChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptToSend || (attachmentsToSend.length > 0 ? `[Załączono: ${attachmentsToSend.map(a => a.name).join(', ')}]` : ''),
      timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
    };

    setAiChatMessages(prev => [...prev, userTurn]);
    if (!customPrompt) {
      setAiChatDraft('');
      setPendingAiAttachments([]);
    }
    setIsAiGenerating(true);

    try {
      const docText = editorRef.current?.innerText || '';
      const selectedText = window.getSelection()?.toString().trim() || '';

      // Lista aktywnych nagłówków dokumentu — żeby asystent wiedział, ile lekcji
      // już jest i pod jaką sekcją (jeśli w ogóle) właśnie pracuje lektor,
      // zamiast zgadywać ze streszczenia całej treści.
      const headingsList = editorRef.current
        ? (Array.from(editorRef.current.querySelectorAll('h1, h2, h3')) as HTMLElement[])
            .map(h => `${h.tagName}: ${(h.textContent || '').replace(/[▾▸]/g, '').trim()}`)
            .filter(line => line.length > 4)
            .join('\n')
        : '';

      const systemPrompt = `Jesteś inteligentnym asystentem lektora języka angielskiego w notatniku lekcyjnym.
Twoim zadaniem jest pomoc w edycji i organizacja materiału zgodnie z szablonem lekcji.

Aktywne sekcje/nagłówki w bieżącym dokumencie:
${headingsList || '(dokument jest pusty — brak nagłówków)'}

Gdy lektor wklei chaotyczne notatki lub poprosi o uporządkowanie materiału:
- Rozpoznaj i podziel treść na właściwe sekcje: Revision, Main topic / Practice, Lesson Summary, Key Language & Corrections (New words), Homework.
- W sekcji Key Language & Corrections oznaczaj błędy i poprawne formy dokładnie tymi znacznikami HTML (interfejs rozpoznaje tylko te trzy klasy):
  Błąd: <span class="badge-error">X [błędna forma]</span>
  Poprawnie: <span class="badge-success">✓ [poprawna forma]</span>
  Słówko: <span class="badge-vocab">Słówko: [wyrażenie] - [wyjaśnienie]</span>
- Zwracaj odpowiedź w ustrukturyzowanym formacie sekcji (nagłówek sekcji, potem jej treść), tak aby interfejs mógł wygenerować przyciski wstawiania do konkretnej sekcji.

Dodatkowo, poza samym porządkowaniem notatek:
1. Pomagasz prowadzić i planować efektywną lekcję języka angielskiego.
2. Błyskawicznie analizujesz notatki, transkrypcje i załączniki (PDF, DOCX/Word, screenshoty, wklejony tekst).
3. Wyciągasz kluczowe słownictwo, korekty gramatyczne i tworzysz podsumowania.
Zasady:
- Odpowiadaj konkretnie, estetycznie i nowocześnie. Słownictwo pogrubiaj (**word**).
- Wyjaśnienia po polsku, przykłady i ćwiczenia po angielsku.`;

      let attachmentsContext = '';
      if (attachmentsToSend.length > 0) {
        attachmentsContext = '\n\n[ZAŁĄCZNIKI UŻYTKOWNIKA DO ANALIZY]:\n' + attachmentsToSend.map((att, idx) => {
          let desc = `--- Załącznik ${idx + 1}: ${att.name} (${att.type.toUpperCase()}) ---\n`;
          if (att.textContent) {
            desc += `Treść tekstu / PDF / DOCX:\n"""${att.textContent.slice(0, 12000)}"""\n`;
          } else if (att.type === 'image') {
            desc += `[Obraz: ${att.name}]\n`;
          }
          return desc;
        }).join('\n');
      }

      let promptWithContext = `Kontekst dokumentu notatnika:
Tytuł: ${docData.title || 'Notatnik lekcyjny'}
Kursant: ${docData.studentName || 'Kursant'}

${selectedText ? `Aktualnie zaznaczony przez użytkownika fragment tekstu:\n"""${selectedText}"""\n\n` : ''}Treść dokumentu notatnika:\n"""${docText.slice(0, 12000)}"""
${docData.teacherNotes ? `\n\n[PRYWATNE NOTATKI LEKTORA (SIDE NOTES — WIDOCZNE TYLKO DLA CIEBIE I LEKTORA, UWAGI DOTYCZĄCE TRUDNOŚCI KURSANTA I PRZEBIEGU ZAJĘĆ)]:\n"""${docData.teacherNotes.slice(0, 5000)}"""\nWykorzystaj te uwagi lektora przy przygotowywaniu podsumowania, korekt lub zadań domowych!\n` : ''}
${attachmentsContext}

Polecenie użytkownika:
${promptToSend || 'Przeanalizuj przesłane załączniki/notatki i przygotuj z nich opracowanie lekcji zgodnie ze standardem CRIBRO.'}`;

      let responseText = '';
      try {
        const councilRes = await runCouncil<string>({
          systemInstruction: systemPrompt,
          prompt: promptWithContext,
          reviewerSystemInstruction: SCRATCHPAD_REVIEW_SYSTEM,
          expectJson: false,
        });
        responseText = councilRes.raw || (councilRes.data as string) || '';
      } catch (councilErr) {
        console.warn('[Scratchpad AI] Narada nie powiodła się, przejście do fallbacku:', councilErr);
        const aiResponse = await generateTextWithUnifiedFallback(
          promptWithContext,
          systemPrompt,
          undefined,
          undefined,
          undefined,
          { taskName: 'Asystent notatnika', category: 'chat' }
        );
        responseText = aiResponse.text || '';
      }

      const assistantTurn: ScratchpadChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: responseText.trim(),
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      };

      setAiChatMessages(prev => [...prev, assistantTurn]);
    } catch (err: any) {
      console.error('[Scratchpad AI Chat Error]:', err);
      setAiChatMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ Nie udało się wygenerować odpowiedzi: ${err?.message || 'Błąd połączenia z modelem AI.'}`,
          timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const markdownToHtml = (text: string): string => {
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += '<p><br></p>';
        continue;
      }

      let formatted = rawLine
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;">$1</code>');

      if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        if (!inList) {
          html += '<ul style="margin: 6px 0; padding-left: 20px;">';
          inList = true;
        }
        const itemContent = formatted.replace(/^[-*•\d.]+\s*/, '');
        html += `<li>${itemContent}</li>`;
      } else if (/^#{1,3}\s+/.test(line)) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        const headingText = formatted.replace(/^#{1,3}\s+/, '');
        html += `<h3 style="color:var(--accent);margin:12px 0 6px;">${headingText}</h3>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p style="margin:4px 0;">${formatted}</p>`;
      }
    }

    if (inList) html += '</ul>';
    return html;
  };

  const handleInsertAiMessageToDoc = (text: string) => {
    if (isReadOnly || !editorRef.current) return;
    const html = markdownToHtml(text);
    editorRef.current.focus();
    window.document.execCommand('insertHTML', false, `<div class="ai-inserted-block" style="border-left: 3px solid #72f0b4; padding-left: 10px; margin: 10px 0;">${html}</div>`);
    handleInput();
  };

  const handleAppendAiMessageToDoc = (text: string) => {
    if (isReadOnly || !editorRef.current) return;
    const innerHtml = markdownToHtml(text);
    const blockHtml = `<p><br></p><div class="ai-inserted-block" style="border-left: 3px solid #72f0b4; padding-left: 12px; margin: 14px 0;">${innerHtml}</div><p><br></p>`;
    editorRef.current.insertAdjacentHTML('beforeend', blockHtml);
    handleInput();
    setTimeout(() => {
      editorRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const handleInsertAsStructuredLesson = (text: string) => {
    if (isReadOnly || !editorRef.current) return;

    // Detect date or default to today
    const dateMatch = text.match(/(?:dnia|z\s*dnia|date:?)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
    const lessonDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Detect topic if present
    const topicMatch = text.match(/(?:temat|topic|lekcja:?)\s*[:\-—]\s*([^\n\r]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : '';

    const nextNum = highestLessonNumber(editorRef.current.innerHTML) + 1;

    // Helper to extract section content
    const extractSection = (keywords: string[]): string => {
      const regex = new RegExp(`(?:#{1,4}\\s*)?(?:${keywords.join('|')})[\\s:\\-—]+([\\s\\S]*?)(?=(?:#{1,4}\\s*)?(?:revision|main topic|lesson summary|key language|homework|blok\\s*\\d|$)|\$)`, 'i');
      const m = text.match(regex);
      return m && m[1] ? m[1].trim() : '';
    };

    const revText = extractSection(['revision', 'powtórka', 'korekty', 'błędy']);
    const topicText = extractSection(['main topic', 'practice', 'ćwiczenia', 'temat główny']);
    const sumText = extractSection(['lesson summary', 'podsumowanie', 'summary']);
    const vocabText = extractSection(['key language', 'słownictwo', 'nowe słówka', 'corrections']);
    const hwText = extractSection(['homework', 'zadanie domowe', 'praca domowa']);

    const hasExistingContent = editorRef.current.innerHTML.trim().length > 0 && editorRef.current.innerText.trim().length > 0;
    const pageBreakHtml = hasExistingContent
      ? `<div class="pad-page-break" data-page-break="1" contenteditable="false"><span class="pad-page-break-badge">── Strona A4 • Nowa Lekcja ──</span></div>`
      : '';

    let fullLessonHtml = `
      ${pageBreakHtml}
      <h2 data-toggle="1" data-collapsed="0">
        <span class="pad-toggle" contenteditable="false" title="Zwiń / rozwiń lekcję">▾</span>
        Lesson ${nextNum} — ${lessonDate}${topic ? ` • ${topic}` : ''}
      </h2>
    `;

    const sections = [
      { title: 'Revision', color: NOTEBOOK_COLORS.rose, body: revText || '<p>• Przejrzyj korekty i słownictwo z poprzednich zajęć.</p>' },
      { title: 'Main topic / Practice', color: NOTEBOOK_COLORS.green, body: topicText || (topic ? `<p><strong>Temat:</strong> ${topic}</p>` : '<p><br></p>') },
      { title: 'Lesson Summary', color: NOTEBOOK_COLORS.blue, body: sumText || (text.length < 500 ? markdownToHtml(text) : '<p><br></p>') },
      { title: 'Key Language & Corrections (New words)', color: NOTEBOOK_COLORS.orange, body: vocabText || '<p><br></p>' },
      { title: 'Homework', color: NOTEBOOK_COLORS.violet, body: hwText || '<p>• Utrwalenie słówek w aplikacji Recall (Fiszki / Tłumaczenie zdań).</p>' },
    ];

    sections.forEach(s => {
      const bodyHtml = s.body.startsWith('<') ? s.body : markdownToHtml(s.body);
      fullLessonHtml += `
        <h3 style="color: ${s.color}">${s.title}</h3>
        <div>${bodyHtml}</div>
      `;
    });

    editorRef.current.insertAdjacentHTML('beforeend', fullLessonHtml);
    handleInput();
    setTimeout(() => {
      measurePages();
      editorRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  /**
   * Wstawia treść AI pod WYBRANĄ sekcję bieżącej (ostatniej) lekcji, zamiast
   * tworzyć nową lekcję. Sekcja to nagłówek H3 z `LESSON_SECTIONS` — szuka go
   * w obrębie ostatniego bloku lekcyjnego (od ostatniego H2 do końca
   * dokumentu albo do następnego H2) i dopisuje treść na końcu tej sekcji,
   * przed kolejnym nagłówkiem.
   *
   * Jeśli w dokumencie nie ma jeszcze żadnej lekcji (H2), nie zgaduje gdzie
   * wstawić — dopisuje na końcu dokumentu, tak jak „Dopisz na końcu”.
   */
  const handleInsertIntoSection = (sectionTitle: string, text: string) => {
    if (isReadOnly || !editorRef.current) return;

    const allH2 = Array.from(editorRef.current.querySelectorAll('h2')) as HTMLElement[];
    const lastH2 = allH2[allH2.length - 1];
    if (!lastH2) {
      handleAppendAiMessageToDoc(text);
      return;
    }

    // Wszystkie węzły od ostatniego H2 (włącznie) do następnego H2 lub końca dokumentu.
    const lessonNodes: Element[] = [];
    let node: Element | null = lastH2;
    while (node) {
      lessonNodes.push(node);
      node = node.nextElementSibling;
      if (node && node.tagName === 'H2') break;
    }

    const targetH3 = lessonNodes.find(
      el => el.tagName === 'H3' && (el.textContent || '').toLowerCase().includes(sectionTitle.toLowerCase())
    ) as HTMLElement | undefined;

    if (!targetH3) {
      handleAppendAiMessageToDoc(text);
      return;
    }

    // Ostatni węzeł tej sekcji: wszystko po `targetH3` aż do kolejnego H2/H3.
    let insertAfter: Element = targetH3;
    let sibling = targetH3.nextElementSibling;
    while (sibling && sibling.tagName !== 'H2' && sibling.tagName !== 'H3') {
      insertAfter = sibling;
      sibling = sibling.nextElementSibling;
    }

    const bodyHtml = markdownToHtml(text);
    insertAfter.insertAdjacentHTML('afterend', bodyHtml);
    handleInput();
    setTimeout(() => {
      measurePages();
      targetH3.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleCopyAiMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAiMsgId(id);
    setTimeout(() => setCopiedAiMsgId(null), 2000);
  };

  // Wstawienie szablonu lektora
  const handleInsertTemplate = (html: string) => {
    if (isReadOnly) return;
    window.document.execCommand('insertHTML', false, html);
    handleInput();
  };

  const refreshTemplates = useCallback(async () => {
    if (!isTeacher) return;
    try {
      const list = await listScratchpadTemplates();
      setTemplates(list);
    } catch (err: any) {
      console.warn('[Scratchpad] Nie udało się pobrać szablonów notatnika:', err?.message || err);
    }
  }, [isTeacher]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  // Zakreślacze lektorskie — czysty element liniowy (inline mark / <span>) bez rozbijania akapitu
  const handleHighlight = (bgColor: string, textColor: string) => {
    if (isReadOnly) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const span = window.document.createElement('span');
    span.style.backgroundColor = bgColor;
    span.style.color = textColor;
    span.style.fontWeight = 'bold';
    span.style.padding = '1px 4px';
    span.style.borderRadius = '4px';
    span.style.display = 'inline';

    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      handleInput();
    } catch (e) {
      execCmd('hiliteColor', bgColor);
    }
  };

  // Wstawienie linku
  const handleInsertLink = () => {
    if (isReadOnly) return;
    const url = window.prompt('Adres linku (https://…)');
    if (!url || !url.trim()) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      execCmd('createLink', url.trim());
    } else {
      window.document.execCommand(
        'insertHTML',
        false,
        `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer">${url.trim()}</a>&nbsp;`
      );
      handleInput();
    }
  };

  // Lista zadań
  const handleInsertChecklist = () => {
    if (isReadOnly) return;
    window.document.execCommand(
      'insertHTML',
      false,
      '<div><input type="checkbox" style="margin-right:6px;vertical-align:middle;" />&nbsp;</div>'
    );
    handleInput();
  };

  // Kopiowanie linku lub kodu PIN
  const handleCopyLink = () => {
    const url = buildScratchpadUrl(docData.id, docData.pin ? { pin: docData.pin } : undefined);
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
      summary: generalLines.slice(0, 5).join('\n') || `Notatki ze wspólnego notatnika z dnia ${todayStr}`,
      thingsToImprove: correctionLines.join('\n'),
      followUp: 'Utrwalenie słownictwa i poprawek z notatnika lekcyjnego.',
    });
  };

  // Obsługa rozpoczęcia prezentacji na żywo
  const handleStartPresentation = async (pres: PresentationState) => {
    setIsLivePresentationModalOpen(false);
    if (!docData.id) return;
    try {
      await updateScratchpadPresentation(docData.id, pres);
    } catch (err) {
      console.error('Błąd uruchamiania prezentacji:', err);
    }
  };

  const handleStopPresentation = async () => {
    if (!docData.id) return;
    try {
      await updateScratchpadPresentation(docData.id, null);
    } catch (err) {
      console.error('Błąd zamykania prezentacji:', err);
    }
  };

  const handleLaunchExerciseFromScenario = async (ex: InteractiveExercise) => {
    if (!docData.id) return;
    try {
      const mappedType =
        ex.type === 'sentence_scramble'
          ? 'sentence_scramble'
          : ex.type === 'error_hunt'
          ? 'error_hunt'
          : 'interactive_quiz';

      await updateScratchpadPresentation(docData.id, {
        active: true,
        title: ex.title || 'Ćwiczenie interaktywne',
        type: mappedType,
        question: ex.question,
        options: ex.options,
        correctAnswer: ex.correctAnswer,
        revealedAnswer: false,
        studentAnswer: null,
        explanation: ex.explanation,
      });
    } catch (err) {
      console.error('Błąd uruchamiania ćwiczenia ze scenariusza:', err);
    }
  };

  const handleLaunchWheelOfFortune = async () => {
    if (!docData.id) return;
    try {
      await updateScratchpadPresentation(docData.id, {
        active: true,
        title: 'Warm-up: Koło Fortuny',
        type: 'wheel_of_fortune',
        question: 'Zakręć kołem i wylosuj pytanie rozgrzewkowe na start lekcji.',
        prompt: 'Interaktywne koło pytań rozgrzewkowych z fizyką GSAP. Wybierz źródło pytań i zakręć kołem!',
      });
    } catch (err) {
      console.error('Błąd uruchamiania Koła Fortuny:', err);
    }
  };

  const handleTriggerAiFromNotes = (promptText: string) => {
    if (!isTeacher) return;
    setIsAiChatOpen(true);
    handleSendAiChat(promptText);
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
    <div
      data-pad-theme={paperTheme}
      className={`pad-shell h-full w-full min-h-0 flex flex-col overflow-hidden bg-base-100 ${standalone ? 'is-standalone' : ''} ${className}`}
    >
      {/* 1. JEDNOLITY NAGŁÓWEK DOKUMENTU */}
      <header className="px-4 py-2.5 pad-bar border-b border-line-strong flex items-center justify-between gap-3 select-none flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-3 min-w-0" data-coach="pad-identity">
          <div className="p-2 rounded-xl bg-accent/12 text-accent border border-accent/25 shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-text-hi truncate tracking-tight">
                {docData.title || `Brudnopis lekcyjny — ${docData.studentName || 'Notatki'}`}
              </h1>
              {docData.pin && (
                <span className="px-2 py-0.5 rounded-lg bg-base-200/80 border border-line-strong font-mono text-[11px] font-bold text-primary tracking-wider shrink-0" title="Stały kod PIN do tego notatnika">
                  PIN: {formatAccessCode(docData.pin)}
                </span>
              )}
              {isReadOnly && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.07] border border-line text-text-2 flex items-center gap-1 shrink-0">
                  <Eye size={11} /> Podgląd
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-text-faint mt-0.5">
              <span className="truncate">
                {docData.studentName ? `Kursant: ${docData.studentName}` : 'Wspólny notatnik'}
              </span>
              <span aria-hidden>•</span>
              {saveStatus === 'saving' ? (
                <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 -ml-3.5" />
                  <CloudUpload size={11} className="animate-pulse" /> Zapisywanie…
                </span>
              ) : saveStatus === 'local_only' ? (
                <span
                  className="text-red-400 flex items-center gap-1.5 font-medium"
                  title="Błąd sieci / zapis tylko lokalnie — kursant nie zobaczy tych zmian dopóki połączenie nie wróci."
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                  <CloudUpload size={11} /> Błąd sieci (tylko lokalnie)
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <CloudCheck size={11} /> Zsynchronizowano
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0 flex-wrap">
          {/* Pomocnik Lektora: Scenariusz i Side Notes */}
          {isTeacher && (
            <button
              type="button"
              onClick={() => setIsScenarioDrawerOpen(!isScenarioDrawerOpen)}
              title="Scenariusz lekcji i prywatne Side Notes lektora"
              className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm ${
                isScenarioDrawerOpen
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08]'
              }`}
            >
              <Target size={14} />
              <span className="hidden md:inline">Scenariusz & Notes</span>
              {docData.teacherNotes && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )}

          {/* Tryb Prezentacji (Live Slides) dla lektora */}
          {isTeacher && (
            <button
              type="button"
              onClick={() => setIsLivePresentationModalOpen(true)}
              data-coach="pad-presentation"
              title="Uruchom tryb prezentacji (wyświetla kursantowi ćwiczenia/slajdy zamiast notatnika)"
              className="h-8 px-2.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Airplay size={14} />
              <span className="hidden md:inline">Prezentacja</span>
            </button>
          )}

          {/* Szybki start: Koło Fortuny dla lektora */}
          {isTeacher && (
            <button
              type="button"
              onClick={handleLaunchWheelOfFortune}
              title="Uruchom Koło Fortuny na żywo (losowanie pytań rozgrzewkowych)"
              className="h-8 px-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <span>🎡</span>
              <span className="hidden lg:inline">Koło Fortuny</span>
            </button>
          )}

          {/* Szablony lekcji dla lektora */}
          {isTeacher && (
            <button
              type="button"
              onClick={() => setIsTemplateManagerOpen(true)}
              title="Wzory lekcji i szablony notatnika (możliwość ustawienia domyślnego)"
              className="h-8 px-2 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer"
            >
              <LayoutTemplate size={14} />
              <span className="hidden lg:inline">Szablony</span>
            </button>
          )}

          {/* Orientacja arkusza A4 (Pionowa / Pozioma) */}
          <button
            type="button"
            onClick={handleToggleOrientation}
            title={pageOrientation === 'portrait' ? 'Układ: Pionowy A4 (kliknij, aby zmienić na poziomy)' : 'Układ: Poziomy A4 (kliknij, aby zmienić na pionowy)'}
            aria-label="Układ strony A4"
            className="h-8 px-2 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <Compass size={14} />
            <span className="hidden xl:inline">{pageOrientation === 'portrait' ? 'A4 Pion' : 'A4 Poziom'}</span>
          </button>

          {/* Udostępnij dla lektora */}
          {isTeacher && (
            <MenuDropdown
              open={isShareMenuOpen}
              onOpenChange={setIsShareMenuOpen}
              width={300}
              align="end"
              aria-label="Udostępnianie i uprawnienia"
              coachId="pad-share"
              triggerTitle="Link, kod PIN i uprawnienia kursanta"
              triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isShareMenuOpen
                  ? 'bg-white/[0.08] border-line-strong text-content'
                  : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
              }`}
              trigger={
                <>
                  <Share2 size={13} />
                  <span className="hidden sm:inline">Udostępnij</span>
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
                      description: 'Otwiera notatnik bez logowania',
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

          {/* Eksport dokumentu */}
          <MenuDropdown
            open={isExportMenuOpen}
            onOpenChange={setIsExportMenuOpen}
            width={280}
            align="end"
            aria-label="Eksport notatnika"
            triggerTitle="Zapisz notatnik jako plik"
            triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              isExportMenuOpen
                ? 'bg-white/[0.08] border-line-strong text-content'
                : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
            trigger={
              <>
                <Download size={13} />
                <span className="hidden sm:inline">Eksportuj</span>
                <MenuChevron open={isExportMenuOpen} />
              </>
            }
            sections={[
              {
                id: 'export',
                items: [
                  {
                    id: 'export-gdocs',
                    label: 'Otwórz w Google Docs',
                    description: 'Kopiuje treść i otwiera nowy dokument Google Docs (Ctrl+V)',
                    icon: <ExternalLink size={14} />,
                    onSelect: async () => {
                      const copied = await exportScratchpadToGoogleDocs(
                        docData.title || 'Notatnik',
                        editorRef.current?.innerHTML || docData.contentHtml
                      );
                      setGoogleDocsHint(copied ? 'copied' : 'manual');
                      setTimeout(() => setGoogleDocsHint(null), 8000);
                    },
                  },
                  {
                    id: 'export-pdf',
                    label: isExportingPdf ? 'Generowanie PDF…' : 'Eksportuj do PDF',
                    description: 'Dokument A4 z zachowaniem stylów i podziału stron',
                    icon: isExportingPdf ? <span className="animate-spin text-primary">⏳</span> : <FileDown size={14} />,
                    onSelect: async () => {
                      setIsExportingPdf(true);
                      try {
                        await exportScratchpadToPDF(
                          docData.title || 'Notatnik',
                          editorRef.current?.innerHTML || docData.contentHtml
                        );
                      } catch (err) {
                        console.error('Błąd eksportu do PDF:', err);
                      } finally {
                        setIsExportingPdf(false);
                      }
                    },
                  },
                  {
                    id: 'export-word',
                    label: 'Eksportuj do Worda (.docx)',
                    description: 'Otwiera się też w Google Docs',
                    icon: <FileType2 size={14} />,
                    onSelect: () => exportScratchpadToWord(
                      docData.title || 'Notatnik',
                      editorRef.current?.innerHTML || docData.contentHtml
                    ),
                  },
                ],
              },
            ]}
          />

          {/* Zapisz do dziennika lekcji */}
          {isTeacher && onPushToLessonRecord && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePushToLesson}
              data-coach="pad-push"
              className="h-8 text-xs flex items-center gap-1.5"
              title="Rozłóż notatki na 4 bloki Notion i otwórz formularz lekcji"
            >
              <Layers size={13} />
              <span className="hidden md:inline">Do dziennika</span>
            </Button>
          )}

          {/* Wskaźnik laserowy z synchronizacją na żywo */}
          <button
            type="button"
            onClick={() => setIsLaserOn(v => !v)}
            title={isLaserOn ? 'Wyłącz wskaźnik laserowy' : 'Wskaźnik laserowy przy kursorze (widoczny również dla kursanta)'}
            aria-pressed={isLaserOn}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
              isLaserOn
                ? 'border-danger/50 bg-danger/15 text-danger animate-pulse shadow-sm shadow-danger/30'
                : 'border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
          >
            <Flashlight size={14} />
          </button>

          {/* Motyw kartki (Jasna / Ciemna) */}
          <button
            type="button"
            onClick={() => setPaperTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
            title={paperTheme === 'light' ? 'Ciemna kartka' : 'Jasna kartka'}
            aria-label={paperTheme === 'light' ? 'Przełącz kartkę na ciemną' : 'Przełącz kartkę na jasną'}
            className="h-8 w-8 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            {paperTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          {/* Samouczek */}
          <button
            type="button"
            onClick={() => setIsCoachOpen(true)}
            title="Samouczek — opis funkcji notatnika"
            aria-label="Samouczek"
            className="h-8 w-8 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <GraduationCap size={14} />
          </button>

          {/* Zamknięcie notatnika */}
          {onClose && (
            <>
              <div className="w-px h-5 bg-line-strong mx-0.5" aria-hidden />
              <button
                type="button"
                onClick={onClose}
                title="Zamknij notatnik"
                aria-label="Zamknij notatnik"
                className="h-8 w-8 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Komunikaty */}
      {googleDocsHint && (
        <div className="px-4 py-2.5 bg-primary/[0.08] border-b border-primary/25 flex items-center gap-2.5 text-xs animate-fadeIn">
          <ExternalLink size={14} className="text-primary shrink-0" />
          <span className="text-content">
            {googleDocsHint === 'copied'
              ? 'Notatnik jest w schowku, a nowy dokument Google otworzył się w drugiej karcie — wklej go tam (Ctrl+V / ⌘V).'
              : 'Przeglądarka nie wpuściła treści do schowka. Nowy dokument Google jest otwarty — użyj „Eksportuj do Worda" i wgraj plik na Dysk.'}
          </span>
        </div>
      )}

      {imageNotice && (
        <div className="px-4 py-2.5 bg-warn/[0.1] border-b border-warn/30 flex items-start gap-2.5 text-xs animate-fadeIn">
          <ImageIcon size={14} className="text-warn shrink-0 mt-0.5" />
          <span className="text-content flex-1">{imageNotice}</span>
          <button
            type="button"
            onClick={() => setImageNotice(null)}
            className="shrink-0 text-content-muted hover:text-text-hi cursor-pointer"
            aria-label="Zamknij komunikat"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {(docData.cloudBlockedReason || saveStatus === 'local_only') && isTeacher && (
        <div className="px-4 py-3 bg-warn/[0.1] border-b border-warn/30 flex items-start gap-3">
          <AlertTriangle size={16} className="text-warn shrink-0 mt-0.5" />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="font-bold text-text-hi">
              Ten notatnik nie zapisał się w chmurze — kursant go nie zobaczy
            </p>
            <p className="text-content-muted mt-0.5">
              {docData.cloudBlockedReason ||
                'Zmiany trafiają wyłącznie do pamięci tej przeglądarki. Nie wysyłaj jeszcze linku kursantowi.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. PASEK FORMATOWANIA */}
      <div className="px-3 py-1.5 pad-bar border-b border-line-strong flex items-center gap-1 overflow-x-auto no-scrollbar select-none sticky top-0 z-30 flex-nowrap sm:flex-wrap">
        {/* Ukryty input dla plików graficznych */}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileSelected}
        />

        {/* Historia / Drukuj */}
        <div className="flex items-center gap-0.5 shrink-0" data-coach="pad-history">
          {!isReadOnly && (
            <>
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
            </>
          )}
          <FormatButton
            icon={<Printer size={14} />}
            title="Drukuj stronę (Ctrl+P)"
            onClick={() => window.print()}
          />
        </div>

        {!isReadOnly && (
          <>
            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Styl tekstu */}
            <MenuDropdown
              open={isStyleMenuOpen}
              onOpenChange={setIsStyleMenuOpen}
              preserveSelection
              width={268}
              align="start"
              aria-label="Styl tekstu"
              coachId="pad-style"
              triggerTitle="Nagłówki i style tekstu"
              triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
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
                  id: 'standard-blocks',
                  label: 'Podstawowe style tekstu',
                  items: [
                    {
                      id: 'p',
                      label: 'Zwykły akapit',
                      icon: <Pilcrow size={14} />,
                      onSelect: () => handleFormatBlock('p'),
                    },
                    {
                      id: 'h1',
                      label: 'Nagłówek 1 (Lekcja)',
                      description: 'Główny nagłówek nadrzędny w spisie',
                      icon: <Heading1 size={14} />,
                      onSelect: () => handleFormatBlock('h1'),
                    },
                    {
                      id: 'h2',
                      label: 'Nagłówek 2 (Rozdział)',
                      description: 'Rozdział widoczny pod lekcją w spisie',
                      icon: <Heading2 size={14} />,
                      onSelect: () => handleFormatBlock('h2'),
                    },
                    {
                      id: 'h3',
                      label: 'Nagłówek 3 (Sekcja wewnątrz)',
                      description: 'Nagłówek sekcji — nie trafia do spisu',
                      icon: <Heading3 size={14} />,
                      onSelect: () => handleFormatBlock('h3'),
                    },
                  ],
                },
                {
                  id: 'toggle-headings',
                  label: 'Nagłówki zwijane (Opcjonalne)',
                  items: [
                    {
                      id: 'toggle-h1',
                      label: 'Zwijany Nagłówek 1',
                      description: 'Nagłówek nadrzędny ze strzałką do zwijania',
                      icon: <ChevronRight size={14} />,
                      onSelect: () => handleToggleHeading('h1'),
                    },
                    {
                      id: 'toggle-h2',
                      label: 'Zwijany Nagłówek 2',
                      description: 'Rozdział ze strzałką do zwijania treści',
                      icon: <ChevronRight size={14} />,
                      onSelect: () => handleToggleHeading('h2'),
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

            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Pogrubienie, Kursywa */}
            <div className="flex items-center gap-0.5 shrink-0">
              <FormatButton
                icon={<Bold size={14} />}
                title="Pogrubienie (Ctrl+B)"
                onClick={() => execCmd('bold')}
              />
              <FormatButton
                icon={<Italic size={14} />}
                title="Kursywa (Ctrl+I)"
                onClick={() => execCmd('italic')}
              />
              <FormatButton
                icon={<Underline size={14} />}
                title="Podkreślenie (Ctrl+U)"
                onClick={() => execCmd('underline')}
              />
              <FormatButton
                icon={<Strikethrough size={14} />}
                title="Przekreślenie"
                onClick={() => execCmd('strikeThrough')}
              />
            </div>

            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Wyrównanie tekstu */}
            <div className="flex items-center gap-0.5 shrink-0">
              <FormatButton
                icon={<AlignLeft size={14} />}
                title="Wyrównaj do lewej"
                onClick={() => execCmd('justifyLeft')}
              />
              <FormatButton
                icon={<AlignCenter size={14} />}
                title="Wyśrodkuj"
                onClick={() => execCmd('justifyCenter')}
              />
              <FormatButton
                icon={<AlignRight size={14} />}
                title="Wyrównaj do prawej"
                onClick={() => execCmd('justifyRight')}
              />
            </div>

            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Kolor tekstu */}
            <div className="flex items-center gap-1 shrink-0" data-coach="pad-color" title="Kolor tekstu">
              <Palette size={13} className="text-text-2 mx-0.5" />
              {[{ name: 'Domyślny', value: 'inherit' }, ...NOTEBOOK_SWATCHES].map(swatch => (
                <button
                  key={swatch.value}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() =>
                    execCmd(
                      'foreColor',
                      swatch.value === 'inherit'
                        ? NOTEBOOK_INK[paperTheme === 'dark' ? 'dark' : 'light']
                        : swatch.value
                    )
                  }
                  title={swatch.name}
                  aria-label={`Kolor tekstu: ${swatch.name}`}
                  className="h-4.5 w-4.5 rounded-full border border-line-strong cursor-pointer transition-transform hover:scale-110 shrink-0"
                  style={{ backgroundColor: swatch.value === 'inherit' ? 'transparent' : swatch.value }}
                />
              ))}
            </div>

            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Zakreślacze lektorskie */}
            <div className="flex items-center gap-1 shrink-0" data-coach="pad-highlighters">
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => handleHighlight('#fee2e2', '#b91c1c')}
                className="h-7 px-2 rounded-lg text-[11px] font-bold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors cursor-pointer shrink-0"
                title="Zaznacz fragment jako błąd kursanta"
              >
                ❌ Błąd
              </button>
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => handleHighlight('#dcfce7', '#15803d')}
                className="h-7 px-2 rounded-lg text-[11px] font-bold bg-accent/12 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer shrink-0"
                title="Zaznacz fragment jako poprawną formę"
              >
                ✅ Poprawnie
              </button>
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => handleHighlight('#fef3c7', '#92400e')}
                className="h-7 px-2 rounded-lg text-[11px] font-bold bg-warn/15 text-warn border border-warn/30 hover:bg-warn/25 transition-colors cursor-pointer shrink-0"
                title="Wyróżnij nowe słówko"
              >
                💡 Słówko
              </button>
            </div>

            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Listy */}
            <div className="flex items-center gap-0.5 shrink-0">
              <FormatButton
                icon={<List size={14} />}
                title="Lista wypunktowana"
                onClick={() => execCmd('insertUnorderedList')}
              />
              <FormatButton
                icon={<ListOrdered size={14} />}
                title="Lista numerowana"
                onClick={() => execCmd('insertOrderedList')}
              />
            </div>

            <div className="w-px h-5 bg-line-strong mx-1 shrink-0" aria-hidden />

            {/* Menu Wstaw */}
            <MenuDropdown
              open={isInsertMenuOpen}
              onOpenChange={setIsInsertMenuOpen}
              preserveSelection
              width={264}
              align="start"
              aria-label="Wstaw element"
              coachId="pad-insert"
              triggerTitle="Data lekcji, szablon sekcji, listy i linia"
              triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
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
                      id: 'lesson',
                      label: 'Nowa lekcja',
                      description: 'Numer, data i sekcje — na końcu dokumentu',
                      icon: <Calendar size={14} />,
                      onSelect: handleInsertLesson,
                    },
                    {
                      id: 'upload-image',
                      label: 'Wstaw zdjęcie z dysku',
                      description: 'PNG, JPG lub WebP (możesz też wklejać Ctrl+V)',
                      icon: <ImageIcon size={14} />,
                      onSelect: () => imageFileInputRef.current?.click(),
                    },
                  ],
                },
                ...(isTeacher
                  ? [
                      {
                        id: 'templates',
                        label: 'Szablony',
                        items:
                          templates.length > 0
                            ? templates.map(tpl => ({
                                id: `tpl-${tpl.id}`,
                                label: tpl.title,
                                description: 'Wstaw szablon',
                                icon: <Sparkles size={14} />,
                                onSelect: () => handleInsertTemplate(tpl.contentHtml),
                              }))
                            : [
                                {
                                  id: 'tpl-empty',
                                  label: 'Brak zapisanych szablonów',
                                  icon: <Sparkles size={14} />,
                                  disabled: true,
                                  onSelect: () => {},
                                },
                              ],
                      },
                      {
                        id: 'templates-manage',
                        items: [
                          {
                            id: 'manage-templates',
                            label: 'Zarządzaj szablonami…',
                            icon: <Settings2 size={14} />,
                            onSelect: () => setIsTemplateManagerOpen(true),
                          },
                        ],
                      },
                    ]
                  : []),
                {
                  id: 'structure',
                  label: 'Struktura dokumentu',
                  items: [
                    {
                      id: 'page-break',
                      label: 'Podział strony A4',
                      description: 'Rozpocznij nową czystą stronę A4',
                      icon: <FilePlus size={14} />,
                      onSelect: handleInsertPageBreak,
                    },
                    {
                      id: 'checklist',
                      label: 'Lista zadań',
                      description: 'Klikalny checkbox',
                      icon: <CheckSquare size={14} />,
                      onSelect: handleInsertChecklist,
                    },
                    {
                      id: 'link',
                      label: 'Link',
                      icon: <Link2 size={14} />,
                      onSelect: handleInsertLink,
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

            {/* Szybki podział strony A4 */}
            <FormatButton
              icon={<FilePlus size={14} />}
              title="Wstaw podział strony A4 (Nowa czysta strona)"
              onClick={handleInsertPageBreak}
            />

            {/* Szybki szablon dla lektora */}
            {isTeacher && templates.length > 0 && (
              templates.length === 1 ? (
                <FormatButton
                  icon={<LayoutTemplate size={14} />}
                  title={`Wstaw szablon: ${templates[0].title}`}
                  onClick={() => handleInsertTemplate(templates[0].contentHtml)}
                />
              ) : (
                <MenuDropdown
                  open={isTemplateMenuOpen}
                  onOpenChange={setIsTemplateMenuOpen}
                  preserveSelection
                  width={260}
                  align="start"
                  aria-label="Wstaw szablon"
                  triggerTitle="Wstaw gotowy szablon lekcji"
                  triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    isTemplateMenuOpen
                      ? 'bg-white/[0.08] border-line-strong text-content'
                      : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
                  }`}
                  trigger={
                    <>
                      <LayoutTemplate size={14} />
                      <span>Szablon</span>
                      <MenuChevron open={isTemplateMenuOpen} />
                    </>
                  }
                  sections={[
                    {
                      id: 'templates-quick',
                      label: 'Wstaw szablon',
                      items: templates.map(tpl => ({
                        id: `quick-${tpl.id}`,
                        label: tpl.title,
                        icon: <LayoutTemplate size={14} />,
                        onSelect: () => handleInsertTemplate(tpl.contentHtml),
                      })),
                    },
                  ]}
                />
              )
            )}

            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={handleInsertLesson}
              disabled={isInsertingLesson}
              title="Dodaj nową lekcję: nowa strona A4, kolejny numer i 5 sekcji szablonu"
              className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-primary/12 text-primary border border-primary/30 hover:bg-primary/20 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Calendar size={13} />
              <span className="whitespace-nowrap">+ Nowa lekcja</span>
            </button>
          </>
        )}

        {/* Prawa strona paska narzędzi: Czat AI (tylko dla lektora), Spis treści i zwijanie */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {isTeacher && (
            <button
              type="button"
              onClick={() => setIsAiChatOpen(v => !v)}
              title={isAiChatOpen ? 'Zamknij Czat AI dokumentu' : 'Otwórz Czat AI dokumentu (Gemini 2.5 Flash)'}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                isAiChatOpen
                  ? 'bg-primary text-accent-ink shadow-sm shadow-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20'
              }`}
            >
              <Sparkles size={13} className={isAiGenerating ? 'animate-spin' : ''} />
              <span>Czat AI</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsTocOpen(v => !v)}
            title={isTocOpen ? 'Ukryj spis treści (Konspekt)' : 'Pokaż spis treści (Konspekt)'}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              isTocOpen
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
          >
            <ListTree size={14} />
            <span className="hidden sm:inline">Spis treści</span>
          </button>
          <FormatButton
            icon={<ChevronsDownUp size={14} />}
            title="Zwiń / Rozwiń rozdziały w dokumencie"
            onClick={() => handleCollapseAll(true)}
          />
        </div>
      </div>

      {/* 3. OBSZAR ROBOCZY: SPIS TREŚCI Z LEWEJ + WYŚRODKOWANA KARTKA A4 */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative w-full h-full">
        {/* SPIS TREŚCI PRZYPIĘTY DO LEWEJ STRONY */}
        {isTocOpen && (
          <aside className="w-64 md:w-72 shrink-0 border-r border-line-strong pad-bar overflow-y-auto flex flex-col z-20 select-none animate-fadeIn">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-line-soft sticky top-0 pad-bar backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-2">
                <ListTree size={13} className="text-primary" />
                <span>Spis treści</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCollapsedTocLessons({})}
                  title="Rozwiń wszystkie lekcje w spisie"
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  Rozwiń
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allH1: Record<string, boolean> = {};
                    toc.filter(t => t.level === 1).forEach(h1 => { allH1[h1.id] = true; });
                    setCollapsedTocLessons(allH1);
                  }}
                  title="Zwiń wszystkie lekcje w spisie"
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  Zwiń
                </button>
                <button
                  type="button"
                  onClick={() => setIsTocOpen(false)}
                  title="Ukryj panel spisu treści"
                  className="p-1 rounded text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {toc.length === 0 ? (
              <p className="px-4 py-6 text-xs leading-relaxed text-text-faint text-center">
                Spis treści zbuduje się automatycznie z nagłówków w dokumencie. Użyj Styl → Nagłówek 1 (Lekcja) i Nagłówek 2 (Rozdział).
              </p>
            ) : (
              <nav className="py-2 px-1.5 space-y-0.5">
                {toc.map(entry => {
                  if (entry.level === 1) {
                    const isLessonCollapsed = !!collapsedTocLessons[entry.id];
                    return (
                      <div key={entry.id} className="group/toc flex items-center w-full rounded-lg hover:bg-white/[0.05] transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleTocLesson(entry.id)}
                          title={isLessonCollapsed ? 'Rozwiń sekcje tej lekcji' : 'Zwiń sekcje tej lekcji'}
                          className="p-1.5 text-text-faint hover:text-text-hi transition-transform cursor-pointer"
                        >
                          <ChevronRight
                            size={12}
                            className={`transition-transform duration-150 ${isLessonCollapsed ? '' : 'rotate-90 text-primary'}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleJumpToHeading(entry.id)}
                          title={entry.text}
                          className={`flex-1 text-left py-1.5 pr-2 text-[12px] font-bold leading-snug truncate transition-colors cursor-pointer ${
                            activeHeadingId === entry.id
                              ? 'text-primary font-extrabold'
                              : 'text-content'
                          }`}
                        >
                          {entry.text}
                        </button>
                      </div>
                    );
                  }

                  // Nagłówek 2 (H2) — podrzędny pod H1
                  if (entry.parentId && collapsedTocLessons[entry.parentId]) {
                    return null; // Ukryty, gdy nadrzędna lekcja H1 jest zwinięta w spisie treści
                  }

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleJumpToHeading(entry.id)}
                      title={entry.text}
                      className={`w-full text-left pl-6 pr-2 py-1.5 flex items-center gap-2 text-[11.5px] leading-snug rounded-md transition-all cursor-pointer ${
                        activeHeadingId === entry.id
                          ? 'text-primary font-bold bg-primary/15 border-l-2 border-primary'
                          : 'text-text-2 font-medium hover:text-content hover:bg-white/[0.05]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                          activeHeadingId === entry.id
                            ? 'bg-primary shadow-[0_0_8px_rgba(114,240,180,0.8)] scale-125'
                            : 'bg-line-strong'
                        }`}
                      />
                      <span className="truncate">{entry.text}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </aside>
        )}

        {/* ZAKŁADKA DO ROZWINIĘCIA SPISU TREŚCI */}
        {!isTocOpen && (
          <button
            type="button"
            onClick={() => setIsTocOpen(true)}
            className="absolute left-0 top-4 z-20 px-2 py-1.5 rounded-r-xl bg-base-200/90 hover:bg-base-200 border-r border-y border-line-strong text-content-muted hover:text-text-hi shadow-md flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer group"
            title="Pokaż spis treści"
          >
            <ListTree size={14} className="text-primary group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Konspekt</span>
          </button>
        )}

        {/* KANWA Z SYMETRYCZNIE WYŚRODKOWANĄ KARTKĄ A4 */}
        <div
          ref={paperWrapRef}
          onMouseMove={handleLaserMouseMove}
          onMouseLeave={handleLaserMouseLeave}
          className="pad-canvas flex-1 min-w-0 h-full overflow-y-auto p-3 sm:p-6 md:p-10 flex justify-center items-start relative"
        >
          <div
            className="relative mx-auto w-full flex flex-col items-center transition-all duration-300"
            style={{ maxWidth: activePageWidth }}
          >
            {/* Zdalny wskaźnik laserowy lektora widziany przez kursanta */}
            {docData.laserPointer?.active && (!isLaserOn || docData.laserPointer.user !== (currentUser?.name || 'Lektor')) && (
              <div
                className="pad-laser-remote"
                style={{
                  left: `${docData.laserPointer.xPercent}%`,
                  top: `${docData.laserPointer.yPercent}%`,
                }}
              >
                <div className="pad-laser-dot" />
                <div className="pad-laser-ring" />
                <div className="pad-laser-label">{docData.laserPointer.user || 'Lektor'}</div>
              </div>
            )}

            <div
              ref={editorRef}
              data-coach="pad-editor"
              data-pad-theme={paperTheme}
              contentEditable={!isReadOnly}
              onInput={handleInput}
              onClick={handlePaperClick}
              onPaste={handlePaste}
              suppressContentEditableWarning
              className={`pad-paper pad-sheet focus:outline-none transition-shadow font-sans selection:bg-primary/30 w-full relative ${
                isLandscape ? 'is-landscape' : ''
              } ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
              style={{
                wordBreak: 'break-word',
                boxShadow: 'var(--pad-shadow)',
                minHeight: activePageHeight,
                padding: `${PAGE_MARGIN_PX}px`,
                boxSizing: 'border-box',
              }}
            />

            {/* Zaznaczony obraz — pływający pasek zmiany rozmiaru i przesuwania */}
            {selectedImage && (
              <div className="sticky top-2 z-30 mb-2 flex justify-center animate-fadeIn">
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-ink-2/95 border border-line-strong shadow-2xl backdrop-blur-xl">
                  <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-text-faint">
                    Obraz
                  </span>
                  {[
                    { label: '25%', value: 0.25 },
                    { label: '50%', value: 0.5 },
                    { label: '75%', value: 0.75 },
                    { label: '100%', value: 1 },
                  ].map(step => (
                    <button
                      key={step.label}
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => resizeSelectedImage(step.value)}
                      className="h-7 px-2 rounded-lg text-[11px] font-bold text-text-2 hover:text-content hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      {step.label}
                    </button>
                  ))}
                  <span className="w-px h-5 bg-line-strong mx-0.5" aria-hidden />
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={moveSelectedImageUp}
                    title="Przesuń obraz wyżej w dokumencie"
                    className="h-7 px-2 rounded-lg text-[11px] font-bold text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <MoveUp size={12} />
                    <span className="hidden sm:inline">Wyżej</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={moveSelectedImageDown}
                    title="Przesuń obraz niżej w dokumencie"
                    className="h-7 px-2 rounded-lg text-[11px] font-bold text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <MoveDown size={12} />
                    <span className="hidden sm:inline">Niżej</span>
                  </button>
                  <span className="w-px h-5 bg-line-strong mx-0.5" aria-hidden />
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={removeSelectedImage}
                    title="Usuń zaznaczony obraz"
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-danger hover:bg-danger/15 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Wirtualne linie podziału stron A4 */}
            {pageMarkers.map((marker) => (
              <div
                key={marker.id}
                aria-hidden
                className="pad-page-rule"
                style={{ top: `${marker.topPx}px` }}
              >
                <span>{marker.label} ({pageOrientation === 'landscape' ? 'Pozioma' : 'Pionowa'})</span>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL ASYSTENTA AI W DOKUMENCIE (Dostępny wyłącznie dla lektora) */}
        {isTeacher && isAiChatOpen && (
          <aside className="w-80 sm:w-96 shrink-0 border-l border-line-strong pad-bar flex flex-col z-20 select-none animate-fadeIn bg-base-200/95 backdrop-blur-xl">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-line-soft bg-base-100/60 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <AIAssistantIcon size="xs" variant="badge" state={isAiGenerating ? 'thinking' : 'online'} glow={false} />
                <div>
                  <h4 className="text-xs font-bold text-text-hi flex items-center gap-1.5">
                    <span>Asystent Notatnika</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono font-normal">
                      Gemini 2.5
                    </span>
                  </h4>
                  <p className="text-[10px] text-content-muted truncate max-w-[170px]">
                    {docData.studentName ? `Kursant: ${docData.studentName}` : 'Analiza dokumentu na żywo'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {aiChatMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAiChatMessages([])}
                    title="Wyczyść historię czatu"
                    className="p-1.5 rounded-lg text-content-muted hover:text-text-hi hover:bg-white/[0.08] transition-colors cursor-pointer text-[10px]"
                  >
                    Wyczyść
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAiChatOpen(false)}
                  title="Zamknij asystenta"
                  className="p-1.5 rounded-lg text-content-muted hover:text-text-hi hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Quick Action Chips */}
            <div className="p-2.5 border-b border-line-soft bg-base-100/30 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleSendAiChat(
                    'Przeanalizuj dotychczasowe notatki w tym dokumencie i wyciągnij 3 kluczowe błędy lub trudności językowe kursanta, które warto przećwiczyć.'
                  )
                }
                disabled={isAiGenerating}
                className="px-2 py-1 rounded-lg bg-base-100/80 hover:bg-primary/15 border border-line-strong hover:border-primary/30 text-[11px] font-medium text-text-2 hover:text-primary transition-all cursor-pointer disabled:opacity-50"
              >
                🔍 Wyciągnij błędy z notatnika
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendAiChat(
                    'Zaproponuj 5 zdań do przetłumaczenia na następną lekcję (Revision Translation) w oparciu o słownictwo i konstrukcje z tego dokumentu.'
                  )
                }
                disabled={isAiGenerating}
                className="px-2 py-1 rounded-lg bg-base-100/80 hover:bg-primary/15 border border-line-strong hover:border-primary/30 text-[11px] font-medium text-text-2 hover:text-primary transition-all cursor-pointer disabled:opacity-50"
              >
                💡 5 zdań do powtórki (PL ➔ EN)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendAiChat(
                    'Stwórz zwięzły mini-quiz sprawdzający zrozumienie najtrudniejszych słówek z ostatnich lekcji z tego notatnika.'
                  )
                }
                disabled={isAiGenerating}
                className="px-2 py-1 rounded-lg bg-base-100/80 hover:bg-primary/15 border border-line-strong hover:border-primary/30 text-[11px] font-medium text-text-2 hover:text-primary transition-all cursor-pointer disabled:opacity-50"
              >
                📝 Mini-quiz ze słówek
              </button>
            </div>

            {/* Messages Body */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsAiDraggingOver(true);
              }}
              onDragLeave={() => setIsAiDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsAiDraggingOver(false);
                if (e.dataTransfer.files) {
                  processAiFiles(e.dataTransfer.files);
                }
              }}
              className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[14rem] relative ${
                isAiDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary rounded-xl' : ''
              }`}
            >
              {isAiDraggingOver && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-base-200/90 backdrop-blur-md rounded-xl text-center p-4">
                  <Paperclip size={24} className="text-primary animate-bounce mb-2" />
                  <span className="text-xs font-bold text-text-hi">Upuść pliki PDF, DOCX, obrazy lub notatki tutaj</span>
                  <span className="text-[10px] text-content-muted">Asystent przeanalizuje ich zawartość i przygotuje lekcję</span>
                </div>
              )}

              {aiChatMessages.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-2">
                  <AIAssistantIcon size="md" variant="avatar" state="idle" glow={true} className="mx-auto" />
                  <h5 className="text-xs font-bold text-text-hi">Inteligentny Asystent Notatnika</h5>
                  <p className="text-[11px] leading-relaxed text-content-muted">
                    Wklej notatki, załącz plik PDF / DOCX, screenshot lub wpisz polecenie, aby przeanalizować materiał i wstawić go bezpośrednio do notatnika.
                  </p>
                </div>
              ) : (
                aiChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl p-3 text-[12px] leading-relaxed relative group ${
                      msg.role === 'user'
                        ? 'bg-primary/15 border border-primary/30 text-text-hi ml-4'
                        : 'bg-base-100/85 border border-line-strong text-content mr-2'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 text-[10px] text-content-muted">
                      <span className="font-semibold">{msg.role === 'user' ? 'Ty' : 'Asystent AI'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {msg.attachments.map((att) => (
                          <span
                            key={att.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-base-100/80 border border-line text-[10px] font-mono text-primary"
                          >
                            <Paperclip size={10} />
                            <span className="truncate max-w-[130px]">{att.name}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap font-sans space-y-1">
                      {msg.text}
                    </div>

                    {msg.role === 'assistant' && (
                      <div className="mt-3 pt-2.5 border-t border-line-soft flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
                          <Layers size={11} className="text-primary" />
                          <span>Opcje wstawienia i formatowania:</span>
                        </div>

                        {/* Główny przycisk: Podgląd i zatwierdzenie formatowania 4 bloków */}
                        <button
                          type="button"
                          onClick={() => handleOpenInsertPreview(msg.text)}
                          title="Otwórz okno podglądu formatowania, edycji 4 bloków i zatwierdzenia"
                          className="w-full px-2.5 py-2 rounded-xl bg-primary text-accent-ink font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-btn hover:brightness-110"
                        >
                          <Sparkles size={13} />
                          <span>Podgląd i formatowanie (Zatwierdź)</span>
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleInsertAsStructuredLesson(msg.text)}
                            title="Wstaw jako nową lekcję (nagłówek, podział strony i 5 bloków lekcji)"
                            className="px-2 py-1.5 rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-accent-ink font-bold text-[10.5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Calendar size={12} className="shrink-0" />
                            <span className="truncate">Wstaw wg szablonu</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAppendAiMessageToDoc(msg.text)}
                            title="Dopisz tę treść na samym dole dokumentu"
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-hi hover:text-primary border border-line text-[10.5px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <PlusCircle size={12} className="shrink-0 text-primary" />
                            <span className="truncate">Dopisz na końcu</span>
                          </button>
                        </div>

                        {/* Wstawienie POD wybraną sekcję bieżącej (ostatniej) lekcji —
                            w odróżnieniu od „Wstaw wg szablonu”, które zakłada NOWĄ lekcję. */}
                        <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider pt-1">
                          Wstaw do sekcji bieżącej lekcji:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInsertIntoSection('Revision', msg.text)}
                            title="Wstaw pod sekcję Revision bieżącej lekcji"
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-hi hover:text-primary border border-line text-[10.5px] font-semibold transition-all cursor-pointer truncate"
                          >
                            Revision
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertIntoSection('Key Language', msg.text)}
                            title="Wstaw pod sekcję Key Language & Corrections bieżącej lekcji"
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-hi hover:text-primary border border-line text-[10.5px] font-semibold transition-all cursor-pointer truncate"
                          >
                            Key Language
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertIntoSection('Lesson Summary', msg.text)}
                            title="Wstaw pod sekcję Lesson Summary bieżącej lekcji"
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-hi hover:text-primary border border-line text-[10.5px] font-semibold transition-all cursor-pointer truncate"
                          >
                            Summary
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertIntoSection('Homework', msg.text)}
                            title="Wstaw pod sekcję Homework bieżącej lekcji"
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-hi hover:text-primary border border-line text-[10.5px] font-semibold transition-all cursor-pointer truncate"
                          >
                            Homework
                          </button>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-line-soft/60 text-[10px] text-content-muted">
                          <button
                            type="button"
                            onClick={() => handleInsertAiMessageToDoc(msg.text)}
                            className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <span>Wstaw w miejscu kursora</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyAiMessage(msg.id, msg.text)}
                            className="hover:text-text-hi transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Copy size={11} />
                            <span>{copiedAiMsgId === msg.id ? 'Skopiowano!' : 'Kopiuj'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {isAiGenerating && (
                <div className="rounded-2xl p-3 bg-base-100/85 border border-primary/30 text-content mr-2 flex items-center gap-2.5">
                  <Loader2 size={15} className="animate-spin text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium animate-pulse">
                    Analizuję materiały i generuję propozycję…
                  </span>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-line-strong bg-base-100/60 space-y-2">
              {/* Attached files preview */}
              {pendingAiAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1 max-h-24 overflow-y-auto">
                  {pendingAiAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-base-100 border border-primary/30 text-[11px] text-text-hi"
                    >
                      <Paperclip size={11} className="text-primary shrink-0" />
                      <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAiAttachments((prev) => prev.filter((a) => a.id !== att.id))
                        }
                        className="p-0.5 rounded text-content-muted hover:text-danger transition-colors cursor-pointer"
                        title="Usuń załącznik"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={aiFileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt,.md,.markdown,.html"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    processAiFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              <div className="relative flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => aiFileInputRef.current?.click()}
                  disabled={isAiGenerating}
                  className="p-2 rounded-xl border border-line-strong bg-base-100 hover:border-primary/40 text-content-muted hover:text-primary transition-all cursor-pointer shrink-0"
                  title="Załącz plik (PDF, screenshot, notatki tekstowe)"
                >
                  <Paperclip size={15} />
                </button>

                <div className="relative flex-1 flex items-center">
                  <textarea
                    value={aiChatDraft}
                    onChange={(e) => setAiChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAiChat();
                      }
                    }}
                    rows={2}
                    placeholder="Wklej notatki lub zapytaj asystenta..."
                    disabled={isAiGenerating}
                    className="w-full bg-base-100/90 border border-line-strong focus:border-primary rounded-xl px-3 py-2 pr-10 text-[12px] text-text-hi placeholder-content-muted outline-none resize-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendAiChat()}
                    disabled={isAiGenerating || (!aiChatDraft.trim() && pendingAiAttachments.length === 0)}
                    className="absolute right-2 p-2 rounded-lg bg-primary text-accent-ink hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer shadow-btn"
                    title="Wyślij (Enter)"
                  >
                    {isAiGenerating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-center text-content-muted">
                Obsługa załączników PDF/obrazów • Shift + Enter dla nowej linii
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* 4. DYSKRETNA STOPKA DOKUMENTU */}
      <footer className="px-4 py-2 pad-bar border-t border-line-strong flex items-center justify-between text-[11px] text-content-muted gap-3 flex-wrap select-none">
        <div className="flex items-center gap-3">
          <span>Słowa: <strong className="text-text-hi">{wordCount}</strong></span>
          <span>•</span>
          <span>Strony: <strong className="text-text-hi">{pageCount}</strong></span>
          <span>•</span>
          <span>Układ: <strong className="text-text-hi">{pageOrientation === 'landscape' ? 'Poziomy A4' : 'Pionowy A4'}</strong></span>
          <span>•</span>
          {contentBytes > SCRATCHPAD_MAX_CONTENT_BYTES / 2 && (
            <>
              <span
                className={
                  contentBytes > SCRATCHPAD_MAX_CONTENT_BYTES * 0.85 ? 'text-warn font-bold' : ''
                }
                title="Dokument ma limit rozmiaru — liczą się głównie wklejone obrazy."
              >
                Rozmiar: {Math.round(contentBytes / 1024)} / {Math.round(SCRATCHPAD_MAX_CONTENT_BYTES / 1024)} kB
              </span>
              <span>•</span>
            </>
          )}
          <span>Wersja: #{docData.version}</span>
          {docData.lastEditedBy && (
            <>
              <span>•</span>
              <span>
                Ostatnia edycja: <strong className="text-text-hi">{docData.lastEditedBy.name}</strong> ({docData.lastEditedBy.role === 'teacher' ? 'Lektor' : 'Kursant'})
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

      {/* Samouczek */}
      <CoachMarks
        steps={coachSteps}
        isOpen={isCoachOpen}
        onClose={() => {
          setIsCoachOpen(false);
          setIsStyleMenuOpen(false);
          setIsInsertMenuOpen(false);
          setIsShareMenuOpen(false);
        }}
        title="Samouczek notatnika"
      />

      {/* Modal zarządzania szablonami */}
      {isTeacher && (
        <ScratchpadTemplateManagerModal
          isOpen={isTemplateManagerOpen}
          onClose={() => setIsTemplateManagerOpen(false)}
          currentUser={{ uid: currentUser?.uid || 'teacher', name: currentUser?.name || 'Lektor' }}
          currentContentHtml={docData.contentHtml}
          onTemplatesChanged={refreshTemplates}
        />
      )}

      {/* Modal wyboru aktywności do prezentacji live */}
      {isTeacher && (
        <ScratchpadLivePresentationModal
          isOpen={isLivePresentationModalOpen}
          onClose={() => setIsLivePresentationModalOpen(false)}
          onStartPresentation={handleStartPresentation}
        />
      )}

      {/* Pomocnik lektora: Drawer ze scenariuszem i prywatnymi Side Notes */}
      {isTeacher && (
        <ScratchpadTeacherCompanionDrawer
          isOpen={isScenarioDrawerOpen}
          onClose={() => setIsScenarioDrawerOpen(false)}
          docData={docData}
          onLaunchExercise={handleLaunchExerciseFromScenario}
          onLaunchWheelOfFortune={handleLaunchWheelOfFortune}
          onTriggerAiSummary={handleTriggerAiFromNotes}
        />
      )}

      {/* Nakładka prezentacji live (widoczna u lektora i kursanta, gdy jest aktywna) */}
      {docData.presentationState?.active && (
        <ScratchpadPresentationOverlay
          presentation={docData.presentationState}
          isTeacher={isTeacher}
          studentName={docData.studentName}
          lessonRecords={studentLessons}
          onClose={handleStopPresentation}
          onRevealAnswer={() => docData.id && revealScratchpadExerciseAnswer(docData.id)}
          onSubmitAnswer={(ans) => docData.id && submitStudentExerciseAnswer(docData.id, ans)}
          onUpdatePresentation={(updates) => {
            if (docData.id && docData.presentationState) {
              updateScratchpadPresentation(docData.id, {
                ...docData.presentationState,
                ...updates,
              });
            }
          }}
          onAddToNotes={(text) => {
            const snippet = `<p><strong>🎯 Rozgrzewka (Koło Fortuny):</strong> ${text}</p>`;
            handleInsertTemplate(snippet);
          }}
        />
      )}

      {/* Modal zatwierdzania i podglądu formatowania lekcji z asystenta AI */}
      <ScratchpadInsertPreviewModal
        isOpen={insertPreviewState.isOpen}
        onClose={() => setInsertPreviewState({ isOpen: false, content: {} })}
        initialContent={insertPreviewState.content}
        onConfirmInsert={handleConfirmInsertFromModal}
      />
    </div>
  );
};

export default ScratchpadEditor;

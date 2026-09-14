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
  ChevronsDownUp,
  Sun,
  Moon,
  Image as ImageIcon,
  Flashlight,
  LayoutTemplate,
} from 'lucide-react';
import { ScratchpadDocument, ScratchpadTemplate } from '../../types';
import {
  buildScratchpadUrl,
  scratchpadContentBytes,
  SCRATCHPAD_MAX_CONTENT_BYTES,
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
import Button from '../ui/Button';
import MenuDropdown, { MenuChevron } from '../ui/MenuDropdown';
import CoachMarks from '../ui/CoachMarks';
import { buildScratchpadCoachSteps } from './scratchpadCoachSteps';
import ScratchpadTemplateManagerModal from './ScratchpadTemplateManagerModal';
import { buildLessonTemplate, LESSON_SECTIONS } from '../../utils/lessonTemplate';
import { NOTEBOOK_COLORS, NOTEBOOK_INK, NOTEBOOK_SWATCHES } from '../../utils/notebookPalette';

/**
 * Wysokość strony A4 przy 96 dpi (297 mm) minus margines dolny, w pikselach.
 * Kartka jest jednym ciągłym polem edycji — kreski podziału rysuje warstwa nad
 * nią, co `PAGE_HEIGHT_PX` pikseli. Wartość jest przybliżeniem: dokument i tak
 * nie jest drukowany z tego widoku, a chodzi o poczucie długości („to już
 * trzecia strona"), nie o zgodność co do milimetra.
 */
const PAGE_HEIGHT_PX = 1123;

/**
 * Szerokość arkusza A4 przy 96 dpi (210 mm). Kartka ma tyle DOKŁADNIE, a nie
 * „mniej więcej tyle, co kolumna tekstu": dokument, który ma się drukować
 * i eksportować do PDF-a, musi mieć proporcje kartki już na ekranie —
 * inaczej lektor układa akapity w innej szerokości, niż potem wyjdą.
 */
const PAGE_WIDTH_PX = 794;

/** Margines dokumentu — 2 cm, czyli standard Worda i Google Docs. */
const PAGE_MARGIN_PX = 76;

/** Pozycja w spisie treści — jeden nagłówek kartki. */
interface TocEntry {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  collapsed: boolean;
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  /** Komunikat po wysłaniu do Google Docs — znika sam po kilku sekundach. */
  const [googleDocsHint, setGoogleDocsHint] = useState<'copied' | 'manual' | null>(null);
  /** Wskaźnik laserowy — światełko przy kursorze do prowadzenia wzroku kursanta. */
  const [isLaserOn, setIsLaserOn] = useState(false);
  /** Obraz zaznaczony kliknięciem — do zmiany rozmiaru. */
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  /** Komunikat o wklejonym obrazie (za duży, nie wszedł). */
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  /** Ile zajmuje dokument — licznik w stopce, ostrzeżenie przed limitem. */
  const [contentBytes, setContentBytes] = useState(0);

  /* Spis treści, podział na strony i motyw kartki — patrz komentarze przy
     `rebuildToc`, `pageRules` i przełączniku motywu w nagłówku. */
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [paperTheme, setPaperTheme] = useState<'light' | 'dark'>(() => {
    try {
      return window.localStorage.getItem('scratchpad_paper_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const paperWrapRef = useRef<HTMLDivElement>(null);
  const structureTimeoutRef = useRef<any>(null);
  const measurePagesRef = useRef<(() => void) | null>(null);
  /** Podpis ostatnio zbudowanego spisu — patrz `rebuildToc`. */
  const tocSignatureRef = useRef<string>('');

  const [templates, setTemplates] = useState<ScratchpadTemplate[]>([]);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);

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

     Wszystkie trzy czytają z JEDNEGO źródła — z HTML-a leżącego w polu
     edycji. Notatnik nie ma modelu dokumentu (treść to `innerHTML`
     zapisywany w Firestore), więc dokładanie równoległej struktury
     w Reakcie znaczyłoby utrzymywanie dwóch prawd o tym samym tekście.
     Zamiast tego po każdej zmianie przechodzimy po nagłówkach i budujemy
     spis od zera; to setki elementów, nie tysiące, więc koszt jest niższy
     niż koszt rozjechania się dwóch struktur.
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
    const headings = Array.from(root.querySelectorAll('h1, h2, h3')) as HTMLElement[];
    const entries: TocEntry[] = headings.map((heading, index) => {
      const id = ensureHeadingId(heading, index);
      const level = Number(heading.tagName.charAt(1)) as 1 | 2 | 3;
      // Strzałka zwijania jest dzieckiem nagłówka, więc `textContent` wciągnąłby
      // jej znak do tytułu rozdziału.
      const clone = heading.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.pad-toggle').forEach(el => el.remove());
      return {
        id,
        level,
        text: (clone.textContent || '').trim() || 'Bez tytułu',
        collapsed: heading.getAttribute('data-collapsed') === '1',
      };
    });

    /* Bez tego porównania spis przebudowywał się przy KAŻDYM naciśnięciu
       klawisza: `setToc` z nową tablicą to nowa referencja, czyli przerysowanie
       całego edytora — przy dłuższym dokumencie widać to jako zacinanie się
       przewijania w trakcie pisania. Struktura dokumentu zmienia się raz na
       kilkadziesiąt znaków, więc porównanie podpisu odcina 99% tych przebudów. */
    const signature = entries.map(e => `${e.level}|${e.id}|${e.text}|${e.collapsed}`).join('\n');
    if (signature === tocSignatureRef.current) return;
    tocSignatureRef.current = signature;
    setToc(entries);
  }, []);

  /**
   * Odświeżenie spisu i liczby stron — ZAWSZE przez ten uchwyt, nigdy wprost
   * z `handleInput`.
   *
   * Obie operacje chodzą po DOM-ie kartki. Wołane przy każdym znaku robiły
   * z pisania serię pełnych przerysowań edytora, a to widać wprost: kursor
   * zostaje w tyle za klawiaturą, a przewijanie szarpie. 250 ms to próg,
   * poniżej którego człowiek i tak nie zauważy, że spis doszedł chwilę po
   * literze — a powyżej którego zaczyna się zastanawiać, czy doszedł w ogóle.
   */
  const scheduleStructureRefresh = useCallback(() => {
    if (structureTimeoutRef.current) clearTimeout(structureTimeoutRef.current);
    structureTimeoutRef.current = setTimeout(() => {
      rebuildToc();
      measurePagesRef.current?.();
    }, 250);
  }, [rebuildToc]);

  /** Liczba stron = wysokość kartki podzielona przez wysokość A4. */
  const measurePages = useCallback(() => {
    const paper = editorRef.current;
    if (!paper) return;
    setPageCount(Math.max(1, Math.ceil(paper.offsetHeight / PAGE_HEIGHT_PX)));
  }, []);

  measurePagesRef.current = measurePages;

  useEffect(() => () => {
    if (structureTimeoutRef.current) clearTimeout(structureTimeoutRef.current);
  }, []);

  // Kartka rośnie przy pisaniu, a nie tylko przy zapisie — `ResizeObserver`
  // łapie też wklejenie, zwinięcie rozdziału i zmianę szerokości okna.
  useEffect(() => {
    const paper = editorRef.current;
    if (!paper || typeof ResizeObserver === 'undefined') return;
    // Obserwator odpala się przy każdym wierszu, który zmienia wysokość
    // kartki — czyli w trakcie pisania stale. `requestAnimationFrame` scala
    // te wywołania do jednego na klatkę.
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
   * Zwinięcie rozdziału: chowamy wszystko od nagłówka do następnego nagłówka
   * tego samego lub wyższego stopnia. Stan zapisuje się w atrybutach i w stylu
   * elementów, czyli w samym HTML-u dokumentu — dzięki temu przeżywa zapis
   * i widzi go druga osoba po drugiej stronie linku.
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

  /** Kliknięcie strzałki w nagłówku — delegacja z całej kartki. */
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
   * Zamiana bloku z kursorem w nagłówek zwijany (i z powrotem).
   *
   * Nie ma tu `execCommand`: przełącznik działa na nagłówku, w którym stoi
   * kursor, i jedyne, co zmienia, to obecność strzałki. Jeżeli kursor stoi
   * w zwykłym akapicie, blok najpierw staje się nagłówkiem drugiego stopnia —
   * „zwijany akapit" nie znaczyłby nic.
   */
  const handleToggleHeading = () => {
    if (isReadOnly || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.getRangeAt(0).startContainer as HTMLElement | null;
    if (node && node.nodeType === 3) node = node.parentElement;
    let heading = node?.closest?.('h1, h2, h3') as HTMLElement | null;

    if (!heading) {
      window.document.execCommand('formatBlock', false, '<h2>');
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

  /** Zwinięcie albo rozwinięcie wszystkich rozdziałów zwijanych naraz. */
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

  /** Przejście do rozdziału ze spisu treści. */
  const handleJumpToHeading = (id: string) => {
    const heading = editorRef.current?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
    if (!heading) return;
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeadingId(id);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem('scratchpad_paper_theme', paperTheme);
    } catch {
      /* tryb prywatny przeglądarki — motyw zostaje na czas tej sesji */
    }
    /* Osobna strona notatnika przebiera CAŁE okno pod motyw kartki — jasna
       kartka w ciemnym oknie to dwa różne programy na jednym ekranie. Zdarzenie
       zamiast propsa, bo edytor jest używany w kilku miejscach i tylko jedno
       z nich (`ScratchpadPage`) ma prawo ruszać motyw całej strony. */
    window.dispatchEvent(new CustomEvent('scratchpad-paper-theme', { detail: paperTheme }));
  }, [paperTheme]);

  // Inicjalizacja lub aktualizacja zawartości z zewnątrz
  useEffect(() => {
    if (!editorRef.current) return;

    // Aktualizuj tylko, gdy użytkownik aktualnie sam nie pisze
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
     OBRAZY, WSKAŹNIK LASEROWY I ROZMIAR DOKUMENTU
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Wklejenie obrazu ze schowka — zrzut ekranu, wycinek, zdjęcie tablicy.
   *
   * Obraz jest zmniejszany i przekodowywany PRZED wstawieniem (patrz
   * `utils/scratchpadImages.ts`), a potem sprawdzany wobec limitu dokumentu.
   * Odmowa pada TU, zanim obraz wejdzie do treści: wklejony i dopiero potem
   * odrzucony przy zapisie znaczyłby notatnik, który wygląda dobrze i cicho
   * przestał się zapisywać.
   */
  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    const file = imageFromClipboard(event.clipboardData);
    if (!file) return;

    event.preventDefault();
    setImageNotice('Przygotowuję obraz…');

    try {
      const paperWidth = editorRef.current
        ? Math.max(280, editorRef.current.clientWidth - PAGE_MARGIN_PX * 2)
        : PAGE_WIDTH_PX - PAGE_MARGIN_PX * 2;
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
        `<img class="pad-img" src="${prepared.dataUrl}" style="width:${prepared.width}px" alt="" />`
      );
      setImageNotice(null);
      handleInput();
    } catch (error: any) {
      console.error('[Notatnik] Wklejenie obrazu nie powiodło się:', error);
      setImageNotice(error?.message || 'Nie udało się wkleić obrazu.');
    }
  };

  /**
   * Zmiana rozmiaru wklejonego obrazu.
   *
   * Uchwyt do ciągnięcia w `contentEditable` jest zawodny: przeglądarka
   * przechwytuje przeciąganie obrazu jako przenoszenie go w tekście, więc
   * połowa pociągnięć kończy się przeniesieniem obrazu zamiast zmianą
   * rozmiaru. Dlatego zamiast uchwytu są cztery ustalone szerokości — to jest
   * decyzja, którą podejmuje się raz na obraz i nie wymaga precyzji.
   */
  const resizeSelectedImage = (fraction: number) => {
    if (!selectedImage || !editorRef.current) return;
    const paperWidth = Math.max(280, editorRef.current.clientWidth - PAGE_MARGIN_PX * 2);
    selectedImage.style.width = `${Math.round(paperWidth * fraction)}px`;
    selectedImage.style.height = 'auto';
    handleInput();
  };

  const removeSelectedImage = () => {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    handleInput();
  };

  /** Światełko przy kursorze — tylko nad kartką i tylko przy włączonym laserze. */
  useEffect(() => {
    if (!isLaserOn) return;
    const dot = window.document.createElement('div');
    dot.className = 'pad-laser';
    window.document.body.appendChild(dot);

    const move = (event: MouseEvent) => {
      dot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    };
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      dot.remove();
    };
  }, [isLaserOn]);

  const handleInput = () => {
    if (!editorRef.current || isReadOnly) return;

    isUserTypingRef.current = true;
    if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current);
    typingResetTimeoutRef.current = setTimeout(() => {
      isUserTypingRef.current = false;
    }, 1500);

    // Zaznaczenie obrazu jest stanem interfejsu, nie treścią dokumentu —
    // gdyby weszło do zapisu, kursant zobaczyłby obrys wokół obrazu, którego
    // nie zaznaczał.
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

  const handleFormatBlock = (tag: string) => {
    if (isReadOnly) return;
    window.document.execCommand('formatBlock', false, `<${tag}>`);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  /**
   * Nowa lekcja w notatniku — nagłówek z NUMEREM i pięć pustych sekcji.
   *
   * Numer liczy się z dotychczasowych nagłówków dokumentu (patrz
   * `utils/lessonTemplate.ts`), więc nikt go nie musi pamiętać; poprawiony
   * ręcznie zostaje wzięty pod uwagę przy następnym wstawieniu.
   *
   * Wstawiamy NA KOŃCU dokumentu, a nie w miejscu kursora: nowa lekcja zawsze
   * dopisuje się pod poprzednimi, a kursor po godzinie pisania stoi gdzie
   * popadnie — najczęściej w środku zeszłotygodniowej notatki.
   */
  const handleInsertLesson = () => {
    if (isReadOnly || !editorRef.current) return;

    const html = buildLessonTemplate({ previousHtml: editorRef.current.innerHTML });
    editorRef.current.insertAdjacentHTML('beforeend', `<p><br></p>${html}`);

    // Kursor ląduje w pierwszej sekcji nowej lekcji — tam zaczyna się pisanie.
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
  };

  // Wstawienie zapisanego szablonu lektora (kolekcja `scratchpadTemplates`)
  const handleInsertTemplate = (html: string) => {
    if (isReadOnly) return;
    window.document.execCommand('insertHTML', false, html);
    handleInput();
  };

  // Lista szablonów widzi wyłącznie lektor/admin — reguła `isAdmin()` na
  // `scratchpadTemplates` odmówi kursantowi nawet próby odczytu, więc nie ma
  // sensu jej wołać poza rolą lektora.
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

  // Szybkie kolorowanie pod błędy / poprawki
  /**
   * Zakreślenie fragmentu.
   *
   * Kolor tła i tekstu ląduje W TREŚCI dokumentu (styl na `span`), więc motyw
   * nie ma jak go potem przestawić — obowiązuje ta sama zasada, co dla całej
   * palety notatnika (`utils/notebookPalette.ts`): jedna wartość ma być
   * czytelna na jasnym papierze I na ciemnej kartce. Poprzednie pastele
   * (#fca5a5, #6ee7b7, #fcd34d) były dobrane pod ciemną kartkę i na jasnym
   * papierze ginęły w tle zakreślenia.
   */
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

  // Wstawienie linku — `execCommand('createLink', ...)` wymaga zaznaczenia;
  // bez niego wstawiamy sam adres jako klikalny tekst, żeby przycisk nie
  // robił po cichu nic.
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

  // Lista zadań — zwykły checkbox HTML, natywnie klikalny nawet w
  // contentEditable. Bez śledzenia stanu w Reakcie (dokument to tylko HTML).
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
  //
  // PIN trafia do linku zawsze, nie tylko gdy `requirePin` jest włączone: ID
  // dokumentu jest już "sekretem" samym w sobie (`allow get: if true` w
  // firestore.rules — link niewidzialny), więc PIN w URL nie osłabia niczego,
  // a bez niego przycisk "Kopiuj link" dawał martwy PIN — kursant musiałby
  // wpisywać go ręcznie mimo posiadania linku jednym kliknięciem.
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
      summary: generalLines.slice(0, 5).join('\n') || `Notatki ze wspólnego notatnika z dnia ${todayStr}`,
      thingsToImprove: correctionLines.join('\n'),
      followUp: 'Utrwalenie słownictwa i poprawek z notatnika lekcyjnego.',
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
    /* Obudowa notatnika to ta sama szyba, co kafelki panelu: półprzezroczysta
       tafla z rozmyciem i linią światła na górnej krawędzi. Wcześniej była
       zwykłym, nieprzezroczystym prostokątem — jedynym takim elementem
       w aplikacji, przez co wyglądała na doklejoną z innego programu. */
    <div className={`pad-shell flex flex-col overflow-hidden ${standalone ? 'is-standalone' : ''} ${className}`}>
      {/* 1. NAGŁÓWEK DOKUMENTU
          Tożsamość po lewej, jedna akcja końcowa i jedno menu dostępu po prawej.
          Kod PIN i przełączniki uprawnień zeszły do menu — na ekranie zostaje
          to, czego lektor używa w trakcie pisania. */}
      <header className="px-4 py-3 pad-bar border-b border-line-strong flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0" data-coach="pad-identity">
          <div className="p-2 rounded-xl bg-accent/12 text-accent border border-accent/25 shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-hi truncate flex items-center gap-2">
              <span>{docData.title || 'Notatnik'}</span>
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

          {/* Eksport widoczny i dla lektora, i dla kursanta — obaj mogą chcieć
              zachować kopię notatnika poza aplikacją. */}
          <MenuDropdown
            open={isExportMenuOpen}
            onOpenChange={setIsExportMenuOpen}
            width={280}
            align="end"
            aria-label="Eksport notatnika"
            triggerTitle="Zapisz notatnik jako plik"
            triggerClassName={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              isExportMenuOpen
                ? 'bg-white/[0.08] border-line-strong text-content'
                : 'bg-white/[0.04] border-line-strong text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
            trigger={
              <>
                <Download size={14} />
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
                    description: 'Kopiuje notatnik i otwiera nowy dokument — wklej Ctrl+V',
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
                    label: 'Eksportuj do PDF',
                    icon: <FileDown size={14} />,
                    onSelect: () => exportScratchpadToPDF(docData.title, docData.contentHtml),
                  },
                  {
                    id: 'export-word',
                    label: 'Eksportuj do Worda',
                    description: 'Otwiera się też w Google Docs',
                    icon: <FileType2 size={14} />,
                    onSelect: () => exportScratchpadToWord(docData.title, docData.contentHtml),
                  },
                ],
              },
            ]}
          />

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

          {/* Motyw KARTKI, nie aplikacji. Dwa osobne ustawienia, bo to dwie
              różne rzeczy: okno jest narzędziem, kartka jest dokumentem —
              i ludzie chcą ciemnego narzędzia z jasnym dokumentem równie
              często, jak ciemnego jednego i drugiego. Domyślnie jasna. */}
          {/* Wskaźnik laserowy — do prowadzenia wzroku kursanta po dokumencie
              w trakcie rozmowy. To jest jedyne narzędzie prezentacyjne, jakiego
              notatnik potrzebuje: kursor i tak tam jest, chodzi tylko o to,
              żeby było go widać na drugim końcu połączenia. */}
          <button
            type="button"
            onClick={() => setIsLaserOn(v => !v)}
            title={isLaserOn ? 'Wyłącz wskaźnik laserowy' : 'Wskaźnik laserowy przy kursorze'}
            aria-pressed={isLaserOn}
            className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              isLaserOn
                ? 'border-danger/50 bg-danger/15 text-danger'
                : 'border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08]'
            }`}
          >
            <Flashlight size={15} />
          </button>

          <button
            type="button"
            onClick={() => setPaperTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
            title={paperTheme === 'light' ? 'Ciemna kartka' : 'Jasna kartka'}
            aria-label={paperTheme === 'light' ? 'Przełącz kartkę na ciemną' : 'Przełącz kartkę na jasną'}
            className="h-9 w-9 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            {paperTheme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setIsCoachOpen(true)}
            title="Samouczek — dymki opisujące każdą funkcję notatnika"
            aria-label="Samouczek"
            className="h-9 w-9 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <GraduationCap size={15} />
          </button>

          {/* Zamknięcie siedzi w pasku nagłówka, a nie pływa nad nim — pływający
              krzyżyk nachodził na przyciski udostępniania. */}
          {onClose && (
            <>
              <div className="w-px h-6 bg-line-strong mx-0.5" aria-hidden />
              <button
                type="button"
                onClick={onClose}
                title="Zamknij notatnik"
                aria-label="Zamknij notatnik"
                className="h-9 w-9 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {googleDocsHint && (
        <div className="px-4 py-2.5 bg-primary/[0.08] border-b border-primary/25 flex items-center gap-2.5 text-xs">
          <ExternalLink size={14} className="text-primary shrink-0" />
          <span className="text-content">
            {googleDocsHint === 'copied'
              ? 'Notatnik jest w schowku, a nowy dokument Google otworzył się w drugiej karcie — wklej go tam (Ctrl+V / ⌘V). Formatowanie przechodzi razem z treścią.'
              : 'Przeglądarka nie wpuściła treści do schowka. Nowy dokument Google jest otwarty — użyj „Eksportuj do Worda" i wgraj plik na Dysk.'}
          </span>
        </div>
      )}

      {imageNotice && (
        <div className="px-4 py-2.5 bg-warn/[0.1] border-b border-warn/30 flex items-start gap-2.5 text-xs">
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

      {/* Notatnik, który nie dotarł do chmury, wygląda u lektora normalnie —
          treść siedzi w pamięci przeglądarki. Kursant po drugiej stronie linku
          zobaczy pustkę, więc ostrzeżenie musi paść tutaj, zanim lektor wyśle
          link, a nie dopiero w konsoli. */}
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

      {/* 2. PASEK FORMATOWANIA
          Widoczne zostaje to, po co sięga się w trakcie notowania: pogrubienie,
          trzy zakreślacze lektorskie i lista. Nagłówki, pozostałe style oraz
          wstawki lekcyjne schowane są w dwóch menu. */}
      {!isReadOnly && (
        <div className="px-3 py-2 pad-bar border-b border-line-strong flex items-center gap-1.5 flex-wrap select-none sticky top-0 z-30">
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
                  {
                    id: 'toggle-heading',
                    label: 'Nagłówek zwijany',
                    description: 'Chowa cały rozdział pod strzałką',
                    icon: <ChevronRight size={14} />,
                    onSelect: handleToggleHeading,
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

          <FormatButton
            icon={<AlignLeft size={15} />}
            title="Wyrównaj do lewej"
            onClick={() => execCmd('justifyLeft')}
          />
          <FormatButton
            icon={<AlignCenter size={15} />}
            title="Wyśrodkuj"
            onClick={() => execCmd('justifyCenter')}
          />
          <FormatButton
            icon={<AlignRight size={15} />}
            title="Wyrównaj do prawej"
            onClick={() => execCmd('justifyRight')}
          />

          <div className="w-px h-5 bg-line-strong" aria-hidden />

          {/* Kolor tekstu — paleta zamknięta (6 kolorów), nie swobodny
              wybór: to notatnik lekcyjny, nie edytor grafiki. */}
          <div className="flex items-center gap-1" data-coach="pad-color" title="Kolor tekstu">
            <Palette size={14} className="text-text-2 mx-0.5" />
            {[{ name: 'Domyślny', value: 'inherit' }, ...NOTEBOOK_SWATCHES].map(swatch => (
              <button
                key={swatch.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                /* „Domyślny" musi trafiać w kolor tekstu AKTUALNEJ kartki —
                   `execCommand` wpisuje wartość wprost w styl, więc grafit
                   wstawiony na jasnej kartce znikałby po przełączeniu na ciemną. */
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
                className="h-5 w-5 rounded-full border border-line-strong cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: swatch.value === 'inherit' ? 'transparent' : swatch.value }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-line-strong" aria-hidden />

          {/* Zakreślacze zostają na wierzchu — to one odróżniają brudnopis
              lektorski od zwykłego edytora i używa się ich co kilka zdań. */}
          <div className="flex items-center gap-1" data-coach="pad-highlighters">
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleHighlight('rgba(209, 84, 76, 0.22)', NOTEBOOK_COLORS.red)}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors cursor-pointer"
              title="Zaznacz fragment jako błąd kursanta"
            >
              ❌ Błąd
            </button>
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleHighlight('rgba(23, 145, 122, 0.22)', NOTEBOOK_COLORS.green)}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-accent/12 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
              title="Zaznacz fragment jako poprawną formę"
            >
              ✅ Poprawnie
            </button>
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleHighlight('rgba(192, 106, 38, 0.22)', NOTEBOOK_COLORS.orange)}
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
                    id: 'lesson',
                    label: 'Nowa lekcja',
                    description: 'Numer, data i pięć sekcji — na końcu dokumentu',
                    icon: <Calendar size={14} />,
                    onSelect: handleInsertLesson,
                  },
                ],
              },
              // Szablony widzi i wstawia wyłącznie lektor/admin — kursant nigdy
              // nie wybiera szablonu sam (patrz `scratchpadTemplates` w
              // firestore.rules), więc dla niego ta sekcja po prostu nie istnieje.
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
                label: 'Struktura',
                items: [
                  {
                    id: 'ol',
                    label: 'Lista numerowana',
                    icon: <ListOrdered size={14} />,
                    onSelect: () => execCmd('insertOrderedList'),
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

          {/* SZABLON JEDNYM DOTKNIĘCIEM.

              Szablon jest pierwszą rzeczą, którą lektor robi na każdej lekcji —
              wstawia rusztowanie i zaczyna pisać. Siedział w menu „Wstaw",
              trzy kliknięcia głębiej, obok listy numerowanej i linii poziomej,
              czyli rzeczy używanych raz na kilka dni. Przy jednym szablonie
              przycisk wstawia go od razu; przy kilku pyta który. */}
          {isTeacher && templates.length > 0 && (
            templates.length === 1 ? (
              <FormatButton
                icon={<LayoutTemplate size={15} />}
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
                triggerClassName={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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

          <FormatButton
            icon={<Calendar size={15} />}
            title="Nowa lekcja — nagłówek z numerem i pięć sekcji"
            onClick={handleInsertLesson}
          />

          <FormatButton
            icon={<ListTree size={15} />}
            title={isTocOpen ? 'Ukryj spis treści' : 'Pokaż spis treści'}
            onClick={() => setIsTocOpen(v => !v)}
          />
          <FormatButton
            icon={<ChevronsDownUp size={15} />}
            title="Zwiń wszystkie rozdziały zwijane"
            onClick={() => handleCollapseAll(true)}
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

      {/* 3. SPIS TREŚCI + KARTKA DOKUMENTU

          ══ SPIS TREŚCI ══

          Powstaje z nagłówków kartki, tak jak w Google Docs: każdy H1 to
          rozdział, H2 i H3 to podrozdziały pod nim. Nie ma osobnego miejsca,
          w którym się go redaguje — struktura dokumentu JEST spisem treści,
          więc dwie listy do utrzymania byłyby dwiema prawdami o tym samym.

          Na telefonie spis kładzie się nad kartką jako niski, przewijalny
          pasek; na komputerze stoi kolumną z lewej. Ta sama treść i ten sam
          kod — różni się tylko kierunek układu.

          ══ KARTKA ══

          Kartka ma własny motyw (jasny domyślnie), niezależny od motywu
          aplikacji — uzasadnienie przy `.pad-paper` w index.css. Kolory
          i typografia są w arkuszu stylów, a nie w klasach narzędziowych,
          bo treść to HTML pisany przez lektora: nagłówków i list powstałych
          z `execCommand` nie da się oklasować. */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {isTocOpen && (
          <aside className="shrink-0 w-full md:w-60 max-h-40 md:max-h-none overflow-y-auto border-b md:border-b-0 md:border-r border-line-strong pad-bar">
            <div className="px-3 py-2.5 flex items-center justify-between gap-2 sticky top-0 pad-bar backdrop-blur-md border-b border-line-soft">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-faint">
                Spis treści
              </span>
              <button
                type="button"
                onClick={() => handleCollapseAll(false)}
                title="Rozwiń wszystkie rozdziały"
                className="text-[10px] font-semibold text-text-2 hover:text-content transition-colors cursor-pointer"
              >
                Rozwiń
              </button>
            </div>
            {toc.length === 0 ? (
              <p className="px-3 py-4 text-[11px] leading-relaxed text-text-faint">
                Spis treści zbuduje się sam z nagłówków. Zaznacz tekst i wybierz
                „Styl → Nagłówek 1/2/3".
              </p>
            ) : (
              <nav className="py-1.5">
                {toc.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleJumpToHeading(entry.id)}
                    title={entry.text}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-[11.5px] leading-snug transition-colors cursor-pointer hover:bg-white/[0.06] ${
                      activeHeadingId === entry.id
                        ? 'text-accent font-semibold'
                        : entry.level === 1
                        ? 'text-content font-semibold'
                        : entry.level === 2
                        ? 'text-text-2'
                        : 'text-text-faint'
                    }`}
                    style={{ paddingLeft: `${12 + (entry.level - 1) * 14}px` }}
                  >
                    {entry.collapsed && <ChevronRight size={11} className="shrink-0 opacity-60" />}
                    <span className="truncate">{entry.text}</span>
                  </button>
                ))}
              </nav>
            )}
          </aside>
        )}

        <div
          ref={paperWrapRef}
          className="pad-canvas flex-1 min-w-0 p-4 md:p-8 md:pt-10 overflow-y-auto min-h-[500px]"
        >
          <div className="relative mx-auto" style={{ width: PAGE_WIDTH_PX, maxWidth: '100%' }}>
            <div
              ref={editorRef}
              data-coach="pad-editor"
              data-pad-theme={paperTheme}
              contentEditable={!isReadOnly}
              onInput={handleInput}
              onClick={handlePaperClick}
              onPaste={handlePaste}
              suppressContentEditableWarning
              className={`pad-paper pad-sheet focus:outline-none transition-shadow font-sans selection:bg-primary/30 ${
                isReadOnly ? 'cursor-default' : 'cursor-text'
              }`}
              style={{
                wordBreak: 'break-word',
                boxShadow: 'var(--pad-shadow)',
                minHeight: PAGE_HEIGHT_PX,
                // Margines w pikselach, nie klasą: ta sama wartość jest
                // podstawą wyliczeń szerokości wklejanego obrazu.
                padding: `${PAGE_MARGIN_PX}px`,
              }}
            />

            {/* Zaznaczony obraz — ustalone szerokości zamiast uchwytu.
                Uzasadnienie przy `resizeSelectedImage`. */}
            {selectedImage && (
              <div className="sticky top-2 z-20 mb-2 flex justify-center">
                <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-xl bg-ink-2/95 border border-line-strong shadow-[var(--shadow-md)] backdrop-blur-xl">
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
                    onClick={removeSelectedImage}
                    title="Usuń obraz"
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-danger hover:bg-danger/15 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Warstwa podziału na strony — leży NAD kartką i nic nie łapie.
                Kreska co wysokość A4; pierwsza pada dopiero na granicy strony
                pierwszej i drugiej, bo „Strona 1" na górze pustego dokumentu
                jest informacją, której nikt nie potrzebuje. */}
            {Array.from({ length: Math.max(0, pageCount - 1) }).map((_, index) => (
              <div
                key={index}
                aria-hidden
                className="pad-page-rule"
                style={{ top: `${(index + 1) * PAGE_HEIGHT_PX}px` }}
              >
                <span>Strona {index + 2}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. DYSKRETNA STOPKA DOKUMENTU */}
      <footer className="px-4 py-2 pad-bar border-t border-line-strong flex items-center justify-between text-[11px] text-content-muted gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span>Słowa: <strong className="text-text-hi">{wordCount}</strong></span>
          <span>•</span>
          <span>Strony: <strong className="text-text-hi">{pageCount}</strong></span>
          <span>•</span>
          {/* Rozmiar pokazujemy dopiero od połowy limitu. Wcześniej jest to
              liczba bez znaczenia; od tego progu zaczyna być ostrzeżeniem. */}
          {contentBytes > SCRATCHPAD_MAX_CONTENT_BYTES / 2 && (
            <>
              <span
                className={
                  contentBytes > SCRATCHPAD_MAX_CONTENT_BYTES * 0.85 ? 'text-warn font-bold' : ''
                }
                title="Dokument ma twardy limit rozmiaru — liczą się głównie wklejone obrazy."
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
        title="Samouczek notatnika"
      />

      {isTeacher && (
        <ScratchpadTemplateManagerModal
          isOpen={isTemplateManagerOpen}
          onClose={() => setIsTemplateManagerOpen(false)}
          currentUser={{ uid: currentUser?.uid || 'teacher', name: currentUser?.name || 'Lektor' }}
          currentContentHtml={docData.contentHtml}
          onTemplatesChanged={refreshTemplates}
        />
      )}
    </div>
  );
};

export default ScratchpadEditor;

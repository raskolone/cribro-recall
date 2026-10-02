/**
 * Struktura lekcji w płaskim HTML notatnika — odczyt, bez zmiany zapisu.
 *
 * Dwa rodzaje nagłówków:
 * - nagłówek LEKCJI: `<h2 data-toggle="1">` ze strzałką zwijania. Tak go
 *   wstawiają wszystkie szablony lekcji (klasa `pad-locked-heading` doszła
 *   dopiero 18.09.2026, więc wcześniejsze lekcje jej nie mają — dlatego
 *   kryterium jej nie wymaga);
 * - nagłówek LEKTORA: każdy inny h1/h2 (przybornik wstawia je przez
 *   `formatBlock`, który zdejmuje `data-toggle`). W lekcji jest jej częścią,
 *   nie granicą.
 *
 * Lekcja kończy się na następnym nagłówku lekcji, separatorze
 * `.pad-page-break` albo na końcu dokumentu.
 */
import { headingPlainText } from './scratchpadDom';

export const LESSON_HEADING_SELECTOR = 'h2[data-toggle="1"]';

export const isLessonHeading = (el: Element | null | undefined): boolean =>
  !!el && el.tagName === 'H2' && el.getAttribute('data-toggle') === '1';

const isPageBreak = (el: Element): boolean => el.classList.contains('pad-page-break');

/** Granica lekcji: następna lekcja albo separator strony. */
export const isLessonBoundary = (el: Element): boolean => isLessonHeading(el) || isPageBreak(el);

/**
 * Węzły chowane przy zwinięciu nagłówka.
 * Lekcja: do następnej lekcji / separatora / końca — nagłówki lektora w środku
 * chowają się razem z treścią. Zwijany nagłówek lektora (stare dokumenty):
 * do następnego nagłówka tego samego lub wyższego poziomu, ale nigdy za
 * granicę lekcji.
 */
export const sectionBodyNodes = (heading: HTMLElement): HTMLElement[] => {
  const lesson = isLessonHeading(heading);
  const level = Number(heading.tagName.charAt(1));
  const nodes: HTMLElement[] = [];
  let node = heading.nextElementSibling as HTMLElement | null;
  while (node && !isLessonBoundary(node)) {
    if (!lesson) {
      const match = /^H([1-6])$/.exec(node.tagName);
      if (match && Number(match[1]) <= level) break;
    }
    nodes.push(node);
    node = node.nextElementSibling as HTMLElement | null;
  }
  return nodes;
};

/** Zwinięcie / rozwinięcie nagłówka w treści dokumentu. */
export const setSectionCollapsed = (heading: HTMLElement, collapsed: boolean): void => {
  const nodes = sectionBodyNodes(heading);
  nodes.forEach(node => {
    node.style.display = collapsed ? 'none' : '';
    // Rozwinięta lekcja pokazuje całą treść — zwinięty w niej nagłówek
    // lektora nie może dalej twierdzić, że jest zwinięty.
    if (!collapsed && node.getAttribute('data-collapsed') === '1') node.setAttribute('data-collapsed', '0');
  });
  // Separator schowany przez starą wersję zwijania (zapisany z display:none)
  // wraca przy każdym przełączeniu sąsiedniej lekcji.
  const boundary = (nodes.length ? nodes[nodes.length - 1] : heading).nextElementSibling as HTMLElement | null;
  if (boundary && isPageBreak(boundary) && boundary.style.display === 'none') boundary.style.display = '';
  heading.setAttribute('data-collapsed', collapsed ? '1' : '0');
};

/**
 * Lekcja, do której należy element (najbliższa poprzedzająca, bez
 * przekraczania separatora). Element zagnieżdżony (np. h2 w `<div>` z treścią
 * AI) liczy się od swojego przodka będącego dzieckiem `root`.
 */
export const findParentLesson = (el: Element, root: Element): HTMLElement | null => {
  let top: Element = el;
  while (top.parentElement && top.parentElement !== root) top = top.parentElement;
  if (top.parentElement !== root) return null;
  let node = top.previousElementSibling;
  while (node) {
    if (isLessonHeading(node)) return node as HTMLElement;
    if (isPageBreak(node)) return null;
    node = node.previousElementSibling;
  }
  return null;
};

/** Pozycja w spisie treści: lekcja albo nagłówek lektora (w lekcji — jej dziecko). */
export interface TocEntry {
  id: string;
  level: 1 | 2;
  text: string;
  collapsed: boolean;
  isLesson: boolean;
  parentId?: string;
}

/**
 * Spis treści z h1/h2 dokumentu. Nagłówek lektora po lekcji staje się jej
 * dzieckiem; przed pierwszą lekcją (albo za separatorem bez lekcji) zostaje
 * na najwyższym poziomie. H3 (sekcje szablonu) nie trafia do spisu.
 *
 * Pusty nagłówek lektora jest pomijany (przeglądarka zostawia pusty węzeł po
 * skasowaniu tekstu; wpis wraca, gdy lektor coś wpisze). Lekcja z pustym
 * tytułem zostaje w spisie jako „Lekcja N (bez tytułu)", gdzie N to jej
 * pozycja wśród lekcji — numer z tekstu przepadł razem z tytułem.
 */
export const buildTocEntries = (
  root: HTMLElement,
  ensureId: (heading: HTMLElement, index: number) => string
): TocEntry[] => {
  const nodes = Array.from(root.querySelectorAll('h1, h2, .pad-page-break')) as HTMLElement[];
  const entries: TocEntry[] = [];
  let currentLessonId: string | undefined;
  let index = 0;
  let lessonOrdinal = 0;
  nodes.forEach(node => {
    if (isPageBreak(node)) {
      currentLessonId = undefined;
      return;
    }
    const isLesson = isLessonHeading(node);
    if (isLesson) lessonOrdinal++;
    const title = headingPlainText(node);
    if (!title && !isLesson) return;
    const id = ensureId(node, index++);
    if (isLesson) currentLessonId = id;
    entries.push({
      id,
      level: Number(node.tagName.charAt(1)) as 1 | 2,
      text: title || `Lekcja ${lessonOrdinal} (bez tytułu)`,
      collapsed: node.getAttribute('data-collapsed') === '1',
      isLesson,
      parentId: isLesson ? undefined : currentLessonId,
    });
  });
  return entries;
};

/**
 * Czy ostatnia lekcja dokumentu jest zwinięta. Zwinięcie chowa wszystko do
 * końca dokumentu, więc wtedy kartka nie powinna dopychać się do pełnej
 * strony A4 (pusta przestrzeń pod paskiem lekcji).
 */
export const isLastLessonCollapsed = (toc: TocEntry[]): boolean => {
  for (let i = toc.length - 1; i >= 0; i--) {
    if (toc[i].isLesson) return toc[i].collapsed;
  }
  return false;
};

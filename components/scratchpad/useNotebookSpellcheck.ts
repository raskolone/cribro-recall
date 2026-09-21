import { useCallback, useState } from 'react';
import { checkNotebookSpelling, SpellcheckIssue } from '../../services/notebookSpellcheckService';

export interface SpellcheckRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SpellcheckMark {
  issue: SpellcheckIssue;
  rects: SpellcheckRect[];
}

export interface SpellcheckPopoverState {
  issue: SpellcheckIssue;
  /** Pozycja pod ostatnim prostokątem podkreślenia, względem tego samego kontenera co znaczniki. */
  anchor: SpellcheckRect;
}

interface TextIndexEntry {
  node: Text;
  start: number;
  end: number;
}

/**
 * Spłaszcza węzły tekstowe kontenera do jednego ciągu + mapy (węzeł, zakres
 * znaków), żeby dało się zamienić offset w tekście na realny `Range` w DOM.
 */
export function buildTextIndex(root: HTMLElement): { text: string; nodes: TextIndexEntry[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = '';
  const nodes: TextIndexEntry[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const start = text.length;
    text += textNode.data;
    nodes.push({ node: textNode, start, end: text.length });
    node = walker.nextNode();
  }
  return { text, nodes };
}

function offsetToPosition(nodes: TextIndexEntry[], offset: number): { node: Text; offset: number } | null {
  for (const entry of nodes) {
    if (offset >= entry.start && offset <= entry.end) {
      return { node: entry.node, offset: offset - entry.start };
    }
  }
  return null;
}

/**
 * Lokalizuje wystąpienie błędu w AKTUALNEJ treści notatnika — zawsze od nowa,
 * po tekście (`contextSnippet` do disambiguacji, `matchedText` jako fallback),
 * nigdy po zapamiętanym offsecie. Dzięki temu wcześniejsze podmiany (np. przy
 * "Zastosuj wszystkie") nie psują lokalizacji kolejnych błędów.
 */
export function findIssueRange(root: HTMLElement, issue: SpellcheckIssue): Range | null {
  const { text, nodes } = buildTextIndex(root);
  if (!text || !issue.matchedText) return null;

  let matchStart = -1;
  const snippet = issue.contextSnippet?.trim();
  if (snippet && snippet.includes(issue.matchedText)) {
    const snippetIdx = text.indexOf(snippet);
    if (snippetIdx !== -1) {
      matchStart = snippetIdx + snippet.indexOf(issue.matchedText);
    }
  }
  if (matchStart === -1) {
    matchStart = text.indexOf(issue.matchedText);
  }
  if (matchStart === -1) return null;

  const matchEnd = matchStart + issue.matchedText.length;
  const startPos = offsetToPosition(nodes, matchStart);
  const endPos = offsetToPosition(nodes, matchEnd);
  if (!startPos || !endPos) return null;

  const range = document.createRange();
  try {
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
  } catch {
    return null;
  }
  return range;
}

/** Prostokąty zajmowane przez `range`, względem lewego-górnego rogu `container` (nie viewportu). */
function rectsRelativeTo(range: Range, container: HTMLElement): SpellcheckRect[] {
  const containerRect = container.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: r.left - containerRect.left,
      top: r.top - containerRect.top,
      width: r.width,
      height: r.height,
    }));
}

interface UseNotebookSpellcheckOptions {
  editorRef: React.RefObject<HTMLDivElement>;
  /** Wywoływane po podmianie tekstu w DOM, żeby edytor przeliczył word count i uruchomił zapis. */
  onApplied: () => void;
}

/**
 * Falowane podkreślenia w stylu Google Docs, bez pisania czegokolwiek do
 * treści notatnika: znaczniki żyją w osobnej, nakładanej warstwie (overlay),
 * pozycjonowanej przez `Range.getClientRects()` nad tekstem w `editorRef`.
 *
 * Zamierzone: nigdy nie owijamy dopasowań w `<span>` WEWNĄTRZ edytowalnego
 * DOM-u. Ten kontenteditable ma za sobą lata delikatnych zależności
 * (execCommand, historia cofania, debounce zapisu czytający `innerHTML`
 * wprost) — dopisanie tam znaczników spellchecka i ich późniejsze
 * wycinanie przed zapisem byłoby now ryzykiem dla czegoś, co działa. Overlay
 * nie dotyka zapisywanej treści w ogóle, więc nie ma czego wycinać.
 *
 * Cena tego wyboru: pozycje są liczone RAZ, przy sprawdzeniu (i po każdej
 * podmianie) — nie śledzą tekstu na żywo w trakcie pisania. To zgodne z tym,
 * jak działa przycisk "Sprawdź pisownię" w tym zadaniu: sprawdzenie na
 * żądanie, nie kontrola w locie. Jakakolwiek kolejna edycja unieważnia
 * pozycje, dlatego `ScratchpadEditor` czyści je przy każdym `handleInput`
 * (patrz `clearAll` wołane stamtąd).
 */
export function useNotebookSpellcheck({ editorRef, onApplied }: UseNotebookSpellcheckOptions) {
  const [issues, setIssues] = useState<SpellcheckIssue[]>([]);
  const [marks, setMarks] = useState<SpellcheckMark[]>([]);
  const [popover, setPopover] = useState<SpellcheckPopoverState | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  /** Przelicza znaczniki dla podanej listy błędów i zwraca tylko te, które faktycznie dało się zlokalizować. */
  const recomputeMarks = useCallback(
    (candidateIssues: SpellcheckIssue[]): SpellcheckIssue[] => {
      const root = editorRef.current;
      if (!root) {
        setMarks([]);
        return [];
      }
      const nextMarks: SpellcheckMark[] = [];
      const locatable: SpellcheckIssue[] = [];
      for (const issue of candidateIssues) {
        const range = findIssueRange(root, issue);
        if (!range) continue;
        const rects = rectsRelativeTo(range, root);
        if (rects.length === 0) continue;
        nextMarks.push({ issue, rects });
        locatable.push(issue);
      }
      setMarks(nextMarks);
      return locatable;
    },
    [editorRef]
  );

  const runCheck = useCallback(async (): Promise<{ found: number }> => {
    const root = editorRef.current;
    if (!root) return { found: 0 };

    setIsChecking(true);
    setPopover(null);
    try {
      const text = (root.innerText || root.textContent || '').trim();
      if (!text) {
        setIssues([]);
        setMarks([]);
        return { found: 0 };
      }
      const found = await checkNotebookSpelling(text);
      const locatable = recomputeMarks(found);
      setIssues(locatable);
      return { found: locatable.length };
    } finally {
      setIsChecking(false);
    }
  }, [editorRef, recomputeMarks]);

  const clearAll = useCallback(() => {
    setIssues((prev) => (prev.length ? [] : prev));
    setMarks((prev) => (prev.length ? [] : prev));
    setPopover(null);
  }, []);

  const openPopoverFor = useCallback((issue: SpellcheckIssue, rect: SpellcheckRect) => {
    setPopover({ issue, anchor: { left: rect.left, top: rect.top + rect.height, width: rect.width, height: rect.height } });
  }, []);

  const closePopover = useCallback(() => setPopover(null), []);

  const ignoreIssue = useCallback(
    (id: string) => {
      setIssues((prev) => {
        const next = prev.filter((i) => i.id !== id);
        recomputeMarks(next);
        return next;
      });
      setPopover(null);
    },
    [recomputeMarks]
  );

  const applyIssue = useCallback(
    (issue: SpellcheckIssue) => {
      const root = editorRef.current;
      if (root) {
        const range = findIssueRange(root, issue);
        if (range) {
          range.deleteContents();
          range.insertNode(document.createTextNode(issue.suggestion));
          root.normalize();
        }
      }
      setIssues((prev) => {
        const next = prev.filter((i) => i.id !== issue.id);
        recomputeMarks(next);
        return next;
      });
      setPopover(null);
      onApplied();
    },
    [editorRef, recomputeMarks, onApplied]
  );

  const applyAll = useCallback(() => {
    const root = editorRef.current;
    if (root) {
      for (const issue of issues) {
        const range = findIssueRange(root, issue);
        if (!range) continue;
        range.deleteContents();
        range.insertNode(document.createTextNode(issue.suggestion));
      }
      root.normalize();
    }
    setIssues([]);
    setMarks([]);
    setPopover(null);
    onApplied();
  }, [editorRef, issues, onApplied]);

  return {
    issues,
    marks,
    popover,
    isChecking,
    runCheck,
    clearAll,
    ignoreIssue,
    applyIssue,
    applyAll,
    openPopoverFor,
    closePopover,
  };
}

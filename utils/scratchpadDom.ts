/**
 * Narzędzia manipulacji DOM dla ScratchpadEditor i TeacherFormattingToolbar.
 *
 * Gwarantuje modyfikacje czysto liniowe (inline):
 * - Przechodzi przez TreeWalker (NodeFilter.SHOW_TEXT)
 * - Nigdy nie przecina ani nie wyciąga elementów blokowych (<p>, <div>, <h1>...)
 * - Nie pozostawia osieroconych pustych akapitów <p></p>
 */

/**
 * Owija każdy fragment tekstu WEWNĄTRZ zaznaczenia własnym `<span>`, zamiast
 * jednym spanem na cały `range`. Zaznaczenie przechodzące przez więcej niż
 * jeden blok (np. dwa akapity) w wersji "jeden span na cały range" wyciągało
 * `<div>`/`<p>` do środka jednego `<span>` — nielegalny układ w HTML,
 * który tworzył puste, nieusuwalne linie przed i po sformatowanym bloku.
 * Dzieląc tekst na węzły i owijając TYLKO fragmenty tekstowe (z podziałem węzła
 * na granicach zaznaczenia), struktura akapitów nigdy się nie rusza.
 */
export const wrapSelectedTextInline = (
  range: Range,
  styleFn: (span: HTMLSpanElement) => void
): HTMLSpanElement[] => {
  let root: Node = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) root = root.parentNode as Node;
  if (!root) return [];

  const doc = root.ownerDocument || window.document;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  const createdSpans: HTMLSpanElement[] = [];
  textNodes.forEach(textNode => {
    const isStart = textNode === range.startContainer;
    const isEnd = textNode === range.endContainer;
    const start = isStart ? range.startOffset : 0;
    const end = isEnd ? range.endOffset : textNode.length;
    if (start >= end) return;

    let target = textNode;
    if (end < target.length) target.splitText(end);
    if (start > 0) target = target.splitText(start);
    if (!target.textContent || !target.textContent.trim()) return;

    const span = doc.createElement('span');
    styleFn(span);
    target.parentNode?.insertBefore(span, target);
    span.appendChild(target);
    createdSpans.push(span);
  });
  return createdSpans;
};

/**
 * Aplikuje klasę formatowania (np. pad-mark-error, pad-mark-correct)
 * na zaznaczonych węzłach tekstowych bez rozbijania akapitów.
 */
export const applyInlineMarkup = (
  range: Range,
  className: string
): HTMLSpanElement[] => {
  return wrapSelectedTextInline(range, span => {
    span.className = className;
  });
};

/**
 * Korekta w locie — przekreśla zaznaczony tekst liniowo
 * i wstawia obok w tym samym akapicie pusty znacznik na poprawną formę.
 */
export const applyInlineStrikeCorrect = (
  range: Range
): HTMLSpanElement | null => {
  const createdSpans = wrapSelectedTextInline(range, span => {
    span.style.textDecoration = 'line-through';
    span.style.color = '#fb7185';
    span.style.textDecorationColor = '#f43f5e';
  });
  if (createdSpans.length === 0) return null;

  const lastSpan = createdSpans[createdSpans.length - 1];
  const doc = lastSpan.ownerDocument || window.document;

  const correction = doc.createElement('span');
  correction.style.color = '#34d399';
  correction.style.fontWeight = '600';
  correction.textContent = '\u00A0';

  const space = doc.createTextNode(' ');
  const parent = lastSpan.parentNode;
  if (parent) {
    parent.insertBefore(space, lastSpan.nextSibling);
    parent.insertBefore(correction, space.nextSibling);
  }

  return correction;
};

/**
 * Tekst nagłówka bez strzałki `.pad-toggle` — to, co trafia do spisu treści.
 * Czyta `textContent`, więc nie zależy od tego, czy tytuł siedzi w
 * `.pad-heading-text` (edytowalny span), czy bezpośrednio w nagłówku.
 */
export const headingPlainText = (heading: HTMLElement): string => {
  const clone = heading.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.pad-toggle').forEach(el => el.remove());
  return (clone.textContent || '').trim();
};

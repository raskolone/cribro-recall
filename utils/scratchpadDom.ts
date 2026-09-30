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

/**
 * Zaznacza całą linię / blok tekstowy na skutek podwójnego kliknięcia (zamiast słowa).
 * Zwraca `true` jeśli zaznaczenie zostało wykonane i należy wywołać `preventDefault()`.
 */
export const selectLineFromTarget = (
  target: HTMLElement | null,
  editorRoot: HTMLElement | null
): boolean => {
  if (!target || !editorRoot || !editorRoot.contains(target)) return false;

  // 1. Nie blokuj natywnego zachowania wewnątrz pól formularzy/inputów
  if (target.closest('input, textarea, select, button')) return false;

  // 2. Ignoruj elementy specjalne (zwijanie sekcji, grafiki, uchwyty, załączniki, podziały stron, linki)
  if (
    target.closest('.pad-toggle') ||
    target.closest('.pad-img-wrapper') ||
    target.closest('.pad-img-handle') ||
    target.closest('.pad-img-toolbar') ||
    target.closest('.pad-img-attachment') ||
    target.tagName === 'IMG' ||
    target.closest('.pad-page-break') ||
    target.closest('.pad-link-card')
  ) {
    return false;
  }

  // 3. Sprawdź, czy kliknięcie jest w obrębie edytowalnej treści (lub edytowalnego tekstu nagłówka)
  const headingText = target.closest<HTMLElement>('.pad-heading-text') || target.querySelector<HTMLElement>('.pad-heading-text');
  const isEditable = Boolean(
    headingText ||
    target.isContentEditable ||
    (editorRoot.getAttribute('contenteditable') !== 'false' && !target.closest('[contenteditable="false"]'))
  );
  if (!isEditable) return false;

  // 4. Znajdź najbliższy blok tekstowy
  const blockNode = target.closest<HTMLElement>('p, li, h1, h2, h3, blockquote, td, th');
  if (!blockNode || blockNode === editorRoot || !editorRoot.contains(blockNode)) {
    return false;
  }

  // 5. W nagłówkach z zablokowaną strukturą zaznacz wyłącznie edytowalny tekst (bez ikony .pad-toggle)
  const targetNode = headingText || blockNode.querySelector<HTMLElement>('.pad-heading-text') || blockNode;

  const doc = targetNode.ownerDocument || window.document;
  const win = doc.defaultView || window;
  const selection = win.getSelection();
  if (!selection) return false;

  const range = doc.createRange();
  range.selectNodeContents(targetNode);
  selection.removeAllRanges();
  selection.addRange(range);

  return true;
};

export interface AutoListConversionResult {
  listElement: HTMLUListElement | HTMLOListElement;
  liElement: HTMLLIElement;
  triggerText: string;
}

/**
 * Wykrywa wzorce listy na początku akapitu <p> przy wciśnięciu spacji:
 * - '-' lub '*' -> <ul><li>
 * - '1.' -> <ol><li>
 * Zwraca informacje o nowo utworzonej liście lub null, jeśli warunki nie są spełnione.
 */
export const tryConvertParagraphToList = (
  range: Range,
  editorRoot: HTMLElement
): AutoListConversionResult | null => {
  if (!range.collapsed) return null;

  let node: Node | null = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!node || !(node instanceof HTMLElement)) return null;

  // Wyklucz nagłówki, elementy zablokowane, istniejące listy oraz elementy checklisty
  if (
    node.closest('.pad-heading-text, .pad-locked-heading, li, ul, ol, .pad-task-item') ||
    node.closest('div, p, li')?.querySelector('input[type="checkbox"]')
  ) {
    return null;
  }

  const currentP = node.closest<HTMLParagraphElement>('p');
  if (!currentP || !editorRoot.contains(currentP)) return null;

  // Wyklucz nagłówki, elementy zablokowane, istniejące listy oraz elementy checklisty
  if (
    currentP.closest('.pad-heading-text, .pad-locked-heading, li, ul, ol, .pad-task-item') ||
    currentP.querySelector('input[type="checkbox"]') ||
    currentP.parentElement?.querySelector('input[type="checkbox"]')
  ) {
    return null;
  }

  // Sprawdź tekst od początku akapitu do pozycji kursora
  const doc = currentP.ownerDocument || window.document;
  const preRange = doc.createRange();
  preRange.setStart(currentP, 0);
  preRange.setEnd(range.startContainer, range.startOffset);
  const textBefore = preRange.toString();

  let listTag: 'ul' | 'ol' | null = null;
  if (textBefore === '-' || textBefore === '*') {
    listTag = 'ul';
  } else if (textBefore === '1.') {
    listTag = 'ol';
  }

  if (!listTag) return null;

  // Usuń wyzwalający wzorzec z początku akapitu
  preRange.deleteContents();

  // Utwórz listę i element li
  const listEl = doc.createElement(listTag);
  const liEl = doc.createElement('li');

  // Przenieś pozostałą zawartość z akapitu do li
  while (currentP.firstChild) {
    liEl.appendChild(currentP.firstChild);
  }

  if (!liEl.hasChildNodes() || (liEl.childNodes.length === 1 && liEl.firstChild?.nodeName === 'BR')) {
    liEl.innerHTML = '<br>';
  }

  listEl.appendChild(liEl);
  currentP.parentNode?.replaceChild(listEl, currentP);

  // Ustaw kursor na początku li
  const win = doc.defaultView || window;
  const selection = win.getSelection();
  if (selection) {
    const newRange = doc.createRange();
    if (liEl.firstChild && liEl.firstChild.nodeType === Node.TEXT_NODE) {
      newRange.setStart(liEl.firstChild, 0);
    } else {
      newRange.setStart(liEl, 0);
    }
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  return {
    listElement: listEl,
    liElement: liEl,
    triggerText: textBefore + ' ',
  };
};

/**
 * Cofa świeżo utworzoną listę z powrotem do akapitu <p> z tekstem wyzwalającym ('- ' lub '1. ').
 */
export const revertAutoListToParagraph = (
  li: HTMLLIElement,
  triggerText: string,
  editorRoot: HTMLElement
): boolean => {
  if (!editorRoot.contains(li)) return false;
  const list = li.closest<HTMLUListElement | HTMLOListElement>('ul, ol');
  if (!list || !editorRoot.contains(list)) return false;

  const doc = li.ownerDocument || window.document;
  const p = doc.createElement('p');

  const textNode = doc.createTextNode(triggerText);
  p.appendChild(textNode);

  // Jeśli w li był jakiś tekst/dzieci poza początkowym <br>, przenieś je
  while (li.firstChild) {
    const child = li.firstChild;
    if (child.nodeName === 'BR' && p.childNodes.length === 1) {
      child.remove();
    } else {
      p.appendChild(child);
    }
  }

  if (list.children.length <= 1) {
    list.parentNode?.replaceChild(p, list);
  } else {
    list.parentNode?.insertBefore(p, list);
    li.remove();
  }

  // Ustaw kursor tuż za tekstem wyzwalającym
  const win = doc.defaultView || window;
  const selection = win.getSelection();
  if (selection) {
    const newRange = doc.createRange();
    newRange.setStart(textNode, triggerText.length);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  return true;
};

/**
 * Synchronizuje stan checkboxa listy zadań (checklist):
 * - aktualizuje atrybut HTML 'checked' (dla poprawnej serializacji do innerHTML / Firestore)
 * - przełącza klasę przekreślenia .pad-task-done na kontenerze nadrzędnym linii
 */
export const syncChecklistState = (
  checkbox: HTMLInputElement,
  editorRoot?: HTMLElement | null
): boolean => {
  const isChecked = checkbox.checked;
  if (isChecked) {
    checkbox.setAttribute('checked', '');
  } else {
    checkbox.removeAttribute('checked');
  }

  const container =
    (checkbox.closest('.pad-task-item') as HTMLElement | null) ||
    (checkbox.parentElement && checkbox.parentElement !== editorRoot
      ? checkbox.parentElement
      : null);

  if (container) {
    if (isChecked) {
      container.classList.add('pad-task-done');
    } else {
      container.classList.remove('pad-task-done');
    }
  }

  return isChecked;
};

/**
 * Usuwa cały pusty element checklisty po naciśnięciu Backspace na początku pustej linii,
 * zastępując go czystym akapitem <p><br></p> (analogicznie do pustego <li> w edytorze),
 * nie pozostawiając osieroconego checkboxa.
 */
export const removeEmptyChecklistItem = (
  range: Range,
  editorRoot: HTMLElement
): boolean => {
  if (!range.collapsed) return false;

  let node: Node | null = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (!node || !(node instanceof HTMLElement)) return false;

  const taskItem =
    (node.closest('.pad-task-item') as HTMLElement | null) ||
    (node.querySelector('input[type="checkbox"]') ? node : null) ||
    (node.closest('div, li, p')?.querySelector('input[type="checkbox"]')
      ? (node.closest('div, li, p') as HTMLElement)
      : null);

  if (!taskItem || !editorRoot.contains(taskItem) || taskItem === editorRoot) {
    return false;
  }

  const checkbox = taskItem.querySelector('input[type="checkbox"]');
  if (!checkbox) return false;

  // Sprawdzamy czy w elemencie jest jakikolwiek tekst poza checkboxem i białymi znakami / nbsp
  const rawText = taskItem.textContent?.replace(/[\s\u00a0]/g, '') || '';
  if (rawText.length > 0) {
    return false;
  }

  const doc = taskItem.ownerDocument || window.document;
  const p = doc.createElement('p');
  p.innerHTML = '<br>';

  const parentList = taskItem.closest('ul, ol');
  if (parentList && parentList.parentNode) {
    taskItem.remove();
    parentList.parentNode.insertBefore(p, parentList.nextSibling);
    if (!parentList.hasChildNodes()) parentList.remove();
  } else {
    taskItem.replaceWith(p);
  }

  const win = doc.defaultView || window;
  const selection = win.getSelection();
  if (selection) {
    const newRange = doc.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  return true;
};

/**
 * Wstawia element checklisty w miejscu kursora lub konwertuje zaznaczony tekst na zadanie.
 * Zamiast zawodnego execCommand('insertHTML'), operuje bezpośrednio na DOM API:
 * - Jeśli jest zaznaczony tekst: zachowuje go i przenosi do zadania obok checkboxa
 * - Jeśli brak zaznaczenia (collapsed): wstawia nowy element zadania z checkboxem i spacją na tekst
 * - Po wstawieniu ustawia kursor w edytowalnym miejscu za checkboxem
 */
export const insertChecklistBlock = (
  editorRoot: HTMLElement
): boolean => {
  const doc = editorRoot.ownerDocument || window.document;
  const win = doc.defaultView || window;
  const selection = win.getSelection();

  let range: Range | null = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (range && !editorRoot.contains(range.commonAncestorContainer)) {
    range = null;
  }

  if (!range) {
    range = doc.createRange();
    range.selectNodeContents(editorRoot);
    range.collapse(false);
  }

  const taskDiv = doc.createElement('div');
  taskDiv.className = 'pad-task-item';

  const checkbox = doc.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('contenteditable', 'false');
  checkbox.style.marginRight = '6px';
  checkbox.style.verticalAlign = 'middle';
  taskDiv.appendChild(checkbox);

  if (!range.collapsed) {
    // 1. Gdy jest zaznaczony tekst: zachowaj go obok checkboxa
    const fragment = range.extractContents();
    taskDiv.appendChild(fragment);

    if (!taskDiv.textContent?.trim()) {
      taskDiv.appendChild(doc.createTextNode('\u00a0'));
    }

    let startNode: Node | null = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;
    const currentBlock = startNode ? (startNode as HTMLElement).closest('p, h1, h2, h3, li, div, blockquote') : null;

    if (currentBlock && currentBlock !== editorRoot && (!currentBlock.textContent || !currentBlock.textContent.trim())) {
      currentBlock.replaceWith(taskDiv);
    } else {
      range.insertNode(taskDiv);
    }

    // Ustaw kursor na końcu przeniesionego tekstu wewnątrz zadania
    const newRange = doc.createRange();
    newRange.selectNodeContents(taskDiv);
    newRange.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  } else {
    // 2. Gdy kursor jest bez zaznaczenia (collapsed)
    const textNode = doc.createTextNode('\u00a0');
    taskDiv.appendChild(textNode);

    let startNode: Node | null = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;
    const currentBlock = startNode ? (startNode as HTMLElement).closest('p, h1, h2, h3, li, div, blockquote') : null;

    if (currentBlock && currentBlock !== editorRoot && (!currentBlock.textContent || !currentBlock.textContent.trim())) {
      // Pusta linia (np. <p><br></p>) -> zastąp czystym elementem checklisty
      currentBlock.replaceWith(taskDiv);
    } else if (currentBlock && currentBlock !== editorRoot) {
      currentBlock.parentNode?.insertBefore(taskDiv, currentBlock.nextSibling);
    } else {
      range.insertNode(taskDiv);
    }

    // Ustaw kursor zaraz za checkboxem (w miejscu na tekst zadania)
    const newRange = doc.createRange();
    newRange.setStart(textNode, 1);
    newRange.collapse(true);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  return true;
};

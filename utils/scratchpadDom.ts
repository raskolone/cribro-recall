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
 * Zaznacza całą linię / blok tekstowy na skutek potrójnego kliknięcia.
 * W przypadku <li> z zagnieżdżoną listą <ul>/<ol>, zaznacza tylko treść nadrzędną (kończy się przed zagnieżdżeniem).
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
  const blockNode = target.closest<HTMLElement>('p, li, h1, h2, h3, blockquote, td, th, .pad-task-item');
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

  // W zagnieżdżonej liście <li> zaznacz tylko treść punktu nadrzędnego (zakończ przed zagnieżdżonym <ul>/<ol>)
  const nestedList = blockNode.tagName.toLowerCase() === 'li' ? blockNode.querySelector('ul, ol') : null;
  if (nestedList && targetNode === blockNode) {
    range.setStart(targetNode, 0);
    range.setEndBefore(nestedList);
  } else if (blockNode.classList.contains('pad-task-item') && targetNode === blockNode) {
    const checkbox = blockNode.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.nextSibling) {
      range.setStartBefore(checkbox.nextSibling);
      range.setEndAfter(blockNode.lastChild || blockNode);
    } else {
      range.selectNodeContents(targetNode);
    }
  } else {
    range.selectNodeContents(targetNode);
  }

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
 * Obsługa Backspace / Delete w elemencie checklisty:
 * 1. Kursor na początku tekstu zadania (zaraz za checkboxem, niepusty tekst) -> odwraca zadanie do zwykłego <p> z zachowaniem tekstu
 * 2. Zadanie puste -> usuwa cały element i przenosi kursor na koniec poprzedniej linii (scalenie)
 * 3. Zaznaczony cały blok (niecollapsed) -> usuwa cały blok zadania
 */
export const removeEmptyChecklistItem = (
  range: Range,
  editorRoot: HTMLElement
): boolean => {
  const doc = editorRoot.ownerDocument || window.document;
  const win = doc.defaultView || window;
  const selection = win.getSelection();

  // 1. Zaznaczony cały blok (niecollapsed)
  if (!range.collapsed) {
    let startNode: Node | null = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;
    let taskItem = startNode ? (startNode as HTMLElement).closest('.pad-task-item') as HTMLElement | null : null;
    if (!taskItem && startNode && startNode.childNodes.length > 0) {
      const child = startNode.childNodes[range.startOffset] || startNode.childNodes[Math.max(0, range.startOffset - 1)];
      if (child) {
        taskItem = (child.nodeType === Node.TEXT_NODE ? child.parentElement : child as HTMLElement)?.closest('.pad-task-item') as HTMLElement | null;
      }
    }
    if (taskItem && editorRoot.contains(taskItem) && taskItem !== editorRoot) {
      const prev = taskItem.previousElementSibling as HTMLElement | null;
      const next = taskItem.nextElementSibling as HTMLElement | null;
      taskItem.remove();

      if (prev) {
        const newRange = doc.createRange();
        newRange.selectNodeContents(prev);
        newRange.collapse(false);
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else if (next) {
        const newRange = doc.createRange();
        newRange.setStart(next, 0);
        newRange.collapse(true);
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else {
        const p = doc.createElement('p');
        p.innerHTML = '<br>';
        editorRoot.appendChild(p);
        const newRange = doc.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
      return true;
    }
    return false;
  }

  // 2. Kursor w jednym miejscu (collapsed)
  let node: Node | null = range.startContainer;
  let offset = range.startOffset;

  let taskItem: HTMLElement | null = null;
  if (node.nodeType === Node.TEXT_NODE) {
    taskItem = node.parentElement?.closest('.pad-task-item') as HTMLElement | null;
  } else if (node instanceof HTMLElement) {
    taskItem = node.closest('.pad-task-item') as HTMLElement | null;
  }

  if (!taskItem || !editorRoot.contains(taskItem) || taskItem === editorRoot) {
    return false;
  }

  const checkbox = taskItem.querySelector('input[type="checkbox"]');
  if (!checkbox) return false;

  const rawText = taskItem.textContent?.replace(/[\s\u00a0]/g, '') || '';

  // SCENARIUSZ A: Zadanie jest puste (brak tekstu poza białymi znakami / nbsp)
  if (rawText.length === 0) {
    const prev = taskItem.previousElementSibling as HTMLElement | null;
    const next = taskItem.nextElementSibling as HTMLElement | null;
    taskItem.remove();

    if (prev) {
      const newRange = doc.createRange();
      newRange.selectNodeContents(prev);
      newRange.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else if (next) {
      const newRange = doc.createRange();
      newRange.setStart(next, 0);
      newRange.collapse(true);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      const p = doc.createElement('p');
      p.innerHTML = '<br>';
      editorRoot.appendChild(p);
      const newRange = doc.createRange();
      newRange.setStart(p, 0);
      newRange.collapse(true);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
    return true;
  }

  // SCENARIUSZ B: Zadanie NIE JEST puste, ale kursor stoi na początku tekstu (zaraz za checkboxem)
  const isAtStartOfText = (() => {
    if (node === taskItem) {
      return offset <= 1;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      let prevSibling = node.previousSibling;
      while (prevSibling && prevSibling !== checkbox && prevSibling.textContent === '') {
        prevSibling = prevSibling.previousSibling;
      }
      return prevSibling === checkbox && offset === 0;
    }
    return false;
  })();

  if (isAtStartOfText) {
    const p = doc.createElement('p');
    checkbox.remove();
    while (taskItem.firstChild) {
      p.appendChild(taskItem.firstChild);
    }
    taskItem.replaceWith(p);

    const newRange = doc.createRange();
    newRange.setStart(p.firstChild || p, 0);
    newRange.collapse(true);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    return true;
  }

  return false;
};

/**
 * Wstawia element checklisty w miejscu kursora lub konwertuje zaznaczone bloki na zadania.
 * Obsługuje zarówno zaznaczenie jednoliniowe, jak i wieloliniowe (multi-line):
 * - Identyfikuje wszystkie bloki (<p>, <li>, nagłówki zwykłe, .pad-task-item) przecinające range
 * - Dla każdego bloku z osobna:
 *   - jeśli to już .pad-task-item -> odwraca z powrotem do <p> (toggle)
 *   - jeśli zwykły blok tekstowy -> przekształca w <div class="pad-task-item"><input type="checkbox"...>{treść}</div>
 * - Dla collapsed range: przekształca bieżący blok (jeśli pusta linia, tworzy czysty element zadania)
 * - Ustawia kursor na końcu ostatniego przekształconego elementu
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

  const createCheckbox = () => {
    const cb = doc.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('contenteditable', 'false');
    cb.style.marginRight = '6px';
    cb.style.verticalAlign = 'middle';
    return cb;
  };

  const convertBlockToTask = (block: HTMLElement): HTMLElement => {
    const taskDiv = doc.createElement('div');
    taskDiv.className = 'pad-task-item';
    taskDiv.appendChild(createCheckbox());

    const isBlank = !block.textContent || !block.textContent.replace(/[\s\u00a0]/g, '');
    if (isBlank) {
      taskDiv.appendChild(doc.createTextNode('\u00a0'));
    } else {
      while (block.firstChild) {
        taskDiv.appendChild(block.firstChild);
      }
    }

    block.replaceWith(taskDiv);
    return taskDiv;
  };

  const convertTaskToParagraph = (taskItem: HTMLElement): HTMLElement => {
    const p = doc.createElement('p');
    const checkbox = taskItem.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.remove();

    while (taskItem.firstChild) {
      p.appendChild(taskItem.firstChild);
    }
    const isBlank = !p.textContent || !p.textContent.replace(/[\s\u00a0]/g, '');
    if (isBlank) {
      p.innerHTML = '<br>';
    }
    taskItem.replaceWith(p);
    return p;
  };

  if (range.collapsed) {
    // 1. Kursor w jednym miejscu (collapsed)
    let startNode: Node | null = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;
    const currentBlock = startNode ? (startNode as HTMLElement).closest('p, li, .pad-task-item, h1, h2, h3, blockquote, div') as HTMLElement | null : null;

    if (!currentBlock || currentBlock === editorRoot || !editorRoot.contains(currentBlock)) {
      const taskDiv = doc.createElement('div');
      taskDiv.className = 'pad-task-item';
      taskDiv.appendChild(createCheckbox());
      taskDiv.appendChild(doc.createTextNode('\u00a0'));
      range.insertNode(taskDiv);
      const newRange = doc.createRange();
      newRange.selectNodeContents(taskDiv);
      newRange.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      return true;
    }

    // Wyklucz zablokowane nagłówki szablonu lekcji
    if (currentBlock.closest('.pad-locked-heading')) {
      return false;
    }

    if (currentBlock.classList.contains('pad-task-item') || currentBlock.querySelector('input[type="checkbox"]')) {
      const p = convertTaskToParagraph(currentBlock.classList.contains('pad-task-item') ? currentBlock : (currentBlock.closest('.pad-task-item') || currentBlock));
      const newRange = doc.createRange();
      newRange.selectNodeContents(p);
      newRange.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      return true;
    }

    const task = convertBlockToTask(currentBlock);
    const newRange = doc.createRange();
    newRange.selectNodeContents(task);
    newRange.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    return true;
  }

  // 2. Zaznaczenie (może obejmować jeden lub wiele bloków)
  const allBlocks = Array.from(editorRoot.querySelectorAll('p, .pad-task-item, li, h1, h2, h3, blockquote')) as HTMLElement[];
  let targetBlocks = allBlocks.filter(b => {
    if (b.closest('.pad-locked-heading')) return false;
    return range!.intersectsNode(b);
  });

  if (targetBlocks.length === 0) {
    let startNode: Node | null = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentElement;
    const single = startNode ? (startNode as HTMLElement).closest('p, .pad-task-item, li, div') as HTMLElement | null : null;
    if (single && single !== editorRoot && editorRoot.contains(single) && !single.closest('.pad-locked-heading')) {
      targetBlocks = [single];
    }
  }

  if (targetBlocks.length === 0) {
    const taskDiv = doc.createElement('div');
    taskDiv.className = 'pad-task-item';
    taskDiv.appendChild(createCheckbox());
    const fragment = range.extractContents();
    taskDiv.appendChild(fragment);
    if (!taskDiv.textContent?.trim()) taskDiv.appendChild(doc.createTextNode('\u00a0'));
    range.insertNode(taskDiv);
    const newRange = doc.createRange();
    newRange.selectNodeContents(taskDiv);
    newRange.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    return true;
  }

  let lastResultElement: HTMLElement | null = null;
  targetBlocks.forEach(block => {
    if (block.classList.contains('pad-task-item') || block.querySelector('input[type="checkbox"]')) {
      const taskElem = block.classList.contains('pad-task-item') ? block : (block.closest('.pad-task-item') as HTMLElement || block);
      lastResultElement = convertTaskToParagraph(taskElem);
    } else {
      lastResultElement = convertBlockToTask(block);
    }
  });

  if (lastResultElement) {
    const newRange = doc.createRange();
    newRange.selectNodeContents(lastResultElement);
    newRange.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  return true;
};

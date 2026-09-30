import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true"></div></body></html>', {
  url: 'http://localhost/',
});
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
(globalThis as any).Node = dom.window.Node;

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncChecklistState,
  removeEmptyChecklistItem,
  tryConvertParagraphToList,
  insertChecklistBlock,
} from '../utils/scratchpadDom';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};

describe('Checklista z przekreśleniem (Scratchpad Checklist)', () => {
  test('1. Kliknięcie w checkbox dodaje atrybut checked w innerHTML i klasę pad-task-done', () => {
    const editor = mount(
      '<div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" /> Zadanie 1</div>'
    );
    const checkbox = editor.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const item = editor.querySelector<HTMLElement>('.pad-task-item')!;

    // Symulacja kliknięcia przez użytkownika (browser zmienia checkbox.checked na true)
    checkbox.checked = true;
    const isChecked = syncChecklistState(checkbox, editor);

    assert.equal(isChecked, true);
    assert.equal(checkbox.hasAttribute('checked'), true);
    assert.equal(item.classList.contains('pad-task-done'), true);

    // WERYFIKACJA STRINGA HTML — atrybut checked musi być obecny w innerHTML
    const htmlString = editor.innerHTML;
    assert.match(htmlString, /checked/i, 'Atrybut checked musi występować w zserializowanym stringu HTML');
    assert.match(htmlString, /pad-task-done/, 'Klasa pad-task-done musi występować w zserializowanym stringu HTML');
  });

  test('2. Ponowne kliknięcie odznacza checkbox, usuwa atrybut checked z innerHTML i usuwa klasę pad-task-done', () => {
    const editor = mount(
      '<div class="pad-task-item pad-task-done"><input type="checkbox" contenteditable="false" checked="" style="margin-right:6px;vertical-align:middle;" /> Zadanie 1</div>'
    );
    const checkbox = editor.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const item = editor.querySelector<HTMLElement>('.pad-task-item')!;

    // Symulacja odznaczenia (browser zmienia checkbox.checked na false)
    checkbox.checked = false;
    const isChecked = syncChecklistState(checkbox, editor);

    assert.equal(isChecked, false);
    assert.equal(checkbox.hasAttribute('checked'), false);
    assert.equal(item.classList.contains('pad-task-done'), false);

    // WERYFIKACJA STRINGA HTML — atrybut checked nie może występować
    const htmlString = editor.innerHTML;
    assert.equal(/checked/i.test(htmlString), false, 'Atrybut checked nie może występować po odznaczeniu w stringu HTML');
    assert.equal(htmlString.includes('pad-task-done'), false, 'Klasa pad-task-done musi zniknąć ze stringa HTML');
  });

  test('3. Backspace w pustej checkliście usuwa cały element bez pozostawiania osieroconego checkboxa', () => {
    const editor = mount(
      '<div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" />&nbsp;</div>'
    );
    const item = editor.querySelector<HTMLElement>('.pad-task-item')!;

    // Kursor wewnątrz elementu (np. w &nbsp;)
    const range = dom.window.document.createRange();
    const textNode = item.lastChild!;
    range.setStart(textNode, 1);
    range.collapse(true);

    const handled = removeEmptyChecklistItem(range, editor);
    assert.equal(handled, true, 'Funkcja powinna obsłużyć Backspace w pustej checkliście');

    // Element checklisty i checkbox muszą być całkowicie usunięte
    assert.equal(editor.querySelectorAll('.pad-task-item').length, 0);
    assert.equal(editor.querySelectorAll('input[type="checkbox"]').length, 0, 'Nie może zostać osierocony checkbox');
    assert.equal(editor.querySelectorAll('p').length, 1, 'Powinien powstać czysty akapit <p>');
  });

  test('4. Backspace w niepustej checkliście nie usuwa elementu checklisty', () => {
    const editor = mount(
      '<div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" /> Kup mleko</div>'
    );
    const item = editor.querySelector<HTMLElement>('.pad-task-item')!;
    const textNode = item.lastChild!;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 4); // wewnątrz słowa "Kup "
    range.collapse(true);

    const handled = removeEmptyChecklistItem(range, editor);
    assert.equal(handled, false, 'Niepusta checklista nie powinna być usuwana przez removeEmptyChecklistItem');
    assert.equal(editor.querySelectorAll('.pad-task-item').length, 1);
    assert.equal(editor.querySelectorAll('input[type="checkbox"]').length, 1);
  });

  test('5. Wpisanie "- " wewnątrz tekstu checklisty nie tworzy zagnieżdżonej listy', () => {
    const editor = mount(
      '<div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" />-</div>'
    );
    const item = editor.querySelector<HTMLElement>('.pad-task-item')!;
    const textNode = item.lastChild as Text;

    // Kursor tuż za myślnikiem (offset 1)
    const range = dom.window.document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.equal(editor.querySelectorAll('li').length, 0, 'Nie powinien powstać element li');
    assert.equal(editor.querySelectorAll('.pad-task-item').length, 1, 'Checklista musi pozostać nienaruszona');
  });

  test('6. Symulacja cyklu Firestore (odświeżenie strony): zaznaczenie przetrwało odświeżenie', () => {
    // KROK 1: Stan początkowy edytora — wstawiona checklista z trzema zadaniami
    const editor = mount(`
      <div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" /> Zadanie 1</div>
      <div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" /> Zadanie 2</div>
      <div class="pad-task-item"><input type="checkbox" contenteditable="false" style="margin-right:6px;vertical-align:middle;" /> Zadanie 3</div>
    `);

    const checkboxes = editor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    assert.equal(checkboxes.length, 3);

    // KROK 2: Użytkownik zaznacza zadanie 1 i zadanie 3
    checkboxes[0].checked = true;
    syncChecklistState(checkboxes[0], editor);

    checkboxes[2].checked = true;
    syncChecklistState(checkboxes[2], editor);

    // Zapis do bazy / symulacja Firestore contentHtml
    const savedHtmlToFirestore = editor.innerHTML;

    // Weryfikacja stringa zapisanego do Firestore
    assert.match(savedHtmlToFirestore, /checked=""[^<]*Zadanie 1/);
    assert.match(savedHtmlToFirestore, /checked=""[^<]*Zadanie 3/);
    assert.doesNotMatch(savedHtmlToFirestore, /checked=""[^<]*Zadanie 2/);

    // KROK 3: ODŚWIEŻENIE STRONY (montujemy zupełnie nowy dokument z HTML-a odczytanego z Firestore)
    const refreshedEditor = mount(savedHtmlToFirestore);

    // Synchronizacja właściwości DOM po wczytaniu innerHTML (odpowiednik useEffect w ScratchpadEditor)
    refreshedEditor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      cb.checked = cb.hasAttribute('checked');
    });

    const refreshedCheckboxes = refreshedEditor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const refreshedItems = refreshedEditor.querySelectorAll<HTMLElement>('.pad-task-item');

    // WERYFIKACJA PO ODŚWIEŻENIU:
    // Zadanie 1: zaznaczone i przekreślone
    assert.equal(refreshedCheckboxes[0].checked, true, 'Zadanie 1 musi być zaznaczone po odświeżeniu');
    assert.equal(refreshedItems[0].classList.contains('pad-task-done'), true, 'Zadanie 1 musi mieć klasę pad-task-done po odświeżeniu');

    // Zadanie 2: niezaznaczone i nieprzekreślone
    assert.equal(refreshedCheckboxes[1].checked, false, 'Zadanie 2 musi być odznaczone po odświeżeniu');
    assert.equal(refreshedItems[1].classList.contains('pad-task-done'), false, 'Zadanie 2 nie może mieć klasy pad-task-done');

    // Zadanie 3: zaznaczone i przekreślone
    assert.equal(refreshedCheckboxes[2].checked, true, 'Zadanie 3 musi być zaznaczone po odświeżeniu');
    assert.equal(refreshedItems[2].classList.contains('pad-task-done'), true, 'Zadanie 3 musi mieć klasę pad-task-done po odświeżeniu');

    // KROK 4: Odznaczamy Zadanie 1 i znów zapisujemy
    refreshedCheckboxes[0].checked = false;
    syncChecklistState(refreshedCheckboxes[0], refreshedEditor);

    const secondSavedHtml = refreshedEditor.innerHTML;

    // KROK 5: PONOWNE ODŚWIEŻENIE STRONY
    const secondRefreshedEditor = mount(secondSavedHtml);
    secondRefreshedEditor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      cb.checked = cb.hasAttribute('checked');
    });

    const finalCheckboxes = secondRefreshedEditor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const finalItems = secondRefreshedEditor.querySelectorAll<HTMLElement>('.pad-task-item');

    // Zadanie 1 jest teraz odznaczone
    assert.equal(finalCheckboxes[0].checked, false, 'Zadanie 1 musi być odznaczone po ponownym odświeżeniu');
    assert.equal(finalItems[0].classList.contains('pad-task-done'), false);

    // Zadanie 3 nadal pozostaje zaznaczone
    assert.equal(finalCheckboxes[2].checked, true, 'Zadanie 3 nadal musi być zaznaczone');
    assert.equal(finalItems[2].classList.contains('pad-task-done'), true);
  });

  test('7. Wstawienie z zaznaczonym tekstem "Kupić mleko" zachowuje tekst obok checkboxa', () => {
    const editor = mount('<p>Kupić mleko</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.length);
    const selection = dom.window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    insertChecklistBlock(editor);

    const taskItem = editor.querySelector<HTMLElement>('.pad-task-item');
    assert.ok(taskItem, 'Element .pad-task-item musi powstać');
    assert.ok(taskItem.querySelector('input[type="checkbox"]'), 'Checkbox musi istnieć wewnątrz zadania');
    assert.match(taskItem.textContent || '', /Kupić mleko/, 'Zaznaczony tekst "Kupić mleko" NIE może zniknąć');

    // Kursor po wstawieniu musi być w edytowalnym miejscu wewnątrz zadania
    const curSel = dom.window.getSelection()!;
    assert.ok(curSel.rangeCount > 0);
    const curRange = curSel.getRangeAt(0);
    assert.ok(taskItem.contains(curRange.startContainer), 'Kursor po wstawieniu musi być wewnątrz zadania');
  });

  test('8. Wstawienie na pustej, collapsed linii wstawia checkbox z miejscem na wpisanie tekstu', () => {
    const editor = mount('<p><br></p>');
    const p = editor.querySelector('p')!;

    const range = dom.window.document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    const selection = dom.window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    insertChecklistBlock(editor);

    const taskItem = editor.querySelector<HTMLElement>('.pad-task-item');
    assert.ok(taskItem, 'Element .pad-task-item musi powstać na pustej linii');
    const checkbox = taskItem.querySelector<HTMLInputElement>('input[type="checkbox"]');
    assert.ok(checkbox, 'Checkbox musi istnieć na pustej linii');
    assert.equal(checkbox.getAttribute('contenteditable'), 'false', 'Checkbox musi mieć contenteditable="false"');

    // Kursor po wstawieniu musi być w edytowalnym miejscu zaraz po checkboxie
    const curSel = dom.window.getSelection()!;
    assert.ok(curSel.rangeCount > 0);
    const curRange = curSel.getRangeAt(0);
    assert.ok(taskItem.contains(curRange.startContainer), 'Kursor po wstawieniu musi być wewnątrz zadania');
  });
});


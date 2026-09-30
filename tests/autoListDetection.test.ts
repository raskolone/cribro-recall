import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true"></div></body></html>', {
  url: 'http://localhost/',
});
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  tryConvertParagraphToList,
  revertAutoListToParagraph,
} from '../utils/scratchpadDom';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};

describe('Auto-wykrywanie list i cofanie Backspace', () => {
  test('1. Wpisanie "- " na początku pustej linii konwertuje na <ul><li></li></ul>', () => {
    const editor = mount('<p>-</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    // Kursor tuż za myślnikiem (offset 1)
    const range = dom.window.document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.ok(result, 'Konwersja powinna zwrócić wynik');
    assert.equal(result.listElement.tagName.toLowerCase(), 'ul');
    assert.equal(result.triggerText, '- ');
    assert.equal(editor.querySelectorAll('ul').length, 1);
    assert.equal(editor.querySelectorAll('li').length, 1);
  });

  test('2. Wpisanie "* " na początku linii konwertuje na <ul><li></li></ul>', () => {
    const editor = mount('<p>*</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.ok(result);
    assert.equal(result.listElement.tagName.toLowerCase(), 'ul');
    assert.equal(result.triggerText, '* ');
    assert.equal(editor.querySelectorAll('ul').length, 1);
  });

  test('3. Wpisanie "1. " na początku linii konwertuje na <ol><li></li></ol>', () => {
    const editor = mount('<p>1.</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 2);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.ok(result);
    assert.equal(result.listElement.tagName.toLowerCase(), 'ol');
    assert.equal(result.triggerText, '1. ');
    assert.equal(editor.querySelectorAll('ol').length, 1);
    assert.equal(editor.querySelectorAll('li').length, 1);
  });

  test('4. Wpisanie "- " na początku linii z tekstem zachowuje resztę tekstu wewnątrz <li>', () => {
    const editor = mount('<p>-Kupić mleko i kawę</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    // Kursor zaraz za myślnikiem
    const range = dom.window.document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.ok(result);
    assert.equal(result.listElement.tagName.toLowerCase(), 'ul');
    assert.equal(result.liElement.textContent, 'Kupić mleko i kawę');
  });

  test('5. Wpisanie "- " w środku istniejącego zdania NIE konwertuje na listę', () => {
    const editor = mount('<p>To jest zdanie z myślnikiem - w środku tekstu</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    // Kursor za myślnikiem w środku tekstu
    const dashIndex = textNode.textContent!.indexOf('-');
    const range = dom.window.document.createRange();
    range.setStart(textNode, dashIndex + 1);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.equal(result, null, 'Nie powinno konwertować myślnika w środku zdania');
    assert.equal(editor.querySelectorAll('ul, ol').length, 0);
  });

  test('6. Wpisanie "- " wewnątrz nagłówka lekcji NIE konwertuje na listę', () => {
    const editor = mount(
      '<h2 class="pad-locked-heading" contenteditable="false">' +
        '<span class="pad-toggle" contenteditable="false">▾</span>' +
        '<span class="pad-heading-text" contenteditable="true">Lesson 1 -</span>' +
      '</h2>'
    );
    const span = editor.querySelector('.pad-heading-text')!;
    const textNode = span.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, textNode.length);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.equal(result, null, 'Nagłówki nie mogą być przekształcane w listę');
    assert.equal(editor.querySelectorAll('ul, ol').length, 0);
  });

  test('7. Wpisanie "- " wewnątrz istniejącego punktu listy <li> NIE tworzy zagnieżdżonej listy', () => {
    const editor = mount('<ul><li>-</li></ul>');
    const li = editor.querySelector('li')!;
    const textNode = li.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    const result = tryConvertParagraphToList(range, editor);
    assert.equal(result, null, 'Istniejący element listy nie może być ponownie konwertowany');
  });

  test('8. Backspace w pustym, świeżo utworzonym <li> cofa konwersję do zwykłego tekstu', () => {
    const editor = mount('<p>-</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    const conversion = tryConvertParagraphToList(range, editor)!;
    assert.ok(conversion);
    assert.equal(editor.querySelectorAll('ul').length, 1);

    // Symulacja Backspace na nowo utworzonym li
    const reverted = revertAutoListToParagraph(conversion.liElement, conversion.triggerText, editor);
    assert.equal(reverted, true);

    // Lista została usunięta, powrócił akapit <p> z tekstem "- "
    assert.equal(editor.querySelectorAll('ul').length, 0);
    const restoredP = editor.querySelector('p')!;
    assert.ok(restoredP);
    assert.equal(restoredP.textContent, '- ');

    // Kursor znajduje się bezpośrednio po tekście "- "
    const selection = dom.window.getSelection()!;
    assert.equal(selection.anchorOffset, 2);
  });

  test('9. Backspace cofa również listę numerowaną 1. do zwykłego tekstu "1. "', () => {
    const editor = mount('<p>1.</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    const range = dom.window.document.createRange();
    range.setStart(textNode, 2);
    range.collapse(true);

    const conversion = tryConvertParagraphToList(range, editor)!;
    assert.ok(conversion);
    assert.equal(editor.querySelectorAll('ol').length, 1);

    const reverted = revertAutoListToParagraph(conversion.liElement, conversion.triggerText, editor);
    assert.equal(reverted, true);

    assert.equal(editor.querySelectorAll('ol').length, 0);
    const restoredP = editor.querySelector('p')!;
    assert.equal(restoredP.textContent, '1. ');

    const selection = dom.window.getSelection()!;
    assert.equal(selection.anchorOffset, 3);
  });
});

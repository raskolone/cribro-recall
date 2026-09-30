import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true"></div></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).NodeFilter = dom.window.NodeFilter;
(globalThis as any).Range = dom.window.Range;

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapSelectedTextInline,
  applyInlineMarkup,
  applyInlineStrikeCorrect,
} from '../utils/scratchpadDom';

describe('Scratchpad Formatting & Inline Markup (Bugfix: brak osieroconych pustych linii)', () => {
  let editor: HTMLElement;

  beforeEach(() => {
    editor = dom.window.document.getElementById('editor')!;
    editor.innerHTML = '<p>First line</p><p>Second line</p><p>Third line</p>';
  });

  describe('TeacherFormattingToolbar — applyInlineMarkup', () => {
    test('1. Zaznaczenie całej linii potrójnym kliknięciem (Triple Click): brak pustych <p>, sąsiednie linie nienaruszone', () => {
      const p1 = editor.children[0] as HTMLElement;
      const p2 = editor.children[1] as HTMLElement;
      const p3 = editor.children[2] as HTMLElement;

      // W Chromium potrójny klik na p2 ustawia:
      // start: p2.firstChild, offset: 0; end: p3, offset: 0
      const range = dom.window.document.createRange();
      range.setStart(p2.firstChild!, 0);
      range.setEnd(p3, 0);

      const created = applyInlineMarkup(range, 'pad-mark-error');

      // (a) Dokładnie 3 akapity w edytorze — ZERO pustych <p></p> przed i po!
      assert.equal(editor.children.length, 3, 'Liczba akapitów nie może się zmienić (brak osieroconych <p>)');
      assert.equal(editor.querySelectorAll('p').length, 3);
      for (const p of Array.from(editor.querySelectorAll('p'))) {
        assert.ok(p.textContent?.trim().length! > 0, 'Żaden akapit nie może być pusty');
      }

      // (b) Span zawiera dokładnie oryginalny tekst "Second line"
      assert.equal(created.length, 1);
      assert.equal(created[0].className, 'pad-mark-error');
      assert.equal(created[0].textContent, 'Second line');
      assert.equal(p2.innerHTML, '<span class="pad-mark-error">Second line</span>');

      // (c) Sąsiednie linie całkowicie nienaruszone
      assert.equal(p1.textContent, 'First line');
      assert.equal(p3.textContent, 'Third line');
    });

    test('2. Zaznaczenie całej linii Shift+Down: brak pustych <p>, czysty markup', () => {
      const p2 = editor.children[1] as HTMLElement;
      const p3 = editor.children[2] as HTMLElement;

      // Shift+Down z początku p2:
      // start: p2.firstChild, offset: 0; end: p3.firstChild, offset: 0
      const range = dom.window.document.createRange();
      range.setStart(p2.firstChild!, 0);
      range.setEnd(p3.firstChild!, 0);

      const created = applyInlineMarkup(range, 'pad-mark-vocab');

      assert.equal(editor.children.length, 3);
      assert.equal(editor.querySelectorAll('p').length, 3);
      assert.equal(p2.innerHTML, '<span class="pad-mark-vocab">Second line</span>');
      assert.equal(editor.children[0].textContent, 'First line');
      assert.equal(editor.children[2].textContent, 'Third line');
    });

    test('3. Zaznaczenie całej linii przeciągnięciem z marginesu (zaznaczenie węzła w edytorze)', () => {
      // Zaznaczenie całego węzła p2 w kontenerze edytora (od indeksu 1 do 2)
      const range = dom.window.document.createRange();
      range.setStart(editor, 1);
      range.setEnd(editor, 2);

      const created = applyInlineMarkup(range, 'pad-mark-correct');

      assert.equal(editor.children.length, 3);
      assert.equal(editor.querySelectorAll('p').length, 3);
      assert.equal(editor.children[1].innerHTML, '<span class="pad-mark-correct">Second line</span>');
      assert.equal(editor.children[0].textContent, 'First line');
      assert.equal(editor.children[2].textContent, 'Third line');
    });

    test('4. Zaznaczenie częściowe (środek linii) — nie niszczy otaczającego tekstu', () => {
      editor.innerHTML = '<p>First line</p><p>Second line of text</p><p>Third line</p>';
      const p2 = editor.children[1] as HTMLElement;
      const textNode = p2.firstChild!;

      // Zaznaczamy słowo "line" w "Second line of text" (indeksy 7 do 11)
      const range = dom.window.document.createRange();
      range.setStart(textNode, 7);
      range.setEnd(textNode, 11);

      applyInlineMarkup(range, 'pad-mark-correction');

      assert.equal(editor.children.length, 3);
      assert.equal(p2.innerHTML, 'Second <span class="pad-mark-correction">line</span> of text');
      assert.equal(p2.textContent, 'Second line of text');
    });

    test('5. Obsługa wszystkich typów oznaczeń (error, correct, vocab, correction, accent)', () => {
      const marks = ['pad-mark-error', 'pad-mark-correct', 'pad-mark-vocab', 'pad-mark-correction', 'pad-mark-accent'];
      for (const mark of marks) {
        editor.innerHTML = '<p>Line A</p><p>Line B</p><p>Line C</p>';
        const pB = editor.children[1] as HTMLElement;
        const pC = editor.children[2] as HTMLElement;

        const range = dom.window.document.createRange();
        range.setStart(pB.firstChild!, 0);
        range.setEnd(pC, 0);

        applyInlineMarkup(range, mark);
        assert.equal(editor.children.length, 3);
        assert.equal(pB.innerHTML, `<span class="${mark}">Line B</span>`);
      }
    });

    test('6. Zaznaczenie linii zawierającej elementy zagnieżdżone (np. <b>bold</b>)', () => {
      editor.innerHTML = '<p>First line</p><p>Hello <b>bold</b> world</p><p>Third line</p>';
      const p2 = editor.children[1] as HTMLElement;
      const p3 = editor.children[2] as HTMLElement;

      const range = dom.window.document.createRange();
      range.setStart(p2.firstChild!, 0);
      range.setEnd(p3, 0);

      applyInlineMarkup(range, 'pad-mark-accent');

      assert.equal(editor.children.length, 3);
      assert.equal(p2.textContent, 'Hello bold world');
      // Sprawdzamy czy bold został zachowany
      assert.ok(p2.querySelector('b'), 'Tag <b> musi zostać zachowany wewnątrz');
      assert.ok(p2.innerHTML.includes('pad-mark-accent'));
      assert.equal(editor.children[0].textContent, 'First line');
      assert.equal(editor.children[2].textContent, 'Third line');
    });
  });

  describe('ScratchpadEditor — applyInlineStrikeCorrect (handleStrikeCorrect)', () => {
    test('1. Korekta na całej linii (Triple Click): brak osieroconych <p>, korekta w tym samym akapicie', () => {
      const p1 = editor.children[0] as HTMLElement;
      const p2 = editor.children[1] as HTMLElement;
      const p3 = editor.children[2] as HTMLElement;

      const range = dom.window.document.createRange();
      range.setStart(p2.firstChild!, 0);
      range.setEnd(p3, 0);

      const correction = applyInlineStrikeCorrect(range);

      assert.ok(correction, 'Musi zwrócić węzeł korekty');
      assert.equal(editor.children.length, 3, 'Liczba akapitów w edytorze musi pozostać nienaruszona (3)');
      assert.equal(editor.querySelectorAll('p').length, 3);

      // Przekreślony tekst i znacznik korekty muszą znajdować się WEWNĄTRZ tego samego akapitu p2
      assert.ok(p2.contains(correction), 'Znacznik korekty musi znajdować się wewnątrz sformatowanego akapitu');
      const struck = p2.querySelector('span[style*="line-through"]');
      assert.ok(struck, 'Musi powstać element z line-through');
      assert.equal(struck?.textContent, 'Second line');

      // Sąsiednie linie nienaruszone
      assert.equal(p1.textContent, 'First line');
      assert.equal(p3.textContent, 'Third line');
    });

    test('2. Korekta na części słowa w środku akapitu', () => {
      editor.innerHTML = '<p>First line</p><p>I have car</p><p>Third line</p>';
      const p2 = editor.children[1] as HTMLElement;
      const textNode = p2.firstChild!;

      // Zaznaczamy "have" (indeksy 2 do 6)
      const range = dom.window.document.createRange();
      range.setStart(textNode, 2);
      range.setEnd(textNode, 6);

      const correction = applyInlineStrikeCorrect(range);

      assert.ok(correction);
      assert.equal(editor.children.length, 3);
      assert.ok(p2.innerHTML.startsWith('I '));
      assert.ok(p2.innerHTML.endsWith(' car'));
      const struck = p2.querySelector('span[style*="line-through"]');
      assert.equal(struck?.textContent, 'have');
      assert.equal(editor.children[0].textContent, 'First line');
      assert.equal(editor.children[2].textContent, 'Third line');
    });
  });
});

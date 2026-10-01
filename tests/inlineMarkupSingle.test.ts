import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true"></div></body></html>', {
  url: 'http://localhost/',
});
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'NodeFilter']) {
  Object.defineProperty(globalThis, k, { value: (dom.window as any)[k], configurable: true, writable: true });
}

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyInlineMarkup, insertEmptyParagraph } from '../utils/scratchpadDom';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};
const select = (a: Node, ao: number, b: Node, bo: number): Range => {
  const r = dom.window.document.createRange();
  r.setStart(a, ao);
  r.setEnd(b, bo);
  return r;
};
const selectAll = (el: Element): Range => select(el, 0, el, el.childNodes.length);

describe('jeden znacznik pad-mark-* na fragment', () => {
  test('Błąd, potem Poprawnie na tym samym tekście: zostaje tylko Poprawnie', () => {
    const editor = mount('<p>hello world</p>');
    applyInlineMarkup(selectAll(editor.querySelector('p')!), 'pad-mark-error');
    assert.equal(editor.innerHTML, '<p><span class="pad-mark-error">hello world</span></p>');
    applyInlineMarkup(selectAll(editor.querySelector('p')!), 'pad-mark-correct');
    assert.equal(editor.innerHTML, '<p><span class="pad-mark-correct">hello world</span></p>');
  });

  test('zaznaczenie części znacznika rozcina go; reszta zostaje starym typem', () => {
    const editor = mount('<p><span class="pad-mark-error">alpha beta gamma</span></p>');
    const t = editor.querySelector('span')!.firstChild!;
    applyInlineMarkup(select(t, 6, t, 10), 'pad-mark-vocab');
    assert.equal(
      editor.innerHTML,
      '<p><span class="pad-mark-error">alpha </span><span class="pad-mark-vocab">beta</span><span class="pad-mark-error"> gamma</span></p>'
    );
  });

  test('ten sam typ ponownie: bez zmiany (brak zagnieżdżania)', () => {
    const editor = mount('<p><span class="pad-mark-error">word</span></p>');
    applyInlineMarkup(selectAll(editor.querySelector('p')!), 'pad-mark-error');
    assert.equal(editor.innerHTML, '<p><span class="pad-mark-error">word</span></p>');
  });

  test('Bold współistnieje ze znacznikiem (kategoria execCommand)', () => {
    const editor = mount('<p><b>bold text</b></p>');
    applyInlineMarkup(selectAll(editor.querySelector('p')!), 'pad-mark-correct');
    assert.equal(editor.innerHTML, '<p><b><span class="pad-mark-correct">bold text</span></b></p>');
    // zmiana znacznika nie gubi <b> wokół fragmentu
    applyInlineMarkup(selectAll(editor.querySelector('p')!), 'pad-mark-error');
    assert.equal(editor.innerHTML, '<p><b><span class="pad-mark-error">bold text</span></b></p>');
  });

  test('znacznik dookoła pogrubienia: zamiana zachowuje <b>', () => {
    const editor = mount('<p><span class="pad-mark-correct"><b>bold</b> plain</span></p>');
    const b = editor.querySelector('b')!.firstChild!;
    applyInlineMarkup(select(b, 0, b, 4), 'pad-mark-error');
    assert.equal(
      editor.innerHTML,
      '<p><b><span class="pad-mark-error">bold</span></b><span class="pad-mark-correct"> plain</span></p>'
    );
  });

  test('klasy spoza pad-mark-* nie wyzwalają zamiany', () => {
    const editor = mount('<p><span class="other">x y</span></p>');
    applyInlineMarkup(selectAll(editor.querySelector('p')!), 'pad-mark-accent');
    assert.equal(editor.innerHTML, '<p><span class="other"><span class="pad-mark-accent">x y</span></span></p>');
  });
});

describe('insertEmptyParagraph', () => {
  const caretIn = (node: Node, offset: number) => {
    const sel = dom.window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(select(node, offset, node, offset));
  };

  test('kursor w <p>: pusty akapit ląduje za nim, kursor w nowym', () => {
    const editor = mount('<p>one</p><p>two</p>');
    caretIn(editor.querySelector('p')!.firstChild!, 1);
    const p = insertEmptyParagraph(editor)!;
    assert.equal(editor.innerHTML, '<p>one</p><p><br></p><p>two</p>');
    assert.equal(dom.window.getSelection()!.anchorNode, p);
  });

  test('kursor w punkcie listy: akapit za całą listą', () => {
    const editor = mount('<ul><li>a</li><li>b</li></ul><p>x</p>');
    caretIn(editor.querySelector('li')!.firstChild!, 0);
    insertEmptyParagraph(editor);
    assert.equal(editor.innerHTML, '<ul><li>a</li><li>b</li></ul><p><br></p><p>x</p>');
  });

  test('brak kursora w edytorze: akapit na końcu', () => {
    const editor = mount('<p>one</p>');
    dom.window.getSelection()!.removeAllRanges();
    insertEmptyParagraph(editor);
    assert.equal(editor.innerHTML, '<p>one</p><p><br></p>');
  });

  test('zablokowany nagłówek: nic nie wstawia', () => {
    const editor = mount('<h2 class="pad-locked-heading"><span class="pad-heading-text">Lesson 1</span></h2><p>x</p>');
    caretIn(editor.querySelector('.pad-heading-text')!.firstChild!, 2);
    assert.equal(insertEmptyParagraph(editor), null);
    assert.equal(editor.querySelectorAll('p').length, 1);
  });
});

describe('znaczniki a pogrubienie', () => {
  test('CSS: .pad-mark-* nie mają font-weight >= 600 (inaczej Bold na znaczniku zdejmuje pogrubienie)', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const block = css.slice(css.indexOf('.pad-mark-error,'), css.indexOf('.pad-mark-error      {'));
    const accent = css.slice(css.indexOf('.pad-mark-accent {'), css.indexOf('.pad-mark-accent {') + 80);
    for (const b of [block, accent]) {
      const w = Number(/font-weight:\s*(\d+)/.exec(b)?.[1]);
      assert.ok(w > 0 && w < 600, `font-weight ${w}`);
    }
  });
});

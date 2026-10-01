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
import { toggleListFormat } from '../utils/scratchpadDom';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};

const rangeOver = (a: Node, b: Node): Range => {
  const r = dom.window.document.createRange();
  r.setStart(a, 0);
  r.setEnd(b, b.textContent!.length);
  return r;
};

describe('toggleListFormat', () => {
  test('zaznaczenie 2 linii + punktowana -> oba <li> w jednym <ul>', () => {
    const editor = mount('<p>one</p><p>two</p><p>three</p>');
    const ps = editor.querySelectorAll('p');
    assert.ok(toggleListFormat(rangeOver(ps[0].firstChild!, ps[1].firstChild!), 'bullet', editor));
    assert.equal(editor.innerHTML, '<ul><li>one</li><li>two</li></ul><p>three</p>');
  });

  test('toggle na już-liście wraca do <p>', () => {
    const editor = mount('<ul><li>one</li><li>two</li></ul>');
    const lis = editor.querySelectorAll('li');
    assert.ok(toggleListFormat(rangeOver(lis[0].firstChild!, lis[1].firstChild!), 'bullet', editor));
    assert.equal(editor.innerHTML, '<p>one</p><p>two</p>');
  });

  test('po toggle zaznaczenie zostaje na obu liniach (żywy range nie zapada się)', () => {
    const editor = mount('<ul><li>one</li><li>two</li></ul>');
    const lis = editor.querySelectorAll('li');
    const sel = dom.window.getSelection()!;
    const r = rangeOver(lis[0].firstChild!, lis[1].firstChild!);
    sel.removeAllRanges();
    sel.addRange(r);
    toggleListFormat(sel.getRangeAt(0), 'bullet', editor);
    assert.equal(sel.isCollapsed, false);
    assert.match(sel.toString(), /one[\s\S]*two/);
  });

  test('toggle jednego środkowego <li> dzieli listę', () => {
    const editor = mount('<ul><li>a</li><li>b</li><li>c</li></ul>');
    const r = dom.window.document.createRange();
    r.setStart(editor.querySelectorAll('li')[1].firstChild!, 1);
    r.collapse(true);
    assert.ok(toggleListFormat(r, 'bullet', editor));
    assert.equal(editor.innerHTML, '<ul><li>a</li></ul><p>b</p><ul><li>c</li></ul>');
  });

  test('numerowana na punktowanej zamienia typ bez zagnieżdżenia', () => {
    const editor = mount('<ul><li>one</li><li>two</li></ul>');
    const lis = editor.querySelectorAll('li');
    assert.ok(toggleListFormat(rangeOver(lis[0].firstChild!, lis[1].firstChild!), 'numbered', editor));
    assert.equal(editor.innerHTML, '<ol><li>one</li><li>two</li></ol>');
  });

  test('collapsed cursor działa na jednej linii', () => {
    const editor = mount('<p>one</p><p>two</p>');
    const r = dom.window.document.createRange();
    r.setStart(editor.querySelectorAll('p')[1].firstChild!, 1);
    r.collapse(true);
    assert.ok(toggleListFormat(r, 'numbered', editor));
    assert.equal(editor.innerHTML, '<p>one</p><ol><li>two</li></ol>');
  });

  test('sąsiednia lista tego samego typu jest scalana', () => {
    const editor = mount('<ul><li>a</li></ul><p>b</p>');
    const r = dom.window.document.createRange();
    r.setStart(editor.querySelector('p')!.firstChild!, 0);
    r.collapse(true);
    toggleListFormat(r, 'bullet', editor);
    assert.equal(editor.innerHTML, '<ul><li>a</li><li>b</li></ul>');
  });

  test('nagłówek i checklista wykluczone', () => {
    const html =
      '<h2 class="pad-locked-heading"><span class="pad-heading-text">Lesson 1</span></h2>' +
      '<div class="pad-task-item"><input type="checkbox">task</div><p>text</p>';
    const editor = mount(html);
    const heading = editor.querySelector('.pad-heading-text')!;
    const task = editor.querySelector('.pad-task-item')!;

    const r1 = dom.window.document.createRange();
    r1.setStart(heading.firstChild!, 1);
    r1.collapse(true);
    assert.equal(toggleListFormat(r1, 'bullet', editor), false);

    const r2 = dom.window.document.createRange();
    r2.setStart(task.lastChild!, 1);
    r2.collapse(true);
    assert.equal(toggleListFormat(r2, 'bullet', editor), false);
    assert.equal(editor.innerHTML, html);

    // zaznaczenie obejmujące nagłówek, checklistę i akapit: zmienia tylko akapit
    assert.ok(toggleListFormat(rangeOver(heading.firstChild!, editor.querySelector('p')!.firstChild!), 'bullet', editor));
    assert.equal(editor.querySelectorAll('.pad-locked-heading, .pad-task-item').length, 2);
    assert.equal(editor.querySelectorAll('ul > li').length, 1);
  });
});

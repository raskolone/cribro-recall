import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor"></div></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonTemplate, highestLessonNumber } from '../utils/lessonTemplate';
import { headingPlainText } from '../utils/scratchpadDom';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};

describe('edytowalny tekst nagłówka lekcji', () => {
  test('h2 i strzałka zostają zablokowane, edytowalny jest tylko span z tytułem', () => {
    const editor = mount(buildLessonTemplate({ lessonNumber: 3, date: '30.09.2026' }));
    const h2 = editor.querySelector('h2')!;
    assert.equal(h2.getAttribute('contenteditable'), 'false');
    assert.equal(h2.querySelector('.pad-toggle')!.getAttribute('contenteditable'), 'false');
    const text = h2.querySelector('.pad-heading-text')!;
    assert.equal(text.getAttribute('contenteditable'), 'true');
    assert.equal(text.textContent, 'Lesson 3 — 30.09.2026');
    assert.equal(h2.querySelectorAll('[contenteditable="true"]').length, 1);
  });

  test('spis treści (headingPlainText) pomija strzałkę i widzi ręczną poprawkę tekstu', () => {
    const editor = mount(buildLessonTemplate({ lessonNumber: 3, date: '30.09.2026' }));
    const h2 = editor.querySelector('h2') as HTMLElement;
    assert.equal(headingPlainText(h2), 'Lesson 3 — 30.09.2026');

    editor.querySelector('.pad-heading-text')!.textContent = 'Lesson 4 — po poprawce';
    assert.equal(headingPlainText(h2), 'Lesson 4 — po poprawce');
    assert.ok(!headingPlainText(h2).includes('▾'));
  });

  test('highestLessonNumber bierze numer poprawiony ręcznie w tekście nagłówka', () => {
    const first = mount(buildLessonTemplate({ lessonNumber: 5, date: '30.09.2026' }));
    assert.equal(highestLessonNumber(first.innerHTML), 5);

    // lektor poprawia błędny numer 5 → 12 palcem w edytowalnym spanie
    first.querySelector('.pad-heading-text')!.textContent = 'Lesson 12 — 30.09.2026';
    assert.equal(highestLessonNumber(first.innerHTML), 12);
    assert.ok(buildLessonTemplate({ previousHtml: first.innerHTML }).includes('Lesson 13 —'));
  });

  test('zwijanie wszystkich: pętla po [data-toggle="1"] ustawia data-collapsed="1" i chowa treść', () => {
    const lesson = (n: number) => buildLessonTemplate({ lessonNumber: n, date: '30.09.2026' });
    const editor = mount(lesson(1) + lesson(2) + lesson(3));
    const headings = Array.from(editor.querySelectorAll('[data-toggle="1"]')) as HTMLElement[];
    assert.equal(headings.length, 3);

    // ta sama logika co setSectionCollapsed + handleCollapseAll w ScratchpadEditor
    const collapse = (heading: HTMLElement, collapsed: boolean) => {
      const level = Number(heading.tagName.charAt(1));
      let node = heading.nextElementSibling as HTMLElement | null;
      while (node) {
        const match = /^H([1-6])$/.exec(node.tagName);
        if (match && Number(match[1]) <= level) break;
        node.style.display = collapsed ? 'none' : '';
        node = node.nextElementSibling as HTMLElement | null;
      }
      heading.setAttribute('data-collapsed', collapsed ? '1' : '0');
    };
    headings.forEach(h => collapse(h, true));

    assert.ok(headings.every(h => h.getAttribute('data-collapsed') === '1'));
    for (const h of headings) {
      const sibling = h.nextElementSibling as HTMLElement | null;
      if (sibling && !/^H[12]$/.test(sibling.tagName)) assert.equal(sibling.style.display, 'none');
    }
  });
});

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
import { selectLineFromTarget } from '../utils/scratchpadDom';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};

describe('selectLineFromTarget — podwójny klik zaznaczający całą linię', () => {
  test('1. Podwójny klik w środku zwykłego akapitu zaznacza cały akapit', () => {
    const editor = mount('<p>To jest pierwsze zdanie akapitu do przetestowania.</p>');
    const p = editor.querySelector('p')!;
    const textNode = p.firstChild as Text;

    const handled = selectLineFromTarget(textNode.parentElement, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'To jest pierwsze zdanie akapitu do przetestowania.');
  });

  test('2. Podwójny klik na zagnieżdżonym elemencie (strong/span) w akapicie zaznacza cały akapit', () => {
    const editor = mount('<p>Początek zdania <strong>bardzo ważny fragment</strong> koniec zdania.</p>');
    const strong = editor.querySelector('strong')!;

    const handled = selectLineFromTarget(strong, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'Początek zdania bardzo ważny fragment koniec zdania.');
  });

  test('3. Podwójny klik w element listy <li> zaznacza dokładnie ten punkt listy', () => {
    const editor = mount('<ul><li>Pierwszy punkt</li><li>Drugi punkt z <em>akcentem</em></li></ul>');
    const secondLi = editor.querySelectorAll('li')[1];
    const em = secondLi.querySelector('em')!;

    const handled = selectLineFromTarget(em, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'Drugi punkt z akcentem');
  });

  test('4. Podwójny klik w nagłówku z .pad-toggle zaznacza TYLKO tekst .pad-heading-text (bez ikony zwijania)', () => {
    const editor = mount(
      '<h2 class="pad-locked-heading" contenteditable="false">' +
        '<span class="pad-toggle" contenteditable="false" title="Zwiń">▾</span>' +
        '<span class="pad-heading-text" contenteditable="true">Lesson 12 — 30.09.2026 • Grammar</span>' +
      '</h2>'
    );
    const headingText = editor.querySelector('.pad-heading-text') as HTMLElement;

    const handled = selectLineFromTarget(headingText, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'Lesson 12 — 30.09.2026 • Grammar');
    assert.ok(!selection?.toString().includes('▾'), 'Zaznaczenie nie może zawierać ikony zwijania ▾');
  });

  test('5. Podwójny klik w kontener H2 zawierający .pad-heading-text wybiera wyłącznie tekst wewnątrz .pad-heading-text', () => {
    const editor = mount(
      '<h2 class="pad-locked-heading" contenteditable="false">' +
        '<span class="pad-toggle" contenteditable="false">▾</span>' +
        '<span class="pad-heading-text" contenteditable="true">Lesson 5 — 30.09.2026</span>' +
      '</h2>'
    );
    const h2 = editor.querySelector('h2') as HTMLElement;

    const handled = selectLineFromTarget(h2, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'Lesson 5 — 30.09.2026');
    assert.ok(!selection?.toString().includes('▾'));
  });

  test('6. Podwójny klik w ikonę zwijania .pad-toggle nie zaznacza linii (zwraca false)', () => {
    const editor = mount(
      '<h2 class="pad-locked-heading" contenteditable="false">' +
        '<span class="pad-toggle" contenteditable="false">▾</span>' +
        '<span class="pad-heading-text" contenteditable="true">Lesson 1 — 30.09.2026</span>' +
      '</h2>'
    );
    const toggle = editor.querySelector('.pad-toggle') as HTMLElement;

    const handled = selectLineFromTarget(toggle, editor);
    assert.equal(handled, false);
  });

  test('7. Podwójny klik w kontrolkę formularza / checkbox nie jest blokowany (zwraca false)', () => {
    const editor = mount('<div><input type="checkbox" id="chk" /> Zadanie do wykonania</div>');
    const checkbox = editor.querySelector('#chk') as HTMLElement;

    const handled = selectLineFromTarget(checkbox, editor);
    assert.equal(handled, false);
  });

  test('8. Podwójny klik w elementy specjalne (podział strony, załącznik) zwraca false', () => {
    const editor = mount(
      '<div class="pad-page-break" data-page-break="1"><span class="pad-page-break-badge">── Strona A4 ──</span></div>'
    );
    const badge = editor.querySelector('.pad-page-break-badge') as HTMLElement;

    const handled = selectLineFromTarget(badge, editor);
    assert.equal(handled, false);
  });

  test('9. Podwójny klik w komórkę tabeli <td> zaznacza zawartość komórki', () => {
    const editor = mount('<table><tbody><tr><td>Treść komórki tabeli</td></tr></tbody></table>');
    const td = editor.querySelector('td') as HTMLElement;

    const handled = selectLineFromTarget(td, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'Treść komórki tabeli');
  });

  test('10. Zaznaczenie <li> z zagnieżdżoną listą <ul> zaznacza TYLKO linię nadrzędną, bez dzieci', () => {
    const editor = mount(
      '<ul>' +
        '<li>' +
          'Punkt nadrzędny listy' +
          '<ul>' +
            '<li>Punkt zagnieżdżony 1</li>' +
            '<li>Punkt zagnieżdżony 2</li>' +
          '</ul>' +
        '</li>' +
      '</ul>'
    );
    const parentLi = editor.querySelector('li')!;
    const textNode = parentLi.firstChild as Text;

    const handled = selectLineFromTarget(textNode.parentElement, editor);
    assert.equal(handled, true);

    const selection = dom.window.getSelection();
    assert.equal(selection?.toString(), 'Punkt nadrzędny listy');
    assert.ok(!selection?.toString().includes('zagnieżdżony'), 'Zaznaczenie nie może obejmować zagnieżdżonych dzieci');
  });
});

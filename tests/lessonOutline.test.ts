import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor"></div></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonTemplate } from '../utils/lessonTemplate';
import {
  buildTocEntries,
  findParentLesson,
  isLastLessonCollapsed,
  isLessonHeading,
  sectionBodyNodes,
  setSectionCollapsed,
} from '../utils/lessonOutline';

const mount = (html: string): HTMLElement => {
  const editor = dom.window.document.getElementById('editor')!;
  editor.innerHTML = html;
  return editor;
};

let idCounter = 0;
const ensureId = (h: HTMLElement): string => {
  if (!h.id) h.id = `pad-h-${idCounter++}`;
  return h.id;
};

/** Dwie lekcje z szablonu, w każdej własny H2 lektora wstawiony w środek treści. */
const twoLessonsWithTeacherHeadings = (): HTMLElement => {
  const editor = mount(
    buildLessonTemplate({ lessonNumber: 1, date: '01.10.2026' }) +
      buildLessonTemplate({ lessonNumber: 2, date: '02.10.2026', previousHtml: '<p>x</p>' })
  );
  const lessons = Array.from(editor.querySelectorAll('h2[data-toggle="1"]')) as HTMLElement[];
  lessons.forEach((lesson, i) => {
    // Za pierwszą sekcją H3 lekcji — w środku treści, przed kolejnymi sekcjami
    const firstH3 = lesson.nextElementSibling!;
    const teacherH2 = dom.window.document.createElement('h2');
    teacherH2.textContent = `Moje słówka ${i + 1}`;
    firstH3.insertAdjacentElement('afterend', teacherH2);
    const p = dom.window.document.createElement('p');
    p.textContent = `po nagłówku lektora ${i + 1}`;
    teacherH2.insertAdjacentElement('afterend', p);
  });
  return editor;
};

const visible = (el: Element) => (el as HTMLElement).style.display !== 'none';

describe('rozróżnienie lekcja / nagłówek lektora', () => {
  test('h2 z szablonu jest lekcją, h1/h2 z przybornika nie', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const h2s = Array.from(editor.querySelectorAll('h2'));
    assert.deepEqual(h2s.map(isLessonHeading), [true, false, true, false]);
    const h1 = dom.window.document.createElement('h1');
    assert.equal(isLessonHeading(h1), false);
  });

  test('stara lekcja bez klasy pad-locked-heading nadal jest lekcją', () => {
    const editor = mount('<h2 data-toggle="1" data-collapsed="0"><span class="pad-toggle">▾</span>Lesson 1</h2>');
    assert.equal(isLessonHeading(editor.querySelector('h2')), true);
  });
});

describe('spis treści — hierarchia', () => {
  test('2 lekcje, każda z zagnieżdżonym H2 lektora', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const toc = buildTocEntries(editor, ensureId);
    assert.equal(toc.length, 4);
    const [l1, c1, l2, c2] = toc;
    assert.equal(l1.isLesson, true);
    assert.equal(l1.parentId, undefined);
    assert.equal(c1.isLesson, false);
    assert.equal(c1.parentId, l1.id);
    assert.equal(c1.text, 'Moje słówka 1');
    assert.equal(l2.isLesson, true);
    assert.equal(l2.parentId, undefined);
    assert.equal(c2.parentId, l2.id);
  });

  test('nagłówki przed pierwszą lekcją zostają na najwyższym poziomie', () => {
    const editor = mount('<h1>Notatki ogólne</h1><p>x</p>' + buildLessonTemplate({ lessonNumber: 1, date: '01.10.2026', previousHtml: '<p>x</p>' }));
    const toc = buildTocEntries(editor, ensureId);
    assert.equal(toc[0].text, 'Notatki ogólne');
    assert.equal(toc[0].parentId, undefined);
    assert.equal(toc[0].isLesson, false);
    assert.equal(toc[1].isLesson, true);
  });

  test('dokument z samymi lekcjami: same wiersze lekcji, bez dzieci', () => {
    const editor = mount(
      buildLessonTemplate({ lessonNumber: 1, date: '01.10.2026' }) +
        buildLessonTemplate({ lessonNumber: 2, date: '02.10.2026', previousHtml: '<p>x</p>' })
    );
    const toc = buildTocEntries(editor, ensureId);
    assert.equal(toc.length, 2);
    assert.ok(toc.every(e => e.isLesson && !e.parentId));
  });
});

describe('zwijanie lekcji w treści', () => {
  test('zwinięcie pierwszej lekcji chowa wszystko łącznie z H2 lektora, druga nienaruszona', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const [lesson1, lesson2] = Array.from(editor.querySelectorAll('h2[data-toggle="1"]')) as HTMLElement[];
    setSectionCollapsed(lesson1, true);

    const teacherH2 = Array.from(editor.querySelectorAll('h2')).find(h => h.textContent === 'Moje słówka 1')!;
    assert.equal(visible(teacherH2), false);
    assert.equal(visible(teacherH2.nextElementSibling!), false);
    // Ostatni węzeł lekcji 1 (przed separatorem) też schowany
    const pageBreak = editor.querySelector('.pad-page-break') as HTMLElement;
    assert.equal(visible(pageBreak.previousElementSibling!), false);
    // Separator i cała lekcja 2 widoczne
    assert.equal(visible(pageBreak), true);
    assert.equal(visible(lesson2), true);
    let node = lesson2.nextElementSibling;
    while (node) {
      assert.equal(visible(node), true);
      node = node.nextElementSibling;
    }
    assert.equal(lesson1.getAttribute('data-collapsed'), '1');

    setSectionCollapsed(lesson1, false);
    assert.ok(sectionBodyNodes(lesson1).every(visible));
  });

  test('ostatnia lekcja zwija się do końca dokumentu', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const lessons = Array.from(editor.querySelectorAll('h2[data-toggle="1"]')) as HTMLElement[];
    setSectionCollapsed(lessons[1], true);
    assert.equal(visible(editor.lastElementChild!), false);
    assert.equal(visible(lessons[0].nextElementSibling!), true);
  });

  test('separator schowany przez starą wersję zwijania wraca przy przełączeniu lekcji', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const lesson1 = editor.querySelector('h2[data-toggle="1"]') as HTMLElement;
    const pageBreak = editor.querySelector('.pad-page-break') as HTMLElement;
    pageBreak.style.display = 'none';
    setSectionCollapsed(lesson1, false);
    assert.equal(visible(pageBreak), true);
  });

  test('zwijany nagłówek lektora (stary dokument) nie wychodzi poza swoją lekcję', () => {
    const editor = mount(
      '<h1 data-toggle="1">Stary rozdział</h1><p>a</p>' +
        '<div class="pad-page-break"></div>' +
        '<h2 data-toggle="1">Lesson 1</h2><p>b</p>'
    );
    const h1 = editor.querySelector('h1') as HTMLElement;
    assert.equal(sectionBodyNodes(h1).length, 1);
  });
});

describe('rodzic nagłówka lektora', () => {
  test('findParentLesson znajduje lekcję, także dla nagłówka zagnieżdżonego w <div>', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const [lesson1, lesson2] = Array.from(editor.querySelectorAll('h2[data-toggle="1"]')) as HTMLElement[];
    const teacher2 = Array.from(editor.querySelectorAll('h2')).find(h => h.textContent === 'Moje słówka 2')!;
    assert.equal(findParentLesson(teacher2, editor), lesson2);

    const div = dom.window.document.createElement('div');
    div.innerHTML = '<h2>W treści AI</h2>';
    lesson1.nextElementSibling!.insertAdjacentElement('afterend', div);
    assert.equal(findParentLesson(div.querySelector('h2')!, editor), lesson1);
  });

  test('nagłówek przed pierwszą lekcją nie ma rodzica', () => {
    const editor = mount('<h1>Wstęp</h1>' + buildLessonTemplate({ lessonNumber: 1, date: '01.10.2026', previousHtml: '<p>x</p>' }));
    assert.equal(findParentLesson(editor.querySelector('h1')!, editor), null);
  });
});

describe('puste nagłówki w spisie treści', () => {
  const emptyTeacherH2 = (editor: HTMLElement): HTMLElement => {
    const h = dom.window.document.createElement('h2');
    h.innerHTML = '<br>';
    editor.querySelector('h3')!.insertAdjacentElement('afterend', h);
    return h;
  };

  test('pusty H2 lektora nie ma wpisu; z tekstem ma; po skasowaniu tekstu znów nie ma', () => {
    const editor = mount(buildLessonTemplate({ lessonNumber: 1, date: '01.10.2026' }));
    const h = emptyTeacherH2(editor);
    assert.equal(buildTocEntries(editor, ensureId).length, 1);
    h.textContent = 'Moje słówka';
    const withText = buildTocEntries(editor, ensureId);
    assert.deepEqual(withText.map(e => e.text), ['Lesson 1 — 01.10.2026', 'Moje słówka']);
    h.innerHTML = '<br>';
    assert.equal(buildTocEntries(editor, ensureId).length, 1);
  });

  test('wyczyszczony tytuł lekcji zostaje w spisie z pozycją zamiast „Bez tytułu"', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const lessons = Array.from(editor.querySelectorAll('h2[data-toggle="1"]')) as HTMLElement[];
    lessons[1].querySelector('.pad-heading-text')!.textContent = '';
    const toc = buildTocEntries(editor, ensureId);
    const lesson2 = toc.filter(e => e.isLesson)[1];
    assert.equal(lesson2.text, 'Lekcja 2 (bez tytułu)');
    assert.ok(toc.every(e => e.text !== 'Bez tytułu'));
    // dziecko tej lekcji nadal do niej należy
    assert.equal(toc.find(e => e.text === 'Moje słówka 2')!.parentId, lesson2.id);
  });
});

describe('minimalna wysokość kartki a zwinięcie ostatniej lekcji', () => {
  test('isLastLessonCollapsed patrzy tylko na ostatnią lekcję', () => {
    const editor = twoLessonsWithTeacherHeadings();
    const [l1, l2] = Array.from(editor.querySelectorAll('h2[data-toggle="1"]')) as HTMLElement[];
    assert.equal(isLastLessonCollapsed(buildTocEntries(editor, ensureId)), false);
    setSectionCollapsed(l1, true);
    assert.equal(isLastLessonCollapsed(buildTocEntries(editor, ensureId)), false);
    setSectionCollapsed(l2, true);
    assert.equal(isLastLessonCollapsed(buildTocEntries(editor, ensureId)), true);
    setSectionCollapsed(l2, false);
    assert.equal(isLastLessonCollapsed(buildTocEntries(editor, ensureId)), false);
  });

  test('dokument bez lekcji: nie jest zwinięty', () => {
    assert.equal(isLastLessonCollapsed(buildTocEntries(mount('<h1>x</h1>'), ensureId)), false);
  });
});

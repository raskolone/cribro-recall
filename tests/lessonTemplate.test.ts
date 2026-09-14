import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLessonTemplate,
  highestLessonNumber,
} from '../utils/lessonTemplate';

describe('utils/lessonTemplate', () => {
  it('pusty dokument daje pierwszą lekcję', () => {
    assert.equal(highestLessonNumber(''), 0);
    assert.ok(buildLessonTemplate({ previousHtml: '' }).includes('Lesson 1 —'));
  });

  it('numer bierze się z najwyższego nagłówka, nie z ostatniego', () => {
    const html = '<h2>Lesson 31 — 01.09.2026</h2><p>x</p><h2>Lesson 12 — 02.09.2026</h2>';
    assert.equal(highestLessonNumber(html), 31);
    assert.ok(buildLessonTemplate({ previousHtml: html }).includes('Lesson 32 —'));
  });

  it('rozpoznaje polski zapis nagłówka', () => {
    assert.equal(highestLessonNumber('<h2>Lekcja 7 — 13.05.2026</h2>'), 7);
    assert.equal(highestLessonNumber('<h1>Lekcja nr 9</h1>'), 9);
  });

  it('numer w treści notatki NIE przesuwa licznika', () => {
    const html = '<h2>Lesson 3 — 01.09.2026</h2><p>Przerabiamy Lesson 45 z podręcznika.</p>';
    assert.equal(highestLessonNumber(html), 3);
  });

  it('numer podany wprost wygrywa z wyliczonym', () => {
    const html = '<h2>Lesson 5 — 01.09.2026</h2>';
    assert.ok(buildLessonTemplate({ previousHtml: html, lessonNumber: 99 }).includes('Lesson 99 —'));
  });

  it('szablon niesie wszystkie pięć sekcji', () => {
    const html = buildLessonTemplate({});
    ['Revision', 'Main topic / Practice', 'Lesson Summary', 'Corrections', 'Homework'].forEach(
      title => assert.ok(html.includes(title), title)
    );
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLessonTemplate,
  extractLastLessonSections,
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

  it('revisionHtml wygrywa z recallItems w sekcji Revision', () => {
    const html = buildLessonTemplate({
      revisionHtml: '<p>WYGENEROWANA POWTÓRKA</p>',
      recallItems: { corrections: ['zły błąd'], vocabulary: ['słowo'] },
    });
    assert.ok(html.includes('WYGENEROWANA POWTÓRKA'));
    assert.ok(!html.includes('zły błąd'));
  });

  describe('extractLastLessonSections', () => {
    it('brak lekcji w dokumencie daje null (Lesson 1)', () => {
      assert.equal(extractLastLessonSections(''), null);
      assert.equal(extractLastLessonSections('<p>Notatka bez lekcji</p>'), null);
    });

    it('wyciąga sekcje z OSTATNIEJ lekcji, nie z wcześniejszych', () => {
      const html = [
        '<h2>Lesson 1 — 01.09.2026</h2>',
        '<h3>Main topic / Practice</h3><p>Stara lekcja — tematyka X</p>',
        '<h3>Key Language &amp; Corrections (New words)</h3><p>Stare słówka</p>',
        '<h2>Lesson 2 — 08.09.2026</h2>',
        '<h3>Main topic / Practice</h3><p>Present Perfect, podróże</p>',
        '<h3>Key Language &amp; Corrections (New words)</h3><p>go -&gt; went, luggage</p>',
      ].join('');

      const sections = extractLastLessonSections(html);
      assert.ok(sections);
      assert.ok(sections!.mainTopic.includes('Present Perfect'));
      assert.ok(!sections!.mainTopic.includes('tematyka X'));
      assert.ok(sections!.keyLanguage.includes('luggage'));
      assert.ok(!sections!.keyLanguage.includes('Stare słówka'));
    });
  });
});

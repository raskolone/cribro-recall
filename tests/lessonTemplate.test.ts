import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLessonTemplate,
  buildLessonTitleText,
  templateDate,
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

  it('tytuł zawsze niesie datę; temat (opcjonalny) jest dopisany obok, nie zamiast daty', () => {
    const withTopic = buildLessonTemplate({ topic: 'Business Negotiations', date: '30.09.2026' });
    assert.ok(withTopic.includes('Lesson 1 — 30.09.2026 • Business Negotiations'));

    const withoutTopic = buildLessonTemplate({ date: '30.09.2026' });
    assert.ok(withoutTopic.includes('>Lesson 1 — 30.09.2026</span>'));
    assert.ok(!withoutTopic.includes('•'));

    const blankTopic = buildLessonTemplate({ topic: '   ', date: '30.09.2026' });
    assert.ok(blankTopic.includes('>Lesson 1 — 30.09.2026</span>'));
  });

  it('data w tytule domyślnie pochodzi z systemu, gdy nie podano date', () => {
    assert.ok(buildLessonTemplate({ topic: 'X' }).includes(`— ${templateDate()} • X`));
  });

  it('temat jest escapowany w HTML, ale podgląd (buildLessonTitleText) zostaje zwykłym tekstem', () => {
    assert.ok(buildLessonTemplate({ topic: 'Q&A <b>', date: 'd' }).includes('d • Q&amp;A &lt;b&gt;'));
    assert.equal(buildLessonTitleText(2, 'd', 'Q&A'), 'Lesson 2 — d • Q&A');
  });

  it('tytuł z datą i tematem nadal daje poprawny numer następnej lekcji', () => {
    const html = buildLessonTemplate({ lessonNumber: 7, topic: 'Travel', date: '30.09.2026' });
    assert.equal(highestLessonNumber(html), 7);
  });

  it('nagłówki szablonów nie są wliczane do numeracji', () => {
    const html = '<h2>Lesson 5 — Szablon Lekcji</h2><p>x</p><h2>Draft Template #12</h2>';
    assert.equal(highestLessonNumber(html), 0);
  });

  it('szablon niesie dokładnie cztery sekcje w nowej kolejności i bez fake tekstów', () => {
    const html = buildLessonTemplate({ cleanEmpty: true });
    ['QUICK RECALL', 'TODAY’S LESSON', 'LANGUAGE NOTES', 'AFTER THE LESSON'].forEach(
      title => assert.ok(html.includes(title), title)
    );
    assert.ok(!html.includes('Marek'));
  });

  it('revisionHtml wygrywa z recallItems w sekcji Quick Recall', () => {
    const html = buildLessonTemplate({
      revisionHtml: '<p>WYGENEROWANY QUICK RECALL</p>',
      recallItems: { corrections: ['zły błąd'], vocabulary: ['słowo'] },
    });
    assert.ok(html.includes('WYGENEROWANY QUICK RECALL'));
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

    it('fallbackText niesie treść całej ostatniej lekcji, gdy Main topic/Key Language są puste', () => {
      const html = [
        '<h2 data-toggle="1" data-collapsed="0"><span class="pad-toggle">▾</span>Lesson 1 — 18.09.2026</h2>',
        '<h3>Main topic / Practice</h3><p><br></p>',
        '<h3>Key Language &amp; Corrections (New words)</h3><p><br></p>',
        '<h3>Homework</h3><p>Przeczytaj rozdział o Present Perfect</p>',
      ].join('');

      const sections = extractLastLessonSections(html);
      assert.ok(sections);
      assert.equal(sections!.mainTopic, '');
      assert.equal(sections!.keyLanguage, '');
      assert.ok(sections!.fallbackText.includes('Present Perfect'));
    });
  });
});

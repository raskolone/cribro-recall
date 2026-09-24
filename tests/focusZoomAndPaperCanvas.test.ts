import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lessonTitleStyle,
  sectionHeadingStyle,
  buildLessonTemplate,
  LESSON_SECTIONS,
} from '../utils/lessonTemplate';
import { FocusBoundingBox } from '../components/scratchpad/FocusZoomSelectionLayer';
import { prefersReducedMotion } from '../services/gsapAnimations';

describe('9A. Lesson Canvas — Paper-Like Surface & Semantic Headings', () => {
  it('Nagłówki sekcji mają semantyczne kolory o wysokim kontraście na papierze', () => {
    const quickRecallHeading = sectionHeadingStyle('QUICK RECALL');
    const todayLessonHeading = sectionHeadingStyle('TODAY’S LESSON');
    const languageNotesHeading = sectionHeadingStyle('LANGUAGE NOTES');
    const afterLessonHeading = sectionHeadingStyle('AFTER THE LESSON');

    // Quick Recall -> Morski/Teal #0f766e
    assert.ok(quickRecallHeading.includes('#0f766e'), 'Quick recall używa teal #0f766e');
    // Today's Lesson -> Szmaragd #0d8a5f
    assert.ok(todayLessonHeading.includes('#0d8a5f'), 'Today lesson używa emerald #0d8a5f');
    // Language Notes -> Indygo #4338ca
    assert.ok(languageNotesHeading.includes('#4338ca'), 'Language notes używa indigo #4338ca');
    // After the lesson -> Bursztyn #b45309
    assert.ok(afterLessonHeading.includes('#b45309'), 'After the lesson używa amber #b45309');

    // Wielkość i krój
    assert.ok(quickRecallHeading.includes('font-size:15px'));
    assert.ok(quickRecallHeading.includes('text-transform:uppercase'));
  });

  it('Tytuł lekcji ma spójną typografię z akcentem na jasnym papierze', () => {
    const titleStyle = lessonTitleStyle('light');
    assert.ok(titleStyle.includes('font-size:22px'));
    assert.ok(titleStyle.includes('color:#0f172a'));
    assert.ok(titleStyle.includes('border-bottom:2px solid'));
  });

  it('Szablon lekcji buduje 4 semantyczne sekcje z poprawnymi nagłówkami', () => {
    const html = buildLessonTemplate({ lessonNumber: 1, cleanEmpty: true });
    assert.ok(html.includes('QUICK RECALL'));
    assert.ok(html.includes('TODAY’S LESSON'));
    assert.ok(html.includes('LANGUAGE NOTES'));
    assert.ok(html.includes('AFTER THE LESSON'));
    assert.ok(html.includes('color:#0f766e'));
    assert.ok(html.includes('color:#0d8a5f'));
    assert.ok(html.includes('color:#4338ca'));
    assert.ok(html.includes('color:#b45309'));
  });
});

describe('9B. Focus Zoom — Bounding Box & Scale Calculations', () => {
  it('Obliczenie bounding box dla zaznaczenia prostokątnego', () => {
    const start = { x: 100, y: 150 };
    const current = { x: 400, y: 350 };

    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    const box: FocusBoundingBox = { left, top, width, height, sourceType: 'rectangle' };

    assert.equal(box.left, 100);
    assert.equal(box.top, 150);
    assert.equal(box.width, 300);
    assert.equal(box.height, 200);
  });

  it('Obliczenie bounding box dla zaznaczenia lasso (punkty odręczne)', () => {
    const lassoPoints = [
      { x: 120, y: 200 },
      { x: 180, y: 180 },
      { x: 260, y: 220 },
      { x: 300, y: 310 },
      { x: 210, y: 350 },
      { x: 140, y: 290 },
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    lassoPoints.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });

    const box: FocusBoundingBox = {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
      sourceType: 'lasso',
    };

    assert.equal(box.left, 120);
    assert.equal(box.top, 180);
    assert.equal(box.width, 180);
    assert.equal(box.height, 170);
  });

  it('Kalkulacja optymalnej skali powiększenia Focus Zoom mieści się w zakresie [1.0x, 3.0x]', () => {
    const containerW = 1200;
    const containerH = 800;

    // 1. Mały fragment (np. jedno słówko 80x40) -> powinien zostać ograniczony do max 3.0x, aby uniknąć pikselizacji
    const smallBox = { width: 80, height: 40 };
    const scaleSmall = Math.max(
      1.0,
      Math.min(3.0, Math.min((containerW * 0.88) / smallBox.width, (containerH * 0.85) / smallBox.height))
    );
    assert.equal(scaleSmall, 3.0, 'Maksymalny zoom nie przekracza 3.0x');

    // 2. Średni fragment (tabela / pytanie 400x250)
    const mediumBox = { width: 400, height: 250 };
    const scaleMedium = Math.max(
      1.0,
      Math.min(3.0, Math.min((containerW * 0.88) / mediumBox.width, (containerH * 0.85) / mediumBox.height))
    );
    assert.ok(scaleMedium >= 2.0 && scaleMedium <= 3.0, 'Średni fragment otrzymuje naturalne powiększenie ~2.6x');

    // 3. Duży fragment (prawie cała strona 750x900)
    const largeBox = { width: 750, height: 900 };
    const scaleLarge = Math.max(
      1.0,
      Math.min(3.0, Math.min((containerW * 0.88) / largeBox.width, (containerH * 0.85) / largeBox.height))
    );
    assert.ok(scaleLarge <= 1.5, 'Duży obszar nie jest nadmiernie przeskalowany');
  });

  it('prefersReducedMotion działa bezpiecznie w środowisku bez DOM i w przeglądarce', () => {
    const reduced = prefersReducedMotion();
    assert.equal(typeof reduced, 'boolean');
  });
});

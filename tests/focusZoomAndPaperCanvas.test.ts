import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lessonTitleStyle,
  sectionHeadingStyle,
  buildLessonTemplate,
  LESSON_SECTIONS,
} from '../utils/lessonTemplate';
import { prefersReducedMotion } from '../services/gsapAnimations';
import {
  viewportPointToDocumentPoint,
  viewportRectToDocumentRect,
  documentRectToViewportRect,
  clampFocusRect,
  computeLassoBoundingBox,
  calculateFocusTransform,
} from '../utils/focusZoomGeometry';

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

describe('9B. Focus Zoom — Geometry & Coordinate Systems', () => {
  it('viewportPointToDocumentPoint przelicza punkt ekranu na współrzędne dokumentu A4', () => {
    const paperRect = { left: 200, top: 100, width: 800, height: 1100 };
    const pt = viewportPointToDocumentPoint({ x: 350, y: 400 }, paperRect);

    assert.equal(pt.x, 150);
    assert.equal(pt.y, 300);
  });

  it('viewportRectToDocumentRect oraz documentRectToViewportRect są wzajemnie odwracalne', () => {
    const paperRect = { left: 150, top: 80, width: 794, height: 1123 };
    const viewRect = { left: 300, top: 250, width: 300, height: 200 };

    const docRect = viewportRectToDocumentRect(viewRect, paperRect);
    assert.equal(docRect.left, 150);
    assert.equal(docRect.top, 170);
    assert.equal(docRect.width, 300);
    assert.equal(docRect.height, 200);

    const backToView = documentRectToViewportRect(docRect, paperRect);
    assert.equal(backToView.left, viewRect.left);
    assert.equal(backToView.top, viewRect.top);
    assert.equal(backToView.width, viewRect.width);
    assert.equal(backToView.height, viewRect.height);
  });

  it('clampFocusRect przycina prostokąt do granic strony A4', () => {
    const clamped = clampFocusRect(
      { left: -20, top: 1100, width: 400, height: 200 },
      { width: 794, height: 1123 }
    );

    assert.equal(clamped.left, 0);
    assert.equal(clamped.top, 1100);
    assert.equal(clamped.width, 400);
    assert.equal(clamped.height, 23); // 1123 - 1100
  });

  it('computeLassoBoundingBox wyznacza bounding box ze wszystkich punktów lasso', () => {
    const points = [
      { x: 120, y: 200 },
      { x: 180, y: 180 },
      { x: 260, y: 220 },
      { x: 300, y: 310 },
      { x: 210, y: 350 },
      { x: 140, y: 290 },
    ];

    const box = computeLassoBoundingBox(points, { width: 800, height: 1100 });
    assert.ok(box);
    assert.equal(box.left, 120);
    assert.equal(box.top, 180);
    assert.equal(box.width, 180);
    assert.equal(box.height, 170);
    assert.equal(box.sourceType, 'lasso');
  });

  it('calculateFocusTransform precyzyjnie centruje środek zaznaczenia w viewport', () => {
    const result = calculateFocusTransform({
      focusRect: { left: 200, top: 300, width: 300, height: 200 },
      paperWidth: 794,
      paperHeight: 1123,
      viewportWidth: 1200,
      viewportHeight: 800,
      padding: { top: 60, right: 30, bottom: 30, left: 30 },
      maxScale: 3.0,
      minScale: 1.0,
      marginRatio: 0.10,
    });

    assert.ok(result.scale >= 1.0 && result.scale <= 3.0);
    assert.ok(typeof result.targetX === 'number');
    assert.ok(typeof result.targetY === 'number');

    // Środek focusRectWithMargin trafia w docelowy viewport center
    const focusCenterX = result.focusCenter.x;
    const focusCenterY = result.focusCenter.y;
    const computedScreenCenterX = result.targetX + focusCenterX * result.scale;
    const computedScreenCenterY = result.targetY + focusCenterY * result.scale;

    // Viewport center
    const expectedViewportCenterX = 30 + (1200 - 30 - 30) / 2; // 600
    const expectedViewportCenterY = 60 + (800 - 60 - 30) / 2; // 415

    assert.ok(Math.abs(computedScreenCenterX - expectedViewportCenterX) < 50);
    assert.ok(Math.abs(computedScreenCenterY - expectedViewportCenterY) < 50);
  });

  it('calculateFocusTransform radzi sobie ze skrajnymi rogami bez pustego tła poza stroną', () => {
    // Róg lewy górny (0,0)
    const topLeft = calculateFocusTransform({
      focusRect: { left: 0, top: 0, width: 150, height: 100 },
      paperWidth: 794,
      paperHeight: 1123,
      viewportWidth: 1200,
      viewportHeight: 800,
      padding: { top: 60, right: 30, bottom: 30, left: 30 },
    });
    // Lewa krawędź papieru nie powinna przesunąć się w prawo za lewy padding
    assert.ok(topLeft.targetX <= 30);
    assert.ok(topLeft.targetY <= 60);

    // Róg prawy dolny
    const bottomRight = calculateFocusTransform({
      focusRect: { left: 650, top: 1000, width: 140, height: 120 },
      paperWidth: 794,
      paperHeight: 1123,
      viewportWidth: 1200,
      viewportHeight: 800,
      padding: { top: 60, right: 30, bottom: 30, left: 30 },
    });
    assert.ok(bottomRight.targetX + 794 * bottomRight.scale >= 1200 - 30);
    assert.ok(bottomRight.targetY + 1123 * bottomRight.scale >= 800 - 30);
  });

  it('prefersReducedMotion działa bezpiecznie w środowisku bez DOM i w przeglądarce', () => {
    const reduced = prefersReducedMotion();
    assert.equal(typeof reduced, 'boolean');
  });
});

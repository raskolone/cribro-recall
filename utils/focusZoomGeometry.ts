/**
 * Focus Zoom Geometry & Coordinate System
 *
 * Modele współrzędnych:
 * A. Document coordinates
 *    Pozycja obiektu lub zaznaczenia na stronie A4 w pikselach [0..paperWidth, 0..paperHeight].
 * B. Canvas coordinates
 *    Pozycja elementu względem kontenera paper canvas.
 * C. Viewport coordinates
 *    Aktualna pozycja widoczna na ekranie przeglądarki (clientX, clientY, getBoundingClientRect).
 * D. Presentation coordinates
 *    Pozycja (targetX, targetY) i skala (scale) pojedynczego wrappera prezentacyjnego.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DocumentRect extends Rect {
  paperWidth?: number;
  paperHeight?: number;
  label?: string;
  sourceType?: 'rectangle' | 'lasso' | 'object';
}

export interface ViewportRect extends Rect {}

export interface FocusTransformResult {
  scale: number;
  targetX: number;
  targetY: number;
  focusRectWithMargin: Rect;
  focusCenter: Point;
  paperWidth: number;
  paperHeight: number;
}

/**
 * Konwertuje punkt z układu Viewport (np. zdarzenie myszy) na układ dokumentu A4.
 */
export function viewportPointToDocumentPoint(
  viewportPoint: Point,
  paperBoundingRect: Rect
): Point {
  const x = Math.max(0, Math.min(paperBoundingRect.width, viewportPoint.x - paperBoundingRect.left));
  const y = Math.max(0, Math.min(paperBoundingRect.height, viewportPoint.y - paperBoundingRect.top));
  return { x, y };
}

/**
 * Konwertuje prostokąt z układu Viewport na układ dokumentu A4.
 */
export function viewportRectToDocumentRect(
  viewportRect: ViewportRect,
  paperBoundingRect: Rect
): DocumentRect {
  const left = Math.max(0, Math.min(paperBoundingRect.width, viewportRect.left - paperBoundingRect.left));
  const top = Math.max(0, Math.min(paperBoundingRect.height, viewportRect.top - paperBoundingRect.top));
  const right = Math.max(0, Math.min(paperBoundingRect.width, viewportRect.left + viewportRect.width - paperBoundingRect.left));
  const bottom = Math.max(0, Math.min(paperBoundingRect.height, viewportRect.top + viewportRect.height - paperBoundingRect.top));

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    paperWidth: paperBoundingRect.width,
    paperHeight: paperBoundingRect.height,
  };
}

/**
 * Konwertuje prostokąt z układu dokumentu na układ Viewport.
 */
export function documentRectToViewportRect(
  docRect: DocumentRect,
  paperBoundingRect: Rect
): ViewportRect {
  return {
    left: paperBoundingRect.left + docRect.left,
    top: paperBoundingRect.top + docRect.top,
    width: docRect.width,
    height: docRect.height,
  };
}

/**
 * Przycina prostokąt do dopuszczalnych granic papieru.
 */
export function clampFocusRect(
  rect: Rect,
  paperBounds: { width: number; height: number }
): Rect {
  const left = Math.max(0, Math.min(paperBounds.width, rect.left));
  const top = Math.max(0, Math.min(paperBounds.height, rect.top));
  const width = Math.max(0, Math.min(paperBounds.width - left, rect.width));
  const height = Math.max(0, Math.min(paperBounds.height - top, rect.height));

  return { left, top, width, height };
}

/**
 * Oblicza bounding box dla zestawu punktów odręcznego lasso.
 */
export function computeLassoBoundingBox(
  points: Point[],
  paperBounds?: { width: number; height: number }
): DocumentRect | null {
  if (!points || points.length < 2) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  let rect: Rect = {
    left: minX,
    top: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };

  if (paperBounds) {
    rect = clampFocusRect(rect, paperBounds);
  }

  return {
    ...rect,
    sourceType: 'lasso',
    label: 'Zaznaczenie odręczne (Lasso)',
    paperWidth: paperBounds?.width,
    paperHeight: paperBounds?.height,
  };
}

/**
 * Pobiera rzeczywisty axis-aligned bounding box dla elementu HTML w układzie dokumentu.
 */
export function computeObjectBoundingBox(
  element: HTMLElement,
  paperElement: HTMLElement
): DocumentRect | null {
  if (!element || !paperElement) return null;

  const elemRect = element.getBoundingClientRect();
  const paperRect = paperElement.getBoundingClientRect();

  const docRect = viewportRectToDocumentRect(
    {
      left: elemRect.left,
      top: elemRect.top,
      width: elemRect.width,
      height: elemRect.height,
    },
    {
      left: paperRect.left,
      top: paperRect.top,
      width: paperRect.width,
      height: paperRect.height,
    }
  );

  const tagName = element.tagName.toLowerCase();
  let label = 'Obiekt lekcji';
  if (tagName === 'img') label = 'Grafika';
  else if (tagName === 'table') label = 'Tabela';
  else if (element.hasAttribute('data-exercise-widget')) label = 'Ćwiczenie interaktywne';
  else if (tagName === 'blockquote') label = 'Cytat / Ramka';
  else if (tagName.startsWith('h')) label = 'Nagłówek';

  return {
    ...docRect,
    sourceType: 'object',
    label,
  };
}

export interface CalculateFocusTransformOptions {
  focusRect: DocumentRect;
  paperWidth: number;
  paperHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  maxScale?: number;
  minScale?: number;
  marginRatio?: number; // default 0.10 (10%)
}

/**
 * Główny, deterministyczny algorytm wyznaczania transformacji (skali i przesunięcia)
 * dla pojedynczego wrappera prezentacyjnego Focus Zoom.
 */
export function calculateFocusTransform({
  focusRect,
  paperWidth,
  paperHeight,
  viewportWidth,
  viewportHeight,
  padding,
  maxScale = 3.0,
  minScale = 1.0,
  marginRatio = 0.10,
}: CalculateFocusTransformOptions): FocusTransformResult {
  const paperW = Math.max(100, paperWidth || 794);
  const paperH = Math.max(100, paperHeight || 1123);

  // Bezpieczny margines 8-12% wokół zaznaczenia
  const marginX = Math.max(8, focusRect.width * marginRatio);
  const marginY = Math.max(8, focusRect.height * marginRatio);

  const focusRectWithMargin = clampFocusRect(
    {
      left: focusRect.left - marginX,
      top: focusRect.top - marginY,
      width: focusRect.width + 2 * marginX,
      height: focusRect.height + 2 * marginY,
    },
    { width: paperW, height: paperH }
  );

  const padTop = padding?.top ?? 24;
  const padBottom = padding?.bottom ?? 24;
  const padLeft = padding?.left ?? 24;
  const padRight = padding?.right ?? 24;

  const availW = Math.max(100, viewportWidth - padLeft - padRight);
  const availH = Math.max(100, viewportHeight - padTop - padBottom);

  // Skala dopasowania do widocznego obszaru
  const scaleW = availW / Math.max(1, focusRectWithMargin.width);
  const scaleH = availH / Math.max(1, focusRectWithMargin.height);
  const rawScale = Math.min(scaleW, scaleH);

  const allowedMaxScale = focusRect.sourceType === 'object' ? Math.max(maxScale, 3.5) : maxScale;
  const scale = Math.max(minScale, Math.min(allowedMaxScale, Number(rawScale.toFixed(2))));

  // Środek zaznaczonego fragmentu w układzie dokumentu
  const focusCenterX = focusRectWithMargin.left + focusRectWithMargin.width / 2;
  const focusCenterY = focusRectWithMargin.top + focusRectWithMargin.height / 2;

  // Środek dostępnego obszaru viewportu
  const viewportCenterX = padLeft + availW / 2;
  const viewportCenterY = padTop + availH / 2;

  // Transformacja przesunięcia (translacja)
  let targetX = viewportCenterX - focusCenterX * scale;
  let targetY = viewportCenterY - focusCenterY * scale;

  // Clamp przesunięcia względem granic strony:
  // 1. Oś X
  if (paperW * scale <= availW) {
    // Jeżeli przeskalowana strona mieści się w całości w poziomie, wyśrodkuj ją
    targetX = padLeft + (availW - paperW * scale) / 2;
  } else {
    // Jeżeli jest szersza, nie pozwól na puste marginesy poza stroną
    const minX = padLeft + availW - paperW * scale;
    const maxX = padLeft;
    targetX = Math.max(minX, Math.min(maxX, targetX));
  }

  // 2. Oś Y
  if (paperH * scale <= availH) {
    // Jeżeli przeskalowana strona mieści się w pionie, wyśrodkuj ją
    targetY = padTop + (availH - paperH * scale) / 2;
  } else {
    // Jeżeli jest wyższa, nie pozwól na puste marginesy powyżej lub poniżej strony
    const minY = padTop + availH - paperH * scale;
    const maxY = padTop;
    targetY = Math.max(minY, Math.min(maxY, targetY));
  }

  return {
    scale,
    targetX: Number(targetX.toFixed(1)),
    targetY: Number(targetY.toFixed(1)),
    focusRectWithMargin,
    focusCenter: { x: focusCenterX, y: focusCenterY },
    paperWidth: paperW,
    paperHeight: paperH,
  };
}

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { computeFitFontSize } from '../utils/fitFontSize';

interface Options {
  /** Granice w rem (przeliczane wg rozmiaru czcionki dokumentu). */
  maxRem: number;
  minRem: number;
}

/**
 * Rozmiar czcionki (px) dopasowany do pola `boxRef`; `textRef` to element z tekstem (do korekty
 * po realnym pomiarze). Przelicza się przy zmianie tekstu i rozmiaru pola (ResizeObserver).
 * Bez wymiarów (jsdom, ukryty element) zostaje maksimum.
 */
export function useFitFontSize(
  boxRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  text: string,
  { maxRem, minRem }: Options,
): number | undefined {
  const [size, setSize] = useState<number | undefined>(undefined);
  const lastBox = useRef({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const view = el.ownerDocument.defaultView;
    if (!view) return;
    const root = parseFloat(view.getComputedStyle(el.ownerDocument.documentElement).fontSize) || 16;
    const maxPx = maxRem * root;
    const minPx = minRem * root;

    const fit = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!(w > 0) || !(h > 0)) return;
      lastBox.current = { w, h };
      const style = view.getComputedStyle(box);
      const innerW = w - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      let { size: next } = computeFitFontSize({ text, width: innerW, height: h, maxSize: maxPx, minSize: minPx });
      // Korekta po realnym pomiarze: oszacowanie szerokości znaków bywa o kilka procent za luźne.
      el.style.fontSize = `${next}px`;
      for (let i = 0; i < 24 && next > minPx && box.scrollHeight > box.clientHeight + 1; i++) {
        next = Math.max(minPx, next - 0.5);
        el.style.fontSize = `${next}px`;
      }
      setSize((prev) => (prev === next ? prev : next));
    };

    fit();
    if (typeof view.ResizeObserver === 'undefined') return;
    const ro = new view.ResizeObserver(() => {
      if (box.clientWidth !== lastBox.current.w || box.clientHeight !== lastBox.current.h) fit();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [boxRef, textRef, text, maxRem, minRem]);

  return size;
}

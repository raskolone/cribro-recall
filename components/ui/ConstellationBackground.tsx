import React, { useEffect, useRef } from 'react';

/**
 * Tło konstelacji — port design/theme/constellation.js.
 *
 * Kanwa jest przezroczysta: gradient strony żyje na <body>, a kanwa ma się przez
 * niego przebijać. Leży fixed na z-index 0, treść aplikacji siedzi nad nią
 * (#root ma position: relative; z-index: 1 w index.css).
 *
 * Bez interakcji z kursorem — to celowe założenie paczki.
 *
 * ══ KOLOR IDZIE Z MOTYWU, NIE Z TEGO PLIKU ══
 *
 * Wcześniej barwa była wpisana tu na sztywno jako zieleń trybu nocnego
 * (114, 240, 180). W trybie jasnym znaczyło to jasną zieleń na jasnym tle,
 * czyli konstelację, której praktycznie nie było widać. Teraz kanwa czyta
 * `--constellation-*` z tokenów, więc tryb jasny rysuje ciemne linie na
 * jasnym tle — te same gwiazdy w odwróconych barwach.
 *
 * Zmiana motywu nie przeładowuje strony, więc kolor trzeba odczytać
 * ponownie: `MutationObserver` pilnuje atrybutów elementu `<html>`, na
 * których siedzi wybór motywu (`data-theme` i klasa `light`).
 */

const CFG = {
  link: 148,              // px, przy którym pojawia się linia
  density: 15500,         // jeden punkt na N px² — więcej = rzadziej
  min: 38,
  max: 120,
  speed: 0.16,            // px na klatkę
};

/** Wartości zapasowe = tryb nocny. Używane, gdy arkusz się jeszcze nie wczytał. */
const FALLBACK_PAINT = { rgb: '114, 240, 180', lineAlpha: 0.17, dotAlpha: 0.42 };

/** Barwa i krycie konstelacji z aktualnego motywu. */
const readPaint = () => {
  if (typeof window === 'undefined' || !document.documentElement) return FALLBACK_PAINT;
  const style = getComputedStyle(document.documentElement);
  const rgb = style.getPropertyValue('--constellation-rgb').trim();
  const line = parseFloat(style.getPropertyValue('--constellation-line-alpha'));
  const dot = parseFloat(style.getPropertyValue('--constellation-dot-alpha'));
  return {
    rgb: rgb || FALLBACK_PAINT.rgb,
    lineAlpha: Number.isFinite(line) ? line : FALLBACK_PAINT.lineAlpha,
    dotAlpha: Number.isFinite(dot) ? dot : FALLBACK_PAINT.dotAlpha,
  };
};

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const ConstellationBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let raf: number | null = null;
    let paint = readPaint();

    const getTargetCount = (w: number, h: number) => {
      return Math.round(
        Math.min(CFG.max, Math.max(CFG.min, (w * h) / CFG.density))
      );
    };

    const initPoints = (w: number, h: number) => {
      const count = getTargetCount(w, h);
      const newPoints: Point[] = [];
      for (let i = 0; i < count; i++) {
        newPoints.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * CFG.speed,
          vy: (Math.random() - 0.5) * CFG.speed,
          r: 0.8 + Math.random() * 1.5,
        });
      }
      return newPoints;
    };

    const updateSize = (isInitial = false) => {
      const newWidth = canvas.clientWidth || window.innerWidth;
      const newHeight = canvas.clientHeight || window.innerHeight;

      if (!isInitial && Math.abs(newWidth - width) < 3 && Math.abs(newHeight - height) < 3) {
        return;
      }

      const oldWidth = width || newWidth;
      const oldHeight = height || newHeight;

      width = newWidth;
      height = newHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (isInitial || points.length === 0) {
        points = initPoints(width, height);
      } else {
        // Skaluj istniejące punkty zamiast losować od zera — brak nagłego błysku/przeskoku
        const scaleX = width / oldWidth;
        const scaleY = height / oldHeight;
        for (const p of points) {
          p.x = Math.max(0, Math.min(width, p.x * scaleX));
          p.y = Math.max(0, Math.min(height, p.y * scaleY));
        }

        const targetCount = getTargetCount(width, height);
        if (points.length < targetCount) {
          const toAdd = targetCount - points.length;
          for (let i = 0; i < toAdd; i++) {
            points.push({
              x: Math.random() * width,
              y: Math.random() * height,
              vx: (Math.random() - 0.5) * CFG.speed,
              vy: (Math.random() - 0.5) * CFG.speed,
              r: 0.8 + Math.random() * 1.5,
            });
          }
        } else if (points.length > targetCount) {
          points = points.slice(0, targetCount);
        }
      }
    };

    const isLightMode = () => {
      if (typeof window === 'undefined' || !document.documentElement) return false;
      return (
        document.documentElement.classList.contains('light') ||
        document.documentElement.getAttribute('data-theme') === 'light'
      );
    };

    // Ambient floating orbs for light mode
    let orbs = [
      { x: 0.2, y: 0.3, vx: 0.0003, vy: 0.0002, radius: 280, color: 'rgba(195, 225, 255, 0.45)' },
      { x: 0.8, y: 0.2, vx: -0.0002, vy: 0.0003, radius: 340, color: 'rgba(185, 245, 220, 0.38)' },
      { x: 0.5, y: 0.8, vx: 0.0002, vy: -0.0002, radius: 300, color: 'rgba(215, 235, 255, 0.40)' },
      { x: 0.85, y: 0.75, vx: -0.0003, vy: -0.0001, radius: 260, color: 'rgba(190, 240, 230, 0.35)' },
    ];

    const getEdgeAlpha = (p: Point, w: number, h: number) => {
      const margin = 28;
      const dx = Math.min(p.x, w - p.x);
      const dy = Math.min(p.y, h - p.y);
      const dist = Math.min(dx, dy);
      if (dist <= 0) return 0;
      if (dist >= margin) return 1;
      return dist / margin;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const isLight = isLightMode();

      if (isLight) {
        // W TRYBIE JASNYM: Miękkie, płynne plamy światła o błękitno-miętowym odcieniu
        for (const orb of orbs) {
          orb.x += orb.vx;
          orb.y += orb.vy;
          if (orb.x < 0.05 || orb.x > 0.95) orb.vx = -orb.vx;
          if (orb.y < 0.05 || orb.y > 0.95) orb.vy = -orb.vy;

          const cx = orb.x * width;
          const cy = orb.y * height;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.radius);
          grad.addColorStop(0, orb.color);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, orb.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dyskretne, powolne pyłki światła
        for (const p of points) {
          p.x += p.vx * 0.7;
          p.y += p.vy * 0.7;
          if (p.x < -20) p.x = width + 20;
          else if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          else if (p.y > height + 20) p.y = -20;

          const edgeFade = getEdgeAlpha(p, width, height);
          if (edgeFade > 0) {
            ctx.fillStyle = `rgba(56, 128, 175, ${(0.22 * edgeFade).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.min(p.r, 1.2), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // W TRYBIE CIEMNYM: Stabilna, gwiezdna konstelacja z miękkim wygaszaniem krawędzi
        const pointAlphas: number[] = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = width + 20;
          else if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          else if (p.y > height + 20) p.y = -20;

          pointAlphas[i] = getEdgeAlpha(p, width, height);
        }

        ctx.lineWidth = 1;
        for (let a = 0; a < points.length; a++) {
          const alphaA = pointAlphas[a];
          if (alphaA <= 0.01) continue;

          for (let b = a + 1; b < points.length; b++) {
            const alphaB = pointAlphas[b];
            if (alphaB <= 0.01) continue;

            const dx = points[a].x - points[b].x;
            const dy = points[a].y - points[b].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > CFG.link) continue;

            const jointEdge = Math.min(alphaA, alphaB);
            const lineAlpha = (paint.lineAlpha * (1 - d / CFG.link) * jointEdge).toFixed(3);
            if (parseFloat(lineAlpha) > 0.005) {
              ctx.strokeStyle = `rgba(${paint.rgb}, ${lineAlpha})`;
              ctx.beginPath();
              ctx.moveTo(points[a].x, points[a].y);
              ctx.lineTo(points[b].x, points[b].y);
              ctx.stroke();
            }
          }
        }

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const edgeFade = pointAlphas[i];
          if (edgeFade > 0.01) {
            ctx.fillStyle = `rgba(${paint.rgb}, ${(paint.dotAlpha * edgeFade).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    const stop = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    let resizeTimer: number | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        updateSize(false);
      }, 100);
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else if (raf === null) draw();
    };

    // Przy prefers-reduced-motion: jedna statyczna klatka, bez pętli.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const redrawStatic = () => {
        paint = readPaint();
        updateSize(true);
        draw();
        stop();
      };
      redrawStatic();
      window.addEventListener('resize', redrawStatic);
      const staticWatcher = new MutationObserver(redrawStatic);
      staticWatcher.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      });
      return () => {
        staticWatcher.disconnect();
        window.removeEventListener('resize', redrawStatic);
      };
    }

    updateSize(true);
    draw();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    const themeWatcher = new MutationObserver(() => {
      paint = readPaint();
    });
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => {
      stop();
      if (resizeTimer) clearTimeout(resizeTimer);
      themeWatcher.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0 transform-gpu"
      style={{
        transform: 'translate3d(0,0,0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    />
  );
};

export default ConstellationBackground;

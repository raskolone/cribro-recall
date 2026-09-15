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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let raf: number | null = null;
    let paint = readPaint();

    const seed = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(
        Math.min(CFG.max, Math.max(CFG.min, (width * height) / CFG.density))
      );

      points = [];
      for (let i = 0; i < count; i++) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * CFG.speed,
          vy: (Math.random() - 0.5) * CFG.speed,
          r: 0.8 + Math.random() * 1.5,
        });
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const isLight = isLightMode();

      if (isLight) {
        // W TRYBIE JASNYM: Miękkie, płynne plamy światła o błękitno-miętowym odcieniu
        // Bez ostrych linii, które wyglądały jak popękany ekran!
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
        }

        ctx.fillStyle = 'rgba(56, 128, 175, 0.22)';
        for (const p of points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.min(p.r, 1.2), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // W TRYBIE CIEMNYM: Klasyczna, gwiezdna konstelacja z liniami
        for (const p of points) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = width + 20;
          else if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          else if (p.y > height + 20) p.y = -20;
        }

        ctx.lineWidth = 1;
        for (let a = 0; a < points.length; a++) {
          for (let b = a + 1; b < points.length; b++) {
            const dx = points[a].x - points[b].x;
            const dy = points[a].y - points[b].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > CFG.link) continue;
            const alpha = (paint.lineAlpha * (1 - d / CFG.link)).toFixed(3);
            ctx.strokeStyle = `rgba(${paint.rgb}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(points[a].x, points[a].y);
            ctx.lineTo(points[b].x, points[b].y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = `rgba(${paint.rgb}, ${paint.dotAlpha})`;
        for (const p of points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
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

    const handleResize = () => seed();

    const handleVisibility = () => {
      if (document.hidden) stop();
      else if (raf === null) draw();
    };

    // Przy prefers-reduced-motion: jedna statyczna klatka, bez pętli.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Jedna statyczna klatka zamiast pętli — ale po zmianie rozmiaru trzeba
      // ją przerysować, inaczej kanwa zostaje wyczyszczona i tło znika.
      const redrawStatic = () => {
        paint = readPaint();
        seed();
        draw();
        stop();
      };
      redrawStatic();
      window.addEventListener('resize', redrawStatic);
      // Przy wyłączonym ruchu jedna klatka musi się przerysować także po
      // zmianie motywu — inaczej zostaje w barwach poprzedniego.
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

    seed();
    draw();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    /* Motyw zmienia się bez przeładowania strony — bez tego konstelacja
       zostawała w barwach poprzedniego trybu do najbliższego odświeżenia. */
    const themeWatcher = new MutationObserver(() => {
      paint = readPaint();
    });
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => {
      stop();
      themeWatcher.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

export default ConstellationBackground;

import React, { useEffect, useRef } from 'react';

/**
 * Tło konstelacji — port design/theme/constellation.js.
 *
 * Kanwa jest przezroczysta: gradient strony żyje na <body>, a kanwa ma się przez
 * niego przebijać. Leży fixed na z-index 0, treść aplikacji siedzi nad nią
 * (#root ma position: relative; z-index: 1 w index.css).
 *
 * Bez interakcji z kursorem — to celowe założenie paczki.
 */

const CFG = {
  color: '114, 240, 180', // --accent jako triplet rgb
  link: 148,              // px, przy którym pojawia się linia
  lineAlpha: 0.17,        // alfa przy zerowej odległości
  dotAlpha: 0.42,
  density: 15500,         // jeden punkt na N px² — więcej = rzadziej
  min: 38,
  max: 120,
  speed: 0.16,            // px na klatkę
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        // Zawijanie zamiast odbicia — punkty nie zbijają się przy krawędziach
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
          const alpha = (CFG.lineAlpha * (1 - d / CFG.link)).toFixed(3);
          ctx.strokeStyle = `rgba(${CFG.color}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(points[a].x, points[a].y);
          ctx.lineTo(points[b].x, points[b].y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(${CFG.color}, ${CFG.dotAlpha})`;
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
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
      seed();
      draw();
      stop();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    seed();
    draw();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
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

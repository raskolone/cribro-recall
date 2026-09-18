import gsap from 'gsap';

/**
 * Czy użytkownik włączył w systemie ograniczenie ruchu (dostępność).
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Buduje funkcję łagodzącą GSAP odpowiadającą krzywej CSS
 * `cubic-bezier(x1, y1, x2, y2)` (np. koło fortuny: naturalne, "fizyczne"
 * zwalnianie). GSAP nie ma darmowego wsparcia dla dowolnych krzywych Beziera
 * (CustomEase to płatny plugin Club GreenSock), więc rozwiązujemy krzywą
 * metodą Newtona — tak jak robią to polyfille `cubic-bezier` w przeglądarkach.
 */
export const cubicBezierEase = (x1: number, y1: number, x2: number, y2: number) => {
  const sampleCurveX = (t: number) => ((1 - 3 * x2 + 3 * x1) * t * t * t) + ((3 * x2 - 6 * x1) * t * t) + (3 * x1 * t);
  const sampleCurveY = (t: number) => ((1 - 3 * y2 + 3 * y1) * t * t * t) + ((3 * y2 - 6 * y1) * t * t) + (3 * y1 * t);
  const sampleCurveDerivativeX = (t: number) => (3 * (1 - 3 * x2 + 3 * x1) * t * t) + (2 * (3 * x2 - 6 * x1) * t) + (3 * x1);

  const solveCurveX = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleCurveX(t) - x;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return Math.min(1, Math.max(0, t));
  };

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleCurveY(solveCurveX(x));
  };
};

/**
 * Płynne, organiczne przejście kropelkowe dla ćwiczeń (styl aplikacji Drops).
 *
 * ADHD-Friendly:
 * - Czas trwania 360ms — wystarczająco szybki, by nie nużyć i nie wybijać ze skupienia.
 * - Delikatny efekt sprężynowania kropli wody (subtelny squash & stretch 0.95 -> 1.02 -> 1.0)
 *   dający przyjemną mikronagrodę sensoryczną (dopamina z postępu).
 * - Brak ostrych błysków i drgań.
 */
export const animateDropletTransition = (
  element: HTMLElement | null,
  direction: 'next' | 'prev' | 'init' = 'next',
  onComplete?: () => void
): gsap.core.Tween | null => {
  if (!element) return null;

  if (prefersReducedMotion()) {
    element.style.opacity = '1';
    element.style.transform = 'none';
    onComplete?.();
    return null;
  }

  // Zresetuj trwające animacje na tym elemencie
  gsap.killTweensOf(element);

  const startX = direction === 'next' ? 16 : direction === 'prev' ? -16 : 0;

  return gsap.fromTo(
    element,
    {
      opacity: 0,
      scaleX: 0.95,
      scaleY: 0.93,
      y: 12,
      x: startX,
    },
    {
      opacity: 1,
      scaleX: 1,
      scaleY: 1,
      y: 0,
      x: 0,
      duration: 0.38,
      ease: 'back.out(1.35)',
      clearProps: 'transform,opacity',
      onComplete,
    }
  );
};

/**
 * Sukces / zatwierdzenie zadania — efekt miękkiej kropli wody (Droplet Pop).
 */
export const animateDropletSuccess = (element: HTMLElement | null): gsap.core.Tween | null => {
  if (!element || prefersReducedMotion()) return null;

  gsap.killTweensOf(element);

  return gsap.fromTo(
    element,
    { scale: 1 },
    {
      scale: 1.035,
      duration: 0.18,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      clearProps: 'transform',
    }
  );
};

/**
 * Płynne napełnianie paska postępu jak ciecz (Liquid Progress Bar).
 */
export const animateProgressBarLiquid = (
  progressBarElement: HTMLElement | null,
  targetWidthPercent: number
): gsap.core.Tween | null => {
  if (!progressBarElement) return null;

  if (prefersReducedMotion()) {
    progressBarElement.style.width = `${targetWidthPercent}%`;
    return null;
  }

  gsap.killTweensOf(progressBarElement);

  return gsap.to(progressBarElement, {
    width: `${targetWidthPercent}%`,
    duration: 0.45,
    ease: 'power2.out',
  });
};

/**
 * Płynne wejście modułu po kliknięciu kafelka (Fade In & Soft Slide).
 */
export const animateModuleEnter = (
  element: HTMLElement | null,
  onComplete?: () => void
): gsap.core.Tween | null => {
  if (!element) return null;

  if (prefersReducedMotion()) {
    element.style.opacity = '1';
    element.style.transform = 'none';
    onComplete?.();
    return null;
  }

  gsap.killTweensOf(element);

  return gsap.fromTo(
    element,
    {
      opacity: 0,
      y: 8,
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
      onComplete,
    }
  );
};

/**
 * Płynne wyjście modułu przed zmianą (Fade Out & Soft Slide).
 */
export const animateModuleExit = (
  element: HTMLElement | null,
  onComplete: () => void
): gsap.core.Tween | null => {
  if (!element) {
    onComplete();
    return null;
  }

  if (prefersReducedMotion()) {
    onComplete();
    return null;
  }

  gsap.killTweensOf(element);

  return gsap.to(element, {
    opacity: 0,
    y: -6,
    duration: 0.15,
    ease: 'power2.in',
    onComplete,
  });
};

/**
 * Efektowna zmiana motywu (Dark / Light) napędzana GSAP.
 *
 * Tworzy płynną radialną falę rozchodzącą się z punktu kliknięcia (x, y) na całym ekranie,
 * zapewniając 60fps animację we wszystkich przeglądarkach.
 */
export const animateThemeRipple = (
  originX: number,
  originY: number,
  isCurrentlyDark: boolean,
  onToggle: () => void
): void => {
  if (prefersReducedMotion()) {
    onToggle();
    return;
  }

  // Oblicz maksymalny promień do najdalszego rogu ekranu
  const maxRadius = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY)
  );

  // Tworzymy dynamiczny element fali
  const ripple = document.createElement('div');
  ripple.style.position = 'fixed';
  ripple.style.left = `${originX}px`;
  ripple.style.top = `${originY}px`;
  ripple.style.width = '10px';
  ripple.style.height = '10px';
  ripple.style.marginLeft = '-5px';
  ripple.style.marginTop = '-5px';
  ripple.style.borderRadius = '50%';
  ripple.style.pointerEvents = 'none';
  ripple.style.zIndex = '999999';
  ripple.style.backgroundColor = isCurrentlyDark ? '#f8fafc' : '#0a0d14';
  ripple.style.opacity = '0.92';
  ripple.style.transform = 'scale(0)';

  document.body.appendChild(ripple);

  const tl = gsap.timeline({
    onComplete: () => {
      ripple.remove();
    },
  });

  const scaleFactor = (maxRadius * 2) / 10;

  tl.to(ripple, {
    scale: scaleFactor,
    duration: 0.36,
    ease: 'power2.inOut',
  })
    .call(() => {
      onToggle();
    })
    .to(ripple, {
      opacity: 0,
      duration: 0.28,
      ease: 'power2.out',
    });
};

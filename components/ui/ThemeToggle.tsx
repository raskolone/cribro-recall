import React, { useCallback, useRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import gsap from 'gsap';
import { useTheme } from '../../context/ThemeContext';
import { animateThemeRipple, prefersReducedMotion } from '../../services/gsapAnimations';

const MORPH_MS = 620;

const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDark = theme === 'dark';

  const handleToggle = useCallback(() => {
    const root = document.documentElement;

    // Przejście kolorów włączamy tylko na czas zmiany
    root.setAttribute('data-morphing', '');
    window.setTimeout(() => root.removeAttribute('data-morphing'), MORPH_MS);

    // Animacja przycisku GSAP
    if (buttonRef.current && !prefersReducedMotion()) {
      gsap.killTweensOf(buttonRef.current);
      gsap.fromTo(
        buttonRef.current,
        { scale: 0.86, rotate: isDark ? -25 : 25 },
        { scale: 1, rotate: 0, duration: 0.45, ease: 'back.out(2.2)', clearProps: 'transform' }
      );
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height / 2 : 0;

    const startViewTransition = (document as any).startViewTransition?.bind(document);

    if (prefersReducedMotion()) {
      toggleTheme();
      return;
    }

    // Jeśli przeglądarka wspiera View Transitions API
    if (startViewTransition) {
      const radius = Math.hypot(
        Math.max(originX, window.innerWidth - originX),
        Math.max(originY, window.innerHeight - originY)
      );

      const transition = startViewTransition(() => {
        toggleTheme();
      });

      transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${originX}px ${originY}px)`,
                `circle(${radius}px at ${originX}px ${originY}px)`,
              ],
            },
            {
              duration: MORPH_MS,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        })
        .catch(() => {
          toggleTheme();
        });
    } else {
      // Fallback: płynna fala radialna GSAP dla pozostałych przeglądarek
      animateThemeRipple(originX, originY, isDark, toggleTheme);
    }
  }, [toggleTheme, isDark]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Włącz tryb dzienny' : 'Włącz tryb nocny'}
      title={isDark ? 'Tryb dzienny' : 'Tryb nocny'}
      className={`relative h-11 w-11 shrink-0 rounded-full border border-line-strong bg-white/[0.04] text-text-2 hover:text-accent hover:border-accent/40 transition-colors cursor-pointer flex items-center justify-center overflow-hidden active:scale-95 ${className}`}
    >
      {/* Obie ikony leżą na sobie i wymieniają się obrotem z GSAP-friendly timingiem */}
      <Sun
        size={18}
        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
        }`}
      />
      <Moon
        size={18}
        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
        }`}
      />
    </button>
  );
};

export default ThemeToggle;

import React, { useCallback, useRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Przełącznik trybu dziennego i nocnego.
 *
 * Przejście to okrągła fala rozchodząca się z samego przycisku — kolory zmieniają
 * się tam, gdzie użytkownik właśnie patrzy i kliknął, więc zmiana czyta się jako
 * skutek jego ruchu, a nie jako mignięcie całego ekranu.
 *
 * Handoff opisywał nakładkę rysowaną GSAP-em (dysk skalowany nad treścią, potem
 * wygaszany). Tutaj to samo robi natywne View Transitions API: przycinamy
 * migawkę NOWEGO motywu rosnącym okręgiem, dzięki czemu rozbłysk odsłania
 * prawdziwy interfejs, zamiast przykrywać go kolorową płachtą. Jest płynniejsze
 * (kompozytor przeglądarki, nie JS na każdej klatce) i nie wymaga dokładania
 * warstwy nad aplikację.
 *
 * Tam, gdzie API nie ma (Firefox, Safari) albo użytkownik prosił o ograniczenie
 * ruchu, zostaje zwykłe przełączenie z 0,5-sekundowym przejściem kolorów
 * z `[data-morphing]`.
 */
const MORPH_MS = 620;

const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(() => {
    const root = document.documentElement;

    // Przejście kolorów włączamy tylko na czas zmiany — na stałe spowolniłoby
    // każdy hover w aplikacji z 0,2 s do 0,5 s.
    root.setAttribute('data-morphing', '');
    window.setTimeout(() => root.removeAttribute('data-morphing'), MORPH_MS);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startViewTransition = (document as any).startViewTransition?.bind(document);

    if (!startViewTransition || prefersReducedMotion) {
      toggleTheme();
      return;
    }

    // Środek fali to środek przycisku, a promień — odległość do najdalszego
    // rogu okna, żeby rozbłysk na pewno pokrył cały ekran.
    const rect = buttonRef.current?.getBoundingClientRect();
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height / 2 : 0;
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
        // Przerwane przejście (np. druga zmiana w trakcie) nie jest błędem —
        // motyw i tak został już przestawiony.
      });
  }, [toggleTheme]);

  const isDark = theme === 'dark';

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Włącz tryb dzienny' : 'Włącz tryb nocny'}
      title={isDark ? 'Tryb dzienny' : 'Tryb nocny'}
      className={`relative h-11 w-11 shrink-0 rounded-full border border-line-strong bg-white/[0.04] text-text-2 hover:text-accent hover:border-accent/40 transition-colors cursor-pointer flex items-center justify-center overflow-hidden ${className}`}
    >
      {/* Obie ikony leżą na sobie i wymieniają się obrotem — bez przeskoku
          układu, który daje warunkowe renderowanie jednej z nich. */}
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

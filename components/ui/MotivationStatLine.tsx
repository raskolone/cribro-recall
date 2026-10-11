import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, Layers, Languages, Link2, PartyPopper, PencilLine, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  MOTIVATION_EMPTY_KEY,
  nextIndex,
  startIndexForVisit,
  type MotivationIcon,
  type MotivationItem,
} from '../../utils/motivationStats';
import { nextVisit } from '../../utils/motivationStatsCache';

/**
 * Jedna linia prawdziwej statystyki kursanta w miejscu dawnego stałego zdania („Dobrze Ci idzie!”).
 * Pozycje zmieniają się co ~7 s płynnym przenikaniem (wszystkie leżą w tym samym miejscu, więc wysokość jest
 * stała — brak skoków układu). Rotację wstrzymuje najechanie, fokus i dotknięcie; dotknięcie / Enter / Spacja
 * przechodzi do następnej statystyki. Bez `aria-live`: czytnik czyta tylko bieżącą pozycję (reszta `aria-hidden`).
 * `prefers-reduced-motion`: bez rotacji i bez przenikania; pokazuje jedną statystykę — kolejną przy każdym
 * wejściu w panel. Brak danych → jedna statyczna linia zachęty (bez liczb).
 */
export const ROTATION_MS = 7000;
/** Po dotknięciu rotacja stoi tyle, żeby dało się spokojnie przeczytać wybraną statystykę. */
export const TOUCH_PAUSE_MS = 15000;

const ICONS: Record<MotivationIcon, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  trophy: Trophy,
  languages: Languages,
  pencil: PencilLine,
  layers: Layers,
  book: BookOpenCheck,
  link: Link2,
  party: PartyPopper,
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface MotivationStatLineProps {
  items: MotivationItem[];
  className?: string;
  /** Bez automatycznej rotacji (np. w dymku) — nadal działa dotknięcie. */
  autoRotate?: boolean;
  /** Wymuszenie trybu bez ruchu (testy); domyślnie prefers-reduced-motion. */
  reducedMotion?: boolean;
  /** Okres rotacji w ms (testy). */
  intervalMs?: number;
  /** Dane jeszcze się wczytują: pusty placeholder o tej samej wysokości (bez błysku linii „brak danych”). */
  pending?: boolean;
}

const MotivationStatLine: React.FC<MotivationStatLineProps> = ({ items, className, autoRotate = true, reducedMotion, intervalMs = ROTATION_MS, pending = false }) => {
  const { t } = useTranslation();
  const reduced = useMemo(() => reducedMotion ?? prefersReducedMotion(), [reducedMotion]);
  const length = items.length;

  const [index, setIndex] = useState(() => (reduced ? startIndexForVisit(nextVisit(), length) : 0));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pausedUntil, setPausedUntil] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const safeIndex = length > 0 ? index % length : 0;

  const advance = useCallback(() => setIndex((i) => nextIndex(i, length)), [length]);

  // Automatyczna rotacja: jeden timer na krok, zatrzymywany przez pauzę; bez rotacji przy reduced-motion.
  useEffect(() => {
    clearTimeout(timer.current);
    if (reduced || !autoRotate || length < 2 || hovered || focused) return;
    const wait = Math.max(intervalMs, pausedUntil - Date.now());
    timer.current = setTimeout(advance, wait);
    return () => clearTimeout(timer.current);
  }, [reduced, autoRotate, length, hovered, focused, pausedUntil, safeIndex, advance, intervalMs]);

  const onTap = () => {
    if (length < 2) return;
    advance();
    setPausedUntil(Date.now() + TOUCH_PAUSE_MS);
  };

  if (pending && length === 0) return <div aria-hidden="true" className={`h-6 sm:h-7 ${className ?? ''}`} />;

  if (length === 0) {
    return (
      <p data-testid="motivation-empty" className={`flex h-6 items-center text-sm font-semibold text-text-hi sm:h-7 sm:text-base ${className ?? ''}`}>
        {t(MOTIVATION_EMPTY_KEY)}
      </p>
    );
  }

  return (
    <button
      type="button"
      data-testid="motivation-line"
      aria-label={length > 1 ? t('motivation.next') : undefined}
      onClick={onTap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`relative -my-2.5 flex min-h-11 w-full cursor-pointer items-center rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${length < 2 ? 'cursor-default' : ''} ${className ?? ''}`}
    >
      {/* Stała wysokość jednej linii: wszystkie pozycje leżą jedna na drugiej, widoczna jest jedna. */}
      <span className="relative block h-6 w-full sm:h-7">
        {items.map((item, i) => {
          const Icon = ICONS[item.icon];
          const active = i === safeIndex;
          return (
            <span
              key={item.id}
              data-testid="motivation-item"
              data-active={active ? 'true' : 'false'}
              aria-hidden={active ? undefined : true}
              className={`absolute inset-0 flex items-center gap-2 whitespace-nowrap font-semibold text-text-hi motion-reduce:transition-none transition-opacity duration-500 ease-in-out ${
                active ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{ fontSize: 'clamp(0.8125rem, 3.9vw, 1rem)' }}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">{t(item.i18nKey, { count: item.count })}</span>
            </span>
          );
        })}
      </span>
    </button>
  );
};

export default MotivationStatLine;

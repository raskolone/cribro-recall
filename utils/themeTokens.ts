/**
 * Odczyt tokenów Nocturne Green (design/theme/tokens.css) w czasie działania.
 *
 * Recharts przyjmuje kolory propsami i przekazuje je dalej do atrybutów SVG,
 * więc `var(--accent)` bywa tam nieprzewidywalne. Zamiast rozsypywać hexy po
 * komponentach wykresów, czytamy wartość z tego samego tokenu, którego używa
 * reszta interfejsu — tokens.css zostaje jedynym źródłem prawdy.
 */

const FALLBACK: Record<string, string> = {
  '--accent': '#72f0b4',
  '--accent-soft': '#a5f7d0',
  '--text': '#eae8e3',
  '--text-2': '#9aa9bd',
  '--text-mute': '#7a8da6',
  '--text-faint': '#39445a',
  '--surface-flat': '#141b2a',
  '--ink-2': '#0b1120',
  '--warn': '#e0a83a',
  '--danger': '#f0726f',
  '--info': '#6fa8f0',
};

const cache = new Map<string, string>();

/**
 * Zwraca wartość tokenu. Poza przeglądarką (SSR, testy) i zanim arkusz się
 * wczyta oddaje wartość zapasową, więc wywołanie nigdy nie zwraca pustego
 * stringa — recharts nie poradziłby sobie z takim kolorem.
 */
export function token(name: string): string {
  const cached = cache.get(name);
  if (cached) return cached;

  const fallback = FALLBACK[name] ?? '#72f0b4';
  if (typeof window === 'undefined' || !document.documentElement) return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  if (!value) return fallback;
  cache.set(name, value);
  return value;
}

/** Wspólny wygląd dymka recharts — powierzchnia i krawędź jak w components.md. */
export function tooltipStyle(): React.CSSProperties {
  return {
    backgroundColor: token('--surface-flat'),
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: '14px',
    color: token('--text'),
  };
}

/**
 * Rampa akcentu dla danych porządkowych (np. poziomy A1–C2).
 *
 * Skala uporządkowana ma kierunek, więc niesie go natężenie jednego koloru,
 * a nie zestaw niepowiązanych barw — dzięki temu wykres zostaje przy regule
 * „jeden akcent" i dalej czyta się od najsłabszego do najmocniejszego.
 */
export function accentRamp(steps: number): string[] {
  if (steps <= 0) return [];
  const min = 0.28;
  const max = 1;
  // Krycie nakładamy na wartość tokenu, żeby zmiana --accent przenosiła się
  // także na wykresy — inaczej ten moduł przeczyłby własnemu założeniu.
  const accent = token('--accent');
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? max : min + ((max - min) * i) / (steps - 1);
    return withAlpha(accent, t);
  });
}

/** Dokłada krycie do koloru z tokenu (#rgb, #rrggbb albo gotowe rgb/rgba). */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(hex);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map(v => parseFloat(v));
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  return color;
}

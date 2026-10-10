/**
 * Kontrast kolorów wg WCAG 2.x — czysta logika (bez DOM), używana w testach tokenów motywu.
 * Przyjmuje #rgb, #rrggbb oraz rgb()/rgba() z przecinkami; krycie składamy w sRGB na tle,
 * tak jak robi to przeglądarka przy zwykłym (nie color-mix) nakładaniu półprzezroczystości.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (fn) return { r: +fn[1], g: +fn[2], b: +fn[3], a: fn[4] === undefined ? 1 : +fn[4] };
  throw new Error(`Nieobsługiwany kolor: "${input}"`);
}

/** `fg` (z własnym kryciem, opcjonalnie nadpisanym `alpha`) nałożone na nieprzezroczyste `bg`. */
export function composite(fg: Rgba, bg: Rgba, alpha: number = fg.a): Rgba {
  const mix = (f: number, b: number) => f * alpha + b * (1 - alpha);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG AA: tekst zwykły 4,5:1, elementy graficzne i obwódki stanu 3:1. */
export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

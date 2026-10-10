import { readFileSync } from 'node:fs';
import { parseColor, Rgba } from '../../utils/contrast';

/**
 * Tokeny kolorów motywu czytane z `index.css`: blok `@theme` = tryb ciemny (domyślny),
 * blok `:root[data-theme="light"], :root.light { --color-… }` = tryb jasny (nadpisuje te same nazwy).
 */
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`Brak bloku ${marker} w index.css`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('Niedomknięty blok');
}

const dark = declarations(blockAfter('@theme {'));
const light = { ...dark, ...declarations(blockAfter(':root[data-theme="light"],\n:root.light {\n  --color-primary')) };

export type ThemeName = 'dark' | 'light';
export const THEMES: Record<ThemeName, Record<string, string>> = { dark, light };

export function themeColor(theme: ThemeName, token: string): Rgba {
  const value = THEMES[theme][token];
  if (!value) throw new Error(`Brak tokenu ${token} w motywie ${theme}`);
  return parseColor(value);
}

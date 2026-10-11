/**
 * Wspólny styl kafelka gier — czysta logika (bez Reacta). Styl mieszka w CSS (`.game-tile` w index.css,
 * tokeny `--color-game-*`, `--color-tile-*`, połysk `--glass-sheen`), a widoki dostają stąd gotowy
 * zestaw atrybutów. Używany w: dopasowaniu, wielokrotnym wyborze, układance z rozsypki i quizie.
 *
 * Stany: spoczynek, zaznaczony, poprawny, błędny, zablokowany. Hover / focus-visible / wciśnięty to
 * pseudoklasy CSS (hover tylko na urządzeniach z kursorem). Stan zawsze niesie też obwódka, ikona
 * i tekst dla czytników ekranu — nigdy sam kolor.
 */

export type GameTileState = 'rest' | 'selected' | 'correct' | 'wrong' | 'locked';

/** Odcień pary 1…5 (palety `tile-1…tile-5`); `undefined` = bez odcienia. */
export type GameTileShade = 1 | 2 | 3 | 4 | 5;

export const GAME_TILE_SHADES = 5;

export interface GameTileAttrs {
  className: string;
  'data-state': GameTileState;
  'data-shade'?: GameTileShade;
  /** Własny pastel kafelka w spoczynku (wielokrotny wybór); stany zaznaczony/poprawny/błędny/zablokowany go nadpisują. */
  'data-tint'?: GameTileShade;
  /** Tylko kafelki przełączane (zaznaczanie): `true` / `false`; w pozostałych brak atrybutu. */
  'aria-pressed'?: boolean;
  'aria-disabled'?: true;
}

export interface GameTileOptions {
  state: GameTileState;
  shade?: GameTileShade;
  /** Pastel w spoczynku, niezależny od wyniku (np. po pozycji opcji) — w odróżnieniu od `shade` nie zostaje po zmianie stanu. */
  tint?: GameTileShade;
  /** Kafelek można zaznaczyć (dopasowanie, układanka) — dodaje `aria-pressed`. */
  toggle?: boolean;
  /** Dodatkowe klasy układu (np. `col-span-2`), nie stylu. */
  extraClass?: string;
}

export function gameTileAttrs({ state, shade, tint, toggle, extraClass }: GameTileOptions): GameTileAttrs {
  const attrs: GameTileAttrs = {
    className: ['game-tile', extraClass].filter(Boolean).join(' '),
    'data-state': state,
  };
  if (shade) attrs['data-shade'] = shade;
  if (tint) attrs['data-tint'] = tint;
  if (toggle) attrs['aria-pressed'] = state === 'selected';
  if (state === 'locked' || state === 'correct') attrs['aria-disabled'] = true;
  return attrs;
}

/** Indeks odcienia (1…5) dla k-tego trafienia z rzędu — kolejne trafienia mają różne odcienie. */
export const shadeForHit = (hitIndex: number): GameTileShade =>
  ((((hitIndex % GAME_TILE_SHADES) + GAME_TILE_SHADES) % GAME_TILE_SHADES) + 1) as GameTileShade;

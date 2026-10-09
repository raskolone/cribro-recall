/**
 * Logika gry „Dopasowanie" (FlashcardStudyScreen → tryb „matching") bez UI.
 *
 * Plansza jest budowana DOKŁADNIE RAZ na rundę (`buildRound`) i trzymana w stanie
 * komponentu — kolejność kafelków nie zależy od referencji tablicy kart z kontekstu,
 * więc aktualizacje w tle nie przetasowują gry. Wybór pary to czysty reduktor
 * (`selectTile`), a animacje są tylko jego odbiciem.
 */

export const MAX_PAIRS_PER_ROUND = 6;

export interface MatchCardInput {
  id: string;
  term: string;
  definition: string;
}

export type TileSide = 'left' | 'right';

export interface MatchTile {
  /** Stabilny klucz: `left-<id>` (termin) / `right-<id>` (znaczenie). */
  key: string;
  pairId: string;
  side: TileSide;
  text: string;
}

export const tileKey = (side: TileSide, pairId: string): string => `${side}-${pairId}`;

/** Fisher–Yates na kopii; `rng` do wstrzykiwania w testach. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Losuje do `maxPairs` kart (bez duplikatów id) i zwraca potasowane kafelki.
 * Wejście jest kopiowane — późniejsze zmiany tablicy źródłowej nic nie zmieniają.
 */
export function buildRound(
  cards: readonly MatchCardInput[],
  rng: () => number = Math.random,
  maxPairs: number = MAX_PAIRS_PER_ROUND,
): MatchTile[] {
  const seen = new Set<string>();
  const unique = cards.filter(c => {
    if (!c || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const chosen = shuffle(unique, rng).slice(0, maxPairs);
  const tiles = chosen.flatMap<MatchTile>(c => [
    { key: tileKey('left', c.id), pairId: c.id, side: 'left', text: c.term },
    { key: tileKey('right', c.id), pairId: c.id, side: 'right', text: c.definition },
  ]);
  return shuffle(tiles, rng);
}

// --- Stan wyboru -------------------------------------------------------------

export interface MatchState {
  selectedKey: string | null;
  /** Para błędnie zestawiona — trwa animacja, kolejne kliknięcia są ignorowane. */
  wrongPair: [string, string] | null;
  matchedPairIds: string[];
  mistakes: number;
  /** Poprawne pary z rzędu bez błędu (nakładka „x2", „x3" — nigdzie nie zapisywana). */
  combo: number;
}

export type MatchEvent = 'select' | 'deselect' | 'switch' | 'match' | 'wrong' | 'ignored';

export const initialMatchState = (): MatchState => ({
  selectedKey: null,
  wrongPair: null,
  matchedPairIds: [],
  mistakes: 0,
  combo: 0,
});

export function selectTile(
  state: MatchState,
  tiles: readonly MatchTile[],
  key: string,
): { state: MatchState; event: MatchEvent; pair?: [string, string] } {
  if (state.wrongPair) return { state, event: 'ignored' };
  const tile = tiles.find(t => t.key === key);
  if (!tile || state.matchedPairIds.includes(tile.pairId)) return { state, event: 'ignored' };

  if (!state.selectedKey) return { state: { ...state, selectedKey: key }, event: 'select' };
  if (state.selectedKey === key) return { state: { ...state, selectedKey: null }, event: 'deselect' };

  const first = tiles.find(t => t.key === state.selectedKey);
  if (!first) return { state: { ...state, selectedKey: key }, event: 'select' };
  // Dwa terminy albo dwa znaczenia — to nie próba pary, tylko zmiana wyboru.
  if (first.side === tile.side) return { state: { ...state, selectedKey: key }, event: 'switch' };

  const pair: [string, string] = [first.key, tile.key];
  if (first.pairId === tile.pairId) {
    return {
      state: {
        ...state,
        selectedKey: null,
        matchedPairIds: [...state.matchedPairIds, tile.pairId],
        combo: state.combo + 1,
      },
      event: 'match',
      pair,
    };
  }
  return {
    state: { ...state, selectedKey: null, wrongPair: pair, mistakes: state.mistakes + 1, combo: 0 },
    event: 'wrong',
    pair,
  };
}

/** Koniec animacji błędnej pary — plansza wraca do stanu wyjściowego. */
export const resolveWrong = (state: MatchState): MatchState =>
  state.wrongPair ? { ...state, wrongPair: null } : state;

export const isRoundComplete = (state: MatchState, tiles: readonly MatchTile[]): boolean =>
  tiles.length > 0 && state.matchedPairIds.length * 2 >= tiles.length;

// --- Gwiazdki ----------------------------------------------------------------

/**
 * Progi (p = liczba par, b = liczba błędów):
 *  - 3 gwiazdki: b <= ceil(10% p)  → 1 błąd dopuszczony już przy 1–10 parach
 *    (w rundzie max 6 par: 0–1 błąd),
 *  - 2 gwiazdki: b <= ceil(30% p)  → 6 par: do 2 błędów, 10 par: do 3,
 *  - 1 gwiazdka: pozostałe przypadki (zawsze co najmniej 1).
 * Przy 1–2 parach próg 2★ pokrywa się z 3★ (2★ nieosiągalne) — świadomie.
 */
export function starsFor(pairs: number, mistakes: number): 1 | 2 | 3 {
  const three = Math.ceil(pairs * 0.1);
  const two = Math.ceil(pairs * 0.3);
  if (mistakes <= three) return 3;
  if (mistakes <= two) return 2;
  return 1;
}

/** Wynik punktowy zapisywany jak dotąd w `saveSession` (formuła bez zmian). */
export const matchingScore = (elapsedSeconds: number, mistakes: number): number =>
  Math.max(0, 100 - elapsedSeconds - mistakes * 5);

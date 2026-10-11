/**
 * Plansza „Dopasuj pary” — czysta logika układu, wspólna dla pracy domowej i ćwiczeń dowolnych.
 *
 * Układ jest STABILNY: kolejność kafelków ustalamy raz (z ziarna), po lewej angielski w kolejności
 * zadania, po prawej polski przetasowany jednorazowo. Zaznaczenie, trafienie, błąd i ponowny render
 * niczego nie przestawiają — nie ma tu żadnego losowania poza `seededShuffle`, a ono jest
 * deterministyczne dla danego ziarna.
 */
import { GAME_TILE_SHADES, shadeForHit, type GameTileShade } from './gameTile';

/** Najwięcej par w jednej rundzie (większe zestawy dzielimy na kolejne rundy). */
export const MAX_PAIRS_PER_ROUND = 5;

export interface BoardPair {
  id: string;
  left: string;
  right: string;
}

/** 32-bitowy hash tekstu (FNV-1a) — ziarno generatora. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — mały, szybki generator deterministyczny. */
export function seededRng(seed: string | number): () => number {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates na kopii, deterministyczny dla ziarna. */
export function seededShuffle<T>(items: readonly T[], seed: string | number): T[] {
  const rng = seededRng(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Podział na rundy po najwyżej `max` par, wyrównany (6 → 3+3, 7 → 4+3, 11 → 4+4+3), tak żeby żadna runda
 * nie została z jedną parą (jedna para nie jest zadaniem na dopasowanie).
 */
export function splitRounds<T>(pairs: readonly T[], max: number = MAX_PAIRS_PER_ROUND): T[][] {
  if (pairs.length === 0) return [];
  const rounds = Math.ceil(pairs.length / max);
  const base = Math.floor(pairs.length / rounds);
  const extra = pairs.length % rounds;
  const out: T[][] = [];
  let at = 0;
  for (let r = 0; r < rounds; r++) {
    const size = base + (r < extra ? 1 : 0);
    out.push(pairs.slice(at, at + size));
    at += size;
  }
  return out;
}

export interface RoundLayout {
  left: BoardPair[];
  right: BoardPair[];
}

/**
 * Układ jednej rundy: lewa kolumna w kolejności zadania, prawa przetasowana RAZ z ziarna.
 * Prawa kolumna nigdy nie jest w tej samej kolejności co lewa (inaczej rozwiązanie byłoby widać).
 */
export function layoutRound(pairs: readonly BoardPair[], seed: string): RoundLayout {
  const left = pairs.slice();
  let right = seededShuffle(pairs, seed);
  if (pairs.length >= 2 && right.every((p, i) => p.id === left[i].id)) {
    right = [...right.slice(1), right[0]];
  }
  return { left, right };
}

/** Ziarno z treści ćwiczenia (id ćwiczeń w zadaniu bywają powtarzalne, treść — nie). */
export const boardSeed = (pairs: readonly BoardPair[]): string => pairs.map((p) => `${p.id}:${p.left}:${p.right}`).join('|');

/** Odcień trafionej pary: k-te trafienie z rzędu dostaje k-ty odcień; niedopasowana para → `undefined`. */
export function pairShade(hits: readonly string[], pairId: string): GameTileShade | undefined {
  const index = hits.indexOf(pairId);
  return index < 0 ? undefined : shadeForHit(index);
}

export { GAME_TILE_SHADES };

/** Pary z zadania bez pustych pól i duplikatów id — wejście dla `splitRounds`. */
export function cleanPairs(raw: unknown): BoardPair[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BoardPair[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const { id, left, right } = p as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof left !== 'string' || !left.trim() || typeof right !== 'string' || !right.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, left, right });
  }
  return out;
}

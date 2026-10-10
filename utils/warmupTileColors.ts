/**
 * Dekoracyjny kolor kafelków układanki — czysta logika.
 *
 * Kolor NIE niesie znaczenia: zależy wyłącznie od TEKSTU kafelka i ziarna rundy (treść zadania),
 * więc jest niezależny od roli (poprawny/dystraktor) i od pozycji w poprawnej odpowiedzi, a przy
 * tym stabilny przy odświeżeniu i przetasowaniu puli. Kafelki jednej rundy dostają kolejne
 * odcienie w kolejności wyznaczonej hashem tekstu, więc pierwsze 5 kafelków ma 5 różnych barw.
 */
import { hashString } from './warmupChunks';

/** Liczba odcieni w palecie (tokeny `tile-1…tile-5` w index.css). */
export const TILE_COLOR_COUNT = 5;

const norm = (text: string): string => text.toLowerCase().trim().replace(/\s+/g, ' ');

/** Indeks koloru 0…4 dla każdego kafelka, w kolejności wejścia. `keys` = teksty kafelków. */
export function assignTileColors(keys: readonly string[], seed: string): number[] {
  const order = keys
    .map((key, index) => ({ index, h: hashString(`${seed}|${norm(key)}`) }))
    .sort((a, b) => a.h - b.h || a.index - b.index);
  const offset = hashString(`${seed}|offset`) % TILE_COLOR_COUNT;
  const colors = new Array<number>(keys.length).fill(0);
  order.forEach(({ index }, rank) => {
    colors[index] = (rank + offset) % TILE_COLOR_COUNT;
  });
  return colors;
}

/**
 * Tasowanie i cięcie zdań na klocki dla ćwiczeń układankowych.
 *
 * Generator AI układa opcje w kolejności, w jakiej o nich myśli — czyli
 * poprawną odpowiedź zwykle jako pierwszą. Ćwiczenie przestaje wtedy sprawdzać
 * cokolwiek, bo kursant trafia bez czytania. Tasujemy więc po stronie kodu,
 * nie licząc na to, że model posłucha instrukcji w promcie.
 */

/** Fisher-Yates. `random` wstrzykiwane, żeby testy były powtarzalne. */
export function shuffleArray<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Tasuje tak, żeby wynik różnił się od wejścia.
 *
 * Zwykłe tasowanie potrafi zwrócić dokładnie tę samą kolejność, a układanka,
 * która od razu jest ułożona, nie jest żadnym zadaniem. Przy krótkich listach
 * to zdarza się często (dla 2 elementów w połowie przypadków).
 */
export function shuffleDistinct<T>(items: T[], random: () => number = Math.random): T[] {
  if (items.length < 2) return [...items];

  // Lista złożona z identycznych elementów nie ma innej kolejności do wylosowania.
  const allIdentical = items.every(item => item === items[0]);
  if (allIdentical) return [...items];

  const isSameOrder = (candidate: T[]) => candidate.every((item, index) => item === items[index]);

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = shuffleArray(items, random);
    if (!isSameOrder(candidate)) return candidate;
  }

  // Zamiana dwóch różnych sąsiadów zawsze daje inną kolejność.
  const fallback = [...items];
  for (let i = 0; i < fallback.length - 1; i++) {
    if (fallback[i] !== fallback[i + 1]) {
      [fallback[i], fallback[i + 1]] = [fallback[i + 1], fallback[i]];
      break;
    }
  }
  return fallback;
}

/**
 * Tnie zdanie na klocki do ułożenia.
 *
 * Nie na pojedyncze słowa: przy dłuższym zdaniu dwadzieścia jednowyrazowych
 * klocków to mozolne klikanie, a nie nauka szyku. Łączymy słowa w grupy tak,
 * by wyszło około `targetTiles` kawałków, zachowując kolejność wyrazów.
 */
export function splitSentenceIntoTiles(sentence: string, targetTiles = 6): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= targetTiles) return words;

  const wordsPerTile = Math.ceil(words.length / targetTiles);
  const tiles: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerTile) {
    tiles.push(words.slice(i, i + wordsPerTile).join(' '));
  }
  return tiles;
}

/** Klocki gotowe do pokazania: pocięte zdanie w losowej, na pewno innej kolejności. */
export function buildShuffledTiles(
  sentence: string,
  targetTiles = 6,
  random: () => number = Math.random
): { tiles: string[]; solution: string[] } {
  const solution = splitSentenceIntoTiles(sentence, targetTiles);
  return { tiles: shuffleDistinct(solution, random), solution };
}

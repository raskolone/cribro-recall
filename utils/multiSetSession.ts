/**
 * Ćwiczenie z kilku zestawów naraz → zapis wyniku istniejącą ścieżką (`saveSession` per zestaw).
 *
 * `saveSession` zna jeden `setId` (statystyki zestawu, wpis w historii, dziennik błędów),
 * więc zamiast zmieniać kontekst i reguły dzielimy wynik wspólnej sesji na zestawy, z których
 * pochodziły karty, i wołamy `saveSession` raz dla każdego z nich — dokładnie tak, jakby kursant
 * ćwiczył je osobno. Czysta logika, bez Firebase.
 */

export interface SessionDataLike {
  setId?: string;
  mode?: string;
  totalCards?: number;
  correctCount?: number;
  scorePercent?: number;
  [key: string]: unknown;
}

export interface SessionResultLike {
  flashcardId?: string;
  isCorrect?: boolean;
  [key: string]: unknown;
}

/**
 * Wspólna lista kart z kilku zestawów: karty o tym samym `id` w różnych zestawach dostają
 * unikalne `id` na czas sesji (`<setId>::<id>`) — moduły ćwiczeń kluczują po `id`, a bez tego
 * druga karta z kolizją by zniknęła. `originalIds` pozwala przywrócić prawdziwe `id` przy zapisie.
 */
export function mergeSetCards<C extends { id: string }>(
  lists: ReadonlyArray<{ setId: string; cards: readonly C[] }>,
): { cards: C[]; cardSetMap: Record<string, string>; originalIds: Record<string, string> } {
  const cards: C[] = [];
  const cardSetMap: Record<string, string> = {};
  const originalIds: Record<string, string> = {};
  for (const { setId, cards: list } of lists) {
    for (const card of list) {
      let id = card.id;
      if (cardSetMap[id]) {
        if (cardSetMap[id] === setId) continue; // ta sama karta dwa razy w jednym zestawie
        id = `${setId}::${card.id}`;
        originalIds[id] = card.id;
      }
      cardSetMap[id] = setId;
      cards.push(id === card.id ? card : { ...card, id });
    }
  }
  return { cards, cardSetMap, originalIds };
}

export interface SessionPart<D, R> {
  sessionData: D;
  results: R[];
}

/**
 * @param cardSetMap `id karty → id zestawu`, z którego karta została wczytana
 * @param fallbackSetId zestaw dla wyników bez znanej karty (nie powinno się zdarzać)
 * @param originalIds `id` na czas sesji → prawdziwe `id` karty (patrz `mergeSetCards`)
 */
export function splitSessionBySet<D extends SessionDataLike, R extends SessionResultLike>(
  sessionData: D,
  results: readonly R[],
  cardSetMap: Readonly<Record<string, string>>,
  fallbackSetId: string,
  originalIds: Readonly<Record<string, string>> = {},
): SessionPart<D, R>[] {
  const groups = new Map<string, R[]>();
  for (const result of results) {
    const setId = (result.flashcardId && cardSetMap[result.flashcardId]) || fallbackSetId;
    const restored =
      result.flashcardId && originalIds[result.flashcardId] ? { ...result, flashcardId: originalIds[result.flashcardId] } : result;
    const list = groups.get(setId);
    if (list) list.push(restored);
    else groups.set(setId, [restored]);
  }
  if (groups.size === 0) return [{ sessionData: { ...sessionData, setId: fallbackSetId }, results: [] }];
  return [...groups].map(([setId, part]) => {
    const correctCount = part.filter((r) => r.isCorrect).length;
    return {
      sessionData: {
        ...sessionData,
        setId,
        totalCards: part.length,
        correctCount,
        scorePercent: part.length > 0 ? Math.round((correctCount / part.length) * 100) : 0,
      },
      results: part,
    };
  });
}

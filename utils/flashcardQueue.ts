/**
 * Czysta logika kolejki powtórek w sesji fiszek.
 *
 * Zasady (Etap R3):
 * 1. Karta oznaczona „Nie umiem" wraca do kolejki po ok. 3 kolejnych kartach (jeśli zostało mniej, na koniec)
 *    i powtarza się, dopóki kursant nie oceni jej „Umiem" lub nie wybierze „Zostaw na później".
 * 2. Sesja kończy się, gdy wszystkie karty są opanowane (kolejka jest pusta).
 * 3. Zabezpieczenie: po 4 kolejnych „Nie umiem" tej samej karty dostępna jest opcja „Zostaw na później".
 * 4. SRS i saveSession: zapisuje tylko PIERWSZĄ ocenę każdej karty w sesji (dalsze powtórki to nauka wewnątrz sesji).
 * 5. Zbierana jest lista słów słabych (kiedykolwiek oznaczonych „Nie umiem").
 */

export interface QueueItem<T = any> {
  card: T;
  consecutiveFailures: number;
}

export interface CardRating {
  flashcardId: string;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface FlashcardQueueState<T = any> {
  initialTotal: number;
  queue: QueueItem<T>[];
  masteredCount: number;
  firstRatings: Map<string, CardRating>;
  weakWordIds: Set<string>;
  weakWords: string[];
  isFinished: boolean;
}

export function createFlashcardQueue<T extends { id: string; term?: string }>(cards: readonly T[]): FlashcardQueueState<T> {
  return {
    initialTotal: cards.length,
    queue: cards.map((card) => ({ card, consecutiveFailures: 0 })),
    masteredCount: 0,
    firstRatings: new Map(),
    weakWordIds: new Set(),
    weakWords: [],
    isFinished: cards.length === 0,
  };
}

export function getCurrentCard<T>(state: FlashcardQueueState<T>): T | null {
  return state.queue[0]?.card ?? null;
}

export function getCurrentConsecutiveFailures<T>(state: FlashcardQueueState<T>): number {
  return state.queue[0]?.consecutiveFailures ?? 0;
}

export function canLeaveCurrentForLater<T>(state: FlashcardQueueState<T>): boolean {
  return (state.queue[0]?.consecutiveFailures ?? 0) >= 4;
}

export function rateCurrentCard<T extends { id: string; term?: string }>(
  state: FlashcardQueueState<T>,
  isCorrect: boolean,
  responseTimeMs = 0,
): FlashcardQueueState<T> {
  if (state.queue.length === 0) return state;

  const currentItem = state.queue[0];
  const cardId = currentItem.card.id;
  const cardTerm = currentItem.card.term || cardId;

  // Zapisujemy tylko PIERWSZĄ ocenę dla SRS
  const newFirstRatings = new Map(state.firstRatings);
  if (!newFirstRatings.has(cardId)) {
    newFirstRatings.set(cardId, {
      flashcardId: cardId,
      isCorrect,
      responseTimeMs,
    });
  }

  const newWeakWordIds = new Set(state.weakWordIds);
  const newWeakWords = [...state.weakWords];

  if (!isCorrect) {
    if (!newWeakWordIds.has(cardId)) {
      newWeakWordIds.add(cardId);
      if (!newWeakWords.includes(cardTerm)) {
        newWeakWords.push(cardTerm);
      }
    }

    const newConsecutiveFailures = currentItem.consecutiveFailures + 1;
    const remaining = state.queue.slice(1);
    // Karta wraca po ok. 3 kolejnych kartach (jeśli zostało mniej, na koniec)
    const insertIndex = Math.min(3, remaining.length);
    const newQueue = [
      ...remaining.slice(0, insertIndex),
      { card: currentItem.card, consecutiveFailures: newConsecutiveFailures },
      ...remaining.slice(insertIndex),
    ];

    return {
      ...state,
      queue: newQueue,
      firstRatings: newFirstRatings,
      weakWordIds: newWeakWordIds,
      weakWords: newWeakWords,
      isFinished: false,
    };
  }

  // Karta opanowana (isCorrect = true)
  const newQueue = state.queue.slice(1);
  const newMasteredCount = state.masteredCount + 1;

  return {
    ...state,
    queue: newQueue,
    masteredCount: newMasteredCount,
    firstRatings: newFirstRatings,
    weakWordIds: newWeakWordIds,
    weakWords: newWeakWords,
    isFinished: newQueue.length === 0,
  };
}

export function leaveCurrentForLater<T extends { id: string; term?: string }>(
  state: FlashcardQueueState<T>,
): FlashcardQueueState<T> {
  if (state.queue.length === 0) return state;

  const currentItem = state.queue[0];
  const cardId = currentItem.card.id;
  const cardTerm = currentItem.card.term || cardId;

  const newWeakWordIds = new Set(state.weakWordIds);
  const newWeakWords = [...state.weakWords];
  if (!newWeakWordIds.has(cardId)) {
    newWeakWordIds.add(cardId);
    if (!newWeakWords.includes(cardTerm)) {
      newWeakWords.push(cardTerm);
    }
  }

  // Karta kończy pętlę i opuszcza kolejkę
  const newQueue = state.queue.slice(1);

  return {
    ...state,
    queue: newQueue,
    weakWordIds: newWeakWordIds,
    weakWords: newWeakWords,
    isFinished: newQueue.length === 0,
  };
}

export function getSessionSummary<T>(state: FlashcardQueueState<T>) {
  const results = Array.from(state.firstRatings.values());
  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = state.initialTotal;
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return {
    totalCards: total,
    correctCount,
    scorePercent,
    results,
    weakWords: state.weakWords,
  };
}

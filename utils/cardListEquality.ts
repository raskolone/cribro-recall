/**
 * Czy dwie listy kart to ta sama talia (te same id, hasła i definicje, w tej samej kolejności).
 *
 * `FlashcardStudyScreen` ładuje karty w efekcie zależnym od funkcji z `FlashcardContext`, której
 * tożsamość zmienia się przy każdym renderze dostawcy (np. po zapisie sesji). Samo przeładowanie
 * zwraca NOWĄ tablicę o tej samej treści — jeśli podstawimy ją do stanu, wszystkie tryby nauki
 * (fiszki, quiz, dopasowanie) zaczynają sesję od nowa i ekran końcowy znika. Gdy talia jest
 * identyczna, zostawiamy poprzednią tablicę.
 */
export interface CardLike {
  id?: string;
  term?: string;
  definition?: string;
}

export function sameCardList(a: readonly CardLike[], b: readonly CardLike[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((card, i) => card.id === b[i].id && card.term === b[i].term && card.definition === b[i].definition);
}

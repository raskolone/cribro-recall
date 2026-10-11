/**
 * Polecenie ćwiczenia — jedna tablica typ → klucz i18n. Tekst polecenia pochodzi WYŁĄCZNIE stąd
 * (pl.json / en.json), nigdy z modelu: generator nie może go zmienić ani zepsuć.
 */
export type InstructionType =
  | 'translation'
  | 'multiple_choice'
  | 'fill_in_the_blank'
  | 'find_errors'
  | 'correction'
  | 'matching'
  | 'word_order';

export const EXERCISE_INSTRUCTION_KEYS: Record<InstructionType, string> = {
  translation: 'Przetłumacz zdanie na angielski',
  multiple_choice: 'Wybierz poprawną odpowiedź',
  fill_in_the_blank: 'Uzupełnij lukę',
  find_errors: 'Znajdź błąd i popraw zdanie',
  correction: 'Znajdź i popraw błąd w zdaniu',
  matching: 'Dopasuj polskie i angielskie odpowiedniki',
  word_order: 'Ułóż wyrazy w poprawne zdanie',
};

/**
 * Dzieli zdanie na część przed luką i po niej (pierwsza luka `___`, dwa i więcej podkreślników).
 * Brak luki → `null` (zdanie zostaje wyświetlone bez zmian). Treść zdania w danych się nie zmienia.
 */
export function splitAtGap(sentence: string | undefined | null): { before: string; after: string } | null {
  if (typeof sentence !== 'string') return null;
  const match = /_{2,}/.exec(sentence);
  if (!match) return null;
  return { before: sentence.slice(0, match.index), after: sentence.slice(match.index + match[0].length) };
}

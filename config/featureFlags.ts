/**
 * Widoczność modułów w panelu kursanta.
 *
 * Brief zabrania usuwania kodu: jeśli coś ma zniknąć z widoku, ma zniknąć przez
 * przełącznik, nie przez kasowanie implementacji. Zmiana wartości w tym pliku
 * przywraca moduł bez pisania czegokolwiek od nowa.
 *
 * O wartościach decyduje Maciej. Domyślnie `false` jest tu tylko `streak`,
 * bo tak mówi brief wprost — reszta zostaje widoczna.
 */

export interface ModuleVisibility {
  /** Licznik passy („🔥 X dni") w domyślnym widoku kursanta. */
  streak: boolean;
  /** Generator „Słownictwo ogólne: miks i koszyk" — widoczny, ale drugorzędny. */
  generalVocabularyGenerator: boolean;
  /** Tryb „Dopasowanie" (Gra). */
  matchingGame: boolean;
  /** Testy w widoku kursanta. */
  studentTests: boolean;
  /** Otwarty generator zdań jako „Praktyka dodatkowa" — nigdy jako domyślne wejście. */
  extraPractice: boolean;
}

/**
 * Silnik prac domowych v2 — trzy typy, trzy próby, rubryka 40/40/20.
 *
 * Osobno od `MODULE_VISIBILITY`, bo to nie jest decyzja o widoczności modułu,
 * tylko przełącznik całej ścieżki: przy `false` panel lektora pokazuje kreator
 * v1, kursant dostaje ekran v1, a `onCall` silnika v2 odmawia wykonania.
 * Wyłączenie flagi jest rollbackiem — nie wymaga cofania wdrożenia ani migracji
 * danych, bo zestawy v1 nigdy nie były mutowane.
 *
 * Druga połowa tej flagi żyje po stronie Cloud Functions
 * (`functions/src/homeworkV2/flag.ts`) i obie muszą być włączone, żeby v2
 * zadziałało. Ustawienie fail-safe jest zamierzone: sama przeglądarka nie
 * włącza silnika, a sama funkcja nie pokaże UI, którego nie ma.
 */
export const HOMEWORK_ENGINE_V2 = true;

export const MODULE_VISIBILITY: ModuleVisibility = {
  streak: false,
  generalVocabularyGenerator: true,
  matchingGame: true,
  studentTests: true,
  extraPractice: true,
};

export const isModuleVisible = (module: keyof ModuleVisibility): boolean =>
  MODULE_VISIBILITY[module] !== false;

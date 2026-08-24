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

export const MODULE_VISIBILITY: ModuleVisibility = {
  streak: false,
  generalVocabularyGenerator: true,
  matchingGame: true,
  studentTests: true,
  extraPractice: true,
};

export const isModuleVisible = (module: keyof ModuleVisibility): boolean =>
  MODULE_VISIBILITY[module] !== false;

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
export const HOMEWORK_ENGINE_V2 = false;

/**
 * Model blokowy współdzielonego notatnika (Iteracja 1 — fundament).
 *
 * Rozszerzenie hybrydowe: `ScratchpadDocument.blocks` obok istniejącego
 * `contentHtml`, bez migracji starych dokumentów. Przy `false`
 * `ScratchpadEditor` działa dokładnie jak dotąd (surowy `contentEditable`
 * sterowany `contentHtml`) — zero zmian w zachowaniu UI. Włączenie flagi
 * (localStorage klucz `scratchpad_shared_notebook_v2` albo zmienna
 * środowiskowa `VITE_SHARED_NOTEBOOK_V2`) odsłania fundament: adapter
 * blocks↔HTML i inicjalizację stanu blokowego w edytorze — nie zmienia
 * jeszcze samego renderowania.
 */
export const SHARED_NOTEBOOK_V2 = false;

const readLocalStorageFlag = (key: string): boolean | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return raw.trim().toLowerCase() === 'true';
  } catch {
    return null;
  }
};

/**
 * Aktywacja `SHARED_NOTEBOOK_V2` w trzech krokach: jawny override w
 * localStorage (do testów ręcznych bez rebuildu), potem `VITE_SHARED_NOTEBOOK_V2`
 * ze środowiska builda, na końcu stała powyżej (domyślnie wyłączona).
 */
export const isSharedNotebookV2Enabled = (): boolean => {
  const fromLocalStorage = readLocalStorageFlag('scratchpad_shared_notebook_v2');
  if (fromLocalStorage !== null) return fromLocalStorage;

  const env: any = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || (typeof process !== 'undefined' && process.env) || {};
  const fromEnv = env.VITE_SHARED_NOTEBOOK_V2;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim().toLowerCase() === 'true';
  }

  return SHARED_NOTEBOOK_V2;
};

export const MODULE_VISIBILITY: ModuleVisibility = {
  streak: false,
  generalVocabularyGenerator: true,
  matchingGame: true,
  studentTests: true,
  extraPractice: true,
};

export const isModuleVisible = (module: keyof ModuleVisibility): boolean =>
  MODULE_VISIBILITY[module] !== false;

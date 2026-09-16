/**
 * JEDNA PALETA NOTATNIKA.
 *
 * ══ PO CO OSOBNY PLIK ══
 *
 * Kolory w notatniku nie są klasami CSS — `execCommand` i szablon lekcji
 * wpisują je WPROST w treść dokumentu (`style="color:…"`). Motyw nie ma więc
 * jak ich przestawić: ta sama wartość musi działać na jasnym papierze
 * i na ciemnej kartce, dziś i za rok, w dokumencie, którego nikt nie będzie
 * przepisywał.
 *
 * Dopóki palety nie było, były dwie: pięć barw nagłówków w szablonie lekcji
 * i pięć barw w pasku narzędzi, dobranych niezależnie i obie wyłącznie pod
 * jasny papier. Na ciemnej kartce granatowy #2563eb i fioletowy #7c3aed
 * schodziły poniżej progu czytelności, a reszta robiła się jaskrawymi
 * plamami różnej mocy.
 *
 * ══ DLACZEGO WSZYSTKIE MAJĄ TĘ SAMĄ JASNOŚĆ ══
 *
 * Każda z tych barw ma jasność względną około 0,22, czyli około 3,4:1 na
 * jasnym papierze i 4,4:1 na ciemnej kartce — po obu stronach czytelnie.
 * Wspólna jasność jest tym, co robi z nich JEDEN zestaw zamiast sześciu
 * niezależnych decyzji: różnią się wyłącznie odcieniem, bo tylko odcień
 * niesie tu znaczenie.
 *
 * Wpisy zrobione wcześniej zachowują swoje kolory. Są zapisane w treści
 * dokumentu i nikt ich nie przepisuje za lektorem.
 */

export interface NotebookColor {
  name: string;
  value: string;
}

/** Sześć odcieni jednej jasności — źródło dla szablonu i paska narzędzi.
 * Zsynchronizowane z systemem kolorów Nocturne Green (tokens.css). */
export const NOTEBOOK_COLORS = {
  rose: '#fb7185',
  red: '#f87171',
  orange: '#fbbf24',
  green: '#72f0b4',
  blue: '#67b5fa',
  violet: '#a78bfa',
} as const;

/** Kolor tekstu kartki — musi zgadzać się z `--pad-fg` w `index.css`. */
export const NOTEBOOK_INK = {
  light: '#2c2822',
  dark: '#eae8e3',
} as const;

/** Paleta paska narzędzi. Zamknięta: to notatnik lekcyjny, nie edytor grafiki. */
export const NOTEBOOK_SWATCHES: NotebookColor[] = [
  { name: 'Czerwony', value: NOTEBOOK_COLORS.red },
  { name: 'Pomarańczowy', value: NOTEBOOK_COLORS.orange },
  { name: 'Zielony (Nocturne)', value: NOTEBOOK_COLORS.green },
  { name: 'Niebieski', value: NOTEBOOK_COLORS.blue },
  { name: 'Fioletowy', value: NOTEBOOK_COLORS.violet },
];

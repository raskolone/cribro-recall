/**
 * JEDNA PALETA NOTATNIKA.
 *
 * ══ PO CO OSOBNY PLIK ══
 *
 * Kolory w notatniku nie są klasami CSS — `execCommand` i szablon lekcji
 * wpisują je WPROST w treść dokumentu (`style="color:…"`), więc motyw
 * (jasny/ciemny papier) nie ma jak ich przestawić PO fakcie — kolor
 * wybrany przy wstawieniu zostaje w dokumencie, dziś i za rok, w
 * dokumencie, którego nikt nie będzie przepisywał.
 *
 * Dopóki palety nie było, były dwie: pięć barw nagłówków w szablonie lekcji
 * i pięć barw w pasku narzędzi, dobranych niezależnie i obie wyłącznie pod
 * jasny papier. Na ciemnej kartce granatowy #2563eb i fioletowy #7c3aed
 * schodziły poniżej progu czytelności, a reszta robiła się jaskrawymi
 * plamami różnej mocy. Rozwiązaniem było jedno wspólne wynagrodzenie
 * jasności (~0,22) — 3,4:1 na jasnym papierze, 4,4:1 na ciemnym.
 *
 * ══ DLACZEGO NAGŁÓWKI SEKCJI (`NOTEBOOK_COLORS`) MAJĄ DZIŚ DWIE WARTOŚCI ══
 *
 * 3,4:1 na jasnym papierze nie przechodzi WCAG AA (próg 4,5:1) — konkretna
 * skarga na czytelność. Jeden wspólny, ciemniejszy hex naprawiłby jasny
 * papier i wrócił do problemu z akapitu wyżej na ciemnym. Stąd
 * `NOTEBOOK_COLORS[klucz]` ma teraz `{ light, dark }`: `dark` to oryginalna,
 * już działająca wartość; `light` to osobno dobrany, ciemniejszy odcień
 * (rodzina Tailwind 700–900) tylko pod jasny papier. Pasek narzędzi
 * (`TOOLBAR_COLORS`) zostaje przy jednym wspólnym heksie — uzasadnienie przy
 * tej stałej niżej.
 *
 * Wpisy zrobione wcześniej zachowują swoje kolory. Są zapisane w treści
 * dokumentu i nikt ich nie przepisuje za lektorem — dotyczy to też
 * nagłówków wstawionych PRZED tą zmianą (zostają przy starym, jasnym
 * odcieniu) i tych, które kursant zobaczy po zmianie motywu papieru już
 * PO wstawieniu (patrz komentarz przy `NOTEBOOK_COLORS` niżej).
 */

export interface NotebookColor {
  name: string;
  value: string;
}

/**
 * Kolory NAGŁÓWKÓW sekcji lekcji (`LESSON_SECTIONS`), osobno na jasny
 * i ciemny papier.
 *
 * Jeden wspólny hex (patrz historia niżej w tym pliku) dawał tylko ~3,4:1 na
 * jasnym papierze — poniżej progu WCAG AA (4,5:1) dla zwykłego tekstu.
 * Podbicie do jednego, ciemniejszego heksa naprawiłoby jasny papier i
 * zepsuło ciemny dokładnie tak, jak opisuje historia niżej („mocne, ciemne
 * barwy... na ciemnej kartce robiły się jaskrawymi plamami"). Stąd para
 * wartości na kolor: `dark` to bez zmian oryginalny, dobrany zestaw (nadal
 * ~4,4:1 na ciemnej kartce); `light` to ciemniejszy, bardziej nasycony
 * odcień z rodziny Tailwind 700–900, dobrany pod jasny papier.
 *
 * Kolor jest wpisany w HTML dokumentu w momencie WSTAWIENIA sekcji (patrz
 * `buildLessonTemplate` w `utils/lessonTemplate.ts`), więc — tak jak reszta
 * kolorów w notatniku — nagłówek zachowuje kolor z chwili napisania, nawet
 * gdy kursant później przełączy kartkę na drugi motyw. To jest znana i
 * zaakceptowana właściwość tego systemu (patrz „Wpisy zrobione wcześniej
 * zachowują swoje kolory" niżej), nie nowa wada.
 */
export interface ThemedHex {
  light: string;
  dark: string;
}

export const NOTEBOOK_COLORS: Record<'rose' | 'red' | 'orange' | 'green' | 'blue' | 'violet', ThemedHex> = {
  rose: { light: '#9f1239', dark: '#fb7185' },
  red: { light: '#991b1b', dark: '#f87171' },
  orange: { light: '#92400e', dark: '#fbbf24' },
  green: { light: '#065f46', dark: '#72f0b4' },
  blue: { light: '#1e40af', dark: '#67b5fa' },
  violet: { light: '#5b21b6', dark: '#a78bfa' },
};

/** Kolor nagłówka sekcji dla danego motywu papieru. */
export const notebookHeadingColor = (
  key: keyof typeof NOTEBOOK_COLORS,
  paperTheme: 'light' | 'dark'
): string => NOTEBOOK_COLORS[key][paperTheme];

/**
 * Paleta paska narzędzi (kolor DOWOLNEGO zaznaczonego tekstu, nie
 * nagłówków) — celowo NIE dostała podziału light/dark jak wyżej. Kursant
 * koloruje nią słowo w trakcie pisania w jednym, ustalonym momencie; ten
 * sam problem (kolor zamrożony w HTML w chwili wpisania) dotyczyłby jej
 * tak samo, ale bez korzyści z góry — w przeciwieństwie do pięciu stałych
 * nagłówków sekcji, tu nie wiadomo z góry, na jaki fragment tekstu kolor
 * padnie, więc dobór „pod aktualny motyw" nie ma jednego oczywistego
 * miejsca do zastosowania. Zostaje pierwotny, jeden-hex-na-kolor dobór
 * (~3,4:1 / ~4,4:1) opisany w komentarzu niżej.
 */
export const TOOLBAR_COLORS = {
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
  { name: 'Czerwony', value: TOOLBAR_COLORS.red },
  { name: 'Pomarańczowy', value: TOOLBAR_COLORS.orange },
  { name: 'Zielony (Nocturne)', value: TOOLBAR_COLORS.green },
  { name: 'Niebieski', value: TOOLBAR_COLORS.blue },
  { name: 'Fioletowy', value: TOOLBAR_COLORS.violet },
];

/**
 * Nagłówki wstawione PRZED podziałem `NOTEBOOK_COLORS` na `{light, dark}`
 * (patrz historia wyżej w tym pliku) mają wpisany wprost w HTML jeden,
 * wspólny hex — dziś przechowywany jako wartość `dark` w `NOTEBOOK_COLORS`
 * — który na jasnym papierze daje ~3,4:1, poniżej progu WCAG AA. Te
 * nagłówki są ZAPISANE w dokumencie i nikt ich nie przepisuje za lektorem
 * (patrz komentarz wyżej), więc naprawa nie może być zapisem do bazy —
 * to wyłącznie transformacja PRZY WCZYTANIU do edytora na jasny papier,
 * ograniczona do nagłówków sekcji lekcji (`<h3>` z jednym z pięciu znanych
 * tytułów), żeby nie dotknąć koloru, który lektor ręcznie nadał zwykłemu
 * tekstowi paskiem narzędzi (te same heksy, inne znaczenie).
 */
const KNOWN_SECTION_TITLES = [
  'Revision',
  'Main topic / Practice',
  'Lesson Summary',
  'Key Language &amp; Corrections (New words)',
  'Key Language & Corrections (New words)',
  'Homework',
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Podnosi kontrast starych, zamrożonych nagłówków sekcji lekcji na jasnym
 * papierze. Bezpieczna do wywołania przy KAŻDYM wczytaniu treści do
 * edytora — nie mutuje zapisanego dokumentu, tylko to, co się renderuje.
 * Na ciemnym papierze nie robi nic (stare nagłówki tam już mają
 * odpowiedni kontrast — to ten sam hex, co dzisiejsza wartość `dark`).
 */
export const sanitizeFrozenHeadingContrast = (html: string, paperTheme: 'light' | 'dark'): string => {
  if (!html || paperTheme !== 'light') return html;

  let result = html;
  // Dopasowuje dokładnie to, co pisze `buildLessonTemplate` w utils/lessonTemplate.ts:
  // `<h3 style="color:${hex}">${title}</h3>`, bez żadnych innych atrybutów w stylu.
  (Object.keys(NOTEBOOK_COLORS) as (keyof typeof NOTEBOOK_COLORS)[]).forEach((key) => {
    const { light, dark } = NOTEBOOK_COLORS[key];
    if (light === dark) return;
    const staleHex = escapeRegExp(dark);
    KNOWN_SECTION_TITLES.forEach((title) => {
      const pattern = new RegExp(
        `<h3 style="color:${staleHex}">(\\s*${escapeRegExp(title)}\\s*)</h3>`,
        'gi'
      );
      result = result.replace(pattern, `<h3 style="color:${light}">$1</h3>`);
    });
  });

  return result;
};

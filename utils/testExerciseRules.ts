/**
 * Reguły typów zadań testowych i kontrola języka treści.
 *
 * Powód istnienia tego pliku: generator produkował ćwiczenia PO POLSKU
 * w aplikacji do nauki angielskiego. Tekst z lukami po polsku, bank słów
 * po polsku, pytania wielokrotnego wyboru po polsku.
 *
 * Przyczyna była w regułach promptu, nie w modelu. Reguła `find_mistake`
 * mówiła wprost „N zdań w języku angielskim" i działała poprawnie. Reguły
 * `fill_in_blank`, `fill_in_blank_bank` i `multiple_choice` nie mówiły
 * o języku NIC — a skoro cały prompt, polecenia i materiał lekcji są po
 * polsku, model brał polski jako domyślny. Zachował się rozsądnie wobec
 * tego, co dostał.
 *
 * Stąd dwie warstwy: jawne reguły z językiem w każdej z nich, oraz
 * walidacja, która sprawdza wynik, zamiast ufać instrukcji.
 */

// ---------------------------------------------------------------------------
// Języki pól
// ---------------------------------------------------------------------------

export type FieldLanguage = 'en' | 'pl' | 'mixed';

export type TestExerciseType =
  | 'translation'
  | 'fill_in_blank'
  | 'fill_in_blank_bank'
  | 'matching'
  | 'find_mistake'
  | 'multiple_choice'
  | 'writing';

/**
 * Jaki język ma mieć które pole w którym typie zadania.
 *
 * `instruction` jest zawsze po polsku — to polecenie dla kursanta, nie
 * materiał do ćwiczenia. Reszta zależy od tego, co zadanie sprawdza.
 */
export const FIELD_LANGUAGES: Readonly<
  Record<TestExerciseType, { prompt: FieldLanguage; correctAnswer: FieldLanguage; wordBank?: FieldLanguage; options?: FieldLanguage }>
> = {
  // Kursant tłumaczy z polskiego na angielski — jedyny typ, w którym
  // polszczyzna w `prompt` jest poprawna i zamierzona.
  translation: { prompt: 'pl', correctAnswer: 'en' },

  // Tekst z lukami jest materiałem do ćwiczenia, więc po angielsku.
  fill_in_blank: { prompt: 'en', correctAnswer: 'en' },
  fill_in_blank_bank: { prompt: 'en', correctAnswer: 'en', wordBank: 'en' },

  // Pary słówko–tłumaczenie: jedna strona polska, druga angielska.
  matching: { prompt: 'mixed', correctAnswer: 'mixed', options: 'mixed' },

  // Zdania z błędami do poprawienia — angielski.
  find_mistake: { prompt: 'en', correctAnswer: 'en' },
  multiple_choice: { prompt: 'en', correctAnswer: 'en', options: 'en' },

  // Polecenie po polsku, wypowiedź kursanta po angielsku.
  writing: { prompt: 'mixed', correctAnswer: 'en' },
};

// ---------------------------------------------------------------------------
// Wykrywanie języka
// ---------------------------------------------------------------------------

/** Litery, które w angielskim nie występują. Najmocniejszy pojedynczy sygnał. */
const POLISH_LETTERS = /[ąćęłńóśźż]/i;

/**
 * Polskie słowa funkcyjne.
 *
 * Sama diakrytyka nie wystarcza: „Monika pracuje w HR i korzysta z aplikacji"
 * nie ma ani jednego ogonka, a jest bezdyskusyjnie po polsku.
 */
const POLISH_STOPWORDS = [
  'jest', 'się', 'nie', 'że', 'aby', 'oraz', 'który', 'która', 'które', 'dla',
  'przez', 'jako', 'tego', 'tym', 'tych', 'jak', 'ale', 'czy', 'gdy', 'kiedy',
  'ponieważ', 'dlatego', 'bardzo', 'swoje', 'swoją', 'może', 'można', 'trzeba',
  'zawsze', 'czasami', 'często', 'wtedy', 'żeby', 'przy', 'pod', 'nad', 'ich',
];

/** Angielskie słowa funkcyjne. */
const ENGLISH_STOPWORDS = [
  'the', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at',
  'for', 'with', 'that', 'this', 'it', 'he', 'she', 'they', 'has', 'have',
  'had', 'but', 'from', 'not', 'you', 'his', 'her', 'their', 'been', 'will',
];

/**
 * Końcówki fleksyjne, które w angielskim praktycznie nie występują.
 *
 * Same słowa funkcyjne nie wystarczały: zdanie „Monika pracuje w HR i czesto
 * korzysta z roznych aplikacji" — wpisane z klawiatury bez polskich znaków —
 * nie ma ani jednego ogonka ani jednego polskiego słowa funkcyjnego, a jest
 * bezdyskusyjnie polskie. Rozpoznaje je dopiero fleksja: pracuje, roznych,
 * aplikacji.
 *
 * Próg sześciu znaków chroni przed angielskimi zbiegami okoliczności —
 * bez niego „beach" i „each" liczyłyby się jako polskie przez końcówkę -ach.
 */
const POLISH_SUFFIXES = [
  'uje', 'ują', 'ych', 'ego', 'emu', 'ami', 'cji', 'ści', 'ość',
  'owy', 'owa', 'owe', 'ować', 'kiem', 'ach', 'ymi', 'iej', 'nej',
];

const MIN_SUFFIX_WORD_LENGTH = 6;

const countPolishSuffixes = (haystack: string[]): number =>
  haystack.filter(
    (w) => w.length >= MIN_SUFFIX_WORD_LENGTH && POLISH_SUFFIXES.some((suf) => w.endsWith(suf))
  ).length;

const words = (text: string): string[] =>
  text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);

const countMatches = (list: string[], haystack: string[]): number =>
  haystack.filter((w) => list.includes(w)).length;

/**
 * Ocena języka fragmentu.
 *
 * Zwraca `null`, gdy tekst jest za krótki, żeby cokolwiek orzec — pojedyncze
 * słowo („commute") nie niesie sygnału i oskarżanie go o polskość byłoby
 * gorsze od przepuszczenia.
 */
export const detectLanguage = (text: string): 'pl' | 'en' | null => {
  const clean = String(text || '').trim();
  if (clean.length < 12) return null;

  const w = words(clean);
  if (w.length < 3) return null;

  const pl =
    countMatches(POLISH_STOPWORDS, w) +
    countPolishSuffixes(w) +
    (POLISH_LETTERS.test(clean) ? 2 : 0);
  const en = countMatches(ENGLISH_STOPWORDS, w);

  if (pl === 0 && en === 0) return null;
  return pl > en ? 'pl' : 'en';
};

// ---------------------------------------------------------------------------
// Walidacja zadania
// ---------------------------------------------------------------------------

export interface LanguageProblem {
  type: string;
  field: string;
  expected: FieldLanguage;
  found: 'pl' | 'en';
  snippet: string;
}

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join(' ');
  return '';
};

/**
 * Sprawdza, czy zadanie jest w języku, w którym ma być.
 *
 * Zwraca listę problemów — pustą, gdy wszystko się zgadza. Pola `mixed`
 * przepuszczamy zawsze: przy dopasowywaniu par i przy poleceniu do wypowiedzi
 * oba języki są na miejscu.
 */
export const validateExerciseLanguage = (question: unknown): LanguageProblem[] => {
  if (!question || typeof question !== 'object') return [];
  const q = question as Record<string, unknown>;

  const type = String(q.type || '') as TestExerciseType;
  const expectations = FIELD_LANGUAGES[type];
  if (!expectations) return [];

  const problems: LanguageProblem[] = [];

  for (const [field, expected] of Object.entries(expectations)) {
    if (!expected || expected === 'mixed') continue;

    const text = asText(q[field]);
    const found = detectLanguage(text);
    if (!found || found === expected) continue;

    problems.push({
      type,
      field,
      expected: expected as FieldLanguage,
      found,
      snippet: text.slice(0, 120),
    });
  }

  return problems;
};

/** Walidacja całego testu. */
export const validateTestLanguage = (questions: unknown[]): LanguageProblem[] =>
  (Array.isArray(questions) ? questions : []).flatMap(validateExerciseLanguage);

/** Zwięzły opis problemów — trafia do promptu naprawczego i do logu. */
export const describeProblems = (problems: LanguageProblem[]): string =>
  problems
    .map(
      (p) =>
        `- typ "${p.type}", pole "${p.field}": ma być po ${
          p.expected === 'en' ? 'ANGIELSKU' : 'POLSKU'
        }, a jest po ${p.found === 'pl' ? 'polsku' : 'angielsku'}. Fragment: „${p.snippet}"`
    )
    .join('\n');

// ---------------------------------------------------------------------------
// Reguły dla promptu
// ---------------------------------------------------------------------------

/**
 * Żelazna zasada języka — wchodzi do promptu przed regułami typów.
 *
 * Stoi osobno i na początku, bo to jedyna zasada, której złamanie unieważnia
 * całe zadanie niezależnie od jego jakości.
 */
export const LANGUAGE_IRON_RULE = `# ŻELAZNA ZASADA JĘZYKOWA — WAŻNIEJSZA OD WSZYSTKIEGO PONIŻEJ

To jest aplikacja do nauki JĘZYKA ANGIELSKIEGO. Materiał, na którym pracuje kursant,
musi być PO ANGIELSKU. Prompt jest po polsku i materiał lekcji jest po polsku — to NIE
znaczy, że ćwiczenia mają być po polsku.

PO POLSKU jest wyłącznie:
- pole "instruction" (polecenie dla kursanta),
- zdania DO PRZETŁUMACZENIA w typie "translation" (kursant tłumaczy PL → EN),
- polska strona pary w typie "matching",
- opis sytuacji w typie "writing".

PO ANGIELSKU jest WSZYSTKO POZOSTAŁE:
- teksty z lukami, historyjki i zdania w "fill_in_blank",
- tekst ORAZ bank słów w "fill_in_blank_bank",
- tekst, pytania i opcje odpowiedzi w "multiple_choice",
- zdania z błędami i ich poprawne wersje w "find_mistake",
- wszystkie odpowiedzi w "correctAnswer" poza typem "matching".

Tekst z lukami po polsku w teście z angielskiego jest błędem dyskwalifikującym
całe zadanie. Zanim zwrócisz wynik, przeczytaj każde zadanie i sprawdź, czy
materiał do ćwiczenia jest po angielsku.`;

/**
 * Reguły poszczególnych typów.
 *
 * Każda zaczyna się od języka, bo to okazało się jedyną rzeczą, której brak
 * model wypełniał po swojemu.
 */
export const TYPE_RULES: Readonly<Record<TestExerciseType, string>> = {
  translation: `- translation [zdania PO POLSKU → tłumaczenie PO ANGIELSKU]: 1 zadanie zbiorcze.
  W 'prompt' umieść N zdań POLSKICH w punktach (1., 2., ...). Do każdego dodaj w nawiasie
  krótką wskazówkę gramatyczną, np. (past simple), żeby kursant wiedział, co zastosować.
  W 'correctAnswer' umieść N tłumaczeń ANGIELSKICH w punktach (1., 2., ...).`,

  fill_in_blank: `- fill_in_blank [tekst PO ANGIELSKU]: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO
  TEKSTU ANGIELSKIEGO (krótka historyjka lub opis sytuacji). To ma być klasyczne ćwiczenie
  gramatyczne z podręcznika: w tekście są luki '___', a PRZY KAŻDEJ LUCE w nawiasie stoi
  forma bazowa do przekształcenia albo wskazówka.
  PRZYKŁAD POPRAWNEGO 'prompt':
  "Last summer Anna ___ (go) to Italy with her friends. They ___ (stay) in a small hotel
  near the beach and ___ (spend) every morning swimming."
  W 'correctAnswer' umieść N poprawnych form w punktach (1. went, 2. stayed, 3. spent).
  Tekst po polsku w tym typie jest błędem dyskwalifikującym.`,

  fill_in_blank_bank: `- fill_in_blank_bank [tekst I bank słów PO ANGIELSKU]: 1 zadanie zbiorcze
  w formie JEDNEGO SPÓJNEGO TEKSTU ANGIELSKIEGO z lukami '___'.
  W 'wordBank' umieść ANGIELSKIE słowa do wstawienia — dokładnie te, które pasują do luk.
  W 'correctAnswer' umieść N odpowiedzi w punktach.
  KOLEJNOŚĆ SŁÓW W 'wordBank' MUSI BYĆ LOSOWA I RÓŻNA OD KOLEJNOŚCI LUK — słowo do pierwszej
  luki nie może być pierwsze na liście, bo wtedy ćwiczenie sprawdza tylko przepisywanie.
  Polskie słowa w banku są błędem dyskwalifikującym.`,

  matching: `- matching [pary polsko-angielskie]: 1 zadanie zbiorcze.
  W 'options' zamieść listę N par w formacie ["dojeżdżać = commute", "termin = deadline"].
  Po lewej stronie znaku '=' polskie znaczenie, po prawej angielskie słowo z lekcji.`,

  find_mistake: `- find_mistake [zdania PO ANGIELSKU]: 1 zadanie zbiorcze polegające na korekcie błędów.
  W 'prompt' umieść N zdań ANGIELSKICH z celowymi błędami w punktach (1., 2., ...).
  RODZAJE BŁĘDÓW DO WYMIESZANIA: gramatyczne, leksykalne, przyimkowe ORAZ OBOWIĄZKOWO BŁĘDNY
  SZYK ZDANIA — co najmniej jedno zdanie musi mieć przestawiony szyk (źle umiejscowiony
  okolicznik czasu, przysłówek częstotliwości w złym miejscu, szyk pytający w twierdzeniu).
  Do KAŻDEGO zdania dodaj na końcu w nawiasie wskazówkę po polsku w formacie
  (wskazówka: zły przyimek), (wskazówka: 3. osoba l. pojedynczej), (wskazówka: zły szyk zdania).
  W 'correctAnswer' umieść N poprawnych zdań ANGIELSKICH w punktach. Nie wypełniaj 'options'.`,

  multiple_choice: `- multiple_choice [tekst I opcje PO ANGIELSKU]: 1 zadanie zbiorcze.
  W 'prompt' umieść JEDEN SPÓJNY TEKST ANGIELSKI z lukami '___' albo N angielskich pytań
  wielokrotnego wyboru. Przy teście z gramatyki preferowana jest krótka historyjka.
  W 'options' podaj ANGIELSKIE opcje A/B/C.
  ROZŁÓŻ POPRAWNE ODPOWIEDZI RÓWNOMIERNIE MIĘDZY A, B i C — poprawna odpowiedź nie może stale
  wypadać jako pierwsza, bo kursant rozwiąże zadanie bez czytania opcji.
  DYSTRAKTORY to typowe błędy Polaka uczącego się angielskiego: kalka z polskiego, mylony czas,
  zły przyimek. Opcje absurdalne niczego nie sprawdzają i są zabronione.`,

  writing: `- writing [polecenie po polsku, wypowiedź kursanta PO ANGIELSKU]: 1 zadanie otwarte.
  W 'prompt' opisz po polsku sytuację i wskaż, czego wypowiedź ma dotyczyć, podaj oczekiwaną
  długość (np. 60–80 słów) oraz WYMIEŃ KONKRETNE konstrukcje lub słownictwo z lekcji, których
  kursant ma użyć. W 'correctAnswer' umieść przykładową wypowiedź wzorcową PO ANGIELSKU.`,
};

/** Reguły dla typów wybranych przez lektora. */
export const rulesForTypes = (types: string[]): string =>
  types
    .map((t) => TYPE_RULES[t as TestExerciseType])
    .filter(Boolean)
    .join('\n\n   ');

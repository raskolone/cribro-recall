/**
 * Żelazne zasady jakości generowanych ćwiczeń — JEDNO źródło tekstu dla wszystkich promptów
 * (rozgrzewka, tłumaczenie, wielokrotny wybór, dopasowanie, korekta zdań, ćwiczenia dowolne).
 *
 * Prompt może modelu tylko PROSIĆ. To, czy prośba została spełniona, sprawdza
 * `utils/exerciseQuality.ts` (kontrola lokalna + sędzia) — te same punkty a)–f) są kryteriami sędziego.
 */

/** Kryteria a)–f) w kolejności, w jakiej sędzia zwraca wyroki. */
export const QUALITY_CRITERIA = ['naturalness', 'equivalence', 'uniqueness', 'level_vocab', 'context', 'grammar'] as const;
export type QualityCriterion = (typeof QUALITY_CRITERIA)[number];

export const EXERCISE_IRON_RULES = `ŻELAZNE ZASADY JAKOŚCI ĆWICZEŃ (obowiązują każdy element, ważniejsze niż użycie słownictwa z lekcji):
a) NATURALNOŚĆ EN i PL. Zdania brzmią jak wypowiedź native speakera. Zakaz kalk i tłumaczenia słowo w słowo, zakaz robotycznych konstrukcji (np. polskie „…, co jest świetne” zamiast naturalnego „i to świetnie”, angielskie „…, which is great” doklejone na końcu), zakaz niezręcznego szyku.
b) RÓWNOWAŻNOŚĆ ZNACZENIOWA PL = EN. Polskie i angielskie zdanie opisują to samo: ta sama osoba, liczba, czas, tryb i stopień formalności (moje = my, nie your; ona = she, nie he; wczoraj = past, nie present).
c) JEDNOZNACZNOŚĆ. Wielokrotny wybór: dokładnie JEDNA poprawna opcja. Dopasowanie: każda para ma tylko jedno sensowne dopasowanie. Korekta zdań: dokładnie JEDEN zamierzony błąd, a wersja poprawna jest naturalna.
d) POZIOM I RÓŻNORODNOŚĆ. Poziom CEFR zgodny z kursantem, słownictwo z lekcji użyte sensownie (nie na siłę), brak duplikatów i brak kilku zdań pod rząd o identycznej strukturze.
e) KONTEKST. Zdanie ma sens jako całość — żadnych absurdów i przypadkowych idiomów niepasujących do reszty (np. „My office is on your doorstep”). Polecenie po polsku musi dotyczyć tej samej sytuacji co zdanie angielskie (nie hamak i meble w jednej parze).
f) POPRAWNOŚĆ GRAMATYCZNA. Każde zdanie angielskie (także to, które ma być POPRAWNE w korekcie i każda wersja po wstawieniu luki) jest gramatycznie bezbłędne: szyk, czas, forma czasownika, przedimki, przyimki, zgoda podmiotu z orzeczeniem. Wielokrotny wybór: po wstawieniu poprawnej opcji zdanie jest poprawne gramatycznie i znaczeniowo, a każda z trzech pozostałych opcji po wstawieniu daje zdanie niepoprawne gramatycznie ALBO nieadekwatne znaczeniowo.
Przed zwróceniem KAŻDEGO elementu sprawdź punkty a)–f). Element, który któregoś nie spełnia, przepisz albo zastąp innym.`;

/** Opis kryteriów dla sędziego — te same a)–e), ale jako pytania tak/nie. */
export const JUDGE_CRITERIA_TEXT = `Dla KAŻDEGO elementu oceń sześć kryteriów (true = spełnione, false = niespełnione):
- naturalness (a): zdania angielskie i polskie brzmią jak native speaker; bez kalk, bez robotycznych konstrukcji, bez niezręcznego szyku;
- equivalence (b): polska i angielska strona znaczą TO SAMO — ta sama osoba, liczba, czas, tryb i formalność (moje ≠ your; inna sytuacja = false);
- uniqueness (c): dokładnie jedna poprawna odpowiedź (wielokrotny wybór), jednoznaczne pary (dopasowanie: polskie znaczenie nie pasuje też do żadnego innego angielskiego słowa z tej samej listy), dokładnie jeden zamierzony błąd i naturalna wersja poprawna (korekta); dla pozostałych typów true;
- level_vocab (d): poziom pasuje do kursanta, słownictwo użyte sensownie;
- context (e): całość ma sens, bez absurdów i przypadkowych idiomów (np. „my office… on your doorstep”);
- grammar (f): zdanie angielskie jest poprawne gramatycznie (szyk, czas, forma czasownika, przedimki, przyimki, zgoda podmiotu z orzeczeniem; w korekcie dotyczy wersji POPRAWNEJ). Wielokrotny wybór: po wstawieniu opcji oznaczonej jako poprawna zdanie jest poprawne gramatycznie I znaczeniowo, a dokładnie jedna z czterech opcji spełnia ten warunek — jeśli druga opcja też daje poprawne zdanie, grammar = false.
W polu reason napisz po polsku w kilku słowach, co jest nie tak (puste, gdy wszystko w porządku). Bądź surowy: wątpliwość = false.`;

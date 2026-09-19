/**
 * Ustawienia, które trzeba potwierdzić przed pierwszym wdrożeniem.
 *
 * Wszystkie trzy są w jednym miejscu celowo — to jedyne wartości w tym pakiecie,
 * które zależą od konta i projektu, a nie od logiki.
 */

/**
 * Baza danych, na której wisi wyzwalacz.
 *
 * Aplikacja nie używa bazy `(default)`, tylko nazwanej instancji założonej przez
 * Google AI Studio (ten sam identyfikator co w firebase.ts i firebase.json).
 * Bez tego pola wyzwalacz nasłuchiwałby pustej bazy `(default)` i nigdy by się
 * nie odpalił — a wdrożenie przeszłoby bez jednego ostrzeżenia.
 */
export const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';

/**
 * Region funkcji. Musi odpowiadać lokalizacji bazy Firestore — wyzwalacze
 * Eventarc nie działają między regionami.
 *
 * Sprawdź lokalizację poleceniem:
 *   firebase firestore:databases:list
 *
 * i wpisz tu region z kolumny `locationId` (np. `europe-central2`, `eur3`
 * odpowiada `europe-west1`, `nam5` odpowiada `us-central1`). Jeśli się nie
 * zgadza, `firebase deploy` odmówi z komunikatem o niedopasowanej lokalizacji —
 * wtedy popraw tę stałą i wdróż ponownie.
 */
export const FUNCTION_REGION = 'us-central1';

/**
 * Adres nadawcy powiadomień.
 *
 * Domena `send.maciej.pro` jest zweryfikowana w Resend (DKIM + SPF w Netlify
 * DNS, 7 września 2026). Świadomie jest to subdomena: poczta główna
 * `maciej.pro` stoi w Hostingerze i ma własne rekordy MX oraz SPF, których
 * wysyłka aplikacji nie dotyka.
 */
export const FROM_ADDRESS = 'Maciej Wyrozumski <wyrozumski@maciej.pro>';

/**
 * Domeny, pod które nie ma sensu wysyłać.
 *
 * Logowanie nazwą użytkownika dokleja `@student.vocabboost.com` (patrz
 * components/auth/AuthScreen.tsx) — to adres syntetyczny, wymyślony po to, żeby
 * Firebase Auth miał czym się posłużyć. Taka wiadomość odbiłaby się albo
 * przepadła, więc traktujemy ją jak brak adresu i mówimy o tym w logu.
 */
export const PLACEHOLDER_EMAIL_DOMAINS = ['student.vocabboost.com'];

/**
 * Adres, pod którym stoi aplikacja — trafia do przycisku w wiadomości.
 *
 * To produkcja na Vercelu, a nie Firebase Hosting: witryna
 * `gen-lang-client-0425391821.web.app` istnieje, ale nic na niej nie stoi
 * (zwraca 404). Gdyby aplikacja kiedyś przeniosła się na Hosting, wystarczy
 * podmienić tę stałą — nic innego nie odwołuje się do adresu.
 */
export const APP_URL = 'https://app.maciej.pro';

/**
 * Bazy Notion, z których czyta synchronizacja.
 *
 * Identyfikatory pochodzą z adresów baz w „Teacher HQ”. Obie muszą być
 * udostępnione integracji (w Notion: „...” → Connections → nazwa integracji),
 * inaczej API odpowiada 404 — Notion nie odróżnia „nie istnieje” od
 * „nie masz dostępu”.
 *
 * Puste od 2026-09-19: stary workspace został usunięty (migracja do
 * „Maciej's space”). Stare ID wskazywałyby na nieistniejącą bazę i
 * `checkNotionDaily` dostawałby 404 bez żadnego wyjaśnienia w logu — pusty
 * string zamiast tego zatrzyma synchronizację jawnie. Wpisz tu nowe ID przed
 * kolejnym `npm run deploy:functions`.
 */
export const NOTION_LESSONS_DB = '';
export const NOTION_STUDENTS_DB = '';

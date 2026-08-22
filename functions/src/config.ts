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
 * `onboarding@resend.dev` to nadawca testowy Resenda: działa bez weryfikacji
 * domeny, ale **wysyła wyłącznie na adres właściciela konta Resend**. Kursanci
 * nic nie dostaną, dopóki nie zweryfikujesz własnej domeny i nie wpiszesz tu
 * adresu w rodzaju `powiadomienia@twojadomena.pl`.
 */
export const FROM_ADDRESS = 'CRIBRO ENGLISH <onboarding@resend.dev>';

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
 * Dopóki projekt nie ma hostingu, zostaw pusty ciąg: wtedy e-mail wychodzi bez
 * przycisku, zamiast prowadzić kursanta pod adres, który nie odpowiada.
 */
export const APP_URL = '';

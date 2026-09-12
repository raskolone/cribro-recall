/**
 * Flaga silnika v2 po stronie Cloud Functions.
 *
 * Druga połowa przełącznika z `config/featureFlags.ts`. Obie muszą być
 * włączone — przeglądarka nie włącza silnika sama, a funkcja nie wystawia
 * zadań, których panel nie umie pokazać.
 *
 * Wartość jest parametrem wdrożenia, a nie dokumentem w Firestore, z dwóch
 * powodów: odczyt z bazy przy każdym wywołaniu kosztuje i potrafi zawieść
 * w najgorszym momencie, a flaga ma być czytelna w `firebase deploy` — widać
 * wtedy, z czym idzie wdrożenie, zamiast zgadywać ze stanu bazy.
 *
 * Plik celowo nie importuje `firebase-functions`. Bramka rzucająca
 * `HttpsError` siedzi w `endpoints.ts`, gdzie ten import i tak jest —
 * dzięki temu sama flaga daje się przetestować z katalogu głównego, w którym
 * pakiet funkcji nie jest zainstalowany.
 *
 * Włączenie: `HOMEWORK_ENGINE_V2=true` w `functions/.env` (plik jest
 * ignorowany przez git) albo w zmiennych środowiskowych w konsoli Google Cloud.
 *
 * Rollback: skasowanie zmiennej albo ustawienie czegokolwiek innego niż
 * `true`. Nie wymaga migracji danych — zestawy v1 nigdy nie były mutowane.
 */

/**
 * Czy silnik v2 wolno uruchomić.
 *
 * Czytane przy każdym wywołaniu, a nie raz przy starcie: zimny start funkcji
 * bywa rzadki, a flaga ma działać od razu po zmianie, nie po przypadkowym
 * przeładowaniu instancji.
 *
 * Dokładne porównanie z `'true'` jest zamierzone. `Boolean('false')` to `true`,
 * więc luźniejsze sprawdzenie włączyłoby silnik przy wartości, która miała go
 * wyłączyć — a to jest dokładnie ten błąd, po którym rollback nie działa.
 */
export const isHomeworkEngineV2Enabled = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean => String(env.HOMEWORK_ENGINE_V2 ?? '').trim().toLowerCase() === 'true';

/** Komunikat odmowy — jawny i nazwany, żeby nie szukać pół godziny nie tam, gdzie trzeba. */
export const ENGINE_DISABLED_MESSAGE =
  'Silnik prac domowych v2 jest wyłączony (HOMEWORK_ENGINE_V2).';

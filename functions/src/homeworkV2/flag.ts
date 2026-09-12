/**
 * Flaga silnika v2 po stronie Cloud Functions.
 *
 * Druga połowa przełącznika z `config/featureFlags.ts`. Obie muszą być
 * włączone — przeglądarka nie włącza silnika sama, a funkcja nie wystawia
 * zadań, których panel nie umie pokazać.
 *
 * Wartość jest parametrem wdrożenia, a nie dokumentem w Firestore, z dwóch
 * powodów: odczyt z bazy przy każdym wywołaniu kosztuje i potrafi zawieść w
 * najgorszym momencie, a flaga ma być czytelna w `firebase deploy` — widać
 * wtedy, z czym idzie wdrożenie, zamiast zgadywać ze stanu bazy.
 *
 * Włączenie:
 *   firebase functions:config nie jest tu używane — parametr czyta się ze
 *   zmiennej środowiskowej wdrożenia (`functions/.env` albo panel Google Cloud):
 *
 *     HOMEWORK_ENGINE_V2=true
 *
 * Rollback: skasowanie zmiennej albo ustawienie czegokolwiek innego niż
 * `true`. Nie wymaga migracji danych — zestawy v1 nigdy nie były mutowane.
 */

import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Czy silnik v2 wolno uruchomić.
 *
 * Czytane przy każdym wywołaniu, a nie raz przy starcie: zimny start funkcji
 * bywa rzadki, a flaga ma działać od razu po zmianie, nie po przypadkowym
 * przeładowaniu instancji.
 */
export const isHomeworkEngineV2Enabled = (): boolean =>
  String(process.env.HOMEWORK_ENGINE_V2 ?? '').trim().toLowerCase() === 'true';

/**
 * Bramka dla każdego `onCall` silnika v2.
 *
 * Odmowa jest jawna i nazwana. Cicha odpowiedź „brak zadań" przy wyłączonej
 * fladze byłaby gorsza od błędu: wyglądałaby jak awaria generatora i kosztowała
 * pół godziny szukania nie tam, gdzie trzeba.
 */
export const requireHomeworkEngineV2 = (): void => {
  if (!isHomeworkEngineV2Enabled()) {
    throw new HttpsError(
      'failed-precondition',
      'Silnik prac domowych v2 jest wyłączony (HOMEWORK_ENGINE_V2).'
    );
  }
};

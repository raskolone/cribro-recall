/**
 * Kontrakty silnika v2 dla aplikacji i testów.
 *
 * Źródło leży w `functions/src/homeworkV2/contracts.ts`, bo `functions/`
 * kompiluje wyłącznie własne `src` i nie zabrałby pliku z katalogu głównego do
 * wdrożenia. Odwrotny kierunek — źródło tutaj, kopia tam — znaczyłby dwie
 * rubryki, które rozjadą się przy pierwszej poprawce.
 *
 * Ten plik jest wyłącznie mostem. Nie dopisuj tu logiki: wszystko, co ocenia
 * odpowiedź, musi być widoczne dla Cloud Functions, które tę ocenę wystawiają.
 */

export * from '../../functions/src/homeworkV2/contracts';

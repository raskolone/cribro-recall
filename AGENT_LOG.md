# AGENT_LOG.md

Log pracy agentów AI nad tym repozytorium. Zasady wpisu: patrz `CLAUDE.md`
sekcja 7.2. Nowe wpisy dopisuj na końcu pliku.

---

2026-09-12 — Claude Code / Sonnet 5

Zadanie: Utworzyć `CLAUDE.md` na podstawie szkicu przygotowanego wcześniej
przez Macieja (plik `Claude cribro recall.pages` / `.pdf` w
`/Users/maciej/Code/`), uzupełniając miejsca oznaczone `[...]` na
podstawie realnego stanu repo, oraz założyć `AGENT_LOG.md` z pierwszym
wpisem.

Zrobione:
- `CLAUDE.md` (nowy plik) — uzupełniono sekcje 4 (konwencje kodu: struktura
  `components/`, `context/`, `utils/`, tokeny motywu, i18n), 5 (komendy
  operacyjne z `package.json`) i 6 (dług techniczny ze stanem z
  `CHANGELOG.md` sekcja 3 na 2026-09-12) na podstawie repo, `AGENTS.md`,
  `CHANGELOG.md` i `git log`.
- `AGENT_LOG.md` (nowy plik) — ten wpis.

Nie dokończone / do sprawdzenia: brak — zadanie zamknięte.

Decyzje architektoniczne: żadnych zmian w kodzie aplikacji, wyłącznie
dokumentacja.

Ryzyka: brak — nie dotknięto `firestore.rules`, autoryzacji ani ścieżek
tokenowych bez logowania.

---

2026-09-12 — Claude Code / Opus 5

Zadanie: Wykonać zlecenie z Notion „Cribro Recall — kanoniczna specyfikacja
silnika v2: homework i testy", sekcja §18 („Kanoniczne wytyczne dla AI
wdrażającego system"). Prompt z §18 nakazuje jako pierwszy krok Etap 0:
audyt bez zmian w kodzie, zakończony raportem różnic, a następnie STOP
i oczekiwanie na komendę `WDRAŻAJ ETAP 1`.

Zrobione:
- `docs/audyt-homework-v2.md` (nowy plik) — pełny raport Etapu 0: mapa
  typów zadań i ekranów, kolekcji i relacji, miejsc tworzących i
  oceniających zestawy, rozjazdu identyfikatorów modeli, statusu
  wdrożenia Expressa; tabela 18 różnic (stan | wymaganie | luka |
  proponowana zmiana | ryzyko | test akceptacyjny); werdykt w sprawie
  `specialTasks` + `engineVersion: 2`; lista plików do ruszenia i
  zakazanych w Etapie 1; cztery pytania blokujące.
- `AGENT_LOG.md` — ten wpis.

Zero zmian w kodzie aplikacji — zgodnie z treścią zlecenia. Stan
wyjściowy zweryfikowany: `npx tsc --noEmit` bez błędów, `npm test`
163/163, drzewo robocze czyste.

Nie dokończone / do sprawdzenia: Etap 1 (kontrakty, flaga
`homeworkEngineV2`, checklista backup/restore/rollback) nie został
rozpoczęty — prompt zabrania tego przed jawną komendą. Cztery pytania
blokujące czekają na odpowiedź Macieja: identyfikator modelu
(`gpt-5.6-luna` vs „GPT-5.6"), sekret `OPENAI_API_KEY` po stronie Cloud
Functions, zgoda na nowy blok `match` w `firestore.rules`, brak `zod`
w repo.

Decyzje architektoniczne (propozycje, nie wdrożenia):
- Rozszerzyć `specialTasks` o `engineVersion: 2` zamiast zakładać nową
  kolekcję — pod trzema warunkami opisanymi w §4 raportu. Powód: nowa
  kolekcja wymagałaby drugiego wyzwalacza mailowego i rozjechałaby listy
  w panelu lektora.
- Dane prób (3 próby, autosave, resume) w podkolekcji
  `specialTasks/{id}/attempts/{attemptId}`, nie w dokumencie nadrzędnym.
  Powód: pozwala nie poszerzać istniejącej reguły `specialTasks.update`
  dla kursanta i trzyma werdykt poza zasięgiem jego zapisu.
- Osobna kaskada modeli wyłącznie OpenAI dla v2. Powód: kaskada v1
  (`services/aiModels.ts`) schodzi do Gemini na pozycjach 2 i 4, a
  zlecenie zabrania innych dostawców.

Ryzyka: NIE dotknięto `firestore.rules`, autoryzacji ani ścieżek
tokenowych bez logowania — audyt był wyłącznie odczytem. Raport
ZGŁASZA jednak, że Etap 1 będzie wymagał zmiany w `firestore.rules`
(nowy blok `match` dla podkolekcji `attempts`) — to obszar wysokiego
ryzyka z `CLAUDE.md` §3 i wymaga jawnej zgody przed wdrożeniem.
Raport odnotowuje też istniejącą (nie wprowadzoną teraz) słabość:
kursant może dziś zapisać `evaluationResults` i `status` na własnym
zadaniu, czyli podstawić sobie wynik prowizoryczny.

---

2026-09-12 — Claude Code / Opus 5 (Etap 1)

Zadanie: Etap 1 zlecenia z Notion §18 — „Kontrakty JSON, flaga
`homeworkEngineV2`, checklista backup/restore/rollback". Maciej dał
komendę `WDRAŻAJ ETAP 1` i rozstrzygnął cztery pytania z Etapu 0:
model `gpt-5.6-luna`, runtime w Cloud Functions z nowym sekretem
`OPENAI_API_KEY`, zgoda na nowy blok `match` dla podkolekcji `attempts`,
ręczne strażniki typów zamiast zod.

Zrobione:
- `functions/src/homeworkV2/contracts.ts` (nowy) — zamrożone kontrakty:
  rubryka 40/40/20, skala 0/0,5/1, próg pewności 0,6, drabinka
  podpowiedzi, stan `nowe|ćwiczymy|opanowane`, `ExerciseContractV2`,
  `AttemptV2`, `GradingVerdictV2`, strażniki typów, czyste funkcje
  `weightedScore` / `isPassingAttempt` / `resolveMastery` /
  `hintForAttempt`, oraz `isV2Task` do ochrony ekranów v1.
- `services/homeworkV2/contracts.ts` (nowy) — most re-eksportujący dla
  aplikacji i testów.
- `functions/src/homeworkV2/flag.ts` (nowy) — `isHomeworkEngineV2Enabled()`
  i `requireHomeworkEngineV2()`.
- `config/featureFlags.ts` — dopisane `HOMEWORK_ENGINE_V2 = false`.
  Nic istniejącego nie ruszone.
- `tests/homeworkV2Contracts.test.ts` (nowy) — 27 testów.
- `docs/backup-restore-homework-v2.md` (nowy) — checklista §15 z
  konkretnymi poleceniami gcloud dla nazwanej bazy.

Weryfikacja: `npx tsc --noEmit` czysto, `npm test` 190/190 (163 wyjściowe
+ 27 nowych), `npm run build` przechodzi, `npm --prefix functions run
build` przechodzi. Import międzypakietowy sprawdzony osobno esbuildem i
tsx — nie przyjąłem na wiarę, że się zbunduje.

Nie dokończone / do sprawdzenia:
- Etap 2 (Assembler, Planner, Generator, Validator w Functions) NIE
  rozpoczęty — prompt zabrania etapu N+1 bez potwierdzenia.
- `docs/backup-restore-homework-v2.md` §2: automatyczny backup poza bazą
  produkcyjną NIE ISTNIEJE w tym projekcie. To blokada przed Etapem 3,
  do wykonania przez Macieja (wymaga uprawnień billingowych).
- Sekret `OPENAI_API_KEY` po stronie Cloud Functions jeszcze nie
  ustawiony — potrzebny dopiero w Etapie 2.

Decyzje architektoniczne:
- Źródło prawdy kontraktów w `functions/src/`, most w `services/`, nie
  odwrotnie. Powód: `functions/tsconfig.json` ma `include: ["src"]`, więc
  plik z katalogu głównego nie wszedłby do wdrożenia, a to Cloud Functions
  wystawiają oceny. Kierunek odwrotny znaczyłby dwie rubryki rozjeżdżające
  się przy pierwszej poprawce.
- Próg zaliczenia próby (`isPassingAttempt`: znaczenie 1 ∧ cel 1 ∧
  poprawność ≥ 0,5, czyli 90/100) jest MOJĄ interpretacją — specyfikacja
  podaje tylko reguły brzegowe („literówka nie zeruje", „brak celu = max
  ćwiczymy"), bez progu liczbowego. Zapisane jawnie w kodzie i w commicie.
  Do zmiany jednym miejscem, z podbiciem `SCHEMA_VERSION`.
- Poprawna druga próba daje `ćwiczymy`, nie `opanowane` — specyfikacja
  wymienia tylko próbę 1 i poprawkę po próbie 3.
- Flaga ma dwie połowy (aplikacja + funkcje), obie muszą być włączone.
  Fail-safe: przeglądarka nie włącza silnika sama.
- Profil uczenia: `users/{uid}/profile/learningCurve` jest agregatem
  współdzielonym z v1. Propozycja (do rozstrzygnięcia w Etapie 4): v2
  pisze do osobnego dokumentu, żeby rollback zostawiał v1 nietknięte.

Ryzyka: NIE dotknięto `firestore.rules` (mimo posiadanej zgody — blok
`attempts` powstanie dopiero w Etapie 4, razem z testami reguł, które go
sprawdzą), autoryzacji ani ścieżek tokenowych bez logowania. Nie dotknięto
`server.ts`, `geminiService.ts`, `homeworkGenerator.ts`, mailingu ani
żadnego ekranu. Ścieżka v1 jest bitowo nietknięta — flaga domyślnie `false`.

---

2026-09-12 — Claude Code / Opus 5 (Etapy 2–4)

Zadanie: „dokończ co zostało do zrobienia" — czyli Etapy 2, 3 i 4
zlecenia z Notion §18, po zamknięciu Etapów 0 i 1.

Zrobione:
- Etap 2 — serwisy rdzenia w `functions/src/homeworkV2/`: `openai.ts`
  (kaskada wyłącznie OpenAI, log kosztu/latency bez treści odpowiedzi),
  `coreKnowledge.ts` (globalny rdzeń w plikach repo), `contextAssembler.ts`,
  `exercisePlanner.ts`, `exerciseGenerator.ts`, `qualityValidator.ts`,
  `gradingEngine.ts`, `feedbackComposer.ts`, `learningProfile.ts`,
  `pipeline.ts`, `endpoints.ts`, `db.ts`. Cztery `onCall` re-eksportowane
  z `functions/src/index.ts`.
- Etap 3 — `services/homeworkV2Client.ts`, `components/admin/HomeworkComposerV2.tsx`
  (1 ekran podglądu), wpięcie za flagą w `HomeworkScreen.tsx`, strażnik
  `isV1Task` w `utils/homework.ts` zastosowany w `StudentHomeworkScreen`
  i `AIExerciseGeneratorScreen`.
- Etap 4 — `components/dashboard/StudentHomeworkV2Screen.tsx`, wpięcie
  w `Dashboard.tsx` z fallbackiem na ekran v1, dwa nowe bloki `match`
  w `firestore.rules` (`attempts`, `drafts`), 11 nowych testów reguł.
- `tests/homeworkV2Pipeline.test.ts` (19 testów),
  `tests/homeworkV2Grading.test.ts` (15 testów, w tym złoty zbiór).
- `CHANGELOG.md` sekcja 4 i `docs/backup-restore-homework-v2.md`
  zaktualizowane.

Weryfikacja: `npx tsc --noEmit` czysto, `npm test` 224/224,
`npm run test:rules` 33/33 na emulatorze, `npm run build` i
`npm --prefix functions run build` przechodzą.

Nie dokończone / do sprawdzenia:
- ŻADEN przebieg end-to-end z prawdziwym modelem nie został wykonany —
  brakuje sekretu `OPENAI_API_KEY` po stronie Cloud Functions. Wszystkie
  testy używają podstawionego `ModelCall`.
- Interfejs (kreator v2 i ekran kursanta v2) NIE był oglądany w
  przeglądarce — przeszedł tylko `tsc` i build. To ten sam dług, który
  `CHANGELOG.md` sekcja 3 odnotowuje dla poprzednich zmian UI.
- Backup Firestore nadal nie istnieje — blokada przed wdrożeniem.
- Typy 4–6 z banku (ułóż i odtwórz, parafraza, reakcja w sytuacji),
  testy postępu i KnowledgeSync z Notion są świadomie poza zakresem.

Dwa błędy poprawności znalezione i naprawione w trakcie, oba takie, które
przeszłyby kompilację:
- `getFirestore()` na poziomie modułu wywalałby wdrożenie, bo
  `export ... from` w `index.ts` jest hoistowany i moduły v2 wykonywały
  się przed `initializeApp()`. Stąd leniwy `db.ts`.
- `previousState` w `submitHomeworkV2Attempt` brany był przez `.pop()`
  z wyniku zapytania bez `orderBy` — Firestore nie gwarantuje tam
  kolejności, więc kursantowi mógł się cofnąć postęp. Teraz sortowanie
  po `attemptNumber`.

Decyzje architektoniczne:
- Profil v2 w `users/{uid}/profile/homeworkV2`, osobno od
  `profile/learningCurve` v1. Powód: profil v1 jest agregatem, więc zapis
  v2 przesunąłby wyliczony poziom kursanta bez możliwości cofnięcia, a
  rollback ma przywracać v1 do stanu sprzed.
- Szkice w osobnej podkolekcji `drafts`, nie w `attempts`. Pozwala dać
  kursantowi prawo zapisu na brudnopis, nie otwierając niczego przy
  werdykcie.
- Ekran v2 ma `fallback` na ekran v1. Bez tego włączenie flagi schowałoby
  kursantowi całą dotychczasową pracę domową.
- Planner jest deterministyczny, bez pytania modelu — jedno wywołanie
  mniej, jeden powód awarii mniej, rozkład przewidywalny dla lektora.

Ryzyka: DOTKNIĘTO `firestore.rules` — dodane dwa bloki `match` wewnątrz
`specialTasks` (`attempts`, `drafts`). Maciej wyraził na to zgodę wprost
przed Etapem 1. Reguła bazowa `specialTasks` NIE została zmieniona, co
potwierdza osobny test („zestawy v1 nie zyskały nowych uprawnień przy
okazji"). NIE dotknięto middleware autoryzacji w `server.ts` ani ścieżek
tokenowych bez logowania. Odnotowany wcześniej dług v1 — kursant może
zapisać `evaluationResults` i `status` na własnym zadaniu — celowo
zostaje nietknięty, bo jego zamknięcie zmieniłoby zachowanie v1.

---

2026-09-12 — Claude Code / Opus 5 (domknięcie DoD po wdrożeniu funkcji)

Zadanie: „dokończ co pozostało i co jesteś w stanie bez mojej obecności
zrobić" — po tym, jak Maciej ustawił sekret `OPENAI_API_KEY` i wykonał
`npm run deploy:functions`.

Stan wdrożenia (zweryfikowany przez `firebase functions:list`):
siedem funkcji w `us-central1`, wszystkie Node 22 / gen 2. Cztery nowe
(`generateHomeworkV2`, `assignHomeworkV2`, `submitHomeworkV2Attempt`,
`proposeHomeworkV2Review`) i trzy zaktualizowane, w tym
`notifyStudentOnHomework` — mailing bez regresji.

Zrobione:
- `functions/src/homeworkV2/assignment.ts` (nowy) — wydzielone
  `selectSendableExercises`, `buildV2TaskPayload`, `newHomeworkSetId`.
  Powód: kontrakt zgodności z v1 przy zapisie to miejsce, w którym łamie
  się albo dotrzymuje zgodność, a taki kod musi dać się przetestować bez
  Firestore.
- `functions/src/homeworkV2/flag.ts` — usunięty import
  `firebase-functions`; `requireHomeworkEngineV2` przeniesione do
  `endpoints.ts`, gdzie `HttpsError` i tak jest. Dzięki temu flaga daje
  się przetestować z katalogu głównego.
- `tests/homeworkV2Flow.test.ts` (nowy, 20 testów) — domknięcie listy
  testów obowiązkowych ze zlecenia §18: drabinka podpowiedzi dla KAŻDEGO
  z trzech typów, grupa (wspólna treść, osobne dokumenty), flaga on/off,
  awaria AI i sieci, zadanie po dwóch nieudanych walidacjach nie idzie
  auto-wysyłką.
- `docs/silnik-v2-architektura.md` (nowy) — ostatni punkt DoD:
  architektura, env i sekrety, koszt, monitoring.
- `CHANGELOG.md` — zaktualizowany stan weryfikacji.

Weryfikacja: `npx tsc --noEmit` czysto, `npm test` 244/244,
`npm --prefix functions run build` przechodzi.

Nie dokończone / do sprawdzenia:
- FLAGI NIE WŁĄCZYŁEM, celowo. Backup Firestore nadal nie istnieje,
  a `docs/backup-restore-homework-v2.md` §2 wymienia to jako blokadę
  przed wypuszczeniem na kogokolwiek. To decyzja Macieja.
- Żaden przebieg z prawdziwym modelem nadal nie miał miejsca. Nie dało
  się go wykonać bez włączenia flagi albo wyciągnięcia klucza z Secret
  Managera — a wyciąganie cudzego sekretu do transkryptu odpada.
- Interfejs v2 (kreator i ekran kursanta) nieoglądany w przeglądarce.
- Szacunki kosztu w `docs/silnik-v2-architektura.md` §3 są wyprowadzone
  z przewidywanej długości promptów, NIE z pomiaru. Po pierwszym realnym
  przebiegu trzeba je poprawić danymi z logu.
- Ostrzeżenie z wdrożenia: `firebase-functions` w `functions/package.json`
  jest przestarzałe, a aktualizacja niesie breaking changes. Świadomie
  nie ruszone w trakcie wdrażania nowych funkcji.

Decyzje architektoniczne: brak nowych. Refaktory były wyłącznie po to,
żeby domknąć wymaganą listę testów.

Ryzyka: NIE dotknięto `firestore.rules`, autoryzacji ani ścieżek
tokenowych. Zmiany w `endpoints.ts` to wyłącznie podmiana kodu inline na
wywołanie wydzielonej funkcji — zachowanie bez zmian, potwierdzone
buildem i testami.

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

---

2026-09-12 — Claude Code / Opus 5 (wdrożenie v2 + naprawy generatora testów)

Zadanie: uruchomienie silnika v2 na produkcji, a następnie naprawa błędów,
na które Maciej trafił w trakcie testowania aplikacji.

## Wdrożenie silnika v2 — ZAKOŃCZONE

Maciej wykonał kroki po swojej stronie: ustawił sekret `OPENAI_API_KEY`
(nowy klucz, osobny od tego w Vercelu), włączył PITR i ochronę przed
skasowaniem bazy, założył harmonogram backupów, wdrożył funkcje i ustawił
`HOMEWORK_ENGINE_V2=true` w `functions/.env`.

Ja włączyłem drugą połowę flagi (`config/featureFlags.ts`, commit
`bfc4354`). **Silnik v2 jest od tego momentu czynny end-to-end na
produkcji** dla każdego zalogowanego lektora i kursanta.

Stan wdrożenia zweryfikowany przez `firebase functions:list`: siedem
funkcji w `us-central1`, Node 22, gen 2.

### Poprawka ścieżki backupu (commit `25f62c0`)

Pierwsza wersja checklisty opisywała eksport przez `gcloud` do kubełka GCS
z regionem `us-central1`. Była **błędna na dwa sposoby**: gcloud nie jest
zainstalowany na maszynie Macieja, a baza stoi w `nam5` (multi-region US),
więc kubełek `us-central1` odrzuciłby eksport. Firebase CLI ma zarządzane
backupy, PITR, restore i klonowanie — bez gcloud i bez kubełka.

Trzy nowe skrypty npm: `firebase:db:protect`, `firebase:backup:schedule`,
`firebase:backup:list`.

**Odnotowana pułapka:** w projekcie jest SZEŚĆ baz Firestore, a jedna
(`ai-studio-cribrorecall-520a4841-...`) zawiera ten sam sufiks UUID co
produkcja i różni się wyłącznie wstawką `cribrorecall`. Backup zrobiony
„prawie tej" bazy jest bezwartościowy, a zorientować się można dopiero
przy restore. Stąd `-d` wpisane na sztywno w skrypty.

Poprawiłem też błędną instrukcję: `npm run deploy:hosting` jest zbędne —
produkcja stoi na Vercelu, a nie na Firebase Hosting, i wdraża się samym
pushem na `main`.

## Naprawy generatora testów (kod v1, poza zakresem zlecenia v2)

Maciej trafił na trzy osobne błędy w trakcie testowania. Wszystkie sprzed
tej sesji — `git diff` na `server.ts`, `AdminTestGenerator.tsx`
i `geminiService.ts` między `48a39b2` a HEAD był pusty przed tymi naprawami.

### 1. Twarde 502 przy każdym generowaniu testu (commit `8289049`)

Objaw: „Model nie zwrócił poprawnej listy zadań".

Przyczyna: `AI_MODEL_CASCADE` zaczyna od `openai/gpt-5.6-luna`. Ścieżka
OpenAI wymusza `response_format: json_object`, a ten tryb **z definicji
zwraca obiekt** — OpenAI nie odda w nim gołej tablicy. `parseQuestions`
wymagało `Array.isArray(value)`, więc poprawna odpowiedź `{"questions":[...]}`
była odrzucana. Działało, dopóki pierwszym modelem w kaskadzie był Gemini,
bo `responseSchema` typu ARRAY sprawia, że Gemini oddaje tablicę. Zepsuło
się bez żadnej zmiany w samym generatorze.

Naprawa: `utils/modelJsonList.ts` przyjmuje oba kształty. Obiekt z kilkoma
tablicami jest odrzucany świadomie — zgadywanie, która jest ta właściwa,
dałoby test złożony z przypadkowego pola.

Warto odnotować: komentarz w `server.ts` już opisywał ten objaw („zwrócił
obiekt zamiast listy"), ale zabezpieczono przed nim wyłącznie drugi
przebieg (weryfikację), nie pierwszy.

### 2. Ćwiczenia generowały się PO POLSKU (commit `423adbf`)

Objaw: tekst z lukami po polsku, bank słów po polsku, w aplikacji do nauki
angielskiego.

Przyczyna była w regułach promptu, nie w modelu. Reguła `find_mistake`
mówiła wprost „N zdań w języku angielskim" i działała poprawnie. Reguły
`fill_in_blank`, `fill_in_blank_bank` i `multiple_choice` **nie mówiły
o języku nic** — a skoro cały prompt, polecenia i materiał lekcji są po
polsku, model wziął polski jako domyślny.

Naprawa w `utils/testExerciseRules.ts`, dwie warstwy:
1. Żelazna zasada językowa na początku promptu + język nazwany wprost
   w regule KAŻDEGO typu. Test pilnuje, że żadna reguła nie milczy.
2. Walidacja WYNIKU per typ i per pole, bo instrukcja w prompcie to prośba,
   nie gwarancja. Przy naruszeniu jedna próba naprawy z wypisanymi
   zarzutami; jeśli model dalej nie poprawi, lektor dostaje jasny komunikat
   zamiast polskiego testu.

Wykrywanie polskiego: diakrytyka + słowa funkcyjne + **fleksja**. Ta
trzecia warstwa okazała się konieczna — napisany przeze mnie test na
zdaniu „Monika pracuje w HR i czesto korzysta z roznych aplikacji"
(bez ogonków) początkowo NIE przechodził.

Przy okazji `fill_in_blank` dostał kształt klasycznego ćwiczenia
gramatycznego z podręcznika: angielski tekst, a przy każdej luce forma
bazowa w nawiasie — `Last summer Anna ___ (go) to Italy`.

### 3. Kursant sam obniżał sobie poziom testu (commit `8401a22`)

W ekranie testu stał przełącznik „Easy — układanka / Hard — wpisywanie",
którym kursant wybierał tryb W TRAKCIE rozwiązywania. To znosiło sens
pomiaru. Poziom pochodzi teraz z `TestQuestion.difficulty`, czyli od
lektora, domyślnie `hard`. `TestQuestionFields` jest używany wyłącznie
w ekranach testu, więc praca domowa jest nietknięta — tam wybór kursanta
zostaje, bo chodzi o naukę, nie o pomiar.

## Nie dokończone / do sprawdzenia

- **Silnik v2 nadal nie przeszedł ani jednego realnego przebiegu.** Flaga
  jest włączona po obu stronach, ale nikt jeszcze nie wygenerował pracy
  domowej v2 z prawdziwym modelem. To jest następna rzecz do zrobienia.
- Szacunki kosztu w `docs/silnik-v2-architektura.md` §3 są wyprowadzone
  z przewidywanej długości promptów, NIE z pomiaru. Do poprawienia po
  pierwszym przebiegu, danymi z linii `[hw-v2] wywołanie modelu`.
- Naprawa językowa generatora testów **nie została sprawdzona w działaniu** —
  przeszła testy jednostkowe i build, ale Maciej nie wygenerował jeszcze
  testu po wdrożeniu.
- Wzorzec „poproś o tablicę, sprawdź `Array.isArray`" mógł zostać w innych
  miejscach v1, które też przeszły na kaskadę z OpenAI na czele. Nie
  przeszukane systematycznie.
- Interfejs v2 (kreator lektora i ekran kursanta) nieoglądany w przeglądarce.

## Zakolejkowane

`docs/kolejka-przebudowa-panelu.md` — przebudowa panelu lektora zgłoszona
przez Macieja: powiadomienia nad kafelkami zamiast w sidebarze, trzy główne
kafelki z Profilem kursantów na pierwszym miejscu, listwa narzędzi pod
spodem, schowanie (nie kasowanie) przeglądu panelu, historii Notion, AI
Lesson Generatora i „Dodaj kursanta", przeniesienie zarządzania kursantami
do Bazy kursantów w sidebarze, oraz ujednolicenie „Brudnopis" → „Notatnik"
w warstwie interfejsu (nazwy w kodzie i bazie zostają).

Zapisałem tam trzy pytania do rozstrzygnięcia przed realizacją: co ma być
trzecim kafelkiem, czy „Profil kursantów" i „Baza kursantów" to nie dwie
nazwy na to samo, i gdzie ląduje powiadomienie, gdy lektor jest już w karcie
kursanta.

## Decyzje architektoniczne

- Reguły typów zadań testowych i walidacja językowa w `utils/`, nie
  w `server.ts`. Powód: `server.ts` ma 114 KB, a to jest logika domenowa
  bez UI, którą trzeba dało się przetestować — zgodnie z konwencją repo.
- Walidacja językowa przy naruszeniu **odmawia**, zamiast oddać lektorowi
  test po polsku. Lepiej powiedzieć wprost, co jest nie tak, niż kazać mu
  to odkrywać na kursancie.

## Ryzyka

NIE dotknięto `firestore.rules` (poza blokiem `attempts`/`drafts` z Etapu 4,
na który była jawna zgoda), middleware autoryzacji ani ścieżek tokenowych
bez logowania. Zmiany w `server.ts` ograniczają się do generatora testów:
podmiana inline'owego parsera na wywołanie funkcji z `utils/` oraz dodanie
bramki językowej. Trasy, autoryzacja i pozostałe endpointy bez zmian.

---

2026-09-12 — Claude Code / Sonnet 5

Zadanie: Etap D z `docs/plan-weekend-2026-09-12.md` — wspólny notatnik:
szablony zarządzane przez lektora (zastąpienie jednego zahardkodowanego
przycisku) oraz eksport do PDF i do pliku `.doc` (Word/Google Docs bez
integracji API). Plus kosmetyczna zmiana nazwy „Brudnopis" → „Notatnik"
wyłącznie w `components/scratchpad/`. Praca wykonana w izolowanym git
worktree na osobnej gałęzi (`worktree-agent-aa8a6bce431bb3b8d`), zakres
ograniczony do `components/scratchpad/`, `utils/pdfExport.ts`,
`firestore.rules` + `tests/rules/`, zgodnie ze zleceniem (równolegle inny
agent pracował nad resztą panelu lektora w głównym katalogu roboczym).

Zrobione:
- `firestore.rules`: nowy, osobny blok `match /scratchpadTemplates/{id} {
  allow read, write: if isAdmin(); }` — dodany zaraz po istniejącym bloku
  `scratchpadPins`, przed `system`. Reguły `scratchpads`/`scratchpadPins`
  nietknięte.
- `tests/rules/firestore.rules.test.ts`: cztery nowe testy dla
  `scratchpadTemplates` (lektor po e-mailu, admin po roli `teacher` w
  dokumencie użytkownika, kursant odmówiony na czytaniu/pisaniu/kasowaniu,
  gość niezalogowany odmówiony). `npm run test:rules` → 37/37 (33 stare +
  4 nowe), żaden stary test się nie zepsuł.
- `types.ts`: nowy interfejs `ScratchpadTemplate`.
- `services/scratchpadTemplateService.ts` (nowy plik): `listScratchpadTemplates`,
  `createScratchpadTemplate`, `updateScratchpadTemplate`,
  `deleteScratchpadTemplate`.
- `components/scratchpad/ScratchpadTemplateManagerModal.tsx` (nowy plik):
  modal zarządzania szablonami — nowy pusty / nowy z aktualnej treści
  edytora, edycja tytułu i HTML, usunięcie z potwierdzeniem inline.
  Renderowany w `ScratchpadEditor.tsx` tylko dla `isTeacher`.
- `components/scratchpad/ScratchpadEditor.tsx`: usunięty zahardkodowany
  `handleInsertTemplate` (stały HTML) — zastąpiony wersją przyjmującą
  dowolny HTML wstawianego szablonu. Menu „Wstaw” pokazuje teraz realną
  listę zapisanych szablonów (sekcja „Szablony”, tylko dla lektora) plus
  wejście „Zarządzaj szablonami…”. Nowy dropdown „Eksportuj” w nagłówku
  (widoczny i dla lektora, i dla kursanta) z dwiema pozycjami: „Eksportuj
  do PDF” i „Eksportuj do Worda” (opis: „Otwiera się też w Google Docs”).
- `utils/pdfExport.ts`: nowe funkcje `exportScratchpadToPDF` (dokładnie wzorzec
  `exportTestToPDF`, `html2pdf.js`, zero nowych zależności) i
  `exportScratchpadToWord` (Blob HTML z nagłówkiem MS Office,
  `Content-Type: application/msword`, rozszerzenie `.doc` — zero nowych
  zależności, zero integracji Google API).
- Zmiana nazwy „Brudnopis” → „Notatnik” w widocznym dla użytkownika tekście
  (nagłówki, przyciski, opisy, tooltipy, samouczek) w plikach:
  `ScratchpadEditor.tsx`, `ScratchpadModal.tsx`, `StudentScratchpadScreen.tsx`,
  `PublicScratchpadScreen.tsx`, `ScratchpadStudentPicker.tsx`,
  `scratchpadCoachSteps.ts`. Świadomie NIE zmienione: nazwy plików, nazwy
  zmiennych/funkcji, nazwa kolekcji `scratchpads`, nazwa
  `scratchpadService.ts`, komentarze w kodzie i komunikaty
  `console.error`/`console.warn` (niewidoczne dla użytkownika w UI).
  Repo nie używa i18next w `components/scratchpad/` (teksty są hardkodowane
  bezpośrednio w JSX), więc `en.json`/`pl.json` nie wymagały zmian.

Nie dokończone / do sprawdzenia:
- Weryfikacja wzrokowa w przeglądarce (menu szablonów, modal zarządzania,
  eksport PDF/Word) nie została wykonana — brak dostępu do przeglądarki w
  tej sesji. Zweryfikowano wyłącznie `tsc --noEmit`, `npm test`, `npm run
  build`, `npm run test:rules`.
- Plik `.doc` z `exportScratchpadToWord` nie został ręcznie otwarty w
  Wordzie ani w Google Docs po wygenerowaniu — wzorzec (nagłówek
  `xmlns:w="urn:schemas-microsoft-com:office:word"`, `Content-Type:
  application/msword`) jest standardowy, ale bez ręcznego testu nie mam
  100% pewności co do renderowania w każdej wersji Worda.

Decyzje architektoniczne:
- Osobna kolekcja `scratchpadTemplates` zamiast rozszerzania `scratchpads`
  — zero interakcji z wrażliwą logiką PIN/dostępu, zgodnie z briefem.
- Serwis szablonów jako nowy plik `scratchpadTemplateService.ts`, nie
  rozszerzenie `scratchpadService.ts` — inna domena (zarządzanie treścią
  wielokrotnego użytku vs. cykl życia jednego dokumentu na kursanta),
  osobny plik czytelniej rozdziela odpowiedzialność.
- „Brudnopis” → „Notatnik” zastosowane tylko do tekstu faktycznie
  renderowanego użytkownikowi (JSX, atrybuty `title`/`aria-label`,
  wartości pól typu `tip`/`description` w samouczku) — komentarze i logi
  konsoli zostawione, bo nie są „widoczne dla użytkownika” w sensie
  dosłownym z briefu, a zmiana ich byłaby wykroczeniem poza zakres.

Ryzyka: dotknięty `firestore.rules`, ale wyłącznie przez dodanie nowego,
w pełni izolowanego bloku (`scratchpadTemplates`, `isAdmin()`-only, zero
odczytu bez logowania, zero ścieżki PIN). Bloki `scratchpads` i
`scratchpadPins` — obszar wysokiego ryzyka z CLAUDE.md §3 — pozostały
bajt w bajt bez zmian; potwierdzone przez pełny przebieg `npm run
test:rules` (37/37, w tym wszystkie stare testy dla tych dwóch kolekcji).
`services/scratchpadService.ts` nietknięty. Middleware autoryzacji w
`server.ts` i ścieżki tokenowe bez logowania — nietknięte.

---

2026-09-12 — Claude Code / Sonnet 5

Zadanie: zlecenie weekendowe Macieja — dokończyć funkcjonowanie prac
domowych, powiadomień związanych z pracami domowymi i wspólnego notatnika
z szablonami/eksportem, plus przebudowa panelu lektora wg wcześniej
zakolejkowanej specyfikacji (`docs/kolejka-przebudowa-panelu.md`) i dalsza
naprawa trybu dziennego. Rozstrzygnięcia otwartych pytań i pełny plan
(przeanalizowany dwa razy pod kątem błędów, jedna realna korekta
znaleziona i naniesiona przed wdrożeniem) w
`docs/plan-weekend-2026-09-12.md`.

Zrobione (Etapy A, B, C, E — szczegóły też w `CHANGELOG.md`):
- **Etap A** (`81377a2`): `components/admin/HomeworkV2ReviewScreen.tsx` —
  brakujący ekran wglądu lektora w zadania silnika prac domowych v2, który
  jest już domyślnie włączony na produkcji (`config/featureFlags.ts`), ale
  nie miał żadnego ekranu przeglądu. To było prawdopodobnie realną
  przyczyną, dla której Maciej zgłosił "prace domowe nie działają".
  `types.ts`: `SpecialTask` +4 opcjonalne pola.
- **Etap B** (`178df72`): naprawiony bug w `notifyStudentOnHomework`
  (ignorował `MailingSettings.enableHomeworkAssigned`), nowy trigger
  `notifyStudentOnHomeworkGraded` + szablon `buildHomeworkGradedEmail`,
  trzeci nasłuch w `TeacherHomeworkNotification.tsx` dla prób v2
  wymagających uwagi, `enableDueDateReminder` oznaczony "Wkrótce" w UI.
- **Etap C** (`f4ee716`): przebudowa `AdminPanel.tsx` — trzy kafelki
  (Profil kursantów / Prezentacja / Notatnik), nowa listwa narzędzi, nowy
  `TeacherAttentionBanner.tsx`, schowanie (flaga `SHOW_LEGACY_PANEL_TOOLS`)
  Przeglądu panelu / AI Lesson Generator / "Dodaj kursanta" (ten ostatni
  ma już pełny odpowiednik w "Bazie kursantów" — bez regresji),
  przemianowanie "Brudnopis"→"Notatnik" poza `components/scratchpad/`.
- **Etap E, częściowo** (`00652dc`): 284 wystąpienia
  `hover:text-white`/`group-hover:text-white`/`focus:text-white` (wzorzec
  identyczny z już raz naprawionym błędem na ekranie startowym) zamienione
  na `text-text-hi` w `components/admin/` i `components/dashboard/`
  (54 pliki). Tryb nocny bez zmian (token = `#ffffff`), tryb dzienny
  czytelny na hover. Reszta surowego `text-white` (~880 wystąpień)
  świadomie nieruszona.
- **Etap D** (`6078752`, zmergowany do `main`): wykonany równolegle przez
  drugiego agenta w izolowanym git worktree (`isolation: worktree`), żeby
  uniknąć kolizji z pracą nad panelem — notatnik dostał realny system
  szablonów (`scratchpadTemplates` w Firestore, `isAdmin()`-only) i eksport
  do PDF/Worda. Pierwsza próba padła w połowie na limicie API bez commita
  (worktree zostało automatycznie posprzątane, bo nic nie było
  zacommitowane) — druga próba dokończyła zadanie. Osobny wpis tego agenta
  wyżej w tym pliku ma pełne szczegóły.
- Merge: zweryfikowałem samodzielnie zgłoszone przez agenta D "2
  przedistniejące awarie" (2 testy Notion + błędy `tsc` o brakującym
  `firebase-functions/logger`) i potwierdziłem, że to artefakt izolowanego
  worktree (brak `functions/node_modules`), nie prawdziwy problem — po
  zmergowaniu do `main` (który ma zainstalowane zależności) pełny zestaw
  weryfikacji przechodzi czysto: `tsc --noEmit` bez błędów, `npm test`
  268/268, `npm run build` bez błędów, `npm run test:rules` 37/37.

Nie dokończone / do sprawdzenia:
- **Zero weryfikacji wzrokowej w przeglądarce** dla całości tej sesji
  (nowy ekran przeglądu v2, przebudowany panel lektora, notatnik z
  szablonami, eksport PDF/Word) — brak dostępu do zalogowanej sesji w
  środowisku agenta. Wszystko przeszło `tsc`/testy/build, nic nie zostało
  obejrzane na żywo. To największe ryzyko tej sesji — pierwsza rzecz do
  zrobienia przy najbliższym logowaniu.
- Pierwszy realny przebieg silnika v2 z prawdziwym modelem OpenAI —
  wymaga ustawienia sekretu `OPENAI_API_KEY` w Cloud Functions, czego nie
  mogłem zrobić (odmowa środowiska agenta na materiał uwierzytelniający).
  Do zrobienia przez Macieja: `npm run firebase:secrets:set --
  OPENAI_API_KEY`, potem jedna realna praca domowa v2 jako smoke test.
- `enableDueDateReminder` pozostaje wyłącznie etykietą UI — wymaga
  Cloud Scheduler + nowej funkcji, świadomie odłożone.
- Plik `.doc` z eksportu notatnika nie został ręcznie otwarty w Wordzie
  ani Google Docs po wygenerowaniu (patrz wpis agenta D wyżej).
- Pozostałe ok. 880 wystąpień surowego `text-white` (nie `hover:`) — pełne
  przejście wymaga oceny per przypadek, nie ślepej zamiany.

Decyzje architektoniczne:
- `proposeHomeworkV2Review` NIE jest funkcją zatwierdzania oceny (błędne
  założenie w pierwszej wersji planu, poprawione po przeczytaniu kodu
  `functions/src/homeworkV2/endpoints.ts` — to generator propozycji
  powtórki). Werdykt AI dla v2 jest natychmiastowy i niemutowalny z
  założenia (`attempts.update: if false` dla każdego, łącznie z adminem),
  więc ekran w Etapie A daje wyłącznie wgląd + ręczną notatkę na
  `specialTasks`, nie "zatwierdzanie".
- Eksport notatnika "do Google Docs" zrealizowany jako plik `.doc`
  (format zgodny z Wordem), nie integracja OAuth z Google API — decyzja
  podjęta z Maciejem wprost w rozmowie, opisana w
  `docs/plan-weekend-2026-09-12.md` Etap D, żeby nie obiecywać integracji
  wymagającej zgody użytkownika w konsoli Google Cloud, której nie da się
  wdrożyć w jedną sesję.
- Etap D wykonany w osobnym worktree równolegle z resztą (Etapy A-C, E)
  w głównym katalogu roboczym — podział wg katalogów
  (`components/scratchpad/` vs reszta) był rozłączny, więc merge przeszedł
  bez konfliktów.

Ryzyka: `firestore.rules` dotknięty wyłącznie przez Etap D (agent D, opis
wyżej) — jeden nowy, w pełni izolowany blok `scratchpadTemplates`. Etapy
A, B, C, E **nie dotykają** `firestore.rules`, middleware autoryzacji w
`server.ts` ani ścieżek tokenowych bez logowania. `.gitignore` dostał nowy
wpis `.claude/worktrees/` — infrastruktura agentów, nigdy nie powinna
trafiać do repo.

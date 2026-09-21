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

---

2026-09-12 — Claude Code / Sonnet 5 (runda 2, ten sam dzień)

Zadanie: kolejny pakiet zgłoszeń Macieja w trakcie tej samej sesji —
cienie na kartach, podstrona ma przeżywać F5, refaktor trybu jasnego
(nagłówki nieczytelne, biały tekst na białym), notatnik "dokładnie jak
Google Docs" (formatowanie, PIN, szablon domyślny), usunięcie "odesłanych
prac" z sidebara na rzecz widgetu w rogu, listwa narzędzi jako kafelki +
zakładka "Prace domowe", automatyczne codzienne sprawdzenie Notion.

Zrobione (commity `64ca190`..`6cb1925`):
- **Krytyczny bug znaleziony w trakcie pracy**: `prose-invert` (Tailwind
  Typography, kolory na sztywno pod ciemne tło) razem z hardkodowanym
  `text-white`, bez względu na motyw, w 10 plikach — w trybie jasnym dawało
  to dosłownie niewidoczny biały tekst na białej/jasnej karcie, m.in. w
  polu wpisywania PIN-u notatnika. Naprawione we wszystkich 10 (jeden
  commit własny dla notatnika `64ca190`, dziewięć pozostałych przez
  równoległego agenta w worktree, zmergowane w `4a27794`).
- Notatnik: naprawiony bug (PIN nigdy nie trafiał do kopiowanego linku),
  prawdziwy szablon domyślny (`ScratchpadTemplate.isDefault`,
  `getDefaultTemplate`/`setDefaultTemplate`) z treścią odzwierciedlającą
  realny szablon lekcji Macieja z Google Docs, szerszy pasek formatowania
  (wyrównanie, 6 kolorów tekstu, linki, lista zadań), mocniejsze
  theme-aware cienie, nowy token `--accent-2` (fioletowy w trybie jasnym).
  Zero zmian w `firestore.rules`.
- Podstrona przeżywa F5: stan panelu (`view` i siedem powiązanych pól)
  lustrzany w `sessionStorage`, odczytywany przy starcie zamiast
  twardego `'dashboard'`. Zabezpieczenie przed pokazaniem widoku
  lektorskiego kursantowi na współdzielonym komputerze.
- Panel lektora: listwa narzędzi zamieniona z pigułek na siatkę kafelków
  (ta sama szerokość co trzy główne kafelki), dołączona pozycja "Prace
  domowe". "Odesłane prace" usunięte z `Sidebar.tsx` (badge + link) —
  `TeacherHomeworkNotification.tsx` przebudowany z auto-znikającego po
  10s toastu na trwały widget w rogu, pokazujący KOMPLET aktualnie
  nieprzejrzanych spraw (nie tylko nowe zdarzenia z tej sesji), z
  rozwijaną listą i osobnym "Później" per pozycja (sessionStorage).
- Notion: nowa scheduled Cloud Function `checkNotionDaily`
  (`functions/src/notion/dailyCheck.ts`, codziennie 06:00 czasu
  warszawskiego) — liczy naprawdę nowe lekcje/kursantów względem tego, co
  już jest w aplikacji, zapisuje do `system/notionAutoCheck`. Karta
  "Historia lekcji z Notion" w panelu zwinięta domyślnie do niepozornego
  linku, rozwija się automatycznie tylko gdy jest coś nowego. **Wdrożone
  na produkcję** (`npm run deploy:functions` — także
  `notifyStudentOnHomeworkGraded` z poprzedniej rundy tego dnia, która
  jeszcze nie była wdrożona).
- Przy okazji naprawione dziesiątki innych miejsc z tym samym wzorcem
  błędu (`hover:text-white`, `border-white/10`, bare `text-white`) w
  plikach dotykanych w tej rundzie (`ScratchpadEditor.tsx`,
  `PublicScratchpadScreen.tsx`, `StudentScratchpadScreen.tsx`,
  `ScratchpadModal.tsx`, `NotionSyncButton.tsx`).

Nie dokończone / do sprawdzenia:
- **Zero weryfikacji wzrokowej w przeglądarce** — jak w poprzedniej
  rundzie tego dnia, wszystko przeszło `tsc`/testy/build, nic nie zostało
  obejrzane na żywo. Priorytet numer jeden przy najbliższym logowaniu,
  szczególnie nowy pasek formatowania notatnika i widget w rogu.
  Odesłane w wersji "Kolor tekstu" — sześć kolorów zaszytych na sztywno w
  kodzie, nie wybór dowolny. Świadomie: to notatnik lekcyjny, nie edytor
  grafiki.
- Cień na kartach "jak na zrzucie" — zrzut, który pokazał Maciej, okazał
  się zrzutem z jego RĘCZNEGO Google Docs, nie z aplikacji (research
  potwierdził: taki tekst nigdzie w kodzie nie istniał). Zinterpretowane
  jako prośba o mocniejszy, theme-aware cień na analogicznej karcie w
  aplikacji (notatnik) — zrobione, ale warto potwierdzić z Maciejem, czy
  o to chodziło, przy najbliższej rozmowie.
- `checkNotionDaily` nie miał jeszcze pierwszego realnego przebiegu (cron
  6:00 czasu warszawskiego) — dowiemy się jutro rano, czy zadziałał.
- Notatnik nadal nie ma prawdziwej współpracy wielu kursorów na żywo, nie
  ma tabel/obrazków, eksport "do Google Docs" to nadal plik `.doc`, nie
  integracja API — świadomie, patrz commit `64ca190` i wcześniejszy plan.

Decyzje architektoniczne:
- `checkNotionDaily` tylko PATRZY, nic nie importuje samodzielnie —
  decyzja, co i komu założyć konto, zostaje po stronie lektora, zgodnie
  z istniejącą filozofią całego modułu Notion ("pojawienie się kogoś w
  Notion nie jest zgodą na założenie mu konta").
- "Później" w widgecie powiadomień i stan podstrony po F5 w
  `sessionStorage`, nie `localStorage` — świeże otwarcie karty ma
  zaczynać czysto, nie dziedziczyć stanu sprzed dni.

Ryzyka: `firestore.rules` **nietknięty** w całej tej rundzie — odczyt
`system/notionAutoCheck` i `scratchpadTemplates` (przy tworzeniu notatnika)
korzysta z reguł, które już tam były. Wdrożone na produkcję Cloud
Functions — `notifyStudentOnHomeworkGraded` i `checkNotionDaily` teraz
faktycznie działają na żywo, nie tylko w repo.

**Dopisek operacyjny (nie dotyczy kodu):** port 3000 lokalnego serwera
deweloperskiego bywa w tym środowisku zajęty przez pozostałość po
wcześniejszym procesie w tle (infrastruktura agenta, nie coś w repo) —
`lsof -i :3000` pokazuje wtedy nasłuch na `localhost:3000` osobno od
właściwego procesu `tsx server.ts` na `*:3000`, a curl trafia w ten
pierwszy i dostaje gołe 404 na każdej trasie, łącznie z `/api/*`. Naprawa:
`npm run dev` na innym porcie (`PORT=3001 npm run dev`) zamiast walczyć o
3000. Nie jest to bug w `server.ts`.

---

2026-09-13 — Claude Code / Opus 5

Zadanie: (A) domknąć trwałość danych z raportu bezpieczeństwa — sprawdzony
  restore, dłuższa retencja, backup kont z Auth, reguły Storage w repo;
  (B) przygotować aplikację na transkrypcje z Cribro Sift jako drugie
  źródło historii lekcji, obok Notion.

Zrobione:
- `scripts/auth-backup.sh` + `npm run firebase:auth:export` — zrzut kont
  z Firebase Auth do iCloud Drive, 12 kopii, pusty eksport odrzucany.
- Retencja backupów Firestore 7 → 30 dni (harmonogram zaktualizowany,
  `package.json` zgodny z rzeczywistością).
- Restore z backupu przywrócony do `cribro-restore-test`, operacja
  `SUCCESSFUL` 100/100, baza testowa skasowana po weryfikacji.
- `storage.rules` (deny-all dla klientów) + wpis w `firebase.json`
  + `npm run deploy:storage`.
- `types.ts`: pięć pól opcjonalnych w `LessonRecord` + `live_transcript`
  w `source`. `firestore.rules`: walidacja tych pól.
- `functions/src/transcript/{ingest,store}.ts` — funkcja HTTP
  `ingestTranscript` + czysta logika zapisu (testowalna bez HTTP).
- `utils/lessonBlocks.ts`: warunek niewidoczności lekcji z transkrypcji.
- `hooks/useLiveLessonTranscript.ts`, `utils/transcriptLesson.ts`,
  `services/transcriptLesson.ts`, `components/admin/TranscriptLessonPanel.tsx`,
  wpięcie w `CascadingLessonDetails` + znacznik źródła w `AdminPanel`.
- Repo `cribro/sift`: `src/main/recall.js`, IPC `recall:send`, preload,
  przycisk w zakładce „Transkrypcja", karta w Ustawieniach, `recall`
  zamknięte przed nieużytkownikiem-właścicielem w `main/owner.js`,
  `scripts/recall-test.js`.
- Wdrożone: reguły + indeksy Firestore, 10 funkcji, sekret
  `SIFT_INGEST_TOKEN`. Przebieg end-to-end sprawdzony na produkcji.

Nie dokończone / do sprawdzenia:
- `hash-config.json` (parametry scrypta) trzeba raz przepisać z konsoli
  Firebase — bez nich odtworzone konta nie przyjmą starych haseł.
- Firebase Storage nie jest założony w projekcie, więc `storage.rules`
  leżą niewdrożone, a kubełkowa połowa cache'u TTS nigdy nie działała.
- Panel transkrypcji nie był oglądany w przeglądarce (tsc + testy +
  build przechodzą). Tryb dzienny tego panelu również nie.
- Próbna lekcja `sift-probna-wysylka-2026-09-13` leży na koncie lektora —
  do skasowania z panelu po obejrzeniu.

Decyzje architektoniczne:
- Sift wysyła WPROST do Recall, nie przez Supabase. Supabase trzyma tam
  konta i notatki; zapisy spotkań nie jadą tam wcale i nie mają
  (komentarz w `supabase/schema.sql`), więc droga przez Supabase
  wymagałaby najpierw zbudowania dla transkrypcji miejsca tam, a potem
  drugiego mostu dalej.
- Token w Secret Managerze, nie w bazie i nie w panelu admina: jedno
  konto lektora, więc ekran do generowania tokena byłby dodatkową
  powierzchnią bez zysku.
- Token jedzie w `X-Sift-Token`. `Authorization: Bearer` na funkcjach v2
  przechwytuje brama Cloud Run i odbija stroną HTML 401 zanim funkcja się
  obudzi — przy pustych logach funkcji. To nie było do wykrycia testami.
- Generowanie bloków i zatwierdzenie lekcji to dwa osobne kliknięcia.
- Lekcja z transkrypcji nie pokazuje ogólnego alertu „wymaga
  potwierdzenia": jego przycisk zdejmuje flagi, nie ruszając
  `sessionStatus`, czyli zatwierdzałby lekcję nadal ukrytą przed kursantem.

Ryzyka:
- **`firestore.rules` DOTKNIĘTE** — wyłącznie dodanie walidacji nowych pól
  opcjonalnych w `isValidLessonRecord`. Żadna reguła dostępu nie ruszona,
  44/44 testów reguł przechodzi, wdrożone na produkcję.
- **Nowa ścieżka bez logowania Firebase**: `ingestTranscript` jest
  publicznym endpointem HTTP chronionym wyłącznie sekretem
  `SIFT_INGEST_TOKEN` (porównanie w stałym czasie). Zapisuje przez Admin
  SDK, czyli ponad regułami. Kto ma token, może dopisać transkrypcję
  dowolnemu kursantowi — nie może natomiast niczego przeczytać ani
  opublikować kursantowi.
- `main/owner.js` w Sifcie zmienione (zawężenie, nie rozszerzenie):
  `recall` wycięte z ustawień publicznych i z zapisu.

---

2026-09-13 (runda 2) — Claude Code / Opus 5

Zadanie: wykorzystać `~/Downloads/design_handoff_cribro_mockup` do
  przebudowy UI i zadbać o widok mobilny panelu kursanta i lektora
  (duże kafelki, prosty widok dla kursanta).

Zrobione:
- `firebase.ts` + `npm run dev:emulated` — przełącznik na emulatory
  Auth/Firestore w trybie dev, z podwójną bramką (`import.meta.env.DEV`
  najpierw, więc blok wypada z buildu produkcyjnego).
- `components/dashboard/StudentToolBar.tsx` (nowy) — listwa dużych kafelków.
- `TodayScreen.tsx` — przebudowa na nagłówek → powtórki → listwa → treść →
  ostatnia lekcja. `openTool` jako jedyny nowy stan.
- `PanelSection.tsx` + cztery sekcje — tryb `headless`.
- `StudentLessonPanel.tsx` — prop `only: 'latest' | 'earlier'`, jedno
  zapytanie do bazy obsługuje oba miejsca.
- `StudentHeroHeader.tsx` — ścieśnienie na telefonie (642 → 419 px).
- Naprawa trybu jasnego: `AdminPanel.tsx` (67 linii) + 9 plików panelu
  kursanta + `AdminAIActivityMonitor.tsx`.
- `Sidebar.tsx` — uchwyt menu na pionowy środek ekranu.
- `AdminPanel.tsx` — druga listwa „Więcej narzędzi" (9 kafelków, zwinięta).

Nie dokończone / do sprawdzenia:
- Menu boczne NIE obcięte wbrew makiecie (uzasadnienie w CHANGELOG).
- Landing bez przebudowy — makieta zawiera cennik i treść ofertową,
  czyli decyzje biznesowe, nie układ.
- „Baza scenariuszy" jako zakładka Prezentacji — nie zrobione.
- Kafelek „Historia" prowadzi do istniejącej historii sesji, nie do
  nowego raportu ze słupkami 14 dni.
- Pozostałe ~780 wystąpień `text-white` poza panelami — nie ruszone,
  bo każde wymaga obejrzenia ekranu, na którym stoi.
- Ekrany poza panelami (fiszki, prezentacja, mailing, ustawienia) nie były
  oglądane w trybie jasnym na telefonie.

Decyzje architektoniczne:
- Zamiana `text-white` ograniczona do LINII i pomijająca linie z
  wypełnieniem akcentem: biel na kolorowym przycisku jest poprawna, a
  szukanie kontekstu po cudzysłowach trafiało w sąsiedni atrybut
  (klasy są szablonami z warunkami).
- Kafelki bez liczników: policzenie zadań i testów w listwie znaczyłoby
  drugi nasłuch na tych samych kolekcjach. Kropka „coś czeka" bierze się
  z flag, które już są w profilu (`hasNewHomework`, `hasNewLesson`).
- Notatnik tylko na dużym ekranie (`desktopOnly`) — wspólne pisanie na
  telefonie nie działa, a wejście do czegoś nieużywalnego jest gorsze
  niż brak wejścia.
- Mniej szczegółów na telefonie niż na komputerze jest tu zamierzone
  (wprost z polecenia), nie kompromisem.

Ryzyka:
- `firestore.rules` NIETKNIĘTY w tej rundzie.
- Zasiane konta w EMULATORZE, nie na produkcji (`monika@example.com`,
  `maciej.wyrozumski@gmail.com`, hasło `test123456`) — żyją tylko w pamięci
  emulatora i giną razem z nim.
- `firebase.ts` to plik inicjujący połączenie z bazą: dodany blok jest
  podwójnie bramkowany, a `import.meta.env` czytane ostrożnie, bo testy
  importują ten plik w gołym Node.

---

2026-09-13 (runda 3) — Claude Code / Opus 5

Zadanie: sześć zmian zgłoszonych przez Macieja po obejrzeniu panelu —
  duplikaty kafelków, historia lekcji w profilu kursanta, notatnik jak
  dokument, kompaktowa lista prac domowych, nowy tryb jasny, likwidacja
  menu bocznego.

Zrobione (commit na etap):
- `AdminPanel.tsx` — usunięte duplikaty Notatnika i Prezentacji z listwy,
  „Profil kursantów" → trasa `students-database`, „Podgląd kursanta"
  dodany do „Więcej narzędzi", wejście do scenariuszy w Planerze.
- `components/admin/LessonSourceBar.tsx` (nowy) — źródła historii lekcji.
- `StandaloneStudentDatabaseScreen.tsx` — globalna weryfikacja Notion.
- `services/scratchpadService.ts` — `adoptScratchpadForStudent`, neutralny
  szablon notatnika roboczego.
- `ScratchpadModal.tsx` — pasek przypisania kursanta w trakcie pisania.
- `ScratchpadEditor.tsx` — kartka w kości słoniowej w obu motywach.
- `components/dashboard/HomeworkTaskList.tsx` (nowy) + przełącznik widoku
  w `HomeworkScreen.tsx`; `hooks/useMediaQuery.ts` (nowy).
- `design/theme/tokens.css` + `index.css` — tryb jasny przepisany, tokeny
  konstelacji; `ConstellationBackground.tsx` czyta kolor z motywu.
- `components/ui/TopBar.tsx` (nowy) — pasek górny + panel zarządzania.
- `Dashboard.tsx` — `TopBar` zamiast `Sidebar`, nasłuch `bug_reports`.
- `TodayScreen.tsx` / `StudentToolBar.tsx` — kafelki słownictwa i praktyki
  dodatkowej, `domId` dla samouczka.
- `components/dashboard/Sidebar.tsx` — USUNIĘTY.

Nie dokończone / do sprawdzenia:
- Modal „Nowa praca domowa" dubluje teraz pasek górny — do decyzji Macieja.
- Ekrany poza panelami (fiszki, prezentacja, mailing, ustawienia) nie były
  oglądane w nowym trybie jasnym.
- Pozostałe ~780 wystąpień `text-white` poza panelami.
- Scenariusze są w Planerze jako przycisk do osobnego ekranu, nie jako
  zakładka wewnątrz — pełna przebudowa modułu to osobne zadanie.

Decyzje architektoniczne:
- Przypisanie notatnika przenosi treść do `sp_<uid>` zamiast dopinać pole,
  bo ekran kursanta szuka notatnika po tym identyfikatorze.
- Lista prac domowych to siatka, nie `<table>`: tabela z pięcioma
  kolumnami wymusza poziome przewijanie, którego nie ma nigdzie indziej.
- Kafelki listwy bez liczników — sygnał „coś czeka" z flag w profilu,
  zero nowych zapytań.
- Kartka notatnika NIE przełącza się z motywem (jedyne takie miejsce).
- Tryb jasny: rozdzielenie niesie różnica jasności i obrys, nie cień.

Ryzyka:
- `firestore.rules` NIETKNIĘTY (44/44 testów reguł przechodzi).
- Usunięcie `Sidebar.tsx` to zmiana nawigacji w całej aplikacji —
  inwentaryzacja wejść zrobiona przed usunięciem i opisana w CHANGELOG.
- Nowy nasłuch `bug_reports` w `Dashboard.tsx` odpala się wyłącznie dla
  roli `admin`.

---

2026-09-14 (runda 4) — Claude Code / Opus 5

Zadanie: siedem zmian zgłaszanych przez Macieja w trakcie sesji —
  kontekst przed lekcją jako główny kafelek z wyborem kursanta,
  likwidacja podglądu kursanta, przeniesienie Bazy tematów do Planera,
  zadokowanie AI Live Monitora, przebudowa notatnika (spis treści,
  nagłówki zwijane, podział na strony, motyw kartki, eksport do Google
  Docs, notatnik jako osobny ekran), przebudowa kontekstu na odprawę AI,
  symetria i szkło w panelu kursanta, czytelność trybu jasnego.

Zrobione (commit na etap):
- `components/admin/AdminPanel.tsx` — „Kontekst przed lekcją" wchodzi na
  miejsce Prezentacji w trójce głównych kafelków (Prezentacja schodzi do
  listwy); kafelek ZAWSZE pyta o kursanta; zakładka „Kontekst" znika
  z profilu; „Podgląd kursanta" i „Baza tematów" znikają z „Więcej
  narzędzi"; Baza tematów ląduje w Planerze obok Bazy scenariuszy;
  kafelek Notatnika prowadzi na trasę `scratchpad`; odbiór
  `_pendingLessonFromScratchpad`.
- `components/admin/PreLessonContextModal.tsx` (nowy).
- `components/admin/PreLessonContext.tsx` — przepisany: odprawa AI na
  wierzchu, surowe notatki zwinięte pod spodem.
- `services/preLessonBriefing.ts` (nowy) — odprawa z 3 ostatnich lekcji,
  JSON ze schematem, bufor w `localStorage` po id ostatniej lekcji.
- `components/dashboard/Dashboard.tsx` — usunięte ekrany `preview-*`
  i stan `previewStudentId`; trasa `scratchpad` rozdziela lektora
  i kursanta.
- `components/dashboard/StudentPreviewFrame.tsx` — USUNIĘTY.
- `components/admin/AdminAIActivityMonitor.tsx` — `createPortal` do
  <body>, zadokowany do dolnej krawędzi, panel rośnie w górę.
- `components/scratchpad/ScratchpadEditor.tsx` — spis treści z nagłówków,
  nagłówki zwijane, warstwa podziału na strony, motyw kartki
  jasny/ciemny, „Otwórz w Google Docs", opóźnione odświeżanie struktury.
- `components/scratchpad/ScratchpadModal.tsx` → `TeacherScratchpadScreen.tsx`
  — ekran zamiast modala, wariant `overlay` dla wejść bez wyjścia.
- `utils/pdfExport.ts` — `exportScratchpadToGoogleDocs`.
- `components/dashboard/StudentToolBar.tsx` / `TodayScreen.tsx` /
  `StudentHeroHeader.tsx` — sześć kafelków, siatka 2×3 i 3×2, `.glass-tile`.
- `components/ui/TopBar.tsx` — logo jako wyraźny cel kliknięcia.
- `index.css` — arkusz kartki `.pad-paper`, receptura `.glass-tile`,
  blok naprawy `text-white` w trybie jasnym, `color-scheme: light`.

Nie dokończone / do sprawdzenia:
- ŻADNA z tych zmian nie była oglądana w działającej przeglądarce —
  przeszły `tsc --noEmit`, `npm test` (293/293) i `npm run build`.
  Notatnik idzie jutro do kursantów, więc wymaga obejrzenia na telefonie
  i na komputerze PRZED wysłaniem linków.
- Nagłówki zwijane zapisują stan w `style.display` elementów, czyli
  w treści dokumentu. Przy współdzielonej edycji zwinięcie u lektora
  zwija też u kursanta — zamierzone, ale nieprzetestowane we dwoje.
- Podział na strony to kreska co 1123 px, nie prawdziwa paginacja: nie
  zna wysokości elementu, przez który przechodzi, więc kreska potrafi
  przeciąć akapit w połowie wiersza.
- Bufor odprawy AI siedzi w `localStorage` jednej przeglądarki; drugi
  komputer liczy ją od nowa.
- „Chatbot kontekstowy" z pierwszej wiadomości NIE został zrobiony —
  patrz Decyzje.

Decyzje architektoniczne:
- Kontekst pyta o kursanta ZA KAŻDYM RAZEM, nawet gdy panel ma otwarty
  profil: ciche użycie `selectedUser` pokazywałoby kontekst kogoś innego
  bez ostrzeżenia.
- Odprawa z TRZECH lekcji, nie z jednej: jedna nie mówi, co wraca.
  Klucz odpowiedzi nie idzie do modelu — najdroższa część promptu, zero
  informacji o tym, jak kursantowi poszło.
- Notatnik jest ekranem, nie modalem; wejścia, z których nie da się wyjść
  bez utraty stanu (prezentacja, baza kursantów, profil), dostają wariant
  `overlay` — warstwę NIEPRZEZROCZYSTĄ, a nie okienko nad przyciemnieniem.
- Eksport do Google Docs przez schowek (`text/html`) + otwarcie pustego
  dokumentu. Prawdziwy eksport wymaga OAuth i zakresu `drive.file`; nie
  ma powodu prosić o dostęp do Dysku dla jednej funkcji.
- Papier kartki to ciepła kość #f6f1e6 jak w czytniku, nie biel: biel na
  ciemnym oknie świeci. Kontrast z tekstem #2c2822 wynosi 12,3:1.
- `text-white` w trybie jasnym znaczy „kolor tekstu na tym, na czym
  stoję" (`--on-fill`), zamiast hurtowej podmiany w 1169 miejscach —
  część z nich jest poprawna i podmiana zepsułaby przyciski akcentu.
- „Praktyka dodatkowa" wypada z kafelków kursanta: to samo wejście stoi
  w nagłówku jako jedyny duży przycisk, a siedem kafelków nie układa się
  równo w żadnej szerokości.
- Chatbot kontekstowy: polecenie („Add a context-aware chatbot… perfect
  for multi-step bookings or") przyszło urwane w połowie zdania i mówi
  o rezerwacjach, których w tej aplikacji nie ma. Zamiast zgadywać zakres
  całego nowego modułu — zostawione do ustalenia.

Ryzyka:
- `firestore.rules` NIETKNIĘTY. Middleware autoryzacji w `server.ts`
  NIETKNIĘTY. Ścieżki tokenowe bez logowania NIETKNIĘTE.
- Usunięcie ekranów `preview-*` to zmiana nawigacji: sprawdzone, że
  `student-today` zostaje jako WŁASNY panel kursanta (używa go `onHome`
  w pasku górnym i powiadomienie o nowej lekcji).
- `TeacherScratchpadScreen` wczytuje listę kursantów własnym zapytaniem
  o kolekcję `users` — czyta ją tylko rola lektora/admina, bo tylko ona
  wchodzi na ten ekran.
- Blok naprawy trybu jasnego w `index.css` stoi poza warstwami Tailwinda,
  więc wygrywa z każdą klasą `text-white`. Dopasowanie jest dokładne
  (`[class~=…]`), ale to reguła globalna — jeśli gdzieś biały tekst na
  ciemnym tle w trybie dziennym ściemnieje, przyczyna jest tutaj.

---

2026-09-14 (runda 5) — Claude Code / Opus 5

Zadanie: długa lista poprawek zgłaszanych w trakcie sesji — kontekst przed
  lekcją (zakres 1/2/3 lekcje, krótka odprawa po imieniu, zwijane okienka),
  trzy poziomy narzędzi w panelu lektora, prosta lista w bazie kursantów,
  notatnik (wysokość, obrazy, laser, szablon, historia wersji, obudowa),
  scalenie prac domowych i testów, kompaktowe słownictwo, onboarding
  z podświetlaniem elementów, prototyp asystenta.

Zrobione (commit na etap):
- `services/preLessonBriefing.ts` — `BriefingScope`, odprawa po imieniu
  do lektora, rozbicie po lekcjach, bufor z zakresem w kluczu.
- `components/admin/PreLessonContext.tsx` — zwijane okienka, jedna
  rozwinięta (najnowsza lekcja).
- `components/admin/AdminPanel.tsx` — trzy poziomy narzędzi, usunięta
  belka „Profil i moduły kursanta", kotwice `data-coach` dla przewodnika.
- `components/admin/StudentSimpleList.tsx` (nowy) + przełącznik
  „Lista / Pełny widok" w `StandaloneStudentDatabaseScreen`.
- `components/dashboard/TeacherWorkScreen.tsx` (nowy) — „Zadania i testy"
  z sekcjami zwijanymi; trasy `homework` i `tests` prowadzą tu.
- `components/dashboard/HomeworkScreen.tsx` — tryb `headless`,
  „Przegląd v2" tylko gdy istnieje zestaw v2.
- `services/scratchpadService.ts` + `types.ts` — `ScratchpadRevision`,
  limit `SCRATCHPAD_MAX_CONTENT_BYTES`, migawki co 5 min.
- `utils/scratchpadImages.ts` (nowy) — zmniejszanie i przekodowanie WebP.
- `components/scratchpad/ScratchpadEditor.tsx` — wklejanie obrazów,
  zmiana rozmiaru, laser, szablon z paska, obudowa ze szkła.
- `components/dashboard/tourSteps.ts` (nowy) + `CoachMarks` jako
  przewodnik; `OnboardingOverlay.tsx` i `OnboardingTour.tsx` USUNIĘTE.
- `components/ui/TopBar.tsx` — stały przycisk pomocy.
- `services/teacherAssistant.ts` + `components/admin/TeacherAssistant.tsx`
  (nowe) — prototyp pytań o kursantów.
- `index.css` — jedna receptura szkła (`liquid-glass-tile` = `.glass-tile`),
  obudowa notatnika, style obrazów i lasera.

Nie dokończone / do sprawdzenia:
- NIC z rundy 4 i 5 nie było oglądane w przeglądarce. Przechodzi
  `tsc --noEmit`, `npm test` (293/293), `npm run build`.
- Notatnik idzie do kursantów — wymaga obejrzenia na telefonie
  i na komputerze przed wysłaniem linków.
- Kroki przewodnika lektora celują w `data-coach` na pulpicie panelu;
  gdy lektor wejdzie w profil kursanta, część kotwic nie istnieje
  i CoachMarks pominie krok. Nieprzetestowane.
- Asystent nie zna prac domowych, testów ani statystyk (zakres prototypu).
- Firebase Storage nadal nie jest założony, więc obrazy w notatniku żyją
  jako data URI w treści dokumentu. To jest powód limitu 700 kB.

Decyzje architektoniczne:
- Zakres odprawy domyślnie JEDNA lekcja: przed cotygodniowymi zajęciami to
  właściwa odpowiedź, trzy byłyby trzy razy większą ścianą tekstu.
- Data i temat lekcji w odprawie wracają z naszych danych, nie z modelu.
- Prace domowe i testy to jeden ekran, bo to jedna czynność; sekcje
  zwijane, nie zakładki, bo pytanie „co jest do sprawdzenia" dotyczy obu
  rodzajów naraz.
- Migawki notatnika w TYM SAMYM dokumencie, nie w osobnej kolekcji —
  osobna wymagałaby własnej reguły w `firestore.rules`.
- Rozmiar obrazu przez cztery ustalone szerokości, nie uchwyt:
  przeglądarka przechwytuje przeciąganie obrazu w `contentEditable`.
- Przewodnik podświetla PRAWDZIWE elementy (CoachMarks), bo poprzedni
  rysował atrapy i uczył atrap.
- Asystent dopasowuje imiona lokalnie i wysyła tylko lekcje osób,
  o które zapytano.
- Jedna receptura szkła dla obu paneli; `liquid-glass-tile` zachowuje
  nazwę, zmienia treść.

Ryzyka:
- `firestore.rules` NIETKNIĘTY. Middleware autoryzacji NIETKNIĘTE.
  Ścieżki tokenowe bez logowania NIETKNIĘTE.
- Nowe pole `revisions` w dokumencie `scratchpads/{id}` — zapisywane tą
  samą regułą, co treść; sprawdzić, czy reguła nie ma białej listy pól.
- `TeacherAssistant` i `StudentSimpleList` czytają kolekcję `users`
  własnymi zapytaniami; oba renderują się wyłącznie dla roli lektora.
- Usunięcie `OnboardingOverlay` zmienia pierwsze wejście do aplikacji dla
  obu ról.

---

2026-09-14 (runda 6) — Claude Code / Opus 5

Zadanie: efekt szkła tylko na hover, uproszczenie profilu kursanta,
  walidacja widoku z konta kursanta, naprawa przewodnika (dymki mają
  pokazywać opisywany element).

Zrobione (commit na etap):
- `index.css` — zdjęty przejazd połysku z `.glass-tile`
  i `.liquid-glass-tile`; zostaje wyłącznie reakcja na kursor.
- `components/ui/CoachMarks.tsx` — reflektor rysuje się także poniżej
  860 px (dotąd na telefonie był sam dymek na czarnym tle); na wąskim
  ekranie dymek przykleja się do krawędzi po PRZECIWNEJ stronie niż cel;
  kroki bez istniejącego celu są pomijane przy otwarciu.
- `components/admin/AdminPanel.tsx` — profil kursanta: spis pięciu sekcji
  i jedna otwarta (`profileSection`), usunięty drugi przycisk zapisu.
  Żadne pole ani handler nie ruszone — karty tylko owinięte warunkiem.
- `components/dashboard/TodayScreen.tsx` — otwarta sekcja dostaje pasek
  z nazwą narzędzia i „Zwiń"; jedna szerokość z nagłówkiem panelu.

Nie dokończone / do sprawdzenia:
- Nadal NIC nie było oglądane w przeglądarce (tsc + 293 testy + build
  + 44 testy reguł przechodzą).
- Profil kursanta: sekcja „Poziom i AI" zawiera najdłuższe pola (prompty);
  warto sprawdzić, czy kolumna nawigacji nie jest przy niej za krótka.
- Kroki przewodnika lektora celują w kotwice na pulpicie; po wejściu
  w profil kursanta zostaną pominięte — zamierzone, ale wtedy przewodnik
  ma mniej kroków, niż mówi jego nazwa.

Decyzje architektoniczne:
- Połysk przejeżdżający był animacją samego kafelka, niezależną od
  kursora — przy sześciu kafelkach sześć ruchów naraz. Zostaje wyłącznie
  ruch mający przyczynę w kursorze.
- Profil: jedna sekcja naraz zamiast akordeonu — akordeon zostawiłby
  możliwość rozwinięcia wszystkiego i wrócilibyśmy do ściany.
- Kroki przewodnika bez celu są POMIJANE, a nie pokazywane bez
  reflektora: dymek nad pustym przyciemnieniem to był dokładnie ten
  zarzut, który miał zniknąć.

Ryzyka:
- `firestore.rules` NIETKNIĘTY (44/44).
- Zmiana w `CoachMarks` dotyczy też samouczka notatnika i prezentacji —
  oba używają tego samego komponentu.

---

2026-09-14 (runda 7) — Claude Code / Opus 5

Zadanie: notatnik jako osobna karta przeglądarki z wyglądem Google Docs
  i arkuszem A4, domyślna edycja przez kursanta, kolizja w prawym dolnym
  rogu, ustawienia modeli AI dla administratora, wykrywanie duplikatów
  w historii lekcji i numeracja od najstarszej.

Zrobione (commit na etap):
- `components/scratchpad/ScratchpadPage.tsx` (nowy) — trasa `/scratchpad`
  dla OBU ról; lektor dostaje edytor, reszta widok po linku/PIN-ie.
  `openScratchpadTab()` w `scratchpadService` jest jedynym wejściem.
  Warianty `overlay` i trasa w aplikacji USUNIĘTE.
- `TeacherScratchpadScreen` — wariant `standalone`, `documentId`,
  dopisywanie id do adresu po utworzeniu notatnika roboczego.
- `scratchpadService` — `allowStudentEdit: true` domyślnie.
- `ScratchpadEditor` + `index.css` — arkusz A4 (794 px, margines 76 px),
  obudowa bez ramy na własnej karcie, motyw całej strony za motywem kartki.
- `utils/lessonTemplate.ts` (nowy) + 6 testów — wpis „Lesson N — data"
  z numerem liczonym z nagłówków dokumentu.
- `index.css` — kolejka prawego dolnego rogu (`--rail-monitor`,
  `.rail-bug`, `.rail-notice`); monitor melduje własną wysokość.
- `utils/lessonDuplicates.ts` (nowy) + 10 testów;
  `components/admin/LessonDuplicatesPanel.tsx` (nowy);
  zapora w `createLessonRecordWithVocabularySet`.
- `services/aiModels.ts` — zadania AI, `cascadeForTask/Category`;
  `services/aiConfigService.ts` (nowy);
  `components/settings/AiModelsSettings.tsx` (nowy);
  `server.ts` — `/api/ai/config`, `/api/ai/save-key`, wczytanie kluczy
  z bazy przy starcie.

Nie dokończone / do sprawdzenia:
- NIC nie oglądane w przeglądarce. tsc + 316 testów + build + 44 testy
  reguł przechodzą.
- `/api/ai/*` nie były wołane na żywo — trzeba sprawdzić, czy
  `system/ai` daje się zapisać kontem administratora.
- Duplikaty: panel kasuje wpisy lekcji, ale NIE kasuje powiązanych
  `vocabularySets`. Zostają osierocone zestawy słownictwa — do decyzji,
  czy usuwać razem.
- Eksport do PDF/Worda nie wie o arkuszu A4 — łamanie stron w pliku nadal
  nie pokrywa się z kreskami na ekranie.
- Widok kursanta w notatniku (`PublicScratchpadScreen`) nie dostał
  arkusza A4 ani motywu strony — używa `ScratchpadEditor` bez
  `standalone`.

Decyzje architektoniczne:
- JEDEN adres notatnika dla lektora i kursanta; o widoku decyduje rola
  otwierającego, nie osobna ścieżka. Dzięki temu link z paska adresu jest
  tym samym linkiem, który idzie do kursanta.
- Numer lekcji liczony z NAGŁÓWKÓW dokumentu, nie z licznika w bazie —
  licznik byłby drugą prawdą i rozjechałby się po ręcznej poprawce.
- Duplikaty dzielone na pewne (temat + data) i podejrzane (temat + treść,
  inne daty); podejrzanych nie kasujemy hurtem, bo cykliczna powtórka
  tematu jest normalną lekcją.
- Wybór modeli wpięty przez kategorię zapytania, którą wszystkie
  wywołania i tak już podają — zero zmian w miejscach wywołań.
- Klucze API: zmienna środowiskowa ma pierwszeństwo nad zapisem
  w aplikacji; interfejs mówi, które źródło jest aktywne.

Ryzyka:
- `firestore.rules` NIETKNIĘTY (44/44). Nowy dokument `system/ai` jest
  czytany i zapisywany WYŁĄCZNIE przez Admin SDK na serwerze.
- `/api/ai/config` jest dostępne dla każdego zalogowanego (aplikacja musi
  znać wybór modeli) — zwraca modele i MASKI kluczy, nigdy pełne wartości.
- Zmiana domyślnej wartości `allowStudentEdit` dotyczy wyłącznie NOWYCH
  notatników; istniejące zostają z dotychczasowym ustawieniem.

---

2026-09-14 — Claude Code / Opus 5 (runda 8)

Zadanie: przebudowa nagłówka profilu kursanta i zakładki historii lekcji na
  symetryczny, „okienkowy" układ; schowanie rzadziej używanych funkcji
  (zwłaszcza Notion) w menu rozwijanych; jeden zestaw narzędzi na dodawanie
  lekcji; weryfikacja AI Lesson Summary i prompt systemowy dla transkrypcji;
  ukrycie panelu lektora po wejściu w profil kursanta; unifikacja układu
  wszystkich zakładek kursanta; poprawa trybu dziennego (konstelacja, kontrast
  tekstu, widoczność kafelków, czytelność okien dialogowych); spójna paleta
  ciemnego trybu notatnika.

Zrobione (siedem commitów, jeden na etap):
- `components/admin/StudentPanelSection.tsx` (nowy) — wspólna rama okna każdej
  zakładki kursanta: pasek tytułu z ikoną i licznikiem, narzędzia po prawej,
  pas filtrów, treść.
- `components/admin/StudentProfileHeader.tsx` (nowy) — nagłówek kursanta w dwóch
  piętrach; cztery równe kafelki metryk; przycisk „Panel lektora"; „Zmień
  kursanta" w menu.
- `AdminPanel.tsx` — panel lektora ukryty, gdy wybrany jest kursant; zakładki
  profil/historia/słownictwo/testy/statystyki przepisane na `StudentPanelSection`;
  menu „Lekcje" (`MenuDropdown`) zbiera wszystkie sposoby dołożenia lekcji
  i porządki; przełącznik rodzaju materiału w modalu AI; nowe pola formularza
  lekcji (praca domowa, klucz odpowiedzi); `handleTranscriptFileUpload`.
- `components/admin/LessonSourceBar.tsx` — zwinięty do jednej linijki, bez
  własnego przycisku Notion.
- `server.ts` — `transcriptInstruction` (osobne polecenie systemowe dla surowej
  transkrypcji), `mode` w `/api/gemini/lesson-summary`, schemat rozszerzony
  o `date`, `corrections`, `homeworkText`, `homeworkAnswerKey`, `nextLessonPlan`.
  Osobno: naprawa TDZ `FIRESTORE_DATABASE_ID`.
- `services/geminiService.ts` — `generateLessonSummary(..., mode)` + prompt
  zapasowy dla transkrypcji.
- `services/lessonRecord.ts` — zapis bloków 2b–4 wprost.
- `index.css`, `design/theme/tokens.css` — odwrócenie `--color-white`
  i `--color-black` w trybie dziennym, ciemniejsze tło strony, mocniejsze
  obrysy i cienie, kontrast `content-muted` i `text-faint`, konstelacja,
  ciemna kartka notatnika, reguła na przyciemnienie okien dialogowych.
- `utils/notebookPalette.ts` (nowy) — jedna paleta notatnika (sześć odcieni
  o tej samej jasności); czytają z niej `lessonTemplate`, przyciski koloru
  i zakreślacze.

Nie dokończone / do sprawdzenia:
- NIC ZA LOGOWANIEM nie było oglądane w przeglądarce. Sprawdzony wyłącznie ekran
  startowy w obu motywach (Playwright, build produkcyjny, zero błędów konsoli).
  Nowy nagłówek kursanta, rama zakładek, menu „Lekcje", modal AI Lesson Summary
  i ciemna kartka notatnika przeszły `tsc --noEmit`, 316 testów i `npm run build`,
  ale nikt ich nie widział w działaniu.
- Tryb transkrypcji AI Lesson Summary NIE był wołany na żywo — brak poświadczeń
  Firebase w tej sesji. Do sprawdzenia na prawdziwej transkrypcji: czy model
  wypełnia wszystkie bloki i czy praca domowa trzyma się materiału z lekcji.
- Port 3000 trzymał serwer deweloperski uruchomiony przez Macieja ponad dobę
  wcześniej — NIE był zabijany. Podgląd robiony na osobnym porcie (4179).
- Wpisy notatnika sprzed tej rundy zachowują stare, jaskrawe kolory nagłówków.
  Nikt ich nie przepisuje.

Decyzje architektoniczne:
- Tryb dzienny naprawiony JEDNĄ zmienną (`--color-white`, `--color-black`),
  a nie przejściem przez 94 pliki. Tailwind 4 liczy wszystkie klasy
  `*-white/X` i `*-black/X` przez `color-mix(… var(--color-*) X%, transparent)`,
  więc podmiana zmiennej odwraca całą rodzinę z zachowaniem proporcji
  dobranych w ponad tysiącu miejsc. Ręczny przegląd byłby tysiącem okazji do
  pomyłki i przeglądem, którego nikt by nie dokończył. Miejsca wymagające
  dosłownej bieli/czerni dostały wartość arbitralną (`bg-[#ffffff]`), bo ta
  nie przechodzi przez zmienną.
- Transkrypcja idzie jako JEDNA lekcja, a nie przez import zbiorczy. Droga
  zbiorcza szuka w materiale nagłówków kolejnych lekcji i przy zapisie rozmowy
  rozcinała jedne zajęcia na kilka wpisów tam, gdzie zmieniał się temat.
- Bloki 2b–4 zapisywane WPROST, zamiast doklejane do `thingsToImprove` pod
  znacznikiem „Zadanie domowe:" i rozcinane wyrażeniem regularnym. Parsowanie
  zostaje dla starych wpisów z Notion, gdzie nie ma wyboru; świadome
  zapisywanie danych w formacie do parsowania robiłoby nowy dług przy każdej
  lekcji z transkrypcji.
- Kolory notatnika w jednym pliku i o WSPÓLNEJ jasności względnej. Kolor idzie
  w treść dokumentu, więc motyw go nie przestawi — jedna wartość musi działać
  na jasnym papierze i na ciemnej kartce. Wspólna jasność robi z sześciu barw
  jeden zestaw: różnią się wyłącznie odcieniem, bo tylko odcień niesie
  znaczenie.
- Funkcje Notion wyłącznie w zakładce historii lekcji. Wcześniej ten sam
  przycisk stał w trzech miejscach, w tym nad zakładkami, których Notion
  nie dotyczy.

Ryzyka:
- `firestore.rules` NIETKNIĘTY. Middleware autoryzacji i ścieżki tokenowe bez
  logowania NIETKNIĘTE.
- `server.ts` zmieniony w dwóch miejscach: nowe polecenie systemowe i pole
  `mode` w `/api/gemini/lesson-summary` (trasa nadal za `requireFirebaseAdmin`,
  uprawnienia bez zmian) oraz przeniesienie deklaracji stałej wyżej w tym samym
  zasięgu. Żadna zmiana nie dotyka autoryzacji.
- Odwrócenie `--color-white`/`--color-black` działa na CAŁĄ aplikację w trybie
  dziennym. Sprawdzone na ekranie startowym; ekrany za logowaniem wymagają
  obejrzenia. Tryb nocny nie jest ruszony — reguły są pod `[data-theme="light"]`.

---

2026-09-14 — Claude Code / Opus 5 → Sonnet 5 (runda 9)

Zadanie: przebudować zakładkę Planera lekcji AI pod kątem lekkości i prostoty
  obudowy przy zachowaniu pełnej mocy narzędzia, zgodnie z wytycznymi skilla
  „🎯 Skill - Lesson Planner" pobranego z Notion (The Cribro Method) —
  trójkrokowy przepływ (ustalenia → propozycje tematu z pytaniem o liczbę
  wariantów → scenariusz z zaznaczaniem elementów do poprawki w czacie);
  czat ma działać agentowo jako narada do czterech modeli (GPT pisze, Gemini
  recenzuje domyślnie); panel administratora do wyboru składu narady i kluczy.

Zrobione (trzy commity):
- `services/lessonPlannerMethod.ts` (nowy) — odwzorowanie skilla z Notion:
  bramka Kroku 0 (`briefGate`), prompt systemowy metody (`CRIBRO_METHOD_SYSTEM`,
  Test naturalności pytań), trzy budowniczowie promptów: propozycje tematu
  (`buildTopicProposalPrompt`), pełny scenariusz (`buildScenarioPrompt`,
  twarde liczby: 5/10/5/4), poprawka zaznaczonych elementów
  (`buildRevisionPrompt`).
- `services/aiCouncil.ts` (nowy) — silnik narady: `runCouncil` w trzech
  turach (autor pisze → do trzech recenzentów zwraca max. 6 zastrzeżeń każdy
  → autor poprawia i ma prawo odrzucić błędne zastrzeżenie). Awaria
  recenzenta nie zabiera gotowej propozycji autora. `DEFAULT_COUNCIL`,
  `normalizeCouncil`, `MAX_COUNCIL_SEATS = 4`.
- `components/admin/LessonPlannerStudio.tsx` (nowy, 1087 linii) — zastępuje
  `LessonPlanner.tsx` w `AdminPanel.tsx`. Trzy kroki na osobnych ekranach
  (Ustalenia / Temat / Scenariusz), scenariusz jako sekcje i elementy
  z identyfikatorami nadawanymi przez model, zaznaczanie + czat poprawek,
  zwinięty pasek transkryptu narady na dole każdego kroku. Wczytywanie
  plików (`LessonFileUploader`, odzyskany ze starego planera) trafia
  materiał do promptu przed opisem słownym, zgodnie z kolejnością źródeł
  w skillu.
- `components/settings/AiCouncilSettings.tsx` (nowy) + `server.ts`
  (`/api/ai/config` POST/GET rozszerzone o `council`) +
  `services/aiConfigService.ts` (`saveAiCouncil`, `peekCouncil`) — skład
  narady w Ustawieniach Administratora, cztery miejsca, pierwsze zawsze
  autor, model z listy zatwierdzonych, licznik wywołań modelu.
- `AdminPanel.tsx` — dwie bazy (scenariuszy, tematów) schowane w jednym
  `MenuDropdown` zamiast dwóch przycisków nad narzędziem.
- Naprawa znaleziona PRZY PRZEGLĄDZIE WŁASNEGO KODU przed commitem:
  `generateLessonPlannerAI` (`services/geminiService.ts`) prosiła model
  o JSON wyłącznie zdaniem w promptcie — bez `response_format` dla OpenAI
  (`callOpenAI` wołane z `isJson: false`) i bez `responseMimeType` dla
  Gemini. Ta sama luka dotyczyła TRZECH istniejących wywołań w
  `services/presentationService.ts` (generator slajdów), nie tylko nowego
  kodu narady. Naprawa: opcjonalny parametr `jsonMode` (domyślnie `false`,
  zero zmiany zachowania dla wywołań tekstowych), włączony w naradzie
  (tylko tury autora — recenzja zostaje wolnym tekstem) i we wszystkich
  trzech wywołaniach w `presentationService.ts`.

Nie dokończone / do sprawdzenia:
- CAŁOŚĆ nieoglądana w przeglądarce i niewywołana na żywych kluczach API —
  brak dostępu do zalogowanej sesji i do skonfigurowanych kluczy w tej
  sesji agenta. Zweryfikowano wyłącznie `tsc --noEmit`, 316 testów,
  `npm run build`.
- `jsonMode: true` podnosi prawdopodobieństwo poprawnego JSON-a, nie
  gwarantuje go — `extractJSON` + `JSON.parse` wciąż jest jedyną linią
  obrony. Do sprawdzenia na żywym kluczu: czy narada (trzy-cztery wywołania
  pod rząd, każde parsujące JSON) rzeczywiście przechodzi bez błędów
  parsowania w praktyce, szczególnie na etapie poprawek (`buildRevisionPrompt`),
  gdzie model dostaje CAŁY scenariusz jako kontekst.
- Nie sprawdzone: czy `extractLessonBlocks` (użyte w `historyDigest` do
  zasilenia Revision Translation materiałem z ostatniej lekcji) radzi sobie
  poprawnie ze wszystkimi kształtami rekordów w bazie Macieja.
- `LessonPlanner.tsx` i pomocnicze komponenty (`LessonModulesConfig`,
  `ChooseScenarioModal`, `GeneratedScenariosSection`, `lessonPlannerPresets`
  — ten ostatni nadal używany przez `LessonScenarioAccordion.tsx`) zostają
  w repo nieużywane przez nowy planer. Nieusunięte świadomie — usunięcie
  plików to osobna decyzja.
- Pętla uczenia się na bazie Notion „Pytania wykorzystane na lekcjach" ze
  skilla NIE jest zaimplementowana — Recall nie odpytuje tej bazy. Model
  dostaje wprost informację, że tych danych nie ma.
- Zapis karty w Notion „Historia Lekcji" (Krok 3 skilla) świadomie pominięty
  w prompt — w Recall zapisuje `scenarioService`, model ma układać lekcję,
  nie decydować o zapisie do Notion.

Decyzje architektoniczne:
- Narada zamiast pojedynczego wywołania: pojedynczy model łamie twarde
  liczby i zakazy metody po cichu (pytanie brzmi mądrze, więc przechodzi
  mimo złamania Testu naturalności) i nie widzi własnych błędów, bo to
  jego tekst. Recenzent dostaje te same wytyczne i CUDZY tekst.
- Recenzent NIE pisze własnej wersji, tylko listę zastrzeżeń (max. 6) —
  recenzent piszący własną wersję zamieniałby naradę w dwóch niezależnych
  autorów zamiast w sprawdzenie jednej propozycji.
- Ostatnie słowo ma zawsze autor; zastrzeżenie recenzenta nie jest
  poleceniem i wolno je odrzucić.
- Poprawka zaznaczonych elementów wstawia WYŁĄCZNIE identyfikatory podane
  przez lektora — model bywa nadgorliwy i dorzuca poprawki do rzeczy, o
  które nikt nie prosił; filtrowane po stronie klienta w
  `LessonPlannerStudio`, nie ufając samoograniczeniu modelu.
- Cztery miejsca w naradzie to sufit, nie limit techniczny: przy trzech
  recenzentach uwagi zaczynają się powtarzać niemal w całości, a koszt
  (N+1 wywołań) rośnie liniowo bez dodatkowej jakości.
- `jsonMode` domyślnie wyłączony w `generateLessonPlannerAI`, żeby nie
  zmieniać zachowania istniejących wywołań na tekst swobodny (stary
  Planer, nieużywany, ale nieusunięty) — włączają go świadomie tylko
  wywołania, które faktycznie parsują JSON.

Ryzyka:
- `firestore.rules` NIETKNIĘTY. Middleware autoryzacji i ścieżki tokenowe
  bez logowania NIETKNIĘTE.
- `server.ts` zmieniony w `/api/ai/config` (GET i POST) — dodane pole
  `council`, ta sama walidacja `allowedModels`/`allowedTasks` co wcześniej,
  zapis nadal wyłącznie przez `requireFirebaseAdmin`. Żadna zmiana nie
  dotyka autoryzacji ani ścieżek tokenowych.
- Narada wykonuje do czterech wywołań modelu NA JEDNO działanie lektora
  (propozycja tematu, budowa scenariusza, każda poprawka) — koszt i czas
  rosną wprost proporcjonalnie do liczby aktywnych recenzentów. Domyślny
  skład (1 autor + 1 recenzent) trzyma to w ryzach; zmiana w ustawieniach
  na więcej recenzentów jest świadomą decyzją administratora, nie
  przypadkiem.

---

2026-09-15 — Antigravity / Gemini 2.5 Flash

Zadanie:
1. Baza Notion i grupy kursantów — widok tabelaryczny Notion pod kafelkami lektora oraz obsługa grup (pary, trójki, grupy firmowe 4+).
2. Rozbudowa Notatnika/Brudnopisu — format A4 (`.pad-page-break`), asystent AI w dokumencie (Gemini 2.5 Flash) z chipami akcji i 1-kliknięciowym wstawianiem, oraz Szybka Powtórka (Quick Recall) przy tworzeniu nowej lekcji (automatyczne wyciąganie 3 poprawek i 5 słówek z ostatniej lekcji).
3. Powiadomienia o sprawdzonej pracy domowej — mailing transakcyjny Resend + wyskakujący modal w aplikacji z polskim wołaczem (`toPolishVocative`).
4. Hierarchia modeli AI — `gemini-2.5-flash` jako nadrzędny model podstawowy we wszystkich zadaniach.
5. Wielosesyjny Asystent Nauczyciela z pamięcią czatu i skrótami do modułów.
6. Dopracowanie motywu Jasnego (świetliste kule zamiast ostrych linii konstelacji) i motyw Adaptacyjny (07:00–19:00).
7. Poszerzenie Narady Modeli i konfiguracji kluczy API o nowych dostawców: Anthropic Claude (`Claude 3.7 Sonnet`, `Claude 3.5 Sonnet`, `Claude 3.5 Haiku`) oraz DeepSeek (`DeepSeek V3`, `DeepSeek R1`), z backendowymi proxy `/api/anthropic` i `/api/deepseek`.

Zrobione:
- `components/admin/TeacherNotionDatabaseView.tsx` (nowy) — osadzony pod kafelkami panelu lektora widok bazy Notion z wyszukiwarką live, filtrami i szybkimi akcjami (notatnik, profil, planer).
- `components/admin/CreateGroupModal.tsx` (nowy) — modal tworzenia/edycji grup: pary (2), trójki (3), grupy firmowe (4+) z przypisaniem firmy, zleceniodawcy i powiązaniem uczniów.
- `types.ts` — dodano `isGroup`, `groupType`, `memberIds`, `contractor`, `company` w `User` oraz `studentIds?: string[]` w `LessonRecord`.
- `components/scratchpad/ScratchpadEditor.tsx` — asystent AI w dokumencie z chipami promptów, podglądem i wstawianiem do edytora; asynchroniczne pobieranie słówek i błędów z poprzedniej lekcji (`getLessonRecordsForStudent`) do sekcji `Revision / Warm-up`.
- `utils/lessonTemplate.ts` — podział stron A4 `.pad-page-break`.
- `server.ts` — endpoint `POST /api/homework/notify-graded` (Resend email + `hasGradedHomework: true` w Firestore), proxy `POST /api/anthropic` (`ANTHROPIC_API_KEY`) oraz `POST /api/deepseek` (`DEEPSEEK_API_KEY`).
- `services/homeworkEmail.ts` — szablon HTML `buildGradedHomeworkEmail` z wynikiem, komentarzem lektora i linkiem bezpośrednim.
- `components/dashboard/StudentHomeworkGradedModal.tsx` — modal powiadomienia na żywo z wołaczem polskiego imienia (`toPolishVocative`).
- `components/admin/TeacherAssistant.tsx` & `services/teacherAssistant.ts` — trwała pamięć czatu z kafelkami skrótów nawigacyjnych do modułów.
- `components/ui/ConstellationBackground.tsx` & `tokens.css` — zastąpienie linii konstelacji dryfującymi świetlistymi kulami gradientowymi w trybie jasnym; pastelowy błękit dzienny (`#f3f8fd` ➔ `#e6effa` ➔ `#dbe7f5`).
- `context/ThemeContext.tsx` — tryb `adaptive` (07:00–19:00 jasny, noc ciemny).
- `services/aiModels.ts` & `services/aiConfigService.ts` — `gemini-2.5-flash` jako primary; dodanie modeli Anthropic Claude, DeepSeek, OpenAI o3-mini i Gemini 2.5 Pro do `SELECTABLE_MODELS` i `PROVIDER_META`.
- `components/settings/AiCouncilSettings.tsx` & `components/settings/AiModelsSettings.tsx` — grupowanie modeli per dostawca (`optgroup`), plakietki dostawców i dedykowane pola kluczy API dla Anthropic i DeepSeek.
- `services/geminiService.ts` — funkcje `callAnthropic` i `callDeepSeek` wpięte do narady modeli, planera lekcji i uniwersalnych kaskad AI; aktualizacja `formatAIModelName`.
- `tests/aiModels.test.ts`, `tests/aiTaskModels.test.ts` — zaktualizowane i rozszerzone testy kaskad i modeli (320 testów zaliczonych).
- `CHANGELOG.md` — uaktualniony o szczegółowy rejestr rundy 10.

Decyzje architektoniczne:
- Uniwersalne proxy w `server.ts` dla Anthropic i DeepSeek z zachowaniem bezpieczeństwa: klucze API nigdy nie trafiają do przeglądarki, autoryzacja przez Firebase Bearer token.
- Wszystkie 4 stanowiska w Radzie Modeli (`AiCouncil`) mogą być dowolnie obsadzane modelami od różnych dostawców (Gemini, OpenAI, Anthropic, DeepSeek).
- Zastosowanie formatowania A4 w notatniku z fizycznymi przerwami stron (`.pad-page-break`) dla estetyki zbliżonej do Google Docs.

Ryzyka i weryfikacja:
- `firestore.rules` nietknięte.
- Bezpieczeństwo kluczy API zachowane (maskowanie serwerowe, brak ekspozycji po stronie klienta).
- Zweryfikowano: `npx tsc --noEmit` (0 błędów), `npm test` (320/320 pass, 100%), `npm run build` (czysty build produkcyjny).

---

2026-09-16 — Antigravity / Gemini 2.5 Flash

Zadanie:
1. Unifikacja modułu Kursanci i Grupy w „Profile kursantów” (CRM): przeniesienie eleganckiego widoku bazy danych Notion z ekranu głównego do bazy CRM z pełnym zestawem narzędzi (tworzenie kursantów z generatorami haseł, tworzenie grup/par `CreateGroupModal`, synchronizacja Notion, akcje masowe na zaznaczonych kontach).
2. Nowy widok „Historia Lekcji” na ekranie głównym panelu lektora w stylu Notion: poziome zakładki kursantów/grup na górze, wyszukiwarka live i filtry statusu, tabela z 4 blokami Notion, błyskawiczny slide-over drawer do podglądu 4 bloków z odsłuchem TTS i kopiowaniem oraz bezpośrednie skróty do Notatnika, Pracy domowej, Prezentacji i Profilu.

Zrobione:
- `components/admin/TeacherLessonHistoryView.tsx` (nowy plik) — dedykowany widok historii lekcji w stylu Notion z poziomymi zakładkami wszystkich kursantów/grup, filtrami statusu (*Wszystkie*, *Odbyte*, *Weryfikacja*), tabelą 4 bloków oraz wysuwanym modalem/drawerem szczegółów 4 bloków (Words & Phrases z audio TTS, Corrections & Pronunciation, Homework z kluczem odpowiedzi, Next Lesson Plan) i skrótami 1-klik.
- `components/admin/StandaloneStudentDatabaseScreen.tsx` — zunifikowany panel CRM łączący widok tabeli Notion z filtrami kontraktorów (*Wszyscy*, *Aktywni*, *Indywidualni*, *Grupy & Pary*, *JCL*, *Inspiro*, *Axell*, *Direct*), wyszukiwarką, multi-selectem i paskiem akcji masowych (zmiana poziomu, kontraktora, statusu, usuwanie) oraz modalami: dodawanie kursanta z generatorem haseł, tworzenie grup/par (`CreateGroupModal`), wysyłka zaproszeń e-mail (`StudentInviteEmailModal`) i synchronizacja Notion (`NotionSyncButton`).
- `components/admin/AdminPanel.tsx` — zastąpienie tabeli kursantów na głównym ekranie komponentem `TeacherLessonHistoryView`, dodanie agregacji lekcji `allTeacherLessons` i `fetchAllLessons`, przekierowanie kafelka „Profil kursantów” do zunifikowanego CRM.
- `services/lessonRecord.ts` — funkcja `getAllLessonRecordsForTeacher` agregująca, deduplikująca i sortująca lekcje ze wszystkich podkolekcji kursantów.
- `CHANGELOG.md` & `AGENT_LOG.md` — uzupełnienie dokumentacji projektu o rejestr rundy 11.

Decyzje architektoniczne:
- Ekran główny lektora stawia teraz w centrum bieżący strumień lekcji i 4 bloki dydaktyczne, dając lektorowi natychmiastowy dostęp do historii spotkań, notatnika live i zadawania prac domowych.
- Pełne zarządzanie kontami, uprawnieniami, grupami i profilami zostało zintegrowane w dedykowanym module „Profile kursantów” (CRM), eliminując redundancję i podwójne listy.

Weryfikacja i stan:
- `npx tsc --noEmit` — 0 błędów typowania TypeScript.
- `npm test` — 320/320 testów jednostkowych zaliczonych (100%).
- `npm run build` — poprawna kompilacja bundle frontend + service worker + backend.

---

2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 15)

Zadanie:
1. Neonowe, wyraziste podświetlenie aktywnego kafelka w panelu lektora (`AdminPanel.tsx`): ring neonowy, radialny gradient, animowany wskaźnik i etykieta „AKTYWNY MODUŁ”.
2. Odczytywanie i multimodalna analiza załączników w Asystencie AI (`TeacherAssistant.tsx`, `teacherAssistant.ts`): obsługa plików PDF, obrazów i screenshotów (`.png`, `.jpg`, `.jpeg`, `.webp`), dokumentów Markdown (`.md`), HTML (`.html`) oraz plików tekstowych (`.txt`).
3. Przepływ akcji Notion AI w Asystencie AI (`TeacherAssistant.tsx`, `teacherAssistant.ts`, `AdminPanel.tsx`, `Dashboard.tsx`): generowanie propozycji lekcji `lesson_json`, karta Notion AI z podsumowaniem i 1-klikowe przyciski akcji: Utwórz lekcję w Dzienniku, Dopracuj w Planerze lekcji, Uruchom w Prezentacji Live, Zadaj jako Pracę domową, Otwórz Notatnik.
4. Rozszerzenie notatnika (`ScratchpadEditor.tsx`): dodawanie załączników w asystencie edytora, wstawianie wygenerowanych treści według szablonu lub na końcu dokumentu.
5. Usprawnienia internacjonalizacji i wielojęzyczności (`LanguageContext.tsx`, `StudentHeroHeader.tsx`, `TodayScreen.tsx`).

Zrobione:
- `components/admin/AdminPanel.tsx`: neonowe poświaty dla kafelków Tier 1/2/3, obsługa akcji z asystenta (`onCreateLessonRecord`, `onOpenInPresentation`), obsługa `initialLessonDraft`.
- `components/admin/TeacherAssistant.tsx`: obsługa załączników (przycisk spinacza, przeciąganie drag&drop, wklejanie ze schowka Ctrl+V/Cmd+V), karty propozycji lekcji Notion AI i przyciski akcji.
- `services/teacherAssistant.ts`: multimodalne wywołanie Gemini 2.5 Flash dla załączników PDF i grafik, parsowanie bloku `lesson_json`, wzbogacony prompt systemowy.
- `components/dashboard/Dashboard.tsx`: mostkowanie akcji asystenta AI do Dziennika lekcji i Prezentacji live (`adminLessonDraft`).
- `components/scratchpad/ScratchpadEditor.tsx`: obsługa załączników w czacie asystenta notatnika, przyciski „Wstaw wg szablonu” i „Dopisz na końcu”.
- `context/LanguageContext.tsx`: dodanie pomocnika `tText(pl, en)`.
- `components/dashboard/StudentHeroHeader.tsx` & `TodayScreen.tsx`: wdrożenie `tText` dla pełnej dwujęzyczności panelu ucznia.

Decyzje architektoniczne:
- Zachowanie bezpieczeństwa: brak kluczy API po stronie klienta, bezpośrednie multimodalne przekazywanie `inlineData` do Gemini 2.5 Flash na backendzie / autoryzowanym kliencie.
- Pełna symetria i zgodność w obu trybach asystenta: centralny na pulpicie lektora oraz pływający dymek w lewym dolnym rogu.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 320/320 zdanych testów (100%).
- `npm run build` — poprawna kompilacja całego pakietu.

---

2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 16)

Zadanie:
1. Notatnik: domyślny format strony A4 bez względu na położenie (`width: 794px`, `min-height: 1123px`, margines 76px, responsywne skalowanie).
2. Dynamiczne, sekcyjne podziały stron A4: po zapełnieniu strony A4 danej lekcji treść płynnie przechodzi na kolejną podstronę bez naruszania kolejnych lekcji; kolejna lekcja zawsze zaczyna się od nowej strony A4 z nagłówkiem na samej górze.
3. Przycisk i menu „Podział strony A4”: wstawianie czystej strony A4 między lekcjami lub w miejscu kursora.
4. Zawsze nagłówek lekcji na górze (`margin-top: 0 !important`, brak zbędnych pustych linii).
5. Naprawa działania lokalnego serwera deweloperskiego (przełączenie na port 3001 w celu uniknięcia kolizji z procesem whatsapp-bridge na 3000 + wdrożenie SPA routingu Express 5).

Zrobione:
- `index.css`: formatowanie A4, `.pad-page-break`, reguły `margin-top: 0 !important` dla nagłówków po podziale strony, responsywność i tryb druku.
- `components/scratchpad/ScratchpadEditor.tsx`: algorytm pomiaru stron `measurePages` z `PageMarker`, przycisk „Podział strony A4” w menu i na pasku narzędzi, funkcja `handleInsertPageBreak`, poprawione wstawianie szablonów lekcji.
- `server.ts` & `.env`: ustawienie `PORT=3001`, naprawa routingu HTML SPA w trybie dev dla Express 5.
- `CHANGELOG.md` & `AGENT_LOG.md`: dokumentacja zmian.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów typowania.
- `npm test` — 320/320 testów jednostkowych zaliczonych (100%).
- `npm run build` — poprawny build produkcyjny.
- Serwer działa stabilnie na `http://localhost:3001`.

---

2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 17)

Zadanie:
1. Poprawa wizualna czatu Asystenta Lektora (`TeacherAssistant.tsx`), aby był spójny z motywem CRIBRO, ale wyraźnie odróżniał się jako nowoczesny, konwersacyjny chat stream (Copilot), a nie statyczny generator.
2. Stworzenie nowego, eleganckiego i uniwersalnego komponentu ikony/awatara asystenta AI (`AIAssistantIcon.tsx`) i wdrożenie go w całej aplikacji.

Zrobione:
- `components/ui/AIAssistantIcon.tsx` (nowy plik):
  - Autorski glif wektorowy łączący motywy marki CRIBRO (geometryczne łuki, centralna gwiazda inteligencji, orbitalne pierścienie, synaptyczne węzły, gradient szmaragdowo-miętowy `#72F0B4` ➔ `#38E196` ➔ `#0D8A5F` oraz neonowy glow).
  - Obsługa wariantów (`avatar`, `badge` ze statusem online, `icon`, `floating`), stanów (`idle`, `thinking`, `online`) oraz dynamicznego skalowania rozmiaru.
- `components/admin/TeacherAssistant.tsx`:
  - Pełna metamorfoza czatu na nowoczesne środowisko konwersacyjne (Copilot).
  - Szklany nagłówek z nowym awatarem, live statusem i przyciskami zarządzania sesjami.
  - Nowy ekran powitalny (Copilot Hub) z siatką tematycznych kart propozycji (Kursanci, Planowanie, Zadania domowe, Powtórka, Multimodalne AI, Postępy).
  - Czytelny timeline wiadomości: wyróżnione dymki lektora (prawostronne ze szmaragdowym szkłem) i asystenta (lewostronne z awatarem AI, kartami Notion AI i 1-klikowymi akcjami).
  - Płynny stan generowania `thinking` z animowanym awatarem AI i potrójnym wskaźnikiem pulsu.
  - Nowy kompozytor z obsługą wielowierszowego tekstu (`Enter` wyślij, `Shift+Enter` nowa linia), wklejaniem schowka i załącznikami.
  - Spójny lifting pływającego dymka czatu w lewym dolnym rogu.
- `components/scratchpad/ScratchpadEditor.tsx`:
  - Wdrożenie nowego `AIAssistantIcon` w nagłówku, ekranie powitalnym i wiadomościach wbudowanego asystenta notatnika.
- `components/admin/LessonPlanner.tsx` & `TeacherSpecialTaskModal.tsx`:
  - Zastąpienie generycznych ikon `Bot` nowym komponentem `AIAssistantIcon`.
- `CHANGELOG.md` & `AGENT_LOG.md`:
  - Aktualizacja dokumentacji zmian.

2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 18)

Zadanie:
1. Dopasowanie szerokości asystenta do głównych kafelków (`max-w-5xl`) oraz obniżenie jego wysokości o ~30% w trybie osadzonym.
2. Zastosowanie spójnego tła szklano-kafelkowego (`liquid-glass-tile`) nawiązującego do kafelków kursantów.
3. Skalowanie w dół kart podpowiedzi/promptów.
4. Całkowite wyczyszczenie danych i tokenów Notion (przerwanie połączenia, reset bazy) w celu umożliwienia wklejenia nowego tokena i ID baz.
5. Implementacja wyszukiwarki i automatycznego wykrywania baz Notion (Auto-discovery) na podstawie tokena po dodaniu integracji do stron w Notion.

Zrobione:
- `components/admin/AdminPanel.tsx` & `components/admin/TeacherAssistant.tsx`:
  - Rozszerzono kontener asystenta do `max-w-5xl mx-auto w-full`, uzyskując idealną spójność krawędzi z siatką kafelków głównych.
  - Zastosowano tło kafelkowe `liquid-glass-tile` z subtelną szmaragdową poświatą neonową.
  - Zredukowano wysokość panelu o ~30% (kompaktowy nagłówek, zmniejszona wysokość okna wiadomości `min-h-[140px] max-h-[280px]`, kompaktowy kompozytor wiadomości).
  - Skalowano w dół karty promptów początkowych (`p-2.5`, mniejsze ikony, mniejsza typografia).
- `server.ts`:
  - Usunięto stare zahardcodowane domyślne identyfikatory baz Notion.
  - Dodano endpoint `POST /api/notion/clear-config` do pełnego resetu zmiennych środowiskowych i dokumentu Firestore `system/notion`.
  - Dodano endpoint `POST /api/notion/search-databases` odpytujący Notion API `/v1/search` pod kątem baz danych udostępnionych integracji.
- `components/settings/SettingsScreen.tsx`:
  - Wyzerowano domyślne identyfikatory baz w polach formularza.
  - Dodano przycisk „Rozłącz i wyczyść Notion” z potwierdzeniem `window.confirm` i bezpiecznym czyszczeniem stanu.
  - Dodano sekcję „Automatyczne wykrywanie baz w Notion (Auto-Discovery)” z przyciskiem wyszukiwania oraz siatką kart wykrytych baz danych z 1-klikowym przypisaniem bazy spotkań i bazy kursantów.
2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 19)

Zadanie:
1. Wdrożenie architektury Liquid Glass dla kafelków w całej aplikacji: połysk szkła, efekt głębi (depth effect) i nowoczesna animacja hover z refleksami świetlnymi (sheen sweep).
2. Płynne animacje i przejścia GSAP w całej aplikacji (moduły, motyw dzienny/nocny, kropelkowe przejścia pytań).

Zrobione:
- `index.css`:
  - Utworzenie klas `.liquid-glass-tile`, `.glass-tile` oraz `.liquid-glass-card`.
  - Wdrożenie wielowarstwowego załamania optycznego, `backdrop-filter: blur(16px) saturate(140%)`.
  - Specular hairline highlight (`::after`) oraz ruchomy promień połysku tafli szkła (`::before` pod kątem `-24deg`).
- `services/gsapAnimations.ts`:
  - Dodanie biblioteki animacji: `animateDropletTransition`, `animateTilePop`, `animateThemeTransition`, `animateModalPresence`.
- `context/FlashcardContext.tsx`:
  - Podpięcie `recordExerciseResults` dla sesji fiszek i dopasowania (matching) w celu ciągłego budowania profilu krzywej uczenia.
- Weryfikacja: `npm test` 320/320 testów pass, `npm run build` pass.

---

2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 20)

Zadanie:
1. Zmiana nazwy „Prawdziwe Wyzwanie” na „Sprawdź Się” z drobną czcionką wyjaśniającą, że są to tłumaczenia pełnych zdań.
2. Dodanie opcjonalnego trybu rozgrzewki klockowej (Warm-up Scrambler) przed rozpoczęciem tłumaczeń/zadań (wzorowany na pracach domowych).
3. Dodanie ćwiczenia „Napraw Zdanie” opartego o silnik `generateFindErrors` z prac domowych.
4. Łącznie 4 ćwiczenia do praktyki dodatkowej: Tłumaczenie zdań („Sprawdź Się”), Korekta zdań („Napraw Zdanie”), Fiszki oraz Dopasowanie w przejrzystym gridzie 2x2 Liquid Glass.
5. Zapisywanie każdego ćwiczenia do historii sesji (`practiceLogs`) oraz budowanie krzywej uczenia (`recordExerciseResults`).
6. Nowoczesne, przyjemne dla oka animacje Drops bez przebodźcowania (ADHD-friendly).

Zrobione:
- `components/dashboard/AIExerciseGeneratorScreen.tsx`:
  - Przeprojektowanie sekcji formatów na elegancką siatkę 2x2 z kaflami Liquid Glass i wskaźnikami:
    1. **Sprawdź Się** (`typing`): badge `Tłumaczenia`, opis tłumaczenia z pamięci, tag `🧩 Tryb rozgrzewki`.
    2. **Napraw Zdanie** (`correction`): badge `Korekta`, opis wykrywania i poprawiania błędów, tag `🎯 Zadanie z pracy domowej`.
    3. **Fiszki** (`flashcards`): badge `Nauka`.
    4. **Dopasowanie** (`match`): badge `Gra`.
  - Wdrożenie ekranu zaproszenia do rozgrzewki (`warmupPhase === 'invite'`) z opcjami `[🚀 Zacznij od rozgrzewki (Zalecane)]` oraz `[⚡ Przejdź od razu do zdań]`.
  - Integracja `HomeworkWarmupScrambler` dla rozgrzewki klockowej.
  - Wdrożenie generowania `generateFindErrors` dla ćwiczenia „Napraw Zdanie”, z podaniem kontekstu i briefingów z krzywej uczenia.
  - Wdrożenie interfejsu zadania „Napraw Zdanie”: bursztynowy kafelek z wyeksponowanym zdaniem z błędem, polskie znaczenie, wskazówka lektora i przycisk `Kopiuj zdanie do edycji`.
  - Natychmiastowa ewaluacja czystego dopasowania (100% bez zbędnego czekania) oraz inteligentny prompt AI dla odpowiedzi alternatywnych.
  - Zapis do `practiceLogs` z `sentence_correction` / `find_errors` oraz wywołanie `recordExerciseResults(..., 'find_errors')`.
  - Dodanie animacji kropelkowej `animateDropletTransition` przy przejściach między zdaniami.
- `components/dashboard/HomeworkWarmupScrambler.tsx`:
  - Rozszerzenie `extractWarmupItems` o bezpośrednią obsługę `item.englishTranslation`.
- `context/FlashcardContext.tsx`:
  - Zapewnienie wywoływania `recordExerciseResults` po ukończeniu powtórki fiszek i gry matching.

Weryfikacja:
- `npm test` — 320/320 testów zaliczonych pomyślnie.
- `npm run build` — produkcyjny build Vite, Service Worker i server/serverless zakończony kodem 0.

---

2026-09-16 — Antigravity / Gemini 3.7 Flash (runda 21)

Zadanie:
1. Usunięcie animowanego efektu połysku (sheen sweep) na wszystkich kafelkach w całej aplikacji.
2. Stworzenie statycznego efektu Liquid Glass o wyraźnej głębi 3D, aby kafelki wyglądały na fizyczne przyciski zrobione ze szkła.
3. Poprawa okna czatu na głównej stronie nauczyciela (`TeacherAssistant.tsx` w `AdminPanel.tsx`), aby wszystko mieściło się w jednym oknie bez konieczności przewijania (scrolla) wewnątrz czatu.

Zrobione:
- `index.css`:
  - Usunięcie animacji `sheen-sweep` oraz pseudo-elementu `::before` z kątem `-24deg` dla kafelków (`.liquid-glass-tile`, `.glass-tile`).
  - Przebudowa `.liquid-glass-tile`, `.glass-tile` oraz `.liquid-glass-card` na statyczny styl szklanego przycisku 3D:
    - Optyczny gradient szkła `linear-gradient(180deg, ...)`,
    - Wewnętrzne ścięcia krawędzi (inner bevel: ostra krawędź górna `inset 0 1px 1px`, miękkie rozświetlenie časzy `inset 0 2px 5px`, wewnętrzny cień dolny `inset 0 -2px 4px`),
    - Wielowarstwowy cień kontaktowy i ambientowy (`0 1px 2px`, `0 6px 15px`, `0 16px 34px`),
    - Statyczny refleks soczewki (`::after` z eliptycznym rozmyciem),
    - Fizyczny efekt wciśnięcia przycisku ze szkła przy kliknięciu (`:active` -> `translateY(2px)`, kompresja cieni),
    - Subtelny hover lift o `2.5px` z pogłębieniem cienia bez przesuwających się pasów światła.
- `components/admin/TeacherAssistant.tsx`:
  - Usunięcie sztywnego ograniczenia `max-h-[280px]` w stanie początkowym czatu, które powodowało wewnętrzny scrollbar tuż po otwarciu strony lektora.
  - Wprowadzenie kompaktowego, horyzontalnego nagłówka powitalnego oraz odświeżonego układu 3x2 kafelków promptów startowych o wysokości ~50px.
  - Całe okno czatu (nagłówek, propozycje, kompozytor wiadomości) mieści się w jednym zwartym kadrze bez scrolla.
  - W widoku aktywnej rozmowy okno wiadomości płynnie korzysta z `max-h-[580px]`, gwarantując czytelność dłuższych odpowiedzi AI i propozycji Notion.

Weryfikacja:
- `npm test` — 320/320 testów zaliczonych pomyślnie.
- `npm run build` — kod 0, poprawnie zbudowano bundle produkcyjny i skrypty serwera.

---

2026-09-17 — Antigravity / Gemini (runda 22)

Zadanie:
1. Przebudowa Planera Lekcji AI (`LessonPlannerStudio.tsx`):
   - Wyszukiwalny wybór kursanta / grupy z bazy `users` z automatycznym zaczytywaniem poziomu CEFR z profilu kursanta (`brief.level = user.level`).
   - Układ scenariusza w 6 rozwijanych blokach akordeonowych ze zrzutu ekranu (Warm-up, Grammar Review, Main Topic z podsekcjami Topic & Material, Lead-in, Thought-Provoking Questions i Teacher's Notes, Language Focus, Practice Enclosure, Wrap-up & Homework).
   - W pełni edytowalne elementy (inline edycja tekstu i Teacher's Notes, dodawanie, usuwanie, zmiana kolejności góra/dół).
   - Sugerowana praca domowa jako konkretny obszar do przećwiczenia z 1-klikowym przejściem do tworzenia pracy domowej ze zdań (`TeacherSpecialTaskModal`).
2. Podział wejścia do Planera Lekcji na 2 opcje:
   - 📝 Nowy scenariusz lekcji (Planer AI).
   - 📺 Nowa prezentacja & slajdy (Centrum Prezentacji & Slajdów AI jak w notatniku).
3. Integracja Prezentacji z profilem kursanta:
   - Generator slajdów AI, gotowe wzorce, szybki wklejacz i własny slajd/audio.
   - Sekcja „Przypisane Prezentacje kursanta” (`getSavedPresentationsList(studentId)`), automatycznie widoczne w notatniku ucznia (`sp_<uid>`).

Zrobione:
- `services/lessonPlannerMethod.ts`:
  - Doprecyzowanie `buildScenarioPrompt` z 6 blokami, w tym sekcją Wrap-up & Homework z sugerowanym obszarem do przećwiczenia.
  - Dodanie helperów `extractHomeworkTask` oraz `extractVocabularyList`.
- `components/admin/LessonPlannerStudio.tsx`:
  - Wdrożenie inteligentnego selektora kursanta z bazy `users` z wyszukiwarką, awatarami i auto-wypełnianiem poziomu CEFR z profilu ucznia.
  - Dwu-opcyjne menu główne: *Nowy scenariusz lekcji* vs *Nowa prezentacja & slajdy*.
  - Rozwijana architektura 6 bloków akordeonowych z pełną edycją, Budką Suflera z 1-klikowym kopiowaniem, ćwiczeniami live z transmisją do scratchpada ucznia oraz przyciskiem *„📝 Stwórz pracę domową ze zdań”*.
  - Centrum Prezentacji & Slajdów AI zintegrowane z notatnikiem (`updateScratchpadPresentation`), generatorem slajdów AI i listą przypisanych prezentacji kursanta (`getSavedPresentationsList`).
- `components/admin/AdminPanel.tsx`:
  - Podłączenie callbacku `onCreateHomework` z otwarciem `TeacherSpecialTaskModal` z przekazaniem wygenerowanego słownictwa i tematu.
- `tests/lessonPlannerStudio.test.ts`:
  - Pakiet testów jednostkowych dla nowych funkcji planera i ekstrakcji zadań.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów typowania.
- `npm test` — 354/354 testów zaliczonych pomyślnie.
- `npm run build` — kod 0, poprawnie zbudowano bundle produkcyjny.






---

2026-09-18 — Claude Code / Sonnet 5

Zadanie: Krytyczna naprawa regresji w synchronizacji notatnika lekcyjnego —
lektor widział status "Zsynchronizowano", ale kursant nie otrzymywał treści
na żywo. Regresja wprowadzona tego samego dnia w trzech commitach
(7217fa9, 96aa789, 4848657) podczas prób naprawy loadera.

Analiza (git diff 45a808c..HEAD):
- `TeacherScratchpadScreen.tsx` i `StudentScratchpadScreen.tsx` dostały
  "twardy timeout bezpieczeństwa" (`setTimeout(() => setIsLoading(false), 2500)`)
  jako osobny `useEffect`, niezależny od faktycznego zakończenia ładowania
  dokumentu.
- Gdy ten timeout odpalał się PRZED zakończeniem `getOrCreateStudentScratchpad`
  (wolna sieć / zimny start Firestore), `isLoading` przechodził na `false`,
  mimo że `scratchpadDoc` był wciąż `null`.
- Ekran lektora w tym stanie renderował edytor na podstawie NIEPAMIĘTANEGO
  (`safeScratchpad`, zwykły `const`, nie `useMemo`) obiektu zastępczego,
  którego `id` dla notatnika roboczego liczyło się jako `` `sp_${Date.now()}` ``
  — NA NOWO PRZY KAŻDYM RENDERZE. Każdy zapis (`handleSaveContent`) trafiał
  więc pod inny, efemeryczny identyfikator dokumentu, nigdy pod stały
  `sp_<uid>`, którego słucha ekran kursanta (`StudentScratchpadScreen`).
  Stąd zapisy "udawały się" (status Zsynchronizowano — bo Firestore
  przyjmował zapis pod dowolnym ID przez `setDoc`/`updateDoc` fallback),
  a kursant nigdy nie widział zmian, bo jego `onSnapshot` nasłuchiwał
  cały czas na `sp_<uid>`.
- Dodatkowo `handleAssignStudent` przełączał `scratchpadDoc.id` OPTYMISTYCZNIE
  (przed zakończeniem `adoptScratchpadForStudent`), co pogłębiało rozjazd ID
  przy przypisywaniu kursanta w trakcie lekcji.

Zrobione (przywrócono stabilny mechanizm sprzed regresji, zachowano tylko
udane poprawki stylu/layoutu z dzisiejszych commitów):
- `components/scratchpad/TeacherScratchpadScreen.tsx`:
  - Usunięcie twardego timeoutu 2.5s (zbędny — `try/finally` w efekcie
    inicjalizującym już gwarantuje zwolnienie `isLoading`).
  - Usunięcie `safeScratchpad` (fallback z `sp_${Date.now()}` liczonym co
    render) — edytor renderuje się TYLKO gdy `scratchpadDoc` jest realnie
    załadowany (`scratchpadDoc ? <Editor/> : null`), tak jak przed regresją.
  - `handleAssignStudent` wraca do wersji synchronicznej: czeka na
    `adoptScratchpadForStudent`, dopiero potem przełącza `scratchpadDoc`
    lokalnie — bez optymistycznego przeskoku ID.
  - `handleSaveContent`/`handleToggleStudentEdit`/`handleToggleRequirePin`
    znów czytają `scratchpadDoc.id` bezpośrednio (bez fallbacku).
  - Zachowano poprawki CSS z dzisiejszych commitów (`min-h-screen`,
    `min-h-[600px]` na kontenerach wariantów) — czysto kosmetyczne, bez
    wpływu na dane.
  - Dodano log diagnostyczny `[SYNC-TEACHER-WRITE]` przy każdym zapisie.
- `components/scratchpad/StudentScratchpadScreen.tsx`:
  - Usunięcie tego samego twardego timeoutu 2.5s.
  - Dodano log diagnostyczny `[SYNC-STUDENT-READ]` przy każdej aktualizacji
    z `onSnapshot`.
- `components/scratchpad/PublicScratchpadScreen.tsx`:
  - Usunięcie analogicznego twardego timeoutu 2.5s (ten plik już miał
    poprawny `try/finally`, timeout był tu czystym duplikatem ryzyka).
- `components/scratchpad/ScratchpadEditor.tsx`:
  - Cofnięcie propa `document` z `ScratchpadDocument | null | undefined`
    z wewnętrznym fallbackiem `id: 'default'` z powrotem do wymaganego
    `document: ScratchpadDocument` — fallback z ID `'default'` był kolejnym
    potencjalnym źródłem współdzielonego/kolizyjnego dokumentu między
    sesjami. Wszyscy trzej wywołujący (`Teacher`/`Student`/`PublicScratchpadScreen`)
    już renderują edytor dopiero po realnym załadowaniu dokumentu.
  - Zachowano dzisiejszą poprawkę stylu kontenera (`h-full w-full min-h-0
    ... bg-base-100` na `.pad-shell`).

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów typowania.
- `npm test` — 359/359 testów zaliczonych pomyślnie.
- `npm run build` — kod 0, poprawnie zbudowano bundle produkcyjny i serwer.
- Diagnostyka w konsoli: dodane logi `[SYNC-TEACHER-WRITE]` i
  `[SYNC-STUDENT-READ]` — do zweryfikowania ręcznie przez Macieja w dwóch
  oknach przeglądarki (ten sam `docId`, rosnący `length` po obu stronach).

Nie dokończone / do sprawdzenia:
- Nie testowano wzrokowo w przeglądarce (brak środowiska z dwoma sesjami
  auth w tym uruchomieniu) — Maciej powinien zweryfikować scenariusz
  "assign kursanta w trakcie pisania" ręcznie przed uznaniem za zamknięte.

Decyzje architektoniczne:
- Uznałem twardy timeout 2.5s za redukujący realne ryzyko (loader wiszący
  w nieskończoność) za cenę wprowadzenia poważniejszego ryzyka (rozjazd ID
  dokumentu) — usunąłem go całkowicie zamiast naprawiać, bo `try/finally`
  z commitu 7217fa9 już rozwiązuje pierwotny problem (wiszący loader) bez
  tego efektu ubocznego. To nie jest nowa architektura — to przywrócenie
  stanu z 45a808c plus zachowanie tej jednej, poprawnej części dzisiejszej
  poprawki (try/finally).

Ryzyka: Zmiany dotyczą wyłącznie logiki komponentów notatnika (nie
`firestore.rules`, nie middleware autoryzacji, nie ścieżek tokenowych bez
logowania) — poza zakresem sekcji 3 CLAUDE.md, nie wymagały wstrzymania.

---

2026-09-18 — Claude Code / Sonnet 5 (kontynuacja tej samej sesji)

Zadanie: Twardy timeout 3s na inicjalizację `TeacherScratchpadScreen.tsx`
(żeby ekran lektora nigdy nie wisiał w nieskończoność na wolnym Firestore)
+ weryfikacja, z którą bazą Firestore łączy się klient.

Zrobione:
- `components/scratchpad/TeacherScratchpadScreen.tsx`:
  - Pobranie dokumentu (`getScratchpadById`/`getOrCreateStudentScratchpad`)
    owinięte w `Promise.race` z timeoutem 3000ms.
  - Przy timeoucie LUB `err.code === 'resource-exhausted'`: lektor dostaje
    w pełni sprawny edytor na STAŁYM, jednorazowo ustawionym przez
    `setScratchpadDoc` ID `sp_teacher_<uid>` (nie liczonym na nowo przy
    każdym renderze — to była dokładnie ta regresja, którą naprawiono
    wcześniej dziś z `sp_${Date.now()}`). Oznaczone przez istniejące pole
    `cloudBlockedReason`, które odpala już istniejący żółty baner w
    `ScratchpadEditor.tsx` ("Ten notatnik nie zapisał się w chmurze —
    kursant go nie zobaczy"). Inne błędy nadal pokazują ekran błędu jak
    dotychczas.
- `firebase.ts`: dodano `console.log('[FIRESTORE-DB-NAME]', ...)` po
  `initializeFirestore` do weryfikacji aktywnej bazy.

Decyzje architektoniczne:
- NIE zmieniono ID bazy Firestore. Zlecenie wskazywało
  `ai-studio-103bf60d-6134-4dcf-97f6-1080bc759669`, ale w całym stosie
  (`firebase.ts`, `server.ts`, `functions/src/config.ts`, `firebase.json`,
  `package.json`) konsekwentnie zaszyte jest
  `ai-studio-520a4841-33d0-41ef-829a-838ebc44072d`. To dwa różne ID, nie
  literówka — przełączenie na złe ID urwałoby dostęp do danych w całej
  aplikacji (klient/serwer/functions łączyłyby się z pustą, prawdopodobnie
  bez wdrożonych `firestore.rules`, bazą). Zapytałem Macieja wprost —
  potwierdził zostawienie obecnego ID i weryfikację przez nowy log.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 359/359.
- `npm run build` — kod 0.

Ryzyka: Zmiany nie dotykają `firestore.rules` ani middleware autoryzacji.
Dotyczą wyłącznie klienta (frontend), poza obszarem wysokiego ryzyka z
sekcji 3 CLAUDE.md.

---

2026-09-18 — Claude Code / Sonnet 5 (kontynuacja tej samej sesji, runda 3)

Zadanie: Usunięcie fałszywego alarmu timeoutu inicjalizacji notatnika
lektora — baner „Ten notatnik nie zapisał się w chmurze" wisiał na stałe
mimo że Firestore realnie przyjmował zapisy i dostarczał aktualizacje
(`[SCRATCHPAD SAVE]` / `[SCRATCHPAD LISTEN]` w konsoli), co sprawiało
wrażenie zablokowanego przypisywania kursanta.

Zrobione — `components/scratchpad/TeacherScratchpadScreen.tsx`:
- Timeout `Promise.race` na inicjalizację: 3000ms → 6000ms (zimny start
  Firebase nie wywołuje już fałszywego trybu awaryjnego).
- Dodano `clearCloudSyncWarning()` — czyści `error` oraz `cloudBlockedReason`
  na dokumencie, wywoływane przy KAŻDYM realnym dowodzie łączności: pierwszym
  callbacku z `onSnapshot` w subskrypcji na żywo oraz po potwierdzonym
  zapisie w chmurze (`handleSaveContent`, gdy `res.cloud !== false`). Baner
  znika automatycznie, gdy połączenie wraca — nie czeka na przeładowanie
  ekranu.
- `handleAssignStudent`: błąd przypisania nie trafia już do stanu `error`
  (który przełącza CAŁY ekran na widok „Zamknij") — nowy, osobny stan
  `assignError` pokazuje się jako mały czerwony tekst przy pasku „Przypisz
  kursanta", nie wyrzucając lektora z działającego edytora. Wywołanie
  `clearCloudSyncWarning()` na starcie przypisania usuwa stary/przeterminowany
  stan błędu, zanim zacznie się próba.
- Potwierdzono (bez zmiany kodu): `adoptScratchpadForStudent` już poprawnie
  przepina dokument na `sp_<studentUid>` i nagłówek edytora („Notatnik
  roboczy" → imię kursanta) — czyta to wprost z `scratchpadDoc.studentName`/
  `title`, więc samo przepięcie stanu w `setScratchpadDoc(adopted)`
  wystarcza.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 359/359.
- `npm run build` — kod 0.

Ryzyka: Brak — zmiany dotyczą wyłącznie logiki UI notatnika lektora, poza
obszarem wysokiego ryzyka z sekcji 3 CLAUDE.md.

---

2026-09-18 — Claude Code / Sonnet 5 (kontynuacja tej samej sesji, runda 4)

Zadanie: Dynamiczne dodawanie lekcji A4 + spis treści + asystent AI z
inteligentnym wstawianiem do sekcji w notatniku.

Ustalenie stanu wyjściowego (przed pisaniem czegokolwiek): większość
zamówionej mechaniki JUŻ ISTNIAŁA w `ScratchpadEditor.tsx` i
`utils/lessonTemplate.ts` — `buildLessonTemplate`/`highestLessonNumber`
(numeracja "Lesson N — data" ze skanu nagłówków), `handleInsertLesson`
(przycisk dodania lekcji z podziałem A4 i 5 sekcjami: Revision, Main topic
/ Practice, Lesson Summary, Key Language & Corrections (New words),
Homework), `rebuildToc` (spis treści z H1/H2, scrollIntoView smooth) oraz
czat AI z przyciskami wstawiania (`handleInsertAsStructuredLesson`,
podgląd/edycja w `ScratchpadInsertPreviewModal`). Żaden szablon lekcji NIE
jest wstrzykiwany automatycznie przy montowaniu — `getInitialScratchpadContent`
odpala się tylko RAZ, przy tworzeniu zupełnie nowego dokumentu kursanta w
`getOrCreateStudentScratchpad`, nigdy przy zwykłym otwarciu istniejącego
notatnika. Nie było więc czego wyłączać w punkcie 1 zlecenia.

Zrobione (domknięcie realnych braków względem zlecenia):
- `components/scratchpad/ScratchpadEditor.tsx`:
  - Przycisk „Nowa lekcja” dostał widoczną etykietę „+ Nowa lekcja” (był
    tylko ikoną z tooltipem).
  - System prompt czatu AI dostał listę aktywnych nagłówków H1/H2/H3
    bieżącego dokumentu oraz instrukcję trzech znaczników-badge
    (`badge-error`/`badge-success`/`badge-vocab`) do oznaczania błędów,
    poprawnych form i słówek w sekcji Key Language & Corrections.
  - Nowa funkcja `handleInsertIntoSection(sectionTitle, text)`: znajduje
    nagłówek H3 wybranej sekcji (Revision / Key Language / Lesson Summary /
    Homework) w obrębie OSTATNIEJ lekcji (od ostatniego H2) i dopisuje tam
    treść z AI, zamiast tworzyć nową lekcję. Fallback do dopisania na końcu
    dokumentu, jeśli żadna lekcja jeszcze nie istnieje.
  - Cztery nowe przyciski pod odpowiedzią asystenta: Revision / Key Language
    / Summary / Homework — obok istniejących „Wstaw wg szablonu” (cała nowa
    lekcja), „Dopisz na końcu”, „Wstaw w miejscu kursora”.
- `index.css`: klasy `.badge-error`, `.badge-success`, `.badge-vocab` —
  te same kolory co istniejące ręczne zakreślacze (❌ Błąd / ✅ Poprawnie /
  💡 Słówko), żeby treść wstawiona przez AI wyglądała identycznie do
  ręcznie zaznaczonej.

Decyzje architektoniczne:
- Nie tworzyłem nowej architektury czatu AI ani nowego systemu wstawiania —
  rozszerzyłem istniejący `handleSendAiChat`/system prompt i istniejący
  zestaw przycisków pod wiadomością asystenta, zgodnie z CLAUDE.md
  („nie wprowadzaj kolejnego mechanizmu bez potrzeby”).
- Sekcja docelowa w `handleInsertIntoSection` jest dopasowywana po
  częściowym dopasowaniu tekstu nagłówka (np. „Key Language” pasuje do
  „Key Language & Corrections (New words)”) — odporne na drobne różnice
  w tytule sekcji między lekcjami.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 359/359.
- `npm run build` — kod 0.

Nie dokończone / do sprawdzenia: Nie testowano wzrokowo w przeglądarce
(kliknięcie „+ Nowa lekcja” i wstawianie do sekcji z czatu AI) — do
potwierdzenia przez Macieja.

Ryzyka: Brak — zmiany dotyczą wyłącznie UI/logiki notatnika, poza obszarem
wysokiego ryzyka z sekcji 3 CLAUDE.md.

---

2026-09-18 — Claude Code / Sonnet 5

Zadanie: (1) Zastąpienie mechanizmu powtórki (Revision) przy „+ Nowa
lekcja” — dotąd ciągniętego z rekordów lekcji w Notion — generatorem AI
opartym o treść OSTATNIEJ lekcji w samym dokumencie notatnika. (2)
Rozgraniczenie uprawnień lektor/kursant w pasku narzędzi Notatnika:
ukrycie „+ Nowa lekcja”, uploadu zdjęć i Czatu AI przed kursantem.

Zrobione:
- `utils/lessonTemplate.ts`: nowa funkcja `extractLastLessonSections(html)`
  (regexowy split po `<h2>`/`<h3>`, bez zależności od DOM — testowalna w
  Node) — wycina tekst sekcji „Main topic / Practice” i „Key Language &
  Corrections” z ostatniej lekcji w dokumencie, `null` gdy dokument nie ma
  jeszcze żadnej lekcji. `buildLessonTemplate` dostał opcję `revisionHtml`
  (wygrywa z dotychczasowym `recallItems`).
- `services/scratchpadAiService.ts` (nowy plik): `generateLessonRevision`
  — wysyła wyciągniętą treść do `generateTextWithUnifiedFallback`
  (kaskada Gemini Flash) z promptem metodycznym zwracającym gotowy HTML
  (3 błędy z badge-error/badge-success, 6 słówek EN/PL, 5 zdań PL→EN).
- `components/scratchpad/ScratchpadEditor.tsx`:
  - `handleInsertLesson`: usunięto zapytanie do `getLessonRecordsForStudent`
    (Notion) w tym miejscu (funkcja nadal używana gdzie indziej w pliku —
    import został). Zamiast tego skanuje `editorRef.current.innerHTML`
    przez `extractLastLessonSections`, woła `generateLessonRevision`, a
    błąd generowania jest łapany i loguje `console.warn` bez blokowania
    wstawienia lekcji (Revision zostaje wtedy pusta).
  - Przyciski „+ Nowa lekcja” (pozycja w menu „Wstaw” i osobny przycisk-
    skrót) oraz „Wstaw zdjęcie z dysku” owinięte w `isTeacher &&` —
    wcześniej wisiały tylko na `!isReadOnly`, więc kursant z
    `docData.allowStudentEdit === true` widział te same narzędzia co
    lektor. Czat AI był już wcześniej gated `isTeacher` — zweryfikowano,
    bez zmian.
- `tests/lessonTemplate.test.ts`: 3 nowe testy — `revisionHtml` wygrywa z
  `recallItems`, `extractLastLessonSections` daje `null` bez lekcji w
  dokumencie, i wycina sekcje z OSTATNIEJ lekcji (nie wcześniejszej).
- `CHANGELOG.md`: nowa sekcja N. z opisem obu zmian.

Nie dokończone / do sprawdzenia:
- Nie testowano wzrokowo w przeglądarce — ani jakości wygenerowanej
  treści Revision (prompt nie był jeszcze uruchomiony na żywym Gemini),
  ani wizualnego ukrycia przycisków na koncie kursanta. Do potwierdzenia
  przez Macieja.
- Interpretacja zlecenia „+ Nowa lekcja / + Dodaj stronę”: przyjąłem, że
  to dwie nazwy TEJ SAMEJ funkcji (dodanie lekcji = podział strony A4 +
  szablon), więc osobny przycisk „Podział strony A4” (ogólny, bez numeru
  lekcji) NIE został ukryty przed kursantem — może się przydać do
  zwykłego strukturyzowania notatek. Do weryfikacji z Maciejem, czy to
  słuszna interpretacja.
- Poprzedni mechanizm powtórki z Notion (`getLessonRecordsForStudent`) w
  `handleInsertLesson` został całkowicie zastąpiony, nie zachowany jako
  fallback — zgodnie z literalnym zleceniem („przeskanuj DOKUMENT”), ale
  to zmiana zachowania względem tego, co działało wcześniej.

Decyzje architektoniczne:
- `extractLastLessonSections` napisana na regexach (nie `DOMParser`), żeby
  działała identycznie w przeglądarce i w testach Node (`tsx --test`, bez
  jsdom) — ten sam wzorzec co istniejące `highestLessonNumber`.
- AI zwraca od razu gotowy HTML z klasami `badge-error`/`badge-success`
  (te same zakreślacze co przy ręcznym oznaczaniu), nie markdown do
  parsowania — mniej miejsc, w których treść może się rozjechać.

Ryzyka: Brak zmian w `firestore.rules` ani middleware autoryzacji —
ukrycie przycisków jest kontrolą na poziomie UI (`isTeacher` z
`currentUser?.role`), nie nowym zabezpieczeniem serwerowym. Kursant z
edytowalnym dostępem do notatnika (`allowStudentEdit`) nadal może
technicznie wstawić dowolny HTML przez inne ścieżki (np. wklejenie) —
to nie jest nowa dziura, tylko niezmieniony istniejący zakres uprawnień
edycji treści.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 362/362 (359 + 3 nowe).
- `npm run build` — kod 0 (istniejące ostrzeżenia o rozmiarze chunków,
  niezwiązane z tą zmianą).

---

2026-09-18 — Claude Code / Sonnet 5

Zadanie: Naprawa pustej sekcji Revision przy „+ Nowa lekcja” (opisane w
poprzednim wpisie jako znane ryzyko/dług — teraz naprawione).

Zrobione:
- `utils/lessonTemplate.ts`: `extractLastLessonSections` zwraca teraz też
  `fallbackText` — surowy tekst CAŁEJ ostatniej lekcji (wszystkie sekcje),
  nie tylko „Main topic / Practice” i „Key Language & Corrections”.
- `components/scratchpad/ScratchpadEditor.tsx` (`handleInsertLesson`):
  - Gdy `mainTopic`/`keyLanguage` są puste (lektor nie wypełnił ich jeszcze
    w poprzedniej lekcji — najczęstszy przypadek zgłoszonego buga), używa
    `fallbackText` jako materiału dla `generateLessonRevision`, zamiast
    pomijać wywołanie AI i zostawiać pusty szablon.
  - Nowa strona A4 wstawia się teraz OD RAZU (bez czekania na Gemini) z
    placeholderem „⏳ Generuję powtórkę na podstawie poprzedniej
    lekcji...” (`data-revision-pending="<token>"`); po odpowiedzi AI
    placeholder jest podmieniany w miejscu, bez re-insertowania całej
    strony. Błąd AI podmienia placeholder na neutralny tekst do ręcznego
    wypełnienia (nie zostaje „⏳” na stałe).
  - Dodano `console.log('[REVISION_DEBUG] ...')` (numer szukanej lekcji,
    pobrany tekst poprzedniej lekcji) i `console.error('[REVISION_API_ERROR]',
    err)` przy błędzie Gemini — do diagnostyki w konsoli przeglądarki.
- `tests/lessonTemplate.test.ts`: nowy test na `fallbackText` z pustymi
  `mainTopic`/`keyLanguage`.
- `CHANGELOG.md`: sekcja O. z opisem przyczyny i naprawy.

Nie dokończone / do sprawdzenia:
- Nie testowano wzrokowo w przeglądarce (brak dostępu do żywego Gemini w
  tej sesji) — sam mechanizm placeholdera i podmiany w miejscu przeszedł
  tylko `tsc`/testy/`build`. Maciej: sprawdź w devtools log
  `[REVISION_DEBUG]` przy kliknięciu „+ Nowa lekcja” na dokumencie z
  jedną, jeszcze niewypełnioną lekcją — to był dokładny scenariusz buga.
- `fallbackText` to tekst WSZYSTKICH sekcji ostatniej lekcji (łącznie z
  ewentualnie już wpisanym Homework czy Lesson Summary) — może być
  szumniejszy niż docelowe „Main topic + Key Language”, ale to świadomy
  kompromis: lepiej dać AI więcej kontekstu niż nic.

Decyzje architektoniczne:
- Placeholder podmieniany przez `outerHTML` po `data-revision-pending`
  (unikalny token z timestampem), nie przez ponowne wywołanie
  `buildLessonTemplate` — unika duplikowania strony/nagłówków, jeśli
  lektor zdążył coś kliknąć/wpisać w międzyczasie gdzie indziej w
  dokumencie.

Ryzyka: Brak zmian w `firestore.rules`, autoryzacji czy ścieżkach
tokenowych.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 363/363 (362 + 1 nowy).
- `npm run build` — kod 0.

---

2026-09-18 — Claude Code / Sonnet 5

Zadanie: Przebudowa fizyki animacji i czytelności "Koła Fortuny"
(warm-up spinner) w module prezentacji + ręczna edycja puli pytań przez
lektora.

Zrobione:
- `services/gsapAnimations.ts`: nowy `cubicBezierEase(x1,y1,x2,y2)` —
  rozwiązuje krzywą Beziera metodą Newtona (polyfill jak w przeglądarkach),
  bo darmowy GSAP nie ma `CustomEase` (to płatny plugin Club GreenSock).
- `components/presentation/WheelOfFortune.tsx`:
  - Obrót koła: `ease: cubicBezierEase(0.15, 0.9, 0.2, 1.0)` zamiast
    `power3.out`, czas 4.5s (lokalnie) / 4.0s (zdalna sync kursanta),
    min. 5 pełnych obrotów (1800°) zamiast 4.
  - Wycinki koła: tekst zawsze biały + `textShadow` (niezależnie od
    koloru wycinka/motywu), pokazują skróconą treść pytania
    (`truncateForWheel`, 20 znaków + „…") zamiast samego numeru `#n`;
    pełna treść w `<title>` (tooltip) i karcie wyniku.
  - Karta wyniku: font pytania podniesiony do min. `text-xl` (1.25rem)
    również poza fullscreenem.
  - Nowy przycisk „Edytuj pytania" (tylko dla lektora) + panel z
    `<textarea>` (jedno pytanie na wiersz) i przyciskiem „Zapisz pulę" —
    buduje nową listę `WheelQuestionItem[]` z `category: 'custom'`.
- `CHANGELOG.md`: nowa sekcja „runda 34" z pełnym opisem.

Nie dokończone / do sprawdzenia:
- Nie zweryfikowano wzrokowo w przeglądarce (brak prostej ścieżki
  logowania lektor→prezentacja z kołem fortuny w tej sesji, tylko
  `tsc`/testy/`build`). Maciej: sprawdź obrót (4.5s, wyraźne zwolnienie
  na końcu, min. 5 pełnych obrotów), czytelność tekstu na wycinkach i w
  karcie wyniku w trybie jasnym i ciemnym, oraz panel „Edytuj pytania".
- Pula pytań z `services/wheelQuestionService.ts` (scenariusz/historia
  lekcji/AI) nie była zmieniana — zadanie dotyczyło wyłącznie animacji,
  czytelności i ręcznej edycji w UI.

Decyzje architektoniczne:
- Krzywa easingu zaimplementowana jako czysta funkcja JS (Newton-Raphson)
  zamiast próby użycia `CustomEase` z GSAP — unikamy zależności od
  płatnego pluginu, a wynik matematycznie odpowiada podanej krzywej CSS
  `cubic-bezier(0.15, 0.9, 0.2, 1.0)`.
- Ręczna edycja puli pytań nadpisuje całą aktywną listę (nie scala z
  istniejącą) — prostsze UX „jedno pytanie na wiersz" zgodne z opisem
  zadania („w 5 sekund dopisać/usunąć"), zamiast osobnego CRUD na
  pojedynczych pozycjach.

Ryzyka: Brak zmian w `firestore.rules`, autoryzacji czy ścieżkach
tokenowych bez logowania.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 363/363 (bez zmian w testowanej logice serwisowej).
- `npm run build` — kod 0.

---

2026-09-18 — Claude Code / Sonnet 5

Zadanie: Pilna naprawa błędu produkcyjnego kursantki dorotakj@student.vocabboost.com
na trasie "/": `TypeError: Cannot read properties of undefined (reading 'word')`.

Zrobione:
- Zlokalizowano źródło: `context/VocabularyContext.tsx` ładował `words` wprost
  z Firestore bez walidacji — dokument w trakcie synchronizacji lub bez pola
  `word` trafiał do tablicy, którą `QuizExercise`/`FillInBlankExercise` indeksują
  po pozycji (`shuffledWords[currentIndex]`). Żywa aktualizacja `onSnapshot`
  kurcząca tablicę w trakcie sesji ćwiczenia dawała `undefined` i wywalała
  całą aplikację (łapał to dopiero globalny `GlobalErrorBoundary`, czyszcząc
  cały widok „/").
- `context/VocabularyContext.tsx`: twarde filtrowanie w `onSnapshot` dla
  `users/{uid}/words` — `.filter(item => item && typeof item.word === 'string'
  && item.word.trim().length > 0)`, żeby wadliwe rekordy nigdy nie trafiały do
  konsumentów (naprawia też `PracticeZone`, `MatchExercise`, `WordList` itd.
  pośrednio, bo wszystkie czerpią z tego samego `words`).
- `components/practice/QuizExercise.tsx`: guard `currentWord` w `useEffect`
  budującym opcje i w `handleAnswer`; dodano wczesny `return` z komunikatem
  „lista słówek się zmieniła" zamiast crasha, gdy `currentWord` jest chwilowo
  `undefined`.
- `components/practice/FillInBlankExercise.tsx`: guard `!currentWord` w
  `handleSubmit` (render już miał `if (!currentWord) return null`).
- `FlashcardExercise.tsx` i `MatchExercise.tsx` sprawdzone — już poprawnie
  zabezpieczone, bez zmian.

Nie dokończone / do sprawdzenia:
- Nie odtworzono błędu 1:1 na koncie dorotakj (brak dostępu do jej danych
  produkcyjnych w tej sesji) — naprawa wynika z analizy kodu i dokładnego
  dopasowania sygnatury błędu, nie z powtórzenia crasha lokalnie.
- Pozostałe odwołania `.word` w kodzie (np. `FlashcardContext.tsx`,
  `StudentLessonHistory.tsx`, `WordCard.tsx`) są już zagnieżdżone w warunkach
  (`if (item.word)`, `.filter(item => item.word)`) lub operują na obiektach,
  które nie mogą być `undefined` w danym kontekście — celowo NIE dotknięte,
  żeby nie rozmyć commitu; jeśli błąd wróci z innym stack trace, zacząć tam.

Decyzje architektoniczne:
- Filtrowanie zrobione raz, u źródła danych (`VocabularyContext`), zamiast
  w każdym z ~10 miejsc renderujących `.word` — mniejsza powierzchnia zmian,
  ten sam efekt dla wszystkich konsumentów tej tablicy.

Ryzyka: Brak zmian w `firestore.rules`, autoryzacji czy ścieżkach
tokenowych bez logowania.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 363/363 zielone.
- `npm run build` — kod 0, nowy hash bundla: `index-D7iVkZT_.js`
  (poprzednio `index-f-64mY-j.js`).

---

2026-09-18 — Claude Code / Sonnet 5

Zadanie: Naprawa kontrastu tekstu w trybie ciemnym oraz stabilizacja
animacji obrotu Koła Fortuny (4 zgłoszone problemy widoku, kontynuacja
rundy 34 z tej samej sesji).

Zrobione (`components/presentation/WheelOfFortune.tsx`):
1. Tekst wylosowanego pytania w karcie wyniku: kolor wymuszony inline
   `style` (`color: isDark ? '#ffffff' : '#0f172a'`, `fontSize: 1.2rem`
   poza fullscreenem, `fontWeight: 500`, `lineHeight: 1.5`) — wcześniej
   klasa `text-white`/`text-slate-900` z `isDark` ternary była
   teoretycznie poprawna, ale nic nie chroniło przed nadpisaniem przez
   styl potomny/globalny; inline styl wygrywa zawsze.
2. Przyciski paska górnego ("Nowe pytania AI", "Edytuj pytania",
   "Pokaż pytania", "Start (60s)"/"Pauza", "Resetuj stoper", "Anuluj")
   były wygaszone w trybie ciemnym: korzystały z wariantów `ghost`/
   `secondary` współdzielonego `components/ui/Button.tsx`, którego
   własne klasy koloru tekstu (`variantStyles`) kolidują z `className`
   przekazywanym z zewnątrz — Tailwind NIE gwarantuje, że klasa później
   w JSX wygrywa w wygenerowanym CSS, więc wygaszony domyślny kolor
   wariantu czasem wygrywał. Zamieniono na zwykłe `<button>` z
   samodzielnymi klasami (`text-slate-200 hover:text-white
   border-slate-700 bg-slate-800/60` w ciemnym motywie) — NIE dotknięto
   samego `Button.tsx` (zmiana tam uderzyłaby we wszystkie ekrany apki).
3. "Skakanie" koła podczas obrotu: CSS `transform-origin` na `<g>` SVG
   bywa przeliczany na nowo z bounding boxa klatka po klatce w części
   przeglądarek. Zamieniono na `svgOrigin: '200 200'` GSAP (właściwy,
   udokumentowany sposób GSAP na stabilną oś obrotu SVG) w
   `gsap.set` (reduced motion) i `gsap.to` (animacja). Krzywa zwalniania
   zaktualizowana na `cubic-bezier(0.12, 0.8, 0.2, 1.0)` zgodnie z nową
   specyfikacją (poprzednio 0.15/0.9/0.2/1.0 z poprzedniego zadania w
   tej samej sesji).
4. Etykiety na wycinkach: zamiast skróconego pytania (20 znaków, które
   nachodziło na sąsiednie wycinki) — krótka etykieta kategorii
   (`q.sourceTag`, max 14 znaków, fallback „Pytanie {n}"). Pełna treść
   pytania: wyłącznie w karcie wyniku po zatrzymaniu koła.

Nie dokończone / do sprawdzenia:
- Nie zweryfikowano wzrokowo w przeglądarce w tej sesji (ta sama
  przeszkoda co w rundzie 34 — brak prostej ścieżki logowania
  lektor→prezentacja z kołem fortuny). Maciej: sprawdź obrót (brak
  bocznego "skakania"), czytelność karty wyniku i przycisków paska w
  trybie ciemnym, oraz że etykiety na wycinkach się nie nakładają.

Decyzje architektoniczne:
- Naprawiono kontrast przycisków przez zamianę na zwykłe `<button>`
  zamiast edycji `components/ui/Button.tsx` — root cause (kolizja
  kolejności klas Tailwind) dotyczy potencjalnie każdego miejsca w
  apce, gdzie wariant `Button` jest nadpisywany przez `className`, ale
  naprawa samego `Button.tsx` to osobna, szersza zmiana wymagająca
  przeglądu wszystkich wywołań — poza zakresem tego zadania.

Ryzyka: Brak zmian w `firestore.rules`, autoryzacji czy ścieżkach
tokenowych bez logowania.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 363/363 zielone.
- `npm run build` — kod 0.

2026-09-19 — Claude Code / Sonnet 5

Zadanie: Koło Fortuny — 6 stałych kategorii wyzwań na tarczy zamiast surowych
notatek + "Accent Pulse" zamiast konfetti. Notatnik — kalibracja wskaźnika
laserowego (8px rdzeń / 18px halo), widoczność lasera u lektora (nie tylko
kursanta), skrót klawiszowy Alt+H dla żółtego zakreślacza.

Zrobione:
- `services/wheelQuestionService.ts`: nowy typ `ChallengeCategoryId`, stała
  `CHALLENGE_CATEGORIES` (Collocation, Fix Error, 60s Pitch, Fill Gap,
  Translation, Upgrade C1), `assignChallengeCategory` (hash id → kategoria,
  deterministyczne) i `withChallengeCategories` — dopięte do wszystkich
  trzech ścieżek generowania puli pytań (scenariusz, historia lekcji, AI).
- `components/presentation/WheelOfFortune.tsx`: tarcza renderuje teraz
  zawsze 6 wycinków `CHALLENGE_CATEGORIES` (ikona Lucide + nazwa, przez
  `foreignObject` w SVG) zamiast liczby wycinków = liczbie pytań. Losowanie
  wybiera najpierw pytanie z puli (jak wcześniej — priorytet nieomówionym),
  koło ląduje na wycinku jego `challengeCategory`; `finishSpin` dobiera
  ostateczną treść z puli pasującą do wylosowanej kategorii. Usunięto
  `canvas-confetti` (tylko z tego komponentu — nadal używane w
  `HomeworkWarmupScrambler`/`QuizExercise`/`FlashcardExercise`/
  `MatchExercise`/`FillInBlankExercise`, nie ruszone). Karta wyniku
  pokazuje teraz też plakietkę wylosowanej kategorii z ikoną.
- `services/gsapAnimations.ts`: nowe `animateAccentPulse` (błysk
  scale 1→1.4, opacity 0.6→0, 600ms) i `animateGlowReveal` (box-shadow
  ramki karty wyniku, emerald/amber wg źródła pytań).
- `index.css`: `.pad-laser` (lokalny wskaźnik lektora) i `.pad-laser-dot`
  (zdalny, widziany przez kursanta) ujednolicone na rdzeń 8px `#EF4444`
  pełne krycie + halo 18px (`radial-gradient` + `box-shadow: 0 0 10px
  rgba(239,68,68,0.6)`), zamiast dawnego różowo-czerwonego gradientu.
  `.pad-laser` był zdefiniowany od dawna, ale nigdy nieużywany w JSX —
  dokładnie ta luka, którą wypełnia ten wpis.
- `components/scratchpad/ScratchpadEditor.tsx`: dodano `localLaserRef` +
  `createPortal(<div className="pad-laser" />, document.body)` renderowany
  gdy `isLaserOn && isTeacher`; `handleLaserMouseMove` aktualizuje jego
  `transform: translate3d(...)` natychmiast (bez throttlingu 50ms, który
  zostaje tylko dla zapisu do Firestore) — to samo (x, y) jest źródłem dla
  obu, więc widok lektora i kursanta są zsynchronizowane. Dodano
  `onKeyDown` na edytowalnej kartce: `Alt+H` (`e.code === 'KeyH'`, działa
  identycznie na Macu z Option) woła istniejące `handleHighlight('#fef3c7',
  '#92400e')` — ten sam żółty zakreślacz „Słówko” co przycisk w toolbarze.

Nie dokończone / do sprawdzenia:
- Nie zweryfikowano wzrokowo w przeglądarce (brak w tej sesji prostej
  ścieżki logowania lektor→prezentacja+notatnik na żywo). Maciej: sprawdź
  (1) że 6 wycinków z ikonami czyta się dobrze w obu motywach i nie
  nachodzi tekst na sąsiednie wycinki, (2) Accent Pulse przy zatrzymaniu
  koła (subtelny błysk, nie migotanie), (3) glow ramki karty wyniku,
  (4) mały czerwony punkt lasera pod kursorem lektora (osobno od tego,
  co widzi kursant) i że nie blokuje kliknięć w tekst, (5) Alt+H na
  zaznaczeniu tekstu w notatniku (i Option+H na Macu, jeśli macie taki
  sprzęt pod ręką).

Decyzje architektoniczne:
- Przypisanie kategorii wyzwania do pytania jest deterministyczne (hash
  id), nie losowe przy każdym renderze — to samo pytanie zawsze ląduje w
  tej samej kategorii w obrębie sesji, więc powtórne losowanie tego
  samego pytania (np. po odświeżeniu) nie przesuwa go na inny wycinek.
- Gdy w wylosowanej kategorii nie ma żadnego nieomówionego pytania,
  `finishSpin` spada najpierw na dowolne pytanie z tej kategorii
  (nawet omówione), a dopiero potem na całą pulę — koło zawsze "trafia"
  wizualnie w kategorię, karta wyniku prawie zawsze pokazuje treść z niej.
- Lokalny wskaźnik lasera u lektora renderowany portalem na `document.body`
  (poza `#root`), zgodnie z istniejącym komentarzem CSS przy `.pad-laser` —
  ta klasa czekała nieużywana dokładnie na to zastosowanie.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji czy
ścieżkach tokenowych bez logowania (`homework/direct/:token`, PIN
notatnika) — `updateScratchpadLaser`/`docData.laserPointer` używane bez
zmian kontraktu danych.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 363/363 zielone.

## 2026-09-19 — Claude Code / Sonnet 5

Zadanie: Zlecenie opisywało reset konfiguracji Notion w stylu aplikacji
Electron (electron-store, sqlite/pouchdb, userData) po migracji na nowy
workspace „Maciej's space" — audyt i wyczyszczenie starych powiązań.

Zrobione:
- Audyt: Cribro nie jest aplikacją Electron — nie ma electron-store, sqlite
  ani pouchdb. Konfiguracja Notion żyje w Firestore (`system/notion`,
  odczyt/zapis w `server.ts` `getNotionConfig`/`/api/notion/save-config`),
  z fallbackiem na `process.env`/`.env`.
- Ustalono, że pełny mechanizm rozłączenia już istnieje i działa poprawnie:
  `POST /api/notion/clear-config` (`server.ts:2404`) zeruje `process.env`,
  dokument Firestore `system/notion` i `.env`; `handleClearNotionConfig`
  (`components/settings/SettingsScreen.tsx:372`) resetuje cały stan UI do
  `configured: false` bez ryzyka „Cannot read properties of undefined".
  Maciej może po prostu kliknąć „Rozłącz" w Ustawieniach — nic nie trzeba
  było tam zmieniać.
- Znaleziono realną lukę: `functions/src/config.ts` miał zahardkodowane
  stare ID baz Notion (`NOTION_LESSONS_DB`, `NOTION_STUDENTS_DB`) używane
  przez `checkNotionDaily` (funkcja zaplanowana), niezależnie od
  Firestore/UI. Na wyraźną prośbę Macieja wyzerowano obie stałe na `''`
  (niewdrożone — czeka na `npm run deploy:functions` po ręcznym wpisaniu
  nowych ID i potwierdzeniu, że integracja ma dostęp do nowych baz).
- Zweryfikowano, że puste ID nie psują `checkNotionDaily` w sposób cichy:
  `previewSync`→`queryDatabase`→`request()` rzuci błąd HTTP z Notion API,
  złapany przez istniejący `try/catch` w `dailyCheck.ts`, który loguje
  błąd i nie nadpisuje ostatniego dobrego wyniku w Firestore.

Nie dokończone / do sprawdzenia:
- `functions/src/config.ts`: `NOTION_LESSONS_DB`/`NOTION_STUDENTS_DB` są
  puste — trzeba wpisać nowe ID z „Maciej's space" i zdeployować
  (`npm run deploy:functions`), inaczej codzienna auto-synchronizacja
  (`checkNotionDaily`) będzie się nie udawać co dzień o 6:00.
- Firestore `system/notion` (produkcja) NIE został wyczyszczony przez tego
  agenta — Maciej zdecydował, że zrobi to sam przez przycisk „Rozłącz" w
  Ustawieniach zamiast przez skrypt.

Decyzje architektoniczne:
- Nie napisano żadnego skryptu `scripts/reset-notion-config.js` ani kodu
  electron-store z oryginalnego zlecenia — nie istnieją w tym projekcie i
  ich dodanie byłoby fikcyjną warstwą niepasującą do architektury
  (patrz `CLAUDE.md` sekcja 2). Zamiast tego potwierdzono z Maciejem
  rzeczywisty zakres przez `AskUserQuestion`.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji ani
ścieżkach tokenowych bez logowania. Jedyna dotknięta stała
(`functions/src/config.ts`) wpływa na zaplanowaną Cloud Function po
kolejnym deployu — nieskonfigurowane ID zatrzymają `checkNotionDaily`
z jawnym błędem w logu, nie cichym uszkodzeniem danych.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 363/363 zielone.

## 2026-09-19 — Claude Code / Sonnet 5 (2)

Zadanie: Zlecenie opisywało usunięcie automatycznego dodawania nowej
lekcji przy montowaniu Scratchpada / wyborze kursanta z listy oraz pełną
manualną kontrolę nad „+ Nowa lekcja" (w tym gating lektor/kursant i
generowanie Revision przez Gemini tylko gdy jest poprzednia lekcja).

Zrobione: Audyt kodu (bez zmian) — opisany problem NIE występuje w
obecnym stanie repo, bo już go naprawiono w poprzednich sesjach
(`f4556a1`, `a9f8ccc`). Sprawdzono:
- `services/scratchpadService.ts` (`getOrCreateStudentScratchpad`,
  `adoptScratchpadForStudent`) — szablon startowy (`buildLessonTemplate`,
  bez wywołania Gemini) wstawia się WYŁĄCZNIE gdy dokument danego
  kursanta nie istnieje jeszcze nigdzie (ani w Firestore, ani lokalnie).
  Istniejący dokument (chmura/lokalny) wraca bez modyfikacji.
- `components/scratchpad/ScratchpadEditor.tsx` — `handleInsertLesson`
  (linia 890) ma dokładnie 2 miejsca wywołania: przycisk „+ Nowa lekcja"
  (linia 2516) i pozycja menu „Wstaw → Nowa lekcja" (linia 2375) — oba
  wyłącznie po kliknięciu, brak wywołania w `useEffect` montażu. Funkcja
  już warunkuje wywołanie Gemini (`generateLessonRevision`) obecnością
  treści poprzedniej lekcji (`willGenerateRevision`) — pierwsza lekcja
  dostaje pusty szablon Revision bez zapytania do AI.
- Oba miejsca wstawiania „Nowa lekcja" (przycisk i pozycja menu) i całą
  sekcję „Elementy lekcji"/„Szablony" w menu „Wstaw" opakowuje warunek
  `isTeacher` (`currentUser.role === 'teacher' || 'admin'`) — kursant
  (`StudentScratchpadScreen.tsx` przekazuje `role: 'student'` na sztywno)
  nie widzi przycisku w ogóle.
- `TeacherScratchpadScreen.tsx` — wybór kursanta („Przypisz kursanta")
  woła `adoptScratchpadForStudent`, które też nie dopisuje nowej lekcji:
  albo zwraca istniejący dokument kursanta bez zmian, albo (dokument
  „nietknięty" = wciąż szablon startowy) podmienia go treścią
  notatnika roboczego — nigdy nie dokleja nowej strony A4.

Nie dokończone / do sprawdzenia: Nie odtworzono opisanego zachowania w
przeglądarce (dev server nieuruchamiany w tej sesji) — jeśli Maciej
nadal to widzi w działającej aplikacji, może to być inne wejście niż
`TeacherScratchpadScreen`/`ScratchpadPage`/`StudentDatabaseScreen`
sprawdzone tutaj, albo build w przeglądarce jest starszy niż `main`
(cache/service worker) — warto potwierdzić przez twardy refresh przed
dalszym szukaniem.

Decyzje architektoniczne: Brak zmian w kodzie — nie wprowadzono żadnej
warstwy „na wszelki wypadek" do funkcji, które już spełniają zlecenie.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji ani
ścieżkach tokenowych bez logowania — sesja była czysto diagnostyczna.

Weryfikacja: Nie dotyczy (brak zmian w kodzie).

## 2026-09-19 — Claude Code / Sonnet 5 (3)

Zadanie: Zlecenie prosiło o nowy moduł „Historia Lekcji" (3 sekcje:
summary/vocabulary/areasForImprovement) + parser transkrypcji „Narada AI"
jako osobny model danych (`LessonHistoryEntry`, nowy serwis, nowe
komponenty w `src/`).

Zrobione: Audyt PRZED implementacją wykazał, że moduł już istnieje pod
innymi nazwami — `LessonRecord` ([types.ts](types.ts)),
`generateLessonFromTranscript` ([services/transcriptLesson.ts](services/transcriptLesson.ts)),
panel lektora [TranscriptLessonPanel.tsx](components/admin/TranscriptLessonPanel.tsx),
widok kursanta [StudentLessonHistory.tsx](components/dashboard/StudentLessonHistory.tsx)
już renderujący 3 sekcje. Po potwierdzeniu z Maciejem ([AskUserQuestion])
zamiast budować równoległy model, rozszerzono istniejące moduły:
- `types.ts`: nowe opcjonalne pola `LessonRecord.summaryPoints: string[]`,
  `vocabularyItems: LessonVocabularyItem[]` (term/translation/
  contextSentence/category), `areasForImprovement:
  LessonAreaForImprovement[]` (originalError/correctedForm/
  ruleExplanation) — obok istniejących pól tekstowych, które zostają
  jedynym źródłem dla fiszek i puli powtórek.
- `utils/transcriptLesson.ts`: `buildTranscriptLessonPrompt` prosi Gemini
  Flash o te 3 pola dodatkowo; `parseTranscriptLesson` waliduje je nowymi
  helperami (`asStringArray`, `asVocabularyItems`,
  `asAreasForImprovement`) — niekompletne pozycje odpadają po cichu,
  puste tablice nie trafiają do rekordu (undefined, nie []).
- `components/dashboard/StudentLessonHistory.tsx`: nagłówki sekcji
  dostały emoji 📘/📙/📕 z zamówienia. Nowe komponenty `SummaryContent`,
  `VocabularyGrid` (z `enrichVocabularyItems` — dopasowuje strukturalne
  dane po haśle do już wyświetlanej/zatwierdzonej listy słówek, nigdy nie
  zmienia samej listy), `AreasForImprovementContent` — użyte we
  wszystkich 3 miejscach renderowania (najnowsza lekcja, wyszukiwanie,
  lista wcześniejszych lekcji), z fallbackiem na stary tekst dla
  starszych lekcji bez pól strukturalnych.
- `tests/transcriptLesson.test.ts`: +2 testy (wypełnianie 3 sekcji,
  odrzucanie niekompletnych pozycji).
- `CHANGELOG.md`: nowa sekcja R pod „3. Znane Ograniczenia...".

Nie dokończone / do sprawdzenia: Zmiana nie była testowana wzrokowo w
przeglądarce (dev server nieuruchamiany w tej sesji) — `npx tsc --noEmit`
i `npm test` (365/365) przechodzą, ale wygląd kart w Historii Lekcji
(emoji, plakietki kategorii, karty błędów) warto sprawdzić na żywo przed
uznaniem UI za gotowe.

Decyzje architektoniczne: Świadomie NIE stworzono osobnego modelu
`LessonHistoryEntry`/nowego serwisu/nowych komponentów, mimo że zlecenie
tak opisywało — istniejący `LessonRecord`/`TranscriptLessonPanel`/
`StudentLessonHistory` już realizowały tę funkcję; równoległy model
byłby duplikacją bez korzyści i naruszałby CLAUDE.md §4 (nie wprowadzaj
kolejnego mechanizmu bez potrzeby). Nowe pola są opcjonalne i addytywne,
żeby nie zerwać żadnego istniejącego konsumenta `LessonRecord`.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji ani
ścieżkach tokenowych bez logowania.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 365/365 zielone (+2 nowe testy).

## 2026-09-19 — Claude Code / Sonnet 5 (4)

Zadanie: Zlecenie łączyło 4 części: (1) domyślnie zwinięte akordeony bloków
historii lekcji + usunięcie zdublowanego przycisku pracy domowej, (2)
redukcja integracji Notion w Ustawieniach do samej transkrypcji, (3)
jednorazowy skrypt migracji archiwum Notion→Firestore z żelazną zasadą
deduplikacji, (4) weryfikacja + CHANGELOG + push.

Przed startem zapytałem Macieja ([AskUserQuestion]) o zakres części 2/3,
bo zlecenie żądało też usunięcia WSZYSTKICH innych modułów odpytujących
Notion API poza transkrypcją (`services/notionSync.ts`,
`functions/src/notion/sync.ts`, `dailyCheck.ts`, sync UI w
`StudentDatabaseScreen.tsx`) — to sprzeczne z architekturą opisaną w
CLAUDE.md §2 i moją pamięcią. Maciej wybrał „Settings UI only" —
nie ruszać backendu/istniejącego kodu synchronizacji w tej sesji.

Zrobione:
- [CascadingLessonDetails.tsx](components/admin/CascadingLessonDetails.tsx):
  `expandedSections` (block1–4, learningCurve) domyślnie `false` zamiast
  `true`. To jest właściwy komponent akordeonu Blok 1–4 + Learning Curve
  (renderowany w `AdminPanel.tsx` przez `CascadingLessonDetails`), nie
  `StudentLessonHistory.tsx`/`TranscriptLessonPanel.tsx` wymienione w
  zleceniu jako przykład („m.in.") — te dwa nie mają takiej struktury
  bloków; `TranscriptLessonPanel.tsx` już był domyślnie zwinięty.
- [StudentLessonHistory.tsx](components/dashboard/StudentLessonHistory.tsx):
  kafelki w widoku wyników wyszukiwania domyślnie zwinięte (`?? false`,
  było `?? true`) — ujednolicone z listą wcześniejszych lekcji. Kafelek
  „najnowszej lekcji" (hero card na górze) świadomie zostawiony zawsze
  rozwinięty — nie ma toggle'a, to design decyzja sprzed tej sesji, nie
  część wymienionej listy bloków.
- [AdminPanel.tsx](components/admin/AdminPanel.tsx): usunięty zdublowany
  przycisk „Wygeneruj pracę domową" z nagłówka modala lekcji (linia ok.
  5286) — karta AI Generator z przyciskiem „Generuj zadania" zostaje
  jedynym miejscem wywołania.
- [SettingsScreen.tsx](components/settings/SettingsScreen.tsx): sekcja
  Notion przemianowana na „Opcjonalna integracja transkrypcji (workflow
  lektora)", zredukowana do token + Meeting Notes DB ID. Usunięte:
  auto-discovery baz, Test Connection, Fetch Transcripts Now, toggle
  auto-fetch + interwał, wraz z odpowiadającym stanem/handlerami.
  Backend `/api/notion/*` w `server.ts` nietknięty (nadal używany przez
  `TeacherLessonHistoryView.tsx` do faktycznego importu transkrypcji).
- Nowy [scripts/migrate-notion-archive.ts](scripts/migrate-notion-archive.ts)
  + `npm run migrate:notion` w `package.json` — patrz CHANGELOG runda 37
  dla pełnego opisu żelaznej zasady deduplikacji i odstępstw od
  literalnego zlecenia (tsx zamiast ts-node, kolekcja `users` zamiast
  `students`).
- CHANGELOG.md: nowa sekcja „runda 37".

Nie dokończone / do sprawdzenia:
- Żadna zmiana UI nie była oglądana w przeglądarce w tej sesji (brak
  odpalonego dev servera) — akordeony w `CascadingLessonDetails.tsx` i
  wygląd Ustawień po redukcji Notion warto sprawdzić wzrokowo.
- `scripts/migrate-notion-archive.ts` nie był uruchomiony z `--apply`
  (tylko suchy przebieg bez `FB_USER`/`FB_PASS` — potwierdzono, że kończy
  się kontrolowanym błędem, nie silent-fail). Pełna migracja historyczna
  już się odbyła w rundzie 28 (22 kursantów, 110/110 lekcji) — pierwsze
  uruchomienie tego skryptu na aktualnym stanie bazy powinno w większości
  zalogować same `[SKIP]`.
- Odkryto podczas audytu: `services/notionSync.ts`,
  `functions/src/notion/sync.ts`, `functions/src/notion/dailyCheck.ts` są
  martwym kodem od rundy 28 (niepodpięte do `functions/src/index.ts`,
  `notionSync.ts` woła nieistniejące już Cloud Functions) — kandydat do
  osobnego sprzątania, celowo nietknięty w tej sesji (poza potwierdzonym
  zakresem).

Decyzje architektoniczne:
- Zawężenie części 2/3 do „Settings UI only" na wyraźne życzenie Macieja
  (patrz wyżej) — nie usunięto backendu/dead code synchronizacji Notion.
- `npm run migrate:notion` używa `tsx`, nie `ts-node` z literalnego
  zlecenia — `ts-node` nie jest zależnością repo, `tsx` jest już
  konwencją wszystkich innych skryptów/testów.
- Nowy skrypt migracyjny zapisuje do `users`/`users/{uid}/lessonRecords`
  (rzeczywisty schemat aplikacji), nie do kolekcji `students` z
  literalnego zlecenia, która nigdzie w kodzie nie istnieje.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji ani
ścieżkach tokenowych bez logowania. Nowy skrypt migracyjny pisze do
kolekcji `users` (produkcyjne dane kursantów) — ale tylko gdy uruchomiony
ręcznie z terminala z `--apply` i poprawnymi `FB_USER`/`FB_PASS`; domyślny
tryb jest suchym przebiegiem bez żadnego zapisu.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 365/365 zielone.
- `npm run build` — bez błędów.
- `npx tsx scripts/migrate-notion-archive.ts` (bez `--apply`, bez env) —
  kończy się kontrolowanym komunikatem o brakującej zmiennej, zero
  zapisów.

## 2026-09-19 — Claude Code / Sonnet 5 (5)

Zadanie: Naprawić dwa zgłoszone problemy w
[scripts/migrate-notion-archive.ts](scripts/migrate-notion-archive.ts)
(z poprzedniej sesji, runda 37): (1) skrypt pracował na zamrożonym
zrzucie z 16 września zamiast pobierać świeże dane z Notion, (2) skrypt
wywalał się twardym błędem przy braku `FB_USER`.

Zrobione:
- [scripts/fetch_notion_dump.mjs](scripts/fetch_notion_dump.mjs)
  przebudowany na eksportowaną funkcję `fetchNotionArchive(...)` (reszta
  logiki pobierania/parsowania Notion bez zmian) — CLI (`node
  scripts/fetch_notion_dump.mjs`) nadal działa identycznie, tylko przez
  `isMainModule` guard woła tę samą funkcję.
- [scripts/migrate-notion-archive.ts](scripts/migrate-notion-archive.ts):
  `loadDump()` odpytuje Notion na żywo gdy `NOTION_API_KEY` jest
  ustawiony, inaczej głośno ostrzega i spada do zrzutu z dysku z jego
  datą w logu. Przepisany z klienckiego SDK (`signInWithEmailAndPassword`
  wymagający `FB_USER`/`FB_PASS`) na `firebase-admin` (wzorzec
  poświadczeń identyczny z `server.ts` — `FIREBASE_SERVICE_ACCOUNT` albo
  ADC środowiska). `resolveTeacherIdentity()` szuka jedynego konta
  admin/teacher w Firestore, potem `FB_USER`/`VITE_FIREBASE_ADMIN_UID`
  jako literalny UID, a przy braku wyniku **nie przerywa działania** —
  loguje ostrzeżenie i kontynuuje bez `migratedBy`.
- CHANGELOG.md: nowa sekcja „runda 38" z pełnym opisem.

Nie dokończone / do sprawdzenia:
- Pełne uruchomienie na żywo (z realnym `NOTION_API_KEY` i
  `FIREBASE_SERVICE_ACCOUNT`/ADC) nie było wykonane — w tym środowisku
  brak obu, więc dry-run kończy się spodziewanym
  `Could not load the default credentials` z Google Auth po wyczerpaniu
  wszystkich ścieżek rozwiązania tożsamości lektora (co samo w sobie
  potwierdza, że brak `FB_USER` już nie jest blokerem — skrypt dochodzi
  dużo dalej niż poprzednio, zanim faktycznie brakujące poświadczenia
  Firestore go zatrzymają).
- `role in ['admin','teacher']` w `resolveTeacherIdentity()` to
  zapytanie Firestore z operatorem `in` na pojedynczym polu — nie
  weryfikowane na produkcyjnej bazie w tej sesji (brak poświadczeń
  lokalnie), teoretycznie nie wymaga indeksu złożonego, ale warto
  potwierdzić przy pierwszym realnym uruchomieniu.

Decyzje architektoniczne:
- Logika pobierania Notion żyje wyłącznie w `fetch_notion_dump.mjs`
  (eksportowana funkcja) — `migrate-notion-archive.ts` ją importuje
  zamiast duplikować pipeline (CLAUDE.md §4).
- `FB_USER`/`VITE_FIREBASE_ADMIN_UID` zmieniły znaczenie: to już nie są
  poświadczenia logowania (email/hasło), tylko opcjonalny, jawnie podany
  UID do oznaczenia migracji — zgodnie z literalnym zleceniem, które
  mówiło o „identyfikatorze lektora", nie o loginie.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji ani
ścieżkach tokenowych bez logowania. Skrypt teraz pisze przez
`firebase-admin`, które **omija reguły bezpieczeństwa Firestore** —
większa siła rażenia niż poprzednia wersja (klucz SDK + logowanie jako
konkretny użytkownik podlegające `firestore.rules`). Ryzyko ograniczone
przez to, że zapis nadal wymaga jawnego `--apply` i realnych poświadczeń
(`FIREBASE_SERVICE_ACCOUNT`/ADC), których nikt przypadkiem nie ustawi.

Weryfikacja:
- `npx tsc --noEmit` — 0 błędów.
- `npm test` — 365/365 zielone.
- `npx tsx scripts/migrate-notion-archive.ts` (dry-run, bez env) —
  potwierdzony brak crashu na samym braku `FB_USER`; poprawny spadek do
  zrzutu z ostrzeżeniem o dacie; jedyny błąd końcowy to oczekiwany brak
  poświadczeń Google w tym środowisku.
- `node scripts/fetch_notion_dump.mjs` (bez `NOTION_API_KEY`) — kończy
  się czytelnym błędem zamiast cichego zawieszenia, CLI-owe zachowanie
  zachowane.

2026-09-19 — Claude Code / Sonnet 5

Zadanie: Wdrożenie "Smart Student Onboarding" — import kursanta z pliku
(.txt/.md/.pdf) w oknie dodawania kursanta, z analizą AI (Gemini) i kartą
weryfikacji braków dla lektora przed utworzeniem konta.

Zrobione:
- Nowe: `types/studentImport.ts` (kontrakt `StudentImportAnalysis`),
  `utils/studentImportNormalize.ts` (deterministyczna normalizacja
  odpowiedzi modelu, wzorowana na `utils/lessonImport.ts`),
  `services/studentImportService.ts` (frontend: czyta plik, woła backend),
  `components/admin/StudentImportReviewCard.tsx` (karta weryfikacji).
- `server.ts`: nowy endpoint `POST /api/gemini/analyze-student-import`
  (`requireFirebaseAdmin`), wariant istniejącego
  `/api/gemini/import-lessons-batch` dla pojedynczego kursanta.
- `components/admin/StandaloneStudentDatabaseScreen.tsx`: dropzone nad
  formularzem tworzenia kursanta, przełączanie na kartę weryfikacji po
  analizie, zapis konta (`createUser`) + historycznych lekcji
  (`createLessonRecordWithVocabularySet`) po zatwierdzeniu.
- `tests/studentImport.test.ts` — 11 testów normalizacji (node:test).
- CHANGELOG.md — runda 39.

Nie dokończone / do sprawdzenia:
- Flow (dropzone → analiza → karta weryfikacji → zapis) nie był klikany
  w przeglądarce w tej sesji — tylko `tsc --noEmit`, `npm test` (376/376)
  i `npm run build` przeszły. Wymaga realnego testu z kluczem Gemini i
  przykładowym plikiem notatek przed uznaniem za w pełni gotowe.
- Brak dodania kluczy i18n (`en.json`/`pl.json`) — świadomie pominięte,
  bo `StandaloneStudentDatabaseScreen.tsx` nigdzie indziej nie używa
  `useTranslation`, więc nowy tekst jest hardkodowanym polskim, zgodnie
  z konwencją tego ekranu (patrz decyzje niżej).

Decyzje architektoniczne:
- Task zlecał kontrakt lekcji "Words & Phrases/Grammar & Accuracy/
  Pronunciation/Homework" — takiego kontraktu nie ma w kodzie (prawdziwy
  to `LessonBlocks`: summary/vocabulary/corrections/homework/nextLesson).
  Zaimportowane lekcje piszą do istniejących płaskich pól `LessonRecord`
  przez `createLessonRecordWithVocabularySet`, żeby nie tworzyć
  równoległego, niezgodnego kontraktu.
- Task zlecał pole `fullName` na koncie kursanta — `User` nie ma takiego
  pola (jest `displayName`/`firstName`/`lastName`/`username`). `fullName`
  zostało jako pole pośrednie w `StudentImportAnalysis` (wynik ekstrakcji
  AI), a przy zapisie konta jest dzielone na `firstName`/`lastName` i
  kopiowane do `displayName`/`username`, dokładnie jak w istniejącym
  `handleCreateStudent`.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji
(`requireFirebaseAuth`/`requireFirebaseAdmin` — nowy endpoint tylko
*używa* `requireFirebaseAdmin`, nie modyfikuje go) ani ścieżkach
tokenowych bez logowania.

2026-09-19 — Claude Code / Sonnet 5

Zadanie: Implementacja Generatora Scenariusza Lekcji 2.0 (Etap 2.1) wg
specyfikacji architektonicznej Opus 5 / audytu GPT-5.6 Sol — ścisły
kontrakt: klient wysyła wyłącznie { studentId, durationMin }, cała reszta
(profil, ostatnia lekcja, tryb, wywołanie Gemini) po stronie backendu.

Zrobione:
- Nowe: `types/scenario.ts` (kontrakt: SCENARIO_MODULE_IDS,
  SCENARIO_DURATION_BUDGETS dla 45/60/90 min, GenerateScenarioRequest,
  ScenarioModelOutput, LessonScenario/ScenarioModule/ScenarioItem,
  SaveScenarioRequest/LessonRecordScenarioPatch), `utils/scenarioValidation.ts`
  (walidacja odpowiedzi modelu + nadawanie czasów/ID — wydzielone z
  endpointu pod testy jednostkowe bez uruchamiania Expressa),
  `services/scenarioClient.ts` (generateScenario/saveScenario z tokenem
  Firebase), `hooks/useScenarioGenerator.ts` (maszyna stanów idle→
  generating→draft→saving→saved|error + edycja/usuwanie punktów draftu),
  `components/admin/ScenarioPreviewPanel.tsx` (selektor 45/60/90 min,
  podgląd 4 modułów, edycja inline, baner cold_start, zapis/odrzucenie).
- `server.ts`: `POST /api/scenario/generate` (requireFirebaseAuth — czyta
  users/{studentId} i ostatnią ukończoną lekcję z lessonRecords, woła
  Gemini Flash z responseSchema, waliduje i zwraca LessonScenario) oraz
  `POST /api/scenario/save` (dopisuje plannedScenario/scenarioSavedAt do
  lessonRecords/{targetLessonId}).
- `types.ts`: `LessonRecord.plannedScenario`/`scenarioSavedAt`.
- `components/admin/AdminPanel.tsx`: wpięty `ScenarioPreviewPanel` nad
  `CascadingLessonDetails` w modalu podglądu lekcji.
- `tests/scenario.test.ts` — 11 testów (node:test): sumowanie budżetów,
  walidacja modelu (zła kolejność/liczba modułów, puste pola, limity
  1-6 punktów), buildLessonScenario (unikalne ID, czasy, kolejność).
- CHANGELOG.md — runda 40.

Nie dokończone / do sprawdzenia:
- Flow (wybór długości → generuj → edycja draftu → zapis) nie był
  klikany w przeglądarce w tej sesji — tylko `tsc --noEmit` (0 błędów),
  `npm test` (387/387) i `npm run build` przeszły. Wymaga testu z
  realnym kluczem Gemini i realnym kursantem/lekcją przed uznaniem za
  w pełni gotowe.
- "Ostatnia ukończona lekcja" pomija rekordy pending_confirmation/
  rejected/draft/live po stronie backendu, ale logika nie była
  przetestowana na realnych danych Firestore z produkcji.

Decyzje architektoniczne:
- Model dostaje responseSchema z enum na moduleId, ale backend i tak
  re-waliduje kolejność/liczbę/długość (validateScenarioModelOutput) —
  responseSchema Gemini nie gwarantuje kolejności ani limitu elementów
  tablicy, a budżety czasowe muszą się dokładnie sumować do 45/60/90 min.
- Endpoint zabezpieczony requireFirebaseAuth, nie requireFirebaseAdmin —
  zgodnie z literalnym poleceniem ("autoryzuje lektora przez Firebase
  Auth") i wzorem /api/homework-v2/generate.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji ani
ścieżkach tokenowych bez logowania. Nowe endpointy tylko *używają*
`requireFirebaseAuth`, nie modyfikują go.

2026-09-19 — Claude Code / Sonnet 5

Zadanie: Wdrożenie 2-etapowego potoku Gemini ("The Cribro Method") w
Generatorze Scenariusza 2.0 (Etap 2.1), zgodnie z podanym poleceniem dla
"Coder 3". Kontrakt/typy/walidacja/UI z Etapu 2.1 istniały już z
poprzedniej rundy tego samego dnia (zob. wpis wyżej) — potok był
jednoetapowy (jedno wywołanie Gemini z responseSchema).

Zrobione:
- `server.ts` (`POST /api/scenario/generate`): rozbito na Etap 1
  (dydaktyczny, wolny tekst, bez responseSchema — pełny profil kursanta
  `level`/`industry`/`goals`, bogatszy kontekst ostatniej lekcji, rygor
  "Test Naturalności" z listą zakazanych korpo-słów, warm-up zakotwiczony
  w konkretnym dniu, main_topic zredukowany do JEDNEJ sytuacji zawodowej
  + wskazówki ratunkowe) i Etap 2 (formatujący, responseSchema — wierne
  przepisanie Etapu 1 na JSON kontraktu).
- Nowe stałe `SCENARIO_DIDACTIC_MODEL`/`SCENARIO_FORMATTING_MODEL` w
  `server.ts`, domyślnie `gemini-2.5-pro`/`gemini-2.5-flash` — patrz
  decyzja niżej. Obie kaskady wywołań to wyłącznie Gemini
  (`GEMINI_MODEL_CASCADE` jako fallback), zero OpenAI.
- `types/scenario.ts`: nowe opcjonalne `teacherNotes?: string[]` na
  `ScenarioModelModule`/`ScenarioModule`.
- `utils/scenarioValidation.ts`: `validateScenarioModelOutput` wymaga
  niepustych `teacherNotes` wyłącznie dla modułu `main_topic`;
  `buildLessonScenario` przepisuje pole 1:1.
- `components/admin/ScenarioPreviewPanel.tsx`: nowy panel "Wskazówki
  ratunkowe (dla lektora)" pod punktami modułu `main_topic`.
- `tests/scenario.test.ts`: +3 testy (brak/pusty teacherNotes w
  main_topic, przepisanie przez buildLessonScenario bez wycieku do
  innych modułów).
- `CHANGELOG.md` — sekcja S.

Nie dokończone / do sprawdzenia:
- Potok NIE był wołany na żywo na kluczu Gemini — brak dostępu do
  skonfigurowanych kluczy i zalogowanej sesji w tej sesji agenta. W
  szczególności nie zweryfikowano, czy Etap 2 zawsze poprawnie wyciąga
  teacherNotes z wolnego tekstu Etapu 1 na żywym modelu (tylko logika
  promptu + walidacja backendu, przetestowane jednostkowo na sztucznych
  danych).
- `npx tsc --noEmit` (0 błędów), `npm test` (390/390, +3 nowe),
  `npm run build` — wszystko przeszło.

Decyzje architektoniczne:
- Zlecenie wskazywało dosłownie modele `gemini-1.5-pro`/`gemini-1.5-flash`.
  Ta rodzina jest wygaszana przez Google i nie istnieje w jedynym źródle
  prawdy modeli w repo (`services/aiModels.ts`, kaskada 2.5/3.8) — użycie
  jej dosłownie groziło realnym błędem 404/deprecated w produkcji.
  Zapytałem Macieja wprost: wybrał "zrób obie nazwy konfigurowalne" — więc
  stałe `SCENARIO_DIDACTIC_MODEL`/`SCENARIO_FORMATTING_MODEL` są nazwane i
  łatwe do podmiany, domyślnie ustawione na aktualne odpowiedniki
  (`gemini-2.5-pro`/`gemini-2.5-flash`), z komentarzem uzasadniającym.
- Zlecenie zakładało pole profilu "preferencje korekty błędów" — nie
  istnieje w `User` (`types.ts`). Nie dodałem nowego pola na chybcika;
  prompt Etapu 1 jawnie mówi modelowi, że tych danych brakuje, i każe mu
  korygować błędy w module `error_work` bez nachalności gdzie indziej.
  Jeśli lektorzy realnie tego potrzebują, wymaga to osobnej decyzji (nowe
  pole w profilu + UI do jego edycji w `SettingsScreen`/karcie kursanta).

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji
(`requireFirebaseAuth`/`requireFirebaseAdmin`) ani ścieżkach tokenowych
bez logowania. Endpointy istniały już wcześniej, autoryzacja
niezmieniona.

2026-09-19 — Claude Code / Sonnet 5

Zadanie: Podpięcie generatora scenariusza lekcji 2.0 jako Tool (Function
Calling) do czatu Asystenta Lektora, zgodnie z wytycznymi audytu GPT-5.6
Sol: zero dublowania logiki między endpointem HTTP a toolem, bezpieczny
resolve studentRef wyłącznie po stronie backendu, granice MVP (podgląd +
link do profilu, bez auto-zapisu do lekcji).

Zrobione:
- `services/scenarioContextService.ts` (nowy) — `loadScenarioStudentContext`,
  wyodrębnione z ciała `/api/scenario/generate`.
- `services/scenarioAiService.ts` (nowy) — `generateScenarioForStudent`,
  wspólny dwuetapowy potok Gemini dla endpointu i toola.
- `services/studentResolver.ts` (nowy) — `resolveStudentRef`, rozstrzyga
  `studentRef` (ID/nazwa) wyłącznie w zbiorze aktywnych kursantów; rzuca
  jawny błąd przy braku/kilku dopasowaniach.
- `server.ts` — endpoint `/api/scenario/generate` przepisany na wywołanie
  wspólnej funkcji; nowy endpoint `POST /api/scenario/generate-for-chat`
  dla toola czatu.
- `services/teacherAssistant.ts` — deklaracja toola Gemini
  `generate_lesson_scenario` (pierwsze prawdziwe function-calling w repo,
  dotąd był tylko wzorzec fenced-block), round-trip functionCall/
  functionResponse w trybie Flash, nowy eksport `ScenarioToolResult`,
  pole `AssistantMessage.scenarioToolResult`.
- `components/admin/ScenarioModuleCard.tsx` (nowy) — wydzielony z
  `ScenarioPreviewPanel.tsx`, prop `readOnly` do kompaktowego podglądu;
  `ScenarioPreviewPanel.tsx` przepisany na jego użycie (bez zmiany
  zachowania w edytorze).
- `components/admin/TeacherAssistant.tsx` — nowy lokalny komponent
  `ScenarioToolResultCard` (wzorem istniejącego `HtmlReportCard`),
  podpięty w obu miejscach renderowania wiadomości; przycisk nawigacji
  reużywa istniejący typ akcji `'profile'`.
- `CHANGELOG.md` sekcja T.

Nie dokończone / do sprawdzenia:
- Brak nowych testów jednostkowych dla `resolveStudentRef` /
  `generateScenarioForStudent` / toola czatu — do zrobienia w osobnej
  rundzie.
- Tool nie był wołany na żywo (brak kluczy Gemini / zalogowanej sesji w
  tej sesji agenta) — nie zweryfikowano w przeglądarce, czy Gemini
  faktycznie decyduje się wywołać `generate_lesson_scenario` przy
  naturalnych poleceniach lektora, ani pełnego round-tripu przez proxy
  `/api/gemini/generate`.
- Tool działa wyłącznie w trybie Flash — Thinking i multimodalny generują
  scenariusz po staremu (bez toola), świadomie poza zakresem tej rundy.

Decyzje architektoniczne:
- Scope resolve studentRef: w bazie nie ma pola wiążącego kursanta z
  konkretnym lektorem (teacherUid/teacherId tylko na grupach/
  scratchpadach/sesjach). Zapytałem Macieja wprost (AskUserQuestion) —
  wybrał globalny zbiór aktywnych kursantów, spójny z istniejącym
  zachowaniem `/api/scenario/generate` i `buildStudentIndex()`. Prawdziwe
  multi-tenant scoping (nowe pole + ew. `firestore.rules`) zostaje jako
  osobna decyzja na przyszłość.
- Tryb Flash w czacie: zamieniłem kolejność prób (`generateTextWithUnifiedFallback`
  był główną ścieżką, bezpośrednie wywołanie Gemini — fallbackiem) na
  odwrotną, bo tylko bezpośrednie wywołanie niesie `tools`. Fallback bez
  toola (kaskada Gemini/OpenAI/Anthropic) zostaje jako siatka
  bezpieczeństwa przy błędzie.

Ryzyka: Nowa logika autoryzacji dostępu (`resolveStudentRef`) — nie
zmienia `firestore.rules` ani middleware `requireFirebaseAuth`/
`requireFirebaseAdmin`, endpoint nadal wymaga zalogowanego lektora/admina
tak jak istniejący `/api/scenario/generate`. Brak zmian w ścieżkach
tokenowych bez logowania.

---

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Zlecenie zakładało, że import notatek/transkrypcji z Notion gubi
treść, bo parser rekurencyjny pobiera tylko bezpośrednie dzieci strony i
pomija dzieci bloków `has_children === true` (zwłaszcza toggle i
callout), z twardym limitem MAX_DEPTH=4, kontrolowaną obsługą błędów API
(bez zapisu do bazy przy błędzie) i usunięciem rzekomego fallbacku
słownictwa „apple/banana”.

Audyt (Faza A) pokazał, że opis zadania trafnie opisuje
`functions/src/notion/client.ts` (`pageToText`) — ale ten moduł jest
martwym kodem od rundy 28 (2026-09-16, patrz CHANGELOG „Pełna Migracja
Bazy Kursantów i Lekcji z Notion do Firestore”): `previewNotionSync`,
`importNotionSelection` i `checkNotionDaily` zostały wtedy usunięte z
`functions/src/index.ts` po jednorazowej pełnej migracji 22
kursantów/110 lekcji do Firestore. Zostały tylko pliki źródłowe i testy
jednostkowe (`tests/notionParse.test.ts`, `notionMatch.test.ts`,
`notionLevel.test.ts`) importujące bezpośrednio z `functions/src/notion/*`
— bez żadnego podpięcia do wdrożonego callable/triggera.

Żywa ścieżka importu treści Notion to dziś `fetchNotionBlocksText` w
`server.ts` (endpoint `/api/notion/meeting-content/:pageId`), używana
przez `ManualTranscriptImportModal.tsx` do wstępnego wypełnienia
formularza przed wygenerowaniem lekcji przez Gemini
(`services/transcriptLesson.ts`) — nie ma tu zapisu do Firestore wprost z
tej funkcji. Ta funkcja już schodziła w KAŻDY blok z `has_children`
(bez filtra po słowach kluczowych toggle/callout) i już miała
`depth > 4` jako granicę — ale błędy API (429/5xx/403/404) były po cichu
połykane (`if (!res.ok) break`), zwracając uciętą treść zamiast błędu, a
przekroczenie głębokości ucinało dane bez sygnału. Fallback
„apple/banana” z opisu zadania nie istnieje jako fallback produkcyjny —
to tylko placeholder w polu formularza ręcznego wpisywania lekcji
(`AdminPanel.tsx:4996`, i18n klucz `pl.json`/`en.json`), niepowiązany z
importem z Notion.

Zapytałem Macieja wprost (AskUserQuestion), który pipeline naprawić —
wybrał żywy (`server.ts`), rekomendowany ze względu na realny wpływ.

Zrobione:
- Nowy `utils/notionBlocksFetcher.ts` — wydzielona, testowalna wersja
  `fetchNotionBlocksText`/`fetchNotionBlockChildrenPage` (wcześniej
  lokalne domknięcia w `server.ts`): twardy `NOTION_BLOCKS_MAX_DEPTH = 4`
  (błąd, gdy blok na głębokości 4 nadal ma dzieci, zamiast ucinania),
  pacing 350 ms + do 3 prób dla 429/5xx z poszanowaniem `Retry-After`,
  defensywna ekstrakcja `rich_text` (brak wyjątku na nieznanym typie
  bloku czy pustych/`null` elementach), błąd API zawsze rzuca wyjątek
  zamiast cicho zwracać pustą/uciętą treść.
- `server.ts` — usunięto zduplikowaną definicję `fetchNotionBlocksText`,
  doszedł import z `utils/notionBlocksFetcher.ts`; oba miejsca użycia
  (`/api/notion/meeting-content/:pageId` i `syncNotionTranscriptsFromApi`)
  już miały `try/catch` zwracający błąd 500 zamiast zapisu częściowych
  danych, więc zamiana zachowania (throw zamiast cichego `break`) nie
  wymagała zmian w wywołujących.
- `tests/notionBlocksFetcher.test.ts` — 11 nowych testów: zagnieżdżenie
  toggle→callout→paragraph, paginacja na dwóch poziomach z osobnym
  kursorem, kolejność depth-first bez duplikacji, pusty wynik przy braku
  sekcji, błąd bez częściowego zwrotu, retry na 429 z `Retry-After`
  (zegar zastępczy `node:test` `mock.timers`), wyczerpanie ponowień na
  5xx, błąd przy bloku na głębokości 4 z dziećmi, brak wyjątku na
  bloku dokładnie na granicy głębokości, odporność na brakujące/`null`
  pola `rich_text`, i sanity-check że tekst kursanta ze słowem „apple”
  przechodzi bez filtrowania.
- `api/index.js`, `dist/server.cjs` — przebudowane (`npm run build`),
  zawierają nową wersję `fetchNotionBlocksText`.

Nie dokończone / do sprawdzenia:
- `functions/src/notion/client.ts` (`pageToText`) — martwy kod, NIE
  naprawiony (poza zakresem wyboru Macieja). Nadal ma ten sam bug opisany
  w zleceniu (filtr po słowach kluczowych toggle/callout, efektywny limit
  głębokości 2). Jeśli ktoś kiedyś przywróci `previewNotionSync`/
  `importNotionSelection`, ten bug wróci — testy `tests/notionParse.test.ts`
  itd. dalej przechodzą, bo nie testują `pageToText`.
- Zmiana nie była sprawdzona na żywo w przeglądarce (brak zalogowanej
  sesji / tokenu Notion w tej sesji agenta) — zweryfikowana wyłącznie
  przez `tsc --noEmit`, `npm test` (401/401 zielono, baza 390 + 11
  nowych) i `npm run build`.
- `ManualTranscriptImportModal.tsx` nadal po cichu zostawia puste pole
  `rawText`, gdy `/api/notion/meeting-content/:pageId` zwróci błąd
  (`if (res.ok) {...}` bez gałęzi na błąd) — teraz endpoint zwraca 500
  zamiast 200 z uciętą treścią, więc lektor dostanie pustkę zamiast
  częściowej notatki, ale nie zobaczy komunikatu błędu. Świadomie poza
  zakresem (zadanie dotyczyło pobierania, nie UI błędów) — warto
  poprawić w osobnej rundzie.

Decyzje architektoniczne:
- Wydzielenie `utils/notionBlocksFetcher.ts` z `server.ts` — jedyny
  sposób na spełnienie wymogu testów regresyjnych z zadania bez mockowania
  całej aplikacji Express (funkcje w `server.ts` to lokalne domknięcia,
  nieeksportowane). Zero zmiany zachowania, czysta ekstrakcja.
- Nie ruszałem `functions/src/notion/*` — Maciej wybrał zakres „żywy
  pipeline”, a naprawa martwego kodu bez podpięcia do żadnego callable
  nie miałaby wpływu produkcyjnego; wspomniane wyżej jako świadomie
  pominięte.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji
(`requireFirebaseAuth`/`requireFirebaseAdmin` niedotknięte) ani ścieżkach
tokenowych bez logowania. Brak migracji/backfillu, schemat dokumentów
lekcji niezmieniony. Brak nowych zależności w `package.json`.

---

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Wdrożyć MVP "Kreatora Scenariuszy i Interaktywnego Canvasu" —
opcjonalny, wersjonowany kontrakt `scenarioCanvasV2` (9 bloków), potok
Planner->Auditor na Gemini, endpoint Lesson Refresh z selektywną
podmianą odrzuconych elementów, lekki komponent Canvasu w React/Tailwind.

Zrobione:
- `types/scenarioCanvas.ts` — kontrakt 9 bloków, CanvasItem z review/
  delivery/generation, budżety czasowe per długość lekcji.
- `utils/scenarioCanvasValidation.ts` — czyste funkcje: dobór
  applicable bloków (pomija grammar_review/older_lesson_refresh),
  walidacja Plannera/Auditora/Refresh, budowanie canvasu, aplikowanie
  patchy. 24 nowe testy w `tests/scenarioCanvas.test.ts`.
- `services/scenarioCanvasAiService.ts` — Planner + Auditor + Lesson
  Refresh, wyłącznie Gemini przez istniejący `generateContentWithRetry`
  (reużyty z `scenarioAiService.ts`, zero nowego klienta AI).
- `services/scenarioContextService.ts` — dopisane `hasGrammarContext`/
  `grammarContext` do istniejącego `loadScenarioStudentContext` (bez
  zmiany kontraktu v1, pola opcjonalne/dodatkowe).
- `server.ts` — trzy nowe endpointy: `/api/scenario/canvas/generate`,
  `/api/scenario/canvas/save`, `/api/scenario/canvas/refresh` (409 przy
  stale `expectedRevision`, idempotencja przez `mutationId`).
- `components/admin/ScenarioCanvasPanel.tsx` +
  `ScenarioCanvasBlockCard.tsx`, `hooks/useScenarioCanvas.ts`,
  `services/scenarioCanvasClient.ts` — UI zamontowany w `AdminPanel.tsx`
  obok istniejącego `ScenarioPreviewPanel` (v1).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (425/425,
  baza 401 + 24 nowe), `npm run build` (przechodzi).
- Dwa commity: backend/kontrakt osobno od UI (`feat(scenario): kontrakt
  i backend...` / `feat(scenario): lekki Canvas 2.0...`).

Nie dokończone / do sprawdzenia:
- UI NIE był sprawdzony wzrokowo w przeglądarce (brak dostępu do
  live Gemini/Firestore w tej sesji) — tylko tsc/testy/build, zgodnie
  z długiem technicznym z sekcji 6 CLAUDE.md.
- Brak testów integracyjnych na żywym Gemini dla Plannera/Auditora/
  Refresh (jak w istniejącym v1 — ten sam brak klucza w środowisku
  agenta).
- Auditor woła się zawsze automatycznie po Plannerze wewnątrz
  `generateScenarioCanvasForStudent` — brak osobnego przełącznika UI
  do jego pominięcia (nie było w zleceniu, ale warto potwierdzić z
  Maciejem czy to pożądane, bo to dodatkowe wywołanie Gemini za każdym
  razem).

Decyzje architektoniczne:
- `scenarioCanvasV2` jako całkowicie osobny, opcjonalny dokument obok
  `plannedScenario` — zero migracji wstecznej zgodnie ze zleceniem.
  Backend (nie model) decyduje o pominiętych blokach na podstawie
  trybu i obecności `corrections`/`thingsToImprove` z ostatniej lekcji
  (proxy dla "kontekstu gramatycznego" — w profilu nie ma osobnego pola
  na gramatykę, reużyłem to samo pole, którego już używa v1 dla
  `error_work`).
- UI zamontowany jako druga, niezależna sekcja w `AdminPanel.tsx`
  (obok v1), a nie jako zamiennik — zlecenie nie prosiło o usunięcie
  v1, a `plannedScenario` ma inny kontrakt i inne miejsca użycia
  (m.in. tool czatu Asystenta Lektora).

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji
(`requireFirebaseAuth`/`requireFirebaseAdmin` niedotknięte) ani
ścieżkach tokenowych bez logowania. Brak importów OpenAI w nowym
kodzie — wyłącznie `@google/genai` przez istniejący
`generateContentWithRetry`. Brak migracji/backfillu, schemat istniejących
dokumentów lekcji niezmieniony (nowe pole wyłącznie opcjonalne/addytywne).

---

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Title Generation Gate przy imporcie transkrypcji — zastąpić
techniczny tytuł ("[KOD] Imię Nazwisko DD.MM.YYYY" / nazwa pliku)
naturalnym tematem lekcji po angielsku generowanym przez Gemini z treści
rozmowy, bez nowego wywołania AI, z ochroną ręcznej edycji lektora przed
nadpisaniem przez spóźniony callback.

Zrobione:
- FAZA 0 (audyt): dwie ścieżki interaktywnego importu prowadzą do
  wspólnego rdzenia `generateLessonFromTranscript` /
  `parseTranscriptLesson` (`services/transcriptLesson.ts` +
  `utils/transcriptLesson.ts`) — `ManualTranscriptImportModal.tsx`
  (Notion + wklejony tekst) i `TranscriptLessonPanel.tsx` (live
  transkrypcja Cribro Sift). Trzecia ścieżka, `syncNotionTranscriptsFromApi`
  w `server.ts`, ustawia `topic: title` wprost z tytułu strony Notion —
  ale to osobny, bezobsługowy bulk-sync bez wywołania Gemini w ogóle
  (transkrypcja czeka na ręczne uzupełnienie bloków przez
  `TranscriptLessonPanel` dopiero po imporcie) — świadomie pominięty,
  bo dotknięcie go złamałoby zakaz nowego wywołania AI albo wymagałoby
  osobnej decyzji architektonicznej, o którą zlecenie nie prosiło.
- `utils/transcriptLesson.ts` — punkt 8 w `TRANSCRIPT_SYSTEM_INSTRUCTION`
  i przepisany opis pola `"topic"` w `buildTranscriptLessonPrompt`: temat
  po angielsku, 1-10 słów, do 80 znaków, zakaz imion/dat/kodów w
  nawiasach/etykiet technicznych i generycznych, pusty string zamiast
  zmyślania. Nowe czyste funkcje: `validateGeneratedTopic()` (walidacja
  runtime odpowiedzi modelu — odrzuca, nie okalecza) i
  `resolveLessonTopic()` (hierarchia: ręczna edycja > tytuł scenariusza >
  temat z AI > brak). `parseTranscriptLesson` przyjmuje teraz
  `metadata.studentName` i przepuszcza `topic` przez walidator.
- `services/transcriptLesson.ts` — dopisane przekazanie `studentName` do
  metadanych parsera (do wykrywania wycieku imienia/nazwiska w temacie).
- `components/admin/ManualTranscriptImportModal.tsx` — nowy stan
  `lessonTopicDirty` (tylko ręczne wpisywanie, nie auto-podpowiedź z
  tytułu spotkania Notion), usunięty techniczny fallback
  `Lekcja z notatek Notion (data)`; brak rozstrzygniętego tematu po
  `resolveLessonTopic` blokuje zapis komunikatem błędu zamiast cichego
  zapisu etykiety.
- `components/admin/TranscriptLessonPanel.tsx` — `recordRef` łapie
  najświeższy temat po zakończeniu wywołania Gemini; jeśli lektor zmienił
  temat ręcznie w edytorze lekcji w międzyczasie, `resolveLessonTopic`
  zachowuje jego edycję zamiast pozwolić odpowiedzi AI ją nadpisać.
- `tests/transcriptLesson.test.ts` — 13 nowych testów jednostkowych na
  `validateGeneratedTopic` i `resolveLessonTopic` (baza 425 + 13 = 438).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (438/438),
  `npm run build` (przechodzi; `api/index.js` przebudowany bez zmian
  treści, bo `server.ts` nie był dotykany w tym zadaniu).
- CHANGELOG.md — sekcja W dopisana z pełnym opisem zmiany.

Nie dokończone / do sprawdzenia:
- UI NIE był sprawdzony wzrokowo w przeglądarce (brak dostępu do live
  Gemini/Firestore w tej sesji agenta) — zgodnie z długiem technicznym w
  CLAUDE.md sekcja 6.
- Zlecenie wymieniało też import PDF w `ManualTranscriptImportModal` —
  audyt pokazał, że ten modal obecnie nie ma ścieżki PDF (tylko Notion i
  wklejony tekst). PDF istnieje w zupełnie osobnym imporcie
  profilu+historii kursanta przy tworzeniu nowego konta
  (`services/studentImportService.ts`,
  `/api/gemini/analyze-student-import`, `StudentImportReviewCard.tsx`) —
  to inna funkcja z inną analizą AI, celowo pominięta jako poza zakresem
  (dotknięcie jej byłoby nowym zadaniem, nie tym samym Title Generation
  Gate).
- `resolveLessonTopic` ma gotowy parametr `scenarioTitle`, ale żadna z
  dwóch ścieżek transkrypcji nie przekazuje tam jeszcze tytułu
  powiązanego scenariusza (obie zaczynają importu bez linku do
  scenariusza) — do podpięcia, jeśli/kiedy transkrypcja zostanie
  powiązana ze scenariuszem przy imporcie.

Decyzje architektoniczne:
- Bramka generowania tematu wpleciona w istniejący, jedyny prompt
  ekstrakcji transkrypcji (`buildTranscriptLessonPrompt` +
  `TRANSCRIPT_SYSTEM_INSTRUCTION`) — zero nowego wywołania AI, zgodnie z
  nienegocjowalnym guardrailem zlecenia.
- Walidator (`validateGeneratedTopic`) świadomie ODRZUCA całe
  podejrzane teksty (zwraca pusty string), zamiast próbować je naprawiać
  (np. ucinać do 80 znaków albo wycinać nawiasy) — spójne z resztą
  parsera transkrypcji (`asText`/`asVocabularyItems` też odrzucają
  niekompletne pozycje zamiast je łatać) i z zasadą „model ma się
  poprawić, a nie dostać po cichu okaleczoną wersję własnej odpowiedzi".
- `syncNotionTranscriptsFromApi` w `server.ts` (bulk sync bez Gemini)
  świadomie pominięty — patrz „Zrobione" wyżej.

Ryzyka: Brak zmian w `firestore.rules`, brak zmian schematu bazy/migracji,
brak nowych bibliotek (package.json/package-lock.json bez zmian), brak
dodatkowego wywołania Gemini (ta sama, jedyna odpowiedź ekstrakcji
transkrypcji obsługuje teraz też temat). Middleware autoryzacji
(`requireFirebaseAuth`/`requireFirebaseAdmin`) i ścieżki tokenowe bez
logowania niedotknięte. `server.ts` nie był w ogóle edytowany w tym
zadaniu. Mapowanie daty i przypisanie kursanta (`studentId`)
niezmienione.

---

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Ujednolicenie modułu prac domowych — zlikwidować w UI podział
v1/v2 (zakładka „Lista prac" + przycisk „Przegląd v2"), jeden nagłówek
„Zarządzanie Pracami Domowymi" + jeden przycisk „+ Przypisz pracę
domową", i wymusić „Human-in-the-loop": silnik oceny AI wywoływany
wyłącznie na żądanie lektora (przycisk „✨ Zaproponuj ocenę z AI"),
z edycją przed „Zatwierdź i wyślij do kursanta"; nadesłana praca zawsze
„Do sprawdzenia". Opcjonalny przełącznik „Automatyczna ocena AI przy
100% pewności" (domyślnie wyłączony).

Przed zaczęciem zauważyłem niescalone, ale przetestowane zmiany z
poprzedniej sesji (Title Generation Gate, wpis wyżej) — niezwiązane z tym
zadaniem, więc scommitowane osobno (`9b0a608`) przed przystąpieniem do
pracy, zgodnie z zasadą „jeden commit = jedna zmiana".

Audyt (przed zmianą kodu, przez subagenta Explore + ręczne dogłębne
sprawdzenie kodu żywych ścieżek): `HomeworkScreen.tsx` jest mostem
między v1 i v2, ale montowany WYŁĄCZNIE z `isTeacher=true`
(`TeacherWorkScreen.tsx`, `AdminPanel.tsx`) — więc jego gałęzie
`!isTeacher` (student workspace, `handleSubmitTask`) są martwym kodem.
Żywa ścieżka studenta to osobny plik, `StudentHomeworkScreen.tsx`.
Silnik v2 jest już domyślnie włączony (`HOMEWORK_ENGINE_V2 = true`)
i faktycznie tworzy nowe zadania po „+ Przypisz pracę domową"
(`HomeworkComposerV2`), ale `StudentHomeworkV2Screen.tsx` jest martwym
importem w `Dashboard.tsx` — kursanci NIE mają dziś jak odpowiedzieć na
zadanie v2 przez normalną nawigację. To pre-istniejąca luka, świadomie
NIE naprawiona w tej rundzie (inny zakres — wymaga decyzji o UX ekranu
kursanta, nie o module zarządzania/oceny). Zgłaszam to jako najważniejsze
ryzyko tej rundy niżej.

Prawdziwy "walidator w tle" znalazłem w `StudentHomeworkScreen.tsx:
handleSubmit` (żywa ścieżka v1): `evaluateTranslations()` (AI) wołane
automatycznie przy KAŻDYM wysłaniu pracy, zanim lektor cokolwiek zrobił.
UI już poprawnie chowała wynik przed kursantem do czasu `status ===
'graded'` — ale silnik i tak się uruchamiał, kosztował, i naruszał
zasadę „na żądanie lektora" z tego zlecenia.

Zrobione:
- `HomeworkScreen.tsx`: usunięte przyciski „Lista prac (n)"/„Przegląd
  v2" i stan `activeTab: 'v2review'`. Jeden przycisk „+ Przypisz pracę
  domową" (zamienia się w „Wróć do listy" w trybie tworzenia). Nowa
  funkcja `openTaskReview(task)` — jeden punkt otwarcia szczegółów,
  kierujący na modal v1 albo na osadzony widok v2 wg `isV2Task(task)`;
  podpięta we wszystkich miejscach, które wcześniej wołały
  `setReviewTask`/`setPreviewTask` wprost (kafelki, `HomeworkTaskList`,
  `initialTaskId` z nawigacji) — część z nich renderowałaby dla v2 pusty
  widok v1 (inny kształt danych), więc to też naprawa błędu. Dodany
  toggle „Automatyczna ocena AI przy 100% pewności" w nagłówku (tylko
  lektor) i zapytanie `collectionGroup('attempts')` do oznaczania zadań
  v2 jako „Do sprawdzenia" (ich `status` na dokumencie nadrzędnym nigdy
  się nie zmienia — werdykt żyje w podkolekcji). Naprawiony przy okazji
  bug: nawigacja z widgetu „Wymaga uwagi" (`initialTaskId`) otwierała
  warsztat KURSANTA zamiast podglądu lektora, bo `activeTask`-owa sekcja
  nie miała `isTeacher`-guarda.
- `components/admin/HomeworkV2ReviewScreen.tsx`: przebudowany z osobnego
  ekranu (lista wszystkich zestawów + zbiorczy boks „Wymaga uwagi") na
  komponent JEDNEGO zadania osadzony w modalu. Zbiorczy boks usunięty —
  pewność modelu zostaje jako subtelna notatka przy próbie. Dodane
  przyciski „Zaproponuj ocenę z AI"/„Zatwierdź i wyślij do kursanta" na
  poziomie pojedynczej próby.
- `functions/src/homeworkV2/endpoints.ts`: `submitHomeworkV2Attempt`
  przestał automatycznie oceniać każdą próbę. Domyślnie zapisuje się bez
  werdyktu (`requiresTeacherReview: true`, `pendingTeacherApproval:
  true`). Dwa nowe `onCall`: `proposeHomeworkV2Grade` (ocena na żądanie,
  nic nie zapisuje) i `approveHomeworkV2Grade` (utrwala werdykt,
  odblokowuje feedback). Wyjątek: gdy `system/homeworkAiSettings.
  autoApproveAtFullConfidence` jest `true`, ocena nadal liczy się
  automatycznie, ale finalizuje się bez lektora WYŁĄCZNIE przy
  `confidence === 1` — inaczej ląduje jako propozycja do przejrzenia.
  Nowy `functions/src/homeworkV2/settings.ts` (odczyt ustawienia po
  stronie Cloud Functions) i nowa czysta funkcja `shouldAutoApprove()`
  w `contracts.ts`.
- `StudentHomeworkScreen.tsx:handleSubmit`: `evaluateTranslations()`
  przeniesione za ten sam przełącznik (`services/
  homeworkAiSettingsService.ts`) — domyślnie wcale się nie uruchamia,
  korzysta z istniejącej ścieżki zapasowej „brak oceny modelu". Gdy
  przełącznik włączony i WSZYSTKIE odpowiedzi w 100% poprawne, zadanie
  trafia od razu jako `status: 'graded'` z automatyczną notatką; każdy
  inny wynik czeka na lektora jak zawsze.
- `HomeworkScreen.tsx`: `handleAnalyzeWithAI` → przycisk „✨ Zaproponuj
  ocenę z AI", `handleSaveReview` → przycisk „Zatwierdź i wyślij do
  kursanta" (logika obu bez zmian — to była już poprawna implementacja,
  tylko źle nazwana).
- Ujednolicone etykiety statusu w całym module: „Do sprawdzenia" / „W
  trakcie" / „Sprawdzone" (`HomeworkTaskList.tsx`, kafelki, modal
  podglądu) — wcześniej cztery różne nazwy dla tych samych trzech
  stanów w różnych miejscach tego samego ekranu.
- `services/homeworkV2Client.ts`: nowe `proposeGradeV2`/`approveGradeV2`.
- `services/homeworkAiSettingsService.ts` (nowy) — odczyt/zapis
  `system/homeworkAiSettings` po stronie klienta (Firestore client SDK
  bezpośrednio — `system/{document=**}` w regułach już pozwala na to
  każdemu `isAdmin()`/`teacher`, więc zero zmian w `firestore.rules`).
- `TeacherAttentionBanner.tsx`, `TeacherHomeworkNotification.tsx`,
  `Dashboard.tsx`: usunięty osobny kanał `onOpenV2Review`/`'v2review'` —
  wszystko woła teraz `onOpenHomework(taskId)`/`filterStatus:'submitted'`,
  bo `openTaskReview` w `HomeworkScreen.tsx` sam rozpoznaje silnik.
- `tests/homeworkV2Contracts.test.ts`: 2 nowe testy na `shouldAutoApprove`
  (baza 438 + 2 = 440).

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (440/440),
`npm run build` (przechodzi), `npm --prefix functions run build`
(przechodzi). UI NIE sprawdzony wzrokowo w przeglądarce.

Nie dokończone / do sprawdzenia:
- `StudentHomeworkV2Screen.tsx` nadal niepodpięty do nawigacji kursanta
  (patrz audyt wyżej) — zadania v2 tworzone przez „+ Przypisz pracę
  domową" nie mają dziś jak dotrzeć do kursanta przez normalny ekran.
  To NIE zostało wprowadzone w tej rundzie, ale skoro `HOMEWORK_ENGINE_V2`
  jest domyślnie `true`, każda nowa praca domowa dziś idzie tą martwą
  ścieżką. Wymaga osobnej decyzji Macieja: naprawić routing w
  `Dashboard.tsx`, czy tymczasowo wyłączyć flagę przy tworzeniu nowych
  zadań, dopóki ekran kursanta nie będzie gotowy. To najważniejsza
  rzecz do wyjaśnienia przed pokazaniem tego modułu prawdziwemu
  kursantowi.
- Nowe endpointy `onCall` (`proposeHomeworkV2Grade`,
  `approveHomeworkV2Grade`) wymagają `npm run deploy:functions`, zanim
  zadziałają na produkcji.
- `/api/homework/notify-graded` (w `server.ts`, niedotknięty w tej
  rundzie) nie weryfikuje, że wywołujący jest lektorem/adminem ani że
  `studentUid` w body to faktyczny adresat — tylko `requireFirebaseAuth`.
  Pre-istniejąca luka, teraz wołana też z nowego miejsca
  (`HomeworkV2ReviewScreen.tsx` po zatwierdzeniu oceny v2). Nie
  naprawiona — poza zakresem tego zlecenia, ale warto zamknąć osobno.
- Auto-ocena przy 100% pewności (oba silniki) NIE wysyła e-maila —
  tylko zapisuje `status: 'graded'`/werdykt w Firestore. Świadome
  uproszczenie zakresu tej rundy.
- Zero weryfikacji wzrokowej w przeglądarce (nowy toggle, osadzony
  widok v2 w modalu, przyciski propose/approve) — zgodnie z długiem
  technicznym z `CLAUDE.md` sekcja 6.

Decyzje architektoniczne:
- Traktowałem `StudentHomeworkScreen.tsx` (v1, żywa ścieżka) jako
  faktyczny cel "Human-in-the-loop", a nie martwe gałęzie
  `HomeworkScreen.tsx`/`StudentHomeworkV2Screen.tsx` — bo to jest kod,
  który dziś naprawdę wykonuje się dla prawdziwych kursantów. Zmiana w
  martwym kodzie nie miałaby żadnego efektu produkcyjnego.
- Dla v2 przełącznik "100% pewności" nadal uruchamia `gradeAttempt`
  automatycznie (żeby w ogóle poznać `confidence`), tylko finalizację
  (zapis werdyktu + feedback dla kursanta) warunkuje wynikiem — bo
  inaczej nie dałoby się nigdy wiedzieć, czy coś jest "100% pewne" bez
  najpierw to ocenić. Ten sam wzorzec zastosowany w v1 (ocena liczy się,
  ale trafia do kursanta tylko przy komplecie poprawnych odpowiedzi).
- `HomeworkV2ReviewScreen.tsx` zostawiony jako osobny plik (nie scalony
  do `HomeworkScreen.tsx`) mimo przebudowy na komponent jednego zadania —
  inna domena danych (exercises/attempts vs sentences/studentAnswers),
  osobny plik czytelniej rozdziela odpowiedzialność, zgodnie z
  konwencją repo.
- Nie ruszałem `firestore.rules` — `system/{document=**}` już pozwalało
  na to, co było potrzebne (odczyt każdemu zalogowanemu, zapis
  `isAdmin()`/`teacher`) dla nowego dokumentu ustawień.

Ryzyka: `firestore.rules` NIE dotknięty. Middleware autoryzacji w
`server.ts` (`requireFirebaseAuth`/`requireFirebaseAdmin`) NIE dotknięty
— `server.ts` w ogóle nie był edytowany w tej rundzie. Ścieżki tokenowe
bez logowania (`homework/direct/:token`) niedotknięte. Dwa nowe
endpointy Cloud Functions wymagają wdrożenia przed użyciem na produkcji
(patrz wyżej).

---

2026-09-20 — Claude Code / Sonnet 5 (P0: podpięcie ekranu kursanta v2)

Zadanie: sprawdzić stan `StudentHomeworkV2Screen.tsx` (odnotowany w
poprzednim wpisie jako martwy import w `Dashboard.tsx`) i podpiąć go,
żeby kursanci mogli wyświetlać i odsyłać nowo przypisane zadania v2
(silnik v2 jest domyślnie włączony i to on dziś tworzy zadania po
kliknięciu „+ Przypisz pracę domową").

Audyt komponentu — NIE był kompletny w sensie technicznym, jeden
prawdziwy błąd:
- **Naruszenie Reguł Hooków**: `const [showManualHint, setShowManualHint]
  = useState(false);` stało PO trzech wcześniejszych warunkowych
  `return` (brak zadań / lista zadań / „to wszystko na dziś"). Przy
  przejściu między tymi stanami React zgłosiłby zmianę kolejności
  hooków (albo po cichu zgubił stan innych hooków) — to by się ujawniło
  dopiero w przeglądarce, nie w `tsc`/testach. Naprawione: hook
  przeniesiony na górę komponentu, obok reszty `useState`.
- Poza tym komponent jest kompletny: pobiera zadania (`studentTasksQuery`
  + filtr `isV2Task`), wysyła próby (`submitHomeworkAttemptV2`), ma
  autosave szkicu do `specialTasks/{id}/drafts/{exerciseId}` (rules już
  na to pozwalały — sprawdzone w `firestore.rules`, zero zmian
  potrzebnych), i poprawnie oddaje `fallback` (ekran v1), gdy kursant
  nie ma żadnego zestawu v2.
- Ważna konsekwencja poprzedniej rundy (human-in-the-loop): odkąd
  `submitHomeworkV2Attempt` już nie ocenia automatycznie, ten ekran
  nadal działa mechanicznie (zapisuje próbę, przechodzi do następnego
  zadania po trzech próbach), ale drabinka podpowiedzi/„pokaż wzorzec po
  3 próbie" z założenia się nie uruchamia (bo `revealModelAnswer` jest
  teraz zawsze `false` w domyślnej ścieżce) — kursant zamiast tego widzi
  komunikat „zapisano, nauczyciel sprawdzi". To zgodne z zasadą
  human-in-the-loop, nie regresja, ale zmienia charakter tego ekranu z
  „trening z natychmiastowym coachingiem" na „odeślij i czekaj" — warto
  to mieć na uwadze przy następnej rozmowie o UX.

Zrobione:
- `components/dashboard/StudentHomeworkV2Screen.tsx`: naprawiony błąd
  kolejności hooków (wyżej). Dodany opcjonalny prop `initialTaskId` —
  nawigacja z powiadomienia/kafelka na pulpicie (`hasNewHomework`,
  `TeacherHomeworkNotification`-owy odpowiednik dla kursanta,
  `StudentHomeworkGradedModal`) teraz otwiera właściwe zadanie od razu,
  zamiast zostawiać kursanta na liście do ręcznego kliknięcia. Gdy
  wskazany `taskId` NIE jest zadaniem v2 (kursant ma zarówno v1 jak i
  v2, a link celuje w starsze zadanie v1), komponent oddaje `fallback`
  zamiast pokazywać pustą/złą listę v2 — link z powiadomienia nie ginie.
- `components/dashboard/Dashboard.tsx`: w gałęzi `view === 'homework'`
  dla kursanta (`!isTeacher`) dodane rozgałęzienie: gdy
  `HOMEWORK_ENGINE_V2` włączone i jest zalogowany `user`, renderuje się
  `StudentHomeworkV2Screen` z `fallback={homeworkV1}` (już istniejący,
  wcześniej przygotowany, ale nieużywany JSX) i `initialTaskId={activeTaskId}`.
  Import `HOMEWORK_ENGINE_V2` i `StudentHomeworkV2Screen` były już w
  pliku (martwe) — teraz obydwa faktycznie używane.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (440/440),
`npm run build` (przechodzi). UI NIE sprawdzony wzrokowo w przeglądarce
— brak dostępu do zalogowanej sesji Firebase w tej sesji agenta (ten sam
dług co reszta ostatnich rund, patrz `CLAUDE.md` sekcja 6). To jest
teraz priorytet numer jeden do zrobienia przy najbliższym logowaniu:
zalogować się jako kursant z przypisanym zadaniem v2 i przejść cały
przepływ (lista → zadanie → wysłanie → powrót do listy → „to wszystko
na dziś").

Nie dokończone / do sprawdzenia:
- Ekran v2 nie ma własnego przycisku „← Wróć do pulpitu" (v1 go ma).
  Nie jest to ślepy zaułek — `TopBar` w `Dashboard.tsx` ma przycisk
  Home niezależny od tego, co renderuje się w `<main>` — ale UX jest
  niespójny między silnikami. Świadomie pominięte w tej rundzie (P0
  było „działa i wysyła", nie parytet wizualny z v1).
- Ekran v2 nie pokazuje kursantowi NICZEGO po tym, jak lektor
  później zatwierdzi ocenę (`approveHomeworkV2Grade`) — nie ma
  listenera na `attempts` po zatwierdzeniu, tylko na `drafts` (autosave)
  i wynik bezpośrednio po `submitHomeworkAttemptV2`. Powiadomienie o
  ocenie dociera dziś wyłącznie przez `StudentHomeworkGradedModal`/e-mail
  (te same pola na `users/{uid}`, ustawiane przez
  `/api/homework/notify-graded`, który `HomeworkV2ReviewScreen.tsx` już
  woła po zatwierdzeniu) — więc kursant SIĘ DOWIE, ale nie zobaczy
  szczegółowego rozbicia odpowiedzi w tym ekranie tak, jak widzi to w
  v1 (`StudentHomeworkScreen.tsx`'s `viewingGradedTask`). Osobne
  zadanie, jeśli ma być parytet.
- Zero testów jednostkowych dla `StudentHomeworkV2Screen.tsx` — to
  komponent czysto UI-owy (Firestore + hooki), reszta testów w repo nie
  pokrywa takich komponentów (brak infrastruktury do testów
  React/RTL w tym projekcie).

Decyzje architektoniczne:
- `initialTaskId` w `StudentHomeworkV2Screen` sprawdza dopasowanie do
  listy zadań v2 PRZED otwarciem — jeśli zadania jeszcze nie doszły
  (`isLoading`), czeka; jeśli doszły i go nie ma, oddaje `fallback`
  zamiast zakładać z góry silnik. To samo zachowanie co reguła „brak
  zestawów v2 → fallback" tuż obok, tylko rozszerzone o przypadek
  konkretnego linku.
- Nie dodawałem tu drabinki „wynik po zatwierdzeniu" (patrz wyżej) —
  wymagałoby nowego listenera i nowego stanu ekranu („sprawdzone, oto
  feedback"), a P0 dotyczyło wyłącznie „kursant widzi i odsyła", nie
  pełnego zamknięcia pętli human-in-the-loop w tym konkretnym ekranie.

Ryzyka: `firestore.rules` NIE dotknięty (i nie było trzeba — reguły dla
`attempts`/`drafts` już istniały z wcześniejszej rundy i już pozwalały
na to, czego ten ekran potrzebuje). Middleware autoryzacji w `server.ts`
i ścieżki tokenowe bez logowania niedotknięte. `server.ts` w ogóle nie
był edytowany. Zero zmian schematu danych — wyłącznie nowy, opcjonalny
prop na już istniejącym komponencie i jedno nowe rozgałęzienie w
`Dashboard.tsx`.

---

2026-09-20 — Claude Code / Sonnet 5 (P0: diagnoza 145 s w `generateHomeworkV2`)

Zadanie: zdiagnozować i wyeliminować przyczynę 145 s na wygenerowanie
6 zadań domowych w `generateHomeworkV2` (us-central1), zamiast
oczekiwanych 3-5 s, i sprowadzić cały zestaw poniżej 8 s.

Audyt (bez zmian w kodzie na tym etapie) przeszedł przez cały łańcuch
wywołań: `endpoints.ts:generateHomeworkV2` → `pipeline.ts:buildExerciseSet`
→ `exerciseGenerator.ts:generateExercises` → `qualityValidator.ts:
validateAll` → `openai.ts:createAiCall`.

Znalezione (dwie przyczyny, jedna dominująca):

1. **`qualityValidator.ts:validateAll`** — generowanie SAMYCH zadań już
   było jednym wywołaniem na cały zestaw (`generateExercises`, komentarz
   w kodzie wprost to tłumaczy). Ale kontrola jakości sprawdzała KAŻDE
   zadanie osobnym, sekwencyjnym wywołaniem modelu (`for...of` + `await`
   w pętli), a każda z do dwóch regeneracji na zadanie też była osobnym
   zapytaniem. Dla 6 zadań: od 7 (bez odrzuceń) do 31 (przy pechu)
   sekwencyjnych zapytań HTTP do Gemini — to jest dokładny mechanizm
   145 s, nie generator, wbrew założeniu w opisie zlecenia.
2. **`openai.ts:createAiCall`** — żadne wywołanie Gemini 2.5 Flash nie
   ustawiało `thinkingConfig`, więc model dokładał domyślny budżet
   rozumowania do KAŻDEGO zapytania, mimo w pełni rozpisanych promptów
   (format, reguły, gotowy przykład JSON) niepotrzebujących
   wielokrokowego rozumowania. To mnożnik na każde z 7-31 zapytań z
   punktu 1.

Sprawdzone i WYKLUCZONE (z opisu zlecenia): brak pętli
exponential-backoff/retry przy błędach walidacji schematu — kaskada po
błędzie po prostu idzie do następnego modelu, bez opóźnień. Format
odpowiedzi już wymuszony natywnie (`responseMimeType: 'application/
json'`), wycinanie bloków markdown w `extractJson` to tylko zapasowy
parser, nie główna ścieżka. Kontekst z lekcji już pobierany przez
`Promise.all`, nie sekwencyjnie.

Zrobione:
- `functions/src/homeworkV2/qualityValidator.ts`: nowa `validateBatch`
  (jedno zapytanie ocenia CAŁY zestaw, dopasowanie werdyktów po polu
  `index` modelu, nie po pozycji w tablicy — model potrafi zwrócić listę
  w innej kolejności). Wspólna, czysta `shapeVerdict()` wydzielona z
  dawnej `validateDraft` — ten sam próg i ta sama reguła „zarzuty biją
  deklarację" liczą się identycznie w ścieżce pojedynczej i wsadowej.
  `validateAll` przepisany: 1 walidacja wstępna + do `MAX_REGENERATIONS`
  (2) rund, każda runda to 1 zapytanie regeneracji + 1 ponownej walidacji
  WYŁĄCZNIE zadań, które jeszcze nie przeszły (nie całego zestawu od
  nowa). Górny limit zapytań na CAŁY zestaw: stałe 5, niezależnie od
  liczby zadań (wcześniej: 5 na SZTUKĘ).
- `functions/src/homeworkV2/exerciseGenerator.ts`: nowa `regenerateBatch`
  (jedno zapytanie poprawia wszystkie nieudane zadania danej rundy,
  każde ze swoimi zarzutami). Usunięty jako martwy kod `regenerateDraft`
  (pojedyncze wywołanie na zadanie) razem z `RegenerateInput` — w pełni
  zastąpiony, zero pozostałych odwołań (sprawdzone grepem po całym repo
  i testach przed usunięciem).
- `functions/src/homeworkV2/pipeline.ts`: `buildExerciseSet` wiąże teraz
  `regenerateBatch` zamiast `regenerateDraft` do `validateAll`.
- `functions/src/homeworkV2/openai.ts`: nowe opcjonalne pole
  `ModelRequest.thinkingBudget` (domyślnie `0` w `createAiCall`),
  przełożone na `generationConfig.thinkingConfig.thinkingBudget` w
  zapytaniu do Gemini. Dotyczy WSZYSTKICH wywołań silnika v2 przez tę
  jedną wspólną funkcję — generowania, walidacji, regeneracji, oceny
  próby (`gradingEngine.ts`) i feedbacku (`feedbackComposer.ts`), nie
  tylko `generateHomeworkV2`. Pole zostaje opcjonalne (nie usunięte) —
  wywołujący może podać większy budżet, gdyby się to okazało potrzebne.
- `tests/homeworkV2Flow.test.ts`: 3 nowe testy pilnujące, że liczba
  wywołań modelu NIE rośnie z liczbą zadań (jedno zapytanie na cały
  zestaw; dopasowanie po `index`; regeneracja obejmuje wyłącznie zadania,
  które nie przeszły, ze stałą górną granicą zapytań) — plus aktualizacja
  3 istniejących testów `validateAll` na nowy kontrakt `regenerateBatch`
  (zmiana z `regenerate` na `regenerateBatch` to zmiana łamiąca sygnaturę
  publicznego API tego modułu).
- `tests/homeworkV2AiCall.test.ts` (nowy plik, 2 testy): stub
  `global.fetch` (ten sam wzorzec co `tests/notionBlocksFetcher.test.ts`)
  potwierdzający, że request do Gemini domyślnie niesie
  `thinkingConfig: {thinkingBudget: 0}`, i że jawnie podany budżet go
  nadpisuje.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445, baza
440 + 5 nowych), `npm --prefix functions run build` (przechodzi),
`npm run build` (przechodzi).

Nie dokończone / do sprawdzenia:
- **Brak realnego pomiaru czasu na produkcji.** Środowisko agenta nie ma
  klucza Gemini ani dostępu do wdrożonych Cloud Functions — „145 s →
  sekundy" jest policzone analitycznie (liczba zapytań × szacowany czas
  na zapytanie bez rozszerzonego rozumowania) i potwierdzone testami na
  LICZBĘ wywołań modelu, NIE zmierzonym czasem end-to-end. Po
  `npm run deploy:functions` pierwsze realne `generateHomeworkV2`
  powinno pokazać w logach `[hw-v2] wywołanie modelu Gemini` (log kosztu/
  latencji, już istniejący) 1-2 wpisy zamiast 7+, każdy rzędu kilku
  sekund — to jest sposób na potwierdzenie na żywo.
  Skopiowana wersja backendu do wdrożenia (`npm run deploy:functions`)
  jeszcze nie wykonana w tej sesji — celowo, bo to działanie na
  produkcji.
- Wyłączenie budżetu myślenia dla WSZYSTKICH wywołań silnika v2 (nie
  tylko generatora) mogło, teoretycznie, obniżyć jakość ocen/feedbacku w
  `gradingEngine.ts`/`feedbackComposer.ts` — nie oceniane jakościowo w
  tej sesji, bo cel był wyłącznie prędkość `generateHomeworkV2`. Jeśli
  jakość zauważalnie spadnie, pierwszy krok to selektywne podniesienie
  `thinkingBudget` z powrotem dla konkretnego kroku (np. generator, gdzie
  liczy się kreatywność), zostawiając walidator/regenerację (zadania
  deterministyczne, `temperature: 0`) przy zerze.

Decyzje architektoniczne:
- `ValidateAllInput.regenerate` (pojedyncze zadanie) zmienione na
  `regenerateBatch` (cała grupa nieudanych) — świadoma zmiana łamiąca
  sygnaturę, bo stary kształt DI wprost wymuszał sekwencyjność, którą
  trzeba było usunąć u źródła, nie obejść. Sprawdzone, że nic poza
  `pipeline.ts` i testami tego repo nie importuje `qualityValidator.ts`
  ani `exerciseGenerator.ts`.
- Dopasowanie werdyktów/regeneracji po polu `index` zwracanym przez
  model, z awaryjnym powrotem do pozycji w tablicy — model może zwrócić
  listę w innej kolejności niż zapytano (widziane już w innych miejscach
  tego silnika, stąd defensywna postawa zamiast zaufania do kolejności).
- `thinkingBudget` jako pole `ModelRequest`, nie globalna stała w
  `createAiCall` — zostawia furtkę na podniesienie budżetu selektywnie
  bez przebudowy interfejsu, gdyby jakość generowania na zero-thinking
  okazała się gorsza w praktyce (patrz „Nie dokończone" wyżej).
- `regenerateDraft` usunięty, nie zostawiony jako martwy kod obok
  `regenerateBatch` — zero odwołań w repo po zmianie (sprawdzone grepem),
  a trzymanie dwóch ścieżek do tej samej rzeczy tylko myli, który sposób
  jest tym właściwym.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji
(`requireFirebaseAuth`/`requireFirebaseAdmin`), ścieżkach tokenowych bez
logowania ani schemacie danych Firestore — cała zmiana jest w warstwie
orkiestracji wywołań modelu wewnątrz Cloud Functions, nietykająca żadnej
reguły dostępu ani zapisu. `endpoints.ts` dotknięty w jednym miejscu
(przekazanie `regenerateBatch` zamiast `regenerateDraft` przez
`pipeline.ts`) — bez zmiany logiki samego endpointu. Zmiana sygnatury
`ValidateAllInput` jest breaking change dla kodu spoza tego repo, gdyby
taki istniał (potwierdzone grepem, że nie istnieje tutaj).

---

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Naprawić 3 błędy renderowania w ekranie prac domowych kursanta —
brak/zły nagłówek rozsypanki, zdublowana instrukcja przy „Znajdź błąd”,
pusty ekran przy „Uzupełnij luki”. Zadanie opisywało to jako dotyczące
`StudentHomeworkV2Screen.tsx`.

Zrobione: Agent eksploracyjny ustalił, że opisane objawy (klocki `chunks`,
tokeny `[BLANK_n]`, pole `polishHint`) nie istnieją w ogóle w silniku v2 —
`StudentHomeworkV2Screen.tsx` renderuje wszystkie typy identycznie jako
płaski tekst + textarea. Pasują dokładnie do silnika v1
(`HomeworkExercise.tsx`). Zapytałem Macieja wprost, który ekran — potwierdził
v1. Naprawione w `components/dashboard/HomeworkExercise.tsx`:
- `word_order`: dodany deterministyczny nagłówek („Przetłumacz zdanie:” +
  boks ze zdaniem polskim, gdy jest `polishHint`/`sourceSentence`/`prompt`;
  „Ułóż słowa w poprawnej kolejności:” bez boksu, gdy nie ma).
- `find_errors`: usunięty fallback `meaningText` na `item.instruction` (bo
  duplikował odznakę „Znajdź i popraw błąd w zdaniu”); `meaningText` teraz
  tylko z `polishHint`/`meaning`, odfiltrowane od listy generycznych etykiet;
  etykieta zmieniona z „Instrukcja / Znaczenie:” na „Znaczenie:”.
- `fill_in_the_blank`: dodane dwie nowe gałęzie obok istniejącego trybu
  klocków (`[BLANK_n]` + bank słów) — tryb wolnego wpisu dla luki `___` w
  `content` (bez banku, zgodnie z kontraktem `gap_from_context` w
  `functions/src/homeworkV2/coreKnowledge.ts:120-128`) i zabezpieczenie
  fallback (pełna treść + wolne pole tekstowe), żeby ekran nigdy nie był
  pusty przy nierozpoznanym kształcie danych.

Pełny opis z uzasadnieniem: `CHANGELOG.md`, sekcja 4, wpis AB.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445, bez nowych
testów), `npm run build` (przechodzi).

Nie dokończone / do sprawdzenia:
- Zmiany NIE zostały obejrzane w przeglądarce — brak dostępu do zalogowanej
  sesji w tej sesji agenta. Sprawdzić wzrokowo wszystkie 3 typy na realnym
  zestawie z `homework/direct/:token` przed wysłaniem do kursantów.
- Nie ustalono ROOT CAUSE, dlaczego element w kształcie v2 (`gap_from_context`)
  w ogóle trafiał do renderera v1 — `isV1Task`/`isV2Task` w `utils/homework.ts`
  powinno to filtrować po stronie zapytania, ale fallback w
  `homeworkItemType()` (linia 76) sugeruje możliwą lukę dla starszych/
  mieszanych dokumentów. Naprawa jest defensywna niezależnie od przyczyny.
- Duplikat tej samej logiki `find_errors`/`fill_in_the_blank` w
  `HomeworkScreen.tsx` (~linie 1750-1799, widok lektora/admina w
  `TeacherWorkScreen.tsx`/`AdminPanel.tsx`) NIE był dotknięty — poza
  zakresem tego zadania (ekran kursanta, nie lektora).

Decyzje architektoniczne:
- Zamiast przepisywać `fill_in_the_blank` pod jeden, nowy kształt danych,
  zostawione wszystkie trzy warianty naraz (stare klocki / nowy wolny wpis /
  fallback) — starsze zadania w bazie mogą wciąż mieć stary kształt
  `textWithBlanks`, więc usunięcie tej gałęzi zepsułoby historyczne prace.

Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach
tokenowych bez logowania ani schemacie danych Firestore — zmiana wyłącznie
w jednym komponencie prezentacyjnym (`HomeworkExercise.tsx`).

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Doprecyzowanie fixu z wpisu AB (commit 15e3fe4) po teście na żywym
UI kursanta — Maciej zgłosił, że rozsypanka v1 nadal pokazuje instrukcję AI
zamiast zdania, i że StudentHomeworkV2Screen.tsx (krok 2/6, gap_from_context)
pokazuje pusty szary obrys bez treści.

Zrobione:
- `components/dashboard/HomeworkExercise.tsx`, `type === 'word_order'`: dodany
  filtr `looksLikeInstruction` — jeśli `polishHint`/`sourceSentence`/`prompt`
  zaczyna się od wzorca instrukcji AI ("Popraw zdanie", "Zwróć uwagę",
  "Instrukcja", "Ułóż"), traktowany jak pusty, więc renderer spada na
  nagłówek bez boksu zamiast pokazać polecenie jako zdanie źródłowe.
- `components/dashboard/StudentHomeworkV2Screen.tsx`: dodany `exerciseContent`
  z fallbackiem `content || sentence || prompt || sourceText`, `console.error`
  ze zrzutem `exercise` gdy wszystko puste, i czytelny komunikat błędu w UI
  zamiast pustego bloku. `instruction` też ma teraz fallback tekstowy.

Nie dokończone / do sprawdzenia:
- Root cause pustego `exercise.content` w v2 NIE ustalony. Zbadano cały
  pipeline backendowy (`assignment.ts` — `selectSendableExercises` wymaga
  niepustego `content` przez `isExerciseContractV2` przed zapisem do
  `sentences`; `endpoints.ts` — `submitHomeworkV2Attempt`/
  `proposeHomeworkV2Grade`/`approveHomeworkV2Grade` tylko czytają istniejący
  kontrakt z tablicy, nic nie nadpisują) — nie znaleziono ścieżki, która
  powinna zapisać pusty `content`. Możliwe, że to dokument sprzed obecnej
  wersji kontraktu albo ręcznie edytowany. Jeśli objaw wróci, sprawdzić log
  `[StudentHomeworkV2Screen] Zadanie bez treści (content):` w konsoli
  przeglądarki kursanta — da pełny zrzut obiektu zadania.
- Zmiany NIE zostały obejrzane w przeglądarce przez agenta (brak dostępu do
  zalogowanej sesji) — Maciej testuje sam na koncie kursanta.

Decyzje architektoniczne: brak nowych — kontynuacja podejścia z AB
(defensywne UI, nigdy nie pokazuj pustego ekranu).

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani ścieżkach
tokenowych bez logowania — wyłącznie dwa komponenty prezentacyjne.

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Zgłoszenie "KRYTYCZNA REGRESJA" — kursant w pracy domowej stracił
rozgrzewkę, pasek pigułek zadań, przyciski Wstecz/Dalej i "Odeślij pracę",
zamiast tego widzi pojedyncze zadanie z blokadą "Sprawdź odpowiedź" i
licznikiem prób. Żądanie: przywrócić w StudentHomeworkV2Screen.tsx.

Zrobione: Zbadano — to NIE regresja, tylko dwa różne, celowo różne ekrany.
StudentHomeworkV2Screen.tsx (silnik "treningu" v2, MAX_ATTEMPTS/hint ladder/
mastery state zamrożone w functions/src/homeworkV2/contracts.ts §3.1) nigdy
nie miał rozgrzewki/pigułek/free-nav — to zamierzone. Cała opisana
funkcjonalność żyje w starym StudentHomeworkScreen.tsx (v1) i tam nadal
działa bez zmian. Zapytałem Macieja wprost (dwie opcje: wyłączyć flagę vs.
przepisać v2 pod model batch/free-nav) — wybrał rollback przez flagę.
Zmieniono `config/featureFlags.ts`: `HOMEWORK_ENGINE_V2` z `true` na `false`
(jedna linia — przełącznik zaprojektowany dokładnie do tego rollbacku,
komentarz w pliku to potwierdza). Skutek: Dashboard.tsx, HomeworkScreen.tsx
(widok lektora) i homeworkV2Client.ts już rozgałęziały się na tej samej
fladze, więc kursant i lektor wracają do v1 w tym samym commicie, bez
dotykania kodu ekranów.

Nie dokończone / do sprawdzenia:
- NIE zmieniono drugiej połowy przełącznika po stronie Cloud Functions
  (functions/src/homeworkV2/flag.ts, env var HOMEWORK_ENGINE_V2 w
  functions/.env / konsoli GCP) — to osobny deploy, nieproszony w tym
  zadaniu. Backend v2 nadal przyjmuje onCall, jeśli ktoś by go wywołał.
- NIE sprawdzono, czy jacyś żywi kursanci mają już przypisane zestawy
  specialTasks z engineVersion:2 — po rollbacku takie zadanie staje się
  niewidoczne w UI (ekran v1 filtruje wyłącznie v1), dopóki flaga nie
  wróci na true. Sprawdzić przed ogłoszeniem rollbacku, jeśli ktoś poza
  Maciejem miał już zadanie v2.

Decyzje architektoniczne: żadna zmiana architektury — czysty rollback
istniejącym przełącznikiem, zgodnie z decyzją Macieja po pytaniu wprost.

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani ścieżkach
tokenowych — jedna stała w config/featureFlags.ts. Ryzyko biznesowe: patrz
punkt o możliwym ukryciu już przydzielonych zadań v2 wyżej.

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Zwiększyć kontrast typografii w Notatniku A4 — zamienić kolory
pięciu predefiniowanych nagłówków sekcji lekcji na klasy Tailwind
text-*-700/800/900 (żądanie podało konkretne pary np. text-rose-700,
text-emerald-800) oraz upewnić się, że tekst podstawowy edytora ma
text-gray-900 zamiast text-gray-500.

Zrobione: Żądanie nie pasowało dosłownie do implementacji — kolory
nagłówków to surowe hexy wpisywane wprost w HTML dokumentu (nie klasy CSS),
świadomie dobrane w utils/notebookPalette.ts pod DWA motywy papieru naraz
jednym wspólnym heksem (~3,4:1 jasny / ~4,4:1 ciemny). Wcześniejszy,
ciemniejszy zestaw był już raz odrzucony w tym repo za psucie ciemnego
motywu (komentarz w kodzie to dokumentuje). Zapytałem Macieja wprost —
wybrał: osobne odcienie per motyw zamiast jednego ciemniejszego heksa dla
obu. Zmiany:
- utils/notebookPalette.ts: NOTEBOOK_COLORS[klucz] to teraz {light, dark}
  zamiast stringa; dark = bez zmian; light = nowy, ciemniejszy odcień
  (Tailwind 700-900: rose #9f1239, orange/amber-800 #92400e, green/
  emerald-800 #065f46, blue-800 #1e40af, violet-800 #5b21b6). Dodano
  notebookHeadingColor(klucz, paperTheme). Paleta paska narzędzi wydzielona
  do TOOLBAR_COLORS, celowo BEZ podziału light/dark (uzasadnienie w
  komentarzu przy stałej).
- utils/lessonTemplate.ts: LESSON_SECTIONS ma colorKey zamiast heksa;
  buildLessonTemplate przyjmuje nową opcję paperTheme (domyślnie 'light').
- components/scratchpad/ScratchpadEditor.tsx: oba wywołania
  buildLessonTemplate przekazują paperTheme ze stanu komponentu;
  zduplikowana inline'owa lista sekcji przy imporcie z Notion (~linia 1389)
  przestawiona na colorKey + notebookHeadingColor tak samo jak
  lessonTemplate.ts.
- Text-gray-900 dla tekstu podstawowego NIE dodany — już dziś steruje nim
  NOTEBOOK_INK (#2c2822 jasny / #eae8e3 ciemny) przez zmienną CSS --pad-fg,
  o WYŻSZYM kontraście niż text-gray-900 na białym tle. Dodanie martwej
  klasy Tailwind do systemu sterowanego zmienną CSS nic by nie zrobiło.

Nie dokończone / do sprawdzenia:
- Nie zweryfikowano wzrokowo w przeglądarce (brak dostępu do zalogowanej
  sesji) — sprawdzić realny kontrast nowych nagłówków na jasnym papierze
  i że ciemny papier wygląda bez zmian.
- Znana, zaakceptowana właściwość (nie wada tej zmiany): kolor nagłówka
  zamraża się w dokumencie w chwili wstawienia sekcji. Sekcja wstawiona na
  jasnym papierze i zapisana zachowa ten (ciemniejszy) odcień na zawsze,
  również po późniejszym przełączeniu kartki na ciemną — tak samo działa
  już dziś ręczne kolorowanie tekstu paskiem narzędzi w tym systemie.

Decyzje architektoniczne: podział jednej wspólnej wartości koloru na
light/dark per klucz w NOTEBOOK_COLORS — decyzja Macieja po pytaniu wprost,
udokumentowana w komentarzu w notebookPalette.ts.

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani ścieżkach
tokenowych bez logowania — wyłącznie warstwa prezentacji/generowania HTML
notatnika.

2026-09-20 — Claude Code / Sonnet 5

Zadanie: (1) Notatnik A4 — wyłączyć automatyczne wstawianie bloku "Lesson 1"
przy tworzeniu nowego notatnika i podnieść kontrast STARYCH, już zapisanych
nagłówków sekcji na jasnym papierze. (2) Adapter kanoniczny ćwiczeń pracy
domowej (normalizeExercise) — koniec zduplikowanych fallbacków w
HomeworkExercise.tsx, bezpieczna rozsypanka (bez TypeError na .word),
deterministyczne nagłówki przez i18next.

Zrobione:
- services/scratchpadService.ts: getInitialScratchpadContent() zwraca teraz
  puste { html: '', text: '' } zamiast buildLessonTemplate(...) — auto-wstaw
  działał wyłącznie przy TWORZENIU nowego notatnika (getOrCreateStudentScratchpad,
  ensureGroupScratchpad w services/groupService.ts), nie przy każdym otwarciu.
  Import buildLessonTemplate usunięty jako nieużywany.
- utils/notebookPalette.ts: nowa funkcja sanitizeFrozenHeadingContrast(html,
  paperTheme) — retroaktywnie podnosi kontrast starych <h3 style="color:...">
  z jednym z pięciu znanych tytułów sekcji, TYLKO przy wczytywaniu do edytora
  na jasnym papierze, bez zapisu do bazy.
- components/scratchpad/ScratchpadEditor.tsx: efekt ładujący docData.contentHtml
  do editorRef.current.innerHTML przepuszcza treść przez sanitizeFrozenHeadingContrast;
  dodano paperTheme do zależności efektu.
- tests/scratchpad.test.ts: zaktualizowany test getInitialScratchpadContent
  pod nowe (puste) zachowanie.
- Nowy utils/normalizeExercise.ts: normalizeExercise(raw, task?) → CanonicalExercise
  z czterema typami kanonicznymi (te same wartości co homeworkItemType() w
  utils/homework.ts — word_order/fill_in_the_blank/translation/find_errors,
  nie nowy enum), state ready/degraded/invalid (zero wyjątków), normalizeGapPayload()
  obsługujący 4 formaty luki (BLANK_n, ___, {{gap:n}}, wordsToCut+fullSentence),
  normalizeTokens() NIGDY nie odrzuca elementów rozsypanki (indeksy w answer
  wskazują na tę tablicę — filtrowanie rozjechałoby zapisane odpowiedzi),
  exerciseUiCopy() zwraca nagłówek/polecenie przez i18n.t().
- components/dashboard/HomeworkExercise.tsx: cztery typy (poza multiple_choice,
  nieopisanym w zleceniu, bez zmian) czytają teraz znormalizowany exercise
  zamiast powielonych łańcuchów item.a||item.b||item.c; dodana karta dla
  state 'invalid'.
- components/dashboard/StudentHomeworkScreen.tsx: dodany key={index} na
  <HomeworkExercise> — bez niego stan showHint przeciekał między pytaniami.
  answerToText/getExerciseReviewRows NIE dotknięte (poza zakresem, ryzyko
  regresji w zapisie/ocenie).
- en.json / pl.json: nowe klucze na nagłówki/polecenia ćwiczeń.
- Nowe testy: tests/normalizeExercise.test.ts (11 testów).

Nie dokończone / do sprawdzenia:
- Nic nie zweryfikowano wzrokowo w przeglądarce (brak dostępu do zalogowanej
  sesji) — sprawdzić: nowy notatnik startuje pusty; stare lekcje mają czytelne
  nagłówki na jasnym papierze; rozsypanka/luki/tłumaczenie/poprawa błędu
  faktycznie działają na koncie testowym kursanta.
- StudentHomeworkV2Screen.tsx (dziś nieużywany, HOMEWORK_ENGINE_V2=false)
  świadomie NIE dotknięty — jeśli v2 kiedyś wróci, ten ekran nadal ma stare,
  zduplikowane fallbacki.

Decyzje architektoniczne: zapytałem Macieja wprost przed adapterem homeworku —
(1) i18next zamiast hardkodowanej stałej EXERCISE_UI_COPY (CLAUDE.md §4);
(2) zakres tylko v1 (żywa ścieżka), nie StudentHomeworkV2Screen.tsx. Typ
kanoniczny w normalizeExercise.ts celowo NIE wprowadza nowego enuma
(UNSCRAMBLE/GAP_FILL/...) opisanego w pierwotnym zleceniu — użyto istniejących
wartości HomeworkType, żeby nie rozdwajać systemu typów w repo.

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani ścieżkach
tokenowych bez logowania. Zmiana notatnika w warstwie prezentacji/generowania
HTML. Zmiana homeworku ograniczona do ekranu v1.

---

2026-09-20 — Claude Code / Sonnet 5

Zadanie: (1) Usunąć OpenAI (GPT-4o, GPT-5.6 Luna) z kaskady generowania
pracy domowej — zgłoszenie mówiło o Live Monitorze pokazującym sekwencję
Gemini 2.5 Flash -> Gemini 3.8 Flash -> GPT-4o mini -> GPT-5.6 Luna
(timeout 7500ms) przy generatorze zadań. Jedynym dopuszczalnym modelem ma
być gemini-2.5-flash z thinkingBudget:0, błąd Gemini ma iść wprost do
lektora zamiast być maskowany przejściem na inny dostawcę. (2) Kontrast
przycisku "Koło Fortuny" w Notatniku A4 — jaskrawożółty tekst niewidoczny
na jasnym tle.

Zrobione:
- services/aiModels.ts: nowa stała HOMEWORK_GENERATION_MODELS =
  [PRIMARY_MODEL] (gemini-2.5-flash), celowo odrębna od AI_MODEL_CASCADE
  (ta zostaje niezmieniona — obsługuje czat/planer/generator zdań poza
  kreatorem HW, gdzie zejście na OpenAI wciąż jest pożądaną siecią
  bezpieczeństwa).
- services/homeworkGenerator.ts: MODELS_FOR_HOMEWORK -> 
  HOMEWORK_GENERATION_MODELS. askForJson() stracił gałąź "narada awaryjna"
  (runCouncil z DEFAULT_COUNCIL, który miał włączonego GPT-4o mini jako
  recenzenta) — to ona realnie sprowadzała OpenAI z powrotem mimo
  MODELS_FOR_HOMEWORK. Błąd (w tym pusta odpowiedź / niesparsowalny JSON)
  leci teraz bez łapania dalej, z oryginalnym komunikatem od Gemini.
  Dodano thinkingConfig:{thinkingBudget:0} i console.log surowego payloadu
  (systemInstruction+prompt) przed wywołaniem. maxRetries podniesiony z 1
  do 2 w generateTextWithUnifiedFallback (= próba + jeden retry sieciowy),
  timeout z 7500ms do 15000ms (bez innych dostawców jako siatki
  bezpieczeństwa jeden model potrzebuje więcej marginesu).
- generateTranslations/generateGaps (ten sam plik) — te dwa typy zadań nie
  idą przez askForJson, tylko wprost przez generateTranslationExercises/
  generateFillInTheBlankExercises w services/geminiService.ts. Dodano tam
  opcjonalny parametr modelsOverride NA KOŃCU listy argumentów (zero
  zmian w istniejących wywołaniach pozycyjnych spoza HW, np.
  AIExerciseGeneratorScreen.tsx) i homeworkGenerator.ts przekazuje przez
  niego HOMEWORK_GENERATION_MODELS + thinkingConfig. Bez tego oba typy
  nadal chodziłyby po pełnej kaskadzie z OpenAI mimo naprawy w askForJson.
- components/scratchpad/ScratchpadEditor.tsx i
  ScratchpadTeacherCompanionDrawer.tsx: przycisk Koła Fortuny stracił
  klasy dark:text-amber-* i dostał stały, nieprzezroczysty jasny "badge"
  (bg-amber-50 / border-amber-300 / text-amber-900, font-medium).

Decyzje architektoniczne: w tym repo Tailwind 4 NIE ma zdefiniowanego
@custom-variant dark oparty o klasę .dark (sprawdzone w index.css) —
dark: domyślnie czyta prefers-color-scheme SYSTEMU, nie motyw appki
(ThemeContext przełącza .dark/.light na <html>, ale Tailwind tego nie
widzi). Stąd realna przyczyna zgłoszonego buga: przy jasnym motywie
appki i ciemnym motywie systemu wygrywał dark:text-amber-300 na jasnym
tle. To potwierdza, a nie tylko podejrzewa, przyczynę znanego długu z
CLAUDE.md/CHANGELOG (~1169 wystąpień text-white / dark: nieprzetestowanych
w trybie dziennym) — naprawiono tu tylko ten jeden przycisk (x2 miejsca),
reszta zostaje jako dług, bo to spory, osobny zakres.

Nie dokończone / do sprawdzenia:
- Nic nie zweryfikowano wzrokowo w przeglądarce ani na Live Monitorze na
  koncie testowym — sprawdzić: (1) "Układam zadania" w kreatorze HW
  pokazuje na Live Monitorze wyłącznie Gemini 2.5 Flash, (2) wymuszony
  błąd Gemini (np. zły klucz) pokazuje w UI treść błędu od Google, nie
  ciche przejście na inny model, (3) przycisk Koła Fortuny czytelny w
  obu ustawieniach motywu systemu.
- Analiza `dark:` vs `.dark` to systemowy problem szerszy niż ten
  przycisk — nie naprawiane całościowo, poza zakresem zlecenia.

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani ścieżkach
tokenowych bez logowania. Zmiana modeli ograniczona do ścieżki
generowania pracy domowej — AI_MODEL_CASCADE/DEFAULT_COUNCIL używane przez
czat/planer/generator zdań poza kreatorem HW celowo nie dotknięte.
Weryfikacja: npx tsc --noEmit (0 błędów), npm test (456/456), npm run
build (przechodzi).

---

2026-09-20 (2) — Claude Code / Sonnet 5

Zadanie: P0 — notatnik kursanta co wejście dubluje treść ("Dopisane
z notatnika roboczego — [data]" + kolejny blok "Lesson 1" dokleja się
wielokrotnie). Zlecenie zakładało automatyczny trigger w useEffect/hooku
synchronizacji/onSelectStudent/montowaniu i prosiło o przeszukanie m.in.
useScratchpad, useNotebookSync, CollaborativeNotebook.tsx,
StudentNotebookView.tsx.

Zrobione:
- Sprawdzono: żaden z wymienionych plików/hooków (useScratchpad,
  useNotebookSync, CollaborativeNotebook.tsx, StudentNotebookView.tsx) nie
  istnieje w repo (`find` po nazwach — zero wyników).
- grep po dosłownej frazie "Dopisane z notatnika roboczego" znalazł JEDNO
  miejsce: adoptScratchpadForStudent() w services/scratchpadService.ts,
  wołane z DOKŁADNIE jednego miejsca: handleAssignStudent() w
  TeacherScratchpadScreen.tsx, na onClick przycisku w liście kandydatów
  (jawne kliknięcie, nie useEffect/onChange/mount).
- Zweryfikowano, że otwieranie notatnika kursanta z CRM/Cockpitu
  (StudentDatabaseScreen.tsx, StudentOperationalHub.tsx,
  TeacherLessonHistoryView.tsx — wszystkie przez
  openScratchpadTab(`sp_${student.id}`) -> getScratchpadById()) jest
  czystym odczytem, bez żadnego zapisu — ten fragment wymagania (2) był
  już spełniony przed zmianą.
- Prawdziwy mechanizm: `/scratchpad` bez `?id=` (zakładka "Notatnik" w
  AdminPanel.tsx) tworzy przy KAŻDYM wejściu nowy roboczy dokument
  (sp_<Date.now()>) z treścią domyślnego szablonu lektora
  (getDefaultTemplate() w getOrCreateStudentScratchpad, może zawierać
  "Lesson 1"). Klik "Przypisz kursanta" -> wybór tego samego kursanta w
  KAŻDEJ takiej świeżej karcie dopisywał tę treść do jego stałego
  notatnika bez ostrzeżenia. To "przypisanie", nie "wejście do notatnika
  kursanta", duplikowało treść.
- Naprawa (Human-in-the-loop, bez usuwania funkcji — zlecenie punkt 2
  wprost dopuszcza manualne przenoszenie z potwierdzeniem, nie żąda
  likwidacji): nowa wouldAppendToExistingNotes(student, teacher) w
  scratchpadService.ts (czysty odczyt, wydzielona wspólna
  isScratchpadUntouched() używana też przez adoptScratchpadForStudent).
  handleAssignStudent() woła ją PRZED adoptScratchpadForStudent — jeśli
  dopisanie faktycznie by nastąpiło, window.confirm() (wzorzec już
  używany w repo) z jawną treścią o dopisaniu, nic nie nadpisujące.
  Odmowa przerywa operację przed jakimkolwiek zapisem. Pierwsze
  przypisanie (notatnik kursanta wciąż pusty) pomija potwierdzenie.

Nie dokończone / do sprawdzenia:
- Nic nie zweryfikowano wzrokowo w przeglądarce — sprawdzić na koncie
  testowym: (1) świeży "Notatnik roboczy" + przypisanie kursanta BEZ
  wcześniejszych notatek nie pokazuje potwierdzenia, (2) przypisanie
  kursanta z istniejącymi notatkami pokazuje confirm() i "Anuluj" nic nie
  zapisuje, (3) symulacja z zadania (klik kursant A -> lista -> klik
  kursant A) — była już bezpieczna PRZED tą zmianą (czysty odczyt przez
  getScratchpadById), potwierdzić że nadal tak jest.

Decyzje architektoniczne: nie usunięto adoptScratchpadForStudent ani
przycisku "Przypisz kursanta" — to jedyny istniejący sposób przenoszenia
notatek z trybu roboczego do kursanta, a zlecenie punkt 2 dopuszcza go
jako operację manualną z potwierdzeniem. Nie tworzono osobnego,
nowego przycisku "Przepisz z roboczego" — istniejący przepływ przypisania
już jest jawnym kliknięciem, brakowało tylko potwierdzenia przy realnym
ryzyku (dopisanie do niepustego dokumentu).

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani ścieżkach
tokenowych bez logowania. Brak zmian w domyślnym zachowaniu
getOrCreateStudentScratchpad/getScratchpadById. Grupowe notatniki
(ensureGroupScratchpad w services/groupService.ts) nie dotknięte — nigdy
nie miały logiki dopisywania.
Weryfikacja: npx tsc --noEmit (0 błędów), npm test (456/456), npm run
build (przechodzi).

2026-09-20 — Claude Code / Sonnet 5

Zadanie: Iteracja 1 sprintu notatnika — fundament modelu blokowego
(ScratchpadBlock) za flagą SHARED_NOTEBOOK_V2, jako rozszerzenie
hybrydowe obok istniejącego contentHtml, bez migracji starych
dokumentów i bez rewrite'u ScratchpadEditor.

Zrobione:
- config/featureFlags.ts: SHARED_NOTEBOOK_V2 = false +
  isSharedNotebookV2Enabled() (override przez localStorage
  scratchpad_shared_notebook_v2 albo VITE_SHARED_NOTEBOOK_V2).
- types.ts: ScratchpadBlockType, ScratchpadBlock, ScratchpadDocument.blocks?
  (opcjonalne).
- utils/scratchpadBlocks.ts (nowy): htmlToBlocks (fallback wsteczny — cały
  HTML jako jeden blok text), blocksToHtml/blocksToText (serializacja
  z powrotem do HTML/tekstu, żeby stare widoki/eksport nie ucierpiały),
  getScratchpadBlocksOrFallback.
- services/scratchpadService.ts: saveScratchpadContent dostał opcjonalny
  5. parametr blocks?: ScratchpadBlock[] — pominięcie (wszystkie dzisiejsze
  wywołania) zachowuje dotychczasowe zachowanie 1:1.
- components/scratchpad/ScratchpadEditor.tsx: stan blocksState
  inicjalizowany/synchronizowany za flagą przez getScratchpadBlocksOrFallback;
  przy fladze wyłączonej zawsze null, reszta edytora (raw contentEditable na
  docData.contentHtml) bez zmian. Nie wpięte jeszcze w renderowanie/zapis —
  to fundament pod kolejną iterację.
- firestore.rules (linia ok. 682, zgoda w zleceniu): 'blocks' dopisane do
  hasOnly([...]) w regule update dla zapisu kursanta/gościa w
  scratchpads/{scratchpadId}. Nie zmienia, kto pisze — tylko rozszerza
  listę pól dozwolonych w tej ograniczonej ścieżce.
- tests/scratchpadBlocks.test.ts (nowy): 6 testów dla adaptera/serializera.
- CHANGELOG.md: wpis runda 41.

Nie dokończone / do sprawdzenia:
- Parsowanie HTML na wiele bloków (heading/vocabulary_pair/... osobno)
  celowo NIE zrobione — htmlToBlocks pakuje cały dokument w jeden blok
  text 1:1. To zadanie kolejnej iteracji.
- Renderowanie UI per-blok w ScratchpadEditor w ogóle nie istnieje —
  blocksState dziś tylko się liczy i synchronizuje, nic go jeszcze nie
  wyświetla ani nie edytuje.
- Nic nie klikane w przeglądarce — flaga jest domyślnie wyłączona,
  ScratchpadEditor nie zmienił zachowania widocznego dla użytkownika.

Decyzje architektoniczne: zero migracji istniejących dokumentów — blocks
jest polem opcjonalnym, fallback liczy się w locie i nigdy nie zapisuje
wstecz do Firestore. Nie przepisano edytora — zlecenie wprost tego
zabraniało.

Ryzyka: dotknięto firestore.rules — WYŁĄCZNIE dopisanie klucza 'blocks'
do istniejącej listy hasOnly() w regule update dla ograniczonej ścieżki
zapisu kursanta/gościa (linia ok. 682). Nie dotknięto allow get/list/
create/delete, scratchpadPins, middleware autoryzacji w server.ts ani
żadnej ścieżki tokenowej bez logowania. Zgoda na ten fragment była
wprost w treści zlecenia.
Weryfikacja: npx tsc --noEmit (0 błędów), npm test (462/462, w tym 6
nowych), npm run test:rules (44/44 na emulatorze), npm run build
(przechodzi).

---

2026-09-20 (3) — Claude Code / Sonnet 5

Zadanie: Wykonać obszerny dokument "P0 Homework Hotfix" (master prompt
wklejony przez Macieja) — kanoniczna rozgrzewka z oceną
correct/close/incorrect i trwałym zapisem próby, twardy guard modeli
homework (wyłącznie gemini-2.5-flash) na wszystkich osiągalnych ścieżkach
v1/v2/Express, oraz statyczny e-mail bez generowania przez AI.

Zrobione: pełny opis w CHANGELOG.md, sekcja "AJ" (2026-09-20). Skrót:
- Re-audyt na starcie (git log, grep) wykazał, że część założeń dokumentu
  zlecenia była już nieaktualna — dwa wcześniejsze commity tej samej sesji
  (0162cff, 5081140) częściowo naprawiły adapter v1 i guard modeli, ale
  WYŁĄCZNIE dla HomeworkExercise.tsx/askForJson, nie dla rozgrzewki ani
  pozostałych generatorów/ocen. Każdy punkt dokumentu zweryfikowano kodem
  przed zmianą zamiast wykonać go ślepo.
- Nowe: utils/warmupRounds.ts (kanoniczny adapter rozgrzewki przez
  normalizeExercise + exerciseUiCopy), utils/unscrambleGrading.ts
  (classifyUnscrambleAttempt — multiset, nie Set).
- components/dashboard/HomeworkWarmupScrambler.tsx: przepisany na
  buildWarmupRounds, obsługa correct/close/incorrect (close nie blokuje,
  statyczny komunikat i18n "Byłeś/Byłaś blisko!", aria-live), nowy prop
  onAttemptResult.
- Trzej wywołujący rozgrzewki podłączeni: StudentHomeworkScreen.tsx
  (natychmiastowy zapis do specialTasks.studentAnswers.warmup.<i>, oraz
  naprawa handleSubmit żeby finalny zapis po ścieżkach nie kasował tej
  mapy), DirectHomeworkScreen.tsx (zbiera próby lokalnie, wysyła w
  istniejącym /api/homework/direct-submit, rozszerzonym o zwalidowane pole
  warmupAttempts), AIExerciseGeneratorScreen.tsx (bez zapisu — brak
  istniejącego modelu prób dla tego ekranu).
- Guard modeli: HOMEWORK_GENERATION_MODELS jako literał ['gemini-2.5-flash']
  as const + assertHomeworkModelAllowed w services/aiModels.ts, wołany
  przed KAŻDYM wywołaniem dostawcy (poza pętlami retry) w:
  generateTranslationExercises, generateFillInTheBlankExercises,
  evaluateTranslations (dotąd NIE miało override mimo wołania z homework),
  processBulkSentences, generateHomework (legacy), evaluateErrorCorrectionSentence,
  evaluateTeacherHomework. generateHomeworkChatPipeline przepisany od zera —
  koniec OpenAI w kroku 1 i w kaskadzie kroku 2, koniec cichych placeholderów
  ("Sample English sentence") i stałej etykiety modelUsed.
- Homework v2: functions/src/homeworkV2/openai.ts — OpenAI całkowicie
  usunięte z V2_MODEL_CASCADE i z createAiCall (potwierdzone rg jako
  bezpieczne — createOpenAiCall był martwy). endpoints.ts — OPENAI_API_KEY
  zdjęty z trzech onCall (sekret globalny nietknięty dla innych funkcji).
  server.ts /api/homework-v2/generate — dodana brakująca bramka
  isHomeworkEngineV2Enabled() (import wprost z functions/src/homeworkV2/flag.ts,
  ten sam wzorzec co istniejący import createAiCall z tego katalogu) +
  usunięty przekazywany openAiApiKey.
- Email: services/homeworkGenerator.ts — generatePersonalizedHomeworkNote
  (wołało AI przy KAŻDYM otwarciu modala) zastąpione buildStaticHomeworkNote
  (deterministyczne, 2 zdania: wołacz + temat + link). Stara funkcja i jej
  jedyny test usunięte (rg potwierdził zero innych callerów).
  HomeworkEmailConfirmationModal.tsx: init przez statyczną funkcję,
  przycisk "Odśwież z AI" -> "Przywróć domyślną treść" (ta sama funkcja).
- TeacherSpecialTaskModal.tsx: poprawione trzy hardkodowane, mylące napisy
  UI ("OpenAI (GPT-4o mini) -> Gemini 3.1 Flash") na "Gemini 2.5 Flash" —
  opisywały generateHomeworkChatPipeline, który już go nie woła.
- Nowe testy: unscrambleGrading.test.ts (8), warmupRounds.test.ts (8),
  homeworkModelGuard.test.ts (6, w tym dowód rzucania PRZED wywołaniem
  sieci), +4 w normalizeExercise.test.ts, przepisany emailNotifications.test.ts
  (-1/+2), zaktualizowany homeworkV2Pipeline.test.ts (kaskada bez OpenAI —
  dokładnie ten test, o którym ostrzegał dokument zlecenia).

Nie dokończone / do sprawdzenia:
- Scenariusz manualny w przeglądarce NIE wykonany — brak w tej sesji
  dostępu do interaktywnej przeglądarki i kredytów/kluczy produkcyjnych.
  Do zrobienia na koncie testowym: (1) rozgrzewka, złapać "close" na
  właściwych słowach w złej kolejności, sprawdzić komunikat + aktywny
  "Dalej", (2) sprawdzić w Firestore specialTasks.studentAnswers.warmup,
  (3) sprawdzić na Live Monitorze, że każdy generator/ocena pracy domowej
  pokazuje wyłącznie Gemini 2.5 Flash.
- Produkcja: brak weryfikacji wdrożonej rewizji Functions vs lokalny HEAD,
  brak weryfikacji produkcyjnej wartości HOMEWORK_ENGINE_V2 — brak w tej
  sesji dostępu do `firebase`/poświadczeń (ten sam ograniczenie co
  poprzednie sesje, patrz CLAUDE.md sekcja 5 o node@22).
- Plik functions/src/homeworkV2/openai.ts zachował swoją nazwę mimo że nie
  zawiera już żadnego kodu OpenAI (tylko historyczny identyfikator modułu,
  importowany w kilku miejscach jako `./openai` — zmiana nazwy pliku
  wymagałaby dotknięcia 6+ importów bez żadnej zmiany zachowania, celowo
  pominięte jako niezwiązany refaktor).

Decyzje architektoniczne:
- Zapis próby rozgrzewki w POLU studentAnswers.warmup zamiast nowego pola
  top-level w specialTasks — unika zmiany firestore.rules (pole
  studentAnswers już jest w hasOnly() dla zapisu kursanta; reguła sprawdza
  tylko klucze najwyższego poziomu, nie zagnieżdżenie). To był świadomy
  wybór właśnie po to, żeby NIE dotykać obszaru wysokiego ryzyka z
  CLAUDE.md sekcja 3 bez wcześniejszej zgody.
- DirectHomeworkScreen (token bez logowania) NIE dostał symetrycznego
  natychmiastowego zapisu jak StudentHomeworkScreen — token-owy kursant nie
  ma stałego połączenia z Firestore, więc jedyny bezpieczny, autoryzowany
  moment zapisu to istniejący, jednorazowy POST /api/homework/direct-submit.
  Rozgrzewkowe próby są więc trwale zapisane dopiero przy finalnym
  oddaniu pracy, nie od razu — udokumentowana asymetria, nie przeoczenie.
- fill_in_the_blank nie dostaje rundy rozgrzewki bez jawnego correctSentence/
  fullSentence od generatora — rekonstrukcja pełnego zdania z samych
  segmentów luk i banku słów (bez gwarancji kolejności) byłaby zgadywaniem,
  którego CLAUDE.md wprost zabrania.
- Brak wersji angielskiej statycznego e-maila (mimo że dokument zlecenia
  o to prosił) — cały istniejący system mailingu jest sztywno polski (brak
  i18next w services/homeworkEmail.ts i functions/src/emailTemplate.ts,
  brak parametru języka), a lektor komunikuje się z kursantami wyłącznie
  po polsku. Dodanie i18n do jednej linijki notatki przy reszcie szablonu
  po polsku byłoby fikcyjną dwujęzycznością — świadome odstępstwo od
  litery zlecenia, opisane też w CHANGELOG.md.

Ryzyka: Brak zmian w firestore.rules (zapis rozgrzewki mieści się w już
dopuszczonym polu studentAnswers), middleware autoryzacji (requireFirebaseAuth
nietknięty) ani w interpretacji tokenu w homework/direct/:token (rozszerzono
wyłącznie ciało żądania o jedno, zwalidowane po stronie serwera pole).
Realna, przetestowana zmiana zachowania: handleSubmit() w
StudentHomeworkScreen.tsx zapisuje teraz studentAnswers po pojedynczych
ścieżkach (studentAnswers.0, studentAnswers.1, ...) zamiast jednym obiektem
zbiorczym — konieczne, żeby nie kasować wcześniej zapisanej mapy warmup, ale
to zmiana w działającej, żywej ścieżce finalnego oddania pracy domowej;
przetestowana (490/490 testów), nie zweryfikowana wzrokowo end-to-end.
HOMEWORK_ENGINE_V2 pozostaje false po obu stronach (config/featureFlags.ts
i env Functions) — nic w tym zadaniu go nie włącza.
Weryfikacja: npx tsc --noEmit (0 błędów), npm test (490/490, baseline 462 +
28 nowych/zmienionych netto), npm run build (przechodzi, dist/server.cjs i
api/index.js przebudowane), git diff --check (czysto).

---

2026-09-21 — Claude Code / Sonnet 5

Zadanie: Pakiet stabilizacyjny P0 — (1) crash lifecycle w HomeworkWarmupScrambler
przy przejściu z dłuższej na krótszą rundę, (2) dvh/scroll pod klawiaturę iOS na
ekranach pracy domowej, (3) higiena kolorów amber/yellow w trybie jasnym,
(4) usunięcie zahardkodowanego mock-fallbacku zdania, (5) whitespace i toast
zamiast alert() w panelu sprawdzania prac lektora. Pełny opis: CHANGELOG.md
sekcja AK.

Zrobione:
- HomeworkWarmupScrambler.tsx: synchroniczny reset stanu rundy w handleNext()
  (ten sam event co setCurrentIndex), transitionLockRef, completeOnceRef,
  obronny guard w renderze (`if (!item) return null`). Root cause potwierdzony
  ręcznie: tymczasowe cofnięcie samego resetu odtworzyło dokładnie zgłoszony
  `TypeError: Cannot read properties of undefined (reading 'word')`.
- Usunięte canvas-confetti z HomeworkWarmupScrambler.tsx (import + wywołanie).
  HomeworkExercise.tsx nigdy go nie miał. Cztery komponenty w
  components/practice/ (PracticeZone — inny moduł, nie homework) zostawione
  bez zmian, celowo.
- Nowy test integracyjny tests/homeworkWarmupScrambler.test.tsx — PIERWSZY test
  renderujący React w tym repo. Dodano jsdom + @testing-library/react jako
  devDependencies (React 19 → @testing-library/react@16), npm test rozszerzony
  o tests/*.test.tsx. Trzy nowe data-testid w komponencie do stabilnego
  targetowania w teście.
- Higiena kolorów: wszystkie surowe klasy `amber-*` w HomeworkWarmupScrambler.tsx
  i HomeworkExercise.tsx zamienione na istniejące tokeny motywu (`warn`,
  `primary`, `info` — patrz design/theme/tokens.css + index.css @theme), NIE na
  dosłowne `text-slate-900` z dokumentu zlecenia (złamałoby tryb ciemny —
  decyzja architektoniczna niżej).
- DirectHomeworkScreen.tsx: `min-h-screen` → `min-h-[100dvh] overflow-y-auto` +
  `pb-36` na kontenerze treści (jedyny realny h-screen-bez-scrolla na ścieżce
  pracy domowej bez logowania).
- HomeworkScreen.tsx: handleSaveReview() — alert() sukcesu zamieniony na
  ActionToast (już istniejący, nieużywany dotąd w homework komponent
  components/ui/ActionToast.tsx). Błędy zostają jako alert() (zgodnie ze
  zleceniem: blokujące pop-upy tylko dla błędów).
- Osobny, niezwiązany commit PRZED tym zadaniem: dokończono zastane, nieukończone
  z poprzedniej sesji zmiany w services/homeworkGenerator.ts (wersja EN
  buildStaticHomeworkNote + deduplikacja tematu) — zastane w working tree na
  starcie sesji, przetestowane, wypchnięte osobno zgodnie z "jeden commit =
  jedna zmiana".

Nie dokończone / do sprawdzenia:
- Punkt (5) zlecenia: "zbędna pusta przestrzeń przed listą odesłanych prac" —
  NIE znaleziono w statycznej lekturze kodu HomeworkScreen.tsx/TeacherWorkScreen.tsx
  (activeTab domyślnie 'list', kreator i widok pracy ucznia nie renderują się
  na tej ścieżce). Możliwe że dotyczy stanu już naprawionego, innej roli/rozdzielczości,
  albo czegoś widocznego tylko w przeglądarce. Wymaga weryfikacji wzrokowej na
  koncie testowym lektora, z realnymi odesłanymi pracami do sprawdzenia.
- Punkt (4) zlecenia (dosłowny string "Czasami tracę poczucie czasu...") —
  NIE znaleziony w repo, bo hotfix P0 z dnia poprzedniego (commit 11e387e,
  CHANGELOG.md wpis AJ) już usunął cichy fallback w generateHomeworkChatPipeline.
  Zlecenie opisywało stan sprzed tamtej zmiany — nic do zrobienia poza
  potwierdzeniem (grep czysty).
- Manualny scenariusz w przeglądarce NIE wykonany (brak w tej sesji dostępu do
  interaktywnej przeglądarki) — patrz lista w CHANGELOG.md wpis AK, ostatni
  akapit.
- StudentHomeworkScreen.tsx/HomeworkExercise.tsx świadomie NIE dostały zmiany
  h-screen→dvh — renderują się już wewnątrz przewijalnej powłoki
  Dashboard.tsx (`h-[100dvh]` na korzeniu), więc nie miały tego problemu.

Decyzje architektoniczne:
- Zlecenie dosłownie prosiło o `text-slate-900`/`bg-slate-100` do poprawy
  kontrastu w trybie jasnym. Użyto zamiast tego istniejących tokenów motywu
  (`warn`/`primary`/`info`), bo repo ma już pełny, zweryfikowany system
  przełączania kolorów przez `data-theme` (patrz design/theme/tokens.css,
  index.css @theme block) — dosłowne hardkodowanie złamałoby tryb ciemny
  (niewidoczny ciemny tekst na granatowym tle). Zgodne z CLAUDE.md sekcja 4:
  "kolory przez tokeny, nie surowe klasy".
- Panel wyniku "close" w rozgrzewce zmieniony z amber na token `info`
  (niebieski), nie na primary/emerald jak "correct" — celowo inny kolor niż
  sukces, żeby kursant nadal widział różnicę między "poprawnie" a "blisko",
  mimo usunięcia ostrzegawczego amber.
- Pierwsza w repo infrastruktura testów renderujących React (jsdom +
  @testing-library/react jako nowe devDependencies, npm test rozszerzony o
  tests/*.test.tsx) — uzasadnione wprost wymaganym w zleceniu testem
  integracyjnym dla komponentu, którego nie da się sensownie przetestować
  bez montowania. jsdom ustawiany lokalnie w pliku testu, nie globalnie, żeby
  nie spowolnić/nie zmienić zachowania pozostałych, czysto logicznych testów.

Ryzyka: Brak zmian w firestore.rules, middleware autoryzacji ani interpretacji
tokenu homework/direct/:token (DirectHomeworkScreen.tsx dostał wyłącznie
kosmetyczną zmianę klas Tailwind, zero zmiany logiki/zapytań). Nowe
devDependencies (jsdom, @testing-library/react) używane wyłącznie w nowym
pliku testowym — zweryfikowano npm run build bez wpływu na dist/.
Weryfikacja: npx tsc --noEmit (0 błędów), npm test (495/495), npm run build
(przechodzi).

2026-09-21 — Claude Code / Sonnet 5

Zadanie: Etap 1 pakietu stabilizacyjnego P0 (zlecenie: lifecycle rozgrzewki,
klawiatura iOS, higiena kolorystyczna + ikona zgłaszania błędów, likwidacja
mocka generatora, szablon e-maila, whitespace/toasty w panelu lektora,
naprawa uprawnień Firestore przy odrzucaniu lekcji). Przed startem
sprawdzono AGENT_LOG.md i git log — punkty 1, 2, 4, 5 i większość 6 były już
zrobione w poprzedniej sesji (commity c3b47db…1c728e1); to zadanie
domyka resztę i weryfikuje całość od nowa.

Zrobione:
- Firestore (punkt 7, realna dziura, nie kosmetyka): `rejectedNotionLessons`
  (subkolekcja użytkownika, zapisywana przez `rejectNotionLesson()` /
  `restoreRejectedNotionLesson()` w services/lessonRecord.ts) nie miała W
  OGÓLE reguły w firestore.rules — stąd "Missing or insufficient
  permissions" przy odrzucaniu sugerowanej lekcji z Notion w AdminPanel.tsx
  (handleRejectNotionLesson). Dodano `isValidRejectedNotionItem()` i blok
  `match /rejectedNotionLessons/{rejectedId}` (read: właściciel/admin,
  create/update/delete: tylko admin/lektor — pisze tylko AdminPanel).
  Sprawdzono `npm run test:rules` na emulatorze: 44/44 zielone, żadna
  istniejąca reguła się nie zepsuła.
- AdminPanel.tsx `handleRejectNotionLesson`: optymistyczna aktualizacja UI
  (lekcja znika z listy i trafia na listę odrzuconych ZANIM zapis w
  Firestore się zakończy), z rollbackiem obu list przy błędzie — zgodnie z
  wymogiem zlecenia p. 7.3.
- Ikona zgłaszania błędu (components/ui/BugReporter.tsx): przeniesiona z
  fixed bottom-right (kolidowała z przyciskami "Dalej"/"Wstecz"/"Odeślij"
  na dole ekranów zadań na telefonie) na fixed top-16 right-4 (pod stałym
  nagłówkiem `TopBar`, h-14). Rozmiar ikony zmniejszony do w-7 h-7,
  `opacity-30 hover:opacity-100`. Skorygowano system kolejkowania dolnego
  rogu w index.css (`--rail-bug` z 60px na 0px, klasa `.rail-bug` usunięta
  całkowicie) — bug nie zajmuje już miejsca w tej kolejce, więc `.rail-notice`
  (toasty, powiadomienia o pracach domowych) nie ma już sztucznego odstępu
  po nieistniejącym już elemencie.
- `canvas-confetti`: kryterium akceptacji zlecenia mówiło wprost "zero
  wystąpień w projekcie", nie tylko w rozgrzewce/homework (jak sugerował
  punkt 1 opisu). Usunięto import i wywołania z całej reszty aplikacji, gdzie
  jeszcze zostały — components/practice/{FlashcardExercise,
  FillInBlankExercise,MatchExercise,QuizExercise}.tsx (ogólny tryb praktyki
  słownictwa, nieużywany w ścieżce prac domowych) — oraz usunięto
  `canvas-confetti`/`@types/canvas-confetti` z package.json i odświeżono
  package-lock.json przez `npm install`.
- Zweryfikowano od nowa (statyczna lektura kodu, bez przeglądarki) punkty
  1, 2, 3 (poza ikoną błędu), 4, 5 z opisu zlecenia — wszystkie już
  zaimplementowane w poprzedniej sesji i zgodne z literą zlecenia:
  HomeworkWarmupScrambler.tsx ma synchroniczny reset w handleNext,
  transitionLockRef, guard `if (!item) return null`, completeOnceRef,
  brak canvas-confetti, przyciski "Następne zdanie" aktywne przy
  correct/close. DirectHomeworkScreen.tsx ma `min-h-[100dvh]` + `pb-36`;
  StudentHomeworkScreen/HomeworkExercise renderują się już w przewijalnej
  powłoce Dashboard.tsx, więc nie potrzebowały zmiany. Etykiety "Wskazówka
  lektora"/"Zdanie z błędem" w HomeworkExercise.tsx używają tokenów motywu
  (primary/content/text-hi), zero amber/yellow/orange. homeworkGenerator.ts
  nie ma żadnego hardkodowanego zdania w catch. buildStaticHomeworkNote ma
  dokładnie te wzorce PL/EN i fallbacki, o które prosiło zlecenie.

Nie dokończone / do sprawdzenia:
- Punkt 6.1 zlecenia ("zbędna pusta przestrzeń przed listą odesłanych prac
  lektora") — jak w poprzedniej sesji, NIE znaleziono w statycznej lekturze
  HomeworkScreen.tsx (modal przeglądu ma `max-h-[50vh] overflow-y-auto`,
  karty odpowiedzi są kompaktowe) ani HomeworkV2ReviewScreen.tsx. Wymaga
  weryfikacji wzrokowej na koncie testowym lektora z realnymi odesłanymi
  pracami — możliwe, że problem jest widoczny tylko w danym stanie/układzie
  ekranu, którego nie odtworzono z samego kodu.
- Nowe top-16/right-4 umiejscowienie BugReporter.tsx NIE sprawdzone
  wzrokowo na telefonie — zmiana pozycji z dolnego prawego rogu (gdzie
  kolidowała z przyciskami akcji) na górny prawy, pod TopBar. Zakładam
  wysokość nagłówka h-14 (56px) + margines; jeśli któryś ekran ma inny/
  brak TopBar, może wymagać korekty offsetu.

Decyzje architektoniczne:
- DoD zlecenia ("Zero wystąpień canvas-confetti w projekcie") czytane
  literalnie, mimo że opis problemu w punkcie 1 mówił tylko o rozgrzewce/
  homework — usunięto bibliotekę całkowicie, nie tylko z zadań domowych.
- rejectedNotionLessons: create/update ograniczone do isAdmin() (lektor),
  nie isOwner() kursanta — bo w całym przepływie tylko AdminPanel.tsx
  (panel lektora) zapisuje ten dokument; kursant nigdy nie inicjuje
  odrzucenia własnej lekcji z Notion.
- BugReporter: zamiast poprawiać kolizję przez z-index/kolejkę (rozwiązanie
  istniejące dla stosu dolnego prawego rogu — monitor/bug/toast), przeniesiono
  cały komponent poza tę kolejkę na górny prawy róg, bo problem nie był
  kolizją MIĘDZY elementami floating (to już było rozwiązane), a kolizją
  z przyciskami akcji w treści strony, które nie są częścią tego systemu.

Ryzyka: Dotknięto firestore.rules (obszar wysokiego ryzyka z CLAUDE.md §3) —
dodano WYŁĄCZNIE nowy blok `match /rejectedNotionLessons/{rejectedId}` +
nową funkcję walidacyjną, zero zmian w istniejących regułach. Przetestowano
na emulatorze (`npm run test:rules`, 44/44 zielone) przed commitem, zgodnie
z zasadą "zatrzymaj się i opisz problem" — opisane tutaj, zmiana jest
addytywna i nie zmienia dostępu do żadnej innej kolekcji.
Weryfikacja całości: npx tsc --noEmit (0 błędów), npm test (495/495),
npm run test:rules (44/44), npm run build (przechodzi).

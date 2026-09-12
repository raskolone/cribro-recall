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

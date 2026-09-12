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

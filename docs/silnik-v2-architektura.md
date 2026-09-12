# Silnik prac domowych v2 — architektura, env, koszt, monitoring

Dokumentacja wymagana przez Definition of Done zlecenia (Notion §18).
Rollback i backup: `docs/backup-restore-homework-v2.md`. Audyt stanu
wyjściowego: `docs/audyt-homework-v2.md`.

---

## 1. Gdzie co stoi

```
przeglądarka lektora                     Cloud Functions (us-central1)
─────────────────────                    ─────────────────────────────
HomeworkComposerV2  ──generateHomeworkV2──►  ContextAssembler ──► Firestore (lekcje)
                                             ExercisePlanner   (bez AI, deterministyczny)
                                             ExerciseGenerator ──► OpenAI
                                             QualityValidator  ──► OpenAI (osobne wywołanie)
                    ◄──── zadania ────────
                        (nic nie zapisane)

                    ──assignHomeworkV2────►  buildV2TaskPayload ──► specialTasks
                                                                     (engineVersion: 2)

przeglądarka kursanta
─────────────────────
StudentHomeworkV2Screen ─submitHomeworkV2Attempt─► GradingEngine    ──► OpenAI
                                                   FeedbackComposer ──► OpenAI
                                                   ProfileUpdater   ──► profile/homeworkV2
                        ◄─ feedback + stan ──────  zapis próby      ──► attempts/
                        (bez procentu)

                        ──autosave──────────────►  drafts/  (wprost z przeglądarki)
```

**Czego tu nie ma i być nie może:**

- **Notion przy generowaniu.** Paliwem jest wyłącznie zatwierdzona lekcja
  w Firestore. Notion to dokumentacja, nie runtime.
- **Klucza OpenAI w przeglądarce.** Frontend woła `httpsCallable`, klucz żyje
  w Secret Managerze i nie opuszcza `openai.ts`.
- **Gemini.** Kaskada v2 to wyłącznie OpenAI — walidator, który raz odpowiada
  z jednego dostawcy, a raz z drugiego, nie jest walidatorem.
- **`server.ts`.** Express na Vercelu obsługuje wyłącznie ścieżkę v1 i nie
  został tknięty.

### Pliki

| Plik | Rola |
|---|---|
| `functions/src/homeworkV2/contracts.ts` | **Źródło prawdy.** Rubryka, progi, drabinka podpowiedzi, strażniki typów, czysty scoring |
| `services/homeworkV2/contracts.ts` | Most re-eksportujący dla aplikacji i testów |
| `openai.ts` | Kaskada OpenAI, parsowanie JSON, log kosztu i latency |
| `coreKnowledge.ts` | Globalny rdzeń: naturalność, antywzorce, styl feedbacku, opis 3 typów |
| `contextAssembler.ts` | Paliwo z lekcji, pseudonimizacja, odsiewanie wymowy |
| `exercisePlanner.ts` | Rozkład typów i ostrzeżenia. **Bez AI** |
| `exerciseGenerator.ts` | Układanie i regeneracja zadań |
| `qualityValidator.ts` | Kontrola naturalności, osobne wywołanie |
| `gradingEngine.ts` | Trzy oceny obszarowe od modelu → rubryka liczy resztę |
| `feedbackComposer.ts` | Komunikat Asystenta Cribro |
| `learningProfile.ts` | Profil v2 i ReviewPlanner |
| `assignment.ts` | Kontrakt zgodności z v1 przy zapisie |
| `flag.ts` | Flaga po stronie funkcji |
| `db.ts` | Leniwy Firestore (kolejność inicjalizacji) |
| `pipeline.ts` / `endpoints.ts` | Orkiestracja i cztery `onCall` |

---

## 2. Zmienne środowiskowe i sekrety

| Gdzie | Nazwa | Wartość | Kto czyta |
|---|---|---|---|
| **Secret Manager** (Firebase) | `OPENAI_API_KEY` | klucz dedykowany dla v2 | `generateHomeworkV2`, `submitHomeworkV2Attempt` |
| **`functions/.env`** | `HOMEWORK_ENGINE_V2` | `true` / brak | wszystkie cztery `onCall` |
| **`config/featureFlags.ts`** | `HOMEWORK_ENGINE_V2` | stała `true` / `false` | panel lektora, ekran kursanta |
| **Vercel** (env vars) | `OPENAI_API_KEY` | **inny, stary klucz** | wyłącznie ścieżka v1 |

Ta sama nazwa w Secret Managerze i w Vercelu to dwa odizolowane magazyny
i dwie różne wartości. Nie mają ze sobą nic wspólnego.

```bash
npm run firebase:secrets:set -- OPENAI_API_KEY   # ustawia (separator -- konieczny)
npm run deploy:functions                          # bez tego funkcje trzymają starą wersję
```

`functions/.env` jest ignorowany przez git (łapie go wzorzec `.env`
z głównego `.gitignore`). **Klucza tam nie wpisuj** — idzie do Secret Managera.

**Obie flagi muszą być włączone.** Fail-safe jest zamierzony: sama
przeglądarka nie włączy silnika, a sama funkcja nie pokaże interfejsu.

---

## 3. Koszt

Modele: `gpt-5.6-luna` to nazwa logiczna, która mapuje się na **`gpt-4o`**
(`mapToActualOpenAIModel`, tak samo jak `server.ts:4`). Zapas to `gpt-4o-mini`.

Stawki wpisane w `openai.ts` (za milion tokenów):

| Model | Wejście | Wyjście |
|---|---|---|
| `gpt-4o` | $2.50 | $10.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |

### Ile wywołań na jeden zestaw

| Krok | Wywołań | Uwaga |
|---|---|---|
| Generowanie | **1** | Jedno na cały zestaw, nie na zadanie |
| Walidacja | **1 na zadanie** | Osobne wywołanie, z założenia |
| Regeneracja | **0–2 na zadanie** | Każda to regeneracja + ponowna walidacja |
| Ocena próby | **1 na próbę** | |
| Feedback | **1 na próbę** | Osobno od oceny, żeby model nie podciągał punktów pod ton |

### Szacunek dla zestawu 6 zadań

> **To są szacunki wyprowadzone z przewidywanej długości promptów, nie z pomiaru.**
> Prawdziwe liczby daje log — patrz §4. Po pierwszym realnym przebiegu warto tu wrócić.

| Etap | Szacowany koszt |
|---|---|
| Generowanie (≈3000 wej. / 1500 wyj.) | ~$0.023 |
| Walidacja 6 zadań (≈2500 wej. / 100 wyj. każde) | ~$0.044 |
| **Razem: ułożenie zestawu** | **~$0.07** ≈ 0,27 zł |
| Jedna próba kursanta (ocena + feedback) | ~$0.006 |
| 6 zadań × 3 próby (najgorszy przypadek) | ~$0.11 ≈ 0,44 zł |
| **Razem: pełny cykl, najgorszy przypadek** | **~$0.18** ≈ 0,70 zł |

Realnie taniej — większość odpowiedzi zamyka się na pierwszej albo drugiej
próbie, a regeneracje są wyjątkiem, nie regułą.

### Co ogranicza koszt

- **Maksymalnie dwie regeneracje** na zadanie. Twardy limit w `MAX_REGENERATIONS`.
- **Jedno wywołanie generatora** na cały zestaw, nie na zadanie.
- **Limit budżetu na projekcie OpenAI.** To jedyne zabezpieczenie działające
  niezależnie od błędu w kodzie — warto go ustawić.

---

## 4. Monitoring

Każde wywołanie modelu zostawia w Cloud Logging linię:

```
[hw-v2] wywołanie modelu
  taskName: "hw-v2/generate" | "hw-v2/validate" | "hw-v2/regenerate"
           | "hw-v2/grade" | "hw-v2/feedback"
  model: "gpt-5.6-luna"
  apiModel: "gpt-4o"
  latencyMs: 4210
  promptTokens: 2984
  completionTokens: 1502
  estimatedCostUsd: 0.022485
```

**Czego w logu nie ma i być nie może:** treści promptu, treści zadania
i odpowiedzi kursanta. Zlecenie mówi o tym wprost, a `aiMonitorService` z v1
trzyma `promptSnippet` — czyli dokładnie to, czego tutaj nie wolno.

### Jak to czytać

```bash
# Ostatnie wywołania silnika
PATH="/opt/homebrew/opt/node@22/bin:$PATH" \
  firebase functions:log --only generateHomeworkV2,submitHomeworkV2Attempt
```

W konsoli Google Cloud (Logs Explorer) przydatny filtr:

```
jsonPayload.message =~ "hw-v2"
```

### Na co patrzeć

| Sygnał | Co znaczy |
|---|---|
| `apiModel: "gpt-4o-mini"` przy generowaniu | Model wiodący odmówił — sprawdź limity konta |
| `latencyMs` > 30000 | Blisko limitu `httpsCallable` po stronie klienta |
| Dużo `hw-v2/regenerate` | Walidator odrzuca — materiał lekcji może być za ubogi |
| `requiresTeacherReview` w odpowiedzi oceny | Model miał pewność < 0,6; kursant nie został ukarany |
| `failed-precondition` | Flaga wyłączona. To nie jest awaria |

---

## 5. Co zostaje poza tym zleceniem

Świadomie niewdrożone, do osobnej decyzji:

- Typy 4–6 z banku: ułóż i odtwórz, parafraza, reakcja w sytuacji.
- Testy postępu (tryb `exam`) — schemat je przewiduje (`mode`), kod nie.
- `KnowledgeSyncService` z Notion — globalny rdzeń żyje w plikach repo.
- Kolejka „Wymaga uwagi" jako moduł. Flaga `requiresTeacherReview` jest
  zapisywana, ale nie ma ekranu, który by ją zbierał.
- Ocena mowy — `responseMode` jest w schemacie, runtime jest tekstowy.
- Interwały SRS dla homework v2. Fiszki działają bez zmian.

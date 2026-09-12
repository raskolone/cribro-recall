# Backup, restore i rollback — przed wdrożeniem silnika v2

Checklista wymagana przez §15 kanonicznej specyfikacji silnika v2. Do przejścia
**w całości** przed pierwszym uruchomieniem v2 na koncie z prawdziwymi kursantami.

Wartości tego projektu:

| Co | Wartość |
|---|---|
| Projekt Google Cloud | `gen-lang-client-0425391821` |
| Baza Firestore | `ai-studio-520a4841-33d0-41ef-829a-838ebc44072d` (**nie** `(default)`) |
| Region funkcji | `us-central1` |
| Lokalizacja bazy | `nam5` (multi-region US) |
| Flaga aplikacji | `HOMEWORK_ENGINE_V2` w `config/featureFlags.ts` |
| Flaga funkcji | zmienna środowiskowa `HOMEWORK_ENGINE_V2` |

> **Uwaga o bazie.** Projekt nie używa bazy `(default)`. Każde polecenie backupu,
> eksportu i przywracania musi podać `--database=ai-studio-520a4841-33d0-41ef-829a-838ebc44072d`.
> Polecenie bez tego przełącznika **zadziała bez błędu** i zrobi backup pustej
> bazy `(default)` — to jest dokładnie ten rodzaj pomyłki, którą widać dopiero
> przy próbie przywrócenia.

---

## 1. Audyt kolekcji i zależności — ✅ wykonany

`docs/audyt-homework-v2.md` §2.2. Kolekcje dotknięte przez v2:

| Kolekcja | Co robi v2 | Ryzyko |
|---|---|---|
| `specialTasks/{taskId}` | **dopisuje** dokumenty z `engineVersion: 2` | Nie mutuje dokumentów v1 |
| `specialTasks/{taskId}/attempts/{attemptId}` | nowa podkolekcja | Nie istnieje w v1 — nie ma czego zepsuć |
| `users/{uid}/profile/homeworkV2` | zapis wyników przez `LearningProfileUpdater` | Nowy dokument, **osobny** od profilu v1 — patrz §5 |
| `specialTasks/{taskId}/drafts/{draftId}` | szkice kursanta (autosave, wznowienie) | Nie istnieje w v1 |
| `users/{uid}/lessonRecords` | **tylko odczyt** (paliwo generatora) | Brak |

---

## 2. Backup — przez Firebase CLI, bez gcloud

> **Poprawka wobec pierwszej wersji tego dokumentu.** Pierwotnie opisywałem
> eksport przez `gcloud` do kubełka GCS z regionem `us-central1`. To było
> niepotrzebnie skomplikowane i w dodatku błędne: baza stoi w **`nam5`**
> (multi-region US), więc kubełek `us-central1` odrzuciłby eksport. Firebase CLI
> ma zarządzane backupy, które nie wymagają ani gcloud, ani kubełka.

### Stan zastany (sprawdzony 2026-09-12)

| Właściwość bazy produkcyjnej | Wartość |
|---|---|
| Lokalizacja | `nam5` |
| Point In Time Recovery | ⛔ **wyłączone** |
| Delete Protection | ⛔ **wyłączone** |
| Harmonogram backupów | ⛔ **brak** |

### ⚠️ W projekcie jest SZEŚĆ baz Firestore

```
ai-studio-103bf60d-6134-4dcf-97f6-1080bc759669
ai-studio-2c7f7324-d34d-49b9-b106-2c9fb49bbb23
ai-studio-520a4841-33d0-41ef-829a-838ebc44072d          ← PRODUKCJA
ai-studio-758dfd29-f476-4c27-b7fb-0590db65d0cd
ai-studio-cribro-db
ai-studio-cribrorecall-520a4841-33d0-41ef-829a-838ebc44072d
```

Ostatnia pozycja zawiera **ten sam sufiks UUID** co produkcja i różni się
wyłącznie wstawką `cribrorecall`. Przy kopiowaniu nazwy z terminala to jest
pułapka gotowa do zadziałania — backup zrobiony „prawie tej" bazy jest
bezwartościowy i zorientujesz się przy restore.

**Zawsze podawaj `-d ai-studio-520a4841-33d0-41ef-829a-838ebc44072d`.**

### Krok 1 — PITR i ochrona przed skasowaniem (30 sekund, największy zysk)

```bash
cd /Users/maciej/Code/cribro/recall

npm run firebase:db:protect
```

Skrypt włącza naraz:
- **Point In Time Recovery** — cofnięcie bazy do dowolnej chwili z ostatnich
  7 dni. To jest realna siatka bezpieczeństwa przy błędzie silnika, i to
  działająca od zaraz, bez czekania na nocny backup.
- **Delete Protection** — bazy produkcyjnej nie da się skasować jednym
  poleceniem.

### Krok 2 — harmonogram backupów

```bash
npm run firebase:backup:schedule
```

Codziennie, retencja 7 dni. Backupy są zarządzane przez Firestore i leżą poza
bazą — spełniają wymóg §15 („niezależny, automatyczny backup poza bazą
produkcyjną").

Sprawdzenie, że harmonogram istnieje:

```bash
npm run firebase:backup:list
```

---

## 3. Backup przed samym wdrożeniem

Przy włączonym PITR osobny ręczny backup nie jest konieczny — cofnięcie do
punktu sprzed wdrożenia masz z automatu. Wystarczy **zanotować czas**
przed włączeniem flagi:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

Ten znacznik jest tym, co podasz przy ewentualnym przywracaniu.

---

## 4. Sprawdzony restore

Restore ma być **sprawdzony**, nie założony. Przywracamy do osobnej bazy,
nigdy na produkcyjną:

```bash
# Co w ogóle jest do przywrócenia
npm run firebase:backup:list

# Przywrócenie do NOWEJ bazy (nie podmienia produkcji)
PATH="/opt/homebrew/opt/node@22/bin:$PATH" firebase firestore:databases:restore \
  --database cribro-restore-test \
  --backup <nazwa-backupu-z-listy>
```

**Kryterium przejścia:** baza `cribro-restore-test` powstaje, a liczba
dokumentów w `specialTasks` zgadza się z produkcją.

Skasuj ją po weryfikacji — kosztuje:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" firebase firestore:databases:delete cribro-restore-test
```

---

## 5. Nowy schemat za flagą — ✅ zrobione w Etapie 1

- `functions/src/homeworkV2/contracts.ts` — kontrakt v2 z `schemaVersion`,
  `promptVersion`, `modelVersion`, `engineVersion: 2`.
- `config/featureFlags.ts` → `HOMEWORK_ENGINE_V2 = false`.
- `functions/src/homeworkV2/flag.ts` → `requireHomeworkEngineV2()`.

Obie flagi muszą być włączone, żeby v2 zadziałało (fail-safe).

**Rozstrzygnięte w Etapie 4: v2 NIE dotyka profilu v1.** Wyniki idą do
`users/{uid}/profile/homeworkV2`, a `users/{uid}/profile/learningCurve` zostaje
wyłącznie dla v1. Profil v1 jest agregatem — dopisanie do niego wyników v2
przesunęłoby wyliczony poziom kursanta bez możliwości cofnięcia, a rollback ma
przywracać v1 do stanu sprzed, nie do stanu „v1 z domieszką liczb, których nigdy
nie policzył".

**W praktyce v2 nie mutuje ŻADNYCH danych v1.** Dopisuje dokumenty
`specialTasks` z `engineVersion: 2`, dwie nowe podkolekcje i jeden nowy dokument
profilu. Nic poza tym.

---

## 6. Dotychczasowe zestawy i wyniki działają dalej

| Sprawdzenie | Jak |
|---|---|
| Ekran kursanta v1 nie widzi zadań v2 | filtr `isV1Task()` w `StudentHomeworkScreen` i `AIExerciseGeneratorScreen` |
| Kursant bez zestawów v2 widzi swoją historię v1 | `fallback` w `StudentHomeworkV2Screen` |
| Panel lektora liczy zadania poprawnie | `AdminPanel`, `TeacherOverview` |
| Mail o pracy domowej nadal ma właściwą liczbę zadań | v2 zachowuje pole `sentences` |
| `notifyStudentOnHomework` nadal wychodzi wcześnie | v2 ustawia `skipAutoEmail: true` |
| Ocena v1 bez zmian | `evaluateTranslations` nietknięte |

**Kryterium przejścia:** `npm test` w całości oraz `npm run test:rules`.

---

## 7. Test pełnego przepływu na emulatorze

```bash
npm run emulators              # Firestore + Auth, projekt demo-cribro
npm run test:rules             # reguły, w tym nowa podkolekcja attempts
```

**Kryterium przejścia:** lektor generuje zestaw, wysyła z 1 ekranu, kursant
robi 3 próby z autosave i wznowieniem, dostaje feedback i stan — wszystko na
emulatorze, zanim cokolwiek dotknie produkcji.

---

## 8. Sprawdzony rollback

Rollback to **wyłączenie flagi**, nie cofanie wdrożenia i nie przywracanie bazy.

```bash
# 1. Funkcje: skasuj zmienną i wdróż ponownie.
#    (albo ustaw HOMEWORK_ENGINE_V2=false w functions/.env)
npm run deploy:functions

# 2. Aplikacja: HOMEWORK_ENGINE_V2 = false w config/featureFlags.ts
npm run build && npm run deploy:hosting
```

**Kryterium przejścia — sprawdź, nie zakładaj:**
- panel lektora pokazuje kreator v1,
- kursant widzi ekran v1 i swoje stare zadania,
- `onCall` silnika v2 odpowiada `failed-precondition`,
- dokumenty v2 **zostają w bazie** i nikomu nie przeszkadzają.

Dane v2 przeżywają rollback celowo: ich skasowanie byłoby nieodwracalne, a
powrót do v2 po naprawie ma nie zaczynać od zera.

---

## 9. Uruchomienie dla wszystkich — dopiero po punktach 1–8

Kolejność: najpierw jedno konto testowe, potem jeden prawdziwy kursant za zgodą,
dopiero potem reszta. Projekt jest w fazie testów po PR-ach #1–#4 — zakres
uzgodnij z Maciejem przed włączeniem flagi komukolwiek poza nim.

---

## Stan checklisty

| # | Punkt | Stan |
|---|---|---|
| 1 | Audyt kolekcji | ✅ `docs/audyt-homework-v2.md` |
| 2 | PITR + harmonogram backupów | ✅ wykonane 2026-09-12 |
| 3 | Znacznik czasu przed wdrożeniem | ⏳ zbędny osobny backup, gdy PITR działa |
| 4 | Sprawdzony restore do osobnej bazy | ⏳ przed włączeniem flagi |
| 5 | Schemat v2 za flagą | ✅ Etap 1; **obie flagi włączone 2026-09-12** |
| 6 | Zestawy v1 działają | ✅ straznik `isV1Task` + 33/33 testów reguł |
| 7 | Pełny przepływ na emulatorze | 🟡 reguły sprawdzone; pełny przebieg z modelem wymaga sekretu |
| 8 | Sprawdzony rollback | 🟡 flaga zaimplementowana po obu stronach, nieprzetestowana na wdrożeniu |
| 9 | Rollout | 🟡 flaga globalna — czynna dla wszystkich zalogowanych |

### Co zostało do sprawdzenia ręcznie

Kod Etapów 1–4 jest napisany i przetestowany jednostkowo, ale **żaden
przebieg end-to-end z prawdziwym modelem nie został wykonany** — brakuje
sekretu `OPENAI_API_KEY` po stronie Cloud Functions. Do zrobienia w tej
kolejności:

1. `firebase functions:secrets:set OPENAI_API_KEY`
2. `HOMEWORK_ENGINE_V2=true` w `functions/.env`
3. `npm run deploy:functions`
4. `HOMEWORK_ENGINE_V2 = true` w `config/featureFlags.ts`, potem `npm run deploy:hosting`
5. Wygenerowanie jednego zestawu na koncie testowym — sprawdzić w logach
   funkcji linię `[hw-v2] wywołanie modelu` (koszt i latency).
6. Przejście zestawu jako kursant: trzy próby, podpowiedzi, wzorzec,
   poprawiona wersja, autosave i wznowienie na drugim urządzeniu.
7. Rollback: wyłączenie flagi po obu stronach i sprawdzenie, że panel
   wraca do kreatora v1, a kursant widzi swoje stare zadania.

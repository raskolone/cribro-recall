# Backup, restore i rollback — przed wdrożeniem silnika v2

Checklista wymagana przez §15 kanonicznej specyfikacji silnika v2. Do przejścia
**w całości** przed pierwszym uruchomieniem v2 na koncie z prawdziwymi kursantami.

Wartości tego projektu:

| Co | Wartość |
|---|---|
| Projekt Google Cloud | `gen-lang-client-0425391821` |
| Baza Firestore | `ai-studio-520a4841-33d0-41ef-829a-838ebc44072d` (**nie** `(default)`) |
| Region funkcji | `us-central1` |
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
| `users/{uid}/profile/learningCurve` | zapis wyników przez `LearningProfileUpdater` | **Współdzielone z v1** — patrz §5 poniżej |
| `users/{uid}/lessonRecords` | **tylko odczyt** (paliwo generatora) | Brak |

---

## 2. Niezależny, automatyczny backup poza bazą produkcyjną — ⛔ NIE ISTNIEJE

**To jest blokada przed wdrożeniem, nie uwaga na marginesie.** W repo nie ma
żadnego skryptu eksportu ani harmonogramu backupu; `scripts/` zawiera wyłącznie
jednorazowe migracje (`backfill-task-owners.mjs`, `backfill-scratchpad-pins.mjs`).

Do wykonania **raz**, przez właściciela projektu (wymaga uprawnień
billingowych — agent AI tego nie założy):

```bash
# Kubełek na eksporty. Region musi odpowiadać lokalizacji bazy.
gcloud storage buckets create gs://cribro-recall-backups \
  --project=gen-lang-client-0425391821 \
  --location=us-central1 \
  --uniform-bucket-level-access

# Harmonogram dzienny, retencja 7 dni.
gcloud firestore backups schedules create \
  --project=gen-lang-client-0425391821 \
  --database=ai-studio-520a4841-33d0-41ef-829a-838ebc44072d \
  --recurrence=daily \
  --retention=7d

# Sprawdzenie, że harmonogram istnieje.
gcloud firestore backups schedules list \
  --project=gen-lang-client-0425391821 \
  --database=ai-studio-520a4841-33d0-41ef-829a-838ebc44072d
```

Backup wewnątrz tej samej bazy backupem nie jest — §2 specyfikacji mówi o tym
wprost przy Firestore („produkcyjna baza aplikacji, nie jest sama w sobie backupem").

---

## 3. Ręczny backup bezpośrednio przed wdrożeniem

```bash
STAMP=$(date +%Y%m%d-%H%M)
gcloud firestore export gs://cribro-recall-backups/pre-hw-v2-$STAMP \
  --project=gen-lang-client-0425391821 \
  --database=ai-studio-520a4841-33d0-41ef-829a-838ebc44072d
```

Zanotuj nazwę operacji z odpowiedzi i poczekaj na jej zakończenie:

```bash
gcloud firestore operations list \
  --project=gen-lang-client-0425391821 \
  --database=ai-studio-520a4841-33d0-41ef-829a-838ebc44072d
```

**Kryterium przejścia:** operacja w stanie `done: true`, a
`gcloud storage ls gs://cribro-recall-backups/pre-hw-v2-$STAMP` pokazuje pliki.

---

## 4. Sprawdzony restore do środowiska testowego

Restore ma być **sprawdzony**, nie założony. Przywracamy do osobnej bazy, nigdy
na produkcyjną:

```bash
# Baza testowa w tym samym projekcie.
gcloud firestore databases create \
  --project=gen-lang-client-0425391821 \
  --database=cribro-restore-test \
  --location=us-central1 \
  --type=firestore-native

gcloud firestore import gs://cribro-recall-backups/pre-hw-v2-$STAMP \
  --project=gen-lang-client-0425391821 \
  --database=cribro-restore-test
```

**Kryterium przejścia:** w bazie `cribro-restore-test` liczba dokumentów w
`specialTasks` zgadza się z produkcją, a losowy dokument ma komplet pól
(`studentUid`, `sentences`, `status`).

Bazę testową skasuj po weryfikacji — kosztuje.

---

## 5. Nowy schemat za flagą — ✅ zrobione w Etapie 1

- `functions/src/homeworkV2/contracts.ts` — kontrakt v2 z `schemaVersion`,
  `promptVersion`, `modelVersion`, `engineVersion: 2`.
- `config/featureFlags.ts` → `HOMEWORK_ENGINE_V2 = false`.
- `functions/src/homeworkV2/flag.ts` → `requireHomeworkEngineV2()`.

Obie flagi muszą być włączone, żeby v2 zadziałało (fail-safe).

**Jedyny punkt styku z danymi v1** to `users/{uid}/profile/learningCurve` —
v2 dopisze tam wyniki przez `LearningProfileUpdater`. Profil jest agregatem
(jeden dokument, nie kolekcja prób), więc zapis v2 **zmieni** liczby, na których
opiera się v1. Do rozstrzygnięcia w Etapie 4: albo v2 pisze do osobnego
dokumentu profilu, albo świadomie zasila wspólny. Domyślnie proponuję osobny —
rollback flagi ma zostawiać v1 dokładnie tak, jak było.

---

## 6. Dotychczasowe zestawy i wyniki działają dalej

| Sprawdzenie | Jak |
|---|---|
| Ekran kursanta v1 nie widzi zadań v2 | filtr `isV2Task()` w `StudentHomeworkScreen` |
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
| 2 | Automatyczny backup poza bazą | ⛔ **nie istnieje — blokada** |
| 3 | Ręczny backup przed wdrożeniem | ⏳ do wykonania przed Etapem 3 |
| 4 | Sprawdzony restore | ⏳ do wykonania przed Etapem 3 |
| 5 | Schemat v2 za flagą | ✅ Etap 1 |
| 6 | Zestawy v1 działają | ⏳ testy powstają w Etapach 2–4 |
| 7 | Pełny przepływ na emulatorze | ⏳ Etap 4 |
| 8 | Sprawdzony rollback | ⏳ Etap 4 |
| 9 | Rollout | ⏳ po akceptacji |

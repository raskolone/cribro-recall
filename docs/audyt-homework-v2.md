# Audyt Etap 0 — Homework Engine v2 (3 typy)

Raport z audytu zleconego w Notion: *Cribro Recall — kanoniczna specyfikacja silnika v2*,
sekcja **§18. Kanoniczne wytyczne dla AI wdrażającego system**.

**Zakres:** wyłącznie rozpoznanie. Żadnej zmiany w kodzie aplikacji. Ten plik i wpis
w `AGENT_LOG.md` są jedynymi nowymi plikami.

**Stan wyjściowy repo (zweryfikowany, nie deklarowany):**
`npx tsc --noEmit` — bez błędów. `npm test` — 163/163 przechodzą. `git status` — czysto,
HEAD na `36900d0`.

**Pętla do dowiezienia (z §3.1 i §18):**
zatwierdzona lekcja → plan 3 typów → zadania JSON → osobny walidator → 1 ekran podglądu →
Wyślij → 3 próby → rubryka 40/40/20 → feedback → `nowe|ćwiczymy|opanowane` → propozycja powtórki.

---

## 1. Co zostało przeczytane

`package.json`, `functions/package.json`, `firebase.json`, `firestore.indexes.json`,
`firestore.rules` (33 KB), `server.ts` (114 KB — trasy, middleware, warstwa AI, TTS),
`api/serverless.ts`, `vercel.json`, `functions/src/index.ts`, `functions/src/config.ts`,
`services/aiModels.ts`, `services/geminiService.ts`, `services/homeworkGenerator.ts`,
`services/learningProfile.ts`, `services/lessonRecord.ts`, `services/aiMonitorService.ts`,
`utils/homework.ts`, `utils/lessonBlocks.ts`, `utils/learningCurve.ts`,
`config/featureFlags.ts`, `hooks/useDraftAnswers.ts`, `components/admin/HomeworkComposer.tsx`,
`components/admin/TeacherSpecialTaskModal.tsx`, `components/admin/HomeworkEmailConfirmationModal.tsx`,
`components/dashboard/StudentHomeworkScreen.tsx`, `types.ts`, `tests/`, `tests/rules/`,
`CHANGELOG.md` §3, `CLAUDE.md`, `AGENTS.md`.

---

## 2. Mapa stanu obecnego

### 2.1. Typy zadań i ekrany

Dziś istnieje **pięć** typów pracy domowej (`types.ts`, `HomeworkType`):
`translation`, `find_errors`, `fill_in_the_blank`, `word_order`, `multiple_choice`.

Żaden z nich nie odpowiada 1:1 trzem typom v2. Najbliższe sąsiedztwo:

| Typ v2 | Najbliższy typ v1 | Czy da się użyć |
|---|---|---|
| `micro_translation` | `translation` | Forma podobna, ale v1 nie ma kontraktu oceny, wariantów, wymaganego materiału ani podpowiedzi z kontraktu. **Nowy typ, nie zmiana istniejącego.** |
| `fix_sentence` | `find_errors` | v1 ma `incorrectSentence`/`correctSentence`, brak typu błędu, brak drabinki podpowiedzi. **Nowy typ.** |
| `gap_from_context` | `fill_in_the_blank` | v1 daje bank słów i `blanks: Record<string,string>`; v2 wymaga wpisywania bez banku. **Nowy typ.** |

Ekrany:
- **Lektor tworzy zadania w dwóch miejscach:** `components/admin/HomeworkComposer.tsx`
  (kreator wielosekcyjny, już blisko „1 ekranu") oraz `components/admin/TeacherSpecialTaskModal.tsx`
  (starsze okno, tylko `translation` / `find_errors`).
- **Kursant rozwiązuje w:** `components/dashboard/StudentHomeworkScreen.tsx` (1939 linii,
  wszystkie 5 typów w jednym komponencie) oraz przez link bez logowania
  (`/api/homework/direct/:token`, `server.ts:666`).
- **Lektor ocenia w:** `AdminPanel.tsx` + `TeacherHomeworkNotification.tsx`
  (zapytanie `where('status','==','submitted')`).

### 2.2. Kolekcje i relacje

| Kolekcja | Rola | Właściciel dokumentu |
|---|---|---|
| `specialTasks/{taskId}` | **Prace domowe.** Płaska, wspólna dla wszystkich kursantów. | `studentUid` |
| `users/{uid}` | Konta, role, `hasNewHomework`, `hasGradedHomework` | `uid` |
| `users/{uid}/lessonRecords/{id}` | Lekcje (paliwo generatora) | `uid` |
| `users/{uid}/vocabularySets/{id}` | Zestawy słownictwa z lekcji | `uid` |
| `users/{uid}/profile/learningCurve` | Profil krzywej uczenia (jeden dokument, nie kolekcja prób) | `uid` |
| `users/{uid}/practiceLogs/{id}` | Log ćwiczeń | `uid` |
| `system/{doc}` | Ustawienia globalne (dziś tylko `system/mailing`) | admin |

Baza **nie jest** `(default)` — to nazwana instancja `ai-studio-520a4841-33d0-41ef-829a-838ebc44072d`
(`firebase.json`, `functions/src/config.ts`). Każdy nowy wyzwalacz i każdy `onCall`
piszący do Firestore musi to podać jawnie, inaczej trafi w pustą bazę bez ostrzeżenia.

### 2.3. Miejsca, które tworzą i oceniają zestawy

Tworzenie: `HomeworkComposer.tsx:265` i `TeacherSpecialTaskModal.tsx:422` — oba
`addDoc(collection(db,'specialTasks'), taskPayload)` **z przeglądarki**, nie z serwera.

Ocena: `StudentHomeworkScreen.tsx:618-670` — kursant klika „wyślij", przeglądarka woła
`evaluateTranslations()` (przez `/api/openai`) i **sama zapisuje wynik** do
`specialTasks.evaluationResults`.

> **Uwaga bezpieczeństwa (stan obecny, nie regresja v2):** reguła `specialTasks` pozwala
> kursantowi zapisać `evaluationResults` i `status`. Kursant może więc podstawić sobie
> własną ocenę. W v1 to tylko „prowizoryczny wynik" przed przeglądem lektora, ale w v2
> stan `opanowane` nie może powstawać po stronie klienta.

### 2.4. Modele AI — kod kontra decyzja §3.1

`services/aiModels.ts`:

```
PRIMARY_MODEL   = 'openai/gpt-5.6-luna'
SECONDARY_MODEL = 'gemini-3.8-flash'
TERTIARY_MODEL  = 'openai/gpt-4o-mini'
AI_MODEL_CASCADE = [PRIMARY, SECONDARY, TERTIARY, 'gemini-2.5-flash']
```

Rozjazd wobec zlecenia:
1. Zlecenie mówi **GPT-5.6**; w kodzie identyfikator brzmi **`gpt-5.6-luna`**. Do potwierdzenia,
   czy to ten sam model.
2. Zlecenie mówi **„nie dodawaj Gemini"**. Gemini **już jest** w kaskadzie v1 na pozycjach 2 i 4,
   a `handleOpenAI` (`server.ts:2313`) po wyczerpaniu modeli OpenAI schodzi do
   `GoogleGenAI`. Samo „nie dodawanie" nie wystarczy — ścieżka v2 musi mieć **własną kaskadę
   wyłącznie OpenAI**, inaczej walidator naturalności potrafi odpowiedzieć z Gemini.
3. Klucz OpenAI jest wyłącznie po stronie serwera (`OPENAI_API_KEY`, `.env.example`) i
   wywołanie idzie **surowym `fetch`** na `https://api.openai.com/v1/chat/completions`
   (`server.ts:119`, `server.ts:246`). Pakiet `openai` jest w `package.json`, ale
   **nie jest importowany w żadnym pliku** — zero miejsc użycia.

### 2.5. Czy Express jest tylko lokalny?

**Nie.** To ustalenie zmienia decyzję o runtime.

`api/serverless.ts` importuje `createApp()` z `server.ts` i eksportuje handler; `npm run build`
buduje go esbuildem do `api/index.js`; `vercel.json` przepisuje `/api/(.*)` na tę funkcję
z `maxDuration: 60`. Express **działa na produkcji** jako funkcja serverless Vercela.

Komentarz w `functions/src/index.ts` („serwer nie jest jeszcze nigdzie wdrożony") oraz
zapis w `CLAUDE.md` §2 są w tym punkcie nieaktualne.

Cloud Functions zawierają dziś **wyłącznie**: wyzwalacz mailowy `notifyStudentOnHomework`
oraz dwa `onCall` do Notion. `functions/package.json` ma dokładnie dwie zależności
(`firebase-admin`, `firebase-functions`) — **żadnego kodu AI i żadnego klucza OpenAI**.

### 2.6. Mailing — realna ścieżka

`notifyStudentOnHomework` wyzwala się na `onDocumentCreated('specialTasks/{taskId}')`
i **natychmiast wychodzi**, gdy dokument ma `manualEmailConfirmationRequired`, `skipAutoEmail`
albo `emailNotificationSent`. Oba dzisiejsze kreatory ustawiają
`manualEmailConfirmationRequired: true, skipAutoEmail: true`, więc **automat w praktyce nie
wysyła nic** — pocztę wysyła `HomeworkEmailConfirmationModal.tsx` po potwierdzeniu lektora.

Funkcja czyta jednak `task.sentences.length` jako `itemCount`. To jest twardy punkt styku
z v2 (patrz §4, warunek W1).

---

## 3. Raport różnic

| # | Stan obecny | Wymaganie zlecenia | Luka | Proponowana zmiana | Ryzyko | Test akceptacyjny |
|---|---|---|---|---|---|---|
| 1 | Kaskada schodzi do Gemini (`aiModels.ts`, `handleOpenAI`) | Tylko OpenAI: GPT‑5.6 core, GPT‑4o‑mini fallback | Walidator może odpowiedzieć innym dostawcą | Nowa stała `HOMEWORK_V2_MODEL_CASCADE = [PRIMARY, TERTIARY]` + ścieżka v2 bez fallbacku Gemini. Kaskada v1 **bez zmian** | Niskie — dodanie stałej, nie modyfikacja istniejącej | Test jednostkowy: kaskada v2 nie zawiera żadnego `gemini*`; brak klucza OpenAI → błąd, nie ciche zejście do Gemini |
| 2 | `functions/` bez kodu AI i bez `OPENAI_API_KEY` | Runtime serwisów w Cloud Functions `onCall` | Funkcje nie potrafią zawołać modelu | `defineSecret('OPENAI_API_KEY')` w `functions/` + wywołanie surowym `fetch` (jak `server.ts:246`) — **zero nowych zależności** | Średnie — nowa powierzchnia wdrożeniowa, wymaga `firebase functions:secrets:set` | Emulator: `onCall` zwraca zadania; brak sekretu → czytelny `HttpsError`, nie 500 |
| 3 | Express na Vercelu, `maxDuration: 60` | Pipeline: generator + walidator + do 2 regeneracji | 60 s bywa za mało na pełny przebieg | Argument **za** Functions: `timeoutSeconds` do 540 (już używane w `importNotionSelection`) | Niskie | Generowanie 8 zadań z walidacją mieści się w limicie |
| 4 | Reguła `specialTasks.update` dla kursanta: `hasOnly([status, studentAnswers, evaluationResults, submittedAt, feedbackReadByStudent, studentViewedAt])` | 3 próby, autosave do chmury, resume, stan opanowania | Każdy zapis nowego pola przez kursanta zostanie **odrzucony** | **Nie poszerzać** reguły na dokumencie nadrzędnym. Dodać podkolekcję `specialTasks/{id}/attempts/{attemptId}` z własną regułą | **WYSOKIE — `firestore.rules`, wymaga zgody (CLAUDE.md §3)** | `tests/rules/`: kursant zapisuje próbę do swojej podkolekcji, nie do cudzej; nie może zapisać werdyktu |
| 5 | Kursant sam zapisuje `evaluationResults` | Ocena i stan `opanowane` powstają po stronie serwera | Możliwe podstawienie własnej oceny | Werdykt zapisuje wyłącznie `onCall` (Admin SDK omija reguły); reguła zabrania kursantowi pisać pola werdyktu w v2 | **WYSOKIE — `firestore.rules`** | Test reguł: kursant próbuje zapisać `masteryState: 'opanowane'` → odrzucone |
| 6 | Brak `teacherId` w jakimkolwiek rekordzie (jest tylko `publicTests.createdBy`) | Każdy rekord ma `teacherId`, izolacja tenantowa | Brak pola i brak źródła wartości | `teacherId` z `request.auth.uid` w `onCall`, **nigdy z żądania klienta** | Niskie | Test: `teacherId` z payloadu klienta jest ignorowany |
| 7 | Brak pojęcia grupy; `taskOwnerFields()` daje `studentIds: [uid]` (jednoelementowe) | Grupa: identyczna treść, osobne próby i profil | Brak modelu grupy | Wspólne `homeworkSetId` + **jeden dokument `specialTasks` na kursanta**. Bez nowej kolekcji | Niskie | Dwóch kursantów, jedno `homeworkSetId`, rozbieżne próby i stany |
| 8 | `evaluateTranslations` — rubryka 40/40/20, ale osie: znaczenie / **gramatyka** / słownictwo+pisownia; wynik 0–100, `is_correct` przy ≥75 | Osie: znaczenie / **materiał docelowy** / poprawność; skala 0/0.5/1; confidence | Inna oś środkowa i inna skala | Nowy `GradingEngine`. **`evaluateTranslations` nietknięte** (używa go v1) | Niskie, jeśli v1 nie ruszamy | Złoty zbiór: wariant naturalny = pełne punkty; literówka nie zeruje; brak celu → max `ćwiczymy` |
| 9 | `StudentHomeworkScreen.tsx:421` pokazuje `Provisional score: X%` | Kursant widzi feedback + stan, **bez procentu** | Procent widoczny | Osobny ekran v2 wybierany flagą; ekran v1 bez zmian | Niskie | Widok v2 nie renderuje `%` ani słupka |
| 10 | Brak prób: jedno wysłanie, `status: 'submitted'`, jeden `evaluationResults` | 3 próby z drabinką podpowiedzi | Brak licznika prób i podpowiedzi | `attemptNumber` w podkolekcji; `hintSmall`/`hintLarge` **z kontraktu zadania**, nie z wolnego AI | Średnie — najwięcej nowej logiki | Dla każdego z 3 typów: próba 1 bez podpowiedzi, 2 mała, 3 większa + wzorzec i wymagana poprawka |
| 11 | Autosave tylko w `localStorage` (`useDraftAnswers`, TTL 7 dni) | Autosave **i resume** | Szkic nie przeżywa zmiany urządzenia | Szkic v2 zapisywany do podkolekcji prób (patrz #4) | Średnie — więcej zapisów do Firestore; potrzebny debounce | Odpowiedź na telefonie → wznowienie na laptopie w tym samym miejscu |
| 12 | Brak `zod`; walidacja JSON to `extractJSON()` (dopasowanie nawiasów) + doraźne sprawdzenia | „Kontrakty JSON + Zod **lub równoważna walidacja już używana w repo**" | W repo nie ma żadnego walidatora schematu | Ręczne strażniki typów w module kontraktów + testy. **Zero nowych zależności** (prompt zabrania bibliotek) | Niskie | Zadanie bez pola obowiązkowego jest odrzucane przed zapisem |
| 13 | `config/featureFlags.ts` — stałe kompilowane, tylko frontend | Flaga `homeworkEngineV2`, rollback = wyłączenie | Funkcje nie widzą flagi frontendu | Flaga w pliku współdzielonym + odpowiednik po stronie `functions` (parametr środowiskowy). Bez odczytu z Firestore na każde wywołanie | Niskie | Flaga off → panel pokazuje v1, `onCall` odmawia; zero śladu v2 |
| 14 | `aiMonitorService` trzyma `promptSnippet` w `sessionStorage` po stronie klienta | Log kosztu i latency **bez treści odpowiedzi kursanta** | Fragment promptu może nieść treść | Log v2 po stronie funkcji: model, tokeny, ms, wynik walidacji. Bez tekstu odpowiedzi | Niskie | Wpis logu nie zawiera tekstu odpowiedzi ani zdania źródłowego |
| 15 | `homeworkItemType()` przy nieznanym elemencie zwraca `'translation'` | v1 nie może renderować zadań v2 | Ekran v1 pokaże zadanie v2 jako tłumaczenie i zepsuje `homeworkBlocks()` | Strażnik `engineVersion === 2` w listach v1 | **Średnie — realna regresja v1** | Dokument v2 nie pojawia się na ekranie v1 przy fladze on i off |
| 16 | Notion nie jest dotykany przy generowaniu (sprawdzone: brak odwołań w `homeworkGenerator`, `geminiService`, `HomeworkComposer`) | Nie odpytywać Notion przy generowaniu | **Brak luki** | — | — | — |
| 17 | `extractLessonBlocks()` zwraca 4 bloki; `isStudentVisibleLesson()` / `isLessonPendingConfirmation()` dają „zatwierdzoną lekcję" | Paliwo: zatwierdzona lekcja, bez wymowy | **Brak luki** — wystarczy reuse, blok wymowy odfiltrować | `ContextAssembler` używa istniejących funkcji | Niskie | Blok `Pronunciation` nie trafia do promptu |
| 18 | `notifyStudentOnHomework` czyta `task.sentences.length` | „`notifyStudentOnHomework` musi nadal działać" | Zmiana nazwy pola zepsuje licznik w mailu | v2 zachowuje `sentences` (patrz §4 W1) | **Średnie, jeśli zignorowane** | `tests/emailNotifications.test.ts` rozszerzony o dokument v2 |

---

## 4. Czy `specialTasks` + `engineVersion: 2` jest bezpieczne?

**Tak — pod trzema warunkami.** Rozdzielna kolekcja nie jest potrzebna i kosztowałaby
więcej (osobne reguły, osobny wyzwalacz mailowy, rozjazd list w panelu lektora).

**W1. Zestaw v2 musi trzymać ćwiczenia w polu `sentences`.**
Wyzwalacz mailowy liczy `task.sentences.length`. Payload v2 może mieć dowolne dodatkowe pola,
ale tablica ćwiczeń zostaje pod tą nazwą — inaczej kursant dostaje maila „0 zadań".

**W2. Zestaw v2 musi zachować kontrakt v1 przy tworzeniu:**
`taskOwnerFields(studentUid)` (reguła `create` wymaga niepustego `studentUid`),
`manualEmailConfirmationRequired: true`, `skipAutoEmail: true`, `status: 'pending'`,
`title`, `createdAt`. Do tego dochodzi `engineVersion: 2`.

**W3. Ekrany v1 muszą pomijać dokumenty z `engineVersion === 2`.**
Bez tego `homeworkItemType()` uzna `micro_translation` za `translation` i `StudentHomeworkScreen`
spróbuje wyrenderować zadanie, którego nie rozumie. To jedyna realna regresja v1
w tym podejściu — i jest tania do zamknięcia.

**Dane prób idą do podkolekcji, nie do dokumentu nadrzędnego:**
`specialTasks/{taskId}/attempts/{attemptId}`. Dzięki temu reguła dla `specialTasks`
zostaje nietknięta (poza dopisaniem nowego bloku `match` dla podkolekcji), a powierzchnia
zapisu kursanta jest wąska i nie obejmuje werdyktu.

---

## 5. Pliki do ruszenia w Etapie 1

**Nowe (większość zmian):**
- `services/homeworkV2/contracts.ts` — kontrakt zadania, strażniki typów, wersjonowanie
- `services/homeworkV2/` — `ContextAssembler`, `ExercisePlanner`, `ExerciseGenerator`,
  `QualityValidator`, `GradingEngine`, `FeedbackComposer`, `LearningProfileUpdater`, `ReviewPlanner`
  (czysty TypeScript, bez React, testowalne bez bazy)
- `services/homeworkV2/coreKnowledge.ts` — globalny rdzeń w plikach repo
  (naturalność, antywzorce, styl feedbacku, rubryka, opis 3 typów)
- `functions/src/homeworkV2/` — `onCall`: generowanie, wysyłka, ocena próby
- `components/admin/HomeworkComposerV2.tsx` — 1 ekran podglądu
- `components/dashboard/StudentHomeworkV2Screen.tsx` — mobile-first, 3 próby
- `tests/homeworkV2*.test.ts` — kontrakty, scoring, próby, złoty zbiór, flaga

**Modyfikowane ostrożnie:**
- `config/featureFlags.ts` — dopisanie `homeworkEngineV2` (tylko dopisanie)
- `types.ts` — nowe typy v2 obok istniejących, bez zmiany `HomeworkType`
- `services/aiModels.ts` — dopisanie kaskady v2, bez ruszania istniejących stałych
- `firestore.rules` — **tylko nowy blok `match` dla podkolekcji `attempts`** (patrz §6)
- `firestore.indexes.json` — indeks pod zapytania v2, jeśli okaże się potrzebny
- `components/dashboard/StudentHomeworkScreen.tsx` — **jedna linia**: filtr `engineVersion !== 2`
- `components/admin/AdminPanel.tsx`, `TeacherOverview.tsx` — ten sam filtr
- `functions/package.json` — `defineSecret` nie wymaga zależności; zmiana tylko jeśli dojdzie skrypt

**Zakazane w tym zleceniu:**
- `server.ts` — bez przepisywania (dozwolone zero zmian)
- `services/geminiService.ts`, `services/homeworkGenerator.ts` — silnik v1, nietykalne
- `functions/src/index.ts` (`notifyStudentOnHomework`), `functions/src/emailTemplate.ts`,
  `functions/src/resend.ts` — mailing bez przebudowy
- `functions/src/notion/*`, `services/notionSync.ts` — KnowledgeSync poza zakresem
- Fiszki i SRS: `context/FlashcardContext.tsx`, `services/recallItems.ts`, `utils/learningCurve.ts`
- Testy postępu: `components/tests/*`, `AdminTestGenerator.tsx`, `/api/gemini/generate-test`
- `services/presentationService.ts`, `scratchpadService.ts`, `liveSessionService.ts`, `ttsService.ts`

---

## 6. Obszary wysokiego ryzyka — wymagają jawnej zgody

Zgodnie z `CLAUDE.md` §3 zatrzymuję się i opisuję zamiast działać.

**`firestore.rules` — konieczna zmiana, minimalna w zamyśle:**

1. **Nowy blok** `match /specialTasks/{taskId}/attempts/{attemptId}` — kursant czyta i tworzy
   wyłącznie próby do zadania, którego jest właścicielem; pola werdyktu
   (`masteryState`, `rubricScores`, `confidence`, `requiresTeacherReview`) są dla niego
   **tylko do odczytu** — zapisuje je Admin SDK z Cloud Functions.
2. **Ewentualne domknięcie istniejącej reguły:** dziś kursant może zapisać
   `evaluationResults` na dokumencie nadrzędnym. W v2 to nie jest potrzebne. Odebranie tego
   prawa **zmieniłoby zachowanie v1** (ekran v1 zapisuje tam wynik prowizoryczny), więc
   **domyślnie tego nie ruszam** — zgłaszam jako osobną decyzję do podjęcia poza tym zleceniem.

Nic poza powyższym w `firestore.rules` nie jest planowane. Middleware
`requireFirebaseAuth` / `requireFirebaseAdmin` i ścieżki tokenowe bez logowania
(`homework/direct/:token`, PIN notatnika) — **bez zmian**.

---

## 7. Pytania blokujące przed Etapem 1

1. **Identyfikator modelu:** zlecenie mówi „GPT‑5.6", kod ma `openai/gpt-5.6-luna`.
   Ten sam model czy dwa różne?
2. **Runtime:** zlecenie mówi Cloud Functions `onCall`, ale klucz OpenAI i cała warstwa AI
   stoją dziś w Expressie wdrożonym na Vercelu. Potwierdzenie, że dokładamy
   `OPENAI_API_KEY` jako sekret Functions (i wykonasz `firebase functions:secrets:set`)?
3. **`firestore.rules`:** zgoda na nowy blok `match` dla podkolekcji `attempts` (§6 punkt 1)?
4. **Zod:** prompt zakłada „Zod lub równoważną walidację już używaną w repo" — w repo nie ma
   żadnej. Przyjmuję ręczne strażniki typów bez nowej zależności. Potwierdzasz?

---

## 8. Wniosek

Kod **nie stoi w sprzeczności** z pętlą z §3.1 — nie ma jej po prostu w ogóle. Trzy typy v2
to nowe typy, nie przeróbki istniejących; ocena v2 to nowa rubryka, nie strojenie starej.
To dobra wiadomość dla ryzyka regresji: v2 da się dołożyć obok v1, a nie w środek v1.

Trzy rzeczy wymagają decyzji **przed** pisaniem kodu i są opisane wyżej: identyfikator modelu,
sekret OpenAI po stronie Cloud Functions oraz nowy blok w `firestore.rules`.

**STOP. Czekam na komendę `WDRAŻAJ ETAP 1`.**

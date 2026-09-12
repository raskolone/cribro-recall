# Plan weekendowy — 2026-09-12/13

Zlecenie Macieja: do końca weekendu muszą **działać** trzy systemy — prace
domowe (odsyłanie + ocenianie), powiadomienia z nimi związane, wspólny
notatnik (szablony + eksport). Do tego przebudowa panelu lektora wg
`docs/kolejka-przebudowa-panelu.md` i dokończenie trybu dziennego wg
`CHANGELOG.md` §3. Decyzje co do otwartych pytań podejmuję sam, jak
poproszono. Testy (generator quizów) — świadomie poza zakresem tego
weekendu.

Ten plik zastępuje `docs/kolejka-przebudowa-panelu.md` jako źródło prawdy
na czas realizacji (dokument źródłowy zostaje, nie kasuję go).

---

## 0. Najważniejsze odkrycie z audytu (zmienia kolejność pracy)

`config/featureFlags.ts`: `HOMEWORK_ENGINE_V2 = true` — **już włączone na
produkcji**. Skutek: kreator lektora (`HomeworkScreen.tsx`, zakładka
"Nowa praca") od razu tworzy zadania **v2**, nie v1.

Ale: **nie istnieje żaden ekran oceniania zadań v2.** `HomeworkScreen.tsx`
(jedyny ekran lektora do przeglądu prac) nie rozpoznaje `engineVersion:2`
i nie czyta subkolekcji `specialTasks/{id}/attempts`. Funkcja
`proposeHomeworkV2Review` istnieje w `functions/src/homeworkV2/endpoints.ts:379`
i działa, ale **nic jej nie wywołuje** — martwy kod. Ocena AI dzieje się
automatycznie przy każdej próbie kursanta (`gradingEngine.ts`), ale lektor
nie ma jak tego zobaczyć, potwierdzić, poprawić ani przejrzeć zadań
oznaczonych `requiresTeacherReview: true`.

**To jest prawdopodobnie realny powód, dla którego "prace domowe nie
działają"** — kursanci mogą już dostawać i odsyłać zadania v2, ale lektor
jest ślepy na wynik. To idzie na pierwsze miejsce, przed przebudową UI.

Sprawdzone i **nieblokujące** (nie wymaga zmiany planu):
- Reguły Firestore (`firestore.rules:401-410`, `attempts`) już pozwalają
  lektorowi (`isAdmin()` obejmuje rolę `teacher`) czytać **każdą** próbę,
  także przez `collectionGroup('attempts')` — zero zmian w regułach
  potrzebnych do zbudowania ekranu oceny.
- Generacja i ocena AI w locie już działają dla kursanta (Etapy 1-4
  wdrożone). Brakuje wyłącznie warstwy lektora.

**Nie objęte tym planem:** pierwszy w pełni potwierdzony przebieg
generacji z prawdziwym kluczem OpenAI po stronie Cloud Functions —
`OPENAI_API_KEY` jako sekret Cloud Functions to dane uwierzytelniające,
których nie mogę odczytać ani ustawić za Ciebie (odmowa środowiska
agenta). **Do zrobienia przez Ciebie**: `npm run firebase:secrets:set --
OPENAI_API_KEY`, potem wygenerowanie jednej realnej pracy domowej v2 na
produkcji jako smoke test. Reszta planu (ekran oceny, powiadomienia,
UI) nie wymaga tego klucza do zbudowania i przetestowania na
emulatorze/mockach — tylko do finalnego uruchomienia z prawdziwym modelem.

---

## 1. Rozstrzygnięcia (3 otwarte pytania z kolejki)

1. **Trzeci kafelek → Notatnik.** Używany na każdej lekcji, i tak jest w
   centrum pracy tego weekendu — sensowne uczynić go widoczniejszym niż
   Planer (używany rzadziej, zostaje w listwie).
2. **"Profil kursantów" (kafelek) vs "Baza kursantów" (zakładka
   sidebar).** Rozróżnienie przez podtytuł/opis, nie przez zmianę nazw:
   - Kafelek: *Profil kursantów* — "wybierz kursanta → historia, prace,
     statystyki".
   - Zakładka: *Baza kursantów* — "zarządzanie kontami: dodawanie,
     edycja, usuwanie".
3. **Gdzie ląduje powiadomienie, gdy lektor jest już w karcie
   kursanta.** Banner wchodzi do wspólnej powłoki panelu lektora (nad
   treścią, pod nagłówkiem), nie tylko do widoku z kafelkami — więc jest
   widoczny też z poziomu karty kursanta, prezentacji itd. Klik prowadzi
   wprost do zadania wymagającego uwagi.

---

## 2. Kolejność realizacji

Kolejność wybrana tak, żeby każdy etap kończył się czymś, co **da się
odpalić i sprawdzić**, zgodnie z zasadą commitów cząstkowych z CLAUDE.md
§7.1.

### Etap A — Ekran wglądu i przeglądu prac domowych v2 (priorytet 1, brakujący kawałek)

**Korekta po weryfikacji kodu (`functions/src/homeworkV2/endpoints.ts:244-390`):**
ocena AI dla v2 jest **natychmiastowa i niemutowalna** — `submitHomeworkV2Attempt`
ocenia i zapisuje werdykt w tej samej sekundzie, co próba kursanta,
a reguła `attempts.update: if false` (`firestore.rules:408`) zabrania
zmiany werdyktu komukolwiek, łącznie z adminem. `proposeHomeworkV2Review`
to **nie** funkcja zatwierdzania oceny — to generator propozycji
powtórki (spaced repetition), nie ma żadnego związku z pojedynczym
zadaniem do "zaakceptowania". Pierwsza wersja planu (przycisk
"Zatwierdź ocenę" wołający tę funkcję) była błędna — nie ma takiej
możliwości w architekturze v2 i nie próbuję jej dodawać (naruszyłoby
świadomie zaprojektowaną niemutowalność historii prób).

Realny brakujący kawałek to więc **widoczność, nie zatwierdzanie**:
- Nowa zakładka/widok w `HomeworkScreen.tsx` (lektor) dla zadań
  `engineVersion:2`: lista kursantów z aktywnymi zestawami v2, z
  rozwinięciem do ćwiczeń i pełnej historii prób z subkolekcji
  `attempts` (odczyt już dozwolony dla `isAdmin()` — zero zmian w
  regułach, zweryfikowane w §0).
- Sekcja "Wymaga uwagi" na górze: zapytanie
  `collectionGroup('attempts').where('requiresTeacherReview','==',true)`,
  pogrupowane po zadaniu/kursancie.
- Skoro werdyktu nie da się zmienić, jedyna sensowna akcja lektora to
  **odnotowanie, że przejrzał** i opcjonalny komentarz dla kursanta —
  zapisywane na `specialTasks/{taskId}` (nie na `attempts`), pola
  `teacherReviewedAt` / `teacherReviewNote`, przez zwykły `updateDoc`
  z przeglądarki (już dozwolone regułą `specialTasks.update: if
  isAdmin()`, bez nowej Cloud Function).
- Bez zmiany `hasGradedHomework` dla v2 — to pole w v1 oznacza "lektor
  właśnie ocenił, pokaż modal kursantowi", a w v2 kursant dostaje
  werdykt i feedback **od razu** przy każdej próbie (`feedback.message`
  w odpowiedzi `submitHomeworkV2Attempt`), więc nie ma tu odpowiednika
  zdarzenia "ocena właśnie się zdarzyła" do zasygnalizowania później.
- Test: `npm run test:rules` (bez zmian w regułach — weryfikacja, że
  nic nie ruszyłem) + `npm test` + ręczny przebieg na emulatorze z
  atrapą wywołania modelu (już wspierana przez wstrzykiwanie zależności
  w `functions/src/homeworkV2`).

### Etap B — Powiadomienia: naprawa i spięcie z ocenianiem
- **Bug:** `functions/src/index.ts:75-83` (`notifyStudentOnHomework`)
  ignoruje globalny przełącznik `MailingSettings.enableHomeworkAssigned`
  — czyta tylko flagi na dokumencie zadania. Naprawka: doczytać
  `system/mailing` i uszanować przełącznik, zanim wyśle.
- **Brak funkcji — dotyczy tylko v1:** `MailingSettings.enableHomeworkReviewed`
  (przełącznik w `AdminMailingScreen.tsx:1782`) nie ma żadnej funkcji,
  która go czyta. Nowy trigger Cloud Function
  `notifyStudentOnHomeworkGraded` — `onDocumentUpdated('specialTasks/{taskId}')`,
  odpala się, gdy `status` zmienia się na `graded` przez
  `HomeworkScreen.tsx:handleSaveReview` (v1, jedyna ścieżka, która
  faktycznie robi taką zmianę statusu) — wysyła mail przez istniejący
  `emailTemplate.ts` (nowy szablon `buildHomeworkGradedEmail`,
  analogiczny do `buildHomeworkEmail`). Uszanuj `emailNotificationsDisabled`
  na koncie kursanta, tak jak robi to już `notifyStudentOnHomework`.
  **v2 nie potrzebuje tego triggera** — patrz korekta w Etapie A: ocena
  i feedback trafiają do kursanta od razu przy próbie, nie przez
  późniejszą akcję lektora, więc nie ma tu zdarzenia "ocena się
  zdarzyła" do zamailowania.
- **Sygnał dla lektora o zadaniach v2 wymagających uwagi:** rozszerzenie
  `TeacherHomeworkNotification.tsx` (już nasłuchuje `specialTasks`
  i testy) o trzeci nasłuch: `collectionGroup('attempts').where('requiresTeacherReview','==',true)`,
  nowe wystąpienia → toast prowadzący do widoku z Etapu A. Tylko in-app,
  bez maila — symetrycznie z tym, jak dziś (bez zmian) wygląda
  powiadomienie o odesłanej pracy v1: też tylko toast, lektor nie
  dostaje maila o żadnym zdarzeniu w tej wersji.
- **Redesign z kolejki (pkt 1):** przenosiny sygnału "praca do oceny"
  z Sidebara do banera w powłoce panelu lektora (patrz Etap C —
  robione razem z przebudową layoutu, bo dotyka tych samych plików).
  `Sidebar.tsx` badge zostaje jako dodatkowy sygnał (nie kasuję — brief
  "chowaj, nie kasuj"), ale traci pierwszeństwo wizualne.
- **Świadomie poza zakresem:** przebudowa na jeden generyczny
  `NotificationContext`/kolekcję `notifications` (dziś 4 niezależne
  komponenty + `AuthContext`, każdy z własnym `onSnapshot` — dług
  strukturalny wykryty w audycie). To osobny refaktor, nie blokuje
  żadnego z trzech priorytetów tego weekendu; dodaję kawałki zgodnie z
  istniejącym wzorcem (kolejny `onSnapshot`), nie zmieniam architektury.
- `enableDueDateReminder` (przypomnienie o terminie) — **świadomie poza
  zakresem tego weekendu**: wymaga harmonogramu (Cloud Scheduler +
  funkcja cron), to nowy, osobny mechanizm, nie naprawa istniejącego.
  Zostawiam przełącznik z opisem w UI "wkrótce", żeby nie sugerował
  działania, którego nie ma.

### Etap C — Przebudowa panelu lektora (UI)
Zakres z `docs/kolejka-przebudowa-panelu.md`, z rozstrzygnięciami z §1
powyżej:
1. Powłoka panelu lektora: baner powiadomień (Etap B) nad treścią,
   trwały między widokami.
2. Trzy kafelki: Profil kursantów → Prezentacja → Notatnik.
3. Listwa narzędzi pod kafelkami (Planer, Prezentacja, Notatnik,
   Mailing) — o połowę niższa, symetryczny układ ikon.
4. Schowane (przełącznikiem widoczności, nie skasowane — wzorzec już
   istnieje w `config/featureFlags.ts`): Przegląd panelu, Historia
   Notion (przenosi się do karty kursanta), AI Lesson Generator, "Dodaj
   kursanta" (przenosi się do Bazy kursantów).
5. Karta kursanta: historia lekcji + historia prac domowych razem,
   Słownictwo AI, Testy, Statystyki. Generator prac domowych zostaje
   osobną funkcją (kafelek/listwa), nie częścią karty.
6. Nazewnictwo: "Brudnopis" → "Notatnik" we wszystkich miejscach UI
   (menu, karty, przyciski, tytuły ekranów). Nazwy w kodzie
   (`scratchpadService.ts`, kolekcja `scratchpads`) **zostają bez
   zmian** — to czysto kosmetyczna zmiana warstwy i18n/UI.

### Etap D — Wspólny notatnik: szablony i eksport
- **Szablony (nowa funkcja, dziś nie istnieje nic poza jednym
  zahardkodowanym przyciskiem).** Nowa kolekcja Firestore
  `scratchpadTemplates/{id}` — **dotyka `firestore.rules`, więc opisuję
  to tutaj zamiast działać po cichu**, zgodnie z CLAUDE.md §3:
  - Pola: `title`, `contentHtml`, `createdBy`, `createdAt`, `updatedAt`.
  - Reguła: `allow read, write: if isAdmin();` — wyłącznie
    lektor/admin zarządza szablonami i wstawia je do notatnika
    kursanta. Kursant nigdy nie czyta tej kolekcji bezpośrednio (nie
    wybiera szablonów sam), więc nie ma tu żadnej ścieżki bez logowania
    ani PIN-owej — zero interakcji z istniejącą, wrażliwą logiką
    `scratchpads`/`scratchpadPins`, którą zostawiam **całkowicie
    nietkniętą**.
  - UI: w `ScratchpadEditor.tsx` (widok lektora) — menu "Wstaw szablon"
    z listą zamiast jednego przycisku; osobny prosty ekran/modal
    zarządzania szablonami (dodaj / edytuj / usuń).
- **Eksport do PDF.** Nowa funkcja `exportScratchpadToPDF` w
  `utils/pdfExport.ts`, dokładnie ten sam wzorzec co
  `exportTestToPDF` (już używa `html2pdf.js`, zależność już w
  `package.json` — zero nowych paczek). Dostępna i dla lektora, i dla
  kursanta.
- **Eksport "do Google Docs".** Decyzja: **bez integracji API Google**
  (OAuth, `googleapis`, konto usługi) — wymagałoby założenia projektu w
  Google Cloud Console, ekranu zgody OAuth i loginu Google po stronie
  każdego kursanta/lektora; to nie da się zrobić w ramach tego
  weekendu ani bez Twojego bezpośredniego udziału w konsoli Google.
  Zamiast tego: eksport do pliku `.doc` (HTML w formacie zgodnym z
  Wordem, `Content-Type: application/msword`) — Google Docs otwiera
  taki plik bezpośrednio po wgraniu na Dysk ("Otwórz za pomocą →
  Dokumenty Google"), Word też. Zero nowych zależności, ten sam wzorzec
  co eksport PDF. Przycisk podpisany uczciwie: "Eksportuj do Worda
  (otwiera się też w Google Docs)" — nie obiecuję czegoś, czego nie ma.
- Dostęp kursanta do notatnika **już działa stale** (nie licząc PIN-u):
  `StudentScratchpadScreen.tsx` + `getOrCreateStudentScratchpad`, ten
  sam dokument `sp_{uid}` widoczny z panelu kursanta. Zero zmian
  potrzebnych — tylko przemianowanie w UI (Etap C.6).

### Etap E — Tryb dzienny na panelach po zalogowaniu
Zakres z `CHANGELOG.md` §3: panele lektora/admina/kursanta nieoglądane w
trybie dziennym, ~1169 surowych `text-white`.

Realistyczny zakres na ten weekend, żeby nie skończyć z 1000+
niezweryfikowanymi zamianami:
1. Zamiana `text-white` → `text-text-hi` **tylko** w komponentach, które
   i tak zmieniam w Etapach A–D (nowy ekran oceny, przebudowany panel
   lektora, notatnik) — to naturalnie pokrywa najważniejsze, najbardziej
   widoczne ekrany.
2. Dodatkowy przegląd `components/admin/` i `components/dashboard/`
   (764 + 278 wystąpień — największe skupiska) pod kątem samego wzorca
   z historycznego buga: `text-white` **razem z** `bg-black/30`,
   `bg-white/5`, `border-white/10` w tym samym elemencie (jasne tło +
   biały tekst = nieczytelne). To ten sam wzorzec, który już raz
   naprawiono na ekranie startowym — najgęstsze źródło realnych
   błędów, nie kosmetyki.
3. Weryfikacja wzrokowa: zrzuty ekranu (Puppeteer, już w zależnościach)
   głównych widoków w trybie dziennym — panel lektora (nowy layout),
   ekran oceny v2, notatnik, dashboard kursanta — przed i po.
4. **Świadomie NIE** przechodzę wszystkich 1169 wystąpień jeden po
   drugim — to osobne, dłuższe zadanie porządkowe, nie blokujące
   funkcjonalności. Zostawiam jasny stan w `AGENT_LOG.md` i
   `CHANGELOG.md`, ile zostało.

---

## 3. Ryzyka i obszary wysokiego ryzyka (CLAUDE.md §3)

- **`firestore.rules`**: jedna zmiana, opisana wyżej (Etap D, nowa
  kolekcja `scratchpadTemplates`, reguła `isAdmin()`-only). Nie dotykam
  `specialTasks`, `attempts`, `drafts`, `scratchpads`, `scratchpadPins`
  — wszystkie już mają wystarczające reguły do tego planu (zweryfikowane
  w §0). Po zmianie: `npm run test:rules` musi przejść w całości, plus
  nowe testy dla `scratchpadTemplates` (czyta/pisze tylko admin/teacher,
  odmawia kursantowi i gościowi).
- **Middleware autoryzacji w `server.ts`**: nietknięte.
- **Ścieżki tokenowe bez logowania** (`homework/direct/:token`,
  notatnik po PIN): nietknięte, poza kosmetyczną zmianą nazwy "Notatnik"
  w UI tego ekranu.
- **`server.ts` (114 KB)**: nowy trigger mailowy (Etap B) idzie do
  `functions/`, nie do `server.ts` — zgodnie z konwencją repo (logika
  reagująca na zdarzenia w bazie = Cloud Functions).

---

## 4. Co świadomie zostaje poza zakresem tego weekendu

- Generator testów (quizów) — już naprawiony w poprzedniej sesji,
  dopracowywanie "w locie" wg polecenia.
- Pierwszy realny przebieg silnika v2 z prawdziwym kluczem OpenAI —
  wymaga Twojej akcji (sekret Cloud Functions).
- `enableDueDateReminder` (przypomnienia o terminie) — nowy mechanizm
  cron, nie naprawa.
- Pełne rozwiązanie "ostatni zapis wygrywa" w notatniku (OT/CRDT) — duży,
  osobny projekt, nie blokuje żadnego z trzech priorytetów.
- Wyczerpujące zamienienie wszystkich 1169 `text-white` — patrz Etap E.
- Prawdziwa integracja z Google Docs API (OAuth) — patrz Etap D.

---

## 5. Weryfikacja przed commitem każdego etapu

`npx tsc --noEmit`, `npm test`, `npm run build`; przy zmianach w
`firestore.rules` dodatkowo `npm run test:rules`. Serwer deweloperski
(`npm run dev`, już uruchomiony na `:3000`) do ręcznego sprawdzenia
wzrokowego kluczowych ekranów.

## 6. Commity

Jeden commit na etap (A–E), zgodnie z CLAUDE.md §7.4 — nie mieszam
naprawy powiadomień z przebudową UI. Push po każdym zamkniętym etapie
(§7.1), nie czekam do końca całości.

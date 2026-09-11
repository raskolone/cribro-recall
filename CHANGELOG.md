# CRIBRO ENGLISH (Recall) — Log Zmian i Stan Aplikacji

> **Cel pliku:** Niniejszy dokument stanowi kompletne, ustrukturyzowane źródło wiedzy o projekcie, architekturze, modułach biznesowych oraz wszystkich zmianach wdrożonych w systemie w ciągu ostatnich 24 godzin. Plik został przygotowany tak, aby każdy programista lub agent/edytor AI (Cursor, Windsurf, Claude Code, Antigravity, Copilot) w nowej sesji mógł natychmiast zrozumieć kontekst i kontynuować rozwój aplikacji bez konieczności ponownej analizy historii git.

---

## 1. Przegląd Platformy i Funkcjonalności

CRIBRO ENGLISH (Recall) to zaawansowana platforma edukacyjna do intensywnej nauki języka angielskiego, łącząca pracę lektora na żywo, synchronizację notatek z Notion, inteligentne prace domowe z oceną AI oraz zautomatyzowany mailing transakcyjny.

### 👥 Role i Uprawnienia w Aplikacji
1. **Kursant (`user`)**:
   - **Dashboard**: Podsumowanie dni z rzędu (streaks), przetłumaczonych zdań, fiszek i ocenionych prac.
   - **Prace domowe**: Interaktywne zadania (tłumaczenia, znajdowanie błędów, luki, puzzle zdań) z natychmiastową oceną AI oraz komentarzami lektora.
   - **Historia lekcji**: Wgląd w odbyte lekcje z Notion podzielone na 4 standardowe bloki (*Words & Phrases*, *Grammar & Accuracy*, *Pronunciation*, *Homework*).
   - **Fiszki & SRS**: Spaced Repetition System z profesjonalną wymową audio TTS.
   - **Testy i Egzaminy**: Rozwiązywanie testów diagnostycznych i okresowych.
   - **Powiadomienia Real-time**: Wyskakujące powiadomienia o nowych zadaniach, ocenionych pracach i testach.
2. **Nauczyciel (`teacher`)**:
   - **Zarządzanie lekcjami**: Import i synchronizacja z Notion, weryfikacja w stagingu, edycja bloków lekcji.
   - **Tworzenie prac domowych**: Generator prac domowych z automatycznym wyciąganiem słówek i zagadnień z lekcji.
   - **Zatwierdzanie wysyłki e-mail**: Potwierdzanie wysłania pracy domowej do kursanta przez e-mail z podglądem danych ucznia i nadawcy.
   - **Sprawdzanie zadań**: Przegląd nadesłanych prac, edycja feedbacku AI, wystawianie ocen i wskazówek.
   - **Generator testów AI**: Tworzenie testów sprawdzających opartych o historię lekcji.
3. **Administrator (`admin`)**:
   - Pełen dostęp do narzędzi nauczyciela oraz:
   - **Zarządzanie użytkownikami**: Tworzenie kont, resetowanie haseł, przypisywanie ról.
   - **Ustawienia systemowe**: Konfiguracja klucza Resend API, parametrów modeli AI, bazy tematów i materiałów.
   - **Mailing**: Podgląd logów wysyłki, szablonów, skrzynki odbiorczej (inbox) i wskaźników dostarczalności.
   - **Centrum diagnostyki**: Przegląd raportów błędów (Bug Reports) i logów serwera.

---

## 2. Architektura Techniczna i Stos Technologiczny

- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, Lucide React, Canvas Confetti.
- **Backend**: Node.js / Express (`server.ts`), endpointy pod `/api/*`, autoryzacja Firebase Auth Bearer token.
- **Baza danych & Auth**: Firebase Firestore w czasie rzeczywistym, Firebase Authentication, Firebase Admin SDK.
- **Sztuczna Inteligencja**:
  - Google Gemini (Gemini 2.5 Flash / 3.6 Flash / Structured JSON outputs).
  - OpenAI (GPT-4o-mini / GPT-4o) jako fallback.
- **Synteza mowy (TTS)**: ElevenLabs Multilingual V2, OpenAI TTS (`tts-1`), GCP TTS z podwójnym cache (dysk serwera + Firebase Storage).
- **Mailing**: Resend API (`resend.com`), szablony responsywne HTML/CSS (`functions/src/emailTemplate.ts`), skrzynka webhooków i symulacji.
- **Integracja Notion**: Notion API Client, parser bloków i baz danych, silnik dopasowywania lekcji do bazy kursantów.

---

## 3. Znane Ograniczenia i Dług Techniczny — PRZECZYTAJ PRZED ZMIANAMI

> Rzeczy, których **nie widać w kodzie na pierwszy rzut oka**, a które zmieniają sposób,
> w jaki należy do niego podchodzić. Stan na 2026-09-11.

### 🔴 Reguły Firestore dla brudnopisu są całkowicie otwarte
W `firestore.rules` kolekcja `scratchpads/{scratchpadId}` ma reguły:
```
allow get, list: if true;
allow create, update: if true;
```
**Konsekwencje:** każda osoba w internecie może odczytać i nadpisać dowolny brudnopis, a uprawnienie `list` pozwala **wylistować całą kolekcję**, czyli notatki wszystkich kursantów, bez logowania.

**Dlaczego tak jest:** anonimowy dostęp po kodzie PIN realizowany jest zapytaniem `query(collection('scratchpads'), where('pin','==',pin))` w `findScratchpadByPin`, a zapytanie kolekcyjne wymaga uprawnienia `list`. Otwarte reguły to najprostszy sposób, żeby kursant wszedł z linku bez konta.

**Jak to naprawić, gdy przyjdzie czas:** utworzyć osobną kolekcję-indeks `scratchpadPins/{pin}` → `{ scratchpadId }`. Wyszukiwanie po PIN-ie stanie się wtedy zwykłym `get` po znanym identyfikatorze, `list` na `scratchpads` będzie można zamknąć, a zapis ograniczyć do lektora i kursanta przypisanego do dokumentu. Wymaga migracji istniejących dokumentów (dla każdego `scratchpads/*` dopisać wpis w indeksie).

### 🟡 Wspólna edycja brudnopisu działa w trybie „ostatni zapis wygrywa"
`ScratchpadEditor` synchronizuje całą zawartość HTML dokumentu, bez algorytmu scalania zmian (OT ani CRDT). Jeśli lektor i kursant piszą **jednocześnie w tym samym miejscu**, zapis jednej strony nadpisze tekst drugiej.

Bufor, który to łagodzi: przychodząca treść nie podmienia edytora, dopóki użytkownik pisze (`isUserTypingRef`, reset 1,5 s po ostatnim klawiszu), a zapis jest opóźniony o 600 ms. Przy naprzemiennym pisaniu w trakcie lekcji to wystarcza.

**Czego z tego wynika:** brudnopis zastępuje Google Docs w scenariuszu „lektor notuje, kursant patrzy i czasem dopisuje", ale **nie** w scenariuszu równoległego pisania we dwoje. Zanim ktoś ogłosi pełne zastąpienie Google Docs, trzeba wprowadzić scalanie zmian na poziomie fragmentów.

### 🟡 Interfejs nie był weryfikowany w przeglądarce
Zmiany UI z etapów opisanych niżej (przebudowa paska Prezentacji i Brudnopisu, samouczek z dymkami, zamrożona kolumna w Bazie Kursantów, układanka z klocków, przełącznik Easy/Hard) przeszły `npx tsc --noEmit`, komplet testów jednostkowych i `npm run build`, ale **nie zostały obejrzane w działającej przeglądarce**. Przy kolejnych poprawkach w tych miejscach warto najpierw sprawdzić je wzrokowo.

---

## 4. Szczegółowy Rejestr Zmian z Ostatnich 24 Godzin

### Nowość: Naprawa Generatora Testów, Postęp w Blokach Pracy Domowej i Placeholder Testów Poziomujących

- **🔴 Przyczyna „Błąd generowania testu" (`server.ts`)**:
  - Generowanie działa w dwóch przebiegach: model tworzy zadania, a drugi przebieg weryfikuje ich spójność. Wynik weryfikacji **nadpisywał `response` bezwarunkowo** — wystarczyło, że drugi przebieg uciął długą tablicę JSON albo zwrócił obiekt zamiast listy, a **cały poprawnie wygenerowany test przepadał** i lektor dostawał wyłącznie komunikat „Błąd generowania testu".
  - Weryfikacja jest teraz **ulepszeniem, nie warunkiem powodzenia**: jej niepowodzenie (nieparsowalny JSON, pusta tablica, wyjątek) zostawia wersję z pierwszego przebiegu zamiast wywracać całą operację.
  - Dodano wspólny `parseQuestions` zdejmujący płot ```` ```json ```` i wymagający niepustej tablicy, oraz osobny, czytelny błąd `502`, gdy to **pierwszy** przebieg nie zwrócił poprawnej listy.
- **Prawdziwa treść błędu zamiast ogólnika (`AdminTestGenerator.tsx`)**:
  - `catch` pokazywał `alert("Błąd generowania testu")` i wyrzucał `err.message` do kosza, więc brak klucza API, limit modelu i zbyt duży plik wyglądały identycznie. Komunikat zawiera teraz konkretną przyczynę zwróconą przez backend.
- **Materiały z lekcji w pełnym układzie 4 bloków (`AdminTestGenerator.tsx`)**:
  - Do modelu szedł wyłącznie temat, streszczenie i słownictwo. Test powstawał więc **bez znajomości poprawek błędów i zadania domowego** — czyli bez tego, gdzie zapisane jest, z czym kursant faktycznie ma problem.
  - Nowy `buildLessonContext` przekazuje podsumowanie, słownictwo, **poprawki i błędy kursanta**, zadanie domowe oraz `thingsToImprove`. Puste bloki są pomijane, żeby nie zasypywać promptu nagłówkami bez treści.
  - Kontekst pełnego archiwum przycięty do tematu i 300 znaków słownictwa na lekcję — przy kilkudziesięciu lekcjach rozpisany w blokach wypychał z okna kontekstu lekcje wybrane przez lektora.
- **Placeholder testów poziomujących (`AdminTestGenerator.tsx`)**:
  - Nowa sekcja **„Testy poziomujące"** z plakietką „Wkrótce" i pustym stanem, opisująca gotowe zestawy CEFR (A1–C2) niezależne od historii lekcji. Stoi w miejscu docelowym, żeby było widać, gdzie trafią zestawy dodawane z czasem.
- **Postęp w blokach pracy domowej (`StudentHomeworkScreen.tsx`)**:
  - Zapis odpowiedzi w toku **już działał** (`hooks/useDraftAnswers`, `localStorage`, ważność 7 dni) i praca była już dzielona na bloki według typu ćwiczenia — brakowało jednak widocznego postępu, więc kursant po przerwie przewijał wszystko od początku w poszukiwaniu pierwszej pustej luki.
  - Dodano **mapę bloków**: każdy blok pokazuje licznik `wypełnione/wszystkie`, ukończone dostają ptaszka, bieżący jest wyróżniony, a kliknięcie przenosi wprost do początku bloku. Nad nią licznik całości, pod nią zdanie: „Nie musisz robić wszystkiego naraz — odpowiedzi zapisują się same".
  - `isAnswered` rozpoznaje odpowiedzi tekstowe, tablicowe (układanka, dobieranie) i obiektowe (luki). Samo `Boolean(answers[i])` uznawało pustą tablicę i `{}` za wypełnione, przez co licznik pokazywałby komplet przy pustej pracy.

### Poprzedni etap: Naprawa Udostępniania Notatnika, Zamknięcie Dziury w Regułach i Przyspieszenie Importu z Notion

- **🔴 Przyczyna „nie znaleziono notatnika" u kursanta (`services/scratchpadService.ts`)**:
  - `getScratchpadById` i `findScratchpadByPin` łapały **każdy** błąd Firestore i zwracały `null`. Odmowa dostępu (`permission-denied`) była więc nie do odróżnienia od faktycznego braku dokumentu i kursant dostawał komunikat „Nie znaleziono notatnika o podanym identyfikatorze", mimo że notatnik istniał.
  - Objaw był mylący także dlatego, że u lektora wszystko wyglądało normalnie — treść siedzi w `localStorage`, więc problem widać było wyłącznie po drugiej stronie linku.
  - Wprowadzono klasę błędu `ScratchpadAccessError` i rozróżnienie odmowy od braku dokumentu. Komunikat mówi teraz wprost, że reguły Firestore nie zostały wdrożone i podaje polecenie `npm run deploy:rules`.
  - Nowe pole `cloudBlockedReason` w `ScratchpadDocument` oraz **baner ostrzegawczy w edytorze**: „Ten notatnik nie zapisał się w chmurze — kursant go nie zobaczy". Ostrzeżenie pada u lektora, zanim wyśle link, a nie dopiero w konsoli przeglądarki.
- **Zamknięcie dziury w regułach Firestore (`firestore.rules`)**:
  - `allow list` dla `scratchpads` ustawione na **`false`** — to ono pozwalało jednym zapytaniem wylistować notatki wszystkich kursantów, bez logowania i bez znajomości linku.
  - `allow get` pozostaje otwarte **świadomie**: identyfikator dokumentu to `sp_{firebaseUid}`, a UID Firebase ma 28 losowych znaków, więc samo ID pełni rolę przepustki — dokładnie jak nieodgadywalny link do dokumentu Google. To realizuje model „widzi każdy, kto ma link".
  - `allow update` rozbite na trzy drogi: administrator, lektor-właściciel (`request.auth.uid == resource.data.teacherUid`) oraz gość z linkiem — ten ostatni **wyłącznie** gdy lektor włączył `allowStudentEdit` i **wyłącznie** w polach treści (`diff().affectedKeys().hasOnly([...])`). Wcześniej `update: if true` pozwalało kursantowi jednym zapisem nadać sobie uprawnienia, podmienić PIN albo przejąć dokument przez zmianę `teacherUid`.
  - Nowa kolekcja-indeks **`scratchpadPins/{pin}` → `{ scratchpadId }`**: dzięki niej wejście po kodzie PIN jest zwykłym `get` po znanym kluczu, a nie zapytaniem kolekcyjnym — i `list` może zostać zamknięty. Wpis nie zawiera treści notatek.
  - `ensureScratchpadPinIndex` dopisuje wpis przy tworzeniu notatnika **oraz przy każdym otwarciu przez lektora**, więc dokumenty sprzed wprowadzenia indeksu naprawiają się same, bez osobnej migracji. Stare zapytanie kolekcyjne zostało jako cichy fallback.
- **Zmiana nazwy na „Mój notatnik" / „Scratchpad"**:
  - Menu boczne kursanta, karta na panelu głównym, nagłówek ekranu kursanta, tytuł nowo tworzonych dokumentów i komunikaty błędów. Słowo „brudnopis" znika z widoków kursanta.
- **Import z Notion: koniec zawieszania (`functions/src/notion/sync.ts`)**:
  - **Przyczyna zawieszania:** treść każdej lekcji to osobne zapytanie do Notion, a szły **sekwencyjnie** wewnątrz pętli po wszystkich lekcjach. Import kursanta z trzydziestoma lekcjami oznaczał trzydzieści zapytań jedno po drugim — aplikacja wyglądała na zawieszoną, aż funkcja padała na timeout.
  - Pętlę rozbito na dwie fazy: najpierw **tanie odsianie** (dopasowanie kursanta, filtr wybranych lekcji, lista odrzuconych), potem pobieranie treści **paczkami po 5 równolegle** (`LESSON_FETCH_CONCURRENCY`).
  - **Druga przyczyna:** warunek `if (selection?.lessonIds && selection.lessonIds.length > 0)` traktował pustą listę jak brak filtra, czyli „importuj wszystko". Pusty wybór zaciągał ponownie **całe archiwum** kursanta. Teraz pusta lista to świadome „nic do pobrania", a `StudentNotionSyncModal` zawsze wysyła jawną listę zamiast `undefined`.
  - **Przyczyna „nie zaczytuje informacji o danym kursancie":** lekcja bez wypełnionego pola `Kursant (relacja)` i bez zgodnej nazwy wypadała z pętli po cichu — import kończył się „sukcesem", nie robiąc nic. Teraz raport zawiera ostrzeżenie mówiące, ilu z zaznaczonych lekcji nie udało się powiązać i gdzie to poprawić w Notion.
  - Pierwsze uruchomienie dla profilu działa bez zmian: przy pustej historii wszystkie lekcje są „nowe", więc zaznaczają się wszystkie.

### Nowość: Brudnopis Dostępny z Każdego Panelu, Backend Udostępniania i Poprawki Ćwiczeń

- **Zamykanie brudnopisu (`ScratchpadEditor.tsx`, `ScratchpadModal.tsx`)**:
  - Przycisk zamknięcia przeniesiony z pływającego krzyżyka nad oknem do paska nagłówka edytora — stary krzyżyk nachodził na przyciski udostępniania po przebudowie nagłówka.
  - Nowy opcjonalny prop `onClose`: bez niego przycisk się nie pojawia (ekran kursanta i widok publiczny mają własną nawigację).
- **Wejście do brudnopisu z górnego paska panelu lektora (`AdminPanel.tsx`, `ScratchpadStudentPicker.tsx`)**:
  - Nowy przycisk **„Brudnopis"** obok generatora AI i dodawania kursanta.
  - Nowy komponent `ScratchpadStudentPicker.tsx`: okno wyboru kursanta z wyszukiwarką po imieniu, loginie i adresie e-mail, sortowaniem alfabetycznym i awatarami. Po wybraniu kursanta od razu otwiera jego stały brudnopis — bez wchodzenia w profil.
- **Wejście do brudnopisu z panelu kursanta (`TodayScreen.tsx`, `Dashboard.tsx`)**:
  - Na panelu głównym kursanta pojawiła się karta **„Mój brudnopis z lektorem"** prowadząca wprost do wspólnego dokumentu (dotąd wejście było wyłącznie w menu bocznym).
- **Naprawa backendu udostępniania (`services/scratchpadService.ts`)**:
  - **Kluczowa poprawka:** `saveScratchpadContent` i `updateScratchpadSettings` używały `updateDoc`, które wymaga istniejącego dokumentu. Jeśli pierwszy zapis do chmury się nie udał, brudnopis istniał wyłącznie lokalnie, a **każdy kolejny zapis leciał na `not-found` w nieskończoność** — notatki nigdy nie docierały do kursanta, mimo że lektor widział je u siebie. Teraz przy błędzie `not-found` dokument jest odtwarzany w chmurze z pełnej kopii lokalnej (`setDoc`), co samoczynnie naprawia rozjechane brudnopisy.
- **Import historii lekcji z Notion — tylko nowe wpisy (`StudentNotionSyncModal.tsx`)**:
  - Lista lekcji domyślnie filtruje się do **„Nowe"** zamiast „Wszystkie" — przy kilkudziesięciu lekcjach w Notion widok był zdominowany przez wpisy dawno zaimportowane.
  - Przycisk importu nazywa się teraz **„Importuj nowe lekcje (N)"** i jasno komunikuje stan „Brak nowych lekcji do importu".
  - Gdy nie ma nic nowego, zamiast pustej listy pojawia się czytelny komunikat „Baza jest aktualna — nie ma nic nowego do pobrania" z liczbą już zaimportowanych lekcji.
- **Powiadomienia pop-up w każdym panelu (`TeacherHomeworkNotification.tsx`)**:
  - Powiadomienie o odesłanej przez kursanta pracy (prawy dolny róg, animacja sprężynowa + delikatny dźwięk) renderuje się teraz przez **portal do `<body>`**. Wcześniej wisiało wewnątrz `<main>`, więc wystarczyło, że któryś panel animował się transformem, a `position: fixed` liczyło się względem tego przodka — powiadomienie lądowało w losowym miejscu albo znikało pod krawędzią panelu.

### Poprawki ćwiczeń i prac domowych

- **Rozsypka w zadaniach na uzupełnianie luk (`utils/exerciseShuffle.ts`, `server.ts`)**:
  - Model układał `wordBank` w kolejności luk, więc poprawne słowo do pierwszej luki było pierwsze na liście i ćwiczenie sprawdzało wyłącznie przepisywanie. Dodano **tasowanie po stronie serwera** (`shuffleDistinct`) — jedyny sposób, który działa niezależnie od tego, czy model posłucha promptu. Ocena porównuje treść, nie pozycję, więc kolejność nie wpływa na sprawdzanie.
  - Instrukcje w promptach uzupełnione: `wordBank` ma być losowy, a w `multiple_choice` poprawne odpowiedzi mają być **rozłożone równomiernie między A, B i C**.
- **Błędny szyk zdania w korekcie błędów (`server.ts`)**:
  - Prompt `find_mistake` wymaga teraz, aby **co najmniej jedno zdanie w zestawie zawierało błędny szyk** (wrong syntax / word order): źle umiejscowiony okolicznik czasu, przysłówek częstotliwości w złym miejscu albo szyk pytający w zdaniu twierdzącym.
- **Mieszany sposób podpowiadania w korekcie błędów (`TestQuestionFields.tsx`)**:
  - Zadanie łączy teraz dwa tryby: część zdań kursant poprawia wpisując (z opcją „Kopiuj do edycji"), a co drugie **układa z wymieszanych klocków**. Tryb przydzielany jest naprzemiennie według numeru zdania, a nie losowo — losowanie przestawiałoby tryb przy każdym renderze.
- **Poziomy trudności Easy / Hard w tłumaczeniu zdań (`TestQuestionFields.tsx`)**:
  - Nowy przełącznik nad listą zdań. **Hard (domyślny)** to wpisywanie tłumaczenia z pamięci, **Easy** zamienia pole tekstowe na **układankę z różnokolorowych klocków** — zdanie pocięte na fragmenty i wymieszane.
  - Nowy komponent `SentenceTilePuzzle`: klocki wybiera się kliknięciem, kliknięcie w ułożony klocek zdejmuje go z powrotem, a kolor przypisany jest do treści fragmentu (nie do pozycji), żeby po przeniesieniu dało się go odszukać wzrokiem. Klocki tasowane są raz na zdanie, żeby nie przestawiały się pod palcami.
  - Nowy moduł `utils/exerciseShuffle.ts` z 13 testami: `shuffleArray`, `shuffleDistinct` (gwarantuje kolejność inną niż wejściowa — układanka podana już ułożona nie jest zadaniem), `splitSentenceIntoTiles` (grupuje słowa, żeby z długiego zdania nie zrobiło się dwadzieścia klocków) i `buildShuffledTiles`.
- **Wyraźne oznaczenie automatycznego feedbacku (`StudentHomeworkScreen.tsx`)**:
  - Po odesłaniu pracy kursant widzi na górze duży baner **„To jest automatyczny feedback"** (czcionka szeryfowa, 2xl, plakietka „Ocena wstępna") z informacją, że komentarz od lektora dostanie później i to on jest oceną wiążącą. Wcześniej w tym miejscu stała niepozorna notka o oczekiwaniu na weryfikację, przez co ocena automatu czytała się jak werdykt nauczyciela.

### Poprzedni etap: Przebudowa Interfejsu Prezentacji i Brudnopisu („Mniej znaczy lepiej") + Samouczek z Dymkami

**Cel przebudowy:** Paski narzędzi Prezentacji i Brudnopisu rozrosły się do kilkunastu równorzędnych przycisków w jednym rzędzie, w pięciu konkurujących kolorach. Interfejs został zredukowany do narzędzi używanych w trakcie mówienia, a operacje przygotowawcze zeszły do menu rozwijanych. Każda funkcja ma teraz opis w samouczku wyświetlanym jako dymek przypięty do konkretnego przycisku.

- **Nowy komponent `components/ui/MenuDropdown.tsx` (menu rozwijane)**:
  - Pierwsze w projekcie menu rozwijane uruchamiane lewym przyciskiem — istniejący `ContextMenu.tsx` obsługuje wyłącznie menu kontekstowe (prawy przycisk).
  - Panel renderowany w portalu na `position: fixed`, z automatycznym odwracaniem w górę przy braku miejsca i przyklejaniem do krawędzi ekranu (paski narzędzi bywają w kontenerach z `overflow: hidden`).
  - Obsługa klawiatury (strzałki, `Home`/`End`, `Enter`, `Escape`, `Tab`), role ARIA `menu` / `menuitem` / `menuitemcheckbox`, sekcje z nagłówkami, pozycje-przełączniki z ptaszkiem, skróty klawiszowe i opisy pod etykietą.
  - Tryb `preserveSelection` blokujący przejęcie fokusu (`onMouseDown → preventDefault`) — konieczny w pasku edytora, bo `execCommand` działa na zaznaczeniu, które ginie przy ucieczce fokusu do przycisku.
  - Kontrola z zewnątrz (`open` / `onOpenChange`) pozwalająca samouczkowi rozwinąć menu i wskazać schowane w nim pozycje.
- **Nowy komponent `components/ui/CoachMarks.tsx` (samouczek z dymkami)**:
  - Silnik samouczka wyświetlający **dymek z ogonkiem (speech bubble) przypięty do konkretnego elementu** wskazanego atrybutem `data-coach`.
  - Automatyczny dobór strony dymka (góra / dół / lewo / prawo) z odwróceniem przy braku miejsca, ogonek celujący w środek opisywanego elementu, wariant dolnego panelu na ekranach < 860 px.
  - Podświetlenie elementu (spotlight) rozdzielone na **dwie warstwy z-index**: przyciemnienie pod menu (`z-400`), obwódka i dymek nad menu (`z-600`), a samo menu pomiędzy (`z-500`) — dzięki temu samouczek opisuje również pozycje ukryte w menu, zamiast wskazywać przyciemniony element.
  - Kroki mogą przygotować scenę (`onBeforeShow` rozwija menu) i posprzątać po sobie (`onAfterShow`); pomiar prostokąta następuje po dwóch klatkach i po zakończeniu płynnego przewinięcia.
  - Nawigacja klawiaturą (strzałki, `Enter`, `Escape`) przechwytywana w fazie capture, żeby nie przewijać slajdów pod spodem.
- **Przebudowa paska Prezentacji (`LessonPresentationView.tsx`)**:
  - Z **12 równorzędnych przycisków zrobiło się 6 widocznych** w trzech strefach: tożsamość talii, narzędzia na żywo (Tablica, Brudnopis, Laser), widok (Notatnik, Pełny ekran) oraz Samouczek.
  - Operacje przygotowawcze — nowy slajd, generowanie talii AI, import konspektu, biblioteka zapisanych prezentacji, ręczny zapis i Wytyczne CELTA — schowane pod jednym menu **„Talia"** z podziałem na sekcje *Buduj lekcję*, *Biblioteka i zapis*, *Metodyka*.
  - **Usunięto dekoracyjne kolory** (emerald / amber / info / rose) niezgodne z regułą `index.css`: „Stan — jedyne nasycone barwy poza akcentem. Nie do dekoracji". Akcent oznacza teraz wyłącznie stan włączony (aktywny laser, otwarty notatnik, pełny ekran).
  - **Usunięto przycisk „Zapisz"** z paska — talia zapisuje się sama co 2 sekundy, więc jego miejsce zajął **wskaźnik stanu zapisu** przy tytule (`Zapisywanie…` / `Zapisano` / `Tylko lokalnie` z ostrzeżeniem o braku synchronizacji z chmurą). Ręczny zapis pozostaje w menu.
  - **Usunięto duplikat „AI Slajd"** z górnego paska — asystent pojedynczego slajdu został wyłącznie przy pasku nawigacji slajdów, gdzie jest akcją kontekstową.
  - Ujednolicono chowanie etykiet: zamiast czterech progów `hidden sm/md/lg/xl` (dających w połowie szerokości rząd nieopisanych ikon) obowiązuje jeden próg `lg` dla wszystkich przycisków naraz.
  - Skrót **`W`** (Tablica) dopisany do ściągawki skrótów w trybie pełnoekranowym.
- **Przebudowa Brudnopisu (`ScratchpadEditor.tsx`)**:
  - Nagłówek: z 5 kontrolek (chip PIN, kopiuj link, przełącznik PIN, przełącznik edycji, przenieś do dziennika) zrobiły się **3** — menu **„Udostępnij"** (link bezpośredni, kod PIN, wymóg PIN-u, zgoda na edycję przez kursanta), przycisk **„Do dziennika"** i ikona Samouczka.
  - Pasek formatowania: z **20 przycisków w płaskim rzędzie zrobiło się 9 elementów**. Na wierzchu zostały zakreślacze lektorskie (❌ Błąd / ✅ Poprawnie / 💡 Słówko), pogrubienie, kursywa i lista; nagłówki i pozostałe style trafiły do menu **„Styl"**, a data lekcji, szablon sekcji, lista numerowana i linia — do menu **„Wstaw"**.
  - Wszystkie przyciski formatowania blokują przejęcie fokusu, dzięki czemu zaznaczenie tekstu przeżywa kliknięcie w pasek.
  - Kolory zakreślaczy przeniesione na tokeny stanu (`danger` / `accent` / `warn`) zamiast surowych klas `rose` / `emerald` / `amber`.
- **Treść samouczków (`presentationCoachSteps.ts`, `scratchpadCoachSteps.ts`)**:
  - **16 kroków dla Prezentacji** (Podstawy, Narzędzia na żywo, Widok, Menu talii, Nawigacja, Prowadzenie) i **do 9 kroków dla Brudnopisu** (Podstawy, Formatowanie, Dostęp, Po lekcji).
  - Każdy krok zawiera nazwę grupy, tytuł, opis działania funkcji językiem lektora oraz opcjonalną wskazówkę praktyczną i skrót klawiszowy.
  - Kroki Brudnopisu dobierają się do roli i trybu: kursant w trybie podglądu nie dostaje opisu paska formatowania ani przełączników uprawnień, których nie ma na swoim ekranie.

### Poprzedni etap — poprawka: Zamrożona Pierwsza Kolumna w Bazie Kursantów (`StudentDatabaseScreen.tsx`)
- Kolumna zaznaczenia i kolumna z nazwiskiem kursanta są **przyklejone przy przewijaniu tabeli w bok** (`position: sticky`), dzięki czemu po dojściu do kolumny logowań nadal widać, czyj to wiersz.
- Szerokość kolumny zaznaczenia ustalona sztywno (48 px), bo kolumna nazwiska przykleja się dokładnie za nią — przy szerokości wyliczanej przez tabelę obie rozjechałyby się o kilka pikseli.
- Tła zamrożonych komórek są nieprzezroczyste (inaczej przewijane kolumny prześwitują pod spodem), a podświetlenia zaznaczenia i najechania wracają jako warstwa `background-image`, żeby nie skasować krycia ustawionego kolorem tła.
- Zamrożone kolumny oddziela od reszty tabeli subtelna krawędź (`shadow-[1px_0_0_0_...]`).

### Poprzedni etap: Współdzielony Brudnopis Google Docs z Kodem PIN i Dostępem przez Link (`Scratchpad`)
- **Architektura jednego trwałego dokumentu per kursant (`scratchpads/{scratchpadId}`)**:
  - Wdrożono moduł **Scratchpad (Współdzielony Brudnopis Lekcyjny)** działający na zasadzie współdzielonego dokumentu Google Docs / Notion.
  - Zgodnie z założeniem kursant ma **dokładnie jeden stały brudnopis** powiązany ze swoją nauką, do którego lektor i kursant wracają na każdej lekcji, bez tworzenia osobnych plików.
  - Dokument posiada unikalny 6-znakowy kod PIN (np. `ABC-123`) oraz stały bezpośredni link (`/scratchpad?pin=ABC-123` lub `/doc?pin=...`), umożliwiający natychmiastowe otwarcie na telefonie, tablecie czy drugim monitorze bez konieczności logowania.
- **Model danych i Firestore (`types.ts`, `firestore.rules`)**:
  - Utworzono interfejs `ScratchpadDocument` w `types.ts` z polami: `id`, `pin`, `studentId`, `studentName`, `teacherUid`, `teacherName`, `title`, `contentHtml`, `contentText`, `allowStudentEdit`, `lastEditedBy`, `version`, `createdAt`, `updatedAt`.
  - Wdrożono reguły bezpieczeństwa Firestore dla kolekcji `scratchpads/{scratchpadId}`: publiczny odczyt po znanym ID lub PIN, bezpieczny zapis dla lektorów oraz edycja zsynchronizowana w czasie rzeczywistym.
- **Serwis brudnopisu (`services/scratchpadService.ts`)**:
  - `getOrCreateStudentScratchpad`: pobranie istniejącego lub utworzenie trwałego dokumentu z inicjalnym szablonem lekcji i unikalnym kodem PIN.
  - `findScratchpadByPin`: wyszukiwanie dokumentu po kodzie PIN z pełną normalizacją znaków mylących.
  - `subscribeScratchpad`: subskrypcja zmian w czasie rzeczywistym przez Firestore `onSnapshot`.
  - `saveScratchpadContent`: automatyczny debounced zapis treści z wersjonowaniem i metadanymi edytora.
  - `updateScratchpadSettings`: przełączanie uprawnień (np. tryb tylko do odczytu vs zezwolenie na edycję dla kursanta).
  - `buildScratchpadUrl`: generowanie gotowych linków do udostępnienia kursantowi.
- **Edytor tekstu bogatego w stylu Google Docs (`components/scratchpad/ScratchpadEditor.tsx`)**:
  - Pełny pasek narzędzi: nagłówki (p, H1, H2, H3), pogrubienie, kursywa, podkreślenie, przekreślenie, listy punktowane i numerowane, podziałka pozioma, cofanie i ponawianie.
  - Szybkie zakreślacze językowe: ❌ błąd kursanta (czerwony), ✅ poprawna forma (zielony), 💡 nowe słówko (żółty/bursztynowy).
  - Narzędzia lekcyjne: wstawianie dzisiejszej daty jako nagłówka lekcji (`📅 Lekcja — DD.MM.YYYY`) oraz wstawianie szablonu sekcji.
  - Płynny wskaźnik zapisu w chmurze (*„Zapisano w chmurze”* / *„Zapisywanie...”*) oraz licznik słów.
  - Przycisk zasilania Dziennika Lekcji (*„Przenieś do Dziennika lekcji”*) z automatyczną ekstrakcją słówek i poprawek do 4 bloków Notion.
- **Ekrany i punkty wejścia**:
  - `components/scratchpad/PublicScratchpadScreen.tsx`: publiczny ekran pod trasą `/scratchpad` oraz `/doc` z formularzem wpisania kodu PIN lub bezpośrednim odczytem z parametru `?pin=...`.
  - `components/scratchpad/StudentScratchpadScreen.tsx`: dedykowany ekran w panelu kursanta zintegrowany z `Dashboard.tsx`.
  - `components/scratchpad/ScratchpadModal.tsx`: uniwersalne okno modalne do otwierania brudnopisu z dowolnego miejsca.
  - **Narzędzie Prezentacji (`LessonPresentationView.tsx`)**: przycisk **„Brudnopis (PIN)”** w pasku narzędzi obok tablicy i minutnika.
  - **Baza Kursantów (`StudentDatabaseScreen.tsx`)**: przycisk **„Brudnopis”** w wierszu tabeli oraz opcja w menu rozwijanym.
  - **Profil Kursanta (`AdminPanel.tsx`)**: wyróżniona karta **„Współdzielony Brudnopis (Scratchpad / Google Docs)”** z bezpośrednim otwarciem modalu.
  - **Menu boczne (`Sidebar.tsx`)**: nowa pozycja **„Mój brudnopis”** dla zalogowanych uczniów.
  - **Routing w `App.tsx`**: publiczne trasy `/scratchpad` oraz `/doc` dostępne przed ekranem logowania.
- **Testy jednostkowe (`tests/scratchpad.test.ts`)**:
  - Kompletny zestaw testów sprawdzających generowanie szablonu, formatowanie URL z kodem PIN, normalizację kodów dostępu oraz ekstrakcję sekcji do 4 bloków Notion (148 testów przechodzących).

### Poprzedni etap: Okno Zaproszenia do Aplikacji w Bazie Kursantów i Profilu Kursanta (`StudentInviteEmailModal.tsx`)

- **Dedykowany komponent okna zaproszenia (`StudentInviteEmailModal.tsx`)**:
  - Utworzono modal wzorowany na widoku mailingu oraz oknie potwierdzenia wysyłki prac domowych (`HomeworkEmailConfirmationModal.tsx`).
  - Umożliwia wysłanie spersonalizowanego e-maila powitalnego zawierającego wygenerowany login (`username`), hasło (istniejące `tempPassword` lub nowe wygenerowane jednym kliknięciem), bezpośredni link do logowania w aplikacji (`appUrl`) oraz opcjonalną notatkę/instrukcje od lektora.
  - Wyposażony w podgląd na żywo (HTML oraz Plain text), symulację nagłówka klienta poczty, opcję kopii ukrytej (BCC) dla lektora oraz przyciski szybkiego kopiowania danych logowania (do wysyłki np. przez WhatsApp / SMS) i pełnej treści wiadomości.
  - Automatycznie synchronizuje zaktualizowane hasło tymczasowe w Firestore (`tempPassword`, `requirePasswordChange: true`) oraz w Firebase Authentication (`/api/admin-users/users/:uid/password`), a także opcjonalnie aktualizuje docelowy adres e-mail kursanta.
  - Zapisuje metadane wysyłki w profilu kursanta (`lastInviteSentAt`, `inviteSentBy`).
- **Integracja w Bazie Kursantów (`StudentDatabaseScreen.tsx`)**:
  - Dodano szybki przycisk **„Zaproszenie”** w kolumnie akcji wiersza każdego kursanta.
  - Dodano pozycję **„Wyślij zaproszenie do aplikacji”** w rozwijanym menu opcji wiersza (`MoreVertical`).
  - W kolumnie e-mail dodano wskaźnik informujący o dacie wysłania ostatniego zaproszenia.
- **Integracja w Profilu Kursanta (`AdminPanel.tsx`)**:
  - Dodano wyróżniony kafelek z przyciskiem **„Wyślij zaproszenie”** w karcie *„Komunikacja i powiadomienia e-mail (Mailing)”*.
  - Dodano przycisk **„Wyślij zaproszenie do aplikacji”** w sekcji *„Akcje i zabezpieczenia konta”* obok opcji zmiany i kopiowania hasła.
- **Rozszerzenie szablonu e-maila powitalnego (`services/homeworkEmail.ts`)**:
  - Rozbudowano `buildWelcomeEmail` oraz interfejs `WelcomeEmailParams` o obsługę pól `customNote`, `assignedBy` oraz `subject`, dodając estetyczny blok notatki w ciemnej stylistyce CRIBRO.
- **Aktualizacja reguł Firestore i typów (`types.ts`, `firestore.rules`)**:
  - Dodano pola `lastInviteSentAt` i `inviteSentBy` do interfejsu `User` oraz białej listy walidacji w regułach Firestore.

### Poprzedni etap: Narzędzie E-Learningu, Pokoje na PIN & Live Sync dla Kursantów (`/live` i `/join`)
- **Architektura sesji chmurowych z kodem PIN (`liveSessions/{pin}`)**:
  - Wdrożono moduł prezentacji i lekcji e-learningowych na żywo wzorowany na Articulate 360 oraz Nearpod/Kahoot.
  - Kompletny dokument planu, architektury i kolejnych faz znajduje się w pliku **[ELEARNING_CLASSROOM_PLAN.md](./ELEARNING_CLASSROOM_PLAN.md)**.
- **Model danych i Firebase Firestore (`types.ts`, `firestore.rules`)**:
  - Dodano interfejsy `LiveSession` oraz `LiveSessionStudent`.
  - Wdrożono bezpieczne reguły Firestore dla `liveSessions/{pin}`: publiczny odczyt po znanym kodzie PIN (`get`), blokada listowania całej kolekcji dla osób niebędących lektorami (`list`), uprawnienia zapisu dla lektorów oraz możliwość rejestracji obecności przez kursantów.
- **Serwis sesji na żywo (`services/liveSessionService.ts`)**:
  - Generator unikalnych 6-znakowych kodów PIN (`ABC-123`) z alfabetu bez mylących się znaków.
  - Pełna subskrypcja stanu w czasie rzeczywistym (`onSnapshot`), synchronizacja przełączania slajdów, odsłoniętych odpowiedzi, tablicy lektora, minutnika i notatek.
  - Obsługa dołączania kursantów (`joinLiveSession`), pulsu obecności (`heartbeatLiveSession`) i zamykania sesji (`endLiveSession`).
- **Nowy ekran kursanta `LiveJoinScreen.tsx`**:
  - Dostępny pod ścieżką `/live` oraz `/join` w `App.tsx` bez konieczności logowania ani posiadania konta.
  - Obsługa wejścia z bezpośredniego linku `cribro.pl/live?pin=ABC123`.
  - Responsywny podgląd slajdu ze skalowaniem tablicy lektora, wskaźnikiem laserowym, zegarem i notatnikiem w locie.
- **Panel prowadzącego `PresenterPanel.tsx`**:
  - Przycisk **„Uruchom sesję Live (PIN)”** w nagłówku panelu prezentera.
  - Modal z kodem PIN, przyciskami kopiowania linku/PINu oraz listą kursantów obecnych na żywo.

### Poprzedni etap: Draft E-maila Powitalnego, Sugestia Zmiany Hasła, Logowanie Google & Nowy Onboarding

- **Draft e-maila powitalnego i zapraszającego do aplikacji (`welcome_invite`)**:
  - Utworzono szablon e-maila powitalnego `welcome_invite` w `AdminMailingScreen.tsx` oraz dedykowaną funkcję `buildWelcomeEmail()` w `services/homeworkEmail.ts`.
  - Zawiera spersonalizowane powitanie w wołaczu (`formatPolishGreeting`), wygenerowany login (`username`), hasło tymczasowe (`tempPassword`), bezpośredni przycisk CTA do logowania w aplikacji, wykaz kluczowych modułów oraz oficjalną wizytówkę lektora w stopce.
  - **Ujednolicenie stylistyki wszystkich e-maili**: Wszystkie szablony (`welcome_invite`, `homework_new`, `homework_reminder_24h`, `homework_graded`, `lesson_summary_vocab`) zostały sformatowane w jednolitej, ciemnej kolorystyce platformy CRIBRO (tło `#0f172a`, karty `#1e293b`, akcenty i przyciski w kolorze `#0d9488`, estetyczna stopka kontaktowa lektora).
- **Sugestia zmiany hasła po pierwszym logowaniu (`PasswordChangeSuggestion.tsx`)**:
  - Dedykowany, nieblokujący banner informacyjny wyświetlany kursantowi po pierwszym zalogowaniu przy użyciu hasła tymczasowego (`user.requirePasswordChange === true && !user.passwordChangeDismissed`).
  - Oferuje 3 ścieżki: (1) Natychmiastowa zmiana hasła na własne (z walidacją powtórzenia hasła), (2) Połączenie profilu z kontem Google za pomocą 1 kliknięcia, (3) „Pomiń na razie”, co trwale zapisuje flagę `passwordChangeDismissed: true` w Firestore i nie narzuca przymusu.
  - Zaktualizowano reguły bezpieczeństwa Firestore (`firestore.rules`) o pole `passwordChangeDismissed`.
- **Łączenie konta z Google i logowanie przez Google**:
  - Integracja metody `linkGoogleAccount()` z `AuthContext` na poziomie banneru sugestii oraz w `SettingsScreen.tsx`.
  - Po pomyślnym powiązaniu konta z Google, system automatycznie usuwa hasło tymczasowe (`tempPassword: deleteField()`) i wyłącza flagę `requirePasswordChange`, umożliwiając późniejsze logowanie jednym kliknięciem przez Google.
- **Rozbudowa i unowocześnienie Onboardingu (`OnboardingOverlay.tsx`)**:
  - Przebudowa przewodnika na dynamiczną, 7-krokową ścieżkę oprowadzającą kursanta po kluczowych sekcjach aplikacji:
    1. *Wprowadzenie i Panel Główny* (`tour-generator`)
    2. *Prace Domowe i Zadania od Lektora* (`tour-homework`)
    3. *Fiszki i Inteligentne Powtórki SRS* (`tour-flashcards`)
    4. *Historia Lekcji i Format 4 Bloków Notion* (`tour-history`)
    5. *Układanka i Tłumaczenie z Pamięci AI* (`tour-generator-header`)
    6. *Personalizacja, Bezpieczeństwo i Konto Google* (`tour-nav-settings`)
    7. *Przycisk Pomoc w Menu* (`tour-help-button`)
  - **Ruchome dymki i spotlight**: Interaktywne ramki spotlightu nad wskazywanym elementem, płynne animacje `motion/react`, wskaźniki kroków oraz bogate mikro-repliki interfejsu (symulacja wpisywania, animowane klocki układanki, obracana fiszka z wymową fonetyczną).
  - **Dostępność i wymóg**: Onboarding uruchamia się obowiązkowo po pierwszym zalogowaniu kursanta, a w menu bocznym (`Sidebar.tsx`) dostępny jest wyraźny przycisk **„Pomoc”** (`id="tour-help-button"`), który pozwala uruchomić przewodnik w dowolnym momencie.

### Poprzedni etap: Bezpośrednie Linki do Prac Domowych z E-maila (Bez Logowania)
- **Generowanie unikalnego linku i tokenu**:
  - Każda nowo utworzona i przypisana praca domowa (`HomeworkComposer.tsx`, `HomeworkEmailConfirmationModal.tsx`) otrzymuje kryptograficznie bezpieczny unikalny `accessToken` (prefiks `hw_...`) oraz 14-dniowy limit ważności (`accessExpiresAt`).
  - Generowany jest dedykowany adres URL `/hw?token={accessToken}` prowadzący bezpośrednio do materiału.
- **Bezpieczne endpointy backendowe w `server.ts`**:
  - `GET /api/homework/direct/:token`: weryfikuje token, sprawdza datę ważności (zwraca kod HTTP 410 w razie przeterminowania), pobiera dane ucznia i serwuje bezpieczny zestaw ćwiczeń bez ujawniania gotowych odpowiedzi.
  - `POST /api/homework/direct-submit`: publiczny endpoint z natychmiastową ewaluacją odpowiedzi, aktualizacją statusu zadania na `'submitted'` oraz bezpośrednim zapisem wyników do podkolekcji `users/{studentUid}/practiceLogs` i profilu kursanta za pomocą Firebase Admin SDK (zgodnie z `firestore.rules`).
- **Nowy ekran kursanta `DirectHomeworkScreen.tsx`**:
  - Dostępny od razu pod ścieżką `/hw` i `/homework-direct` w `App.tsx` bez konieczności wcześniejszego logowania i bez zbędnego szumu.
  - Płynny, nowoczesny interfejs: pasek postępu, wskaźnik liczby rozwiązanych ćwiczeń, obsługa wszystkich 5 typów zadań (`translation`, `word_order`, `multiple_choice`, `fill_in_the_blank`, `find_errors`) za pomocą `HomeworkExercise.tsx`.
  - Ekran sukcesu z natychmiastowym feedbackiem punktowym i opcjonalnym przejściem do zalogowania na platformę.
- **Szablon e-mail z powiadomieniem**:
  - `services/homeworkEmail.ts`: zaktualizowano szablon powiadomienia o pracy domowej o wyrazisty przycisk CTA *„Wykonaj zadanie teraz (bez logowania) →”* oraz informację o unikalnym linku i terminie ważności.

### A. Konfiguracja Resend API i Refaktoryzacja Mailingu
- **Przeniesienie klucza API do Ustawień Admina**:
  - Usunięto pola wprowadzania i zapisywania klucza Resend API z widoku mailingu (`AdminMailingScreen.tsx`).
  - W `components/settings/SettingsScreen.tsx` dodano dedykowaną, zabezpieczoną kartę **"Konfiguracja Resend API (Mailing)"** dostępną wyłącznie dla ról `admin` oraz `teacher`.
  - Wdrożono odczyt aktualnego stanu konfiguracji z backendu (`/api/mailing/status`), maskowanie klucza (`re_••••••••`), przełącznik widoczności oraz bezpieczny zapis do `.env` i Firestore (`system/mailing`) przez `/api/mailing/save-key`.
- **Ujednolicenie nazewnictwa**:
  - Zmieniono nazwę zakładki w całym systemie z *„Poczta & Mailing”* / *„Mailing & Powiadomienia e-mail”* na proste i czytelne **„Mailing”** ([Sidebar.tsx](components/dashboard/Sidebar.tsx), [AdminPanel.tsx](components/admin/AdminPanel.tsx), [AdminMailingScreen.tsx](components/admin/AdminMailingScreen.tsx)).
- **Konfiguracja nadawców i adresów**:
  - Skonfigurowano oficjalne adresy nadawców z szybkim przełącznikiem w interfejsie: `wyrozumski@maciej.pro` oraz `maciej@learnwithmaciej.com`.
  - Dodano automatyczne formatowanie imion w polskim wołaczu (np. *„Witaj Maćku!”* zamiast mianownika) w szablonach e-mail.
  - Skonfigurowano nagłówek `Reply-To`, usunięto przedrostki `[TEST]` ze standardowych tematów wiadomości.
  - Zaimplementowano backendową symulację wiadomości przychodzących i akcje skrzynki odbiorczej przez bezpieczne endpointy API.

### B. Moduł Pracy Domowej i Potwierdzenie Wysyłki E-mail
- **Modal potwierdzenia wysyłki e-maila przez nauczyciela**:
  - Utworzono komponent [HomeworkEmailConfirmationModal.tsx](components/admin/HomeworkEmailConfirmationModal.tsx).
  - Po przypisaniu lub wygenerowaniu pracy domowej, przed wysłaniem powiadomienia e-mail wyświetla się modal z:
    - Rzeczywistym imieniem kursanta pobranym z profilu bazy danych,
    - Wyborem i potwierdzeniem adresu skrzynki nadawcy (`wyrozumski@maciej.pro` / `maciej@learnwithmaciej.com`),
    - Potwierdzeniem adresu e-mail odbiorcy,
    - Pełnym zestawieniem zadań składających się na pracę domową (tłumaczenia, luki, błędy, puzzle zdań).
  - Nauczyciel ma możliwość zatwierdzenia wysyłki lub pominięcia wysyłania e-maila (zapis samej pracy w platformie).
- **Powiadomienia Real-time o oddanych pracach**:
  - Dodano nasłuchiwacz Firestore na nowe/oddane prace domowe kursantów z dedykowanym komponentem powiadomień dla lektora ([TeacherHomeworkNotification.tsx](components/dashboard/TeacherHomeworkNotification.tsx)).
  - Dodano licznik nieprzejrzanych prac w menu bocznym (badge w `Sidebar.tsx`).
- **Usprawnienia sprawdzania prac i AI Evaluation**:
  - Wdrożono motywujący, konstruktywny prompt ewaluacji AI dla lektora w [aiSuggestions.ts](services/aiSuggestions.ts).
  - Zabezpieczono renderowanie odpowiedzi typu *fill-in-the-blank* (obsługa zarówno stringów, jak i obiektów `{ blankWord, sentence }` w [StudentHomeworkScreen.tsx](components/dashboard/StudentHomeworkScreen.tsx) i panelu nauczyciela).
  - Zaimplementowano wyskakujące okno z podsumowaniem dla kursanta po sprawdzeniu pracy ([StudentHomeworkGradedModal.tsx](components/dashboard/StudentHomeworkGradedModal.tsx)) z blokadą przeskakiwania ekranu.
- **Nowy typ zadania: Korekta błędów w zdaniu (Find Errors / Spot the Mistakes) w Pracy Domowej i Testach**:
  - **Praca domowa (`find_errors`)**:
    - **Ekran Pracy Domowej Lektora ([HomeworkScreen.tsx](components/dashboard/HomeworkScreen.tsx))**:
      - Naprawiono widoczność: kafelek „2. Poprawianie błędów w zdaniach” został w pełni powiązany z typem `find_errors` (zamiast dotychczasowego pustego lub zastępczego `fill_in_the_blank`).
      - Zaimplementowano dedykowany generator AI (`generateFindErrors`) tworzący zdania z celowymi błędami na bazie wybranych lekcji, słownictwa oraz sekcji `thingsToImprove` i `corrections`.
      - Zbudowano formularz edycji dla lektora: pola na zdanie z błędem (`incorrectSentence`), poprawną wersję (`correctSentence`), wskazówkę naprowadzającą (`hint`), kontekst PL (`polishHint`) oraz wyjaśnienie (`explanation`).
      - W podglądzie zadania oraz w widoku kursanta dodano odznakę błędu, rozwijaną wskazówkę oraz przycisk **„Kopiuj zdanie do edycji”** ułatwiający szybkie poprawienie felernego fragmentu.
    - **Modal Zadania Specjalnego Lektora ([TeacherSpecialTaskModal.tsx](components/admin/TeacherSpecialTaskModal.tsx))**:
      - Dodano przełącznik typu zadania w nagłówku modalu (`Tłumaczenie` vs `Poprawianie błędów`).
      - Zintegrowano generator `generateFindErrors` w dwustopniowym pipeline AI oraz dostosowano listę wygenerowanych zdań i tryb edycji inline do obsługi specyficznych pól `find_errors`.
    - **Kreator Prac Domowych ([HomeworkComposer.tsx](components/admin/HomeworkComposer.tsx))**:
      - W podglądzie pozycji dodano wyświetlanie wskazówki (`💡 Wskazówka: {item.hint}`).
    - **Ewaluacja AI ([geminiService.ts](services/geminiService.ts))**:
      - Zaktualizowano `evaluateTeacherHomework` o bezpośrednią obsługę ewaluacji nadesłanych przez kursanta poprawek zdań typu `find_errors`.
  - **Testy (`find_mistake`)**:
    - **Generator Testów AI ([server.ts](server.ts))**:
      - W `typeRulesMap['find_mistake']` nakazano modelowi do KAŻDEGO zdania z błędem obowiązkowo dodawać w nawiasie zwięzłą wskazówkę naprowadzającą ułatwiającą pracę kursantowi (np. `(wskazówka: zły przyimek)`, `(wskazówka: 3. osoba l. pojedynczej)`).
      - W endpointzie oceniania `/api/gemini/grade-test` dodano instrukcję weryfikującą poprawność naprawy błędu i zachowania struktury zdania.
    - **Interfejs Rozwiązywania Testu ([TestQuestionFields.tsx](components/tests/TestQuestionFields.tsx))**:
      - Wdrożono funkcję `extractSentenceHint` inteligentnie wyodrębniającą wskazówkę z nawiasów na końcu zdania.
      - W `SentenceListTask` zdanie z błędem jest czyszczone ze wskazówki, a wskazówka wyświetla się w eleganckim boksie `💡 Wskazówka: ...`.
      - Przycisk **„Kopiuj do edycji”** wkleja do pola odpowiedzi wyłącznie czyste zdanie z błędem bez nawiasu wskazówki.
      - Wyeliminowano powielanie promptu w nagłówku `TestQuestionHeader` oraz błędne renderowanie opcji jednokrotnego wyboru (radio) dla tego typu pytań.
    - **Podgląd i Edycja w Panelu Lektora ([AdminTestGenerator.tsx](components/admin/AdminTestGenerator.tsx), [TestPreviewModal.tsx](components/admin/TestPreviewModal.tsx))**:
      - Ujednolicono prezentację zadań w formie listy zdań ze złotymi odznakami błędu i podglądem klucza odpowiedzi.

### C. Zaawansowana Synchronizacja z Notion i Układ 4 Bloków
- **Granularna selekcja lekcji w synchronizacji z Notion**:
  - W modalu synchronizacji [StudentNotionSyncModal.tsx](components/admin/StudentNotionSyncModal.tsx) dodano możliwość precyzyjnego wyboru, które lekcje z bazy Notion mają zostać zaimportowane, a które pominięte, zapobiegając duplikowaniu pracy i wielokrotnemu importowi tych samych zajęć.
  - Zaimplementowano trwałą czarną listę odrzuconych lekcji (`rejectionBlacklist`) w dokumencie `notionSyncState`.
  - Wprowadzono sekcję lekcji oczekujących na zatwierdzenie w stagingu z elastyczną weryfikacją AI.
- **Ochrona widoku kursanta**:
  - Wprowadzono filtr blokujący wyświetlanie kursantom wersji roboczych (drafts / pending confirmation) — uczeń widzi wyłącznie lekcje oficjalnie zatwierdzone przez lektora.
- **Ścisły 4-blokowy format lekcji Notion**:
  - Wymuszono spójny podział każdej lekcji na 4 standardowe bloki Notion:
    1. `Words & Phrases` (słownictwo i wyrażenia)
    2. `Grammar & Accuracy` (struktury gramatyczne i poprawki językowe)
    3. `Pronunciation` (trudne dźwięki, akcent i wymowa fonetyczna)
    4. `Homework` (zadania domowe i materiały utrwalające)
  - Ukryto wiązanie ze scenariuszami na rzecz bezpośredniego, czytelnego układu blokowego Notion.
  - Dodano narzędzie retroaktywnego czyszczenia i migracji starszych lekcji do nowego formatu ([CleanLessonsModal.tsx](components/admin/CleanLessonsModal.tsx)).
- **Toggle Heading widoku „Do potwierdzenia” (Notion-style)**:
  - Sekcja lekcji oczekujących na potwierdzenie została przekształcona w kompaktowy **Toggle Heading** w stylu Notion ([AdminPanel.tsx](components/admin/AdminPanel.tsx)).
  - Domyślnie zwinięty widok zajmuje minimalną przestrzeń na ekranie, prezentując w jednym wierszu kluczowe metryki (liczbę lekcji oczekujących, podział na nowe wpisy i aktualizacje).
  - Rozwijanie i zwijanie jednym kliknięciem z animacją chevronu.
- **Weryfikacja istnienia lekcji w bazie kursanta & Opcja „Zaktualizuj rekord” (Update records)**:
  - Zaimplementowano algorytm weryfikujący, czy dana lekcja ze stagingu Notion istnieje już w historii kursanta (dopasowanie po `notionPageId`, dacie spotkania lub znormalizowanym tytule tematu).
  - Wpisy istniejące są wyraźnie oznaczone plakietką `🔄 Istnieje w bazie (Aktualizacja: YYYY-MM-DD)` i wyposażone w dedykowany przycisk **„Zaktualizuj rekord”**.
  - Kliknięcie „Zaktualizuj rekord” natychmiastowo konwertuje i aktualizuje istniejący rekord do najnowszego układu 4 bloków Notion (`structuredBlocks`, `vocabularyText`, `corrections`, `homeworkText`), synchronizuje powiązane zestawy fiszek w tle oraz usuwa zbędny szkic roboczy, eliminując duplikaty w bazie.
- **Wyraźne podsumowanie nowości wg dat na samej górze**:
  - Na samej górze panelu lekcji wprowadzono wyeksponowany baner analityczny badający osie czasu.
  - System porównuje daty lekcji z Notion z najnowszą potwierdzoną datą w bazie kursanta, jasno informując lektora:
    - Która lekcja jest najświeższa chronologicznie (`📅 YYYY-MM-DD — Temat`),
    - Ile wpisów to całkowicie nowe lekcje,
    - Ile wpisów to aktualizacje istniejących zajęć,
    - Jakie konkretnie nowe terminy pojawiły się w Notion ponad dotychczasową historię ucznia.

### D. Baza Kursantów: Checkboxy, Opcje Rekordu (Notion Fetch) i Operacje Masowe
- **Tick boxy (checkboxy) w bazie kursantów**:
  - Wdrożono kolumnę tick boxów w [StudentDatabaseScreen.tsx](components/admin/StudentDatabaseScreen.tsx) dla każdego kursanta oraz nadrzędny checkbox w nagłówku tabeli (z obsługą stanu częściowego zaznaczenia `indeterminate` i szybkiego zaznaczania/odznaczania wszystkich przefiltrowanych).
- **Rozszerzone opcje rekordu i bezpośredni Notion Fetch**:
  - Dodano dedykowany przycisk oraz pozycję w menu rozwijanym `...` (**Więcej opcji**) umożliwiającą natychmiastowe uruchomienie **Pobierz / Zaktualizuj z Notion** dla konkretnego kursanta przy użyciu zintegrowanego modalu [StudentNotionSyncModal.tsx](components/admin/StudentNotionSyncModal.tsx).
  - Dodatkowe szybkie akcje w menu wiersza: przejście do profilu, planer lekcji, prace domowe, szybka edycja adresu e-mail oraz bezpieczne usuwanie kursanta.
- **Pływający pasek akcji masowych (Bulk Action Bar)**:
  - Automatycznie pojawia się na dole ekranu po zaznaczeniu $\ge 1$ kursantów.
  - Wyświetla licznik zaznaczonych, przycisk **Modyfikuj wspólne**, przycisk **Usuń** (styl `danger`) oraz przycisk odznaczenia wszystkich.
- **Modal modyfikacji wspólnych elementów (Bulk Edit Modal)**:
  - Pozwala na jednoczesną zmianę poziomu zaawansowania (CEFR: A1–C2), uprawnień/roli (`user`, `teacher`, `admin`) oraz preferencji mailingu (włączenie/wyłączenie powiadomień) z opcją *(Bez zmian)* dla pól nieedytowanych.
  - Narzędzia pomocnicze w [utils/studentDatabaseUtils.ts](utils/studentDatabaseUtils.ts).
- **Bezpieczne usuwanie (Bulk Delete & Single Delete)**:
  - Modal masowego usuwania z listą usuwanych użytkowników, wyraźnym ostrzeżeniem o nieodwracalności oraz usunięciem kont zarówno z bazy Firestore, jak i z systemu Firebase Authentication.

### F. Zmiana Kolejności Zadań (Reordering) oraz Nowy Standard E-mail ze Stopką-Wizytówką
- **Zmiana kolejności zadań przed przypisaniem kursantowi (Reordering)**:
  - **Kreator prac domowych ([HomeworkComposer.tsx](components/admin/HomeworkComposer.tsx))**:
    - W kroku 4 („Sprawdź i przypisz”) dodano możliwość zmiany kolejności całych bloków/typów ćwiczeń (`moveSection`) oraz pojedynczych zadań wewnątrz sekcji (`moveItem`) przy pomocy przycisków góra/dół (`ChevronUp`, `ChevronDown`).
    - Każde zadanie otrzymało wyraźny numer porządkowy odzwierciedlający dokładną sekwencję, w jakiej uczeń będzie je wykonywać.
  - **Generator zadań specjalnych AI ([TeacherSpecialTaskModal.tsx](components/admin/TeacherSpecialTaskModal.tsx))**:
    - W liście wygenerowanych przez modele AI zdań dodano przyciski przesuwania `moveSentence` w górę i w dół, pozwalając lektorowi dowolnie ułożyć kolejność pytań przed zapisaniem i przypisaniem zadania.
  - **Generator testów ([AdminTestGenerator.tsx](components/admin/AdminTestGenerator.tsx))**:
    - Oprócz istniejącego przestawiania pytań głównych, dodano funkcję `moveSentenceInQuestion` z przyciskami góra/dół dla zdań podrzędnych (np. w pytaniach złożonych z wielu zdań do tłumaczenia lub korekty), z automatyczną synchronizacją i reindeksacją klucza odpowiedzi.
  - **Ręczny edytor pracy domowej ([HomeworkScreen.tsx](components/dashboard/HomeworkScreen.tsx))**:
    - W formularzu tworzenia/edycji zadań lektora dodano przyciski góra/dół dla ćwiczeń tłumaczeniowych (`moveTranslationItem`) oraz zdań z błędami do korekty (`moveErrorCorrectionItem`).
- **Uproszczenie treści e-maila z powiadomieniem o pracy domowej**:
  - Zgodnie z wytycznymi usunięto szczegółowe listowanie treści zadań i zdań w wiadomości e-mail — mail zawiera wyłącznie zwięzłą informację o przypisaniu pracy domowej z tytułem, opcjonalnym terminem wykonania, ewentualnymi wskazówkami/notatką lektora oraz dużym przyciskiem CTA kierującym do aplikacji ([services/homeworkEmail.ts](services/homeworkEmail.ts), [functions/src/emailTemplate.ts](functions/src/emailTemplate.ts)).
  - Zsynchronizowano wizualny podgląd w modalu potwierdzenia lektora ([HomeworkEmailConfirmationModal.tsx](components/admin/HomeworkEmailConfirmationModal.tsx)).
- **Elegancka stopka maila — Wizytówka lektora (zgodnie ze wzorem)**:
  - Wdrożono wizytówkę lektora w stopce wiadomości o strukturze:
    - Obramowanie w kolorze niebieskim (`border: 1.5px solid #2563eb`), zaokrąglone rogi i tło karty,
    - Pogrubione imię i nazwisko: **Maciej Wyrozumski**,
    - Tytuł zawodowy: `Instructional Designer | AI EdTech Specialist | English Trainer`,
    - Ciemna linia oddzielająca (`border-top: 2px solid #0f172a`),
    - Zestaw 5 kontaktów z dedykowanymi ikonami i aktywnymi linkami:
      1. ✉️ `wyrozumski@maciej.pro` (mailto)
      2. 📞 `+48 698 250 507` (tel)
      3. 🌐 `www.maciej.pro` (https)
      4. 🔗 `linkedin.com/in/maciej-pro` (https)
      5. 🐙 `github.com/raskolone` (https)
    - Wersja czysto-tekstowa (plain text) zachowuje ten sam układ i komplet danych kontaktowych.

### G. Architektura Panelu Nauczyciela & Poprawki UI/UX
- **Wydzielenie bazy kursantów**:
  - Utworzono niezależny ekran bazy uczniów [StandaloneStudentDatabaseScreen.tsx](components/admin/StandaloneStudentDatabaseScreen.tsx).
  - Usunięto problematyczny kafelek z panelu nauczyciela, rozwiązując błędy z zapętlonym routingiem i nieintencjonalnym spadaniem do panelu kursanta.
- **Optymalizacja renderowania `AdminPanel`**:
  - Wyeliminowano niepotrzebne przeładowania (remounting) panelu administracyjnego przy zmianie aktywnej zakładki lub selekcji ucznia.
- **Nowy komponent nagłówka kursanta**:
  - Wdrożono [StudentHeroHeader.tsx](components/dashboard/StudentHeroHeader.tsx) z podsumowaniem statystyk, poziomem CEFR, progresem i streakami.
- **Wymiana natywnych alertów**:
  - Wszystkie przeglądarkowe wywołania `window.alert(...)` zastąpiono nowoczesnym, wycentrowanym oknem modalnym [AdminMessageModal.tsx](components/ui/AdminMessageModal.tsx).

### H. Jakość Kodu, Typowanie i Testy Automatyczne
- **Testy jednostkowe**:
  - Przechodzi **144 na 144 testów jednostkowych** (100% pass):
    - `tests/studentDatabaseBulk.test.ts` (9 testów operacji masowych i selekcji)
    - `tests/lessonBlocks.test.ts` (19 testów podziału na 4 bloki i ich konwersji)
    - `tests/homework.test.ts` (35 testów logiki prac domowych i typów odpowiedzi)
    - `tests/notionSync.test.ts` (28 testów synchronizacji z Notion i blacklisty)
    - `tests/flashcardGenerator.test.ts` (14 testów)
    - `tests/vocabularyContext.test.tsx` (17 testów)
    - `tests/gamification.test.ts` (22 testy)
- **TypeScript**:
  - `npx tsc --noEmit` kończy się kodem `0` (brak jakichkolwiek błędów typowania).
- **Produkcyjny Build**:
  - `npm run build` kompiluje aplikację Vite oraz PWA Service Worker bez przeszkód.

### I. Nowa Organizacja Panelu Nauczyciela: Koncepcja „Bez zbędnego szumu” & Przyjazna ADHD
- **Czysty widok główny (General View) z 3 modułami uniwersalnymi**:
  - Zgodnie z wytycznymi z widoku głównego usunięto rozpraszające kafelki powiązane z pojedynczymi kursantami.
  - Pozostawiono wyłącznie 3 uniwersalne, estetyczne kafelki modułów ogólnych:
    1. **Planer lekcji** (`lesson-planner`) — projektowanie scenariuszy zajęć i materiałów dydaktycznych,
    2. **Prezentacja & Notatnik** (`presentation`) — interaktywna tablica lekcyjna, rysowanie i slajdy,
    3. **Mailing** (`mailing`) — moduł newsletterów, szablonów i masowych powiadomień przez Resend API.
  - Aktywny moduł ogólny otwiera się bezpośrednio pod kafelkami z wyraźnym nagłówkiem modułu oraz przyciskiem *„✕ Zamknij moduł / Wróć do profilu kursanta”*.
- **Wydzielony obszar roboczy profilu kursanta (Student Workspace)**:
  - Przy braku wybranego kursanta: czytelna, estetyczna karta zachęcająca do wyboru ucznia z wyszukiwarki.
  - Po wyborze kursanta wyświetla się **Student Hero Card** z najważniejszymi informacjami w pigułce:
    - Zdjęcie / inicjały, pełne imię i nazwisko, login `@username`,
    - Odznaka poziomu CEFR (A1–C2) oraz rola systemowa (`Kursant`, `Nauczyciel`, `Admin`),
    - Wskaźnik dostarczalności e-mail Resend (`✓ Dostarczalny` vs `⚠ Zastępczy`),
    - Licznik wizyt, data ostatniej aktywności,
    - Szybki przycisk synchronizacji z Notion (`StudentNotionSyncModal`),
    - Przyciski szybkiej zmiany ucznia oraz zamknięcia profilu.
- **Estetyczne i czytelne zakładki na górze profilu**:
  - Pasek 7 poziomych zakładek z wyraźnym stanem aktywnym (wysoki kontrast `bg-primary`, brak rozpraszających animacji i mrugania):
    1. `Profil & Dane` (UserIcon)
    2. `Kontekst` (FileText)
    3. `Historia lekcji` (BookOpen + badge z liczbą lekcji)
    4. `Praca domowa` (Award + badge z liczbą zadań)
    5. `Słownictwo & AI` (BookMarked + badge z liczbą zestawów fiszek)
    6. `Testy AI` (Award)
    7. `Statystyki & Wyniki` (BarChart2)
- **Kompletna zakładka „Profil & Dane” (odzwierciedlenie Bazy Kursantów)**:
  - Zbudowano 5 dedykowanych, ustrukturyzowanych kart edycji:
    1. **Dane podstawowe i identyfikacja**: Imię, Nazwisko, Login konta (`@username`) z przyciskiem natychmiastowej zmiany, ID użytkownika,
    2. **Komunikacja i powiadomienia e-mail (Mailing)**: Pole adresu e-mail, weryfikacja poprawności formatu, status Resend, intuicyjny przełącznik wypisania z mailingu (`emailNotificationsDisabled`),
    3. **Poziom zaawansowania i konfiguracja AI**: Wybór poziomu CEFR A1–C2, opis kursanta stanowiący kontekst dla promptów AI, żelazne reguły i ograniczenia dla modeli generatywnych,
    4. **Integracja Notion & Aktywność**: Wywołanie synchronizacji lekcji z bazy Notion, statystyki wizyt, liczba lekcji, data logowania,
    5. **Uprawnienia i zarządzanie kontem**: Przełącznik ról użytkownika, zmiana hasła, kopiowanie hasła do schowka, przełącznik ukończenia onboardingu, zawieszenie konta, archiwizacja, kontrola widoczności modeli AI i Live Monitora, bezpośrednia wiadomość do kursanta, bezpieczne usuwanie konta.
  - Duży, wyraźny przycisk zapisu profilu ze stanem ładowania i potwierdzeniem.

### J. Opcja Wysyłki do Ukrytego Nadawcy (BCC / Ukryta Kopia) w Module Mailing
- **Weryfikacja wychodzących wiadomości przez lektora**:
  - W module Mailing ([AdminMailingScreen.tsx](components/admin/AdminMailingScreen.tsx)) dodano opcję wysyłania ukrytej kopii wiadomości (BCC — Blind Carbon Copy) z domyślnie zaznaczonym własnym adresem e-mail lektora (`wyrozumski@maciej.pro` / `currentUser.email`), aby lektor mógł bezpośrednio we własnej skrzynce weryfikować, czy wiadomości bez przeszkód opuszczają system i jak prezentują się w programie pocztowym.
  - Szybkie przełączniki adresów lektora (`wyrozumski@maciej.pro`, `maciej@learnwithmaciej.com`) oraz możliwość wprowadzenia dowolnego adresu BCC.
- **Globalna konfiguracja BCC w ustawieniach poczty**:
  - W zakładce Ustawienia skrzynki dodano opcję trwałej konfiguracji `enableBccSender` i `bccEmail` (zapisywane w dokumencie `system/mailing` w Firestore).
- **Obsługa po stronie backendu ([server.ts](server.ts))**:
  - Endpoint `/api/mailing/test-send` odbiera parametr `bcc`, sanitizuje adresy i przekazuje je do Resend API w polu `bcc: [...]`.
  - W przypadku braku bezpośredniego parametru w żądaniu serwer automatycznie sprawdza konfigurację w Firestore i dołącza ukrytą kopię nadawcy.
  - Endpoint `/api/mailing/status` zwraca aktualny status konfiguracji `enableBccSender` i `bccEmail`.
### K. Usunięcie Wzmianek o AI z Widoków Kursanta i Ujednolicenie Interfejsu Systemu
- **Koncepcja jednego spójnego systemu**:
  - Wyeliminowano jawne akronimy i odniesienia do „AI” / „sztucznej inteligencji” z interfejsów dedykowanych kontom kursantów (`role === 'user'`).
  - Zaawansowany silnik generatywny i ewaluacyjny nadal działa w tle, napędzając platformę, jednak dla ucznia system prezentuje się jako spójny, profesjonalny i naturalny partner edukacyjny.
- **Szczegółowy zakres modyfikacji widoków kursanta**:
  - **Statystyki kursanta ([StudentStatsScreen.tsx](components/dashboard/StudentStatsScreen.tsx))**:
    - Zastąpiono etykiety dymków *„Komentarz Nauczyciela AI”* / *„Wskazówka Nauczyciela AI”* profesjonalnymi określeniami *„Komentarz pedagogiczny”* oraz *„Wskazówka językowa”*.
    - Opisy podsumowań i stanów ładowania przeformułowano na naturalne: *„Szybkie podsumowanie Twoich postępów...”*, *„Analizowanie Twoich wykonanych zdań...”*.
    - Nazwę domyślnej sesji zmieniono z *„Sesja Tłumaczeniowa AI”* na *„Sesja Tłumaczeniowa”*.
  - **Dziennik sesji ćwiczeń ([PracticeSessionsSection.tsx](components/dashboard/PracticeSessionsSection.tsx))**:
    - Zmiana typu sesji z *„Trening z AI”* / *„AI training”* na czytelny *„Trening zdań”* / *„Sentence training”*.
  - **Szczegóły lekcji i powtórki ([LessonDetails.tsx](components/dashboard/LessonDetails.tsx), [StudentLessonHistory.tsx](components/dashboard/StudentLessonHistory.tsx))**:
    - Przyciski utrwalania materiału z *„Zdania AI”* / *„Przećwicz z AI”* / *„Trening zdań z AI”* przemianowano na *„Trening zdań”* (*„Sentence Practice”*).
    - Opis opcji zmieniono na: *„Układaj i tłumacz nowe zdania kontekstowe oparte o materiał lekcji”*.
  - **Wprowadzenie dla nowych uczniów ([OnboardingOverlay.tsx](components/dashboard/OnboardingOverlay.tsx))**:
    - Zastąpiono hasła marketingowe typu *„Cribro Smart AI Training”*, *„AI-Powered Practice Formats”*, *„AI SCORING”* eleganckimi wersjami: *„Inteligentny trening językowy Cribro”*, *„Praktyczne Formaty Ćwiczeń”*, *„Ocena i feedback”*.
    - Wskazówki techniczne o modelach AI zastąpiono informacją o natychmiastowej analizie i wsparciu systemu.
  - **Moduł ćwiczeń i generowania zdań ([AIExerciseGeneratorScreen.tsx](components/dashboard/AIExerciseGeneratorScreen.tsx))**:
    - Zastąpiono sformułowania *„inteligentna korekta AI”*, *„AI przygotowuje ćwiczenie...”*, *„Trening AI”*, *„wskazówki AI”* oraz *„Rekomendowane przez AI”* czystymi, profesjonalnymi frazami (*„natychmiastowa korekta”*, *„Przygotowywanie ćwiczenia...”*, *„Trening zdań”*, *„Wzorcowe tłumaczenie”*).
    - Komunikaty błędów nie eksponują już surowych technicznych haseł AI.
  - **Testy kursanta ([StudentTestsScreen.tsx](components/tests/StudentTestsScreen.tsx))**:
    - Zmieniono komunikat braku recenzji z *„Brak feedbacku AI dla tego testu”* na *„Brak dodatkowego komentarza dla tego testu”*.
  - **Edytor zestawów słówek i fiszek ([FlashcardEditScreen.tsx](components/flashcards/FlashcardEditScreen.tsx))**:
    - Przyciski akcji zmieniono na *„Inteligentny import”*, *„Generuj z tematu”*, *„✨ Generuj”*.
    - Opisy analizy tekstu zamiast *„sztuczna inteligencja przeanalizuje go...”* informują o automatycznym stworzeniu zestawu przez system.
  - **Ustawienia lektora i dźwięku ([SettingsScreen.tsx](components/settings/SettingsScreen.tsx))**:
    - Dla kursantów zablokowano widok modeli AI, a opcje lektora przemianowano na *„Zaawansowany Lektor (Płynny)”* oraz *„Ekspresyjny Lektor (Dynamiczny)”*.
  - **Animacje ładowania i usługi ([AISkeletonLoader.tsx](components/ui/AISkeletonLoader.tsx), [VocabularyGenerator.tsx](components/dashboard/VocabularyGenerator.tsx), [LanguageContext.tsx](context/LanguageContext.tsx), [geminiService.ts](services/geminiService.ts))**:
    - Domyślny loader informuje o *„Przygotowywaniu materiału...”*, a opisy w kontekście językowym i serwisy zwracają czyste, przyjazne komunikaty błędów.
- **Zachowanie narzędzi nauczyciela i administratora**:
  - Panele `teacher` oraz `admin` zachowały pełne instrumentarium AI (prompty, wybór modeli, generator sprawdzania, zaawansowane parametry generowania zadań).

### L. Konsolidacja Modułu Mailing: Usunięcie Zdublowanych Odnośników, Dedykowany Pop-up Modal i Powiadomienia na Kafelku
- **Wyeliminowanie duplikatów wejścia do modułu Mailing**:
  - Zgodnie z zasadą minimalizmu i braku zbędnego szumu, usunięto zdublowane odnośniki do modułu Mailing z paska bocznego ([Sidebar.tsx](components/dashboard/Sidebar.tsx)) oraz z górnego nagłówka panelu nauczyciela ([AdminPanel.tsx](components/admin/AdminPanel.tsx)).
  - Jedynym oficjalnym punktem wejścia do modułu Mailing pozostaje elegancki kafelek w sekcji *Główne Narzędzia Lektora* w Panelu Nauczyciela.
- **Dedykowany Pop-up Modal dla Modułu Mailing ([AdminPanel.tsx](components/admin/AdminPanel.tsx))**:
  - Kliknięcie kafelka Mailing nie przeładowuje widoku głównego ani nie rozpycha układu pionowego lektora – otwiera pełny, dedykowany pop-up modal w wysokiej estetyce glassmorphism (`z-[100]`, `bg-black/85 backdrop-blur-md`).
  - Modal zawiera nagłówek z tytułem, opisem, licznikiem nowych wiadomości oraz przyciskiem zamknięcia (wspiera również natychmiastowe zamykanie klawiszem `Escape` oraz kliknięciem w tło).
  - Wewnątrz modalu osadzony jest komponent `AdminMailingScreen` z pełną funkcjonalnością (szablony, skrzynka, monitoring, konfiguracja BCC i historia wysyłek).
- **Gotowość pod odbiór wiadomości i dynamiczny kafelek powiadomień**:
  - Zaimplementowano nasłuchiwanie w czasie rzeczywistym w Firestore (`onSnapshot` na kolekcji `inboundMessages` z warunkiem `read == false`).
  - W przypadku nadejścia nieprzeczytanych wiadomości (gdy włączony zostanie odbiór):
    - Kafelek Mailing zmienia kolorystykę na wyróżniający ton ostrzegawczy z ciepłym akcentem bursztynowym (`border-amber-400/80 bg-gradient-to-br from-amber-500/[0.08] via-base-200/80 to-base-200 shadow-[0_0_30px_rgba(245,158,11,0.22)]`).
    - Na ikonie koperty pojawia się animowany wskaźnik ping (`animate-ping`).
    - Zamiast standardowej plakietki pojawia się pulsujący badge z liczbą powiadomień: `{count} NOWYCH`.
    - Dolna etykieta akcji zmienia się na `Otwórz skrzynkę ({count})` w kolorze akcentu.

### M. Rozwój Planera Lekcji AI: Uproszczony Interfejs, Uploader Plików/Screenshotów, Baza Scenariuszy i Most do Prezentacji
- **Uproszczony, intuicyjny interfejs Planera Lekcji ([LessonPlanner.tsx](components/admin/LessonPlanner.tsx))**:
  - Przeprojektowano strukturę wizualną w duchu zasady *„Bez zbędnego szumu”* i zoptymalizowano pod kątem ADHD.
  - Na samej górze umieszczono pole: **„Opisz, jaką lekcję chciałbyś zrobić”**, zapewniające lektorowi pełną swobodę formułowania tematów (konwersacje, gramatyka, specyficzne kazusy biznesowe).
  - Pod polem opisu znajduje się przejrzysty pasek parametrów: wybór kursanta, poziomu CEFR (A1-C2), czasu trwania (30-90 min) oraz profilu zajęć.
  - Szybkie akcje: podpowiedzi tematów z historii kursanta oraz lekcje powtórkowe z ostatnich błędów.
- **Obsługa plików, materiałów i screenshotów ([LessonFileUploader.tsx](components/admin/LessonFileUploader.tsx))**:
  - Wprowadzono sekcję **„Dodaj pliki, które chcesz wykorzystać do generowania lekcji”**.
  - Obsługa formatów:
    - **Obrazy i screenshoty**: PNG, JPG, WEBP, GIF (z obsługą przeciągania Drag & Drop, wyboru z dysku oraz wklejania ze schowka `Ctrl+V` / `Cmd+V` prosto z pamięci podręcznej systemu).
    - **Dokumenty**: PDF.
    - **Tekst i struktury**: Markdown (.md), HTML (.html), zwykłe pliki tekstowe (.txt).
  - Wizualne miniatury załączników z plakietkami formatów, rozmiarem, możliwością podglądu (lightbox) oraz usuwania.
  - Wzbogacenie komunikacji z modelami AI ([geminiService.ts](services/geminiService.ts)) o wielomodalną analizę załączników i wstrzykiwanie tekstu źródłowego.
- **Nowa Baza Scenariuszy Lekcji ([StandaloneLessonScenariosScreen.tsx](components/admin/StandaloneLessonScenariosScreen.tsx), [ChooseScenarioModal.tsx](components/admin/ChooseScenarioModal.tsx))**:
  - W pasku bocznym ([Sidebar.tsx](components/dashboard/Sidebar.tsx)) oraz routerze ([Dashboard.tsx](components/dashboard/Dashboard.tsx)) dodano dedykowaną pozycję: **„Baza scenariuszy”**.
  - Zbiór gotowych, wzorcowych konspektów CELTA ([scenarioService.ts](services/scenarioService.ts)) z podziałem na kategorie (Business Negotiations, Small Talk & Networking, Job Interview Mastery, Mixed Conditionals).
  - Opcje działania na każdym materiale:
    1. **Użyj bez modyfikacji**: natychmiastowe wykorzystanie konspektu.
    2. **Dostosuj z AI dla kursanta**: załadowanie szablonu do Planera Lekcji i personalizacja pod profil i historię ucznia.
- **Most do Prezentacji & Notatnika Live ([AdminPanel.tsx](components/admin/AdminPanel.tsx), [LessonScenarioAccordion.tsx](components/admin/LessonScenarioAccordion.tsx))**:
  - Na wygenerowanych i załadowanych scenariuszach dodano przycisk **„Uruchom w Prezentacji & Notatniku”**.
  - Jednym kliknięciem scenariusz jest przekształcany w interaktywną talię slajdów (`createPresentationFromScenario`) i zapisywany w `presentationService`, po czym system płynnie przełącza lektora do modułu Prezentacji & Notatnika Live.

### G. Środowisko Content Designera: Spis Treści, Multimedia Audio i Ekstrakcja z Podręczników / PDF
- **Interaktywny Spis Treści i Plan Lekcji na Slajdach (`type: 'toc'`)**:
  - Moduł `presentationService.ts` generuje teraz dedykowany Slajd 2 ze spisem treści i planem zajęć (Agenda).
  - W komponencie [SlideCard.tsx](components/admin/presentation/SlideCard.tsx) wprowadzono przejrzystą siatkę bloków dydaktycznych z czasem trwania i opisem.
  - Dodano funkcjonalność natychmiastowej nawigacji (`onJumpToSlide`) – lektor może jednym kliknięciem przeskoczyć ze spisu treści do wybranego modułu ćwiczeniowego.
- **Obsługa i Odtwarzacz Plików Audio dla Lektora i Kursanta**:
  - Rozszerzono [LessonFileUploader.tsx](components/admin/LessonFileUploader.tsx) o formaty audio (`.mp3`, `.wav`, `.m4a`, `.ogg`, MIME `audio/*`) z wbudowanym odtwarzaczem podglądowym.
  - W [types.ts](types.ts) oraz [SlideCard.tsx](components/admin/presentation/SlideCard.tsx) zintegrowano pola `slide.audioUrl`, `slide.audioName` oraz typ `listening`.
  - Odtwarzacz audio jest zsynchronizowany i dostępny zarówno w panelu lektora, jak i w osobnym oknie kursanta ([PresenterScreen.tsx](components/admin/presentation/PresenterScreen.tsx)).
- **Ekstrakcja Materiałów ze Skanów Podręczników i Ukryte Odpowiedzi**:
  - Wzbogacono prompt metodyczny w [LessonPlanner.tsx](components/admin/LessonPlanner.tsx) o wytyczne dla roli Content Designera do analizy skanów i wyciągania esencji bez zbędnego szumu.
  - Parser w `presentationService.ts` automatycznie wyodrębnia odpowiedzi w nawiasach `(Odpowiedź: ...)`, `(Answer: ...)`, `(Tłumaczenie: ...)` i tworzy interaktywne elementy z ukrytą odpowiedzią (`revealed: false`), którą można odkryć jednym kliknięciem.
  - Załączone zdjęcia i screenshoty stron podręczników są automatycznie przypisywane do slajdów (`slide.imageUrl`) z funkcją powiększenia w pełnym modalu lightbox.

---


## 5. Przewodnik Szybkiego Startu dla Nowych Sesji i AI

### Kluczowe Komendy
```bash
# Uruchomienie serwera deweloperskiego (port domyślny 5173 / API backend na 3001)
npm run dev

# Weryfikacja typowania TypeScript
npx tsc --noEmit

# Uruchomienie wszystkich testów
npm test

# Budowanie wersji produkcyjnej
npm run build
```

### Ważne Ścieżki w Repozytorium
- `components/admin/AdminMailingScreen.tsx` — Panel Mailing (szablony, skrzynka odbiorcza, wysyłka).
- `components/settings/SettingsScreen.tsx` — Ustawienia użytkownika oraz konfiguracja klucza Resend API.
- `components/admin/HomeworkComposer.tsx` — Kreator i przypisywanie pracy domowej kursantowi.
- `components/admin/HomeworkEmailConfirmationModal.tsx` — Modal potwierdzający wysyłkę e-maila z pracą domową.
- `components/admin/StudentNotionSyncModal.tsx` — Modal synchronizacji lekcji z Notion z selekcją i blacklistą.
- `utils/lessonBlocks.ts` — Narzędzia podziału i parsowania 4 bloków lekcji Notion.
- `server.ts` — Główny serwer Express z endpointami `/api/mailing/*`, proxy Notion i TTS.
- `functions/src/emailTemplate.ts` — Szablony e-mail w HTML z brandingiem CRIBRO ENGLISH.
- `types.ts` — Główne definicje typów TypeScript w całym projekcie.

### Zasady Architektoniczne dla Kolejnych Zmian
1. **Bezpieczeństwo kluczy**: Klucze API (Resend, Notion, OpenAI, Gemini) nie mogą znajdować się w kodzie frontendu. Zawsze korzystaj z endpointów serwerowych `/api/*` z weryfikacją tokenu Firebase (`Authorization: Bearer <token>`).
2. **Format lekcji**: Wszelkie operacje na lekcjach powinny zachowywać i respektować format 4 bloków Notion (`Words & Phrases`, `Grammar & Accuracy`, `Pronunciation`, `Homework`).
3. **Powiadomienia e-mail**: Wysyłka e-maili do kursantów powinna odbywać się z potwierdzeniem lektora, z poprawnym wołaczem imienia oraz nadawcą `wyrozumski@maciej.pro` lub `maciej@learnwithmaciej.com`.
4. **Testy jednostkowe**: Przed zatwierdzeniem zmian upewnij się, że `npx tsc --noEmit` oraz `npm test` wykonują się bezbłędnie.

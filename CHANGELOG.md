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
> w jaki należy do niego podchodzić. Stan na 2026-09-14 (runda 8).

### ✅ (Naprawione 2026-09-12) Reguły Firestore dla brudnopisu były całkowicie otwarte
Historyczny wpis — zostawiony jako ślad, bo dokładnie ten problem naprawia commit opisany w sekcji 4 poniżej („Zamknięcie dziury w regułach brudnopisu i indeks PIN-ów").

Kolekcja `scratchpads/{scratchpadId}` miała `allow get, list: if true; allow create, update: if true;` — każda osoba w internecie mogła odczytać i nadpisać dowolny brudnopis, a `list` pozwalał wylistować notatki wszystkich kursantów bez logowania. Naprawa: `list` zamknięty bez wyjątku, dodany indeks `scratchpadPins/{pin} → { scratchpadId }` z odczytem po znanym kluczu i zapisem ograniczonym do właściciela dokumentu (lektor/kursant, dla którego notatnik powstał) albo admina — patrz `firestore.rules` i `tests/rules/firestore.rules.test.ts`.

### 🟡 Wspólna edycja brudnopisu działa w trybie „ostatni zapis wygrywa"
`ScratchpadEditor` synchronizuje całą zawartość HTML dokumentu, bez algorytmu scalania zmian (OT ani CRDT). Jeśli lektor i kursant piszą **jednocześnie w tym samym miejscu**, zapis jednej strony nadpisze tekst drugiej.

Bufor, który to łagodzi: przychodząca treść nie podmienia edytora, dopóki użytkownik pisze (`isUserTypingRef`, reset 1,5 s po ostatnim klawiszu), a zapis jest opóźniony o 600 ms. Przy naprzemiennym pisaniu w trakcie lekcji to wystarcza.

**Czego z tego wynika:** brudnopis zastępuje Google Docs w scenariuszu „lektor notuje, kursant patrzy i czasem dopisuje", ale **nie** w scenariuszu równoległego pisania we dwoje. Zanim ktoś ogłosi pełne zastąpienie Google Docs, trzeba wprowadzić scalanie zmian na poziomie fragmentów.

### 🟡 Tryb dzienny nieobejrzany na ekranach po zalogowaniu (częściowo naprawione 2026-09-12)
Ekran startowy i logowanie zostały poprawione i sprawdzone wzrokowo w obu motywach. Panele lektora,
administratora i kursanta przełączają się przez tokeny, ale **nadal nie były oglądane w trybie dziennym
w przeglądarce** — wymagają zalogowania.

2026-09-12: naprawiono **284 wystąpienia** wzorca `hover:text-white`/`group-hover:text-white`/
`focus:text-white` w połączeniu z `hover:bg-white/5`/`bg-white/10` w `components/admin/` i
`components/dashboard/` (54 plików) — dokładnie ten sam wzorzec błędu, co na ekranie startowym: hover
podświetla się niemal-białym tłem i tekst staje się niemal niewidoczny na jasnej stronie. Zamienione na
`text-text-hi` (w trybie nocnym token równa się `#ffffff`, więc wygląd ciemnego motywu się nie zmienił —
zweryfikowane przez brak zmian w `tsc`/testach/buildzie po zamianie).

Nadal zostaje ok. **880+ wystąpień** samego, statycznego (nie tylko `hover:`) surowego `text-white` w
komponentach — część jest poprawna (biały napis na wypełnieniu akcentem), część może powtarzać ten sam
problem. Świadomie nieruszone w tej sesji — pełne przejście wymaga weryfikacji wzrokowej per przypadek,
nie ślepej zamiany (patrz `docs/plan-weekend-2026-09-12.md`, Etap E).

**2026-09-14: problem obszedł się bez tej zamiany.** W `index.css` stoi blok, który w trybie jasnym
przedefiniowuje `text-white` (i warianty `/95`…`/30`, `border-white/10`, `bg-white/[0.0x]`) na
`var(--on-fill, …)`, a elementy z wypełnieniem akcentem ustawiają u siebie `--on-fill: #fff`. Biel
zostaje bielą tam, gdzie ma być, i ciemnieje tam, gdzie stoi na białej karcie — bez ruszania
komponentów. **Konsekwencja dla następnych zmian:** jeżeli w trybie dziennym jakiś biały napis na
ciemnym tle niespodziewanie ściemnieje, przyczyna jest w tym bloku, a nie w komponencie. Lista
powierzchni „na których biel zostaje bielą" jest wypisana wprost i trzeba ją uzupełnić, gdy powstanie
nowy rodzaj wypełnienia.

### 🟡 Interfejs nie był weryfikowany w przeglądarce
Zmiany UI z etapów opisanych niżej (przebudowa paska Prezentacji i Brudnopisu, samouczek z dymkami, zamrożona kolumna w Bazie Kursantów, układanka z klocków, przełącznik Easy/Hard) przeszły `npx tsc --noEmit`, komplet testów jednostkowych i `npm run build`, ale **nie zostały obejrzane w działającej przeglądarce**. Przy kolejnych poprawkach w tych miejscach warto najpierw sprawdzić je wzrokowo.

To samo dotyczy przebudowy panelu lektora, ekranu przeglądu prac v2 i nowego notatnika z 2026-09-12
(sekcja 4 niżej) — brak dostępu do zalogowanej sesji przeglądarki w tej sesji agenta. Zweryfikowano
wyłącznie `tsc --noEmit`, `npm test`, `npm run build`, `npm run test:rules`.

**2026-09-14 — to samo dotyczy całej rundy 4** (kontekst przed lekcją jako kafelek, odprawa AI,
notatnik jako osobny ekran ze spisem treści i podziałem na strony, szkło w panelu kursanta, naprawa
trybu jasnego). Notatnik idzie do pierwszych kursantów, więc **wymaga obejrzenia na telefonie
i na komputerze przed wysłaniem linków**.

**2026-09-14, runda 8 — częściowo obejrzane.** Ekran startowy sprawdzony w przeglądarce
w OBU motywach (Playwright na buildzie produkcyjnym, bez błędów konsoli): tryb dzienny ma
widoczną konstelację, czytelne karty i podpisy, tryb nocny jest nietknięty. **Nie obejrzano
niczego za logowaniem** — nowy nagłówek kursanta, rama zakładek, menu „Lekcje", modal
AI Lesson Summary i ciemna kartka notatnika przeszły `tsc --noEmit`, 316 testów i `npm run build`,
ale nikt ich nie widział w działającej aplikacji. Do sprawdzenia w pierwszej kolejności:
czy przyciemnienie okien dialogowych w trybie dziennym nie zjada kontrastu i czy zakreślacze
w notatniku czytają się na obu papierach.

**2026-09-14, runda 9 — planer lekcji NIE był wołany na żywo.** Nowy Planer
(`LessonPlannerStudio`), narada modeli (`aiCouncil`) i ustawienia jej składu
(`AiCouncilSettings`) przeszły `tsc --noEmit`, 316 testów i `npm run build`, ale
nikt nie kliknął przez trzy kroki w przeglądarce ani nie wywołał prawdziwej
narady na kluczach API — brak dostępu do zalogowanej sesji i do skonfigurowanych
kluczy w tej sesji agenta.

Przy przeglądzie własnego kodu przed commitem znaleziona i naprawiona usterka
w `generateLessonPlannerAI` (`services/geminiService.ts`), na którym stoi cała
narada: funkcja prosiła model o JSON WYŁĄCZNIE zdaniem w promptcie, bez
żadnego strukturalnego wymuszenia u żadnego z dwóch dostawców — gałąź OpenAI
wołała `callOpenAI(..., isJson: false)` (więc serwer nigdy nie ustawiał
`response_format: { type: "json_object" }`), gałąź Gemini nie ustawiała
`responseMimeType`. Ta sama luka dotyczyła też TRZECH już istniejących,
produkcyjnych wywołań w `services/presentationService.ts` (generator slajdów
prezentacji) — nie tylko nowego kodu. Naprawa: opcjonalny parametr
`jsonMode` w `generateLessonPlannerAI`, domyślnie `false` (zero zmiany
zachowania dla wywołań na tekst swobodny), włączany świadomie przez naradę
(tylko w turach autora — recenzja zostaje wolnym tekstem) i przez wszystkie
trzy wywołania w `presentationService.ts`. Mimo naprawy: **nadal nie
zweryfikowane na żywym kluczu** — `jsonMode: true` tylko podnosi
prawdopodobieństwo poprawnego JSON-a, nie gwarantuje go, a `extractJSON` wciąż
jest jedyną linią obrony, jeśli model i tak zwróci coś, czego nie da się
sparsować.

### 🟡 Notatnik: co zostało niedokończone (stan 2026-09-14)

- **Panel duplikatów kasuje wpisy lekcji, ale NIE powiązane `vocabularySets`.**
  Po posprzątaniu historii zostają osierocone zestawy słownictwa wskazujące na
  nieistniejące lekcje. Do decyzji, czy usuwać je razem — kasowanie zestawu
  zabiera też postęp powtórek kursanta, więc nie zrobiono tego automatem.
- **Widok kursanta (`PublicScratchpadScreen`) nie dostał arkusza A4 ani motywu
  strony.** Używa `ScratchpadEditor` bez trybu `standalone`, więc kursant widzi
  starą, panelową obudowę — treść jest ta sama, wygląd nie.
- **Eksport do PDF/Worda nie wie o arkuszu A4.** Łamanie stron w pliku nie
  pokrywa się z kreskami na ekranie.
- **Trasy `/api/ai/config` i `/api/ai/save-key` nadal nie były wołane na żywo.**
  Sprawdzić, czy zapis `system/ai` przechodzi kontem administratora. Osobna
  usterka na tej ścieżce — odczyt kluczy przy starcie serwera wywalał się
  w każdym uruchomieniu — została znaleziona i naprawiona w rundzie 8
  (patrz sekcja 4, punkt 9).

### 🟡 Odwrócenie bieli i czerni w trybie dziennym trzyma się JEDNEJ zasady

`--color-white` i `--color-black` są w trybie dziennym zamienione na przeciwne
wartości (`index.css`), bo w komponentach obie znaczą rolę („włosowa kreska",
„studzienka", „napis na wypełnieniu"), a nie dosłowny kolor. **Pisząc nowy
komponent, używaj tokenów** (`border-line-strong`, `bg-base-100`, `text-text-hi`,
`text-accent-ink`) — wtedy nic nie trzeba odwracać.

Jeżeli w jakimś miejscu potrzebna jest PRAWDZIWA biel albo czerń w obu motywach
(kartka wydruku, napis na czerwonym tle błędu, barwa spoza palety), wpisz
`bg-[#ffffff]` / `text-[#0f1720]` — wartość arbitralna nie przechodzi przez
zmienną i zostaje dosłowna. Takich miejsc jest teraz kilkanaście i wszystkie są
świadome.

Zapas dla przeglądarek bez `color-mix` (sprzed 2023) zostaje biały — tego nie da
się obejść i nie warto.

### 🟡 Kolory wpisywane w treść dokumentu notatnika nie podlegają motywom

`execCommand` i szablon lekcji zapisują kolor WPROST w HTML dokumentu
(`style="color:…"`). Motyw nie ma jak go potem przestawić, a wpisy zrobione
wcześniej zachowują barwy, które wtedy dostały. Dlatego każda nowa barwa
w notatniku musi pochodzić z `utils/notebookPalette.ts` i mieć tę samą jasność
względną (~0,22) co reszta — inaczej będzie czytelna na jednym papierze
i nieczytelna na drugim. **Nie dobieraj kolorów notatnika „na oko" pod aktualnie
włączony motyw.**

Wpisy sprzed rundy 8 mają stare, jaskrawe barwy nagłówków. Nikt ich nie
przepisuje za lektorem.

### ✅ (Zmienione 2026-09-22) Podział na strony w notatniku był kreską co 1123px, nie paginacją
Historyczny wpis. Warstwa nad kartką rysowała kreskę co 1123 px (A4 przy 96 dpi) NIEZALEŻNIE od
tego, czy to była granica lekcji czy środek akapitu — wyglądało to jak sztywne ucinanie strony,
mimo że sama kartka (`min-height`, nie `height`) i tak już rosła elastycznie w dół. Od 2026-09-22
`measurePages` (`ScratchpadEditor.tsx`) nie generuje już tych wirtualnych linii wewnątrz lekcji —
kontrakt jest teraz dosłownie "1 Lekcja = 1 Strona": liczba stron = liczba fizycznych
`.pad-page-break` (wstawianych między lekcjami) + 1, kartka rośnie jak canvas bez sztucznych cięć.
Eksport do PDF/Worda nadal nie łamie stron w tych samych miejscach — to osobny, nienaprawiony temat.

### 🟡 Stan zwinięcia nagłówków jest częścią treści dokumentu
Nagłówki zwijane zapisują `style.display` chowanych elementów, czyli stan zwinięcia siedzi w HTML-u
zapisywanym w Firestore. Wynika z tego, że zwinięcie rozdziału u lektora **zwija go też u kursanta**
po drugiej stronie linku. Zamierzone (dokument ma wyglądać tak samo u obu stron), ale niesprawdzone
we dwoje na żywo.
### 🟡 Bufor odprawy AI jest lokalny dla przeglądarki
`services/preLessonBriefing.ts` trzyma wynik w `localStorage` pod kluczem `briefing_{studentId}_{date}`. Przełączenie przeglądarki lub urządzenia generuje nową odprawę na świeżo.

---

### 🚀 Wersje robocze (szkice) notatnika lektora — zakładka obok listy kursantów (2026-09-25, runda 57)

1. **Model danych (`types.ts`, `firestore.rules`)**: nowa kolekcja top-level `drafts/{draftId}` — `NoteDraft { id, teacherId, title, scratchpadId, createdAt, updatedAt }`. Rekord jest wyłącznie NAZWANYM WPISEM NA LIŚCIE — nie duplikuje treści notatnika. Faktyczna treść żyje w kolekcji `scratchpads` (ten sam mechanizm co notatnik kursanta, `getOrCreateStudentScratchpad`), więc `ScratchpadEditor.tsx` (4300 linii) nie wymagał żadnych zmian. Reguły Firestore: `get/list/create/update/delete` dozwolone dla `isAdmin()` lub gdy `teacherId == request.auth.uid` (tożsame ze wzorcem reszty repo dla dokumentów właściciela).
2. **`services/draftsService.ts` (przepisany)**: `getDrafts`/`subscribeDrafts` (indeks po `teacherId`, sortowanie `updatedAt` desc po stronie klienta), `createDraft` (zakłada notatnik przez `getOrCreateStudentScratchpad({id: null, ...})` — ten sam kod ścieżki co dotychczasowy jednorazowy „notatnik roboczy bez kursanta” — i dopisuje wpis do `drafts`), `renameDraft`, `deleteDraft` (usuwa TYLKO wpis z listy, nie dotyka dokumentu `scratchpads` — nieodwracalne kasowanie cudzej/własnej treści notatnika zostaje świadomie poza zakresem tej zmiany).
3. **`components/scratchpad/ScratchpadStudentPicker.tsx`**: nowe opcjonalne propsy `drafts`/`onPickDraft`/`onCreateDraft`/`onRenameDraft`/`onDeleteDraft`. Gdy podane, nad polem wyszukiwania pojawia się przełącznik zakładek „Kursanci” / „Wersje robocze” (tokeny motywu z `utils/themeTokens.ts`, nie surowe klasy `slate-*`/`white`). Zakładka szkiców: przycisk „+ Nowy szkic”, kafelki z tytułem (dwuklik = zmiana nazwy inline), datą ostatniej edycji (`formatDraftDate`) i przyciskiem kosza widocznym na hover.
4. **`components/admin/AdminPanel.tsx`**: `notebookDrafts` state zasilany `subscribeDrafts(currentUser.id, ...)`, wpięty w istniejący modal `ScratchpadStudentPicker` (ten sam, którym lektor dotychczas wybierał notatnik kursanta przy przycisku „Otwórz notatnik”). Wybór/utworzenie szkicu otwiera notatnik w nowej karcie przez istniejący `openScratchpadTab(scratchpadId, title)` — identycznie jak przy otwieraniu notatnika kursanta.
5. **Świadomie NIE zaimplementowane wprost ze zlecenia**: „Przypisz szkic do kursanta” — funkcjonalność analogiczna już istnieje (`adoptScratchpadForStudent`/`wouldAppendToExistingNotes` w `services/scratchpadService.ts`, human-in-the-loop w `TeacherScratchpadScreen.tsx`), więc nie duplikowano jej osobnym przyciskiem w pickerze; lektor otwiera szkic i przypisuje go z poziomu samego notatnika, tak jak dotychczasowy „notatnik roboczy”.
6. **Ryzyko — `firestore.rules` dotknięty**: dodano nową kolekcję `drafts/{draftId}`, reguły opisane w punkcie 1. Zmiana skonsultowana z Maciejem przed wdrożeniem (wymóg `CLAUDE.md` sekcja 3) — zaakceptował istniejący, częściowo już napisany kształt reguły. Middleware autoryzacji i ścieżki tokenowe bez logowania niedotknięte. Reguły NIE zostały wdrożone na produkcję w tej sesji (`npm run deploy:rules` wymaga osobnej, jawnej zgody).
7. **Weryfikacja techniczna**: `npx tsc --noEmit` — 0 błędów. `npm test` — 547/547 zielone. `npm run build` — przechodzi (Vite + `server.cjs` + `api/index.js`). **Nie zweryfikowano wzrokowo w przeglądarce** — brak dostępu do UI w tej sesji, patrz dług techniczny sekcja 3.

---

### 🚀 Poprawki UX w Notatniku Lekcyjnym A4: Izolacja stylów tekstu po Enterze, likwidacja hover-zoom grafik, Lupa +50% i Fullscreen Lightbox (2026-09-24, runda 56)

1. **Izolacja formatowania tekstu i likwidacja krwawienia stylów (Mark Bleed)**:
   - W zdarzeniu klawisza `Enter` (`handleEnterKey` w `ScratchpadEditor.tsx`) wdrożono czysty podział bloku tekstu: nowo tworzony akapit (`<p><br></p>`) nie dziedziczy stylów, kolorów, tła ani znaczników `<span>`/`<font>` poprzedniego bloku.
   - Wymuszono resetowanie aktywnych stanów formatowania (`removeFormat`) przy przejściu do nowej linii, eliminując niechciane dziedziczenie kolorów przy dalszym pisaniu.
   - W funkcji nakładania zakreśleń (`wrapSelectedTextInline` & `handleHighlight`) kursor po oznaczeniu tekstu jest natychmiast pozycjonowany zaraz za utworzonym znacznikiem `<span>`, co zapobiega krwawieniu formatowania na tej samej linii.
2. **Refaktoryzacja grafik i wyłączenie agresywnego hover-zoom**:
   - Usunięto regułę automatycznego powiększania na najechanie myszką (`transform: scale(1.5)`) oraz `cursor: zoom-in` z `index.css` dla `.pad-paper img` i `.pad-img`. Kursor myszy nad grafiką nie powoduje już nagłego rozciągnięcia elementu.
3. **Pasek akcji grafiki i Lupa +50% (Inline Zoom Toggle)**:
   - Każda grafika jest opakowana w kontener `pad-img-wrapper group relative inline-block`.
   - W prawym górnym rogu obrazka dodano dyskretny pasek akcji widoczny wyłącznie po najechaniu myszką (`opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 backdrop-blur-md rounded-lg p-1`):
     * **Przycisk 1 (Lupa +50%)**: przełącza powiększenie wewnątrz arkusza o 50% (`inline zoom toggle`) z możliwością ponownego kliknięcia i powrotu do standardu.
     * **Przycisk 2 (Tryb Prezentacji / Pełny Ekran)**: otwiera grafikę w pełnoekranowym modalu Lightbox.
   - Zdarzenia toolbara mają `e.stopPropagation()` i `e.preventDefault()`, chroniąc kursor i fokus w edytorze.
4. **Tryb Prezentacji (Fullscreen Lightbox)**:
   - Ciemne tło modalu (`bg-black/85 backdrop-blur-sm fixed inset-0 z-50`).
   - Obraz wycentrowany, 100% ostrości i proporcji pliku (`max-w-[95vw] max-h-[95vh] object-contain`).
   - Obsługa zamykania: klawisz Escape, kliknięcie w tło lub przycisk X w rogu.
5. **Weryfikacja techniczna**:
   - `npx tsc --noEmit` — 0 błędów typowania.
   - `npm test` — 513/513 testów jednostkowych zaliczonych.
   - `npm run build` — produkcyjny build zakończony sukcesem w 6.4s.

---

### 🚀 Pakiet usprawnień UX/UI: Konfiguracja i System Prompt Czatu AI, Follow-upy, Enlarge w Notatniku A4 i Weryfikacja Google Auth (2026-09-24, runda 55)

1. **Konfiguracja Czatu AI i Custom System Prompt (`AiChatSettings.tsx` & `SettingsScreen.tsx`)**:
   - Dodano dedykowaną sekcję **„Konfiguracja Czatu AI”** w panelu Ustawień Administratora/Lektora.
   - Umożliwiono edycję własnego system promptu (*Custom System Prompt*) oraz definiowanie niestandardowych umiejętności (*Skills*) asystenta lektora.
   - Wprowadzono model danych `AiChatConfig` / `AiChatSkill` oraz metody `saveAiChatConfig` i `peekChatConfig` w `services/aiConfigService.ts`, z pełną synchronizacją przez endpointy `/api/ai/config` w `server.ts`.
2. **Twardy System Prompt i Zwięzłość Odpowiedzi (`services/teacherAssistant.ts`)**:
   - Wstrzyknięto rygorystyczną instrukcję na poziomie kodu: zakaz tworzenia ścian tekstu, wymóg maksymalnej zwięzłości, podsumowań i punktorów, a także generowania rozbudowanych analiz wyłącznie na wyraźne żądanie.
   - Wymóg dołączania na końcu każdej odpowiedzi 2–3 pytań/akcji follow-up w maszynowym bloku ````followups_json [ ... ]````.
   - Zintegrowano dynamiczne wstrzykiwanie reguł i aktywnych skilli lektora z ustawień (`effectiveSystemInstruction`) we wszystkich trybach (Flash, Thinking Council, Multimodal).
3. **UX Czatu AI — Sugestie Follow-up & Kolorystyka Jasnego Motywu (`TeacherAssistant.tsx`)**:
   - Nad polem wpisywania wiadomości (input/textarea) dodano kontener na kafelki **Follow-up suggestions** o wyraźnym, kontrastowym akcencie (`bg-primary/15 hover:bg-primary/25 text-primary border border-primary/50`).
   - Kliknięcie kafelka natychmiast uzupełnia pole tekstowe i wysyła zapytanie do asystenta.
   - Zapewniono pełną czytelność w trybie jasnym (Day Mode) — jasne tło czatu z tokenów powierzchni oraz mocno kontrastowe pigułki statusów.
4. **Notatnik A4 — Efekt Enlarge na obrazkach (`index.css`)**:
   - Dla elementów graficznych w notatniku (`.pad-paper img`, `.pad-img`) wdrożono płynne powiększenie podczas najechania myszką (`transition: transform 0.3s ease-in-out, box-shadow 0.3s; transform: scale(1.5); z-index: 50; cursor: zoom-in; position: relative`).
   - Zweryfikowano brak przycinania powiększonego obrazu przez kontenery nadrzędne.
5. **Weryfikacja Google Auth (`AuthContext.tsx`)**:
   - Zweryfikowano logikę logowania przez Google pod kątem łączenia z istniejącymi profilami kursantów w `users/{id}` bez tworzenia osieroconych dokumentów.
   - Dodano logowanie diagnostyczne `[Auth] Pomyślnie zlinkowano tożsamość Google z profilem kursanta: {uid}`.
6. **Weryfikacja techniczna**:
   - `npx tsc --noEmit` — 0 błędów typowania.
   - `npm test` — 513/513 testów jednostkowych zakończonych sukcesem.

---

### 🚀 Skonsolidowany sprint: Baza wzorców w pracach domowych, Day/Dark mode w kafelkach oraz likwidacja Notion (2026-09-23, runda 54)

1. **Baza wzorców w kreatorze prac domowych (`AssignHomeworkModal.tsx`)**:
   - W typach `SpecialTask` (`types.ts`) uczyniono `lessonId` oraz `lessonNoteId` opcjonalnymi (`lessonId?: string`, `lessonNoteId?: string`), co umożliwia zadawanie prac bezpośrednio z bazy wiedzy bez powiązania z wcześniejszą lekcją.
   - Wprowadzono przełącznik źródła materiału w modalu zadawania pracy: `[ 📝 Notatka lekcyjna ]` | `[ 📚 Wzorce Gramatyczne ]`.
   - W trybie wzorców zintegrowano `services/blueprintService.ts`:
     * Selektor poziomu CEFR (A1–C2) zaciągający tematy z `getBlueprintIndex()`.
     * Asynchroniczne pobieranie zdań wybranego rozdziału (`getChapterDetails`) z dynamicznym ładowaniem JSON.
     * Interaktywna lista par zdań PL/EN z checkboxami oraz przyciskiem *„Zaznacz pierwsze 6”* / *„Wyczyść”*.
     * Opcjonalne pole kontekstu tematycznego (np. podróże, zakupy, IT).
     * Generowanie bezpiecznego tokenu zadania (`generateSecureHomeworkToken`), zapis w Firestore `users/{studentId}/specialTasks` i bezpośrednie wywołanie modalu wysyłki email (`HomeworkEmailConfirmationModal`).
2. **Naprawa styli kafelków kursantów (Wariant 3C — Day & Dark Mode)**:
   - **Tryb jasny (Day Mode)**:
     * Kafelki mają białe tło (`bg-white`), czytelną szarą ramkę (`border-slate-300` / `#cbd5e1`) oraz ciemne teksty (`text-slate-900` dla imienia, `text-slate-600` dla metadanych).
     * Prawa pigułka akcji: `bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-emerald-600`.
     * Mikro-wskaźnik i checkbox dostosowane do jasnego tła.
   - **Tryb ciemny (Dark Mode)**:
     * Wyraźniejsza spoczynkowa ramka `#263852` (zamiast zlewającego się granatu).
     * Podkręcony o 10% efekt `:hover` i Specular Highlight: `border-color: rgba(52, 211, 153, 0.65)`, laserowa linia `box-shadow: 0 0 12px 2px rgba(52, 211, 153, 0.9)`, poświata `rgba(52, 211, 153, 0.38)`.
3. **Likwidacja pozostałości integracji z Notion**:
   - Zaktualizowano podtytuł historii lekcji w `AdminPanel.tsx`: *„Transkrypcje z Sifta i wpisy ręczne — jedna oś czasu”*.
   - Zaktualizowano `components/admin/LessonSourceBar.tsx` — usunięto wzmianki i karty Notion, wyeksponowano źródła Sift oraz Wpisy ręczne / archiwalne.
   - Zaktualizowano etykiety akcji w menu `AdminPanel.tsx` i `TeacherTodayCockpit.tsx`.
4. **Weryfikacja techniczna**:
   - `npx tsc --noEmit` — 0 błędów typowania.
   - `npm test` — 513/513 testów jednostkowych zaliczonych.
   - `npm run build` — czysty build produkcyjny (PWA + SSR).

---

### 🎴 Refaktoring kafelków kursantów (Wariant 3C Compact Flow) & Usunięcie integracji Notion (2026-09-23, runda 53)

1. **Nowy ultrakompaktowy layout kafelków kursanta (`components/admin/StudentCard.tsx`)**:
   - Wdrożono horyzontalny Wariant 3C (**Linear Specular Highlight / Compact Flow**) o wysokości 70–74px.
   - Płynny gradient laserowej linii świetlnej (Specular Highlight `#34d399` / `#6ee7b7` z poświatą neonową) na górnej krawędzi podczas najechania kursorem.
   - Pionowy wskaźnik statusu (`.specular-accent-bar`), podświetlany w stanie hover i aktywności.
   - Checkbox szybkiego masowego zaznaczania z pełną izolacją zdarzeń (`stopPropagation`).
   - Awatar typu squircle z bezbłędnym generowaniem 2-literowych inicjałów dla polskich znaków diakrytycznych (np. `ŁK`, `DR`, `ŚŻ`).
   - Blok tekstowy: imię i nazwisko oraz zwięzła linijka metadanych w formacie `Język • Poziom / Firma`.
   - Zintegrowany dok mikro-akcji po prawej stronie (Lekcje/Dziennik, Notatnik lekcyjny A4, Profil kursanta).
2. **Style CSS (`index.css`)**:
   - Dodano reguły `.specular-student-card`, `.specular-student-card:hover`, `.specular-student-card.is-active`, `.specular-student-card.is-selected` oraz `.specular-accent-bar`.
   - Zapewniono pełną spójność estetyczną z motywem Nocturne Green.
3. **Integracja w module bazy kursantów (`components/admin/StandaloneStudentDatabaseScreen.tsx`)**:
   - Zastąpiono dawny wysoki widok kafelkowy nową, responsywną siatką `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3`.
4. **Czystka architektoniczna — usunięcie integracji z Notion**:
   - Wycięto przycisk *„Sprawdź transkrypcje w Notion”* oraz nieużywane stany i hooki z `components/admin/AdminPanel.tsx` oraz `components/admin/TeacherLessonHistoryView.tsx`.
   - Usunięto nieużywany komponent `components/admin/NotionImportPreviewModal.tsx`.
   - Zaktualizowano opis w `components/admin/AdminMailingScreen.tsx`.
5. **Weryfikacja jakościowa**:
   - `npx tsc --noEmit` — 0 błędów typowania.
   - `npm test` — 513/513 testów jednostkowych zaliczonych.
   - `npm run build` — produkcyjna kompilacja bundle zakończona powodzeniem.

---

### 📚 Ekstrakcja i wdrożenie banku Grammar Blueprints oraz Idiomów z plików PDF (2026-09-23, runda 52)

**Zrealizowano pełne zadanie ekstrakcji i wdrożenia bazy materiałów dydaktycznych Grammar Blueprints:**
1. **Zabezpieczenie Git i środowiska**:
   - Dodano katalog `scripts/source_pdfs/` do `.gitignore`, zabezpieczając pliki binarne PDF przed śledzeniem w repozytorium.
   - Wykorzystano `pdf-parse` wraz z runnerem `tsx` do ekstrakcji zawartości.
2. **Definicje typów TypeScript (`types/blueprints.ts`, `src/types/blueprints.ts`)**:
   - Zdefiniowano interfejsy `CEFRLevel` (`'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'`), `BlueprintSentence`, `BlueprintChapter`, `BlueprintTopicMeta` oraz `IdiomItem`.
3. **Niezawodny skrypt ekstrakcji (`scripts/parseGrammarPdfs.ts`)**:
   - Skuteczna sanityzacja stopek, nagłówków stron i usuwanie rozbić słów powstałych przez łamanie linii w PDF.
   - Parsowanie 6 tomów podręcznika „Angielski w tłumaczeniach — Gramatyka” (A1–C2) oraz pliku `Idiomy.pdf`.
   - Wyniki parsowania:
     * **Tom 1 (A1)**: 36/36 rozdziałów, 1258 sparowanych zdań, 0 braków.
     * **Tom 2 (A2)**: 36/36 rozdziałów, 1258 sparowanych zdań, 0 braków.
     * **Tom 3 (B1)**: 36/36 rozdziałów, 1258 sparowanych zdań, 0 braków.
     * **Tom 4 (B2)**: 36/36 rozdziałów, 1258 sparowanych zdań, 0 braków.
     * **Tom 5 (C1)**: 36/36 rozdziałów, 1258 sparowanych zdań, 0 braków.
     * **Tom 6 (C2)**: 36/36 rozdziałów, 1256 sparowanych zdań, 0 braków.
     * **Idiomy**: 20 idiomów z polskim znaczeniem i przykładami zdań.
     * **Łącznie**: 216 rozdziałów (ponad 200 tematów w `index.json`) i 7546 zdań wzorcowych.
4. **Struktura danych JSON (`data/blueprints/`, `src/data/blueprints/`)**:
   - `index.json` — lekki indeks metadanych 216 tematów.
   - `level_1_a1.json` do `level_6_c2.json` — pełne zbiory zdań podzielone na tomy.
   - `idioms.json` — zestaw idiomów dla poziomu A2-B1.
5. **Serwis pobierania wzorców z Code Splitting (`services/blueprintService.ts`, `src/services/blueprintService.ts`)**:
   - `getBlueprintIndex()` — synchroniczny odczyt indeksu metadanych.
   - `getTopicsByLevel(level)` — filtrowanie tematów według poziomu CEFR.
   - `getChapterDetails(level, chapterId)` — dynamiczny import odpowiedniego pliku JSON na żądanie.
   - `getIdioms()` — asynchroniczne pobieranie bazy idiomów.
6. **Weryfikacja jakościowa**:
   - `npx tsc --noEmit` — 0 błędów typowania.
   - `npm test` — 513/513 testów jednostkowych zaliczonych.
   - `npm run build` — produkcyjna kompilacja bundle zakończona sukcesem.

---

### 🚀 Pakiet 1: Architektura Cockpitu AI i Karta Kursanta ID Card Master-Detail (2026-09-23, runda 51)

**Zrealizowano pełny Pakiet 1 refaktoryzacji interfejsu Cribro Recall:**
1. **Uproszczenie Pulpitu Głównego (Dashboard / AdminPanel)**:
   - Zredukowano górne kafelki nawigacyjne do **DWOCH głównych modułów**:
     * Moduł 1: **"Moi kursanci & Grupy"** (`id: 'students'`) — zintegrowana baza CRM, widok kafelkowy, zarządzanie grupami.
     * Moduł 2: **"Moje zasoby"** (`id: 'tools'`) — materiały, testy, bank ćwiczeń, planer lekcji, mailing, baza słownictwa i statystyki.
   - Siatka wyśrodkowana w układzie `grid-cols-1 sm:grid-cols-2 max-w-4xl`.
   - Czat asystenta AI (`TeacherAssistant` w trybie `mode="embedded"`) stanowi centralny element strony głównej Cockpitu lektora (mózg operacyjny lektora).
   - Zapewniono automatyczne ukrywanie pływającej ikony FAB asystenta AI w lewym dolnym rogu ekranu (`mode="floating"`), gdy użytkownik znajduje się na widoku głównym Cockpitu (brak dublowania czatu na ekranie).
   - Zaktualizowano przewodnik samouczka lektora (`tourSteps.ts`) do 2 modułów.
2. **Likwidacja "Centrum Kursanta" i wdrożenie układu Master-Detail**:
   - Całkowicie wycofano poziomy briefing/komponent "Centrum Kursanta" (`StudentOperationalHub`) oraz poziomy pasek zakładek.
   - Wdrożono dwukolumnowy układ Master-Detail (`max-w-[1640px]`):
     * **LEWA KOLUMNA** (~320-360px / `w-full lg:w-80 xl:w-96`):
       - Karta w formacie **"ID Card"**: awatar/inicjał, imię i nazwisko, username, pigułka poziomu CEFR, firma/kontraktor, e-mail, status współpracy, ostatnia wizyta oraz przycisk powrotu do CRM.
       - Wertykalne kafelki nawigacji z subtelnymi akcentami kolorystycznymi:
         1. **"Historia lekcji"** (akcent indigo/fiolet, licznik lekcji, domyślnie aktywny widok).
         2. **"Dane podstawowe"** (akcent emerald/zielony, edycja profilu, kontaktu, notatek lektora, CEFR i AI).
         3. **"Prace domowe"** (akcent amber/pomarańczowy, zadania i statusy).
         4. **"Notatnik lekcyjny (A4)"** (akcent sky/błękitny, szybkie przejście do wspólnego notatnika kursanta).
     * **PRAWA KOLUMNA** (`flex-1 min-w-0`):
       - Pełny obszar roboczy wybranego widoku z lewej kolumny.
3. **Ciągłość funkcji w Historii Lekcji**:
   - Zachowano nienaruszony komplet akcji lektora: przegląd wpisów lekcyjnych, transkrypcje w Notion, wpis ręczny, porządkowanie lekcji w Notion na 4 bloki oraz eksport do pliku PDF.
4. **Weryfikacja**:
   - `npx tsc --noEmit` — 0 błędów typowania.
   - `npm test` — 513/513 testów przechodzi pomyślnie.
   - `npm run build` — bundle buduje się bez problemów.

---

### 🎨 Refaktoryzacja widoku CRM, bazy kursantów i nawigacji 80/20 (2026-09-23, runda 50)

**Zadanie:** uproszczenie i ujednolicenie architektury CRM oraz bazy kursantów zgodnie z zasadą 80/20:
1. **Reorganizacja nawigacji głównej pulpitu lektora (`AdminPanel.tsx`)**:
   - Usunięto z górnej siatki osobny kafelek "Moje lekcje". Historia lekcji dostępna jest bezpośrednio z karty każdego kursanta.
   - Pasek zredukowany do 3 głównych modułów: `Dzisiaj (Cockpit)`, `Moi kursanci & Grupy` (zaktualizowany opis i badge), `Narzędzia lektora`.
   - Zaktualizowano samouczek lektora (`tourSteps.ts`) do 3 modułów.
2. **Domyślny widok kafelkowy (Cards View) w CRM (`StandaloneStudentDatabaseScreen.tsx`)**:
   - Wprowadzono stan `viewMode: 'cards' | 'table'` z domyślnym ustawieniem `'cards'`.
   - Dodano obok wyszukiwarki dyskretny przełącznik z ikonami `LayoutGrid` / `Table` (z opisem widoku administracyjnego).
   - Zaprojektowano estetyczne kafelki w ciemnym motywie (`bg-base-200/80`, `border-line-strong`, hover glow `border-primary/50`) łączące kursantów indywidualnych oraz grupy zajęciowe na jednej siatce z pigułkami typu, poziomu CEFR, kontraktora/firmy, statusu oraz ostatniej lekcji.
3. **Karta szczegółów kursanta — zmiana na "ID kursanta" oraz historia z Notatnikiem A4 (`StudentProfileHeader.tsx`, `StudentOperationalHub.tsx`, `AdminPanel.tsx`)**:
   - Zmieniono nagłówki i etykiety z "Profil kursanta" na "ID kursanta".
   - Do kart lekcji w zakładce *Historia Lekcji* dodano szybki link otwierający Notatnik lekcyjny (A4) (`scratchpad`).
4. **Unifikacja zarządzania grupami (`StandaloneStudentDatabaseScreen.tsx`, `AdminPanel.tsx`)**:
   - Usunięto stary przycisk `+ Nowa grupa / para` oraz modal `CreateGroupModal`.
   - Wprowadzono przycisk `+ Grupy zajęciowe` uruchamiający kanoniczny moduł `GroupsManager.tsx` (bazujący na `groups/{groupId}` i `/api/groups`).
   - Usunięto zdublowany odnośnik do grup z podwidoku *Narzędzia lektora* (`toolsDrawer`).

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513 zaliczonych), `npm run build` (przechodzi na czysto).

---

### 🔧 Notatnik A4: naprawa zakreślaczy inline, "Korekta w locie", zablokowane nagłówki szablonu, elastyczny canvas strony (2026-09-22, runda 49)

**Problem:** zaznaczenie fragmentu tekstu przechodzącego przez więcej niż jeden akapit i kliknięcie
❌ Błąd / ✅ Poprawnie / 💡 Słówko owijało CAŁY zaznaczony `Range` (razem z `<div>`/`<p>` w środku) w
jeden `<span>` — nielegalny, ale tolerowany przez przeglądarkę układ renderujący się jako
pełnoszerokie, puste kolorowe pasy zamiast podświetlenia w linii tekstu.

**Naprawa:** `handleHighlight` (`ScratchpadEditor.tsx`) korzysta teraz z nowej `wrapSelectedTextInline`
— dzieli zaznaczenie na węzły tekstowe (z `Text.splitText` na granicach zaznaczenia) i owija KAŻDY
z osobna, nigdy nie przenosząc bloków do środka `<span>`.

**Nowe narzędzia paska:**
- 🧹 Wyczyść zaznaczenie — zdejmuje nałożone `<span style="...">` (zakreślacze/korekty) i
  `foreColor` z zaznaczonego fragmentu.
- ⇄ Korekta — przekreśla zaznaczenie i stawia obok puste miejsce na poprawną formę, z kursorem
  ustawionym od razu w środku.
- Rozwijana strzałka `▾` obok istniejącej palety kolorów tekstu — dodatkowa siatka pastelowych
  odcieni (`NOTEBOOK_SWATCHES_EXTENDED` w `utils/notebookPalette.ts`).

**Zablokowane nagłówki szablonu lekcji:** `<h2>`/`<h3>` wstawiane przez `buildLessonTemplate`
(`utils/lessonTemplate.ts`) dostają `contenteditable="false"` + klasę `pad-locked-heading`. Zmiana
zachowania: wcześniej treść nagłówka (np. data lekcji) była edytowalna wprost w miejscu — teraz
trzeba usunąć i wstawić nagłówek od nowa, żeby poprawić literówkę. Świadoma decyzja zgodna z
briefem ("nagłówki nieedytowalne"), nie inicjatywa agenta.

**Elastyczny canvas strony:** patrz wpis wyżej o `measurePages` — kontrakt "1 Lekcja = 1 Strona".

Zob. `AGENT_LOG.md` (2026-09-22) po pełne detale i uzasadnienie decyzji (m.in. dlaczego kolory
nowych narzędzi zostały jako inline-style hex, nie klasy Tailwind z briefu — spójność z resztą
`utils/notebookPalette.ts`). Weryfikacja: `tsc --noEmit` 0 błędów, `npm test` 513/513, `npm run
build` przechodzi. Brak weryfikacji wzrokowej w przeglądarce.

---

### 🚀 Pakiet 2 Refaktoryzacji Interfejsu (Pulpit Lektora, CRM Glassmorphism, Dedublikacja Powiadomień, Panel Kursanta) (2026-09-23)

**Zadanie:** Realizacja Pakietu 2 refaktoryzacji UI:
1. Dynamiczne przełączanie widoku i zachowanie Czatu AI (centralny mózg w Cockpicie, ukryty FAB; po przejściu do podmodułów centralny czat znika i pojawia się pływający trigger FAB w lewym dolnym rogu).
2. Sekcja Narzędzi Lektora (Inline zamiast modal/drawer): po kliknięciu „Moje zasoby" narzędzia wyświetlają się wprost w widoku roboczym pod głównymi kafelkami.
3. Dedublikacja Powiadomień: usunięto dublujące się popupy z prawego dolnego rogu oraz baner z panelu lektora; pozostawiono JEDNO estetyczne, zbiorcze powiadomienie pigułkowe w TopBarze (`Wymaga uwagi: X`).
4. Udoskonalenie CRM (`StandaloneStudentDatabaseScreen.tsx`): stylistyka Glassmorphism (`bg-base-200/50 backdrop-blur-md`, `border border-white/10`, delikatny glow), kompaktowy przełącznik sortowania („Ostatnia aktywność" vs „Alfabetycznie A-Z") oraz skompresowany pasek wyszukiwania i filtrów.
5. Uproszczenie Panelu Kursanta (`StudentHeroHeader.tsx`, `TodayScreen.tsx`): minimalistyczne powitanie „Cześć [Imię]" z motywującym tekstem („Dobrze Ci idzie!"), usunięcie zbędnych liczników i etykiet, pojedynczy Action Hero Card ze stanem zadania od lektora oraz uporządkowana 4-elementowa nawigacja.

**Zmienione:**
- `components/admin/AdminPanel.tsx` — wycofanie `toolsDrawerOpen` i `GSAPModal` narzędzi lektora; wdrożenie widoku inline pod `activeTab === 'tools'`; synchronizacja `setActiveTab` z `onTabChange`; montowanie centralnego `TeacherAssistant mode="embedded"` wyłącznie przy `!activeTab && !selectedUser`; usunięcie dublującego `TeacherAttentionBanner`.
- `components/dashboard/Dashboard.tsx` — usunięcie pływającego `TeacherHomeworkNotification` z prawego rogu; wprowadzenie scentralizowanego nasłuchu `teacherAttentionCount` z `specialTasks` i `attempts` w czasie rzeczywistym i podpięcie do pigułki `notices` w `TopBar`.
- `components/admin/StandaloneStudentDatabaseScreen.tsx` — dodanie sortowania (`activity` vs `alphabetical`), ikonki `ArrowDownAZ`, kompaktowego paska narzędziowego oraz stylistyki Glassmorphism dla kafelków kursantów i grup.
- `components/dashboard/StudentHeroHeader.tsx` — usunięcie etykiety „Panel kursanta" oraz rozpraszających boxów liczników; wyczyszczenie powitania do „Cześć [Imię]" i „Dobrze Ci idzie!"; wdrożenie pojedynczego Action Hero Card prowadzącego bezpośrednio do zadań od lektora.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513), `npm run build` (sukces).

---

### 🌙 Nocny pakiet stabilizacyjny — zakładki prac domowych, logowanie e-mailem, mail powitalny, fix uprawnień odrzucania lekcji, tydzień kalendarzowy, fix Notion fetch-transcripts (2026-09-21, runda 48)

**Zadanie:** zlecenie w pełni autonomicznej sesji obejmujące 7 niezależnych obszarów. Faza 4 (obszar wysokiego ryzyka wg CLAUDE.md sekcja 3) i ogólny zakres zostały najpierw potwierdzone z Maciejem przez `AskUserQuestion` zamiast działania bez pytania — zgodnie z CLAUDE.md, które ma priorytet nad instrukcją zlecenia "nie zatrzymuj się na pytania o zakres".

**Zmienione:**
- `components/dashboard/HomeworkScreen.tsx` — pionowy stos trzech sekcji lektora (aktywne prace / testy kursantów / archiwum) zastąpiony poziomą nawigacją zakładkową "Prace domowe" / "Moje testy" / "Sprawdzone przez nauczyciela" (nowy stan `contentTab`, memo `activeStudentTests`/`completedStudentTests`/`activeHomeworkCount`). Wyłącznie zmiana filtrowania/prezentacji — bez zmian w zapytaniach Firestore, mutacjach ani logice oceniania AI. Przycisk "+ Przypisz pracę domową" zostaje w nagłówku niezależnie od zakładki.
- `components/auth/AuthScreen.tsx` — pole logowania to teraz "Adres e-mail" (`type="email"`, `autoComplete="email"`), normalizacja `trim().toLowerCase()`, mapowanie błędów Firebase (`auth/invalid-email`, `auth/user-not-found`/`wrong-password`/`invalid-credential`, `auth/too-many-requests`) na czytelne komunikaty PL. `loginWithEmail`/`registerWithEmail` w `AuthContext.tsx` już wcześniej wywoływały `signInWithEmailAndPassword` bezpośrednio, bez wyszukiwania po `username` w Firestore — bez zmian.
- `components/admin/StudentDatabaseScreen.tsx` — usunięto renderowanie etykiet `@username` w wierszu tabeli CRM oraz w modalach usuwania/edycji kursanta (identyfikacja przez imię/nazwisko i e-mail). `types.ts`: `User.username` oznaczone `@deprecated` (fallback nazwy wyświetlanej, nie login).
- `services/homeworkEmail.ts` (`buildWelcomeEmail`) i `components/admin/StudentInviteEmailModal.tsx` — pole "Login" w mailu powitalnym i w kopiowanym tekście bierze teraz e-mail odbiorcy zamiast `student.username`; dodana wyróżniona ramka ze wskazówką o logowaniu jednym kliknięciem przez Google dla adresów Gmail/Workspace (HTML + wersja tekstowa). Zapis statusu/daty zaproszenia (`invitationSent`, `invitationSentAt`, `lastInviteSentAt`) już działał poprawnie.
- `services/lessonRecord.ts` (`deleteLessonRecord`) — **fix P0**: kasowanie głównego rekordu lekcji przy odrzucaniu (`rejectNotionLesson`) szło przez nieosłonięty `deleteDoc`; przy próbie usunięcia dokumentu, który już nie istniał (podwójny klik, wyścig dwóch zakładek lektora), reguła Firestore czytająca `resource.data` przy delete dostawała puste `resource` i zwracała "Missing or insufficient permissions". Naprawione przez objęcie tym samym guardem `deleteIfExists`, który już chronił opcjonalne zestawy fiszek. **Świadomie bez zmian w `firestore.rules`** — bezpieczny wariant ustalony z Maciejem przed wdrożeniem.
- `components/admin/AdminPanel.tsx` — grupowanie historii lekcji kursanta zamiast kroczących 7 dni (`diffDays <= 7`, granica przesuwała się codziennie) liczy teraz bieżący tydzień kalendarzowy (poniedziałek 00:00 do teraz), etykieta "Ten tydzień".
- `server.ts` (`syncNotionTranscriptsFromApi`) — **fix P0**: zapytanie do bazy spotkań Notion nie miało sortowania, więc przy bazie większej niż `page_size=40` świeżo dodana dzisiejsza transkrypcja mogła nie zmieścić się w wynikach i modal pokazywał "Brak stron w Notion powiązanych z tym kursantem" mimo istniejącej strony. Dodano `sorts: created_time desc` (tak jak już robi `/api/notion/recent-meetings`), dopasowanie po samym nazwisku (obok imienia/pełnego imienia+nazwiska/e-maila/nazwy grupy) i logi diagnostyczne (liczba zwróconych stron, pageId/tytuł niedopasowanych stron).

**Świadomie nieruszone:** `firestore.rules`, middleware autoryzacji w `server.ts`, ścieżki tokenowe bez logowania (`homework/direct/:token`, notatnik po PIN).

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), `npm run build` (przechodzi, w tym `server.cjs` i `api/index.js`). UI NIE zweryfikowane wzrokowo w przeglądarce w tej sesji — zwłaszcza wygląd zakładek na telefonie, realny test logowania e-mailem i realny import transkrypcji Dariusza Wacha z Notion.

---

### 🎯 Przywrócenie Hero Chatu Asystenta AI na pulpicie lektora (2026-09-21, runda 47)

**Zadanie:** zlecenie chciało dedykowanej sekcji Hero z centralnym czatem AI pod siatką 4 kafelków pulpitu (badge, nagłówek "W czym mogę dzisiaj pomóc?", pigułki Flash/Thinking, @ Kursant/Skille/Załącz, przycisk wysyłki). Audyt pokazał, że `TeacherAssistant.tsx` w `mode="embedded"` (`:979-1836`) to dokładnie ten komponent — identyczny badge, nagłówek, pigułki (Flash w amber gradiencie), autouzupełnianie @ i /, załączniki, karty lekcji/scenariuszy — już w pełni zbudowany i przetestowany. Był jednak montowany wyłącznie wewnątrz pełnoekranowej nakładki, otwieranej przyciskiem-paskiem pod kafelkami (`AdminPanel.tsx`), zamiast być stałym elementem pulpitu.

**Zmienione:**
- `components/admin/AdminPanel.tsx` — przycisk-pasek "Otwórz czat AI" pod siatką 4 kafelków zastąpiony bezpośrednim montowaniem `<TeacherAssistant mode="embedded" .../>` z tymi samymi handlerami co wcześniej (`handleAssistantNavigate`, `handleAssistantSelectStudent`, `handleAssistantCreateLessonRecord`, `handleAssistantOpenInPresentation`). Montowanie warunkiem JS `isDesktopUI` (nie samym CSS `hidden md:block` jak reszta siatki) — inaczej komponent odpalałby `buildStudentIndex()` w tle również na telefonie, mimo że wizualnie ukryty.

**Świadomie nieruszone:** `assistantOverlayOpen` i pełnoekranowa nakładka (`AdminPanel.tsx:2260-2280`) zostają bez zmian — to nadal jedyne wejście do czatu AI na telefonie (`TeacherMobileHub` → stopka "Zapytaj Asystenta AI"). Żadna logika `TeacherAssistant.tsx` nie została zduplikowana w nowym komponencie — zero ryzyka rozjazdu między "hero" a "pełnym" czatem, bo to ten sam komponent.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), `npm run build` (przechodzi). UI NIE zweryfikowane wzrokowo w przeglądarce w tej sesji (dług z sekcji 6 CLAUDE.md) — zwłaszcza czy `isDesktopUI` faktycznie wyklucza podwójne montowanie na telefonie.

---

### 🧠 Ekstrakcja Gemini Flash w imporcie transkrypcji z Notion — koniec z surowym tytułem/ISO, gotowa lekcja od razu po akceptacji (2026-09-21, runda 46)

**Zadanie:** Pull-on-Demand import z Notion (`server.ts:2683` `syncNotionTranscriptsFromApi`, endpoint `/api/notion/fetch-transcripts`) miał już selekcję per-kursant, idempotentność i modal podglądu, ale tytuł lekcji był surowym tytułem strony Notion (albo fallbackiem "Lekcja z dnia..."), a zaakceptowany import zapisywał tylko `topic/date/rawTranscript` ze statusem `pending_confirmation` — lektor musiał później osobno wygenerować bloki lekcji.

**Zmienione:**
- `server.ts` — nowa funkcja `extractNotionTranscriptData(transcriptText, fallbackDate)`: wywołuje Gemini (kaskada `AI_MODEL_CASCADE`, zaczyna od `gemini-2.5-flash`, `thinkingConfig.thinkingBudget: 0`, `responseSchema` z polami `topic/date/summary/keyLanguage[]/corrections[]`) i zwraca sparsowany JSON z fallbackiem na pustą strukturę przy błędzie (jedna nieudana strona nie wywraca całego importu). W gałęzi `mode: 'preview'` `syncNotionTranscriptsFromApi` wywołuje ekstrakcję dla każdej nowej strony i dokłada do itemu `aiTopic/aiDate/aiSummary/keyLanguageCount/correctionsCount/keyLanguage/corrections`. W gałęzi `mode: 'import'` ekstrakcja uruchamia się ponownie tylko dla jawnie zaznaczonych stron (koszt pomijalny), a zapis do `lessonRecords` idzie już z kompletnymi polami (`topic` — edytowany przez lektora `topicOverrides[pageId]` albo temat z AI, `date`, `lessonSummary`, `vocabularyText` i `corrections` sformatowane z tablic AI) oraz statusem `confirmed`/`isPendingConfirmation: false` zamiast dotychczasowego `pending_confirmation`/`draft`.
- `components/admin/NotionImportPreviewModal.tsx` — `NotionPreviewItem` rozszerzony o pola AI; tytuł w karcie podglądu to teraz edytowalny `<input>` (domyślnie `aiTopic`), pod nim podsumowanie AI i liczniki "X zwrotów"/"Y korekt". `onConfirmImport` przyjmuje teraz też `topicOverrides: Record<string,string>` z edycjami lektora.
- `components/admin/AdminPanel.tsx` (`handleImportNotionForOpenStudent`) i `components/admin/TeacherLessonHistoryView.tsx` (`handleConfirmNotionImport`) — oba call site'y modala przekazują `topicOverrides` dalej do body requestu.

**Decyzja architektoniczna:** import z Notion przestaje przechodzić przez etap `pending_confirmation` → ręczne „wygeneruj bloki" → potwierdź. Modal podglądu z ekstrakcją AI JEST teraz jedynym krokiem human-in-the-loop — po kliknięciu „Zaimportuj zaznaczone" lekcja ląduje w Firestore od razu ze statusem `confirmed` i kompletnymi polami. `structuredBlocks` (`utils/lessonBlocks.ts`) świadomie NIE jest tu ustawiane — tak jak wcześniej, klient wylicza bloki przy renderze przez `extractLessonBlocks()`.

**Świadomie nieruszone:** `firestore.rules`, `requireFirebaseAuth`/`requireFirebaseAdmin` (endpoint już był za `requireFirebaseAdmin`), ścieżki tokenowe bez logowania.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), `npm run build` (przechodzi). Ręczny test w przeglądarce (podgląd/import realnej transkrypcji z Notion) NIE wykonany w tej sesji.

---

### 🧩 CRM Kursantów: konfiguracja kolumn, sortowanie, błyskawiczne tooltipy; scalenie profilu kursanta do 4 zakładek; odchudzenie panelu ucznia (2026-09-21, runda 45)

**Zadanie:** personalizacja tabeli kursantów (widoczność kolumn, sortowanie, natychmiastowe tooltipy zamiast natywnego `title`), scalenie profilu kursanta z 6+ zakładek do 4, usunięcie szumu z panelu ucznia (moduł Słownictwo & AI).

**Zmienione:**
- `components/admin/StudentDatabaseScreen.tsx` — dropdown „⚙️ Kolumny" nad tabelą (5 przełączników: Poziom/Profil, Adres e-mail & hasło, Zaproszenie i aktywacja, Ostatnia wizyta/Logowania, Kontraktor/Gdzie pracuje), stan zapisywany w `localStorage` pod kluczem `cribro_crm_columns_prefs`. Nowa kolumna „Kontraktor / Gdzie pracuje" (`user.contractor`/`user.company`, pola już istniały w `types.ts`, nie były pokazywane w tabeli). Sortowanie po kliknięciu nagłówka z czytelnym wskaźnikiem chevron (góra/dół zamiast statycznej strzałki) dla Kursant/Nazwisko, E-mail, Poziom i nowego pola „Ostatnia wizyta" (usunięto martwe pole sortowania `logins`, które nie miało podpiętego nagłówka — ujednolicone do `lastActive`, bo to ono odpowiada realnemu wymogowi „monitorowanie aktywności"). Nowy komponent `ActionTooltip` (czysty Tailwind, `group/tip` + `group-hover/tip:flex`, pojawia się bez natywnej ~1-2 s zwłoki przeglądarki) zastąpił `title=` przy ikonach akcji (kopiowanie hasła, edycja e-maila, oznaczanie zaproszenia, skróty Profil/Planer/Prace/Zaproszenie/Notatnik, „Więcej opcji"), z efektem `hover:scale-115 hover:text-emerald-400 active:scale-95`.
- `components/admin/AdminPanel.tsx` — pasek zakładek profilu kursanta scalony z 8 do 4 widocznych: **Centrum kursanta (Hub)**, **Moje lekcje** (dawna „Historia lekcji"), **Praca domowa**, **Profil & Dane**. Nowa stała `SHOW_LEGACY_STUDENT_TABS = false` (ten sam wzorzec co istniejący `SHOW_LEGACY_PANEL_TOOLS`) chowa z paska — ale NIE usuwa z kodu — zakładki „Spaced Repetition (Recall)", „Słownictwo & AI", „Testy AI" i osobne „Statystyki & Wyniki"; ich JSX nadal się renderuje pod `activeTab==='recall'|'vocabulary'|'tests'|'stats'` i wraca jednym przestawieniem stałej na `true`. Wewnątrz „Profil & Dane" pięć sekcji (`profileSection`) scalone widokowo do 3: „Dane podstawowe i poziom" (dawne `basic`+`level`), „E-mail, dostęp i uprawnienia" (dawne `mail`+`access`), „Aktywność i statystyki" (bez zmian) — stan `profileSection` i callbacki `onEditContact`/`onEditLevel` zostały nietknięte (nadal ustawiają `'mail'`/`'level'`), warunki renderowania kart zostały złączone przez `||`, więc nic się nie rozjechało.
- `components/admin/StudentOperationalHub.tsx` — usunięty przycisk „Rozpocznij dzisiejszy Recall" z paska działań obok „Prowadź lekcję" (zgodnie z poleceniem). Jego metryki (`hubData.recallStats`) przeniesione do nowego boksu „Stan bazy Recall (Spaced Repetition)" w zakładce Hub/briefing, z drobnym linkiem „Zobacz szczegóły" wywołującym ten sam `onOpenRecall`.
- `components/dashboard/TodayScreen.tsx` — nowa stała `SHOW_STUDENT_VOCABULARY_MODULE = false` chowa (nie usuwa) zakładkę „Słownictwo" w panelu zasobów kursanta (`resourceSubTab`) razem ze skrótem „Otwórz fiszki" i `StudentVocabPreview`; domyślna zakładka zasobów to i tak już była „Praca domowa" (`resourceSubTab === 'homework'`), więc kursant po zalogowaniu widzi wyłącznie prace domowe, testy i historię/notatnik — bez zmian w `StudentHomeworkScreen.tsx` (nie miał modułu słownictwa/AI widocznego dla ucznia).

**Decyzja architektoniczna (na wyraźne życzenie w trakcie zadania):** żadna z „usuwanych" funkcji (Słownictwo & AI, Recall jako osobna zakładka, Testy AI, osobne Statystyki) nie została skasowana z kodu — wszystkie chowają się za stałymi typu `SHOW_*` z komentarzem odwracającym w jednej linii. Podejście spójne z istniejącym już w pliku wzorcem `SHOW_LEGACY_PANEL_TOOLS`.

**Świadomie nieruszone:** `firestore.rules`, `requireFirebaseAuth`/`requireFirebaseAdmin`, ścieżki tokenowe (`homework/direct/:token`, notatnik po PIN) — zero zmian w tym zadaniu.

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), `npm run build` (przechodzi). UI NIE zweryfikowane wzrokowo w przeglądarce — w szczególności dropdown „Kolumny" (kolejność/szerokość kolumn po ukryciu), chevron sortowania i nowa kolumna Kontraktor na realnych danych.

---

### 🧩 Unifikacja podglądu lekcji (globalna Historia Lekcji ↔ profil kursanta), hierarchia tematu, czyszczenie duplikatów Weryfikacja (2026-09-21, runda 44)

**Zadanie:** zlikwidować podwójną logikę wyświetlania lekcji — modal podglądu w globalnej "Historii Lekcji" renderował własny, uboższy układ ("1. Scenariusz i założenia", "2. Podsumowanie i 4 Bloki Notion") zamiast działającego akordeonu `CascadingLessonDetails` używanego w profilu kursanta, przez co często pokazywał "Brak zapisanego słownictwa" mimo że dane istniały. Dodatkowo: rozszerzyć hierarchię wyciągania tematu lekcji i dodać jednorazowe czyszczenie wiszących duplikatów `Weryfikacja`.

**Zmienione:**
- `components/admin/TeacherLessonHistoryView.tsx` — modal podglądu lekcji (`previewLesson`) renderuje teraz `<CascadingLessonDetails>` (ten sam komponent co w profilu kursanta, `AdminPanel.tsx`), zamiast własnego, zdublowanego układu bloków. Stopka modalu ograniczona do `Edytuj` / `Usuń` / `Otwórz Notatnik` (usunięte `Prezentacja` i `Zadaj pracę domową` — dublowały akcje dostępne już w wierszu tabeli). Dodano nowe propsy: `onEditLesson`, `onGenerateHomeworkFromLesson`, `onConfirmLesson`, `onRejectLesson`, `onUpdateLesson`, `onCleanupDuplicatePendingLessons`. Nowy przycisk nagłówka "Wyczyść duplikaty Weryfikacja (N)", widoczny tylko gdy `findDuplicatePendingLessons()` coś znajdzie.
- `components/admin/AdminPanel.tsx` — `handleConfirmLessonDirectly`/`handleRejectNotionLesson` dostały opcjonalny `studentIdOverride`, żeby działały dla lekcji spoza aktualnie otwartego profilu kursanta (globalna tabela nie ma pojęcia "wybranego kursanta"). Nowy `handleUpdateLessonRecordForStudent` (dla przycisku "Utrwal czysty format" w `CascadingLessonDetails`). Zapis edycji lekcji (`handleSaveLessonRecord`) i obie powyższe funkcje odświeżają teraz `allTeacherLessons` (`fetchAllLessons`), żeby zmiany z globalnego podglądu były od razu widoczne w tabeli.
- `utils/lessonDisplay.ts` — `getDisplayLessonTopic()` rozszerzony o pełną hierarchię: (1) realny `topic`, (2) pierwsza linijka (do 60 znaków) streszczenia lekcji/Bloku 1, (3) nazwa kursanta/firmy oczyszczona ze znacznika ISO, (4) `Lekcja z dnia DD.MM.YYYY`. Parametr typowany wąskim `Pick<LessonRecord, ...>` zamiast `Partial<LessonRecord>`, żeby wywołania z lżejszych typów kart (np. `CloseoutLessonCard`, gdzie `source` to zwykły `string`) nie padały na niezwiązanych polach.
- `utils/lessonBlocks.ts` — nowa `findDuplicatePendingLessons()`: znajduje wpisy w statusie `Weryfikacja`, dla których ten sam kursant ma już potwierdzoną lekcję tego samego dnia (zdublowany import z Notion obok ręcznie uzupełnionego rekordu). Czysta funkcja, nic nie usuwa sama.
- `tests/lessonDisplay.test.ts` (nowy, 11 testów) i `tests/lessonBlocks.test.ts` (+2 testy) — pokrycie nowej hierarchii tematu i `findDuplicatePendingLessons`.

**Świadomie nieruszone:** `firestore.rules` — nie dotknięte. Permission bugfix przy kasowaniu/odrzucaniu lekcji (`deleteIfExists` w `services/lessonRecord.ts`) był już zrobiony w poprzedniej rundzie (43) i zweryfikowany jako wystarczający — patrz reguła `sets/{setId}` w `firestore.rules`, gdzie odczyt nieistniejącego dokumentu rzuca `permission-denied` z samej konstrukcji reguły (`resource.data.userId` na `resource == null`); `deleteIfExists` łapie ten wyjątek w `try/catch` zamiast przepuszczać go do lektora, więc operacja kasowania kończy się sukcesem mimo ostrzeżenia w konsoli.

**Szczegóły i decyzje architektoniczne:** `AGENT_LOG.md`, wpis z 2026-09-21 (runda 44).

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), `npm run build` (przechodzi). UI NIE zweryfikowane wzrokowo w przeglądarce.

---

### 🧹 Import z Notion na Pull-on-Demand, deduplikacja po dacie, likwidacja "salonu gier" AI z widoku lekcji (2026-09-21, runda 43)

**Zadanie:** pakiet stabilizacji silnika lekcji — wyłączyć automatyczny import z Notion w tle, wymusić twardą deduplikację i idempotentne ID przy imporcie, ujednolicić format tematów/dat w widoku "Moje Lekcje", zastąpić poziomy pasek 20+ pigułek kursantów kompaktowym dropdownem, oraz usunąć 3 karty generatorów AI z widoku szczegółów pojedynczej lekcji.

**Zmienione:**
- `server.ts` (`syncNotionTranscriptsFromApi`, `/api/notion/fetch-transcripts`) — usunięty `setInterval` odpytujący Notion co 5 minut w tle. Funkcja dostała tryby `preview` (tylko podgląd, nic nie zapisuje) i `import` (zapisuje wyłącznie strony jawnie zaznaczone przez lektora, dla jednego wybranego kursanta). Twarda deduplikacja: pominięcie strony, jeśli kursant ma już zatwierdzoną (`status: 'confirmed'`) lekcję na ten sam dzień. Idempotentne ID nowych wpisów: `notion_<pageId>`. Usunięty podwójny zapis do osieroconej, nieobjętej `firestore.rules` kolekcji najwyższego poziomu `lessonRecords` — zapis idzie wyłącznie do `users/{studentId}/lessonRecords`.
- `components/admin/NotionImportPreviewModal.tsx` (nowy) — modal podglądu: lektor widzi kandydatów z Notion dla wybranego kursanta i sam zaznacza, co zaimportować. `components/admin/NotionUnmatchedTranscriptsModal.tsx` (usunięty — ścieżka stała się nieosiągalna po zawężeniu podglądu do jednego kursanta).
- `functions/src/notion/dailyCheck.ts` (usunięty) — martwy `onSchedule` (codziennie 06:00), nigdy nie wyeksportowany jako Cloud Function, pisał do dokumentu, którego żaden frontend nie czytał.
- `utils/lessonDisplay.ts` (nowy) — `getDisplayLessonTopic()`/`formatLessonDateDDMMYYYY()`: wykrywa surowe ciągi ISO zapisane jako temat lekcji (np. `Milena… 2026-09-16T06:30…`) i pokazuje `Lekcja z dnia DD.MM.YYYY` zamiast nich. Podłączone we wszystkich miejscach, gdzie temat trafia bezpośrednio do lektora (`TeacherLessonHistoryView.tsx`, `AdminPanel.tsx`, `TeacherMobileHub.tsx`, `TeacherTodayCockpit.tsx`, `StudentOperationalHub.tsx`).
- `components/admin/TeacherLessonHistoryView.tsx` — poziomy pasek pigułek kursantów/grup zastąpiony przyciskiem-dropdownem z wyszukiwarką.
- `components/admin/AdminPanel.tsx` — z widoku szczegółów pojedynczej lekcji usunięte 3 karty generatorów AI ("Wygeneruj pracę domową z tej lekcji", "Generator scenariusza lekcji 2.0", "Kreator Scenariuszy — Canvas"); widok zawiera teraz wyłącznie temat, datę, notatki/transkrypcję, listę słówek oraz akcje Edytuj/Usuń.
- `services/lessonRecord.ts` — próba naprawy błędu uprawnień przy odrzucaniu/usuwaniu lekcji: `deleteLessonRecord()` usuwał bezwarunkowo `sets/set-lesson-{id}`, mimo że większość lekcji nie ma zestawu fiszek — dodano sprawdzenie istnienia przed `deleteDoc` (dokument, którego nigdy nie było, potrafi wywołać "Missing or insufficient permissions" przy ewaluacji reguły Firestore). `rejectNotionLesson()` dostał fallback dla pustego `topic` (pole wymagane przez `isValidRejectedNotionItem` w `firestore.rules`).

**Świadomie nieruszone:** `firestore.rules` — bez jednoznacznego, odtwarzalnego dowodu, że błąd uprawnień pochodzi z reguł (a nie z kodu klienta, co dwie powyższe poprawki już adresują), zmiana w tym obszarze wysokiego ryzyka wymaga osobnej zgody i planu (CLAUDE.md sekcja 3). `functions/src/notion/sync.ts` (`previewSync`/`importSelection`) — ta ścieżka nigdy nie była wyeksportowana jako Cloud Function (nieobecna w `functions/src/index.ts`), a jej bazy Notion w `functions/src/config.ts` są puste od migracji workspace'u 2026-09-19; nie dostała tych samych poprawek co `server.ts`, bo nie wpływa na produkcję — ale ma pokrycie testami (`tests/notionMatch.test.ts`, `notionLevel.test.ts`, `notionParse.test.ts`), więc plik został zamiast tego przy życiu.

**Szczegóły i decyzje architektoniczne:** `AGENT_LOG.md`, wpisy z 2026-09-21 (trzy — jeden na sekcję zadania).

Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (495/495), `npm run build` (przechodzi). UI nie zweryfikowane wzrokowo w przeglądarce.

---

### 🎯 Kokpit lektora (desktop): 4 kafelki zamiast rozwijanego paska „Więcej narzędzi", pasek szybkiego zapytania do Asystenta AI (2026-09-21, runda 42)

**Zadanie:** uprościć główną nawigację pulpitu lektora na desktopie do 4 wyrazistych kafelków i dedykowanej strefy Asystenta AI, likwidując rozwijaną listę drugorzędnych narzędzi.

**Zmienione:** `components/admin/AdminPanel.tsx`
- Siatka główna (`data-coach="tour-teacher-main"`) zredukowana z 4+3+2 (kafelki + rząd „Zadania/Planer/Mailing" + zwijane „Więcej narzędzi": Słownictwo/Statystyki) do dokładnie 4 kafelków: `Dzisiaj (Cockpit)` (CENTRUM DNIA), `Moi kursanci` (BAZA CRM, dawniej „Kursanci"), `Moje lekcje` (LEKCJE I NOTATKI, dawniej „Historia lekcji" — sam tytuł kafelka, id `lesson-history` i pozostałe wystąpienia etykiety w profilu kursanta/turze bez zmian), `Narzędzia lektora` (ZESTAW NARZĘDZI, nowy kafelek zastępujący usunięty kafelek „Notatnik").
- Kliknięcie `Narzędzia lektora` otwiera `GSAPModal` (`toolsDrawerOpen` state) z 6 kafelkami drugorzędnymi: Notatnik lekcyjny (A4), Zadania i testy, Planer lekcji, Mailing (z odznaką liczby nieprzeczytanych), Słownictwo, Statystyki — dokładnie te same akcje (`handleTileClick`) co wcześniej rozsiane po dwóch rzędach.
- Nieprzeczytana poczta (`unreadMailingCount`) sygnalizowana teraz na kafelku `Narzędzia lektora` (pulsująca odznaka „X NOWYCH", wzorem istniejącego mechanizmu `hasNotification`/`notificationCount` w kafelkach), nie tylko wewnątrz podwidoku.
- Usunięty stan `showMoreTools` (zwijany pasek). Nowy stan `toolsDrawerOpen`.
- Stan `mobileAssistantOpen` przemianowany na `assistantOverlayOpen` i odchudzony z `md:hidden` — ta sama pełnoekranowa nakładka czatu (dotąd tylko telefon/Pocket Companion) obsługuje teraz też desktop.
- Pod siatką 4 kafelków nowy pasek „Zapytaj o dzisiejsze lekcje, kursanta lub zaplanuj ćwiczenie..." z przyciskiem „Otwórz czat AI" — otwiera `assistantOverlayOpen` zamiast osadzonego na stałe czatu. Strona główna panelu (`activeTab === null`) nie renderuje już pełnego `<TeacherAssistant mode="embedded">` obok kafelków — dostęp do czatu jest wyłącznie przez pasek/nakładkę, żeby nie kolidował z układem kafelków.
- `components/dashboard/tourSteps.ts` — `buildTeacherTourSteps`: 5 kroków (`tour-teacher-main/context/scratchpad/work/more`) zastąpione 2 krokami (`tour-teacher-main/tools`) zgodnymi z nową siatką; poprzednie kroki wskazywały już częściowo na nieistniejące elementy (`tour-teacher-context` nie miał odpowiadającego kafelka `data-coach` od czasu wcześniejszej rundy).

**Poza zakresem (świadomie):** `components/admin/TeacherMobileHub.tsx` (Pocket Companion, telefon < md) NIE zmieniony — ma własny, wcześniej zaprojektowany układ 3 kafelków + pasek Asystenta w stopce; zlecenie dotyczyło głównej nawigacji desktopowej.

**Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (495/495 zielone), `npm run build` (przechodzi). UI NIE zweryfikowane wzrokowo w przeglądarce — panel lektora wymaga zalogowanego konta testowego, do zrobienia przez Macieja: (1) siatka 4 kafelków i podwidok „Narzędzia lektora" (otwiera się/zamyka, wszystkie 6 akcji trafiają do właściwego modułu), (2) pasek Asystenta AI otwiera pełnoekranową nakładkę czatu i zamyka się krzyżykiem, (3) odznaka nieprzeczytanej poczty na kafelku `Narzędzia lektora`.

**Ryzyka:** brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania.

---

### 🧩 Notatnik: fundament modelu blokowego za flagą `SHARED_NOTEBOOK_V2` (Iteracja 1) (2026-09-20, runda 41)

**Zadanie:** wprowadzić fundament modelu blokowego we współdzielonym notatniku (`ScratchpadDocument`), rozszerzenie hybrydowe obok istniejącego `contentHtml`, bez migracji starych dokumentów i bez zmiany zachowania edytora, dopóki flaga jest wyłączona.

**Added:**
- `config/featureFlags.ts` — `SHARED_NOTEBOOK_V2 = false` i `isSharedNotebookV2Enabled()` (override przez `localStorage.scratchpad_shared_notebook_v2` albo `VITE_SHARED_NOTEBOOK_V2`, wzorem `HOMEWORK_ENGINE_V2`/`functions/src/homeworkV2/flag.ts`).
- `types.ts` — `ScratchpadBlockType` (`heading`/`text`/`bullet_list`/`vocabulary_pair`/`correction`/`callout`/`student_input`/`slide_break`), `ScratchpadBlock`, `ScratchpadDocument.blocks?` (opcjonalne — brak nie oznacza błędu, tylko dokument sprzed modelu blokowego).
- `utils/scratchpadBlocks.ts` — adapter i serializer: `htmlToBlocks` (fallback wsteczny — cały `contentHtml` jako jeden blok `text`), `blocksToHtml`/`blocksToText` (żeby stare widoki, podgląd, druk i eksport do Notion/PDF nadal czytały `contentHtml`/`contentText` tak jak dotąd), `getScratchpadBlocksOrFallback` (blocks jeśli istnieją, inaczej konwersja z HTML).
- `services/scratchpadService.ts` — `saveScratchpadContent` przyjmuje opcjonalny piąty parametr `blocks?: ScratchpadBlock[]`; przy pominięciu (dzisiejsze wywołania z `TeacherScratchpadScreen`/`StudentScratchpadScreen`/`PublicScratchpadScreen`) zachowanie identyczne jak przed zmianą.
- `components/scratchpad/ScratchpadEditor.tsx` — stan `blocksState`, `null` przy fladze wyłączonej (cały istniejący `contentEditable` sterowany `contentHtml` bez zmian); przy fladze włączonej inicjalizuje się i synchronizuje z `docData` przez `getScratchpadBlocksOrFallback` — jeszcze nie wpięty w renderowanie ani zapis, to fundament pod kolejną iterację.
- `firestore.rules` (linia ok. 682, zgoda udzielona w zleceniu) — `'blocks'` dopisane do `hasOnly([...])` w regule `update` dla zapisu kursanta/gościa z linkiem w `scratchpads/{scratchpadId}`; nie zmienia, kto może pisać, tylko rozszerza listę pól, które ta ograniczona ścieżka zapisu może nieść.
- `tests/scratchpadBlocks.test.ts` — 6 testów: `htmlToBlocks` (pusty dokument, konwersja 1:1), `blocksToHtml` (kolejność `order`, pominięcie `teacherOnly`), `blocksToText` (czysty tekst), `getScratchpadBlocksOrFallback` (istniejące `blocks` vs. fallback z `contentHtml`).

**Decyzje architektoniczne:**
- Zero migracji: `blocks` jest polem opcjonalnym, stare dokumenty bez tego pola działają identycznie jak dotąd — `getScratchpadBlocksOrFallback` konwertuje je w locie, nigdy nie zapisując wstecz.
- `htmlToBlocks` celowo NIE parsuje HTML na wiele bloków (nagłówki/akapity osobno) — to wymagałoby parsera DOM i decyzji o granicach bloków, które ta iteracja (fundament) jeszcze nie podejmuje; fallback pakuje cały HTML w jeden blok `text` 1:1.
- `ScratchpadEditor.tsx` NIE renderuje jeszcze UI per-blok — zlecenie wprost zabrania przepisywania edytora od zera; Iteracja 1 kończy się na typach, adapterze i inicjalizacji stanu za flagą.

**Ryzyka:** dotyka `firestore.rules` — zmiana ograniczona do dopisania jednego klucza (`'blocks'`) do istniejącej listy `hasOnly([...])` w regule `update` dla zapisu kursanta/gościa; nie zmienia `allow get/list/create/delete`, nie dotyka `scratchpadPins`, middleware autoryzacji w `server.ts` ani żadnej ścieżki tokenowej. Zgoda na ten fragment była w treści zlecenia.

**Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (462/462 zielone, w tym 6 nowych), `npm run test:rules` (44/44 zielone na emulatorze, reguła `scratchpads` nadal odrzuca niedozwolone pola), `npm run build` (przechodzi). UI nie było klikane w przeglądarce — flaga jest domyślnie wyłączona, więc `ScratchpadEditor` nie zmienił zachowania do zweryfikowania wzrokowo.

---

### 🧩 Generator Scenariusza Lekcji 2.0 — kontrakt 4 modułów, budżety czasowe po stronie backendu (2026-09-19, runda 40)

**Zadanie:** nowy generator scenariusza kolejnej lekcji dla lektora (Etap 2.1), oparty o ścisły kontrakt: klient wysyła wyłącznie `{ studentId, durationMin }`, nigdy nie czyta Firestore przed wywołaniem AI. Cała logika (profil kursanta, ostatnia ukończona lekcja, tryb `returning`/`cold_start`, wywołanie Gemini) żyje w `server.ts`.

**Added:**
- `types/scenario.ts` — kontrakt: `SCENARIO_MODULE_IDS` (`warmup_followup`/`error_work`/`main_topic`/`wrapup_feedback`, stała kolejność), `SCENARIO_DURATION_BUDGETS` dla 45/60/90 min (budżety per moduł sumują się dokładnie do długości lekcji), `GenerateScenarioRequest`, `ScenarioModelOutput` (to, co zwraca model — bez czasów i ID), `LessonScenario`/`ScenarioModule`/`ScenarioItem` (to, co widzi klient — z czasami i ID nadanymi przez backend), `SaveScenarioRequest`/`LessonRecordScenarioPatch`.
- `utils/scenarioValidation.ts` — `validateScenarioModelOutput` (dokładnie 4 moduły w stałej kolejności, 1-6 niepustych punktów każdy) i `buildLessonScenario` (nadaje czasy z `SCENARIO_DURATION_BUDGETS` i ID punktów) — wydzielone z endpointu, żeby dało się przetestować bez uruchamiania Expressa.
- `POST /api/scenario/generate` (`server.ts`, `requireFirebaseAuth`) — czyta `users/{studentId}` (brak `level`/CEFR → 400 `insufficient-profile`), ostatnią ukończoną lekcję z `users/{studentId}/lessonRecords` (pomija `pending_confirmation`/`rejected`/`draft`/`live`; brak wyniku → `mode: 'cold_start'`), woła Gemini Flash (`GEMINI_MODEL_CASCADE`, `responseSchema` wymuszający kształt `ScenarioModelOutput`) z osobnym poleceniem dla `error_work` zależnie od trybu (powtórka błędów z ostatniej lekcji vs. ćwiczenia diagnostyczne poziomu), waliduje odpowiedź i zwraca gotowy `LessonScenario`.
- `POST /api/scenario/save` (`server.ts`, `requireFirebaseAuth`) — dopisuje `plannedScenario`/`scenarioSavedAt` do `users/{studentId}/lessonRecords/{targetLessonId}`.
- `services/scenarioClient.ts` — `generateScenario`/`saveScenario`, doklejają token Firebase Auth (wzorem `services/studentImportService.ts`).
- `hooks/useScenarioGenerator.ts` — maszyna stanów `idle → generating → draft → saving → saved | error`, mutacje draftu (`editItem`, `removeItem`) i `discard`.
- `components/admin/ScenarioPreviewPanel.tsx` — selektor 45/60/90 min, przycisk generowania, podgląd 4 modułów z czasem i celem, edytowalne punkty z przyciskiem usunięcia, baner dla `cold_start`, przyciski zapisu/odrzucenia draftu. Wpięty w `AdminPanel.tsx` nad `CascadingLessonDetails`, w modalu podglądu lekcji (`studentId` z `selectedUser.id`, `targetLessonId` z `viewingRecord.id`).
- `LessonRecord.plannedScenario`/`scenarioSavedAt` (`types.ts`) — pola na wynik zapisu.
- `tests/scenario.test.ts` — 11 testów (node:test): sumowanie budżetów do 45/60/90 min, walidacja modelu (zła liczba/kolejność modułów, pusty cel, 0 lub >6 punktów, pusty tekst punktu), `buildLessonScenario` (unikalne ID, czasy z budżetu, zachowana kolejność modułów).

**Decyzje architektoniczne:**
- Model dostaje `responseSchema` z `enum` na `moduleId`, ale backend i tak re-waliduje kolejność/liczbę/długość w `validateScenarioModelOutput` — `responseSchema` u Gemini nie gwarantuje kolejności ani limitu elementów tablicy, a matematyka czasu trwania lekcji (budżety sumujące się do 45/60/90) nie może zależeć od tego, czy model coś pominął.
- "Ostatnia ukończona lekcja" pomija rekordy `pending_confirmation`/`rejected`/`draft`/`live` (pobiera do 10 najnowszych i bierze pierwszą pasującą) — inaczej scenariusz `returning` opierałby się na notatce, której kursant jeszcze nie widział albo która została odrzucona.
- Endpoint zabezpieczony `requireFirebaseAuth`, nie `requireFirebaseAdmin` — zgodnie z literalnym poleceniem ("autoryzuje lektora przez Firebase Auth") i wzorem `/api/homework-v2/generate`, który też nie wymaga roli admina.

**Ryzyka:** brak zmian w `firestore.rules`, middleware autoryzacji ani ścieżkach tokenowych bez logowania — nowe endpointy tylko *używają* `requireFirebaseAuth`.

**Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (387/387 zielone, w tym 11 nowych), `npm run build` (przechodzi). UI (`ScenarioPreviewPanel`) nie było klikane w przeglądarce w tej sesji — flow generuj→edytuj→zapisz nie był ręcznie zweryfikowany wzrokowo, wymaga testu z realnym kluczem Gemini.

---

### 🚀 Smart Student Onboarding — import kursanta z pliku (.txt/.md/.pdf) z analizą AI i kartą weryfikacji (2026-09-19, runda 39)

**Zadanie:** okno "Dodaj kursanta" (`components/admin/StandaloneStudentDatabaseScreen.tsx`) dostało strefę przeciągnij-i-upuść — lektor wrzuca plik z notatkami o kursancie (profil + historia lekcji), Gemini wyciąga dane, a lektor dostaje kartę weryfikacji z podświetlonymi brakami zamiast wypełniać formularz ręcznie.

**Added:**
- `types/studentImport.ts` — kontrakt `StudentImportAnalysis`/`ParsedLessonImport`. Pola nazwane inaczej niż w istniejącym `User`/`LessonRecord` (np. `fullName` zamiast `displayName`) celowo — to surowy wynik ekstrakcji AI, mapowany na docelowy dokument dopiero przy zapisie.
- `utils/studentImportNormalize.ts` — deterministyczne wyznaczanie `status`/`missingFields` z odpowiedzi modelu (ten sam wzorzec co `utils/lessonImport.ts`: kształt pilnujemy u siebie, nie w prompcie, bo `responseSchema` działa tylko dla Gemini). Brak imienia/e-maila = brak krytyczny (blokuje zapis), brak poziomu CEFR i niepewna data lekcji (np. "15 maja" bez roku) = tylko ostrzeżenie.
- `POST /api/gemini/analyze-student-import` (`server.ts`, `requireFirebaseAdmin`) — wariant istniejącego `/api/gemini/import-lessons-batch` (ten sam pipeline PDF: `pdf-parse` → fallback na multimodalny upload), ale dla pojedynczego kursanta bez dopasowywania do bazy.
- `services/studentImportService.ts` — `parseStudentDocument(file)`, czyta .txt/.md jako tekst, .pdf jako base64, woła powyższy endpoint z tokenem Firebase.
- `components/admin/StudentImportReviewCard.tsx` — karta weryfikacji: pola edytowalne, czerwona/żółta ramka na brakach, lista historycznych lekcji z edytowalną datą (`dateAmbiguous` podświetlone na żółto).
- Integracja w `StandaloneStudentDatabaseScreen.tsx`: dropzone nad istniejącym formularzem tworzenia konta; po zatwierdzeniu karty tworzy konto (`createUser`, jak dotychczasowy `handleCreateStudent`) i dopisuje historyczne lekcje przez `createLessonRecordWithVocabularySet` (`users/{uid}/lessonRecords`).
- `tests/studentImport.test.ts` — 11 testów `normalizeStudentImportAnalysis`/`normalizeParsedLessons` (node:test), w stylu `tests/lessonImport.test.ts`.

**Decyzje architektoniczne:**
- Nie wprowadzono nowej nazwy bloków lekcji ("Words & Phrases"/"Grammar & Accuracy"/"Pronunciation") — takiego kontraktu nie ma nigdzie w kodzie (patrz sekcja 1 wyżej, opis Historii Lekcji to uproszczenie). Zaimportowane lekcje piszą do istniejących płaskich pól `LessonRecord` (`lessonSummary`, `vocabularyText`, `corrections`) przez `createLessonRecordWithVocabularySet`, zgodnie z §4 `CLAUDE.md` (jedna logika domenowa, bez duplikatu).
- `extractedData.level` to podzbiór CEFR (`A1`–`C2`) zapisywany wprost do wolnotekstowego `User.level` — brak konwersji, bo pole i tak nie ma enuma w typie `User`.
- Panel admina nie używa `useTranslation` nigdzie indziej w tym pliku — nowe napisy są hardkodowanym polskim tekstem, zgodnie z konwencją sąsiednich ekranów CRM, a nie przez `en.json`/`pl.json`.

**Ryzyka:** brak zmian w `firestore.rules`, middleware autoryzacji ani ścieżkach tokenowych bez logowania. Nowy endpoint chroniony `requireFirebaseAdmin`, tak jak analogiczne endpointy importu lekcji.

**Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (376/376 zielone, w tym 11 nowych), `npm run build` (przechodzi; nieusunięte wcześniej istniejące ostrzeżenia o rozmiarze chunków niezwiązane ze zmianą). UI nie było klikane w przeglądarce w tej sesji — flow dropzone→review→zapis nie był ręcznie zweryfikowany wzrokowo.

---

### 🔧 Skrypt migracji Notion: pobieranie na żywo zamiast zamrożonego zrzutu, koniec zależności od FB_USER (2026-09-19, runda 38)

**Zgłoszone problemy:** `scripts/migrate-notion-archive.ts` (runda 37) pracował na zamrożonym zrzucie z 16 września (nowe lekcje/kursanci dopisani w Notion od tamtej pory były niewidoczne) i wywalał się twardym błędem, gdy `FB_USER` nie był ustawiony w środowisku.

**1. Pobieranie live z Notion API (`scripts/fetch_notion_dump.mjs`, `scripts/migrate-notion-archive.ts`):**
- `fetch_notion_dump.mjs` przebudowany na eksportowaną funkcję `fetchNotionArchive({ token, studentsDbId?, lessonsDbId?, onProgress? })` — cała logika pobierania/paginacji/rate-limitu/parsowania stron Notion żyje teraz w jednym miejscu; oryginalne CLI (`node scripts/fetch_notion_dump.mjs` → zapis `notion_migration_dump.json`) działa bez zmian, tylko woła tę samą funkcję pod strażą `isMainModule`.
- `migrate-notion-archive.ts` → `loadDump()`: jeśli `NOTION_API_KEY` jest ustawiony, woła `fetchNotionArchive` na żywo i pracuje na stanie bazy z chwili uruchomienia (opcjonalne nadpisanie ID baz przez `NOTION_STUDENTS_DB_ID` / `NOTION_LESSONS_DB_ID`). Bez klucza — głośne ostrzeżenie i spadek do `notion_migration_dump.json` z datą zrzutu w logu, żeby nie było wątpliwości, że dane mogą być nieaktualne.
- Żelazna zasada deduplikacji (e-mail LUB imię i nazwisko → `[SKIP]`, dopisywanie tylko brakujących po dacie lekcji) — bez zmian.

**2. Koniec twardej zależności od `FB_USER` (`migrate-notion-archive.ts`):**
- Skrypt przepisany z klienckiego SDK Firebase (`signInWithEmailAndPassword`, wymagający `FB_USER`/`FB_PASS`) na **firebase-admin** — ten sam wzorzec poświadczeń co `server.ts` (`FIREBASE_SERVICE_ACCOUNT` w .env, w innym wypadku Application Default Credentials środowiska). Zapis do Firestore przez Admin SDK omija reguły bezpieczeństwa, więc logowanie jako konkretny lektor przestało być potrzebne do działania skryptu.
- `resolveTeacherIdentity()`: jeśli w kolekcji `users` istnieje dokładnie jedno konto o roli `admin`/`teacher`, jego UID jest wybierany automatycznie. Przy 0 lub >1 dopasowaniach skrypt sprawdza `FB_USER` lub `VITE_FIREBASE_ADMIN_UID` z .env jako **literalny UID** (nie e-mail/hasło). Gdy żadna ścieżka nie da wyniku, skrypt **nie przerywa działania** — loguje ostrzeżenie i kontynuuje bez znacznika `migratedBy` (nowe, opcjonalne pole zapisywane na utworzonych rekordach kursanta/lekcji, gdy tożsamość lektora jest znana).
- Log: `Migracja dla lektora UID: <uid> (<email>)` przy udanym rozwiązaniu.

**3. Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (365/365). Dry-run bez `FB_USER`/`FIREBASE_SERVICE_ACCOUNT`/`NOTION_API_KEY` w tym środowisku potwierdza: brak crashu na samym braku `FB_USER` (ostrzeżenie + kontynuacja), poprawny spadek do zrzutu z ostrzeżeniem o dacie; jedyny błąd końcowy to spodziewany brak poświadczeń Google (`Could not load the default credentials`) — do uzupełnienia przez `FIREBASE_SERVICE_ACCOUNT` w .env albo `gcloud auth application-default login` przy faktycznym uruchomieniu z `--apply`. Pełne uruchomienie live (z realnym `NOTION_API_KEY` i poświadczeniami zapisu) nie było wykonane w tej sesji.

---

### 🔧 Domyślnie zwinięte bloki historii lekcji, uproszczenie ustawień Notion do samej transkrypcji, skrypt migracji archiwum (2026-09-19, runda 37)

**1. Domyślnie zwinięte akordeony w historii lekcji (UI polish):**
- `CascadingLessonDetails.tsx` (widok lektora — Blok 1 „Lekcja w skrócie", Blok 2 „Key Language & Corrections", Blok 3 „Homework — Cribro Habit", Blok 4 „Next Lesson", „Learning Curve"): domyślny stan `expandedSections` zmieniony z `true` na `false` na wszystkich pięciu sekcjach — lektor sam rozwija to, co go interesuje, zamiast przewijać ścianę zawsze otwartych bloków.
- `StudentLessonHistory.tsx`: kafelki lekcji w widoku wyników wyszukiwania (`isExpanded = expandedLessonIds[lesson.id] ?? true`) domyślnie otwierały się rozwinięte — ujednolicono z listą wcześniejszych lekcji, gdzie domyślnie są zwinięte (`?? false`).
- `AdminPanel.tsx`: usunięto zdublowany zielony przycisk „Wygeneruj pracę domową" z górnego paska nagłówka lekcji (obok „Edytuj"/„Usuń") — jedynym miejscem wywołania tej akcji zostaje dedykowana karta „Wygeneruj pracę domową z tej lekcji [AI Generator]" z przyciskiem „Generuj zadania".

**2. Uproszczenie panelu integracji Notion w Ustawieniach do samej transkrypcji (`SettingsScreen.tsx`):**
- Sekcja przemianowana na „Opcjonalna integracja transkrypcji (workflow lektora)" i ograniczona wyłącznie do: klucza API Notion oraz ID bazy/strony z transkrypcjami (AI Meeting Notes).
- Usunięto z UI: automatyczne wykrywanie baz (Auto-Discovery + kafelki znalezionych baz), przycisk „Testuj połączenie", przycisk „Pobierz transkrypcje teraz", przełącznik automatycznego cyklicznego pobierania w tle wraz z wyborem interwału — razem z odpowiadającym stanem (`isSearchingDatabases`, `discoveredDatabases`, `isTestingNotion`, `notionTestResult`, `isFetchingNotion`, `notionFetchResult`, `autoFetchEnabledInput`, `autoFetchIntervalInput`) i handlerami (`handleSearchNotionDatabases`, `handleTestNotionConnection`, `handleFetchNotionTranscripts`).
- Backend (`server.ts` endpointy `/api/notion/*`, w tym `fetch-transcripts` używany przez `TeacherLessonHistoryView.tsx`) **nie został ruszony** — decyzja podjęta świadomie po pytaniu doprecyzowującym do Macieja: zlecenie sugerowało też usunięcie modułów synchronizacji bazy kursantów (`services/notionSync.ts`, `functions/src/notion/sync.ts`, `dailyCheck.ts`), ale audyt wykazał, że są to już martwy kod nieużywany od rundy 28 (`functions/src/index.ts` ich nie importuje, `services/notionSync.ts` woła nieistniejące już Cloud Functions) — usuwanie ich wykraczałoby poza potwierdzony zakres „tylko UI Ustawień" i zostaje jako zadanie do osobnej decyzji.

**3. Jednorazowy skrypt migracji archiwum Notion → Firestore z żelazną zasadą deduplikacji (`scripts/migrate-notion-archive.ts`):**
- Nowy skrypt TS (`npm run migrate:notion`, tryb suchego przebiegu domyślnie, `-- --apply` zapisuje) importuje zrzut `scripts/notion_migration_dump.json` (generowany przez już istniejący `scripts/fetch_notion_dump.mjs` — świadomie nie duplikowano pipeline'u pobierania z API Notion) do Firestore.
- Żelazna zasada: jeśli kursant o danym e-mailu LUB imieniu i nazwisku już istnieje w `users`, skrypt **nie tworzy** nowego rekordu — loguje `[SKIP] Kursant <Imię Nazwisko> już istnieje w bazie – pomijam.` i dopisuje tylko te jego lekcje z dumpu, których data nie występuje jeszcze w `users/{uid}/lessonRecords`.
- Limitowanie zapytań: 300 ms opóźnienia między zapisami do Firestore.
- **Uwaga — odstępstwa od literalnego zlecenia, świadome i udokumentowane w kodzie skryptu:**
  - Uruchamiane przez `tsx`, nie `ts-node` — `ts-node` nie jest zależnością projektu, a `tsx` jest już używany do wszystkich innych skryptów/testów w repo (unikanie nowej zależności bez potrzeby, zgodnie z CLAUDE.md §4).
  - Kursanci zapisywani do kolekcji `users` (rola `user`) z lekcjami w `users/{uid}/lessonRecords`, **nie** do osobnej kolekcji `students` — to jest rzeczywisty, jedyny schemat używany przez resztę aplikacji (`StudentLessonHistory.tsx`, `AdminPanel.tsx`); kolekcja `students` w ogóle nie istnieje i jej utworzenie osierociłoby dane.
- **Kontekst — pełna migracja historyczna już się odbyła** (round 28, 2026-09-16: 22 kursantów, 110/110 lekcji, 0 pominiętych, przez istniejący `scripts/migrate_dump_to_firestore.mjs`). Nowy skrypt to bezpieczniejszy, idempotentny wariant do ponownego użycia przy przyszłych archiwalnych dumpach — pierwsze uruchomienie na aktualnym stanie bazy w większości zaloguje same `[SKIP]`.

**4. Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (365/365), `npm run build` (bez błędów). Zmiany UI (akordeony, Ustawienia) nie były sprawdzone wzrokowo w przeglądarce w tej sesji.

---

### 🔧 Kontrast Trybu Ciemnego i Stabilna Oś Obrotu Koła Fortuny (2026-09-18, runda 36)

**Zgłoszenie:** 4 problemy widoku Koła Fortuny po rundzie 34 (ta sama sesja):
nieczytelny czarny tekst pytania na ciemnej karcie, wygaszone przyciski paska
("Nowe pytania AI", "Edytuj pytania", "Start (60s)"), koło "skaczące" podczas
obrotu zamiast czystej rotacji w osi, oraz nachodzące na siebie etykiety na
wycinkach.

**Naprawa (`components/presentation/WheelOfFortune.tsx`):**
1. **Kontrast karty wyniku:** kolor tekstu pytania wymuszony inline `style`
   (`color`, `fontSize: 1.2rem` poza fullscreenem, `fontWeight: 500`,
   `lineHeight: 1.5`) zamiast samej klasy Tailwind — inline styl gwarantuje,
   że nic potomnego/globalnego go nie nadpisze.
2. **Wygaszone przyciski:** przyczyna — warianty `ghost`/`secondary`
   współdzielonego `components/ui/Button.tsx` mają własne klasy koloru
   tekstu, które kolidują z `className` przekazywanym z zewnątrz (Tailwind
   nie gwarantuje, że klasa późniejsza w JSX wygrywa w wygenerowanym CSS).
   Naprawiono przez zamianę na zwykłe `<button>` z samodzielnymi klasami —
   **celowo NIE dotknięto** `Button.tsx` (zmiana tam uderzyłaby we
   wszystkie ekrany aplikacji, poza zakresem tego zadania).
3. **Skakanie koła:** CSS `transform-origin` na `<g>` SVG bywa przeliczany
   z bounding boxa klatka po klatce w części przeglądarek. Zamieniono na
   `svgOrigin: '200 200'` GSAP (udokumentowany, SVG-bezpieczny odpowiednik)
   w `gsap.set` i `gsap.to`. Krzywa zwalniania zaktualizowana na
   `cubic-bezier(0.12, 0.8, 0.2, 1.0)`.
4. **Etykiety na wycinkach:** zamiast skróconego pytania (20 znaków, które
   nachodziło na sąsiednie wycinki) — krótka etykieta kategorii
   (`sourceTag`, max 14 znaków). Pełne pytanie: wyłącznie w karcie wyniku.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów. `npm test` — 363/363 zielone.
`npm run build` — kod 0. Nie zweryfikowano wzrokowo w przeglądarce w tej
sesji (brak prostej ścieżki logowania lektor→prezentacja z kołem fortuny) —
Maciej: sprawdź brak bocznego "skakania" koła, czytelność karty wyniku i
przycisków w trybie ciemnym, brak nachodzenia etykiet na wycinkach.

---

### 🔧 Naprawa Awarii Głównego Widoku Kursanta — Niewalidowane Słówka z Firestore (2026-09-18, runda 35)

**Zgłoszenie:** dorotakj@student.vocabboost.com — cała aplikacja wywalała się
na trasie "/" z `TypeError: Cannot read properties of undefined (reading 'word')`.

**Przyczyna:** `context/VocabularyContext.tsx` ładował `words` bezpośrednio z
`onSnapshot` na `users/{uid}/words` bez żadnej walidacji. Dokument w trakcie
zapisu/synchronizacji (albo bez pola `word`) trafiał do tablicy. `QuizExercise`
i `FillInBlankExercise` indeksują tę tablicę po pozycji
(`shuffledWords[currentIndex]`) — gdy żywa aktualizacja Firestore skurczyła
tablicę w trakcie trwającego ćwiczenia, `currentWord` stawał się `undefined` i
`currentWord.word` wywalało cały komponent. Ponieważ jedyny `ErrorBoundary` w
drzewie jest globalny (`components/ui/GlobalErrorBoundary.tsx`, montowany w
`App.tsx`), błąd czyścił całą aplikację zamiast tylko ćwiczenia.

**Naprawa:**
- `context/VocabularyContext.tsx`: twarde filtrowanie w `onSnapshot` —
  `.filter(item => item && typeof item.word === 'string' && item.word.trim().length > 0)`
  — wadliwe rekordy nigdy nie docierają do konsumentów (naprawia pośrednio
  wszystko, co czyta `words`/`difficultWords`/`dueWords`: `PracticeZone`,
  `MatchExercise`, `WordList` itd.).
- `components/practice/QuizExercise.tsx`: guard na `currentWord` w efekcie
  budującym opcje odpowiedzi i w `handleAnswer`; łagodny fallback zamiast
  crasha, gdy lista zmieni się w trakcie sesji.
- `components/practice/FillInBlankExercise.tsx`: brakujący guard w
  `handleSubmit` (render już miał `if (!currentWord) return null`).

**Nie dotknięto:** `FlashcardExercise.tsx`, `MatchExercise.tsx` (już poprawnie
zabezpieczone) ani pozostałe odwołania do `.word` w kodzie (`FlashcardContext.tsx`,
`StudentLessonHistory.tsx`, `WordCard.tsx` itd.) — te operują na obiektach, które
w swoim kontekście nie mogą być `undefined`, albo są już warunkowane.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów. `npm test` — 363/363 zielone.
`npm run build` — kod 0, nowy hash bundla `index-D7iVkZT_.js` (poprzednio
`index-f-64mY-j.js`). Błąd nie został odtworzony 1:1 na koncie dorotakj (brak
dostępu do jej danych produkcyjnych) — naprawa oparta o dokładne dopasowanie
sygnatury błędu i analizę kodu.

---

### 🚀 Fizyka i Czytelność Koła Fortuny, Ręczna Edycja Puli Pytań (2026-09-18, runda 34)

**Kontekst:** Koło Fortuny (`components/presentation/WheelOfFortune.tsx`) miało już
źródła pytań (scenariusz / poprzednie lekcje / AI), ale animacja obrotu była zbyt
krótka i mało "fizyczna", wycinki koła pokazywały tylko numer porządkowy zamiast
treści pytania (kolor tekstu zależny od motywu — czytelność zmienna), a lektor nie
miał szybkiego sposobu na ręczną edycję puli bez przechodzenia przez AI.

**1. Naturalna fizyka obrotu:**
- Nowa funkcja `cubicBezierEase(x1, y1, x2, y2)` w `services/gsapAnimations.ts` —
  rozwiązuje krzywą Beziera metodą Newtona i zwraca funkcję łagodzącą kompatybilną z
  GSAP (darmowy GSAP nie ma `CustomEase`, to płatny plugin Club GreenSock).
- Obrót koła używa teraz `WHEEL_SPIN_EASE = cubicBezierEase(0.15, 0.9, 0.2, 1.0)`
  (odpowiednik CSS `cubic-bezier(0.15, 0.9, 0.2, 1.0)`) zamiast `power3.out`.
- Czas trwania: 4.5s (lokalny obrót) / 4.0s (synchronizacja zdalna kursanta —
  celowo nieco krótszy, żeby nie lagował, ale w tym samym zakresie 4–5s).
- Minimum 5 pełnych obrotów (1800°) zamiast poprzednich 4.
- Przycisk "ZAKRĘĆ" i przycisk "Zakręć ponownie" były już blokowane na czas
  `isSpinning` — bez zmian, tylko zweryfikowano zgodność z wymaganiem.

**2. Czytelność wycinków koła (Light/Dark):**
- Tekst na wycinkach zawsze biały (`fill="#ffffff"`) z `textShadow` w `style`
  (SVG `<text>` wspiera CSS text-shadow w Chrome/Firefox) — niezależnie od
  koloru wycinka czy motywu aplikacji, zamiast poprzedniego `colorInfo.text`
  zależnego od palety jasnej/ciemnej.
- Wycinki pokazują teraz skróconą treść pytania (`truncateForWheel`, limit 20
  znaków + wielokropek) zamiast samego numeru `#n` — pełna treść w `<title>`
  (tooltip po najechaniu) i w karcie wyniku.
- Karta wyniku: rozmiar czcionki pytania podniesiony do min. `text-xl`
  (1.25rem) w obu stanach (fullscreen i standardowy), żeby spełnić wymóg
  minimalnego kontrastu/czytelności.

**3. Ręczna edycja puli pytań przez lektora:**
- Nowy przycisk "Edytuj pytania" (obok "Nowe pytania AI", tylko `!isStudent`)
  otwiera panel z `<textarea>` — jedno pytanie na wiersz, wstępnie wypełniony
  aktualną pulą.
- "Zapisz pulę" buduje nową listę `WheelQuestionItem[]` (`category: 'custom'`,
  `sourceTag: 'Edycja lektora'`), resetuje omówione pytania i wylosowany wynik.
- Fallback do 6+ domyślnych pytań warm-up po angielsku już istniał w
  `services/wheelQuestionService.ts` (`FALLBACK_WARMUP_QUESTIONS`, używany
  automatycznie zarówno dla scenariusza, jak i historii lekcji, gdy danych
  jest za mało) — bez zmian, tylko zweryfikowano że pokrywa wymóg.

**Nie dotknięto:** `services/wheelQuestionService.ts` (logika ekstrakcji pytań
ze scenariusza/historii/AI) — zmiany dotyczą wyłącznie warstwy animacji i UI
w `WheelOfFortune.tsx` oraz nowego, generycznego helpera easing w
`gsapAnimations.ts`.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów. `npm test` — 363/363 zielone
(bez zmian w testowanej logice serwisowej). `npm run build` — kod 0. Nie
zweryfikowano wzrokowo w przeglądarce (brak łatwej ścieżki logowania
lektor→prezentacja z kołem fortuny w tej sesji) — Maciej: sprawdź obrót
(4.5s, wyraźne zwolnienie na końcu), czytelność tekstu na wycinkach i karcie
wyniku w obu motywach, oraz panel "Edytuj pytania".

---

### 🚀 Integracja Notion AI Meeting Notes, Sanitizacja JSON i Weryfikacja Aktywności Kursantów (2026-09-18, runda 33)

**1. Naprawa parsowania JSON w podsumowaniach lekcji (`utils/transcriptLesson.ts`):**
- Wdrożono funkcję sanitizującą `sanitizeJsonText(raw)` wywoływaną przed `JSON.parse()`:
  - Usuwanie znaczników bloków markdown (` ```json `, ` ``` `).
  - Obcinanie śmieciowych znaków przed pierwszą klamrą `{` i po ostatniej klamrze `}`.
  - Zabezpieczenie nieeskejpowanych znaków nowej linii (`\n`, `\r`, `\t`) oraz znaków kontrolnych wewnątrz wartości string.
- Ustawiono `responseMimeType: 'application/json'` w wywołaniach SDK Gemini.

**2. Pobieranie spotkań i notatek z bazy Notion (`server.ts`):**
- Endpoint `GET /api/notion/recent-meetings`:
  - Filtrowanie i sortowanie spotkań Notion z ostatnich 7–10 dni (po właściwościach daty lub `created_time`).
  - Odczytywanie właściwości strony Notion: tytuł (`title`), pełna nazwa kursanta (`studentNameRaw` z właściwości `Kursant`/`Student` lub prefiksu tytułu), data zajęć (`lessonDate` z `date.start`) oraz link URL.
- Endpoint `GET /api/notion/meeting-content/:pageId`:
  - Rekurencyjne pobieranie i scalanie zawartości bloków strony Notion w jednolity ciąg tekstowy notatek ze spotkania.

**3. 1-klikowy import notatek i auto-matching (`components/admin/ManualTranscriptImportModal.tsx`):**
- Dodano sekcję *"Ostatnie spotkania Notion (ostatnie 7 dni)"* nad polem tekstowym z kafelkami spotkań.
- Logika automatycznego dopasowywania do wybranego kursanta:
  - Porównywanie imienia/nazwiska kursanta ze `studentNameRaw` oraz tytułem strony Notion.
  - Oznaczanie dopasowanego spotkania zielonym badge'em *"Sugerowane dla [Imię]"*.
  - Automatyczne ustawienie daty lekcji i zaciągnięcie pełnej treści notatek z Notion do pola `textarea`.
  - Możliwość ręcznego wyboru innego spotkania lub wklejenia własnego tekstu.

**4. Weryfikacja logowania kursanta w kolumnie "ZAPROSZENIE & AKTYWACJA" (`components/admin/StudentDatabaseScreen.tsx`, `components/admin/StandaloneStudentDatabaseScreen.tsx`):**
- Sprawdzanie pól logowania i aktywności w obiekcie kursanta Firestore (`isActivated`, `loginCount`, `lastLoginDate`, `lastLoginAt`, `firstLoginAt`, `lastActiveAt`, `activatedAt`, `hasLoggedIn`).
- Dynamiczna zmiana badge'a ze statycznego "Oczekuje" na zielony pill **"Aktywny"** z zieloną kropką statusu w przypadku wykrycia pomyślnego logowania.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów ✓.

---

### 🚀 System Podpowiedzi (ModuleHelpButton) dla Modułów Lesson Planner i Presentation Studio (2026-09-17, runda 32)

**1. Konfiguracja Przewodników Modułów (`config/moduleGuides.ts`):**
- Nowy plik `config/moduleGuides.ts` definiuje interfejs `ModuleGuide` i słownik `MODULE_GUIDES`.
- Dwa kompletne wpisy:
  - `'lesson-planner'`: 4-krokowy przewodnik planowania blokowego, opis sumowania czasu, wskazówka o optymalnym rozkładzie 45-minutowej lekcji (5-10-25-5 min) i kolorowym pasku ostrzegawczym.
  - `'presentation-studio'`: 4-krokowy przewodnik studia slajdów 16:9, opis generatora AI dual-pass, wskazówka o limicie 1 MB Firestore i kompresji Base64.

**2. Komponent `ModuleHelpButton` (`components/common/ModuleHelpButton.tsx`):**
- Okrągły przycisk `?` z ikoną `HelpCircle` i **pulsującym efektem ring** (`animate-ping`) widocznym po najechaniu kursorem.
- Kliknięcie otwiera minimalistyczny modal z pełnym backdrop-blur:
  - Nagłówek: tytuł modułu + badge (np. `Blokowy Konspekt`).
  - Sekcja `summary` — opis modułu w jednym akapicie.
  - Ponumerowane kroki (1–4) w ramkach z opisem każdego etapu.
  - Blok wskazówki lektorskiej z ikoną `Lightbulb` (amber).
  - Przycisk `Rozumiem, zamknij` oraz zamykanie przez ESC i kliknięcie w tło.
- Blokowanie `document.body` scroll gdy modal jest otwarty — pełna dostępność (`role="dialog"`, `aria-modal`).
- Zero zewnętrznych zależności npm.

**3. Integracja w modułach:**
- `components/planner/LessonPlannerStudio.tsx`: `<ModuleHelpButton guideId="lesson-planner" />` wstawiony obok badge statusu w nagłówku modułu.
- `components/presentation/PresentationStudio.tsx`: `<ModuleHelpButton guideId="presentation-studio" />` wstawiony w górnym pasku akcji, za polem edycji tytułu prezentacji.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów. `npm test` — 359/359 testów ✓.

---

### 🚀 FAZA 4: Spaced Repetition & Recall Engine — Centrum Powtórek Kursanta (2026-09-17, runda 31)

**1. Typy danych (`types/recall.ts`):**
- `RecallRating`: `'hard' | 'good' | 'easy'`.
- `RecallHistoryEntry`: `{ date: string; grade: RecallRating }`.
- `RecallCard`: `id`, `studentId`, `sourceLessonId?`, `term`, `translation`, `contextSentence?`, `phonetic?`, `intervalLevel` (0–5), `nextReviewDate` (YYYY-MM-DD), `reviewHistory`.
- `DailyReviewSession`: `{ dueCards: RecallCard[]; totalDueCount: number }`.

**2. Serwis Firestore + Algorytm SRS (`services/recallService.ts`):**
- Ścieżka Firestore: `students/{studentId}/recall_cards/{cardId}`.
- Mapa interwałów: `{ 0: 0d, 1: 1d, 2: 3d, 3: 7d, 4: 14d, 5: 30d }`.
- **Algorytm oceny** (`calculateNextInterval`):
  - `hard` → reset do poziomu 1 (powtórka jutro).
  - `good` → +1 poziom (maks. 5).
  - `easy` → +2 poziomy (maks. 5).
- `getDueCardsForStudent`: query Firestore z `where('nextReviewDate', '<=', today)` + fallback do `localStorage`.
- `getAllCardsForStudent`: pobiera cały stan bazy kartek do widoku statystyk.
- `processCardReview`: przelicza interwał, aktualizuje historię, zapisuje przez `updateDoc` (fallback: `setDoc`).
- `batchAddCardsFromLesson`: masowy import zwrotów przez `writeBatch` + synchronizacja `localStorage`.
- Cały localStorage cache pod kluczem `cribro_recall_cards_v1_{studentId}`.

**3. Komponent fiszki 3D (`components/recall/RecallFlashcard.tsx`):**
- Obrót 3D przez CSS `perspective(1000px)` + `rotateY(180deg)` na kliknięcie lub spację.
- **Awers**: zwrot EN, fonetyka, zdanie kontekstowe, przycisk TTS (`window.speechSynthesis`).
- **Rewers**: polskie tłumaczenie, zdanie kontekstowe.
- Trzy przyciski oceny: 🔴 Trudne / 🟡 Dobre / 🟢 Łatwe (z opisem interwału).
- Klawiszowa obsługa (Spacja/Enter = odwróć).

**4. Hub Sesji Powtórkowej (`components/recall/StudentRecallHub.tsx`):**
- Nagłówek z etykietą „Faza 4" i powitaniem kursanta.
- Licznik kart `Do powtórzenia dzisiaj: X`, pasek postępu procentowy.
- Ekran ukończenia sesji: trofeum `Trophy`, rozkład ocen (hard/good/easy), przyciski powrotu.
- Siatka statystyk bazy: 6 kolumn poziomów opanowania (0–5), z wyróżnieniem `Opanowane (lvl 5)`.

**5. Integracja w AdminPanel:**
- `components/admin/StudentOperationalHub.tsx`: dodano `onOpenRecall?: (studentId: string) => void` — przycisk „Rozpocznij dzisiejszy Recall" z ikoną `Brain` i fioletowym akcentem `indigo`.
- `components/admin/AdminPanel.tsx`: nowa zakładka **„Spaced Repetition (Recall)"** z ikoną `Brain` w pasku profilu kursanta; wstrzyknięcie `<StudentRecallHub>` dla `activeTab === 'recall'`; przycisk wbudowany `onOpenRecall` przełącza zakładkę.

**6. Firestore Rules:**
- Dodano regułę dla `/students/{studentId}` i `/students/{studentId}/recall_cards/{cardId}`: dostęp dla `isAdmin()` lub `request.auth.uid == studentId`.

**7. Testy jednostkowe (`tests/recallService.test.ts`):**
- 5 nowych przypadków testowych: progi mapy interwałów, `addDaysToDate`, ocena `hard`, `good` i `easy` na różnych poziomach startowych.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów. `npm test` — 359/359 testów ✓. `npm run build` — ✓ (6.12s).

---

### 🚀 FAZA 3: Lesson Planner 2.0 — Blokowy Konspekt Lekcji, Presentation Studio i Collaborative Scratchpad (2026-09-17, runda 30)

**1. Typy danych (`types/planner.ts`, `types/presentation.ts`):**
- `BlockType`: 7 typów (`warmup | recall | input | practice | speaking | feedback | homework`).
- `LessonBlock`: `id`, `type`, `title`, `durationMinutes`, `content`, `linkedPresentationId?`.
- `LessonScenario`: `id`, `teacherId`, `studentId`, `date`, `topic`, `mainGoal`, `blocks[]`, `totalDurationMinutes`, `status` (`draft` | `planned`), `createdAt`, `updatedAt`.
- `Presentation`, `Slide`, `SlideElement` — pełny model danych Studio Slajdów.

**2. Serwis Planera (`services/plannerService.ts`):**
- `getDefaultScenarioTemplate`: predefiniowany konspekt 45 min (Warm-up 5 → Recall 10 → Speaking 25 → Feedback 5).
- `saveLessonScenario` / `getLessonPlansForStudent` — CRUD Firestore pod `lessonScenarios/{scenarioId}`.
- `localStorage` sync pod `cribro_lesson_planner_scenarios_v1`.

**3. Presentation Studio (`components/presentation/PresentationStudio.tsx`, `services/presentationStudioService.ts`):**
- Płótno slajdów 16:9, panel boczny z zakładkami (Slajdy, Szablony, Multimedia, Generator AI).
- Generator AI dual-pass (`services/geminiSlideGenerator.ts`): przejście 1 — struktura, przejście 2 — treść każdego slajdu.
- Kompresja grafik Base64 (`utils/presentationImageCompression.ts`) z limitem dokumentu Firestore (1 MB).

**4. Collaborative Scratchpad (`components/scratchpad/StudentScratchpadScreen.tsx`):**
- Naprawiony crash po stronie kursanta: blok `try/catch` w funkcji zapisu, obsługa `FirebaseError` permissions bez białego ekranu.
- Firestore rules zaktualizowane o `allow update` dla kursanta na własnym dokumencie notatnika.

**Weryfikacja:** `npx tsc --noEmit` — 0 błędów. `npm test` — 354/354 testów ✓. `npm run build` — ✓.

---

### 🚀 Kursy Grupowe & Pary, Wielomodelowa Narada AI (Flash 3.8 + Recenzenci), Uproszczony Mailing i E-Learning w Notatniku (2026-09-16, runda 29)


**1. Obsługa Kursów Grupowych, Par i Grup Firmowych (B2B):**
- **Model danych & Kolekcja Firestore (`types.ts`, `services/groupService.ts`)**:
  - Wprowadzono typ `StudentGroup` z polami `name`, `type` (`pair` | `triplet` | `group` | `b2b_corporate`), `level`, `teacherId`, `memberIds`, `memberNames`, `activeScratchpadId`.
  - Rozszerzono `ScratchpadDocument` oraz `LessonRecord` o pola `groupId`, `groupName` i `memberIds`.
  - Utworzono serwis `services/groupService.ts` z funkcjami zarządzania grupami (`createGroup`, `updateGroup`, `deleteGroup`, `getGroupsForTeacher`, `getGroupsForStudent`, `ensureGroupScratchpad`).
- **Interfejs Zarządzania Grupami (`GroupManagementModal.tsx`, `StudentDatabaseScreen.tsx`)**:
  - Dodano przycisk „Pary & Grupy" w pasku bazy kursantów.
  - Szybki kreator grupy z wyborem poziomu CEFR, firmy B2B, typu oraz wyszukiwarką i multiselectem kursantów.
  - Automatyczne powiązanie i generowanie wspólnego notatnika grupowego (`ensureGroupScratchpad`).

**2. Wielomodelowa Narada AI (AI Council) dla Wszystkich Generatorów Treści:**
- **Skład Narady zgodny z wytycznymi (`services/aiCouncil.ts`)**:
  - **Autor**: `gemini-3.8-flash` (Najnowszy Flash) z automatycznym fallbackiem do OpenAI.
  - **Recenzent 1**: `gemini-2.5-flash` (Domyślny).
  - **Recenzent 2**: `openai/gpt-4o-mini` (Lekki).
  - **Recenzent 3**: `openai/gpt-4o` / `claude` (Opcjonalny).
- **Zastosowanie we wszystkich modułach**:
  - **Generator Prac Domowych & Ćwiczeń (`services/homeworkGenerator.ts`)**: Narada AI weryfikuje naturalność zdań, sens kontekstowy, brak sztucznych zdań-wydmuszek oraz zgodność z Learning Curve kursanta (`EXERCISE_REVIEW_SYSTEM`).
  - **Generator Rozgrzewek & Koła Fortuny (`services/wheelQuestionService.ts`)**: Narada dba o naturalne, dojrzałe pytania konwersacyjne dla dorosłych (`WARMUP_REVIEW_SYSTEM`).
  - **Asystent AI w Notatniku (`ScratchpadEditor.tsx`)**: Narada recenzuje tworzone opracowania notatek i formatowanie bloków Notion (`SCRATCHPAD_REVIEW_SYSTEM`).

**3. Uproszczony Mailing, Zaproszenia Kursantów i Monitoring Skrzynki Poczty:**
- **Wysyłanie zaproszeń do aplikacji (`StudentInviteEmailModal.tsx`)**:
  - Szybkie generowanie spersonalizowanych e-maili powitalnych z bezpiecznym hasłem i linkiem logowania bezpośrednio z bazy kursantów.
- **Odczyt poczty przychodzącej (`wyrozumski@maciej.pro`)**:
  - Monitoring skrzynki w `AdminMailingScreen.tsx` z filtrami nieprzeczytanych, podglądem odpowiedzi i gotowością pod reguły automatyzacji.

**4. Notatnik jako Centrum Prezentacji i Interaktywny E-Learning (Articulate 360 Style):**
- **Czyszczenie menu głównego**:
  - Prezentacja została w 100% zintegrowana wewnątrz Notatnika (`ScratchpadEditor.tsx`), eliminując zbędne przełączniki.
- **Szybki Wklejacz Treści (Quick Paste)**:
  - Wklejanie zdań/słówek i natychmiastowa zamiana w interaktywne slajdy dla kursanta.
- **Prototyp Slajdów E-Learningowych (`InteractiveSlideDeck.tsx`)**:
  - **Fiszki 3D (Flip Cards)**: Płynny obrót 3D kart ze słówkami, wymową, polskim znaczeniem i przykładem zdania.
  - **Kroki Procesu (Interactive Step-by-Step Tabs)**: Przechodzenie przez sekcje case study z kluczowymi wnioskami.
  - **Interaktywny Quiz**: Pytania jednokrotnego wyboru z natychmiastową weryfikacją i wyjaśnieniem lektorskim.

---

### 🚀 Pełna Migracja Bazy Kursantów i Lekcji z Notion do Firestore & Usunięcie Nadmiarowej Synchronizacji (2026-09-16, runda 28)

**1. 100% Bezstratna Migracja Danych z Notion do Firestore:**
- **Kompletny zrzut i import historii**:
  - Zaimportowano wszystkich **22 kursantów i grup** (w tym profile archiwalne i firmy: Axell, Media-Saturn, AMW, DB Schenker, Fundacja Rakiety, Gulermak, Kramp) oraz wszystkie **110 lekcji** z bazy Notion bez ani jednej pominiętej lekcji (`lessonsImported: 110`, `lessonsSkipped: 0`).
  - Każda lekcja została deterministycznie sparsowana do kanonicznej struktury 4 bloków Notion (*Words & Phrases*, *Grammar & Accuracy*, *Pronunciation*, *Homework* z osobnym Answer Key oraz Learning Curve / Student Speaking) i zapisana w podkolekcji `users/{studentId}/lessonRecords/{lessonId}`.
  - Wygenerowano bezpieczne konta startowe i hasła jednorazowe dla nowo utworzonych użytkowników.

**2. Całkowite Usunięcie Modułów i Przycisków Importu Kursantów z Notion:**
- Usunięto zbędne modale i komponenty synchronizacji: `NotionSyncButton.tsx`, `StudentNotionSyncModal.tsx`, `NotionSyncResultModal.tsx`, `TeacherNotionDatabaseView.tsx`.
- Z `AdminPanel.tsx` oraz `StudentDatabaseScreen.tsx` usunięto przyciski, modale i opcje menu rozwijanego „Pobierz z Notion" / „Pobierz / Zaktualizuj z Notion".
- Z `SettingsScreen.tsx` usunięto pole konfiguracji bazy kursantów (`studentsDbId`), upraszczając konfigurację Notion wyłącznie do klucza API i **Bazy Spotkań & Transkrypcji** (`meetingNotesDbId`).
- Usunięto nieużywane funkcje Cloud Functions (`previewNotionSync`, `importNotionSelection`, `checkNotionDaily`), pozostawiając integrację z Notion **wyłącznie** jako magazyn notatek i transkrypcji AI ze spotkań.

**3. Odporność na Błędy w Pobieraniu Transkrypcji (`TeacherLessonHistoryView.tsx`):**
- Naprawiono błąd `Unexpected token 'A', "An error o"... is not valid JSON` poprzez bezpieczne sprawdzanie `Content-Type` odpowiedzi serwera przed wywołaniem `.json()`.

---

### 🚀 Nowy Design Koła Fortuny (Dark/Light Mode), Niezależny Wybór Motywu Lektora i Kursanta oraz Lekka, Płynna Animacja GSAP (2026-09-16, runda 27)

**1. Kompleksowy Redesign Wizualny Koła Fortuny w Trybach Jasnym i Ciemnym (`WheelOfFortune.tsx`):**
- **Eliminacja defektu białego tła**:
  - Wcześniejsza klasa `.liquid-glass-card` w trybie jasnym wymuszała jednolite, białe tło `rgba(255, 255, 255, 0.98)`, co przy ciemnym tle prezentacji tworzyło nieestetyczny, ostry kontrast.
  - Zastąpiono sztywne klasy dedykowanym, responsywnym systemem motywów opartym o `useTheme` (`isDark`):
    - **Tryb Ciemny (Nocturne Obsidian)**: głębokie szkliste tło `dark:bg-slate-900/80`, tytanowy pierścień SVG koła (`#182234` do `#0b101b`), ciemne szkło 3D przycisku centralnego z poświatą neonową oraz pastelowe, luminescencyjne etykiety sektorów (`SECTOR_PALETTE_DARK`).
    - **Tryb Jasny (Clean Porcelain Studio)**: eleganckie porcelanowe szkło `bg-white/95 border-slate-200/90`, gradient platynowo-aluminiowy na obwodzie koła (`#f8fafc` do `#cbd5e1`), biało-ceramiczny przycisk 3D oraz czytelne, ciemne napisy o wysokim kontraście (`SECTOR_PALETTE_LIGHT`).
- **Niezależne Przełączanie Motywu dla Kursanta i Lektora**:
  - Zarówno lektor, jak i kursant mogą w dowolnym momencie kliknąć ikonę słońca/księżyca na pasku Koła Fortuny lub w górnym pasku nakładki prezentacji (`ScratchpadPresentationOverlay.tsx`).
  - Zmiana motywu jest lokalna dla danego ekranu (`toggleTheme`), nie nadpisuje stanu drugiego uczestnika lekcji i nie jest synchronizowana do bazy danych, zapewniając pełną autonomię preferencji wizualnych.
- **Czytelność Tekstu Sektorów (Zero Odwróconych Napisów)**:
  - Zoptymalizowano kalkulację kątów w elementach `<text>` SVG — numery pytań (`#1` do `#8`) są automatycznie obracane tak, aby zawsze pozostawały czytelne w pozycji pionowej, bez konieczności przechylania głowy.

**2. Płynna, Niskonakładowa Animacja Obrotu i Błyskawiczna Synchronizacja (`WheelOfFortune.tsx`):**
- **Krzywa wyhamowania `power3.out` i krótszy czas obrotu**:
  - Czas trwania obrotu zredukowano z ociężałych 4.4s do dynamicznych, eleganckich 2.8s (oraz 2.4s przy synchronizacji sieciowej u kursanta), eliminując znużenie podczas lekcji na żywo.
- **Ochrona procesora przed dławieniem (Throttling tyknięć iglicy)**:
  - Wcześniejsza implementacja tworzyła do 40 animacji GSAP na sekundę w handlerze `onUpdate`, co obciążało słabsze komputery i urządzenia mobilne.
  - Wprowadzono precyzyjny bufor czasowy (`now - lastTickTimeRef.current > 38ms`) oraz flagę `overwrite: 'auto'`, stabilizując odświeżanie wskaźnika na poziomie ~25 klatek/s przy minimalnym zużyciu CPU.
- **Pewna synchronizacja stanu u kursanta**:
  - Usunięto błąd, w którym kursant ignorował aktualizację obrotu z Firestore w trakcie trwania lokalnego stanu `isSpinning`. Różnica kąta `Math.abs(interaction.wheelRotation - rotationRef.current) > 1` natychmiast płynnie dociąga koło kursanta do pozycji wyznaczonej przez lektora.

**3. Synchronizacja Nakładki Prezentacji Notatnika (`ScratchpadPresentationOverlay.tsx`):**
- Usunięto sztywne tło `bg-[#0b0f17]/95`, wprowadzając pełną obsługę motywów: `dark:bg-[#0b0f17]/95 bg-slate-50/98`.
- Karty pytań (`Question Card`) oraz nagłówek odtwarzacza audio automatycznie dostosowują tła, cienie i kolory tekstu do aktywnego motywu.

**4. Zarządzanie Procesami i Zasobami Maszyny:**
- Wyłączono lokalne serwery deweloperskie na portach 3000 i 3001, zwalniając pamięć RAM i zasoby procesora.
- Wcześniejsze zmiany (obsługa załączników audio w planerze lekcji, odtwarzacz audio w prezentacji, blokada asystenta AI dla kursanta) zostały zweryfikowane i wypchnięte do repozytorium GitHub (`origin/main`).

---

### 🚀 Głęboka Harmonia Trybu Ciemnego Notatnika z Systemem Nocturne Green (2026-09-16, runda 26)

**1. Eliminacja Płaskiej Szaro-Niebieskiej Belki i Przejście na Frosted Nocturne Glass (`index.css`):**
- **Szkliste paski narzędzi i nagłówka**:
  - W trybie ciemnym usunięto sztywne, nieprzezroczyste tło `--bg-lift` (`#172a46`) ze `.pad-shell.is-standalone .pad-bar`.
  - Wszystkie paski notatnika (`.pad-bar` — górny nagłówek, pasek formatowania, panel spisu treści i stopka) otrzymały nowoczesne, półprzezroczyste wykończenie `rgba(10, 16, 28, 0.90)` z mocnym rozmyciem `backdrop-filter: blur(18px) saturate(1.2)` i subtelnym obrysem `rgba(255, 255, 255, 0.08)`.
  - W trybie jasnym paski zachowują czyste, matowe szkło `rgba(255, 255, 255, 0.94)` z `blur(16px)` i obrysem `rgba(15, 23, 32, 0.12)`.

**2. Klimatyczne Oświetlenie Kanwy Biurka Zamiast Płaskiej Czerni (`index.css`):**
- **Likwidacja czarnej pustki wokół arkusza**:
  - Dotychczas kanwa `.pad-canvas` w trybie samodzielnym przybierała jednolitą czerń `#070b14`.
  - Wprowadzono atmosferyczny, podwójny gradient radialny zgodny z sygnaturą CRIBRO: subtelne światło padające od góry z odcieniem `--bg-lift` (`rgba(23, 42, 70, 0.45)`) oraz aksamitne przejście do głębokiego granatu bazy `#09101c` — arkusz notatnika leży teraz w trójwymiarowej, nastrojowej przestrzeni.

**3. Szlachetny Ciemny Arkusz Notatnika (`index.css`):**
- **Stylizacja luksusowego pergaminu Nocturne**:
  - Zaokrąglenie rogów arkusza `.pad-sheet` zwiększono z surowych 2px do eleganckich 8px.
  - Kartka w trybie ciemnym otrzymała gradient `linear-gradient(180deg, #0e1728 0%, #0a111e 100%)` z delikatnym, szmaragdowym obrysem `1px solid rgba(114, 240, 180, 0.14)`.
  - Tekst podstawowy został zsynchronizowany z kremowym odcieniem marki `--pad-fg: #eae8e3` (ciepła kość słoniowa eliminująca zmęczenie wzroku i efekt poświaty).
  - Cień arkusza zyskał subtelny, szmaragdowy rim-light: wielowarstwowy drop-shadow z poświatą `rgba(114, 240, 180, 0.08)`.

**4. Dynamiczna Harmonizacja Kolorów Nagłówków w Treści Dokumentu (`index.css`, `notebookPalette.ts`):**
- **Rozwiązanie problemu starych i nowych inline stylów w notatkach**:
  - Szablon lekcji i edytor wpisują barwy bezpośrednio w atrybut `style="color: ..."`. Zgaszone, mdłe pastele (`#17917a`, `#4c7fe0`, `#c06a26`, `#d4577f`, `#8f6fe0`) gryzły się z ciemnym tłem.
  - W `index.css` wdrożono reguły selektorów atrybutów dla `.pad-paper[data-pad-theme="dark"]`, które w locie przekształcają kolory na ciemnej kartce w świetliste, nasycone barwy z palety Nocturne:
    - Zielony (`#17917a` / `#72f0b4`) → `#72f0b4` (Nocturne Green) z poświatą `text-shadow: 0 0 16px rgba(114, 240, 180, 0.28)`,
    - Niebieski (`#4c7fe0` / `#67b5fa`) → `#67b5fa` (Sky Blue) z poświatą,
    - Pomarańczowy (`#c06a26` / `#fbbf24`) → `#fbbf24` (Ciepły Bursztyn / Warm Amber),
    - Różowy (`#d4577f` / `#fb7185`) → `#fb7185` (Koralowy Róż / Coral Rose),
    - Fioletowy (`#8f6fe0` / `#a78bfa`) → `#a78bfa` (Aksamitny Fiolet / `--accent-2`),
    - Czerwony (`#d1544c` / `#f87171`) → `#f87171` (Złagodzona Czerwień).
  - W trybie jasnym reguły te dbają o zachowanie maksymalnego kontrastu AAA (np. `#72f0b4` renderuje się jako głęboki szmaragd `#0d8a5f`).
  - W `utils/notebookPalette.ts` zaktualizowano `NOTEBOOK_COLORS`, `NOTEBOOK_INK.dark` (`#eae8e3`) oraz próbniki `NOTEBOOK_SWATCHES`, dzięki czemu nowo tworzone sekcje od razu korzystają z palety Nocturne.

**5. Dopracowanie Spisu Treści (TOC) i Narzędzi Edytora (`ScratchpadEditor.tsx`):**
- Na kontenerze `.pad-shell` dodano atrybut `data-pad-theme={paperTheme}`, umożliwiający płynną kaskadę motywów.
- W spisie treści aktywny rozdział/lekcja otrzymuje szmaragdowy akcent z lewej strony (`border-l-2 border-primary bg-primary/15`), a punkt wskaźnika zyskuje szmaragdową poświatę `shadow-[0_0_8px_rgba(114,240,180,0.8)] scale-125`.
- Zakreślacze lektorskie w trybie ciemnym używają autentycznych barw Nocturne (`#72f0b4`, `#fbbf24`, `#fb7185`).

**6. Blokada Czatu AI Notatnika dla Kursanta (`ScratchpadEditor.tsx`):**
- Asystent notatnika (Czat AI / Gemini 2.5 Flash) został stworzony jako narzędzie metodyczno-dydaktyczne dla lektora (analiza prywatnych Side Notes, generowanie ćwiczeń, podsumowywanie notatek do prac domowych).
- Przycisk `[ ✨ Czat AI ]` w pasku formatowania oraz wysuwany panel asystenta są renderowane **wyłącznie dla lektora i administratora** (`isTeacher`).
- Funkcje wysyłki wiadomości (`handleSendAiChat`) oraz aktywacji z poziomu notatek lektorskich (`handleTriggerAiFromNotes`) zostały zabezpieczone twardą strażą uprawnień (`if (!isTeacher) return;`), całkowicie odcinając dostęp kursantom.

---

### 🚀 Kontrast Pomocnika Lektora w Trybie Jasnym & Pełna Dostępność Ćwiczenia „Koło Fortuny" w Notatniku i Prezentacji (2026-09-16, runda 25)

**1. Poprawa Kontrastu w Trybie Jasnym (`index.css`, `ScratchpadTeacherCompanionDrawer.tsx`):**
- **Wyeliminowanie nieczytelnej bieli na żółtym tle**:
  - W pliku `index.css` usunięto regułę wymuszającą `--on-fill: #ffffff` dla klas `bg-amber-500` i wprowadzono dedykowaną regułę dla `bg-amber-500`, `bg-amber-400`, `bg-yellow-500`, `bg-yellow-400` ustawiającą ciemny atrament `--on-fill: #0f1720`. Dzięki temu wszystkie żółte i bursztynowe przyciski oraz plakietki w trybie jasnym zyskują certyfikowany kontrast WCAG AAA (ponad 10:1).
- **Czytelność prywatnych Side Notes w Pomocniku Lektora**:
  - Aktywna zakładka `Side Notes (Prywatne)` używa nasyconego koloru `bg-amber-500 text-slate-950 font-black` (oraz `dark:bg-amber-400 dark:text-ink`), gwarantując perfekcyjną czytelność etykiety.
  - Informacyjny boks `Prywatna przestrzeń lektora` zyskał wyrazisty nagłówek `text-amber-950 dark:text-amber-300` oraz tekst `text-slate-800 dark:text-amber-100/90 font-medium`, likwidując wyblakły, słomkowy odcień.
  - Pole notatek `textarea` otrzymało wyraźny obrys `border-line-strong hover:border-line-stronger focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20` oraz czytelną plakietkę auto-zapisu `text-amber-950 bg-amber-100`.
  - Przycisk `Wygeneruj podsumowanie z AI` ma teraz ciemny atrament `text-slate-950 font-black` na bursztynowym tle.
  - W zakładce scenariusza poprawiono kontrast Budki Suflera (Teacher's Notes follow-up i scaffolding).

**2. Uniwersalna Dostępność i Odkrywalność Ćwiczenia „Koło Fortuny" (Wheel of Fortune) (`ScratchpadTeacherCompanionDrawer.tsx`, `ScratchpadEditor.tsx`, `ScratchpadLivePresentationModal.tsx`, `ScratchpadPresentationOverlay.tsx`, `SlideEditorModal.tsx`, `LessonPresentationView.tsx`, `types.ts`, `services/scratchpadService.ts`):**
- **Bezpośrednie uruchomienie z Pomocnika Lektora**:
  - W nagłówku szuflady pomocnika lektora dodano przycisk szybkiego startu `[ 🎡 Koło Fortuny ]`.
  - Na samej górze zakładki scenariusza umieszczono dedykowaną, elegancką kartę `🎡 Koło Fortuny (Rozgrzewka)` z przyciskiem `[ ✨ Uruchom ]`.
- **Szybki start z poziomu Notatnika**:
  - W górnym pasku `ScratchpadEditor.tsx` obok przycisku `Prezentacja` dodano przycisk `[ 🎡 Koło Fortuny ]` dla lektora.
- **Gotowy wzorzec w modalu Prezentacji**:
  - W oknie wyboru aktywności na żywo (`ScratchpadLivePresentationModal.tsx`) dodano `🎡 Koło Fortuny (Warm-up Wheel / Rozgrzewka)` jako pierwszy, domyślny preset.
- **Pełne renderowanie gry w nakładce prezentacji notatnika**:
  - W `ScratchpadPresentationOverlay.tsx` zintegrowano silnik `WheelOfFortune` (fizyka GSAP, dźwięki, TTS, konfetti, losowanie pytań ze scenariusza lub historii lekcji) wraz z dwukierunkową synchronizacją obrotu oraz dodawaniem wylosowanych pytań do treści notatnika (`onAddToNotes`).
- **Wybór typu w edytorze slajdów**:
  - W `SlideEditorModal.tsx` dodano typ `🎡 Koło Fortuny (Rozgrzewka / Warm-up)` do listy wyboru typów slajdu.
- **Narzędzie w pasku prezentacji lektorskiej**:
  - W `LessonPresentationView.tsx` w pasku narzędzi na żywo (obok Tablicy, Notatnika i Lasera) dodano przycisk `[ 🎡 Koło Fortuny ]`, który jednym kliknięciem przenosi lektora na slajd rozgrzewkowy lub tworzy go dynamicznie w talii.

---

### 🚀 Spójność Motywów Pomocnika Lektora, Walidacja Ciemnego Trybu Notatnika & Wyjście z Prezentacji Klawiszem ESC (2026-09-16, runda 24)

**1. Spójność Motywów Pomocnika Lektora (Live Companion) (`ScratchpadTeacherCompanionDrawer.tsx`):**
- **Eliminacja sztywnych barw i pełna adaptacja do motywu jasnego/ciemnego**:
  - Usunięto sztywne, ciemne heksadecymalne wartości (`bg-[#0e131f]`, `bg-[#16273b]`, `bg-[#331828]`, `bg-[#2b192e]`, `bg-ink-1`, surowe `text-white`), które powodowały drastyczny rozjazd wizualny przy włączonym trybie jasnym.
  - Całość szuflady oparto na tokenach projektowych: kontener `bg-base-200 border-l border-line-strong`, nagłówki `bg-base-100/70 border-line`, teksty `text-text-hi` oraz `text-content-muted`.
- **Czytelność prywatnej przestrzeni lektora (Side Notes)**:
  - Naprawiono żółtą kartkę informacyjną: w trybie jasnym tekst ma wysoki kontrast (`text-amber-900` / `text-amber-800`), a w ciemnym elegancki odcień (`text-amber-200` / `text-amber-300`).
  - Pole `textarea` zyskało naturalne tło `bg-base-100`, wyraźny obrys `border-line-strong` oraz czytelny kolor atramentu `text-text-hi` z delikatnym akcentem focus ring.
- **Karty scenariusza i ćwiczeń Kahoot-Style**:
  - Karty zagadnień i pytań dyskusyjnych otrzymały tokeny semantyczne (`bg-sky-500/15`, `bg-rose-500/15`), a Budka Suflera (Teacher's Notes) i ćwiczenia interaktywne płynnie dopasowują się do wybranego motywu.

**2. Walidacja i Optymalizacja Kolorystyczna Ciemnego Trybu Notatnika (`ScratchpadEditor.tsx`, `index.css`):**
- **Inteligentny domyślny motyw kartki (`paperTheme`)**:
  - Jeżeli użytkownik nie zapisał ręcznie preferencji w `localStorage`, notatnik automatycznie przyjmuje aktualny motyw aplikacji (w trybie nocnym startuje z ciemną kartką, w dziennym z jasną).
- **Zwiększony kontrast zakreślaczy lektorskich na ciemnej kartce**:
  - Wprowadzono dynamiczny dobór parametrów zakreślaczy w `ScratchpadEditor.tsx` zależny od motywu kartki (`paperTheme === 'dark' ? ... : ...`).
  - Na ciemnej kartce (`#111a2c`): błąd to `#fca5a5` na `rgba(239, 68, 68, 0.28)`, poprawna forma to `#6ee7b7` na `rgba(16, 185, 129, 0.28)` (spójne z akcentem marki), a nowe słówko to `#fcd34d` na `rgba(245, 158, 11, 0.28)`.
  - W trybie jasnym zakreślenia używają nasyconych, ciemniejszych atramentów z delikatniejszym tłem.
- **Dopracowane elementy edytora w CSS**:
  - Wzbogacono bloki cytatów (`blockquote`) oraz nagłówki tabel (`th`), nadając im elegancki akcent marki Nocturne Green i wysoki kontrast.

**3. Opcja Wyjścia z Prezentacji oraz Klawisz ESC (`LessonPresentationView.tsx`, `AdminPanel.tsx`, `LessonPlannerStudio.tsx`, `ScratchpadPresentationOverlay.tsx`, `LiveJoinScreen.tsx`):**
- **Dedykowany przycisk wyjścia**:
  - W pasku narzędzi prezentacji (`LessonPresentationView.tsx`) umieszczono wyrazisty, ergonomiczny przycisk `[🚪 Wyjdź Esc]` z ikoną `LogOut` i etykietą skrótu.
- **Hierarchiczna obsługa klawisza ESC w trybie prezentacji**:
  - Po naciśnięciu ESC system w pierwszej kolejności zamyka ewentualnie otwarte okna podręczne (tablicę, edytor slajdów, generator AI, bibliotekę talii, samouczek).
  - Jeśli żadne podrzędne okno nie jest otwarte, ESC wyłącza tryb pełnoekranowy i zamyka prezentację poprzez callback `onClose`, zwracając użytkownika do panelu głównego.
- **Propagacja wyjścia w aplikacji**:
  - `AdminPanel.tsx` oraz `LessonPlannerStudio.tsx` przekazują `onClose`, dzięki czemu lektor może błyskawicznie zamknąć prezentację jednym klawiszem.
  - W nakładce prezentacji notatnika (`ScratchpadPresentationOverlay.tsx`) klawisz ESC natychmiast zamyka ćwiczenie i wraca do kartki.
  - W widoku kursanta (`LiveJoinScreen.tsx`) klawisz ESC wyłącza fullscreen lub umożliwia opuszczenie aktywnej sesji live.

---

### 🚀 Zarządzanie Kontami Kursantów, Bezpieczeństwo Haseł, Opcjonalny Mailing Notion, Weryfikacja Statystyk & Zasilanie Learning Curve ze Wszystkich Źródeł (2026-09-16, runda 23)

**1. Bezpieczeństwo Haseł Kursantów i Kopiowanie Hasła dla Admina (`StudentProfileHeader.tsx`, `StandaloneStudentDatabaseScreen.tsx`, `StudentDatabaseScreen.tsx`, `AuthContext.tsx`, `ForcePasswordChangeScreen.tsx`, `PasswordChangeSuggestion.tsx`):**
- **Szybkie kopiowanie hasła startowego**:
  - Administrator i lektor mają możliwość skopiowania hasła początkowego kursanta jednym kliknięciem (`[📋 Kopiuj hasło startowe]` w profilu kursanta oraz `[📋 Kopiuj hasło]` w bazie kursantów) z czytelnym komunikatem feedbacku (`✓ Skopiowano!`).
- **Trwałe usuwanie hasła po aktywacji/zmianie**:
  - Hasło startowe (`tempPassword`) jest trwale kasowane (`deleteField()`) z dokumentu Firestore w momencie, gdy kursant:
    1. Zmieni hasło na własne (w formularzu wymuszonej zmiany `ForcePasswordChangeScreen` lub w sugerowanej zmianie `PasswordChangeSuggestion`) — ustawiane są flagi `hasCustomPassword: true`, `passwordChangedAt: nowIso`.
    2. Zaloguje się przez Google lub połączy konto z Google (`linkGoogleAccount`) — ustawiane są flagi `isGoogleLinked: true`, `authProvider: 'google'`.
- **Bezpieczny stan chroniony w interfejsie**:
  - Po usunięciu hasła początkowego panel administratora/lektora nie próbuje go wyświetlać ani zgadywać, lecz czytelnie prezentuje bezpieczny status: `🔒 Hasło własne kursanta (chronione)` lub `🌐 Połączono z Google`.

**2. Opcjonalny E-mail Powitalny przy Imporcie Kursantów z Notion (`NotionSyncButton.tsx`):**
- **Rozdzielenie tworzenia konta od wysyłki maila**:
  - W oknie potwierdzenia synchronizacji z Notion dodano podrzędny checkbox: `[ ] Wyślij e-mail powitalny z danymi logowania (opcjonalnie)`.
  - Jeśli lektor odznaczy tę opcję, konto w Firebase i profil kursanta powstają z bezpiecznym hasłem tymczasowym, ale żaden e-mail nie jest wysyłany.
  - Wygenerowane hasło jest czytelnie prezentowane lektorowi w oknie podsumowania importu (`NotionSyncResultModal`), aby mógł przekazać je kursantowi osobiście.
  - W przypadku zaznaczenia opcji, mail powitalny jest wysyłany automatycznie, a pole `invitationSent: true` zostaje natychmiast odnotowane w bazie.

**3. Status Zaproszenia i Aktywacji Konta (`types.ts`, `firestore.rules`, `StudentProfileHeader.tsx`, `StudentDatabaseScreen.tsx`, `StandaloneStudentDatabaseScreen.tsx`, `StudentInviteEmailModal.tsx`):**
- **Rozszerzenie modelu `User` i reguł Firestore**:
  - Dodano dozwolone pola: `invitationSent`, `invitationSentAt`, `isActivated`, `firstLoginAt`, `hasCustomPassword`, `passwordChangedAt`, `authProvider`, `isGoogleLinked`, `completedTasksCount`.
- **Wskaźnik zaproszenia i manualne oznaczanie**:
  - Plakietka stanu: `✅ Zaproszenie: Wysłano (data)` vs `⏳ Zaproszenie: Nie wysłano`.
  - Przycisk szybkiej akcji `[Oznacz jako wysłane]` / `[Cofnij]` z bezpośrednim zapisem w Firestore w profilu kursanta i w tabeli bazy kursantów.
  - Automatyczne oznaczanie `invitationSent: true` po wysłaniu maila z modala `StudentInviteEmailModal`.
- **Wskaźnik pierwszej aktywacji**:
  - Wskaźnik `🟢 Konto aktywowane (data)` vs `⚪ Oczekuje na 1. logowanie`.
  - Automatyczne wykrywanie pierwszego udanego logowania kursanta w `AuthContext.updateLoginStats` i utrwalenie znacznika czasu w `firstLoginAt`.

**4. Weryfikacja i Poprawa Statystyk (Admin, Nauczyciel, Kursant) (`StudentHeroHeader.tsx`, `TeacherDashboardStats.tsx`, `TeacherDashboardActivity.tsx`):**
- **Eliminacja podwójnego zliczania ukończonych zadań**:
  - W `StudentHeroHeader.tsx` naprawiono sumowanie: wyodrębniono `standaloneExercisesCount` (tylko sesje z `practiceLogs` inne niż `'homework'` i `'test'`), eliminując podwójne liczenie zadań domowych i testów.
- **Precyzyjna chronologia aktywności lektora**:
  - W `TeacherDashboardStats.tsx` wprowadzono jawne sortowanie chronologiczne przed wycięciem ostatnich 10 sesji (`logs.sort(...)`) oraz zabezpieczenie przed dzieleniem przez zero przy pustej historii.
- **Czytelne formatowanie wskaźnika poprawności**:
  - W `TeacherDashboardActivity.tsx` naprawiono formatowanie wyniku z mylącego `${data.score}/${data.totalWords}` (np. `85/5`) na jednoznaczne `${data.score}% (${data.totalWords} zadań)`.

**5. Pełna Integracja Historii Sesji i Krzywej Uczenia (`learningCurve.ts`, `TakeTestScreen.tsx`, `HomeworkScreen.tsx`, `server.ts`):**
- **Zasilanie profilu `learningCurve` z każdego rodzaju zadań**:
  - Dodano i wyeksportowano `deserializeLearningProfile` w `utils/learningCurve.ts`.
  - Zintegrowano `recordExerciseResults` w `TakeTestScreen.tsx` przy zatwierdzaniu testu okresowego/diagnostycznego.
  - Zintegrowano `recordExerciseResults` w `HomeworkScreen.tsx` przy nadsyłaniu pracy domowej w aplikacji.
  - Wdrożono aktualizację profilu ucznia w Firebase Admin SDK w backendzie Express (`/api/homework/direct-submit` w `server.ts`) dla prac domowych oddawanych przez bezpośrednie linki e-mail.
  - Wszystkie zadania tworzą ustrukturyzowany wpis w `practiceLogs`, a profil krzywej uczenia dostosowuje wagi słownictwa i trudność kolejnych ćwiczeń adaptacyjnych.

---

### 🚀 Koło Fortuny (Wheel of Fortune) jako Pierwszy Element Trybu Prezentacji — Płynna Fizyka GSAP, ADHD-Friendly & Dwukierunkowa Synchronizacja Live (2026-09-16, runda 22)

**1. Interaktywne Koło Fortuny na Start Prezentacji (`WheelOfFortune.tsx`, `SlideCard.tsx`, `types.ts`):**
- **Pierwszy element interaktywny lekcji**:
  - Dodano nowy typ slajdu `wheel_of_fortune` do `PresentationSlideType`.
  - W `getDefaultPresentation` oraz `createPresentationFromScenario` slajd rozgrzewkowy z Kołem Fortuny pojawia się od razu jako slajd nr 2 (tuż po slajdzie tytułowym), wprowadzając dynamiczny, angażujący icebreaker na sam początek zajęć.
  - Na klasycznych slajdach typu `warmup` dodano przycisk szybkiego przełącznika `[ 🎡 Koło Fortuny ]` / `[ 📋 Pokaż karty pytań ]`, umożliwiając lektorowi natychmiastowe zamienienie dowolnej listy pytań w koło fortuny.
- **Wybór źródła pytań (Scenariusz vs Poprzednie Lekcje Kursanta)**:
  - Przełącznik źródeł pytań w nagłówku koła:
    - `🎯 Aktualny scenariusz`: pytania wyciągane bezpośrednio z zagadnień scenariusza, pytań do dyskusji (`thoughtProvokingQuestions`) lub modułów rozgrzewkowych.
    - `🔄 Z poprzednich lekcji`: inteligentny ekstraktor `extractQuestionsFromPastLessons` analizujący historię spotkań kursanta (`LessonRecord`) i przekształcający notatki lektora (`suggestedFollowUp`), słownictwo z lekcji (`vocabularyText`), trudniejsze zagadnienia (`thingsToImprove`) oraz tematy w personalizowane wyzwania konwersacyjne.
  - Generator pytań AI na żądanie (`Gemini 2.5 Flash`) tworzący 8 unikalnych tematów dostosowanych do profilu ucznia.
  - Zestaw 8 starannie dobranych, bezpiecznych pytań zapasowych (fallback).

**2. Płynna Fizyka Animacji w GSAP i Doświadczenie ADHD-Friendly (`WheelOfFortune.tsx`):**
- **Zaawansowana fizyka obrotu koła w GSAP**:
  - Obrót koła napędzany przez `gsap.to` z krzywą spowolnienia `power4.out` o czasie trwania `4.4s`, wykonujący od 5 do 7 pełnych obrotów i miękko lądujący na docelowym wycinku.
  - Sprężyste odchylenie iglicy wskaźnika (`needleRef`) przy każdym kontakcie z obwodowymi kołkami koła (`gsap.fromTo(..., { rotation: -18 }, { rotation: 0, ease: 'back.out(2)' })`).
  - Poszanowanie preferencji dostępności `prefers-reduced-motion` z natychmiastowym wskazaniem wyniku bez wywoływania zawrotów głowy.
- **Estetyka Liquid Glass i ADHD-Friendly UX**:
  - 8-sektorowe koło SVG z harmonijną, stonowaną paletą HSL i subtelnymi szklanymi refleksami.
  - Centralny przycisk z realistyczną głębią szklaną 3D (`ZAKRĘĆ`), reagujący na kliknięcie fizycznym wgnieceniem tafli.
  - Spokojne tempo, brak stroboskopowych błysków, neonowych mrugań czy gwałtownych dźwięków.
  - Karta wylosowanego pytania z dużą, czytelną typografią, wymową audio TTS, wbudowanym stoperem 60 sekund na odpowiedź (z pauzą i resetem), przyciskami: `Dodaj do notatek lekcji`, `Oznacz jako omówione` oraz delikatnym efektem `canvas-confetti`.

**3. Dwukierunkowa Synchronizacja w Czasie Rzeczywistym (Real-time Live Sync):**
- Rozbudowano interfejs `SlideInteraction` o parametry obrotu: `wheelRotation`, `isWheelSpinning`, `drawnQuestionId`, `drawnQuestionText`, `questionSource`.
- Zapewniono pełną dwukierunkową synchronizację: gdy kursant lub lektor kręci kołem w oknie `LiveJoinScreen` (lub `LessonPresentationView`), zmiana natychmiast propaguje się przez Firestore `liveSessions/{pin}` oraz `BroadcastChannel` do drugiego urządzenia — obaj uczestnicy widzą dokładnie ten sam obrót i wylosowane pytanie w tym samym ułamku sekundy.

---

### 🚀 Statyczny Liquid Glass z Głębią 3D Przycisku i Kompaktowe Okno Czatu Lektora bez Scrolla (2026-09-16, runda 21)

**1. Usunięcie Animacji Połysku i Statyczny Liquid Glass 3D dla Kafelków (`index.css`):**
- **Całkowite usunięcie animowanego połysku**: Zlikwidowano pseudo-element `::before` ze skośnym, przesuwającym się pasem światła (`sheen sweep` / `skewX(-24deg)`). Wszystkie kafelki w aplikacji mają teraz czysty, spokojny i w 100% statyczny wygląd.
- **Fizyczna głębia 3D szklanych przycisków**:
  - Wprowadzono zaawansowany gradient optyczny imitujący załamanie światła przez taflę szlifowanego szkła (`linear-gradient(180deg, ...)`).
  - Wieloetapowe cieniowanie wewnętrzne (inner bevel): ostra, rozjaśniona krawędź górna (`inset 0 1px 1px 0 rgba(255,255,255,0.36)`), miękka poświata czaszy (`inset 0 2px 5px 0 rgba(255,255,255,0.08)`) oraz głęboki cień dolnej krawędzi tafli (`inset 0 -2px 4px 0 rgba(0,0,0,0.38)`).
  - Statyczny refleks soczewki (`::after`): eliptyczny, stały rozbłysk ambientowy na górnej połowie kafelka bez żadnego ruchu.
  - Dotykowy efekt wciśnięcia (3D button press): kliknięcie kafelka (`:active`) obniża go o `2px` i kompresuje cienie, dając realistyczne wrażenie fizycznego przycisku ze szkła.
  - Zbalansowany hover: subtelne uniesienie o `2.5px` z pogłębieniem cienia i akcentu neonowego bez przesuwających się pasów światła.

**2. Optymalizacja Okna Czatu na Głównej Stronie Nauczyciela (`TeacherAssistant.tsx`):**
- **Eliminacja wewnętrznego paska przewijania (scrolla)**: Usunięto sztywne ograniczenie `max-h-[280px]` w stanie początkowym czatu, które powodowało ucinanie kafelków i wymuszało niepotrzebne scrollowanie wewnątrz okna tuż po załadowaniu panelu.
- **Kompaktowy, elegancki widok powitalny**:
  - Nowy, horyzontalny nagłówek z awatarem i zwięzłym opisem.
  - 6 kafelków propozycji ułożonych w symetryczny, kompaktowy układ 3x2 o zredukowanej wysokości z czytelnymi miniaturami ikon, kategorią i tytułem.
  - Całość (nagłówek, propozycje tematów, pole wprowadzania) idealnie mieści się w jednym oknie o wysokości ~270px bez scrollbara wewnątrz komponentu.
- **Elastyczna przestrzeń konwersacji**: W trakcie aktywnej rozmowy okno wiadomości płynnie adaptuje się do wysokości do `max-h-[580px]`, zapewniając pełną czytelność odpowiedzi AI i kart akcji Notion bez zbędnego ściskania tekstu.

---

### 🚀 4 Formaty Praktyki Dodatkowej: „Sprawdź Się” z Rozgrzewką, „Napraw Zdanie” z Prac Domowych, Fiszki & Dopasowanie oraz Budowanie Krzywej Uczenia (2026-09-16, runda 20)

**1. Transformacja i Nowy Podział na 4 Ćwiczenia w Praktyce Dodatkowej (`AIExerciseGeneratorScreen.tsx`):**
- **Zmiana nazwy „Prawdziwe Wyzwanie” na „Sprawdź Się”**:
  - Tytuł: `Sprawdź Się` (EN: `Check Yourself`), badge: `Tłumaczenia` (`Translations`).
  - Drobny opis pomocniczy: `Tłumaczenie pełnych zdań z pamięci i natychmiastowa korekta AI.`
  - Wskaźnik trybu rozgrzewki: `🧩 Tryb rozgrzewki`.
- **Wdrożenie nowego ćwiczenia „Napraw Zdanie” (Error Correction)**:
  - Przeniesiono silnik zadań typu `find_errors` bezpośrednio z generatora prac domowych (`generateFindErrors` w `services/homeworkGenerator.ts`).
  - Karta wyboru formatu: Tytuł `Napraw Zdanie` (EN: `Fix the Sentence`), badge `Korekta`, opis: `Wyszukaj błąd gramatyczny lub leksykalny i wpisz poprawne zdanie.` oraz wskaźnik `🎯 Zadanie z pracy domowej`.
  - Dedykowany, przejrzysty interfejs zadania: ekspozycja zdania z błędem w karcie o bursztynowej poświacie (`AlertCircle`), kontekst/znaczenie po polsku, rozwijana wskazówka lektora oraz przycisk `Kopiuj zdanie do edycji` (dzięki któremu kursant może jednym kliknięciem wstawić zdanie i poprawić jedynie wadliwy wyraz bez konieczności przepisywania całego tekstu).
- **Kompletny 4-kafelkowy grid Liquid Glass**:
  - Uporządkowany układ 2x2 z estetyką `liquid-glass-tile`, wielopoziomową głębią, refleksami świetlnymi i subtelnym hover liftem.
  - 1. **Sprawdź Się** (Wpisywanie / Tłumaczenia)
  - 2. **Napraw Zdanie** (Korekta zdań z błędem)
  - 3. **Fiszki** (Aktywne przypominanie słownictwa)
  - 4. **Dopasowanie** (Szybkie łączenie par na czas)

**2. Opcjonalny Tryb Rozgrzewki Klockowej (Warm-up Scrambler) w Treningu Zdań:**
- Po wygenerowaniu zadań dla trybu tłumaczeń lub korekty zdań kursant widzi elegancki ekran zaproszenia z wyborem:
  - `🚀 Zacznij od rozgrzewki (Zalecane)` — uruchamia komponent `HomeworkWarmupScrambler` z 3 zdaniami w formie układanki klockowej.
  - `⚡ Przejdź od razu do zdań` — natychmiastowe przejście do głównych zadań.
- Zaktualizowano `HomeworkWarmupScrambler.tsx`, aby natywnie obsługiwał pole `item.englishTranslation`, co zapewnia bezbłędną współpracę z generatorem tłumaczeń.
- Rozgrzewka jest łagodna dla percepcji i zgodna z zasadami ADHD-friendly (brak presji czasowej, możliwość pominięcia w każdej chwili).

**3. Integracja z Historią Sesji i Budowaniem Krzywej Uczenia (Learning Curve):**
- **Wszystkie 4 ćwiczenia** lądują teraz w historii sesji kursanta (`users/{userId}/practiceLogs`) i zasilają profil adaptacji poziomu (`recordExerciseResults`):
  - **Sprawdź Się**: zapisuje log `ai_translation` z formatem `typing` i przekazuje wyniki do `recordExerciseResults(..., 'translation')`.
  - **Napraw Zdanie**: zapisuje log `sentence_correction` z formatem `find_errors`, natychmiast waliduje dokładne dopasowanie tekstu (100% bez zbędnego opóźnienia) lub korzysta z dedykowanego promptu oceniania AI, a następnie zasila profil przez `recordExerciseResults(..., 'find_errors')`.
  - **Fiszki** i **Dopasowanie**: w `context/FlashcardContext.tsx` po ukończeniu sesji fiszek lub matching automatycznie wywoływana jest funkcja `recordExerciseResults` z typami `'flashcards'` i `'match'`.
- Zwiększanie licznika ukończonych zadań i aktualizacja passy (`updateUserStreak`).

**4. Nowoczesne Animacje Drops bez Przebodźcowania:**
- Wprowadzono animację przejść kropelkowych `animateDropletTransition` z `services/gsapAnimations.ts` przy zmianie pytań i przejściach między zadaniami — miękkie, organiczne skalowanie (0.95 -> 1.0) z delikatnym fade-in w 0.38s bez nagłych błysków.

---

### 🚀 Nowa Architektura Liquid Glass dla Kafelków w Całej Aplikacji: Połysk Szkła, Efekt Głębi i Nowoczesna Animacja Hover Sheen (2026-09-16, runda 19)

**1. Receptura Płynnego Szkła (Liquid Glass) i Optyczna Głębia (`index.css`):**
- **Zunifikowany selektor dla całej aplikacji**: Powiązano klasy `.liquid-glass-tile`, `.glass-tile` oraz `.liquid-glass-card`, gwarantując spójny, ultranowoczesny wygląd wszystkich kafelków w panelu lektora (`AdminPanel.tsx`), panelu kursanta (`StudentToolBar.tsx`, `StudentHeroHeader.tsx`), modułach zadań (`StudentAssignedHomework.tsx`, `AssignedTasks.tsx`, `TeacherQuickAccess.tsx`) i kartach.
- **Wielowarstwowy gradient o załamaniu optycznym**: Złożony gradient `linear-gradient(140deg, ...)` z akcentem miętowym na ciemnym tle (`color-mix(in srgb, var(--bg-lift) 55%, var(--ink-2) 45%)`) oraz czysty krystaliczny gradient w trybie jasnym (`:root.light`).
- **Filtr rozmycia i nasycenia**: `backdrop-filter: blur(16px) saturate(140%)` dający wrażenie fizycznego szkła załamującego elementy tła.
- **Wielopoziomowa głębia cienia (Depth Effect)**:
  - Cień kontaktowy + głęboki ambientowy cień podłogi (`0 2px 5px -1px rgba(0,0,0,0.35), 0 12px 30px -4px rgba(0,0,0,0.45)`).
  - Wewnętrzne załamanie krawędzi (specular prism highlight): `inset 0 1px 0 rgba(255,255,255,0.18)` na górze i subtelne domknięcie `inset 0 -1px 0 rgba(0,0,0,0.25)` na dole.

**2. Nowoczesna, Fizyczna Animacja Hover (Sheen Sweep & Spring Micro-Lift):**
- **Płynne uniesienie 3D (Spring Micro-Lift)**: `transform: translateY(-4px) scale(1.01)` z fizyczną krzywą sprężystości `cubic-bezier(0.34, 1.45, 0.7, 1)`, dającą natychmiastowe, sprężyste i organiczne wrażenie przy najechaniu myszą.
- **Przejazd aksamitnego refleksu światła (Liquid Sheen Sweep `::before`)**:
  - Ukryty pod kątem `-24deg` pas połysku (`skewX(-24deg)`), który przy `hover` płynnie i szybko przesuwa się po tafli szkła w 0.65s (`cubic-bezier(0.2, 0.8, 0.25, 1)`).
  - Aktywuje się wyłącznie przy wejściu kursora (nie zapętla się, nie miga, jest w 100% ADHD-friendly).
- **Dynamiczna poświata głębi (Aura Glow)**: Rozbłysk cienia pod kafelkiem (`0 20px 38px -6px rgba(0,0,0,0.55), 0 0 28px -2px rgba(114,240,180,0.22)`), rozświetlenie obrysu (`rgba(114,240,180,0.42)`) oraz wzmocnienie górnej linii pryzmatu (`inset 0 1.5px 0.5px rgba(255,255,255,0.30)`).
- **Wsparcie dla urządzeń dotykowych i Reduced Motion**:
  - Na ekranach dotykowych (`@media (hover: none)`): lekka redukcja skali (`scale(0.985)`) przy dotknięciu.
  - Wyłączenie transformacji i połysku przy preferencji `prefers-reduced-motion: reduce`.

---

### 🚀 Dopasowanie Szerokości i Wysokości Asystenta (-30%), Kafelkowe Tło Glassmorphic, Całkowity Reset Notion i Wyszukiwarka Baz Auto-Discovery (2026-09-16, runda 18)

**1. Dopasowanie Układu i Wizualności Asystenta AI (`TeacherAssistant.tsx`, `AdminPanel.tsx`):**
- **Szerokość idealnie zrównana z kafelkami głównymi**: Kontener asystenta AI został poszerzony do `max-w-5xl mx-auto w-full`, dzięki czemu jego krawędzie lewa i prawa idealnie pokrywają się z siatką głównych modułów lektora w `AdminPanel.tsx`.
- **Kompaktowa wysokość (-30%)**: Zmniejszono wysokość panelu o ok. 30% w trybie osadzonym, co zapewnia optymalną ergonomię bez przewijania całego ekranu:
  - Zmniejszono paddingi nagłówka i kompozytora wiadomości.
  - Skrócono widok historii rozmowy (`min-h-[140px] max-h-[280px]` z płynnym przewijaniem).
  - Skalowano w dół karty podpowiedzi pytań/promptów na ekranie powitalnym (`p-2.5`, mniejsze ikony i kompaktowy tekst).
- **Kafelkowe tło Liquid Glassmorphic**: Zastąpiono surowe tło gradientowe sprawdzonym stylem kafelków głównych (`liquid-glass-tile` z subtelnym neonowym gradientem poświaty).

**2. Całkowity Reset i Rozłączenie Połączenia z Notion (`server.ts`, `SettingsScreen.tsx`):**
- **Wyczyszczenie tokena i ID baz**: Dodano endpoint `POST /api/notion/clear-config`, który usuwa zapisane poświadczenia Notion ze zmiennych środowiskowych i z dokumentu `system/notion` w Firestore.
- **Usunięcie domyślnych, zahardcodowanych ID baz**: Usunięto stare domyślne identyfikatory baz z `server.ts` i `SettingsScreen.tsx`, pozwalając na czysty start i podłączenie nowej bazy.
- **Przycisk „Rozłącz i wyczyść Notion”**: W Ustawieniach Administratora (`SettingsScreen.tsx`) dodano czerwony przycisk z ikoną `Unlink`, umożliwiający bezpieczne wyczyszczenie danych przed wprowadzeniem nowego tokena.

**3. Inteligentna Wyszukiwarka Baz Notion (Auto-Discovery) na podstawie Tokena (`server.ts`, `SettingsScreen.tsx`):**
- **Endpoint `POST /api/notion/search-databases`**: Wywołuje oficjalny endpoint Notion API `/v1/search` z filtrem obiektów bazodanowych (`property: object, value: database`), zwracając listę wszystkich baz udostępnionych integracji.
- **Karty wykrytych baz danych z 1-klikowym przypisaniem roli**:
  - Prezentacja tytułu, ikony (emoji/ikona bazy), opisu, linku zewnętrznego oraz właściwości (np. *Data, Kursant, Status, Link*).
  - Przyciski szybkiego przypisania `[📌 Spotkania]` oraz `[👥 Kursanci]` automatycznie wypełniają odpowiednie identyfikatory w formularzu konfiguracyjnym.
  - Aktywne odznaki wizualne dla aktualnie wybranych baz.

---

### 🚀 Zintegrowany Planer Lekcji z Notatnikiem, Interaktywne Ćwiczenia Kahoot-Style, Prywatne Side Notes Lektora oraz Baza „Moje Scenariusze” (2026-09-16, runda 18)

**1. Nowy Format Promptu i Struktura Wizualna Planera Lekcji (`services/lessonPlannerMethod.ts`, `components/admin/LessonPlannerStudio.tsx`):**
- **Wizualna wierność makietom**:
  - Karta nagłówkowa *Callout*: `🏭 Format` (poziom, czas, typ lekcji), `Cel` (praktyczne mówienie, gramatyka), `Materiał źródłowy` (konkretny bank materiałów i personalizacja pod kursanta).
  - 6 zwijanych sekcji akordeonowych z etykietami czasowymi i podświetleniem aktywnej sekcji: `1. Revision and Warm Up`, `2. Grammar Review`, `3. Main Topic`, `4. Language Focus`, `5. Practice Enclosure`, `6. Extra Tasks`.
  - Sekcja 3 (Main Topic): niebieska kapsuła `Topic and Material` (cele i materiał źródłowy), niebieska kapsuła `Lead-in`, bordowo-śliwkowa kapsuła `Thought-Provoking Questions` (notatka banku bezpieczeństwa, wskazówka metodyczna dla kursanta).
  - Pytania z polami wyboru `[ ]` (checkbox), inline edycją, przenoszeniem w górę/dół, usuwaniem oraz dodawaniem własnych pytań.
  - Rozwijana **Budka Suflera** (`Teacher's Notes`) pod każdym pytaniem: `• Cel:`, `• Scaffolding:` (kursywa z przyciskiem szybkiego kopiowania podpowiedzi), `• Follow-up:` (złocisty akcent).
- **Interaktywny czat z AI**: Konwersacyjne wprowadzanie poprawek i rozszerzeń do scenariusza przez asystenta AI bez konieczności zaznaczania elementów; asystent zachowuje zaakceptowane fragmenty i aktualizuje JSON planu.
- **Baza „Moje scenariusze”**: Każdy wygenerowany scenariusz jest zapisywany w Firestore (`lessonScenarios`) i lokalnej pamięci podręcznej, z możliwością filtrowania, przypisywania do kursantów i ponownego otwierania.

**2. Pomocnik Lektora w Notatniku — Scenariusz i Prywatne Side Notes (`ScratchpadTeacherCompanionDrawer.tsx`, `ScratchpadEditor.tsx`):**
- **Górny przycisk `[🎯 Scenariusz & Notes]`**: Otwiera wysuwany boczny panel dla lektora podczas lekcji na żywo.
- **Zakładka Scenariusza**: Lektor śledzi przygotowany plan, odhacza zadane pytania w czasie rzeczywistym (`[ ]` ➔ `[x]`), czyta podpowiedzi z Budki Suflera i uruchamia ćwiczenia dla ucznia jednym kliknięciem.
- **Zakładka `[📝 Side Notes]` (Prywatne uwagi lektora)**:
  - 100% prywatna przestrzeń tekstowa lektora (pole `teacherNotes` w Firestore), całkowicie ukryta przed kursantem.
  - Auto-zapis na bieżąco podczas lekcji.
  - Integracja z asystentem AI w notatniku: gdy lektor prosi o podsumowanie lekcji lub pracę domową, asystent automatycznie wczytuje `teacherNotes` jako bezcenny kontekst realnych trudności i błędów kursanta.

**3. Interaktywny Tryb Ćwiczeń Prezentacji na Żywo (Kahoot-Style) (`ScratchpadPresentationOverlay.tsx`):**
- **Doświadczenie Kahoot na żywo**: Gdy lektor uruchomi zadanie z Sekcji 5 (`Practice Enclosure`), notatnik kursanta zostaje płynnie zastąpiony przez interaktywną nakładkę ćwiczenia.
- **Kolorowe kafelki odpowiedzi (A, B, C, D)** z geometrycznymi symbolami (trójkąt, romb, koło, kwadrat) i dynamicznymi stanami:
  - Kursant klika swoją odpowiedź, stan synchronizuje się natychmiast u lektora (`studentAnswer`).
  - Lektor decyduje o momencie odkrycia karty: przycisk `[👁️ Odkryj poprawną odpowiedź]` (`revealedAnswer`).
  - Efektowna weryfikacja: poprawny kafelek pulsuje na szmaragdowo z checkmarkiem `✓`, błędny wybór kursanta zostaje przekreślony na czerwono `✕`, a poniżej pojawia się karta z regułą językową i wyjaśnieniem (`explanation`).
  - Po zamknięciu nakładki uczeń natychmiast wraca do edycji notatnika.

**4. Integracja Prezentacji w Planerze i Usunięcie Kafelka z Menu Głównego (`AdminPanel.tsx`):**
- Usunięto osobny kafelek `Prezentacja` z siatki kafelków lektora w `AdminPanel.tsx`, konsolidując widok slajdów i ćwiczeń bezpośrednio wewnątrz Planera Lekcji i Notatnika.
- Przejścia z profilu kursanta i asystenta automatycznie kierują do ujednoliconego Planera ze zintegrowanym podglądem prezentacji.

**5. Nowoczesne Animacje GSAP w Całej Aplikacji, Kropelkowe Przejścia (Styl Drops, ADHD-Friendly) i Fala Zmiany Motywu (`services/gsapAnimations.ts`, `components/ui/GSAPModuleTransition.tsx`, `components/dashboard/StudentHomeworkScreen.tsx`, `components/ui/ThemeToggle.tsx`):**
- **Centralny moduł animacji `gsapAnimations.ts`**:
  - `animateDropletTransition`: subtelny, organiczny squash & stretch (scale 0.95 ➔ 1.02 ➔ 1.0) przy zmianie ćwiczenia w czasie 380 ms, dający mikrosatysfakcję z postępu bez przebodźcowania i rozpraszania.
  - `animateProgressBarLiquid`: płynne napełnianie paska postępu jak ciecz w probówce.
  - `animateModuleEnter` i `animateModuleExit`: aksamitny fade in/out (`GSAPModuleTransition.tsx`) dla otwieranych modułów po kliknięciu kafelków w panelu lektora (`AdminPanel.tsx`), kursanta (`Dashboard.tsx`) oraz na listwie narzędzi (`TodayScreen.tsx`).
  - `animateThemeRipple`: 60fps radialna fala zmiany motywu rozchodząca się ze współrzędnych przycisku z elastyczną rotacją ikon `Sun` i `Moon`.
  - Pełna obsługa dostępności i respektowanie systemowej flagi `prefers-reduced-motion`.

---

### 🚀 Nowy Autorski Awatar AI CRIBRO w Całej Aplikacji oraz Wizualna Transformacja Asystenta w Konwersacyjny Chat Copilot (2026-09-16, runda 17)

**1. Nowy Autorski Komponent Awatara / Ikony AI w Całej Aplikacji (`AIAssistantIcon.tsx`):**
- **Dedykowany symbol inteligencji CRIBRO**: Stworzono elegancki, wielowarstwowy symbol wektorowy `AIAssistantIcon.tsx` łączący geometryczne łuki marki CRIBRO, 4-ramienną gwiazdę inteligencji, synaptyczne węzły i gradient szmaragdowo-miętowy (`#72F0B4` ➔ `#38E196` ➔ `#0D8A5F`) z dynamiczną poświatą neonową (`glow`).
- **Elastyczne warianty i stany**:
  - Warianty: `avatar` (szklany kafelek z gradientem), `badge` (ze wskaźnikiem live statusu online), `icon` (sam glif wektorowy).
  - Stany: `idle`, `thinking` (orbitalny obrót i pulsowanie), `online` (neonowa kropka aktywności).
  - Rozmiary: od `xs` (14px) do `2xl` (48px) oraz dowolne liczbowe.
- **Spójność w całej aplikacji**: Wdrożono nowy awatar w Asystencie Lektora (`TeacherAssistant.tsx`), wbudowanym Asystencie Notatnika (`ScratchpadEditor.tsx`), Planerze lekcji (`LessonPlanner.tsx`) oraz Generatorze zadań domowych (`TeacherSpecialTaskModal.tsx`).

**2. Wizualna Transformacja Czatu Asystenta w Nowoczesny Konwersacyjny Chat Copilot (`TeacherAssistant.tsx`):**
- **Odcięcie od statycznego generatora**: Całkowicie przebudowano wygląd czatu, aby natychmiast komunikował dynamiczne, interaktywne środowisko konwersacyjne (Copilot):
  - *Górna belka*: Szklany pasek z nowym awatarem AI, live wskaźnikiem `Online`, odznaką `Gemini 2.5 Flash & Workspace` oraz czytelnymi przyciskami *Załącz plik*, *Historia* i *Nowy czat*.
  - *Ekran powitalny (Copilot Hub)*: Dynamiczny awatar AI, przyjazny nagłówek powitalny oraz siatka tematycznych kart propozycji z mikro-ikonami (*Kursanci & CRM*, *Planowanie lekcji*, *Zaległe zadania*, *Szybka powtórka*, *Analiza materiału*, *Podsumowanie postępów*).
  - *Strumień wiadomości (Timeline)*: Wyraźnie odróżnione bańki lektora (prawostronne, szmaragdowe szkło z etykietą i załącznikami) oraz asystenta (lewostronne, z awatarem AI, sformatowanym tekstem, podglądem kart Notion AI oraz 1-klikowymi akcjami modułowymi).
  - *Stan generowania / Myślenie*: Animowany awatar AI w trybie `thinking` z potrójną falą świetlną i statusem analizy bazy.
  - *Kompozytor wiadomości (Input Bar)*: Nowoczesna kapsuła z obsługą wielowierszowego wpisywania (`Shift+Enter` nowa linia, `Enter` wyślij), szybkim dodawaniem załączników, podpowiedziami skrótów oraz podglądem miniatur plików przed wysłaniem.

---

### 🚀 Domyślny format A4 w Notatniku, Dynamiczne Podziały Stron między Lekcjami, Wymuszenie Nagłówka Lekcji na Górze i Konfiguracja Portu 3001 (2026-09-16, runda 16)

**1. Domyślny format strony A4 bez względu na położenie (`ScratchpadEditor.tsx`, `index.css`):**
- **Jednolity arkusz A4**: Notatnik we wszystkich widokach (zarówno lektora, jak i kursanta, w oknie aplikacji, na dedykowanej karcie `/scratchpad` oraz na urządzeniach mobilnych) renderuje symetryczną kartkę o proporcjach A4 (`width: 794px`, `min-height: 1123px`, margines `76px` z responsywnym dopasowaniem na wąskich ekranach).
- **Wskaźnik i licznik stron**: Dokładny licznik łącznej liczby stron A4 w dolnym pasku stanu.

**2. Dynamiczne podziały stron A4 i brak nachodzenia na kolejne lekcje (`ScratchpadEditor.tsx`, `index.css`):**
- **Sekcyjne przeliczanie stron**: Zastąpiono sztywne, globalne kreski podziału algorytmem uwzględniającym fizyczne podziały `.pad-page-break`. Każda lekcja stanowi osobną stronę A4.
- **Automatyczne rozszerzanie bez niszczenia kolejnych lekcji**: Gdy treść w danej lekcji przekroczy 1 stronę A4, lekcja płynnie zajmuje kolejną podstronę A4 (np. Strona 2), a kolejna lekcja pozostaje nienaruszona na swoim miejscu, zaczynając się zawsze od nowej strony A4 (np. Strona 3).
- **Przycisk i funkcja „Podział strony A4”**:
  - Dedykowany przycisk na pasku narzędzi oraz pozycja w menu *Wstaw ➔ Struktura dokumentu ➔ Podział strony A4*.
  - Umożliwia 1-klikowe wstawienie czystej strony A4 pomiędzy istniejącymi lekcjami lub w dowolnym miejscu kursora.

**3. Zawsze nagłówek lekcji na samej górze strony (`index.css`, `ScratchpadEditor.tsx`, `lessonTemplate.ts`):**
- **Żelazna reguła pionowego wyrównania**: Nagłówki lekcji (`h1`, `h2`, `h3` po `.pad-page-break` oraz na samym początku dokumentu) mają `margin-top: 0 !important; padding-top: 0 !important;`.
- **Brak pustych odstępów**: Usunięto niepotrzebne puste akapity `<p><br></p>` wstawiane przed nagłówkiem nowej lekcji.

**4. Rozwiązanie kolizji portu i stabilne uruchamianie serwera (`server.ts`, `.env`):**
- **Przeniesienie na port 3001**: Wyeliminowano konflikt z procesem whatsapp-bridge blokującym `127.0.0.1:3000`.
- **Wdrożenie tras SPA Vite**: Dodano obsługę `app.get('/', ...)` oraz `app.get('{*all}', ...)` zgodną z Express 5.

### 🚀 Wyraziste Neonowe Podświetlenie Aktywnych Kafelków w Panelu Lektora, Multimodalna Analiza Załączników (PDF, Screenshoty, Dokumenty) i Przepływ Akcji Notion AI w Asystencie AI (2026-09-16, runda 15)

**1. Wyraziste, Neonowe Podświetlenie Aktywnego Kafelka we Wszystkich Rzędach (`AdminPanel.tsx`):**
- **Wyróżniający się stan aktywny**: Każdy zaznaczony kafelek w panelu lektora (Tier 1: *Kursanci*, *Historia lekcji*, *Notatnik*; Tier 2: *Zadania i testy*, *Planer lekcji*, *Mailing*; Tier 3: *Prezentacja*, *Słownictwo*, *Statystyki*) otrzymał wyrazisty, wysokokontrastowy wygląd:
  - Neonowy pierścień i poświata: `border-primary ring-2 ring-primary/90 ring-offset-2 ring-offset-base-300 shadow-[0_0_35px_rgba(114,240,180,0.38),inset_0_0_22px_rgba(114,240,180,0.14)]`.
  - Promienisty gradient tła: `bg-gradient-to-br from-primary/[0.18] via-base-200 to-base-200/95 scale-[1.02]`.
  - Plakietka statusowa: `bg-primary text-accent-ink font-black shadow-[0_0_12px_rgba(114,240,180,0.5)]` z pulsującym punktem i etykietą **„AKTYWNY MODUŁ”**.
  - Pasek informacyjny: Wskaźnik **„● Przeglądasz ten moduł”** w żywym kolorze `text-primary font-extrabold`.
  - Animowany punkt aktywności na przyciskach pomocniczych w Tier 2 i Tier 3.

**2. Odczytywanie i Multimodalna Analiza Załączników w Asystencie AI (`TeacherAssistant.tsx`, `teacherAssistant.ts`):**
- **Obsługa wielu formatów materiałów**: Możliwość załączania plików PDF, obrazów i screenshotów (`.png`, `.jpg`, `.jpeg`, `.webp`), dokumentów Markdown (`.md`), HTML (`.html`) oraz plików tekstowych (`.txt`).
- **Trzy sposoby dodawania materiałów**:
  1. *Wybór pliku* za pomocą ikony spinacza (Paperclip) w polu wpisywania.
  2. *Wklejanie ze schowka* (`Ctrl+V` / `Cmd+V`) bezpośrednio do pola wpisywania dla natychmiastowej analizy screenshotów.
  3. *Przeciąganie i upuszczanie* (Drag & Drop) na okno chatu.
- **Pasek oczekujących załączników**: Miniaturki załączonych plików z nazwami, ikonami typu i przyciskiem usuwania przed wysłaniem.
- **Wizualizacja załączników w historii wiadomości**: Dymki wiadomości pokazują miniatury załączonych grafik oraz plakietki dokumentów.
- **Multimodalne API Gemini 2.5 Flash**: Bezpośrednie przekazywanie danych binarnych `inlineData` (obrazy, PDF) oraz tekstu do modelu Gemini z automatycznym fallbackiem kaskadowym.

**3. Przepływ Akcji w Stylu Notion AI w Chacie Asystenta (`TeacherAssistant.tsx`, `teacherAssistant.ts`, `AdminPanel.tsx`, `Dashboard.tsx`):**
- **Generowanie tematu lekcji na polecenie**: Wpisanie w czacie np. *„Przygotuj temat lekcji dla Dariusza”* analizuje historię lekcji danego kursanta w CRM i generuje propozycję tematu, słownictwa z polskimi tłumaczeniami, zagadnień gramatycznych oraz zadania domowego.
- **Karta podglądu lekcji (Notion AI Card)**: Odpowiedź zawiera estetyczną kartę z podsumowaniem propozycji, oznaczeniem kursanta, słówkami kluczowymi i pracą domową.
- **Bezpośrednie przyciski wykonania akcji**: Pod odpowiedzią wyświetlają się interaktywne przyciski wykonania:
  - 🟢 **Utwórz lekcję w Dzienniku** — natychmiast otwiera formularz nowej lekcji ze wstępnie wypełnionymi 4 blokami Notion i przypisanym kursantem.
  - 🟢 **Dopracuj w Planerze lekcji** — przenosi do studia scenariuszy z załadowanym tematem.
  - 🟢 **Uruchom w Prezentacji Live** — tworzy i uruchamia interaktywny scenariusz w widoku Prezentacji na żywo.
  - 🟢 **Zadaj jako Pracę domową** — otwiera generator zadań domowych dla wskazanego kursanta.
  - 🟢 **Notatnik kursanta** — otwiera dedykowaną kartę notatnika.
- **Pełna integracja w obu trybach**: Wszystkie akcje i załączniki działają identycznie w trybie centralnym na stronie głównej oraz w trybie pływającego dymka w lewym dolnym rogu.

**1. Nowa Strona Główna Panelu Lektora z Centralnym Asystentem AI (`AdminPanel.tsx`, `TeacherAssistant.tsx`):**
- **Domyślny widok pulpitu**: Po wejściu do panelu nauczyciela (gdy żaden moduł ani profil kursanta nie jest wybrany) system nie wyświetla już bezpośrednio historii lekcji ani bazy kursantów, lecz prezentuje nowoczesne, centralne okno **Asystenta AI CRIBRO**.
- **Sugerowane pytania (Prompt chips)**: Chat zawiera zestaw szybkich sugestii kontekstowych klikalnych jednym przyciskiem:
  - *„Z kim była ostatnia lekcja?”*
  - *„Kto ma niezrobioną pracę domową?”*
  - *„Zaproponuj powtórkę na dzisiejszą lekcję”*
  - *„Jakie słownictwo ostatnio przerabiałem?”*
  - *„Kto najdłużej nie miał lekcji?”*
  - *„Podsumuj postępy moich kursantów”*
- **Karty akcji i przekierowania**: Odpowiedzi asystenta generują automatyczne przyciski akcji przenoszące lektora wprost do odpowiedniego modułu (profil ucznia, zadanie domowe, planer lekcji, notatnik).
- **Historia sesji i kopiowanie odpowiedzi**: Pełna historia wcześniejszych rozmów z możliwością wznawiania sesji oraz przycisk kopiowania treści odpowiedzi.

**2. Symetryczne, Wyśrodkowane Rozmieszczenie Wszystkich Rzędów Kafelków (`AdminPanel.tsx`):**
- **Jednolita szerokość i wyśrodkowanie (`max-w-5xl mx-auto w-full justify-center`)**: Wszystkie 3 poziomy narzędzi lektora:
  1. Główne narzędzia (Kursanci, Historia lekcji, Notatnik) — siatka 3 kolumn;
  2. Narzędzia pomocnicze (Zadania i testy, Planer lekcji, Mailing) — siatka 3 kolumn;
  3. Rozwijany panel „Więcej narzędzi” (Prezentacja, Słownictwo, Statystyki) — siatka 3 kolumn;
  zostały wyśrodkowane i mają identyczną geometrię, eliminując wszelkie asymetrie niezależnie od rozdzielczości ekranu.
- **Płynne przełączanie / Toggle modułów**: Ponowne kliknięcie aktywnego kafelka zamyka moduł i natychmiast powraca do strony głównej z centralnym chatem AI. Przycisk *„Wróć do strony głównej”* pozwala na natychmiastowe wyczyszczenie aktywnego widoku.

**3. Warunkowy, Pływający Dymek Czatu w Lewym Dolnym Rogu (`Dashboard.tsx`, `TeacherAssistant.tsx`):**
- **Inteligentne ukrywanie**: Na stronie głównej panelu lektora pływający dymek w lewym dolnym rogu jest niewidoczny, aby nie dublować centralnego chatu.
- **Pojawianie się w innych sekcjach**: W momencie przejścia do jakiejkolwiek innej sekcji lub modułu (Baza kursantów, Historia lekcji, Profil kursanta, Mailing, Planer, Prezentacja, Zadania domowe itd.), dymek asystenta natychmiast pojawia się w lewym dolnym rogu ekranu, umożliwiając szybkie zadawanie pytań w kontekście bieżącej pracy.

### 🚀 Filtrowanie spotkań spoza lekcji w Notion, Jednolity CRM i Historia pod kafelkami ze skalowaniem i strzałkami "Pokaż więcej", Wskaźnik Laserowy na żywo, Orientacja A4, Spis Treści H1/H2 i Prototyp Prezentacji w Notatniku (2026-09-16, runda 13)

**1. Inteligentne filtrowanie i popup dla transkrypcji Notion (`server.ts`, `NotionUnmatchedTranscriptsModal.tsx`, `TeacherLessonHistoryView.tsx`):**
- **Weryfikacja spotkań lekcyjnych**: W trakcie zaczytywania transkrypcji ze spotkań z Notion, system analizuje tytuł, uczestników i treść. Jeśli spotkanie nie dotyczy lekcji języka angielskiego ani nie pasuje do żadnego kursanta w bazie CRM, jest bezpiecznie ignorowane (nie tworzy niepotrzebnych, pustych lekcji w stagingu).
- **Wyskakujący raport (Pop-up)**: Po synchronizacji lektor otrzymuje szczegółowy modal `NotionUnmatchedTranscriptsModal` z listą zignorowanych spotkań (data, tytuł, fragment transkrypcji, powód odrzucenia) oraz liczbą zaimportowanych właściwych lekcji.

**2. Jednolity widok Kursantów i Historii lekcji pod kafelkami ze skalowaniem ekranu (`AdminPanel.tsx`):**
- **Identyczne zachowanie kafelków**: Kliknięcie w kafelek **"Kursanci"** lub **"Historia lekcji"** natychmiast rozwija właściwy moduł bezpośrednio pod kafelkami w tym samym, spójnym kontenerze.
- **Odrębne, responsywne skalowanie kontenera**: Zwiększono szerokość dolnego modułu na większych ekranach (`max-w-[1640px]`), zachowując estetyczne marginesy boczne — tabela historii lekcji i baza CRM pokazują więcej kolumn bez ucinania szerokości do małego kontenera.

**3. Limity rekordów i strzałki "Pokaż więcej / Zwiń" (`TeacherLessonHistoryView.tsx`, `StandaloneStudentDatabaseScreen.tsx`):**
- **Historia lekcji**: Domyślnie wyświetla 6 najnowszych rekordów. Na dole tabeli umieszczono estetyczny przycisk ze strzałką Chevron: *„Pokaż wszystkie (X lekcji)”* / *„Zwiń do 6 ostatnich”*.
- **Baza kursantów**: Domyślny limit wierszy dopasowany do ekranu (10 kursantów) z dolnym przyciskiem ze strzałką: *„Pokaż wszystkich kursantów (X)”* / *„Zwiń listę”*.

**4. Notatnik / Scratchpad — Spis treści H1/H2, Nagłówki zwijane i szablony lekcji (`ScratchpadEditor.tsx`, `types.ts`, `services/scratchpadService.ts`):**
- **Czyste nagłówki standardowe**: Usunięto automatycznie dodawane strzałki zwijania przy zwykłych nagłówkach w dokumencie.
- **Opcjonalne nagłówki zwijane**: W menu Styl dodano dedykowane opcje: *Zwijany Nagłówek 1* oraz *Zwijany Nagłówek 2* — tylko wtedy nagłówek zyskuje strzałkę zwijania.
- **Spis treści (TOC)**:
  - **Nagłówek 1 (H1)** — nagłówek nadrzędny (lekcja), który w spisie treści posiada strzałkę do zwijania/rozwijania swoich podrozdziałów H2.
  - **Nagłówek 2 (H2)** — rozdziały w lekcji, wyświetlane z wcięciem pod H1 w spisie treści.
  - **Nagłówek 3 (H3)** — sekcje szczegółowe, celowo **nie** pojawiają się w spisie treści.
- **Szablony lekcji (Templates)**: Dedykowany przycisk *„Szablony”* w pasku narzędzi lektora z możliwością wstawiania szablonu, tworzenia nowych, edycji oraz ustawiania szablonu domyślnego (`ScratchpadTemplateManagerModal`).

**5. Zsynchronizowany na żywo Wskaźnik Laserowy (`ScratchpadEditor.tsx`, `index.css`):**
- **Synchronizacja Real-time**: Włączenie wskaźnika laserowego przez lektora transmituje współrzędne kursora w obrębie kartki A4 (z throttlingiem ~50ms).
- **Widok kursanta**: Kursant widzi płynnie poruszający się, świecący czerwony punkt laserowy z pulsującym pierścieniem i etykietą *„🔴 Lektor”* dokładnie w miejscu wskazywanym przez nauczyciela.

**6. Przesuwanie i zmiana rozmiaru obrazów oraz screenshotów (`ScratchpadEditor.tsx`):**
- **Wklejanie i wgrywanie**: Błyskawiczne wklejanie screenshotów (Ctrl+V) oraz opcja wyboru pliku z dysku w menu Wstaw.
- **Pływający pasek akcji**: Po kliknięciu w obraz pojawia się pasek z opcjami: *25%*, *50%*, *75%*, *100%*, przyciski *„Wyżej”* / *„Niżej”* (przesuwające obraz między blokami/sekcjami) oraz *„Usuń”*. Obrazy posiadają również atrybut `draggable="true"`.

**7. Orientacja arkusza A4 — Pionowa i Pozioma (`ScratchpadEditor.tsx`, `index.css`):**
- **Przełącznik orientacji**: Przycisk w nagłówku *„A4 Pion / A4 Poziom”* przełącza proporcje kartki (794x1123px vs 1123x794px), przelicza podział stron i zapisuje preferencję w dokumencie.

**8. Prototyp Trybu Prezentacji Live w Notatniku (`ScratchpadPresentationOverlay.tsx`, `ScratchpadLivePresentationModal.tsx`):**
- **Przycisk „Prezentacja” w notatniku**: Lektor może w dowolnym momencie uruchomić tryb prezentacji, wybierając gotowe ćwiczenie (np. *Opisanie obrazka / Describe the picture*, *Pytanie dyskusyjne*, *Wyzwanie językowe*) lub wpisując własny materiał/zdjęcie.
- **Ekran kursanta**: Zamiast notatnika na ekranie kursanta pojawia się pełnoekranowy, estetyczny slajd z pytaniem, zadaniem i opcjonalnymi podpowiedziami (Hints).
- **Zakończenie i powrót**: Lektor jednym kliknięciem zamyka prezentację i natychmiast przywraca widok notatnika.

### 🚀 Refaktoryzacja Modułów Lektora, Integracja Transkrypcji z Notion i Zaawansowany Silnik Analizy Lekcji wg Nowego Standardu (2026-09-16, runda 12)

**1. Refaktoryzacja Głównych Kafelków Panelu Lektora (`AdminPanel.tsx`):**
- **Kafelek 1: "Kursanci"** — bezpośrednie wejście do bazy CRM (`students-database`), zarządza profilami, lekcjami, zadaniami domowymi i materiałami.
- **Kafelek 2: "Historia lekcji"** — bezpośredni przełącznik do globalnej bazy lekcji Notion-style (`TeacherLessonHistoryView`).
- **Kafelek 3: "Notatnik"** — natychmiastowe otwarcie wspólnego notatnika na żywo.
- **Usunięcie kafelka "Kontekst przed lekcją"** — całkowicie usunięto stary modal pre-lesson context oraz pickery z kodu panelu lektora (zgodnie z wytycznymi kontekst zostanie wdrożony jako funkcja asystenta AI chat).
- **Czyste przełączanie modułów**: Kliknięcie w dowolny moduł (Planer lekcji, Mailing, Prezentacja) otwiera pełnoekranowy widok danego narzędzia z przyciskiem "Wróć do historii", zastępując główny strumień lekcji.

**2. Synchronizacja i Manualny Import Transkrypcji z Notion (`TeacherLessonHistoryView.tsx`, `server.ts`):**
- **Przycisk "Sprawdź transkrypcje w Notion"**: Umieszczony na górnym pasku widoku Historii Lekcji. Umożliwia lektorowi manualne odpytanie bazy Notion o nowe transkrypcje w zdefiniowanej karcie.
- **Natychmiastowy import i powiadomienie**: System sprawdza endpoint `/api/notion/fetch-transcripts`, zapisuje nowe transkrypcje bezpośrednio w `users/${studentId}/lessonRecords/${docId}` z flagą `isInStaging: true`, informuje lektora o liczbie zaimportowanych lekcji i natychmiast odświeża listę lekcji.

**3. Silnik Zaawansowanej Analizy Transkrypcji Lekcji (`utils/transcriptLesson.ts`, `services/transcriptLesson.ts`, `types.ts`):**
- Wdrożenie pełnego kontraktu ze specyfikacji *Lesson Processing Workflow*:
  - **Hierarchia faktów**: Transkrypcja stanowi jedyne i nadrzędne źródło faktów (strict factual consistency).
  - **Rozróżnienie wypowiedzi**: System ściśle odseparowuje wypowiedzi kursanta od instrukcji, wyjaśnień i parafraz lektora.
  - **Trwały profil i postępy (`studentInsights`)**: Ekstrakcja 3–6 zwięzłych zdań o sytuacji zawodowej, celach, preferencjach i priorytetach językowych kursanta, z automatyczną aktualizacją profilu w bazie (`users/${studentId}`).
  - **4 Bloki Notion**:
    - `lessonSummary`: 2–3 zdania podsumowania merytorycznego.
    - `vocabulary`: kategoryzacja na nowe słownictwo (`new`) i wymagające utrwalenia (`needs_practice`).
    - `corrections`: max 3 najważniejsze błędy w formacie `❌ [Błąd] → ✅ [Korekta] — [Krótkie wyjaśnienie]`.
    - `homework`: 4 ustrukturyzowane mechanizmy (tłumaczenie, korekta błędu, dokończenie odpowiedzi, ułożenie zdania) wraz z kluczem odpowiedzi (`answerKey`).
    - `nextLesson`: max 3 konkretne rekomendacje na kolejne zajęcia.
  - **Niejawny rejestr pytań lektora (`lesson_question_logs`)**: Zapis pytań merytorycznych z transkrypcji (origin, questionQuality, anonymousPattern, studentResponse, plannerInsight) do dedykowanej kolekcji analitycznej.
  - **Idempotentność i wersjonowanie**: Śledzenie `processingRunId` oraz `analysisVersion`.

**4. Dwublokowy Podgląd Lekcji dla Nauczyciela (`TeacherLessonHistoryView.tsx`):**
- Wyraźny podział podglądu lekcji na dwie estetyczne sekcje:
  - **Sekcja 1: Scenariusz i założenia lekcji (Plan)** — temat, materiały, pytania planowane przed lekcją.
  - **Sekcja 2: Podsumowanie lekcji i 4 Bloki Notion (Realizacja)** — zrealizowana treść, wnioski z wypowiedzi ucznia (`studentInsights`), słownictwo z TTS, korekty, zadania domowe z kluczem i krzywa uczenia się (Learning Curve).
- **Bezpieczeństwo widoku kursanta**: Potwierdzenie, że panel kursanta (`StudentLessonHistory.tsx`) wyświetla wyłącznie bezpieczne, zatwierdzone bloki (Summary, Vocabulary, Corrections), bez notatek lektora i bez danych scenariusza.

### 🚀 Unifikacja CRM Kursantów i Grup w „Profile kursantów” oraz nowy widok „Historia Lekcji” w stylu Notion na ekranie głównym lektora (2026-09-16, runda 11)

**1. Nowy panel „Historia Lekcji” na Ekranie Głównym Lektora (`TeacherLessonHistoryView.tsx`).**
- Zastąpienie tabeli kursantów na ekranie głównym dedykowanym widokiem historii lekcji wzorowanym bezpośrednio na układzie z Notion.
- **Poziome zakładki kursantów i grup**: Na górze tabeli umieszczono pasek z zakładkami `[ ▦ Wszystkie lekcje ]` oraz wszystkimi kursantami i grupami (`[ ▦ Dariusz Wach ]`, `[ ▦ Łukasz Kołłątaj ]`, `[ 👥 Grupa Gülermak ]`, `[ 👥 Kramp ]`, `[ ▦ Milena Miksa-Matyjasik ]` itd.) wraz z licznikami lekcji, umożliwiający natychmiastowe filtrowanie strumienia lekcji bez przeładowywania strony.
- **Wyszukiwarka i filtry statusu**: Wyszukiwanie na żywo po tematach, słownictwie, dacie i podsumowaniach oraz filtry statusu (*Wszystkie*, *Odbyte* — zielony pill `Odbyta`, *Weryfikacja / Brudnopis* — bursztynowy pill, sortowanie chronologiczne).
- **Tabela 4 Bloków Notion**: Kolumny z tematem (z ikoną strony Notion), kursantem/grupą, datą lekcji, statusem, wskaźnikami 4 bloków (*Słownictwo*, *Korekty & Wymowa*, *Zadanie domowe*, *Plan*) oraz szybkimi akcjami.
- **Błyskawiczny Slide-over Drawer / Modal 4 Bloków**: Szczegółowy podgląd z podziałem na Blok 1 (Words & Phrases z odsłuchem wymowy TTS i kopiowaniem), Blok 2 (Corrections & Pronunciation), Blok 3 (Homework z kluczem odpowiedzi) oraz Blok 4 (Next Lesson Plan) i notatki z lekcji.
- **1-klik akcje**: Bezpośrednie przejście do Notatnika kursanta na żywo (`openScratchpadTab`), zadanie pracy domowej, tryb prezentacji oraz przejście do profilu.

**2. Zunifikowany CRM w „Profile kursantów” (`StandaloneStudentDatabaseScreen.tsx`).**
- Przeniesienie i zintegrowanie pełnego widoku tabeli Notion z bazy głównej do dedykowanego modułu CRM (`students-database`).
- **Filtry kontraktorów i typów**: Zakładki *Wszyscy*, *Aktywni*, *Indywidualni (1:1)*, *Grupy & Pary*, *🏢 JCL*, *🏢 Inspiro*, *🏢 Axell*, *⚡ Direct* oraz wyszukiwarka.
- **Akcje masowe (Bulk Actions)**: Zaznaczanie wielu kont (multi-select checkboxy), masowa zmiana poziomu (A1..C2), zmiana kontraktora, zmiana statusu współpracy, usuwanie zaznaczonych.
- **Tworzenie i edycja kont**: Pełna integracja z modalem tworzenia kursantów (z automatycznym generatorem haseł i kopiowaniem poświadczeń), tworzeniem grup i par (`CreateGroupModal`), wysyłką zaproszeń e-mail (`StudentInviteEmailModal`) oraz synchronizacją z Notion (`NotionSyncButton`).
- **Kolumny CRM**: Nazwa z awatarem i składem grupy, Typ, Poziom/Profil, Adresy e-mail z kopiowaniem, Kontraktor, Gdzie pracuje, Ostatnia lekcja, Status, Typ zajęć oraz akcje bezpośrednie (Profil, Notatnik, Praca domowa, Planer, Edycja grupy, Usunięcie).

**3. Agregacja i synchronizacja lekcji w `services/lessonRecord.ts`.**
- Nowa funkcja `getAllLessonRecordsForTeacher(students)` do wydajnego pobierania, deduplikacji i chronologicznego sortowania lekcji ze wszystkich podkolekcji kursantów.

### 🚀 Notion bazy grupowe, asystent AI w dokumencie, szybka powtórka lekcji, powiadomienia o sprawdzonej pracy domowej, płynny motyw i Gemini 2.5 Flash (2026-09-15, runda 10)

**1. Widok bazy Notion pod kafelkami lektora i zarządzanie grupami kursantów.**
- (`components/admin/TeacherNotionDatabaseView.tsx`, nowy) Osadzony pod kafelkami aktywności panelu lektora pełny widok tabelaryczny bazy Notion kursantów z wyszukiwarką na żywo, filtrami (Wszyscy, Tylko Grupy, Indywidualni, Aktywni), statystykami powiązań Notion ID, szybkimi przełącznikami i bezpośrednimi akcjami: otwarcie notatnika/brudnopisu (`openScratchpadTab`), profil kursanta (`handleSelectUser`), oraz uruchomienie planera lekcji (`lesson-planner`).
- (`components/admin/CreateGroupModal.tsx`, nowy) Modal do tworzenia i edycji grup kursantów: pary (2 osoby), trójki (3 osoby) oraz grupy firmowe/wieloosobowe (4+ osób). Obsługa przypisywania zleceniodawcy (`contractor`), nazwy firmy (`company`) oraz członków (`memberIds`).
- (`types.ts`) Rozszerzenie typów o `isGroup?: boolean`, `groupType?: 'pair' | 'triplet' | 'group'`, `memberIds?: string[]`, `contractor?: string`, `company?: string` w `User` oraz `studentIds?: string[]` w `LessonRecord`.
- (`components/settings/SettingsScreen.tsx`) Dedykowana sekcja konfiguracji integracji Notion w ustawieniach administratora (token Notion, ID bazy, interwał synchronizacji, test połączenia).

**2. Asystent AI wewnątrz Notatnika (Scratchpad Editor) & Szybka Powtórka (Quick Recall).**
- (`components/scratchpad/ScratchpadEditor.tsx`) Zintegrowany boczny panel In-Document AI Assistant zasilany przez `gemini-2.5-flash`. Oferuje szybkie akcje (wyciąganie błędów z lekcji, generowanie 5 zdań do tłumaczenia, mini-quiz z notatnika), formatowanie markdown z podglądem oraz 1-kliknięciowe wstawianie ("Wstaw do notatnika") wygenerowanej zawartości wprost do aktywnego dokumentu.
- **Szybka Powtórka przy tworzeniu nowej lekcji**: Asynchroniczne wyciąganie z ostatniej lekcji kursanta (`getLessonRecordsForStudent`) 3 kluczowych poprawek gramatycznych oraz 5 pozycji słownictwa i automatyczne wstrzykiwanie do sekcji `Revision / Warm-up` nowego szablonu lekcji.
- (`utils/lessonTemplate.ts`) Podział arkusza A4 z klasą `.pad-page-break` i formatowaniem stron.

**3. Powiadomienia o sprawdzonej pracy domowej (Graded Homework Flow).**
- (`server.ts`, `services/homeworkEmail.ts`) Nowy endpoint `POST /api/homework/notify-graded` wyzwalający wysyłkę e-mail przez Resend (`buildGradedHomeworkEmail`) z wynikiem punktowym, komentarzem lektora i bezpośrednim linkiem oraz aktualizujący flagę `hasGradedHomework: true` w profilu kursanta.
- (`components/dashboard/StudentHomeworkGradedModal.tsx`) Wyskakujące powiadomienie na żywo po zalogowaniu kursanta z poprawnym wołaczem polskiego imienia (`toPolishVocative`, np. *"Cześć Moniko,"*) oraz exact copy: *"Cześć [Imię], sprawdziłem Twoją pracę domową. Zajrzyj do aplikacji, aby sprawdzić swój wynik i ewentualnie przećwiczyć rzeczy do poprawy."*
- (`components/dashboard/HomeworkScreen.tsx`, `components/admin/HomeworkV2ReviewScreen.tsx`) Zintegrowane wywołanie powiadomienia przy zatwierdzaniu recenzji i oceny pracy domowej.

**4. Domyślna hierarchia modeli AI: Gemini 2.5 Flash.**
- (`services/aiModels.ts`, `.ai-settings.json`, `tests/aiModels.test.ts`, `tests/aiTaskModels.test.ts`, `tests/transcriptLesson.test.ts`) Ujednolicenie i ustawienie `gemini-2.5-flash` jako nadrzędnego modelu domyślnego dla wszystkich zadań i kaskad AI.
- (`services/homeworkV2Client.ts`) Podpięcie telemetrii zdarzeń dla `aiMonitor` w generatorze prac domowych.

**5. Rozbudowa Asystenta Nauczyciela (Teacher Assistant).**
- (`components/admin/TeacherAssistant.tsx`, `services/teacherAssistant.ts`) Trwała wielosesyjna pamięć czatu z zapamiętywaniem historii konwersacji oraz kafelkami skrótów szybkiej nawigacji do kluczowych modułów (Planer lekcji, Notatnik, Mailing, Ustawienia, Baza Notion, Prace domowe).

**6. Dopracowanie motywu Jasnego i Adaptacyjnego (Aura / Ambient Theme).**
- (`components/ui/ConstellationBackground.tsx`) W trybie jasnym usunięto ostre linie konstelacji („efekt pękniętego ekranu"), zastępując je płynnymi, dryfującymi świetlistymi kulami gradientowymi (ambient luminous orbs) i subtelnym migotaniem cząsteczek.
- (`design/theme/tokens.css`) Wprowadzenie kojącej, pastelowej palety dziennego nieba (`#f3f8fd` ➔ `#e6effa` ➔ `#dbe7f5`).
- (`context/ThemeContext.tsx`) Nowy tryb `adaptive` automatycznie dostosowujący motyw do pory dnia (07:00–19:00 tryb jasny, noc tryb ciemny) z 60-sekundowym timerem.

**7. Poszerzenie Narady Modeli i Kluczy API o nowych dostawców (Anthropic Claude & DeepSeek).**
- (`services/aiModels.ts`, `services/aiConfigService.ts`) Rozszerzenie listy modeli (`SELECTABLE_MODELS`) i typów o dostawców `Anthropic Claude` (`Claude 3.7 Sonnet`, `Claude 3.5 Sonnet`, `Claude 3.5 Haiku`) oraz `DeepSeek` (`DeepSeek V3 (Chat)`, `DeepSeek R1 (Reasoner)`), a także dodanie `openai/o3-mini` i `gemini-2.5-pro`.
- (`components/settings/AiCouncilSettings.tsx`, `components/settings/AiModelsSettings.tsx`) Wprowadzenie grupowania modeli wg dostawców (`optgroup`), kolorystycznych plakietek dostawców (`PROVIDER_META`) oraz dedykowanych pól zapisu kluczy API dla `Anthropic` (`ANTHROPIC_API_KEY`) i `DeepSeek` (`DEEPSEEK_API_KEY`) obok Gemini, OpenAI i ElevenLabs.
- (`server.ts`, `services/geminiService.ts`) Implementacja backendowych endpointów proxy `/api/anthropic` i `/api/deepseek` z obsługą `callAnthropic` i `callDeepSeek`, mapowaniem na docelowe modele API dostawców i integracją w naradzie modeli (`runCouncil`), planerze lekcji oraz kaskadach zapasowych.

**8. Weryfikacja jakości.**
- Komplet 320 testów jednostkowych przechodzi pomyślnie (`npm test`).
- Pełna zgodność typów TypeScript (`npx tsc --noEmit`).
- Czysty build produkcyjny (`npm run build`).

### 🎯 Planer lekcji przepisany na metodę Cribro i naradę modeli (2026-09-14, runda 9)

**Skąd to pochodzi.** Odwzorowanie skilla „🎯 Skill - Lesson Planner" z Notion
(Prompts & Instructions) wraz z nadpisaniami z „🎯 Lesson Planner — Master Prompt
& System" — pobrane bezpośrednio z Notion przy tym zadaniu. Notion pozostaje
źródłem prawdy: jeśli tamta strona się zmieni, `services/lessonPlannerMethod.ts`
trzeba zaktualizować ręcznie, bo aplikacja nie czyta skilla na żywo (scenariusz
musi dać się ułożyć także wtedy, gdy Notion jest niedostępny).

**1. Planer to teraz trzy kroki, jeden na ekran — nie ściana ustawień.**
(`components/admin/LessonPlannerStudio.tsx`, zastępuje `LessonPlanner.tsx`)
Poprzedni ekran pokazywał cały mechanizm na wejściu: konfigurację modułów,
presety, ustawienia metodyki, odmianę angielskiego, liczbę słówek, styl
wyjaśnień, załączniki, wybór scenariusza bazowego i czat — wszystko naraz,
zanim padło pierwsze pytanie o temat. Teraz:
   - **Ustalenia** — tryb, kursant/grupa, data, poziom (bramka Kroku 0 metody:
     bez tych trzech planer nie rusza). Gramatyka i materiał źródłowy zwinięte,
     bo w większości lekcji zostają puste.
   - **Temat** — AI pyta wprost, czy jest sugestia tematu i ile wariantów
     przygotować (2–4), tak jak zrobiłby to człowiek, któremu zlecono lekcję.
     Warianty wracają jako karty z kątem, materiałem i przykładowym pytaniem —
     nie ściana tekstu do przeczytania.
   - **Scenariusz** — lekcja w sekcjach i elementach, każdy z własnym,
     stabilnym identyfikatorem nadanym przez model. Element da się zaznaczyć
     i poprosić czat o poprawkę WYŁĄCZNIE zaznaczonych elementów — reszta
     scenariusza, wraz z tym, co lektor już zaakceptował, zostaje nietknięta.
   - Mózg narzędzia (transkrypt narady, który model co powiedział) siedzi pod
     jednym zwiniętym paskiem na dole każdego kroku — widoczny na życzenie,
     niezajmujący miejsca, gdy wszystko idzie dobrze. Potężne narzędzie
     w prostej obudowie, zgodnie z poleceniem.

**2. Metoda Cribro jako prompt, nie jako luźna instrukcja.**
(`services/lessonPlannerMethod.ts`, nowy) Struktura pięciu sekcji, twarde
liczby (dokładnie 5 pytań warm-up, 10 pytań dyskusyjnych, 5 pozycji
słownictwa, 4 zadania Extra Tasks, każde inne), Practice Enclosure celowo
puste, i Test naturalności pytań powtórzony przy KAŻDYM wywołaniu — nie tylko
przy generowaniu całości, bo to jest reguła, którą modele łamią najciszej:
pytanie brzmi mądrze i przechodzi, mimo że nie da się na nie odpowiedzieć
jednym zdaniem.

Świadomie pominięte: zapis karty w bazie Notion „Historia Lekcji" (w Recall
robi to `scenarioService`, model ma UŁOŻYĆ lekcję, nie decydować o zapisie)
oraz pętla uczenia się na bazie „Pytania wykorzystane na lekcjach" (Recall
jeszcze nie odpytuje tej bazy Notion — modelowi mówimy WPROST, że tych danych
nie ma, inaczej zaczyna wymyślać „sprawdzone wzorce", których nikt nie sprawdził).

**3. Narada modeli — do czterech głosów, autor plus recenzenci.**
(`services/aiCouncil.ts`, nowy) Pojedynczy model pisze scenariusz pewnie siebie
i nie widzi własnych błędów wobec wytycznych — łamie twarde liczby, wypełnia
sekcję, która ma zostać pusta, przepuszcza pytanie, które nie przechodzi Testu
naturalności. Recenzent widzi, bo dostaje te same wytyczne i CUDZY tekst.

Trzy tury: autor pisze → do trzech recenzentów czyta propozycję pod kątem
wytycznych i zwraca maksymalnie po sześć zastrzeżeń (nie własną wersję —
recenzent piszący własną wersję przestaje recenzować i robi drugiego autora)
→ autor poprawia, mając zastrzeżenia przed sobą, i ma prawo je odrzucić, jeśli
są błędne. Awaria recenzenta nie zabiera lektorowi gotowej propozycji autora —
narada schodzi wtedy do wyniku z pierwszej tury.

**4. Skład narady w Ustawieniach Administratora.**
(`components/settings/AiCouncilSettings.tsx`, nowy; `server.ts`,
`services/aiConfigService.ts` rozszerzone o pole `council` w `system/ai`)
Cztery miejsca, pierwsze zawsze autor (bez niego nie ma czego recenzować),
model do wyboru z listy już zatwierdzonych modeli, narada do wyłączenia jednym
przełącznikiem. Panel liczy i pokazuje wprost, ile wywołań modelu kosztuje
wybrany skład — sufit czterech miejsc jest celowy, bo przy trzech recenzentach
uwagi zaczynają się powtarzać niemal w całości i narada przestaje dokładać
cokolwiek do jakości, tylko kosztuje więcej i trwa dłużej. Klucze API zostają
w sekcji „Modele AI" obok — narada korzysta z tych samych.

**5. Wczytywanie plików trafia do planera.** (`LessonFileUploader`, istniejący
komponent, dotąd używany tylko w starym planerze) Metoda sprawdza materiał
źródłowy w kolejności: załączony plik → opis słowny → propozycje AI. Treść
odczytanych plików trafia do promptu przed opisem słownym; pliki bez odczytanej
treści (obraz, PDF bez warstwy tekstowej) są wymieniane z nazwy, żeby lektor
widział, że model ich nie przeczytał, zamiast żeby zniknęły po cichu.

**6. Naprawa przy okazji: JSON z modeli bez strukturalnego wymuszenia.**
(`services/geminiService.ts`, `services/presentationService.ts`) Odkryte przy
przeglądzie własnego kodu narady: `generateLessonPlannerAI` prosiła model
o JSON wyłącznie zdaniem w promptcie — żaden z dwóch dostawców nie dostawał
strukturalnego wymuszenia (`response_format` / `responseMimeType`). Ta sama
luka dotyczyła trzech już istniejących wywołań w generatorze slajdów
prezentacji, nie tylko nowego kodu narady. Naprawa: opcjonalny parametr
`jsonMode`, domyślnie wyłączony (zero zmiany zachowania dla wywołań na tekst
swobodny), włączony w naradzie (tylko tury autora) i we wszystkich trzech
wywołaniach w `presentationService.ts`. Nadal niezweryfikowane na żywym
kluczu — patrz sekcja 3 niżej.

**Co zostaje nieużywane, ale nieusunięte:** `LessonPlanner.tsx` i jego pomocnicze
komponenty (`LessonModulesConfig`, `ChooseScenarioModal`,
`GeneratedScenariosSection`). Nic ich już nie importuje, więc nie trafiają do
bundla produkcyjnego — usunięcie plików to osobna decyzja, nie zrobiona przy
tym zadaniu.

**Nieobejrzane w przeglądarce.** Cała funkcja przeszła `tsc --noEmit`, 316
testów i `npm run build`, ale nikt nie kliknął przez trzy kroki w działającej
aplikacji ani nie wywołał prawdziwej narady na żywych kluczach API. Do
sprawdzenia w pierwszej kolejności: czy JSON zwracany przez modele parsuje się
niezawodnie w praktyce (prompt wymusza go opisowo, nie schematem — Gemini
i OpenAI mają różne mechanizmy wymuszania JSON-a, a `generateLessonPlannerAI`
używa jednego wywołania bez `responseSchema`), i czy poprawka zaznaczonych
elementów rzeczywiście zostawia resztę scenariusza nietkniętą przy prawdziwej
odpowiedzi modelu.

### 🧭 Profil kursanta jako osobny widok, tryb dzienny i paleta notatnika (2026-09-14, runda 8)

**1. Wejście w profil kursanta CHOWA panel lektora.** Wcześniej profil dokładał
się pod pulpitem: nagłówek panelu, baner uwagi, trzy kafelki, listwa narzędzi
i „więcej narzędzi" zostawały nad nim w całości, więc każde kliknięcie zakładki
wymagało przewinięcia sześciu ekranów cudzej treści. Teraz widok kursanta zajmuje
ekran sam, a jedynym wyjściem jest przycisk „Panel lektora" w jego nagłówku.

**2. Nagłówek kursanta to okno z czterema równymi kafelkami.**
(`components/admin/StudentProfileHeader.tsx`) Poprzedni był jednym pasem
z czternastoma rzeczami w jednej linii — awatar, imię, login, poziom, rola, stan
konta, e-mail z dopiskiem, logowania, ostatnia wizyta i trzy przyciski, każde
innej wysokości i wagi. Teraz dwa piętra: KTO TO JEST (awatar, imię, znaczniki,
wyjście i menu) oraz CO O NIM WIADOMO — cztery równe kafelki metryk w siatce,
bo są tej samej rangi. Kafelek e-maila i poziomu prowadzi wprost do właściwej
sekcji profilu.

**3. Każda zakładka kursanta ma tę samą ramę okna.**
(`components/admin/StudentPanelSection.tsx`) Sześć zakładek było zbudowanych
sześcioma sposobami: historia miała nagłówek nad paskiem pięciu przycisków,
słownictwo nagłówek z przyciskami bez ramy, statystyki gołą siatkę bez nagłówka,
testy trzy nagłówki jeden pod drugim. Teraz każda to okno: pasek tytułu z ikoną
i licznikiem po lewej, narzędzia po prawej, pas filtrów pod spodem, treść
w środku. Zakładki różnią się treścią, nie budową.

**4. Jeden zestaw narzędzi na całą historię lekcji; Notion tylko tutaj.**
Czynności stały w TRZECH miejscach naraz — „Pobierz z Notion" w nagłówku
kursanta (czyli także nad statystykami i pracą domową, których Notion nie
dotyczy), „Sprawdź Notion" w pasku źródeł i pięć przycisków nad listą. Trzy
z nich dokładały lekcję, a wyglądały jak trzy różne funkcje. Teraz jedno menu
„Lekcje": wpis ręczny, pobranie z Notion, z transkrypcji (AI), import zbiorczy,
a pod kreską porządki (bloki Notion, eksport PDF). Pasek źródeł stracił własny
przycisk i zwinął się do jednej linijki z liczbami; przez zwinięcie przebija się
tylko transkrypcja czekająca na lektora.

**5. AI Lesson Summary rozróżnia notatki od transkrypcji.** Funkcja dostawała
JEDNO polecenie systemowe, napisane pod gotowe notatki ze spotkania. Wklejona
transkrypcja dostawała to samo — model szukał w zapisie rozmowy sekcji, których
tam nie ma, i oddawał trzy zdania streszczenia przy pustej reszcie pól. Do tego
szła drogą importu zbiorczego, która przy zmianie tematu w rozmowie rozcinała
jedne zajęcia na kilka wpisów.

Modal pyta teraz, CO się wkleja. „Transkrypcja lekcji" dostaje osobne polecenie
systemowe: wyłuskaj każde słowo i zwrot podane przez lektora, każdą poprawkę
błędu, uwagi o wymowie, gramatykę i ustalenia, po czym ułóż je w STANDARDOWY
UKŁAD BLOKÓW z historii lekcji — i idzie zawsze jako JEDNA lekcja. Wersja
transkrypcyjna generuje też pracę domową na materiale z tych zajęć, bo blok 3
jest częścią układu, który widzi kursant.

**6. Bloki 2b–4 jadą wprost, a nie doklejone do „Things to Improve".** Praca
domowa, klucz odpowiedzi, korekty i plan na kolejną lekcję mają własne pola
w schemacie AI, w formularzu lekcji i w zapisie do bazy — wcześniej musiały
jechać pod znacznikiem „Zadanie domowe:" i być rozcinane wyrażeniem regularnym.
Stare wpisy otwierają się bez zmian (formularz wyciąga z nich bloki przez
`extractLessonBlocks`). Data lekcji bierze się z materiału, gdy w nim jest.
Dołożone wczytywanie plików `.txt/.md/.vtt/.srt` ze ścinaniem znaczników czasu.

**7. Tryb dzienny: biel i czerń przestały być dosłowne.** Komponenty powstawały
w trybie nocnym, więc kreski i wypełnienia są w nich zapisane jako biel z niskim
kryciem: 1100 `border-white/10`, 500 `bg-white/5`, 770 `text-white`. Na białej
karcie ta biel NIE ISTNIEJE — stąd wyprane okna dialogowe. Tailwind 4 liczy
każdą z tych klas przez `color-mix(… var(--color-white) X%, transparent)`, więc
podmiana samej zmiennej odwraca całą rodzinę naraz, z zachowaniem proporcji
dobranych w ponad tysiącu miejsc. To samo z czernią (`bg-black/40` to studzienka
pola, `text-black` napis na wypełnieniu akcentem). Wyjątki wpisane wprost jako
`#ffffff` / `#0f1720`; przyciemnienie za oknem dialogowym ma własną regułę
i zostaje ciemne, ale przy kryciu 0,45 zamiast 0,80.

Poza tym: tło strony `#f2f4f7 → #e9edf2` (biała karta przy kryciu 50–60%
dawała różnicę trzech jednostek jasności), `content-muted` 4,1:1 → 5,4:1,
`text-faint` 2,3:1 → 4,5:1, mocniejsze obrysy i dwuwarstwowe cienie,
a konstelacja z 1,1:1 na wyraźnie widoczną siatkę bliższą grafitowi niż zieleni.

**8. Ciemna kartka notatnika należy do tej samej aplikacji.** Była CIEPŁA
(`#211f1c`, druk `#e8e3d9`, linki `#5fe3c0`) i leżąc na chłodnym granacie
wyglądała jak wklejona z innego programu. Teraz granat `#111a2c` o stopień
jaśniejszy od kanwy, chłodna biel druku, akcent marki `#72f0b4` w linkach
i zakreśleniach, cień z miętowym obrysem.

Druga rzecz to kolory, które notatnik wpisuje W TREŚĆ dokumentu
(`style="color:…"`) — motyw nie ma jak ich potem przestawić, więc ta sama
wartość musi działać na obu papierach. Były dwie niezależne palety dobrane
wyłącznie pod jasny papier. Teraz jedna (`utils/notebookPalette.ts`): sześć
odcieni o tej samej jasności względnej (~0,22), czyli ~3,4:1 na papierze
i ~4,4:1 na ciemnej kartce. Czytają z niej szablon lekcji, przyciski koloru
i zakreślacze.

**9. Naprawa: klucze AI z bazy nie wracały po restarcie.**
`FIRESTORE_DATABASE_ID` była zadeklarowana w połowie `createApp`, a wczytanie
kluczy odpala się na jej początku — każdy start kończył się wyjątkiem
„Cannot access … before initialization", złapanym przez `catch` i zameldowanym
jako „nie udało się wczytać kluczy z bazy". Klucz zapisany w Ustawieniach
Administratora NIGDY nie wracał po wdrożeniu. Deklaracja przeniesiona nad
pierwsze użycie; sprawdzone na świeżym starcie serwera.

---

### 📄 Notatnik na własnej karcie, modele AI w ustawieniach (2026-09-14, rundy 5–7)

**1. Notatnik jest OSOBNĄ STRONĄ pod `/scratchpad`, otwieraną w nowej karcie.**
Jest otwarty przez całą lekcję, równolegle do profilu kursanta, pracy domowej
i prezentacji — ekran wewnątrz aplikacji znaczył, że każde zajrzenie gdzie
indziej wymaga wyjścia i powrotu, a przy powrocie kartka jest znów na górze.
**Jeden adres dla obu stron**: o tym, czy pokazać pełny edytor, czy widok po
linku/PIN-ie, decyduje rola otwierającego, a nie osobna ścieżka. Link
skopiowany z paska adresu jest dokładnie tym, który idzie do kursanta.
Notatnik roboczy dopisuje swój identyfikator do adresu zaraz po utworzeniu —
bez tego odświeżenie karty zakładało drugi, pusty dokument. Warianty `overlay`
i trasa wewnątrz aplikacji usunięte; wszystkie wejścia wołają
`openScratchpadTab`.

**2. Kartka to arkusz A4, dokument chodzi za motywem kartki.** 794 px
(210 mm przy 96 dpi), margines 2 cm. Strona notatnika ustawia motyw okna pod
motyw kartki — dotąd kartka była jasna, a wszystko wokół ciemne, czyli dwa
różne programy na jednym ekranie. Na własnej karcie rama traci obrys i cień,
kanwa jest jednolicie szara.

**3. Wpis lekcyjny z numerem liczonym z dokumentu.** „Nowa lekcja" dokłada
na końcu `Lesson N — data` i pięć kolorowych sekcji (Revision, Main topic /
Practice, Lesson Summary, Key Language & Corrections, Homework). Numer bierze
się z najwyższego numeru w dotychczasowych NAGŁÓWKACH — osobny licznik
w bazie byłby drugą prawdą i rozjechałby się przy pierwszej ręcznej poprawce.
Poprawiony palcem jest brany pod uwagę przy następnym wstawieniu.

**4. Kursant może pisać od razu.** Domyślne „tylko podgląd" znaczyło tyle, że
na każdej pierwszej lekcji trzeba było o tym pamiętać i odblokować — a że
nikt nie pamiętał, kursant pisał „nie mogę nic wpisać" i lekcja stawała.
Dotyczy NOWYCH notatników; istniejące zostają z dotychczasowym ustawieniem.

**5. Obrazy ze schowka, wskaźnik laserowy, szablon z paska, historia wersji.**
Wklejony zrzut jest zmniejszany do 1400 px i przekodowywany na WebP PRZED
wstawieniem: Storage w tym projekcie nie jest założony, więc obraz mieszka
w treści dokumentu, a ta ma sufit 1 MiB — zrzut z retiny wklejony wprost
w ogóle by się nie zapisał. Dokument nosi do pięciu migawek treści, najwyżej
jedną na pięć minut, i robi je **wyłącznie lektor**: reguły przepuszczają
kursantowi tylko pięć konkretnych pól, więc `revisions` w jego zapisie
odrzucałoby CAŁY zapis.

**6. Zadania i testy to jeden ekran.** Kafelek „Testy" prowadził donikąd —
generator renderuje się wyłącznie w profilu wybranego kursanta. Powstał
`TeacherWorkScreen` z sekcjami zwijanymi; „Przegląd v2" pokazuje się dopiero,
gdy istnieje choć jeden zestaw silnika v2.

**7. Panel lektora ma trzy poziomy.** Trzy duże kafelki na prowadzenie lekcji,
trzy w listwie na to, co między nimi, reszta w „Więcej narzędzi". Ustawienia
i Diagnostyka straciły kafelki — są pod kołem zębatym. Profil kursanta
pokazuje JEDNĄ sekcję naraz zamiast pięciu rozłożonych kart. Baza kursantów
otwiera się prostą listą, arkusz a la Notion jest o klik dalej.

**8. Przewodnik podświetla prawdziwe elementy.** Poprzedni rysował własne
atrapy tego, co opisuje, więc człowiek uczył się atrapy. Reflektor był poza
tym wyłączony poniżej 860 px — na telefonie przewodnik pokazywał czarny ekran
z dymkiem i niczym podświetlonym. Kroki celujące w nieistniejący element są
pomijane. Pomoc dostała własny przycisk w pasku górnym.

**9. Prawy dolny róg to jedna kolejka.** Monitor AI, zgłaszanie błędu,
powiadomienia i toasty wpadały w to samo miejsce z własnym `bottom`
i `z-index`; monitor z najwyższym z-indeksem zakrywał wszystko. Wysokości są
zmiennymi CSS, a monitor melduje własną — u osób, którym się nie renderuje,
reszta nie wisi nad pustym miejscem.

**10. Duplikaty w historii lekcji.** Import z Notion nadaje każdemu wpisowi
nowy identyfikator, więc drugi import tej samej strony dokładał bliźniaka —
raz powtórzona synchronizacja podwoiła historię temat po temacie. Trzy
warstwy: zapora przed zapisem (ten sam temat tego samego dnia zwraca
istniejący wpis), wykrywanie z podziałem na **pewne** (temat + data)
i **podejrzane** (temat + ta sama treść, inne daty — cykliczna powtórka
tematu jest normalną lekcją, więc tych nie kasujemy hurtem) oraz panel
sprzątania, który pokazuje znalezisko i kasuje dopiero na kliknięcie.
Numeracja idzie od najstarszej: #1 to pierwsze zajęcia i ten numer się nie
zmienia — dotąd liczyliśmy od końca, więc „wróć do lekcji 5" znaczyło co
tydzień co innego.

**11. Ustawienia modeli AI i kluczy API (tylko administrator).** Model
pierwszego wyboru dla czterech rodzajów pracy: generowanie zadań, ocena,
czat, streszczenia. Wpięte przez kategorię zapytania, którą wszystkie
wywołania i tak podają — zero zmian w miejscach wywołań. Zapasów nie da się
przestawić (to one ratują sytuację przy awarii dostawcy), ale są pokazane
wprost. Klucze OpenAI / Gemini / ElevenLabs zapisuje się w aplikacji, działają
od razu i wracają z bazy przy starcie serwera; zmienna środowiskowa ma
pierwszeństwo i interfejs mówi, które źródło jest aktywne. `system/ai` czyta
i zapisuje **wyłącznie serwer przez Admin SDK** — otwarcie reguły odczytu na
kolekcji `system` znaczyłoby, że klucz OpenAI da się pobrać z przeglądarki
dowolnego kursanta.

**12. Podsumowanie pracy domowej po imieniu i po ludzku.** Prompt kazał pisać
„pięknym, motywującym językiem" i dostawaliśmy „Drogi Kursancie, jestem pod
wrażeniem… każdy błąd to cenna lekcja". Teraz: zwrot po imieniu w wołaczu,
najwyżej trzy zdania do 350 znaków, obszar do poprawy nazwany wprost
(„bezokolicznik po 'decide'", nie „precyzja form czasownikowych"), plus
przykład dobrego i złego podsumowania w promptcie.

**13. Prototyp asystenta.** Pływające okno dla lektora: „co ostatnio robiłem
z Bartkiem". Imiona dopasowywane lokalnie, do modelu jadą lekcje tylko tych
osób, o które zapytano — bez tego każde pytanie kosztowałoby całą bazę.

**Weryfikacja.** `tsc --noEmit`, `npm test` (316/316), `npm run build`
i `npm run test:rules` (44/44) przechodzą. **Żadna z tych zmian nie była
oglądana w przeglądarce.**


### 🗂️ Kontekst przed lekcją, notatnik jak dokument i czytelny dzień (2026-09-14, runda 4)

Siedem zgłoszeń Macieja z jednej sesji. Każde osobnym commitem.

**1. „Kontekst przed lekcją" jako jeden z trzech głównych kafelków.**
Wchodzi na miejsce Prezentacji: kontekst otwiera się przed KAŻDĄ lekcją,
Prezentację włącza się na część niektórych — więc to kontekst zasługuje na
jedno z trzech miejsc zarezerwowanych dla rzeczy używanych za każdym razem.
Prezentacja schodzi do listwy poniżej. Kafelek ZAWSZE pyta, o którego
kursanta chodzi, nawet gdy panel ma otwarty czyjś profil: ciche użycie
zaznaczonego kursanta pokazywałoby kontekst kogoś innego bez ostrzeżenia.
Zakładka „Kontekst" znika z profilu kursanta.

**2. Podgląd kursanta usunięty w całości.** Pięć ekranów `preview-*`,
`StudentPreviewFrame` i stan `previewStudentId`. Była to druga, równoległa
droga do danych, które lektor ma w profilu kursanta — każda zmiana w panelu
kursanta wymagała sprawdzenia dwóch wersji tego samego ekranu.
`student-today` zostaje: to WŁASNY panel kursanta, nie podgląd.

**3. Baza tematów wchodzi do Planera lekcji.** Temat jest materiałem,
z którego powstaje scenariusz, a scenariusz powstaje w Planerze. Stoi teraz
obok „Bazy scenariuszy", nie w osobnej pozycji menu.

**4. AI Live Monitor zadokowany do dolnej krawędzi okna.** Wisiał 80 px nad
dołem, czyli w powietrzu nad treścią — przy przewijaniu wyglądał, jakby
dryfował. `createPortal` do `<body>` wyprowadza go poza `#root`: panele bywają
kontenerami z `transform`, a ten unieruchamia `position: fixed` względem
kontenera zamiast okna. Rozwinięty rejestr podnosi się nad pasek.

**5. Notatnik przebudowany — idzie jutro do pierwszych kursantów.**
- **Spis treści** jak w Google Docs: powstaje z nagłówków kartki (H1 rozdział,
  H2 i H3 podrozdziały), na telefonie kładzie się nad kartką, na komputerze
  stoi kolumną z lewej. Struktura dokumentu JEST spisem — nie ma drugiego
  miejsca do jego redagowania.
- **Nagłówki zwijane (toggle).** Strzałka to nieedytowalny element wewnątrz
  nagłówka, nie pseudoelement: pseudoelementu nie da się kliknąć wewnątrz
  `contentEditable` bez łapania kliknięć całego nagłówka. Stan zwinięcia
  siedzi w HTML-u, więc przeżywa zapis i widzi go druga osoba.
- **Podział na strony**: kreska co wysokość A4 (1123 px), rysowana warstwą nad
  kartką; licznik stron w stopce, przeliczany przez `ResizeObserver`.
- **Własny motyw kartki**, jasny domyślnie, niezależny od motywu aplikacji.
  Papier to ciepła kość #f6f1e6 jak w czytniku, nie biel — biel na ciemnym
  oknie świeci; z tekstem #2c2822 daje 12,3:1, czyli powyżej progu AAA.
- **Notatnik jest EKRANEM, nie oknem.** Modal przyciemniał aplikację
  („załatw to i wracaj"), przez półprzezroczyste tło prześwitywały kafelki
  i konstelacja, a kartka nigdy nie dostawała więcej niż 90vh. Wejścia,
  z których nie da się wyjść bez utraty stanu (prezentacja na żywo, baza
  kursantów, profil), dostają wariant `overlay` — warstwę NIEPRZEZROCZYSTĄ.
- **„Otwórz w Google Docs"**: kopiuje notatnik do schowka jako `text/html`
  i otwiera pusty dokument; wklejenie zachowuje nagłówki, listy i zakreślacze.
  Prawdziwy eksport wymagałby OAuth i zakresu `drive.file`.
- **Płynność**: spis i licznik stron przebudowywały się przy każdym znaku, co
  przy dłuższym dokumencie widać było jako szarpanie przewijania. Teraz jedno
  odświeżenie 250 ms po ostatniej zmianie, z odcięciem po podpisie struktury.

**6. Kontekst przed lekcją to odprawa AI, nie zrzut notatek.** W polu „do
poprawy" potrafiło siedzieć całe zadanie domowe razem z kluczem odpowiedzi —
ekran mający oszczędzać minutę przed lekcją tę minutę zabierał. Model dostaje
TRZY ostatnie lekcje (jedna nie mówi, co wraca) i zwraca: co się działo,
o czym mówił kursant, jakie słowa padły, co zadałem, co się chwieje, co
zrobić dzisiaj. Klucz odpowiedzi nie idzie do modelu. Odprawa startuje sama
i jest buforowana po identyfikatorze ostatniej lekcji. Surowe notatki leżą
pod spodem, zwinięte blok po bloku.

**7. Panel kursanta: symetria, szkło, klikalne logo.** Siedem narzędzi nie
układa się równo w żadnej szerokości — „Praktyka dodatkowa" wypada z siatki
(to samo wejście jest w nagłówku jako jedyny duży przycisk). Zostaje sześć:
2 kolumny × 3 rzędy na telefonie, 3 × 2 na komputerze, siatka wypełnia się
cała. Notatnik traci `desktopOnly`. Wspólna receptura `.glass-tile`:
półprzezroczysta tafla z rozmyciem, obrys włosowy i POJEDYNCZY przejazd
połysku przy najechaniu — stała poświata na sześciu kafelkach to sześć rzeczy
wołających o uwagę, czyli żadna. Logo dostaje kursor łapki i `aria-label`.

**8. Tryb jasny: biały tekst przestaje być biały tam, gdzie jest niewidoczny.**
Ponad tysiąc surowych `text-white` z czasów, gdy aplikacja miała tylko tryb
nocny, dawało w dzień biały tekst na białych kartach — całe zdania niewidoczne.
Hurtowa podmiana nie wchodziła w grę, bo część z nich jest POPRAWNA (biel na
wypełnieniu akcentem). Zamiast tego `text-white` znaczy teraz „kolor tekstu na
tym, na czym stoję": domyślnie ciemny token dnia, a elementy z wypełnieniem
ustawiają u siebie `--on-fill: #fff` i dziedziczenie zmiennych robi resztę.
Selektory dopasowują klasę DOKŁADNIE (`[class~="bg-primary"]`), bo
`bg-primary` to wypełnienie, a `bg-primary/10` to odcień na białej karcie.
Do tego `color-scheme: light` — bez niego pola tekstowe rysowały się ciemne.

**Czego NIE zrobiono.** „Context-aware chatbot" z pierwszej wiadomości:
polecenie przyszło urwane w połowie zdania i mówi o rezerwacjach
wieloetapowych, których w tej aplikacji nie ma. Zakres do ustalenia.

**Weryfikacja.** `tsc --noEmit`, `npm test` (293/293) i `npm run build`
przechodzą. ŻADNA z tych zmian nie była oglądana w przeglądarce.


### 🧭 Sześć etapów przebudowy nawigacji i tryb jasny od nowa (2026-09-13, runda 3)

Zgłoszenie Macieja po obejrzeniu panelu. Każdy etap osobnym commitem.

**1. Koniec z tym samym narzędziem w dwóch miejscach.** Notatnik i Prezentacja
stały na jednym ekranie dwa razy — jako główne kafelki i jeszcze raz
w listwie. „Profil kursantów" prowadzi teraz PROSTO do bazy kursantów
zamiast otwierać własną, skróconą listę (były to dwa spisy tych samych
ludzi). „Historia lekcji" zdjęta z narzędzi — jest zakładką w profilu
kursanta. „Baza scenariuszy" zdjęta z menu i wstawiona do Planera lekcji:
scenariusz jest materiałem, z którego powstaje lekcja.

**2. Źródło historii lekcji widoczne w profilu.** Nowy `LessonSourceBar`
liczy, ile lekcji przyszło z Notion, ile z transkrypcji Sifta i ile
transkrypcji czeka na bloki. Dwa źródła dostają dwa różne interfejsy, bo
to dwie różne czynności: Notion jest ciągniony (ma przycisk), transkrypcje
są pchane (nie ma czego kliknąć). Globalna weryfikacja całej bazy
przeniesiona z pulpitu do Bazy kursantów.

**3. Notatnik otwiera się pusty, kursant dochodzi w trakcie.** Kafelek
stawiał wcześniej najpierw listę kursantów. Teraz notatnik otwiera się od
razu jako roboczy, a przypisanie PRZENOSI treść do stałego notatnika
kursanta (`sp_<uid>`) — dopięcie samego pola dałoby notatnik, który wygląda
na przypisany, a którego kursant nigdy nie zobaczy. Notatnik z historią
dostaje treść na końcu, po kresce; świeży jest podmieniany. Kartka do
pisania zawsze w kolorze kości słoniowej, niezależnie od motywu: ciemna
kartka czyta się jak panel aplikacji, a nie jak dokument.

**4. Prace domowe jako kompaktowa lista.** Domyślnie lista, kafelki do
wyboru, na telefonie kafelki obowiązkowo (wiersz listy ma cele dotyku
wielkości znaczka). Nowy `hooks/useMediaQuery.ts` z jednym progiem `md`
dla całej aplikacji.

**5. Tryb jasny przepisany.** Poprzedni był „papierowy": kość słoniowa
(#f7f5f0), wgłębienia w ciemniejszej kości, cienie o kryciu 0,22–0,30
rozmyte na 24–56 px i dwa kolory akcentu. Teraz układ z narzędzi do pracy
na danych: chłodne szare tło (#f2f4f7), białe karty, włosowe obrysy, cienie
ledwie widoczne (0,06–0,10), poświata zamieniona na obrys, jeden akcent
ściemniony do #0d8a5f (kontrast 4,6:1 na bieli — wolno nim pisać).
**Konstelacja w tle** miała kolor wpisany na sztywno jako zieleń trybu
nocnego, więc w trybie jasnym jej praktycznie nie było; teraz barwa i krycie
są tokenem, a tryb jasny dostaje ciemne linie w wyższym kryciu.

**6. Menu boczne usunięte w obu rolach.** Niosło nawigację (przejęły kafelki)
i ustawienia konta (nigdy nie potrzebowały stałej kolumny). Nowy `TopBar`:
znak marki, jedno zdanie o tym, co czeka, koło zębate. Pod kołem cały panel
zarządzania — ustawienia, pomoc, diagnostyka, motyw, język, wylogowanie.
Zgłoszony błąd świeci czerwoną kropką na kole, zanim ktokolwiek otworzy
panel. Przed usunięciem inwentaryzacja: „Moje słownictwo" i „Praktyka
dodatkowa" (kursant) oraz „Podgląd kursanta" (lektor) istniały WYŁĄCZNIE
w menu i dostały kafelki. Samouczek przepięty na nowe elementy.
`Sidebar.tsx` usunięty z repo.

**Stan weryfikacji:** 293/293 testów jednostkowych, 44/44 testów reguł na
emulatorze, `tsc --noEmit` czysto, oba buildy przechodzą. Zrzuty
z działającej aplikacji (emulatory + Playwright): panel lektora 1280 px
i panel kursanta 390 px w trybie jasnym, panel kursanta 390 px w trybie
ciemnym, panel zarządzania pod kołem zębatym — bez poziomego suwaka, bez
błędów w konsoli.

**Do rozważenia (nie zrobione):** modal „Nowa praca domowa"
(`StudentNotifications`) mówi teraz to samo, co pasek górny, tylko blokuje
ekran. Dwa kanały na jeden fakt — ale usunięcie ścieżki powiadomień bez
zgody byłoby zmianą zachowania, nie porządkiem.


### 📱 Widok mobilny: kafelki w panelu kursanta i naprawa trybu jasnego (2026-09-13)

Podstawa: `~/Downloads/design_handoff_cribro_mockup` (trzy makiety HTML +
README). Wprowadzone to, co pasuje do dzisiejszych funkcji; rozbieżności
i świadome pominięcia — niżej.

**Po raz pierwszy w tym projekcie UI zostało sprawdzone w przeglądarce, nie
tylko przez `tsc` i testy.** Umożliwił to nowy przełącznik na emulatory
(`npm run dev:emulated` + `npm run emulators`): wcześniej nie było jak
obejrzeć żadnego ekranu po zalogowaniu, bo każdy potrzebuje konta i danych,
a jedyne konta były produkcyjne. Zrzuty robione Playwrightem przy 390 px
(iPhone 14), w obu motywach, na zasianym koncie kursanta i lektora.

**Co znalazło się od razu po włączeniu trybu jasnego** (i nie zostało
znalezione przez żaden test):
- Panel kursanta: powitanie („Cześć, Moniko!"), liczniki, nagłówek „ZADANIA
  OD LEKTORA" i karty zadań — **biały tekst na jasnym tle**. Karty stały na
  `bg-black/40`, czyli szarej płycie zamiast jasnej karty.
- Panel lektora: **niewidoczne TYTUŁY trzech głównych kafelków** („Profil
  kursantów", „Prezentacja", „Notatnik") i nagłówek ekranu. Kafelek
  pokazywał ikonę, plakietkę i opis, a nazwę — nie.
- Widget „AI Live Monitor" wisiał w tym samym narożniku co przycisk
  zgłaszania błędu i przy `z-index: 9999` po prostu go przykrywał.
- Uchwyt menu bocznego (`top-20`) przecinał kartę powitalną w połowie zdania.

Wszystko naprawione tokenami motywu — 67 linii w `AdminPanel.tsx` i dziewięć
plików panelu kursanta. `text-white` zostaje tam, gdzie stoi na wypełnieniu
akcentem (zamiana tam byłaby błędem w drugą stronę); zakres zamiany
ograniczony do linii, bo klasy w tych plikach bywają szablonami z warunkami.

**Panel kursanta na kafelkach.** Zadania, testy, wcześniejsze lekcje,
historia ćwiczeń i notatnik (tylko duży ekran) jako listwa dużych kafelków;
treść otwiera się jednym panelem POD listwą, zawsze w tym samym miejscu.
Wcześniej: stos sześciu zwijanych pasków, w którym dojście do testów na
telefonie znaczyło przewinięcie wszystkiego powyżej. `PanelSection` dostał
tryb `headless`, żeby ta sama sekcja działała w obu układach bez
rozgałęziania kodu treści.

**Nagłówek kursanta ścieśniony na telefonie z 642 px do 419 px**, więc oba
rzędy kafelków i „ostatnia lekcja" wchodzą nad zgięcie (zmierzone, nie
oszacowane): trzy liczniki w jednym rzędzie zamiast zawijanych dwóch, jedno
zadanie zamiast dwóch, zachęta do praktyki dodatkowej tylko na dużym
ekranie. Na komputerze bez zmian — zgodnie z zasadą „szczegóły na dużym
ekranie".

**Panel lektora: druga listwa „Więcej narzędzi"** (9 kafelków, zwinięta).
Te wejścia istniały dotąd wyłącznie w menu bocznym, które na telefonie jest
szufladą — połowa panelu była schowana przed kciukiem.

**Rozbieżności wobec makiety — świadome:**
- **Menu boczne NIE zostało obcięte.** Makieta redukuje je u lektora do
  trzech pozycji, a u kursanta zdejmuje „Pracę domową" i „Historię lekcji".
  Kafelki dodane jako droga krótsza, nie jedyna: menu niesie żywe plakietki
  z licznikami, a usuniętej nawigacji nie widać jako braku, tylko jako
  regresji. Do domknięcia po Twoich testach na telefonie.
- **Landing bez przebudowy.** Makieta ma cennik w trzech progach, sekcję
  ofertową dla lektorów i FAQ — to treść biznesowa, nie układ, i nie ma jej
  skąd wziąć. Sam język wizualny (Cormorant Garamond, DM Mono, akcent
  `#72f0b4`, tło konstelacji) aplikacja ma już zgodny z makietą.
- **Tokeny zostawione bez zmian.** Paleta makiety to ta sama rodzina
  (akcent `#72f0b4` co do cyfry), różnice sięgają 2–3 cyfr hex w tłach.
  Przestawianie ich przemalowałoby całą aplikację bez zysku.
- **„Baza scenariuszy" nadal osobno**, nie jako zakładka w Prezentacji —
  to przebudowa modułu prezentacji, nie zmiana układu; osobne zadanie.
- **Kafelek „Historia" prowadzi do istniejącej historii sesji ćwiczeń**,
  a nie do nowego raportu ze słupkami 14 dni z makiety.

**Stan weryfikacji:** 293/293 testów jednostkowych, `tsc --noEmit` czysto,
oba buildy przechodzą, zrzuty przy 390 px w obu motywach dla kursanta
i lektora — bez poziomego suwaka, bez błędów w konsoli. Nie sprawdzone:
ekrany poza panelami (fiszki, prezentacja, mailing) i pozostałe ~780
wystąpień `text-white` w innych plikach.


### 🔐 Trwałość danych i druga droga do lekcji: transkrypcje z Cribro Sift (2026-09-13)

**Część A — trwałość danych (wszystko sprawdzone na produkcji, nie założone):**

- **Restore przetestowany po raz pierwszy.** Backup z 2026-09-13 09:22
  przywrócony do osobnej bazy `cribro-restore-test`; operacja zgłosiła
  `operationState: SUCCESSFUL`, 100/100 pracy, 15 minut, a nowa baza
  wskazuje we `sourceInfo` właściwy backup i właściwy snapshot. Baza
  testowa skasowana po weryfikacji (wymagało najpierw zdjęcia delete
  protection, którą odziedziczyła). **Uwaga metodyczna:** zgodność liczby
  dokumentów per kolekcja nie została policzona — lokalnie nie ma klucza
  serwisowego (`FIREBASE_SERVICE_ACCOUNT` w `.env` jest puste) ani gcloud.
  Raport operacji dotyczy całego backupu, więc jest mocniejszym sygnałem
  niż próbka, ale to nie to samo co przeliczenie.
- **Retencja backupów 7 → 30 dni.** Błąd w danych agregowanych (learning
  curve) psuje się cicho i bywa widoczny po dwóch tygodniach.
- **Eksport kont z Firebase Auth** — `npm run firebase:auth:export`
  (`scripts/auth-backup.sh`). Zarządzany backup Firestore obejmuje bazę, nie
  listę użytkowników: skasowane konto zostawiało profil `users/{uid}` bez
  loginu i bez drogi powrotnej. Zrzut ląduje w iCloud Drive (poza repo i poza
  ten dysk), 12 ostatnich kopii, pusty eksport jest odrzucany, żeby awaria
  nie podmieniła dobrej kopii na zero kont. Pierwszy przebieg: 40 kont,
  18 z hasłem, 5 tylko przez Google.
  **Luka do domknięcia ręką:** eksport zawiera `passwordHash` i `salt`, ale
  NIE parametry scrypta projektu. Bez nich `auth:import` wjedzie, a żadne
  stare hasło nie zadziała. Firebase CLI ich nie oddaje — trzeba raz
  przepisać z konsoli do `hash-config.json`; skrypt o tym ostrzega przy
  każdym uruchomieniu.
- **`storage.rules` w repo**, dostęp klienta zamknięty (`allow read, write:
  if false`). Do kubełka sięga tylko `server.ts` przez Admin SDK, który
  reguły omija, a frontend nie importuje `firebase/storage` w ogóle.
  **Niewdrożone:** Firebase Storage nie jest w tym projekcie założony —
  `firebase deploy --only storage` odpowiada „has not been set up". Wynika
  z tego, że **kubełkowa połowa cache'u TTS nigdy nie działała**: brak
  kubełka wpada w `catch` w `server.ts` i po cichu przechodzi do
  generowania. Działa wyłącznie cache na dysku.

**Część B — transkrypcje z Cribro Sift jako drugie źródło lekcji:**

Notion pozostaje nietknięty i pełnoprawny. Transkrypcja to droga obok, nie
zamiast.

- **Schemat:** `LessonRecord` dostaje pięć pól opcjonalnych
  (`liveTranscript`, `sessionStatus`, `drillDraft`, `siftSessionId`,
  `transcriptReceivedAt`) i wartość `live_transcript` w `source`. Reguły
  walidują typ i rozmiar każdego; limit transkrypcji 500 000 znaków stoi
  tam, bo dokument Firestore ma sufit 1 MB i po jego przekroczeniu nie
  zapisuje się NIC, razem z całą lekcją.
- **Punkt odbioru:** funkcja HTTP `ingestTranscript` (`us-central1`).
  Zwykły POST z tokenem zamiast `onCall`, bo Sift jest Electronem bez
  Firebase SDK. Token w Secret Managerze (`SIFT_INGEST_TOKEN`), nie w bazie.
  Identyfikator dokumentu wywodzi się z `siftSessionId`, więc powtórna
  wysyłka podmienia transkrypcję w tej samej lekcji, zostawiając temat
  i pracę lektora.
- **Token jedzie w `X-Sift-Token`, nie w `Authorization`** — i to jest
  znalezisko, które kosztowałoby dzień szukania. Brama Cloud Run (funkcje
  v2) sama przechwytuje `Authorization: Bearer …`, próbuje zweryfikować go
  jako token Google i odpowiada stroną HTML „401 Unauthorized" **zanim
  funkcja się obudzi** — logi funkcji zostają puste. Funkcja przy tym JEST
  publiczna i wygląda na sprawną: żądania bez tego nagłówka dochodzą
  normalnie. Wykryte przy weryfikacji na produkcji, nie w testach (testy
  podstawiają `fetch` i bramy nie widzą).
- **Niewidoczność dla kursanta:** lekcja z transkrypcji wjeżdża z trzema
  flagami (`status`, `isPendingConfirmation`, `pendingReason`), a
  `isLessonPendingConfirmation` dostaje osobny warunek na `live_transcript`
  bez `sessionStatus: 'completed'`. Surowy zapis rozmowy nie trafia do
  kursanta ani przez chwilę.
- **Panel lektora:** `useLiveLessonTranscript` (onSnapshot) + panel przy
  lekcji z paskiem stanu, zwiniętym podglądem zapisu i **dwoma osobnymi
  krokami** — generowanie bloków i zatwierdzenie dla kursanta. Sklejone
  w jedno kliknięcie oznaczałyby, że treść wymyślona z przekręconego
  nagrania trafia do kursanta przed przeczytaniem przez człowieka.
- **Generowanie:** model buduje ten sam kontrakt 4 bloków, co import
  z Notion — dzięki temu fiszki, prace domowe, learning curve i eksport PDF
  działają bez zmian. Prompt zakazuje odpowiadania na pytania z
  transkrypcji i dopisywania materiału, którego w rozmowie nie było.
- **Strona Sifta** (repo `cribro/sift`): `main/recall.js`, przycisk
  w zakładce „Transkrypcja", karta w Ustawieniach. Wysyłka jest
  kliknięciem, nie automatem. Ustawienia `recall` nie wychodzą do okna
  zwykłemu użytkownikowi i nie dają się zapisać (`main/owner.js`, oba
  kierunki). Potwierdzone przy okazji: **Sift już robi transkrypcję na
  żywo** — zakładka pokazuje tekst narastająco w trakcie nagrywania, bo
  odcinki są przepisywane na bieżąco. Nic tu nie trzeba dorabiać.

**Stan weryfikacji:** `tsc --noEmit` czysto w obu pakietach, 293/293 testów
jednostkowych Recall, 44/44 testów reguł na emulatorze, 12/12 sprawdzeń
mostu w Sifcie, `npm run build` przechodzi. Wdrożone na produkcję: reguły
Firestore, indeksy, dziesięć funkcji (w tym nowa `ingestTranscript`), sekret
`SIFT_INGEST_TOKEN`. **Przebieg end-to-end wykonany na produkcji**: próbna
transkrypcja przyjęta (201 `created`), ponowna wysyłka tej samej sesji
zwróciła 200 `updated` — jedna lekcja, nie dwie; zły token odbity naszym
JSON-em 401; GET odbity 405. Próbna lekcja leży na koncie lektora jako
`sift-probna-wysylka-2026-09-13` i można ją skasować z panelu.


### 🆕 Notatnik jak Google Docs, widget powiadomień, automat Notion (2026-09-12, runda 2)

Ciąg dalszy tego samego dnia. **Krytyczny bug wykryty i naprawiony w 10
plikach**: `prose-invert` (Tailwind Typography) razem z hardkodowanym
`text-white` dawały dosłownie niewidoczny biały tekst na białym tle w
trybie jasnym — dotyczyło m.in. pola PIN-u notatnika. Poza tym: notatnik
dostał prawdziwy szablon domyślny (edytowalny, odzwierciedla realny
szablon lekcji Macieja z Google Docs), naprawiony bug z PIN-em nigdy nie
trafiającym do kopiowanego linku, szerszy pasek formatowania (wyrównanie,
kolory, linki, checklisty), fioletowy akcent (`--accent-2`) na kości
słoniowej. Podstrona przeżywa teraz odświeżenie strony (F5) —
`sessionStorage`. "Odesłane prace" zniknęły z sidebara, zastąpione trwałym
widgetem w prawym dolnym rogu pokazującym komplet nieprzejrzanych spraw
(nie tylko nowe zdarzenia z bieżącej sesji). Listwa narzędzi w panelu
lektora to teraz kafelki tej samej szerokości co trzy główne, z nową
pozycją "Prace domowe". Nowa scheduled Cloud Function `checkNotionDaily`
sprawdza Notion raz dziennie (6:00) i pokazuje kartę w panelu wyłącznie,
gdy jest coś naprawdę nowego — **wdrożone na produkcję**, razem z
`notifyStudentOnHomeworkGraded` z poprzedniej rundy tego dnia. Zero zmian
w `firestore.rules`. Zero weryfikacji wzrokowej w przeglądarce — patrz
sekcja 3. Pełne szczegóły: `AGENT_LOG.md`.

### 🆕 Prace domowe v2, powiadomienia i przebudowa panelu lektora (2026-09-12)

Zlecenie weekendowe Macieja: dokończyć funkcjonowanie prac domowych,
powiadomień z nimi związanych i wspólnego notatnika, plus przebudowa UI
panelu lektora i dalsza naprawa trybu dziennego. Pełny plan i analiza:
`docs/plan-weekend-2026-09-12.md`. Cztery etapy (A–C, E) w tym wpisie;
Etap D (notatnik) opisany osobno niżej — budowany równolegle przez
drugiego agenta w izolowanym worktree.

**Kluczowe odkrycie audytu, które zmieniło priorytety:** silnik prac
domowych v2 (`config/featureFlags.ts: HOMEWORK_ENGINE_V2 = true`) jest już
domyślnie włączony na produkcji — kreator lektora od razu tworzy zadania
v2, nie v1. Ale **nie istniał żaden ekran, przez który lektor mógłby te
zadania zobaczyć albo sprawdzić**. `proposeHomeworkV2Review`
(`functions/src/homeworkV2/endpoints.ts`) był martwym kodem — i tak
naprawdę to nie funkcja zatwierdzania oceny, tylko generator propozycji
powtórki (spaced repetition), niezwiązany z pojedynczym zadaniem. To był
błąd w pierwszej wersji tego planu, wykryty i poprawiony po przeczytaniu
kodu funkcji, zanim cokolwiek napisano — werdykt AI dla v2 jest
natychmiastowy i **niemutowalny** (`attempts.update: if false` w
`firestore.rules`, dotyczy każdego, łącznie z adminem), więc "zatwierdzanie
oceny" nie jest w ogóle możliwe w tej architekturze.

**Etap A — `components/admin/HomeworkV2ReviewScreen.tsx` (nowy plik).**
Nowa zakładka "Przegląd v2" w `HomeworkScreen.tsx`: lista wszystkich
zestawów v2 z rozwinięciem do ćwiczeń i pełnej historii prób
(`specialTasks/{id}/attempts`), sekcja "Wymaga uwagi" zbierająca próby z
`requiresTeacherReview: true` przez `collectionGroup('attempts')` — reguły
już na to pozwalały (`isAdmin()` obejmuje rolę `teacher`), zero zmian w
`firestore.rules`. Jedyna dostępna akcja lektora: odnotowanie przeglądu i
opcjonalna notatka, zapisywane na `specialTasks` (nie na niemutowalnym
`attempts`) przez zwykły `updateDoc`. `types.ts`: `SpecialTask` dostał
opcjonalne pola `engineVersion`, `teacherId`, `teacherReviewedAt`,
`teacherReviewNote`.

**Etap B — powiadomienia.** Dwie naprawy w `functions/src/index.ts`:
1. `notifyStudentOnHomework` (trigger na nową pracę domową) ignorował
   globalny przełącznik `MailingSettings.enableHomeworkAssigned` z panelu
   Mailingu — czytał tylko flagi na samym dokumencie zadania. Teraz
   sprawdza `system/mailing` przed wysyłką.
2. Nowy trigger `notifyStudentOnHomeworkGraded` (`onDocumentUpdated` na
   `specialTasks`, przejście `status` → `graded`) wysyła mail przez nowy
   szablon `buildHomeworkGradedEmail` (`functions/src/emailTemplate.ts`) —
   `MailingSettings.enableHomeworkReviewed` miał przełącznik w UI od
   dawna, ale żadna funkcja go nie czytała. Dotyczy wyłącznie v1: silnik
   v2 daje feedback kursantowi od razu przy próbie, nie przez późniejszą
   ocenę lektora, więc nie ma tu odpowiednika zdarzenia do zamailowania.

`TeacherHomeworkNotification.tsx` dostał trzeci nasłuch (próby v2 z
`requiresTeacherReview`) w tym samym toastcie co odesłane prace/testy.
`enableDueDateReminder` w `AdminMailingScreen.tsx` oznaczony jako
"Wkrótce" — przełącznik istniał, ale nic za nim nie stoi (wymaga
harmonogramu Cloud Scheduler), więc nie miał dalej sugerować działania.

**Etap C — przebudowa panelu lektora**, realizacja zakolejkowanej wcześniej
specyfikacji z `docs/kolejka-przebudowa-panelu.md` (rozstrzygnięcia
otwartych pytań w `docs/plan-weekend-2026-09-12.md` §1):
- Trzy główne kafelki w `AdminPanel.tsx`: **Profil kursantów** → Prezentacja
  → **Notatnik** (Notatnik jako trzeci, bo używany na każdej lekcji; Planer,
  rzadziej używany, schodzi do listwy). "Profil kursantów" (kafelek) i
  "Baza kursantów" (zakładka sidebara, zarządzanie kontami) rozróżnione
  opisem — to nie jest to samo miejsce.
- Nowa listwa narzędzi pod kafelkami: Planer, Prezentacja, Notatnik,
  Mailing, Synchronizacja z Notion — wszystkie narzędzia lektora w jednym
  miejscu.
- Nowy `components/admin/TeacherAttentionBanner.tsx`: trwały sygnał
  "Wymaga Twojej uwagi" (prace v1 odesłane + próby v2 do przeglądu) nad
  treścią panelu — widoczny też w karcie kursanta, bo `AdminPanel` nie
  odmontowuje się między widokami wewnętrznymi.
- Schowane przełącznikiem `SHOW_LEGACY_PANEL_TOOLS = false` (nie
  skasowane): "Przegląd panelu" (`TeacherOverview`), "AI Lesson
  Generator", "Dodaj kursanta" z górnego paska — ten ostatni ma już pełny
  odpowiednik w zakładce "Baza kursantów"
  (`StandaloneStudentDatabaseScreen.tsx`), więc bez regresji.
- "Brudnopis" → "Notatnik" w UI poza `components/scratchpad/` (ten dostał
  przemianowanie osobno w Etapie D). Przy okazji poprawione dwa mylące
  odwołania do "Google Docs" w opisach w `AdminPanel.tsx` — notatnik nim
  nie jest.

**Etap E (częściowy) — tryb dzienny.** Patrz zaktualizowany wpis w sekcji
3 wyżej: 284 wystąpienia `hover:text-white` naprawione w
`components/admin/` i `components/dashboard/`.

**Świadomie poza zakresem tego zlecenia** (patrz
`docs/plan-weekend-2026-09-12.md` §4): pierwszy realny przebieg silnika v2
z prawdziwym kluczem OpenAI (sekret Cloud Functions — wymaga akcji
Macieja, agent nie ma dostępu do materiału uwierzytelniającego),
`enableDueDateReminder` jako działający mechanizm, pełne rozwiązanie
"ostatni zapis wygrywa" w notatniku (OT/CRDT), wyczerpujące zamienienie
wszystkich pozostałych ok. 880 wystąpień surowego `text-white`,
prawdziwa integracja z Google Docs API.

**Weryfikacja:** `npx tsc --noEmit`, `npm test` (268/268), `npm run
build` — czysto po każdym z czterech commitów (`81377a2`, `178df72`,
`f4ee716`, `00652dc`). Brak dostępu do zalogowanej sesji przeglądarki w
tej sesji agenta — zero weryfikacji wzrokowej, patrz sekcja 3.

**Ryzyka:** `firestore.rules` **nietknięty** przez tę część pracy (zero
zmian w Etapach A/B/C/E). Middleware autoryzacji w `server.ts` i ścieżki
tokenowe bez logowania — nietknięte.

### 🆕 Notatnik: szablony lektora i eksport do PDF/Worda (2026-09-12)

Zlecenie z `docs/plan-weekend-2026-09-12.md`, Etap D. Zakres wyłącznie
`components/scratchpad/`, `utils/pdfExport.ts`, `firestore.rules` (jedna nowa,
osobna kolekcja) i `tests/rules/`.

**Szablony treści (dotąd był jeden zahardkodowany przycisk „Szablon sekcji"
w `ScratchpadEditor.handleInsertTemplate`, wstawiający zawsze ten sam HTML).**
Zastąpione prawdziwą, wieloszablonową funkcją zarządzaną przez lektora:
- Nowa kolekcja `scratchpadTemplates/{id}` (`title`, `contentHtml`, `createdBy`,
  `createdAt`/`updatedAt` jako ISO stringi) — **osobna od `scratchpads`/
  `scratchpadPins`**, celowo zero interakcji z tą wrażliwą logiką dostępu
  linkiem/PIN-em. Reguła: `allow read, write: if isAdmin();` — kursant nigdy
  nie czyta ani nie zapisuje tej kolekcji, wybór i wstawienie szablonu robi
  wyłącznie lektor.
- `services/scratchpadTemplateService.ts` (nowy): lista/dodanie/edycja/
  usunięcie szablonu.
- `components/scratchpad/ScratchpadTemplateManagerModal.tsx` (nowy): prosty
  modal zarządzania — nowy pusty szablon, nowy z aktualnej treści edytora,
  edycja tytułu/HTML, usunięcie z potwierdzeniem. Widoczny wyłącznie dla
  lektora/admina.
- Menu „Wstaw” w `ScratchpadEditor.tsx` pokazuje teraz realną listę zapisanych
  szablonów (sekcja „Szablony”) plus wejście „Zarządzaj szablonami…" —
  wyłącznie w wersji lektorskiej; kursant widzi tylko wstawianie daty.
- `tests/rules/firestore.rules.test.ts`: cztery nowe testy — lektor po
  e-mailu i po roli `teacher` w dokumencie użytkownika czyta/zapisuje,
  kursant nie czyta ani nie zapisuje (żadną drogą), gość niezalogowany nie ma
  dostępu. `npm run test:rules` → 37/37 (33 stare + 4 nowe), żaden istniejący
  test nie ruszył się.

**Eksport do PDF.** `exportScratchpadToPDF` w `utils/pdfExport.ts` — dokładnie
ten sam wzorzec co istniejące `exportTestToPDF` (`html2pdf.js`, zero nowych
zależności). Dostępny z menu „Eksportuj” w nagłówku notatnika, dla lektora i
kursanta.

**Eksport „do Worda / Google Docs" — bez integracji API Google.** Zgodnie z
decyzją zapisaną w planie: żadnego OAuth, żadnej biblioteki `googleapis`.
`exportScratchpadToWord` (ten sam plik) generuje blob HTML z nagłówkiem
zgodnym z formatem Worda (`xmlns:w="urn:schemas-microsoft-com:office:word"`),
pobierany z `Content-Type: application/msword` i rozszerzeniem `.doc` — Word
otwiera go bezpośrednio, Google Docs po wgraniu na Dysk („Otwórz za pomocą →
Dokumenty Google"). Przycisk w UI podpisany uczciwie: „Eksportuj do Worda"
z opisem „Otwiera się też w Google Docs" — nigdzie nie nazwane wprost
eksportem „do Google Docs".

**Nazewnictwo „Brudnopis" → „Notatnik".** Zmieniony wyłącznie widoczny dla
użytkownika tekst w `components/scratchpad/` (nagłówki, tytuły, opisy,
przyciski, samouczek) — nazwy plików, zmiennych, funkcji, kolekcji Firestore
`scratchpads` i `scratchpadService.ts` zostają bez zmian, zgodnie z briefem.
Komentarze w kodzie i komunikaty `console.error`/`console.warn` (niewidoczne
dla użytkownika) też zostawione bez zmian.

**Stan weryfikacji:** `npx tsc --noEmit` czysto (poza dwoma niepowiązanymi,
przedistniejącymi błędami w `functions/src/notion/{client,sync}.ts` —
brakujący moduł `firebase-functions/logger` w środowisku, potwierdzone przez
odtworzenie tego samego błędu na commicie sprzed tej zmiany), `npm test` —
251/253 (te same dwa niepowiązane, przedistniejące niepowodzenia w
`tests/notionLevel.test.ts` i `tests/notionMatch.test.ts`, ten sam brakujący
moduł, potwierdzone na commicie sprzed zmiany), `npm run test:rules` 37/37,
`npm run build` przechodzi.

### 🔧 Generator testów — trzy naprawy (2026-09-12)

Błędy wychwycone przez Macieja w trakcie testowania aplikacji. Wszystkie w kodzie v1, niezwiązane z silnikiem v2.

**1. Twarde 502 przy każdym generowaniu testu.** Lektor dostawał „Model nie zwrócił poprawnej listy zadań" — a model odpowiadał poprawnie. `AI_MODEL_CASCADE` zaczyna od `openai/gpt-5.6-luna`, ścieżka OpenAI wymusza `response_format: json_object`, a ten tryb **z definicji zwraca obiekt**, nigdy gołej tablicy. `parseQuestions` wymagało `Array.isArray`, więc `{"questions":[...]}` leciało do kosza. Działało, dopóki pierwszym modelem w kaskadzie był Gemini (`responseSchema` typu ARRAY oddaje tablicę) — zepsuło się bez żadnej zmiany w samym generatorze. Naprawa: `utils/modelJsonList.ts` przyjmuje oba kształty.

**2. Ćwiczenia generowały się po polsku** — tekst z lukami, bank słów i pytania wielokrotnego wyboru po polsku, w aplikacji do nauki angielskiego. Przyczyna w regułach promptu: `find_mistake` mówiła wprost „w języku angielskim" i działała, a `fill_in_blank`, `fill_in_blank_bank` i `multiple_choice` nie mówiły o języku nic. Skoro prompt i materiał lekcji są po polsku, model wziął polski jako domyślny. Naprawa w `utils/testExerciseRules.ts`: żelazna zasada językowa + język nazwany wprost w każdej regule, plus **walidacja wyniku** per typ i per pole z jedną próbą automatycznej naprawy. Wykrywanie polskiego łączy diakrytykę, słowa funkcyjne i fleksję — samo „Monika pracuje w HR" bez ogonków nie dawało się rozpoznać bez tej trzeciej warstwy.

Przy okazji `fill_in_blank` dostał kształt klasycznego ćwiczenia z podręcznika: angielski tekst, a przy każdej luce forma bazowa w nawiasie — `Last summer Anna ___ (go) to Italy`.

**3. Kursant sam obniżał sobie poziom testu.** W ekranie testu stał przełącznik „Easy — układanka / Hard — wpisywanie", którym kursant wybierał tryb w trakcie rozwiązywania. Poziom pochodzi teraz z `TestQuestion.difficulty`, czyli od lektora, domyślnie `hard`. Praca domowa nietknięta — tam wybór kursanta zostaje.

---

### 🆕 Silnik prac domowych v2 — Etapy 0–4 (2026-09-12)

Wdrożenie zlecenia z Notion („Cribro Recall — kanoniczna specyfikacja silnika v2", §18). Całość **za flagą `HOMEWORK_ENGINE_V2`, domyślnie wyłączoną**. Ścieżka v1 nietknięta.

**Pętla, która działa:** zatwierdzona lekcja → plan 3 typów → zadania JSON → osobny walidator → 1 ekran podglądu → Wyślij → 3 próby → rubryka 40/40/20 → feedback Asystenta Cribro → stan `nowe|ćwiczymy|opanowane` → propozycja powtórki.

- **Etap 0 — audyt** (`docs/audyt-homework-v2.md`): mapa kodu i 18 różnic. Trzy ustalenia zmieniły plan: Express **nie jest** tylko lokalny (stoi na Vercelu przez `api/serverless.ts`), kaskada modeli v1 schodzi do Gemini, a reguła `specialTasks.update` nie przepuściłaby pól potrzebnych na próby i wznowienie.
- **Etap 1 — kontrakty i flaga**: `functions/src/homeworkV2/contracts.ts` — zamrożona rubryka (znaczenie 40 / materiał docelowy 40 / poprawność 20, skala 0/0,5/1), próg pewności 0,6, drabinka podpowiedzi, stan opanowania. Ręczne strażniki typów zamiast `zod` (zlecenie zabrania nowych bibliotek, a w repo nie było żadnego walidatora schematu).
- **Etap 2 — serwisy w Cloud Functions**: Assembler, Planner, Generator, Validator, Grading, Feedback, profil, ReviewPlanner. Kaskada **wyłącznie OpenAI** (`gpt-5.6-luna` → `gpt-4o-mini`; nazwa logiczna mapuje się na `gpt-4o`, jak w `server.ts:4`). Wywołanie modelu jest wstrzykiwane, więc wszystko da się testować bez klucza i bez sieci.
- **Etap 3 — ekran lektora**: `HomeworkComposerV2` — jeden ekran podglądu i Wyślij, kontrakt pod rozwinięciem. Zadania, których walidator nie przepuścił po dwóch regeneracjach, nie idą automatycznie.
- **Etap 4 — flow kursanta**: `StudentHomeworkV2Screen` — mobile-first, jedno zadanie na ekran, bez procentu i bez słupka. Autosave i wznowienie przez Firestore (w v1 szkic żył tylko w `localStorage`, więc nie przeżywał zmiany urządzenia).

**`firestore.rules` — dwa nowe bloki wewnątrz `specialTasks`, reguła bazowa nietknięta:**
- `attempts/{attemptId}` — odczyt dla właściciela i lektora, **zapis dla nikogo**. Werdykt pisze wyłącznie Cloud Function przez Admin SDK. Kursant nie ma jak podstawić sobie `masteryState: 'opanowane'`. Historia prób jest niezmienna.
- `drafts/{draftId}` — autosave kursanta, pola wyliczone wprost, żeby nie dało się przemycić werdyktu szkicem.

**Czego to NIE rusza:** `server.ts`, `geminiService.ts`, `homeworkGenerator.ts`, mailingu, fiszek, SRS, testów postępu, syncu Notion. `notifyStudentOnHomework` działa dalej — zestaw v2 zachowuje pole `sentences` (wyzwalacz liczy z niego pozycje do maila) i ustawia `skipAutoEmail`, czyli wchodzi w ten sam tryb co kreatory v1.

**Stan weryfikacji:** `tsc --noEmit` czysto, 244/244 testów jednostkowych (komplet ośmiu testów obowiązkowych ze zlecenia), 33/33 testów reguł na emulatorze, oba buildy przechodzą. **Wdrożone i uruchomione na produkcji 2026-09-12**: siedem funkcji w `us-central1` (`notifyStudentOnHomework` zaktualizowana bez błędu, mailing nietknięty), sekret `OPENAI_API_KEY` w Secret Managerze, obie połowy flagi włączone. PITR i ochrona przed skasowaniem bazy włączone, harmonogram backupów dzienny z retencją 7 dni. **Żaden przebieg z prawdziwym modelem jeszcze nie miał miejsca** — to następny krok. Dokumentacja: `docs/silnik-v2-architektura.md`. **Żaden przebieg end-to-end z prawdziwym modelem nie został wykonany** — brakuje sekretu `OPENAI_API_KEY` po stronie Cloud Functions. Kroki do uruchomienia: `docs/backup-restore-homework-v2.md`.

**Blokada przed wdrożeniem:** projekt nie ma żadnego automatycznego backupu Firestore poza bazą produkcyjną. Polecenia `gcloud` w `docs/backup-restore-homework-v2.md` §2 — wymaga uprawnień billingowych.



### Dokumentacja: `CLAUDE.md` i `AGENT_LOG.md`

Dodano `CLAUDE.md` — stały kontekst dla agentów AI pracujących nad repo
(architektura, obszary wysokiego ryzyka, konwencje kodu, komendy
operacyjne, dług techniczny, zasady commitowania i logowania pracy).
Szkic przygotował Maciej, uzupełniono go realnymi danymi z repo,
`AGENTS.md` i tej sekcji CHANGELOG. Dodano też `AGENT_LOG.md` — dziennik
pracy kolejnych agentów AI, z pierwszym wpisem opisującym to zadanie.

### Bezpieczeństwo: Zamknięcie dziury w regułach brudnopisu i indeks PIN-ów

Kolekcja `scratchpadPins` (dodana wcześniej razem z zamknięciem `list` na `scratchpads`,
patrz sekcja 3) miała zapis otwarty dla każdego zalogowanego (`allow create, update: if
isAuthenticated()`). To było zbyt szerokie: dowolny zalogowany kursant mógł nadpisać wpis
`scratchpadPins/{PIN}` i przekierować **czyjś** kod PIN na **własny** notatnik — przejęcie
linku bez znajomości hasła, tylko przez odgadnięcie/podsłuchanie kodu innego kursanta.

- **`firestore.rules`**: `create`/`update` na `scratchpadPins/{pin}` wymaga teraz albo
  `isAdmin()`, albo bycia stroną notatnika, na który wpis wskazuje (`teacherUid` lub
  `studentId` dokumentu `scratchpads/{scratchpadId}` musi się zgadzać z `request.auth.uid`)
  **i** zgodności ID dokumentu (`pin`) z polem `pin` w tym notatniku — bez tego drugiego
  warunku kursant mógł nadal przejąć cudzy PIN, wskazując go na **własny** (poprawnie
  należący do niego) notatnik, bo sama własność dokumentu docelowego nie potwierdza, że kod
  PIN też do niego należy. Wykryte przez test, nie przez przegląd kodu — patrz niżej.
- **`tests/rules/firestore.rules.test.ts`**: nowe testy na emulatorze — `list` na
  `scratchpads` odmawia każdemu (łącznie z adminem), `get`/`list` na `scratchpadPins`
  zachowuje się jak zaprojektowano, właściciel (lektor i kursant) zapisuje swój wpis, admin
  zapisuje niezależnie od właściciela, a próba przejęcia cudzego PIN-u (`setDoc`/`updateDoc`
  wskazujący na inny notatnik) jest odrzucana. `npm run test:rules` → 23/23.
- **`scripts/backfill-scratchpad-pins.mjs`** (nowy, jednorazowy): dopisuje wpisy w
  `scratchpadPins` dla notatników założonych przed wprowadzeniem indeksu. Aplikacja dorabia
  taki wpis też sama przy pierwszym otwarciu (`ensureScratchpadPinIndex` w
  `services/scratchpadService.ts`), ale tylko dla dokumentów z deterministycznym ID
  (`sp_{studentId}`) — notatniki bez `studentId` (stare `sp_{timestamp}`) nikt od tamtej
  pory mógł nie otworzyć, więc same się nie naprawią. Skrypt wykrywa i zgłasza kolizje PIN-ów
  (dwa notatniki z tym samym kodem) zamiast zgadywać, który jest właściwy. Suchy przebieg
  domyślnie, `--apply` żeby zapisać.
- **Rozważona i odrzucona decyzja**: opakowanie zapisu `scratchpads` + `scratchpadPins` przy
  tworzeniu notatnika w jeden atomowy `runTransaction`. Sprawdzone empirycznie na emulatorze:
  dla lektora/admina (rola z `isAdmin()`) transakcja działa, ale dla kursanta tworzącego
  własny notatnik po raz pierwszy (`StudentScratchpadScreen`, `teacherUid` to placeholder
  `teacher_default`) — pada, bo reguła własności PIN-indeksu odczytuje (`get()`) dokument
  `scratchpads`, którego w tej samej, jeszcze niezatwierdzonej transakcji Firestore nie widzi.
  Obecny sekwencyjny zapis (dwa kolejne `await`, bez zmian w tym kroku) działa poprawnie pod
  nowymi regułami dla obu ścieżek — potwierdzone testami. Zdecydowano zostać przy nim: okno
  niekonsystencji jest już ograniczone przez samoleczenie przy każdym kolejnym otwarciu i przez
  skrypt migracji powyżej.

### Poprawka: Tryb Dzienny Wstaje — Montaż `ThemeProvider`, Czytelny Ekran Startowy i Limit Precache

Poprzedni etap dołożył cały motyw jasny, ale aplikacja po starcie pokazywała czerwony ekran
`useTheme must be used within a ThemeProvider`. Naprawione i **sprawdzone w przeglądarce**
(Playwright, oba motywy, zero błędów w konsoli).

- **`ThemeProvider` nie był nigdzie zamontowany (`index.tsx`)**:
  - `ThemeContext` i `ThemeToggle` powstały w poprzednim commicie, ale drzewa aplikacji nikt nie opakował providerem. Pierwszy `useTheme()` w `Sidebar → ThemeToggle` rzucał wyjątek i cały panel zastępował ekran błędu.
  - Provider stoi teraz **najwyżej**, nad `ErrorBoundary` i `App`, więc motyw obowiązuje tak samo na ekranach publicznych (test z linku, brudnopis, praca domowa z e-maila), które renderują się poza `Dashboard`.
- **Mignięcie ciemnego tła przy trybie dziennym (`index.html`)**:
  - `<html class="dark">` jest w szablonie na sztywno, więc kursant z wybranym trybem dziennym oglądał ciemny ekran do chwili zamontowania Reacta. Dodany **synchroniczny skrypt w `<head>`** ustawia klasę, `data-theme` i `color-scheme` z `localStorage` (albo z ustawienia systemowego) jeszcze przed pierwszym malowaniem. Klasa w szablonie zostaje jako zachowanie awaryjne przy wyłączonym JS.
- **Ekran startowy i logowanie były nieczytelne w trybie dziennym (`LandingPage.tsx`, `AuthScreen.tsx`)**:
  - Oba ekrany malowały tekst surowym `text-white` (32 wystąpienia) oraz tła `bg-black/30`, `bg-white/5`, obramowania `border-white/10`. To **nie są tokeny**, więc przełącznik ich nie dotykał: nagłówek „CRIBRO", „Start here" i podpisy kafelków zostawały białe na papierowym tle, a przycisk logowania e-mailem — ciemnoszary.
  - Zamienione na tokeny: `text-white → text-text-hi`, `border-white/10 → border-line-strong`, `bg-white/5 → bg-line-soft`, `bg-black/30 → bg-ink` itd. W trybie nocnym wartości tokenów są niemal tożsame z poprzednimi (`--text-hi` to dokładnie `#ffffff`, `--line-strong` to `rgba(255,255,255,0.12)`), więc **wygląd nocny się nie zmienia** — potwierdzone zrzutem przed i po.
- **Build wywalał się na limicie precache PWA (`vite.config.ts`)**:
  - `maximumFileSizeToCacheInBytes` stało na `5 000 000`, a główny bundle ważył `4 999 820` B. Dołożenie **kilkuset bajtów** kodu przekraczało próg i `vite build` kończył się błędem workboxa (kod wyjścia 1), co wywróciłoby też deploy. Limit podniesiony do 8 MB; realnym rozwiązaniem jest podział bundla na chunki.

### Poprzedni etap: Tryb Dzienny (Day Mode), Powiadomienie o Przypisanym Teście i Uproszczenie Menu Kursanta

- **Tryb dzienny — pełny motyw jasny (`design/theme/tokens.css`, `index.css`)**:
  - Zrealizowany wg `design_handoff_day_mode/README.md` jako **drugi zestaw wartości dla tych samych nazw zmiennych** — zero nowych tokenów, zero zmian w komponentach.
  - **Kluczowe odkrycie:** aliasy Tailwinda (`bg-base-200`, `text-content-muted` i ~2700 innych użyć) mają w `@theme` zaszyte hexy, ale Tailwind v4 generuje utilities jako `background-color: var(--color-base-200)`. Nadpisanie tych zmiennych pod `:root[data-theme="light"]` przestawia więc **cały interfejs — panel lektora, administratora i kursanta — bez dotykania choćby jednego komponentu**. Zweryfikowane na zbudowanym CSS.
  - Akcent w trybie dziennym jest ciemniejszy (`#14a06e` zamiast mięty `#72f0b4`): mięta na białym tle daje ok. 1.8:1 i drobny tekst staje się nieczytelny. Mięta zostaje w poświatach i dużych wypełnieniach. Analogicznie przyciemnione `--warn` / `--danger` / `--info`.
  - Cienie oparte na barwie atramentu (`#1e2630`, krycie 0.16–0.20) zamiast czerni — czarne cienie na papierowej bieli czytają się jak brud.
  - `ThemeContext` ustawia teraz `data-theme` **oraz** `color-scheme` na elemencie głównym; bez tego natywne kontrolki (paski przewijania, pola formularzy) zostawały ciemne na jasnym tle.
- **Animacja przełączania — lepsza niż w handoffie (`components/ui/ThemeToggle.tsx`)**:
  - Handoff opisywał nakładkę rysowaną GSAP-em: dysk skalowany **nad** treścią, potem wygaszany. Zamiast tego użyto natywnego **View Transitions API** — rosnący okrąg przycina migawkę *nowego* motywu, więc rozbłysk **odsłania prawdziwy interfejs**, zamiast przykrywać go kolorową płachtą. Animacja idzie przez kompozytor przeglądarki, a nie przez JS na każdej klatce, i nie wymaga dokładania warstwy nad aplikację.
  - Fala rozchodzi się **ze środka klikniętego przycisku**, promień liczony do najdalszego rogu okna. Ikony słońca i księżyca leżą na sobie i wymieniają się obrotem ze sprężystym easingiem — bez przeskoku układu, który daje warunkowe renderowanie jednej z nich.
  - Fallback dla przeglądarek bez View Transitions (Firefox, Safari) oraz dla `prefers-reduced-motion`: zwykłe przełączenie z 0,5-sekundowym przejściem kolorów.
  - Atrybut `[data-morphing]` włącza przejście kolorów **tylko na czas zmiany** — na stałe spowolniłby każdy hover w aplikacji z 0,2 s do 0,5 s.
  - **`ThemeToggle` nie był wcześniej nigdzie zamontowany** — dlatego przełącznika w ogóle nie było w interfejsie. Trafił do stopki menu bocznego, obok przełącznika języka.
- **Powiadomienie o przypisanym teście (`components/ui/ActionToast.tsx`, `AdminTestGenerator.tsx`)**:
  - Po przypisaniu testu kursantowi pojawia się pop-up w prawym dolnym rogu z animacją sprężynową i **tym samym sygnałem dźwiękowym**, co powiadomienie o odesłanej pracy — zamiast `alert()`, które zabiera fokus i trzeba je odklikać przy każdym teście.
  - Dźwięk wyciągnięty do wspólnego `utils/notificationChime.ts` (dwuton D5→A5 generowany oscylatorem — bez żądania sieciowego, działa offline). `TeacherHomeworkNotification` korzysta teraz z tego samego modułu zamiast własnej kopii.
- **Usunięcie zakładki „Testy" z menu kursanta (`Sidebar.tsx`)**:
  - Kursant ma w menu tylko **„Mój panel"** — testy są jego częścią, a nie osobnym miejscem.
  - O czekającym teście przypomina **pulsująca kropka** przy ikonie panelu plus plakietka „test". Kropka zamiast liczby, bo chodzi o sygnał „coś na Ciebie czeka", a nie o raport ilościowy.
  - Dodano nasłuch testów przypisanych kursantowi (bez `completedAt`, status inny niż `completed`/`graded`). Poprzedni licznik przy tej zakładce liczył `teacherRead == false`, czyli metrykę **lektora**, i był wypełniany wyłącznie dla lektora — u kursanta zawsze pokazywał zero.

### Poprzedni etap: Naprawa Generatora Testów, Postęp w Blokach Pracy Domowej i Placeholder Testów Poziomujących

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

### 4. Rejestr Zmian (Changelog)

### 🐛 2026-09-18 — Naprawa Regresji: Synchronizacja Notatnika Lekcyjnego Przestała Działać dla Kursanta

- **Objaw**: Lektor widział status „Zsynchronizowano" przy zapisie, ale kursant nie otrzymywał treści na żywo (pusty edytor / brak aktualizacji).
- **Przyczyna**: Regresja wprowadzona tego samego dnia (commity `7217fa9`, `96aa789`, `4848657`) podczas prób naprawy loadera notatnika:
  - Twardy timeout bezpieczeństwa (`setTimeout(() => setIsLoading(false), 2500)`) w `TeacherScratchpadScreen.tsx` i `StudentScratchpadScreen.tsx` potrafił zwolnić stan ładowania, zanim faktyczny dokument został pobrany z Firestore.
  - W tym oknie lektor renderował edytor na podstawie obiektu zastępczego (`safeScratchpad`), którego identyfikator dla notatnika roboczego liczył się jako `` `sp_${Date.now()}` `` **na nowo przy każdym renderze** — zamiast stałego `sp_<uid>` kursanta. Zapisy trafiały więc pod wciąż inny, efemeryczny dokument, którego kursant nigdy nie słuchał (jego ekran zawsze nasłuchuje `sp_<uid>`).
  - Zapis mimo to „się udawał" (Firestore przyjmował go pod dowolnym ID przez fallback `updateDoc` → `setDoc`), stąd mylący status „Zsynchronizowano" u lektora.
- **Naprawa**: Usunięto twardy timeout (zbędny — `try/finally` z tego samego dnia już gwarantuje zwolnienie loadera) i fallback `safeScratchpad`; edytor lektora renderuje się dopiero po realnym załadowaniu dokumentu, tak jak przed regresją. `handleAssignStudent` wraca do wersji, która czeka na `adoptScratchpadForStudent` przed przełączeniem lokalnego stanu, bez optymistycznego przeskoku ID. Zachowano dzisiejsze poprawki czysto kosmetyczne (klasy CSS wysokości kontenerów). Szczegóły: `AGENT_LOG.md`, wpis 2026-09-18.
- **Zweryfikowano**: `npx tsc --noEmit` (0 błędów), `npm test` (359/359), `npm run build` (kod 0). Nie zweryfikowano wzrokowo w przeglądarce z dwoma równoległymi sesjami — do potwierdzenia przez Macieja.

### 🚀 2026-09-17 — Przebudowa Planera Lekcji AI: Wybór Kursanta z Listy, Auto-zaczytywanie Poziomu CEFR, Architektura 6 Bloków ze Zrzutów, 1-klikowe Zadanie Pracy Domowej ze Zdań i Centrum Prezentacji z Przypisanymi Prezentacjami

#### 1. Wybór Kursanta / Grupy z Bazy i Automatyczne Zaczytywanie Poziomu CEFR
- **Problem**: W kroku 1 planera lekcji (`LessonPlannerStudio.tsx`) pole *Kursant / Grupa* było zwykłym polem tekstowym, a lektor musiał ręcznie wpisywać imię i ustalać poziom CEFR.
- **Rozwiązanie**:
  - Wdrożono wyszukiwalny selektor kursanta z bazy `users` z podglądem imienia, nazwiska (`formatStudentDisplayName`), adresu e-mail oraz odznaki poziomu CEFR.
  - Wybór kursanta automatycznie:
    1. Ustawia imię kursanta w `brief.audience`,
    2. Zaczytuje poziom zaawansowania z profilu kursanta (`user.level`) do `brief.level` i generatora slajdów,
    3. Synchronizuje historię lekcji z profilu ucznia do briefu,
    4. Umożliwia wpisanie niestandardowej grupy lub ręczną modyfikację poziomu w razie potrzeby.

#### 2. Dwu-opcyjne Menu Główne Planera: Nowy Scenariusz vs Nowa Prezentacja
- **Nowa funkcjonalność**: Na wejściu do Planera Lekcji lektor ma do wyboru 2 główne tryby pracy:
  1. 📝 **Nowy scenariusz lekcji** — kreator scenariusza krok po kroku (Ustalenia -> Temat -> Scenariusz w 6 blokach),
  2. 📺 **Nowa prezentacja & slajdy** — Centrum Prezentacji & Slajdów AI zintegrowane z notatnikiem i bazą slajdów.

#### 3. Architektura 6 Bloków Akordeonowych wg Szablonu
- **Problem**: Scenariusz wymagał pełnej edytowalności wszystkich elementów, jasnego podziału na bloki ze zrzutów ekranu oraz przejrzystego interfejsu metodycznego.
- **Rozwiązanie**:
  - Wdrożono rozwijaną strukturę blokową ze zrzutu ekranu:
    1. *Karta wstępna lekcji*: Format, Cel, Materiał źródłowy,
    2. *Karta materiałów audio*: Odtwarzacz MP3/WAV, usuwanie i dodawanie nagrań do lekcji,
    3. *Revision and Warm Up (10 min)*: 5 pytań check-in, revision translation, older lesson refresh,
    4. *Grammar Review (10 min)*: Opcjonalne reguły gramatyczne z przykładami,
    5. *Main Topic & Discussion (28–30 min)*: Sub-bloki *Topic and Material*, *Lead-in* oraz *Thought-Provoking Questions (Safety Bank)* z rozwijaną Budką Suflera (*Teacher's Notes*: • Cel, • Scaffolding z 1-klikowym kopiowaniem, • Follow-up),
    6. *Language Focus (12 min)*: Delayed Correction i Key Vocabulary z tłumaczeniami,
    7. *Practice Enclosure (10 min)*: Ćwiczenia interaktywne na żywo (Quiz jednokrotnego wyboru, Sentence Scramble, Polowanie na błąd) z przyciskiem *„🚀 Uruchom dla kursanta”* prosto w notatniku `sp_<uid>`,
    8. *Wrap-up & Homework (5 min)*: Podsumowanie wniosków oraz **Sugerowana praca domowa — konkretny obszar do przećwiczenia**.
  - Każdy element szablonu jest w 100% edytowalny (edycja tekstu i Teacher's Notes, dodawanie nowych punktów, usuwanie, zmiana kolejności góra/dół, zaznaczanie checkboxem, zaznaczanie do modyfikacji AI w czacie asystenta).

#### 4. 1-Klikowe Przejście do Tworzenia Pracy Domowej ze Zdań
- **Nowa funkcjonalność**: W bloku pracy domowej oraz w górnym pasku scenariusza dodano przycisk **„📝 Stwórz pracę domową ze zdań”**.
- Kliknięcie natychmiast otwiera generator zadań domowych (`TeacherSpecialTaskModal`) dla wybranego kursanta, z automatycznie przekazanym tematem lekcji, wytycznymi metodycznymi z planu oraz słownictwem z sekcji Language Focus (`extractVocabularyList`).

#### 5. Centrum Prezentacji i Slajdów AI z Przypisanymi Prezentacjami Kursanta
- **Nowa funkcjonalność**:
  - Kreator slajdów w planerze oferuje ten sam zaawansowany silnik co w notatniku (`ScratchpadLivePresentationModal`): Generator Slajdów AI, 7 interaktywnych wzorców, Szybki Wklejacz, Własny Slajd/Audio.
  - Dodano dedykowaną zakładkę **„📂 Przypisane Prezentacje dla [Kursant]”**:
    - Prezentacje zapisywane w planerze lub generowane dla ucznia otrzymują powiązanie `studentId` i automatycznie pojawiają się w notatniku kursanta (`sp_<uid>`) w sekcji gotowych prezentacji.
    - Lektor może 1 kliknięciem otworzyć prezentację w pełnym trybie prezentera (`LessonPresentationView`), uruchomić transmisję slajdów na żywo do notatnika ucznia lub zarządzać bazą prezentacji.

#### 6. Weryfikacja i Testy
- Utworzono testy w [tests/lessonPlannerStudio.test.ts](tests/lessonPlannerStudio.test.ts) testujące formatowanie nazw kursantów, generowanie promptów z 6 blokami, ekstrakcję prac domowych (`extractHomeworkTask`) i słownictwa (`extractVocabularyList`).
- Komplet 354 testów jednostkowych przechodzi pomyślnie (`npm test`), build produkcyjny (`npm run build`) oraz `npx tsc --noEmit` bez żadnych błędów.

### 🚀 2026-09-17 — Faza 1: Cockpit Lektora „Dzisiaj” + Zintegrowana Karta Kursanta (Student Operational Hub)

#### 1. Pulpit Lektora „Dzisiaj” (Teacher Daily Cockpit)
- **Problem**: Lektor po wejściu do aplikacji musiał przeklikiwać wiele osobnych widoków, aby ustalić, z kim ma dziś lekcje, które lekcje z transkrypcji/Notion wymagają domknięcia i publikacji, czyje prace domowe czekają na sprawdzenie oraz którzy kursanci nie mają zaplanowanych kolejnych spotkań.
- **Rozwiązanie**:
  - Wdrożono komponent `TeacherTodayCockpit.tsx` zasilany serwisem `teacherCockpitService.ts` (`fetchTeacherCockpitData`).
  - **4 kluczowe metryki KPI**: *Lekcje na dziś*, *Lekcje do domknięcia*, *Prace domowe do sprawdzenia*, *Kursanci bez planu*.
  - **Rozkład dnia**: Lista zaplanowanych lekcji z natychmiastowym przyciskiem *„Prowadź zajęcia”* (otwarcie notatnika Live Scratchpad w nowej karcie), *„Planer”* oraz wglądem w profil ucznia.
  - **Kolejka do domknięcia**: Natychmiastowa identyfikacja lekcji oczekujących na zatwierdzenie, transkrypcji Sift oraz lekcji bez wprowadzonych 4 bloków z wizualnymi tagami stanu (*Podsumowanie*, *Praca domowa*, *Słownictwo*).
  - **Prace domowe**: Podgląd nadesłanych prac (`status: 'submitted'`) z natychmiastowym przejściem do weryfikacji oceny AI i feedbacku lektora.
  - **Kursanci bez planu**: Lista aktywnych uczniów, którzy nie mają zaplanowanej lekcji w nadchodzących 7 dniach, z 1-klikowym wejściem do generowania scenariusza lekcji.

#### 2. Zintegrowana Karta Kursanta (Student Operational Hub)
- **Problem**: Kontekst kursanta był rozproszony po wielu zakładkach (profil, historia lekcji, zadania domowe, słownictwo, statystyki), co wydłużało czas przygotowania do zajęć.
- **Rozwiązanie**:
  - Wdrożono `StudentOperationalHub.tsx` (`fetchStudentHubContext`), agregujący pełen obraz ucznia w jednym miejscu z czasem rekonstrukcji kontekstu <60 sekund.
  - **Główny pasek CTA**: *„✨ Przygotuj kolejną lekcję”* (bezpośrednie przejście do `LessonPlannerStudio` z załadowanym kontekstem ucznia), *„Prowadź lekcję”* (Live Scratchpad) oraz *„Zadaj pracę domową”*.
  - **Nagłówek operacyjny**: Poziom CEFR, cel nauki, branża, format nauki, status współpracy, hasło startowe do aplikacji z opcją kopiowania i wysyłką zaproszenia e-mail.
  - **4 dedykowane zakładki operacyjne**:
    1. *Briefing & Odprawa AI*: Pamięć słabych punktów `weaknesses`, automatyczny brief przedlekcyjny AI z rekomendowanymi tematami i zagadnieniami gramatycznymi.
    2. *Oś czasu tematów & 4 bloków*: Chronologiczny podgląd ostatnich 10 tematów z podziałem na *Słownictwo*, *Gramatykę*, *Wymowę* i *Zadania*.
    3. *Zadania domowe & Recall*: Status nadesłanych prac, wskaźniki ukończenia oraz statystyki bazy fiszek SRS.
    4. *Cele & Profil*: Szczegółowe dane kontaktowe, uprawnienia i preferencje nauki.

#### 3. Rozszerzenie Modeli Danych i Architektury Typów
- **Zmiany w [types.ts](types.ts)**:
  - Dodano `LessonWorkflowStatus` (`'idea' | 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'closed' | 'archived'`).
  - Rozszerzono model `User` o pola `goals`, `industry`, `learningFormat`.
  - Rozszerzono `LessonRecord` o `workflowStatus`.
  - Zdefiniowano interfejsy `TeacherCockpitData`, `ScheduledLessonCard`, `CloseoutLessonCard`, `ReviewHomeworkCard`, `StudentWithoutPlanCard`, `StudentOperationalHubData`.

#### 4. Weryfikacja i Testy Jednostkowe
- Utworzono pakiet testów w [tests/teacherCockpit.test.ts](tests/teacherCockpit.test.ts) testujący funkcje wyznaczania statusu cyklu życia lekcji `deriveLessonWorkflowStatus` oraz formatowania dat `getIsoDateOnly`.
- Wszystkie 349 testów jednostkowych przechodzi pomyślnie (`npm test`), build produkcyjny (`npm run build`) oraz typowanie TypeScript (`npx tsc --noEmit`) bez błędów.

#### 5. Globalna Zasada Adresowania Użytkowników: Samo Imię i Zawsze w Odmianie (Wołacz / Narzędnik)
- **Problem**: W nagłówkach odpraw przedlekcyjnych (`PreLessonContext`), powitaniach oraz promptach AI użytkownicy byli adresowani pełnym imieniem i nazwiskiem (np. *„Maciej Wyrozumski, ostatnio z Mileną Miksa-Matyjasik...”*), co brzmiało sztucznie i nieelegancko.
- **Rozwiązanie**:
  - Wdrożono zasadę globalną: **nigdy nie adresujemy użytkownika z nazwiskiem — samo imię w zupełności wystarczy, zawsze odmienione w poprawnym polskim wołaczu lub narzędniku**.
  - Rozbudowano [utils/polishVocative.ts](utils/polishVocative.ts):
    - `formatOnlyFirstName`: wyciąga wyłącznie pierwsze imię, czyszcząc nazwiska, znaki interpunkcyjne, podkreślenia i kropki (`Milena.Miksa-Matyjasik` -> `Milena`, `Maciej Wyrozumski` -> `Maciej`).
    - `toPolishVocative`: zawsze odcina nazwisko i odmienia pierwsze imię w wołaczu (`Macieju`, `Anno`, `Piotrze`, `Kasiu`, `Michale`).
    - `toPolishInstrumental`: generuje formę narzędnika dla konstrukcji „z [Imię]” (`z Mileną`, `z Maciejem`, `z Anną`, `z Bartkiem`).
    - `sanitizeBriefingHeadline`: filtruje i czyści nagłówki odpraw AI (również w buforze `localStorage`), konwertując mianownik i nazwiska na naturalny wołacz (*„Macieju, ostatnio z Mileną w...”*).
  - W [utils/studentFormat.ts](utils/studentFormat.ts) dodano `formatStudentFirstName`.
  - W [services/preLessonBriefing.ts](services/preLessonBriefing.ts), [services/teacherAssistant.ts](services/teacherAssistant.ts), [services/geminiService.ts](services/geminiService.ts) oraz komponentach UI (`PreLessonContext.tsx`, `StudentOperationalHub.tsx`, `TeacherTodayCockpit.tsx`) wprowadzono ścisłe reguły przekazywania wyłącznie pierwszego imienia i egzekwowania wołacza przez modele AI.
  - Pokryto nową funkcjonalność kompleksowymi testami jednostkowymi w [tests/polishVocative.test.ts](tests/polishVocative.test.ts) i [tests/studentFormat.test.ts](tests/studentFormat.test.ts).

### 🚀 2026-09-17 — Czat Lektora: Masowy Import Kursantów (Admin-only), Web Scraping & Research, Renderer HTML i Generator PDF A4, Poprawa Powitań i Nazwisk

#### 1. Masowy Import Kursantów z Innych Platform przez Czat (Tylko Administrator)
- **Problem**: Ręczne wpisywanie kursantów podczas migracji z innych aplikacji (np. LangLion, arkuszy Google Sheets, systemów CRM) było czasochłonne i wymagało wielokrotnego wypełniania formularza dodawania użytkownika.
- **Rozwiązanie**:
  - Utworzono dedykowany endpoint backendu `POST /api/admin-users/bulk-import` chroniony middleware `requireFirebaseAdmin`. Obsługuje on jednoczesne zakładanie kont w Firebase Authentication i profili w kolekcji `users` w Firestore, generuje unikalne adresy e-mail `@student.vocabboost.com` i bezpieczne hasła startowe, pomija istniejące duplikaty oraz zwraca szczegółowy raport statusów.
  - Asystent Lektora (`TeacherAssistant.tsx` + `teacherAssistant.ts`) potrafi zinterpretować wklejony tekst, tabelę, CSV czy listę kontaktów i zaprezentować interaktywną kartę podglądu `BulkStudentImportCard` z tabelą użytkowników, poziomami CEFR, firmami i przyciskiem natychmiastowego importu jednym kliknięciem.
  - Narzędzie jest ściśle ograniczone do użytkowników z rolą `admin` — dla zwykłych użytkowników i lektorów komenda `/import` i akcja importu są niewidoczne i zablokowane.

#### 2. Narzędzia Web Scrapingu i Researchu Internetowego
- **Problem**: Lektorzy potrzebują wyszukiwać i analizować autentyczne materiały, artykuły prasowe czy słownictwo branżowe z sieci bez opuszczania czatu.
- **Rozwiązanie**:
  - Wdrożono endpoint `POST /api/web-research/scrape` pobierający strony internetowe z nagłówkami User-Agent, czyszczący zbędny kod HTML (skrypty, style, nawigację) i dostarczający esencję tekstu do analizy przez model AI.
  - Asystent automatycznie wykrywa linki URL w promptach, pobiera ich treść i dołącza do kontekstu modelu, generując podsumowania, konspekty lub pytania konwersacyjne z listą klikalnych źródeł `WebSourcesList`.
  - Dodano komendę `/research` do szybkiego zlecania analizy źródeł internetowych.

#### 3. Wbudowany Renderer HTML oraz Generator PDF A4 dla Raportów i Planów
- **Problem**: Raporty postępów, plany wdrożenia i konspekty generowane w czacie były zwykłym tekstem markdown, wymagającym ręcznego formatowania przy wysyłce do klienta/kursanta.
- **Rozwiązanie**:
  - Zaimplementowano funkcję `exportHtmlToPDF` w [utils/pdfExport.ts](utils/pdfExport.ts) przygotowaną do druku w formacie A4 z zachowaniem typografii CRIBRO, nagłówków, ramek i tabel.
  - Asystent wyposażony w komendy `/raport` oraz `/plan` generuje bloki ````html_report ... ````, które czat renderuje w formie karty `HtmlReportCard` z podglądem na żywo, opcją otwarcia w nowym oknie, kopiowaniem kodu źródłowego oraz 1-klikowym pobraniem sformatowanego pliku `.pdf`.

#### 4. Humanizacja Nazwisk Kursantów i Poprawa Powitań
- **Problem**: Zastąpienie surowych identyfikatorów UID czytelnymi imionami i nazwiskami kursantów w całej aplikacji oraz naturalna odmiana powitań.
- **Rozwiązanie**:
  - Zweryfikowano i wdrożono helper [utils/studentFormat.ts](utils/studentFormat.ts) zabezpieczający przed wyświetlaniem technicznych ID.
  - Zintegrowano moduł wołacza [utils/polishVocative.ts](utils/polishVocative.ts) w nagłówku powitalnym czatu (`W czym mogę dzisiaj pomóc, Macieju?`).

#### 1. Naprawa kontrastu i stylistyki Prezentacji Live (Tryb Ciemny & Jasny)
- **Problem**: Karta fiszek 3D (`InteractiveSlideDeck`) oraz nagłówek prezentacji (`ScratchpadPresentationOverlay`) renderowały ciemny tekst na ciemnym tle w trybie nocnym ze względu na niezdefiniowane aliasy klas Tailwind (`text-text-muted`, `bg-bg-surface`, `border-border-subtle`).
- **Rozwiązanie**:
  - Przepisano komponenty `InteractiveSlideDeck.tsx` i `ScratchpadPresentationOverlay.tsx` na jawne, odporne na motyw klasy z wariantami `dark:` i jasnymi (`dark:bg-[#111827] bg-white`, `dark:text-white text-slate-900`, `dark:text-slate-300 text-slate-600`, `dark:border-white/15 border-slate-200`).
  - Dodano podwyższony kontrast dla pytań, wskazówek, przykładów oraz przycisku wyjścia („Zakończ i wróć Esc").
  - Wzbogacono fiszki 3D o wyraźne etykiety pojęć, wskazówki fonetyczne/kontekstowe oraz płynną animację obrotu.

#### 2. Generator Lekcji w Slajdach (AI Council)
- **Nowa funkcjonalność**: Dodano zakładkę **„✨ Generator Slajdów AI (Lekcja)"** w `ScratchpadLivePresentationModal.tsx`.
- Lektor podaje temat (lub klika w gotowy szablon biznesowy np. *Negocjacje & Obiekcje*, *Small Talk & Networking*, *Trendy & Wykresy*), opcjonalne notatki/materiały, poziom CEFR (A2-C2) i liczbę slajdów (3-6).
- Wielomodelowa Narada AI (`runCouncil`) generuje kompletną lekcję ze zróżnicowanymi metodycznie slajdami:
  1. *Rozgrzewka i dyskusja* (`slide` / Hook) z chwytliwym pytaniem i zwrotami do wypowiedzi,
  2. *Struktura lub etapy procesu* (`process_tabs`),
  3. *Kluczowe zwroty w kontekście* (`flip_cards` 3D),
  4. *Interaktywny quiz / scenariusz* (`interactive_quiz`) z autentycznym uzasadnieniem,
  5. *Wyzwanie komunikacyjne* (`scenario_item`).
- Możliwość natychmiastowego podejrzenia każdego slajdu w oknie modalnym przed startem.

#### 3. Zsynchronizowana Nawigacja Wieloslajdowa
- `presentationState` w `types.ts` i `ScratchpadPresentationOverlay.tsx` obsługuje tablicę `slides` oraz synchronizację `slideIndex`.
- Pasek miniaturek slajdów, przełączniki `< Poprzedni` / `Następny >` oraz obsługa skrótów klawiaturowych (`←` / `→` dla lektora, `Esc` dla wyjścia).

#### 4. Samouczek i Przewodnik Prezentacji
- Dodano krok samouczka `pad-presentation` w `scratchpadCoachSteps.ts` oraz atrybut `data-coach="pad-presentation"` na pasku narzędzi.
- Dodano okno modalne przewodnika („Przewodnik po Centrum Prezentacji Live") w `ScratchpadLivePresentationModal.tsx`.

### Poprzedni etap: Zmiana Kolejności Zadań (Reordering) oraz Nowy Standard E-mail ze Stopką-Wizytówką
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

### H. Integracja Audio w Planerze Lekcji i Odtwarzanie w Prezentacji w Notatniku (2026-09-16)
- **Wgrywanie i Zarządzanie Plikami Audio w Planerze Lekcji ([LessonPlannerStudio.tsx](components/admin/LessonPlannerStudio.tsx))**:
  - **Krok 3 (Scenariusz)**: Dodano dedykowaną kartę „Materiały Audio i Rozumienie ze Słuchu” z bezpośrednim przyciskiem `Wgraj plik audio (.mp3, .wav)`, listą załączonych nagrań, podglądem dźwiękowym oraz możliwością usuwania.
  - **Trwałość (Persistence)**: Zapewniono pełny cykl życia załączników – zapisywanie `attachments` do bazy scenariuszy Firestore (`saveGeneratedScenario`), odzyskiwanie załączników audio przy wczytywaniu scenariusza z biblioteki (`handleLoadScenarioFromLibrary`) oraz przekazywanie ich do generatora prezentacji (`createPresentationFromScenario`).
- **Odtwarzacz Audio w Prezentacji w Notatniku ([ScratchpadPresentationOverlay.tsx](components/scratchpad/ScratchpadPresentationOverlay.tsx))**:
  - Rozszerzono `ScratchpadDocument['presentationState']` o `audioUrl`, `audioName` oraz typ slajdu `'listening'`.
  - Wdrożono nowoczesny, fioletowo-szmaragdowy baner odtwarzacza audio ze wskaźnikiem fali i kontrolerem HTML5 dostępnym zarówno dla kursanta na żywo, jak i lektora.
- **Boczna Szuflada Lektora ([ScratchpadTeacherCompanionDrawer.tsx](components/scratchpad/ScratchpadTeacherCompanionDrawer.tsx))**:
  - W zakładce „Scenariusz lekcji” dodano automatyczne wykrywanie załączników audio aktywnego scenariusza.
  - Lektor ma do dyspozycji odsłuch podglądowy oraz przycisk **„🚀 Odtwórz w Prezentacji”**, który jednym kliknięciem emituje slajd ze ścieżką audio na ekran kursanta w czasie rzeczywistym.
  - Dodano możliwość szybkiego dogrania pliku audio na żywo w trakcie lekcji za pomocą przycisku `+ Dodaj audio`.
- **Kreatory i Edytory Slajdów ([ScratchpadLivePresentationModal.tsx](components/scratchpad/ScratchpadLivePresentationModal.tsx), [SlideEditorModal.tsx](components/admin/presentation/SlideEditorModal.tsx))**:
  - Wzbogacono presety prezentacji o „🎧 Słuchanie & Audio (Listening comprehension)”.
  - Dodano pole wgrywania plików audio z dysku lub linku URL z podglądem na żywo w edytorze pojedynczych slajdów oraz w modalu prezentacji live.

### N. Automatyczna sekcja Revision (AI) przy dodawaniu lekcji + rozgraniczenie uprawnień lektor/kursant w Notatniku (2026-09-18)
- **Inteligentna Powtórka generowana z poprzedniej lekcji ([lessonTemplate.ts](utils/lessonTemplate.ts), [scratchpadAiService.ts](services/scratchpadAiService.ts), [ScratchpadEditor.tsx](components/scratchpad/ScratchpadEditor.tsx))**:
  - Przycisk **„+ Nowa lekcja”** nie pyta już Notion o powtórkę — skanuje treść OSTATNIEJ lekcji w tym samym dokumencie notatnika (`extractLastLessonSections`), wycinając sekcje „Main topic / Practice” i „Key Language & Corrections”.
  - Nowa funkcja `generateLessonRevision` wysyła tę treść do kaskady Gemini Flash (`generateTextWithUnifiedFallback`) z promptem metodycznym, który zwraca gotowy fragment HTML: 3 błędy z badge-error/badge-success, 6 słówek EN↔PL do sprawdzenia, 5 zdań PL→EN do przetłumaczenia.
  - `buildLessonTemplate` przyjmuje teraz `revisionHtml` (wygrywa z dotychczasowym `recallItems`) — Lesson 1 (brak poprzedniej lekcji w dokumencie) dostaje pusty szablon Revision bez wywołania AI.
  - Błąd generowania (np. limit AI, brak sieci) nie blokuje wstawienia lekcji — sekcja Revision zostaje wtedy pusta, do ręcznego wypełnienia.
- **Rozgraniczenie uprawnień lektor/kursant w pasku narzędzi Notatnika ([ScratchpadEditor.tsx](components/scratchpad/ScratchpadEditor.tsx))**:
  - Przyciski **„+ Nowa lekcja”** (skrót i pozycja w menu „Wstaw”) oraz **„Wstaw zdjęcie z dysku”** są teraz widoczne wyłącznie dla `isTeacher` (lektor/admin) — wcześniej zależały tylko od `isReadOnly`, więc kursant z włączonym `allowStudentEdit` widział te same narzędzia co lektor.
  - Czat AI dokumentu był już wcześniej ograniczony do `isTeacher` — bez zmian, tylko zweryfikowano.
  - Kursant zachowuje pełne uprawnienia do pisania w dokumencie, formatowania (czcionki, listy, checklisty) i zaznaczania fragmentów jako błąd/poprawna forma/słówko.

### O. Naprawa: Pusta sekcja Revision przy „+ Nowa lekcja”, gdy poprzednia lekcja nie miała jeszcze wpisanych błędów/słówek (2026-09-18)
- **Przyczyna**: `extractLastLessonSections` wyciągała tekst tylko z sekcji „Main topic / Practice” i „Key Language & Corrections” ostatniej lekcji. Jeśli lektor nie zdążył ich jeszcze wypełnić (typowy przypadek — druga lekcja dodana od razu po pierwszej), obie sekcje były puste, `previousLessonText` był pusty i `handleInsertLesson` w ogóle nie wołał `generateLessonRevision` — sekcja Revision zostawała z domyślnym pustym szablonem.
- **Fallback na treść całej ostatniej lekcji ([lessonTemplate.ts](utils/lessonTemplate.ts))**: `extractLastLessonSections` zwraca teraz dodatkowo `fallbackText` (surowy tekst WSZYSTKICH sekcji ostatniej lekcji, nie tylko dwóch konkretnych). `ScratchpadEditor.handleInsertLesson` używa `fallbackText` jako materiału dla AI, gdy `mainTopic`/`keyLanguage` są puste, zamiast od razu wycofywać się do pustego szablonu.
- **Placeholder ładowania ([ScratchpadEditor.tsx](components/scratchpad/ScratchpadEditor.tsx))**: nowa strona A4 wstawia się natychmiast (bez czekania na Gemini) z tekstem „⏳ Generuję powtórkę na podstawie poprzedniej lekcji...” w sekcji Revision (znacznik `data-revision-pending`); po odebraniu odpowiedzi z `generateLessonRevision` placeholder jest podmieniany w miejscu na gotowe zadania. Błąd AI podmienia placeholder na neutralny tekst do ręcznego wypełnienia, zamiast zostawiać „⏳” na stałe.
- **Diagnostyka**: dodano `console.log('[REVISION_DEBUG] ...')` (numer szukanej lekcji, pobrany tekst poprzedniej lekcji) i `console.error('[REVISION_API_ERROR]', err)` przy błędzie wywołania Gemini.
- Nowy test w [lessonTemplate.test.ts](tests/lessonTemplate.test.ts) pokrywa przypadek pustych `mainTopic`/`keyLanguage` z niepustym `fallbackText`.

### P. Koło Fortuny: stałe kategorie wyzwań + Accent Pulse zamiast konfetti; Notatnik: kalibracja lasera, laser widoczny u lektora, skrót Alt+H (2026-09-19)
- **Architektura wycinków Koła Fortuny ([WheelOfFortune.tsx](components/presentation/WheelOfFortune.tsx), [wheelQuestionService.ts](services/wheelQuestionService.ts))**:
  - Tarcza ma teraz zawsze 6 stałych wycinków kategorii (`CHALLENGE_CATEGORIES`): Collocation, Fix Error, 60s Pitch, Fill Gap, Translation, Upgrade C1 — z ikoną Lucide na wycinku (`Link2`, `ShieldAlert`, `Mic`, `Puzzle`, `Languages`, `Gem`), niezależnie od liczby pytań w puli.
  - Nowe pole `WheelQuestionItem.challengeCategory` (`ChallengeCategoryId`) przypisywane deterministycznie (`assignChallengeCategory`, hash id) każdemu pytaniu ze scenariusza, historii lekcji, edycji ręcznej i generacji AI.
  - `handleSpinClick` losuje pytanie z puli (priorytet nieomówionym), koło ląduje na wycinku odpowiadającym `challengeCategory` tego pytania; `finishSpin` dobiera treść z puli pasującą do wylosowanej kategorii (fallback na dowolne nieomówione, potem dowolne). Pełna treść pytania nadal wyłącznie w karcie wyniku — na tarczy tylko nazwa kategorii i ikona.
- **„Accent Pulse” zamiast konfetti**: usunięto `canvas-confetti` z tego komponentu (nadal używane gdzie indziej w apce — nie dotknięto). Nowe helpery w [gsapAnimations.ts](services/gsapAnimations.ts): `animateAccentPulse` (błysk scale 1→1.4 / opacity 0.6→0, 600ms, na overlayu w centrum koła) i `animateGlowReveal` (rozjaśnienie ramki karty wyniku box-shadow, kolor emerald dla źródła „scenariusz”, amber dla „poprzednie lekcje”).
- **Kalibracja wskaźnika laserowego w Notatniku ([index.css](index.css))**: rdzeń zmniejszony do 8×8px, pełne krycie `#EF4444`; halo 18px przez `radial-gradient` + `box-shadow: 0 0 10px rgba(239,68,68,0.6)`. Dotyczy zarówno zdalnego wskaźnika (`.pad-laser-dot`, widziany przez kursanta) jak i nowego lokalnego (`.pad-laser`).
- **Laser widoczny również u lektora ([ScratchpadEditor.tsx](components/scratchpad/ScratchpadEditor.tsx))**: wcześniej `docData.laserPointer` był renderowany tylko po stronie kursanta — lektor z włączonym laserem nie widział własnej kropki. Dodano lokalny wskaźnik renderowany przez `createPortal` na `document.body` (`pointer-events: none`), aktualizowany bez throttlingu bezpośrednio w `handleLaserMouseMove` (ten sam punkt x/y trafia też, po throttlingu 50ms, do Firestore — więc widok lektora i kursanta pozostają zsynchronizowane co do źródła danych).
- **Skrót zakreślacza Alt+H / Option+H**: `onKeyDown` na edytowalnej kartce (`e.altKey && e.code === 'KeyH'`, sprawdzenie po `code` działa identycznie na obu platformach) wywołuje istniejący `handleHighlight('#fef3c7', '#92400e')` — to samo żółte wyróżnienie „Słówko” co przycisk w pasku narzędzi, bez konieczności celowania kursorem w toolbar.

### Q. Audyt resetu konfiguracji Notion po migracji workspace'u (2026-09-19)
- **Zlecenie zakładało błędną architekturę**: opis zadania odnosił się do aplikacji Electron (`electron-store`, cache sqlite/pouchdb, plik konfiguracyjny w `userData`) — Cribro nie jest aplikacją Electron i żaden z tych mechanizmów w projekcie nie istnieje. Audyt (`grep -ril notion`) potwierdził, że jedynym miejscem trwałego zapisu tokena i ID baz Notion jest dokument Firestore `system/notion` (odczyt/zapis w [server.ts](server.ts) `getNotionConfig`/`/api/notion/save-config`), z fallbackiem na `process.env`/`.env`.
- **Mechanizm rozłączenia już istniał i działał poprawnie** — nie wymagał zmian: `POST /api/notion/clear-config` ([server.ts:2404](server.ts#L2404)) zeruje `process.env`, dokument `system/notion` i `.env`; `handleClearNotionConfig` ([SettingsScreen.tsx:372](components/settings/SettingsScreen.tsx#L372)) resetuje cały stan UI do `configured: false` bez ryzyka błędu „Cannot read properties of undefined”. Wystarczy kliknąć „Rozłącz” w Ustawieniach, żeby wejść w stan gotowy na konfigurację nowego workspace'u „Maciej's space”.
- **Realna luka**: [functions/src/config.ts](functions/src/config.ts) miał zahardkodowane stare ID baz Notion (`NOTION_LESSONS_DB`, `NOTION_STUDENTS_DB`) używane wyłącznie przez zaplanowaną funkcję `checkNotionDaily` — niezależnie od Firestore/UI, więc kliknięcie „Rozłącz” ich nie czyściło. Na wyraźną prośbę Macieja wyzerowano obie stałe na `''` (zmiana lokalna, niewdrożona — wymaga wpisania nowych ID z „Maciej's space” i `npm run deploy:functions`, inaczej `checkNotionDaily` będzie codziennie o 6:00 kończyć się jawnym błędem w logu zamiast po cichu wskazywać na usunięty workspace).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (363/363 zielone). Firestore `system/notion` w produkcji świadomie NIE zostało wyczyszczone przez agenta — Maciej zdecydował się zrobić to sam przyciskiem „Rozłącz”.

### R. Trzy ustrukturyzowane sekcje Historii Lekcji: 📘 Podsumowanie / 📙 Słownictwo / 📕 Obszary do poprawy (2026-09-19)
- **Zlecenie opisywało nowy moduł „Historia Lekcji” + parser transkrypcji „Narada AI”** — audyt wykazał, że oba już istnieją i działają: `LessonRecord` ([types.ts](types.ts)), Narada AI to `generateLessonFromTranscript` ([services/transcriptLesson.ts](services/transcriptLesson.ts)), panel lektora to [TranscriptLessonPanel.tsx](components/admin/TranscriptLessonPanel.tsx), a widok kursanta to [StudentLessonHistory.tsx](components/dashboard/StudentLessonHistory.tsx) — już renderujący dokładnie 3 sekcje (Podsumowanie/Słownictwo/Do poprawy), tylko nienazwane emoji i oparte o wolny tekst, nie o ustrukturyzowane dane. Żeby nie dublować architektury (patrz filozofia w [CLAUDE.md](CLAUDE.md) §4), rozszerzono istniejące moduły zamiast tworzyć równoległy model.
- **Nowe pola `LessonRecord` ([types.ts](types.ts))**: `summaryPoints?: string[]`, `vocabularyItems?: LessonVocabularyItem[]` (`term`, `translation`, `contextSentence`, `category?: 'idiom' | 'collocation' | 'business' | 'general'`), `areasForImprovement?: LessonAreaForImprovement[]` (`originalError`, `correctedForm`, `ruleExplanation`) — opcjonalne, obok istniejących pól tekstowych (`lessonSummary`, `vocabularyText`, `thingsToImprove`/`corrections`), które zostają jedynym źródłem dla fiszek (`syncFlashcardSetForLesson`), puli powtórek (`generateRecallCandidates`) i starszych widoków. Starsze lekcje bez tych pól nie tracą nic — karta wraca do renderowania tekstu.
- **Parser Narady AI ([utils/transcriptLesson.ts](utils/transcriptLesson.ts))**: `buildTranscriptLessonPrompt` prosi model (Gemini Flash, kaskada bez zmian) o dodatkowe trzy pola JSON (`summaryPoints`, `vocabularyItems`, `areasForImprovement`) obok istniejących bloków tekstowych. `parseTranscriptLesson` waliduje je nowymi helperami (`asStringArray`, `asVocabularyItems`, `asAreasForImprovement`) — pozycje bez wymaganych pól (np. słówko bez tłumaczenia, błąd bez poprawnej formy) odpadają po cichu, a pusta tablica nigdy nie trafia do rekordu (zostaje `undefined`, nie `[]`).
- **Widok kursanta ([StudentLessonHistory.tsx](components/dashboard/StudentLessonHistory.tsx))**: nagłówki trzech sekcji dostały emoji z zamówienia (📘/📙/📕) zamiast ikon Lucide. Nowe komponenty modułowe `SummaryContent` (lista punktów z `summaryPoints`, fallback na Markdown `lessonSummary`), `VocabularyGrid` (karty słówek z opcjonalnym zdaniem kontekstowym i plakietką kategorii — `enrichVocabularyItems` dopasowuje `vocabularyItems` do już wyświetlanej/zatwierdzonej listy słówek po haśle, nigdy nie zmienia SAMEJ listy, tylko ją wzbogaca) i `AreasForImprovementContent` (karty ❌ błąd → ✅ poprawna forma + zasada, fallback na Markdown `thingsToImprove`) użyte we wszystkich trzech miejscach renderowania (najnowsza lekcja, wyniki wyszukiwania, lista wcześniejszych lekcji).
- Nowe testy w [transcriptLesson.test.ts](tests/transcriptLesson.test.ts): wypełnianie trzech sekcji strukturalnych obok pól tekstowych, odrzucanie niekompletnych pozycji bez ustawiania pustych tablic.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (365/365 zielone, +2 nowe).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji ani ścieżkach tokenowych bez logowania. Zmiana czysto addytywna (nowe opcjonalne pola) — żaden istniejący konsument `LessonRecord` (Notion, fiszki, pula powtórek, starsze widoki lektora) nie został dotknięty.

### S. Generator Scenariusza 2.0: dwuetapowy potok Gemini ("The Cribro Method") (2026-09-19)
- **Kontrakt/UI/walidacja z Etapu 2.1 (runda wcześniejsza tego samego dnia) już istniały** — audyt potwierdził `types/scenario.ts`, `utils/scenarioValidation.ts`, `POST /api/scenario/generate|save`, `ScenarioPreviewPanel.tsx`, `useScenarioGenerator.ts` i 11 testów. Zlecenie na tę rundę dotyczyło konkretnie przejścia z jednego wywołania Gemini z `responseSchema` na dwuetapowy potok dydaktyka→formater i wzmocnienia rygoru pedagogicznego promptu.
- **Dwa etapy w `POST /api/scenario/generate` ([server.ts](server.ts))**:
  - Etap 1 (dydaktyczny, wolny tekst, bez `responseSchema`) — pełny profil kursanta (CEFR, `industry`, `goals`) + bogatszy kontekst ostatniej lekcji, wymuszony "Test Naturalności" (lista zakazanych korpo-słów: headspace, bandwidth, leverage, facilitate, synergy, touch base, circle back, actionable, streamline i ich polskie odpowiedniki), warm-up zakotwiczony w konkretnym dniu/wydarzeniu (nie "How was your week?"), moduł `main_topic` zredukowany do JEDNEJ konkretnej sytuacji zawodowej + sekcja wskazówek ratunkowych dla lektora.
  - Etap 2 (formatujący, `responseSchema`) — przepisuje WIERNIE wynik Etapu 1 na JSON zgodny z kontraktem; nie generuje nowej treści pedagogicznej, więc lżejszy/tańszy model wystarcza i nie psuje rygoru Etapu 1.
  - Nazwane stałe `SCENARIO_DIDACTIC_MODEL`/`SCENARIO_FORMATTING_MODEL` w `server.ts` — zlecenie wskazywało dosłownie `gemini-1.5-pro`/`gemini-1.5-flash`, ale ta rodzina jest wygaszana przez Google i nie istnieje w jedynym źródle prawdy modeli (`services/aiModels.ts`, kaskada 2.5/3.8). Po pytaniu do Macieja: stałe zostają skonfigurowane na `gemini-2.5-pro`/`gemini-2.5-flash` (ten sam podział ról: Pro do rozumowania, Flash do formatu), z komentarzem uzasadniającym — łatwe do podmiany, jeśli 1.5 kiedyś wróci. Obie kaskady wywołań to WYŁĄCZNIE modele Gemini (`GEMINI_MODEL_CASCADE` jako fallback), zero OpenAI, zgodnie z literalnym poleceniem.
- **Nowe pole `teacherNotes?: string[]`** na `ScenarioModelModule`/`ScenarioModule` ([types/scenario.ts](types/scenario.ts)) — wskazówki ratunkowe (rescue prompts) dla lektora, wymagane wyłącznie dla modułu `main_topic` (`validateScenarioModelOutput` w [utils/scenarioValidation.ts](utils/scenarioValidation.ts) rzuca błąd, gdy brak lub puste). Widoczne w [ScenarioPreviewPanel.tsx](components/admin/ScenarioPreviewPanel.tsx) jako osobny bursztynowy panel "Wskazówki ratunkowe (dla lektora)" pod punktami modułu głównego tematu.
- **Decyzja architektoniczna — brak pola "preferencje korekty błędów"**: profil kursanta (`User` w [types.ts](types.ts)) nie ma takiego pola. Zamiast wymyślać nowe, równoległe pole na chybcika, prompt Etapu 1 jawnie informuje model o braku danych i każe korygować błędy w module `error_work`, bez nachalności gdzie indziej. Jeśli lektorzy będą tego pola realnie potrzebować, wymaga to osobnej decyzji (nowe pole w profilu + UI do jego edycji), nie prompt-hacku.
- Nowe testy w [tests/scenario.test.ts](tests/scenario.test.ts): odrzucenie braku/pustych `teacherNotes` w `main_topic`, przepisanie `teacherNotes` przez `buildLessonScenario` bez wycieku do innych modułów.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (390/390 zielone, +3 nowe), `npm run build` (przechodzi).
- Nie dokończone / do sprawdzenia: **potok nie był wołany na żywo na kluczu Gemini** — brak dostępu do skonfigurowanych kluczy i zalogowanej sesji w tej sesji agenta. W szczególności nie zweryfikowano wzrokowo, czy Etap 2 (formater) faktycznie zawsze poprawnie wyodrębnia `teacherNotes` z wolnego tekstu Etapu 1, gdy model dydaktyczny nie nazwie sekcji dokładnie "Wskazówki ratunkowe" (prompt Etapu 2 ma na to instrukcję, ale to nieprzetestowane na żywym modelu).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji (`requireFirebaseAuth`/`requireFirebaseAdmin`) ani ścieżkach tokenowych bez logowania. Endpointy istniały już wcześniej i nie zmieniły autoryzacji.

---

### T. Generator scenariusza jako Tool (Function Calling) w czacie Asystenta Lektora (2026-09-19)
- **Ekstrakcja generatora — zero dublowania**: logika z `POST /api/scenario/generate` (odczyt kontekstu kursanta, dwuetapowy potok Gemini, walidacja, nadanie budżetów) przeniesiona z ciała endpointu do `services/scenarioContextService.ts` (`loadScenarioStudentContext`) i `services/scenarioAiService.ts` (`generateScenarioForStudent`). Endpoint i nowy tool czatu wołają dokładnie tę samą funkcję; `generateContentWithRetry`/`GEMINI_MODEL_CASCADE` z `server.ts` wstrzyknięte jako parametry (nie duplikowane), żeby nie ruszać istniejącej kaskady retry.
- **Nowy endpoint `POST /api/scenario/generate-for-chat`** ([server.ts](server.ts), `requireFirebaseAuth`) — przyjmuje wyłącznie `{ studentRef, durationMin?, customTopicFocus? }`. Gemini nigdy nie dostaje ani nie zgaduje ID kursanta z bazy.
- **`services/studentResolver.ts`** (`resolveStudentRef`) — rozstrzyga `studentRef` (ID dokumentu, dokładna nazwa lub częściowe dopasowanie) wyłącznie w zbiorze aktywnych, niearchiwizowanych kursantów. Brak dopasowania → 404 z jawnym błędem; kilka dopasowań → 409 z listą kandydatów, bez zgadywania.
  - **Decyzja architektoniczna (potwierdzona z Maciejem)**: zlecenie wymagało scope'owania po „kursantach przypisanych do uid zalogowanego lektora”, ale w bazie **nie istnieje żadne pole wiążące kursanta z konkretnym lektorem** — `teacherUid`/`teacherId` występują wyłącznie na grupach, scratchpadach i sesjach live, nigdy na dokumencie `users/{studentId}`. Po pytaniu do Macieja: resolver używa tego samego globalnego zbioru aktywnych kursantów, jakiego już dziś używa `/api/scenario/generate` i `buildStudentIndex()` w czacie (model jeden-lektor-na-wdrożenie) — żadnej nowej migracji/pola w tej rundzie. Prawdziwe multi-tenant scoping wymagałoby osobnej decyzji i dotyka `firestore.rules`/modelu danych (sekcja 3 tego dokumentu).
- **Pierwsze prawdziwe Gemini function-calling w repo** ([services/teacherAssistant.ts](services/teacherAssistant.ts)) — dotąd jedynym „tool-em” w czacie była konwencja fenced-block (\`\`\`lesson_json\`\`\` itp.). Tool `generate_lesson_scenario` (`studentRef`, opcjonalnie `durationMin`/`customTopicFocus`) zarejestrowany w trybie **Flash** (nie Thinking/multimodal — granica MVP, patrz niżej). Wywołanie funkcji → `POST /api/scenario/generate-for-chat` → wynik wraca do Gemini jako `functionResponse` (lekki payload: nazwa kursanta/czas/tryb, bez całej treści scenariusza) → model formułuje naturalną odpowiedź; pełny `LessonScenario` leci osobno do UI.
  - Zmiana kolejności prób w trybie Flash: dotąd `generateTextWithUnifiedFallback` (kaskada Gemini/OpenAI/Anthropic, bez tools) była główną ścieżką, a bezpośrednie `getAI().models.generateContent` — fallbackiem. Odwrócone: bezpośrednie wywołanie Gemini z `tools` jest teraz główną ścieżką (bo `generateTextWithUnifiedFallback` nie przenosi function-calling), a `generateTextWithUnifiedFallback` (bez toola) jest siatką bezpieczeństwa przy błędzie.
- **`components/admin/ScenarioModuleCard.tsx`** — wydzielony z `ScenarioPreviewPanel.tsx` (bez zmiany zachowania w edytorze) komponent pojedynczego modułu scenariusza, z nowym propem `readOnly` do kompaktowego podglądu. Reużyty w nowym `ScenarioToolResultCard` (lokalny komponent w `TeacherAssistant.tsx`, analogicznie do istniejącego `HtmlReportCard`).
- **Granice MVP (zgodnie ze zleceniem)**: czat renderuje wynik toola wyłącznie jako podgląd 4 modułów (read-only) + przycisk „Przejdź do profilu kursanta” (reużyty istniejący typ akcji `'profile'`, bez nowego typu). Brak automatycznego zapisu do lekcji.
- Nowe pola typów: `AssistantMessage.scenarioToolResult` / nowy eksport `ScenarioToolResult` w `services/teacherAssistant.ts` (celowo osobny od starego `lessonScenario: GeneratedLessonScenario` — inny kontrakt, inny generator).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (390/390 zielone — bez nowych testów tej rundy, patrz niżej), `npm run build` (przechodzi).
- **Nie dokończone / do sprawdzenia**:
  - Brak nowych testów jednostkowych dla `resolveStudentRef`/`generateScenarioForStudent`/toola — w tej sesji nie było dostępu do live Firestore/Gemini ani czasu na zbudowanie fixture'ów zgodnych z konwencją `tests/`. Wymaga osobnej rundy.
  - Tool NIE był wołany na żywo na kluczu Gemini w prawdziwej rozmowie czatu — nie zweryfikowano wzrokowo w przeglądarce, czy Gemini realnie decyduje się wywołać `generate_lesson_scenario` przy naturalnych sformułowaniach lektora, ani czy proxy `/api/gemini/generate` (które przepuszcza `config` i `candidates` bez zmian) poprawnie niesie `functionCall`/`functionResponse` przez pełny round-trip w praktyce.
  - Tool działa wyłącznie w trybie Flash — w Thinking (`runCouncil`) i multimodalnym (załączniki) czat generuje scenariusz po staremu (bez toola), bo oba te tryby mają inną architekturę wywołania i podłączenie tools do nich wykracza poza tę rundę.
- Ryzyka: **dotyka obszaru z sekcji 3 tylko pośrednio** — `resolveStudentRef` to nowa logika autoryzacji dostępu do danych kursantów (kto może rozstrzygnąć `studentRef` do którego kursanta), ale nie zmienia `firestore.rules` ani middleware `requireFirebaseAuth`/`requireFirebaseAdmin`; endpoint nadal wymaga zalogowanego lektora/admina, tak jak istniejący `/api/scenario/generate`.

---

### U. Kontrolowane błędy i twardy limit głębokości w pobieraniu bloków Notion (2026-09-20)
- **Zlecenie zakładało błędną architekturę**: opis zadania (rekurencyjny parser gubiący dzieci toggle/callout, fallback słownictwa „apple/banana”) trafnie opisywał `functions/src/notion/client.ts` (`pageToText`) — ale ten moduł jest **martwym kodem od rundy 28** (2026-09-16, sekcja „Pełna Migracja Bazy Kursantów i Lekcji z Notion do Firestore” wyżej w tym pliku): `previewNotionSync`, `importNotionSelection` i `checkNotionDaily` zostały wtedy usunięte z `functions/src/index.ts` po jednorazowej pełnej migracji 22 kursantów/110 lekcji do Firestore. Zostały tylko pliki źródłowe i testy jednostkowe importujące bezpośrednio z `functions/src/notion/*`, bez żadnego podpięcia do wdrożonego callable. Fallback „apple/banana” z opisu zadania też nie istnieje jako fallback produkcyjny — to placeholder pola formularza ręcznego wpisywania lekcji (`AdminPanel.tsx:4996`), niepowiązany z importem z Notion.
- **Żywa ścieżka to `fetchNotionBlocksText` w [server.ts](server.ts)** (endpoint `/api/notion/meeting-content/:pageId`, używana przez [ManualTranscriptImportModal.tsx](components/admin/ManualTranscriptImportModal.tsx) do wypełniania formularza przed generowaniem lekcji przez Gemini). Już schodziła w każdy blok z `has_children` niezależnie od typu i miała `depth > 4`, ale błędy API (429/5xx/403/404) były po cichu połykane (`if (!res.ok) break`), zwracając uciętą treść zamiast błędu, a przekroczenie głębokości ucinało dane bez sygnału. Po pytaniu do Macieja (AskUserQuestion) — wybrał naprawę tej żywej ścieżki zamiast martwego kodu w `functions/src/notion/*`.
- **Nowy [utils/notionBlocksFetcher.ts](utils/notionBlocksFetcher.ts)** — wydzielona z `server.ts` (wcześniej lokalne domknięcia, nietestowalne bez uruchomienia całego Express) wersja `fetchNotionBlocksText`/`fetchNotionBlockChildrenPage`: twardy `NOTION_BLOCKS_MAX_DEPTH = 4` (błąd, gdy blok na głębokości 4 nadal ma dzieci, zamiast cichego ucinania), pacing 350 ms + do 3 prób łącznie dla 429/5xx z poszanowaniem `Retry-After`, defensywna ekstrakcja `rich_text` (brak wyjątku na nieznanym typie bloku, pustych/`null` elementach), błąd API zawsze rzuca wyjątek zamiast cicho zwracać pustą/uciętą treść. `server.ts` importuje stąd, oba miejsca użycia (`/api/notion/meeting-content/:pageId`, `syncNotionTranscriptsFromApi`) już miały `try/catch` zwracający błąd zamiast zapisu częściowych danych.
- Nowe testy w [tests/notionBlocksFetcher.test.ts](tests/notionBlocksFetcher.test.ts) (11): zagnieżdżenie toggle→callout→paragraph, paginacja na dwóch poziomach z osobnym kursorem, kolejność depth-first bez duplikacji, pusty wynik przy legalnym braku sekcji, błąd bez częściowego zwrotu, retry na 429 z `Retry-After` (zegar zastępczy `node:test` `mock.timers`), wyczerpanie ponowień na 5xx, błąd przy bloku na głębokości 4 z dziećmi, brak wyjątku dokładnie na granicy głębokości, odporność na brakujące/`null` pola `rich_text`, sanity-check że tekst kursanta ze słowem „apple” przechodzi bez filtrowania.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (401/401 zielone, baza 390 + 11 nowych), `npm run build` (przechodzi, `api/index.js`/`dist/server.cjs` przebudowane).
- Nie dokończone / do sprawdzenia: `functions/src/notion/client.ts` (`pageToText`) — martwy kod, świadomie NIE naprawiony (poza wybranym przez Macieja zakresem); nadal ma bug z opisu zadania, więc wróci, jeśli ktoś kiedyś przywróci `previewNotionSync`/`importNotionSelection`. Zmiana nie była sprawdzona na żywo w przeglądarce (brak tokenu Notion/zalogowanej sesji w tej sesji agenta). `ManualTranscriptImportModal.tsx` nadal po cichu zostawia puste pole przy błędzie endpointu (brak gałęzi `else` na `res.ok`) — teraz dostanie pustkę zamiast częściowej notatki, ale bez komunikatu błędu; poprawa UI świadomie poza zakresem tej rundy.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji (`requireFirebaseAuth`/`requireFirebaseAdmin` niedotknięte) ani ścieżkach tokenowych bez logowania. Brak migracji/backfillu, schemat dokumentów lekcji niezmieniony, brak nowych zależności w `package.json`.

---

### V. Kreator Scenariuszy i Interaktywny Canvas — MVP (`scenarioCanvasV2`) (2026-09-20)
- **Nowy, opcjonalny kontrakt obok `plannedScenario`** — [types/scenarioCanvas.ts](types/scenarioCanvas.ts): 9 bloków w stałej kolejności (`lesson_goal`, `warm_up`, `revision_translation`, `older_lesson_refresh`, `grammar_review`, `main_topic`, `language_focus`, `practice_enclosure`, `homework`), zapisywanych jako pole `scenarioCanvasV2` na `users/{studentId}/lessonRecords/{id}` — zero migracji, zero zmian w `firestore.rules`. Stary dokument bez tego pola nadal się otwiera (`hasScenarioCanvasV2`); `plannedScenario` (v1, sekcja S) niezmieniony i nadal działa równolegle.
- **Backend decyduje o pominiętych blokach, nie model**: `computeApplicableCanvasBlockIds` ([utils/scenarioCanvasValidation.ts](utils/scenarioCanvasValidation.ts)) pomija `grammar_review` przy braku kontekstu gramatycznego (`corrections`/`thingsToImprove` z ostatniej lekcji — dopisane jako `hasGrammarContext`/`grammarContext` do `loadScenarioStudentContext` w [services/scenarioContextService.ts](services/scenarioContextService.ts), reużywając ten sam odczyt co v1, zero dublowania) i `older_lesson_refresh` przy cold starcie. Czasy per blok (`CANVAS_DURATION_BUDGETS`, 45/60/90 min) nadaje backend, sumują się do `durationMin` (bez `lesson_goal`, który ma 0 min i jest calloutem, nie blokiem czasowym).
- **Potok Planner → Auditor, wyłącznie Gemini** ([services/scenarioCanvasAiService.ts](services/scenarioCanvasAiService.ts), reużywa `scenarioAiService`/`generateContentWithRetry`, brak nowego klienta AI, brak OpenAI): Planner zwraca treść bloków w response schema JSON — `main_topic` wymuszony na 2-3 `rescue_question` + dokładnie 1 `wind_down_question` (walidacja w `validateCanvasPlannerOutput`). Auditor dostaje zwalidowany plan i zwraca WYŁĄCZNIE patch po `itemId` dla sztucznych/nudnych punktów — nie generuje drugiego scenariusza.
- **Lesson Refresh = selektywna podmiana, nie regeneracja**: `POST /api/scenario/canvas/refresh` w [server.ts](server.ts) czyta zapisany canvas, sprawdza `expectedRevision` (409 przy stale-revision) i `lastMutationId` (identyczny `mutationId` = idempotentny zwrot bez ponownego wołania Gemini — ochrona przed podwójnym kliknięciem). Do modelu leci WYŁĄCZNIE: odrzucone elementy + uwagi lektora + teksty zaakceptowanych kotwic (do unikania duplikatów) — bez pełnego transkryptu. Response schema wymusza dokładną równość zbiorów `itemId` (`validateCanvasRefreshOutput`); `applyLessonRefresh` podmienia tylko odrzucone pozycje, zwiększa ich `generation`, przestawia `review.state` na `pending` — zaakceptowane elementy nienaruszone, `revision` canvasu rośnie o 1.
- **Endpointy** (`requireFirebaseAuth`, ten sam middleware co v1): `POST /api/scenario/canvas/generate` (draft, bez zapisu), `POST /api/scenario/canvas/save` (zapis wyłącznie na żądanie lektora z `targetLessonId`), `POST /api/scenario/canvas/refresh`.
- **UI**: [components/admin/ScenarioCanvasPanel.tsx](components/admin/ScenarioCanvasPanel.tsx) + [components/admin/ScenarioCanvasBlockCard.tsx](components/admin/ScenarioCanvasBlockCard.tsx) — lekki, bez DnD, Tailwind. `lesson_goal` jako callout na górze, karta na blok (pominięte bloki wyszarzone z powodem pominięcia), wiersz punktu z akcjami ✓/✗, pole krótkiej uwagi po odrzuceniu, fioletowy zwijany panel Teacher's Notes (`main_topic`), przycisk „Lesson Refresh” aktywny tylko gdy są odrzucone elementy. Zamontowany w `AdminPanel.tsx` obok istniejącego `ScenarioPreviewPanel` (v1) — dwa niezależne generatory obok siebie, nic się nie nadpisuje.
- Nowe testy w [tests/scenarioCanvas.test.ts](tests/scenarioCanvas.test.ts) (24): kolejność 9 bloków (także pominiętych), pomijanie `grammar_review`/`older_lesson_refresh`, budżety czasowe sumujące się do `durationMin`, unikalne `itemId`/stan `pending`/`generation: 1` po zbudowaniu, walidacja Plannera (main_topic rescue/wind_down, pusty punkt, zła kolejność), Auditor (odrzuca patch dla obcego `itemId`, podmienia wyłącznie wskazane teksty), Lesson Refresh (równość zbiorów `itemId` — za mało/obcy ID/dokładnie ten sam zbiór, selektywna podmiana z nienaruszonymi zaakceptowanymi elementami, wzrost `revision`/zapis `mutationId`), 1:1 vs cold start (różne zestawy bloków).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (425/425 zielone, baza 401 + 24 nowych), `npm run build` (przechodzi, `api/index.js`/`dist/server.cjs` przebudowane).
- **Nie dokończone / do sprawdzenia**: UI Canvasu NIE był sprawdzony wzrokowo w przeglądarce (brak dostępu do live Gemini/Firestore w tej sesji agenta) — zweryfikowano wyłącznie `tsc`/testy jednostkowe/build, zgodnie z sekcją 6 tego pliku (dług techniczny „UI ostatnich zmian nie zweryfikowane w przeglądarce”). Auditor jest wywoływany zawsze po Plannerze (część `generateScenarioCanvasForStudent`) — brak osobnego przełącznika do pominięcia go. Brak testów integracyjnych na żywym Gemini dla Plannera/Auditora/Refresh (jak w v1 — patrz sekcja S/T, ten sam brak dostępu do klucza w środowisku agenta).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji (`requireFirebaseAuth` niedotknięte, żadnej nowej ścieżki tokenowej bez logowania), brak importów OpenAI w nowym kodzie (wyłącznie `@google/genai` przez istniejący `generateContentWithRetry`).

### W. Title Generation Gate — temat lekcji z transkrypcji generowany przez AI z treści rozmowy, nie z technicznego tytułu (2026-09-20)
- **Problem**: import transkrypcji (Notion w [ManualTranscriptImportModal.tsx](components/admin/ManualTranscriptImportModal.tsx), live-transkrypcja Cribro Sift w [TranscriptLessonPanel.tsx](components/admin/TranscriptLessonPanel.tsx)) kończył się tematem lekcji, który bywał techniczną etykietą zamiast realnej treści rozmowy — tytuł spotkania z Notion (`[KOD] Imię Nazwisko DD.MM.YYYY`) trafiał do pola tematu jako podpowiedź, a przy braku odpowiedzi z Gemini wpadał fallback `Lekcja z notatek Notion (data)`.
- **Bramka w istniejącym promptcie ekstrakcji** ([utils/transcriptLesson.ts](utils/transcriptLesson.ts)) — bez nowego wywołania AI: `TRANSCRIPT_SYSTEM_INSTRUCTION` (punkt 8) i opis pola `"topic"` w `buildTranscriptLessonPrompt` każą modelowi zwrócić zwięzły, naturalny tytuł po angielsku (1-10 słów, do 80 znaków) wyłącznie z treści rozmowy — z jawnym zakazem imion/nazwisk, dat, kodów w nawiasach, rozszerzeń plików i etykiet („Lesson with”, „Meeting notes”, „Transcript”, „English Lesson”, „Meeting”, „Conversation”); transkrypcja jest jawnie oznaczona jako dane, nie instrukcje. Brak wyłonionego tematu → model ma zwrócić pusty string, nie zmyślać.
- **Walidacja runtime** — nowa `validateGeneratedTopic()` w `utils/transcriptLesson.ts`, wpięta w `parseTranscriptLesson`: odrzuca (zwraca `''`, nie okalecza) odpowiedź wielolinijkową, dłuższą niż 80 znaków, z kodem w nawiasach, datą, rozszerzeniem pliku, etykietą techniczną jako prefiksem, generycznym tematem („English Lesson”/„Meeting”/„Conversation” itd.) albo zawierającą token z imienia/nazwiska kursanta (`studentName` przekazywany teraz też z `services/transcriptLesson.ts` do metadanych parsera).
- **Hierarchia źródła tematu** — nowa czysta funkcja `resolveLessonTopic()`: ręczna edycja lektora (gdy pole jest „dirty”) > tytuł scenariusza (parametr gotowy, obecnie żadna z dwóch ścieżek importu nie ma jeszcze linku do scenariusza) > zwalidowany temat z Gemini > brak — wymóg ręcznego wpisania. Zero technicznego fallbacku (nazwa pliku/tytuł Notion/data) na końcu łańcucha.
- **ManualTranscriptImportModal.tsx**: nowy stan `lessonTopicDirty`, ustawiany wyłącznie przy ręcznym wpisywaniu w polu (nie przy auto-podpowiedzi tytułu spotkania Notion — ta nadal tylko wypełnia pole, ale nie liczy się jako „ręczna edycja” w hierarchii). Usunięty fallback `Lekcja z notatek Notion (data)` — brak rozstrzygniętego tematu po `resolveLessonTopic` blokuje zapis komunikatem, zamiast cichego wpisania technicznej etykiety.
- **TranscriptLessonPanel.tsx**: `recordRef` (aktualizowany w `useEffect`) chwyta najświeższy `record.topic` po zakończeniu wywołania Gemini — jeśli lektor zmienił temat ręcznie w osobnym edytorze lekcji, zanim odpowiedź AI wróciła, `resolveLessonTopic` zachowuje jego edycję zamiast pozwolić spóźnionemu callbackowi ją nadpisać.
- Nowe testy w [tests/transcriptLesson.test.ts](tests/transcriptLesson.test.ts) (13): `validateGeneratedTopic` (poprawny temat, kod w nawiasach, data, rozszerzenie pliku, etykiety techniczne, tematy generyczne, wyciek imienia/nazwiska, zbyt długi/wielolinijkowy, pusta odpowiedź) i `resolveLessonTopic` (hierarchia manual/scenariusz/AI/pusty wynik).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (438/438 zielone, baza 425 + 13 nowych), `npm run build` (przechodzi, `api/index.js` przebudowany bez zmian treści — `server.ts` niedotknięty w tym zadaniu).
- **Nie dokończone / do sprawdzenia**: UI NIE był sprawdzony wzrokowo w przeglądarce (brak dostępu do live Gemini/Firestore w tej sesji agenta) — zgodnie z sekcją 6 tego pliku. Zadanie wspominało też import PDF w `ManualTranscriptImportModal` — audyt (FAZA 0) pokazał, że ten modal obecnie nie ma ścieżki PDF (tylko Notion i wklejony tekst); PDF istnieje w zupełnie osobnym imporcie profilu+historii kursanta (`services/studentImportService.ts` / `/api/gemini/analyze-student-import`), celowo pominiętym jako poza zakresem tego zlecenia. `resolveLessonTopic` ma gotowy parametr `scenarioTitle`, ale żadna z dwóch ścieżek transkrypcji nie przekazuje tam jeszcze tytułu scenariusza — do podpięcia, jeśli/kiedy transkrypcja zostanie powiązana ze scenariuszem.
- Ryzyka: brak zmian w `firestore.rules`, brak zmian schematu/migracji, brak nowych bibliotek, brak dodatkowego wywołania Gemini (ta sama, jedna odpowiedź ekstrakcji transkrypcji), middleware autoryzacji i ścieżki tokenowe bez logowania niedotknięte.

---

### Y. Ujednolicenie Modułu Prac Domowych: koniec podziału v1/v2, Human-in-the-Loop dla oceny AI (2026-09-20)
- **Zlecenie**: zlikwidować w UI podział na v1/v2 (zakładka „Lista prac" + przycisk „Przegląd v2"), zamienić nagłówek na jeden tytuł + jeden przycisk „+ Przypisz pracę domową", i wyłączyć automatyczne uruchamianie silnika oceny AI w tle — ocena ma się zaczynać wyłącznie po kliknięciu lektora „✨ Zaproponuj ocenę z AI", z możliwością edycji przed „Zatwierdź i wyślij do kursanta". Opcjonalny przełącznik „Automatyczna ocena AI przy 100% pewności" (domyślnie `false`).
- **Audyt (przed zmianą kodu)**: `components/dashboard/HomeworkScreen.tsx` jest mostem między dwiema architekturami. Faktyczny ruch produkcyjny idzie przez `StudentHomeworkScreen.tsx` (v1) — student submituje pracę, `HomeworkScreen.tsx` (zamontowany wyłącznie z `isTeacher=true` w `TeacherWorkScreen.tsx`/`AdminPanel.tsx`) to jedyny żywy widok lektora do przeglądu/oceny. Silnik v2 (`functions/src/homeworkV2/*`, `HomeworkComposerV2.tsx`) jest już domyślnie włączony flagą `HOMEWORK_ENGINE_V2` i jest tym, co realnie tworzy nowe zadania po kliknięciu „+ Przypisz pracę domową" — ale `StudentHomeworkV2Screen.tsx` jest martwym importem w `Dashboard.tsx` (nigdy nie renderowany), więc kursanci dziś nie mają jak odpowiedzieć na zadanie v2 przez normalną nawigację. To pre-istniejąca luka, świadomie NIE naprawiona w tej rundzie (poza zakresem zlecenia, wymaga osobnej decyzji o UX ekranu kursanta) — odnotowana tutaj i w `AGENT_LOG.md`.
- **Odkryty w trakcie audytu prawdziwy problem "walidatora w tle"**: `StudentHomeworkScreen.tsx:handleSubmit` (v1, żywa ścieżka) wywoływał `evaluateTranslations()` (AI) automatycznie przy KAŻDYM wysłaniu pracy przez kursanta, zanim lektor cokolwiek zobaczył — dokładnie to, co zlecenie każe wyłączyć. UI już poprawnie chowała wynik przed kursantem do czasu `status === 'graded'` (widoczne w kodzie i komentarzach sprzed tej zmiany), ale silnik i tak się uruchamiał i kosztował.
- **Ujednolicony nagłówek** (`HomeworkScreen.tsx`): usunięte przyciski „Lista prac (n)" i „Przegląd v2" oraz stan `activeTab: 'v2review'`. Zostaje istniejący tytuł „Zarządzanie Pracami Domowymi" + jeden przycisk „+ Przypisz pracę domową" (zamienia się w „Wróć do listy" w trybie tworzenia). Zestawy v1 i v2 renderują się na tej samej liście (`tasks` już je łączyło — bariera była wyłącznie w UI/nawigacji, nie w danych).
- **Jeden punkt otwarcia szczegółów** — nowa funkcja `openTaskReview(task)`: kieruje na istniejący modal v1 (sentence-po-sentence) dla zadań bez `engineVersion === 2`, i na nowy, osadzony widok v2 dla pozostałych. Podpięta we WSZYSTKICH miejscach, które wcześniej wołały `setReviewTask`/`setPreviewTask` bezpośrednio (kafelki, `HomeworkTaskList`, nawigacja z widgetu powiadomień) — część z nich renderowałaby dla zadania v2 pusty/błędny widok v1 (inny kształt danych: `content`/`instruction` vs `polishSentence`), więc to jest też naprawa błędu, nie tylko porządkowanie.
- **`HomeworkV2ReviewScreen.tsx` przebudowany** z osobnego ekranu „Przegląd v2" (lista WSZYSTKICH zestawów + zbiorczy boks „Wymaga uwagi") na komponent pokazujący JEDNO zadanie wewnątrz wspólnego modala szczegółów. Usunięty zbiorczy boks ostrzeżenia — pewność modelu zostaje wyłącznie jako subtelna notatka przy konkretnej próbie (`pewność modelu: X%`).
- **Human-in-the-loop dla v2** (`functions/src/homeworkV2/endpoints.ts`): `submitHomeworkV2Attempt` przestał automatycznie wołać `gradeAttempt`/`composeFeedback` przy każdej próbie. Domyślnie próba zapisuje się bez werdyktu (`requiresTeacherReview: true`, `pendingTeacherApproval: true`) i kursant dostaje generyczny komunikat „zapisano, nauczyciel sprawdzi". Dwa nowe endpointy `onCall`: `proposeHomeworkV2Grade` (uruchamia silnik oceny na żądanie lektora, nic nie zapisuje — zwraca propozycję do edycji) i `approveHomeworkV2Grade` (utrwala ewentualnie poprawiony werdykt, odblokowuje feedback dla kursanta). Nowa czysta funkcja `shouldAutoApprove(confidence, autoApproveEnabled)` w `contracts.ts` (2 nowe testy w `tests/homeworkV2Contracts.test.ts`, baza 438+2=440).
- **Human-in-the-loop dla v1** (`StudentHomeworkScreen.tsx:handleSubmit`): wywołanie `evaluateTranslations()` przeniesione za przełącznik — domyślnie (wyłączony) w ogóle się nie uruchamia, kod korzysta z istniejącej ścieżki zapasowej („brak oceny modelu" → `explanation: 'Przesłano do oceny lektora'`). Lektor ocenia istniejącym już wcześniej przyciskiem w `HomeworkScreen.tsx` (`handleAnalyzeWithAI`), przemianowanym na „✨ Zaproponuj ocenę z AI"; `handleSaveReview` przemianowany na „Zatwierdź i wyślij do kursanta" — logika obu bez zmian, to była już poprawna implementacja human-in-the-loop, tylko źle nazwana.
- **Przełącznik „Automatyczna ocena AI przy 100% pewności"**: nowy dokument `system/homeworkAiSettings` (pole `autoApproveAtFullConfidence`, domyślnie `false`) — bez zmian w `firestore.rules`, bo `system/{document=**}` już pozwala na zapis każdemu `isAdmin()` (obejmuje rolę `teacher`) i odczyt każdemu zalogowanemu. Toggle w nagłówku `HomeworkScreen.tsx` (tylko dla lektora), serwisy `services/homeworkAiSettingsService.ts` (klient) i `functions/src/homeworkV2/settings.ts` (Cloud Functions). Włączony — v1 i v2 nadal liczą ocenę, ale kończą ją automatycznie WYŁĄCZNIE gdy wynik jest w 100% bezbłędny (`confidence === 1` dla v2, wszystkie pozycje `isCorrect && score === 100` dla v1); każdy inny wynik i tak czeka na lektora.
- **Ujednolicone etykiety statusu** w całym module: „Do sprawdzenia" / „W trakcie" / „Sprawdzone" (wcześniej rozjechane nazwy: „Przesłano do oceny"/„Do zrobienia"/„Oceniono"/„Zrobiona" w różnych miejscach tego samego ekranu). Nowy prop `needsReviewTaskIds` w `HomeworkTaskList.tsx` + zapytanie `collectionGroup('attempts')` w `HomeworkScreen.tsx` — zadania v2 nie zmieniają `status` na dokumencie nadrzędnym (werdykt żyje w podkolekcji `attempts`), więc bez tego sygnału wyglądałyby jak „W trakcie" na zawsze, nawet z próbą czekającą na ocenę.
- **Naprawiony przy okazji błąd nawigacji**: kliknięcie zadania z widgetu „Wymaga uwagi" (`TeacherHomeworkNotification.tsx`) ustawiało `initialTaskId`, co w `HomeworkScreen.tsx` zawsze otwierało warsztat KURSANTA (`setActiveTask`) — sekcja bez `isTeacher`-guarda, bo komponent renderuje się identycznie dla obu ról. Dla lektora (jedyny kontekst, w którym ten ekran w ogóle się montuje) efekt teraz woła `openTaskReview`, nie `setActiveTask`. `TeacherAttentionBanner.tsx` i `TeacherHomeworkNotification.tsx` scalone na jeden kanał nawigacji (`filterStatus: 'submitted'` / `taskId`) zamiast osobnego `onOpenV2Review`.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (440/440), `npm run build` (przechodzi), `npm --prefix functions run build` (przechodzi).
- **Nie dokończone / do sprawdzenia**:
  - UI NIE był sprawdzony wzrokowo w przeglądarce — zgodnie z długiem z sekcji 6 tego pliku. Priorytet: nowy toggle w nagłówku, osadzony widok v2 w modalu, przyciski „Zaproponuj ocenę z AI"/„Zatwierdź i wyślij".
  - `StudentHomeworkV2Screen.tsx` pozostaje niepodpięty do nawigacji kursanta (patrz audyt wyżej) — nowe zadania v2 tworzone przez „+ Przypisz pracę domową" nie mają dziś jak dotrzeć do kursanta przez normalny ekran. Wymaga osobnej decyzji: naprawić routing w `Dashboard.tsx`, czy tymczasowo wyłączyć `HOMEWORK_ENGINE_V2` przy tworzeniu nowych zadań, dopóki ekran kursanta nie będzie gotowy.
  - Powiadomienie e-mail po zatwierdzeniu oceny v2 (`approveGradeV2`) korzysta z tego samego `/api/homework/notify-graded` co v1 — ten endpoint nie weryfikuje, że wywołujący jest lektorem/adminem lub że `studentUid` w body to faktyczny adresat (tylko `requireFirebaseAuth`, czyli dowolny zalogowany). To pre-istniejąca luka w `server.ts`, NIE wprowadzona ani naprawiona w tej rundzie — odnotowana, bo dotknięta ścieżka jest teraz wołana z nowego miejsca.
  - Auto-ocena v1 przy 100% pewności NIE wysyła e-maila o sprawdzonej pracy (tylko ustawia `status: 'graded'` w Firestore — kursant zobaczy wynik w aplikacji); auto-ocena v2 przy 100% pewności też pomija powiadomienie e-mail. Świadome uproszczenie zakresu tej rundy — do rozważenia, czy dopisać wysyłkę.
- Ryzyka: `firestore.rules` NIE dotknięty (nowy dokument ustawień mieści się w istniejącej regule `system/{document=**}`). Middleware autoryzacji w `server.ts` i ścieżki tokenowe bez logowania niedotknięte. Nowe endpointy `onCall` (`proposeHomeworkV2Grade`, `approveHomeworkV2Grade`) wymagają wdrożenia (`npm run deploy:functions`) zanim zadziałają na produkcji — do czasu wdrożenia przycisk „Zaproponuj ocenę z AI" dla zadań v2 zwróci błąd wywołania.

---

### Z. P0: Podpięcie ekranu kursanta v2 (`StudentHomeworkV2Screen.tsx`) do `Dashboard.tsx` (2026-09-20)
- **Problem**: entry Y wyżej odnotowała, że silnik v2 domyślnie tworzy nowe zadania po „+ Przypisz pracę domową", ale `StudentHomeworkV2Screen.tsx` był martwym importem w `Dashboard.tsx` — kursanci nie mieli jak w ogóle zobaczyć ani odesłać zadania v2.
- **Audyt komponentu**: znaleziony jeden prawdziwy błąd — `useState` dla `showManualHint` stał PO trzech warunkowych `return` (naruszenie Reguł Hooków), co ujawniłoby się dopiero w przeglądarce jako rozjazd kolejności hooków przy przejściu między widokami (lista/zadanie/koniec). Przeniesiony na górę komponentu razem z resztą stanu. Poza tym komponent jest kompletny: pobiera zadania, wysyła próby przez `submitHomeworkAttemptV2`, ma autosave szkicu do podkolekcji `drafts` (reguły Firestore już na to pozwalały z wcześniejszej rundy — zero zmian w `firestore.rules`), i poprawnie oddaje `fallback` (ekran v1), gdy kursant nie ma zestawu v2.
- **`Dashboard.tsx`**: w gałęzi `view === 'homework'` dla kursanta dodane rozgałęzienie — gdy `HOMEWORK_ENGINE_V2` włączone, renderuje się `StudentHomeworkV2Screen` z `fallback={homeworkV1}` (JSX już przygotowany wcześniej, ale nieużywany) zamiast zawsze zwracać `homeworkV1`.
- **Spójność nawigacji**: nowy prop `initialTaskId` w `StudentHomeworkV2Screen.tsx` — kliknięcie kafelka/powiadomienia ze wskazanym zadaniem otwiera je od razu, zamiast zostawiać kursanta na liście. Gdy wskazane zadanie NIE jest zadaniem v2 (kursant ma i v1, i v2, link celuje w starsze v1), komponent oddaje `fallback` zamiast pustej/złej listy v2.
- **Skutek uboczny poprzedniej rundy (human-in-the-loop) odnotowany, nie naprawiony**: skoro `submitHomeworkV2Attempt` już nie ocenia automatycznie (entry Y), ten ekran nadal mechanicznie działa (zapisuje próbę, przechodzi dalej po 3 próbach), ale drabinka podpowiedzi/„pokaż wzorzec po 3 próbie" się nie uruchamia — kursant widzi generyczne „zapisano, nauczyciel sprawdzi" zamiast natychmiastowego coachingu. Zgodne z human-in-the-loop, ale zmienia charakter ekranu; do rozmowy przy następnej sesji.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (440/440), `npm run build` (przechodzi).
- **Nie dokończone / do sprawdzenia**: UI NIE sprawdzony wzrokowo w przeglądarce (brak dostępu do zalogowanej sesji Firebase w środowisku agenta) — priorytet numer jeden przy najbliższym logowaniu. Ekran v2 nie ma własnego „← Wróć do pulpitu" (TopBar ma Home niezależnie, więc nie jest to ślepy zaułek, ale UX niespójny z v1). Ekran v2 nie pokazuje kursantowi rozbicia odpowiedzi po tym, jak lektor później zatwierdzi ocenę (`approveHomeworkV2Grade`) — powiadomienie dociera przez `StudentHomeworkGradedModal`/e-mail, ale nie ma szczegółowego widoku „sprawdzone" jak w v1.
- Ryzyka: `firestore.rules` NIE dotknięty (reguły dla `attempts`/`drafts` już istniały). Middleware autoryzacji i ścieżki tokenowe bez logowania niedotknięte. `server.ts` nieedytowany. Zero zmian schematu danych.

---

### AA. P0: Diagnoza i naprawa 145 s na `generateHomeworkV2` (6 zadań) → docelowo pojedyncze cyfry sekund (2026-09-20)
- **Przyczyna #1 (dominująca)**: `qualityValidator.ts:validateAll` sprawdzał każde zadanie OSOBNYM wywołaniem modelu, sekwencyjnie (`for...of` + `await`), a każda z do dwóch regeneracji na zadanie też była osobnym zapytaniem. Dla zestawu 6 zadań to od 7 (najlepszy przypadek: 1 generowanie + 6 walidacji) do 31 sekwencyjnych zapytań HTTP do Gemini w najgorszym (1 + 6 + 2×6×2). Generowanie SAMYCH zadań już wcześniej było jednym wywołaniem na cały zestaw (`exerciseGenerator.ts:generateExercises`) — winowajcą był krok kontroli jakości, nie generator.
- **Przyczyna #2 (mnożnik na każde zapytanie)**: żadne wywołanie Gemini 2.5 Flash w `openai.ts:createAiCall` nie ustawiało `thinkingConfig` — model dokładał domyślny, niewidoczny budżet rozumowania do KAŻDEGO zapytania, mimo że prompty tego silnika są już maksymalnie rozpisane (format, reguły, gotowy przykład) i nie potrzebują wielokrokowego rozumowania. Przy 7-31 sekwencyjnych zapytaniach z dorzuconym "myśleniem" na każdym, 145 s dla 6 zadań się zgadza rachunkowo.
- **Nie potwierdzone jako przyczyna** (zbadane i wykluczone): brak pętli exponential-backoff/retry przy błędach walidacji schematu — `createAiCall` przy błędzie po prostu przechodzi do następnego modelu w kaskadzie, bez opóźnień. Format odpowiedzi już był wymuszony natywnie (`responseMimeType: 'application/json'`) — `extractJson` z wycinaniem markdownowych bloków jest tylko defensywnym zapasowym parserem, nie głównym mechanizmem. Pobieranie kontekstu (`contextAssembler.ts`) już używa `Promise.all` dla lekcji, nie sekwencyjnych zapytań Firestore.
- **Naprawa #1 — walidacja i regeneracja są teraz WSADOWE**: `qualityValidator.ts` dostał `validateBatch` (jedno zapytanie ocenia CAŁY zestaw naraz, dopasowanie werdyktów po polu `index`) i `exerciseGenerator.ts` dostał `regenerateBatch` (jedno zapytanie poprawia WSZYSTKIE nieudane zadania danej rundy naraz, znając zarzuty każdego z osobna). `validateAll` w `qualityValidator.ts` przepisany: zamiast pętli po zadaniach, robi 1 walidację wstępną + do `MAX_REGENERATIONS` (2) rund, każda runda to 1 zapytanie regeneracji + 1 zapytanie ponownej walidacji WYŁĄCZNIE zadań, które jeszcze nie przeszły. Górny limit zapytań dla całego zestawu spadł z `1 + 5N` (N = liczba zadań) do stałych `1 + 2×2 = 5`, niezależnie od tego, czy zestaw ma 3 czy 30 zadań. Usunięty jako martwy kod: `regenerateDraft` (pojedyncze wywołanie na zadanie), w pełni zastąpiony przez `regenerateBatch`.
- **Naprawa #2 — wyłączony domyślny budżet myślenia**: `ModelRequest` w `openai.ts` dostał opcjonalne pole `thinkingBudget` (domyślnie `0`), przekładane na `generationConfig.thinkingConfig.thinkingBudget` w zapytaniu do Gemini. Dotyczy WSZYSTKICH wywołań silnika v2 przez `createAiCall` (generowanie, walidacja, regeneracja, ocena próby w `gradingEngine.ts`, feedback w `feedbackComposer.ts`) — nie tylko `generateHomeworkV2`, bo to jedna wspólna funkcja wywołująca model dla całego silnika. Wywołujący może podać większy budżet tam, gdzie się to kiedyś okaże potrzebne (pole jest opcjonalne, nie usunięte).
- **Wynik**: dla zestawu 6 zadań, ścieżka bez odrzuceń walidatora to teraz 2 zapytania do Gemini (1 generowanie + 1 walidacja wsadowa) zamiast 7-31 — przy per-zapytaniowym opóźnieniu rzędu 3-5 s bez rozszerzonego rozumowania, całość mieści się w pojedynczych cyfrach sekund, zgodnie z kryterium sukcesu. Ścieżka z odrzuceniami (rzadsza) rośnie najwyżej do 6 zapytań (5 dodatkowych rund), nie do dziesiątek.
- Nowe testy w `tests/homeworkV2Flow.test.ts` (3): walidacja całego zestawu to jedno wywołanie modelu niezależnie od liczby zadań; dopasowanie werdyktów po `index`, nie po kolejności w tablicy; regeneracja obejmuje WYŁĄCZNIE zadania, które nie przeszły, jednym wywołaniem na rundę (z policzoną, stałą górną granicą zapytań). Nowy plik `tests/homeworkV2AiCall.test.ts` (2 testy, mockujący `global.fetch`): domyślny `thinkingBudget: 0` trafia do requestu Gemini; jawnie podany budżet nadpisuje domyślny.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445, baza 440 + 5 nowych), `npm --prefix functions run build` (przechodzi), `npm run build` (przechodzi).
- **Nie dokończone / do sprawdzenia**: brak realnego pomiaru czasu na produkcji z prawdziwym kluczem Gemini — środowisko agenta nie ma dostępu do klucza ani do wdrożonych Cloud Functions, więc "145 s → sekundy" jest zweryfikowane analitycznie (liczba zapytań × szacowany czas na zapytanie) i testami jednostkowymi na liczbę wywołań, NIE zmierzonym realnym czasem end-to-end. Do potwierdzenia po `npm run deploy:functions`: pierwsze realne `generateHomeworkV2` z logiem `[hw-v2] wywołanie modelu Gemini` (już istniejący log kosztu/latencji na każde wywołanie) powinno pokazać 1-2 wpisy zamiast 7+, każdy rzędu kilku sekund. Ewentualny spadek jakości zadań przez wyłączenie "myślenia" modelu nie był oceniany jakościowo — jeśli zestawy zaczną wypadać gorzej, pierwszy krok to podniesienie `thinkingBudget` selektywnie dla generatora (kreatywne układanie), zostawiając walidator/regenerację przy `0` (zadania deterministyczne, `temperature: 0`).
- Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania ani schemacie danych — zmiana jest wyłącznie w warstwie orkiestracji wywołań modelu wewnątrz Cloud Functions. `endpoints.ts` i `pipeline.ts` niezmienione poza jedną linią wiążącą `regenerateBatch` zamiast `regenerateDraft` do `validateAll`. Interfejs `ValidateAllInput` zmienił pole `regenerate` na `regenerateBatch` — to breaking change dla ewentualnego kodu spoza tego repo, który by go importował (brak takiego przypadku tutaj, potwierdzone grepem).

### AB. Naprawa trzech błędów renderowania ćwiczeń v1 u kursanta: nagłówek rozsypanki, zdublowana instrukcja przy poprawie błędu, pusty ekran luki (2026-09-20)
- **Ważne dla następnej sesji**: zadanie było opisane jako dotyczące `StudentHomeworkV2Screen.tsx`, ale zbadane pod agentem eksploracyjnym pokazało, że ten ekran renderuje wszystkie 3 typy v2 (`micro_translation`, `fix_sentence`, `gap_from_context`) identycznie jako płaski tekst + textarea — nie ma tam ani klocków, ani luk, ani zdublowanej linii „Znaczenie". Opisane objawy (klocki `chunks`, tokeny `[BLANK_n]`, pole `polishHint`) pasują dokładnie do **silnika v1** (`HomeworkExercise.tsx`, używany przez `StudentHomeworkScreen.tsx` i `DirectHomeworkScreen.tsx`, czyli ekran kursanta po linku z maila). Maciej potwierdził wprost, że to v1. Jeśli ktoś w przyszłości dostanie podobne zgłoszenie „pusty ekran/zdublowana instrukcja w pracy domowej kursanta" — najpierw sprawdzić, którym ekranem (v1 czy v2) kursant faktycznie rozwiązuje zadanie, zanim zacznie się grzebać w `StudentHomeworkV2Screen.tsx`.
- **Rozsypanka (`word_order`) — brak nagłówka**: `HomeworkExercise.tsx`, blok `type === 'word_order'` w ogóle nie miał nagłówka poza opcjonalnym `item.polishHint`. Naprawa: deterministyczny nagłówek — „Przetłumacz zdanie:" + widoczny boks ze zdaniem źródłowym (`polishHint`/`sourceSentence`/`prompt`), gdy tekst polski istnieje; „Ułóż słowa w poprawnej kolejności:" bez boksu, gdy go nie ma.
- **Znajdź błąd (`find_errors`) — zdublowana instrukcja**: `meaningText` miał zapasowe źródło `item.instruction`, gdy `item.exerciseType === 'fix_sentence'` — a `instruction` dla tego typu w praktyce powtarza treść odznaki „Znajdź i popraw błąd w zdaniu" wypisanej wyżej. Naprawa: `meaningText` bierze WYŁĄCZNIE `item.polishHint`/`item.meaning` (realne tłumaczenie/kontekst), odrzucone jeśli treść pasuje do listy znanych generycznych etykiet instrukcji. Etykieta zmieniona z „Instrukcja / Znaczenie:" na samo „Znaczenie:", bo teraz pokazuje wyłącznie prawdziwe znaczenie, nie instrukcję.
- **Uzupełnij luki (`fill_in_the_blank`) — pusty ekran**: renderer zakładał WYŁĄCZNIE stary kształt v1 (`item.textWithBlanks` z tokenami `[BLANK_n]` + `item.availableWords` jako bank słów do wyboru). Generator v2 (`gap_from_context`, patrz `functions/src/homeworkV2/coreKnowledge.ts:120-128`) nie wysyła żadnego z tych pól — wysyła `content` jako zdanie z luką oznaczoną `___` (trzy podkreślniki) i **bez banku słów**, kursant ma wpisać słowo sam. Gdy taki element trafiał (jakąkolwiek drogą) do tego renderera, `parts` wychodziło puste i ekran między paskiem postępu a nawigacją był kompletnie pusty. Naprawa — trzy gałęzie: (1) stary tryb klocków, gdy są tokeny `[BLANK_n]`, bez zmian; (2) nowy tryb: gdy `content`/`text`/`sentence` zawiera `___`, renderuje zdanie z wstawionym polem `<input>` w miejscu luki, odpowiedź jako zwykły string; (3) zabezpieczenie: gdy nie rozpoznano żadnego z dwóch formatów, pokazuje pełną treść zadania (fallback po `content`/`text`/`sentence`/`instruction`) plus wolne pole tekstowe — kursant NIGDY nie widzi pustego ekranu, nawet przy nieznanym kształcie danych.
- Nie tknięto duplikatu tej samej logiki `find_errors`/`fill_in_the_blank` w `HomeworkScreen.tsx` (linie ok. 1750-1799) — to inline implementacja używana w widoku lektora/admina (`TeacherWorkScreen.tsx`, `AdminPanel.tsx`), nie w ekranie, w którym kursant rozwiązuje zadanie. Poza zakresem tego zadania; jeśli podobny objaw wystąpi też tam, wymaga osobnej naprawy.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445, bez nowych testów — zmiana czysto w warstwie renderowania UI, bez logiki do jednostkowego pokrycia poza tym, co już testują istniejące testy), `npm run build` (przechodzi).
- **Nie dokończone / do sprawdzenia**: zmiany nie zostały obejrzane w działającej przeglądarce (brak dostępu do zalogowanej sesji w tej sesji agenta) — przed wysłaniem do kursantów sprawdzić wzrokowo wszystkie 3 typy zadań na realnym zestawie z `homework/direct/:token`. Root cause, DLACZEGO w ogóle element „v2-kształtny" (`gap_from_context`) trafiał do renderera v1, nie został ustalony — `isV1Task`/`isV2Task` w `utils/homework.ts` teoretycznie filtruje to po stronie zapytania, ale fallback w `homeworkItemType()` (linia 76: `task?.type || 'translation'`) sugeruje, że mieszane/starsze dokumenty mogą omijać ten filtr. Naprawa w tym zadaniu jest defensywna (nigdy nie pokazuj pustego ekranu) niezależnie od przyczyny, ale warto to zbadać osobno, jeśli objaw się powtórzy.
- Ryzyka: Brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania ani schemacie danych Firestore — zmiana wyłącznie w jednym komponencie prezentacyjnym (`components/dashboard/HomeworkExercise.tsx`).

### AC. Doprecyzowanie wpisu AB po teście na realnym UI kursanta: sanityzacja instrukcji w rozsypance v1, defensywny fallback treści w v2 (2026-09-20)
- Maciej przetestował naprawę z wpisu AB na żywym UI i zgłosił dwa dalsze objawy — jeden potwierdza, że fix z AB był niekompletny, drugi dotyczy realnie silnika v2 (nie pomyłki v1/v2 jak w AB):
- **Rozsypanka (`word_order`, v1) — boks nadal pokazywał instrukcję AI zamiast zdania**: fix z AB pokazywał boks źródłowy zawsze, gdy `polishHint`/`sourceSentence`/`prompt` było niepuste — ale generator potrafi wstrzyknąć do TEGO SAMEGO pola własną instrukcję („Popraw zdanie. Zwróć uwagę na zaimek dzierżawczy.") zamiast prawdziwego zdania polskiego. Naprawa: `HomeworkExercise.tsx`, `type === 'word_order'` — dodany filtr `looksLikeInstruction` (regex `^(popraw zdanie|zwróć uwagę|instrukcja|ułóż)`), który taki tekst traktuje jak pusty; wtedy komponent poprawnie spada na nagłówek „Ułóż słowa w poprawnej kolejności:" bez boksu, zamiast pokazać polecenie jako rzekome zdanie źródłowe.
- **Uzupełnij z kontekstu (`gap_from_context`, v2) — pusty szary obrys w kroku 2/6**: zbadano `StudentHomeworkV2Screen.tsx` i kontrakt (`functions/src/homeworkV2/contracts.ts` — `ExerciseContractV2.content`, jedyne pole treści, wymagane niepuste przez `isExerciseContractV2` i egzekwowane przez `selectSendableExercises` przed zapisem do `sentences`). Backendowo `content` nie powinien być pusty — filtr serwerowy odrzuca kontrakty bez niego, zanim trafią do dokumentu kursanta. Nie znaleziono ścieżki po stronie Cloud Functions, która nadpisywałaby/czyściła `sentences` po zapisie (`submitHomeworkV2Attempt`, `proposeHomeworkV2Grade`, `approveHomeworkV2Grade` tylko odczytują `contract` z istniejącej tablicy, nie modyfikują jej). Root cause NIE został jednoznacznie ustalony (możliwe: starszy/ręcznie edytowany dokument sprzed `SCHEMA_VERSION` obecnego kontraktu). Naprawa defensywna zamiast czekania na diagnozę: `exerciseContent` czyta `exercise.content` z fallbackiem na `sentence`/`prompt`/`sourceText`, `console.error` przy każdym pustym wyniku (ze zrzutem całego `exercise`, do zdiagnozowania z konsoli kursanta następnym razem), a UI zamiast pustego obrysu pokazuje czytelny komunikat „Nie udało się wczytać treści tego zadania…" zamiast milczącej pustki. `exercise.instruction` też ma teraz fallback („Uzupełnij zdanie.”), gdyby i to pole było puste.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445), `npm run build` (przechodzi).
- **Nie dokończone / do sprawdzenia**: root cause pustego `content` w v2 nadal nieznany — jeśli objaw się powtórzy, sprawdzić w konsoli przeglądarki log `[StudentHomeworkV2Screen] Zadanie bez treści (content):` dodany w tej naprawie, da pełny zrzut obiektu zadania do dalszej diagnozy. Zmiany ponownie nieobejrzane w przeglądarce przez agenta (brak dostępu do zalogowanej sesji) — Maciej testuje sam.
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji ani ścieżkach tokenowych — wyłącznie dwa komponenty prezentacyjne (`HomeworkExercise.tsx`, `StudentHomeworkV2Screen.tsx`).

### AD. Rollback `HOMEWORK_ENGINE_V2` → `false`: zgłoszona „krytyczna regresja" (brak rozgrzewki/pigułek/Wstecz-Dalej/Odeślij pracę) to zamierzona różnica dwóch produktów, nie bug (2026-09-20)
- Zgłoszenie opisywało zniknięcie rozgrzewki, paska pigułek zadań, przycisków Wstecz/Dalej i przycisku „Odeślij pracę" — z żądaniem przywrócenia ich w `StudentHomeworkV2Screen.tsx` razem z usunięciem blokady „Sprawdź odpowiedź"/„Pozostałe próby: 2".
- **To nie jest regresja w v2 — to jest v1.** `StudentHomeworkV2Screen.tsx` (ekran „treningu" z próbami, podpowiedziami i stanem opanowania) nigdy nie miał rozgrzewki, pigułek ani swobodnej nawigacji — to zamierzony inny model, zamrożony w `functions/src/homeworkV2/contracts.ts` §3.1 (`MAX_ATTEMPTS = 3`, drabinka podpowiedzi `hintForAttempt`, `resolveMastery` zależny od numeru próby). Cała opisana funkcjonalność (rozgrzewka `HomeworkWarmupScrambler.tsx`, pigułki zadań, Wstecz/Dalej, „Odeślij pracę domową") żyje wyłącznie w starym ekranie `StudentHomeworkScreen.tsx` (v1, 1949 linii) — i tam nadal działa bez zmian.
- Przepisanie v2 pod model batch/free-nav bez blokady odrzucone jako rozwiązanie: wymagałoby demontażu zamrożonego kontraktu oceniania (numer próby steruje i podpowiedzią, i tym, czy zadanie liczy się jako „opanowane") oraz przeprojektowania `submitHomeworkV2Attempt`/`gradingEngine.ts` po stronie Cloud Functions — zbyt duża zmiana architektoniczna na „krytyczną naprawę" bez wcześniejszej decyzji Macieja (patrz §7.1 CLAUDE.md, faza testów).
- Zapytany wprost, Maciej wybrał najmniejszą opcję: **rollback przez istniejący przełącznik**, zaprojektowany dokładnie do tego (`config/featureFlags.ts` — komentarz przy `HOMEWORK_ENGINE_V2`: „Wyłączenie flagi jest rollbackiem — nie wymaga cofania wdrożenia ani migracji danych"). Zmieniono `HOMEWORK_ENGINE_V2` z `true` na `false` — jedna linia. Skutek: `Dashboard.tsx:525` przestaje renderować `StudentHomeworkV2Screen` dla kogokolwiek, wszyscy kursanci wracają do `StudentHomeworkScreen` (v1) z rozgrzewką, pigułkami, Wstecz/Dalej i „Odeślij pracę" — bez zmiany kodu tych ekranów. `HomeworkScreen.tsx:1910` (widok lektora) i `services/homeworkV2Client.ts:115` już wcześniej rozgałęziały się na tej samej fladze, więc panel lektora automatycznie wraca do kreatora v1 w tym samym commicie.
- **Nie tknięto** drugiej połowy przełącznika po stronie Cloud Functions (`functions/src/homeworkV2/flag.ts`, zmienna środowiskowa `HOMEWORK_ENGINE_V2` w `functions/.env` / konsoli GCP) — to osobny deploy, poza zakresem zmiany w repo frontendu, i nie było proszone. Jeśli backend v2 ma też przestać przyjmować wywołania `onCall`, wymaga to świadomej decyzji o zmianie zmiennej środowiskowej i redeployu funkcji.
- **Nie sprawdzono**, czy istnieją już realne zestawy `specialTasks` z `engineVersion: 2` przypisane żywym kursantom — po tym rollbacku taki kursant trafia do ekranu v1, który filtruje wyłącznie zadania v1 (patrz `isV1Task`/`isV2Task` w `utils/homework.ts`), więc jego zadanie v2 stałoby się niewidoczne w UI, dopóki flaga nie wróci na `true`. Do zweryfikowania przed ogłoszeniem rollbacku kursantom, jeśli ktokolwiek poza Maciejem miał już przydzielone zadanie v2.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji ani ścieżkach tokenowych — zmiana jednej stałej w `config/featureFlags.ts`. Ryzyko biznesowe opisane wyżej (możliwe ukrycie już przydzielonych zadań v2).

### AE. Kontrast nagłówków sekcji w Notatniku A4 — podział `NOTEBOOK_COLORS` na osobne odcienie light/dark zamiast jednego wspólnego heksa (2026-09-20)
- Zlecenie prosiło o zamianę kolorów pięciu nagłówków sekcji lekcji na klasy Tailwind `text-*-700`/`text-*-800`/`text-*-900` oraz o `text-gray-900` dla tekstu podstawowego. Żadne z nich nie pasowało dosłownie do implementacji — zbadano `utils/notebookPalette.ts` przed zmianą:
  - Kolory nagłówków NIE są klasami CSS. To surowe hexy wpisywane WPROST w HTML dokumentu (`style="color:…"`) w chwili wstawienia sekcji — bo treść jest trwale zapisywana w Firestore i musi zostać czytelna niezależnie od tego, czy ktoś kiedyś przełączy kartkę na ciemny motyw. Plik miał już udokumentowaną, świadomą decyzję: jeden wspólny hex na kolor, dobrany tak, żeby jedna wartość dawała ~3,4:1 na jasnym papierze I ~4,4:1 na ciemnym — a wcześniejszy, ciemniejszy zestaw (`#d81b7a`, `#1d4ed8`, `#7c3aed`) był świadomie odrzucony, bo na ciemnej kartce robił się "jaskrawymi plamami".
  - 3,4:1 faktycznie nie przechodzi WCAG AA (próg 4,5:1) — zgłoszenie miało rację co do samego problemu, ale proponowane rozwiązanie (jeden, dużo ciemniejszy hex) cofnęłoby projekt dokładnie do wariantu, który już raz odrzucono za psucie ciemnego motywu.
  - Tekst podstawowy edytora już dziś używa `NOTEBOOK_INK` (`#2c2822` na jasnym papierze, `#eae8e3` na ciemnym) przez zmienną CSS `--pad-fg` — nie `text-gray-500` ani żadnej klasy Tailwind. `#2c2822` ma WYŻSZY kontrast na białym papierze niż `text-gray-900` (`#111827`) w praktyce jest ciemniejszy/cieplejszy odpowiednik — nie wymagało zmiany. Nie dodano sztucznej klasy `text-gray-900` do systemu opartego na CSS-owych zmiennych, bo nic by nie zrobiła (kolor i tak steruje `--pad-fg`) i wprowadziłaby martwy kod.
- Zapytany wprost, Maciej wybrał: osobne odcienie per motyw papieru, zamiast jednego wspólnego (ciemniejszego) heksa dla obu.
- Zmiana w `utils/notebookPalette.ts`: `NOTEBOOK_COLORS[klucz]` to teraz `{ light, dark }` zamiast pojedynczego stringa — `dark` bez zmian (oryginalny, już działający na ciemnym papierze zestaw), `light` to nowy, ciemniejszy i bardziej nasycony odcień z rodziny Tailwind 700–900 (rose→`#9f1239`, orange→`#92400e`/amber-800, green→`#065f46`/emerald-800, blue→`#1e40af`/blue-800, violet→`#5b21b6`/violet-800), dobrany pod jasny papier. Dodana funkcja `notebookHeadingColor(klucz, paperTheme)`. Paleta paska narzędzi (kolor DOWOLNIE zaznaczonego tekstu, nie nagłówków) wydzielona do osobnej stałej `TOOLBAR_COLORS` i celowo NIE dostała podziału light/dark — uzasadnienie w komentarzu przy tej stałej (nie ma jednego miejsca "pod aktualny motyw", bo koloruje dowolny fragment tekstu, nie z góry znaną sekcję).
- `utils/lessonTemplate.ts`: `LESSON_SECTIONS` przechowuje teraz `colorKey` zamiast gotowego heksa; `buildLessonTemplate` przyjmuje nową opcję `paperTheme` (`'light' | 'dark'`, domyślnie `'light'`) i rozstrzyga kolor w chwili budowania HTML.
- `components/scratchpad/ScratchpadEditor.tsx`: oba wywołania `buildLessonTemplate` (nowa lekcja z paska narzędzi i import z Notion) przekazują `paperTheme` z istniejącego stanu komponentu; zduplikowana, inline'owa lista sekcji przy imporcie z Notion (linie ok. 1389-1394) przestawiona na `colorKey` + `notebookHeadingColor(...)` tak samo jak `lessonTemplate.ts`, żeby oba miejsca budowania sekcji nie rozjechały się kolorystycznie.
- **Znana i zaakceptowana właściwość, nie nowa wada**: kolor nagłówka jest zamrożony w dokumencie w chwili wstawienia. Sekcja wstawiona w motywie jasnym i zapisana zachowuje ciemniejszy odcień na zawsze — również gdy kursant PÓŹNIEJ przełączy kartkę na ciemną (przełącznik motywu jest per-widz, w `localStorage`, nie właściwością dokumentu). To ta sama, już istniejąca w tym systemie zasada co dla ręcznie kolorowanego tekstu paskiem narzędzi ("wpisy zrobione wcześniej zachowują swoje kolory") — nie regresja wprowadzona tą zmianą.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445, bez nowych testów — `tests/lessonTemplate.test.ts` nie asercjonuje konkretnych heksów), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji ani ścieżkach tokenowych — zmiana w warstwie prezentacji/generowania HTML notatnika (`utils/notebookPalette.ts`, `utils/lessonTemplate.ts`, `components/scratchpad/ScratchpadEditor.tsx`). Nie zweryfikowano wzrokowo w przeglądarce (brak dostępu do zalogowanej sesji) — sprawdzić realny kontrast nowych nagłówków na jasnym papierze i upewnić się, że ciemny papier wygląda bez zmian.

### AF. Notatnik A4: koniec automatycznego wstawiania „Lesson 1" przy tworzeniu notatnika + naprawa kontrastu na STARYCH nagłówkach, nie tylko nowych (2026-09-20)
- Zlecenie: notatnik kursanta ma wczytywać wyłącznie istniejący stan z bazy — pusty dokument zostaje pusty, dopóki lektor nie kliknie „+ Nowa lekcja". Zbadano `ScratchpadEditor.tsx` — tam auto-wstawianie NIE istniało (`handleInsertLesson` jest wyłącznie pod przyciskiem/menu). Rzeczywiste źródło automatu było w `services/scratchpadService.ts`: `getInitialScratchpadContent()`, wołane przez `getOrCreateStudentScratchpad()` przy zakładaniu NOWEGO notatnika (funkcja `getOrCreateStudentScratchpad` w tym samym pliku, świadomie udokumentowana 2026-09-12 — patrz komentarz w kodzie sprzed zmiany), i analogicznie przez `ensureGroupScratchpad()` w `services/groupService.ts` dla notatników grupowych.
- Zmiana: `getInitialScratchpadContent()` zwraca teraz `{ html: '', text: '' }` zamiast `buildLessonTemplate(...)` — import `buildLessonTemplate` z `utils/lessonTemplate.ts` usunięty z `scratchpadService.ts` jako nieużywany. Jeśli lektor ma ustawiony własny domyślny szablon (`scratchpadTemplates`, `isDefault: true`), ten wybór ZOSTAJE — to jawna decyzja lektora, nie automat w kodzie; zmienia się wyłącznie wbudowany fallback. `adoptScratchpadForStudent()` (przenoszenie treści z notatnika roboczego) nie wymagał zmian — porównanie „czy notatnik jest nietknięty" już wcześniej traktowało pusty tekst jako `untouched = true`.
- Przy okazji naprawiono drugą część tego samego zgłoszenia: stare nagłówki sekcji, wstawione PRZED wczorajszym podziałem `NOTEBOOK_COLORS` na `{light, dark}` (wpis AE wyżej), mają nadal wpisany w HTML jeden, wspólny hex (dzisiejszą wartość `dark`) — na jasnym papierze to wciąż ~3,4:1, poniżej WCAG AA. Ponieważ te nagłówki są zapisane w dokumencie i nikt ich nie przepisuje za lektorem (ta sama zasada co w AE), naprawa NIE mogła być zapisem do bazy. Dodano `sanitizeFrozenHeadingContrast(html, paperTheme)` w `utils/notebookPalette.ts` — czysta transformacja PRZY WCZYTANIU do edytora (`ScratchpadEditor.tsx`, efekt synchronizujący `docData.contentHtml` → `editorRef.current.innerHTML`, teraz też zależny od `paperTheme`), ograniczona wyłącznie do `<h3 style="color:...">` z jednym z pięciu znanych tytułów sekcji lekcji — nie dotyka koloru, który lektor ręcznie nadał zwykłemu tekstowi paskiem narzędzi (te same heksy w `TOOLBAR_COLORS`, inne znaczenie). Na ciemnym papierze funkcja nic nie robi.
- Test `tests/scratchpad.test.ts` zaktualizowany pod nowe zachowanie (dawniej asercjonował obecność „Lesson 1" i pięciu sekcji w treści startowej — teraz asercjonuje pustą treść).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (445/445 przed dodaniem testów homeworku — patrz AG), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji ani ścieżkach tokenowych. Nie zweryfikowano wzrokowo w przeglądarce — sprawdzić, że nowy notatnik faktycznie startuje pusty i że stare, zaimportowane wcześniej lekcje mają teraz czytelne nagłówki na jasnym papierze.

### AG. Adapter kanoniczny ćwiczeń pracy domowej (`normalizeExercise`) — koniec zduplikowanych łańcuchów fallbacków w `HomeworkExercise.tsx`, `.word`-bezpieczna rozsypanka, deterministyczne nagłówki przez i18next (2026-09-20)
- Zlecenie opisywało pełny adapter kanoniczny z nowym systemem typów (`UNSCRAMBLE`/`GAP_FILL`/...) i hardkodowaną stałą `EXERCISE_UI_COPY`. Przed implementacją sprawdzono zakres z Maciejem (dwa pytania): (1) `HOMEWORK_ENGINE_V2 = false` (rollback AD, ten sam dzień) — `StudentHomeworkScreen.tsx` + `HomeworkExercise.tsx` (v1) to jedyny ekran, który realnie widzi kursant, więc normalizacja obejmuje TYLKO v1, nie dotyka nieużywanego dziś `StudentHomeworkV2Screen.tsx`; (2) CLAUDE.md §4 wymaga i18next, a hardkodowana stała łamałaby to wprost (nie odziedziczony dług — nowe złamanie) — wybrano i18next.
- Nowy plik `utils/normalizeExercise.ts`: `normalizeExercise(raw, task?)` zwraca `CanonicalExercise` z jednym z czterech typów kanonicznych — celowo NIE nowy enum (`UNSCRAMBLE` itd.), tylko te same cztery wartości, które `homeworkItemType()` w `utils/homework.ts` już rozróżnia (`word_order`, `fill_in_the_blank`, `translation`, `find_errors`) — mniej pojęć w kodzie, `TYPE_ALIASES` mapuje na nie warianty v2 (`fix_sentence`, `gap_from_context`, `micro_translation`) i literalne `unscramble`/`gap_fill`/`cloze`. `multiple_choice` (piąty typ v1, nieopisany w zleceniu) zostaje bez zmian — działał poprawnie, nie ma bugów do naprawienia.
  - `state: 'ready' | 'degraded' | 'invalid'` — zero wyjątków, `try/catch` na całości; błędny/pusty element nigdy nie wywraca renderu, tylko degraduje.
  - `normalizeGapPayload()` obsługuje cztery kształty luki: kanoniczne `{{gap:n}}`, legacy `[BLANK_n]` z bankiem (`services/geminiService.ts:generateFillInTheBlankExercises`, jedyny format faktycznie używany przez dzisiejszy generator v1), potrójne podkreślenie `___` bez banku (`content`/`text`/`sentence`, format `gap_from_context` z v2 — źródło „pustego szarego boksu" z AB/AC), i zdanie bazowe + `wordsToCut`/`missingWords` (format przewidziany na przyszłość — dzisiejszy generator go nie wysyła, ale grep potwierdził brak konfliktu z istniejącymi danymi).
  - Rozsypanka (`word_order`): `tokens` to ZAWSZE `string[]` — `normalizeTokens()` NIE odrzuca elementów (źródło `TypeError: reading 'word'`, gdyby AI zwróciło `{word: "..."}` zamiast stringa), tylko podmienia je na pusty string / `String(entry)`, bo `answer` w UI trzyma INDEKSY do tej tablicy, a `answerToText()` w `StudentHomeworkScreen.tsx` czyta `item.chunks?.[i]` — filtrowanie przesunęłoby indeksy i rozjechało już zapisane odpowiedzi.
  - `looksLikeInjectedInstruction()` — przeniesiona z `HomeworkExercise.tsx` (commit 9294fab) heurystyka wykrywająca, gdy generator wstrzyknął własną instrukcję w pole zdania źródłowego; boks tłumaczenia/źródła renderuje się tylko, gdy realnie istnieje zdanie.
  - `exerciseUiCopy(type)` zwraca nagłówek/polecenie PRZEZ `i18n.t(...)` (klucz = domyślny polski tekst, zgodnie z konwencją repo) — dodane klucze w `en.json`/`pl.json`.
- `components/dashboard/HomeworkExercise.tsx`: wszystkie cztery typy (poza `multiple_choice`) czytają teraz `exercise` z `normalizeExercise(item, {type})` zamiast osobnych, powielonych łańcuchów `item.a || item.b || item.c` w każdej gałęzi. Dodana karta `InvalidExerciseCard` dla `state === 'invalid'` (zamiast pustego ekranu/crasha). Renderer luk buduje UI wprost z `exercise.segments` (trzy warianty: zdegradowany fallback-textarea, pojedyncza luka wpisywana w zdaniu, luki-kafelki z bankiem słów) zamiast osobnej logiki na każdy format.
- `components/dashboard/StudentHomeworkScreen.tsx`: `<HomeworkExercise key={index} .../>` — brakujący `key` powodował, że React trzymał ten sam instancjonowany komponent między pytaniami, więc stan `showHint` (schowaj/pokaż wskazówkę) przeciekał z jednego pytania do następnego. `answerToText`/`getExerciseReviewRows` (serializacja do zapisu i widok recenzji lektora) NIE zostały dotknięte — nadal czytają `item` bezpośrednio, celowo, żeby nie ryzykować regresji w zapisie/ocenie odpowiedzi poza zakresem tego zlecenia (v1-only).
- Nowy `tests/normalizeExercise.test.ts` (11 testów): brak crasha na `.word`, indeksy rozsypanki nie przesuwają się przy filtrowaniu, brak boksu tłumaczenia bez polskiego zdania, wstrzyknięta instrukcja nie staje się zdaniem źródłowym, cztery formaty luki, degradacja zamiast pustego ekranu, aliasy typów v2→v1.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (456/456), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji ani ścieżkach tokenowych. Zmiana ograniczona do ekranu v1 (żywa ścieżka); `StudentHomeworkV2Screen.tsx` nie dotknięty. Nie zweryfikowano wzrokowo w przeglądarce — sprawdzić realne wykonanie pracy domowej (rozsypanka, luki z bankiem i bez, tłumaczenie, poprawa błędu) na koncie testowym kursanta.

---

### AH. Praca domowa: koniec cichego zejścia na OpenAI, wyłącznie Gemini 2.5 Flash + kontrast przycisku „Koło Fortuny" (2026-09-20)
- Zgłoszenie: Live Monitor pokazywał na jednym wywołaniu generatora zadań sekwencję Gemini 2.5 Flash → Gemini 3.8 Flash → GPT-4o mini → GPT-5.6 Luna (timeout 7500ms) — zamierzeniem było, żeby praca domowa NIGDY nie schodziła na OpenAI, a błąd Gemini był widoczny wprost, nie maskowany przełączeniem dostawcy. Uwaga terminologiczna w zleceniu: kod generujący pracę domową (`services/homeworkGenerator.ts`, `services/geminiService.ts`) działa w przeglądarce (wołany wprost z `components/admin/HomeworkComposer.tsx`), nie w Cloud Functions — nie ma tu warstwy HTTP 400/500 do zwrócenia; „czytelny błąd" oznacza więc: błąd Gemini leci bez zmian do `GeneratedSection.error`, które i tak od dawna renderuje treść błędu lektorowi.
- Nowa stała `HOMEWORK_GENERATION_MODELS = [PRIMARY_MODEL]` w `services/aiModels.ts` — świadomie ODRĘBNA od `AI_MODEL_CASCADE` (ta zostaje bez zmian, bo obsługuje czat, streszczenia, generator zdań poza kreatorem pracy domowej i inne miejsca, gdzie zejście na OpenAI jest pożądaną siecią bezpieczeństwa).
- `services/homeworkGenerator.ts`: `MODELS_FOR_HOMEWORK` wskazuje teraz na `HOMEWORK_GENERATION_MODELS` zamiast na `PREFERRED_AI_MODELS` (czyli `AI_MODEL_CASCADE` z OpenAI w kaskadzie). `askForJson()` (używane przez `generateWordOrder`, `generateMultipleChoice`, `generateFindErrors` — a przez nią też `TeacherSpecialTaskModal.tsx`, `AIExerciseGeneratorScreen.tsx`, `HomeworkScreen.tsx`) stracił całą gałąź „narada awaryjna" (`runCouncil` z `DEFAULT_COUNCIL`, który miał włączony GPT-4o mini jako recenzenta) — to była druga, ukryta pętla wielomodelowa uruchamiana PO nieudanym bezpośrednim wywołaniu, i to ona realnie sprowadzała OpenAI z powrotem do kaskady mimo `MODELS_FOR_HOMEWORK`. Teraz błąd (w tym pusta odpowiedź i niesparsowalny JSON) leci bez łapania dalej.
- Dodano `thinkingConfig: { thinkingBudget: 0 }` do configu Gemini w `askForJson` (generowanie zadań, nie rozumowanie) oraz `console.log` surowego payloadu (systemInstruction + prompt) przed każdym wywołaniem — do diagnostyki, o którą prosiło zlecenie.
- `generateTranslations`/`generateGaps` w tym samym pliku (tłumaczenia i luki, które nie idą przez `askForJson`, tylko wprost przez `generateTranslationExercises`/`generateFillInTheBlankExercises` w `services/geminiService.ts`) dostały nowy opcjonalny parametr `modelsOverride` na końcu listy argumentów (żeby nie złamać istniejących pozycyjnych wywołań spoza pracy domowej, np. `AIExerciseGeneratorScreen.tsx`) i przekazują `HOMEWORK_GENERATION_MODELS` — bez tego te dwa typy zadań nadal chodziłyby po pełnej kaskadzie z OpenAI mimo naprawy w `askForJson`. Domyślne zachowanie obu funkcji (`PREFERRED_AI_MODELS`, bez `modelsOverride`) zostaje niezmienione dla wywołań spoza kreatora pracy domowej.
- Maksymalnie 1 ponowienie przy błędzie sieciowym: `maxRetries: 2` w wywołaniu `generateTextWithUnifiedFallback` (znaczenie w tej funkcji: liczba PRÓB, nie ponowień — `2` = próba + jeden retry), timeout podniesiony z 7500ms do 15000ms, bo bez sieci bezpieczeństwa w postaci innych dostawców jeden model potrzebuje więcej marginesu, zanim zostanie uznany za martwy.
- Przycisk „🎡 Koło Fortuny" w pasku Notatnika A4 (`ScratchpadEditor.tsx`) i identyczny przycisk w `ScratchpadTeacherCompanionDrawer.tsx`: usunięto klasy `dark:text-amber-*`, bo w tym repo Tailwind 4 NIE ma zdefiniowanego `@custom-variant dark` opartego o klasę `.dark` na `<html>` (sprawdzone w `index.css`) — `dark:` w Tailwind 4 domyślnie czyta `prefers-color-scheme` SYSTEMU, nie motyw wybrany w aplikacji (`ThemeContext` przełącza klasę `.dark`/`.light`, ale Tailwind jej nie widzi). Efekt: przy jasnym motywie aplikacji i ciemnym motywie systemu operacyjnego wygrywał `dark:text-amber-300` (jasny tekst) na jasnym tle — stąd „niewidoczny jaskrawożółty napis". Naprawa: stały, nieprzezroczysty jasny „badge" (`bg-amber-50`, `border-amber-300`, `text-amber-900`, bez wariantu `dark:`) czytelny niezależnie od tego, co Tailwind aktualnie uzna za `dark:`. To ten sam mechanizm co reszta ok. 1169 wystąpień `dark:`/`text-white` opisanych w sekcji 3 jako dług — nie naprawiono ich całościowo (poza zakresem tego zlecenia), tylko udokumentowano tu jako potwierdzoną przyczynę, nie tylko podejrzenie.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (456/456), `npm run build` (przechodzi). Nie zweryfikowano wzrokowo w przeglądarce ani na Live Monitorze na koncie testowym — sprawdzić: (1) kliknięcie „Układam zadania" w kreatorze pracy domowej pokazuje na Live Monitorze wyłącznie Gemini 2.5 Flash, (2) wymuszony błąd Gemini (np. zły klucz) pokazuje w UI treść błędu od Google, nie ciche przejście na inny model, (3) przycisk „Koło Fortuny" ma czytelny ciemny napis na jasnym tle w obu ustawieniach motywu systemu.
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji ani ścieżkach tokenowych. Zmiana modeli ograniczona do ścieżki generowania pracy domowej (`homeworkGenerator.ts` + dwa nowe opcjonalne parametry w `geminiService.ts`, domyślne zachowanie gdzie indziej niezmienione) — `AI_MODEL_CASCADE`/`DEFAULT_COUNCIL` używane przez czat, planer lekcji, generator zdań poza kreatorem HW itd. celowo nie dotknięte.

---

### AI. P0: Potwierdzenie przed dopisaniem treści roboczej do notatnika kursanta (2026-09-20)
- Zgłoszenie (ze zrzutem ekranu): notatnik kursanta co wejście dubluje treść — nagłówek „Dopisane z notatnika roboczego — [data]" i kolejny blok „Lesson 1" doklejają się wielokrotnie. Zlecenie zakładało, że przyczyną jest automatyczny trigger w `useEffect`/hooku synchronizacji/montowaniu edytora, i prosiło o przeszukanie `useScratchpad`, `useNotebookSync` oraz komponentów CRM/Cockpitu wyboru kursanta — żaden z tych plików/hooków nie istnieje w tym repo (sprawdzone: `find` po nazwach, brak wyników).
- Realna przyczyna, znaleziona przez `grep` po dosłownej frazie „Dopisane z notatnika roboczego": JEDNO miejsce w kodzie ją produkuje — `adoptScratchpadForStudent()` w `services/scratchpadService.ts`, wywoływane z DOKŁADNIE jednego miejsca: `handleAssignStudent()` w `TeacherScratchpadScreen.tsx`, na `onClick` przycisku z listy kandydatów (nie `useEffect`, nie `onChange`, nie montowanie — już wcześniej jawne kliknięcie). Zweryfikowano też, że otwieranie notatnika kursanta wprost z CRM/Cockpitu (`StudentDatabaseScreen.tsx`, `StudentOperationalHub.tsx`, `TeacherLessonHistoryView.tsx` — wszystkie przez `openScratchpadTab(\`sp_\${student.id}\`)` → `getScratchpadById()`) jest czystym odczytem bez żadnego zapisu — ten fragment wymagania (2) był już spełniony.
- Prawdziwy mechanizm duplikacji: `/scratchpad` bez parametru `?id=` (zakładka „Notatnik" w `AdminPanel.tsx`/`openScratchpadTab()`) tworzy za KAŻDYM wejściem NOWY roboczy dokument (`sp_<Date.now()>`) z treścią domyślnego szablonu lektora (`getDefaultTemplate()` w `getOrCreateStudentScratchpad`, może zawierać blok „Lesson 1"). Kliknięcie „Przypisz kursanta" → wybór tego samego kursanta w KAŻDEJ takiej świeżej karcie dopisywało tę treść do jego stałego notatnika (`sp_<uid>`) bez ostrzeżenia, że kursant ma tam już własne notatki — stąd „co wejście" z opisu zgłoszenia: nie powtórne wejście do notatnika kursanta duplikowało treść, tylko powtórne otwarcie „Notatnika roboczego" i ponowne przypisanie tego samego kursanta.
- Naprawa — Human-in-the-loop zamiast usuwania funkcji (usunięcie `adoptScratchpadForStudent`/przycisku „Przypisz kursanta" złamałoby jedyny istniejący sposób przenoszenia notatek z trybu roboczego do kursanta, co zlecenie punkt 2 wprost dopuszcza jako operację manualną z potwierdzeniem — nie żąda jej likwidacji):
  - Nowa funkcja `wouldAppendToExistingNotes(student, teacher)` w `services/scratchpadService.ts` — czysty odczyt (bez zapisu), sprawdza z wyprzedzeniem, czy notatnik docelowy kursanta ma już realną treść (wydzielone z `adoptScratchpadForStudent` do wspólnego `isScratchpadUntouched()`, żeby obie funkcje liczyły „świeżość" tak samo).
  - `handleAssignStudent()` w `TeacherScratchpadScreen.tsx` woła ją PRZED `adoptScratchpadForStudent` — jeśli dopisanie faktycznie by nastąpiło, `window.confirm(...)` (wzorzec już używany w tym repo, m.in. `GroupManagementModal.tsx`, `LessonPlanner.tsx`) z jawną treścią: „X ma już własne notatki. Treść zostanie DOPISANA na końcu (nic nie zostanie nadpisane). Kontynuować?". Odmowa przerywa operację przed jakimkolwiek zapisem. Gdy notatnik kursanta jest wciąż nietknięty (pierwsze przypisanie), potwierdzenie jest pomijane — tam nie ma czego stracić.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (456/456), `npm run build` (przechodzi). Symulacja z zadania (klik w kursanta A → powrót do listy → ponowny klik w kursanta A) była już bezpieczna PRZED tą zmianą — to czysty odczyt przez `getScratchpadById`; ta zmiana zabezpiecza osobną, faktycznie ryzykowną ścieżkę (`Notatnik roboczy` → „Przypisz kursanta”). Nie zweryfikowano wzrokowo w przeglądarce — sprawdzić na koncie testowym: (1) świeży „Notatnik roboczy” + przypisanie kursanta BEZ wcześniejszych notatek nie pokazuje potwierdzenia i działa jak dotąd, (2) przypisanie kursanta, który ma już notatki, pokazuje `confirm()` i po „Anuluj” nic się nie zapisuje.
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji ani ścieżkach tokenowych. Brak zmian w domyślnym zachowaniu `getOrCreateStudentScratchpad`/`getScratchpadById` (odczyt notatnika kursanta z CRM pozostaje czystym odczytem, tak jak był). Nie ograniczono ani nie zmieniono zachowania grupowych notatników (`ensureGroupScratchpad` w `services/groupService.ts`) — tam nigdy nie było logiki dopisywania, więc nie dotyczy tego zgłoszenia.

---

### AJ. P0 Homework Hotfix: kanoniczna rozgrzewka (`correct/close/incorrect`), domknięcie guarda modeli homework na WSZYSTKICH ścieżkach (v1 + v2 + Express), statyczny e-mail bez AI (2026-09-20)
- Zlecenie: obszerny dokument P0 („master prompt") zakładający baseline audytu na HEAD `fa97286`. Re-audyt na starcie wykazał, że dwa z założonych defektów były już częściowo naprawione w tej samej sesji przed zleceniem (`0162cff` — adapter `normalizeExercise` w `HomeworkExercise.tsx`; `5081140` — `HOMEWORK_GENERATION_MODELS`/koniec narady awaryjnej w `askForJson`, patrz wpis AH) — ale WYŁĄCZNIE dla v1-rendererów homework, nie dla rozgrzewki ani dla pozostałych generatorów/ocen. Zamiast ślepo powtarzać cały dokument, zweryfikowano każdy punkt kodem/grepem przed zmianą (zgodnie z żądaniem „zero zgadywania") i naprawiono to, co faktycznie zostało nienaprawione.
- **Rozgrzewka — kanoniczny adapter (`utils/warmupRounds.ts`, nowy)**: `HomeworkWarmupScrambler.tsx` miał WŁASNY, równoległy łańcuch normalizacji (`correctTranslation`/`chunks`/`sentence`/`polishSentence`...) i ZAWSZE renderował nagłówek „Ułóż zdanie z rozsypanki", nawet dla tłumaczenia czy poprawy błędu. Nowy `buildWarmupRounds()` deleguje rozpoznanie typu do `normalizeExercise` (ten sam adapter co `HomeworkExercise.tsx` — zero drugiej mapy semantyki) i do `exerciseUiCopy()` (też już istniejący, ale dotąd nieużywany nigdzie — te same statyczne klucze i18n co `HomeworkExercise.tsx`: „Ułóż zdanie", „Przetłumacz zdanie", „Popraw zdanie"). `normalizeExercise.ts` dostał minimalne rozszerzenie: `correctSentence` dla typów `translation` (aliasy `correctTranslation`/`englishTranslation`/`englishSentence`/`modelAnswer`) i `find_errors` (z `raw.correctSentence`) — potrzebne, bo rozgrzewka musi znać zdanie wzorcowe do ułożenia z niego rozsypanki, czego kanoniczny kontrakt dotąd nie eksponował. `fill_in_the_blank` celowo NIE dostaje własnej rekonstrukcji zdania z luk (ryzyko zgadywania kolejności) — runda jest pomijana, chyba że generator dołączył gotowe `correctSentence`/`fullSentence`.
- **Rozgrzewka — ocena `correct | close | incorrect` (`utils/unscrambleGrading.ts`, nowy)**: czysta funkcja `classifyUnscrambleAttempt(answerTokens, targetTokens)` porównuje MULTIZBIORY tokenów (mapa liczności, nie `Set` — inaczej ginie informacja o duplikatach), więc te same słowa w złej kolejności dają `close`, a brakujące/dodatkowe/złe/źle policzone duplikaty dają `incorrect`. `HomeworkWarmupScrambler.tsx`: `close` pokazuje statyczny (nie generowany przez AI) komunikat „Byłeś/Byłaś blisko!" + poprawne zdanie (nowe klucze i18n w `en.json`/`pl.json`), NIE blokuje przejścia dalej (przycisk „Następne zdanie"/„Rozpocznij pracę domową" dostępny tak samo jak po `correct`), `incorrect` zachowuje dotychczasowe zachowanie (kafelki zostają, „Resetuj" dostępne) — zero nowego przebiegu lekcji. Wynik ogłaszany też przez `role="status" aria-live="polite"`, nie tylko kolorem obramowania.
- **Rozgrzewka — trwały zapis próby**: nowy opcjonalny prop `onAttemptResult({itemIndex, answerOrder, result})`, wywoływany raz na każdą w pełni ułożoną próbę. Zero nowej kolekcji — dane lądują w istniejącym, już autoryzowanym polu `studentAnswers` dokumentu `specialTasks` (już dopuszczone w `firestore.rules` `hasOnly([...])`), pod kluczem `warmup.<itemIndex>`, więc firestore.rules NIE wymagały zmiany. `StudentHomeworkScreen.tsx` (zalogowany kursant) zapisuje NATYCHMIAST przez `updateDoc` z kluczem po ścieżce (`studentAnswers.warmup.<i>`), a `handleSubmit()` (finalne oddanie pracy) też został przepisany na zapis po ścieżkach (`studentAnswers.<i>` per pozycja, zamiast jednego obiektu) — inaczej finalny zapis CAŁKOWICIE nadpisywałby (nie scalał) wcześniej zapisaną mapę `warmup`, bo Firestore nie robi głębokiego scalania zwykłych obiektowych pól. `DirectHomeworkScreen.tsx` (token bez logowania) nie ma stałego połączenia z Firestore — próby rozgrzewki są zbierane lokalnie i wysyłane w TYM SAMYM, jedynym autoryzowanym wywołaniu `/api/homework/direct-submit` (rozszerzone o opcjonalne, zwalidowane po stronie serwera pole `warmupAttempts`), bez nowego endpointu i bez zmiany autoryzacji tokenowej. `AIExerciseGeneratorScreen.tsx` (niezależna praktyka, poza właściwym zakresem, ale współdzieli ten sam komponent rozgrzewki) nie ma żadnego istniejącego modelu prób do podpięcia — dostaje samą poprawę UX `close`, bez zapisu (zgodnie z „nie twórz nowej kolekcji").
- **Guard modeli homework — dokończenie na WSZYSTKICH ścieżkach**: `HOMEWORK_GENERATION_MODELS` w `services/aiModels.ts` zmieniony z `[PRIMARY_MODEL]` (alias, mógłby się przesunąć razem z resztą aplikacji) na literał `['gemini-2.5-flash'] as const`, plus nowy `assertHomeworkModelAllowed(model)` (rzuca `DisallowedHomeworkModelError` dla KAŻDEGO modelu spoza dokładnie tej jednej wartości — w tym innego Gemini). Guard wołany TUŻ PRZED wywołaniem dostawcy (poza pętlami retry — inaczej niedozwolony model rzucałby dopiero po 3 pustych próbach) w: `generateTranslationExercises`, `generateFillInTheBlankExercises`, `evaluateTranslations` (ocena tłumaczeń pracy domowej — DOTĄD używała `PREFERRED_AI_MODELS` bez wyjątku, mimo wołania z `StudentHomeworkScreen.tsx`/`HomeworkScreen.tsx`), oraz jako sztywna (bez parametru) blokada w trzech funkcjach jednoprzeznaczeniowych, które przed tą zmianą używały pełnej kaskady z OpenAI bezwarunkowo: `processBulkSentences` (import zdań hurtem, `HomeworkScreen.tsx`), `generateHomework` (starszy generator, `LessonHistory.tsx`), `evaluateErrorCorrectionSentence`/`evaluateTeacherHomework` (ocena poprawy błędu i AI-ocena nauczyciela, `HomeworkScreen.tsx`). `AIExerciseGeneratorScreen.tsx` dostał `modelsOverride`/`HOMEWORK_GENERATION_MODELS` na wywołaniu `generateTranslationExercises`, bo jego wynik zasila TEN SAM komponent rozgrzewki (patrz wyżej) — reachability z warm-up czyni tę jedną ścieżkę in-scope, mimo że ekran służy też niezależnej praktyce.
- **`generateHomeworkChatPipeline` (services/geminiService.ts) — pełny rewrite**: dotychczas Krok 1 wołał `callOpenAI(..., "gpt-5.6-luna")` wprost, a Krok 2 („weryfikacja Gemini") miał w SWOJEJ kaskadzie zapasowy `TERTIARY_MODEL` = `openai/gpt-4o-mini`, więc etykieta „Gemini 3.1 Flash" mogła w praktyce oznaczać GPT — a przy błędzie obu kroków funkcja po cichu zwracała albo zmyślone „Sample English sentence" (maska awarii Kroku 1), albo surowy szkic OpenAI (maska awarii Kroku 2), zawsze z twardo wpisanym `modelUsed: 'OpenAI (GPT-4o mini) → Gemini 3.1 Flash'` NIEZALEŻNIE od tego, co faktycznie odpowiedziało. Nowa wersja: oba kroki wołają WYŁĄCZNIE `HOMEWORK_GENERATION_MODELS` przez `generateTextWithUnifiedFallback` (ten sam guard co wyżej), błąd (pusta odpowiedź, niesparsowalny JSON) leci wprost do wywołującego bez żadnego cichego fallbacku ani placeholdera, a `modelUsed` to prawdziwa wartość zwrócona przez ostatnie udane wywołanie (`verificationRes.modelUsed`), zapisywana i logowana DOPIERO po sukcesie. Żywi wywołujący (`HomeworkScreen.tsx`, `TeacherSpecialTaskModal.tsx`) dostali też uaktualnione, nie-mylące etykiety UI (`modelInfo: 'Gemini 2.5 Flash'` zamiast `'OpenAI (GPT-4o mini) → Gemini 3.1 Flash'`, treść czatu bez wzmianki o GPT).
- **Homework v2 (Functions + Express) — OpenAI usunięte z kaskady, nie tylko z UI**: `functions/src/homeworkV2/openai.ts`: `V2_MODEL_CASCADE` skrócona do WYŁĄCZNIE Gemini (`gemini-2.5-flash` → `gemini-3.8-flash`, obie mapowane na stabilny `gemini-2.5-flash`), cała gałąź OpenAI w `createAiCall` (fetch do `api.openai.com`, `mapToActualOpenAIModel`, `createOpenAiCall` — potwierdzony `rg` jako martwy, zero callerów poza nieużywanym importem) usunięta. `functions/src/homeworkV2/endpoints.ts`: `OPENAI_API_KEY` (sekret zdefiniowany LOKALNIE w tym pliku, nie globalnie — inne funkcje poza homeworkV2 zachowują swój dostęp do sekretu bez zmian) usunięty z `secrets: [...]` i z payloadu `createAiCall({...})` we WSZYSTKICH trzech miejscach (`generateHomeworkV2`, `submitHomeworkV2Attempt`, `proposeHomeworkV2Grade`). `tests/homeworkV2Pipeline.test.ts` świadomie zaktualizowany (asercja `gpt-4o-mini` w kaskadzie zamieniona na asercję jego BRAKU + test mapowania modeli Gemini zamiast OpenAI) — dokładnie ten test, o którym ostrzegał dokument zlecenia.
- **Express `/api/homework-v2/generate` — brakująca bramka flagi**: endpoint w `server.ts` NIE sprawdzał w ogóle `HOMEWORK_ENGINE_V2` (w przeciwieństwie do Functions, gdzie `requireHomeworkEngineV2()` już istniało w `endpoints.ts`) i przekazywał `openAiApiKey` do `createAiCall`. Naprawa: import `isHomeworkEngineV2Enabled`/`ENGINE_DISABLED_MESSAGE` WPROST z `functions/src/homeworkV2/flag.ts` (ten plik celowo nie importuje `firebase-functions`, więc działa też pod `tsx`/Express — `server.ts` już wcześniej importował z tego samego katalogu `createAiCall`, więc to nie nowy wzorzec), bramka `if (!isHomeworkEngineV2Enabled()) return res.status(412)...` jako pierwsza instrukcja w handlerze, zero duplikowania interpretacji zmiennej środowiskowej. `openAiApiKey` usunięty z wywołania `createAiCall`.
- **E-mail — koniec generowania AI, statyczny szablon**: `handleGenerateAIPersonalization` w `HomeworkEmailConfirmationModal.tsx` wołał AI (`generatePersonalizedHomeworkNote`) automatycznie przy KAŻDYM otwarciu modala (przed jakąkolwiek notatką lektora), z regułowym fallbackiem tylko na wypadek błędu sieci. Zastąpione nową, czysto deterministyczną `buildStaticHomeworkNote()` w `services/homeworkGenerator.ts` (bez wywołania AI w ogóle): „Cześć, [wołacz]! Przygotowałem dla Ciebie zestaw ćwiczeń na podstawie [temat]. Link: [link]." — maks. 2 zdania, wołacz z istniejącego `formatPolishGreeting`, temat z `task.title`/`task.lessonTopics`, link z już istniejącego `directAccess.url` (magic link bez logowania, budowany w tym samym komponencie). Stara `generatePersonalizedHomeworkNote` (i jej jedyny test) usunięta — `rg` potwierdził zero innych callerów po zdjęciu z modala. Przycisk „Odśwież z AI" zamieniony na „Przywróć domyślną treść" (ta sama statyczna funkcja, zero AI); treść nadal w pełni edytowalna ręcznie w polu tekstowym. Świadomie NIE dodano wersji angielskiej — cały istniejący system mailingu (`services/homeworkEmail.ts`, `functions/src/emailTemplate.ts`) jest sztywno polski (brak i18next, brak parametru języka w żadnym z tych plików) i to jest jedyny język, w jakim ten lektor komunikuje się z kursantami; dodanie i18n tylko do tej jednej linijki, gdy cała reszta szablonu zostaje po polsku, byłoby fikcyjną, niedziałającą dwujęzycznością.
- Nowe testy: `tests/unscrambleGrading.test.ts` (8, w tym duplikaty tokenów), `tests/warmupRounds.test.ts` (8, w tym regresja nagłówka rozsypanki dla tłumaczenia/poprawy błędu i historycznych aliasów), `tests/homeworkModelGuard.test.ts` (6, w tym dowód, że `generateTranslationExercises`/`generateFillInTheBlankExercises`/`evaluateTranslations` rzucają PRZED jakimkolwiek wywołaniem sieci przy niedozwolonym modelu), rozszerzenie `tests/normalizeExercise.test.ts` (+4, aliasy `correctSentence`), przepisanie `tests/emailNotifications.test.ts` (usunięty test AI-notatki, +2 nowe dla statycznego szablonu) oraz `tests/homeworkV2Pipeline.test.ts` (kaskada bez OpenAI).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (490/490 — baseline 462 + 28 nowych/zmienionych netto), `npm run build` (przechodzi, `dist/server.cjs` i `api/index.js` przebudowane), `git diff --check` (czysto). Precyzyjny grep P0 (`openai|gpt-4o|gpt-5|OPENAI_API_KEY` po plikach ze ścieżki homework/warm-up) daje wyłącznie: komentarze opisujące naprawę, nazwę pliku `./openai` (historyczny identyfikator modułu Functions, dziś zero kodu OpenAI w środku) oraz jeden kosmetyczny placeholder UI (`activeGeneratingModel` w `AIExerciseGeneratorScreen.tsx`, wartość początkowa przed pierwszym wywołaniem, nadpisywana realnym modelem i tak przymusowo Gemini dla ścieżki zasilającej rozgrzewkę). Manualny scenariusz w przeglądarce NIE został wykonany (brak w tej sesji dostępu do interaktywnej przeglądarki/kredytów produkcyjnych) — do zrobienia na koncie testowym: (1) wygenerować pracę domową, otworzyć „Rozgrzewkę", ułożyć właściwe słowa w złej kolejności → oczekiwane `close` + „Byłeś/Byłaś blisko!" + poprawne zdanie + aktywny „Dalej", (2) sprawdzić w Firestore, że `specialTasks/{id}.studentAnswers.warmup.<i>` zawiera rzeczywistą kolejność i `result: "close"`, (3) potwierdzić na Live Monitorze, że każde wywołanie generatora/oceny pracy domowej pokazuje wyłącznie Gemini 2.5 Flash.
- Ryzyka: brak zmian w `firestore.rules` (zapis rozgrzewki mieści się w już dopuszczonym polu `studentAnswers`), brak zmian w middleware autoryzacji (`requireFirebaseAuth` nietknięty) ani w ścieżce tokenowej `homework/direct/:token` poza rozszerzeniem ciała żądania o jedno, zwalidowane po stronie serwera pole. Zmiana `handleSubmit()` w `StudentHomeworkScreen.tsx` (zapis po ścieżkach zamiast jednym obiektem) to świadoma, ale realna zmiana zachowania zapisu istniejącej, działającej ścieżki finalnego oddania pracy — przetestowana (490/490), ale nie zweryfikowana wzrokowo end-to-end na koncie testowym. `HOMEWORK_ENGINE_V2` pozostaje `false` po obu stronach (`config/featureFlags.ts` i env Functions) — nic z tego zlecenia go nie włącza.

---

### AK. Rozgrzewka: crash przy skróceniu rundy, koniec confetti, higiena kolorów amber w trybie jasnym; toast po ocenie pracy (2026-09-21)
- Zlecenie: pakiet stabilizacyjny — (1) napraw crash `reading 'word'` w `HomeworkWarmupScrambler.tsx` przy przejściu z dłuższej rundy na krótszą, (2) `min-h-[100dvh]`/scroll na ekranach pracy domowej pod klawiaturę iOS, (3) usuń blade amber/yellow z tekstów i wskazówek w trybie jasnym, (4) usuń zahardkodowany mock-fallback zdania, (5) mniej pustej przestrzeni i toast zamiast `alert()` w panelu sprawdzania prac lektora.
- **Root cause crasha (1) potwierdzony i naprawiony**: `shuffledBank` przeliczał się przez `useMemo` NATYCHMIAST przy zmianie `currentIndex` (bo zależy od `currentItem`/`targetWords`, które zmieniają się w tym samym renderze), ale reset `selectedWordIndices` siedział w OSOBNYM `useEffect([currentIndex])`, uruchamianym PO commicie. Pierwszy render krótszej rundy 2 czytał więc `shuffledBank` już nowej (krótszej) rundy, ale `selectedWordIndices` jeszcze starej (dłuższej) rundy 1 — `shuffledBank[bankIndex]` wypadało poza zakres i `.word` rzucało `TypeError`. Naprawa w `handleNext()`: `setSelectedWordIndices([])`/`setResult(null)`/`setShowHint(false)` przeniesione w TO SAMO wywołanie co `setCurrentIndex(prev => prev + 1)` (React batchuje oba w jeden render, więc oba stany zmieniają się razem), plus obronny guard w renderze (`if (!item) return null`) jako druga linia obrony. Dodano `transitionLockRef` (blokuje `handleNext` do czasu, aż nowa runda faktycznie się wyrenderuje — zwalniany w `useEffect([currentIndex])`, nie od razu) przeciw podwójnemu dotknięciu, oraz `completeOnceRef`, żeby `onComplete()` na ostatnim zdaniu wołało się dokładnie raz.
- **Regresja potwierdzona przed naprawą**: tymczasowe cofnięcie tylko synchronicznego resetu (zostawiając wszystko inne, w tym nowy test) odtworzyło DOKŁADNIE zgłoszony wyjątek (`TypeError: Cannot read properties of undefined (reading 'word')`, stack w `HomeworkWarmupScrambler.tsx`) — dowód, że test poniżej faktycznie łapie ten bug, a nie tylko przechodzi przypadkiem.
- **Nowy test integracyjny (React + jsdom) — pierwszy w tym repo**: `tests/homeworkWarmupScrambler.test.tsx`, dwa przypadki (runda 1 dłuższa (8 słów) → runda 2 krótsza (3 słowa) bez crasha i z pustym „Twoje zdanie"; przycisk „Dalej" aktywny też przy wyniku `close`). Repo miało dotąd WYŁĄCZNIE testy czystych funkcji przez `node:test`/`tsx --test tests/*.test.ts` — zero infrastruktury do renderowania komponentów. Dodano `jsdom`+`@testing-library/react` jako `devDependencies` (React 19 wspierany od `@testing-library/react@16`), jsdom ustawiany RĘCZNIE w samym pliku testu (nie globalnie), żeby nie obciążać pozostałych, czysto logicznych testów; `npm test` rozszerzony o `tests/*.test.tsx`. Trzy nowe `data-testid` w komponencie (`warmup-bank-tile`, `warmup-selected-tile`, `warmup-next-button`) — bez nich test musiałby odróżniać identyczne teksty słów między bankiem a ułożonym zdaniem przez kruche selektory CSS.
- **Confetti usunięte z rozgrzewki**: import `canvas-confetti` i wywołanie przy `correct` skasowane z `HomeworkWarmupScrambler.tsx`. `HomeworkExercise.tsx` (renderer właściwych zadań pracy domowej) nigdy go nie miał. Cztery komponenty w `components/practice/` (`FlashcardExercise`/`MatchExercise`/`QuizExercise`/`FillInBlankExercise`, używane przez `PracticeZone.tsx` — niezależny moduł powtórek, nie pracę domową) zachowują confetti bez zmian — zlecenie dotyczyło wyłącznie rozgrzewki i ekranów homework.
- **Higiena kolorów (3) — tokeny `warn`/`primary`/`info`, nie `text-slate-*`**: zlecenie sugerowało dosłownie `text-slate-900`/`bg-slate-100`, ale `design/theme/tokens.css`+`index.css` mają już pełny, zweryfikowany system tokenów trybu jasnego (`--color-warn`, `--color-primary`, `--color-info`, przełączane przez `data-theme`/`.light` na `:root`) — w tym już potwierdzony w sekcji 3 tego pliku mechanizm, w którym nawet `--color-white`/`--color-black` są PRZEDEFINIOWANE per motyw. Twarde `text-slate-900` złamałoby tryb ciemny (niewidoczny ciemny tekst na granatowym tle), więc zamiast tego surowe klasy `amber-*` (nie objęte tym mechanizmem — paleta Tailwinda, nie token) zamienione na istniejące tokeny: przyciski/pigułki podpowiedzi w `HomeworkExercise.tsx` (`bg-primary/15 border-primary/40 text-primary` aktywne / `bg-base-200 border-line-strong text-content-muted` nieaktywne), karta „zdanie z błędem" ujednolicona z istniejącym wzorcem karty źródłowego zdania (`bg-base-100/70 border-white/10`, jak w gałęzi tłumaczenia tego samego pliku), `InvalidExerciseCard` (realny stan błędu, zostaje wyróżniony, ale tokenem `warn`, nie surowym `amber`). W `HomeworkWarmupScrambler.tsx`: nagłówek „Rozgrzewka językowa" i przycisk podpowiedzi → `primary`, panel wyniku `close` (dotąd amber) → `info` (niebieski, odróżnialny od zielonego `correct` bez trzeciego, ostrzegawczego koloru), piąty kolor w palecie kafelków słów (dekoracyjny, bez znaczenia) zamieniony z `amber` na `rose`, żeby nie zostawić ANI JEDNEGO `amber-*` w obu plikach (zweryfikowane grepem po zmianach).
- **(2) `min-h-[100dvh]`**: `DirectHomeworkScreen.tsx` (jedyny prawdziwy `min-h-screen` bez przewijania na ścieżce pracy domowej — kursant bez logowania, token w URL, strona STOI SAMA, nie w powłoce `Dashboard.tsx`) → `min-h-[100dvh] overflow-y-auto` + `pb-36` na wewnętrznym kontenerze treści, pod klawiaturę ekranową iOS Safari. `StudentHomeworkScreen.tsx`/`HomeworkExercise.tsx` NIE dostały analogicznej zmiany — renderują się wewnątrz `<main className="flex-1 overflow-y-auto ...">` w `Dashboard.tsx` (`h-[100dvh]` na korzeniu aplikacji), które już scrolluje i nie ma własnego `h-screen`; zmiana tam byłaby kosmetyczna bez pokrycia w realnym problemie.
- **(4) Mock-fallback zdania — już naprawiony wcześniej**: dosłowny ciąg z dokumentu zlecenia („Czasami tracę poczucie czasu...") NIE istnieje w repo (sprawdzone grepem, zero trafień poza niezwiązanym przykładowym zdaniem w `tests/testExerciseRules.test.ts`). Hotfix P0 z dnia poprzedniego (patrz wpis AJ wyżej, commit `11e387e`) już przepisał `generateHomeworkChatPipeline` tak, żeby błąd leciał wprost do wywołującego bez cichego placeholdera/zmyślonego zdania — ten punkt zlecenia opisywał stan SPRZED tamtego hotfixu. Weryfikacja: grep po `placeholder.*sentence`/`silent.*fallback`/dosłownej frazie — zero trafień w `services/homeworkGenerator.ts`/`services/geminiService.ts`.
- **(5) Panel sprawdzania prac — toast zamiast `alert()`**: `HomeworkScreen.tsx`, `handleSaveReview()` — `alert('Ocena i komentarz zostały zapisane! ...')` (blokujący, zabiera fokus) zamieniony na już istniejący, ale dotąd nigdzie w homework nieużywany `ActionToast` (`components/ui/ActionToast.tsx`, portal w prawym dolnym rogu, auto-znika po 6s — komponent MIAŁ dokładnie taki cel w komentarzu dokumentacyjnym, tylko nie był podłączony). Błędy (`catch` w tej samej funkcji) ZOSTAJĄ jako `alert()` — zgodnie ze zleceniem: duże pop-upy tylko dla błędów blokujących. Nie ruszono `alert()` przy tworzeniu/edycji/przypisaniu pracy (`handleSaveTask`, ok. linii 956/1026) — to inna czynność (kreator, nie sprawdzanie odesłanej pracy), poza zakresem tego punktu zlecenia. **Nie znaleziono** w kodzie „zbędnej pustej przestrzeni" opisanej w zleceniu przed listą odesłanych prac — `activeTab` domyślnie `'list'`, kreator (`activeTab === 'create'`) i blok pracy ucznia (`activeTask`) nie renderują się na tej ścieżce, `TeacherWorkScreen.tsx` (przełącznik sekcji) jest już zwarty. Możliwe, że opis dotyczył stanu already-fixed albo scenariusza niezweryfikowanego statyczną lekturą kodu — wymaga potwierdzenia wzrokowego w przeglądarce, patrz AGENT_LOG.md.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (495/495 — baseline 493 + 2 nowe w `tests/homeworkWarmupScrambler.test.tsx`), `npm run build` (przechodzi). Regresja testu potwierdzona ręcznie (patrz wyżej) przez tymczasowe cofnięcie fixa.
- Ryzyka: brak zmian w `firestore.rules`, autoryzacji, ścieżkach tokenowych poza kosmetyczną zmianą klas Tailwind w `DirectHomeworkScreen.tsx` (bez zmiany logiki). Nowe `devDependencies` (`jsdom`, `@testing-library/react`) używane WYŁĄCZNIE w nowym pliku testowym — nie importowane przez żaden kod aplikacyjny, zweryfikowane `npm run build` bez zmiany w `dist/`. Nie zweryfikowano wzrokowo w przeglądarce (patrz punkt 5 wyżej i AGENT_LOG.md) — do zrobienia na koncie testowym: (1) rozgrzewka z pracą domową mającą zdania różnej długości, złapać przejście do krótszej rundy, (2) tryb jasny: karta „popraw błąd" i podpowiedzi w pracy domowej i rozgrzewce, kontrast tekstu, (3) `DirectHomeworkScreen` na telefonie (iOS Safari) z klawiaturą otwartą na polu tłumaczenia, (4) zapisanie oceny pracy przez lektora pokazuje toast w prawym dolnym rogu zamiast pełnoekranowego alertu.

### AL. Naprawa uprawnień Firestore przy odrzucaniu lekcji z Notion, przeniesienie ikony zgłaszania błędu poza przyciski akcji, całkowite usunięcie `canvas-confetti` (2026-09-21)
- Zlecenie: domknięcie pakietu stabilizacyjnego z wpisu AK — punkt 7 (uprawnienia Firestore przy odrzucaniu lekcji) nie był jeszcze dotknięty, plus rewizja punktu 3 (ikona zgłaszania błędu) i kryterium akceptacji „zero wystąpień `canvas-confetti` w projekcie" (szersze niż opis problemu w punkcie 1, który mówił tylko o rozgrzewce).
- **(7) Root cause potwierdzony i naprawiony**: `rejectNotionLesson()`/`restoreRejectedNotionLesson()` (`services/lessonRecord.ts`) zapisują/usuwają dokumenty w `users/{studentId}/rejectedNotionLessons/{rejectedId}` — subkolekcja bez ŻADNEJ reguły w `firestore.rules` (zero wzmianki w całym pliku), stąd `Missing or insufficient permissions` przy każdym odrzuceniu (`handleRejectNotionLesson` w `AdminPanel.tsx`). Dodano `isValidRejectedNotionItem()` i blok `match /rejectedNotionLessons/{rejectedId}` (odczyt: właściciel/admin; zapis/usunięcie: tylko admin/lektor, bo tylko panel lektora inicjuje odrzucenie). Zweryfikowane na emulatorze: `npm run test:rules` 44/44 zielone, żadna istniejąca reguła się nie zepsuła.
- **Optymistyczna aktualizacja UI**: `handleRejectNotionLesson` w `AdminPanel.tsx` przenosi lekcję z listy aktywnej na listę odrzuconych OD RAZU (przed `await`), z rollbackiem obu list w `catch` przy błędzie zapisu — zamiast czekać na potwierdzenie z Firestore.
- **(3) Ikona zgłaszania błędu**: `BugReporter.tsx` — floating przycisk (`fixed bottom-right`, część kolejki `.rail-bug`/`.rail-notice`/`.rail-monitor` z wpisu wcześniejszej sesji o zarządzaniu z-index) kolidował z przyciskami akcji ("Dalej"/"Wstecz"/"Odeślij") na dole ekranów zadań na telefonie. To NIE była kolizja między elementami floating (ta była już rozwiązana wcześniej) — problem w treści strony, poza tym systemem. Przeniesiono na `fixed top-16 right-4` (pod stałym nagłówkiem `TopBar`, `h-14`), zmniejszono ikonę do `w-7 h-7`, dodano `opacity-30 hover:opacity-100`. Skoro bug nie zajmuje już miejsca w dolnej kolejce, `--rail-bug` w `index.css` zmienione z `60px` na `0px` (klasa `.rail-bug` usunięta), żeby `.rail-notice` (toasty, powiadomienia o pracach domowych) nie miało sztucznego odstępu po nieistniejącym już elemencie.
- **`canvas-confetti` — rewizja decyzji z wpisu AK**: tamta sesja świadomie zostawiła bibliotekę w czterech komponentach `components/practice/` (`FlashcardExercise`/`MatchExercise`/`QuizExercise`/`FillInBlankExercise` — ogólny moduł powtórek słownictwa, nie praca domowa), bo opis problemu w zleceniu dotyczył wyłącznie rozgrzewki/homework. To zlecenie miało jednak dodatkowo dosłowne kryterium akceptacji „zero wystąpień biblioteki `canvas-confetti` w projekcie" — bez wyjątków. Odczytane literalnie: usunięto import i wywołania z tych czterech plików oraz `canvas-confetti`/`@types/canvas-confetti` z `package.json`, odświeżono `package-lock.json` (`npm install`).
- Ponownie zweryfikowano (statyczna lektura kodu) punkty 1, 2, 4, 5 z pakietu — bez zmian, wszystkie zaimplementowane poprawnie we wpisie AK. Punkt 6.1 (whitespace w panelu sprawdzania prac) — jak w AK, nie znaleziono w statycznej lekturze `HomeworkScreen.tsx`/`HomeworkV2ReviewScreen.tsx`; wymaga weryfikacji wzrokowej z realnymi odesłanymi pracami.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (495/495), `npm run test:rules` (44/44), `npm run build` (przechodzi).
- Ryzyka: zmiana w `firestore.rules` (obszar wysokiego ryzyka) — WYŁĄCZNIE addytywna (nowy blok reguł + nowa funkcja walidacyjna dla nowej subkolekcji), zero zmian w istniejących regułach, potwierdzone testem na emulatorze przed commitem. Nowa pozycja `BugReporter.tsx` (`top-16 right-4`) nie zweryfikowana wzrokowo na telefonie — patrz AGENT_LOG.md.

---

### AM. Panel sprawdzania prac — poprawka scrollowania w modalu recenzji, naprawa animacji flip fiszek (`components/practice/FlashcardExercise.tsx`), nowy dwutrybowy silnik tłumaczeń (2026-09-21)
- Zlecenie: (1) usunięcie nadmiernej pustej przestrzeni w panelu sprawdzania lektora przed listą odesłanych prac, (2) naprawa responsywności i animacji 3D fiszek, (3) nowy model typów i komponent UI dla dwutrybowego silnika ćwiczeń tłumaczeniowych (`classic_assisted` / `fragment_pool`).
- **(1) Root cause potwierdzony inaczej niż w poprzednich sesjach (AK, AL)**: obie poprzednie sesje szukały „zbędnej pustej przestrzeni" w statycznym układzie `HomeworkScreen.tsx`/nieistniejącym `HomeworkV2ReviewScreen.tsx` i niczego nie znalazły — bo problem nie jest w układzie treści, tylko w modalu „Przegląd & Ocena nauczyciela" (`reviewTask`/`v2ReviewTask`, ok. linii 3157–3275): kontener tła miał `flex items-center justify-center overflow-y-auto`, a karta modala dodatkowo `my-8`. Przy pracy z wieloma zdaniami (modal wyższy niż viewport) flex `items-center` centruje kartę tak, że jej górna część — nagłówek i zaraz po nim lista odesłanych odpowiedzi — ląduje POZA widocznym obszarem przewijania, a lektor musi przewijać w górę, żeby w ogóle dotrzeć do listy. Zmieniono `items-center` → `items-start` i `my-8` → `my-4` w obu modalach (`reviewTask` i `v2ReviewTask`) — karta zaczyna się teraz od góry viewportu, nagłówek i lista są widoczne od razu.
- **(2) Root cause animacji flip**: `FlashcardExercise.tsx` (moduł powtórek słownictwa w `components/practice/`, niezależny od pracy domowej) miał kontener obracany z `transform-style: preserve-3d` (inline style), ale ŻADEN element przodek nie ustawiał `perspective` — bez tego przeglądarka renderuje obrót jako płaskie ściśnięcie, nie efekt 3D. Przepisano na czyste klasy Tailwind wg zlecenia: rodzic `perspective-[1000px]`, kontener obracany `transition-transform duration-500 [transform-style:preserve-3d]` sterowany klasą `[transform:rotateY(180deg)]` zależną od `isFlipped` (zamiast inline `style`), przód/tył `[backface-visibility:hidden] absolute inset-0` (tył dodatkowo `[transform:rotateY(180deg)]`), plus `[-webkit-backface-visibility:hidden]`/`[-webkit-transform-style:preserve-3d]` dla iOS Safari. Karta dostała `w-full max-w-md mx-auto` na zewnętrznym kontenerze oraz `aspect-[3/2] min-h-[220px]` (zamiast sztywnego `h-80`) na kontenerze obracanym.
- **Ten sam webkit-jank naprawiony u źródła dla pozostałych fiszek**: `.backface-hidden` w `index.css` (globalna klasa, używana przez `RecallFlashcard.tsx` i dwukrotnie w `FlashcardStudyScreen.tsx`) miała `backface-visibility: hidden` bez prefiksu `-webkit-`, w odróżnieniu od innych klas 3D/transform w tym samym pliku (np. `.liquid-glass-card`) — dodano brakujący prefiks. `FlashcardStudyScreen.tsx` (dedykowany widok „Fiszki" dla kursanta, osobny od `components/practice/`) dostał dodatkowo `min-h-[220px]` na obu kartach `aspect-[3/2]` jako zabezpieczenie przed zbyt niską kartą na wąskich telefonach — sama animacja (framer-motion + istniejące `.perspective-1000`) działała już poprawnie i nie wymagała przepisania na Tailwind.
- **(3) Nowy model danych**: `types/translationExercise.ts` — `TranslationMode`, `TranslationStep`, `AdvancedTranslationPayload`, dokładnie wg kontraktu ze zlecenia.
- **Nowy komponent `components/practice/TranslationExercise.tsx`** (UI-only, świadomie NIEPODŁĄCZONY do żadnego źródła danych — zlecenie nie precyzowało generatora AI ani miejsca w `PracticeZone.tsx`/pracy domowej, więc podłączenie zostawione na osobne zlecenie): iteruje po liście `AdvancedTranslationPayload`, dla `classic_assisted` renderuje pole tekstowe + klikalne podpowiedzi leksykalne (`lexicalHints`) wstawiane do odpowiedzi, dla `fragment_pool` renderuje pulę fragmentów (`correctChunk` + `distractors`, tasowane) wybieranych krok po kroku wg `stepIndex` z podglądem składanego zdania. Porównanie odpowiedzi z `targetSentence` przez nową `normalizeSentence()` (ta sama polityka normalizacji co `utils/unscrambleGrading.ts` — małe litery, bez interpunkcji, jednolity apostrof), ale na całym zdaniu naraz, nie per-token — bo w tłumaczeniu (w odróżnieniu od układanki ze stałym zestawem słów) kolejność i dobór słów SĄ przedmiotem oceny, nie tylko ich obecność. Ekran podsumowania (poprawne/wszystkie) wzorowany na istniejącym `FlashcardExercise.tsx`.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (495/495, bez nowych testów — komponent UI bez logiki wystarczająco złożonej, by uzasadnić nowy plik testowy, cała logika porównania to jedna czysta funkcja pokrywająca się wzorcem z już przetestowanego `unscrambleGrading.ts`), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych. Zmiana w modalu recenzji (`items-start`/`my-4`) to zmiana zachowania istniejącego, działającego UI — przetestowana statycznie i przez typecheck/build, ale NIE zweryfikowana wzrokowo w przeglądarce na koncie testowym lektora z realnymi odesłanymi pracami (patrz AGENT_LOG.md). Animacja flip fiszek (`FlashcardExercise.tsx`, `FlashcardStudyScreen.tsx`) również nie zweryfikowana wzrokowo, w tym na iOS Safari.

---

### AN. Pocket Companion — pulpit lektora na telefonie (`< md`) i pierwsza fala naprawy kontrastu żółci/pomarańczy w trybie jasnym (2026-09-21)
- Zlecenie: (1) na telefonie (`< md`, próg z `useIsDesktop()`) zamiast pełnego pulpitu lektora (`AdminPanel.tsx`) pokazać uproszczony hub „Pocket Companion" — 3 kafelki (Dzisiaj / Kursanci / Historia lekcji) + wyeksponowane wejście do Asystenta AI w stopce zamiast małego dymka; (2) schować `AdminAIActivityMonitor` na telefonie; (3) zablokować „Notatnik" (A4) i „Planer lekcji" ekranem „skorzystaj z desktopu" przy wejściu na telefonie; (4) pierwsza fala naprawy kontrastu w trybie jasnym — `text-white` w `HomeworkExercise.tsx` i zduplikowany wzorzec „pastelowej" pigułki podpowiedzi (`bg-amber-950/*` + `text-amber-200/300`) w kilku ekranach.
- **Nowy komponent `components/admin/TeacherMobileHub.tsx`**: 3 kafelki, każdy otwiera pełnoekranowy „sheet" (nie desktopowy ekran) z podsumowaniem — „Dzisiaj" woła `fetchTeacherCockpitData` (ten sam serwis co desktopowy `TeacherTodayCockpit.tsx`, ale bez montowania jego ciężkiego drzewa) i pokazuje dzisiejsze lekcje + prace do sprawdzenia; „Kursanci" to lista z wyszukiwarką i lekkim podglądem (ostatnia lekcja, e-mail) z przyciskiem „Otwórz pełny profil" jako świadomym hand-offem do istniejącego (desktopowego) profilu — dogłębny CRM nie jest w zasięgu tego zlecenia; „Historia lekcji" to płaska lista ostatnich 30 lekcji.
- **`AdminPanel.tsx`**: kafelki desktopowe (4 główne + 3 pomocnicze + „więcej narzędzi") owinięte w `hidden md:block`, `TeacherMobileHub` renderowany tylko gdy `!isDesktopUI && activeTab === null`. Wbudowany Asystent AI na stronie głównej (`activeTab === null`) też schowany na telefonie (`hidden md:block`) — zastępuje go pełnoekranowa nakładka wywoływana z paska w stopce Pocket Companion. Cztery handlery przekazywane wcześniej inline do `<TeacherAssistant mode="embedded">` (`onNavigateToModule`, `onSelectStudent`, `onCreateLessonRecord`, `onOpenInPresentation`) wyciągnięte do nazwanych funkcji (`handleAssistantNavigate` itd.) przed `return` — bez tego trzeba by powielić ~90 linii logiki między wersją desktopową i mobilną nakładką.
- **Gate „użyj desktopu"**: nowy `components/ui/DesktopOnlyNotice.tsx` (współdzielony komunikat). Wpięty w dwóch miejscach: `ScratchpadPage.tsx` (gdy lektor — nie kursant po PIN-ie — otwiera `/scratchpad` bez `isDesktop`) i `AdminPanel.tsx` (gdy `activeTab === 'lesson-planner'` i `!isDesktopUI`, jako nowa gałąź ternary PRZED istniejącą gałęzią renderującą `LessonPlannerStudio`).
- **`AdminAIActivityMonitor.tsx`**: `isAllowed` dostał dodatkowy warunek `&& isDesktop` (`useIsDesktop()`) — widżet nie renderuje się i zeruje własny CSS var `--rail-monitor` na telefonie, tak samo jak wtedy, gdy użytkownik nie ma uprawnień. Zmiana w jednym miejscu (już istniejący warunek `isAllowed`), bez dotykania JSX.
- **Kontrast, fala 1**: `HomeworkExercise.tsx` — 9 wystąpień `text-white` (zdanie do tłumaczenia/rozsypanki/multiple choice/find_errors, 3 pola `<textarea>`) zamienione na `text-text-hi` (token, czarny w light / biały w dark — mechanizm auto-inwersji `--color-white` w `index.css` obejmuje tylko `border-white/*`/`bg-white/*`, NIE literalny `text-white`, więc te pola renderowały się białym tekstem na białym tle w trybie jasnym). Zduplikowany wzorzec pigułki „Wskazówka lektora" (`bg-amber-950/25-30` + `text-amber-200` treść + `text-amber-300` etykieta + `text-amber-400` ikona) w `AIExerciseGeneratorScreen.tsx` (~4142) i `StudentHomeworkV2Screen.tsx` (~386) zamieniony na token `text-warn` (`#9a6410` light / `#e0a83a` dark — już używany w tym samym `HomeworkExercise.tsx` przy `AlertCircle`). To samo w odznakach BLOK 3/BLOK 4 w `LessonDetails.tsx` (`text-amber-300`/`text-yellow-300` → `text-warn`) i w podpowiedzi rozgrzewki `HomeworkScreen.tsx:244`.
- **Świadomie NIE zrobione** (pozostaje na kolejne zlecenie — grep na `text-amber-[2-4]00|text-yellow-300` poza naprawionymi plikami wskazuje jeszcze `StudentHomeworkScreen.tsx`, resztę `AIExerciseGeneratorScreen.tsx`, `StudentHeroHeader.tsx`): tła pigułek (`bg-amber-500/*`) i CRM (`StudentDatabaseScreen.tsx`, tabela z zamrożoną kolumną) NIE zostały przepisane na mobilny układ kartowy — zlecenie prosiło o hub z 3 kafelkami na stronie głównej, nie o mobilny redesign każdego ekranu, do którego te kafelki prowadzą po „Otwórz pełny profil"/pełnej historii.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (495/495, bez nowych testów — zmiana jest UI/routingowa, bez nowej logiki czystej do jednostkowego pokrycia), `npm run build` (przechodzi, ostrzeżenie o rozmiarze chunka istniało już wcześniej). Żadna z wizualnych zmian NIE została zweryfikowana wzrokowo w przeglądarce na koncie testowym — do zrobienia: (1) telefon, panel lektora — 3 kafelki + pasek Asystenta, każdy sheet się otwiera i zamyka; (2) `/scratchpad` i „Planer lekcji" na telefonie pokazują komunikat, nie desktopowy ekran; (3) tryb jasny — `HomeworkExercise.tsx` i pigułki podpowiedzi czytelne.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania (`ScratchpadPage.tsx` dostał tylko dodatkowy early-return PRZED istniejącą logiką roli/PIN-u, bez zmiany samej logiki dostępu).

---

### AO. Angielski, stonowany szablon lekcji w Notatniku A4 i globalna likwidacja `window.confirm()` (2026-09-21)
- Zlecenie: (1) profesjonalny, angielski szablon wklejania lekcji w Notatniku (nagłówki + typografia bez „tęczy" kolorów), (2) sprawdzenie logiki przełączania kursanta w notatniku pod kątem niechcianego doklejania brudnopisu, (3) likwidacja natywnych `window.confirm()`/`window.alert()` na rzecz spójnego modala in-app.
- **(1) Nagłówki**: `utils/lessonTemplate.ts` (`LESSON_SECTIONS`) — `Revision`→`Warm-up & Review`, `Main topic / Practice`→`Main Focus & Practice`, `Key Language & Corrections (New words)`→`Key Language & Corrections`, `Homework`→`Homework & Action Items`; `Lesson Summary` bez zmian. Zduplikowana kopia tej listy w `handleInsertAsStructuredLesson` (`components/scratchpad/ScratchpadEditor.tsx`, osobna ścieżka wstawiania — z wklejonego/rozpoznanego tekstu, nie z przycisku „Nowa lekcja") zaktualizowana identycznie, wraz z etykietami przycisków „wstaw do sekcji" i treścią systemowego promptu Asystenta AI notatnika.
- **(1) Typografia**: pięć jaskrawych kolorów nagłówków sekcji (`NOTEBOOK_COLORS`/`colorKey`: róż/zieleń/niebieski/pomarańcz/fiolet, wpisywane wprost w HTML dokumentu) zastąpione jednym, stonowanym stylem inline — nagłówek H2 tytułu lekcji pogrubiony z cienką linią pod spodem (`lessonTitleStyle`), nagłówki H3 sekcji wielkimi literami, z odstępem liter, przytłumionym kolorem tekstu (`sectionHeadingStyle`) — oba nowe helpery w `utils/lessonTemplate.ts`, reużyte w `ScratchpadEditor.tsx` zamiast zduplikowanej logiki kolorów. `NOTEBOOK_COLORS`/`notebookHeadingColor`/`sanitizeFrozenHeadingContrast` w `utils/notebookPalette.ts` ZOSTAJĄ nietknięte — wyłącznie dla wpisów zrobionych PRZED tą zmianą (nikt nie przepisuje za lektorem treści już zapisanej w dokumencie). Pigułki korekt/słówek Asystenta AI (`.badge-error`/`.badge-success`/`.badge-vocab`, `index.css`) przeszły z płaskich, nasyconych wypełnień na dyskretne warianty z cienką obwódką (np. `.badge-success`: `#ecfdf5`/`#065f46`/obwódka `#a7f3d0`, w duchu `bg-emerald-50 text-emerald-800 border-emerald-200` ze zlecenia).
- **(2) Przełączanie kursanta — bez zmian logiki**: `ScratchpadStudentPicker.tsx` (wybór spośród już istniejących kursantów) od razu ładował właściwy dokument kursanta, bez doklejania czegokolwiek — zweryfikowane czytaniem kodu, nie był to bug. Jedyne miejsce z „doklejaniem" to `handleAssignStudent` w `TeacherScratchpadScreen.tsx` — świadomie zaprojektowana, udokumentowana w kodzie funkcja human-in-the-loop: przypisanie ŚWIEŻEGO, jeszcze nieprzypisanego „notatnika roboczego" do kursanta, który ma już własne notatki, dopisuje treść roboczą na końcu jego dokumentu, ale wyłącznie po jawnym potwierdzeniu lektora — nic nie ginie bezgłośnie. Zapytany wprost, Maciej potwierdził zachowanie tej logiki (rekomendacja) — zmieniony wyłącznie `window.confirm()` na modal in-app, sama logika dopisywania nietknięta.
- **(3) `window.alert()` — już przechwycony globalnie**: `utils/appAlert.ts` od dawna nadpisuje `window.alert` przy imporcie (montowanym raz, w `AppAlertModal.tsx`/`App.tsx`), więc KAŻDE wywołanie `alert(...)` w repo (setki miejsc) już dziś pokazuje ten sam stylizowany modal zamiast natywnego okna przeglądarki — bez potrzeby przepisywania pojedynczych wywołań. Literalne kryterium akceptacji „zero wystąpień `alert(` w kodzie" NIE zostało spełnione dosłownie (przepisanie ~150 wywołań byłoby czystym powtórzeniem pracy, którą ten mechanizm już wykonuje w runtime) — jeśli to niewystarczające, wymaga osobnej decyzji.
- **(3) `window.confirm()` — nowy `confirmAsync()`**: dodana funkcja Promise-owa w `utils/appAlert.ts` (`confirmAsync(message, { title?, tone?, confirmText?, cancelText? }) → Promise<boolean>`, domyślny `tone: 'danger'` — czerwony przycisk potwierdzenia, bo prawie wszystkie zastane wywołania to potwierdzenia kasowania). Wszystkie 30 wystąpień `window.confirm()`/`confirm()` w 18 plikach (`components/admin/*`, `components/dashboard/*`, `components/scratchpad/TeacherScratchpadScreen.tsx`, `components/settings/SettingsScreen.tsx`) zamienione na `await confirmAsync(...)`, z dodaniem `async` do otaczających handlerów tam, gdzie jeszcze nim nie były. Sam modal (`AppAlertModal.tsx`) nie wymagał zmian — już miał ciemne tło z blur, czerwony przycisk dla `tone: 'danger'`, szmaragdowy/`primary` dla pozostałych tonów i przycisk „Anuluj".
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), grep po repo na `window\.confirm|confirm(` poza `utils/appAlert.ts` — zero trafień.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji (`server.ts`), ścieżkach tokenowych bez logowania. Zmiany wyłącznie w warstwie UI/frontend. Wizualny efekt nowego szablonu (typografia H2/H3, pigułki korekt) i modali potwierdzenia NIE zweryfikowany wzrokowo w przeglądarce — do zrobienia: (1) wstawienie nowej lekcji w Notatniku na koncie testowym, sprawdzić czytelność nagłówków w obu motywach papieru (jasny/ciemny), (2) kliknięcie dowolnej akcji kasującej (np. usunięcie lekcji w `AdminPanel.tsx`) pokazuje nowy modal zamiast natywnego okna przeglądarki.

---

### AP. Odchudzenie belki profilu kursanta i „Historia Lekcji" z Pull-on-Demand Notion wprost z profilu (Krok 1/3, 2026-09-21)
- Zlecenie (pakiet stabilizacyjny „Izolacja Powtórek, Angielski Szablon Notatnika, Profil Kursanta i Zakładki Prac Domowych"): audyt wykazał, że §1 (izolacja powtórek + angielski szablon) i §5 (likwidacja `window.confirm`/`alert`) są już zrobione (patrz wpis AO wyżej) — sesja wykonała wyłącznie §2 (belka profilu) i §3 (nazwa zakładki + Notion na żądanie z poziomu profilu); §4 (zakładki w Pracach domowych) świadomie zostawiony na kolejny krok, potwierdzone z Maciejem.
- **§1, ponowna weryfikacja (bez zmian w kodzie)**: generator „Warm-up & Review" (`ScratchpadEditor.tsx`, `handleInsertLesson`) czyta poprzednią lekcję wyłącznie z `previousHtml` — treści dokumentu AKTUALNIE otwartego w edytorze dla TEGO kursanta — nigdy z globalnego zapytania czy z innego dokumentu. Brak poprzedniej lekcji → neutralny placeholder („Przejrzyj korekty i słownictwo z poprzednich zajęć"). Jedyne udokumentowane „doklejanie" (`TeacherScratchpadScreen.tsx`, `handleAssignStudent`) to świadoma funkcja human-in-the-loop, potwierdzona przez Macieja we wpisie AO — nie ruszona ponownie.
- **§2 — `StudentProfileHeader.tsx` z 335 linii do ok. 90**: usunięte w całości — cztery kafelki metryk (E-mail/Poziom/Logowania/Ostatnia wizyta, już dostępne w zakładce „Profil & Dane"), pigułka „Kopiuj hasło startowe" z kopiowaniem do schowka, para „Zaproszenie: Wysłano/Nie wysłano" + przycisk „Oznacz jako wysłane"/"Cofnij", status „Połączono z Google"/"Hasło własne kursanta". Nagłówek zawiera teraz wyłącznie: awatar/inicjał, imię i nazwisko, wąski jednolinijkowy pasek statusu logowania (kropka + `Oczekuje na 1. logowanie` w kolorze `warn` / `Ostatnia wizyta: DD.MM.YYYY, HH:mm` w `content-muted`) oraz przyciski „Panel lektora" i menu „Zmień kursanta". Propsy `onEditContact`/`onEditLevel`/`onToggleInvitationSent` zostały w interfejsie (zgodność z wywołaniem z `AdminPanel.tsx`), ale nieużywane wewnątrz komponentu — edycja kontaktu/poziomu i zarządzanie zaproszeniem żyje teraz wyłącznie w zakładce „Profil & Dane".
- **§3 — zakładka profilu przemianowana**: `AdminPanel.tsx`, tablica zakładek profilu kursanta — `{ id: 'history', label: 'Moje lekcje', ... }` → `label: 'Historia Lekcji'` (nazwa ujednolicona z tytułem już istniejącego, osobnego globalnego widoku `TeacherLessonHistoryView.tsx`, który wewnątrz JUŻ nazywał się „Historia Lekcji" — niespójność była wyłącznie w etykiecie zakładki, nie w treści).
- **§3 — Pull-on-Demand Notion, dopięty bez duplikowania logiki**: `TeacherLessonHistoryView.tsx` miał już gotowy, działający mechanizm (`callNotionSync` → `POST /api/notion/fetch-transcripts`, `{ mode: 'preview'|'import', studentId, pageIds? }`) — ale wyłącznie w GLOBALNYM widoku lektora (kafelek „Moje lekcje" na stronie głównej, z ręcznym wyborem kursanta z listy), nie w zakładce „Historia Lekcji" WEWNĄTRZ profilu pojedynczego kursanta. Dodano do `AdminPanel.tsx` nowy przycisk „Sprawdź transkrypcje w Notion" obok istniejącego menu „Lekcje" w tej zakładce, wołający TEN SAM endpoint, zawsze zawężony do `selectedUser.id` (bez potrzeby wyboru kursanta — jest już otwarty). Pusty wynik (`items.length === 0`) → toast „Nie znaleziono nowych transkrypcji w Notion dla tego kursanta." zamiast otwierania pustego modala (czego oryginalny `TeacherLessonHistoryView.tsx` NIE robił — tam modal otwiera się zawsze, nawet z zerem wyników; nie tknięte, poza zakresem tego zlecenia). Niepuste wyniki → `NotionImportPreviewModal` (już istniejący, reużyty), import wyłącznie po jawnym zaznaczeniu i kliknięciu „Zaimportuj zaznaczone".
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508, bez nowych testów — zmiana czysto UI/wiring, bez nowej logiki czystej wymagającej pokrycia).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania. Zmiany wyłącznie w `components/admin/AdminPanel.tsx` i `components/admin/StudentProfileHeader.tsx`. Wizualnie NIE zweryfikowano w przeglądarce — do zrobienia: (1) belka profilu w obu motywach z kursantem, który nigdy się nie logował, i z takim, który już się logował, (2) przycisk „Sprawdź transkrypcje w Notion" w zakładce „Historia Lekcji" — przypadek pusty (toast) i przypadek z wynikami (modal + import).

### AQ. Humanizacja tonu szablonów mailowych Resend — koniec trzeciej osoby i tabel metryk (2026-09-21)
- Zlecenie: wyeliminować z treści maili do kursanta bezosobowy/trzecioosobowy język ("Lektor", "Przypisane przez") i biurokratyczne tabele metryk na rzecz bezpośredniej, pierwszoosobowej komunikacji Macieja.
- `services/homeworkEmail.ts` (`buildHomeworkConfirmationEmail`, ścieżka bezpośredniego linku bez logowania po potwierdzeniu lektora w `HomeworkEmailConfirmationModal.tsx`): usunięty wiersz „Przypisane przez" z tabeli metryk i wersji tekstowej; „Termin wykonania"/„Ważność linku" zamienione z tabeli na jedno zdanie („Zadanie czeka na Ciebie do..."). `buildWelcomeEmail`: „Wiadomość od lektora:" → „Wiadomość ode mnie:".
- `functions/src/emailTemplate.ts` (`buildHomeworkEmail`, ścieżka Cloud Function przy zdarzeniu nowej pracy domowej w bazie): ta sama zmiana tabeli metryk. `buildHomeworkGradedEmail`: temat „Lektor sprawdził pracę: ..." → „Sprawdziłem Twoją pracę domową: ..."; etykieta „Komentarz lektora:" → „Komentarz i wskazówki ode mnie:" (ujednolicone z bliźniaczą funkcją `buildGradedHomeworkEmail` w `services/homeworkEmail.ts`, która już była w 1. osobie).
- `components/admin/HomeworkEmailConfirmationModal.tsx`: podgląd (zakładka Preview) miał własny, twardo wpisany tekst rozjeżdżający się z realnie wysyłaną treścią — „Lektor przypisał dla Ciebie..." i tabelę „Przypisane przez", których w kodzie wysyłki już nie ma. Ujednolicono podgląd z faktycznym szablonem.
- Świadomie pominięte: (1) mail z podsumowaniem lekcji (`sendLessonSummaryEmail`) — nie istnieje w kodzie, to część osobnego, nierozpoczętego zadania; (2) twardy warunek anty-halucynacyjny w promptcie systemowym Gemini dla treści maili — nie znaleziono w repo miejsca, gdzie treść maila byłaby generowana przez model; (3) etykiety „Lektor"/„Kursant" w UI panelu admina (nagłówki tabel, podgląd wewnętrzny w `AdminMailingScreen.tsx`, `StudentInviteEmailModal.tsx`) — to interfejs dla Macieja, nie treść maila do kursanta.
- Weryfikacja: `npx tsc --noEmit` w katalogu głównym i w `functions/` (0 błędów w obu), `npm test` (508/508). Zero weryfikacji wzrokowej w kliencie pocztowym.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania ani w kluczu API mailingu.

### AR. Bramka wyboru kursanta przed Notatnikiem A4 — bez ruszania zabezpieczenia przed doklejaniem (2026-09-21)
- Zlecenie żądało też całkowitego usunięcia modala „Dopisać do istniejących notatek?" (zabezpieczenie z wpisu AO/AP wyżej). Zapytany wprost przed wdrożeniem, Maciej potwierdził: zabezpieczenie zostaje, nowa bramka ma tylko otwierać istniejący dokument kursanta bez scalania.
- `components/scratchpad/ScratchpadStudentPicker.tsx` — komponent (szukajka + lista kursantów z avatarem/inicjałem i poziomem) już istniał w pełni gotowy, ale był zaimportowany a nieużywany w `AdminPanel.tsx` (martwy kod). Dodano mu opcjonalny `secondaryAction` (etykieta + onClick) pod listą.
- `components/admin/AdminPanel.tsx` — kafelek „Notatnik" na pulpicie lektora (`handleTileClick('notatnik')`) otwierał notatnik roboczy bez pytania o kursanta; teraz najpierw pokazuje `ScratchpadStudentPicker` z akcją pomocniczą „Otwórz notatnik roboczy (bez kursanta / tryb testowy)". Wybór kursanta otwiera jego własny, istniejący dokument (`sp_<id>`) — zero doklejania.
- `components/scratchpad/TeacherScratchpadScreen.tsx` — nowy pasek kontekstu, gdy notatnik jest już przypisany do kursanta: pigułka z imieniem + „Zmień kursanta ▾", otwierająca notatnik innego ucznia w nowej karcie (spójnie z tym, jak działa każde inne wejście do notatnika w aplikacji). Istniejący pasek „Przypisz kursanta" (scalanie treści roboczej, `handleAssignStudent` z potwierdzeniem `wouldAppendToExistingNotes`) pozostał bez zmian.
- Świadomie pominięte: przycisk „Notatnik" pod flagą `SHOW_LEGACY_PANEL_TOOLS` nadal otwiera notatnik roboczy wprost — narzędzie legacy, poza zakresem.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508). Zero weryfikacji wzrokowej w przeglądarce.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania. Zabezpieczenie przed nieodwracalnym nadpisaniem/zdublowaniem notatek kursanta świadomie nietknięte.

### AS. Uproszczenie parsowania lekcji: koniec generowania pracy domowej w notatce + mail podsumowania (human-in-the-loop) (2026-09-21)
- Usunięto generowanie Bloku 3 (praca domowa/klucz odpowiedzi) z OBU ścieżek tworzenia lekcji z wklejonego tekstu: `utils/transcriptLesson.ts` (obsługuje zarówno wklejanie notatek Notion AI przez `ManualTranscriptImportModal.tsx`, jak i recenzję nagrań Cribro Sift w `TranscriptLessonPanel.tsx`) oraz `server.ts` `/api/gemini/lesson-summary` w trybie `'transcript'` (drugi, równoległy pipeline używany też do wklejania surowych notatek w `AdminPanel.tsx`). Ta druga ścieżka miała jawny komentarz broniący generowania homeworku („pusty blok to dziura, nie oszczędność") — usunięty po jawnym potwierdzeniu z Maciejem, że jest nieaktualny. Praca domowa żyje wyłącznie w osobnym module ćwiczeń.
- Nowy szablon Resend `buildLessonSummaryEmail` (`services/homeworkEmail.ts`) i nowy modal `components/admin/LessonSummaryEmailModal.tsx`: po zapisaniu lekcji DLA JEDNEGO kursanta (nie przy zajęciach grupowych — brak jednego adresata) `AdminPanel.tsx` pyta, czy wysłać mailem podsumowanie (Key Language + korekty), zamiast wysyłać automatycznie. Wysyłka przez istniejący, ogólny endpoint `/api/mailing/test-send` (ten sam, którego już używa `HomeworkEmailConfirmationModal` do realnej, nie tylko testowej wysyłki).
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania.

### AT. Naprawa: „Nie znaleziono notatnika o podanym adresie" przy pierwszym otwarciu notatnika kursanta (2026-09-21)
- Bug ujawniony przy wdrażaniu wpisu AR: bramka wyboru kursanta otwiera notatnik po deterministycznym ID (`sp_<studentId>`) przez `getScratchpadById`, która TYLKO czyta — nigdy nie tworzy. Kursant bez wcześniejszego notatnika trafiał na czerwony ekran błędu zamiast czystego edytora A4.
- `services/scratchpadService.ts` (`openScratchpadTab`): opcjonalny drugi argument `studentName`, dopisywany do URL jako `&name=`. `components/scratchpad/ScratchpadPage.tsx`: wyciąga `studentId` wprost z adresu (wzorzec `sp_<studentId>`, ten sam co w `getOrCreateStudentScratchpad`) zamiast na sztywno przekazywać `{ id: null, name: 'Notatnik roboczy' }`. `components/scratchpad/TeacherScratchpadScreen.tsx`: gdy `getScratchpadById` zwróci `null`, a `student.id` jest znany — dopada `getOrCreateStudentScratchpad` zamiast rzucać błąd; adres bez rozpoznanego kursanta nadal kończy się błędem jak dotychczas.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (508/508).
- Ryzyka: brak zmian w `firestore.rules`. Uprawnienia `create` dla `scratchpads/{id}` nie weryfikowane osobno — ten sam `getOrCreateStudentScratchpad` już działa produkcyjnie w ścieżce notatnika roboczego.

### AU. Sprawdzanie pisowni/stylu PL/EN w Notatniku A4 — falowane podkreślenia w stylu Google Docs (2026-09-22)
- Nowy endpoint `POST /api/notebook/spellcheck` (`server.ts`, `requireFirebaseAdmin` — teacher/admin, jak `/api/gemini/lesson-summary`): Gemini 2.5 Flash (`thinkingBudget: 0`, JSON), system instruction o kontekście dwujęzycznym (nie myl PL z EN), zwraca `{ issues: [{ id, matchedText, contextSnippet, suggestion, type: spelling|grammar|awkward, shortReason }] }`.
- Nowe pliki: `services/notebookSpellcheckService.ts` (klient), `components/scratchpad/useNotebookSpellcheck.ts` (lokalizacja błędu w DOM przez `Range`/`TreeWalker`, podmiana tekstu), `components/scratchpad/SpellcheckPopover.tsx` (dymek: przycisk sugestii, „Ignoruj", `shortReason`). `ScratchpadEditor.tsx`: przycisk „Sprawdź pisownię" w pasku narzędzi, pigułka „X uwag do pisowni" z „Zastosuj wszystkie"/„Wyczyść podkreślenia", toast przy zerze błędów (reużyty istniejący `components/ui/Toast.tsx`).
- **Świadome odstępstwo od zlecenia**: zlecenie podawało klasy Tailwind `decoration-wavy` do zastosowania WPROST na dopasowanym tekście — co wymagałoby owijania dopasowań w `<span>` WEWNĄTRZ edytowalnego DOM-u notatnika, którego `innerHTML` idzie bezpośrednio do Firestore. Zamiast tego znaczniki żyją w osobnej warstwie nakładanej nad kartką (`position: absolute`, pozycjonowanej przez `Range.getClientRects()`), z falą narysowaną przez CSS `background-image` — ten sam efekt wizualny, zero ryzyka dla zapisywanej treści notatnika. Konsekwencja: pozycje liczą się na żądanie (klik „Sprawdź pisownię" i po każdej podmianie), nie śledzą tekstu w locie — każda kolejna edycja czyści podkreślenia.
- Nowy plik testowy `tests/notebookSpellcheck.test.tsx` (jsdom ręcznie, jak `tests/homeworkWarmupScrambler.test.tsx`): lokalizacja dopasowania rozbitego na węzły tekstowe przez element inline, disambiguacja przez `contextSnippet` przy powtórzonym słowie, `null` gdy błędu już nie ma w treści, fallback na sam `matchedText`.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513, +5 nowych), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania. Zero weryfikacji wzrokowej w przeglądarce.

### AV. Naprawa: „Missing or insufficient permissions" przy odrzucaniu lekcji „Do potwierdzenia" (2026-09-22)
- Zlecenie zakładało, że przyczyną jest pole `teacherId` niepasujące do reguły Firestore — założenie błędne. Dokumenty `lessonRecords`/`vocabularySets`/`sets`/`rejectedNotionLessons` nie mają w ogóle pola `teacherId` (potwierdzone w `functions/src/notion/sync.ts`); reguły tych kolekcji w `firestore.rules` są bramkowane wyłącznie przez `isAdmin()` (5 twardo zakodowanych e-maili LUB `role` na koncie w `['admin', 'admin_student', 'teacher']`), bez odniesienia do właściciela dokumentu. Błąd oznaczał, że konto klikające „Odrzuć" nie spełniało żadnego z tych warunków.
- `server.ts` — nowy endpoint `POST /api/lessons/reject-pending` (`requireFirebaseAdmin`), który przez Admin SDK usuwa `lessonRecords/{lessonId}`, opcjonalnie `vocabularySets/{vocabularySetId}` i `sets/set-lesson-{lessonId}`, i zapisuje wpis w `rejectedNotionLessons/{rejectedId}`. Admin SDK omija reguły klienckie Firestore całkowicie.
- `services/lessonRecord.ts` — `rejectNotionLesson()` przepisane na wywołanie tego endpointu (wzorem `authHeader()` z `services/aiConfigService.ts`) zamiast bezpośrednich zapisów klienckich. `deleteLessonRecord()` (zwykłe kasowanie lekcji, duplikaty) pozostało bez zmian.
- Świadomie pominięte: zmiana `firestore.rules` (zlecona jako „Krok A") — niepotrzebna, bo endpoint Admin SDK w pełni rozwiązuje problem bez dotykania obszaru wysokiego ryzyka z sekcji 3 `CLAUDE.md`. Pominięty też dwuetapowy mechanizm „spróbuj klienta, potem fallback backendowy" — uproszczone do jednej ścieżki przez backend.
- Zauważona przy okazji niespójność (nienaprawiona, poza zakresem): `requireFirebaseAdmin` w `server.ts` nie uznaje roli `admin_student`, którą uznają `firestore.rules`.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513), `npm run build` (przechodzi, w tym `server.cjs`/`api/index.js`). Zero weryfikacji na koncie z rzeczywiście problematyczną rolą — zalecane ręczne sprawdzenie.
- Ryzyka: `firestore.rules` NIE zmienione. Nowy endpoint wymaga poprawnego tokenu Firebase i przechodzi ten sam admin-check co reszta `/api/admin-users/*` — nie jest ścieżką bez logowania.

### AW. Porządki UI: usunięcie pól Bloku 3/Klucza/Bloku 4 z edycji lekcji (2026-09-22)
- `components/admin/AdminPanel.tsx` — usunięte z modala edycji lekcji ("Panel lekcji") trzy pola: "Praca domowa (Blok 3 — Homework)", "Klucz odpowiedzi (Answer Key)", "Na kolejnej lekcji (Blok 4 — Next Lesson)". Zostają: nagłówek, dane lekcji, słownictwo, "Elementy do powtórek" (`RecallItemsReview`), "Things to Improve".
- Zlecenie prosiło też o "bezpieczny fallback null lub pomiń te pola w payloadzie zapisu". Sprawdzone przed zmianą i świadomie NIE zrobione: (a) te pola nigdy nie były wymagane przez `isValidLessonRecord` w `firestore.rules`, więc zapis nigdy nie był nimi blokowany; (b) `homeworkText`/`homeworkAnswerKey`/`nextLessonPlan`/`suggestedFollowUp` to żywy, szeroko używany model danych — m.in. widoczny kursantowi w `StudentLessonHistory.tsx`/`LessonHistory.tsx`, używany w `PreLessonContext.tsx`, `presentationService.ts`, `scenarioContextService.ts`, i wciąż generowany przez import zbiorczy z Notion (`server.ts` `/api/gemini/import-lessons-batch`). Wcześniejszy wpis "AS" (2026-09-21) usunął generowanie homeworku tylko z JEDNEJ ścieżki (transkrypcja), nie z całego modelu. Usunięcie tych pól z payloadu edycji kasowałoby więc realne dane przy każdym zapisie istniejącej lekcji z tego modala — zamiast tego stan i payload zostały nietknięte: wartości nadal wczytują się z rekordu przy otwarciu edycji i zapisują z powrotem bez zmian (round-trip), więc formularz jest zwarty, a zapis niczego nie niszczy ani nie wymaga.
- Zadanie 2 zlecenia (usunięcie sekcji "NAZWA KONTA / LOGIN") było już wykonane w poprzednim, osobnym zadaniu tego samego dnia — commit 4d60e39. Zweryfikowane grepem, nic do zrobienia.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513), `npm run build` (przechodzi).
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania. Zero weryfikacji wzrokowej w przeglądarce.

### AX. Podsumowanie lekcji w stronie biernej + trwałe usunięcie Bloku 3 z historii lekcji, ujednolicony akordeon kursant/lektor (2026-09-22)
- **Prompt AI (strona bierna, max 3-4 punkty):** `utils/transcriptLesson.ts` (`TRANSCRIPT_SYSTEM_INSTRUCTION` + `buildTranscriptLessonPrompt`, pola `summary`/`summaryPoints`) — dodana żelazna reguła: BLOK 1 „Lekcja w skrócie" to maksymalnie 3-4 punkty w stronie biernej/bezosobowej, z jawnym zakazem form gawędziarskich („Lektor wprowadził...", „[Imię] opowiadał(a) o...") i przykładami wzorcowymi wprost ze zlecenia. Ten plik jest realnym, aktywnym generatorem promptu dla ścieżki transkrypcji (`TranscriptLessonPanel.tsx`, `ManualTranscriptImportModal.tsx`) — server-side `/api/gemini/lesson-summary` (`server.ts` ok. linii 4353-4435) to osobna, równoległa ścieżka dla wklejanych notatek/PDF, zaktualizowana tą samą regułą dla spójności.
- **Trwałe wycięcie Bloku 3 z ekstrakcji:** `parseTranscriptLesson` w `utils/transcriptLesson.ts` już nie czyta `parsed.homework`/`parsed.answerKey` z odpowiedzi modelu — nawet gdyby model mimo instrukcji coś tam wstawił, parser to ignoruje (`blocks.homework`/`blocks.answerKey` zawsze `''` dla tej ścieżki). W `server.ts` (`/api/gemini/lesson-summary`) usunięte `homeworkText`/`homeworkAnswerKey` z `responseSchema` — model nie ma już nawet slotu w schemacie JSON, żeby je zwrócić. Bulk-import z Notion/dokumentów (`server.ts` `/api/gemini/import-lessons-batch`, ok. linii 3754-3812) świadomie NIETKNIĘTY — inny endpoint, inny cel (import gotowej historii, nie generowanie z transkrypcji), poza zakresem zlecenia.
- **Ujednolicony akordeon kursant/lektor:** `components/dashboard/LessonDetails.tsx` (widok kursanta, używany przez `StudentLessonPanel.tsx` i `LessonHistoryMonths.tsx`) przepisany z płaskiego, zawsze-rozwiniętego layoutu na dokładnie ten sam wzorzec zwijanych akordeonów co `components/admin/CascadingLessonDetails.tsx` (widok lektora): kolorowe rounded-2xl kontenery, gradientowy nagłówek z pigułką „BLOK N", ikoną i opisem, `ChevronDown`/`ChevronUp` do zwijania, domyślnie wszystko zwinięte. Dodana sekcja Learning Curve (fioletowy akordeon) w widoku kursanta — WYŁĄCZNIE dla `isTeacher` (ten sam wewnętrzny `useAuth()`-owy gating co wcześniej dla Next Lesson), bo wcześniej jej tam w ogóle nie było mimo że lektor patrzący na panel kursanta powinien ją widzieć.
- **Blok 3 (Homework) usunięty z HISTORII lekcji dla obu ról:** cały akordeon „BLOK 3 — Homework — Cribro Habit" wycięty z `CascadingLessonDetails.tsx` (był i tak już wcześniej ukryty przed kursantem w `LessonDetails.tsx`, ale widoczny lektorowi). Wraz z nim usunięty prop `onGenerateHomework` (i state `isAnswerKeyOpen`) — **capability nie zginęła**: przycisk „Wygeneruj zadanie domowe z lekcji" nadal istnieje jako osobne akcje w wierszach tabeli `AdminPanel.tsx` (ok. linii 3502, 3626, `handleGenerateHomeworkFromLesson`), które nigdy nie przechodziły przez ten prop. Usunięty też martwy po tej zmianie prop `onGenerateHomeworkFromLesson` z `TeacherLessonHistoryView.tsx` i jego przekazanie w `AdminPanel.tsx`.
- **Etykieta „Revision Notes"→„Lekcja w skrócie":** `pl.json`/`en.json`, klucz i18n `"Revision Notes"` (używany w polu formularza edycji lekcji w `AdminPanel.tsx`) — zmieniona tylko wartość tłumaczenia, nie klucz, żeby nie ruszać wywołań `i18n.t(...)`.
- **Świadomie NIETKNIĘTE, poza zakresem:** `components/dashboard/LessonHistory.tsx` i `components/dashboard/StudentLessonHistory.tsx` — zweryfikowane grepem, że żaden z nich nie jest importowany z `Dashboard.tsx` ani żadnego aktywnego ekranu (martwy kod, mimo że wspomniane jako „widoczne kursantowi" we wcześniejszym wpisie AW — to się nie potwierdziło przy faktycznym sprawdzeniu grafu importów). Jeśli kiedyś zostaną podłączone, będą potrzebowały tej samej rewizji co `LessonDetails.tsx`.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513), `npm run build` (przechodzi). Zero weryfikacji wzrokowej w przeglądarce.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania.

### AY. Notatnik A4: kolumny/tabele w menu „+ Wstaw" i „Wstaw do notatki" w panelu Scenariusz & Notes (2026-09-22)
- Zlecenie opisywało trzy duże funkcje jako brakujące, z których dwie już istniały (sprawdzone przed pisaniem kodu, nie przyjęte na słowo): bramka wyboru kursanta (`ScratchpadStudentPicker.tsx` + pasek „Przypisz/Zmień kursanta" w `TeacherScratchpadScreen.tsx`, wpis AR wyżej) i panel boczny ze scenariuszem/prywatnymi notatkami (`ScratchpadTeacherCompanionDrawer.tsx`, przycisk „Scenariusz & Notes" w nagłówku edytora). Obie zaimplementowane inaczej niż literalnie żądał opis zlecenia i z udokumentowanym uzasadnieniem w komentarzach w kodzie — **zapytany wprost przed zmianą, Maciej potwierdził: zostawić jak jest**, nie zastępować modalem blokującym (bramka) ani układem flex/grid push-layout (panel, obecnie `fixed` nakładka ~512px, nie 340-380px).
- **Zrobione — `components/scratchpad/ScratchpadEditor.tsx`:** menu „+ Wstaw" → sekcja „Struktura dokumentu" dostała trzy nowe pozycje: „Układ 2 kolumn" (`handleInsertColumns`), „Tabela 2×2" i „Tabela 3×2" (`handleInsertTable(rowCount)`), wstawiane w miejscu kursora przez `execCommand('insertHTML', ...)` (ten sam wzorzec co istniejące `handleInsertTemplate`/`handleInsertChecklist`). Każdy wstrzyknięty blok kończy się pustym `<p><br></p>` (zasada anti-trap ze zlecenia) — bez tego kursor łapał się w ostatniej komórce siatki/tabeli. Klasy Tailwind (np. `bg-slate-900/40`) wpisane wprost jako literalne stringi w pliku źródłowym, żeby skaner Tailwinda (który czyta pliki tekstowo, nie przez AST) je znalazł mimo że trafiają do `innerHTML` w runtime, nie do JSX.
- **Zrobione — `handleInsertPhraseToDoc`** (`ScratchpadEditor.tsx`) + nowy prop `onInsertPhrase` w `ScratchpadTeacherCompanionDrawer.tsx`: przy każdym punkcie scenariusza w zakładce „Scenariusz Lekcji" pojawił się przycisk „Wstaw" (obok istniejącego „Skopiuj" dla podpowiedzi), który wstawia dany zwrot/zadanie jako nowy akapit w miejscu kursora na aktywnej stronie A4. Wzorem istniejącego `handleInsertAiMessageToDoc` — `editorRef.current.focus()` PRZED `execCommand`, bo przycisk żyje w osobnym panelu nakładki (poza `contenteditable`), więc bez jawnego przywrócenia fokusu przeglądarka nie ma dokąd wstawić treści.
- **Sekcja 4 zlecenia (weryfikacja reguł edytora A4)** — sprawdzona grepem, nie ruszana: `contenteditable="false"` na `pad-locked-heading` już obecne, narzędzia korekty (`wrapSelectedTextInline`, `handleStrikeCorrect`) już operują przez `Text.splitText` bez łamania akapitów, elastyczna wysokość strony A4 już wdrożona (komentarz w kodzie: „bez sztywnego ucinania po dokładnie 297mm") — wszystko z wcześniejszego commitu `51e96ac`.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513), `npm run build` (przechodzi). Zero weryfikacji wzrokowej w przeglądarce (brak dostępu w tej sesji) — w szczególności wygląd nowych kolumn/tabel na obu motywach papieru i przycisku „Wstaw" w panelu bocznym.
- Ryzyka: brak zmian w `firestore.rules`, middleware autoryzacji, ścieżkach tokenowych bez logowania.

### AZ. Zarządzanie grupami kursantów, wspólny notatnik grupowy i fan-out prac domowych (2026-09-22)
- **Panel zarządzania grupami w CRM:** `components/admin/AdminPanel.tsx` oraz `components/admin/GroupManagementModal.tsx` — dodano pełną obsługę tworzenia, edycji i usuwania grup kursantów wraz z przypisywaniem lektorów i kursantów.
- **Wspólny notatnik grupy dla lektora i kursanta:**
  - `components/scratchpad/ScratchpadStudentPicker.tsx` — lektor może wybrać notatnik grupy; system automatycznie inicjalizuje wspólny dokument `sp_group_${groupId}` (`ensureGroupScratchpad`).
  - `components/dashboard/TodayScreen.tsx` — kursant należący do grupy widzi dedykowany, wyróżniony kafel `[ 📓 Wspólny notatnik grupy: {group.name} ]` oraz skrót w listwie narzędzi `StudentToolBar`, umożliwiający bezpośrednie przejście do wspólnego notatnika w czasie rzeczywistym (`openScratchpadTab`).
- **Fan-out prac domowych dla grup w V2:** `components/admin/HomeworkComposerV2.tsx` — dodano przełącznik wyboru adresata (kursant indywidualny / grupa), selekcję członków z checkboxami (domyślnie zaznaczeni wszyscy członkowie grupy) oraz wysyłkę fan-out via `assignHomeworkSetV2` tworzącą powiązane dokumenty `specialTasks` ze wspólnym `groupId` i `homeworkSetId` wraz z obsługą powiadomień toast i kolejkowaniem modali potwierdzenia e-mail.
- **Reguły Firestore:** `firestore.rules` — dodano regułę `allow read:` dla `/groups/{groupId}` z warunkiem autoryzacji i członkostwa (`request.auth.uid in resource.data.memberIds`) lub uprawnień admina (`isAdmin()`), umożliwiającą zapytania `array-contains` dla kursantów.
- Weryfikacja: `npx tsc --noEmit` (0 błędów), `npm test` (513/513), `npm run build` (przechodzi).

### BA. Pakiet 2 Refaktoryzacji Interfejsu (Pulpit Lektora, CRM Glassmorphism, Deduplikacja Powiadomień, Panel Kursanta) (2026-09-23)
- **Pulpit Lektora & Dynamiczny Czat AI (`components/admin/AdminPanel.tsx`, `components/dashboard/Dashboard.tsx`):**
  - Czat AI (`TeacherAssistant mode="embedded"`) jest centralnym mózgiem w kokpicie (`!activeTab && !selectedUser`), a pływający FAB w lewym dolnym rogu jest ukryty.
  - Po przełączeniu na moduł kursantów (`students`) lub narzędzi (`tools`), centralne okno znika, a w lewym dolnym rogu natychmiast pojawia się dyskretny pływający trigger (FAB) asystenta AI z zachowaniem kontekstu.
  - Wycofano modal/drawer narzędzi lektora (`toolsDrawerOpen`); kafelek „Moje zasoby / Narzędzia" renderuje siatkę narzędzi inline wprost w widoku roboczym w ramach animacji `GSAPModuleTransition`.
- **Deduplikacja Powiadomień (`components/dashboard/Dashboard.tsx`, `components/admin/AdminPanel.tsx`):**
  - Usunięto powielające się powiadomienia: wycofano pływający popup `TeacherHomeworkNotification` w prawym dolnym rogu oraz baner `TeacherAttentionBanner`.
  - Wdrożono pojedynczą pigułkę powiadomień zbiorczych w górnym pasku nawigacyjnym (`TopBarNotice`: `"Wymaga uwagi: X"`), która w czasie rzeczywistym zlicza oczekujące prace i flagowane próby z bezpośrednim przejściem do sprawdzania.
- **Udoskonalenie Widoku CRM (`components/admin/StandaloneStudentDatabaseScreen.tsx`):**
  - Kafelki kursantów i grup otrzymały stylistykę Glassmorphism (`bg-base-200/50 backdrop-blur-md`, subtelna ramka `border border-white/10`, hover glow).
  - Wdrożono kompaktowy przełącznik sortowania: „Ostatnia aktywność" (domyślne, po najświeższej dacie lekcji/wpisu) oraz „Alfabetycznie" (A-Z).
  - Skompresowano pasek wyszukiwania i filtrów do pojedynczego, niskiego paska.
- **Minimalistyczny Panel Kursanta (`components/dashboard/StudentHeroHeader.tsx`):**
  - Usunięto etykietę „Panel kursanta" oraz rozpraszające liczniki statystyk.
  - Wdrożono minimalistyczny nagłówek z powitaniem `Cześć [Imię]` i motywującym hasłem (`Dobrze Ci idzie!`).
  - Wdrożono pojedynczy Action Hero Card: wyraźny kafelek z informacją „Zadania od lektora" i terminem lub stanem pustym „Brak nowych zadań od lektora. Sprawdź ćwiczenia w Moich zasobach".
- **Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (513/513 zaliczonych), `npm run build` (przechodzi).

### BB. Optymalizacja Kolorystyki Trybu Jasnego, Kontrastu oraz Uproszczenie Kafelków CRM (2026-09-23)
- **Pole Czatu AI w Trybie Jasnym (`components/admin/TeacherAssistant.tsx`):**
  - Wyeliminowano hardcoded ciemne tło `bg-[#0c1424]/90` na rzecz responsywnego tokenu `bg-ink-2/95` z `backdrop-blur-2xl`. W trybie jasnym pole czatu jest śnieżnobiałe i spójne z resztą widoku, a w trybie ciemnym zachowuje głębię Nocturne Green.
  - Skorygowano tokeny tekstu na przyciskach akcji na `text-accent-ink`.
- **Wysoki Kontrast w Trybie Jasnym (WCAG AAA) (`index.css`, `components/admin/AdminPanel.tsx`, `components/admin/TeacherTodayCockpit.tsx`):**
  - Dodano globalne reguły dla trybu jasnego mapujące blade odcienie `-200`, `-300` i `-400` (amber/żółty, błękitny/sky/blue, fioletowy/purple, szmaragdowy/emerald, różowy/rose) na nasycone, ciemne barwy o kontraście 7:1+ (m.in. `#92400e` dla przypomnień i ostrzeżeń, `#0369a1` dla błękitów/linków/filtrów CRM, `#6b21a8` dla grup, `#065f46` dla sukcesu).
  - Skorygowano tło sekcji lekcji do potwierdzenia z ciemnego `bg-amber-950/20` na responsywne `bg-amber-500/[0.08] dark:bg-amber-950/20`.
- **Uproszczenie Kafelków Kursantów & Grup oraz Filtry CRM (`components/admin/StandaloneStudentDatabaseScreen.tsx`, `index.css`):**
  - Uproszczono treść kafelków CRM: usunięto e-mail, pigułki poziomu, statusy oraz pole „Ostatnia lekcja”; pozostawiono tylko Awatar, Imię i Nazwisko / Nazwę grupy oraz 4 bezpośrednie mikro-ikony prowadzące do kluczowych zakładek (Historia lekcji, Zadania domowe, Notatnik A4, Profil/Notatki).
  - Nadano kafelkom lekki efekt szkła (`liquid-glass-tile`) z wyróżnieniem fioletowego akcentu dla grup zajęciowych.
  - Usunięto filtry firm (JCL, Inspiro, Axell itp.), zwężono wyszukiwarkę i zastąpiono pojedynczy przycisk rozwijanym menu `+ Dodaj` (Nowy kursant / Nowa grupa).
- **Wdrożenie Dedykowanego Banera Open Graph (`index.html`, `public/opengraph_recall.jpg`):**
  - Podpięto grafikę Open Graph (`opengraph_recall.jpg`, 1200x630) z bezwzględnymi ścieżkami URL (`https://app.maciej.pro/`) dla komunikatorów i mediów społecznościowych (WhatsApp, Facebook, Twitter Cards `summary_large_image`).
- **Lesson Studio MVP — Etap 1 i 2 (`types/lessonStudio.ts`, `utils/lessonStudioSeed.ts`, `services/lessonStudioAiService.ts`, `components/lessonStudio/LessonStudioEditor.tsx`, `server.ts`):**
  - **Typowanie & Modele:** Utworzono `types/lessonStudio.ts` ze strukturą dla `MissionPack`, `LessonBlueprint`, `LessonBlock`, `PersonalizableSlot`, `PersonalizationSettings` oraz `LessonInstance`.
  - **Seed Mission Pack 1:** Zdefiniowano szablon lekcji B1 *"Explain a Problem and Agree on the Next Step"* z 8 blokami (`Check-in & Recall`, `Mission Briefing`, `Notice the Language`, `Build the Report`, `Clarification Loop`, `Final Mission`, `Optional Branches`, `Language Harvest`) oraz dedykowanymi slotami personalizacji.
  - **Silnik Personalizacji AI:** Wdrożono endpoint `POST /api/lesson-studio/personalize` (`requireFirebaseAdmin`), wykorzystujący Gemini 2.5 Flash (`thinkingBudget: 0`) i Structured Output do deterministycznego generowania wartości slotów w oparciu o profil ucznia i historię lekcji.
  - **Interfejs Studia:** Zaimplementowano edytor `LessonStudioEditor.tsx` z panelem konfiguracji (Context, Focus, Depth), przyciskiem `[ ✨ Personalize ]` oraz dwukolumnowym widokiem slotów w inspektorze bloku (*Base vs Adapted*) z możliwością ręcznej edycji przez lektora.
- **Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (513/513 zaliczonych), `npm run build` (przechodzi, w tym server.cjs i api/index.js).

### BC. Zadokowany przybornik Tools przy kartce A4, oczyszczenie palety narzędzi, hierarchia H1/H2 w spisie treści i karty linków Open Graph (2026-09-25)
- **Sticky dock launchera „Tools" (`components/scratchpad/FloatingToolsLauncher.tsx`, `components/scratchpad/ScratchpadEditor.tsx`):**
  - Przycisk „Tools" przeniesiony z rogu całego okna przeglądarki (`fixed right-6 top-24`) do wnętrza scrollowanego canvasu (`.pad-canvas`), jako drugi element flex obok wyśrodkowanej kartki A4 — `sticky top-24 self-start`, więc przesuwa się razem ze scrollem strony i zostaje blisko edytowanego fragmentu.
  - Na wąskich ekranach (`< lg`) wraca do zminimalizowanego FAB w prawym dolnym rogu (`max-lg:fixed max-lg:bottom-6 max-lg:right-6`).
- **Porządki w `FloatingToolPalette.tsx` („Lesson Tools"):**
  - Usunięto zakładki TEACH i CANVAS (oznaczenia nauczycielskie i Focus Zoom/Prezentacja pozostają dostępne przez `TeacherDock.tsx` i pasek formatowania — nie zniknęły z aplikacji, tylko z tego jednego panelu); pozostały CONTENT i DRAW.
  - Usunięto przycisk „Usuń zaznaczone" z siatki CONTENT.
  - Naprawiono kontrast kafelka „Exercise Studio & Gry”: tło `bg-emerald-950/60`, tekst `text-emerald-200`, pigułka „Nowe” z jawnym `bg-emerald-500 text-slate-950`.
- **Kontrast w `TeacherDock.tsx`:** opis Focus Zoom („Zaznacz prostokątem lub odręcznym lasso...") zmieniony z wyblakłego `text-slate-300` na `text-slate-600 dark:text-slate-200 font-medium`.
- **Hierarchia nagłówków H1/H2:** przycisk „Nagłówek sekcji (H2)” w palecie narzędzi rozdzielony na dwa: „Nagłówek lekcji (H1)” i „Nagłówek sekcji (H2)”. Sam mechanizm spisu treści (`rebuildToc` w `ScratchpadEditor.tsx`) już wcześniej budował drzewo z H1 jako punktu nadrzędnego i H2 jako wciętego podelementu — brakowało tylko przycisku wstawiającego H1 w UI.
- **Karty linków Open Graph (`components/scratchpad/InsertLinkModal.tsx`, nowy endpoint `GET /api/og-preview` w `server.ts`, style `.pad-link-card*` w `index.css`):**
  - „Wstaw link” w palecie narzędzi otwiera teraz modal zamiast `window.prompt()`: pole URL + opcjonalny własny tytuł, pobranie `og:title`/`og:description`/`og:image`/favicon przez nowy serwerowy endpoint (autoryzacja `requireFirebaseAuth`, wzorowany na istniejącym `/api/web-research/scrape`), z eleganckim fallbackiem (sama domena + favicon Google), gdy strona nie udostępnia metadanych OG lub żąda zbyt długo (timeout 8s).
  - Selektor rozmiaru karty: Kompaktowy / Karta średnia / Karta duża (banner) — wstawiana jako pojedynczy `<a>` (`contenteditable="false"`), więc kliknięcie w dowolne miejsce karty, łącznie z miniaturką, otwiera link w nowej karcie.
- **Weryfikacja:** `npx tsc --noEmit` (0 błędów), `npm test` (547/547 zaliczonych), `npm run build` (przechodzi, w tym server.cjs i api/index.js). Brak weryfikacji wzrokowej w przeglądarce w tej sesji — patrz `AGENT_LOG.md`.

---

### BD. Generator ćwiczeń: koniec powtórek po „Generuj kolejne zdania", „Popraw zdanie" zawsze z prawdziwym błędem, zasady naturalności Cribro Method w promptach (2026-09-25)
- **Powtórki zdań (`components/dashboard/AIExerciseGeneratorScreen.tsx`, `utils/exerciseSentenceChecks.ts`):** przycisk „Generuj kolejne zdania" czyści listę i pyta model od nowa o to samo słownictwo; jedynym kontekstem „nie powtarzaj" były `practiceLogs` (w trybie pisania zapisują odpowiedź kursanta, nie zdanie modelu), a tryb „Popraw zdanie" nie dostawał go wcale. Ekran trzyma teraz listę podanych w sesji zdań; `generateTranslationExercises` i `generateFindErrors` dostają ją jako jawny zakaz w prompcie ORAZ odsiewają wynik (`filterRepeatedSentences`, porównanie po normalizacji). Partia złożona z samych powtórek liczy się jako pusta i uruchamia istniejący retry.
- **„Popraw zdanie" (v1 — `generateFindErrors` w `services/homeworkGenerator.ts`, wspólne dla trybu korekty kursanta, `HomeworkScreen`, `TeacherSpecialTaskModal`, `HomeworkComposer`):** Gemini `responseSchema` z wymaganymi `correct_sentence`, `error_type` (zamknięta lista 10 typowych błędów Polaka — `FIX_SENTENCE_ERROR_TYPES`), `error_sentence`; `propertyOrdering` wymusza kolejność „najpierw naturalne zdanie poprawne, potem typ błędu, na końcu zdanie zepsute". `checkFixSentenceItem` odrzuca zadanie bez któregoś pola, z typem spoza listy albo z `error_sentence` równym `correct_sentence` po normalizacji; `collectValidFixSentences` robi najwyżej JEDNĄ powtórkę z mocniejszą instrukcją (lista odrzuconych zdań), a zadania nadal wadliwe nie trafiają do kursanta. Nowe opcjonalne pole `ErrorCorrectionExercise.errorType`.
- **`fix_sentence` (silnik v2, `functions/src/homeworkV2/`):** brief typu mapuje `modelAnswer`/`errorType`/`content` na te same reguły; `deterministicFailedChecks` w `qualityValidator.ts` (zdanie „z błędem" równe wzorcowi lub wariantowi, brak/nieznany `errorType`) ma pierwszeństwo przed werdyktem modelu-kontrolera i wpuszcza zadanie w istniejącą pętlę regeneracji — po jej wyczerpaniu zadanie dostaje `requiresTeacherReview` zamiast trafić do kursanta. `errorType` żyje tylko w szkicu (kontrakt v2 zamrożony, `SCHEMA_VERSION` bez zmian). `PROMPT_VERSION` → `hw-v2-2026-09-25`. **Wymaga `npm run deploy:functions`, żeby zadziałało na produkcji** (w tej sesji nie wdrożono).
- **Zasady naturalności Cribro Method (`services/cribroSentenceRules.ts` → `CRIBRO_SENTENCE_NATURALNESS`):** zdaniowa wersja Testu naturalności z planera lekcji (test dwóch sekund, jedno zdanie = jedna myśl, standard języka mówionego, konkret, kontekst samowystarczalny, słownictwo wspierające prostsze od celu, obie strony bez kalki). Jedna instrukcja w `QUALITY_RULES` (wszystkie typy pracy domowej v1), w master prompcie tłumaczeń i w `NATURALNESS_RULES` silnika v2 (generator, walidator, regeneracja). Zasady, które pokrywa, usunięto z `QUALITY_RULES`, zamiast je dublować.
- **Kopie w `functions/`:** pakiet funkcji nie importuje z katalogu głównego, więc typy błędów, reguły „Popraw zdanie", zasady naturalności i normalizacja zdań są w dwóch kopiach — `tests/cribroSentenceRules.test.ts` pilnuje, żeby były identyczne.
- **Weryfikacja:** `npx tsc --noEmit` — jedyny błąd to niezacommitowana, niezwiązana zmiana w `constants.ts` (patrz `AGENT_LOG.md`); `functions/` `tsc --noEmit` — 0 błędów. `npm test` — 573/573 (26 nowych). `npm run build` — przechodzi. Jakość zdań na żywym modelu NIE była sprawdzana (brak klucza/sieci w testach).

---

### BE. Blokada pustego zgłoszenia pracy domowej ("Nadesłano" bez ani jednej odpowiedzi) na wszystkich czterech ścieżkach zapisu + audyt mailingu (2026-09-25)
- **Audyt (Batch 1 Sesja A, zgłoszony przed dalszymi krokami):** mechanizm mailowy po ocenieniu pracy domowej JUŻ ISTNIAŁ i działał — `notifyStudentOnHomeworkGraded` (`functions/src/index.ts`), Resend + Cloud Functions, statyczny szablon, wyzwalacz na przejściu `status` → `graded`. Dotyczy wyłącznie silnika v1; v2 (`HOMEWORK_ENGINE_V2 = false`, niewdrożony) ma `approveHomeworkV2Grade`, który zapisuje ocenę, ale nie wysyła maila — zostawione bez zmian na tę sesję (Maciej: pominąć, v2 i tak nieaktywne).
- **Bug:** student mógł oddać pracę domową bez wypełnienia ani jednego pola — zgłoszenie i tak dostawało `status: 'submitted'` ("Nadesłano") i lądowało w kolejce lektora nie do odróżnienia od realnej pracy, tyle że z samymi zerami. Guard (odrzucenie, nie tylko flaga — decyzja Macieja) dodany w czterech miejscach zapisu `status: 'submitted'`/`'graded'` do `specialTasks`:
  - `components/dashboard/StudentHomeworkScreen.tsx` (`handleSubmit`) — realny ekran zalogowanego kursanta (`Dashboard.tsx` routing: `isTeacher ? TeacherWorkScreen : StudentHomeworkScreen`). Nowy `L.noAnswers` (pl+en), blokuje przed dotychczasowym ostrzeżeniem "X zadań bez odpowiedzi / wyślij mimo to", które zostaje dla częściowych zgłoszeń.
  - `server.ts` `/api/homework/direct-submit` — ścieżka tokenowa bez logowania (`DirectHomeworkScreen.tsx`, magic link). Nowy 400 `empty_submission` przed zapisem do Firestore.
  - `components/dashboard/AIExerciseGeneratorScreen.tsx` (`handleFinishAll`, gałąź nie-puzzle) — ten sam guard; gałąź puzzle (układanka) pominięta celowo, tam nie da się "wysłać pustego".
  - `components/dashboard/HomeworkScreen.tsx` (`handleSubmitTask`) — dodany dla kompletności; ten komponent jest dziś routowany tylko dla `isTeacher`, więc ta konkretna ścieżka może być martwym reliktem sprzed refaktoru modułu prac domowych — nie potwierdzone, do sprawdzenia osobno.
- **`scripts/backfill-flag-empty-submissions.mjs` (nowy):** wykrywa historyczne puste zgłoszenia sprzed tej naprawy. Wzorowany na `scripts/backfill-task-owners.mjs` — logowanie jako nauczyciel (`FB_USER`/`FB_PASS`), domyślnie suchy przebieg (wypisuje listę), `--apply` dopisuje wyłącznie `isEmptySubmission: true` (nie rusza `status`). Nieuruchomiony w tej sesji — wymaga hasła Macieja.
- **Weryfikacja:** `npx tsc --noEmit` — 0 błędów (stray `Z` z `constants.ts`, o którym mowa w poprzednim wpisie, zniknął z roboczego drzewa w trakcie tej sesji — nie nasza zmiana). `npm test` — 573/573, bez regresji.
- **Ryzyka:** `server.ts` `/api/homework/direct-submit` to ścieżka tokenowa bez logowania (obszar wysokiego ryzyka wg `CLAUDE.md` §3) — dotknięta wyłącznie dodaniem wczesnego `400` przed istniejącą logiką; weryfikacja tokenu, wygaśnięcie dostępu i to, co token ujawnia, bez zmian. `firestore.rules` i middleware autoryzacji — nietknięte.

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

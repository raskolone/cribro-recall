# CRIBRO E-LEARNING & LIVE CLASSROOM — Dokument Architektury, Stanu i Planu Rozwoju

> **Cel dokumentu:** Kompletny przewodnik dla programistów oraz asystentów AI (Antigravity, Cursor, Windsurf, Claude Code, Copilot) opisujący architekturę modułu e-learningu, system prezentacji na żywo z kodem PIN, aktualny stan wdrożenia oraz szczegółową roadmapę kolejnych kroków.

---

## 🎯 1. Wizja i Koncepcja Narzędzia

Celem modułu jest przekształcenie platformy CRIBRO w potężne, autorskie środowisko e-learningowe łączące najlepsze cechy **Articulate 360 / Rise** (bogaty builder, interaktywne materiały multimedialne) oraz **Nearpod / Kahoot** (pokoje lekcyjne na żywo z kodem PIN, synchronizacja wielourządzeniowa, kontrola tempa przez lektora i live odpowiedzi uczniów).

### Główne filary:
1. **Pokoje lekcyjne na kod PIN (`/live` i `/join`)**: Kursant dołącza ze smartfona, tabletu lub laptopa bez konieczności logowania, wpisując jedynie 6-znakowy kod PIN (np. `ABC-123`).
2. **Multi-Device Real-Time Sync**: Zmiana slajdu, odsłonięcie odpowiedzi, minutnik, tablica lektora i notatnik słówek/poprawek są natychmiast synchronizowane na wszystkich ekranach przez Firebase Firestore (`onSnapshot`).
3. **Kreator e-learningowy dla lektora**: 12 wyspecjalizowanych typów slajdów, generator talii z Notion i poziomów CEFR przez AI (Gemini), asystent slajdu, synteza mowy audio TTS.
4. **Tryb Asynchroniczny (Self-Paced)**: Możliwość udostępnienia gotowej prezentacji jako samodzielnego modułu do nauki w domu z automatyczną oceną i zapisem postępów.

---

## 🏗️ 2. Architektura i Przepływ Danych

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ARCHITEKTURA SESJI LIVE                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────────────────────┐   ┌───────────────────────────────────┐
│     PANEL LEKTORA (Presenter)       │   │    WIDOK KURSANTA (Live / PIN)    │
│  - Komponent: PresenterPanel.tsx    │   │  - Komponent: LiveJoinScreen.tsx  │
│  - Przełączanie slajdów             │   │  - Trasa: /live lub /join         │
│  - Odsłanianie odpowiedzi / Hintów  │   │  - Wpisanie 6-znakowego PINu      │
│  - Rysowanie na tablicy / Laser     │   │  - Natychmiastowy odbiór stanu    │
│  - Prowadzenie odliczania           │   │  - Podgląd tablicy ze skalowaniem │
│  - Lista kursantów online na żywo   │   │  - Słówka i poprawki na bieżąco   │
└──────────────────┬──────────────────┘   └─────────────────▲─────────────────┘
                   │                                        │
                   │ (Zapis stanu / push)                   │ (onSnapshot sub)
                   ▼                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│              FIRESTORE REAL-TIME ROOMS (`liveSessions/{pin}`)               │
│  - `pin`: "ABC123", `sessionId`, `teacherUid`, `status`: "active"           │
│  - `currentSlideIndex`: 2, `totalSlides`: 10                                │
│  - `interaction`: { revealedAnswers, highlightedItemId, randomQuestionIndex }│
│  - `whiteboard`: { shapes, width, height }                                  │
│  - `timerEndsAt`: 1726000000                                                │
│  - `liveNotebook`: { vocab: [...], corrections: [...] }                     │
│  - `connectedStudents`: [{ id, name, joinedAt, lastSeenAt }]               │
│  - `revision`: 14                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ 3. Co Zostało Wdrożone do Tej Pory (Faza 1 — COMPLETED)

W systemie działa w pełni funkcjonalna **Faza 1 (Pokoje na PIN & Synchronizacja Chmurowa)**:

### A. Model Danych i Baza Firestore
- **Typy w `types.ts`**:
  - `LiveSession`: kompletny stan sesji w chmurze (slajdy, interakcja, tablica, minutnik, notatnik, lista obecności, status).
  - `LiveSessionStudent`: identyfikator, imię, czas dołączenia i heartbeat `lastSeenAt`.
- **Reguły w `firestore.rules` (`liveSessions/{pin}`)**:
  - Publiczny odczyt pojedynczego dokumentu sesji po znanym kodzie PIN (`allow get: if true;`).
  - Blokada listowania całej kolekcji dla osób niebędących lektorami (`allow list: if isAdmin();`).
  - Uprawnienia zapisu dla lektorów oraz aktualizacji obecności/odpowiedzi dla dołączających kursantów.

### B. Serwis Zarządzania Sesją (`services/liveSessionService.ts`)
- `createLiveSession`: losowanie unikalnego kodu PIN (z alfabetu `CODE_ALPHABET` bez mylących się znaków), inicjalizacja dokumentu w Firestore i synchronizacja kanału lokalnego.
- `subscribeLiveSession`: subskrypcja zmian dokumentu w czasie rzeczywistym (`onSnapshot`).
- `updateLiveSessionState`: debounced / natychmiastowy push zmian stanu (slajd, odpowiedzi, rysunek, notatki).
- `joinLiveSession` & `heartbeatLiveSession`: rejestracja obecności kursanta i okresowy ping co 25s.
- `endLiveSession`: zamknięcie pokoju i powiadomienie połączonych uczestników.
- `buildLiveSessionUrl`: tworzenie gotowego linku `https://domena/live?pin=ABC123`.

### C. Ekran Kursanta (`components/presentation/LiveJoinScreen.tsx`)
- Podpięty w `App.tsx` pod ścieżki `/live`, `/join` oraz `/live?pin=...` (bez konieczności logowania).
- Pola na kod PIN oraz imię/pseudonim kursanta (z zapamiętywaniem w `localStorage`).
- Responsywny widok aktywnego slajdu z synchronizacją odsłoniętych elementów.
- Skalowanie rysunków z tablicy lektora (`Whiteboard`) do wymiarów ekranu kursanta.
- Wskaźnik laserowy lektora, minutnik i bieżący notatnik słówek oraz poprawek gramatycznych.
- Ekran podsumowania po zakończeniu sesji przez nauczyciela.

### D. Panel Prowadzącego (`components/admin/presentation/PresenterPanel.tsx`)
- Przycisk **„Uruchom sesję Live (PIN)”** w nagłówku panelu prezentera.
- Modal z dużym kodem PIN, przyciskami kopiowania linku/PINu oraz listą kursantów obecnych na żywo.
- Równoległa obsługa:
  1. Sesji chmurowej na PIN (dla kursantów zdalnych na ich urządzeniach).
  2. Lokalnego okna `/present` (przez `BroadcastChannel` do screen-sharingu na jednym komputerze).

---

## 📋 4. Plan Dalszego Rozwoju (Kolejne Fazy)

### 🔹 Faza 2: Dwukierunkowa Interaktywność (Live Quizzes & Real-time Answers)
- **Cel:** Kursant może aktywnie klikać opcje w quizach, uzupełniać luki w zdaniach i przesyłać odpowiedzi na swoim urządzeniu.
- **Zakres prac:**
  1. Dodanie pola `studentResponses: Record<slideId, Record<studentId, { answer, isCorrect, submittedAt }>>` do `LiveSession`.
  2. Odblokowanie interaktywności w `SlideCard.tsx` po stronie kursanta w trybie quizu (`exerciseType: 'fill-gap' | 'multiple-choice' | 'transform'`).
  3. Live Dashboard wyników u lektora: wykres rozkładu odpowiedzi na żywo (jak w Mentimeter) lub lista poprawnych/błędnych odpowiedzi uczniów.

### 🔹 Faza 3: Ulepszenia Kreatora E-Learningu (Authoring Tool jak Articulate)
- **Cel:** Jeszcze szybsze i bardziej elastyczne tworzenie prezentacji i modułów wiedzy.
- **Zakres prac:**
  1. Drag & Drop zmiana kolejności slajdów w lewym pasku nawigacji.
  2. Generowanie wymowy audio TTS dla całych bloków słownictwa (zapis w Firebase Storage).
  3. Gotowe szablony modułów lekcyjnych (*Business English Meeting, Negotiation, Phrasal Verbs, Job Interview*).
  4. Wzbogacony edytor blokowy (tabele fonetyczne, karty 'Callout', diagramy).

### 🔹 Faza 4: Tryb Asynchroniczny (Self-Paced E-Course & Export)
- **Cel:** Prezentacja jako samodzielny kurs e-learningowy do przerobienia w domu.
- **Zakres prac:**
  1. Tryb `student-paced`: kursant sam przechodzi slajdy, rozwiązuje ćwiczenia i otrzymuje punkty.
  2. Automatyczny zapis wyników do profilu ucznia (`users/{studentId}/practiceLogs`).
  3. Przycisk **„Konwertuj do Pracy Domowej”**: jednym kliknięciem lektor zamienia nierozwiązane slajdy w oficjalne zadanie domowe Cribro z powiadomieniem e-mail.

### 🔹 Wizja Długoterminowa (Wirtualna Klasa Wideo + AI Meeting Notes)
- Integracja wideo WebRTC przez **LiveKit Cloud** (`@livekit/components-react`).
- Strumieniowa transkrypcja rozmowy na żywo (Deepgram Nova-2) z automatycznym wyciąganiem błędów i słówek bezpośrednio do 4 bloków Notion.

---

## 🛠️ 5. Kluczowe Pliki Źródłowe Modułu

| Plik | Rola w Systemie |
| :--- | :--- |
| `types.ts` | Definicje `LiveSession`, `LiveSessionStudent`, `LessonPresentation`, `PresentationSlide`. |
| `firestore.rules` | Reguły bezpieczeństwa dla kolekcji `liveSessions/{pin}`. |
| `services/liveSessionService.ts` | Logika tworzenia, subskrypcji, aktualizacji i zamykania sesji na PIN w Firestore. |
| `components/presentation/LiveJoinScreen.tsx` | Główny widok kursanta pod `/live` i `/join` (formularz PIN + podgląd na żywo). |
| `components/admin/presentation/PresenterPanel.tsx` | Panel lektora: start sesji, modal z kodem PIN, lista obecności kursantów online. |
| `components/admin/presentation/LessonPresentationView.tsx` | Główny kontener prezentacji, tablicy, notatnika i edytora slajdów. |
| `components/admin/presentation/SlideCard.tsx` | Silnik renderowania 12 typów slajdów i interaktywnych zadań. |
| `components/admin/presentation/Whiteboard.tsx` | Wektorowa tablica do rysowania nad slajdami. |
| `utils/accessCode.ts` | Bezpieczne generowanie, formatowanie i walidacja 6-znakowych kodów PIN. |
| `App.tsx` | Konfiguracja routingu dla `/live` i `/join` przed ekranem logowania. |

---

## 🧪 6. Standard Weryfikacji Kodu

Przed wdrożeniem jakichkolwiek kolejnych zmian uruchom standardowe polecenia testowe:
```bash
# 1. Sprawdzenie typowania TypeScript:
npx tsc --noEmit

# 2. Testy jednostkowe (144 testy):
npm test

# 3. Budowanie produkcyjne:
npm run build
```

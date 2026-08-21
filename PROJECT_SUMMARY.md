# Podsumowanie Projektu: VocabBoost / Cribro

Zaawansowana platforma edukacyjna do nauki języka angielskiego oparta na AI (Google Gemini + OpenAI) oraz wielopoziomowym silniku syntezy mowy (ElevenLabs / OpenAI TTS / GCP).

> **Szczegółowa, kompletna dokumentacja techniczna i funkcjonalna znajduje się w pliku: [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**

---

## 🛠 Technologie i Architektura

- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, React Markdown, Canvas Confetti.
- **Backend & Baza Danych**: Node.js / Express.js (`server.ts`), Firebase Firestore (baza danych w czasie rzeczywistym), Firebase Auth, Firebase Admin SDK, Firebase Storage (cache audio).
- **Sztuczna Inteligencja (Multi-Tier AI Pipeline)**:
  - Google Gemini 2.5 Flash / Gemini 3.6 Flash / Gemini 3.1 Flash TTS
  - OpenAI GPT-4o-mini / GPT-4o / GPT-4-turbo jako niezawodny fallback
  - Structured JSON schemas i automatyczna naprawa formatowania
- **Synteza mowy (TTS Multi-Tier Caching)**:
  - ElevenLabs Multilingual V2 (profesjonalne głosy US i UK)
  - OpenAI TTS (`tts-1`)
  - Google Cloud Text-to-Speech / Gemini Flash TTS
  - Podwójny cache audio: lokalny dysk serwera (`/tmp/tts_cache`) + Firebase Storage Bucket

---

## 👥 Role Użytkowników

1. **Kursant (`user`)**: Panel nauki, interaktywne prace domowe z oceną AI, generator ćwiczeń, fiszki Spaced Repetition (SRS), historia własnych lekcji, egzaminy i testy z limitem podejść, statystyki postępów i coaching metodyczny AI.
2. **Nauczyciel (`teacher`)**: Tworzenie i edycja lekcji, przypisywanie zestawów słownictwa, generator prac domowych z lekcji, generator testów AI, sprawdzanie egzaminów, analityka postępów kursantów.
3. **Administrator (`admin`)**: Pełne zarządzanie użytkownikami (tworzenie, zmiana haseł, usuwanie kont), diagnostyka błędów (Bug Reports), globalna baza tematów i zasobów.

---

## 🚀 Główne Moduły i Funkcjonalności

### 1. Panel Kursanta (Dashboard)
- **Streaki i statystyki:** Śledzenie dni nauki z rzędu oraz przetłumaczonych zdań.
- **Powiadomienia Real-time (`StudentNotifications`):** Wyskakujące okna o nowych lekcjach, zadaniach domowych i testach.
- **Baner zadań oczekujących:** Błyskawiczny skrót do nierozwiązanych prac domowych.
- **Onboarding Tour:** Interaktywny przewodnik po platformie dla nowych kursantów.

### 2. Moduł Pracy Domowej (`HomeworkScreen`)
- Zadania przypisane przez lektora oraz wygenerowane automatycznie z lekcji.
- Tryby: tłumaczenie zdań, znajdowanie błędów, uzupełnianie luk, układanie zdań (Puzzle).
- Natychmiastowa ocena AI i możliwość weryfikacji/dodania uwag przez lektora.

### 3. Generator Ćwiczeń AI (`AIExerciseGeneratorScreen`)
- Generowanie spersonalizowanych ćwiczeń na podstawie zrealizowanych lekcji lub trudnych słówek.
- Szczegółowy feedback po polsku: ocena 0–100%, rozbicie na znaczenie, gramatykę i leksykę, sugerowana wersja native-speakera, wymowa audio.

### 4. Fiszki i Spaced Repetition (`FlashcardStudyScreen` & `FlashcardSetsScreen`)
- Inteligentny algorytm powtórek przestrzennych (SRS).
- Tryb nauki z oceną trudności i wyliczaniem terminów powtórek.
- Tryb prezentacji pełnoekranowej do zajęć z lektorem.
- Odsłuchiwanie audio każdego słowa i zdania przykładowego.

### 5. Historia Lekcji Kursanta (`LessonHistoryScreen`)
- Chronologiczny rejestr zajęć: temat, słownictwo, notatki, co poprawić, zadania sugerowane.
- **1-Click AI Homework:** Generowanie pracy domowej ze słownictwa z danej lekcji jednym kliknięciem.

### 6. Testy i Egzaminy (`StudentTestsScreen`, `TakeTestScreen`)
- Obsługa pytań wielokrotnego wyboru, luk, banku słów, tłumaczeń, łączenia w pary, pisania (*writing*) i znajdowania błędów.
- Automatyczne sprawdzanie przez AI z oceną punktową i motywującym komentarzem.

### 7. Statystyki i Raport Postępów (`StudentStatsScreen`)
- Wykresy dokładności i historii sesji.
- **AI Pedagogical Coach:** Inteligentny asystent metodyczny wskazujący mocne strony, typowe błędy i praktyczne porady dydaktyczne.

### 8. Panel Zarządzania i Narzędzia Lektora (`AdminPanel`)
- **Dziennik lekcji:** Dodawanie, edycja i import notatek z Google Meet / Zoom.
- **AI Batch Import:** Masowe wczytywanie historii lekcji z plików PDF / Google Docs z automatycznym dopasowaniem kursantów.
- **Generator Testów AI (`AdminTestGenerator`):** Tworzenie kompleksowych testów w oparciu o profil kursanta i odbyte lekcje, z podglądem i edycją pytań.
- **Centrum Sprawdzania Testów (`AllTestsTeacherView`):** Wgląd w wyniki, odpowiedzi uczniów i wystawione oceny.
- **Baza Tematów (`TopicDatabaseScreen`):** Repozytorium gotowych materiałów dydaktycznych.
- **Moduł Zgłaszania Błędów (`BugReports` / `AdminDebuggingScreen`):** Bezpośrednia komunikacja techniczna i diagnostyka.

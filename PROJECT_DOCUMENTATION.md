# VocabBoost / Cribro — Kompletna Dokumentacja i Podsumowanie Aplikacji

> **Wersja:** 2.4.0  
> **Status:** Wdrożona i działająca produkcyjnie  
> **Główne przeznaczenie:** Zaawansowana, inteligentna platforma edukacyjna do nauki języka angielskiego dla szkół językowych, lektorów oraz kursantów, napędzana sztuczną inteligencją (Google Gemini + OpenAI) oraz wielopoziomowym silnikiem mowy (TTS ElevenLabs / OpenAI / GCP).

---

## Spis Treści
1. [Wizja i Przeznaczenie Systemu](#1-wizja-i-przeznaczenie-systemu)
2. [Architektura Technologiczna (Tech Stack)](#2-architektura-technologiczna-tech-stack)
3. [Backend i Usługi Serwerowe](#3-backend-i-usługi-serwerowe)
4. [Silnik Sztucznej Inteligencji (AI Pipeline)](#4-silnik-sztucznej-inteligencji-ai-pipeline)
5. [Silnik Mowy Text-to-Speech (TTS)](#5-silnik-mowy-text-to-speech-tts)
6. [Role i Uprawnienia Użytkowników](#6-role-i-uprawnienia-użytkowników)
7. [Szczegółowy Opis Modułów Kursanta](#7-szczegółowy-opis-modułów-kursanta)
8. [Szczegółowy Opis Modułów Nauczyciela i Administratora](#8-szczegółowy-opis-modułów-nauczyciela-i-administratora)
9. [Baza Danych Firestore i Bezpieczeństwo](#9-baza-danych-firestore-i-bezpieczeństwo)
10. [Podsumowanie i Gotowość Wdrożeniowa](#10-podsumowanie-i-gotowość-wdrożeniowa)

---

## 1. Wizja i Przeznaczenie Systemu

**VocabBoost (Cribro)** łączy bezpośrednią współpracę kursanta z lektorem z możliwościami nowoczesnych modeli językowych (LLM). 

Główne założenia platformy:
- **Automatyzacja pracy lektora:** Od tworzenia notatek z lekcji, przez wyodrębnianie słownictwa, aż po błyskawiczne generowanie spersonalizowanych prac domowych i testów sprawdzających.
- **Kontekstowa nauka kursanta:** Ćwiczenia, fiszki, powtórki i prace domowe nie bazują na przypadkowych słówkach, lecz ściśle na **autentycznych materiałach i notatkach z odbytych lekcji**.
- **Wielopoziomowa ocena językowa:** AI nie tylko sprawdza poprawność tłumaczenia, ale ocenia zdanie w 3 kategoriach (znaczenie, gramatyka, słownictwo), sugeruje bardziej naturalne konstrukcje native-speakerów i wyjaśnia błędy w języku polskim.
- **Spaced Repetition (SRS):** Inteligentny algorytm powtórek przestrzennych dbający o długotrwałe zapamiętywanie słownictwa.

---

## 2. Architektura Technologiczna (Tech Stack)

### Frontend
- **Framework:** React 18+ (Functional Components, Hooks, Context API)
- **Język:** TypeScript (ścisłe typowanie interfejsów i modeli danych)
- **Bundler & Dev Server:** Vite
- **Styling:** Tailwind CSS (nowoczesny, ciemny motyw, dopracowana hierarchia wizualna, pełna responsywność RWD)
- **Komponenty & Ikony:** Lucide React
- **Wizualizacja danych:** Recharts (wykresy kołowe, słupkowe i liniowe postępów)
- **Formatowanie treści:** React Markdown (eleganckie renderowanie formatowania tekstu z modeli AI)
- **Efekty wizualne:** Canvas Confetti (nagradzanie ukończonych zadań i testów)

### Backend & Integracje
- **Serwer aplikacyjny:** Express.js (`server.ts`) zintegrowany z middleware Vite
- **Baza danych & Auth:** Firebase Firestore + Firebase Authentication + Firebase Admin SDK
- **Przechowywanie plików i audio:** Firebase Storage Bucket + lokalny cache serwerowy
- **Przetwarzanie dokumentów:** `pdf-parse` (ekstrakcja tekstu z plików PDF) + integracja Google Drive API
- **Sztuczna Inteligencja:** 
  - `@google/genai` (Google Gemini 2.5 Flash, Gemini 3.6 Flash, Gemini 3.1 Flash TTS)
  - OpenAI API (GPT-4o-mini, GPT-4o, GPT-4-turbo) jako automatyczny fallback
- **Synteza mowy:** ElevenLabs Multilingual V2, OpenAI TTS (`tts-1`), Google Cloud TTS

---

## 3. Backend i Usługi Serwerowe

Serwer Express (`/server.ts`) stanowi bezpieczne proxy oraz centrum operacyjne dla operacji wymagających uprawnień administracyjnych lub kluczy API:

1. **Zarządzanie Użytkownikami (`/api/admin-users/*`):**
   - Bezpieczne listowanie użytkowników przez Firebase Admin SDK (`listUsers`).
   - Tworzenie nowych kont kursantów z automatyczną generacją haseł tymczasowych.
   - Zmiana haseł i aktualizacja ról (`setCustomUserClaims`).
   - Usuwanie kont kursantów i czyszczenie powiązanych danych.

2. **Generowanie Testów AI (`/api/gemini/generate-test`):**
   - Przygotowanie wielozadaniowych sprawdzianów na podstawie profilu ucznia i historii lekcji.
   - Wbudowana dwuetapowa weryfikacja logiczna zadań (generowanie + audyt jakości).

3. **Wsadowy Import Lekcji (`/api/gemini/import-lessons-batch`):**
   - Analiza plików PDF, dokumentów tekstowych oraz Google Docs.
   - Błyskawiczne wyodrębnianie dat, tematów, notatek gramatycznych, słówek i zaleceń dla wielu lekcji jednocześnie.

4. **Podsumowywanie Spotkań i Lekcji (`/api/gemini/lesson-summary`):**
   - Konwersja surowej transkrypcji ze spotkania online (Google Meet, Zoom) na ustrukturyzowany wpis lekcyjny.

5. **Sprawdzanie i Ocena Egzaminów (`/api/gemini/grade-test`):**
   - Automatyczna analiza odpowiedzi ucznia z wyrozumiałością na interpunkcję i dogłębną oceną wypowiedzi pisemnych (*writing*).

6. **Raport Metodyczny i Coaching AI (`/api/gemini/student-stats-summary`):**
   - Generowanie profesjonalnego komentarza lektorskiego, mocnych stron, obszarów do poprawy i wskazówek dydaktycznych na podstawie logów ćwiczeń.

7. **Synteza Mowy (`/api/tts`):**
   - Zapewnia naturalne audio dla słówek i zdań w akcencie amerykańskim (US) oraz brytyjskim (UK).

---

## 4. Silnik Sztucznej Inteligencji (AI Pipeline)

Platforma posiada odporny na awarie, wielopoziomowy system zapytań AI:

```
[ Żądanie z Frontendu ]
         │
         ▼
[ Poziom 1: OpenAI GPT-4o-mini / GPT-4o ] ────(Sukces)────► [ Zwrot do Użytkownika ]
         │ (Brak klucza / Limit 429 / Błąd)
         ▼
[ Poziom 2: Google Gemini 2.5 Flash ] ────────(Sukces)────► [ Zwrot do Użytkownika ]
         │ (Limit / Błąd)
         ▼
[ Poziom 3: Gemini 3.6 Flash / Fallback ] ────(Sukces)────► [ Zwrot do Użytkownika ]
```

### Kluczowe Właściwości AI:
- **Restrykcyjne Schematy JSON (Structured Outputs):** Wszystkie generowane zadania, testy i analizy są ściśle walidowane z użyciem schematów typów, eliminując błędy parsowania.
- **Kompensacja formatowania:** Automatyczne usuwanie znaczników Markdown przed parsowaniem JSON (`extractJSON`).
- **Pamięć Błędów Ucznia:** Analizator słabych stron kursanta (`getUserWeaknesses`) wyszukuje powtarzające się pomyłki gramatyczne i leksykalne z wcześniejszych sesji, wplatając je w nowe ćwiczenia.

---

## 5. Silnik Mowy Text-to-Speech (TTS)

System wymowy słownictwa i zdań przykładowych wyposażony jest w 3 poziomy generowania oraz 2-poziomowy bufor pamięci:

1. **Podwójny Cache:**
   - **Local Disk Cache (`/tmp/tts_cache`):** Czas odpowiedzi ~5 ms dla wcześniej wygenerowanych nagrań.
   - **Firebase Storage Cache:** Trwałe przechowywanie plików MP3 w chmurze — raz wygenerowane słówko jest dostępne dla wszystkich użytkowników bez dodatkowych kosztów API.
2. **Kaskada Dostawców TTS:**
   - **Tier 1:** ElevenLabs Multilingual V2 (profesjonalne głosy: George/Alice dla UK, Drew/Rachel dla US).
   - **Tier 2:** OpenAI TTS (`tts-1` z głosami: fable, shimmer, echo, nova).
   - **Tier 3:** Google Cloud Text-to-Speech Neural2 / Gemini Flash TTS Preview.

---

## 6. Role i Uprawnienia Użytkowników

Platforma obsługuje 3 role użytkowników z dedykowanymi widokami i uprawnieniami:

| Rola | Dostępne Widoki i Funkcje |
| :--- | :--- |
| **Kursant (`user`)** | Dashboard, Zadania Domowe, Generator Ćwiczeń AI, Fiszki i Powtórki SRS, Historia Swoich Lekcji, Egzaminy i Testy, Statystyki Postępów, Zgłaszanie Błędów. |
| **Nauczyciel (`teacher`)** | Wszystkie moduły kursanta + Podgląd profilu każdego ucznia, Tworzenie i edycja lekcji, Zadawanie prac domowych, Przypisywanie zestawów słówek, Generator Testów, Przegląd wyników egzaminów, Dostęp do analityki lektorskiej. |
| **Administrator (`admin`)** | Pełne uprawnienia Nauczyciela + Tworzenie/usuwanie kont lektorów i kursantów, Zarządzanie hasłami i dostępem, Debugger i logi błędów aplikacji, Globalna baza tematów i zasobów edukacyjnych. |

---

## 7. Szczegółowy Opis Modułów Kursanta

### 7.1. Ekran Główny (Dashboard)
- **Status i Streaki:** Licznik dni regularnej nauki z rzędu oraz łączna liczba przetłumaczonych zdań.
- **Powiadomienia w czasie rzeczywistym:** Wyskakujące okna z informacją o nowej lekcji, przypisanej pracy domowej lub teście.
- **Baner zadań:** Szybki skrót do najświeższych zadań domowych z możliwością natychmiastowego rozpoczęcia.
- **Onboarding Tour:** Przewodnik krok-po-kroku wprowadzający nowego użytkownika w kluczowe funkcje aplikacji.

### 7.2. Moduł Pracy Domowej (`HomeworkScreen`)
- Obsługa zadań przypisanych przez nauczyciela oraz zadań wygenerowanych na podstawie lekcji.
- **Typy ćwiczeń domowych:**
  - *Tłumaczenie zdań:* Wpisywanie tłumaczenia z natychmiastową oceną AI.
  - *Wyszukiwanie i poprawianie błędów:* Identyfikacja i korekta błędnych zdań.
  - *Uzupełnianie luk (Fill in the Blanks):* Wpisywanie brakujących słów w kontekście.
  - *Układanka słowna (Puzzle):* Układanie zdań z rozsypanych klocków słownych.
- **Automatyczna i ręczna ocena:** Po ukończeniu zadanie otrzymuje status `completed`, a nauczyciel ma wgląd w odpowiedzi ucznia i może dodać własny komentarz lub ocenę.

### 7.3. Generator Ćwiczeń AI (`AIExerciseGeneratorScreen`)
- Wybór źródła materiału: konkretna lekcja, zestaw słówek, praca domowa lub ogólna baza.
- Wybór poziomu trudności (A1-A2, B1-B2, C1-C2) oraz liczby zdań (5, 10, 15, 20).
- **Szczegółowy Feedback po każdym zdaniu:**
  - Wynik punktowy 0–100%.
  - Podział oceny: *Meaning* (znaczenie), *Grammar* (gramatyka), *Vocabulary* (leksyka).
  - Wskazanie ulepszonej, bardziej naturalnej wersji zdania.
  - Wyjaśnienie gramatyczne po polsku.
  - Odtwarzanie poprawnej wymowy przez TTS.

### 7.4. Moduł Fiszek i Spaced Repetition (`FlashcardStudyScreen` & `FlashcardSetsScreen`)
- Przeglądanie zestawów słownictwa powiązanych z lekcjami oraz zestawów własnych.
- **Tryb Nauki (SRS):**
  - Inteligentne algorytmy powtórek przestrzennych (ocena trudności: Znowu, Trudne, Dobre, Łatwe).
  - Automatyczne wyliczanie kolejnego terminu powtórki.
  - Odsłuchiwanie audio dla każdego słowa i zdania przykładowego.
- **Tryb Prezentacji:** Pełnoekranowy tryb do nauki słówek lub pracy z lektorem podczas zajęć.

### 7.5. Historia Lekcji Kursanta (`LessonHistoryScreen`)
- Chronologiczny spis wszystkich odbytych zajęć z lektorem.
- Szczegóły każdej lekcji: Data, Temat, Omówione słownictwo, Notatki i teoria, Uwagi do wypowiedzi (*Student Speaking*), Rzeczy do poprawy (*Things to improve*), Zadania na przyszłość.
- **Przycisk 1-Click AI Homework:** Możliwość natychmiastowego wygenerowania interaktywnej pracy domowej ze słownictwa z danej lekcji.

### 7.6. Egzaminy i Testy (`StudentTestsScreen`, `TakeTestScreen`)
- Sprawdziany przygotowane przez lektora.
- Obsługa wielu typów pytań w jednym teście:
  - Pytania wielokrotnego wyboru (*Multiple Choice*).
  - Luki w tekście (*Fill in the Blanks*).
  - Bank słów do wstawienia (*Word Bank*).
  - Tłumaczenia zdań (*Sentence Translation*).
  - Łączenie w pary (*Matching Pairs*).
  - Dłuższa forma pisemna (*Writing*).
  - Znajdowanie błędów (*Find Mistake*).
- Zabezpieczenie przed przekroczeniem limitu podejść.
- Podsumowanie z oceną punktową, procentową oraz motywującym feedbackiem lektorskim wygenerowanym przez AI.

### 7.7. Statystyki i Raport Postępów (`StudentStatsScreen`)
- Wykresy dokładności i aktywności w czasie.
- Rozkład opanowania słownictwa (Nowe, W trakcie nauki, Opanowane).
- **AI Pedagogical Coach:** Zintegrowany moduł analityczny, który na bieżąco analizuje historię błędów kursanta i tworzy syntetyczny raport:
  - Główne atuty językowe,
  - Zagadnienia sprawiające trudność,
  - Konkretna porada dydaktyczna.

---

## 8. Szczegółowy Opis Modułów Nauczyciela i Administratora

### 8.1. Panel Zarządzania Kursantami (`AdminPanel`)
- Lista wszystkich kursantów z podglądem poziomu, daty ostatniego logowania i aktywności.
- Tworzenie nowych kont kursantów z automatycznym hasłem startowym.
- Możliwość zresetowania hasła, zawieszenia konta lub usunięcia profilu.
- Przełącznik aktywnego ucznia: Lektor może jednym kliknięciem przełączyć kontekst panelu na wybranego kursanta.

### 8.2. Dziennik Lekcji i Import AI
- Formularz dodawania i edycji pojedynczej lekcji z polami: data, temat, notatki, słówka, uwagi lektora.
- **AI Batch Import (Import Masowy):**
  - Wgrywanie plików PDF lub dokumentów Google Docs zawierających historię wielu lekcji.
  - Automatyczne parsowanie i przypisywanie lekcji do właściwych kursantów w bazie danych.
- **AI Meeting Notes to Lesson:** Wklejenie transkrypcji ze spotkania online i automatyczne wygenerowanie kompletnego wpisu lekcyjnego w kilka sekund.

### 8.3. Kreator Prac Domowych (`TeacherSpecialTaskModal`)
- Wybór ucznia (lub opcja przypisania do wszystkich kursantów).
- Wybór typu zadania: Tłumaczenia, Wyszukiwanie błędów, Uzupełnianie luk.
- Wybór zakresu materiału: na podstawie konkretnej lekcji, zestawu słówek lub własnych wytycznych.
- Natychmiastowa synchronizacja: Po utworzeniu zadania kursant otrzymuje powiadomienie w czasie rzeczywistym.

### 8.4. Zaawansowany Generator Testów (`AdminTestGenerator`)
- Tworzenie egzaminów na podstawie historii lekcji, profilu kursanta lub załączonych plików PDF.
- Konfiguracja proporcji typów zadań (np. 4 tłumaczenia, 6 luk z bankiem słów, 1 wypowiedź pisemna).
- **Edytor i Podgląd Testu (`TestEditModal`, `TestPreviewModal`):** Lektor przed wysłaniem testu może edytować każde pytanie, zmienić punktację, podpowiedzi lub poprawne odpowiedzi.
- Ustalanie limitu podejść i terminu oddania (*Due Date*).

### 8.5. Centrum Oceniania i Wglądu w Testy (`AllTestsTeacherView`)
- Zbiorcza tabela wszystkich testów wysłanych i rozwiązanych przez uczniów.
- Podgląd odpowiedzi każdego ucznia, punktacji cząstkowej oraz wygenerowanego przez AI feedbacku.
- Możliwość ręcznej korekty oceny i dopisania własnych uwag lektorskich.

### 8.6. Baza Tematów i Zasobów Edukacyjnych (`TopicDatabaseScreen`)
- Centralne repozytorium gotowych materiałów, zagadnień gramatycznych i planów lekcji.
- Możliwość szybkiego przypisania gotowego tematu do planu zajęć dowolnego ucznia.

### 8.7. Moduł Diagnostyczny i Zgłoszenia Błędów (`AdminDebuggingScreen`)
- Rejestr zgłoszeń błędów przesłanych przez użytkowników za pomocą wbudowanego formularza *Report Bug*.
- Podgląd kontekstu błędu, roli użytkownika, ścieżki i statusu zgłoszenia (*new*, *investigating*, *resolved*).

---

## 9. Baza Danych Firestore i Bezpieczeństwo

Aplikacja wykorzystuje Cloud Firestore z rygorystycznymi regułami bezpieczeństwa (`firestore.rules`):

```
/users/{userId}                       ── Profile użytkowników, role, statystyki, flagi powiadomień
/users/{userId}/tests/{testId}        ── Testy i sprawdziany przypisane do danego kursanta
/users/{userId}/practiceLogs/{logId}  ── Historia rozwiązanych ćwiczeń i szczegółowy feedback AI
/specialTasks/{taskId}                ── Prace domowe i zadania specjalne
/lessonRecords/{recordId}             ── Dziennik lekcji z notatkami i słownictwem
/vocabularySets/{setId}               ── Zestawy słówek wygenerowane z lekcji
/flashcardSets/{setId}                ── Zestawy fiszek do nauki
/flashcardSets/{setId}/cards/{cardId} ── Poszczególne fiszki ze słownictwem i zdaniami
/studySessions/{sessionId}            ── Zapisane sesje nauki fiszek
/bugReports/{reportId}                ── Zgłoszenia błędów od użytkowników
```

### Bezpieczeństwo i Uprawnienia:
- **Zabezpieczenie ról:** Tylko konta z rolą `admin` lub `teacher` mają prawo tworzyć lekcje, przypisywać testy oraz zarządzać kontami.
- **Izolacja danych kursanta:** Kursanci mają dostęp wyłącznie do swoich własnych logów, fiszek, testów i zadań.
- **Powiadomienia Real-Time:** Zastosowanie nasłuchiwaczy `onSnapshot` gwarantuje natychmiastową aktualizację interfejsu kursanta bez konieczności przeładowywania strony po akcji nauczyciela.

---

## 10. Podsumowanie i Gotowość Wdrożeniowa

Aplikacja **VocabBoost / Cribro** stanowi w pełni funkcjonalny, kompleksowy system edukacyjny klasy produkcyjnej. Wszystkie kluczowe obszary zostały zaimplementowane, przetestowane i zoptymalizowane:

1. ✅ **Pełna ścieżka kursanta:** od nauki fiszek, przez ćwiczenia z AI, po rozwiązywanie prac domowych i egzaminów.
2. ✅ **Kompletny pulpit lektora:** zarządzanie kursantami, masowy import notatek, automatyczne generowanie zadań i wgląd w analitykę.
3. ✅ **Wysoka odporność infrastruktury AI:** wielopoziomowy fallback modeli (OpenAI + Gemini) eliminujący przestoje w działaniu.
4. ✅ **Profesjonalna synteza mowy:** integracja z ElevenLabs, OpenAI i Google Cloud z buforowaniem plików audio.
5. ✅ **Nowoczesny design i responsywność:** dopracowany interfejs graficzny w ciemnej tonacji, zgodny z zasadami dostępności i ergonomii.

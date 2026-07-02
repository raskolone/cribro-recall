# Podsumowanie Projektu: Aplikacja do Nauki Języka Angielskiego z AI

Poniżej znajduje się zestawienie dotychczas wdrożonych funkcji oraz ogólnej architektury aplikacji.

## 🛠 Technologie i Architektura
- **Frontend**: React (18+), TypeScript, Vite, Tailwind CSS.
- **Backend & Baza Danych**: Firebase (Firestore, Firebase Auth) - chmurowa, trwała pamięć danych dla użytkowników.
- **AI**: Integracja z Google Gemini API (wykorzystywane m.in. do generowania zadań domowych oraz sprawdzania ćwiczeń tłumaczeniowych).
- **Inne biblioteki**: `recharts` (wykresy), `react-markdown` (renderowanie formatowania tekstu AI).

## 👥 Role Użytkowników
- **Kursant (Użytkownik)**: Ma dostęp do swojego panelu nauki, postępów, zadań domowych, historii lekcji oraz zestawów fiszek.
- **Nauczyciel (Admin)**: Posiada dedykowany "Panel Administratora", gdzie może zarządzać użytkownikami, sprawdzać ich postępy oraz dodawać/edytować lekcje.

## 🚀 Główne Funkcjonalności

### 1. Panel Główny Kursanta (Dashboard)
- **Moje Zadania Domowe (Assigned Tasks)**: Lista zestawów i zadań domowych przypisanych przez nauczyciela, z pulsującym powiadomieniem dla elementów nowych/jeszcze nieotwartych.
- **Historia Lekcji (Lesson History)**: Chronologiczna lista przebytych lekcji (dodawanych przez nauczyciela) zawierająca temat, podsumowanie oraz przerobione słownictwo.
  - **Generowanie pracy domowej przez AI**: Kursant ma możliwość wygenerowania spersonalizowanych ćwiczeń domowych (tłumaczenia, pytania otwarte) na podstawie przerobionej lekcji, za pomocą jednego przycisku.
- **Postępy w nauce (Learning Progress)**: Zwijany (chowany) panel ze statystykami. Wyświetla łączną liczbę słów, statystyki powtórek (Spaced Repetition) oraz wykresy rozkładu materiału i opanowania (Mastery Level).
- **Generator Słownictwa**: Oparte na AI narzędzie do wyszukiwania, tłumaczenia i generowania słówek wraz z przykładowymi zdaniami.
- **Lista Słówek**: Moduł pozwalający przeglądać zapisane słówka, zarządzać nimi i oznaczać je jako trudne.

### 2. Nauka i Fiszki ("Ucz się")
- **Zarządzanie Zestawami**: Przeglądanie własnych zestawów, materiałów z konkretnych lekcji oraz zadań stricte domowych od nauczyciela.
- **Tryb Nauki**: Możliwość szybkiego odpytania z materiału (Fiszki).
- **Ukryty Moduł Treningu**: (Tymczasowo wygaszony w menu głównym – fundament przygotowany pod quizy i zaawansowane ćwiczenia w przyszłości).

### 3. Panel Administratora (Dla Nauczyciela)
- **Zarządzanie Użytkownikami**: Lista kursantów, opcje usuwania i zmiany haseł dla wybranych kont.
- **Raporty Postępów**: Nauczyciel może podejrzeć logi ćwiczeń poszczególnych uczniów oraz opanowane przez nich słownictwo.
- **Zarządzanie Historią Lekcji**: Panel z osobnym oknem (modal) do dodawania oraz **edytowania** wpisów dotyczących odbytej lekcji. Nauczyciel wpisuje datę, temat, zrealizowane słownictwo oraz podsumowanie, co potem wyświetla się automatycznie na dashboardzie wybranego ucznia.

### 4. Inteligencja Aplikacji (Gemini API)
- **Nauczyciel AI**: Ocena wolnych tłumaczeń użytkownika na język angielski.
- **Generator Zadań na zawołanie**: Pobieranie kontekstu z konkretnej lekcji i zwracanie angażującej, sformatowanej (Markdown) i krótkiej pracy domowej dla ucznia, w oparciu o modele Gemini.

### 5. Wygląd i Ustawienia
- **Wielojęzyczność Interfejsu**: Opcja przełączania między językiem polskim i angielskim (na poziomie konta/ustawień).
- **Responsywny Design**: Ciemny, elegancki motyw oparty na kartach, z możliwością zwijania bocznego paska menu w celu odzyskania przestrzeni roboczej.

# Dokumentacja Aplikacji (Cribro Recall)

## Stack Technologiczny

Aplikacja została zbudowana w oparciu o nowoczesny, reaktywny stos technologiczny, zapewniający wysoką wydajność, bezpieczeństwo oraz skalowalność:

*   **Frontend:** React (wersja 18+), Vite (jako bundler)
*   **Język:** TypeScript (silne typowanie, interfejsy dla bezpieczeństwa i stabilności kodu)
*   **Style:** Tailwind CSS (utility-first CSS, responsywny design)
*   **Backend & Baza Danych (BaaS):** Firebase
    *   **Firebase Authentication:** Zarządzanie użytkownikami (rejestracja, logowanie), kontrola ról (uczeń, admin, admin_student).
    *   **Cloud Firestore:** Baza danych NoSQL do przechowywania zestawów fiszek, historii lekcji, dzienników ćwiczeń, statystyk użytkowników i notatek.
*   **Animacje:** Framer Motion (`motion/react`) dla płynnych przejść i mikrointerakcji.
*   **Architektura:** Single Page Application (SPA).

## Funkcje i Moduły

Aplikacja składa się z zaawansowanych modułów skierowanych do dwóch głównych ról: Kursanta i Nauczyciela (Administratora).

### Panel Kursanta (Dashboard)
1.  **Zestawy Słówek (Flashcards):**
    *   Przeglądanie i nauka z dedykowanych zestawów słówek i wyrażeń.
    *   Fiszki wspierane algorytmami powtórek (Spaced Repetition).
    *   Statystyki i historia nauki z fiszek.
2.  **Historia Lekcji:**
    *   Przeglądanie historii odbytych lekcji (temat, data).
    *   Dostęp do szczegółowych notatek z zajęć, podsumowań, wskazówek dotyczących wymowy i zadanych prac domowych.
3.  **Generowanie Ćwiczeń z AI:**
    *   Osobny moduł (AI Exercise Generator) do dynamicznego tworzenia materiałów szkoleniowych na podstawie wprowadzonych danych.
4.  **Ustawienia:**
    *   Zarządzanie profilem, ustawianie częstotliwości powtórek.
5.  **Testy i Ćwiczenia (Practice):**
    *   Sprawdzanie swojej wiedzy w różnych trybach ćwiczeń. Dzienniki z wynikiem (Practice Logs).

### Panel Nauczyciela (Admin Panel)
1.  **Zarządzanie Kursantami:**
    *   Przeglądanie wszystkich użytkowników, zmiana ról, modyfikacja profili.
2.  **Zarządzanie Lekcjami i Raporty (Lesson Records):**
    *   Zarządzanie historią lekcji dla konkretnego ucznia.
    *   Formularz tworzenia wpisu z lekcji z takimi polami jak: *Temat, Słownictwo, Podsumowanie, Revision Notes, O czym mówił kursant, Wymowa, Co poprawić, Praca domowa, Zadanie dodatkowe*.
3.  **Meeting Notes AI (Nowość):**
    *   Sekcja pozwalająca na wklejenie surowej transkrypcji (np. z Google Meet).
    *   Funkcja (aktualnie w przygotowaniu do integracji) automatycznego wyciągania podsumowań, słownictwa i uwag dla kursanta na bazie transkrypcji.
4.  **Baza Danych Słownictwa:**
    *   Globalne i lokalne zarządzanie zestawami słówek i tworzeniem fiszek na podstawie danych z lekcji.
5.  **Podgląd Statystyk (Admin Stats):**
    *   Analiza aktywności studenta: logowania, odbyta praktyka, skuteczność nauki słownictwa.

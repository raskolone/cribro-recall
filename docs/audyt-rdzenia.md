# Audyt rdzenia: stan aplikacji vs. specyfikacja

Rdzeń, który ma działać bez zarzutu:
**lekcja → zatwierdzony ślad → krótkie aktywne powtórki → kontekst przed następną lekcją.**

Raport opisuje różnice między tym, co jest w kodzie, a tabelami ze specyfikacji.
Bez zmian w kodzie — poza tym, co objął Priorytet 3, opisanym na końcu.

Legenda: **jest** / **częściowo** / **brak**.

---

## Panel nauczyciela

### 1. Lista kursantów — „Komu dziś poświęcić uwagę?"

Dziś: `components/admin/AdminPanel.tsx` (lista kont) + `components/admin/TeacherOverview.tsx`
(zwijany przegląd: liczba kursantów, aktywni w 7 dniach, nowi w 30 dniach, rozbicie na
poziomy, ostatnie logowania, statusy zadań).

| Wymaganie | Stan | Co dokładnie brakuje |
|---|---|---|
| Następna lekcja | **brak** | W modelu danych nie ma żadnego pola z terminem następnych zajęć — ani w `users`, ani w `lessonRecords`. To brak danych, nie brak widoku: bez nowego pola nie ma czego pokazać. |
| Data ostatniego kontaktu | **częściowo** | `users.lastLoginDate` mówi o logowaniu, nie o lekcji. Data ostatniej lekcji da się wyliczyć z `lessonRecords` (pole `date`), ale nie jest pokazywana przy kursancie na liście. |
| Liczba elementów wymagających decyzji | **częściowo** | `TeacherOverview` liczy zadania zbiorczo dla całego panelu (oczekujące / odesłane / po terminie), a nie per kursant. Nie wlicza też zestawów słownictwa w statusie `draft`, czyli tego, co faktycznie czeka na Twoją decyzję. |

**Wniosek:** ekran odpowiada dziś na „co się ogólnie dzieje", a nie na „komu dziś poświęcić
uwagę". Do zamknięcia luki potrzeba jednego nowego pola (termin następnej lekcji) i licznika
decyzji liczonego przy każdym kursancie.

### 2. Kontekst kursanta przed lekcją — „Co ostatnio robiliśmy i co dalej?"

Dziś: dane są komplet, widoku dedykowanego nie ma. `LessonRecord` niesie `lessonSummary`,
`studentSpeaking`, `thingsToImprove` i `suggestedFollowUp`; `LessonHistoryScreen` to renderuje.

| Wymaganie | Stan | Co dokładnie brakuje |
|---|---|---|
| Streszczenie ostatniej lekcji | **częściowo** | Jest w historii lekcji, ale trzeba do niego dojść: profil kursanta → historia → rozwinięcie właściwego wpisu. Nie ma ekranu „otwórz przed zajęciami", który podaje to od razu. |
| 3 najważniejsze elementy | **brak** | `VocabularySet` ma `itemCount` i `vocabularyText`, ale słownictwo jest jednym blokiem tekstu. Nic nie wskazuje, które elementy są najważniejsze — nie ma ani rangi, ani wyboru. |
| Elementy niestabilne | **brak widoku** | Podkolekcja `weaknesses` istnieje i jest zapisywana, ale w całym interfejsie nie ma miejsca, które by ją pokazywało. Dane idą wyłącznie do promptów AI (`getUserWeaknesses` w `AIExerciseGeneratorScreen`). Nauczyciel ich nie widzi. |

**Wniosek:** to największa luka po stronie nauczyciela — i jednocześnie najtańsza do zamknięcia,
bo wszystkie dane już są. Brakuje jednego ekranu, który je zbiera.

### 3. Zapis po lekcji — „Jak zostawić ślad w mniej niż 90 sekund?"

Dziś: najmocniejszy element rdzenia. Formularz lekcji w `AdminPanel` plus modal
„✨ AI Lesson Summary", który z wklejonych notatek ze spotkania wypełnia datę, temat
i wszystkie pola wpisu. `createLessonRecordWithVocabularySet` zapisuje wpis razem
z zestawem słownictwa.

| Wymaganie | Stan | Co dokładnie brakuje |
|---|---|---|
| Notatka / wklejone punkty | **jest** | — |
| Szkic AI | **jest** | `generateLessonSummary` wypełnia formularz z wklejonego tekstu lub pliku. |
| Wybór 3–10 elementów | **brak** | Słownictwo to jedno pole tekstowe (`vocabularyText`). Nie ma zaznaczania elementów ani żadnej granicy 3–10 — `itemCount` to tyle, ile się wkleiło. Flaga `status` (`draft`/`ready`) istnieje w modelu i jest przestawiana z kodu, ale w formularzu nie ma kroku „zatwierdzam te elementy". |
| Jeden następny krok | **jest** | Pole `suggestedFollowUp`. |

**Wniosek:** ślad powstaje szybko, ale nie jest *zatwierdzony* — a to właśnie „zatwierdzony ślad"
jest w rdzeniu. Bez kroku wyboru 3–10 elementów kolejne ogniwo (powtórki) dostaje surowy wklej,
a nie decyzję nauczyciela.

---

## Panel kursanta

### 1. Dzisiaj — „Masz skończoną krótką sesję"

Dziś: po zalogowaniu kursant trafia na `AIExerciseGeneratorScreen` — czyli na **konfigurator**,
nie na gotową sesję. Musi wybrać tryb, źródło i liczbę zdań, a potem poczekać na wygenerowanie.

| Wymaganie | Stan | Co dokładnie brakuje |
|---|---|---|
| 3–10 zadań z przypisanej pętli | **częściowo** | Domyślnie 5 zdań (mieści się w widełkach) i od tej zmiany domyślnym źródłem jest ostatnia lekcja. Ale nie ma „przypisanej pętli" — jest generowanie na żądanie. |
| Czas 3–7 min | **brak** | Nigdzie nie ma budżetu czasu ani informacji, ile sesja potrwa. Tryb `practiceMode: 'time'` istnieje, lecz nie jest osadzony w widełkach 3–7 min. |
| Bez feedu i rankingu | **jest** | Rankingu ani feedu w kodzie nie ma. Licznik passy zniknął z tego widoku w Priorytecie 3. |

**Wniosek:** obietnica „masz skończoną krótką sesję" nie jest dotrzymana — kursant dostaje
narzędzie do złożenia sesji, a nie sesję. To różnica kilku kliknięć i oczekiwania na AI.

### 2. Ostatnia lekcja — „Wiesz, co wynosisz ze spotkania"

| Wymaganie | Stan | Co dokładnie brakuje |
|---|---|---|
| Krótkie podsumowanie | **jest** | `LessonHistoryScreen` pokazuje `lessonSummary` i `thingsToImprove`. |
| Zatwierdzone elementy | **brak** | Nie ma listy elementów powiązanej z konkretną lekcją — patrz brak zatwierdzania po stronie nauczyciela. |
| Następny krok | **brak — i to jest błąd, nie luka** | W `components/dashboard/LessonHistoryScreen.tsx:699` `suggestedFollowUp` jest schowany za warunkiem `isTeacher`. Pole istnieje, nauczyciel je wypełnia, a kursant nigdy go nie widzi. Specyfikacja wymaga tego pola w widoku kursanta wprost. |

**Wniosek:** jedna linijka warunku odcina kursanta od „co dalej". To najtańsza poprawka
w całym raporcie i pierwsza, którą warto zrobić.

### 3. Powtórka — „Najpierw przypomnij sobie, potem sprawdź"

| Wymaganie | Stan | Co dokładnie brakuje |
|---|---|---|
| Kontekst | **częściowo** | Fiszka pokazuje samo hasło. Zdanie kontekstowe powstaje osobno (`generateContextSentence`), ale nie jest częścią powtórki. Tryb „Prawdziwe Wyzwanie" ma kontekst w postaci zdania do przetłumaczenia i jest od tej zmiany domyślny. |
| Próba odpowiedzi | **jest** | Fiszki: odwrócenie karty. Wpisywanie: pełne zdanie z pamięci. |
| Feedback | **jest** | Ocena AI z rozbiciem na znaczenie / gramatykę / słownictwo. |
| Sygnalizacja trudności | **częściowo** | Fiszki mają ocenę trudności odpowiedzi; w trybie wpisywania trudność wynika z wyniku, ale kursant nie zgłasza jej sam. |

### Audyt zlecony osobno: „Dopasowanie" i „Fiszki"

Brief prosił o sprawdzenie, czy te dwa tryby biorą materiał zatwierdzony po lekcji, czy
z ogólnego generatora. Oba wchodzą przez `handleStartOtherPractice`, które dobiera źródło
w kolejności: koszyk (jeśli wybrany) → jawnie wybrany zestaw → zaznaczone lekcje →
**`vocabularySets[0]`, czyli ostatnia lekcja** → koszyk.

Wniosek: przy domyślnych ustawieniach oba tryby sięgają po materiał z ostatniej lekcji,
a nie po ogólną pulę. Wymóg jest spełniony i nie wymaga zmian.

Zastrzeżenie do „Dopasowania": to nadal gra na rozpoznawanie, bez odpowiednika w metodyce
z raportu. Zgodnie z briefem zostaje bez nowych funkcji.

---

## Podsumowanie: kolejność łatania

1. **Odsłonić `suggestedFollowUp` kursantowi** — jedna linijka, zamyka wymóg „następny krok".
2. **Ekran kontekstu przed lekcją** — dane są komplet, brakuje widoku, który je zbiera
   (streszczenie + elementy + `weaknesses`).
3. **Krok zatwierdzania 3–10 elementów** po lekcji — bez niego „zatwierdzony ślad" z rdzenia
   nie istnieje, a wszystko dalej karmi się surowym wklejem.
4. **„Dzisiaj" jako gotowa sesja** zamiast konfiguratora.
5. **Termin następnej lekcji** — nowe pole, potem licznik decyzji per kursant na liście.

Pozycje 1–3 nie wymagają nowych danych. Pozycja 5 wymaga rozszerzenia modelu.

---

## Zmiany wprowadzone w Priorytecie 3 (dla kompletności)

- Licznik passy zniknął z panelu kursanta i z haseł na pulpicie; liczba zostaje w Statystykach.
- „Prawdziwe Wyzwanie" jest domyślnym i jedynym trybem na pierwszym planie.
- „Układanka" wypadła z ekranu startowego i z przełącznika w konfiguracji; wraca jako
  propozycja po dwóch nieudanych próbach z rzędu, tylko dla tego jednego zdania.
- Domyślnym źródłem materiału jest ostatnia lekcja; „Słownictwo ogólne: miks i koszyk"
  zjechało na koniec listy pod nagłówek „Opcje dodatkowe".
- Bez zmian, zgodnie z briefem: `AdminTestGenerator`, `AllTestsTeacherView`,
  `TopicDatabaseScreen`, AI Lesson Generator, AI Live Monitor.

# ZAKOLEJKOWANE: przebudowa panelu lektora

Zadanie zgłoszone przez Macieja 2026-09-12, do wykonania **po** domknięciu
jakości ćwiczeń testowych. Zapisane, żeby nie przepadło między zadaniami.

Cel nadrzędny, jego słowami: *„nie mam zamiaru zajmować się wiecznie
interfejsem użytkownika, tylko chcę przejść do rozbudowania narzędzi
lektorskich"*. Czyli: jedna porządna przebudowa, a nie seria poprawek.

---

## 1. Powiadomienia o pracach do oceny

**Teraz:** pokazują się w sidebarze.

**Ma być:** znikają z sidebara. Pojawiają się w panelu lektora jako mały
komunikat **tuż nad trzema głównymi kafelkami**, obok napisu „Główne narzędzia
lektora".

Treść: jeśli jest praca domowa do ocenienia albo zwrócony test — krótka
informacja, że wymagana jest akcja lektora. Bez rozbudowanej listy; to ma być
sygnał, nie kolejny ekran.

---

## 2. Nowy układ panelu lektora

### Trzy duże kafelki — najważniejsze narzędzia

| # | Teraz | Ma być |
|---|---|---|
| 1 | Planer lekcji AI | **Profil kursantów** → wybór kursanta → karta kursanta |
| 2 | Prezentacja | Prezentacja |
| 3 | Notatnik / Mailing | do ustalenia przy projektowaniu |

### Listwa narzędzi pod kafelkami

Pod kafelkami **listwa o połowę (lub 1/3) niższa** niż kafelek, z pozostałymi
narzędziami w mniejszych ikonach, rozłożonymi symetrycznie:

- Planer lekcji
- Narzędzie prezentacji
- Notatnik
- Mailing

Ma być wyraźnie widać, co jest czym. Wszystkie narzędzia lektora w **jednym
miejscu** — teraz są rozstrzelone po panelu.

### Do schowania (NIE kasować — ukryć z widoku)

- **Przegląd panelu** — na razie ma zniknąć
- **Historia lekcji z Notion** — znika z panelu, ma być w funkcjach przy kursancie
- **AI Lesson Generator** — znika
- **Dodaj kursanta** — znika z panelu; zarządzanie kursantami przenosi się do
  zakładki **Baza kursantów** w sidebarze
- **Synchronizacja z Notion** i inne narzędzia ogólne — do toolbara

---

## 3. Karta kursanta

Po wejściu w profil kursanta **wyłącznie rzeczy związane z tym kursantem**:

- Historia lekcji
- **Historia prac domowych** — podgląd, co kursant do tej pory zrobił
  (wrzucone razem z historią lekcji)
- Słownictwo AI — zostaje
- Testy z AI — przypisywane bezpośrednio do kursanta
- Statystyki — zostają

**Generator prac domowych** ma być osobną funkcją, nie częścią karty.

---

## 4. Nazewnictwo

**„Brudnopis" ma zniknąć z interfejsu. Wszędzie ma być „Notatnik".**

To jedno narzędzie, a występuje pod dwiema nazwami i w kilku miejscach naraz —
do zebrania w jedno miejsce i jedną nazwę.

Uwaga techniczna: kolekcja w bazie nazywa się `scratchpads`, a serwis
`scratchpadService.ts`. Nazwy w kodzie i w bazie **zostają** — zmiana dotyczy
wyłącznie tego, co widzi użytkownik. Migracja kolekcji nie jest tego warta.

---

## 5. Uwagi do zaprojektowania

Maciej wprost poprosił o pomoc w przekształceniu zamysłu w spójną wizję, więc
przy realizacji trzeba rozstrzygnąć:

- **Co jest trzecim kafelkiem.** Jeśli 1. to Profil kursantów, a 2. Prezentacja,
  to trzeci powinien odpowiadać na pytanie „co robię najczęściej" — kandydaci:
  Notatnik (używany na każdej lekcji) albo Planer lekcji (używany przed każdą).
  Mailing jest rzadszy i pasuje raczej do listwy.
- **Czy „Profil kursantów" i „Baza kursantów" to nie są dwie nazwy na to samo.**
  Jeśli kafelek prowadzi do wyboru kursanta, a zakładka w sidebarze do
  zarządzania kontami, nazwy muszą to rozróżniać, inaczej lektor będzie zgadywał.
- **Gdzie ląduje powiadomienie**, gdy lektor jest już w karcie kursanta.

---

## Stan

⏳ **Niezaczęte.** Do wykonania po domknięciu jakości ćwiczeń testowych.

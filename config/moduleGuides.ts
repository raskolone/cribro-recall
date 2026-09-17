export interface ModuleGuide {
  id: string;
  title: string;
  badge: string;
  summary: string;
  steps: { title: string; desc: string }[];
  proTip?: string;
}

export const MODULE_GUIDES: Record<string, ModuleGuide> = {
  'lesson-planner': {
    id: 'lesson-planner',
    title: 'Lesson Planner 2.0',
    badge: 'Blokowy Konspekt',
    summary:
      'Moduł planowania lekcji pozwala ułożyć jednostkę dydaktyczną z podziałem na bloki czasowe — każdy z typem, tytułem i opisem ćwiczenia. Całkowity czas sumuje się automatycznie, a gotowy konspekt można powiązać z prezentacją lub notatnikiem.',
    steps: [
      {
        title: 'Wybierz kursanta i datę',
        desc: 'Wskaż kursanta z listy, ustaw datę lekcji i wpisz główny cel zajęć — pojawi się w nagłówku konspektu.',
      },
      {
        title: 'Dodaj i ułóż bloki',
        desc: 'Kliknij „+ Dodaj blok", wybierz typ (Warm-up, Recall, Speaking…) i określ czas w minutach. Bloki możesz przeciągać, by zmienić kolejność.',
      },
      {
        title: 'Wypełnij treść i powiąż ze slajdami',
        desc: 'W każdym bloku opisz ćwiczenie lub wklej kluczowe zwroty. Opcjonalnie podlinkuj konkretny slajd z modułu Presentation Studio.',
      },
      {
        title: 'Zapisz i zatwierdź',
        desc: 'Kliknij „Zapisz konspekt". Status zmieni się na „Zatwierdzona". Konspekt jest widoczny w historii danego kursanta.',
      },
    ],
    proTip:
      'Optymalny rozkład dla 45-minutowej lekcji to: Warm-up 5 min → Recall 10 min → Speaking 25 min → Feedback 5 min. Pasek czasu zmienia kolor, gdy przekroczysz 60 minut.',
  },

  'presentation-studio': {
    id: 'presentation-studio',
    title: 'Presentation Studio',
    badge: 'Slajdy 16:9',
    summary:
      'Interaktywny edytor slajdów w formacie 16:9, działający bezpośrednio w przeglądarce. Slajdy zapisywane są w Firestore jako dane JSON — bez zewnętrznych plików. Wbudowany generator AI (dual-pass) tworzy gotową prezentację z notatek tekstowych w kilka sekund.',
    steps: [
      {
        title: 'Wybierz lub utwórz prezentację',
        desc: 'Kliknij „Biblioteka prezentacji", by wczytać istniejący deck, albo zacznij od pustego płótna. Każda prezentacja należy do Twojej prywatnej bazy i może być przypisana do wielu kursantów.',
      },
      {
        title: 'Dodaj i edytuj slajdy',
        desc: 'W lewym panelu: zakładka „Slajdy" — miniaturki i nowy slajd, „Szablony" — gotowe układy (Tytuł, Dialog, Słownictwo), „Multimedia" — wgraj zdjęcia z dysku.',
      },
      {
        title: 'Użyj generatora AI (Dual-Pass)',
        desc: 'W zakładce „Generator AI" wklej notatki lub słownictwo z lekcji. AI wykona dwa przejścia: pierwsze tworzy strukturę, drugie dopracowuje treść każdego slajdu. Wynik pojawia się natychmiast.',
      },
      {
        title: 'Przypisz kursantów i zapisz',
        desc: 'Kliknij „Przypisz kursantów" na górnym pasku, zaznacz wybrane osoby. Kliknij „Zapisz" — prezentacja jest dostępna dla kursantów w ich panelu.',
      },
    ],
    proTip:
      'Grafiki wgrywane z dysku są automatycznie kompresowane do Base64 i skalowane, by dokument Firestore nie przekroczył limitu 1 MB. Jeśli slajd jest zbyt ciężki, pojawi się ostrzeżenie — zmniejsz rozdzielczość zdjęcia lub usuń nadmiarowe elementy.',
  },
};

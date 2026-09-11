import type { CoachStep } from '../../ui/CoachMarks';

interface CoachControls {
  /** Rozwija menu „Talia", żeby samouczek mógł wskazać schowane w nim pozycje. */
  setDeckMenuOpen: (open: boolean) => void;
}

/**
 * Treść samouczka Prezentacji.
 *
 * Opisy mówią, co funkcja daje na lekcji, a nie co robi przycisk — lektor
 * czyta je raz i ma zdecydować, kiedy po nie sięgnąć, a nie nauczyć się mapy
 * interfejsu.
 */
export const buildPresentationCoachSteps = ({ setDeckMenuOpen }: CoachControls): CoachStep[] => {
  const insideDeckMenu = {
    onBeforeShow: () => setDeckMenuOpen(true),
    preferredPlacement: 'left' as const,
  };

  return [
    {
      coachId: 'pres-identity',
      group: 'Podstawy',
      title: 'Nagłówek talii i autozapis',
      description:
        'Pokazuje tytuł prezentacji, poziom kursanta i liczbę slajdów. Obok tytułu widnieje stan zapisu — talia i notatnik zapisują się same, dwie sekundy po ostatniej zmianie.',
      tip: 'Jeśli zobaczysz tu informację o zapisie wyłącznie lokalnym, prezentacja nie trafiła do chmury i nie otworzysz jej na drugim komputerze.',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pres-whiteboard',
      group: 'Narzędzia na żywo',
      title: 'Tablica',
      description:
        'Otwiera warstwę do rysowania nałożoną na bieżący slajd. Możesz podkreślić końcówkę czasownika albo rozrysować szyk zdania wprost na materiale, który kursant właśnie ogląda.',
      tip: 'Rysunek należy do slajdu — po przejściu dalej znika, żeby nie zasłaniać nowej treści kreskami, które już nic nie znaczą.',
      shortcut: 'W',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pres-scratchpad',
      group: 'Narzędzia na żywo',
      title: 'Brudnopis kursanta',
      description:
        'Otwiera stały, współdzielony dokument kursanta — jeden na całą naukę, w stylu Google Docs. Piszecie w nim oboje w czasie rzeczywistym, a kursant otwiera go linkiem na telefonie bez logowania.',
      tip: 'Wracasz do tego samego dokumentu na każdej lekcji. Wstaw na początku datę, a historia nauki zbuduje się sama.',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pres-laser',
      group: 'Narzędzia na żywo',
      title: 'Wskaźnik laserowy',
      description:
        'Zamienia kursor w świecącą kropkę widoczną na slajdzie. Służy do prowadzenia wzroku kursanta po dłuższym tekście albo tabeli odmian.',
      shortcut: 'L',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pres-notebook',
      group: 'Widok',
      title: 'Notatnik lekcyjny',
      description:
        'Pokazuje lub chowa boczny panel z zakładkami: nowe słówka, poprawki błędów, luźne notatki i minutnik ćwiczeń. Schowanie panelu oddaje całą szerokość slajdowi.',
      shortcut: 'N',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pres-fullscreen',
      group: 'Widok',
      title: 'Pełny ekran',
      description:
        'Rozciąga prezentację na cały monitor i chowa resztę panelu. W tym trybie na dole pojawia się ściągawka ze skrótami klawiszowymi.',
      shortcut: 'F',
      preferredPlacement: 'left',
    },
    {
      coachId: 'pres-deck-menu',
      group: 'Menu talii',
      title: 'Wszystko, co robisz przed lekcją',
      description:
        'Pod tym menu leżą operacje na całej talii: tworzenie slajdów, generowanie z AI, import konspektu i biblioteka zapisanych prezentacji. Nie zaśmiecają paska, bo sięgasz po nie w przygotowaniach, a nie w trakcie mówienia.',
      preferredPlacement: 'left',
    },
    {
      ...insideDeckMenu,
      coachId: 'pres-menu-new-slide',
      group: 'Menu talii',
      title: 'Nowy slajd',
      description:
        'Otwiera edytor pustego slajdu. Wybierasz typ — tekst, lista słówek, ćwiczenie z lukami, pytania do dyskusji — i wypełniasz go ręcznie.',
    },
    {
      ...insideDeckMenu,
      coachId: 'pres-menu-ai-deck',
      group: 'Menu talii',
      title: 'Generowanie całej talii',
      description:
        'Tworzy kompletną prezentację na zadany temat i poziom. Bierze pod uwagę ostatnie błędy kursanta z dziennika lekcji, więc ćwiczenia trafiają w jego realne braki.',
      tip: 'Zanim wygenerujesz talię, zajrzyj do Wytycznych CELTA — opisują strukturę, na której opiera się generator.',
    },
    {
      ...insideDeckMenu,
      coachId: 'pres-menu-import',
      group: 'Menu talii',
      title: 'Import konspektu',
      description:
        'Zamienia gotowy materiał — konspekt, notatki z podręcznika, wcześniejszą lekcję z dziennika — w talię slajdów, bez przepisywania treści ręcznie.',
    },
    {
      ...insideDeckMenu,
      coachId: 'pres-menu-library',
      group: 'Menu talii',
      title: 'Biblioteka prezentacji',
      description:
        'Lista zapisanych talii tego kursanta. Otwiera panel, z którego wczytasz wcześniejszą prezentację albo usuniesz nieaktualną.',
    },
    {
      ...insideDeckMenu,
      coachId: 'pres-menu-guidelines',
      group: 'Menu talii',
      title: 'Wytyczne CELTA / ESA',
      description:
        'Ściągawka metodyczna: jak zbudować lekcję w układzie Engage – Study – Activate i jakich zasad trzyma się generator slajdów.',
      onAfterShow: () => setDeckMenuOpen(false),
    },
    {
      coachId: 'pres-slide-nav',
      group: 'Nawigacja',
      title: 'Pasek slajdów',
      description:
        'Przewija talię i pokazuje numerowane miniatury — klikasz numer, żeby skoczyć wprost do slajdu. Najedź na numer, aby zobaczyć tytuł slajdu.',
      tip: 'W trakcie lekcji wygodniej jest używać spacji i strzałek niż celować myszą w numery.',
      preferredPlacement: 'top',
    },
    {
      coachId: 'pres-slide-actions',
      group: 'Nawigacja',
      title: 'Akcje bieżącego slajdu',
      description:
        'Dotyczą wyłącznie slajdu, który masz na ekranie: poprawienie go przez AI, ręczna edycja treści oraz usunięcie z talii.',
      preferredPlacement: 'top',
    },
    {
      coachId: 'pres-presenter-panel',
      group: 'Prowadzenie',
      title: 'Panel prowadzącego',
      description:
        'Twoja część ekranu, której kursant nie widzi: notatki do slajdu, podgląd następnego, minutnik oraz uruchomienie sesji Live na PIN dla kursantów zdalnych.',
      tip: 'Sesja Live daje kursantowi ten sam slajd, tablicę i notatnik na jego własnym urządzeniu — wystarczy, że wpisze kod PIN.',
      preferredPlacement: 'top',
    },
    {
      coachId: 'pres-live-notebook',
      group: 'Prowadzenie',
      title: 'Notatnik lekcyjny',
      description:
        'Łapiesz tu w locie wszystko, co pada na lekcji: nowe słówka z tłumaczeniem i wymową, poprawki błędów w układzie „powiedział → poprawnie" oraz minutnik na ćwiczenia.',
      tip: 'Na koniec lekcji jedno kliknięcie „Przenieś do Dziennika lekcji" przepisuje słówka i poprawki do 4 bloków Notion.',
      preferredPlacement: 'left',
    },
  ];
};

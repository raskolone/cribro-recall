import { CoachStep } from '../ui/CoachMarks';

/**
 * Przewodniki powitalne — kursanta i lektora.
 *
 * ══ DLACZEGO DYMKI PRZY ELEMENTACH, A NIE OSOBNY POKAZ ══
 *
 * Poprzedni przewodnik rysował WŁASNY obrazek tego, co opisuje: dymek mówił
 * „tu masz swoje zadania", a obok stała narysowana atrapa kafelka zadań.
 * Człowiek uczył się więc atrapy, a nie aplikacji — a potem szukał na ekranie
 * czegoś, co wyglądało jak rysunek, i nie znajdował.
 *
 * `CoachMarks` (ten sam mechanizm, co samouczek w notatniku) robi coś
 * odwrotnego: przyciemnia ekran, WYCINA w nim prawdziwy element i przypina
 * dymek do niego. Po zamknięciu przewodnika na ekranie zostaje dokładnie to,
 * co przed chwilą było podświetlone.
 *
 * ══ DLACZEGO KROKÓW JEST MAŁO ══
 *
 * Przewodnik pokazuje się raz, przy pierwszym wejściu, i nikt nie czyta go
 * w skupieniu. Siedem kroków znaczy, że ostatnie trzy przeklika się bez
 * czytania. Tu jest tyle kroków, ile jest miejsc, do których naprawdę trzeba
 * trafić — reszta obroni się sama.
 */

export const buildStudentTourSteps = (): CoachStep[] => [
  {
    coachId: 'tour-hero',
    group: 'Twój panel',
    title: 'Wszystko, co dziś ważne',
    description:
      'Tu widzisz, ile masz już za sobą i czy lektor coś dla Ciebie zostawił. Jeśli nie ma zadań, dostajesz propozycję ćwiczeń na dziś.',
    tip: 'Wracaj tu między lekcjami — panel sam mówi, co warto zrobić.',
    preferredPlacement: 'bottom',
  },
  {
    coachId: 'tour-resources',
    group: 'Od lektora i własne',
    title: 'Moje zasoby',
    description:
      'Wszystkie Twoje zadania domowe, testy sprawdzające oraz zestawy słownictwa i fiszki zebrane w jednym wygodnym miejscu.',
    tip: 'Kropka na kafelku oznacza nową lub ocenioną pracę domową.',
  },
  {
    coachId: 'tour-history',
    group: 'Twoje postępy',
    title: 'Historia',
    description:
      'Kompletny zapis Twojej nauki: podsumowania wcześniejszych lekcji z notatkami lektora oraz historia zrealizowanych sesji ćwiczeń.',
    tip: 'Możesz wracać do materiałów z dowolnej wcześniejszej lekcji.',
  },
  {
    coachId: 'tour-scratchpad',
    group: 'Na lekcji',
    title: 'Mój notatnik',
    description:
      'Wspólny dokument, w którym lektor pisze w trakcie zajęć. Widzisz go na żywo, a gdy lektor na to pozwoli — możesz dopisywać.',
    tip: 'Notatnik zostaje po lekcji. Zawsze możesz do niego wrócić.',
  },
];

export const buildTeacherTourSteps = (): CoachStep[] => [
  {
    coachId: 'tour-teacher-main',
    group: 'Prowadzenie lekcji',
    title: 'Cztery kafelki, jeden pulpit',
    description:
      'Dzisiaj (Cockpit) do bieżącej roboty, Moi kursanci to Twoja baza CRM, Moje lekcje to notatki i historia, a Narzędzia lektora chowają resztę — notatnik, zadania, planer, mailing, słownictwo i statystyki.',
    preferredPlacement: 'bottom',
  },
  {
    coachId: 'tour-teacher-tools',
    group: 'Reszta panelu',
    title: 'Narzędzia lektora',
    description:
      'Notatnik na żywo, zadania i testy, planer lekcji, mailing, słownictwo i statystyki — jeden kafelek otwiera lekki podwidok ze wszystkimi naraz, więc nie zaśmiecają strony głównej.',
    tip: 'Kursant do notatnika wchodzi linkiem albo PIN-em, bez logowania.',
  },
];

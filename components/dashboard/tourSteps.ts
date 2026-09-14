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
    coachId: 'tour-homework',
    group: 'Od lektora',
    title: 'Moje zadania',
    description:
      'Prace domowe przypisane przez lektora. Kropka na kafelku znaczy, że czeka coś nowego albo że Twoja praca została oceniona.',
    tip: 'Odpowiedzi sprawdzają się od razu — nie musisz czekać na lekcję.',
  },
  {
    coachId: 'tour-tests',
    group: 'Od lektora',
    title: 'Moje testy',
    description:
      'Testy sprawdzające ułożone z materiału z Twoich lekcji. Znajdziesz tu też wyniki poprzednich podejść.',
  },
  {
    coachId: 'tour-flashcards',
    group: 'Twoje słownictwo',
    title: 'Moje słownictwo',
    description:
      'Zestawy słówek powstają automatycznie z każdej lekcji. Możesz się ich uczyć fiszkami albo przećwiczyć je w zdaniach.',
    tip: 'Własne zestawy też możesz tu tworzyć — nikt poza Tobą ich nie widzi.',
  },
  {
    coachId: 'tour-history',
    group: 'Twoje lekcje',
    title: 'Wcześniejsze lekcje',
    description:
      'Notatki z odbytych zajęć: o czym rozmawialiście, jakie słowa padły i co było do poprawy.',
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
    title: 'Trzy narzędzia na każdą lekcję',
    description:
      'Profil kursanta, kontekst przed lekcją i notatnik. To jest komplet do przeprowadzenia zajęć — reszta panelu obsługuje to, co dzieje się między nimi.',
    preferredPlacement: 'bottom',
  },
  {
    coachId: 'tour-teacher-context',
    group: 'Przed lekcją',
    title: 'Kontekst przed lekcją',
    description:
      'Wybierasz kursanta i zakres — ostatnią lekcję, dwie albo trzy — a model układa z notatek krótką odprawę: co się działo, o czym mówił kursant, jakie słowa padły i co się chwieje.',
    tip: 'Otwórz to na minutę przed zajęciami zamiast czytać historię lekcji.',
  },
  {
    coachId: 'tour-teacher-scratchpad',
    group: 'W trakcie lekcji',
    title: 'Notatnik',
    description:
      'Wspólny dokument na żywo. Otwiera się pusty — kursanta przypisujesz w trakcie, a wtedy treść trafia do jego stałego notatnika.',
    tip: 'Kursant wchodzi linkiem albo PIN-em, bez logowania.',
  },
  {
    coachId: 'tour-teacher-work',
    group: 'Między lekcjami',
    title: 'Zadania i testy',
    description:
      'Jedno miejsce na przypisywanie, ocenianie i przeglądanie prac domowych oraz testów.',
  },
  {
    coachId: 'tour-teacher-more',
    group: 'Reszta panelu',
    title: 'Więcej narzędzi',
    description:
      'Planer lekcji, prezentacja, słownictwo i statystyki. Zwinięte, bo sięga się po nie rzadziej niż co zajęcia.',
    preferredPlacement: 'top',
  },
];

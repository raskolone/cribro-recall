import type { CoachStep } from '../ui/CoachMarks';

interface CoachControls {
  setStyleMenuOpen: (open: boolean) => void;
  setInsertMenuOpen: (open: boolean) => void;
  setShareMenuOpen: (open: boolean) => void;
  /** Kroki dostępne wyłącznie dla lektora — kursant ich nie zobaczy. */
  isTeacher: boolean;
  canPushToLesson: boolean;
  /** W trybie podglądu nie ma paska formatowania, więc te kroki odpadają. */
  canFormat: boolean;
}

/**
 * Treść samouczka Brudnopisu.
 *
 * Kroki dobierają się do roli: kursant nie dostaje opisu przełączników, których
 * nie ma na swoim ekranie, bo samouczek celowałby w nieistniejący element.
 */
export const buildScratchpadCoachSteps = ({
  setStyleMenuOpen,
  setInsertMenuOpen,
  setShareMenuOpen,
  isTeacher,
  canPushToLesson,
  canFormat,
}: CoachControls): CoachStep[] => {
  const steps: CoachStep[] = [
    {
      coachId: 'pad-identity',
      group: 'Podstawy',
      title: 'Jeden dokument na całą naukę',
      description:
        'To stały notatnik tego kursanta — nie tworzy się nowego pliku na każdą lekcję. Obok tytułu widać, czy zmiany trafiły już do chmury, oraz kto pisał ostatni.',
      tip: 'Zapis idzie automatycznie, ułamek sekundy po tym, jak przestaniesz pisać.',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pad-editor',
      group: 'Podstawy',
      title: 'Wspólna kartka',
      description:
        'Piszecie tu oboje naraz, jak w dokumencie Google. To, co wpiszesz, pojawia się u kursanta w tej samej sekundzie — również na jego telefonie otwartym z linku.',
      preferredPlacement: 'top',
    },
  ];

  const formattingSteps: CoachStep[] = [
    {
      coachId: 'pad-style',
      group: 'Formatowanie',
      title: 'Styl tekstu',
      description:
        'Nagłówki i style zapisu. Nagłówek drugiego stopnia oznacza zwykle datę lekcji, trzeciego — sekcję w środku lekcji.',
      preferredPlacement: 'bottom',
      onBeforeShow: () => setStyleMenuOpen(true),
      onAfterShow: () => setStyleMenuOpen(false),
    },
    {
      coachId: 'pad-highlighters',
      group: 'Formatowanie',
      title: 'Zakreślacze lektorskie',
      description:
        'Zaznacz fragment i nadaj mu znaczenie: czerwony to błąd kursanta, zielony poprawna forma, żółty nowe słówko. Kolory pełnią rolę znaczników — kursant wraca do notatek i od razu widzi, co było czym.',
      tip: 'Te trzy kolory czyta też funkcja przenoszenia do dziennika, więc konsekwentne zakreślanie oszczędza pracy po lekcji.',
      preferredPlacement: 'bottom',
    },
    {
      coachId: 'pad-insert',
      group: 'Formatowanie',
      title: 'Wstawianie gotowych elementów',
      description:
        'Listy, linia oddzielająca, nagłówek z dzisiejszą datą oraz — dla lektora — zapisane szablony sekcji (słownictwo, poprawki, ustalenia) do wstawienia jednym kliknięciem.',
      tip: 'Zacznij lekcję od wstawienia daty — notatnik sam ułoży się w chronologiczną historię nauki.',
      preferredPlacement: 'bottom',
      onBeforeShow: () => setInsertMenuOpen(true),
      onAfterShow: () => setInsertMenuOpen(false),
    },
    {
      coachId: 'pad-history',
      group: 'Formatowanie',
      title: 'Cofanie zmian',
      description: 'Cofa i przywraca ostatnie zmiany w treści, tak jak w każdym edytorze tekstu.',
      shortcut: 'Ctrl+Z',
      preferredPlacement: 'bottom',
    },
  ];

  if (canFormat) steps.push(...formattingSteps);

  if (isTeacher) {
    steps.push({
      coachId: 'pad-share',
      group: 'Dostęp',
      title: 'Udostępnianie i uprawnienia',
      description:
        'Pod tym menu jest wszystko, co decyduje o dostępie kursanta: link bezpośredni, kod PIN, wymóg podania PIN-u oraz zgoda na to, by kursant sam pisał w dokumencie.',
      tip: 'Domyślnie link otwiera notatnik od razu. PIN włącz tylko wtedy, gdy zależy Ci na dodatkowej zaporze.',
      preferredPlacement: 'bottom',
      onBeforeShow: () => setShareMenuOpen(true),
    });

    steps.push({
      coachId: 'pad-menu-student-edit',
      group: 'Dostęp',
      title: 'Edycja po stronie kursanta',
      description:
        'Przełącznik decyduje, czy kursant tylko patrzy, czy również pisze. Na ćwiczeniach pisemnych włącz edycję, przy dyktowaniu zostaw sam podgląd.',
      preferredPlacement: 'left',
      onBeforeShow: () => setShareMenuOpen(true),
      onAfterShow: () => setShareMenuOpen(false),
    });
  }

  if (canPushToLesson) {
    steps.push({
      coachId: 'pad-push',
      group: 'Po lekcji',
      title: 'Przeniesienie do dziennika',
      description:
        'Czyta notatnik i rozkłada go na 4 bloki Notion: słownictwo, poprawki, podsumowanie i zadanie. Otwiera gotowy formularz lekcji, który wystarczy przejrzeć i zapisać.',
      tip: 'Działa najlepiej, gdy notatki mają nagłówki sekcji — wstawisz je jednym kliknięciem z menu „Wstaw”.',
      preferredPlacement: 'bottom',
    });
  }

  return steps;
};
